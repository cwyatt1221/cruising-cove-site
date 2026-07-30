import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  TRIPS_TABLE,
  corsJson,
  isCastawayTier,
  newId,
  parseJsonArray,
  parseJsonObject,
  parseCustomPacking,
  requireUser,
  table,
  tripToJson,
} from "../lib/planner";

function readTripBody(body: Record<string, unknown>) {
  const shipSlug = String(body.shipSlug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  const embarkDate = String(body.embarkDate ?? "").trim();
  const castawayTier = String(body.castawayTier ?? "firstTime");
  if (!shipSlug) throw new Error("Ship is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(embarkDate)) throw new Error("Embark date must be YYYY-MM-DD.");
  if (!isCastawayTier(castawayTier)) throw new Error("Invalid Castaway Club tier.");

  const nights = Math.max(1, Math.min(21, Number(body.nights) || 3));
  const ports = parseJsonArray(body.ports).slice(0, 20);
  const themes = parseJsonArray(body.themes).slice(0, 10);
  const cabinCandidates = parseJsonArray(body.cabinCandidates).slice(0, 20);
  const excursionShortlist = parseJsonArray(body.excursionShortlist).slice(0, 40);
  const signupPriority = parseJsonArray(body.signupPriority).slice(0, 40);
  const customPackingItems = parseCustomPacking(body.customPackingItems);
  const partyAges = (Array.isArray(body.partyAges) ? body.partyAges : parseJsonArray(body.partyAges))
    .map((n) => Number(n))
    .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 120)
    .slice(0, 12);
  const destinationRegion = String(body.destinationRegion ?? "other")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40) || "other";
  const title = String(body.title ?? "").trim().slice(0, 80);

  return {
    shipSlug,
    embarkDate,
    nights,
    ports,
    destinationRegion,
    castawayTier,
    partyAges,
    themes,
    cabinCandidates,
    customPackingItems,
    excursionShortlist,
    signupPriority,
    signupChecks: parseJsonObject(body.signupChecks),
    packingChecks: parseJsonObject(body.packingChecks),
    carryOnChecks: parseJsonObject(body.carryOnChecks),
    title,
  };
}

export async function plannerListTrips(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to sync your cruise planner." });

  try {
    const trips = await table(TRIPS_TABLE);
    const list = [];
    for await (const entity of trips.listEntities({ queryOptions: { filter: `PartitionKey eq '${user.userId}'` } })) {
      list.push(tripToJson(entity as Record<string, unknown>));
    }
    list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return corsJson(200, { trips: list });
  } catch (err) {
    context.error("plannerListTrips failed:", err);
    return corsJson(500, { error: "Could not load your trips." });
  }
}

export async function plannerUpsertTrip(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to sync your cruise planner." });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return corsJson(400, { error: "Request body must be valid JSON." });
  }

  let parsed;
  try {
    parsed = readTripBody(body);
  } catch (err) {
    return corsJson(400, { error: err instanceof Error ? err.message : "Invalid trip." });
  }

  const tripId = String(body.id ?? "").trim() || newId();
  const now = new Date().toISOString();
  const trips = await table(TRIPS_TABLE);

  try {
    let createdAt = now;
    try {
      const existing = await trips.getEntity(user.userId, tripId);
      createdAt = String(existing.createdAt ?? now);
    } catch {
      // create
    }

    await trips.upsertEntity(
      {
        partitionKey: user.userId,
        rowKey: tripId,
        shipSlug: parsed.shipSlug,
        embarkDate: parsed.embarkDate,
        nights: parsed.nights,
        portsJson: JSON.stringify(parsed.ports),
        destinationRegion: parsed.destinationRegion,
        castawayTier: parsed.castawayTier,
        partyAgesJson: JSON.stringify(parsed.partyAges),
        themesJson: JSON.stringify(parsed.themes),
        cabinCandidatesJson: JSON.stringify(parsed.cabinCandidates),
        customPackingJson: JSON.stringify(parsed.customPackingItems),
        excursionShortlistJson: JSON.stringify(parsed.excursionShortlist),
        signupPriorityJson: JSON.stringify(parsed.signupPriority),
        signupChecksJson: JSON.stringify(parsed.signupChecks),
        packingChecksJson: JSON.stringify(parsed.packingChecks),
        carryOnChecksJson: JSON.stringify(parsed.carryOnChecks),
        title: parsed.title,
        updatedAt: now,
        createdAt,
      },
      "Replace"
    );

    const saved = await trips.getEntity(user.userId, tripId);
    return corsJson(200, { success: true, trip: tripToJson(saved as Record<string, unknown>) });
  } catch (err) {
    context.error("plannerUpsertTrip failed:", err);
    return corsJson(500, { error: "Could not save your trip." });
  }
}

export async function plannerDeleteTrip(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (request.method === "OPTIONS") return corsJson(204, {});
  const user = await requireUser(request.headers);
  if (!user) return corsJson(401, { error: "Sign in to sync your cruise planner." });

  const tripId = request.params.tripId?.trim();
  if (!tripId) return corsJson(400, { error: "Trip id is required." });

  try {
    const trips = await table(TRIPS_TABLE);
    await trips.deleteEntity(user.userId, tripId);
    return corsJson(200, { success: true });
  } catch (err) {
    context.error("plannerDeleteTrip failed:", err);
    return corsJson(500, { error: "Could not delete that trip." });
  }
}

app.http("plannerListTrips", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/trips",
  handler: plannerListTrips,
});

app.http("plannerUpsertTrip", {
  methods: ["POST", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/trips",
  handler: plannerUpsertTrip,
});

app.http("plannerDeleteTrip", {
  methods: ["DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "planner/trips/{tripId}",
  handler: plannerDeleteTrip,
});
