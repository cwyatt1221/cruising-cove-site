/**
 * Port, packing, and cost knowledge cards for Ask AI First Mate.
 */

export type PortCard = {
  slug: string;
  name: string;
  region: string;
  summary: string;
  tip: string;
  guidePath: string;
};

export const PORT_CARDS: PortCard[] = [
  {
    slug: "castaway-cay",
    name: "Castaway Cay",
    region: "Bahamas",
    summary:
      "Disney’s original private island: direct pier docking, three beaches (including adults-only Serenity Bay), calm lagoon water, and complimentary BBQ lunch.",
    tip: "Walk 5–10 minutes past the tram stop for quieter beach space; towels are provided at the pier.",
    guidePath: "/ports/castaway-cay.html",
  },
  {
    slug: "lookout-cay",
    name: "Lookout Cay at Lighthouse Point",
    region: "Bahamas",
    summary:
      "Disney’s second Bahamian destination (opened 2024 on Eleuthera), culture-forward with big beaches, Goombay Cultural Center, and family + Serenity Bay areas.",
    tip: "Budget extra time for the ~half-mile open-trestle pier walk; beaches are unsheltered so swim conditions can vary.",
    guidePath: "/ports/lookout-cay.html",
  },
  {
    slug: "nassau",
    name: "Nassau",
    region: "Bahamas",
    summary:
      "Short walk from the pier into downtown; easy to overspend or overheat—pick beach, town, or Atlantis before you step off.",
    tip: "Get in the water or get a real local bite—don’t only do the pier retail strip.",
    guidePath: "/ports/nassau.html",
  },
  {
    slug: "cozumel",
    name: "Cozumel",
    region: "Western Caribbean",
    summary:
      "Mexico favorite for beach clubs and snorkeling; downtown is close, but the good swim spots usually need a transfer.",
    tip: "Get on or in the Caribbean (beach club, calm snorkel, or park day)—don’t only do the pier mall.",
    guidePath: "/ports/cozumel.html",
  },
  {
    slug: "grand-cayman",
    name: "Grand Cayman",
    region: "Western Caribbean",
    summary:
      "Often a tender port; Stingray City and Seven Mile Beach are the headline draws—build real buffer for the boat ride back.",
    tip: "Do Stingray City at least once; pair with a shorter Seven Mile Beach visit rather than rushing both full-length.",
    guidePath: "/ports/grand-cayman.html",
  },
  {
    slug: "falmouth",
    name: "Falmouth",
    region: "Western Caribbean",
    summary:
      "Jamaica’s purpose-built cruise port: Dunn’s River Falls inland, coastal beach clubs, and a pier village at the ship.",
    tip: "If you came for Dunn’s River, protect transfer buffer like it’s part of the excursion.",
    guidePath: "/ports/falmouth.html",
  },
  {
    slug: "roatan",
    name: "Roatán",
    region: "Western Caribbean",
    summary:
      "Honduras Bay Islands stop known for reefs, West Bay beaches, and zip-line days—usually with a transfer from the cruise pier.",
    tip: "Get in the water at West Bay (or a comparable clear beach); pad transfers and return early.",
    guidePath: "/ports/roatan.html",
  },
  {
    slug: "costa-maya",
    name: "Costa Maya",
    region: "Western Caribbean",
    summary:
      "Purpose-built Yucatán cruise pier with shopping off the gangway, beach clubs nearby, and Maya ruins inland.",
    tip: "Decide beach vs ruins before you walk off the ship—one clear plan beats a last-minute mix.",
    guidePath: "/ports/costa-maya.html",
  },
  {
    slug: "st-thomas",
    name: "St. Thomas",
    region: "Eastern Caribbean",
    summary:
      "U.S. Virgin Islands call known for duty-free shopping in Charlotte Amalie and Magens Bay a short ride away.",
    tip: "Get to Magens Bay even for a couple of hours; shopping is the side quest.",
    guidePath: "/ports/st-thomas.html",
  },
  {
    slug: "st-maarten",
    name: "St. Maarten",
    region: "Eastern Caribbean",
    summary:
      "One island, two sides: Dutch Philipsburg for shopping/beach clubs, French St. Martin for lunch, Maho for plane-spotting beaches.",
    tip: "Pick Philipsburg beach + paced shopping, or commit fully to Maho—don’t half-do both.",
    guidePath: "/ports/st-maarten.html",
  },
  {
    slug: "st-kitts",
    name: "St. Kitts",
    region: "Eastern Caribbean",
    summary:
      "Scenic Eastern Caribbean call: Basseterre at the pier, Brimstone Hill fortress inland, beach clubs, and the scenic railway.",
    tip: "Pick the railway or Brimstone Hill for the signature memory—or commit to a beach and skip FOMO.",
    guidePath: "/ports/st-kitts.html",
  },
  {
    slug: "antigua",
    name: "Antigua",
    region: "Eastern Caribbean",
    summary:
      "Classic Eastern Caribbean beach-and-bay day: St. John’s near the pier, calm swim spots, and fort views for a short culture stop.",
    tip: "Commit to one beautiful bay and stay; unhurried beach days beat island scavenger hunts.",
    guidePath: "/ports/antigua.html",
  },
  {
    slug: "san-juan",
    name: "San Juan",
    region: "Eastern Caribbean",
    summary:
      "One of the best walkable Disney cruise ports—forts, cobblestones, and café culture near Old San Juan when docked there.",
    tip: "Walk Old San Juan—don’t only shop the pier; even a short loop past Paseo de la Princesa and one fort lawn is enough.",
    guidePath: "/ports/san-juan.html",
  },
  {
    slug: "tortola",
    name: "Tortola",
    region: "Eastern Caribbean",
    summary:
      "British Virgin Islands stop: Road Town near the pier, beach clubs and viewpoints farther out, sail-and-snorkel days on clear water.",
    tip: "Get on the water or on a real beach; one job beats a rushed island circuit.",
    guidePath: "/ports/tortola.html",
  },
  {
    slug: "cartagena",
    name: "Cartagena",
    region: "Colombia / Panama Canal",
    summary:
      "Walled old city, serious heat, and a pier that usually needs a transfer—signature stop on Disney Magic Panama Canal sailings.",
    tip: "Get inside the walls and walk plazas slowly; protect transfer buffer.",
    guidePath: "/ports/cartagena.html",
  },
  {
    slug: "panama-canal",
    name: "Panama Canal",
    region: "Panama Canal",
    summary:
      "Full canal transit day on Disney Magic repositioning cruises—locks and Gatun Lake from the decks; not a typical Bahamas hop.",
    tip: "Be on deck for the locks; canal day is onboard spectacle, not a Panama City beach afternoon.",
    guidePath: "/ports/panama-canal.html",
  },
  {
    slug: "cabo-san-lucas",
    name: "Cabo San Lucas",
    region: "Mexican Riviera / Pacific",
    summary:
      "Land’s End Arch views, often tendering into the marina, beach or boat days on Panama Canal and Riviera-style sailings.",
    tip: "See El Arco from the water; swim Medano/Sea of Cortez side, not the Pacific near Land’s End; add tender buffer.",
    guidePath: "/ports/cabo-san-lucas.html",
  },
  {
    slug: "puerto-vallarta",
    name: "Puerto Vallarta",
    region: "Mexican Riviera / Pacific",
    summary:
      "Malecón walks, beach clubs, and a real city day ashore—common Pacific call on Disney Magic Panama Canal eastbound itineraries.",
    tip: "Walk the Malecón and eat a real sit-down lunch ashore; traffic is the silent schedule killer.",
    guidePath: "/ports/puerto-vallarta.html",
  },
  {
    slug: "juneau",
    name: "Juneau",
    region: "Alaska",
    summary:
      "Alaska’s capital (boat/plane only): glacier views, whales, and compact downtown within reach of the pier if you dress for weather.",
    tip: "See Mendenhall Glacier up close, even briefly; pair with a short downtown walk rather than rushing glacier + full whale watching.",
    guidePath: "/ports/juneau.html",
  },
  {
    slug: "ketchikan",
    name: "Ketchikan",
    region: "Alaska",
    summary:
      "Alaska’s rainiest big port: Creek Street boardwalks, totem poles, and fishing right off the dock.",
    tip: "Walk Creek Street and see the totems—don’t let rain talk you out of it.",
    guidePath: "/ports/ketchikan.html",
  },
  {
    slug: "skagway",
    name: "Skagway",
    region: "Alaska",
    summary:
      "Walkable Gold Rush-era town; White Pass & Yukon Route train is the classic book-ahead outing.",
    tip: "Ride the White Pass & Yukon Route at least once; if sold out, a slow downtown walk is still worth it.",
    guidePath: "/ports/skagway.html",
  },
];

