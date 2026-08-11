/**
 * Themed Welcome Aboard HTML emails for newsletter signup.
 * Templates live in api/templates/welcome-aboard/ (bundled with Functions).
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { escapeHtml } from "./email";
import { monthFromYmd } from "./portClimate";
import { CatalogSailing, lookupSailing } from "./sailingCatalog";
import type { SailingEmailContent } from "./newsletterSailingEmail";

export type SailingWelcomeTheme = "base" | "halloween" | "christmas";
export type WelcomeTheme = SailingWelcomeTheme | "generic";

export type BuildWelcomeAboardOpts = {
  name: string;
  shipSlug: string;
  shipLabel: string;
  embarkationDate: string;
  unsubUrl?: string;
};

export type BuildNewsletterWelcomeOpts = {
  name: string;
  shipSlug?: string;
  shipLabel?: string;
  embarkationDate?: string;
  unsubUrl?: string;
};

const TEMPLATE_FILES: Record<WelcomeTheme, string> = {
  base: "base.html",
  halloween: "halloween.html",
  christmas: "christmas.html",
  generic: "generic.html",
};

function templatesDir(): string {
  // Compiled: dist/src/lib → ../../../templates/welcome-aboard
  return join(dirname(__filename), "..", "..", "..", "templates", "welcome-aboard");
}

function loadTemplate(theme: WelcomeTheme): string {
  const file = join(templatesDir(), TEMPLATE_FILES[theme]);
  return readFileSync(file, "utf8");
}

function siteBaseUrl(): string {
  return (process.env.PUBLIC_SITE_URL || "https://www.cruisingcove.com").replace(/\/$/, "");
}

function formatDisplayDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd || "").trim());
  if (!m) return ymd;
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const month = months[Number(m[2]) - 1] || m[2];
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((ymd || "").trim());
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatSailRange(embark: string, returnYmd: string | undefined, nights: number | undefined): string {
  const start = formatDisplayDate(embark);
  const endYmd = returnYmd || (nights != null ? addDaysYmd(embark, nights) : "");
  if (!endYmd) return start;
  const end = formatDisplayDate(endYmd);
  const sm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(embark);
  const em = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endYmd);
  if (sm && em && sm[1] === em[1] && sm[2] === em[2]) {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[Number(sm[2]) - 1]} ${Number(sm[3])}–${Number(em[3])}, ${sm[1]}`;
  }
  return `${start} – ${end}`;
}

function themeFromCatalogLabel(theme: string | undefined): SailingWelcomeTheme | null {
  const t = (theme || "").trim();
  if (!t) return null;
  if (/halloween/i.test(t)) return "halloween";
  if (/merry|christmas|christmastime|holiday/i.test(t)) return "christmas";
  return null;
}

/**
 * Prefer curated catalog theme when the sailing is known.
 * - Known sailing with Halloween / Merrytime theme → that variant
 * - Known sailing with no theme → base (e.g. post-Merrytime Dec 26 Treasure)
 * - Unknown sailing → Sep–Oct halloween, Nov–Dec christmas, else base
 */
export function resolveWelcomeTheme(shipSlug: string, embarkationDate: string): SailingWelcomeTheme {
  const sailing = lookupSailing(shipSlug, embarkationDate);
  if (sailing) {
    return themeFromCatalogLabel(sailing.theme) || "base";
  }
  const month = monthFromYmd(embarkationDate);
  if (month === 9 || month === 10) return "halloween";
  if (month === 11 || month === 12) return "christmas";
  return "base";
}

/** Sailing Welcome Aboard when ship + date exist; otherwise Welcome to the Cove. */
export function resolveNewsletterWelcomeTheme(
  shipSlug?: string,
  embarkationDate?: string
): WelcomeTheme {
  const slug = (shipSlug || "").trim();
  const embark = (embarkationDate || "").trim();
  if (!slug || !embark) return "generic";
  return resolveWelcomeTheme(slug, embark);
}

export function fillPlaceholders(
  template: string,
  data: Record<string, string>,
  onMissing?: (key: string) => void
): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      return value == null ? "" : String(value);
    }
    onMissing?.(key);
    return match;
  });
}

function dayNumberFromLabel(label: string): number | null {
  const m = /Day\s+(\d+)/i.exec((label || "").trim());
  return m ? Number(m[1]) : null;
}

export type ItineraryStop = { dayLabel: string; title: string };

