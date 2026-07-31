/**
 * Castaway Club booking-window helpers (approximate Disney windows; confirm in app).
 * Official activity windows: First-time 75 · Silver 90 · Gold 105 · Platinum 120 · Pearl 123.
 * Concierge: often ~130 days via Shoreside Concierge phone; ~123 days online (matches Pearl).
 */
(function (global) {
  var WINDOWS = {
    cabana: {
      concierge: 130,
      pearl: 123,
      platinum: 120,
      gold: 105,
      silver: 90,
      firstTime: 75,
    },
    portAdventures: {
      concierge: 130,
      pearl: 123,
      platinum: 120,
      gold: 105,
      silver: 90,
      firstTime: 75,
    },
    specialtyDining: {
      concierge: 130,
      pearl: 123,
      platinum: 120,
      gold: 105,
      silver: 90,
      firstTime: 75,
    },
  };

  var TIER_LABELS = {
    concierge: "Concierge",
    pearl: "Pearl Castaway Club (25+ sailings)",
    platinum: "Platinum Castaway Club",
    gold: "Gold Castaway Club",
    silver: "Silver Castaway Club",
    firstTime: "First-time guest",
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
      '<p class="fine-print">Approximate Castaway Club windows for most U.S. Disney sailings (Pearl = 25+ completed sailings; first-time guests are not Pearl). Concierge often opens ~130 days by phone; online is commonly ~123. Always confirm the exact open time in the Disney Cruise Line app.</p>';
    root.innerHTML = html;
  }

  function bindForm(form) {
    var out = document.getElementById("bookingWindowResult");
    if (!form || !out) return;
    function update(e) {
      if (e) e.preventDefault();
      var sail = parseDate(form.sailDate.value);
      var tier = form.tier.value || "firstTime";
      if (!WINDOWS.portAdventures[tier]) tier = "firstTime";
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

  global.CCBookingWindows = {
    WINDOWS: WINDOWS,
    TIER_LABELS: TIER_LABELS,
    parseDate: parseDate,
    addDays: addDays,
    formatDate: formatDate,
    daysUntil: daysUntil,
    compute: compute,
    statusLabel: statusLabel,
    render: render,
  };
})(typeof window !== "undefined" ? window : globalThis);
