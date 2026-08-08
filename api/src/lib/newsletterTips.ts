/** Newsletter sailing-tip drip: milestones, content, and selection (pure / testable). */

export const TIP_MILESTONES = ["d90", "d60", "d30", "d14", "d7", "d0"] as const;
export type TipMilestoneId = (typeof TIP_MILESTONES)[number];

export interface TipMilestone {
  id: TipMilestoneId;
  /** Upper bound of the window (inclusive), in whole days until embarkation. */
  days: number;
  /** Lower bound exclusive — next milestone's days (or -1 for embarkation day). */
  afterDays: number;
  subjectSuffix: string;
}

/** Windows for a daily cron: send once when days-until falls into the band. Missed earlier tips are skipped (no catch-up spam). */
export const MILESTONES: TipMilestone[] = [
  { id: "d90", days: 90, afterDays: 60, subjectSuffix: "90 days to go" },
  { id: "d60", days: 60, afterDays: 30, subjectSuffix: "60 days to go" },
  { id: "d30", days: 30, afterDays: 14, subjectSuffix: "30 days to go" },
  { id: "d14", days: 14, afterDays: 7, subjectSuffix: "14 days to go" },
  { id: "d7", days: 7, afterDays: 0, subjectSuffix: "7 days to go" },
  { id: "d0", days: 0, afterDays: -1, subjectSuffix: "embarkation day" },
];

export function parseTipsSent(raw: unknown): TipMilestoneId[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is TipMilestoneId => TIP_MILESTONES.includes(x as TipMilestoneId));
  }
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is TipMilestoneId => TIP_MILESTONES.includes(x as TipMilestoneId));
  } catch {
    return [];
  }
}

export function serializeTipsSent(ids: TipMilestoneId[]): string {
  return JSON.stringify(ids);
}

/** Whole UTC calendar days from `todayYmd` to `embarkYmd` (negative if past). */
export function daysUntilEmbark(embarkYmd: string, todayYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(embarkYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) {
    return null;
  }
  const embark = Date.parse(`${embarkYmd}T00:00:00Z`);
  const today = Date.parse(`${todayYmd}T00:00:00Z`);
  if (Number.isNaN(embark) || Number.isNaN(today)) return null;
  return Math.round((embark - today) / 86_400_000);
}

/**
 * Pick at most one tip for today. Uses the tightest matching unsent window so late
 * signups get the current-stage tip, not a backlog of outdated milestones.
 */
export function selectMilestone(
  daysUntil: number,
  tipsSent: readonly string[]
): TipMilestone | null {
  if (daysUntil < 0) return null;
  const sent = new Set(tipsSent);
  for (const m of MILESTONES) {
    if (sent.has(m.id)) continue;
    if (m.id === "d0") {
      if (daysUntil === 0) return m;
      continue;
    }
    if (daysUntil <= m.days && daysUntil > m.afterDays) return m;
  }
  return null;
}

/** Short ship name for subjects: "Disney Wish" → "Wish". */
export function shipShortName(shipLabel: string): string {
  const label = shipLabel.trim();
  if (!label) return "";
  return label.replace(/^Disney\s+/i, "").trim() || label;
}

export function tipSubject(shipLabel: string, milestone: TipMilestone): string {
  const short = shipShortName(shipLabel);
  const prefix = short ? `${short} sailing tip` : "Sailing tip";
  return `${prefix}: ${milestone.subjectSuffix}`;
}

export interface TipEmailContent {
  html: string;
  text: string;
}

