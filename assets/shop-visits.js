/**
 * Marketplace / homepage "Shop on Etsy" click counts — admin-only display.
 * Increments via POST /api/sellers/{id}/visit (same as Cruise Accessories directory).
 */
(function () {
  "use strict";

  function isAdminLoggedIn() {
    return !!(window.CCAdminAuth && window.CCAdminAuth.getToken && window.CCAdminAuth.getToken());
  }

  function visitLabel(n) {
    var count = Math.max(0, Math.floor(Number(n) || 0));
    if (count <= 0) return "";
    return count === 1 ? "1 visit" : count + " visits";
  }

  function paintCountEl(el, n) {
    if (!el) return;
    if (!isAdminLoggedIn()) {
      el.hidden = true;
      return;
    }
    var label = visitLabel(n);
    el.hidden = !label;
    el.textContent = label;
  }

  function recordVisit(shopId, countEl) {
    if (!shopId) return;
    fetch("/api/sellers/" + encodeURIComponent(shopId) + "/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: location.pathname + location.search }),
      keepalive: true,
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (!result.ok) return;
        var n =
          result.data && typeof result.data.visitCount === "number" ? result.data.visitCount : null;
        if (n != null) paintCountEl(countEl, n);
      })
      .catch(function () {});
  }

  function applyLoadedCounts(byId) {
    document.querySelectorAll("[data-visit-count]").forEach(function (el) {
      var shopId = el.getAttribute("data-shop-id") || "";
      if (!shopId || byId[shopId] == null) return;
      el.setAttribute("data-visit-total", String(byId[shopId]));
      paintCountEl(el, byId[shopId]);
    });
  }

  function hideAllCounts() {
    document.querySelectorAll("[data-visit-count]").forEach(function (el) {
      el.hidden = true;
    });
  }

  async function loadCounts() {
    if (!document.querySelector("[data-visit-count]")) return;
    if (!isAdminLoggedIn()) {
      hideAllCounts();
      return;
    }
    try {
      var res = await fetch("/api/sellers");
      var data = await res.json();
      if (!res.ok || !Array.isArray(data.sellers)) return;
      var byId = {};
      data.sellers.forEach(function (shop) {
        if (shop && shop.id) byId[shop.id] = shop.visitCount;
      });
      applyLoadedCounts(byId);
    } catch (_) {}
  }

  function init() {
    document.addEventListener("click", function (e) {
      var link = e.target.closest("[data-visit-shop]");
      if (!link) return;
      var shopId = link.getAttribute("data-shop-id") || link.getAttribute("data-cc-id") || "";
      var actions = link.closest(".shop-card-actions, .mp-card-actions");
      var countEl = actions ? actions.querySelector("[data-visit-count]") : null;
      recordVisit(shopId, countEl);
    });

    document.addEventListener("cc-admin-auth-change", loadCounts);

    loadCounts();
    // Admin auth may load async via site-nav after this script runs.
    setTimeout(loadCounts, 400);
    setTimeout(loadCounts, 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.CCShopVisits = { loadCounts: loadCounts, recordVisit: recordVisit };
})();
