/**
 * Castaway Club booking-window helpers (approximate Disney windows; confirm in app).
 */
(function () {
  // Days before sailing when the window typically opens
  var WINDOWS = {
    cabana: {
      concierge: 123,
      platinum: 108,
      gold: 93,
      silver: 90,
      pearl: 75,
    },
    portAdventures: {
      concierge: 120,
      platinum: 105,
      gold: 90,
      silver: 90,
      pearl: 75,
    },
    specialtyDining: {
      concierge: 120,
      platinum: 105,
      gold: 90,
      silver: 90,
      pearl: 75,
    },
  };

  var TIER_LABELS = {
    concierge: "Concierge",
    platinum: "Platinum Castaway Club",
    gold: "Gold Castaway Club",
    silver: "Silver Castaway Club",
    pearl: "First-time / Pearl",
  };

  function parseDate(value) {
    if (!value) return null;
    var parts = value.split("-");
    if (parts.length !== 3) return null;
    var d = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2]),
      12,
      0,
      0
    );
    return isNaN(d.getTime()) ? null : d;
  }

  function addDays(date, days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function formatDate(d) {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function daysUntil(from, to) {
    var ms = to.getTime() - from.getTime();
    return Math.ceil(ms / 86400000);
  }

  function compute(sailDate, tier) {
    var today = new Date();
    today.setHours(12, 0, 0, 0);
    var out = {};
    Object.keys(WINDOWS).forEach(function (key) {
      var openDays = WINDOWS[key][tier];
      var opens = addDays(sailDate, -openDays);
      var untilOpen = daysUntil(today, opens);
      var untilSail = daysUntil(today, sailDate);
      out[key] = {
        openDays: openDays,
        opens: opens,
        untilOpen: untilOpen,
        untilSail: untilSail,
        status:
          untilSail < 0
            ? "sailed"
            : untilOpen > 0
              ? "upcoming"
              : untilOpen === 0
                ? "opens-today"
                : "open",
      };
    });
    return out;
  }

  function statusLabel(s) {
    if (s.status === "sailed") return "Sail date is in the past";
    if (s.status === "upcoming")
      return "Opens in " + s.untilOpen + " day" + (s.untilOpen === 1 ? "" : "s");
    if (s.status === "opens-today") return "Opens today (confirm your time zone / app)";
    return "Window should already be open — book soon if you haven’t";
  }

  function render(root, sailDate, tier) {
    var data = compute(sailDate, tier);
    var html =
      '<div class="stat-grid">' +
      '<div class="stat"><span class="k mono">Your tier</span><span class="v display">' +
      TIER_LABELS[tier] +
      "</span></div>" +
      '<div class="stat"><span class="k mono">Sail date</span><span class="v display">' +
      formatDate(sailDate) +
      "</span></div>" +
      '<div class="stat"><span class="k mono">Cabanas</span><span class="v display">' +
      formatDate(data.cabana.opens) +
      '</span><span class="note">' +
      statusLabel(data.cabana) +
      " · ~" +
      data.cabana.openDays +
      " days out</span></div>" +
      '<div class="stat"><span class="k mono">Port Adventures</span><span class="v display">' +
      formatDate(data.portAdventures.opens) +
      '</span><span class="note">' +
      statusLabel(data.portAdventures) +
      " · ~" +
      data.portAdventures.openDays +
      " days out</span></div>" +
      '<div class="stat"><span class="k mono">Specialty dining</span><span class="v display">' +
      formatDate(data.specialtyDining.opens) +
      '</span><span class="note">' +
      statusLabel(data.specialtyDining) +
      " · typically with PA window</span></div>" +
      "</div>" +
      '<p class="fine-print">Approximate Castaway Club windows used by most U.S. Disney sailings. Concierge and club tiers can shift; always confirm the exact open time in the Disney Cruise Line app or with your agent.</p>';
    root.innerHTML = html;
  }

  function bindForm(form) {
    var out = document.getElementById("bookingWindowResult");
    if (!form || !out) return;
    function update(e) {
      if (e) e.preventDefault();
      var sail = parseDate(form.sailDate.value);
      var tier = form.tier.value || "pearl";
      if (!sail) {
        out.innerHTML =
          '<p class="fine-print">Enter your sail date to see cabana, Port Adventure, and specialty dining windows.</p>';
        return;
      }
      render(out, sail, tier);
    }
    form.addEventListener("submit", update);
    form.addEventListener("change", update);
    update();
  }

  function init() {
    bindForm(document.getElementById("bookingWindowForm"));
    bindForm(document.getElementById("cabanaCountdownForm"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
