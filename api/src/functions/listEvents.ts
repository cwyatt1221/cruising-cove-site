import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { TableClient } from "@azure/data-tables";
import { adminAuthOk } from "../lib/adminAuth";

const TABLE_NAME = "SiteEvents";

let tableClient: TableClient | null = null;
function getTableClient(): TableClient {
  if (!tableClient) {
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
    tableClient = TableClient.fromConnectionString(connectionString, TABLE_NAME);
  }
  return tableClient;
}

export async function listEvents(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!(await adminAuthOk(request))) {
    return { status: 401, jsonBody: { error: "Missing or invalid 'key' query parameter." } };
  }

  const typeFilter = request.query.get("type");
  const days = Math.min(90, Math.max(1, Number(request.query.get("days") || 30) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const client = getTableClient();
    const counts: Record<string, number> = {};
    const byTarget: Record<string, number> = {};
    let total = 0;
    const recent: Record<string, unknown>[] = [];

    for await (const entity of client.listEntities()) {
      const recordedAt = String(entity.recordedAt || "");
      if (recordedAt && recordedAt < since) continue;
      const type = String(entity.type || "");
      if (typeFilter && type !== typeFilter) continue;

      total += 1;
      counts[type] = (counts[type] || 0) + 1;

      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(String(entity.meta || "{}"));
      } catch {
        meta = {};
      }
      const target = String(
        meta.query || meta.agent || meta.shop || meta.href || entity.path || "unknown"
      ).slice(0, 200);
      const targetKey = `${type}:${target}`;
      byTarget[targetKey] = (byTarget[targetKey] || 0) + 1;

      if (recent.length < 100) {
        recent.push({
          type,
          path: entity.path,
          meta,
          recordedAt,
        });
      }
    }

    recent.sort((a: any, b: any) => String(b.recordedAt).localeCompare(String(a.recordedAt)));

    const topTargets = Object.entries(byTarget)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([key, count]) => {
        const idx = key.indexOf(":");
        return { type: key.slice(0, idx), target: key.slice(idx + 1), count };
      });

    return {
      status: 200,
      jsonBody: {
        days,
        totalEvents: total,
        countsByType: counts,
        topTargets,
        recent,
      },
    };
  } catch (err) {
    context.error("listEvents error:", err);
    return { status: 500, jsonBody: { error: "Failed to list events." } };
  }
}

// Separate route from POST /api/events — SWA only keeps one registration per path.
app.http("listEvents", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "events-report",
  handler: listEvents,
});
