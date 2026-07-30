(function (global) {
  var TOKEN_KEY = "cc_community_token";
  var USER_KEY = "cc_community_user";

  function apiBase() {
    return "/api";
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function getUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token || "");
    localStorage.setItem(USER_KEY, JSON.stringify(user || null));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    var token = getToken();
    if (token) {
      // SWA managed Functions overwrite Authorization — also send a custom header.
      headers.Authorization = "Bearer " + token;
      headers["X-CC-Token"] = token;
    }
    var res = await fetch(apiBase() + path, {
      method: options.method || "GET",
      headers: headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    var data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = {};
    }
    if (!res.ok) {
      var err = new Error((data && data.error) || "Request failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (e) {
      return iso;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderAuthBar(el) {
    if (!el) return;
    var user = getUser();
    if (user && getToken()) {
      el.innerHTML =
        '<p class="who">Signed in as <strong>' +
        escapeHtml(user.displayName) +
        "</strong></p>" +
        '<div class="actions">' +
        '<button type="button" class="btn btn-outline" data-cc-logout>Sign out</button>' +
        "</div>";
      var btn = el.querySelector("[data-cc-logout]");
      if (btn) {
        btn.addEventListener("click", function () {
          clearSession();
          location.reload();
        });
      }
    } else {
      el.innerHTML =
        '<p class="who">Join sailing boards with a free Cruising Cove account.</p>' +
        '<div class="actions">' +
        '<a class="btn btn-gold" href="/community/login.html">Sign in / Register</a>' +
        "</div>";
    }
  }

  global.CCCommunity = {
    api: api,
    getToken: getToken,
    getUser: getUser,
    setSession: setSession,
    clearSession: clearSession,
    formatDate: formatDate,
    escapeHtml: escapeHtml,
    renderAuthBar: renderAuthBar,
  };
})(window);
