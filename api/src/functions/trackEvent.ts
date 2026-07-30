import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { randomUUID } from "crypto";

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

  return { status: 204 };
}

app.http("trackEvent", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "events",
  handler: trackEvent,
});
