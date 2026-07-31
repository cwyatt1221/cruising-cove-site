/**
 * Interactive deck-by-deck venue locator for ship pages.
 * Mount: <div data-cc-deck-plans="disney-wish"></div>
 */
(function () {
  var CATS = [
    { id: "all", label: "All" },
    { id: "dining", label: "Dining" },
    { id: "pool", label: "Pools" },
    { id: "entertainment", label: "Shows & fun" },
    { id: "kids", label: "Kids & teens" },
    { id: "adults", label: "Adults" },
    { id: "spa", label: "Spa" },
    { id: "laundry", label: "Laundry" },
    { id: "service", label: "Services" },
  ];

  var ZONE_LABEL = { fwd: "Forward", mid: "Midship", aft: "Aft" };
  var CAT_LABEL = {
    dining: "Dining",
    pool: "Pool",
    entertainment: "Entertainment",
    kids: "Kids & teens",
    adults: "Adults",
    spa: "Spa",
    laundry: "Laundry",
    service: "Services",
  };

  function shipKeyFromPath() {
    var m = location.pathname.match(/disney-([a-z-]+)\.html/);
    return m ? "disney-" + m[1] : null;
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function officialUrl(slug) {
    return "https://disneycruise.disney.go.com/ships/deck-plans/" + slug + "/";
  }

  function deckNumbers(ship) {
    return Object.keys(ship.decks || {})
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      });
  }

  function venuesFor(ship, deck, cat) {
    var list = ((ship.decks[deck] || {}).venues) || [];
    if (cat && cat !== "all") {
      list = list.filter(function (v) {
        return v.cat === cat;
      });
    }
    return list;
  }

  function firstDeckWithVenues(ship, cat) {
    var nums = deckNumbers(ship);
    for (var i = 0; i < nums.length; i++) {
      if (venuesFor(ship, String(nums[i]), cat).length) return String(nums[i]);
    }
    return nums.length ? String(nums[0]) : null;
  }

  function renderMap(venues) {
    var zones = ["fwd", "mid", "aft"];
    return (
      '<div class="cc-deck-map" aria-hidden="true">' +
      '<div class="cc-deck-hull">' +
      zones
        .map(function (z) {
          var dots = venues
            .filter(function (v) {
              return v.zone === z;
            })
            .map(function (v) {
              return (
                '<span class="cc-deck-dot cat-' +
                esc(v.cat) +
                '" title="' +
                esc(v.name) +
                '"></span>'
              );
            })
            .join("");
          return (
            '<div class="cc-deck-zone zone-' +
            z +
            '">' +
            '<span class="cc-deck-zone-label">' +
            ZONE_LABEL[z] +
            "</span>" +
            '<div class="cc-deck-dots">' +
            (dots || '<span class="cc-deck-empty">—</span>') +
            "</div></div>"
          );
        })
        .join("") +
      "</div>" +
      '<p class="cc-deck-map-caption">Simplified locator · Forward → Aft · not a scaled floor plan</p>' +
      "</div>"
    );
  }

  function renderList(venues) {
    if (!venues.length) {
      return '<p class="cc-deck-empty-msg">Nothing in this category on this deck — try another filter or deck.</p>';
    }
    return (
      '<ul class="cc-deck-venue-list">' +
      venues
        .map(function (v) {
          return (
            "<li>" +
            '<div class="cc-deck-venue-top">' +
            '<span class="cc-deck-cat cat-' +
            esc(v.cat) +
            '">' +
            esc(CAT_LABEL[v.cat] || v.cat) +
            "</span>" +
            '<span class="cc-deck-zone-chip">' +
            esc(ZONE_LABEL[v.zone] || v.zone) +
            "</span>" +
            "</div>" +
            "<strong>" +
            esc(v.name) +
            "</strong>" +
            (v.tip ? "<p>" + esc(v.tip) + "</p>" : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }

  function mount(el) {
    var key = el.getAttribute("data-cc-deck-plans") || shipKeyFromPath();
    var data = (window.CC_DECK_PLANS || {})[key];
    if (!data || !data.decks) {
      el.innerHTML = '<p class="fine-print">Deck guide coming soon for this ship.</p>';
      return;
    }

    var state = {
      cat: "all",
      deck: firstDeckWithVenues(data, "all"),
    };

    function paint() {
      var nums = deckNumbers(data);
      var deckKey = state.deck;
      var deckInfo = data.decks[deckKey] || {};
      var venues = venuesFor(data, deckKey, state.cat);

      el.innerHTML =
        '<div class="cc-deck-plans">' +
        '<div class="cc-deck-meta">' +
        '<p class="cc-deck-class">' +
        esc(data.classLabel || "") +
        "</p>" +
        (data.note ? "<p class=\"cc-deck-note\">" + esc(data.note) + "</p>" : "") +
        "</div>" +
        '<div class="cc-deck-filters" role="tablist" aria-label="Venue type">' +
        CATS.map(function (c) {
          return (
            '<button type="button" class="cc-deck-filter' +
            (state.cat === c.id ? " is-active" : "") +
            '" data-cat="' +
            c.id +
            '" role="tab" aria-selected="' +
            (state.cat === c.id ? "true" : "false") +
            '">' +
            esc(c.label) +
            "</button>"
          );
        }).join("") +
        "</div>" +
        '<div class="cc-deck-tabs" role="tablist" aria-label="Deck number">' +
        nums
          .map(function (n) {
            var k = String(n);
            var count = venuesFor(data, k, state.cat).length;
            var disabled = state.cat !== "all" && count === 0;
            return (
              '<button type="button" class="cc-deck-tab' +
              (state.deck === k ? " is-active" : "") +
              (disabled ? " is-empty" : "") +
              '" data-deck="' +
              k +
              '"' +
              (disabled ? ' aria-disabled="true"' : "") +
              ">" +
              "Deck " +
              k +
              (count && state.cat !== "all" ? '<span class="cc-deck-count">' + count + "</span>" : "") +
              "</button>"
            );
          })
          .join("") +
        "</div>" +
        '<div class="cc-deck-panel">' +
        "<h3>Deck " +
        esc(deckKey) +
        "</h3>" +
        (deckInfo.blurb ? "<p class=\"cc-deck-blurb\">" + esc(deckInfo.blurb) + "</p>" : "") +
        renderMap(venues) +
        renderList(venues) +
        "</div>" +
        '<p class="cc-deck-official">' +
        '<a class="btn btn-outline" href="' +
        esc(officialUrl(data.officialSlug || key.replace("disney-", ""))) +
        '" target="_blank" rel="noopener noreferrer">Official Disney deck plans (cabins)</a>' +
        ' <span class="fine-print">Opens Disney Cruise Line · useful for stateroom maps</span>' +
        "</p>" +
        "</div>";

      el.querySelectorAll("[data-cat]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          state.cat = btn.getAttribute("data-cat");
          var next = firstDeckWithVenues(data, state.cat);
          if (next) state.deck = next;
          paint();
        });
      });
      el.querySelectorAll("[data-deck]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          if (btn.getAttribute("aria-disabled") === "true") return;
          state.deck = btn.getAttribute("data-deck");
          paint();
        });
      });
    }

    paint();
  }

  function init() {
    document.querySelectorAll("[data-cc-deck-plans]").forEach(mount);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
