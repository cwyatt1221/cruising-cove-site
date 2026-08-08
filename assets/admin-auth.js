/**
 * Shared admin password login for Cruising Cove admin pages.
 * Stores a short-lived session token (not REPORT_ACCESS_KEY) in sessionStorage.
 */
(function (global) {
  var STORAGE_KEY = "cc_admin_session_token";
  var EXPIRES_KEY = "cc_admin_session_expires";

  var ADMIN_PAGES = [
    {
      href: "/admin/",
      label: "Admin home",
      blurb: "Sign in and jump to every moderation tool",
    },
    {
      href: "/agents/admin.html",
      label: "Travel agents",
      blurb: "Agent applications, directory publish, guest request locks",
    },
    {
      href: "/marketplace/sellers/admin.html",
      label: "Marketplace sellers",
      blurb: "Curated 10 shop applications",
    },
    {
      href: "/gallery/admin.html",
      label: "Photo gallery",
      blurb: "Guest photos and comments",
    },
    {
      href: "/community/admin.html",
      label: "Community",
      blurb: "Posts, board chat, hide/delete, mutes",
    },
    {
      href: "/planning/my-cruise-admin.html",
      label: "My Cruise & reviews",
      blurb: "Packing suggestions, port/excursion/venue reviews",
    },
  ];

  function getToken() {
    try {
      var token = sessionStorage.getItem(STORAGE_KEY) || "";
      var expires = sessionStorage.getItem(EXPIRES_KEY) || "";
      if (!token) return "";
      if (expires && Date.parse(expires) < Date.now()) {
        clearToken();
        return "";
      }
      return token;
    } catch (_) {
      return "";
    }
  }

  function setToken(token, expiresAt) {
    try {
      sessionStorage.setItem(STORAGE_KEY, token || "");
      sessionStorage.setItem(EXPIRES_KEY, expiresAt || "");
    } catch (_) {}
  }

  function clearToken() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(EXPIRES_KEY);
    } catch (_) {}
  }

  async function login(password) {
    // Uses existing /api/community/login (scope=site-admin). Dedicated /api/admin-login
    // is not registered on this SWA due to the managed Functions route cap.
    var res = await fetch("/api/community/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: "site-admin",
        action: "login",
        password: password || "",
      }),
    });
    var data = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) throw new Error(data.error || "Login failed");
    setToken(data.token, data.expiresAt);
    syncNav();
    return data;
  }

  async function logout() {
    var token = getToken();
    clearToken();
    syncNav();
    if (!token) return;
    try {
      await fetch("/api/community/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "site-admin",
          action: "logout",
          token: token,
        }),
      });
    } catch (_) {}
  }

  function currentPath() {
    return (location.pathname || "/").replace(/\/+/g, "/");
  }

  function isCurrent(href) {
    var path = currentPath();
    var clean = (href || "").replace(/\/+$/, "") || "/";
    var pathClean = path.replace(/\/+$/, "") || "/";
    if (clean === "/admin") return pathClean === "/admin" || pathClean === "/admin/index.html";
    return path === href || pathClean === clean;
  }

  function syncNav() {
    var existing = document.getElementById("ccAdminBar");
    var loggedIn = Boolean(getToken());
    document.body.classList.toggle("cc-admin-logged-in", loggedIn);

    if (!loggedIn) {
      if (existing) existing.remove();
      return;
    }

    var path = currentPath();
    var linksHtml = ADMIN_PAGES.map(function (page) {
      var current = isCurrent(page.href);
      return (
        '<a href="' +
        page.href +
        '"' +
        (current ? ' class="is-current" aria-current="page"' : "") +
        ">" +
        page.label +
        "</a>"
      );
    }).join("");

    if (!existing) {
      existing = document.createElement("div");
      existing.id = "ccAdminBar";
      existing.className = "cc-admin-bar";
      existing.setAttribute("role", "navigation");
      existing.setAttribute("aria-label", "Admin tools");
      document.body.insertBefore(existing, document.body.firstChild);
    }

    existing.innerHTML =
      '<div class="cc-admin-bar-inner">' +
      '<a class="cc-admin-bar-brand" href="/admin/">Admin</a>' +
      '<nav class="cc-admin-bar-links">' +
      linksHtml +
      "</nav>" +
      '<button type="button" class="cc-admin-bar-logout" id="ccAdminBarLogout">Sign out</button>' +
      "</div>";

    var logoutBtn = document.getElementById("ccAdminBarLogout");
    if (logoutBtn) {
      logoutBtn.onclick = async function () {
        await logout();
        if (path.indexOf("/admin") === 0 || /admin\.html$/.test(path)) {
          location.reload();
        }
      };
    }
  }

  /**
   * Wire a password form into an admin page.
   * options: { passwordInput, loginBtn, logoutBtn?, statusEl?, onReady }
   */
  function bind(options) {
    var passwordInput = options.passwordInput;
    var loginBtn = options.loginBtn;
    var logoutBtn = options.logoutBtn || null;
    var statusEl = options.statusEl || null;
    var onReady = options.onReady || function () {};

    function showStatus(msg, ok) {
      if (!statusEl) return;
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.className = (statusEl.className || "").replace(/\b(ok|err)\b/g, "").trim() + (ok ? " ok" : " err");
    }

    function syncUi() {
      var loggedIn = Boolean(getToken());
      if (passwordInput) {
        passwordInput.disabled = loggedIn;
        if (loggedIn) passwordInput.value = "";
        passwordInput.placeholder = loggedIn ? "Signed in" : "Admin password";
      }
      if (loginBtn) loginBtn.hidden = loggedIn;
      if (logoutBtn) logoutBtn.hidden = !loggedIn;
      syncNav();
      if (loggedIn) onReady();
    }

    if (loginBtn) {
      loginBtn.addEventListener("click", async function () {
        loginBtn.disabled = true;
        try {
          await login(passwordInput ? passwordInput.value : "");
          showStatus("Signed in. Session lasts about 12 hours.", true);
          syncUi();
        } catch (err) {
          showStatus(err.message || "Login failed", false);
        } finally {
          loginBtn.disabled = false;
        }
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && loginBtn && !loginBtn.hidden) loginBtn.click();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async function () {
        await logout();
        showStatus("Signed out.", true);
        syncUi();
      });
    }

    syncUi();
    return { getToken: getToken, syncUi: syncUi };
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(syncNav);

  global.CCAdminAuth = {
    getToken: getToken,
    login: login,
    logout: logout,
    clearToken: clearToken,
    bind: bind,
    syncNav: syncNav,
    ADMIN_PAGES: ADMIN_PAGES,
  };
})(window);
