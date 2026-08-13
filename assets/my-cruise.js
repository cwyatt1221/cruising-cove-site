/**
 * My Cruise planner — local trip state + optional account sync.
 */
(function () {
  var DATA = window.CC_MY_CRUISE;
  var CATALOG = window.CC_SAILING_CATALOG;
  var DATED = window.CC_DATED_SAILINGS;
  var BW = window.CCBookingWindows;
  var Community = window.CCCommunity;
  var STORAGE_KEY = "cc_my_cruise_trips";
  var ACTIVE_KEY = "cc_my_cruise_active";

  var state = {
    trips: [],
    activeId: null,
    communityPacking: [],
    reviewCache: {},
  };

  function $(id) {
    return document.getElementById(id);
  }

  var PAGE =
    (document.body && document.body.getAttribute("data-mc-page")) ||
    (document.getElementById("mcDashboard") ? "active" : "setup");

  function toast(msg) {
    var el = $("mcToast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.hidden = true;
    }, 2800);
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shipName(slug) {
    var s = DATA.ships.find(function (x) {
      return x.slug === slug;
    });
    return s ? s.name : slug;
  }

  function portName(id) {
    var p = DATA.ports.find(function (x) {
      return x.id === id;
    });
    return p ? p.name : id;
  }

  function loadLocal() {
    try {
      state.trips = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") || [];
      state.activeId = localStorage.getItem(ACTIVE_KEY) || (state.trips[0] && state.trips[0].id) || null;
    } catch (e) {
      state.trips = [];
      state.activeId = null;
    }
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.trips));
    if (state.activeId) localStorage.setItem(ACTIVE_KEY, state.activeId);
  }

  function activeTrip() {
    return state.trips.find(function (t) {
      return t.id === state.activeId;
    }) || null;
  }

  function emptyTrip() {
    return {
      id: uid(),
      shipSlug: "disney-wish",
      embarkDate: "",
      nights: 4,
      ports: [],
      destinationRegion: "bahamas",
      castawayTier: "firstTime",
      partyAges: [],
      themes: ["none"],
      cabinCandidates: [],
      customPackingItems: [],
      signupChecks: {},
      packingChecks: {},
      carryOnChecks: {},
      excursionShortlist: [],
      signupPriority: [],
      title: "",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  function readFormIntoTrip(trip) {
    if (!$("mcShip")) return trip;
    trip.shipSlug = $("mcShip").value;
    trip.embarkDate = $("mcEmbark").value;
    trip.nights = Number($("mcNights").value) || 3;
    trip.castawayTier = $("mcTier").value;
    trip.destinationRegion = $("mcRegion").value;
    trip.title = ($("mcTitle").value || "").trim();
    trip.ports = selectedValues($("mcPorts"));
    trip.themes = selectedValues($("mcThemes"));
    if (!trip.themes.length) trip.themes = ["none"];
    var agesRaw = ($("mcAges").value || "").split(/[,\s]+/).filter(Boolean);
    trip.partyAges = agesRaw
      .map(function (n) {
        return Number(n);
      })
      .filter(function (n) {
        return !isNaN(n) && n >= 0 && n <= 120;
      });
    var cabins = ($("mcCabins").value || "")
      .split(/[\n,]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    trip.cabinCandidates = cabins.slice(0, 20);
    trip.updatedAt = new Date().toISOString();
    return trip;
  }

  function fillForm(trip) {
    if (!trip || !$("mcShip")) return;
    $("mcShip").value = trip.shipSlug || "disney-wish";
    $("mcEmbark").value = trip.embarkDate || "";
    $("mcNights").value = String(trip.nights || 4);
    $("mcTier").value = trip.castawayTier || "firstTime";
    $("mcRegion").value = trip.destinationRegion || "bahamas";
    $("mcTitle").value = trip.title || "";
    $("mcAges").value = (trip.partyAges || []).join(", ");
    $("mcCabins").value = (trip.cabinCandidates || []).join("\n");
    setSelectedValues($("mcPorts"), trip.ports || []);
    setSelectedValues($("mcThemes"), trip.themes || []);
  }

  function selectedValues(select) {
    if (!select) return [];
    return Array.prototype.slice
      .call(select.options)
      .filter(function (opt) {
        return opt.selected;
      })
      .map(function (opt) {
        return opt.value;
      });
  }

  function setSelectedValues(select, values) {
    if (!select) return;
    var set = {};
    (values || []).forEach(function (v) {
      set[v] = true;
    });
    Array.prototype.slice.call(select.options).forEach(function (opt) {
      opt.selected = !!set[opt.value];
    });
  }

  async function syncFromServer() {
    if (!Community || !Community.getToken()) return;
    try {
      var data = await Community.api("/planner/trips");
      var remote = data.trips || [];
      if (!remote.length) return;
      var byId = {};
      state.trips.forEach(function (t) {
        byId[t.id] = t;
      });
      remote.forEach(function (r) {
        var local = byId[r.id];
        if (!local || (r.updatedAt || "") >= (local.updatedAt || "")) {
          byId[r.id] = r;
        }
      });
      state.trips = Object.keys(byId).map(function (k) {
        return byId[k];
      });
      state.trips.sort(function (a, b) {
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      });
      if (!state.activeId && state.trips[0]) state.activeId = state.trips[0].id;
      saveLocal();
    } catch (e) {
      /* stay local */
    }
  }

  async function pushTrip(trip) {
    if (!Community || !Community.getToken()) return;
    try {
      var data = await Community.api("/planner/trips", { method: "POST", body: trip });
      if (data.trip) {
        var idx = state.trips.findIndex(function (t) {
          return t.id === data.trip.id;
        });
        if (idx >= 0) state.trips[idx] = data.trip;
        saveLocal();
      }
    } catch (e) {
      toast(
        e && e.status === 401
          ? "Saved on this device — sign in again to sync."
          : "Saved on this device — cloud sync unavailable right now."
      );
    }
  }

  function youngestAge(trip) {
    if (!trip.partyAges || !trip.partyAges.length) return null;
    return Math.min.apply(null, trip.partyAges);
  }

  function maxKidAge(trip) {
    var kids = (trip.partyAges || []).filter(function (a) {
      return a < 18;
    });
    if (!kids.length) return null;
    return Math.max.apply(null, kids);
  }

  function signupListForTrip(trip) {
    var youngest = youngestAge(trip);
    var items = DATA.signupItems.filter(function (item) {
      if (item.ships && item.ships.length && item.ships.indexOf(trip.shipSlug) === -1) return false;
      if (item.ports && item.ports.length) {
        var hit = item.ports.some(function (p) {
          return (trip.ports || []).indexOf(p) !== -1;
        });
        if (!hit) return false;
      }
      if (typeof item.maxAge === "number" && youngest !== null && youngest > item.maxAge) {
        // still show nursery etc. if any child could qualify
        var any = (trip.partyAges || []).some(function (a) {
          return a <= item.maxAge;
        });
        if (!any && trip.partyAges.length) return false;
      }
      return true;
    });
    var priority = trip.signupPriority || [];
    items.sort(function (a, b) {
      var ia = priority.indexOf(a.id);
      var ib = priority.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.priority - b.priority;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return items;
  }

  function itineraryTags(trip) {
    var tags = { all: true };
    var region = trip.destinationRegion || "other";
    if (region) tags[region] = true;
    (trip.ports || []).forEach(function (portId) {
      var p = DATA.ports.find(function (x) {
        return x.id === portId;
      });
      if (!p) return;
      if (p.region) tags[p.region] = true;
      if (p.island) tags.bahamas = true;
    });
    (trip.themes || []).forEach(function (t) {
      if (t && t !== "none") tags[t] = true;
    });
    if ((trip.partyAges || []).some(function (a) {
      return a < 18;
    })) {
      tags.kids = true;
    }
    if (tags.bahamas || tags.caribbean) tags.pirate = true;
    return tags;
  }

  function packingForTrip(trip) {
    var tags = itineraryTags(trip);
    var base = DATA.packingItems.filter(function (item) {
      return (item.tags || []).some(function (t) {
        return tags[t];
      });
    });
    var community = (state.communityPacking || []).filter(function (item) {
      return (
        (item.tags || []).some(function (t) {
          return tags[t];
        }) ||
        (item.tags || []).indexOf("all") !== -1 ||
        !(item.tags || []).length
      );
    });
    return base.concat(
      community.map(function (c) {
        return {
          id: c.id,
          label: c.label,
          tags: c.tags,
          category: c.category || "community",
          carryOn: !!c.carryOn,
        };
      })
    );
  }

  function packingBasisText(trip) {
    var bits = [];
    var regionLabels = {
      bahamas: "Bahamas",
      caribbean: "Caribbean",
      alaska: "Alaska",
      panama: "Panama Canal",
      europe: "Europe",
      "mexican-riviera": "Mexican Riviera",
      hawaii: "Hawaii",
      "northern-europe": "Northern Europe",
      singapore: "Singapore / Asia",
      transatlantic: "Transatlantic",
      other: "general",
    };
    bits.push(regionLabels[trip.destinationRegion] || "general");
    var ports = (trip.ports || [])
      .map(portName)
      .filter(function (n) {
        return n && n !== "Other / not listed";
      });
    if (ports.length) bits.push(ports.slice(0, 4).join(", ") + (ports.length > 4 ? "…" : ""));
    var themes = (trip.themes || []).filter(function (t) {
      return t && t !== "none";
    });
    if (themes.length) {
      bits.push(
        themes
          .map(function (id) {
            var t = DATA.themes.find(function (x) {
              return x.id === id;
            });
            return t ? t.name : id;
          })
          .join(", ")
      );
    }
    if ((trip.partyAges || []).some(function (a) {
      return a < 18;
    })) {
      bits.push("kids");
    }
    return (
      "Default list for this itinerary (" +
      bits.join(" · ") +
      "). Check items off as you pack, then add anything extra to your own list."
    );
  }

  function renderTripList() {
    var ul = $("mcTripList");
    if (!ul) return;
    if (!state.trips.length) {
      ul.innerHTML =
        PAGE === "active"
          ? '<li class="mc-empty">No saved cruises yet — <a href="/planning/my-cruise.html">set one up</a>.</li>'
          : '<li class="mc-empty">No saved cruises yet — fill the form and save.</li>';
      return;
    }
    ul.innerHTML = state.trips
      .map(function (t) {
        var label =
          (t.title ? escapeHtml(t.title) + " · " : "") +
          escapeHtml(shipName(t.shipSlug)) +
          (t.embarkDate ? " · " + escapeHtml(t.embarkDate) : "");
        var active = t.id === state.activeId ? " (active)" : "";
        return (
          "<li><span>" +
          label +
          active +
          '</span><span><button type="button" data-load="' +
          escapeHtml(t.id) +
          '">Open</button> · <button type="button" data-del="' +
          escapeHtml(t.id) +
          '">Delete</button></span></li>'
        );
      })
      .join("");
  }

  function renderCountdown(trip) {
    var root = $("mcCountdown");
    if (!root) return;
    if (!trip.embarkDate || !BW || !BW.compute) {
      root.innerHTML = '<p class="mc-empty">Add an embarkation date to see booking windows.</p>';
      return;
    }
    var sail = BW.parseDate(trip.embarkDate);
    if (!sail) {
      root.innerHTML = '<p class="mc-empty">Enter a valid embarkation date.</p>';
      return;
    }
    var result = BW.compute(sail, trip.castawayTier || "firstTime");
    var keys = [
      ["portAdventures", "Port Adventures / cabanas"],
      ["specialtyDining", "Specialty dining"],
      ["cabana", "Island cabanas"],
    ];
    root.innerHTML = keys
      .map(function (pair) {
        var info = result[pair[0]];
        var status =
          info.status === "open"
            ? "Window open"
            : info.status === "opens-today"
              ? "Opens today (midnight ET)"
              : info.status === "upcoming"
                ? "Opens in " + info.untilOpen + " day(s)"
                : "Sailing passed";
        return (
          '<div class="mc-count-card"><strong>' +
          escapeHtml(pair[1]) +
          "</strong><span>" +
          escapeHtml(BW.formatDate(info.opens)) +
          "</span><em>" +
          escapeHtml(status) +
          "</em></div>"
        );
      })
      .join("");
  }

  function renderSignup(trip) {
    var root = $("mcSignupList");
    if (!root) return;
    var items = signupListForTrip(trip);
    if (!items.length) {
      root.innerHTML = '<p class="mc-empty">No sign-ups matched this sailing yet.</p>';
      return;
    }
    root.innerHTML =
      '<ul class="mc-list">' +
      items
        .map(function (item, index) {
          var checked = trip.signupChecks && trip.signupChecks[item.id] ? " checked" : "";
          return (
            "<li>" +
            '<input type="checkbox" id="su_' +
            escapeHtml(item.id) +
            '" data-signup="' +
            escapeHtml(item.id) +
            '"' +
            checked +
            ">" +
            "<div><label for=\"su_" +
            escapeHtml(item.id) +
            '"><strong>' +
            escapeHtml(item.label) +
            "</strong></label>" +
            (item.note ? '<p class="meta">' + escapeHtml(item.note) + "</p>" : "") +
            '</div><div class="mc-prio-btns">' +
            '<span class="pri">#' +
            (index + 1) +
            "</span>" +
            '<button type="button" data-up="' +
            escapeHtml(item.id) +
            '">Up</button>' +
            '<button type="button" data-down="' +
            escapeHtml(item.id) +
            '">Down</button>' +
            "</div></li>"
          );
        })
        .join("") +
      "</ul>";
  }

  function renderPacking(trip) {
    var root = $("mcPackingList");
    var carry = $("mcCarryOnList");
    var customRoot = $("mcCustomPackingList");
    var basis = $("mcPackingBasis");
    var progress = $("mcPackProgress");
    if (!root || !carry || !customRoot) return;

    if (!trip.customPackingItems) trip.customPackingItems = [];
    if (!trip.packingChecks) trip.packingChecks = {};
    if (!trip.carryOnChecks) trip.carryOnChecks = {};

    if (basis) basis.textContent = packingBasisText(trip);

    var items = packingForTrip(trip);
    var custom = trip.customPackingItems || [];
    var carryIds = {};
    DATA.carryOnEssentials.forEach(function (id) {
      carryIds[id] = true;
    });
    items.forEach(function (item) {
      if (item.carryOn) carryIds[item.id] = true;
    });

    function listHtml(subset, checkMap, dataAttr, removable) {
      if (!subset.length) {
        return removable
          ? '<p class="mc-empty">Nothing added yet — type an item and click Add to my list.</p>'
          : '<p class="mc-empty">Save ports and destination to build your default list.</p>';
      }
      return (
        '<ul class="mc-list">' +
        subset
          .map(function (item) {
            var checked = checkMap && checkMap[item.id] ? " checked" : "";
            return (
              "<li><input type=\"checkbox\" id=\"" +
              dataAttr +
              "_" +
              escapeHtml(item.id) +
              '" data-' +
              dataAttr +
              '="' +
              escapeHtml(item.id) +
              '"' +
              checked +
              "><div><label for=\"" +
              dataAttr +
              "_" +
              escapeHtml(item.id) +
              '">' +
              escapeHtml(item.label) +
              "</label>" +
              (item.category
                ? '<p class="meta">' + escapeHtml(item.category) + "</p>"
                : "") +
              "</div>" +
              (removable
                ? '<button type="button" class="mc-remove" data-remove-pack="' +
                  escapeHtml(item.id) +
                  '">Remove</button>'
                : "<span></span>") +
              "</li>"
            );
          })
          .join("") +
        "</ul>"
      );
    }

    var byCat = {};
    items.forEach(function (item) {
      var cat = item.category || "essentials";
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(item);
    });
    var catOrder = Object.keys(byCat).sort();
    if (!items.length) {
      root.innerHTML =
        '<p class="mc-empty">Save your cruise details to generate a default packing list.</p>';
    } else {
      root.innerHTML = catOrder
        .map(function (cat) {
          return (
            '<h4 class="mc-pack-cat">' +
            escapeHtml(cat) +
            "</h4>" +
            listHtml(byCat[cat], trip.packingChecks, "pack", false)
          );
        })
        .join("");
    }

    customRoot.innerHTML = listHtml(
      custom.map(function (c) {
        return { id: c.id, label: c.label, category: "yours" };
      }),
      trip.packingChecks,
      "pack",
      true
    );

    carry.innerHTML = listHtml(
      items.filter(function (item) {
        return carryIds[item.id];
      }),
      trip.carryOnChecks,
      "carry",
      false
    );

    if (progress) {
      var allIds = items
        .map(function (i) {
          return i.id;
        })
        .concat(
          custom.map(function (c) {
            return c.id;
          })
        );
      var done = allIds.filter(function (id) {
        return trip.packingChecks && trip.packingChecks[id];
      }).length;
      if (allIds.length) {
        progress.hidden = false;
        progress.textContent = done + " of " + allIds.length + " packed";
      } else {
        progress.hidden = true;
      }
    }
  }

  function renderCharacters(trip) {
    var chars = DATA.charactersByShip[trip.shipSlug] || [];
    var shows = DATA.entertainmentByShip[trip.shipSlug] || [];
    $("mcCharacters").innerHTML =
      "<ul class=\"mc-bullets\">" +
      chars
        .map(function (c) {
          return "<li>" + escapeHtml(c) + "</li>";
        })
        .join("") +
      "</ul>";
    $("mcShows").innerHTML =
      "<ul class=\"mc-bullets\">" +
      shows
        .map(function (c) {
          return "<li>" + escapeHtml(c) + "</li>";
        })
        .join("") +
      "</ul>";
  }

  function renderIsland(trip) {
    var root = $("mcIsland");
    if (!root) return;
    var plans = [];
    if ((trip.ports || []).indexOf("castaway-cay") !== -1) plans.push(DATA.islandPlans.castaway);
    if ((trip.ports || []).indexOf("lookout-cay") !== -1) plans.push(DATA.islandPlans.lookout);
    if (!plans.length) {
      root.innerHTML =
        '<p class="mc-empty">Add Castaway Cay or Lookout Cay to see a no-cabana island plan.</p>';
      return;
    }
    root.innerHTML = plans
      .map(function (p) {
        return (
          "<div><h3 style=\"font-family:var(--font-serif);font-weight:500;color:var(--navy);margin:0 0 8px;\">" +
          escapeHtml(p.title) +
          '</h3><ul class="mc-bullets">' +
          p.tips
            .map(function (t) {
              return "<li>" + escapeHtml(t) + "</li>";
            })
            .join("") +
          "</ul></div>"
        );
      })
      .join("");
  }

  function renderStateroom(trip) {
    var root = $("mcStateroom");
    if (!root) return;
    var list = trip.cabinCandidates || [];
    var intelLink = "/ships/" + encodeURIComponent(trip.shipSlug) + ".html";
    root.innerHTML =
      '<p class="mc-sub" style="margin-top:0;">Compare candidates against <a href="' +
      intelLink +
      '" style="color:var(--teal);text-decoration:underline;">ship stateroom intel</a> (noise, elevators, connections).</p>' +
      (list.length
        ? '<ul class="mc-bullets">' +
          list
            .map(function (c) {
              return "<li>" + escapeHtml(c) + "</li>";
            })
            .join("") +
          "</ul>"
        : '<p class="mc-empty">Add cabin numbers or categories in the trip form (e.g. “8020”, “verandah midship”).</p>');
  }

  function renderAgent(trip) {
    var root = $("mcAgent");
    if (!root) return;
    var summary =
      shipName(trip.shipSlug) +
      (trip.embarkDate ? " sailing " + trip.embarkDate : "") +
      " · " +
      (trip.nights || "?") +
      " nights · tier " +
      (trip.castawayTier || "firstTime") +
      " · ports: " +
      ((trip.ports || []).map(portName).join(", ") || "TBD");
    root.innerHTML =
      "<p>Share this planner snapshot with a Disney-specialist agent — booking through an agent usually costs you nothing extra.</p>" +
      '<p class="meta" style="color:var(--muted);font-size:0.9rem;">' +
      escapeHtml(summary) +
      "</p>" +
      '<div class="mc-actions"><a class="btn btn-gold" href="/agents/">Browse agents</a>' +
      '<button type="button" class="btn btn-outline" id="mcCopySummary">Copy trip summary</button></div>';
    var btn = $("mcCopySummary");
    if (btn) {
      btn.onclick = function () {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(summary).then(function () {
            toast("Trip summary copied.");
          });
        } else {
          toast(summary);
        }
      };
    }
  }

  function renderCommunity(trip) {
    var root = $("mcCommunity");
    if (!root) return;
    if (!trip.embarkDate) {
      root.innerHTML = '<p class="mc-empty">Add an embarkation date to jump into that sailing’s community board.</p>';
      return;
    }
    var key = trip.shipSlug + "_" + trip.embarkDate;
    root.innerHTML =
      "<p>Talk fish extenders, meetups, and day-of tips with guests on this exact sailing.</p>" +
      '<div class="mc-actions"><a class="btn btn-gold" href="/community/sailing.html?key=' +
      encodeURIComponent(key) +
      '">Open sailing community</a>' +
      '<a class="btn btn-outline" href="/community/">All boards</a></div>';
  }

  function excursionMatches(trip, exc, filters) {
    if ((trip.ports || []).length && (trip.ports || []).indexOf(exc.port) === -1 && filters.port === "trip") {
      return false;
    }
    if (filters.port !== "all" && filters.port !== "trip" && exc.port !== filters.port) return false;
    if (filters.category !== "all" && (exc.categories || []).indexOf(filters.category) === -1) return false;
    if (filters.energy !== "all" && exc.energy !== filters.energy) return false;
    var kidMax = maxKidAge(trip);
    if (filters.ageFit === "kids" && kidMax !== null && typeof exc.ageMin === "number" && kidMax < exc.ageMin) {
      return false;
    }
    if (filters.q) {
      var hay = (exc.name + " " + exc.summary).toLowerCase();
      if (hay.indexOf(filters.q) === -1) return false;
    }
    return true;
  }

  async function loadReviews(targetId) {
    if (state.reviewCache[targetId]) return state.reviewCache[targetId];
    try {
      var data = await Community.api(
        "/planner/reviews?type=excursion&id=" + encodeURIComponent(targetId)
      );
      state.reviewCache[targetId] = data;
      return data;
    } catch (e) {
      return { reviews: [], average: null, count: 0 };
    }
  }

  async function renderExcursions(trip) {
    var root = $("mcExcursions");
    if (!root) return;
    var filters = {
      port: ($("mcExcPort") && $("mcExcPort").value) || "trip",
      category: ($("mcExcCat") && $("mcExcCat").value) || "all",
      energy: ($("mcExcEnergy") && $("mcExcEnergy").value) || "all",
      ageFit: ($("mcExcAge") && $("mcExcAge").value) || "kids",
      q: (($("mcExcQ") && $("mcExcQ").value) || "").trim().toLowerCase(),
    };
    var list = DATA.excursions.filter(function (exc) {
      return excursionMatches(trip, exc, filters);
    });
    if (!list.length) {
      root.innerHTML =
        '<p class="mc-empty">No excursions match these filters. Add ports to your trip or widen filters.</p>';
      return;
    }

    root.innerHTML = list
      .map(function (exc) {
        var saved = (trip.excursionShortlist || []).indexOf(exc.id) !== -1;
        return (
          '<article class="mc-exc" data-exc="' +
          escapeHtml(exc.id) +
          '"><h3>' +
          escapeHtml(exc.name) +
          "</h3><p>" +
          escapeHtml(exc.summary) +
          '</p><div class="tags">' +
          '<span class="tag">' +
          escapeHtml(portName(exc.port)) +
          "</span>" +
          '<span class="tag">' +
          escapeHtml(exc.ages) +
          "</span>" +
          '<span class="tag">' +
          escapeHtml(exc.price) +
          "</span>" +
          (exc.categories || [])
            .map(function (c) {
              return '<span class="tag">' + escapeHtml(c) + "</span>";
            })
            .join("") +
          '</div><div class="mc-exc-actions">' +
          '<button type="button" class="btn ' +
          (saved ? "btn-outline" : "btn-gold") +
          '" data-shortlist="' +
          escapeHtml(exc.id) +
          '">' +
          (saved ? "Remove from shortlist" : "Shortlist") +
          "</button>" +
          '<button type="button" class="btn btn-outline" data-reviews="' +
          escapeHtml(exc.id) +
          '">Reviews</button>' +
          "</div><div class=\"mc-review-box\" id=\"rev_" +
          escapeHtml(exc.id) +
          '" hidden></div></article>'
        );
      })
      .join("");
  }

  async function openReviews(excId) {
    var box = document.getElementById("rev_" + excId);
    if (!box) return;
    box.hidden = false;
    box.innerHTML = "<p class=\"mc-empty\">Loading reviews…</p>";
    var data = await loadReviews(excId);
    var trip = activeTrip();
    var reviewsHtml =
      data.count === 0
        ? '<p class="mc-empty">No reviews yet — be the first.</p>'
        : data.reviews
            .map(function (r) {
              return (
                '<div class="mc-review"><div class="mc-stars">' +
                "★".repeat(r.rating) +
                "☆".repeat(5 - r.rating) +
                "</div><strong>" +
                escapeHtml(r.title || "Review") +
                "</strong> · " +
                escapeHtml(r.displayName) +
                "<p>" +
                escapeHtml(r.body) +
                "</p>" +
                (r.agesNote ? '<p class="meta">Ages: ' + escapeHtml(r.agesNote) + "</p>" : "") +
                "</div>"
              );
            })
            .join("");
    box.innerHTML =
      reviewsHtml +
      '<form class="mc-suggest" data-review-form="' +
      escapeHtml(excId) +
      '">' +
      "<h4 style=\"margin:0 0 8px;font-family:var(--font-serif);color:var(--navy);\">Add a review</h4>" +
      '<div class="mc-field"><label>Rating</label><select name="rating"><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></div>' +
      '<div class="mc-field"><label>Title</label><input name="title" maxlength="80" placeholder="Worth it for toddlers?"></div>' +
      '<div class="mc-field"><label>Your review</label><textarea name="body" required minlength="20" placeholder="What ages thrived, what you’d skip, timing tips…"></textarea></div>' +
      '<div class="mc-field"><label>Ages on your sailing (optional)</label><input name="agesNote" maxlength="120" placeholder="e.g. 3, 7, adults"></div>' +
      '<button type="submit" class="btn btn-gold">Submit review</button>' +
          '<p class="meta" style="margin-top:8px;">Requires a free Cruising Cove account. Reviews are moderated before they appear.</p></form>';
  }

  async function renderPortReviews(trip) {
    var root = $("mcPortReviews");
    if (!root) return;
    var ports = (trip.ports || []).filter(function (id) {
      return id && id !== "other";
    });
    if (!ports.length) {
      root.innerHTML = '<p class="mc-empty">Add ports to your cruise to see and write port reviews.</p>';
      return;
    }

    root.innerHTML = ports
      .map(function (portId) {
        return (
          '<article class="mc-exc" data-port="' +
          escapeHtml(portId) +
          '"><h3>' +
          escapeHtml(portName(portId)) +
          '</h3><div class="mc-review-box" id="portrev_' +
          escapeHtml(portId) +
          '"><p class="mc-empty">Loading…</p></div>' +
          '<form class="mc-suggest" data-port-review="' +
          escapeHtml(portId) +
          '">' +
          '<h4 style="margin:0 0 8px;font-family:var(--font-serif);color:var(--navy);">Add a port review</h4>' +
          '<div class="mc-field"><label>Rating</label><select name="rating"><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select></div>' +
          '<div class="mc-field"><label>Title</label><input name="title" maxlength="80" placeholder="Easy DIY day"></div>' +
          '<div class="mc-field"><label>Your review</label><textarea name="body" required minlength="20" placeholder="What worked for your ages, timing tips, what you’d skip…"></textarea></div>' +
          '<div class="mc-field"><label>Ages on your sailing (optional)</label><input name="agesNote" maxlength="120"></div>' +
          '<button type="submit" class="btn btn-gold">Submit for review</button>' +
          '<p class="meta" style="margin-top:8px;">Moderated before it goes live.</p></form></article>'
        );
      })
      .join("");

    for (var i = 0; i < ports.length; i++) {
      await fillPortReviews(ports[i]);
    }
  }

  async function fillPortReviews(portId) {
    var box = document.getElementById("portrev_" + portId);
    if (!box) return;
    try {
      var data = await Community.api("/planner/reviews?type=port&id=" + encodeURIComponent(portId));
      if (!data.count) {
        box.innerHTML = '<p class="mc-empty">No approved reviews yet.</p>';
        return;
      }
      box.innerHTML = data.reviews
        .map(function (r) {
          return (
            '<div class="mc-review"><div class="mc-stars">' +
            "★".repeat(r.rating) +
            "☆".repeat(5 - r.rating) +
            "</div><strong>" +
            escapeHtml(r.title || "Review") +
            "</strong> · " +
            escapeHtml(r.displayName) +
            "<p>" +
            escapeHtml(r.body) +
            "</p></div>"
          );
        })
        .join("");
    } catch (e) {
      box.innerHTML = '<p class="mc-empty">Could not load reviews.</p>';
    }
  }

  function renderBanner(trip) {
    var el = $("mcBannerTitle");
    if (!el) return;
    el.textContent =
      (trip.title ? trip.title + " — " : "") +
      shipName(trip.shipSlug) +
      (trip.embarkDate ? " · " + trip.embarkDate : "");
    $("mcBannerMeta").textContent =
      (trip.nights || "?") +
      " nights · " +
      ((trip.ports || []).map(portName).join(", ") || "Ports TBD") +
      " · " +
      (DATA.tiers.find(function (t) {
        return t.id === trip.castawayTier;
      }) || { label: trip.castawayTier }).label;
  }

  function renderSetupCta(trip) {
    var empty = $("mcEmptyDash");
    var cta = $("mcSetupCta");
    var summary = $("mcSetupSummary");
    if (!cta && !empty) return;
    var ready = !!(trip && trip.embarkDate);
    if (empty) empty.hidden = ready;
    if (cta) cta.hidden = !ready;
    if (summary && ready) {
      summary.textContent =
        (trip.title ? trip.title + " — " : "") +
        shipName(trip.shipSlug) +
        " · " +
        trip.embarkDate +
        " · " +
        (trip.nights || "?") +
        " nights · " +
        ((trip.ports || []).map(portName).join(", ") || "Ports TBD");
    }
  }

  function renderAll() {
    var trip = activeTrip();
    var dash = $("mcDashboard");
    var empty = $("mcEmptyDash");
    renderTripList();
    fillForm(trip);
    if (PAGE === "setup" || !dash) {
      renderSetupCta(trip);
      return;
    }
    if (!trip || !trip.embarkDate) {
      dash.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }
    dash.hidden = false;
    if (empty) empty.hidden = true;
    renderBanner(trip);
    renderCountdown(trip);
    renderSignup(trip);
    renderPacking(trip);
    renderCharacters(trip);
    renderIsland(trip);
    renderStateroom(trip);
    renderAgent(trip);
    renderCommunity(trip);
    renderExcursions(trip);
    renderPortReviews(trip);
    var cost = $("mcCostLink");
    if (cost) cost.href = "/planning/disney-cruise-cost.html";
  }

  function movePriority(id, dir) {
    var trip = activeTrip();
    if (!trip) return;
    var items = signupListForTrip(trip).map(function (i) {
      return i.id;
    });
    var idx = items.indexOf(id);
    if (idx < 0) return;
    var swap = idx + dir;
    if (swap < 0 || swap >= items.length) return;
    var tmp = items[idx];
    items[idx] = items[swap];
    items[swap] = tmp;
    trip.signupPriority = items;
    trip.updatedAt = new Date().toISOString();
    saveLocal();
    pushTrip(trip);
    renderSignup(trip);
  }

  function bind() {
    var saveBtn = $("mcSave");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        var trip = activeTrip() || emptyTrip();
        readFormIntoTrip(trip);
        if (!trip.embarkDate) {
          toast("Add an embarkation date first.");
          return;
        }
        var idx = state.trips.findIndex(function (t) {
          return t.id === trip.id;
        });
        if (idx >= 0) state.trips[idx] = trip;
        else state.trips.unshift(trip);
        state.activeId = trip.id;
        saveLocal();
        pushTrip(trip);
        renderAll();
        toast(
          Community && Community.getToken()
            ? "Cruise saved — open Active sailing next."
            : "Cruise saved — open Active sailing next."
        );
      });
    }

    var newBtn = $("mcNew");
    if (newBtn) {
      newBtn.addEventListener("click", function () {
        var trip = emptyTrip();
        state.trips.unshift(trip);
        state.activeId = trip.id;
        saveLocal();
        fillForm(trip);
        renderAll();
        toast("New cruise draft ready.");
      });
    }

    var printBtn = $("mcPrint");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        document.body.classList.add("mc-printing");
        window.print();
        setTimeout(function () {
          document.body.classList.remove("mc-printing");
        }, 500);
      });
    }

    var shareBtn = $("mcShare");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        shareTrip();
      });
    }

    var catalog = $("mcCatalog");
    if (catalog) {
      catalog.addEventListener("change", function () {
        applyCatalog(catalog.value);
      });
    }

    var shipEl = $("mcShip");
    var embarkEl = $("mcEmbark");
    function onShipOrDateChange() {
      applyDatedSailing({ silent: false });
    }
    if (shipEl) shipEl.addEventListener("change", onShipOrDateChange);
    if (embarkEl) {
      embarkEl.addEventListener("change", onShipOrDateChange);
      embarkEl.addEventListener("input", function () {
        if (embarkEl.value && embarkEl.value.length === 10) onShipOrDateChange();
        else updateSailingMatchHint(null);
      });
    }

    var tripList = $("mcTripList");
    if (tripList) {
      tripList.addEventListener("click", function (e) {
        var load = e.target.getAttribute && e.target.getAttribute("data-load");
        var del = e.target.getAttribute && e.target.getAttribute("data-del");
        if (load) {
          state.activeId = load;
          saveLocal();
          renderAll();
        }
        if (del) {
          state.trips = state.trips.filter(function (t) {
            return t.id !== del;
          });
          if (state.activeId === del) state.activeId = state.trips[0] ? state.trips[0].id : null;
          saveLocal();
          if (Community && Community.getToken()) {
            Community.api("/planner/trips/" + encodeURIComponent(del), { method: "DELETE" }).catch(function () {});
          }
          renderAll();
        }
      });
    }

    var dash = $("mcDashboard");
    if (!dash) return;

    dash.addEventListener("change", function (e) {
      var trip = activeTrip();
      if (!trip) return;
      var t = e.target;
      if (t.getAttribute("data-signup")) {
        trip.signupChecks[t.getAttribute("data-signup")] = !!t.checked;
      } else if (t.getAttribute("data-pack")) {
        trip.packingChecks[t.getAttribute("data-pack")] = !!t.checked;
      } else if (t.getAttribute("data-carry")) {
        trip.carryOnChecks[t.getAttribute("data-carry")] = !!t.checked;
      } else {
        return;
      }
      trip.updatedAt = new Date().toISOString();
      saveLocal();
      pushTrip(trip);
      if (t.getAttribute("data-pack") || t.getAttribute("data-carry")) {
        renderPacking(trip);
      }
    });

    dash.addEventListener("click", function (e) {
      var up = e.target.getAttribute && e.target.getAttribute("data-up");
      var down = e.target.getAttribute && e.target.getAttribute("data-down");
      var shortlist = e.target.getAttribute && e.target.getAttribute("data-shortlist");
      var reviews = e.target.getAttribute && e.target.getAttribute("data-reviews");
      var removePack = e.target.getAttribute && e.target.getAttribute("data-remove-pack");
      if (up) movePriority(up, -1);
      if (down) movePriority(down, 1);
      if (removePack) {
        var tripRm = activeTrip();
        if (!tripRm) return;
        tripRm.customPackingItems = (tripRm.customPackingItems || []).filter(function (c) {
          return c.id !== removePack;
        });
        if (tripRm.packingChecks) delete tripRm.packingChecks[removePack];
        tripRm.updatedAt = new Date().toISOString();
        saveLocal();
        pushTrip(tripRm);
        renderPacking(tripRm);
        toast("Removed from your list.");
      }
      if (shortlist) {
        var trip = activeTrip();
        if (!trip) return;
        var list = trip.excursionShortlist || [];
        var i = list.indexOf(shortlist);
        if (i >= 0) list.splice(i, 1);
        else list.push(shortlist);
        trip.excursionShortlist = list;
        trip.updatedAt = new Date().toISOString();
        saveLocal();
        pushTrip(trip);
        renderExcursions(trip);
      }
      if (reviews) openReviews(reviews);
    });

    ["mcExcPort", "mcExcCat", "mcExcEnergy", "mcExcAge", "mcExcQ"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("input", function () {
        var trip = activeTrip();
        if (trip) renderExcursions(trip);
      });
      el.addEventListener("change", function () {
        var trip = activeTrip();
        if (trip) renderExcursions(trip);
      });
    });

    dash.addEventListener("submit", function (e) {
      var portForm = e.target.closest("[data-port-review]");
      if (portForm) {
        e.preventDefault();
        submitPortReview(portForm);
        return;
      }
      var form = e.target.closest("[data-review-form]");
      if (form) {
        e.preventDefault();
        submitReview(form);
        return;
      }
      if (e.target.id === "mcAddPackForm") {
        e.preventDefault();
        addCustomPackingItem(e.target);
        return;
      }
      if (e.target.id === "mcRemindForm") {
        e.preventDefault();
        submitReminder(e.target);
        return;
      }
      if (e.target.id === "mcSuggestForm") {
        e.preventDefault();
        submitSuggestion(e.target);
      }
    });
  }

  async function shareTrip() {
    var trip = activeTrip();
    if (!trip || !trip.embarkDate) {
      toast("Save a cruise with an embarkation date first.");
      return;
    }
    try {
      var data = await Community.api("/planner/shares", { method: "POST", body: { trip: trip } });
      var url = location.origin + (data.urlPath || "/planning/active-sailing.html?share=" + data.token);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast("Share link copied.");
      } else {
        toast(url);
      }
    } catch (err) {
      toast(err.message || "Could not create share link.");
    }
  }

  async function submitReminder(form) {
    var trip = activeTrip();
    if (!trip || !trip.embarkDate) {
      toast("Save a cruise with an embarkation date first.");
      return;
    }
    var email = (form.email && form.email.value) || ($("mcRemindEmail") && $("mcRemindEmail").value) || "";
    try {
      var data = await Community.api("/planner/reminders", {
        method: "POST",
        body: {
          email: email,
          shipSlug: trip.shipSlug,
          embarkDate: trip.embarkDate,
          castawayTier: trip.castawayTier,
          title: trip.title || "",
        },
      });
      toast(data.message || "Reminder saved.");
      form.reset();
    } catch (err) {
      toast(err.message || "Could not save reminder.");
    }
  }

  function applyCatalog(id) {
    if (!CATALOG || !CATALOG.templates) return;
    var t = CATALOG.templates.find(function (x) {
      return x.id === id;
    });
    if (!t || t.id === "custom") return;
    var trip = activeTrip();
    if (!trip) {
      trip = emptyTrip();
      state.trips.unshift(trip);
      state.activeId = trip.id;
    }
    if (t.shipSlug) trip.shipSlug = t.shipSlug;
    trip.nights = t.nights || trip.nights;
    trip.destinationRegion = t.destinationRegion || trip.destinationRegion;
    trip.ports = (t.ports || []).slice();
    trip.updatedAt = new Date().toISOString();
    fillForm(trip);
    saveLocal();
    var note = $("mcCatalogNote");
    if (note) note.textContent = t.note || "Confirm ports in the official app.";
    updateSailingMatchHint(null);
    toast("Template applied — add your embarkation date to match a dated sailing, then save.");
  }

  function regionFromPorts(portIds) {
    var counts = {};
    (portIds || []).forEach(function (id) {
      var p = DATA.ports.find(function (x) {
        return x.id === id;
      });
      if (!p || !p.region || p.region === "other") return;
      counts[p.region] = (counts[p.region] || 0) + 1;
    });
    var best = "";
    var bestN = 0;
    Object.keys(counts).forEach(function (r) {
      if (counts[r] > bestN) {
        best = r;
        bestN = counts[r];
      }
    });
    return best || "";
  }

  function updateSailingMatchHint(sailing) {
    var hint = $("mcSailingMatch");
    if (!hint) return;
    if (sailing) {
      var themeBit = sailing.theme ? " · " + sailing.theme : " · standard sailing";
      hint.textContent =
        "Matched catalog sailing: " +
        sailing.nights +
        " nights" +
        themeBit +
        (sailing.departurePort ? " from " + sailing.departurePort : "") +
        ". Confirm in the official app.";
      return;
    }
    var ship = $("mcShip") && $("mcShip").value;
    var date = $("mcEmbark") && $("mcEmbark").value;
    if (ship && date) {
      hint.textContent =
        "No exact match for that ship + date yet — fill nights/ports manually or pick a template below. We’re expanding dated sailings over time.";
      return;
    }
    hint.textContent = "Enter ship + date to autofill nights, ports, region, and theme.";
  }

  function applyDatedSailing(opts) {
    opts = opts || {};
    if (!DATED || !DATED.lookup) {
      updateSailingMatchHint(null);
      return false;
    }
    var shipEl = $("mcShip");
    var dateEl = $("mcEmbark");
    if (!shipEl || !dateEl) return false;
    var sailing = DATED.lookup(shipEl.value, dateEl.value);
    updateSailingMatchHint(sailing);
    if (!sailing) return false;

    var trip = activeTrip();
    if (!trip) {
      trip = emptyTrip();
      state.trips.unshift(trip);
      state.activeId = trip.id;
    }
    trip.shipSlug = sailing.shipSlug;
    trip.embarkDate = sailing.embarkationDate;
    trip.nights = sailing.nights || trip.nights;
    trip.ports = (sailing.ports || []).slice();
    trip.destinationRegion =
      sailing.destinationRegion || regionFromPorts(trip.ports) || trip.destinationRegion;
    var themeId =
      (DATED.themeIdFromLabel && DATED.themeIdFromLabel(sailing.theme)) || "none";
    trip.themes = [themeId];
    trip.updatedAt = new Date().toISOString();
    fillForm(trip);
    saveLocal();
    if (!opts.silent) {
      toast("Filled nights, ports, region, and theme from our sailing catalog.");
    }
    return true;
  }

  function addCustomPackingItem(form) {
    var trip = activeTrip();
    if (!trip) {
      toast("Save a cruise first.");
      return;
    }
    var input = form.querySelector('[name="label"]') || $("mcAddPackItem");
    var label = ((input && input.value) || "").trim().slice(0, 120);
    if (label.length < 2) {
      toast("Enter an item to add.");
      return;
    }
    if (!trip.customPackingItems) trip.customPackingItems = [];
    var exists = trip.customPackingItems.some(function (c) {
      return c.label.toLowerCase() === label.toLowerCase();
    });
    if (exists) {
      toast("That’s already on your list.");
      return;
    }
    trip.customPackingItems.push({ id: "custom_" + uid(), label: label });
    trip.updatedAt = new Date().toISOString();
    if (input) input.value = "";
    saveLocal();
    pushTrip(trip);
    renderPacking(trip);
    toast("Added to your packing list.");
  }

  async function submitReview(form) {
    if (!Community || !Community.getToken()) {
      location.href =
        "/community/login.html?next=" + encodeURIComponent(location.pathname + location.search);
      return;
    }
    var trip = activeTrip() || {};
    var excId = form.getAttribute("data-review-form");
    var fd = new FormData(form);
    try {
      await Community.api("/planner/reviews", {
        method: "POST",
        body: {
          targetType: "excursion",
          targetId: excId,
          rating: Number(fd.get("rating")),
          title: fd.get("title"),
          body: fd.get("body"),
          agesNote: fd.get("agesNote"),
          shipSlug: trip.shipSlug || "",
          embarkDate: trip.embarkDate || "",
        },
      });
      delete state.reviewCache[excId];
      toast(data.message || "Review submitted for moderation.");
      openReviews(excId);
    } catch (err) {
      toast(err.message || "Could not save review.");
    }
  }

  async function submitPortReview(form) {
    if (!Community || !Community.getToken()) {
      location.href =
        "/community/login.html?next=" + encodeURIComponent(location.pathname + location.search);
      return;
    }
    var trip = activeTrip() || {};
    var portId = form.getAttribute("data-port-review");
    var fd = new FormData(form);
    try {
      var data = await Community.api("/planner/reviews", {
        method: "POST",
        body: {
          targetType: "port",
          targetId: portId,
          rating: Number(fd.get("rating")),
          title: fd.get("title"),
          body: fd.get("body"),
          agesNote: fd.get("agesNote"),
          shipSlug: trip.shipSlug || "",
          embarkDate: trip.embarkDate || "",
        },
      });
      toast(data.message || "Review submitted for moderation.");
      form.reset();
    } catch (err) {
      toast(err.message || "Could not save review.");
    }
  }

  async function submitSuggestion(form) {
    if (!Community || !Community.getToken()) {
      location.href =
        "/community/login.html?next=" + encodeURIComponent(location.pathname + location.search);
      return;
    }
    var fd = new FormData(form);
    try {
      await Community.api("/planner/packing-suggestions", {
        method: "POST",
        body: {
          item: fd.get("item"),
          reason: fd.get("reason"),
          tags: String(fd.get("tags") || "")
            .split(/[,\s]+/)
            .filter(Boolean),
        },
      });
      form.reset();
      toast("Suggestion submitted for review.");
    } catch (err) {
      toast(err.message || "Could not submit suggestion.");
    }
  }

  function populateStaticFilters() {
    var ship = $("mcShip");
    if (ship) {
      ship.innerHTML = DATA.ships
        .map(function (s) {
          return '<option value="' + s.slug + '">' + escapeHtml(s.name) + "</option>";
        })
        .join("");
    }
    var tier = $("mcTier");
    if (tier) {
      tier.innerHTML = DATA.tiers
        .map(function (t) {
          return '<option value="' + t.id + '">' + escapeHtml(t.label) + "</option>";
        })
        .join("");
    }
    var catalog = $("mcCatalog");
    if (catalog && CATALOG && CATALOG.templates) {
      catalog.innerHTML = CATALOG.templates
        .map(function (t) {
          return '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.label) + "</option>";
        })
        .join("");
    }
    var ports = $("mcPorts");
    if (ports) {
      ports.innerHTML = DATA.ports
        .map(function (p) {
          return '<option value="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + "</option>";
        })
        .join("");
    }
    var themes = $("mcThemes");
    if (themes) {
      themes.innerHTML = DATA.themes
        .map(function (t) {
          return '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.name) + "</option>";
        })
        .join("");
    }
    var portFilter = $("mcExcPort");
    if (portFilter) {
      portFilter.innerHTML =
        '<option value="trip">Ports on my cruise</option><option value="all">All ports</option>' +
        DATA.ports
          .filter(function (p) {
            return p.id !== "other";
          })
          .map(function (p) {
            return '<option value="' + p.id + '">' + escapeHtml(p.name) + "</option>";
          })
          .join("");
    }
    var cat = $("mcExcCat");
    if (cat) {
      cat.innerHTML =
        '<option value="all">All categories</option>' +
        DATA.excursionCategories
          .map(function (c) {
            return '<option value="' + c.id + '">' + escapeHtml(c.label) + "</option>";
          })
          .join("");
    }
  }

  function renderAuth() {
    var el = $("mcAuth");
    if (!el || !Community) return;
    var user = Community.getUser && Community.getUser();
    var next = encodeURIComponent(location.pathname + location.search);
    if (user && Community.getToken()) {
      el.innerHTML =
        '<p class="who">Signed in as <strong>' +
        escapeHtml(user.displayName) +
        "</strong> — trips sync to your account.</p>" +
        '<button type="button" class="btn btn-outline-light" id="mcLogout">Sign out</button>';
      $("mcLogout").onclick = function () {
        Community.clearSession();
        renderAuth();
        toast("Signed out. Trips stay on this device.");
      };
    } else {
      el.innerHTML =
        '<p class="who">Works on this device without an account. <a href="/community/login.html?next=' +
        next +
        '">Sign in</a> to sync, review, and suggest packing items.</p>';
    }
  }

  async function loadCommunityPacking() {
    if (!Community) return;
    try {
      var data = await Community.api("/planner/packing-items");
      state.communityPacking = data.items || [];
    } catch (e) {
      state.communityPacking = [];
    }
  }

  async function loadSharedTrip() {
    var params = new URLSearchParams(location.search);
    var token = params.get("share");
    if (!token || !Community) return;
    try {
      var data = await Community.api("/planner/shares/" + encodeURIComponent(token));
      var trip = Object.assign(emptyTrip(), data.trip || {});
      trip.id = trip.id || "share_" + token;
      var idx = state.trips.findIndex(function (t) {
        return t.id === trip.id;
      });
      if (idx >= 0) state.trips[idx] = trip;
      else state.trips.unshift(trip);
      state.activeId = trip.id;
      saveLocal();
      toast("Opened shared cruise plan.");
    } catch (e) {
      toast("Could not open that share link.");
    }
  }

  function loadTemplateFromQuery() {
    var params = new URLSearchParams(location.search);
    var templateId = params.get("template");
    if (!templateId) return;
    applyCatalog(templateId);
    var catalog = $("mcCatalog");
    if (catalog) catalog.value = templateId;
  }

  async function init() {
    if (!DATA) return;
    populateStaticFilters();
    loadLocal();
    bind();
    renderAuth();
    await loadSharedTrip();
    await syncFromServer();
    await loadCommunityPacking();
    renderAll();
    loadTemplateFromQuery();
    if ($("mcShip") && $("mcEmbark") && $("mcEmbark").value) {
      applyDatedSailing({ silent: true });
    } else {
      updateSailingMatchHint(null);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
