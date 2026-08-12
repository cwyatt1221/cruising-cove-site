/**
 * Curated Cruising Cove fleet facts for Ask AI First Mate.
 * Prefer this over model memory for ship identity, dining, and Easter eggs.
 * Not live Disney inventory — prices/availability still need official DCL or an agent.
 */

export type FleetShip = {
  slug: string;
  name: string;
  classLabel: string;
  launched: string;
  passengers: string;
  tonnage: string;
  typicalHomeport?: string;
  stern: string;
  atriumOrGrandHall: string;
  bow?: string;
  rotationalDining: string;
  specialtyDining: string;
  signatureNotes: string[];
  easterEggs: string[];
  guidePath: string;
};

export const FLEET_SHIPS: FleetShip[] = [
  {
    slug: "disney-magic",
    name: "Disney Magic",
    classLabel: "Classic (Magic class)",
    launched: "1998",
    passengers: "~2,400",
    tonnage: "83,000 GT",
    stern: "Goofy painting the ship’s name",
    atriumOrGrandHall: "Helmsman Mickey (atrium)",
    bow: "Sorcerer Mickey medallion",
    rotationalDining: "Lumière’s · Rapunzel’s Royal Table · Animator’s Palate",
    specialtyDining: "Palo (adults 18+)",
    signatureNotes: [
      "First DCL ship; Art Deco styling; intimate classic-class feel",
      "Signature stage show: Tangled: The Musical",
      "Sister ship to Disney Wonder",
    ],
    easterEggs: [
      "Oceaneer Lab wall paintings hide classic three-circle Mickeys",
      "Ship horn plays When You Wish Upon a Star notes at sail-away",
    ],
    guidePath: "/ships/disney-magic.html",
  },
  {
    slug: "disney-wonder",
    name: "Disney Wonder",
    classLabel: "Classic (Magic class)",
    launched: "1999",
    passengers: "~2,400",
    tonnage: "83,000 GT",
    stern: "Donald Duck and his nephews",
    atriumOrGrandHall: "Princess Ariel statue outside Triton’s (atrium)",
    rotationalDining: "Triton’s · Tiana’s Place · Animator’s Palate",
    specialtyDining: "Palo (adults 18+)",
    signatureNotes: [
      "Art Nouveau twin to the Magic",
      "Tiana’s Place is Wonder-exclusive",
      "Signature stage show: Frozen, A Musical Spectacular",
      "Often used for Alaska and other intimate itineraries",
    ],
    easterEggs: [
      "Ship godmother: Tinker Bell",
      "Horn plays When You Wish Upon a Star notes",
    ],
    guidePath: "/ships/disney-wonder.html",
  },
  {
    slug: "disney-dream",
    name: "Disney Dream",
    classLabel: "Dream class",
    launched: "2011",
    passengers: "~4,000",
    tonnage: "130,000 GT",
    stern: "Sorcerer Mickey (Fantasia) with enchanted brooms",
    atriumOrGrandHall: "Admiral Donald Duck (atrium)",
    bow: "Captain Mickey medallion",
    rotationalDining: "Enchanted Garden · Royal Palace · Animator’s Palate",
    specialtyDining: "Palo · Remy (adults 18+)",
    signatureNotes: [
      "Introduced AquaDuck water coaster and virtual portholes",
      "Midship Detective Agency interactive mystery (Dream + Fantasy)",
      "Sister ship to Disney Fantasy",
    ],
    easterEggs: [
      "Pepe the King Prawn mini door at stateroom 5148½",
      "Animated deck panels (Boat Builders, Hawaiian Holiday, Neverland wheel)",
    ],
    guidePath: "/ships/disney-dream.html",
  },
  {
    slug: "disney-fantasy",
    name: "Disney Fantasy",
    classLabel: "Dream class",
    launched: "2012",
    passengers: "~4,000",
    tonnage: "130,000 GT",
    stern: "Dumbo",
    atriumOrGrandHall: "Minnie Mouse (atrium)",
    rotationalDining: "Enchanted Garden · Royal Court · Animator’s Palate",
    specialtyDining: "Palo · Remy (adults 18+)",
    signatureNotes: [
      "Art Nouveau Dream-class twin with AquaDuck",
      "Midship Detective Agency + Pepe door 5148½ (same as Dream)",
      "Pixar Day sailings may offer Hey Howdy Breakfast with Woody and Friends at Animator’s Palate (reserve)",
    ],
    easterEggs: [
      "Peacock-inspired atrium flourish above the chandelier",
      "Hidden Mickey silhouettes spotted in chandelier/metalwork",
    ],
    guidePath: "/ships/disney-fantasy.html",
  },
  {
    slug: "disney-wish",
    name: "Disney Wish",
    classLabel: "Wish class (1st)",
    launched: "2022",
    passengers: "~4,000",
    tonnage: "144,000 GT",
    typicalHomeport: "Port Canaveral, FL (common)",
    stern: "Rapunzel and Pascal",
    atriumOrGrandHall:
      "Grand Hall — Cinderella statue; chandelier like Cinderella’s dress; glass slipper at staircase",
    bow: "Captain Minnie medallion (first DCL bow not Mickey)",
    rotationalDining: "1923 · Arendelle: A Frozen Dining Adventure · Worlds of Marvel",
    specialtyDining: "Palo Steakhouse · Enchanté (adults 18+)",
    signatureNotes: [
      "Wish-class template: Grand Hall, AquaMouse, adult district nightlife",
      "Olaf’s Royal Picnic is Wish-associated character dining (confirm availability by sailing)",
      "Sister ships: Treasure, Destiny; Believe planned as 4th Wish-class",
    ],
    easterEggs: [
      "Lucifer/Jaq/Gus under Cinderella’s dress; fleet ‘stars’ around chandelier",
      "Mickey & the Beanstalk mural near 1923; spa awnings form a Hidden Mickey from Observation Deck",
      "Stateroom lampshades hide Mickey ears when lit",
    ],
    guidePath: "/ships/disney-wish.html",
  },
  {
    slug: "disney-treasure",
    name: "Disney Treasure",
    classLabel: "Wish class (2nd)",
    launched: "December 2024",
    passengers: "~4,000",
    tonnage: "144,000 GT",
    typicalHomeport: "Port Canaveral, FL (common for 7-night Caribbean)",
    stern: "Captain Hook and Peter Pan (mid-chase)",
    atriumOrGrandHall:
      "Grand Hall — Aladdin, Jasmine, and Magic Carpet statue plus Genie lamp; Agrabah adventure theme",
    rotationalDining: "1923 · Plaza de Coco · Worlds of Marvel",
    specialtyDining: "Palo Steakhouse · Enchanté (adults 18+)",
    signatureNotes: [
      "Adventure theme; Jumbeaux’s Sweets (Zootopia) exclusive sweet shop",
      "Haunted Mansion Parlor and Skipper Society lounges",
      "Shows include Disney The Tale of Moana and Beauty and the Beast",
      "Tomorrow Tower Suite in the funnel",
    ],
    easterEggs: [
      "Genie lamp joins Grand Hall lighting / Kiss Goodnight-style shows; look for Hidden Mickey near lamp",
      "Six chandelier lanterns honor fleet atrium icons (Mickey, shell, Donald, Minnie, slipper, lamp)",
      "Floor butterflies: facing forward = toward bow; facing back = aft",
      "Hull number 718 appears in décor (e.g. Periscope Pub gauge); Skipper paddles 55 and 71",
    ],
    guidePath: "/ships/disney-treasure.html",
  },
  {
    slug: "disney-destiny",
    name: "Disney Destiny",
    classLabel: "Wish class (3rd)",
    launched: "November 2025",
    passengers: "~4,000",
    tonnage: "~144,000 GT",
    typicalHomeport: "Port Everglades, Fort Lauderdale (common for short Bahamas/Western Caribbean)",
    stern: "Spider-Man (first Marvel character on a DCL stern)",
    atriumOrGrandHall:
      "Grand Hall — T’Challa / Wakanda theme with vibranium-inspired chandelier",
    bow: "Hero Minnie",
    rotationalDining: "1923 · Pride Lands: Feast of the Lion King · Worlds of Marvel",
    specialtyDining: "Palo Steakhouse · Enchanté (adults 18+)",
    signatureNotes: [
      "Heroes-and-villains theme; shorter 4–5 night sailings common",
      "Iron Man–themed Destiny Tower Suite; The Sanctum (Doctor Strange lounge)",
      "Nightly Grand Hall Kiss Goodnight; occasional Kiss Goodnightmares",
    ],
    easterEggs: [
      "Sanctum: Eye of Agamotto, Cloak of Levitation, iPad ‘33’ secret cocktail menu",
      "Hidden Mickeys and lightning bolts point toward the bow; number seven motif (7th ship)",
      "Cask and Cannon ceiling murals nod to the fleet and hull number 706",
    ],
    guidePath: "/ships/disney-destiny.html",
  },
  {
    slug: "disney-adventure",
    name: "Disney Adventure",
    classLabel: "Unique mega-ship (not Wish/Dream/Classic)",
    launched: "March 2026",
    passengers: "~6,700",
    tonnage: "~208,000 GT",
    typicalHomeport: "Singapore (Marina Bay Cruise Centre)",
    stern: "Captain Mickey and Captain Minnie together (first dual-captain stern)",
    atriumOrGrandHall: "Town Square / Imagination Garden storybook spaces (no classic atrium statue formula)",
    rotationalDining: "Multiple rotational / hall restaurants across themed lands (confirm sailing menu)",
    specialtyDining: "Adult and specialty venues vary by land — confirm in Navigator / My Cruise Activities",
    signatureNotes: [
      "Largest DCL ship; first Asia homeport",
      "Seven themed lands including Marvel Landing and San Fransokyo Street",
      "Ironcycle Test Run — Marvel rollercoaster, longest at sea",
      "Typically 3–5 night Singapore itineraries",
    ],
    easterEggs: [
      "Imagination Garden storybook castle waterfall echoes Walt Disney Pictures opening",
      "Look up in restaurants for ceiling character motifs",
      "Ask for complimentary Mickey Premium Ice Cream Bar at character dining (not printed on menu)",
    ],
    guidePath: "/ships/disney-adventure.html",
  },
  {
    slug: "disney-believe",
    name: "Disney Believe",
    classLabel: "Wish class (4th, upcoming)",
    launched: "Expected late 2027 (TBA)",
    passengers: "~4,000*",
    tonnage: "~144,000 GT*",
    stern: "Not announced yet",
    atriumOrGrandHall: "Not announced yet",
    rotationalDining: "Not announced yet (expect Wish-class rotational pattern)",
    specialtyDining: "Likely Palo Steakhouse · Enchanté pattern (unconfirmed)",
    signatureNotes: [
      "Theme: promise and possibility",
      "Story inspirations teased: Encanto, Frozen, Moana, Snow White, The Little Mermaid",
      "Homeport and dining names still TBA — do not invent details",
    ],
    easterEggs: ["Too early — wait for official/Imagineering reveals"],
    guidePath: "/ships/disney-believe.html",
  },
];

