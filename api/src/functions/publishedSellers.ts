import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  MAX_PUBLISHED_SHOPS,
  PUBLISHED_TABLE,
  maybeBackfillFoundingSeller,
  table,
  toPublicSeller,
} from "../lib/sellers";

export async function listPublishedSellers(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return { status: 204, headers: { "Access-Control-Allow-Origin": "*" } };
  }

  try {
    const client = table(PUBLISHED_TABLE);
    await client.createTable();
    const sellers: ReturnType<typeof toPublicSeller>[] = [];

    for await (const entity of client.listEntities()) {
      if (entity.status && entity.status !== "published") continue;
      const enriched = await maybeBackfillFoundingSeller(entity as Record<string, unknown>);
      sellers.push(toPublicSeller(enriched));
    }

    sellers.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (b.publishedAt || "").localeCompare(a.publishedAt || "");
    });

    return {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" },
      jsonBody: {
        sellers,
        total: sellers.length,
        max: MAX_PUBLISHED_SHOPS,
        openSlots: Math.max(0, MAX_PUBLISHED_SHOPS - sellers.length),
      },
    };
  } catch (err) {
    context.error("listPublishedSellers error:", err);
    return { status: 500, jsonBody: { error: "Could not load sellers." } };
  }
}

app.http("listPublishedSellers", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "sellers",
  handler: listPublishedSellers,
});