export const COST_CARD_FACTS: string[] = [
  "Typical 7-night adult fare ranges (Caribbean/Bahamas-style planning starts): Inside ~$1,200–$2,500; Oceanview ~$1,400–$3,000; Verandah ~$1,800–$4,000; Concierge ~$4,000–$10,000+; short trips lower; peak/Europe/Alaska higher. Not live quotes.",
  "Fare includes: stateroom, rotational dining (MDRs + buffet), entertainment, youth clubs, and most private-island beach access including BBQ lunch.",
  "Not in sticker fare: gratuities, specialty dining, alcohol, Wi-Fi, spa, and Port Adventures/excursions.",
  "Recommended gratuities: about $16/person/night standard; about $27.25/person/night concierge/suites — prepaid or settled onboard.",
  "Specialty dining: Palo / Palo Steakhouse often ~$55 pp on U.S. sailings; Remy and Enchanté run higher; gratuity usually added separately. Confirm live prices.",
  "Wi-Fi: free basic messaging for apps like iMessage/WhatsApp/Navigator messaging; paid packages for full internet/streaming — confirm current rates.",
  "Alcohol: drinks often ~$10–15 (+ auto gratuity); dining-room corkage typically ~$20/bottle for your own wine.",
  "Embarkation alcohol policy (since June 2026, 21+): one unopened wine/champagne ≤750 ml OR six beers ≤12 oz (not both) in carry-on at embarkation only; alcohol bought ashore is held until the end of the cruise.",
  "Port Adventures roughly $50–$300+ per person — the biggest discretionary swing by itinerary.",
  "Onboard collectibles: popcorn buckets and souvenir sippers are paid extras (not in cruise fare). Designs rotate by movie/ship/season and sell out; leave suitcase space. Exact prices change — confirm at the popcorn stand or shops onboard rather than treating any web number as a quote.",
  "Bingo is a paid family game (cards cost extra); sippers are often refillable for soft drinks/coffee depending on the cup. More context: /entertainment/#bingo-collectibles",
  "Guide: /planning/disney-cruise-cost.html",
];

