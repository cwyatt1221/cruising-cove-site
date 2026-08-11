/**
 * DCL / Cruising Cove planning news for newsletter “this week” sections.
 * Keep newest first; mirrored from site articles (API cannot import the browser IIFE).
 */

export type NewsletterArticle = {
  title: string;
  excerpt: string;
  date: string; // YYYY-MM-DD
  path: string;
};

const ARTICLES: NewsletterArticle[] = [
  {
    title: "Sparkle for sail days and park days — Shimmering Ever After",
    excerpt: "Sequin mouse ears and embroidered apparel from Founding Shop No. 2.",
    date: "2026-08-10",
    path: "/articles/welcome-aboard-shimmering-ever-after.html",
  },
  {
    title: "What a Disney Cruise Travel Agent Can Actually Do For You",
    excerpt:
      "Same price as booking direct — planning help, expertise, advocacy, and how to ask about onboard credit.",
    date: "2026-08-09",
    path: "/articles/what-a-disney-cruise-travel-agent-can-do.html",
  },
  {
    title: "Disney Cruise Pixie Dusting: Guest-to-Guest Surprises Explained",
    excerpt: "Etiquette, gift ideas, and how sailing Pixie Dust sign-ups work on Cruising Cove.",
    date: "2026-08-06",
    path: "/articles/disney-cruise-pixie-dusting.html",
  },
  {
    title: "Welcome Aboard Bels Castle Creations — First Marketplace Shop",
    excerpt: "Door magnets, fish extender gifts, cabin décor, and personalized keepsakes.",
    date: "2026-08-05",
    path: "/articles/welcome-aboard-bels-castle-creations.html",
  },
  {
    title: "What Most People Don't Know Happens on the Disney Destiny",
    excerpt: "Kiss Goodnight timing, Loki and Facilier takeovers, and Sanctum secrets.",
    date: "2026-08-05",
    path: "/articles/disney-destiny-hidden-secrets.html",
  },
  {
    title: "Disney Cruise Booking & Cost: Your Questions Answered",
    excerpt: "What’s included, agent vs Disney booking, insurance, discounts, and kids pricing.",
    date: "2026-08-04",
    path: "/articles/disney-cruise-booking-and-cost.html",
  },
];

function parseYmd(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`);
}

/** Prefer articles from the last `withinDays`; if fewer than `min`, pad with newest overall. */
export function recentNewsletterArticles(
  todayYmd: string,
  opts: { withinDays?: number; min?: number; max?: number } = {}
): NewsletterArticle[] {
  const withinDays = opts.withinDays ?? 7;
  const min = opts.min ?? 2;
  const max = opts.max ?? 4;
  const today = parseYmd(todayYmd);
  if (Number.isNaN(today)) return ARTICLES.slice(0, max);

  const cutoff = today - withinDays * 86_400_000;
  const recent = ARTICLES.filter((a) => {
    const t = parseYmd(a.date);
    return !Number.isNaN(t) && t >= cutoff && t <= today;
  });

  const picked = [...recent];
  if (picked.length < min) {
    for (const a of ARTICLES) {
      if (picked.some((p) => p.path === a.path)) continue;
      picked.push(a);
      if (picked.length >= min) break;
    }
  }
  return picked.slice(0, max);
}