/** Embark → ports (with At sea gaps) → return, from curated catalog. */
export function buildItineraryStops(
  sailing: CatalogSailing | null,
  departurePort: string
): ItineraryStop[] {
  const portName = (departurePort || "your departure port").trim() || "your departure port";
  if (!sailing || !sailing.nights || sailing.nights < 1) {
    return [
      { dayLabel: "Day 1", title: `Embark — ${portName}` },
      { dayLabel: "Ports", title: "Confirm your full itinerary in My Reservations / Navigator" },
      { dayLabel: "Return", title: `Return — ${portName}` },
    ];
  }

  const lastDay = sailing.nights + 1;
  const byDay = new Map<number, string>();
  for (const p of sailing.ports || []) {
    const n = dayNumberFromLabel(p.dayLabel);
    if (n != null && n >= 2 && n < lastDay) {
      byDay.set(n, p.name);
    }
  }

  const stops: ItineraryStop[] = [
    { dayLabel: "Day 1", title: `Embark — ${portName}` },
  ];
  for (let d = 2; d < lastDay; d++) {
    stops.push({
      dayLabel: `Day ${d}`,
      title: byDay.get(d) || "At sea",
    });
  }
  stops.push({ dayLabel: `Day ${lastDay}`, title: `Return — ${portName}` });
  return stops;
}

function itineraryThemeColors(theme: SailingWelcomeTheme): { day: string; text: string } {
  if (theme === "halloween") return { day: "#D9622B", text: "#1A1030" };
  if (theme === "christmas") return { day: "#B03A2E", text: "#0F3D2E" };
  return { day: "#E8785A", text: "#0B2545" };
}

export function formatItineraryRowsHtml(
  stops: ItineraryStop[],
  theme: SailingWelcomeTheme
): string {
  const colors = itineraryThemeColors(theme);
  return stops
    .map((stop, i) => {
      const border =
        i < stops.length - 1 ? "border-bottom:1px dashed #E0D6C2;" : "";
      return `<tr>
            <td style="padding:8px 0;${border}font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:${colors.day};font-weight:bold;width:90px;font-size:12px;letter-spacing:0.5px;text-transform:uppercase;vertical-align:top;">${escapeHtml(stop.dayLabel)}</td>
            <td style="padding:8px 0;${border}font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:14px;color:${colors.text};vertical-align:top;">${escapeHtml(stop.title)}</td>
          </tr>`;
    })
    .join("");
}

function firstPort(sailing: CatalogSailing | null): {
  name: string;
  arrival: string;
  departure: string;
  excursions: string[];
} {
  if (!sailing?.ports?.length) {
    return {
      name: "Your first port of call",
      arrival: "See Navigator for arrival",
      departure: "See Navigator for all-aboard",
      excursions: [
        "Check shore excursions in the Disney Cruise Line Navigator app",
        "Leave a real return buffer to the ship",
        "Pack reef-safe sunscreen and a light cover-up",
      ],
    };
  }
  const port = sailing.ports[0];
  const ideas = (sailing.excursionsByPort[port.portId] || []).slice(0, 3);
  return {
    name: port.name,
    arrival: `${port.dayLabel} — see Navigator for exact arrival`,
    departure: "Confirm all-aboard time in Navigator",
    excursions:
      ideas.length > 0
        ? ideas.map((ex) => `${ex.name}${ex.price ? ` (${ex.price})` : ""} — ${ex.summary}`)
        : [
            "Browse shore excursions in the Navigator app",
            "Leave a real return buffer to the ship",
            "Pack reef-safe sunscreen and a light cover-up",
          ],
  };
}

function itineraryName(
  sailing: CatalogSailing | null,
  shipLabel: string,
  theme: SailingWelcomeTheme
): string {
  if (sailing?.theme) {
    const nights = sailing.nights ? `${sailing.nights}-Night ` : "";
    return `${nights}${sailing.theme}`;
  }
  if (theme === "halloween") return "Halloween on the High Seas sailing";
  if (theme === "christmas") return "Very Merrytime sailing";
  if (sailing?.nights) return `${sailing.nights}-Night ${shipLabel} sailing`;
  return `${shipLabel} sailing`;
}

