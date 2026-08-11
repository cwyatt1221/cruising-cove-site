/** Curated sailing itineraries for personalized newsletter emails (not live Disney inventory). */

export type SailingPortStop = {
  portId: string;
  name: string;
  dayLabel: string;
};

export type SailingExcursionIdea = {
  name: string;
  summary: string;
  price?: string;
};

export type CatalogSailing = {
  shipSlug: string;
  embarkationDate: string;
  nights: number;
  departurePort: string;
  /** Optional holiday / themed sailing name from DCL. Omit when unthemed. */
  theme?: string;
  returnDate?: string;
  departureTime?: string;
  returnTime?: string;
  ports: SailingPortStop[];
  /** Top ideas keyed by portId */
  excursionsByPort: Record<string, SailingExcursionIdea[]>;
};

const SAILINGS: CatalogSailing[] = [
  {
    shipSlug: "disney-dream",
    embarkationDate: "2026-10-16",
    nights: 3,
    departurePort: "Port Everglades (Fort Lauderdale)",
    theme: "Halloween on the High Seas",
    returnDate: "2026-10-19",
    departureTime: "3:00 PM",
    returnTime: "8:00 AM",
    ports: [
      { portId: "lookout-cay", name: "Lookout Cay at Lighthouse Point", dayLabel: "Day 2" },
      { portId: "nassau", name: "Nassau", dayLabel: "Day 3" },
    ],
    excursionsByPort: {
      "lookout-cay": [
        {
          name: "Lookout Cay free beach day",
          summary: "Disney island day without a paid excursion — plan chairs and shade early.",
          price: "Included",
        },
        {
          name: "Lookout Cay private cabana",
          summary: "Ultra-limited. Treat as lottery + have a free-beach backup.",
          price: "$$$$",
        },
      ],
      nassau: [
        {
          name: "Atlantis Aquaventure",
          summary: "Full-day water park. Leave a real return buffer to the ship.",
          price: "$$$",
        },
        {
          name: "Nassau beach club day",
          summary: "Chairs, lunch, transfer — confirm last shuttle time.",
          price: "$$",
        },
        {
          name: "Downtown / Junkanoo Beach DIY",
          summary: "Walkable from the pier — still watch the clock in heat.",
          price: "$",
        },
      ],
    },
  },
  {
    shipSlug: "disney-wish",
    embarkationDate: "2026-10-16",
    nights: 3,
    departurePort: "Port Canaveral, FL",
    theme: "Halloween on the High Seas",
    returnDate: "2026-10-19",
    departureTime: "About 3:45 PM",
    returnTime: "About 7:30 AM",
    ports: [
      { portId: "nassau", name: "Nassau", dayLabel: "Day 2" },
      { portId: "castaway-cay", name: "Disney Castaway Cay", dayLabel: "Day 3" },
    ],
    excursionsByPort: {
      nassau: [
        {
          name: "Atlantis Aquaventure",
          summary: "Full-day water park. Leave a real return buffer to the ship.",
          price: "$$$",
        },
        {
          name: "Nassau beach club day",
          summary: "Chairs, lunch, transfer — confirm last shuttle time.",
          price: "$$",
        },
      ],
      "castaway-cay": [
        {
          name: "Castaway Cay free beach day",
          summary: "Snorkel, bike, and Cabana Beach — chairs fill early near the pier.",
          price: "Included",
        },
      ],
    },
  },
  {
    shipSlug: "disney-destiny",
    embarkationDate: "2026-10-24",
    nights: 5,
    departurePort: "Fort Lauderdale, FL",
    theme: "Halloween on the High Seas",
    returnDate: "2026-10-29",
    departureTime: "3:00 PM",
    returnTime: "8:00 AM",
    ports: [
      { portId: "cozumel", name: "Cozumel, Mexico", dayLabel: "Day 3" },
      { portId: "castaway-cay", name: "Disney Castaway Cay", dayLabel: "Day 5" },
    ],
    excursionsByPort: {
      cozumel: [
        {
          name: "Reef snorkel or dive",
          summary: "Cozumel’s reefs are the draw — book early and watch return times.",
          price: "$$$",
        },
        {
          name: "Beach club day",
          summary: "Chairs, lunch, and easy logistics from the pier.",
          price: "$$",
        },
        {
          name: "Downtown shopping DIY",
          summary: "Walkable from many berths — still leave a heat-and-traffic buffer.",
          price: "$",
        },
      ],
      "castaway-cay": [
        {
          name: "Castaway Cay free beach day",
          summary: "Classic Disney island day — plan chairs and shade early.",
          price: "Included",
        },
      ],
    },
  },
  {
    // Explicitly unthemed: post–Very Merrytime New Year sailing.
    shipSlug: "disney-treasure",
    embarkationDate: "2026-12-26",
    nights: 7,
    departurePort: "Port Canaveral, FL",
    returnDate: "2027-01-02",
    departureTime: "About 3:45 PM",
    returnTime: "About 7:30 AM",
    ports: [
      { portId: "cozumel", name: "Cozumel, Mexico", dayLabel: "Day 3" },
      { portId: "grand-cayman", name: "George Town, Grand Cayman", dayLabel: "Day 4" },
      { portId: "falmouth", name: "Falmouth, Jamaica", dayLabel: "Day 5" },
      { portId: "castaway-cay", name: "Disney Castaway Cay", dayLabel: "Day 7" },
    ],
    excursionsByPort: {
      cozumel: [
        {
          name: "Reef snorkel or dive",
          summary: "Cozumel’s reefs are the draw — book early and watch return times.",
          price: "$$$",
        },
      ],
      "castaway-cay": [
        {
          name: "Castaway Cay free beach day",
          summary: "Classic Disney island day — plan chairs and shade early.",
          price: "Included",
        },
      ],
    },
  },
];

export function sailingCatalogKey(shipSlug: string, embarkationDate: string): string {
  return `${shipSlug}_${embarkationDate}`;
}

export function lookupSailing(shipSlug: string, embarkationDate: string): CatalogSailing | null {
  const slug = (shipSlug || "").trim();
  const date = (embarkationDate || "").trim();
  if (!slug || !date) return null;
  return (
    SAILINGS.find((s) => s.shipSlug === slug && s.embarkationDate === date) ?? null
  );
}