const SITE_GUIDE_PATHS = `
Helpful Cruising Cove pages (prefer linking these when relevant):
- Ships hub: /ships/
- Dining hub: /dining/
- Entertainment hub: /entertainment/
- Ports hub: /ports/
- Packing list: /planning/disney-cruise-packing-list.html
- Cost overview: /planning/disney-cruise-cost.html
- Booking windows: /planning/booking-windows.html
- Castaway Club: /planning/castaway-club.html
- Kids clubs: /planning/kids-clubs.html
- Midship Detective Agency: /articles/midship-detective-agency.html
- Destiny hidden secrets: /articles/disney-destiny-hidden-secrets.html
- Find a travel agent: /agents/
- Community: /community/
`;

const PLANNING_FACTS = `
Planning facts (Cruising Cove guidance):
- Cruising Cove is independent and unofficial — never claim Disney affiliation.
- Do not invent live prices, cabin availability, or sailing inventory. Say to confirm on Disney Cruise Line’s official site, the Disney Cruise Line Navigator / My Disney Cruise tools, or via a travel agent.
- Rotational dining means each night a different main restaurant with the same wait team (classic DCL system).
- Adult specialty dining (Palo / Remy / Palo Steakhouse / Enchanté) usually costs extra and often needs advance reservations.
- Castaway Cay and Lookout Cay are Disney private island destinations (Bahamas region).
- MagicBand+ / Key to the World cards act as room key + onboard charge; details vary by sailing era — point guests to planning pages if unsure.
`;

