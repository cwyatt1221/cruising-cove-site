import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomBytes, randomUUID } from "crypto";
import { escapeHtml, notifyOwnerOfSubmitError, safeField, sendEmail } from "../lib/email";

const TABLE_NAME = "NewsletterSignups";

const SHIPS: { slug: string; label: string }[] = [
  { slug: "disney-magic", label: "Disney Magic" },
  { slug: "disney-wonder", label: "Disney Wonder" },
  { slug: "disney-dream", label: "Disney Dream" },
  { slug: "disney-fantasy", label: "Disney Fantasy" },
  { slug: "disney-wish", label: "Disney Wish" },
  { slug: "disney-treasure", label: "Disney Treasure" },
  { slug: "disney-destiny", label: "Disney Destiny" },
  { slug: "disney-adventure", label: "Disney Adventure" },
];

const SHIP_BY_SLUG = new Map(SHIPS.map((s) => [s.slug, s.label]));
const SHIP_BY_LABEL = new Map(SHIPS.map((s) => [s.label.toLowerCase(), s]));

interface NewsletterInput {
  email?: string;
  name?: string;
  ship?: string;
  embarkationDate?: string;
  sailingTips?: boolean;
  pageUrl?: string;
}

interface UnsubscribeInput {
  email?: string;
  token?: string;
}

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

