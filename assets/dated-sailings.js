/**
 * Dated Disney Cruise sailings for My Cruise autofill (ship + embark date).
 * Keep in sync with api/src/lib/sailingCatalog.ts — not a live Disney inventory feed.
 */
(function (global) {
  var sailings = [
    {
      shipSlug: "disney-dream",
      embarkationDate: "2026-10-16",
      nights: 3,
      destinationRegion: "bahamas",
      theme: "Halloween on the High Seas",
      departurePort: "Port Everglades (Fort Lauderdale)",
      ports: ["lookout-cay", "nassau"],
    },
    {
      shipSlug: "disney-wish",
      embarkationDate: "2026-10-16",
      nights: 3,
      destinationRegion: "bahamas",
      theme: "Halloween on the High Seas",
      departurePort: "Port Canaveral, FL",
      ports: ["nassau", "castaway-cay"],
    },
    {
      shipSlug: "disney-destiny",
      embarkationDate: "2026-10-24",
      nights: 5,
      destinationRegion: "caribbean",
      theme: "Halloween on the High Seas",
      departurePort: "Fort Lauderdale, FL",
      ports: ["cozumel", "castaway-cay"],
    },
    {
      shipSlug: "disney-treasure",
      embarkationDate: "2026-12-26",
      nights: 7,
      destinationRegion: "caribbean",
      theme: null,
      departurePort: "Port Canaveral, FL",
      ports: ["cozumel", "grand-cayman", "falmouth", "castaway-cay"],
    },
  ];

  function themeIdFromLabel(theme) {
    if (!theme) return "none";
    var t = String(theme).toLowerCase();
    if (t.indexOf("halloween") >= 0) return "halloween";
    if (t.indexOf("merry") >= 0) return "merrytime";
    if (t.indexOf("bluey") >= 0) return "bluey";
    if (t.indexOf("marvel") >= 0) return "marvel";
    if (t.indexOf("pixar") >= 0) return "pixar";
    return "none";
  }

  function lookup(shipSlug, embarkationDate) {
    var slug = String(shipSlug || "").trim();
    var date = String(embarkationDate || "").trim();
    if (!slug || !date) return null;
    for (var i = 0; i < sailings.length; i++) {
      if (sailings[i].shipSlug === slug && sailings[i].embarkationDate === date) {
        return sailings[i];
      }
    }
    return null;
  }

  global.CC_DATED_SAILINGS = {
    sailings: sailings,
    lookup: lookup,
    themeIdFromLabel: themeIdFromLabel,
  };
})(typeof window !== "undefined" ? window : globalThis);
