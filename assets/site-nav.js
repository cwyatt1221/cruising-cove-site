/**
 * Nav helpers: Guides dropdown + shared toggle behavior.
 * Loaded on every page via analytics/site-search stack — also safe alone.
 */
(function () {
  "use strict";

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
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".nav-dropdown")) return;
      document.querySelectorAll(".nav-dropdown.open").forEach(function (dd) {
        dd.classList.remove("open");
        var btn = dd.querySelector(".nav-dropdown-toggle");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    });
  }

  function markCurrent() {
    var path = location.pathname.replace(/\/+/g, "/");
    var guideHrefs = [
      "/excursions/",
      "/faq/",
      "/articles/",
      "/planning/disney-cruise-packing-list.html",
      "/planning/disney-cruise-cost.html",
      "/planning/booking-windows.html",
      "/planning/castaway-club.html",
      "/pirate-night/",
    ];
    var onGuides = guideHrefs.some(function (h) {
      return path === h || path.indexOf(h.replace(/\.html$/, "")) === 0 || (h !== "/" && path.indexOf(h) === 0);
    });
    document.querySelectorAll(".nav-dropdown").forEach(function (dd) {
      if (!onGuides) return;
      dd.classList.add("current");
      var btn = dd.querySelector(".nav-dropdown-toggle");
      if (btn) btn.classList.add("current");
      dd.querySelectorAll(".nav-dropdown-menu a").forEach(function (a) {
        var href = a.getAttribute("href") || "";
        if (!href) return;
        if (path === href || (href !== "/" && path.indexOf(href.replace(/\.html$/, "")) === 0)) {
          a.classList.add("current");
        }
      });
    });
  }

  function communityToken() {
    try {
      return localStorage.getItem("cc_community_token") || "";
    } catch (e) {
      return "";
    }
  }

  /** Gallery + Sign up on every full site header (skips minimal admin bars). */
  function ensureExtraNav() {
    var links = document.getElementById("primaryNav");
    var cta = document.querySelector(".site-nav-bar .nav-cta");
    if (!links || !cta) return;

    var path = location.pathname.replace(/\/+/g, "/");

    if (!links.querySelector('a[data-cc-nav="gallery"]')) {
      var gallery = document.createElement("a");
      gallery.href = "/decorations/#gallery";
      gallery.textContent = "Gallery";
      gallery.setAttribute("data-cc-nav", "gallery");
      if (path.indexOf("/decorations") === 0) gallery.classList.add("current");
      links.appendChild(gallery);
    }

    if (!cta.querySelector('a[data-cc-nav="auth"]')) {
      var auth = document.createElement("a");
      auth.setAttribute("data-cc-nav", "auth");
      auth.className = "nav-auth-link";
      if (communityToken()) {
        auth.href = "/community/";
        auth.textContent = "Account";
        if (path.indexOf("/community") === 0) auth.classList.add("current");
      } else {
        var next = location.pathname + location.search + location.hash;
        auth.href = "/community/login.html?next=" + encodeURIComponent(next);
        auth.textContent = "Sign up";
        if (path.indexOf("/community/login") === 0) auth.classList.add("current");
      }
      var btn = cta.querySelector("a.btn");
      if (btn) cta.insertBefore(auth, btn);
      else cta.appendChild(auth);
    }
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
    initDropdowns();
    ensureExtraNav();
    markCurrent();
    loadAdminAuth();
  });
})();
