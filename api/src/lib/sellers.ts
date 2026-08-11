import { TableClient } from "@azure/data-tables";

export const APPLICATIONS_TABLE = "SellerApplications";
export const PUBLISHED_TABLE = "PublishedSellers";
export const MAX_PUBLISHED_SHOPS = 10;

/** Canonical marketplace category tags (apply form + filters). */
export const SELLER_CATEGORIES = [
  "Door magnets",
  "Fish extender gifts",
  "Cabin décor",
  "Personalized keepsakes",
  "Celebration / birthday",
  "Packing organizers",
  "Lanyards & credentials",
  "Luggage tags",
  "Apparel",
  "Printables",
] as const;

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
  return base || "shop";
}

export function splitCsv(value: unknown): string[] {
  const str = typeof value === "string" ? value : "";
  return str ? str.split(", ").filter(Boolean) : [];
}

export function joinCsv(arr: string[]): string {
  return arr.filter(Boolean).join(", ");
}

export type SocialProofQuote = { quote: string; name?: string };

export function parseSocialProofQuotes(value: unknown): SocialProofQuote[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const quote = String((item as { quote?: unknown }).quote ?? "").trim();
        if (!quote) return null;
        const name = String((item as { name?: unknown }).name ?? "").trim();
        return name ? { quote, name } : { quote };
      })
      .filter((q): q is SocialProofQuote => Boolean(q));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return parseSocialProofQuotes(JSON.parse(trimmed));
    } catch {
      // Legacy: plain quote string
      return [{ quote: trimmed.slice(0, 280) }];
    }
  }
  return [];
}

export function serializeSocialProofQuotes(quotes: SocialProofQuote[]): string {
  return JSON.stringify(
    quotes
      .map((q) => {
        const quote = String(q.quote || "").trim().slice(0, 280);
        if (!quote) return null;
        const name = String(q.name || "").trim().slice(0, 60);
        return name ? { quote, name } : { quote };
      })
      .filter(Boolean)
  );
}

/** Resolve public category list from entity fields. */
export function resolveCategories(entity: Record<string, unknown>): string[] {
  // Prefer JSON `categories` when present (admin edits / newer rows)
  if (typeof entity.categories === "string" && entity.categories.trim()) {
    try {
      const parsed = JSON.parse(entity.categories);
      if (Array.isArray(parsed)) {
        return parsed.map((c) => String(c).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  if (Array.isArray(entity.categories)) {
    return entity.categories.map((c) => String(c).trim()).filter(Boolean);
  }

  const categories = splitCsv(entity.productCategories);
  const other = String(entity.productCategoriesOther ?? "").trim();
  if (other) categories.push(other);
  return categories;
}

/** Public marketplace card payload. */
export function toPublicSeller(entity: Record<string, unknown>) {
  const quotes = parseSocialProofQuotes(entity.socialProofQuotes);
  const visitRaw = entity.visitCount;
  const visitCount =
    typeof visitRaw === "number"
      ? visitRaw
      : typeof visitRaw === "string" && visitRaw.trim()
        ? Number(visitRaw) || 0
        : 0;

  return {
    id: String(entity.rowKey),
    name: String(entity.shopName ?? entity.name ?? ""),
    shopUrl: String(entity.shopUrl ?? entity.etsyShopUrl ?? entity.etsyUrl ?? ""),
    description: String(entity.shopDescription ?? entity.description ?? ""),
    photoUrls: splitCsv(entity.photoUrls),
    categories: resolveCategories(entity),
    featured: Boolean(entity.featured),
    socialProofQuotes: quotes,
    visitCount: Math.max(0, Math.floor(visitCount)),
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

/** One-time-friendly defaults for founding shop Bels Castle Creations. */
export const BELS_CASTLE_DEFAULTS = {
  categories: [
    "Door magnets",
    "Fish extender gifts",
    "Cabin décor",
    "Personalized keepsakes",
    "Celebration / birthday",
  ],
  socialProofQuotes: [
    {
      quote:
        "Our door magnets made embarkation day feel magical — and the fish extender gifts were a hit with the whole sailing.",
      name: "Sarah",
    },
  ] as SocialProofQuote[],
};

/** Defaults for founding shop Shimmering Ever After. */
export const SHIMMERING_EVER_AFTER_DEFAULTS = {
  socialProofQuotes: [
    {
      quote:
        "Asked the seller one week prior to my unexpected Disney trip if she can get it to me on time. She told me about the rush order and worked her magic and within two days it was on its way to me. Not only did it come on time but the quality is top notch. I got so many compliments! Will purchase from this seller again! 11/10",
    },
  ] as SocialProofQuote[],
};

/**
 * If a known founding shop is live without tags/quotes, persist sensible defaults.
 * Safe to call on every list — only writes when fields are empty.
 */
export async function maybeBackfillFoundingSeller(
  entity: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const id = String(entity.rowKey || "");

  if (id === "bels-castle-creations") {
    const categories = resolveCategories(entity);
    const quotes = parseSocialProofQuotes(entity.socialProofQuotes);
    const needsCategories = categories.length === 0;
    const needsQuotes = quotes.length === 0;
    if (!needsCategories && !needsQuotes) return entity;

    const patch: {
      partitionKey: string;
      rowKey: string;
      categories?: string;
      productCategories?: string;
      socialProofQuotes?: string;
    } = {
      partitionKey: "directory",
      rowKey: id,
    };

    let next = { ...entity };
    if (needsCategories) {
      patch.categories = JSON.stringify(BELS_CASTLE_DEFAULTS.categories);
      patch.productCategories = joinCsv([...BELS_CASTLE_DEFAULTS.categories]);
      next = { ...next, ...patch };
    }
    if (needsQuotes) {
      patch.socialProofQuotes = serializeSocialProofQuotes(BELS_CASTLE_DEFAULTS.socialProofQuotes);
      next = { ...next, socialProofQuotes: patch.socialProofQuotes };
    }

    try {
      const client = table(PUBLISHED_TABLE);
      await client.updateEntity(patch, "Merge");
    } catch {
      /* non-fatal — still return enriched public payload */
    }

    return next;
  }

  if (id === "shimmering-ever-after") {
    const quotes = parseSocialProofQuotes(entity.socialProofQuotes);
    if (quotes.length > 0) return entity;

    const patch = {
      partitionKey: "directory",
      rowKey: id,
      socialProofQuotes: serializeSocialProofQuotes(SHIMMERING_EVER_AFTER_DEFAULTS.socialProofQuotes),
    };

    try {
      const client = table(PUBLISHED_TABLE);
      await client.updateEntity(patch, "Merge");
    } catch {
      /* non-fatal */
    }

    return { ...entity, socialProofQuotes: patch.socialProofQuotes };
  }

  return entity;
}