function siteBase(): string {
  return (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
}

function greeting(name: string, shipLabel: string): string {
  const who = name.trim() ? name.trim() : "there";
  const ship = shipLabel.trim();
  if (ship) return `Hi ${who} — your ${ship} sailing is coming up.`;
  return `Hi ${who} — your Disney cruise is coming up.`;
}

type TipLinks = { label: string; path: string }[];

function buildTip(opts: {
  name: string;
  shipLabel: string;
  body: string[];
  links: TipLinks;
}): TipEmailContent {
  const site = siteBase();
  const greet = greeting(opts.name, opts.shipLabel);
  const paragraphs = opts.body;
  const textLinks = opts.links.map((l) => `- ${l.label}: ${site}${l.path}`).join("\n");
  const text = [greet, "", ...paragraphs, "", "Helpful links:", textLinks, "", "— Cruising Cove", site].join(
    "\n"
  );
  const htmlParas = paragraphs.map((p) => `<p>${escapeForEmail(p)}</p>`).join("\n");
  const htmlLinks = opts.links
    .map((l) => `<li><a href="${site}${l.path}">${escapeForEmail(l.label)}</a></li>`)
    .join("");
  const html = `
    <p>${escapeForEmail(greet)}</p>
    ${htmlParas}
    <p><strong>Helpful links</strong></p>
    <ul>${htmlLinks}</ul>
    <p style="font-size:12px;color:#666">— Cruising Cove · <a href="${site}">${escapeForEmail(site)}</a></p>
  `;
  return { html, text };
}

function escapeForEmail(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildTipEmail(
  milestoneId: TipMilestoneId,
  opts: { name: string; shipLabel: string; embarkationDate: string }
): TipEmailContent {
  const { name, shipLabel, embarkationDate } = opts;
  const dateNote = embarkationDate ? ` Embarkation: ${embarkationDate}.` : "";

  switch (milestoneId) {
    case "d90":
      return buildTip({
        name,
        shipLabel,
        body: [
          `You're about 90 days out.${dateNote} This is a great window to confirm Castaway Club timing and start planning port adventures, dining, and kids clubs — windows open at different times by tier.`,
          "We don’t invent exact open dates here: use our booking-windows and Castaway Club guides so you know when your tier can book, then set a reminder in My Cruise if you like.",
          "Still booking or comparing sailings? A Disney-specialist agent can help with itineraries and cabin choices at no extra cost to you vs booking direct.",
        ],
        links: [
          { label: "Booking windows by Castaway tier", path: "/planning/booking-windows.html" },
          { label: "Castaway Club overview", path: "/planning/castaway-club.html" },
          { label: "Find an agent", path: "/agents/" },
        ],
      });
    case "d60":
      return buildTip({
        name,
        shipLabel,
        body: [
          `About 60 days to go.${dateNote} Gather travel docs early (passports / birth certificates as needed), and note when online check-in opens for your sailing so you’re ready the moment it does.`,
          "Skim the sailing timeline and deposit / final-payment guide so due dates don’t sneak up. If anything looks off on your reservation, it’s easier to fix now than in the final weeks.",
        ],
        links: [
          { label: "Sailing timeline", path: "/planning/sailing-timeline.html" },
          { label: "Deposit & final payment", path: "/planning/deposit-final-payment.html" },
          { label: "Before-you-go prep", path: "/articles/before-you-go-disney-cruise-prep.html" },
        ],
      });
    case "d30":
      return buildTip({
        name,
        shipLabel,
        body: [
          `One month out.${dateNote} Start a packing list, lock in must-do reservations (dining, spa, kids clubs where applicable), and peek at port days so you’re not improvising everything at the pier.`,
          "Kids clubs have age bands and registration steps — worth reading before you board. If you’re still sorting logistics, an agent can still help with changes.",
        ],
        links: [
          { label: "Disney cruise packing list", path: "/planning/disney-cruise-packing-list.html" },
          { label: "Kids clubs guide", path: "/planning/kids-clubs.html" },
          { label: "My Cruise planner", path: "/planning/my-cruise.html" },
        ],
      });
    case "d14":
      return buildTip({
        name,
        shipLabel,
        body: [
          `Two weeks out.${dateNote} Run through final payments if anything is still due, finish online check-in when it’s open, and walk the embarkation-day checklist so port morning feels calm.`,
          "Double-check what you need at the terminal (IDs, boarding docs, medication) and leave room in the suitcase for Pirate Night and any port days.",
        ],
        links: [
          { label: "Embarkation day checklist", path: "/planning/embarkation-day-checklist.html" },
          { label: "Deposit & final payment", path: "/planning/deposit-final-payment.html" },
          { label: "Packing list", path: "/planning/disney-cruise-packing-list.html" },
        ],
      });
    case "d7":
      return buildTip({
        name,
        shipLabel,
        body: [
          `Final week.${dateNote} Confirm arrival plans to the port, download any apps Disney recommends for your sailing, and set aside boarding documents where you’ll find them at 5 a.m.`,
          "A quick pass on seasickness prep, Wi‑Fi plans, and gratuities means fewer “wait, did we…?” moments once you’re onboard.",
        ],
        links: [
          { label: "Embarkation day checklist", path: "/planning/embarkation-day-checklist.html" },
          { label: "Seasickness tips", path: "/planning/seasickness.html" },
          { label: "Wi‑Fi guide", path: "/planning/wifi.html" },
        ],
      });
    case "d0":
      return buildTip({
        name,
        shipLabel,
        body: [
          `It’s embarkation day — have an amazing cruise!${dateNote}`,
          "Keep IDs and boarding docs handy, follow your arrival window, and use the embarkation checklist if you want a last calm scan before you leave for the terminal.",
          "Once you’re home, we’d love a review of your ship or ports in My Cruise — it helps the next family plan.",
        ],
        links: [
          { label: "Embarkation day checklist", path: "/planning/embarkation-day-checklist.html" },
          { label: "My Cruise (reviews & planner)", path: "/planning/my-cruise.html" },
          { label: "Community sailing boards", path: "/community/" },
        ],
      });
    default: {
      const _exhaustive: never = milestoneId;
      throw new Error(`Unknown milestone: ${_exhaustive}`);
    }
  }
}
