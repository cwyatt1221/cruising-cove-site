import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { PUBLISHED_TABLE, table, toPublicSeller } from "../lib/sellers";

/**
 * Increment a published shop's visit counter (Visit shop clicks).
 * Soft-fails for unknown/unpublished shops so marketplace UX stays quiet.
 */
export async function recordSellerVisit(
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

  const sellerId = (request.params.id || "").trim();
  if (!sellerId) {
    return { status: 400, jsonBody: { error: "Seller id is required." } };
  }

  try {
    const client = table(PUBLISHED_TABLE);
    await client.createTable();

    let entity: Record<string, unknown>;
    try {
      entity = (await client.getEntity("directory", sellerId)) as Record<string, unknown>;
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 404) {
        return {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
          jsonBody: { error: "Seller not found." },
        };
      }
      throw err;
    }

    if (entity.status && entity.status !== "published") {
      return {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        jsonBody: { error: "Seller not found." },
      };
    }

    const prevRaw = entity.visitCount;
    const prev =
      typeof prevRaw === "number"
        ? prevRaw
        : typeof prevRaw === "string" && prevRaw.trim()
          ? Number(prevRaw) || 0
          : 0;
    const visitCount = Math.max(0, Math.floor(prev)) + 1;

    await client.updateEntity(
      {
        partitionKey: "directory",
        rowKey: sellerId,
        visitCount,
      },
      "Merge"
    );

    return {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      jsonBody: {
        success: true,
        id: sellerId,
        visitCount,
        seller: toPublicSeller({ ...entity, visitCount }),
      },
    };
  } catch (err) {
    context.error("recordSellerVisit error:", err);
    return {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      jsonBody: { error: "Could not record visit." },
    };
  }
}

app.http("recordSellerVisit", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "sellers/{id}/visit",
  handler: recordSellerVisit,
});
