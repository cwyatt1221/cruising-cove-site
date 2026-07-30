/**
 * Site analytics: Microsoft Clarity + first-party commercial click events.
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
