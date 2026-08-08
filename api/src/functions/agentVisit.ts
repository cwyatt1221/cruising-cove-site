import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { PUBLISHED_TABLE, table, toPublicAgent } from "../lib/agents";
import {
  notifyAgentProfileClick,
  parseVisitCount,
  shouldSendClickNotify,
} from "../lib/clickNotify";

/**
 * Increment a published agent's profile view counter.
 * Soft-fails for unknown/unpublished agents so profile UX stays quiet.
 * Owner email is rate-limited (at most once per agent per hour); counter always increments.
 */
export async function recordAgentVisit(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  const agentId = (request.params.id || "").trim();
  if (!agentId) {
    return { status: 400, jsonBody: { error: "Agent id is required." } };
  }

  let path = "";
  try {
    const body = (await request.json()) as { path?: string };
    path = String(body?.path ?? "").trim().slice(0, 300);
  } catch {
    /* body optional */
  }
  if (!path) {
    path = (request.headers.get("referer") || "").slice(0, 300);
  }

  try {
    const client = table(PUBLISHED_TABLE);
    await client.createTable();

    let entity: Record<string, unknown>;
    try {
      entity = (await client.getEntity("directory", agentId)) as Record<string, unknown>;
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 404) {
        return {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
          jsonBody: { error: "Agent not found." },
        };
      }
      throw err;
    }

    if (entity.status && entity.status !== "published") {
      return {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        jsonBody: { error: "Agent not found." },
      };
    }

    const visitCount = parseVisitCount(entity.visitCount) + 1;
    const nowIso = new Date().toISOString();
    const sendNotify = shouldSendClickNotify(entity.lastNotifyAt);
    await client.updateEntity(
      {
        partitionKey: "directory",
        rowKey: agentId,
        visitCount,
        ...(sendNotify ? { lastNotifyAt: nowIso } : {}),
      },
      "Merge"
    );

    if (sendNotify) {
      try {
        const agentName = String(entity.name || agentId);
        const sent = await notifyAgentProfileClick({
          agentName,
          agentId,
          visitCount,
          path: path || `/agents/profile.html?id=${encodeURIComponent(agentId)}`,
          at: nowIso,
        });
        if (!sent) context.warn("Agent visit notify email not sent (check RESEND_API_KEY).");
      } catch (err) {
        context.error("Agent visit notify email failed:", err);
      }
    }

    return {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      jsonBody: {
        success: true,
        id: agentId,
        visitCount,
        notified: sendNotify,
        agent: toPublicAgent({ ...entity, visitCount }),
      },
    };
  } catch (err) {
    context.error("recordAgentVisit error:", err);
    return {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      jsonBody: { error: "Could not record visit." },
    };
  }
}

app.http("recordAgentVisit", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "agents/{id}/visit",
  handler: recordAgentVisit,
});
