/**
 * Cruising Cove — founding agent directory data.
 * Sample placeholders stay in CC_AGENTS. Live approved agents load from /api/agents.
 * Keep sample: true on placeholders so cards show a SAMPLE watermark.
 */
window.CC_AGENTS = [
  {
    id: "jordan-mitchell",
    name: "Jordan Mitchell",
    agency: "Harbor & Sail Travel",
    location: "Orlando, FL",
    years: 9,
    sailings: 40,
    earmarked: true,
    featured: true,
    sample: true,
    specialties: ["First-timers", "Wish-class", "Family groups"],
    pitch: "I help first-time Disney cruisers feel booked and ready — stateroom strategy, dining windows, and the messy details between deposit and sail-away.",
    bio: "Jordan has planned Disney cruises for families of every size, with a focus on Wish-class ships and Port Canaveral sailings. Expect clear timelines, booking-window reminders, and someone who answers when plans change.",
    highlights: [
      "Wishlist stateroom shortlists before you book",
      "Castaway Club window strategy for Palo, cabanas, and excursions",
      "Multi-cabin family coordination"
    ],
    emailNotify: "leads+jordan@example.com"
  },
  {
    id: "samira-owens",
    name: "Samira Owens",
    agency: "Tide & Table Voyages",
    location: "Atlanta, GA",
    years: 12,
    sailings: 55,
    earmarked: true,
    featured: true,
    sample: true,
    specialties: ["Castaway Cay", "Lookout Cay", "Adult sailings"],
    pitch: "Beach-day planning is my specialty — cabanas, tender timing, and which ports are worth the independent adventure.",
    bio: "Samira specializes in Bahamas itineraries and private-island days. If your group cares about cabanas, adult beaches, and getting the most out of a short sailing, she's the fit.",
    highlights: [
      "Private-island cabana and beach strategy",
      "Adults-focused sailings without losing family logistics",
      "Accessible and mobility-friendly planning"
    ],
    emailNotify: "leads+samira@example.com"
  },
  {
    id: "chris-delgado",
    name: "Chris Delgado",
    agency: "Blue Pennant Planners",
    location: "Houston, TX",
    years: 7,
    sailings: 28,
    earmarked: true,
    featured: false,
    sample: true,
    specialties: ["Dream-class", "Alaska", "Large groups"],
    pitch: "Big groups, interlocking staterooms, and itineraries that aren't just the Bahamas — I keep the paperwork from becoming the vacation.",
    bio: "Chris works with reunions and multi-generation groups sailing Dream-class and Alaska. Strong on connecting rooms, payment schedules, and keeping every cabin on the same page.",
    highlights: [
      "Reunion and multi-cabin booking",
      "Alaska and longer itineraries",
      "Payment and rebooking advocacy"
    ],
    emailNotify: "leads+chris@example.com"
  },
  {
    id: "ava-bennett",
    name: "Ava Bennett",
    agency: "Lantern Line Travel",
    location: "Remote · US",
    years: 6,
    sailings: 22,
    earmarked: true,
    featured: false,
    sample: true,
    specialties: ["Budget planning", "Gift-card strategies", "First-timers"],
    pitch: "You're excited — and a little sticker-shocked. I help you spend where it matters and skip what doesn't.",
    bio: "Ava is known for transparent cost planning: deposit timelines, gift-card stacking awareness, and helping first-timers avoid surprise onboard spend.",
    highlights: [
      "Cost walkthroughs before you commit",
      "First-timer orientation without the overwhelm",
      "Clear communication over group texts"
    ],
    emailNotify: "leads+ava@example.com"
  }
];

window.CC_getAgent = function (id) {
  return (window.CC_AGENTS || []).find(function (a) { return a.id === id; }) || null;
};

window.CC_profilePath = function (agent) {
  if (!agent) return "/agents/";
  if (agent.sample) return "/agents/" + agent.id + ".html";
  return "/agents/profile.html?id=" + encodeURIComponent(agent.id);
};

/** Pre-cropped headshots for directory circles (full-body uploads stay in blob storage). */
window.CC_AGENT_PHOTO_OVERRIDES = {
  "emily-schultz": "/assets/agent-photos/emily-schultz.jpg?v=6",
  "martina-yost": "/assets/agent-photos/martina-yost.jpg?v=5",
  "kim-fanning": "/assets/agent-photos/kim-fanning.jpg?v=2",
  "donna-walters": "/assets/agent-photos/donna-walters.jpg?v=4",
  "shana-matos": "/assets/agent-photos/shana-matos.jpg?v=2",
  "rebekah-lukins": "/assets/agent-photos/rebekah-lukins.jpg?v=2"
};

window.CC_slugifyName = function (name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
};

window.CC_agentPhotoUrl = function (agent) {
  if (!agent) return null;
  var slug = agent.slug || window.CC_slugifyName(agent.name);
  var override = slug && window.CC_AGENT_PHOTO_OVERRIDES[slug];
  return override || agent.photoUrl || null;
};

window.CC_loadDirectoryAgents = async function () {
  var live = [];
  try {
    var res = await fetch("/api/agents");
    if (res.ok) {
      var data = await res.json();
      live = data.agents || [];
    }
  } catch (_) {}

  var samples = (window.CC_AGENTS || []).filter(function (a) { return a.sample; });
  if (live.length) return live;
  return samples;
};