export function buildWelcomeToCoveData(opts: {
  name: string;
  unsubUrl?: string;
}): { theme: "generic"; data: Record<string, string> } {
  const name = (opts.name || "").trim() || "there";
  const site = siteBaseUrl();
  return {
    theme: "generic",
    data: {
      GUEST_NAME: name,
      WELCOME_MESSAGE:
        "Thanks for joining Cruising Cove. We’ll send planning tips, ship notes, and marketplace finds when they’re useful — not a weekly blast.",
      KEY_CARD_INSTRUCTIONS:
        "Your Key to the World card unlocks your stateroom and is your onboard ID and charge card. Download the Disney Cruise Line Navigator app before sail-away.",
      DINING_INSTRUCTIONS:
        "Your rotational dining assignment is on your Key to the World card. Specialty dining can be requested through Guest Services or the Navigator app after embarkation.",
      WIFI_INSTRUCTIONS:
        "Connect to Disney Cruise Line Wi‑Fi and purchase a package in the Navigator app or at Guest Services (typically per device).",
      MUSTER_INSTRUCTIONS:
        "Assigned after boarding — check the Navigator app or your stateroom TV for time and location.",
      UNLOCK_MESSAGE:
        "Have a sailing booked (or almost booked)? Add your ship and embarkation date to get a personalized Welcome Aboard note plus short tips at key milestones before you cruise.",
      SHIPS_URL: `${site}/ships/`,
      PACKING_URL: `${site}/planning/disney-cruise-packing-list.html`,
      AGENTS_URL: `${site}/agents/`,
      MARKETPLACE_URL: `${site}/marketplace/`,
      COMMUNITY_URL: `${site}/community/`,
      NEWSLETTER_URL: `${site}/newsletter/`,
      SOCIAL_HASHTAG: "#CruisingCove",
      UNSUB_URL: (opts.unsubUrl || `${site}/newsletter/unsubscribe.html`).trim(),
    },
  };
}

