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
    '<a href="/planning/deposit-final-payment.html">Deposit &amp; final payment</a>' +
    '<a href="/planning/booking-windows.html">Booking windows</a>' +
    '<a href="/planning/castaway-club.html">Castaway Club</a>' +
    '<a href="/planning/embarkation-day-checklist.html">Embarkation day</a>' +
    '<a href="/planning/kids-clubs.html">Kids clubs</a>' +
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
    if (links.getAttribute("data-cc-nav") === "v4") return;
    links.innerHTML = NAV_HTML;
    links.setAttribute("data-cc-nav", "v4");
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

  function pageTitleForShare() {
    var h1 = document.querySelector(".page-hero h1, main h1, h1");
    if (h1) {
      return (h1.textContent || "").replace(/\s+/g, " ").trim();
    }
    var raw = document.title || "Cruising Cove";
    return raw.replace(/\s*[|—-]\s*Cruising Cove\s*$/i, "").trim() || raw;
  }

  function ensurePageActions() {
    var path = location.pathname.replace(/\/+/g, "/");
    var isArticle = path.indexOf("/articles/") === 0;
    var isPlanning = path.indexOf("/planning/") === 0;
    if (!isArticle && !isPlanning) return;
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
    ensurePageActions();
    loadAdminAuth();
  });
})();