export const PACKING_CARD_FACTS: string[] = [
  "Documents: passports or birth certificates + photo ID (match Disney rules for the itinerary); booking confirmation / Port Arrival Form; credit card for Key to the World / Folio; prescriptions in original bottles.",
  "Cabin essentials: magnetic hooks, packing cubes, night light, optional clip fan, reusable water bottles, motion-sickness plan, chargers/power bank.",
  "Disney provides shampoo, conditioner, body wash, and a hair dryer — prefer space for layers and shoes over toiletry duplicates.",
  "Daytime: walking shoes + sandals, swimsuits + cover-ups, light layers for cold AC, casual dinner outfits for most rotational nights.",
  "After 5pm in MDRs: avoid tank tops, board shorts, swim cover-ups, athletic shorts, and baseball caps; closed-toe dress shoes preferred on dressier nights.",
  "Premium dining (Palo/Remy/Enchanté): elevated closed-toe looks; skip jeans, shorts, flip-flops, athletic wear, logo tees, beach cover-ups.",
  "Bahamas/Caribbean: 2–3 swimsuits per person, rash guards for kids, water shoes for rocky/tender ports, insect repellent for some dusk ports, light rain shell.",
  "Private islands: sunscreen, hats, dry change for the ride back; Castaway/Lookout towels are provided at the pier.",
  "Alaska: waterproof hooded jacket, fleece/mid-layer, warm hat/gloves, broken-in waterproof shoes, binoculars; usually no Pirate Night.",
  "Panama Canal: Caribbean-style kit + binoculars for locks and motion remedies for sea days; canal day is onboard, not a Panama City pier day.",
  "Leave room (or a soft bag) for Bingo prizes, sippers, and popcorn buckets — bulky collectibles.",
  "Guide: /planning/disney-cruise-packing-list.html",
];

