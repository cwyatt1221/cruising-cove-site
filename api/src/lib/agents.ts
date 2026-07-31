import { TableClient } from "@azure/data-tables";

export const APPLICATIONS_TABLE = "AgentApplications";
export const PUBLISHED_TABLE = "PublishedAgents";

export { adminAuthOk as adminKeyOk } from "./adminAuth";

export function table(name: string): TableClient {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
  return TableClient.fromConnectionString(connectionString, name);
}

export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "agent";
}

export function splitCsv(value: unknown): string[] {
  const str = typeof value === "string" ? value : "";
  return str ? str.split(", ").filter(Boolean) : [];
}

export function highlightsList(value: unknown): string[] {
  const str = typeof value === "string" ? value : "";
  return str
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function yearsNumber(value: unknown): number | null {
  const str = String(value ?? "").trim();
  const match = str.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function sailingsNumber(value: unknown): number | null {
  const str = String(value ?? "").trim();
  const match = str.match(/\d+/);
  return match ? Number(match[0]) : null;
}

export function earmarkedBool(value: unknown): boolean {
  return String(value ?? "").toLowerCase() === "yes";
}

/** Public directory card / profile payload (no private contact fields). */
export function toPublicAgent(entity: Record<string, unknown>) {
  const specialties = splitCsv(entity.specialties);
  const other = String(entity.specialtiesOther ?? "").trim();
  if (other) specialties.push(other);

  return {
    id: String(entity.rowKey),
    name: String(entity.name ?? ""),
    agency: String(entity.agency ?? ""),
    location: String(entity.location ?? ""),
    years: typeof entity.years === "number" ? entity.years : yearsNumber(entity.yearsExperience),
    sailings: typeof entity.sailings === "number" ? entity.sailings : sailingsNumber(entity.sailingsPlanned),
    sailingsSailed: entity.sailingsSailed ? String(entity.sailingsSailed) : null,
    shipsSailed: entity.shipsSailed ? String(entity.shipsSailed) : null,
    earmarked: Boolean(entity.earmarked),
    featured: Boolean(entity.featured),
    sample: false,
    photoUrl: entity.photoUrl ? String(entity.photoUrl) : null,
    website: entity.website ? String(entity.website) : null,
    specialties,
    pitch: String(entity.pitch ?? ""),
    bio: String(entity.bio ?? ""),
    whyChooseMe: String(entity.whyChooseMe ?? ""),
    highlights: highlightsList(entity.highlights),
    chargesFees: String(entity.chargesFees ?? ""),
    feeNotes: String(entity.feeNotes ?? ""),
    socialLinks: {
      instagram: entity.instagramUrl ? String(entity.instagramUrl) : null,
      facebook: entity.facebookUrl ? String(entity.facebookUrl) : null,
      tiktok: entity.tiktokUrl ? String(entity.tiktokUrl) : null,
    },
    publishedAt: entity.publishedAt ? String(entity.publishedAt) : null,
  };
}