function formatShipSummary(ship: FleetShip): string {
  const lines = [
    `${ship.name} (${ship.classLabel}; launched ${ship.launched}; ${ship.passengers} guests; ${ship.tonnage})`,
    `  Stern: ${ship.stern}`,
    `  Atrium/Grand Hall: ${ship.atriumOrGrandHall}`,
  ];
  if (ship.bow) lines.push(`  Bow: ${ship.bow}`);
  if (ship.typicalHomeport) lines.push(`  Typical homeport: ${ship.typicalHomeport}`);
  lines.push(`  Rotational dining: ${ship.rotationalDining}`);
  lines.push(`  Specialty dining: ${ship.specialtyDining}`);
  lines.push(`  Notes: ${ship.signatureNotes.join("; ")}`);
  lines.push(`  Easter eggs: ${ship.easterEggs.join("; ")}`);
  lines.push(`  Guide: ${ship.guidePath}`);
  return lines.join("\n");
}

/** Compact fleet card always included in the system prompt. */
export function buildFleetKnowledgeBlock(): string {
  const body = FLEET_SHIPS.map(formatShipSummary).join("\n\n");
  return [
    "=== CRUISING COVE FLEET KNOWLEDGE (authoritative for identity facts) ===",
    "When a guest asks about stern characters, atrium/Grand Hall statues, ship class, or signature dining, answer from this block.",
    "",
    body,
    PLANNING_FACTS.trim(),
    SITE_GUIDE_PATHS.trim(),
    "=== END FLEET KNOWLEDGE ===",
  ].join("\n");
}

