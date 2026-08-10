/**
 * Thin v1 stateroom intel — curated planning notes, not verified cabin databases.
 */
(function () {
  var CLASS_NOTES = {
    classic: {
      elevators:
        "Light sleepers: skip cabins immediately beside midship and aft elevator lobbies. Ask for “away from elevators” when booking.",
      obstructed:
        "Oceanview and some verandah categories can sit above lifeboats or under overhangs — Disney labels obstructed / limited view in the planner. Open the deck plan before you lock a number.",
      connecting:
        "Connecting doors exist but are limited vs Wish-class. Request connecting rooms at booking; they sell early on holidays.",
      noise: [
        "Cabins under the pool deck or near early-morning buffet service can hear setup.",
        "Aft rooms near Funnel Vision / outdoor movies get evening sound on some sailings.",
        "Inside rooms midship are often the quietest sleepers if you don’t need a window.",
      ],
    },
    dream: {
      elevators:
        "Avoid rooms flush with midship elevator banks on cabin decks. Corner and far-forward or far-aft within a category are usually quieter.",
      obstructed:
        "Some Category 4/5 verandahs have metal or lifeboat views. Virtual-porthole insides are fully enclosed — no real window noise, but you hear neighbors more.",
      connecting:
        "Dream-class connecting inventory is solid for families; book two rooms and request connecting early.",
      noise: [
        "Upper-deck cabins under AquaDuck / pool areas can hear morning water-play and chair stacking.",
        "Rooms near the Walt Disney Theatre or district nightlife hear late foot traffic on show nights.",
        "Guest tip pattern: midship, lower-to-mid cabin decks for motion + quieter nights.",
      ],
    },
    wish: {
      elevators:
        "Wish-class has forward and aft elevator banks only — no midship bank (the Grand Hall takes that space). If you’re noise-sensitive, skip cabins right next to either lobby and pick a few doors down the corridor.",
      obstructed:
        "Check for obstructed verandah labels and rooms under AquaMouse structure. Concierge forward/aft has different view tradeoffs — compare deck plans.",
      connecting:
        "Wish-class has hundreds of connecting doors (Wish ~451). Great for multi-cabin groups — still request explicitly.",
      noise: [
        "Cabins near AquaMouse / pool decks hear attraction and morning setup.",
        "Rooms above or beside late lounges (Wish-class lounge corridors) can get evening noise.",
        "Guest tip pattern: true midship verandahs sit farther from both elevator banks (quieter, longer walk); near-forward or near-aft is more convenient.",
      ],
    },
    adventure: {
      elevators:
        "Adventure is a much larger ship — elevator banks and public corridors are high-traffic. Ask for a quieter cabin zone when you book.",
      obstructed:
        "Confirm view type in the planner; mega-ship categories vary more than classic Disney decks.",
      connecting:
        "Connecting options exist for families — confirm at booking for multi-cabin parties.",
      noise: [
        "Expect more ambient corridor noise than Magic/Wonder; prioritize location over tiny fare savings if you need quiet.",
        "Upper decks near water attractions and entertainment districts are the usual noise tradeoff.",
      ],
    },
  };

  var SHIP_CLASS = {
    "disney-magic": "classic",
    "disney-wonder": "classic",
    "disney-dream": "dream",
    "disney-fantasy": "dream",
    "disney-wish": "wish",
    "disney-treasure": "wish",
    "disney-destiny": "wish",
    "disney-believe": "wish",
    "disney-adventure": "adventure",
  };

  function shipKeyFromPath() {
    var m = location.pathname.match(/disney-([a-z-]+)\.html/);
    return m ? "disney-" + m[1] : null;
  }

  function renderInto(el, data) {
    var noise = (data.noise || [])
      .map(function (n) {
        return "<li>" + n + "</li>";
      })
      .join("");
    el.innerHTML =
      '<span class="label mono">&mdash; Cabin intel · v1</span>' +
      "<h3 style=\"font-family:var(--font-serif);font-size:1.35rem;font-weight:500;color:var(--navy);margin:0 0 0.75rem;\">What to watch before you pick a number</h3>" +
      "<p><strong>Elevators.</strong> " +
      data.elevators +
      "</p>" +
      "<p><strong>Obstructed verandahs.</strong> " +
      data.obstructed +
      "</p>" +
      "<p><strong>Connecting rooms.</strong> " +
      data.connecting +
      "</p>" +
      (noise
        ? "<p><strong>Noise patterns (guest reports + deck layout).</strong></p><ul class=\"plain\">" +
          noise +
          "</ul>"
        : "") +
      '<p class="fine-print" style="margin-top:0.85rem;">Thin v1 — curated planning notes, not a live cabin database. Always verify the specific stateroom in Disney’s deck plans before you pay.</p>';
  }

  function init() {
    var nodes = document.querySelectorAll("[data-cc-stateroom-intel]");
    if (nodes.length) {
      var key = shipKeyFromPath();
      var cls = SHIP_CLASS[key] || "wish";
      var data = CLASS_NOTES[cls];
      nodes.forEach(function (el) {
        var override = el.getAttribute("data-cc-stateroom-intel");
        if (override && CLASS_NOTES[override]) data = CLASS_NOTES[override];
        renderInto(el, data);
      });
    }

    var grid = document.getElementById("cabinIntelGrid");
    if (grid) {
      var labels = {
        classic: "Magic & Wonder",
        dream: "Dream & Fantasy",
        wish: "Wish, Treasure & Destiny",
        adventure: "Adventure",
      };
      grid.innerHTML = Object.keys(labels)
        .map(function (key) {
          var d = CLASS_NOTES[key];
          return (
            '<div class="fleet-card"><span class="class-tag">' +
            labels[key] +
            "</span><h3>" +
            labels[key] +
            "</h3>" +
            "<p><strong>Elevators.</strong> " +
            d.elevators +
            "</p>" +
            "<p><strong>Views.</strong> " +
            d.obstructed +
            "</p>" +
            "<p><strong>Connecting.</strong> " +
            d.connecting +
            "</p></div>"
          );
        })
        .join("");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.CCStateroomIntel = {
    CLASS_NOTES: CLASS_NOTES,
    SHIP_CLASS: SHIP_CLASS,
  };
})();
