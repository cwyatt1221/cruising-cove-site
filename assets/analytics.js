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

  function communityUserMeta() {
    try {
      var token = localStorage.getItem("cc_community_token") || "";
      var raw = localStorage.getItem("cc_community_user");
      if (!token || !raw) return {};
      var user = JSON.parse(raw);
      return {
        userId: user && user.userId ? String(user.userId).slice(0, 80) : "",
        userEmail: user && user.email ? String(user.email).slice(0, 120) : "",
        userName: user && user.displayName ? String(user.displayName).slice(0, 80) : "",
      };
    } catch (e) {
      return {};
    }
  }

  function isSignedIn() {
    try {
      return Boolean(localStorage.getItem("cc_community_token"));
    } catch (e) {
      return false;
    }
  }

  function loginRedirect(next) {
    var dest = next || location.pathname + location.search;
    // Unwrap login URLs and always store a same-origin path (never absolute https://…).
    try {
      var u = new URL(dest, location.href);
      if (/\/community\/login\.html$/i.test(u.pathname)) {
        dest = u.searchParams.get("next") || location.pathname + location.search;
        u = new URL(dest, location.href);
      }
      if (u.origin === location.origin) {
        dest = u.pathname + u.search + u.hash;
      } else {
        dest = location.pathname + location.search;
      }
    } catch (e) {
      /* keep dest */
    }
    location.href = "/community/login.html?next=" + encodeURIComponent(dest);
  }

  /** True only for the agent request page itself — not login?next=…/agents/request… */
  function isAgentRequestHref(href) {
    try {
      return /\/agents\/request\.html$/i.test(new URL(href, location.href).pathname);
    } catch (e) {
      return false;
    }
  }

  function track(type, meta) {
    if (!type) return;
    var merged = Object.assign({}, communityUserMeta(), meta || {});
    var payload = JSON.stringify({
      type: String(type).slice(0, 64),
      path: location.pathname.slice(0, 200),
      meta: merged,
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

  /** Report a failed application / agent-request submit so the owner can be emailed. */
  function reportSubmitError(form, meta) {
    var data = Object.assign({}, meta || {});
    data.form = form || data.form || "Unknown form";
    if (data.error == null && data.message != null) data.error = data.message;
    track("application_submit_error", data);
  }

  function flashNotice(message) {
    var text = String(message || "").trim();
    if (!text) return;
    var el = document.getElementById("cc-flash-notice");
    if (!el) {
      el = document.createElement("div");
      el.id = "cc-flash-notice";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;" +
        "max-width:min(92vw,420px);padding:12px 16px;border-radius:4px;" +
        "background:#0f1c33;color:#f5f0e1;font:600 0.9rem/1.4 Source Sans 3,system-ui,sans-serif;" +
        "box-shadow:0 12px 28px -14px rgba(15,28,51,.55);opacity:0;transition:opacity .18s ease;";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = "1";
    clearTimeout(flashNotice._t);
    flashNotice._t = setTimeout(function () {
      el.style.opacity = "0";
    }, 3200);
  }

  window.CCAnalytics = { track: track, reportSubmitError: reportSubmitError, flashNotice: flashNotice };

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
      var isShopLink =
        custom === "shop_click" ||
        Boolean(a.getAttribute("data-shop-id")) ||
        /etsy\.com/i.test(href);

      if (isShopLink) {
        track(custom || "shop_click", {
          href: href.slice(0, 300),
          label: label,
          shop: a.getAttribute("data-shop-id") || a.getAttribute("data-cc-id") || "",
          id: a.getAttribute("data-cc-id") || "",
        });
        return;
      }

      if (custom) {
        track(custom, {
          href: href.slice(0, 300),
          label: label,
          id: a.getAttribute("data-cc-id") || "",
        });
        return;
      }

      if (isAgentRequestHref(href)) {
        if (a.getAttribute("aria-disabled") === "true" || a.classList.contains("is-disabled")) {
          e.preventDefault();
          flashNotice(
            a.getAttribute("title") ||
              "You already have an open agent request. Other agents stay locked until Cruising Cove unlocks your account."
          );
          return;
        }
        // Unsigned users navigate to request.html (auth gate + Sign in link). Do not
        // preventDefault + JS redirect — that reads as a Clarity dead click and can
        // misfire when href is a login URL whose next= mentions /agents/request.
        var agentMatch = href.match(/[?&]agent=([^&]+)/);
        if (isSignedIn()) {
          track("agent_request_click", {
            href: href.slice(0, 300),
            label: label,
            agent: agentMatch ? decodeURIComponent(agentMatch[1]) : "",
          });
        }
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
