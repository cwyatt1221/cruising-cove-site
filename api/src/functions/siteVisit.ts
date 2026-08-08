import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";

const TABLE_NAME = "SiteStats";
const PARTITION_KEY = "site";
const ROW_KEY = "visitors";
const MAX_RETRIES = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

function parseCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function statusCode(err: unknown): number | undefined {
  if (typeof err === "object" && err && "statusCode" in err) {
    return (err as { statusCode?: number }).statusCode;
  }
  return undefined;
}

async function readCount(client: TableClient): Promise<number> {
  try {
    const entity = await client.getEntity(PARTITION_KEY, ROW_KEY);
    return parseCount(entity.total);
  } catch (err) {
    if (statusCode(err) === 404) return 0;
    throw err;
  }
}

async function incrementCount(client: TableClient): Promise<number> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const entity = (await client.getEntity(PARTITION_KEY, ROW_KEY)) as {
        etag?: string;
        total?: unknown;
      };
      const next = parseCount(entity.total) + 1;
      await client.updateEntity(
        {
          partitionKey: PARTITION_KEY,
          rowKey: ROW_KEY,
          etag: entity.etag,
          total: next,
          updatedAt: new Date().toISOString(),
        },
        "Merge"
      );
      return next;
    } catch (err) {
      const code = statusCode(err);
      if (code === 404) {
        try {
          await client.createEntity({
            partitionKey: PARTITION_KEY,
            rowKey: ROW_KEY,
            total: 1,
            updatedAt: new Date().toISOString(),
          });
          return 1;
        } catch (createErr) {
          // Another request created the row — retry.
          if (statusCode(createErr) === 409) continue;
          throw createErr;
        }
      }
      // Precondition failed (etag mismatch) — retry.
      if (code === 412) continue;
      throw err;
    }
  }
  // Last resort: read current value after contended updates.
  return (await readCount(client)) || 1;
}

/**
 * Sitewide visitor counter.
 * GET  /api/site-visit — current total (no increment)
 * POST /api/site-visit — increment once and return new total
 * Frontend should call POST at most once per browser session.
 */
export async function siteVisit(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return { status: 204, headers: CORS };
  }

  try {
    const client = await getTableClient();

    if (request.method === "GET") {
      const total = await readCount(client);
      return {
        status: 200,
        headers: { ...CORS, "Cache-Control": "no-store" },
        jsonBody: { total },
      };
    }

    const total = await incrementCount(client);
    return {
      status: 200,
      headers: { ...CORS, "Cache-Control": "no-store" },
      jsonBody: { total, incremented: true },
    };
  } catch (err) {
    context.error("siteVisit error:", err);
    return {
      status: 500,
      headers: CORS,
      jsonBody: { error: "Could not load visitor count." },
    };
  }
}

app.http("siteVisit", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "site-visit",
  handler: siteVisit,
});
