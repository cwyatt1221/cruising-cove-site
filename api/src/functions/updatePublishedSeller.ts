import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  APPLICATIONS_TABLE,
  PUBLISHED_TABLE,
  adminKeyOk,
  joinCsv,
  parseSocialProofQuotes,
  serializeSocialProofQuotes,
  table,
  toPublicSeller,
} from "../lib/sellers";

interface UpdateBody {
  categories?: string[];
  productCategories?: string[];
  productCategoriesOther?: string;
  socialProofQuotes?: unknown;
  featured?: boolean;
}

/**
 * Admin edit for a live PublishedSellers row (categories + social proof quotes).
 */
export async function updatePublishedSeller(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") {
    return {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-cc-admin-key",
      },
    };
  }

  if (!(await adminKeyOk(request))) {
    return { status: 401, jsonBody: { error: "Missing or invalid 'key' query parameter." } };
  }

  const sellerId = (request.params.id || "").trim();
  if (!sellerId) return { status: 400, jsonBody: { error: "Seller id is required." } };

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  try {
    const published = table(PUBLISHED_TABLE);
    await published.createTable();

    let existing: Record<string, unknown>;
    try {
      existing = (await published.getEntity("directory", sellerId)) as Record<string, unknown>;
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? (err as { statusCode?: number }).statusCode
          : undefined;
      if (status === 404) return { status: 404, jsonBody: { error: "Seller not found." } };
      throw err;
    }

    const patch: {
      partitionKey: string;
      rowKey: string;
      categories?: string;
      productCategories?: string;
      productCategoriesOther?: string;
      socialProofQuotes?: string;
      featured?: boolean;
    } = {
      partitionKey: "directory",
      rowKey: sellerId,
    };

    const catsSource = body.categories ?? body.productCategories;
    if (Array.isArray(catsSource)) {
      const categories = catsSource.map((c) => String(c).trim()).filter(Boolean);
      patch.categories = JSON.stringify(categories);
      patch.productCategories = joinCsv(categories);
    }

    if (body.productCategoriesOther !== undefined) {
      patch.productCategoriesOther = String(body.productCategoriesOther || "").trim();
    }

    if (body.socialProofQuotes !== undefined) {
      const quotes = parseSocialProofQuotes(body.socialProofQuotes);
      patch.socialProofQuotes = serializeSocialProofQuotes(quotes);
    }

    if (body.featured !== undefined) {
      patch.featured = Boolean(body.featured);
    }

    if (Object.keys(patch).length <= 2) {
      return { status: 400, jsonBody: { error: "No editable fields provided." } };
    }

    await published.updateEntity(patch, "Merge");

    // Keep linked application categories in sync when present
    const appPk = String(existing.applicationPartitionKey || "").trim();
    const appRk = String(existing.applicationRowKey || "").trim();
    if (appPk && appRk && (patch.productCategories !== undefined || patch.socialProofQuotes !== undefined)) {
      try {
        const apps = table(APPLICATIONS_TABLE);
        const appPatch: {
          partitionKey: string;
          rowKey: string;
          productCategories?: string;
          categories?: string;
          productCategoriesOther?: string;
          socialProofQuotes?: string;
        } = {
          partitionKey: appPk,
          rowKey: appRk,
        };
        if (patch.productCategories !== undefined) {
          appPatch.productCategories = patch.productCategories;
          appPatch.categories = patch.categories;
        }
        if (patch.productCategoriesOther !== undefined) {
          appPatch.productCategoriesOther = patch.productCategoriesOther;
        }
        if (patch.socialProofQuotes !== undefined) {
          appPatch.socialProofQuotes = patch.socialProofQuotes;
        }
        await apps.updateEntity(appPatch, "Merge");
      } catch (syncErr) {
        context.warn("Could not sync application after seller update:", syncErr);
      }
    }

    const updated = { ...existing, ...patch } as Record<string, unknown>;
    return {
      status: 200,
      jsonBody: { success: true, seller: toPublicSeller(updated) },
    };
  } catch (err) {
    context.error("updatePublishedSeller error:", err);
    return { status: 500, jsonBody: { error: "Could not update seller." } };
  }
}

app.http("updatePublishedSeller", {
  methods: ["POST", "PATCH", "OPTIONS"],
  authLevel: "anonymous",
  route: "sellers/{id}",
  handler: updatePublishedSeller,
});
