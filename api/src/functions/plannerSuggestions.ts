import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  PACKING_ITEMS_TABLE,
  SUGGESTIONS_TABLE,
  corsJson,
  newId,
  parseJsonArray,
  requireUser,
  shortId,
  table,
} from "../lib/planner";

function suggestionToJson(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey),
    item: String(entity.item ?? ""),
    reason: String(entity.reason ?? ""),
    tags: parseJsonArray(entity.tagsJson),
    status: String(entity.status ?? "pending"),
    displayName: String(entity.displayName ?? "Guest"),
    userId: String(entity.userId ?? ""),
    createdAt: String(entity.createdAt ?? ""),
    reviewedAt: String(entity.reviewedAt ?? ""),
    adminNote: String(entity.adminNote ?? ""),
  };
}

function packingItemToJson(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey),
    label: String(entity.label ?? ""),
    tags: parseJsonArray(entity.tagsJson),
    category: String(entity.category ?? "extras"),
    carryOn: Boolean(entity.carryOn),
    sourceSuggestionId: String(entity.sourceSuggestionId ?? ""),
    createdAt: String(entity.createdAt ?? ""),
  };
}

function adminKeyOk(request: HttpRequest): boolean {
  const key = request.query.get("key") || request.headers.get("x-cc-admin-key") || "";
  return Boolean(process.env.REPORT_ACCESS_KEY && key === process.env.REPORT_ACCESS_KEY);
}

export async function plannerSubmitSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to suggest a packing item." });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const item = String(body.item ?? "").trim().slice(0, 120);
  const reason = String(body.reason ?? "").trim().slice(0, 500);
  const tags = parseJsonArray(body.tags).slice(0, 12);
  if (item.length < 3) return corsJson(400, { error: "Please describe the packing item." });

  try {
    const id = newId();
    const now = new Date().toISOString();
    const suggestions = await table(SUGGESTIONS_TABLE);
    await suggestions.createEntity({
      partitionKey: "packing",
      rowKey: id,
      item,
      reason,
      tagsJson: JSON.stringify(tags),
      status: "pending",
      displayName: user.displayName,
      userId: user.userId,
      createdAt: now,
      reviewedAt: "",
      adminNote: "",
    });
    return corsJson(200, { success: true, id, message: "Thanks — we’ll review this before it goes live." });
  } catch (err) {
    context.error("plannerSubmitSuggestion failed:", err);
    return corsJson(500, { error: "Could not submit that suggestion." });
  }
}

export async function plannerListApprovedPacking(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  try {
    const items = await table(PACKING_ITEMS_TABLE);
    const list = [];
    for await (const entity of items.listEntities({ queryOptions: { filter: `PartitionKey eq 'approved'` } })) {
      list.push(packingItemToJson(entity as Record<string, unknown>));
    }
    list.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
    return corsJson(200, { items: list });
  } catch (err) {
    context.error("plannerListApprovedPacking failed:", err);
    return corsJson(500, { error: "Could not load community packing items." });
  }
}

export async function plannerAdminListSuggestions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  if (!adminKeyOk(request)) return corsJson(401, { error: "Missing or invalid admin key." });

  const statusFilter = request.query.get("status") || "pending";

  try {
    const suggestions = await table(SUGGESTIONS_TABLE);
    const list = [];
    for await (const entity of suggestions.listEntities({
      queryOptions: { filter: `PartitionKey eq 'packing'` },
    })) {
      const row = suggestionToJson(entity as Record<string, unknown>);
      if (statusFilter !== "all" && row.status !== statusFilter) continue;
      list.push(row);
    }
    list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return corsJson(200, { suggestions: list });
  } catch (err) {
    context.error("plannerAdminListSuggestions failed:", err);
    return corsJson(500, { error: "Could not list suggestions." });
  }
}

export async function plannerAdminModerateSuggestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  if (!adminKeyOk(request)) return corsJson(401, { error: "Missing or invalid admin key." });

  const suggestionId = request.params.suggestionId?.trim();
  if (!suggestionId) return corsJson(400, { error: "Suggestion id is required." });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const action = String(body.action ?? "").trim();
  const adminNote = String(body.adminNote ?? "").trim().slice(0, 300);
  if (action !== "approve" && action !== "reject") {
    return corsJson(400, { error: "action must be approve or reject." });
  }

  try {
    const suggestions = await table(SUGGESTIONS_TABLE);
    const existing = await suggestions.getEntity("packing", suggestionId);
    const now = new Date().toISOString();
    const status = action === "approve" ? "approved" : "rejected";

    await suggestions.updateEntity(
      {
        partitionKey: "packing",
        rowKey: suggestionId,
        etag: existing.etag,
        status,
        reviewedAt: now,
        adminNote,
      },
      "Merge"
    );

    if (action === "approve") {
      const packing = await table(PACKING_ITEMS_TABLE);
      const tags = parseJsonArray(existing.tagsJson);
      const label = String(body.label ?? existing.item ?? "").trim().slice(0, 120);
      const category = String(body.category ?? "community").trim().slice(0, 40) || "community";
      const carryOn = Boolean(body.carryOn);
      await packing.upsertEntity(
        {
          partitionKey: "approved",
          rowKey: `c_${shortId()}`,
          label,
          tagsJson: JSON.stringify(tags),
          category,
          carryOn,
          sourceSuggestionId: suggestionId,
          createdAt: now,
        },
        "Replace"
      );
    }

    const saved = await suggestions.getEntity("packing", suggestionId);
    return corsJson(200, { success: true, suggestion: suggestionToJson(saved as Record<string, unknown>) });
  } catch (err) {
    context.error("plannerAdminModerateSuggestion failed:", err);
    return corsJson(500, { error: "Could not moderate that suggestion." });
  }
}

app.http("plannerSubmitSuggestion", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/packing-suggestions",
  handler: plannerSubmitSuggestion,
});

app.http("plannerListApprovedPacking", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/packing-items",
  handler: plannerListApprovedPacking,
});

app.http("plannerAdminListSuggestions", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/admin/packing-suggestions",
  handler: plannerAdminListSuggestions,
});

app.http("plannerAdminModerateSuggestion", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/admin/packing-suggestions/{suggestionId}",
  handler: plannerAdminModerateSuggestion,
});