const PORT_ALIASES: { slug: string; patterns: RegExp[] }[] = [
  { slug: "castaway-cay", patterns: [/castaway/i, /castaway cay/i] },
  { slug: "lookout-cay", patterns: [/lookout cay/i, /lighthouse point/i] },
  { slug: "nassau", patterns: [/\bnassau\b/i] },
  { slug: "cozumel", patterns: [/\bcozumel\b/i] },
  { slug: "grand-cayman", patterns: [/grand cayman/i, /stingray city/i] },
  { slug: "falmouth", patterns: [/\bfalmouth\b/i, /dunn'?s river/i] },
  { slug: "roatan", patterns: [/roat[aá]n/i] },
  { slug: "costa-maya", patterns: [/costa maya/i] },
  { slug: "st-thomas", patterns: [/st\.?\s*thomas/i, /magens bay/i] },
  { slug: "st-maarten", patterns: [/st\.?\s*maa?rten/i, /st\.?\s*martin/i, /\bmaho\b/i] },
  { slug: "st-kitts", patterns: [/st\.?\s*kitts/i] },
  { slug: "antigua", patterns: [/\bantigua\b/i] },
  { slug: "san-juan", patterns: [/san juan/i] },
  { slug: "tortola", patterns: [/\btortola\b/i] },
  { slug: "cartagena", patterns: [/\bcartagena\b/i] },
  { slug: "panama-canal", patterns: [/panama canal/i] },
  { slug: "cabo-san-lucas", patterns: [/\bcabo\b/i, /san lucas/i] },
  { slug: "puerto-vallarta", patterns: [/puerto vallarta/i, /\bvallarta\b/i] },
  { slug: "juneau", patterns: [/\bjuneau\b/i, /mendenhall/i] },
  { slug: "ketchikan", patterns: [/\bketchikan\b/i] },
  { slug: "skagway", patterns: [/\bskagway\b/i, /white pass/i] },
];

export function findPortsMentioned(question: string): PortCard[] {
  const q = question.trim();
  if (!q) return [];
  const found: PortCard[] = [];
  for (const alias of PORT_ALIASES) {
    if (!alias.patterns.some((re) => re.test(q))) continue;
    const port = PORT_CARDS.find((p) => p.slug === alias.slug);
    if (port && !found.some((p) => p.slug === port.slug)) found.push(port);
  }
  return found;
}

function wantsCost(question: string): boolean {
  return /\b(cost|price|pricing|budget|expensive|gratuity|gratuities|wifi|wi-?fi|how much|fare|alcohol|excursions?|popcorn|sipper|bingo|bucket)\b/i.test(
    question
  );
}

function wantsPacking(question: string): boolean {
  return /\b(pack|packing|suitcase|what to bring|bring|clothes|wardrobe|formal night|pirate night|passport|documents?|popcorn|sipper)\b/i.test(
    question
  );
}

export function buildPlanningKnowledgeBlock(): string {
  const ports = PORT_CARDS.map(
    (p) =>
      `${p.name} (${p.region}) — ${p.summary} Tip: ${p.tip} Guide: ${p.guidePath}`
  ).join("\n");
  return [
    "=== PORT / PACKING / COST CARDS ===",
    "PORTS:",
    ports,
    "",
    "COST FACTS:",
    ...COST_CARD_FACTS.map((f) => `- ${f}`),
    "",
    "PACKING FACTS:",
    ...PACKING_CARD_FACTS.map((f) => `- ${f}`),
    "Also: /ports/departure-ports.html for U.S. homeport logistics.",
    "=== END PORT / PACKING / COST CARDS ===",
  ].join("\n");
}

export function buildPlanningFocusBlock(question: string): string {
  const parts: string[] = [];
  const ports = findPortsMentioned(question);
  if (ports.length) {
    parts.push(
      "Focused ports:",
      ...ports.map(
        (p) =>
          `- ${p.name}: ${p.summary} Tip: ${p.tip} Open this guide: https://www.cruisingcove.com${p.guidePath}`
      )
    );
  }
  if (wantsCost(question)) {
    parts.push(
      "Focused cost card:",
      ...COST_CARD_FACTS.map((f) => `- ${f}`),
      "Open this guide: https://www.cruisingcove.com/planning/disney-cruise-cost.html"
    );
    if (/\b(popcorn|sipper|bingo|bucket)\b/i.test(question)) {
      parts.push(
        "Open this guide: https://www.cruisingcove.com/entertainment/#bingo-collectibles"
      );
    }
  }
  if (wantsPacking(question)) {
    parts.push(
      "Focused packing card:",
      ...PACKING_CARD_FACTS.map((f) => `- ${f}`),
      "Open this guide: https://www.cruisingcove.com/planning/disney-cruise-packing-list.html"
    );
  }
  if (!parts.length) return "";
  return (
    "\n\n=== PLANNING FOCUS ===\n" + parts.join("\n") + "\n=== END PLANNING FOCUS ==="
  );
}
