import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { parseVisitCount } from "../lib/clickNotify";
import { recordShopClick } from "../lib/sellerClicks";
import { PUBLISHED_TABLE, table, toPublicSeller } from "../lib/sellers";

/**
 * Record a marketplace "Visit shop" click-out.
 * Logs an event for weekly owner reports and increments the lifetime visit counter.
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
        "Access-Control-Allow-Headers": "Content-Type, x-cc-admin-key",
      },
    };
  }

  const sellerId = (request.params.id || "").trim();
  if (!sellerId) {
    return { status: 400, jsonBody: { error: "Seller id is required." } };
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

    const visitCount = parseVisitCount(entity.visitCount) + 1;

    try {
      await recordShopClick({ shopId: sellerId, path: path || "/marketplace/" });
    } catch (clickErr) {
      context.warn("Seller click event not stored:", clickErr);
    }

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
