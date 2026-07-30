import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { PUBLISHED_TABLE, table, toPublicAgent } from "../lib/agents";

export async function listPublishedAgents(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return { status: 204, headers: { "Access-Control-Allow-Origin": "*" } };
  }

  try {
    const client = table(PUBLISHED_TABLE);
    await client.createTable();
    const agents: ReturnType<typeof toPublicAgent>[] = [];

    for await (const entity of client.listEntities()) {
      if (entity.status && entity.status !== "published") continue;
      agents.push(toPublicAgent(entity as Record<string, unknown>));
    }

    agents.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.publishedAt || "").localeCompare(a.publishedAt || "");
    });

    return {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" },
      jsonBody: { agents, total: agents.length },
    };
  } catch (err) {
    context.error("listPublishedAgents error:", err);
    return { status: 500, jsonBody: { error: "Could not load agents." } };
  }
}

export async function getPublishedAgent(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return { status: 204, headers: { "Access-Control-Allow-Origin": "*" } };
  }

  const id = (request.params.id || "").trim();
  if (!id) return { status: 400, jsonBody: { error: "Agent id is required." } };

  try {
    const client = table(PUBLISHED_TABLE);
    await client.createTable();
    const entity = await client.getEntity("directory", id);
    if (entity.status && entity.status !== "published") {
      return { status: 404, jsonBody: { error: "Agent not found." } };
    }
    return {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" },
      jsonBody: { agent: toPublicAgent(entity as Record<string, unknown>) },
    };
  } catch (err: unknown) {
    const status = typeof err === "object" && err && "statusCode" in err ? (err as { statusCode?: number }).statusCode : undefined;
    if (status === 404) return { status: 404, jsonBody: { error: "Agent not found." } };
    context.error("getPublishedAgent error:", err);
    return { status: 500, jsonBody: { error: "Could not load that agent." } };
  }
}

app.http("listPublishedAgents", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "agents",
  handler: listPublishedAgents,
});

app.http("getPublishedAgent", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "agents/{id}",
  handler: getPublishedAgent,
});
