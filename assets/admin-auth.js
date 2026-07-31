/**
 * Shared admin password login for Cruising Cove admin pages.
 * Stores a short-lived session token (not REPORT_ACCESS_KEY) in sessionStorage.
 */
(function (global) {
  var STORAGE_KEY = "cc_admin_session_token";
  var EXPIRES_KEY = "cc_admin_session_expires";

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
    return data;
  }

  async function logout() {
    var token = getToken();
    clearToken();
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

  global.CCAdminAuth = {
    getToken: getToken,
    login: login,
    logout: logout,
    clearToken: clearToken,
    bind: bind,
  };
})(window);
