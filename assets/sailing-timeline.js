/**
 * Your sailing timeline — final payment, activity window, check-in, embarkation.
 * Approximate Disney windows; always confirm in the Disney Cruise Line app.
 */
(function (global) {
  var ACTIVITY = {
    concierge: 130,
    pearl: 123,
    platinum: 120,
    gold: 105,
    silver: 90,
    firstTime: 75,
  };

  var CHECKIN = {
    concierge: 40,
    pearl: 40,
    platinum: 38,
    gold: 35,
    silver: 33,
    firstTime: 30,
  };

  var TIER_LABELS = {
    concierge: "Concierge",
    pearl: "Pearl (25+ sailings)",
    platinum: "Platinum",
    gold: "Gold",
    silver: "Silver",
    firstTime: "First-time guest",
  };

  function parseDate(value) {
    if (!value) return null;
    var parts = value.split("-");
    if (parts.length !== 3) return null;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
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
    return Math.ceil((to.getTime() - from.getTime()) / 86400000);
  }

  function statusFor(today, eventDate, sailDate) {
    if (daysUntil(today, sailDate) < 0) return { key: "sailed", label: "Sail date has passed" };
    var until = daysUntil(today, eventDate);
    if (until > 0) return { key: "upcoming", label: "In " + until + " day" + (until === 1 ? "" : "s") };
    if (until === 0) return { key: "today", label: "Today — confirm exact time in the app" };
    return { key: "passed", label: "Should already be open / due" };
  }

  function finalPaymentDays(nights) {
    return nights >= 6 ? 120 : 90;
  }

  function compute(sailDate, tier, nights) {
    var today = new Date();
    today.setHours(12, 0, 0, 0);
    nights = Math.max(1, Number(nights) || 4);
    if (!ACTIVITY[tier]) tier = "firstTime";

    var payDays = finalPaymentDays(nights);
    var activityDays = ACTIVITY[tier];
    var checkinDays = CHECKIN[tier];

    var milestones = [
      {
        id: "final-payment",
        title: "Final payment due",
        detail: "~" + payDays + " days before sail (" + (nights >= 6 ? "6+ night" : "1–5 night") + " pattern)",
        date: addDays(sailDate, -payDays),
        link: "/planning/deposit-final-payment.html",
      },
      {
        id: "activities",
        title: "Activity booking window",
        detail: "Cabanas, Port Adventures, specialty dining · ~" + activityDays + " days out",
        date: addDays(sailDate, -activityDays),
        link: "/planning/booking-windows.html",
      },
      {
        id: "check-in",
        title: "Online check-in / port arrival",
        detail: "~" + checkinDays + " days out for your tier (confirm in app)",
        date: addDays(sailDate, -checkinDays),
        link: "/planning/castaway-club.html",
      },
      {
        id: "embarkation",
        title: "Embarkation morning",
        detail: "Terminal arrival group, Key to the World, first afternoon",
        date: sailDate,
        link: "/planning/embarkation-day-checklist.html",
      },
    ];

    milestones.forEach(function (m) {
      m.status = statusFor(today, m.date, sailDate);
    });

    return {
      tier: tier,
      nights: nights,
      sailDate: sailDate,
      milestones: milestones,
      royalGathering: addDays(sailDate, -30),
    };
  }

  function render(root, data) {
    var items = data.milestones
      .map(function (m) {
        return (
          '<li class="cc-timeline-item status-' +
          m.status.key +
          '">' +
          '<div class="cc-timeline-marker" aria-hidden="true"></div>' +
          '<div class="cc-timeline-body">' +
          "<h3>" +
          m.title +
          "</h3>" +
          '<p class="cc-timeline-date">' +
          formatDate(m.date) +
          ' · <span class="cc-timeline-status">' +
          m.status.label +
          "</span></p>" +
          "<p>" +
          m.detail +
          "</p>" +
          '<p><a href="' +
          m.link +
          '">Open guide →</a></p>' +
          "</div></li>"
        );
      })
      .join("");

    root.innerHTML =
      '<div class="stat-grid">' +
      '<div class="stat"><span class="k mono">Tier</span><span class="v display">' +
      TIER_LABELS[data.tier] +
      "</span></div>" +
      '<div class="stat"><span class="k mono">Sail date</span><span class="v display">' +
      formatDate(data.sailDate) +
      "</span></div>" +
      '<div class="stat"><span class="k mono">Nights</span><span class="v display">' +
      data.nights +
      "</span></div>" +
      "</div>" +
      '<ol class="cc-timeline">' +
      items +
      "</ol>" +
      '<div class="callout" style="margin-top:1.2rem;"><span class="label mono">&mdash; Extra calendar</span>' +
      "<p><strong>Royal Gathering</strong> (free multi-princess meet) typically opens ~30 days before sail for everyone — " +
      formatDate(data.royalGathering) +
      " on this sailing. Put it on a separate reminder.</p></div>" +
      '<p class="fine-print">Approximate planning dates for most U.S. Disney sailings. Final payment, Castaway Club windows, and check-in times can vary by promotion and itinerary — confirm in My Reservations and the Navigator app.</p>';
  }

  function bind() {
    var form = document.getElementById("sailingTimelineForm");
    var out = document.getElementById("sailingTimelineResult");
    if (!form || !out) return;
    function update(e) {
      if (e) e.preventDefault();
      var sail = parseDate(form.sailDate.value);
      var tier = form.tier.value || "firstTime";
      var nights = form.nights.value;
      if (!sail) {
        out.innerHTML = '<p class="fine-print">Enter your sail date to build the timeline.</p>';
        return;
      }
      render(out, compute(sail, tier, nights));
    }
    form.addEventListener("submit", update);
    form.addEventListener("change", update);
    update();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  global.CCSailingTimeline = { compute: compute, TIER_LABELS: TIER_LABELS };
})(typeof window !== "undefined" ? window : this);
