/**
 * All-in Disney cruise cost estimate (planning ballpark, not a quote).
 */
(function () {
  var FARE_PER_NIGHT = {
    inside: { adult: 260, kid: 150 },
    oceanview: { adult: 310, kid: 175 },
    verandah: { adult: 400, kid: 220 },
    concierge: { adult: 850, kid: 420 },
  };

  var SHIP_MULT = {
    magic: 0.95,
    wonder: 0.95,
    dream: 1.0,
    fantasy: 1.05,
    wish: 1.12,
    treasure: 1.15,
    destiny: 1.15,
    adventure: 1.2,
  };

  var GRAT_STD = 16;
  var GRAT_CONCIERGE = 27.25;
  var WIFI = { none: 0, internet: 30, streaming: 49 };
  var SPECIALTY = 55;
  var DRINK = 12;
  var DRINK_TIP = 0.18;

  function money(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  function calc(input) {
    var nights = Math.max(2, Number(input.nights) || 4);
    var adults = Math.max(1, Number(input.adults) || 2);
    var kids = Math.max(0, Number(input.kids) || 0);
    var guests = adults + kids;
    var tier = FARE_PER_NIGHT[input.tier] || FARE_PER_NIGHT.verandah;
    var mult = SHIP_MULT[input.ship] || 1;
    var fare =
      (adults * tier.adult + kids * tier.kid) * nights * mult;
    var gratRate = input.tier === "concierge" ? GRAT_CONCIERGE : GRAT_STD;
    var gratuities = guests * gratRate * nights;
    var wifiDay = WIFI[input.wifiTier] || 0;
    var wifiDevices = Math.max(0, Number(input.wifiDevices) || 0);
    var wifi = wifiDay * wifiDevices * nights;
    var specialtyCovers = Math.max(0, Number(input.specialty) || 0);
    var specialty = specialtyCovers * SPECIALTY;
    var drinks = Math.max(0, Number(input.drinks) || 0);
    var drinkTotal = drinks * DRINK * (1 + DRINK_TIP);
    var total = fare + gratuities + wifi + specialty + drinkTotal;
    return {
      nights: nights,
      guests: guests,
      fare: fare,
      gratuities: gratuities,
      wifi: wifi,
      specialty: specialty,
      drinks: drinkTotal,
      total: total,
      gratRate: gratRate,
    };
  }

  function render(out) {
    var stats = document.getElementById("calcStats");
    var note = document.getElementById("calcNote");
    if (!stats) return;
    stats.innerHTML =
      '<div class="stat"><span class="k mono">Fare estimate</span><span class="v display">' +
      money(out.fare) +
      '</span><span class="note">party total · planning mid</span></div>' +
      '<div class="stat"><span class="k mono">Gratuities</span><span class="v display">' +
      money(out.gratuities) +
      '</span><span class="note">$' +
      out.gratRate.toFixed(2) +
      " × " +
      out.guests +
      " × " +
      out.nights +
      " nights</span></div>" +
      '<div class="stat"><span class="k mono">Wi‑Fi</span><span class="v display">' +
      money(out.wifi) +
      '</span><span class="note">selected tier × devices × nights</span></div>' +
      '<div class="stat"><span class="k mono">Specialty dining</span><span class="v display">' +
      money(out.specialty) +
      '</span><span class="note">~$55 cover · before tip</span></div>' +
      '<div class="stat"><span class="k mono">Drinks</span><span class="v display">' +
      money(out.drinks) +
      '</span><span class="note">~$12 + 18% each</span></div>' +
      '<div class="stat"><span class="k mono">All-in estimate</span><span class="v display">' +
      money(out.total) +
      '</span><span class="note">not a Disney quote</span></div>';
    if (note) {
      note.textContent =
        "Ballpark for U.S. Caribbean / Bahamas–style sailings. Peak weeks, Alaska, Europe, and Adventure sailings run higher. Confirm live fares and package prices in Disney’s planner before you budget.";
    }
  }

  function readForm(form) {
    return {
      ship: form.ship.value,
      nights: form.nights.value,
      adults: form.adults.value,
      kids: form.kids.value,
      tier: form.tier.value,
      wifiDevices: form.wifiDevices.value,
      wifiTier: form.wifiTier.value,
      specialty: form.specialty.value,
      drinks: form.drinks.value,
    };
  }

  function init() {
    var form = document.getElementById("costCalc");
    if (!form) return;
    function update(e) {
      if (e) e.preventDefault();
      render(calc(readForm(form)));
    }
    form.addEventListener("submit", update);
    form.addEventListener("change", update);
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
