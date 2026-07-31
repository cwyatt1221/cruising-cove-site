import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  REVIEWS_TABLE,
  corsJson,
  isReviewTargetType,
  newId,
  requireUser,
  reviewPartition,
  table,
} from "../lib/planner";
import { adminAuthOk as adminKeyOk } from "../lib/adminAuth";

function reviewToJson(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey),
    targetType: String(entity.targetType ?? ""),
    targetId: String(entity.targetId ?? ""),
    rating: Number(entity.rating ?? 0),
    title: String(entity.title ?? ""),
    body: String(entity.body ?? ""),
    agesNote: String(entity.agesNote ?? ""),
    shipSlug: String(entity.shipSlug ?? ""),
    embarkDate: String(entity.embarkDate ?? ""),
    displayName: String(entity.displayName ?? "Guest"),
    status: String(entity.status ?? "pending"),
    createdAt: String(entity.createdAt ?? ""),
    userId: String(entity.userId ?? ""),
    partitionKey: String(entity.partitionKey ?? ""),
  };
}

export async function plannerListReviews(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  const targetType = String(request.query.get("type") ?? "");
  const targetId = String(request.query.get("id") ?? "");
  if (!isReviewTargetType(targetType) || !targetId.trim()) {
    return corsJson(400, { error: "Query params type and id are required." });
  }

  try {
    const pk = reviewPartition(targetType, targetId);
    const reviews = await table(REVIEWS_TABLE);
    const list = [];
    for await (const entity of reviews.listEntities({ queryOptions: { filter: `PartitionKey eq '${pk}'` } })) {
      const row = reviewToJson(entity as Record<string, unknown>);
      if (row.status === "approved") list.push(row);
    }
    list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const avg =
      list.length === 0 ? null : Math.round((list.reduce((sum, r) => sum + r.rating, 0) / list.length) * 10) / 10;
    return corsJson(200, { reviews: list, average: avg, count: list.length });
  } catch (err) {
    context.error("plannerListReviews failed:", err);
    return corsJson(500, { error: "Could not load reviews." });
  }
}

export async function plannerCreateReview(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to leave a review." });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const targetType = String(body.targetType ?? "");
  const targetId = String(body.targetId ?? "").trim().toLowerCase();
  const rating = Number(body.rating);
  const title = String(body.title ?? "").trim().slice(0, 80);
  const reviewBody = String(body.body ?? "").trim().slice(0, 2000);
  const agesNote = String(body.agesNote ?? "").trim().slice(0, 120);
  const shipSlug = String(body.shipSlug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  const embarkDate = String(body.embarkDate ?? "").trim();

  if (!isReviewTargetType(targetType) || !targetId) {
    return corsJson(400, { error: "targetType and targetId are required." });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return corsJson(400, { error: "Rating must be an integer from 1 to 5." });
  }
  if (reviewBody.length < 20) {
    return corsJson(400, { error: "Please write at least 20 characters so others get useful context." });
  }
  if (embarkDate && !/^\d{4}-\d{2}-\d{2}$/.test(embarkDate)) {
    return corsJson(400, { error: "Embark date must be YYYY-MM-DD." });
  }

  try {
    const pk = reviewPartition(targetType, targetId);
    const id = newId();
    const now = new Date().toISOString();
    const reviews = await table(REVIEWS_TABLE);
    await reviews.createEntity({
      partitionKey: pk,
      rowKey: id,
      targetType,
      targetId,
      rating,
      title,
      body: reviewBody,
      agesNote,
      shipSlug,
      embarkDate,
      displayName: user.displayName,
      userId: user.userId,
      status: "pending",
      createdAt: now,
    });
    return corsJson(200, {
      success: true,
      message: "Thanks — your review is pending moderation and will appear once approved.",
      review: {
        id,
        targetType,
        targetId,
        rating,
        title,
        status: "pending",
      },
    });
  } catch (err) {
    context.error("plannerCreateReview failed:", err);
    return corsJson(500, { error: "Could not save your review." });
  }
}

export async function plannerAdminListReviews(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  if (!(await adminKeyOk(request))) return corsJson(401, { error: "Missing or invalid admin key." });

  const statusFilter = request.query.get("status") || "pending";

  try {
    const reviews = await table(REVIEWS_TABLE);
    const list = [];
    for await (const entity of reviews.listEntities()) {
      const row = reviewToJson(entity as Record<string, unknown>);
      if (statusFilter !== "all" && row.status !== statusFilter) continue;
      list.push(row);
    }
    list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return corsJson(200, { reviews: list });
  } catch (err) {
    context.error("plannerAdminListReviews failed:", err);
    return corsJson(500, { error: "Could not list reviews." });
  }
}

export async function plannerAdminModerateReview(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  if (!(await adminKeyOk(request))) return corsJson(401, { error: "Missing or invalid admin key." });

  const reviewId = request.params.reviewId?.trim();
  if (!reviewId) return corsJson(400, { error: "Review id is required." });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const action = String(body.action ?? "").trim();
  const partitionKey = String(body.partitionKey ?? "").trim();
  if (action !== "approve" && action !== "reject") {
    return corsJson(400, { error: "action must be approve or reject." });
  }
  if (!partitionKey) return corsJson(400, { error: "partitionKey is required." });

  try {
    const reviews = await table(REVIEWS_TABLE);
    const existing = await reviews.getEntity(partitionKey, reviewId);
    await reviews.updateEntity(
      {
        partitionKey,
        rowKey: reviewId,
        etag: existing.etag,
        status: action === "approve" ? "approved" : "rejected",
        reviewedAt: new Date().toISOString(),
      },
      "Merge"
    );
    const saved = await reviews.getEntity(partitionKey, reviewId);
    return corsJson(200, { success: true, review: reviewToJson(saved as Record<string, unknown>) });
  } catch (err) {
    context.error("plannerAdminModerateReview failed:", err);
    return corsJson(500, { error: "Could not moderate that review." });
  }
}

app.http("plannerListReviews", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/reviews",
  handler: plannerListReviews,
});

app.http("plannerCreateReview", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/reviews",
  handler: plannerCreateReview,
});

app.http("plannerAdminListReviews", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/admin/reviews",
  handler: plannerAdminListReviews,
});

app.http("plannerAdminModerateReview", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/admin/reviews/{reviewId}",
  handler: plannerAdminModerateReview,
});
