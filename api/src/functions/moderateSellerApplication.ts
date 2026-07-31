import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  APPLICATIONS_TABLE,
  MAX_PUBLISHED_SHOPS,
  PUBLISHED_TABLE,
  adminKeyOk,
  countPublishedSellers,
  slugifyName,
  table,
  toPublicSeller,
} from "../lib/sellers";

interface ModerateBody {
  partitionKey?: string;
  action?: string;
  featured?: boolean;
  sellerId?: string;
}

async function uniqueSellerId(preferred: string): Promise<string> {
  const client = table(PUBLISHED_TABLE);
  await client.createTable();
  let candidate = preferred;
  let n = 2;
  while (true) {
    try {
      await client.getEntity("directory", candidate);
      candidate = `${preferred}-${n}`;
      n += 1;
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 404) return candidate;
      throw err;
    }
  }
}

export async function moderateSellerApplication(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (!adminKeyOk(request)) {
    return { status: 401, jsonBody: { error: "Missing or invalid 'key' query parameter." } };
  }

  const rowKey = (request.params.id || "").trim();
  if (!rowKey) return { status: 400, jsonBody: { error: "Application id is required." } };

  let body: ModerateBody;
  try {
    body = (await request.json()) as ModerateBody;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  const partitionKey = (body.partitionKey || "").trim();
  const action = (body.action || "").trim().toLowerCase();
  if (!partitionKey) return { status: 400, jsonBody: { error: "partitionKey is required." } };
  if (!["approve", "reject", "unpublish"].includes(action)) {
    return { status: 400, jsonBody: { error: "action must be approve, reject, or unpublish." } };
  }

  try {
    const apps = table(APPLICATIONS_TABLE);
    const published = table(PUBLISHED_TABLE);
    await published.createTable();

    const application = await apps.getEntity(partitionKey, rowKey);
    const now = new Date().toISOString();

    if (action === "reject") {
      await apps.updateEntity(
        {
          partitionKey,
          rowKey,
          status: "rejected",
          moderatedAt: now,
          publishedSellerId: application.publishedSellerId || "",
        },
        "Merge"
      );
      return { status: 200, jsonBody: { success: true, status: "rejected" } };
    }

    if (action === "unpublish") {
      const existingId = String(application.publishedSellerId || "").trim();
      if (existingId) {
        try {
          await published.updateEntity(
            {
              partitionKey: "directory",
              rowKey: existingId,
              status: "unpublished",
              unpublishedAt: now,
            },
            "Merge"
          );
        } catch (err: unknown) {
          const status =
            typeof err === "object" && err && "statusCode" in err
              ? (err as { statusCode?: number }).statusCode
              : undefined;
          if (status !== 404) throw err;
        }
      }
      await apps.updateEntity(
        {
          partitionKey,
          rowKey,
          status: "unpublished",
          moderatedAt: now,
          publishedSellerId: existingId,
        },
        "Merge"
      );
      return { status: 200, jsonBody: { success: true, status: "unpublished" } };
    }

    // approve / publish
    const existingId = String(application.publishedSellerId || "").trim();
    if (!existingId) {
      const liveCount = await countPublishedSellers();
      if (liveCount >= MAX_PUBLISHED_SHOPS) {
        return {
          status: 400,
          jsonBody: {
            error: `The Curated 10 is full (${MAX_PUBLISHED_SHOPS} live shops). Unpublish a shop before approving another.`,
          },
        };
      }
    }

    const preferred =
      slugifyName((body.sellerId || "").trim()) ||
      slugifyName(String(application.publishedSellerId || "")) ||
      slugifyName(String(application.shopName || "shop"));

    const sellerId = existingId || (await uniqueSellerId(preferred));
    const featured = Boolean(body.featured);

    const entity = {
      partitionKey: "directory",
      rowKey: sellerId,
      status: "published",
      shopName: String(application.shopName || "").trim(),
      etsyShopUrl: String(application.etsyShopUrl || "").trim(),
      ownerName: String(application.ownerName || "").trim(),
      emailNotify: String(application.email || "").trim(),
      shopDescription: String(application.shopDescription || "").trim(),
      photoUrls: String(application.photoUrls || "").trim(),
      productCategories: String(application.productCategories || "").trim(),
      productCategoriesOther: String(application.productCategoriesOther || "").trim(),
      audienceSize: String(application.audienceSize || "").trim(),
      willingToBarter: String(application.willingToBarter || "").trim(),
      otherNotes: String(application.otherNotes || "").trim(),
      instagramUrl: String(application.instagramUrl || "").trim(),
      facebookUrl: String(application.facebookUrl || "").trim(),
      tiktokUrl: String(application.tiktokUrl || "").trim(),
      featured,
      applicationPartitionKey: partitionKey,
      applicationRowKey: rowKey,
      publishedAt: now,
      unpublishedAt: "",
    };

    try {
      await published.createEntity(entity);
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 409) {
        await published.updateEntity(entity, "Merge");
      } else {
        throw err;
      }
    }

    await apps.updateEntity(
      {
        partitionKey,
        rowKey,
        status: "approved",
        moderatedAt: now,
        publishedSellerId: sellerId,
        featured,
      },
      "Merge"
    );

    const publicSeller = toPublicSeller(entity as unknown as Record<string, unknown>);
    return {
      status: 200,
      jsonBody: {
        success: true,
        status: "approved",
        seller: publicSeller,
        marketplacePath: `/marketplace/#${encodeURIComponent(sellerId)}`,
      },
    };
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    if (status === 404) return { status: 404, jsonBody: { error: "Application not found." } };
    context.error("moderateSellerApplication error:", err);
    return { status: 500, jsonBody: { error: "Could not update that application." } };
  }
}

app.http("moderateSellerApplication", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "seller-applications/{id}",
  handler: moderateSellerApplication,
});