function newsletterNotifyEmail(): string {
  return (
    process.env.NEWSLETTER_NOTIFY_EMAIL ||
    process.env.AGENT_LEAD_NOTIFY_EMAIL ||
    "cgrove0712@gmail.com"
  ).trim();
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function newUnsubToken(): string {
  return randomBytes(24).toString("hex");
}

function parseShip(raw: string): { slug: string; label: string } | null {
  const value = raw.trim();
  if (!value) return null;
  const bySlug = SHIP_BY_SLUG.get(value);
  if (bySlug) return { slug: value, label: bySlug };
  const byLabel = SHIP_BY_LABEL.get(value.toLowerCase());
  if (byLabel) return byLabel;
  return null;
}

function looksLikeDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isSignupActive(entity: Record<string, unknown>): boolean {
  if (entity.active === false || entity.active === 0) return false;
  if (typeof entity.active === "string") {
    const v = entity.active.trim().toLowerCase();
    if (v === "false" || v === "0" || v === "no") return false;
  }
  return true;
}

/** Mark all NewsletterSignups rows for an email (or matching token) inactive. */
export async function unsubscribeNewsletterSignups(opts: {
  email?: string;
  token?: string;
}): Promise<{ updated: number; email: string }> {
  const client = await getTableClient();
  const email = opts.email ? normalizeEmail(opts.email) : "";
  const token = (opts.token || "").trim();
  if (!email && !token) return { updated: 0, email: "" };

  const now = new Date().toISOString();
  let updated = 0;
  let resolvedEmail = email;

  if (email) {
    const iter = client.listEntities({
      queryOptions: { filter: `PartitionKey eq '${email.replace(/'/g, "''")}'` },
    });
    for await (const entity of iter) {
      if (!isSignupActive(entity as Record<string, unknown>)) {
        resolvedEmail = String(entity.email ?? entity.partitionKey ?? email);
        continue;
      }
      await client.updateEntity(
        {
          partitionKey: String(entity.partitionKey),
          rowKey: String(entity.rowKey),
          etag: entity.etag,
          active: false,
          sailingTips: false,
          unsubscribedAt: now,
        },
        "Merge"
      );
      updated += 1;
      resolvedEmail = String(entity.email ?? entity.partitionKey ?? email);
    }
    return { updated, email: resolvedEmail };
  }

  // Token path: full scan (same pattern as planner reminders).
  for await (const entity of client.listEntities()) {
    if (String(entity.unsubToken ?? "") !== token) continue;
    resolvedEmail = String(entity.email ?? entity.partitionKey ?? "");
    if (!isSignupActive(entity as Record<string, unknown>)) {
      continue;
    }
    await client.updateEntity(
      {
        partitionKey: String(entity.partitionKey),
        rowKey: String(entity.rowKey),
        etag: entity.etag,
        active: false,
        sailingTips: false,
        unsubscribedAt: now,
      },
      "Merge"
    );
    updated += 1;
  }

  // Also deactivate any other signups sharing that email partition.
  if (resolvedEmail) {
    const more = await unsubscribeNewsletterSignups({ email: resolvedEmail });
    updated += more.updated;
  }

  return { updated, email: resolvedEmail };
}

export async function submitNewsletter(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let body: NewsletterInput;
  try {
    body = (await request.json()) as NewsletterInput;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  const email = normalizeEmail(String(body.email ?? "").slice(0, 200));
  const name = String(body.name ?? "").trim().slice(0, 120);
  const pageUrl = String(body.pageUrl ?? "").trim().slice(0, 500);
  const embarkationDate = String(body.embarkationDate ?? "").trim().slice(0, 10);
  const shipRaw = String(body.ship ?? "").trim().slice(0, 80);

  if (!email || !looksLikeEmail(email)) {
    return { status: 400, jsonBody: { error: "A valid email address is required." } };
  }

  let shipSlug = "";
  let shipLabel = "";
  if (shipRaw) {
    const parsed = parseShip(shipRaw);
    if (!parsed) {
      return { status: 400, jsonBody: { error: "Please choose a Disney Cruise Line ship from the list." } };
    }
    shipSlug = parsed.slug;
    shipLabel = parsed.label;
  }

  if (embarkationDate && !looksLikeDate(embarkationDate)) {
    return { status: 400, jsonBody: { error: "Embarkation date must be a valid date (YYYY-MM-DD)." } };
  }

  const wantsSailingTips =
    Boolean(body.sailingTips) || Boolean(shipSlug) || Boolean(embarkationDate);

  const signupId = randomUUID();
  const unsubToken = newUnsubToken();
  const now = new Date();
  const submittedAt = now.toISOString();

  try {
    const client = await getTableClient();
    await client.createEntity({
      partitionKey: email,
      rowKey: signupId,
      email,
      name,
      shipSlug,
      shipLabel,
      embarkationDate,
      sailingTips: wantsSailingTips,
      tipsSent: "[]",
      pageUrl,
      submittedAt,
      active: true,
      unsubToken,
    });
  } catch (err) {
    context.error("Failed to store newsletter signup:", err);
    const message = err instanceof Error ? err.message : String(err);
    try {
      await notifyOwnerOfSubmitError({
        form: "Newsletter signup",
        error: message,
        source: "api/newsletter",
        path: pageUrl,
        httpStatus: 500,
        context: {
          email: safeField(email),
          name: safeField(name),
          ship: safeField(shipLabel || shipSlug),
        },
      });
    } catch (notifyErr) {
      context.error("Newsletter error notify failed:", notifyErr);
    }
    return {
      status: 500,
      jsonBody: { error: "Something went wrong saving your signup. Please try again." },
    };
  }

  const tipsBits = [shipLabel, embarkationDate].filter(Boolean).join(", ");
  const subject = wantsSailingTips
    ? `Newsletter signup + sailing tips${tipsBits ? ` (${tipsBits})` : ""}`
    : "Newsletter signup";

  const text = [
    "New newsletter signup on Cruising Cove.",
    "",
    `Name: ${name || "—"}`,
    `Email: ${email}`,
    `Ship: ${shipLabel || "—"}`,
    `Embarkation: ${embarkationDate || "—"}`,
    `Sailing tips: ${wantsSailingTips ? "yes" : "no"}`,
    `Page: ${pageUrl || "—"}`,
    `Signup id: ${signupId}`,
    `When: ${submittedAt}`,
  ].join("\n");

  const html = `
    <p>New newsletter signup on Cruising Cove.</p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(name || "—")}</li>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
      <li><strong>Ship:</strong> ${escapeHtml(shipLabel || "—")}</li>
      <li><strong>Embarkation:</strong> ${escapeHtml(embarkationDate || "—")}</li>
      <li><strong>Sailing tips:</strong> ${wantsSailingTips ? "yes" : "no"}</li>
      <li><strong>Page:</strong> ${
        pageUrl
          ? `<a href="${escapeHtml(pageUrl)}">${escapeHtml(pageUrl)}</a>`
          : "—"
      }</li>
      <li><strong>Signup id:</strong> ${escapeHtml(signupId)}</li>
    </ul>
  `;

  try {
    const sent = await sendEmail(newsletterNotifyEmail(), subject, html, text);
    if (!sent) {
      context.warn("Newsletter signup saved but notify email was not sent (check RESEND_API_KEY / RESEND_FROM_EMAIL).");
    }
  } catch (err) {
    context.error("Newsletter notify email failed:", err);
  }

  return {
    status: 200,
    jsonBody: {
      success: true,
      signupId,
      sailingTips: wantsSailingTips,
      message: wantsSailingTips
        ? "You're on the list — we'll send cruise tips, and sailing notes when we have your ship and date."
        : "You're on the list — thanks for joining the Cruising Cove newsletter.",
    },
  };
}

export async function unsubscribeNewsletter(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  let email = "";
  let token = "";

  if (request.method === "GET") {
    email = normalizeEmail(String(request.query.get("email") || "").slice(0, 200));
    token = String(request.query.get("token") || "").trim();
  } else {
    let body: UnsubscribeInput;
    try {
      body = (await request.json()) as UnsubscribeInput;
    } catch {
      return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
    }
    email = normalizeEmail(String(body.email ?? "").slice(0, 200));
    token = String(body.token ?? "").trim();
  }

  if (!email && !token) {
    return { status: 400, jsonBody: { error: "Email or unsubscribe token is required." } };
  }
  if (email && !looksLikeEmail(email)) {
    return { status: 400, jsonBody: { error: "A valid email address is required." } };
  }

  try {
    const result = await unsubscribeNewsletterSignups({ email: email || undefined, token: token || undefined });
    // Always succeed for email-based unsub to avoid email enumeration; token miss can 404.
    if (token && !email && result.updated === 0 && !result.email) {
      return { status: 404, jsonBody: { error: "Unsubscribe link is invalid or already used." } };
    }
    return {
      status: 200,
      jsonBody: {
        success: true,
        message: "You're unsubscribed. You won't receive further Cruising Cove newsletter or sailing tip emails.",
      },
    };
  } catch (err) {
    context.error("Newsletter unsubscribe failed:", err);
    return { status: 500, jsonBody: { error: "Could not unsubscribe. Please try again." } };
  }
}

app.http("submitNewsletter", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "newsletter",
  handler: submitNewsletter,
});

app.http("unsubscribeNewsletter", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "newsletter/unsubscribe",
  handler: unsubscribeNewsletter,
});
