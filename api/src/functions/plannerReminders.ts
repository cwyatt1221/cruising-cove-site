import { app, HttpRequest, HttpResponseInit, InvocationContext, Timer } from "@azure/functions";
import { createHash, randomBytes } from "crypto";
import { corsJson, isCastawayTier, newId, table } from "../lib/planner";

export const REMINDERS_TABLE = "PlannerReminders";

const WINDOW_DAYS: Record<string, number> = {
  firstTime: 75,
  silver: 90,
  gold: 105,
  platinum: 120,
  pearl: 123,
  concierge: 123,
};

function reminderToJson(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey),
    email: String(entity.email ?? ""),
    shipSlug: String(entity.shipSlug ?? ""),
    embarkDate: String(entity.embarkDate ?? ""),
    castawayTier: String(entity.castawayTier ?? ""),
    title: String(entity.title ?? ""),
    windowOpensOn: String(entity.windowOpensOn ?? ""),
    remindAt: String(entity.remindAt ?? ""),
    status: String(entity.status ?? "pending"),
    createdAt: String(entity.createdAt ?? ""),
  };
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function daysBefore(ymd: string, before: number): string {
  return addDaysYmd(ymd, -before);
}

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Cruising Cove <onboarding@resend.dev>";
  if (!key) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  return res.ok;
}

export async function plannerCreateReminder(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const shipSlug = String(body.shipSlug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  const embarkDate = String(body.embarkDate ?? "").trim();
  const castawayTier = String(body.castawayTier ?? "firstTime");
  const title = String(body.title ?? "").trim().slice(0, 80);

  if (!email.includes("@")) return corsJson(400, { error: "A valid email is required." });
  if (!shipSlug) return corsJson(400, { error: "Ship is required." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(embarkDate)) return corsJson(400, { error: "Embark date must be YYYY-MM-DD." });
  if (!isCastawayTier(castawayTier)) return corsJson(400, { error: "Invalid Castaway tier." });

  const openDays = WINDOW_DAYS[castawayTier] || 75;
  const windowOpensOn = daysBefore(embarkDate, openDays);
  // Remind the morning of window day (and allow signup anytime before).
  const remindAt = `${windowOpensOn}T04:00:00.000Z`;
  if (new Date(remindAt).getTime() < Date.now() - 86400000) {
    return corsJson(400, { error: "That booking window has already passed." });
  }

  const id = newId();
  const unsub = randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  const emailKey = createHash("sha256").update(email).digest("hex").slice(0, 24);

  try {
    const reminders = await table(REMINDERS_TABLE);
    await reminders.createEntity({
      partitionKey: "reminder",
      rowKey: id,
      email,
      emailKey,
      shipSlug,
      embarkDate,
      castawayTier,
      title,
      windowOpensOn,
      remindAt,
      status: "pending",
      unsubToken: unsub,
      createdAt: now,
      sentAt: "",
    });
    return corsJson(200, {
      success: true,
      id,
      windowOpensOn,
      message: "Reminder saved. We’ll email you when your booking window opens (if email sending is configured).",
    });
  } catch (err) {
    context.error("plannerCreateReminder failed:", err);
    return corsJson(500, { error: "Could not save that reminder." });
  }
}

export async function plannerUnsubscribeReminder(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const token = request.query.get("token")?.trim() || "";
  if (!token) return corsJson(400, { error: "Missing token." });

  try {
    const reminders = await table(REMINDERS_TABLE);
    for await (const entity of reminders.listEntities({
      queryOptions: { filter: `PartitionKey eq 'reminder'` },
    })) {
      if (String(entity.unsubToken ?? "") !== token) continue;
      await reminders.updateEntity(
        {
          partitionKey: "reminder",
          rowKey: String(entity.rowKey),
          etag: entity.etag,
          status: "cancelled",
        },
        "Merge"
      );
      return corsJson(200, { success: true, message: "Reminder cancelled." });
    }
    return corsJson(404, { error: "Reminder not found." });
  } catch (err) {
    context.error("plannerUnsubscribeReminder failed:", err);
    return corsJson(500, { error: "Could not cancel reminder." });
  }
}

export async function plannerSendRemindersTimer(timer: Timer, context: InvocationContext): Promise<void> {
  void timer;
  const now = Date.now();
  try {
    const reminders = await table(REMINDERS_TABLE);
    for await (const entity of reminders.listEntities({
      queryOptions: { filter: `PartitionKey eq 'reminder'` },
    })) {
      if (String(entity.status ?? "") !== "pending") continue;
      const remindAt = new Date(String(entity.remindAt ?? "")).getTime();
      if (!remindAt || remindAt > now) continue;

      const email = String(entity.email ?? "");
      const ship = String(entity.shipSlug ?? "").replace(/-/g, " ");
      const embark = String(entity.embarkDate ?? "");
      const opens = String(entity.windowOpensOn ?? "");
      const unsub = String(entity.unsubToken ?? "");
      const site = process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com";
      const subject = `Your Disney cruise booking window opens ${opens}`;
      const text = `Your Castaway Club booking window for ${ship} (${embark}) opens on ${opens} (midnight ET). Open My Cruise: ${site}/planning/my-cruise.html\nUnsubscribe: ${site}/api/planner/reminders/unsubscribe?token=${unsub}`;
      const html = `<p>Your Castaway Club booking window for <strong>${ship}</strong> (embark ${embark}) opens on <strong>${opens}</strong> at midnight Eastern.</p><p><a href="${site}/planning/my-cruise.html">Open My Cruise planner</a></p><p style="font-size:12px;color:#666"><a href="${site}/api/planner/reminders/unsubscribe?token=${unsub}">Unsubscribe</a></p>`;

      const sent = await sendEmail(email, subject, html, text);
      await reminders.updateEntity(
        {
          partitionKey: "reminder",
          rowKey: String(entity.rowKey),
          etag: entity.etag,
          status: sent ? "sent" : "pending",
          sentAt: sent ? new Date().toISOString() : "",
          lastAttemptAt: new Date().toISOString(),
          sendError: sent ? "" : "Email provider not configured or send failed",
        },
        "Merge"
      );
      if (!sent) {
        context.warn(`Reminder ${entity.rowKey} ready but email not sent (configure RESEND_API_KEY).`);
      }
    }
  } catch (err) {
    context.error("plannerSendRemindersTimer failed:", err);
  }
}

app.http("plannerCreateReminder", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/reminders",
  handler: plannerCreateReminder,
});

app.http("plannerUnsubscribeReminder", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/reminders/unsubscribe",
  handler: plannerUnsubscribeReminder,
});

app.timer("plannerSendRemindersTimer", {
  schedule: "0 0 * * * *", // hourly
  handler: plannerSendRemindersTimer,
});
