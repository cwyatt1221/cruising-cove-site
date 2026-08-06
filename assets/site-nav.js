/**
 * Nav helpers: shared primary menu, dropdowns, current-page marking.
 * Loaded on every page via analytics/site-search stack — also safe alone.
 */
(function () {
  "use strict";

  var NAV_HTML =
    '<a href="/ships/">Ships</a>' +
    '<a href="/ports/">Ports</a>' +
    '<div class="nav-dropdown" data-cc-nav-group="onboard">' +
    '<button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true">Onboard</button>' +
    '<div class="nav-dropdown-menu">' +
    '<a href="/dining/">Dining</a>' +
    '<a href="/entertainment/">Entertainment</a>' +
    "</div>" +
    "</div>" +
    '<div class="nav-dropdown" data-cc-nav-group="plan">' +
    '<button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true">Plan</button>' +
    '<div class="nav-dropdown-menu">' +
    '<a href="/planning/my-cruise.html">My Cruise planner</a>' +
    '<a href="/planning/disney-cruise-cost.html">What it costs</a>' +
    '<a href="/planning/first-cruise.html">First-cruise path</a>' +
    '<a href="/planning/sailing-timeline.html">Sailing timeline</a>' +
    '<a href="/planning/deposit-final-payment.html">Deposit &amp; final payment</a>' +
    '<a href="/planning/booking-windows.html">Booking windows</a>' +
    '<a href="/planning/castaway-club.html">Castaway Club</a>' +
    '<a href="/planning/embarkation-day-checklist.html">Embarkation day</a>' +
    '<a href="/planning/kids-clubs.html">Kids clubs</a>' +
    '<a href="/planning/cabin-intel.html">Cabin intel</a>' +
    '<a href="/planning/gratuities.html">Gratuities</a>' +
    '<a href="/planning/wifi.html">Wi-Fi packages</a>' +
    '<a href="/planning/seasickness.html">Seasickness</a>' +
    '<a href="/planning/accessibility.html">Accessibility</a>' +
    '<a href="/planning/june-2026-policy-changes.html">June 2026 changes</a>' +
    '<a href="/planning/stateroom-guides.html">Stateroom guides</a>' +
    '<a href="/planning/compare-sailings.html">Compare sailings</a>' +
    '<a href="/planning/disney-cruise-packing-list.html">Packing list</a>' +
    '<a href="/special-cruises/">Special sailings</a>' +
    '<a href="/excursions/">Excursions</a>' +
    '<a href="/pirate-night/">Pirate Night</a>' +
    '<a href="/faq/">FAQ</a>' +
    '<a href="/articles/">Articles</a>' +
    '<a href="/agents/when-an-agent-helps.html">When an agent helps</a>' +
    "</div>" +
    "</div>" +
    '<a href="/community/">Community</a>' +
    '<a href="/gallery/">Gallery</a>' +
    '<a href="/marketplace/">Marketplace</a>';

  var ONBOARD_HREFS = ["/dining/", "/entertainment/"];
  var PLAN_HREFS = [
    "/excursions/",
    "/faq/",
    "/articles/",
    "/special-cruises/",
    "/pirate-night/",
    "/planning/",
    "/agents/when-an-agent-helps.html",
  ];

  function pathMatches(path, href) {
    if (!href) return false;
    if (path === href) return true;
    var base = href.replace(/\.html$/, "");
    return href !== "/" && (path.indexOf(href) === 0 || path.indexOf(base) === 0);
  }

  function enhanceToggle() {
    var btn = document.querySelector(".site-nav-bar .nav-toggle");
    var menu = document.getElementById("primaryNav");
    if (!btn || btn.getAttribute("data-cc-menu-label")) return;
    btn.setAttribute("data-cc-menu-label", "1");
    btn.setAttribute("aria-label", "Menu");
    if (!btn.querySelector(".nav-toggle-label")) {
      var bars = document.createElement("span");
      bars.className = "nav-toggle-bars";
      bars.setAttribute("aria-hidden", "true");
      while (btn.firstChild) bars.appendChild(btn.firstChild);
      if (!bars.querySelector("span")) {
        bars.innerHTML = "<span></span><span></span><span></span>";
      }
      btn.appendChild(bars);
      var label = document.createElement("span");
      label.className = "nav-toggle-label";
      label.textContent = "Menu";
      btn.appendChild(label);
    }
    if (menu) {
      btn.addEventListener("click", function () {
        setTimeout(function () {
          var open = menu.classList.contains("open");
          var labelEl = btn.querySelector(".nav-toggle-label");
          if (labelEl) labelEl.textContent = open ? "Close" : "Menu";
          btn.setAttribute("aria-label", open ? "Close menu" : "Menu");
        }, 0);
      });
    }
  }

  function normalizePrimaryNav() {
    var links = document.getElementById("primaryNav");
    if (!links) return;
    if (links.getAttribute("data-cc-nav") === "v5") return;
    links.innerHTML = NAV_HTML;
    links.setAttribute("data-cc-nav", "v5");
  }

  function removeAuthLink() {
    document.querySelectorAll('a[data-cc-nav="auth"], .nav-auth-link').forEach(function (el) {
      el.remove();
    });
  }

  function ensurePrivacyNote() {
    var note =
      'Cruising Cove is an independent planning site. When you create an account, leave a comment, request an agent, or submit a form, we use that information only to run and improve Cruising Cove — for example, to keep you signed in, show your community posts, or connect you with a travel agent you asked to hear from. We do not sell your personal information, and we do not provide your account or form details to third parties for their marketing. We never ask for Disney Cruise Line or MyDisney login credentials. <a href="/privacy/">Read more</a>.';

    document.querySelectorAll(".site-legal .wrap, .site-footer > .wrap, footer.site-footer > .wrap").forEach(function (wrap) {
      if (wrap.querySelector("[data-cc-privacy]")) return;
      // Full statement already lives in main content on /privacy/.
      if (location.pathname.indexOf("/privacy") === 0) return;
      var p = document.createElement("p");
      p.className = "disclaimer privacy-note";
      p.setAttribute("data-cc-privacy", "1");
      p.innerHTML = note;
      wrap.appendChild(p);
    });
  }

  function ensureFeedbackLink() {
    var links = document.getElementById("primaryNav");
    if (!links || links.querySelector("[data-cc-feedback]")) return;

    var href =
      "mailto:cgrove0712@gmail.com?subject=" +
      encodeURIComponent("Cruising Cove feedback") +
      "&body=" +
      encodeURIComponent("Page: " + location.href.split("#")[0] + "\n\nYour feedback:\n\n");

    var a = document.createElement("a");
    a.href = href;
    a.setAttribute("data-cc-feedback", "1");
    a.textContent = "Give Feedback";
    links.appendChild(a);
  }

  function pageTitleForShare() {
    var h1 = document.querySelector(".page-hero h1, main h1, h1");
    if (h1) {
      return (h1.textContent || "").replace(/\s+/g, " ").trim();
    }
    var raw = document.title || "Cruising Cove";
    return raw.replace(/\s*[|—-]\s*Cruising Cove\s*$/i, "").trim() || raw;
  }

  function insertBeforeChrome(section) {
    var actions = document.querySelector("[data-cc-page-actions]");
    if (actions && actions.parentNode) {
      actions.parentNode.insertBefore(section, actions);
      return;
    }
    var legal = document.querySelector(".site-legal");
    if (legal && legal.parentNode) {
      legal.parentNode.insertBefore(section, legal);
      return;
    }
    var main = document.querySelector("main");
    if (main && main.parentNode) {
      main.parentNode.insertBefore(section, main.nextSibling);
    }
  }

  function ensurePageActions() {
    var path = location.pathname.replace(/\/+/g, "/");
    var isArticle = path.indexOf("/articles/") === 0;
    var isPlanning = path.indexOf("/planning/") === 0;
    if (!isArticle && !isPlanning) return;
    if (path === "/articles/" || path === "/articles/index.html") return;
    if (document.querySelector("[data-cc-page-actions]")) return;

    var title = pageTitleForShare();
    var url = location.href.split("#")[0];
    var commentSubject = "Comment on " + title;
    var commentBody =
      "Page: " + url + "\n\nYour comment:\n\n";
    var shareSubject = title + " — Cruising Cove";
    var shareBody =
      "I thought you might like this from Cruising Cove:\n\n" + title + "\n" + url + "\n";

    var section = document.createElement("section");
    section.className = "cc-page-actions";
    section.setAttribute("data-cc-page-actions", "1");
    section.setAttribute("aria-label", "Comment or share");
    section.innerHTML =
      '<div class="wrap">' +
      '<p class="cc-page-actions-label">Found this useful?</p>' +
      '<div class="cc-page-actions-row">' +
      '<a class="btn btn-outline" href="mailto:cassondra@cruisingcove.com?subject=' +
      encodeURIComponent(commentSubject) +
      "&body=" +
      encodeURIComponent(commentBody) +
      '">Leave a comment</a>' +
      '<a class="btn btn-gold" href="mailto:?subject=' +
      encodeURIComponent(shareSubject) +
      "&body=" +
      encodeURIComponent(shareBody) +
      '">Share by email</a>' +
      "</div>" +
      "</div>";

    insertBeforeChrome(section);
  }

  var PLANNING_FALLBACKS = [
    { href: "/planning/first-cruise.html", title: "First-cruise path", meta: "Plan" },
    { href: "/planning/disney-cruise-packing-list.html", title: "Disney cruise packing list", meta: "Plan" },
    { href: "/planning/kids-clubs.html", title: "Kids clubs guide", meta: "Plan" },
    { href: "/agents/", title: "Find a Disney cruise travel agent", meta: "Agents" },
    { href: "/ships/", title: "Compare the Disney fleet", meta: "Ships" },
  ];

  var SHIP_ARTICLE_IDS = {
    "disney-destiny": [
      "disney-destiny-hidden-secrets",
      "disney-destiny-halloween-high-seas",
      "disney-destiny-toddler-tips",
      "worlds-of-marvel",
      "which-disney-ship-should-you-choose",
    ],
    "disney-wish": [
      "disney-wish-vs-disney-treasure",
      "worlds-of-marvel",
      "bluey-on-disney-cruise-line-2026",
      "which-disney-ship-should-you-choose",
    ],
    "disney-treasure": [
      "disney-wish-vs-disney-treasure",
      "worlds-of-marvel",
      "which-disney-ship-should-you-choose",
    ],
    "disney-dream": [
      "midship-detective-agency",
      "bluey-on-disney-cruise-line-2026",
      "which-disney-ship-should-you-choose",
    ],
    "disney-fantasy": ["midship-detective-agency", "which-disney-ship-should-you-choose"],
    "disney-wonder": ["bluey-on-disney-cruise-line-2026", "which-disney-ship-should-you-choose"],
    "disney-magic": ["which-disney-ship-should-you-choose", "10-hidden-disney-cruise-secrets"],
    "disney-adventure": ["which-disney-ship-should-you-choose"],
  };

  var ARTICLE_EXTRA_LINKS = {
    "welcome-aboard-kim": [{ href: "/agents/", title: "Browse travel agents", meta: "Agents" }],
    "welcome-aboard-donna": [{ href: "/agents/", title: "Browse travel agents", meta: "Agents" }],
    "welcome-aboard-shana": [{ href: "/agents/", title: "Browse travel agents", meta: "Agents" }],
    "welcome-aboard-rebekah": [{ href: "/agents/", title: "Browse travel agents", meta: "Agents" }],
    "welcome-aboard-bels-castle-creations": [
      { href: "/marketplace/", title: "Visit the marketplace", meta: "Marketplace" },
    ],
    "marketplace-sellers-application-fixed": [
      { href: "/marketplace/sellers/", title: "Seller applications", meta: "Marketplace" },
    ],
    "disney-cruise-booking-and-cost": [
      { href: "/planning/disney-cruise-cost.html", title: "What a Disney cruise costs", meta: "Plan" },
    ],
    "before-you-go-disney-cruise-prep": [
      { href: "/planning/disney-cruise-packing-list.html", title: "Packing list", meta: "Plan" },
    ],
    "life-onboard-disney-cruise": [
      { href: "/planning/kids-clubs.html", title: "Kids clubs guide", meta: "Plan" },
    ],
    "disney-cruise-ports-money-disembarkation": [
      { href: "/ports/", title: "Port guides", meta: "Ports" },
    ],
    "castaway-cay-vs-lookout-cay": [
      { href: "/ports/castaway-cay.html", title: "Castaway Cay guide", meta: "Ports" },
    ],
    "which-disney-ship-should-you-choose": [{ href: "/ships/", title: "Ship guides", meta: "Ships" }],
    "disney-wish-vs-disney-treasure": [
      { href: "/ships/disney-wish.html", title: "Disney Wish guide", meta: "Ships" },
    ],
    "disney-destiny-hidden-secrets": [
      { href: "/ships/disney-destiny.html", title: "Disney Destiny guide", meta: "Ships" },
    ],
    "disney-destiny-halloween-high-seas": [
      { href: "/ships/disney-destiny.html", title: "Disney Destiny guide", meta: "Ships" },
    ],
    "disney-destiny-toddler-tips": [
      { href: "/planning/kids-clubs.html", title: "Kids clubs guide", meta: "Plan" },
    ],
    "worlds-of-marvel": [{ href: "/dining/", title: "Dining guides", meta: "Onboard" }],
    "disney-cruise-fish-extenders": [
      { href: "/marketplace/", title: "Marketplace essentials", meta: "Marketplace" },
    ],
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pathSlug(path, folder) {
    var prefix = "/" + folder + "/";
    if (path.indexOf(prefix) !== 0) return "";
    var rest = path.slice(prefix.length).replace(/\/+$/, "");
    if (!rest || rest === "index.html") return "";
    return rest.replace(/\.html$/, "");
  }

  function normalizePath(href) {
    if (!href) return "";
    try {
      var u = new URL(href, location.origin);
      return u.pathname.replace(/\/+/g, "/");
    } catch (e) {
      return href;
    }
  }

  function tokensFromText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(function (t) {
        return (
          t.length > 2 &&
          "the and for with your from that this what when how are you".indexOf(t) === -1
        );
      });
  }

  function scoreArticleRelated(currentId, currentTitle, candidate) {
    if (!candidate || candidate.id === currentId) return -1;
    var score = 0;
    var curTokens = tokensFromText(currentId + " " + currentTitle);
    var candTokens = tokensFromText(candidate.id + " " + candidate.title);
    curTokens.forEach(function (t) {
      if (candTokens.indexOf(t) !== -1) score += 3;
    });
    var ships = ["destiny", "wish", "treasure", "dream", "fantasy", "wonder", "magic", "adventure"];
    ships.forEach(function (ship) {
      if (currentId.indexOf(ship) !== -1 && candidate.id.indexOf(ship) !== -1) score += 8;
    });
    if (/welcome-aboard/.test(currentId) && /welcome-aboard/.test(candidate.id)) score += 6;
    if (/marketplace|fish-extender|seller/.test(currentId) && /marketplace|fish-extender|seller/.test(candidate.id))
      score += 5;
    if (/port|castaway|lookout|disembark/.test(currentId) && /port|castaway|lookout|disembark/.test(candidate.id))
      score += 5;
    if (/toddler|kids|bluey|nursery/.test(currentId) && /toddler|kids|bluey|nursery|life-onboard/.test(candidate.id))
      score += 5;
    if (/halloween|secret|hidden/.test(currentId) && /halloween|secret|hidden/.test(candidate.id)) score += 4;
    return score;
  }

  function articleById(id) {
    if (!id || !window.CC_ARTICLES) return null;
    for (var i = 0; i < window.CC_ARTICLES.length; i++) {
      if (window.CC_ARTICLES[i].id === id) return window.CC_ARTICLES[i];
    }
    return null;
  }

  function linkItem(href, title, meta) {
    return { href: href, title: title, meta: meta || "" };
  }

  function dedupeLinks(items, currentPath) {
    var seen = {};
    var out = [];
    seen[normalizePath(currentPath)] = 1;
    items.forEach(function (item) {
      if (!item || !item.href || !item.title) return;
      var key = normalizePath(item.href);
      if (seen[key]) return;
      seen[key] = 1;
      out.push(item);
    });
    return out;
  }

  function pickRelatedForArticle(slug) {
    var articles = window.CC_ARTICLES || [];
    var current = null;
    for (var i = 0; i < articles.length; i++) {
      if (articles[i].id === slug || normalizePath(articles[i].url) === "/articles/" + slug + ".html") {
        current = articles[i];
        break;
      }
    }
    var currentId = current ? current.id : slug;
    var currentTitle = current ? current.title : pageTitleForShare();
    var scored = articles
      .map(function (a) {
        return { article: a, score: scoreArticleRelated(currentId, currentTitle, a) };
      })
      .filter(function (row) {
        return row.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    var links = [];
    scored.slice(0, 3).forEach(function (row) {
      links.push(linkItem(row.article.url, row.article.title, "Article"));
    });

    var extras = ARTICLE_EXTRA_LINKS[currentId] || [];
    extras.forEach(function (extra) {
      links.push(linkItem(extra.href, extra.title, extra.meta));
    });

    if (links.length < 3) {
      var idx = current
        ? articles.findIndex(function (a) {
            return a.id === current.id;
          })
        : -1;
      for (var j = 1; j < articles.length && links.length < 3; j++) {
        var neighbor = articles[(Math.max(idx, 0) + j) % articles.length];
        if (neighbor.id === currentId) continue;
        links.push(linkItem(neighbor.url, neighbor.title, "Article"));
      }
    }

    PLANNING_FALLBACKS.forEach(function (fb) {
      if (links.length < 3) links.push(linkItem(fb.href, fb.title, fb.meta));
    });

    return dedupeLinks(links, location.pathname).slice(0, 3);
  }

  function pickRelatedForShip(slug) {
    var links = [
      linkItem("/planning/kids-clubs.html", "Kids clubs by age", "Plan"),
      linkItem("/planning/disney-cruise-packing-list.html", "Packing list", "Plan"),
      linkItem("/agents/", "Find a travel agent", "Agents"),
      linkItem("/planning/first-cruise.html", "First-cruise path", "Plan"),
      linkItem("/articles/", "More articles", "Articles"),
    ];
    var ids = SHIP_ARTICLE_IDS[slug] || [];
    var articleLinks = [];
    ids.forEach(function (id) {
      var a = articleById(id);
      if (a) articleLinks.push(linkItem(a.url, a.title, "Article"));
    });
    // Prefer ship-specific articles, then keep useful planning links.
    var merged = articleLinks.concat(links);
    return dedupeLinks(merged, location.pathname).slice(0, 4);
  }

  function renderRelatedSection(label, ariaLabel, items) {
    if (!items || !items.length) return;
    if (document.querySelector("[data-cc-related]")) return;

    var section = document.createElement("section");
    section.className = "cc-related";
    section.setAttribute("data-cc-related", "1");
    section.setAttribute("aria-label", ariaLabel);

    var listHtml = items
      .map(function (item) {
        return (
          '<li class="cc-related-item">' +
          '<a href="' +
          escapeHtml(item.href) +
          '">' +
          (item.meta
            ? '<span class="cc-related-meta">' + escapeHtml(item.meta) + "</span>"
            : "") +
          '<span class="cc-related-title">' +
          escapeHtml(item.title) +
          "</span>" +
          "</a>" +
          "</li>"
        );
      })
      .join("");

    section.innerHTML =
      '<div class="wrap">' +
      '<p class="cc-related-label">' +
      escapeHtml(label) +
      "</p>" +
      '<ul class="cc-related-list">' +
      listHtml +
      "</ul>" +
      "</div>";

    insertBeforeChrome(section);
  }

  function withArticlesData(done) {
    if (window.CC_ARTICLES) {
      done();
      return;
    }
    var existing = document.querySelector('script[src="/assets/articles-data.js"]');
    function finish() {
      done();
    }
    if (existing) {
      if (window.CC_ARTICLES) {
        finish();
        return;
      }
      existing.addEventListener("load", finish);
      // Already-parsed scripts won't fire load; poll briefly.
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        if (window.CC_ARTICLES || tries > 40) {
          clearInterval(timer);
          finish();
        }
      }, 25);
      return;
    }
    var s = document.createElement("script");
    s.src = "/assets/articles-data.js";
    s.onload = finish;
    s.onerror = finish;
    document.head.appendChild(s);
  }

  function ensureRelatedLinks() {
    if (document.querySelector("[data-cc-related]")) return;
    var path = location.pathname.replace(/\/+/g, "/");
    var articleSlug = pathSlug(path, "articles");
    var shipSlug = pathSlug(path, "ships");

    if (articleSlug) {
      withArticlesData(function () {
        renderRelatedSection("Read next", "Read next", pickRelatedForArticle(articleSlug));
      });
      return;
    }

    if (shipSlug) {
      withArticlesData(function () {
        renderRelatedSection("Also useful", "Also useful", pickRelatedForShip(shipSlug));
      });
      return;
    }

    if (path === "/agents/" || path === "/agents/index.html") {
      renderRelatedSection(
        "Also useful",
        "Also useful",
        dedupeLinks(
          [
            linkItem("/agents/when-an-agent-helps.html", "When an agent helps", "Agents"),
            linkItem("/planning/first-cruise.html", "First-cruise path", "Plan"),
            linkItem("/ships/", "Compare the Disney fleet", "Ships"),
            linkItem("/marketplace/", "Marketplace", "Marketplace"),
          ],
          path
        )
      );
      return;
    }

    if (path === "/marketplace/" || path === "/marketplace/index.html") {
      renderRelatedSection(
        "Also useful",
        "Also useful",
        dedupeLinks(
          [
            linkItem("/marketplace/sellers/", "Browse sellers", "Marketplace"),
            linkItem("/articles/disney-cruise-fish-extenders.html", "Fish extenders guide", "Article"),
            linkItem("/planning/disney-cruise-packing-list.html", "Packing list", "Plan"),
            linkItem("/agents/", "Find a travel agent", "Agents"),
          ],
          path
        )
      );
    }
  }

  function initDropdowns(root) {
    var dropdowns = (root || document).querySelectorAll(".nav-dropdown");
    dropdowns.forEach(function (dd) {
      var btn = dd.querySelector(".nav-dropdown-toggle");
      if (!btn || btn.dataset.ccBound) return;
      btn.dataset.ccBound = "1";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var open = dd.classList.toggle("open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        document.querySelectorAll(".nav-dropdown.open").forEach(function (other) {
          if (other !== dd) {
            other.classList.remove("open");
            var ob = other.querySelector(".nav-dropdown-toggle");
            if (ob) ob.setAttribute("aria-expanded", "false");
          }
        });
      });
    });
    if (!document.documentElement.dataset.ccNavOutside) {
      document.documentElement.dataset.ccNavOutside = "1";
      document.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest(".nav-dropdown")) return;
        document.querySelectorAll(".nav-dropdown.open").forEach(function (dd) {
          dd.classList.remove("open");
          var btn = dd.querySelector(".nav-dropdown-toggle");
          if (btn) btn.setAttribute("aria-expanded", "false");
        });
      });
    }
  }

  function markCurrent() {
    var path = location.pathname.replace(/\/+/g, "/");
    var links = document.getElementById("primaryNav");
    if (!links) return;

    links.querySelectorAll(":scope > a").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (pathMatches(path, href)) a.classList.add("current");
    });

    links.querySelectorAll(".nav-dropdown").forEach(function (dd) {
      var group = dd.getAttribute("data-cc-nav-group");
      var hrefs = group === "onboard" ? ONBOARD_HREFS : group === "plan" ? PLAN_HREFS : [];
      var onGroup = hrefs.some(function (h) {
        return pathMatches(path, h);
      });
      if (!onGroup) return;
      dd.classList.add("current");
      var btn = dd.querySelector(".nav-dropdown-toggle");
      if (btn) btn.classList.add("current");
      dd.querySelectorAll(".nav-dropdown-menu a").forEach(function (a) {
        if (pathMatches(path, a.getAttribute("href") || "")) a.classList.add("current");
      });
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function loadAdminAuth() {
    if (window.CCAdminAuth) {
      window.CCAdminAuth.syncNav();
      return;
    }
    if (document.querySelector('script[src="/assets/admin-auth.js"]')) return;
    var s = document.createElement("script");
    s.src = "/assets/admin-auth.js";
    s.async = true;
    document.head.appendChild(s);
  }

  ready(function () {
    enhanceToggle();
    normalizePrimaryNav();
    removeAuthLink();
    initDropdowns();
    markCurrent();
    ensurePrivacyNote();
    ensureFeedbackLink();
    ensureRelatedLinks();
    ensurePageActions();
    loadAdminAuth();
  });
})();
