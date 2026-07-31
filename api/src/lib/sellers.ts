import { TableClient } from "@azure/data-tables";

export const APPLICATIONS_TABLE = "SellerApplications";
export const PUBLISHED_TABLE = "PublishedSellers";
export const MAX_PUBLISHED_SHOPS = 10;

export function table(name: string): TableClient {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("STORAGE_CONNECTION_STRING is not set.");
  return TableClient.fromConnectionString(connectionString, name);
}

export function adminKeyOk(request: { query: { get(name: string): string | null } }): boolean {
  const key = request.query.get("key");
  return Boolean(process.env.REPORT_ACCESS_KEY && key === process.env.REPORT_ACCESS_KEY);
}

export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "shop";
}

export function splitCsv(value: unknown): string[] {
  const str = typeof value === "string" ? value : "";
  return str ? str.split(", ").filter(Boolean) : [];
}

/** Public marketplace card payload. */
export function toPublicSeller(entity: Record<string, unknown>) {
  const categories = splitCsv(entity.productCategories);
  const other = String(entity.productCategoriesOther ?? "").trim();
  if (other) categories.push(other);

  return {
    id: String(entity.rowKey),
    name: String(entity.shopName ?? entity.name ?? ""),
    etsyUrl: String(entity.etsyShopUrl ?? entity.etsyUrl ?? ""),
    description: String(entity.shopDescription ?? entity.description ?? ""),
    photoUrls: splitCsv(entity.photoUrls),
    categories,
    featured: Boolean(entity.featured),
    socialLinks: {
      instagram: entity.instagramUrl ? String(entity.instagramUrl) : null,
      tiktok: entity.tiktokUrl ? String(entity.tiktokUrl) : null,
      facebook: entity.facebookUrl ? String(entity.facebookUrl) : null,
    },
    publishedAt: entity.publishedAt ? String(entity.publishedAt) : null,
  };
}

export async function countPublishedSellers(): Promise<number> {
  const client = table(PUBLISHED_TABLE);
  await client.createTable();
  let n = 0;
  for await (const entity of client.listEntities()) {
    if (!entity.status || entity.status === "published") n += 1;
  }
  return n;
}
