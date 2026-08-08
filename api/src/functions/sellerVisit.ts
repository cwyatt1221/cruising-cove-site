import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { adminAuthOk } from "../lib/adminAuth";
import { PUBLISHED_TABLE, table, toPublicSeller } from "../lib/sellers";
import {
  notifyMarketplaceClick,
  parseVisitCount,
  shouldSendClickNotify,
} from "../lib/clickNotify";

/**
 * Increment a published shop's visit counter (Visit shop clicks).
 * Soft-fails for unknown/unpublished shops so marketplace UX stays quiet.
 * Owner email is rate-limited (at most once per shop per hour); counter always increments.
 * Pass force=1 with REPORT_ACCESS_KEY (or admin session) to bypass cooldown.
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

  const forceRequested = (request.query.get("force") || "").trim() === "1";
  const force = forceRequested && (await adminAuthOk(request));

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
    const nowIso = new Date().toISOString();
    const attemptNotify = force || shouldSendClickNotify(entity.lastNotifyAt);

    // Always increment the counter; only stamp lastNotifyAt after a successful send.
    await client.updateEntity(
      {
        partitionKey: "directory",
        rowKey: sellerId,
        visitCount,
      },
      "Merge"
    );

    let notified = false;
    let notifySkipped: string | undefined;
    let notifyError: string | undefined;

    if (!attemptNotify) {
      notifySkipped = "cooldown";
    } else {
      try {
        const shopName = String(entity.shopName || entity.name || sellerId);
        const result = await notifyMarketplaceClick({
          shopName,
          shopId: sellerId,
          visitCount,
          path: path || "/marketplace/",
          at: nowIso,
        });
        if (result.ok) {
          notified = true;
          await client.updateEntity(
            {
              partitionKey: "directory",
              rowKey: sellerId,
              lastNotifyAt: nowIso,
            },
            "Merge"
          );
        } else {
          notifyError = result.reason;
          context.warn(`Seller visit notify email not sent: ${result.reason}`);
        }
      } catch (err) {
        notifyError = "notify threw";
        context.error("Seller visit notify email failed:", err);
      }
    }

    return {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      jsonBody: {
        success: true,
        id: sellerId,
        visitCount,
        notified,
        ...(notifySkipped ? { notifySkipped } : {}),
        ...(notifyError ? { notifyError } : {}),
        ...(forceRequested && !force ? { forceDenied: true } : {}),
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
