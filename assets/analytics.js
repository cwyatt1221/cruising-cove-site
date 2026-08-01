/**
 * Site analytics: Microsoft Clarity, Meta Pixel, + first-party commercial click events.
 * Drop <script src="/assets/analytics.js" defer></script> before </body>.
 */
(function () {
  "use strict";

  // Microsoft Clarity
  (function (c, l, a, r, i, t, y) {
    c[a] =
      c[a] ||
      function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
    t = l.createElement(r);
    t.async = 1;
    t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", "xubwzh2frb");

  // Meta Pixel
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", "1300581908656255");
  window.fbq("track", "PageView");

  function track(type, meta) {
    if (!type) return;
    var payload = JSON.stringify({
      type: String(type).slice(0, 64),
      path: location.pathname.slice(0, 200),
      meta: meta || {},
      at: new Date().toISOString(),
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
        return;
      }
    } catch (e) {
      /* fall through */
    }
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(function () {});
  }

  window.CCAnalytics = { track: track };

  function ensureBrandMail() {
    document.querySelectorAll(".site-nav-bar > .logo, .site-footer .foot-top > .logo").forEach(function (logo) {
      if (logo.parentElement && logo.parentElement.classList.contains("brand")) return;
      var wrap = document.createElement("div");
      wrap.className = "brand";
      logo.parentNode.insertBefore(wrap, logo);
      wrap.appendChild(logo);
      var mail = document.createElement("a");
      mail.className = "logo-mail";
      mail.href = "mailto:cassondra@cruisingcove.com";
      mail.setAttribute("aria-label", "Email Cruising Cove");
      mail.setAttribute("title", "Email cassondra@cruisingcove.com");
      mail.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
        '<rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/>' +
        '<path d="M4 7l8 6 8-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        "</svg>";
      wrap.appendChild(mail);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureBrandMail);
  } else {
    ensureBrandMail();
  }

  document.addEventListener(
    "click",
    function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a") : null;
      if (!a) return;

      var href = a.getAttribute("href") || "";
      var label = (a.getAttribute("data-cc-label") || a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
      var custom = a.getAttribute("data-cc-event");

      if (custom) {
        track(custom, {
          href: href.slice(0, 300),
          label: label,
          id: a.getAttribute("data-cc-id") || "",
        });
        return;
      }

      if (/etsy\.com/i.test(href)) {
        track("etsy_click", {
          href: href.slice(0, 300),
          label: label,
          shop: a.getAttribute("data-shop-id") || a.getAttribute("data-cc-id") || "",
        });
        return;
      }

      if (href.indexOf("/agents/request") !== -1) {
        var agentMatch = href.match(/[?&]agent=([^&]+)/);
        track("agent_request_click", {
          href: href.slice(0, 300),
          label: label,
          agent: agentMatch ? decodeURIComponent(agentMatch[1]) : "",
        });
        return;
      }

      // Dynamic profiles: /agents/profile.html?id=shana-matos
      if (/\/agents\/profile\.html/i.test(href)) {
        var profileMatch = href.match(/[?&]id=([^&]+)/);
        track("agent_profile_click", {
          href: href.slice(0, 300),
          label: label,
          agent: profileMatch ? decodeURIComponent(profileMatch[1]) : "",
        });
        return;
      }

      // Legacy static profiles: /agents/ava-bennett.html
      if (/^\/agents\/[a-z0-9-]+\.html(?:$|\?)/i.test(href)) {
        track("agent_profile_click", {
          href: href.slice(0, 300),
          label: label,
          agent: href.replace(/^\/agents\//i, "").replace(/\.html.*/i, ""),
        });
      }
    },
    true
  );
})();
