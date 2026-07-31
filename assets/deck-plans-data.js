/**
 * Curated public-venue deck maps for Cruising Cove ship guides.
 * Not official Disney floor plans — planning locator only.
 */
(function (global) {
  function V(name, cat, zone, tip) {
    return { name: name, cat: cat, zone: zone, tip: tip || "" };
  }

  var wishShared = {
    classLabel: "Wish class · 15 decks",
    officialSlug: "wish",
    decks: {
      "2": {
        blurb: "Kids clubs hub — Oceaneer spaces and nursery.",
        venues: [
          V("Disney's Oceaneer Club", "kids", "mid", "Ages ~3–12 · multi-room playground; register on embarkation day"),
          V("Walt Disney Imagineering Lab", "kids", "mid", "Hands-on Oceaneer wing — popular during open house"),
          V("It's a Small World Nursery", "kids", "mid", "Extra fee · reserve early for specialty-dinner coverage"),
        ],
      },
      "3": {
        blurb: "Grand Hall atrium, theatre, and adult lounges.",
        venues: [
          V("Grand Hall", "service", "mid", "Main atrium — embarkation, character meets, photo ops"),
          V("Walt Disney Theatre", "entertainment", "fwd", "Broadway-style shows · arrive 15–20 min early"),
          V("1923", "dining", "mid", "Rotational dinner · Walt & Roy sides of the same restaurant"),
          V("Nightingale's", "adults", "mid", "Elegant cocktail lounge"),
          V("The Bayou", "adults", "mid", "Live-music lounge (Princess and the Frog)"),
          V("Star Wars: Hyperspace Lounge", "adults", "mid", "Immersive Star Wars bar · evenings often 18+"),
          V("Oceaneer Club slide entrance", "kids", "mid", "Slide down to Deck 2 clubs — after check-in"),
        ],
      },
      "4": {
        blurb: "Guest services, cinemas, and Worlds of Marvel.",
        venues: [
          V("Guest Services", "service", "mid", "Purser desk · Port Adventures nearby"),
          V("Worlds of Marvel", "dining", "aft", "Rotational interactive Marvel dinner show"),
          V("Wonderland Cinema", "entertainment", "fwd", "Feature films throughout the sailing"),
          V("Never Land Cinema", "entertainment", "fwd", "Second cinema · staggered showtimes"),
          V("Preludes", "dining", "fwd", "Theatre snacks & drinks before shows"),
        ],
      },
      "5": {
        blurb: "Arendelle dining, spa approaches, Edge, and pubs.",
        venues: [
          V("Arendelle: A Frozen Dining Adventure", "dining", "aft", "Rotational Frozen show dinner — protect this night"),
          V("Senses Spa & Fitness", "spa", "fwd", "Treatments, salon, and gym · book early"),
          V("Edge", "kids", "mid", "Tween club · ages ~11–14"),
          V("Keg & Compass", "dining", "fwd", "Pub fare · extra charge"),
          V("Triton Lounge", "adults", "fwd", "Quiet lounge near spa / forward elevators"),
        ],
      },
      "11": {
        blurb: "Family pool deck and Marceline Market buffet.",
        venues: [
          V("Marceline Market", "dining", "aft", "Buffet breakfast & lunch"),
          V("Mickey & Friends Festival of Foods", "dining", "mid", "Pool-deck quick-service stalls"),
          V("Mickey's / Minnie's / Daisy's / Pluto's pools", "pool", "mid", "Main family splash & swim zone"),
          V("Inside Out: Emotional Whirlwind", "entertainment", "mid", "Spinning outdoor attraction"),
        ],
      },
      "12": {
        blurb: "Adult specialty dining, more pools, teens, AquaMouse entry.",
        venues: [
          V("Palo Steakhouse", "dining", "aft", "Adult specialty · cover charge · enter via The Rose"),
          V("Enchanté", "dining", "aft", "French fine dining · cover charge"),
          V("The Rose", "adults", "aft", "Bar gateway to Palo & Enchanté"),
          V("Goofy's / Donald's pools & Hero Zone", "pool", "mid", "More outdoor swim + active play"),
          V("Toy Story Splash Zone", "pool", "fwd", "Little-kid splash area"),
          V("Vibe", "kids", "aft", "Teen lounge · ages ~14–17"),
          V("The Hideaway", "kids", "aft", "Older teens / young adults evenings"),
          V("AquaMouse (boarding)", "entertainment", "mid", "Enclosed water coaster attraction"),
          V("Concierge Lounge", "service", "fwd", "Concierge guests only"),
        ],
      },
      "13": {
        blurb: "Adult Quiet Cove and AquaMouse track views.",
        venues: [
          V("Quiet Cove Pool", "pool", "aft", "Adults 18+ pool & whirlpools"),
          V("Cove Café / Cove Bar", "adults", "aft", "Adult coffee & cocktails by Quiet Cove"),
          V("AquaMouse (upper track)", "entertainment", "mid", "Ride path wraps upper decks"),
          V("Concierge Sun Deck", "pool", "aft", "Concierge outdoor retreat"),
        ],
      },
      "14": {
        blurb: "Highest outdoor splash pocket.",
        venues: [V("Chip 'n' Dale's Pool", "pool", "mid", "Small upper-deck family pool")],
      },
    },
  };

  function cloneWish(overrides) {
    var base = JSON.parse(JSON.stringify(wishShared));
    if (overrides.name) base.name = overrides.name;
    if (overrides.officialSlug) base.officialSlug = overrides.officialSlug;
    if (overrides.note) base.note = overrides.note;
    if (overrides.replace) {
      Object.keys(overrides.replace).forEach(function (deck) {
        var map = overrides.replace[deck];
        (base.decks[deck].venues || []).forEach(function (v) {
          if (map[v.name]) {
            var next = map[v.name];
            if (typeof next === "string") v.name = next;
            else {
              if (next.name) v.name = next.name;
              if (next.tip) v.tip = next.tip;
              if (next.cat) v.cat = next.cat;
            }
          }
        });
      });
    }
    if (overrides.add) {
      Object.keys(overrides.add).forEach(function (deck) {
        if (!base.decks[deck]) base.decks[deck] = { blurb: "", venues: [] };
        base.decks[deck].venues = (base.decks[deck].venues || []).concat(overrides.add[deck]);
      });
    }
    if (overrides.remove) {
      Object.keys(overrides.remove).forEach(function (deck) {
        var drop = overrides.remove[deck];
        base.decks[deck].venues = (base.decks[deck].venues || []).filter(function (v) {
          return drop.indexOf(v.name) === -1;
        });
      });
    }
    return base;
  }

  global.CC_DECK_PLANS = {
    "disney-wish": Object.assign(
      {
        name: "Disney Wish",
        note: "Wish-class template. Treasure and Destiny share this layout with different theming.",
      },
      wishShared
    ),

    "disney-treasure": cloneWish({
      name: "Disney Treasure",
      officialSlug: "treasure",
      note: "Same Wish-class hull as Wish — adventure theming instead of fairytale.",
      replace: {
        "3": {
          "The Bayou": {
            name: "Skipper Society",
            tip: "Jungle Cruise–inspired lounge · live entertainment evenings",
          },
          "Star Wars: Hyperspace Lounge": {
            name: "Haunted Mansion Parlor",
            tip: "Haunted Mansion lounge · same spot as Wish Hyperspace",
          },
        },
        "5": {
          "Arendelle: A Frozen Dining Adventure": {
            name: "Plaza de Coco",
            tip: "Rotational Coco theatrical dinner — protect both nights on 7-night sailings",
          },
          "Keg & Compass": {
            name: "Periscope Pub",
            tip: "20,000 Leagues–inspired pub · sports & craft brews",
          },
        },
      },
    }),

    "disney-destiny": cloneWish({
      name: "Disney Destiny",
      officialSlug: "destiny",
      note: "Wish-class heroes theme — same bones as Wish/Treasure.",
      replace: {
        "3": {
          "The Bayou": {
            name: "The Sanctum",
            tip: "Doctor Strange lounge · daytime activities, live music at night",
          },
          "Star Wars: Hyperspace Lounge": {
            name: "Haunted Mansion Parlor",
            tip: "Haunted Mansion lounge (Destiny version)",
          },
        },
        "5": {
          "Arendelle: A Frozen Dining Adventure": {
            name: "Pride Lands: Feast of the Lion King",
            tip: "Rotational Lion King theatrical feast",
          },
        },
      },
    }),

    "disney-dream": {
      name: "Disney Dream",
      classLabel: "Dream class · 14 decks",
      officialSlug: "dream",
      note: "Nearly identical layout to Fantasy — Art Deco styling on Dream.",
      decks: {
        "2": {
          blurb: "Enchanted Garden and lower public spaces.",
          venues: [
            V("Enchanted Garden", "dining", "aft", "Rotational restaurant · garden conservatory vibe"),
          ],
        },
        "3": {
          blurb: "Atrium, Royal Palace, Animator’s Palate, adult district.",
          venues: [
            V("Lobby Atrium", "service", "mid", "Character meets & embarkation hub"),
            V("Royal Palace", "dining", "aft", "Rotational princess / fairytale dining"),
            V("Animator's Palate", "dining", "aft", "Rotational · walls come alive"),
            V("District nightlife (The Tube, Pink, Ooh La La, 687)", "adults", "fwd", "Adult lounges · evenings"),
            V("Guest Services", "service", "mid", "Purser & Port Adventures desks"),
            V("D Lounge", "entertainment", "mid", "Family activities & game shows"),
          ],
        },
        "4": {
          blurb: "Walt Disney Theatre and shops.",
          venues: [
            V("Walt Disney Theatre", "entertainment", "fwd", "Broadway-style productions"),
            V("Preludes", "dining", "fwd", "Pre-show snacks"),
            V("Mickey's Mainsail / shops", "service", "mid", "Main retail corridor"),
          ],
        },
        "5": {
          blurb: "Kids clubs and Buena Vista movie theatre.",
          venues: [
            V("Disney's Oceaneer Club", "kids", "mid", "Ages ~3–12"),
            V("Disney's Oceaneer Lab", "kids", "mid", "Connected Oceaneer space"),
            V("It's a Small World Nursery", "kids", "mid", "Fee + reservation"),
            V("Buena Vista Theatre", "entertainment", "aft", "Feature films"),
            V("Edge", "kids", "mid", "Tween club ~11–14"),
          ],
        },
        "11": {
          blurb: "Spa, Quiet Cove adults, and sweets.",
          venues: [
            V("Senses Spa & Fitness", "spa", "fwd", "Spa, salon, gym"),
            V("Quiet Cove Pool", "pool", "fwd", "Adults 18+"),
            V("Cove Café", "adults", "fwd", "Adult coffee bar"),
            V("Vanellope's Sweets & Treats", "dining", "mid", "Sweet shop · extra charge items"),
          ],
        },
        "12": {
          blurb: "Adult specialty, buffet, Concierge.",
          venues: [
            V("Palo", "dining", "aft", "Adult Italian specialty · cover"),
            V("Remy", "dining", "aft", "Adult French fine dining · cover"),
            V("Meridian", "adults", "aft", "Bar between Palo & Remy"),
            V("Cabanas", "dining", "aft", "Buffet breakfast & lunch"),
            V("Concierge Lounge", "service", "fwd", "Concierge guests"),
          ],
        },
        "13": {
          blurb: "Main family pools, AquaDuck, quick service.",
          venues: [
            V("Mickey's Pool", "pool", "mid", "Main family pool · Funnel Vision"),
            V("Nemo's Reef", "pool", "mid", "Little-kid splash"),
            V("AquaDuck entrance", "entertainment", "mid", "Water coaster boarding"),
            V("Flo's Café / quick service", "dining", "mid", "Pizza, grill, Ramone's Cantina, soft-serve"),
          ],
        },
        "14": {
          blurb: "Sports deck and upper AquaDuck track.",
          venues: [
            V("Goofy's Sports Deck", "entertainment", "fwd", "Basketball, sports court"),
            V("Twist 'n' Spout", "pool", "mid", "Water slide"),
            V("Satellite Falls", "pool", "fwd", "Adult splash / whirlpool area"),
          ],
        },
      },
    },

    "disney-fantasy": {
      name: "Disney Fantasy",
      classLabel: "Dream class · 14 decks",
      officialSlug: "fantasy",
      note: "Sister to Dream — same bones, Art Nouveau styling and Royal Court instead of Royal Palace.",
      decks: null, // filled below from dream with rename
    },

    "disney-magic": {
      name: "Disney Magic",
      classLabel: "Classic class · 11 decks",
      officialSlug: "magic",
      note: "Intimate classic-class layout shared with Wonder (different restaurant names).",
      decks: {
        "1": {
          blurb: "Health center and tender access.",
          venues: [V("Health Center", "service", "fwd", "Medical / first aid")],
        },
        "3": {
          blurb: "Atrium, Lumière’s, After Hours lounges, Rapunzel’s.",
          venues: [
            V("Lobby Atrium", "service", "mid", "Embarkation & character hub"),
            V("Lumière's", "dining", "mid", "Rotational Beauty and the Beast dining"),
            V("Rapunzel's Royal Table", "dining", "aft", "Rotational Tangled dining"),
            V("After Hours (Keys, O'Gills, Fathoms)", "adults", "fwd", "Adult nightlife district"),
            V("Guest Services / Port Adventures", "service", "mid", "Purser desks off atrium"),
          ],
        },
        "4": {
          blurb: "Theatre, shops, Animator’s Palate, D Lounge.",
          venues: [
            V("Walt Disney Theatre", "entertainment", "fwd", "Broadway-style shows"),
            V("Preludes", "dining", "fwd", "Theatre snacks"),
            V("Mickey's Mainsail / White Caps", "service", "mid", "Main shops"),
            V("D Lounge", "entertainment", "mid", "Family activities"),
            V("Animator's Palate", "dining", "aft", "Rotational interactive dining"),
            V("Outdoor Promenade", "service", "mid", "Wraparound Deck 4 walk"),
          ],
        },
        "5": {
          blurb: "Oceaneer clubs, nursery, Buena Vista Theatre.",
          venues: [
            V("Disney's Oceaneer Lab", "kids", "fwd", "Ages ~3–12"),
            V("Disney's Oceaneer Club", "kids", "aft", "Ages ~3–12 · connected to Lab"),
            V("It's a Small World Nursery", "kids", "aft", "Fee + reservation"),
            V("Buena Vista Theatre", "entertainment", "aft", "Movies"),
          ],
        },
        "9": {
          blurb: "Pools, quick service, spa, Quiet Cove.",
          venues: [
            V("Goofy's Family Pool", "pool", "mid", "Main pool · Funnel Vision above"),
            V("AquaLab / Dory's Reef", "pool", "aft", "Kids splash zones"),
            V("Twist 'n' Spout", "pool", "aft", "Water slide"),
            V("Pinocchio's / Pete's / Daisy's quick service", "dining", "aft", "Pizza, grill, lighter bites"),
            V("Cabanas", "dining", "aft", "Buffet breakfast & lunch"),
            V("Edge", "kids", "mid", "Tween club near pool"),
            V("Quiet Cove Pool", "pool", "fwd", "Adults 18+"),
            V("Signals / Cove Café", "adults", "fwd", "Adult bar & coffee"),
            V("Senses Spa & Fitness", "spa", "fwd", "Spa and gym"),
          ],
        },
        "10": {
          blurb: "Overlooks, sports, Palo, Concierge, Vibe stairs.",
          venues: [
            V("Wide World of Sports", "entertainment", "fwd", "Basketball & sports court"),
            V("Palo", "dining", "aft", "Adult specialty Italian · cover"),
            V("Concierge Lounge", "service", "mid", "Concierge guests"),
            V("Bibbidi Bobbidi Boutique", "service", "fwd", "Princess makeovers · fee"),
            V("Pool overlook / Funnel Vision seating", "entertainment", "mid", "Watch Deck 9 events from above"),
          ],
        },
        "11": {
          blurb: "Teen club only.",
          venues: [V("Vibe", "kids", "mid", "Teen lounge · ages ~14–17")],
        },
      },
    },

    "disney-wonder": {
      name: "Disney Wonder",
      classLabel: "Classic class · 11 decks",
      officialSlug: "wonder",
      note: "Magic’s twin — Triton’s and Tiana’s Place instead of Lumière’s and Rapunzel’s.",
      decks: null,
    },

    "disney-adventure": {
      name: "Disney Adventure",
      classLabel: "Adventure · 19 guest decks (no Deck 14)",
      officialSlug: "adventure",
      note: "Largest DCL ship — themed lands stacked vertically. Layout differs from Wish/Dream/Magic. Confirm hours in Navigator.",
      decks: {
        "4": {
          blurb: "Embarkation, medical, guest services.",
          venues: [
            V("Embarkation lobby / Guest Services", "service", "mid", "Boarding day hub"),
            V("Medical Center", "service", "mid", "Health services"),
          ],
        },
        "5": {
          blurb: "Lowest guest dining & retail approaches.",
          venues: [V("Animator's Palate", "dining", "mid", "Rotational · animated walls")],
        },
        "6": {
          blurb: "Imagination Garden lower level + dining.",
          venues: [
            V("Disney Imagination Garden (lower)", "entertainment", "mid", "Atrium · Garden Stage below"),
            V("Enchanted Summer Restaurant", "dining", "mid", "Rotational"),
            V("Navigator's Club", "dining", "mid", "Rotational"),
          ],
        },
        "7": {
          blurb: "Oceaneer Club + atrium mid level.",
          venues: [
            V("Disney's Oceaneer Club", "kids", "mid", "Ages ~3–12 · high demand on short sailings"),
            V("Imagination Garden (mid)", "entertainment", "mid", "Overlook of Garden Stage"),
          ],
        },
        "8": {
          blurb: "Imagination Garden upper + Hollywood Spotlight.",
          venues: [
            V("Hollywood Spotlight Club", "dining", "mid", "Rotational"),
            V("Imagination Garden (upper)", "entertainment", "mid", "Aerial Garden Stage views"),
          ],
        },
        "9": {
          blurb: "Town Square theatre deck.",
          venues: [
            V("Walt Disney Theatre", "entertainment", "mid", "Broadway-style shows · remember foot traffic before curtain"),
            V("Animator's Table", "dining", "mid", "Rotational"),
            V("Town Square", "service", "mid", "Princess-themed indoor zone"),
          ],
        },
        "10": {
          blurb: "Discovery Reef casual dining outdoors.",
          venues: [
            V("Disney Discovery Reef", "entertainment", "aft", "Outdoor Little Mermaid / Nemo / Luca zone"),
            V("Stitch's 'Ohana Grill & quick service", "dining", "aft", "Casual included dining"),
            V("Palo Trattoria / Palo Café", "dining", "aft", "Adult specialty options · cover"),
            V("Infinite Bliss Spa (Elemis)", "spa", "mid", "Spa treatments"),
          ],
        },
        "11": {
          blurb: "San Fransokyo Street — teens, games, cinemas.",
          venues: [
            V("San Fransokyo Street", "entertainment", "mid", "Big Hero 6 zone · arcade & meet-and-greets"),
            V("Edge", "kids", "mid", "Tween club"),
            V("Vibe", "kids", "mid", "Teen lounge"),
            V("Cinemas", "entertainment", "mid", "Multiple screens"),
          ],
        },
        "16": {
          blurb: "Wayfinder Bay — Moana-inspired outdoor retreat.",
          venues: [
            V("Wayfinder Bay", "pool", "aft", "Moana-themed outdoor pool / lounge area"),
          ],
        },
        "17": {
          blurb: "Toy Story Place — main family pools & slides.",
          venues: [
            V("Sunnyside Family Pool", "pool", "mid", "Main family pool"),
            V("Woody & Jessie's Wild Slides", "pool", "mid", "Water slides"),
            V("Flying Saucer / Toy Story splash zones", "pool", "mid", "Kids splash areas"),
            V("Pizza Planet & Pixar Market", "dining", "mid", "Pool-deck casual dining"),
          ],
        },
        "19": {
          blurb: "Marvel Landing — rides and infinity pool.",
          venues: [
            V("Ironcycle Test Run", "entertainment", "mid", "Roller coaster · longest at sea"),
            V("Pym Quantum Racers", "entertainment", "mid", "Marvel ride"),
            V("Groot Galaxy Spin", "entertainment", "mid", "Family spinner"),
            V("Tony Stark infinity pool / bar", "pool", "aft", "Adult-leaning pool bar midday"),
          ],
        },
      },
    },
  };

  // Fantasy = Dream with Royal Court rename
  (function () {
    var dream = global.CC_DECK_PLANS["disney-dream"];
    var fantasy = JSON.parse(JSON.stringify(dream));
    fantasy.name = "Disney Fantasy";
    fantasy.officialSlug = "fantasy";
    fantasy.note = "Sister to Dream — Royal Court instead of Royal Palace; Art Nouveau styling.";
    fantasy.decks["3"].venues.forEach(function (v) {
      if (v.name === "Royal Palace") {
        v.name = "Royal Court";
        v.tip = "Rotational princess / fairytale dining (Fantasy)";
      }
    });
    global.CC_DECK_PLANS["disney-fantasy"] = fantasy;
  })();

  // Wonder = Magic with restaurant/lounge renames
  (function () {
    var magic = global.CC_DECK_PLANS["disney-magic"];
    var wonder = JSON.parse(JSON.stringify(magic));
    wonder.name = "Disney Wonder";
    wonder.officialSlug = "wonder";
    wonder.note = "Magic’s twin — Triton’s and Tiana’s Place; After Hours lounges renamed.";
    wonder.decks["3"].venues = [
      V("Lobby Atrium", "service", "mid", "Embarkation & character hub"),
      V("Triton's", "dining", "mid", "Rotational Little Mermaid dining"),
      V("Tiana's Place", "dining", "aft", "Rotational Princess and the Frog dining"),
      V("French Quarter Lounge", "adults", "aft", "Café / lounge near Tiana’s"),
      V("After Hours (Azure, Crown & Fin, Cadillac)", "adults", "fwd", "Adult nightlife district"),
      V("Guest Services / Port Adventures", "service", "mid", "Purser desks off atrium"),
    ];
    global.CC_DECK_PLANS["disney-wonder"] = wonder;
  })();
})(typeof window !== "undefined" ? window : globalThis);
