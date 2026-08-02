import { randomBytes, randomUUID } from "crypto";
import { corsJson, requireUser, table } from "./community";

export const TRIPS_TABLE = "PlannerTrips";
export const REVIEWS_TABLE = "PlannerReviews";
export const SUGGESTIONS_TABLE = "PlannerSuggestions";
export const PACKING_ITEMS_TABLE = "PlannerPackingItems";

export { corsJson, requireUser, table };

export type CastawayTier =
  | "firstTime"
  | "silver"
  | "gold"
  | "platinum"
  | "pearl"
  | "concierge";

export type ReviewTargetType = "excursion" | "port" | "venue";

export function newId(): string {
  return randomUUID();
}

export function shortId(): string {
  return randomBytes(6).toString("hex");
}

export function isCastawayTier(value: string): value is CastawayTier {
  return (
    value === "firstTime" ||
    value === "silver" ||
    value === "gold" ||
    value === "platinum" ||
    value === "pearl" ||
    value === "concierge"
  );
}

export function isReviewTargetType(value: string): value is ReviewTargetType {
  return value === "excursion" || value === "port" || value === "venue";
}

export function reviewPartition(type: ReviewTargetType, targetId: string): string {
  const id = targetId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!id) throw new Error("Target id is required.");
  return `${type}:${id}`;
}

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function tripToJson(entity: Record<string, unknown>) {
  return {
    id: String(entity.rowKey),
    shipSlug: String(entity.shipSlug ?? ""),
    embarkDate: String(entity.embarkDate ?? ""),
    nights: Number(entity.nights ?? 0) || 0,
    ports: parseJsonArray(entity.portsJson),
    destinationRegion: String(entity.destinationRegion ?? "other"),
    castawayTier: String(entity.castawayTier ?? "firstTime"),
    partyAges: parseJsonArray(entity.partyAgesJson).map((n) => Number(n)).filter((n) => !Number.isNaN(n)),
    themes: parseJsonArray(entity.themesJson),
    cabinCandidates: parseJsonArray(entity.cabinCandidatesJson),
    customPackingItems: parseCustomPacking(entity.customPackingJson),
    signupChecks: parseJsonObject(entity.signupChecksJson),
    packingChecks: parseJsonObject(entity.packingChecksJson),
    carryOnChecks: parseJsonObject(entity.carryOnChecksJson),
    excursionShortlist: parseJsonArray(entity.excursionShortlistJson),
    signupPriority: parseJsonArray(entity.signupPriorityJson),
    title: String(entity.title ?? ""),
    updatedAt: String(entity.updatedAt ?? ""),
    createdAt: String(entity.createdAt ?? ""),
  };
}

export function parseCustomPacking(value: unknown): { id: string; label: string }[] {
  let raw: unknown[] = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) raw = parsed;
    } catch {
      return [];
    }
  }
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const obj = row as Record<string, unknown>;
      const id = String(obj.id ?? "").trim().slice(0, 64);
      const label = String(obj.label ?? "").trim().slice(0, 120);
      if (!id || !label) return null;
      return { id, label };
    })
    .filter((row): row is { id: string; label: string } => Boolean(row))
    .slice(0, 60);
}