export function buildWelcomeToCoveEmail(opts: {
  name: string;
  unsubUrl?: string;
}): SailingEmailContent {
  const { data } = buildWelcomeToCoveData(opts);
  const missing = new Set<string>();
  const html = fillPlaceholders(loadTemplate("generic"), data, (key) => missing.add(key));
  if (missing.size) {
    console.warn(`welcomeToCove missing placeholders: ${[...missing].sort().join(", ")}`);
  }
  const subject = "Welcome to the Cove";
  const text = [
    "Welcome to the Cove — Cruising Cove",
    "",
    `Hi ${data.GUEST_NAME},`,
    data.WELCOME_MESSAGE,
    "",
    "Getting started:",
    `· Key Card & App: ${data.KEY_CARD_INSTRUCTIONS}`,
    `· Dining: ${data.DINING_INSTRUCTIONS}`,
    `· WiFi: ${data.WIFI_INSTRUCTIONS}`,
    `· Muster: ${data.MUSTER_INSTRUCTIONS}`,
    "",
    "Explore:",
    `· Ships: ${data.SHIPS_URL}`,
    `· Packing list: ${data.PACKING_URL}`,
    `· Travel agent directory: ${data.AGENTS_URL}`,
    `· Marketplace: ${data.MARKETPLACE_URL}`,
    `· Community: ${data.COMMUNITY_URL}`,
    "",
    data.UNLOCK_MESSAGE,
    `Add your ship & date: ${data.NEWSLETTER_URL}`,
    "",
    data.UNSUB_URL ? `Unsubscribe: ${data.UNSUB_URL}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}

export function buildWelcomeAboardData(opts: BuildWelcomeAboardOpts): {
  theme: SailingWelcomeTheme;
  data: Record<string, string>;
} {
  const shipLabel = (opts.shipLabel || "your ship").trim();
  const name = (opts.name || "").trim() || "there";
  const embark = (opts.embarkationDate || "").trim();
  const sailing = lookupSailing(opts.shipSlug, embark);
  const theme = resolveWelcomeTheme(opts.shipSlug, embark);
  const port = firstPort(sailing);
  const departurePort = sailing?.departurePort || "Your departure port";
  const returnPort = sailing?.departurePort || "Your return port";
  const sailDate = formatSailRange(embark, sailing?.returnDate, sailing?.nights);
  const site = siteBaseUrl();
  const itineraryStops = buildItineraryStops(sailing, departurePort);
  const itineraryRowsHtml = formatItineraryRowsHtml(itineraryStops, theme);
  const itineraryText = itineraryStops.map((s) => `${s.dayLabel}: ${s.title}`).join("\n");

  const captainsByTheme: Record<SailingWelcomeTheme, string> = {
    base: `Welcome aboard ${shipLabel}! We’re glad you’re on the Cruising Cove list for this sailing. Below is a quick snapshot to help you settle in — and we’ll send short tips at key milestones before you embark.`,
    halloween: `Welcome aboard ${shipLabel} for Halloween on the High Seas! From festive décor and costume fun to Mouse-querade moments, this sailing is packed with family-friendly spooky season energy. Here’s a quick snapshot to get you started — more tips land as embarkation gets closer.`,
    christmas: `Welcome aboard ${shipLabel} for the holidays at sea! Deck the Ship moments, tree lighting, and seasonal dining make Very Merrytime sailings feel extra magical. Here’s a quick snapshot to get you started — more tips land as embarkation gets closer.`,
  };

  const data: Record<string, string> = {
    SHIP_NAME: shipLabel,
    SAIL_DATE: sailDate || formatDisplayDate(embark) || embark,
    ITINERARY_NAME: itineraryName(sailing, shipLabel, theme),
    DEPARTURE_PORT: departurePort,
    DEPARTURE_TIME: sailing?.departureTime || "See your cruise documents",
    RETURN_PORT: returnPort,
    RETURN_TIME: sailing?.returnTime || "See your cruise documents",
    MUSTER_TIME: "As assigned",
    MUSTER_LOCATION: "Check the Navigator app / your stateroom TV",
    WEATHER_SUMMARY: "Check Navigator closer to sail for the forecast",
    GUEST_NAME: name,
    CAPTAINS_WELCOME_MESSAGE: captainsByTheme[theme],
    CAPTAIN_NAME: "Your Cruising Cove crew",
    KEY_CARD_INSTRUCTIONS:
      "Your Key to the World card unlocks your stateroom and is your onboard ID and charge card. Download the Disney Cruise Line Navigator app before sail-away.",
    DINING_INSTRUCTIONS:
      "Your rotational dining assignment is on your Key to the World card. Specialty dining can be requested through Guest Services or the Navigator app after embarkation.",
    WIFI_INSTRUCTIONS:
      "Connect to Disney Cruise Line Wi‑Fi and purchase a package in the Navigator app or at Guest Services (typically per device).",
    EVENT_1_TIME: "Sail-away",
    EVENT_1_DESCRIPTION: `Welcome-aboard energy as ${shipLabel} leaves port — perfect for first deck photos.`,
    EVENT_2_TIME: theme === "halloween" ? "Halloween fun" : theme === "christmas" ? "Holiday fun" : "Sea day",
    EVENT_2_DESCRIPTION:
      theme === "halloween"
        ? "Look for festive décor, seasonal treats, and costume moments — check Navigator for parade and party times."
        : theme === "christmas"
          ? "Deck the Ship reveals, tree lighting, and holiday treats — check Navigator for ceremony times."
          : "Broadway-style shows, pools, and rotational dining — skim the ship guide before you board.",
    EVENT_3_TIME: "Port days",
    EVENT_3_DESCRIPTION: `First landfall highlight: ${port.name}. Confirm exact times in My Reservations / Navigator.`,
    PORT_NAME: port.name,
    PORT_ARRIVAL_TIME: port.arrival,
    PORT_DEPARTURE_TIME: port.departure,
    EXCURSION_1: port.excursions[0] || "See Navigator for shore excursions",
    EXCURSION_2: port.excursions[1] || "Leave a return buffer to the ship",
    EXCURSION_3: port.excursions[2] || "Pack reef-safe sunscreen",
    ITINERARY_ROWS: itineraryRowsHtml,
    ITINERARY_TEXT: itineraryText,
    DRESS_CODE:
      theme === "halloween"
        ? "Cruise casual most evenings; costumes welcome for Mouse-querade / parade nights — check Navigator."
        : theme === "christmas"
          ? "Cruise casual most evenings; festive outfits are welcome for tree lighting and holiday dinners."
          : "Cruise casual — no swimwear in the main dining rooms after 5 PM.",
    ONBOARD_CREDIT_INFO: "Any onboard credit posts to your stateroom account — check your Folio in the Navigator app.",
    LOYALTY_INFO: "Castaway Club members: check the app or Guest Services for status benefits and pin pickup.",
    GUEST_SERVICES_CONTACT: "Dial 7 from your stateroom phone, or visit Guest Services midship.",
    SOCIAL_HASHTAG: "#CruisingCove",
    COSTUME_PARADE_TIME: "Check Navigator",
    COSTUME_PARADE_LOCATION: "Main atrium / scheduled parade route",
    COSTUME_JUDGING_CATEGORIES: "Best Family Group, Most Creative, Littlest Pirate, Glow-in-the-Dark",
    TRICK_OR_TREAT_SCHEDULE:
      "Kids’ trick-or-treating by deck — exact times post in the Navigator app on event days. Costumes welcome for ages 3–12.",
    HAUNTED_HAPPY_HOUR_TEASER:
      "Seasonal sips and playful mocktails during themed happy-hour windows — family-friendly fun, never fright-night.",
    DECK_THE_SHIP_SCHEDULE:
      "Watch for atrium decoration reveals on embarkation day — exact times post in the Navigator app.",
    TREE_LIGHTING_TIME: "Check Navigator",
    TREE_LIGHTING_LOCATION: "Atrium (typical) — confirm in Navigator",
    SECRET_SANTA_INSTRUCTIONS:
      "If your sailing offers a guest gift exchange, details are usually at Guest Services — ask early if you’re interested.",
    HOLIDAY_DINING_SPECIALS:
      "Look for holiday menus in the main dining rooms and seasonal treats around the ship — cookie decorating and cocoa often appear on sea days.",
    AGENTS_URL: `${site}/agents/`,
    MARKETPLACE_URL: `${site}/marketplace/`,
    PACKING_URL: `${site}/planning/disney-cruise-packing-list.html`,
    UNSUB_URL: (opts.unsubUrl || `${site}/newsletter/unsubscribe.html`).trim(),
  };

  return { theme, data };
}

export function buildWelcomeAboardEmail(opts: BuildWelcomeAboardOpts): SailingEmailContent {
  const { theme, data } = buildWelcomeAboardData(opts);
  const missing = new Set<string>();
  const html = fillPlaceholders(loadTemplate(theme), data, (key) => missing.add(key));
  if (missing.size) {
    console.warn(
      `welcomeAboard missing placeholders (${theme}): ${[...missing].sort().join(", ")}`
    );
  }

  const themeLabel =
    theme === "halloween"
      ? "Halloween on the High Seas"
      : theme === "christmas"
        ? "Very Merrytime"
        : null;

  const subject = themeLabel
    ? `Welcome Aboard — ${data.SHIP_NAME} · ${themeLabel}`
    : `Welcome Aboard — ${data.SHIP_NAME}`;

  const text = [
    `Welcome Aboard — ${data.SHIP_NAME}`,
    themeLabel || data.ITINERARY_NAME,
    data.SAIL_DATE,
    "",
    `Hi ${data.GUEST_NAME},`,
    data.CAPTAINS_WELCOME_MESSAGE,
    "",
    `Departs: ${data.DEPARTURE_PORT} — ${data.DEPARTURE_TIME}`,
    `Returns: ${data.RETURN_PORT} — ${data.RETURN_TIME}`,
    "",
    "Your itinerary:",
    data.ITINERARY_TEXT,
    "",
    `First landfall preview: ${data.PORT_NAME}`,
    `· ${data.EXCURSION_1}`,
    `· ${data.EXCURSION_2}`,
    `· ${data.EXCURSION_3}`,
    "",
    "More from the Cove:",
    `· Travel agent directory: ${data.AGENTS_URL}`,
    `· Marketplace: ${data.MARKETPLACE_URL}`,
    `· Packing list: ${data.PACKING_URL}`,
    "",
    "View this email in an HTML-capable client for the full Welcome Aboard newsletter.",
    data.UNSUB_URL ? `Unsubscribe: ${data.UNSUB_URL}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

/** Guest welcome for any newsletter signup — themed sailing or Welcome to the Cove. */
export function buildNewsletterWelcomeEmail(opts: BuildNewsletterWelcomeOpts): SailingEmailContent {
  const slug = (opts.shipSlug || "").trim();
  const embark = (opts.embarkationDate || "").trim();
  if (!slug || !embark) {
    return buildWelcomeToCoveEmail({ name: opts.name, unsubUrl: opts.unsubUrl });
  }
  return buildWelcomeAboardEmail({
    name: opts.name,
    shipSlug: slug,
    shipLabel: (opts.shipLabel || "").trim() || slug,
    embarkationDate: embark,
    unsubUrl: opts.unsubUrl,
  });
}
