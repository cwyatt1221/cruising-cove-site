/**
 * Lightweight page retrieval: match question keywords to Cruising Cove pages,
 * fetch HTML from PUBLIC_SITE_URL, strip to text snippets for the chat prompt.
 */

export type RetrievablePage = {
  path: string;
  title: string;
  keywords: string[];
};

/** High-value guides the chat may pull live snippets from. */
export const RETRIEVABLE_PAGES: RetrievablePage[] = [
  { path: "/ships/disney-magic.html", title: "Disney Magic", keywords: ["magic", "lumiere", "rapunzel", "tangled"] },
  { path: "/ships/disney-wonder.html", title: "Disney Wonder", keywords: ["wonder", "tiana", "frozen", "ariel"] },
  { path: "/ships/disney-dream.html", title: "Disney Dream", keywords: ["dream", "aquaduck", "remy", "detective", "pepe"] },
  { path: "/ships/disney-fantasy.html", title: "Disney Fantasy", keywords: ["fantasy", "dumbo", "royal court", "woody"] },
  { path: "/ships/disney-wish.html", title: "Disney Wish", keywords: ["wish", "arendelle", "cinderella", "rapunzel", "pascal"] },
  {
    path: "/ships/disney-treasure.html",
    title: "Disney Treasure",
    keywords: ["treasure", "hook", "peter pan", "aladdin", "genie", "plaza de coco", "haunted mansion parlor", "skipper"],
  },
  {
    path: "/ships/disney-destiny.html",
    title: "Disney Destiny",
    keywords: ["destiny", "spider-man", "spiderman", "wakanda", "sanctum", "kiss goodnight", "pride lands"],
  },
  {
    path: "/ships/disney-adventure.html",
    title: "Disney Adventure",
    keywords: ["adventure", "singapore", "ironcycle", "san fransokyo"],
  },
  { path: "/ships/disney-believe.html", title: "Disney Believe", keywords: ["believe"] },
  { path: "/planning/disney-cruise-cost.html", title: "Disney cruise cost", keywords: ["cost", "price", "budget", "gratuity", "wifi", "fare"] },
  {
    path: "/planning/disney-cruise-packing-list.html",
    title: "Packing list",
    keywords: ["pack", "packing", "suitcase", "bring", "formal", "pirate night"],
  },
  { path: "/planning/booking-windows.html", title: "Booking windows", keywords: ["booking window", "reservation", "book"] },
  { path: "/planning/castaway-club.html", title: "Castaway Club", keywords: ["castaway club", "loyalty", "platinum", "gold", "silver"] },
  { path: "/planning/kids-clubs.html", title: "Kids clubs", keywords: ["oceaneer", "kids club", "nursery", "edge", "vibe"] },
  { path: "/planning/embarkation-day-checklist.html", title: "Embarkation day", keywords: ["embarkation", "port arrival", "boarding"] },
  { path: "/dining/", title: "Dining hub", keywords: ["dining", "palo", "remy", "enchante", "rotational"] },
  { path: "/entertainment/", title: "Entertainment hub", keywords: ["show", "entertainment", "theatre", "theater"] },
  {
    path: "/entertainment/#bingo-collectibles",
    title: "Bingo, sippers & popcorn buckets",
    keywords: ["popcorn", "popcorn bucket", "sipper", "bingo", "collectible"],
  },
  { path: "/articles/midship-detective-agency.html", title: "Midship Detective Agency", keywords: ["detective", "midship", "pepe"] },
  {
    path: "/articles/disney-destiny-hidden-secrets.html",
    title: "Destiny hidden secrets",
    keywords: ["kiss goodnight", "kiss goodnightmares", "sanctum", "hidden secret"],
  },
  { path: "/ports/castaway-cay.html", title: "Castaway Cay", keywords: ["castaway cay", "castaway"] },
  { path: "/ports/lookout-cay.html", title: "Lookout Cay", keywords: ["lookout cay", "lighthouse point"] },
  { path: "/ports/nassau.html", title: "Nassau", keywords: ["nassau", "atlantis"] },
  { path: "/ports/cozumel.html", title: "Cozumel", keywords: ["cozumel"] },
  { path: "/ports/grand-cayman.html", title: "Grand Cayman", keywords: ["cayman", "stingray"] },
  { path: "/ports/falmouth.html", title: "Falmouth", keywords: ["falmouth", "jamaica", "dunn"] },
  { path: "/ports/juneau.html", title: "Juneau", keywords: ["juneau", "mendenhall"] },
  { path: "/ports/ketchikan.html", title: "Ketchikan", keywords: ["ketchikan"] },
  { path: "/ports/skagway.html", title: "Skagway", keywords: ["skagway", "white pass"] },
  { path: "/ports/panama-canal.html", title: "Panama Canal", keywords: ["panama canal"] },
  { path: "/ports/departure-ports.html", title: "Departure ports", keywords: ["port canaveral", "everglades", "galveston", "homeport", "parking"] },
  { path: "/agents/", title: "Find an agent", keywords: ["travel agent", "agent"] },
];

export function scorePage(question: string, page: RetrievablePage): number {
  const q = question.toLowerCase();
  let score = 0;
  for (const kw of page.keywords) {
    if (q.includes(kw.toLowerCase())) score += kw.includes(" ") ? 3 : 2;
  }
  return score;
}

export function rankPagesForQuestion(question: string, limit = 2): RetrievablePage[] {
  return RETRIEVABLE_PAGES.map((page) => ({ page, score: scorePage(question, page) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.page);
}

export function siteBaseUrl(): string {
  return (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function clipSnippet(text: string, maxChars = 1800): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
}

async function fetchPageText(path: string, timeoutMs = 2500): Promise<string | null> {
  const url = `${siteBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/html", "User-Agent": "CruisingCoveChat/1.0" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = htmlToPlainText(html);
    return clipSnippet(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type RetrievedSnippet = {
  path: string;
  title: string;
  url: string;
  text: string;
};

export async function retrievePageSnippets(
  question: string,
  opts?: { limit?: number }
): Promise<RetrievedSnippet[]> {
  const pages = rankPagesForQuestion(question, opts?.limit ?? 2);
  if (!pages.length) return [];

  const results = await Promise.all(
    pages.map(async (page) => {
      const text = await fetchPageText(page.path);
      if (!text) return null;
      return {
        path: page.path,
        title: page.title,
        url: `${siteBaseUrl()}${page.path}`,
        text,
      } satisfies RetrievedSnippet;
    })
  );

  return results.filter((x): x is RetrievedSnippet => Boolean(x));
}

export function buildRetrievalBlock(snippets: RetrievedSnippet[]): string {
  if (!snippets.length) return "";
  const body = snippets
    .map(
      (s) =>
        `Page: ${s.title}\nURL: ${s.url}\nSnippet:\n${s.text}`
    )
    .join("\n\n---\n\n");
  return (
    "\n\n=== RETRIEVED CRUISING COVE PAGE SNIPPETS (prefer these details; cite Open this guide URLs) ===\n" +
    body +
    "\n=== END RETRIEVED SNIPPETS ==="
  );
}