const SHIP_ALIASES: { slug: string; patterns: RegExp[] }[] = [
  { slug: "disney-magic", patterns: [/\bmagic\b/i] },
  { slug: "disney-wonder", patterns: [/\bwonder\b/i] },
  { slug: "disney-dream", patterns: [/\bdream\b/i] },
  { slug: "disney-fantasy", patterns: [/\bfantasy\b/i] },
  { slug: "disney-wish", patterns: [/\bwish\b/i] },
  { slug: "disney-treasure", patterns: [/\btreasure\b/i] },
  { slug: "disney-destiny", patterns: [/\bdestiny\b/i] },
  { slug: "disney-adventure", patterns: [/\badventure\b/i] },
  { slug: "disney-believe", patterns: [/\bbelieve\b/i] },
];

export function findShipsMentioned(question: string): FleetShip[] {
  const q = question.trim();
  if (!q) return [];
  const found: FleetShip[] = [];
  for (const alias of SHIP_ALIASES) {
    if (!alias.patterns.some((re) => re.test(q))) continue;
    const ship = FLEET_SHIPS.find((s) => s.slug === alias.slug);
    if (ship && !found.some((s) => s.slug === ship.slug)) found.push(ship);
  }
  return found;
}

/** Extra focused detail when the question names specific ship(s). */
export function buildShipFocusBlock(question: string): string {
  const ships = findShipsMentioned(question);
  if (!ships.length) return "";
  const parts = ships.map((ship) => {
    return [
      `Focused ship: ${ship.name}`,
      `- Stern character(s): ${ship.stern}`,
      `- Atrium / Grand Hall: ${ship.atriumOrGrandHall}`,
      ship.bow ? `- Bow: ${ship.bow}` : null,
      `- Dining: ${ship.rotationalDining} | Specialty: ${ship.specialtyDining}`,
      `- Key notes: ${ship.signatureNotes.join(" · ")}`,
      `- Easter eggs: ${ship.easterEggs.join(" · ")}`,
      `- Deep dive: https://cruisingcove.com${ship.guidePath}`,
    ]
      .filter(Boolean)
      .join("\n");
  });
  return (
    "\n\n=== SHIP FOCUS (question named these ships — answer precisely) ===\n" +
    parts.join("\n\n") +
    "\n=== END SHIP FOCUS ==="
  );
}

export const CHAT_BASE_SYSTEM_PROMPT = `You are Ask AI First Mate on Cruising Cove, helping people plan a Disney Cruise Line vacation.

Cruising Cove is an independent, unofficial planning resource. It is not affiliated with, endorsed by, or sponsored by The Walt Disney Company, Disney Cruise Line, or any of their affiliates. Never imply or claim any official Disney affiliation.

Use the CRUISING COVE FLEET KNOWLEDGE block as the source of truth for ship identity facts (stern characters, atrium/Grand Hall statues, class, signature dining, listed Easter eggs). Do not contradict it.

Answer clearly about DCL ships, staterooms, dining, kids' clubs, shows, ports, departure logistics, budgeting, and travel agents.

If you don't know something specific — current exact pricing, live cabin availability, or sailing schedules that change — say so plainly rather than guessing, and suggest checking the relevant Cruising Cove page, Disney Cruise Line’s official site, or a travel agent.

When helpful, mention the Cruising Cove path from the knowledge block (e.g. /ships/disney-treasure.html).

Keep answers concise: 2–5 sentences unless the question needs a short list.`;

export function buildChatSystemPrompt(question: string): string {
  return (
    CHAT_BASE_SYSTEM_PROMPT +
    "\n\n" +
    buildFleetKnowledgeBlock() +
    buildShipFocusBlock(question)
  );
}
