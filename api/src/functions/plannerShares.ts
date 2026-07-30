import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { randomBytes } from "crypto";
import {
  corsJson,
  parseJsonArray,
  parseJsonObject,
  parseCustomPacking,
  requireUser,
  table,
} from "../lib/planner";

export const SHARES_TABLE = "PlannerShares";

function shareToJson(entity: Record<string, unknown>) {
  return {
    token: String(entity.rowKey),
    trip: parseJsonObject(entity.tripJson),
    createdAt: String(entity.createdAt ?? ""),
    expiresAt: String(entity.expiresAt ?? ""),
  };
}

export async function plannerCreateShare(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  const trip = body.trip;
  if (!trip || typeof trip !== "object" || Array.isArray(trip)) {
    return corsJson(400, { error: "trip object is required." });
  }

  const t = trip as Record<string, unknown>;
  const shipSlug = String(t.shipSlug ?? "").trim();
  const embarkDate = String(t.embarkDate ?? "").trim();
  if (!shipSlug || !/^\d{4}-\d{2}-\d{2}$/.test(embarkDate)) {
    return corsJson(400, { error: "Trip needs a ship and embarkation date before sharing." });
  }

  // Snapshot only planning fields — never passwords/tokens.
  const snapshot = {
    shipSlug,
    embarkDate,
    nights: Number(t.nights) || 0,
    ports: parseJsonArray(t.ports),
    destinationRegion: String(t.destinationRegion ?? "other"),
    castawayTier: String(t.castawayTier ?? "firstTime"),
    partyAges: parseJsonArray(t.partyAges)
      .map((n) => Number(n))
      .filter((n) => !Number.isNaN(n)),
    themes: parseJsonArray(t.themes),
    cabinCandidates: parseJsonArray(t.cabinCandidates),
    customPackingItems: parseCustomPacking(t.customPackingItems),
    signupChecks: parseJsonObject(t.signupChecks),
    packingChecks: parseJsonObject(t.packingChecks),
    carryOnChecks: parseJsonObject(t.carryOnChecks),
    excursionShortlist: parseJsonArray(t.excursionShortlist),
    signupPriority: parseJsonArray(t.signupPriority),
    title: String(t.title ?? "").slice(0, 80),
  };

  const user = await requireUser(request.headers);
  const token = randomBytes(12).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime());
  expires.setDate(expires.getDate() + 90);

  try {
    const shares = await table(SHARES_TABLE);
    await shares.createEntity({
      partitionKey: "share",
      rowKey: token,
      tripJson: JSON.stringify(snapshot),
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      createdBy: user?.userId || "",
    });
    return corsJson(200, {
      success: true,
      token,
      urlPath: `/planning/my-cruise.html?share=${token}`,
      expiresAt: expires.toISOString(),
    });
  } catch (err) {
    context.error("plannerCreateShare failed:", err);
    return corsJson(500, { error: "Could not create a share link." });
  }
}

export async function plannerGetShare(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const token = request.params.token?.trim();
  if (!token) return corsJson(400, { error: "Share token is required." });

  try {
    const shares = await table(SHARES_TABLE);
    const entity = await shares.getEntity("share", token);
    const expiresAt = String(entity.expiresAt ?? "");
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      return corsJson(410, { error: "This share link has expired." });
    }
    return corsJson(200, shareToJson(entity as Record<string, unknown>));
  } catch (err) {
    context.error("plannerGetShare failed:", err);
    return corsJson(404, { error: "Share link not found." });
  }
}

app.http("plannerCreateShare", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/shares",
  handler: plannerCreateShare,
});

app.http("plannerGetShare", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/shares/{token}",
  handler: plannerGetShare,
});
