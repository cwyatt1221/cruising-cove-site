import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { adminAuthOk } from "../lib/adminAuth";
import { sendEmail } from "../lib/email";
import {
  TipMilestoneId,
  buildTipEmail,
  daysUntilEmbark,
  parseTipsSent,
  selectMilestone,
  serializeTipsSent,
  tipSubject,
} from "../lib/newsletterTips";

const TABLE_NAME = "NewsletterSignups";

let tableClient: TableClient | null = null;

async function getTableClient(): Promise<TableClient> {
  if (!tableClient) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
    tableClient = TableClient.fromConnectionString(connectionString, TABLE_NAME);
    await tableClient.createTable();
  }
  return tableClient;
}

function todayYmdUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export interface TipRunResult {
  scanned: number;
  eligible: number;
  sent: number;
  skipped: number;
  errors: number;
  dryRun: boolean;
  details: {
    email: string;
    signupId: string;
    milestone: TipMilestoneId;
    subject: string;
    action: "sent" | "would_send" | "error";
    error?: string;
  }[];
}

/**
 * Scan NewsletterSignups for sailing-tip drips. Idempotent via tipsSent JSON array.
 * Sends at most one tip per signup per run.
 */
export async function runNewsletterTipDrip(
  context: InvocationContext,
  opts: { dryRun?: boolean; limitDetails?: number } = {}
): Promise<TipRunResult> {
  const dryRun = Boolean(opts.dryRun);
  const limitDetails = opts.limitDetails ?? 50;
  const today = todayYmdUtc();
  const result: TipRunResult = {
    scanned: 0,
    eligible: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    dryRun,
    details: [],
  };

  const client = await getTableClient();
  for await (const entity of client.listEntities()) {
    result.scanned += 1;

    const sailingTips = Boolean(entity.sailingTips);
    const embarkationDate = String(entity.embarkationDate ?? "").trim();
    if (!sailingTips || !embarkationDate) {
      result.skipped += 1;
      continue;
    }

    const daysUntil = daysUntilEmbark(embarkationDate, today);
    if (daysUntil === null || daysUntil < 0) {
      result.skipped += 1;
      continue;
    }

    const tipsSent = parseTipsSent(entity.tipsSent);
    const milestone = selectMilestone(daysUntil, tipsSent);
    if (!milestone) {
      result.skipped += 1;
      continue;
    }

    result.eligible += 1;
    const email = String(entity.email ?? entity.partitionKey ?? "").trim();
    const name = String(entity.name ?? "").trim();
    const shipLabel = String(entity.shipLabel ?? "").trim();
    const partitionKey = String(entity.partitionKey);
    const rowKey = String(entity.rowKey);
    const subject = tipSubject(shipLabel, milestone);
    const content = buildTipEmail(milestone.id, { name, shipLabel, embarkationDate });

    if (dryRun) {
      if (result.details.length < limitDetails) {
        result.details.push({
          email,
          signupId: rowKey,
          milestone: milestone.id,
          subject,
          action: "would_send",
        });
      }
      result.sent += 1;
      continue;
    }

    try {
      const ok = await sendEmail(email, subject, content.html, content.text);
      if (!ok) {
        result.errors += 1;
        context.warn(`Tip ${milestone.id} for ${rowKey} not sent (check RESEND_API_KEY / RESEND_FROM_EMAIL).`);
        if (result.details.length < limitDetails) {
          result.details.push({
            email,
            signupId: rowKey,
            milestone: milestone.id,
            subject,
            action: "error",
            error: "sendEmail returned false",
          });
        }
        continue;
      }

      const nextSent = serializeTipsSent([...tipsSent, milestone.id]);
      await client.updateEntity(
        {
          partitionKey,
          rowKey,
          etag: entity.etag,
          tipsSent: nextSent,
          lastTipSentAt: new Date().toISOString(),
          lastTipMilestone: milestone.id,
        },
        "Merge"
      );
      result.sent += 1;
      if (result.details.length < limitDetails) {
        result.details.push({
          email,
          signupId: rowKey,
          milestone: milestone.id,
          subject,
          action: "sent",
        });
      }
    } catch (err) {
      result.errors += 1;
      const message = err instanceof Error ? err.message : String(err);
      context.error(`Tip drip failed for ${rowKey}:`, err);
      if (result.details.length < limitDetails) {
        result.details.push({
          email,
          signupId: rowKey,
          milestone: milestone.id,
          subject,
          action: "error",
          error: message,
        });
      }
    }
  }

  return result;
}

/** Daily 14:00 UTC — sailing tip drip for NewsletterSignups. */
export async function newsletterTipsTimer(timer: Timer, context: InvocationContext): Promise<void> {
  void timer;
  try {
    const summary = await runNewsletterTipDrip(context, { dryRun: false });
    context.log(
      `newsletterTipsTimer: scanned=${summary.scanned} eligible=${summary.eligible} sent=${summary.sent} skipped=${summary.skipped} errors=${summary.errors}`
    );
  } catch (err) {
    context.error("newsletterTipsTimer failed:", err);
  }
}

/**
 * Manual / dry-run: GET /api/newsletter/tips/run?key=…&dryRun=1
 * Requires REPORT_ACCESS_KEY (or admin session). Use dryRun=1 to avoid sending.
 */
export async function newsletterTipsRun(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!(await adminAuthOk(request))) {
    return { status: 401, jsonBody: { error: "Unauthorized." } };
  }

  const dryParam = (request.query.get("dryRun") || request.query.get("dry") || "").toLowerCase();
  const dryRun = dryParam === "1" || dryParam === "true" || dryParam === "yes";

  try {
    const summary = await runNewsletterTipDrip(context, { dryRun });
    return {
      status: 200,
      jsonBody: {
        success: true,
        ...summary,
        message: dryRun
          ? "Dry run only — no emails sent and tipsSent was not updated."
          : "Tip drip run complete.",
      },
    };
  } catch (err) {
    context.error("newsletterTipsRun failed:", err);
    return { status: 500, jsonBody: { error: "Tip drip run failed." } };
  }
}

app.timer("newsletterTipsTimer", {
  schedule: "0 0 14 * * *", // daily 14:00 UTC
  handler: newsletterTipsTimer,
});

app.http("newsletterTipsRun", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "newsletter/tips/run",
  handler: newsletterTipsRun,
});
