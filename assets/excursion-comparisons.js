/**
 * Disney Port Adventure vs independent patterns — filter by destination.
 * Prices are approximate planning ranges (per adult, USD) and change by sailing/season.
 */
(function (global) {
  var destinations = [
    { id: "nassau", name: "Nassau", region: "Bahamas" },
    { id: "cozumel", name: "Cozumel", region: "Western Caribbean" },
    { id: "grand-cayman", name: "Grand Cayman", region: "Western Caribbean" },
    { id: "san-juan", name: "San Juan", region: "Eastern Caribbean" },
    { id: "st-thomas", name: "St. Thomas", region: "Eastern Caribbean" },
  ];

  var comparisons = [
    {
      id: "nassau-atlantis",
      destination: "nassau",
      activity: "Atlantis Aquaventure day",
      duration: "Most of the port call",
      disney: {
        label: "Disney Port Adventure",
        detail: "Tickets + transfer package through Disney",
        price: "$170–220+",
      },
      independent: {
        label: "Independent",
        detail: "Atlantis day ticket + taxi / hotel transfer",
        price: "$110–160+",
      },
      priceGap: "Often $50–80+ per adult",
      shipWait: "high",
      shipWaitNote:
        "Farther day with bridge traffic and park exit lines. Independent means the ship will not wait if you miss all-aboard.",
      tip: "Lean Disney if you want the ship-wait cushion on a full Atlantis day. Independent only if you’re disciplined about the return clock.",
    },
    {
      id: "nassau-beach-club",
      destination: "nassau",
      activity: "Beach club day (chairs, lunch, transfer)",
      duration: "Half to full day",
      disney: {
        label: "Disney Port Adventure",
        detail: "Disney-booked club with timed return",
        price: "$90–150",
      },
      independent: {
        label: "Independent",
        detail: "Direct club booking or reputable pier transfer",
        price: "$60–110",
      },
      priceGap: "Often $25–50 per adult",
      shipWait: "medium",
      shipWaitNote:
        "Transfer distance varies by club. Closer clubs with clear shuttle cutoffs are safer independent picks.",
      tip: "Confirm the club’s last shuttle — not your own estimate. On a short Nassau call, Disney’s buffer is worth more.",
    },
    {
      id: "nassau-downtown",
      destination: "nassau",
      activity: "Downtown / Junkanoo Beach DIY",
      duration: "2–4 hours",
      disney: {
        label: "Disney Port Adventure",
        detail: "Usually unnecessary for a pier-adjacent stroll",
        price: "N/A",
      },
      independent: {
        label: "Independent / DIY",
        detail: "Walk Bay Street; taxi or walk to Junkanoo Beach",
        price: "$0–40",
      },
      priceGap: "DIY wins on cost",
      shipWait: "low",
      shipWaitNote:
        "Near the pier with an easy walk-back. Still leave a real buffer — heat and shopping stretch time.",
      tip: "Skip paid tours for a simple town or nearby beach morning. Save Disney money for farther clubs or Atlantis.",
    },
    {
      id: "cozumel-beach-club",
      destination: "cozumel",
      activity: "All-inclusive beach club",
      duration: "Most of the day",
      disney: {
        label: "Disney Port Adventure",
        detail: "Club package with transfer and return timing",
        price: "$90–140",
      },
      independent: {
        label: "Independent",
        detail: "Direct Mr. Sanchos–style club + taxi or shared van",
        price: "$55–95",
      },
      priceGap: "Often $30–50 per adult",
      shipWait: "medium",
      shipWaitNote:
        "Good swim clubs sit a transfer away from downtown. DIY taxis work — if you nail the return window.",
      tip: "Independent is common here when the club is well-reviewed and you leave early. Disney if kids + zero logistics stress.",
    },
    {
      id: "cozumel-snorkel",
      destination: "cozumel",
      activity: "Reef / snorkel boat",
      duration: "Half day+",
      disney: {
        label: "Disney Port Adventure",
        detail: "Disney-operated or Disney-contracted boat day",
        price: "$80–130",
      },
      independent: {
        label: "Independent",
        detail: "Local snorkel operator booked ahead",
        price: "$45–85",
      },
      priceGap: "Often $30–50 per adult",
      shipWait: "high",
      shipWaitNote:
        "Boat days stack pier meet times, water conditions, and dock return. Delays compound fast.",
      tip: "Prefer Disney for boat-heavy snorkel days unless you’ve vetted a specific operator with strong on-time reviews.",
    },
    {
      id: "cozumel-downtown",
      destination: "cozumel",
      activity: "Downtown shopping + lunch",
      duration: "2–3 hours",
      disney: {
        label: "Disney Port Adventure",
        detail: "Not needed for pier-adjacent shopping",
        price: "N/A",
      },
      independent: {
        label: "Independent / DIY",
        detail: "Walk off the pier; lunch ashore",
        price: "$0–30",
      },
      priceGap: "DIY wins on cost",
      shipWait: "low",
      shipWaitNote: "Close to the ship — still watch all-aboard if you wander far for a beach club.",
      tip: "Use DIY for town; book a club or snorkel only if you actually want swim time.",
    },
    {
      id: "cayman-stingray",
      destination: "grand-cayman",
      activity: "Stingray City / sandbar boat",
      duration: "Half day+",
      disney: {
        label: "Disney Port Adventure",
        detail: "Boat outing booked through Disney",
        price: "$100–160",
      },
      independent: {
        label: "Independent",
        detail: "Local boat operator + tender timing on your own",
        price: "$60–110",
      },
      priceGap: "Often $35–60 per adult",
      shipWait: "high",
      shipWaitNote:
        "Grand Cayman is often a tender port. Boat tours plus tender lines make late returns expensive.",
      tip: "Lean Disney on tender days for stingray / boat combos — the ship-wait guarantee matters more here.",
    },
    {
      id: "cayman-beach",
      destination: "grand-cayman",
      activity: "Seven Mile Beach day",
      duration: "Half to most of the day",
      disney: {
        label: "Disney Port Adventure",
        detail: "Beach club / transfer package",
        price: "$70–120",
      },
      independent: {
        label: "Independent",
        detail: "Taxi to public beach or direct club booking",
        price: "$20–80",
      },
      priceGap: "Can be $40–70+ per adult",
      shipWait: "medium",
      shipWaitNote:
        "Beach itself is straightforward; tender return lines are the real risk late in the day.",
      tip: "Independent taxis work if you reverse-plan from tender cutoff. Disney if your call is short or you’re with young kids.",
    },
    {
      id: "san-juan-old-city",
      destination: "san-juan",
      activity: "Old San Juan walking day",
      duration: "Half day",
      disney: {
        label: "Disney Port Adventure",
        detail: "Guided city / fort highlights tour",
        price: "$70–110",
      },
      independent: {
        label: "Independent / DIY",
        detail: "Walk the walls, forts, and plazas yourself",
        price: "$0–25",
      },
      priceGap: "DIY often saves $60–100 per adult",
      shipWait: "low",
      shipWaitNote:
        "When docked pier-adjacent, Old San Juan is one of the easiest DIY ports — still leave shade and return buffer.",
      tip: "Most families do this independently. Book Disney only if you want narration and zero route planning.",
    },
    {
      id: "san-juan-nature",
      destination: "san-juan",
      activity: "Bioluminescence / farther nature tour",
      duration: "Long half day or evening-style timing",
      disney: {
        label: "Disney Port Adventure",
        detail: "Disney-timed nature outing",
        price: "$90–150",
      },
      independent: {
        label: "Independent",
        detail: "Local eco-operator with own transport",
        price: "$60–120",
      },
      priceGap: "Often $25–50 per adult",
      shipWait: "high",
      shipWaitNote:
        "Distance from the pier raises the cost of any delay. Independent only with a wide buffer and strong reviews.",
      tip: "Prefer Disney when the tour leaves the old city — ship-wait insurance is the product you’re buying.",
    },
    {
      id: "st-thomas-beach",
      destination: "st-thomas",
      activity: "Beach club / Magens-style swim day",
      duration: "Most of the day",
      disney: {
        label: "Disney Port Adventure",
        detail: "Beach package with transfer",
        price: "$80–140",
      },
      independent: {
        label: "Independent",
        detail: "Taxi or shared van to beach / club",
        price: "$40–90",
      },
      priceGap: "Often $30–50 per adult",
      shipWait: "medium",
      shipWaitNote:
        "Island traffic and hill roads can stretch returns. Build more buffer than the map suggests.",
      tip: "Independent is fine with a timed taxi plan. Disney if you want one ticket and a guaranteed cushion.",
    },
    {
      id: "st-thomas-sail",
      destination: "st-thomas",
      activity: "Sail / snorkel combo",
      duration: "Half day+",
      disney: {
        label: "Disney Port Adventure",
        detail: "Disney-booked boat day",
        price: "$90–150",
      },
      independent: {
        label: "Independent",
        detail: "Local charter or shared snorkel sail",
        price: "$55–110",
      },
      priceGap: "Often $30–50 per adult",
      shipWait: "high",
      shipWaitNote:
        "Water days depend on weather, boarding, and dock return — delays stack. Ship-wait matters.",
      tip: "Default to Disney for boat combos unless a specific indie operator has recent on-time proof.",
    },
  ];

  var shipWaitLabels = {
    low: "Low risk",
    medium: "Medium risk",
    high: "High risk",
  };

  function byDestination(id) {
    return comparisons.filter(function (c) {
      return c.destination === id;
    });
  }

  function destinationById(id) {
    return (
      destinations.find(function (d) {
        return d.id === id;
      }) || null
    );
  }

  global.CC_EXCURSION_DESTINATIONS = destinations;
  global.CC_EXCURSION_COMPARISONS = comparisons;
  global.CC_excursionByDestination = byDestination;
  global.CC_excursionDestination = destinationById;
  global.CC_SHIP_WAIT_LABELS = shipWaitLabels;
})(typeof window !== "undefined" ? window : globalThis);
