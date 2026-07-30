/**
 * Sitewide search in the main nav.
 * Drop <script src="/assets/site-search.js" defer></script> before </body>.
 * Injects its own control into .site-nav-bar and searches /assets/search-index.json.
 */
(function () {
  "use strict";

  var indexPromise = null;
  var indexData = null;

  function loadIndex() {
    if (indexData) return Promise.resolve(indexData);
    if (!indexPromise) {
      indexPromise = fetch("/assets/search-index.json")
        .then(function (res) {
          if (!res.ok) throw new Error("Search index unavailable");
          return res.json();
        })
        .then(function (data) {
          indexData = data;
          return data;
        })
        .catch(function (err) {
          indexPromise = null;
          throw err;
        });
    }
    return indexPromise;
  }

  function tokenize(q) {
    return String(q || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter(function (t) {
        return t.length > 1;
      });
  }

  function scorePage(page, tokens) {
    var title = (page.title || "").toLowerCase();
    var h1 = (page.h1 || "").toLowerCase();
    var desc = (page.description || "").toLowerCase();
    var body = (page.body || "").toLowerCase();
    var url = (page.url || "").toLowerCase();
    var score = 0;
    var matched = 0;

    tokens.forEach(function (t) {
      var hit = false;
      if (title.indexOf(t) !== -1) {
        score += title.startsWith(t) ? 24 : 16;
        hit = true;
      }
      if (h1.indexOf(t) !== -1) {
        score += 10;
        hit = true;
      }
      if (desc.indexOf(t) !== -1) {
        score += 8;
        hit = true;
      }
      if (url.indexOf(t) !== -1) {
        score += 6;
        hit = true;
      }
      if (body.indexOf(t) !== -1) {
        score += 3;
        hit = true;
      }
      if (hit) matched += 1;
    });

    if (!tokens.length || matched < tokens.length) return 0;
    return score;
  }

  function snippetFor(page, tokens) {
    var source = page.description || page.body || "";
    if (!source) return "";
    var lower = source.toLowerCase();
    var idx = -1;
    for (var i = 0; i < tokens.length; i++) {
      idx = lower.indexOf(tokens[i]);
      if (idx !== -1) break;
    }
    if (idx === -1) return source.slice(0, 110) + (source.length > 110 ? "…" : "");
    var start = Math.max(0, idx - 36);
    var end = Math.min(source.length, idx + 90);
    var snip = source.slice(start, end).trim();
    return (start > 0 ? "…" : "") + snip + (end < source.length ? "…" : "");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function search(pages, query) {
    var tokens = tokenize(query);
    if (!tokens.length) return [];
    return pages
      .map(function (page) {
        return { page: page, score: scorePage(page, tokens), snippet: snippetFor(page, tokens) };
      })
      .filter(function (r) {
        return r.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 8);
  }

  function ensureMounted() {
    var nav = document.querySelector(".site-nav-bar");
    if (!nav || document.getElementById("ccSiteSearch")) return;

    var wrap = document.createElement("div");
    wrap.className = "cc-site-search";
    wrap.id = "ccSiteSearch";
    wrap.innerHTML =
      '<label class="cc-site-search-label" for="ccSiteSearchInput">Search</label>' +
      '<div class="cc-site-search-box">' +
      '<svg class="cc-site-search-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none">' +
      '<circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      "</svg>" +
      '<input id="ccSiteSearchInput" type="search" placeholder="Search the site…" autocomplete="off" enterkeyhint="search" aria-expanded="false" aria-controls="ccSiteSearchResults" aria-autocomplete="list"/>' +
      "</div>" +
      '<div class="cc-site-search-results" id="ccSiteSearchResults" role="listbox" hidden></div>';

    var cta = nav.querySelector(".nav-cta");
    if (cta) nav.insertBefore(wrap, cta);
    else nav.appendChild(wrap);

    var input = wrap.querySelector("#ccSiteSearchInput");
    var results = wrap.querySelector("#ccSiteSearchResults");
    var timer = null;

    function closeResults() {
      results.hidden = true;
      results.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
    }

    function render(items, query) {
      if (!query.trim()) {
        closeResults();
        return;
      }
      if (!items.length) {
        results.innerHTML = '<p class="cc-site-search-empty">No matches for “' + escapeHtml(query.trim()) + '”</p>';
        results.hidden = false;
        input.setAttribute("aria-expanded", "true");
        return;
      }
      results.innerHTML = items
        .map(function (item) {
          return (
            '<a class="cc-site-search-item" role="option" href="' +
            escapeHtml(item.page.url) +
            '">' +
            "<strong>" +
            escapeHtml(item.page.title) +
            "</strong>" +
            (item.snippet ? "<span>" + escapeHtml(item.snippet) + "</span>" : "") +
            "</a>"
          );
        })
        .join("");
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function runSearch() {
      var q = input.value;
      loadIndex()
        .then(function (data) {
          render(search(data.pages || [], q), q);
        })
        .catch(function () {
          results.innerHTML = '<p class="cc-site-search-empty">Search isn’t available right now.</p>';
          results.hidden = false;
        });
    }

    input.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 140);
    });
    input.addEventListener("focus", function () {
      loadIndex();
      if (input.value.trim()) runSearch();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeResults();
        input.blur();
      }
      if (e.key === "Enter") {
        var first = results.querySelector(".cc-site-search-item");
        if (first && !results.hidden) {
          e.preventDefault();
          window.location.href = first.getAttribute("href");
        }
      }
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) closeResults();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureMounted);
  } else {
    ensureMounted();
  }
})();
