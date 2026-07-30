/**
 * Cruising Cove articles — weekly homepage rotation + archive.
 * Add new posts to the front of CC_ARTICLES (newest first) for archive order.
 * Homepage feature rotates by ISO week across the array.
 */
(function (global) {
  var articles = [
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

  function byId(id) {
    return articles.find(function (a) {
      return a.id === id;
    }) || null;
  }

  global.CC_ARTICLES = articles;
  global.CC_featuredArticle = featuredArticle;
  global.CC_getArticle = byId;
})(typeof window !== "undefined" ? window : globalThis);
