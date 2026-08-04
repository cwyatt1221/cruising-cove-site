import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";
import { escapeHtml, notifyEmail, notifyOwnerOfSubmitError, safeField, sendEmail } from "../lib/email";

const TABLE_NAME = "SiteEvents";
const MAX_META_CHARS = 800;

interface EventInput {
  type?: string;
  path?: string;
  meta?: Record<string, unknown>;
  at?: string;
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

function sanitizeType(value: unknown): string {
  const t = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
  return t;
}

export async function trackEvent(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  let body: EventInput;
  try {
    body = (await request.json()) as EventInput;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  const type = sanitizeType(body.type);
  if (!type) return { status: 400, jsonBody: { error: "type is required." } };

  const path = String(body.path ?? "").slice(0, 200);
  let metaJson = "";
  try {
    metaJson = JSON.stringify(body.meta ?? {}).slice(0, MAX_META_CHARS);
  } catch {
    metaJson = "{}";
  }

  const at = body.at && !Number.isNaN(Date.parse(body.at)) ? body.at : new Date().toISOString();
  const day = at.slice(0, 10);

  try {
    const client = await getTableClient();
    await client.createEntity({
      partitionKey: day,
      rowKey: randomUUID(),
      type,
      path,
      meta: metaJson,
      recordedAt: at,
      userAgent: (request.headers.get("user-agent") || "").slice(0, 200),
    });
  } catch (err) {
    context.error("trackEvent failed:", err);
    // Don't break the UX if analytics fails.
    return { status: 204 };
  }

  if (type === "agent_request_click") {
    try {
      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(metaJson || "{}") as Record<string, unknown>;
      } catch {
        meta = {};
      }
      const agent = String(meta.agent || "unknown");
      const href = String(meta.href || path || "");
      const site = (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
      const subject = `Agent request button clicked: ${agent}`;
      const text = [
        "Someone clicked “Request this agent” on Cruising Cove.",
        "",
        `Agent: ${agent}`,
        `From page: ${path || "—"}`,
        `Link: ${href || "—"}`,
        "",
        "They are taken to the request form next. You’ll get another email if they submit it.",
        `${site}/agents/request.html?agent=${encodeURIComponent(agent)}`,
      ].join("\n");
      const html = `
        <p>Someone clicked <strong>Request this agent</strong> on Cruising Cove.</p>
        <ul>
          <li><strong>Agent:</strong> ${escapeHtml(agent)}</li>
          <li><strong>From page:</strong> ${escapeHtml(path || "—")}</li>
          <li><strong>Link:</strong> ${escapeHtml(href || "—")}</li>
        </ul>
        <p>They are taken to the request form next. You’ll get another email if they submit it.</p>
        <p><a href="${escapeHtml(site)}/agents/request.html?agent=${encodeURIComponent(agent)}">Open request form</a></p>
      `;
      const sent = await sendEmail(notifyEmail(), subject, html, text);
      if (!sent) context.warn("agent_request_click notify email not sent (check RESEND_API_KEY).");
    } catch (err) {
      context.error("agent_request_click notify failed:", err);
    }
  }

  // Client-reported submit failures (network / gateway / etc.). Skip benign 4xx validation.
  if (type === "application_submit_error") {
    try {
      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(metaJson || "{}") as Record<string, unknown>;
      } catch {
        meta = {};
      }
      const statusNum = Number(meta.httpStatus);
      const hasStatus = Number.isFinite(statusNum) && statusNum > 0;
      const isBenignValidation = hasStatus && statusNum >= 400 && statusNum < 500 && statusNum !== 429;
      if (!isBenignValidation) {
        const form = safeField(meta.form, 80) || "Application submit";
        const error = safeField(meta.error || meta.message, 400) || "Submit failed (client report)";
        const sent = await notifyOwnerOfSubmitError({
          form,
          error,
          source: "client/events",
          path: path || safeField(meta.path, 200),
          httpStatus: hasStatus ? statusNum : "network",
          context: {
            email: meta.email,
            name: meta.name || meta.fullName || meta.ownerName || meta.guestName,
            shopName: meta.shopName,
            agency: meta.agency,
            agentId: meta.agentId,
            agentName: meta.agentName,
          },
        });
        if (!sent) context.warn("application_submit_error notify email not sent (check RESEND_API_KEY).");
      }
    } catch (err) {
      context.error("application_submit_error notify failed:", err);
    }
  }

  return { status: 204 };
}

app.http("trackEvent", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "events",
  handler: trackEvent,
});
