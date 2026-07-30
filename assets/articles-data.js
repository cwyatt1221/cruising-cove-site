/**
 * Cruising Cove articles — homepage carousel (up to 5) + archive.
 * Keep newest first in CC_ARTICLES for the archive list.
 * Homepage carousel starts on this week's featured piece, then pages through up to 5.
 */
(function (global) {
  var FEATURED_SLOTS = 5;

  var articles = [
    {
      id: "bluey-on-disney-cruise-line-2026",
      title: "Bluey and Bingo Are Setting Sail: What to Know About Bluey on Disney Cruise Line in 2026",
      excerpt:
        "Where to find Bluey and Bingo at sea in 2026 — Wonder, Dream, and Wish — plus Wakey Wakey, meet-and-greets, Pyjama Bash, and booking tips.",
      date: "2026-07-30",
      url: "/articles/bluey-on-disney-cruise-line-2026.html",
    },
    {
      id: "disney-wish-vs-disney-treasure",
      title: "Disney Wish vs. Disney Treasure: Which Disney Cruise Ship Is Better?",
      excerpt:
        "Same Wish-class layout, different themes — Arendelle vs Plaza de Coco, Hyperspace Lounge vs Haunted Mansion Parlor, and which ship fits your family.",
      date: "2026-07-30",
      url: "/articles/disney-wish-vs-disney-treasure.html",
    },
    {
      id: "castaway-cay-vs-lookout-cay",
      title: "Castaway Cay vs. Lookout Cay: Which Disney Private Island Is Better?",
      excerpt:
        "Two exclusive Bahamas islands, two very different days — beaches, snorkeling, Disney magic, culture, and which one fits your family.",
      date: "2026-07-30",
      url: "/articles/castaway-cay-vs-lookout-cay.html",
    },
    {
      id: "midship-detective-agency",
      title: "What Is the Midship Detective Agency?",
      excerpt:
        "A free interactive mystery on the Disney Dream and Fantasy — clue cards, enchanted artwork, and ship-wide detective work most guests walk right past.",
      date: "2026-07-30",
      url: "/articles/midship-detective-agency.html",
    },
    {
      id: "10-hidden-disney-cruise-secrets",
      title: "10 Hidden Disney Cruise Secrets Most First-Time Guests Never Discover",
      excerpt:
        "Many first-time cruisers focus on the big attractions. Some of the best Disney Cruise experiences are the lesser-known perks hidden throughout the ships.",
      date: "2026-07-30",
      url: "/articles/10-hidden-disney-cruise-secrets.html",
    },
  ];

  function isoWeek(d) {
    var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  }

  function featuredArticle(now) {
    if (!articles.length) return null;
    var week = isoWeek(now || new Date());
    var idx = (week - 1) % articles.length;
    return articles[idx];
  }

  /** Up to 5 articles for homepage paging, starting with this week's feature. */
  function featuredCarousel(now) {
    if (!articles.length) return [];
    var start = articles.indexOf(featuredArticle(now));
    if (start < 0) start = 0;
    var out = [];
    var n = Math.min(FEATURED_SLOTS, articles.length);
    for (var i = 0; i < n; i++) {
      out.push(articles[(start + i) % articles.length]);
    }
    return out;
  }

  function byId(id) {
    return (
      articles.find(function (a) {
        return a.id === id;
      }) || null
    );
  }

  global.CC_ARTICLES = articles;
  global.CC_FEATURED_SLOTS = FEATURED_SLOTS;
  global.CC_featuredArticle = featuredArticle;
  global.CC_featuredCarousel = featuredCarousel;
  global.CC_getArticle = byId;
})(typeof window !== "undefined" ? window : globalThis);
