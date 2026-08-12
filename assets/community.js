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

  /** Revoke server session (best-effort), then clear local storage. */
  async function signOut() {
    var token = getToken();
    if (token) {
      try {
        await api("/community/login", {
          method: "POST",
          body: { action: "logout", token: token },
        });
      } catch (e) {
        /* still clear local session */
      }
    }
    clearSession();
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
        '<p class="who">Signed in to Cruising Cove as <strong>' +
        escapeHtml(user.displayName) +
        "</strong></p>" +
        '<div class="actions">' +
        '<button type="button" class="btn btn-outline" data-cc-logout>Sign out</button>' +
        "</div>";
      var btn = el.querySelector("[data-cc-logout]");
      if (btn) {
        btn.addEventListener("click", function () {
          signOut().then(function () {
            location.reload();
          });
        });
      }
    } else {
      el.innerHTML =
        '<p class="who">One free Cruising Cove account for community boards, My Cruise, gallery, and agent requests.</p>' +
        '<div class="actions">' +
        '<a class="btn btn-gold" href="' +
        escapeHtml(loginUrl()) +
        '">Sign in / Register</a>' +
        "</div>";
    }
  }

  /** Prefer same-origin path+query+hash so next= never becomes an absolute URL. */
  function toInternalPath(dest) {
    if (!dest) return location.pathname + location.search + location.hash;
    try {
      var u = new URL(String(dest), location.href);
      if (u.origin !== location.origin) return location.pathname + location.search + location.hash;
      if (/\/community\/login\.html$/i.test(u.pathname)) {
        return toInternalPath(u.searchParams.get("next") || "/community/");
      }
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return location.pathname + location.search + location.hash;
    }
  }

  function loginUrl(next) {
    return "/community/login.html?next=" + encodeURIComponent(toInternalPath(next));
  }

  function requireSignIn(next) {
    if (getToken() && getUser()) return true;
    location.href = loginUrl(next);
    return false;
  }

  /** Active agent-request lock for the signed-in user, or null. */
  async function getAgentRequestLock() {
    if (!getToken()) return null;
    try {
      var data = await api("/agent-lead");
      if (data && data.locked) return data;
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Disable "Request this agent" links when the user already has a locked request.
   */
  function isAgentRequestHref(href) {
    try {
      return /\/agents\/request\.html$/i.test(new URL(href, location.href).pathname);
    } catch (e) {
      return false;
    }
  }

  function applyAgentRequestLocks(root, lock) {
    var scope = root || document;
    var links = scope.querySelectorAll('a[href*="/agents/request"], a[data-cc-request-href]');
    links.forEach(function (a) {
      if (!a.dataset.ccRequestHref) {
        // getAttribute keeps a relative path; the .href property is always absolute.
        a.dataset.ccRequestHref = toInternalPath(a.getAttribute("href") || "");
      } else {
        a.dataset.ccRequestHref = toInternalPath(a.dataset.ccRequestHref);
      }
      var href = a.dataset.ccRequestHref || "";
      // Ignore login?next=…/agents/request… and other non-request destinations.
      if (!isAgentRequestHref(href)) return;
      var match = href.match(/[?&]agent=([^&]+)/);
      var agentId = match ? decodeURIComponent(match[1]) : "";
      if (!lock || !lock.locked) {
        a.removeAttribute("aria-disabled");
        a.classList.remove("is-disabled");
        a.removeAttribute("title");
        a.setAttribute("href", href);
        if (a.dataset.ccOrigLabel) {
          a.textContent = a.dataset.ccOrigLabel;
          delete a.dataset.ccOrigLabel;
        }
        return;
      }
      if (!a.dataset.ccOrigLabel) a.dataset.ccOrigLabel = (a.textContent || "").trim();
      a.setAttribute("aria-disabled", "true");
      a.classList.add("is-disabled");
      // Keep the real href so analytics can intercept; never use href="#" (Clarity dead clicks).
      a.setAttribute("href", href);
      if (agentId && agentId === lock.agentId) {
        a.textContent = "Requested";
        a.title = "You already requested this agent.";
      } else {
        a.textContent = "Locked";
        a.title =
          "You already requested " +
          (lock.agentName || "an agent") +
          ". Other agents stay locked until Cruising Cove unlocks your account.";
      }
    });
  }

  global.CCCommunity = {
    api: api,
    getToken: getToken,
    getUser: getUser,
    setSession: setSession,
    clearSession: clearSession,
    signOut: signOut,
    formatDate: formatDate,
    escapeHtml: escapeHtml,
    renderAuthBar: renderAuthBar,
    loginUrl: loginUrl,
    requireSignIn: requireSignIn,
    getAgentRequestLock: getAgentRequestLock,
    applyAgentRequestLocks: applyAgentRequestLocks,
  };
})(window);
