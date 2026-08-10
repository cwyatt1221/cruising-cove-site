/**
 * Nav helpers: shared primary menu, dropdowns, current-page marking.
 * Loaded on every page via analytics/site-search stack — also safe alone.
 */
(function () {
  "use strict";

  var NAV_HTML =
    '<a href="/ships/">Ships</a>' +
    '<a href="/ports/">Ports</a>' +
    '<div class="nav-dropdown" data-cc-nav-group="onboard">' +
    '<button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true">Onboard</button>' +
    '<div class="nav-dropdown-menu">' +
    '<a href="/dining/">Dining</a>' +
    '<a href="/entertainment/">Entertainment</a>' +
    "</div>" +
    "</div>" +
    '<div class="nav-dropdown" data-cc-nav-group="plan">' +
    '<button type="button" class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true">Plan</button>' +
    '<div class="nav-dropdown-menu">' +
    '<a href="/planning/my-cruise.html">My Cruise planner</a>' +
    '<a href="/planning/disney-cruise-cost.html">What it costs</a>' +
    '<a href="/planning/first-cruise.html">First-cruise path</a>' +
    '<a href="/planning/sailing-timeline.html">Sailing timeline</a>' +
    '<a href="/planning/deposit-final-payment.html">Deposit &amp; final payment</a>' +
    '<a href="/planning/booking-windows.html">Booking windows</a>' +
    '<a href="/planning/castaway-club.html">Castaway Club</a>' +
    '<a href="/planning/embarkation-day-checklist.html">Embarkation day</a>' +
    '<a href="/planning/kids-clubs.html">Kids clubs</a>' +
    '<a href="/planning/cabin-intel.html">Cabin intel</a>' +
    '<a href="/planning/gratuities.html">Gratuities</a>' +
    '<a href="/planning/wifi.html">Wi-Fi packages</a>' +
    '<a href="/planning/seasickness.html">Seasickness</a>' +
    '<a href="/planning/accessibility.html">Accessibility</a>' +
    '<a href="/planning/june-2026-policy-changes.html">June 2026 changes</a>' +
    '<a href="/planning/stateroom-guides.html">Stateroom guides</a>' +
    '<a href="/planning/compare-sailings.html">Compare sailings</a>' +
    '<a href="/planning/disney-cruise-packing-list.html">Packing list</a>' +
    '<a href="/special-cruises/">Special sailings</a>' +
    '<a href="/excursions/">Excursions</a>' +
    '<a href="/pirate-night/">Pirate Night</a>' +
    '<a href="/articles/">Articles</a>' +
    '<a href="/agents/when-an-agent-helps.html">When an agent helps</a>' +
    "</div>" +
    "</div>" +
    '<a href="/community/">Community</a>' +
    '<a href="/gallery/">Gallery</a>' +
    '<a href="/marketplace/">Marketplace</a>' +
    '<a href="/faq/">FAQ</a>' +
    '<a href="/newsletter/">Newsletter</a>' +
    '<button type="button" class="cc-nav-feedback" data-cc-feedback="1">Give Feedback</button>';

  var ONBOARD_HREFS = ["/dining/", "/entertainment/"];
  var PLAN_HREFS = [
    "/excursions/",
    "/articles/",
    "/special-cruises/",
    "/pirate-night/",
    "/planning/",
    "/agents/when-an-agent-helps.html",
  ];

  function pathMatches(path, href) {
    if (!href) return false;
    if (path === href) return true;
    var base = href.replace(/\.html$/, "");
    return href !== "/" && (path.indexOf(href) === 0 || path.indexOf(base) === 0);
  }

  function enhanceToggle() {
    var btn = document.querySelector(".site-nav-bar .nav-toggle");
    var menu = document.getElementById("primaryNav");
    if (!btn || btn.getAttribute("data-cc-menu-label")) return;
    btn.setAttribute("data-cc-menu-label", "1");
    btn.setAttribute("aria-label", "Menu");
    if (!btn.querySelector(".nav-toggle-label")) {
      var bars = document.createElement("span");
      bars.className = "nav-toggle-bars";
      bars.setAttribute("aria-hidden", "true");
      while (btn.firstChild) bars.appendChild(btn.firstChild);
      if (!bars.querySelector("span")) {
        bars.innerHTML = "<span></span><span></span><span></span>";
      }
      btn.appendChild(bars);
      var label = document.createElement("span");
      label.className = "nav-toggle-label";
      label.textContent = "Menu";
      btn.appendChild(label);
    }
    if (menu) {
      btn.addEventListener("click", function () {
        setTimeout(function () {
          var open = menu.classList.contains("open");
          var labelEl = btn.querySelector(".nav-toggle-label");
          if (labelEl) labelEl.textContent = open ? "Close" : "Menu";
          btn.setAttribute("aria-label", open ? "Close menu" : "Menu");
        }, 0);
      });
    }
  }

  function normalizePrimaryNav() {
    var links = document.getElementById("primaryNav");
    if (!links) return;
    if (links.getAttribute("data-cc-nav") === "v9") return;
    links.innerHTML = NAV_HTML;
    links.setAttribute("data-cc-nav", "v9");
  }

  function removeAuthLink() {
    document.querySelectorAll('a[data-cc-nav="auth"], .nav-auth-link').forEach(function (el) {
      el.remove();
    });
  }

  function ensurePrivacyNote() {
    var note =
      'Cruising Cove is an independent planning site. When you create an account, leave a comment, request an agent, or submit a form, we use that information only to run and improve Cruising Cove — for example, to keep you signed in, show your community posts, or connect you with a travel agent you asked to hear from. We do not sell your personal information, and we do not provide your account or form details to third parties for their marketing. We never ask for Disney Cruise Line or MyDisney login credentials. <a href="/privacy/">Read more</a>.';

    document.querySelectorAll(".site-legal .wrap, .site-footer > .wrap, footer.site-footer > .wrap").forEach(function (wrap) {
      if (wrap.querySelector("[data-cc-privacy]")) return;
      // Full statement already lives in main content on /privacy/.
      if (location.pathname.indexOf("/privacy") === 0) return;
      var p = document.createElement("p");
      p.className = "disclaimer privacy-note";
      p.setAttribute("data-cc-privacy", "1");
      p.innerHTML = note;
      wrap.appendChild(p);
    });
  }

  function ensureFeedbackLink() {
    var links = document.getElementById("primaryNav");
    if (!links) return;

    var existing = links.querySelector("[data-cc-feedback]");
    var btn = existing;
    // Upgrade legacy <a href="#feedback"> to a real button (Clarity dead-click fix).
    if (btn && btn.tagName !== "BUTTON") {
      var replacement = document.createElement("button");
      replacement.type = "button";
      replacement.className = "cc-nav-feedback";
      replacement.setAttribute("data-cc-feedback", "1");
      replacement.textContent = btn.textContent || "Give Feedback";
      btn.parentNode.replaceChild(replacement, btn);
      btn = replacement;
    }
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-nav-feedback";
      btn.setAttribute("data-cc-feedback", "1");
      btn.textContent = "Give Feedback";
      links.appendChild(btn);
    }

    btn.removeAttribute("href");
    btn.removeAttribute("role");
    if (btn.getAttribute("data-cc-feedback-bound") === "1") return;
    btn.setAttribute("data-cc-feedback-bound", "1");
    btn.addEventListener("click", function () {
      openFeedbackModal();
    });
  }

  function feedbackPageUrl() {
    try {
      return location.href.split("#")[0];
    } catch (_) {
      return "";
    }
  }

  function ensureFeedbackModal() {
    var existing = document.getElementById("ccFeedbackModal");
    if (existing) return existing;

    var overlay = document.createElement("div");
    overlay.id = "ccFeedbackModal";
    overlay.className = "cc-feedback-modal";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "ccFeedbackTitle");
    overlay.innerHTML =
      '<div class="cc-feedback-backdrop" data-cc-feedback-close="1"></div>' +
      '<div class="cc-feedback-panel">' +
      '<button type="button" class="cc-feedback-close" data-cc-feedback-close="1" aria-label="Close">&times;</button>' +
      '<h2 id="ccFeedbackTitle" class="display">Give Feedback</h2>' +
      '<p class="cc-feedback-lead">Tell us what works, what doesn\'t, or what you\'d like next. We read every note.</p>' +
      '<form id="ccFeedbackForm" class="cc-feedback-form" novalidate>' +
      '<label for="ccFeedbackName">Name <span class="cc-feedback-optional">(optional)</span></label>' +
      '<input id="ccFeedbackName" name="name" type="text" maxlength="120" autocomplete="name" placeholder="Your name">' +
      '<label for="ccFeedbackEmail">Email <span class="cc-feedback-required">*</span></label>' +
      '<input id="ccFeedbackEmail" name="email" type="email" maxlength="200" required autocomplete="email" placeholder="you@example.com">' +
      '<label for="ccFeedbackMessage">Message <span class="cc-feedback-required">*</span></label>' +
      '<textarea id="ccFeedbackMessage" name="message" rows="5" maxlength="5000" required placeholder="Your feedback…"></textarea>' +
      '<p class="cc-feedback-status" id="ccFeedbackStatus" role="status" aria-live="polite" hidden></p>' +
      '<div class="cc-feedback-actions">' +
      '<button type="button" class="btn btn-outline" data-cc-feedback-close="1">Cancel</button>' +
      '<button type="submit" class="btn btn-gold" id="ccFeedbackSubmit">Send feedback</button>' +
      "</div>" +
      "</form>" +
      "</div>";

    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-cc-feedback-close") === "1") {
        closeFeedbackModal();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) closeFeedbackModal();
    });

    var form = document.getElementById("ccFeedbackForm");
    form.addEventListener("submit", onFeedbackSubmit);

    return overlay;
  }

  function setFeedbackStatus(msg, ok) {
    var statusEl = document.getElementById("ccFeedbackStatus");
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
    statusEl.className = "cc-feedback-status" + (msg ? (ok ? " ok" : " err") : "");
  }

  function openFeedbackModal() {
    var overlay = ensureFeedbackModal();
    var form = document.getElementById("ccFeedbackForm");
    var submitBtn = document.getElementById("ccFeedbackSubmit");
    if (form) form.reset();
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send feedback";
    }
    setFeedbackStatus("", true);
    overlay.hidden = false;
    document.body.classList.add("cc-feedback-open");
    var email = document.getElementById("ccFeedbackEmail");
    if (email) setTimeout(function () { email.focus(); }, 0);

    var menu = document.getElementById("primaryNav");
    var toggle = document.querySelector(".site-nav-bar .nav-toggle");
    if (menu && menu.classList.contains("open")) {
      menu.classList.remove("open");
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
        var labelEl = toggle.querySelector(".nav-toggle-label");
        if (labelEl) labelEl.textContent = "Menu";
        toggle.setAttribute("aria-label", "Menu");
      }
    }
  }

  function closeFeedbackModal() {
    var overlay = document.getElementById("ccFeedbackModal");
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("cc-feedback-open");
  }

  function onFeedbackSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var nameEl = document.getElementById("ccFeedbackName");
    var emailEl = document.getElementById("ccFeedbackEmail");
    var messageEl = document.getElementById("ccFeedbackMessage");
    var submitBtn = document.getElementById("ccFeedbackSubmit");

    var name = (nameEl && nameEl.value ? nameEl.value : "").trim();
    var email = (emailEl && emailEl.value ? emailEl.value : "").trim();
    var message = (messageEl && messageEl.value ? messageEl.value : "").trim();

    if (!email || email.indexOf("@") < 1) {
      setFeedbackStatus("Please enter a valid email address.", false);
      if (emailEl) emailEl.focus();
      return;
    }
    if (!message || message.length < 2) {
      setFeedbackStatus("Please enter your feedback message.", false);
      if (messageEl) messageEl.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
    }
    setFeedbackStatus("", true);

    var payload = {
      name: name,
      email: email,
      message: message,
      pageUrl: feedbackPageUrl(),
    };

    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          if (window.CCAnalytics && CCAnalytics.reportSubmitError) {
            CCAnalytics.reportSubmitError("Site feedback", {
              httpStatus: result.status,
              error: (result.body && result.body.error) || ("HTTP " + result.status),
              email: payload.email,
              name: payload.name,
              path: payload.pageUrl,
            });
          }
          throw new Error((result.body && result.body.error) || "Something went wrong. Please try again.");
        }
        setFeedbackStatus((result.body && result.body.message) || "Thanks — your feedback was sent.", true);
        if (form) form.reset();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send feedback";
        }
        setTimeout(function () {
          closeFeedbackModal();
        }, 1600);
      })
      .catch(function (err) {
        setFeedbackStatus((err && err.message) || "Something went wrong. Please try again.", false);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send feedback";
        }
      });
  }

  var NEWSLETTER_SHIPS = [
    { slug: "disney-magic", label: "Disney Magic" },
    { slug: "disney-wonder", label: "Disney Wonder" },
    { slug: "disney-dream", label: "Disney Dream" },
    { slug: "disney-fantasy", label: "Disney Fantasy" },
    { slug: "disney-wish", label: "Disney Wish" },
    { slug: "disney-treasure", label: "Disney Treasure" },
    { slug: "disney-destiny", label: "Disney Destiny" },
    { slug: "disney-believe", label: "Disney Believe" },
    { slug: "disney-adventure", label: "Disney Adventure" },
  ];

  var newsletterUid = 0;

  function newsletterShipOptionsHtml() {
    return NEWSLETTER_SHIPS.map(function (ship) {
      return '<option value="' + ship.slug + '">' + ship.label + "</option>";
    }).join("");
  }

  function newsletterPageUrl() {
    try {
      return location.href.split("#")[0];
    } catch (_) {
      return "";
    }
  }

  function buildNewsletterFormHtml(uid, compact) {
    var emailId = "ccNlEmail" + uid;
    var nameId = "ccNlName" + uid;
    var shipId = "ccNlShip" + uid;
    var dateId = "ccNlDate" + uid;
    var tipsId = "ccNlTips" + uid;
    var statusId = "ccNlStatus" + uid;
    var formId = "ccNlForm" + uid;
    var submitId = "ccNlSubmit" + uid;
    var rowClass = compact ? "cc-newsletter-row cc-newsletter-row-compact" : "cc-newsletter-row";

    return (
      '<form id="' + formId + '" class="cc-newsletter-form" novalidate data-cc-nl-uid="' + uid + '">' +
      '<div class="' + rowClass + '">' +
      '<div class="cc-newsletter-field">' +
      '<label for="' + emailId + '">Email <span class="cc-newsletter-required">*</span></label>' +
      '<input id="' + emailId + '" name="email" type="email" maxlength="200" required autocomplete="email" placeholder="you@example.com">' +
      "</div>" +
      '<div class="cc-newsletter-field">' +
      '<label for="' + nameId + '">Name <span class="cc-newsletter-optional">(optional)</span></label>' +
      '<input id="' + nameId + '" name="name" type="text" maxlength="120" autocomplete="name" placeholder="Your name">' +
      "</div>" +
      "</div>" +
      '<div class="' + rowClass + '">' +
      '<div class="cc-newsletter-field">' +
      '<label for="' + shipId + '">Ship <span class="cc-newsletter-optional">(optional)</span></label>' +
      '<select id="' + shipId + '" name="ship">' +
      '<option value="">Any / not sure yet</option>' +
      newsletterShipOptionsHtml() +
      "</select>" +
      "</div>" +
      '<div class="cc-newsletter-field">' +
      '<label for="' + dateId + '">Embarkation date <span class="cc-newsletter-optional">(optional)</span></label>' +
      '<input id="' + dateId + '" name="embarkationDate" type="date">' +
      "</div>" +
      "</div>" +
      '<label class="cc-newsletter-check" for="' + tipsId + '">' +
      '<input id="' + tipsId + '" name="sailingTips" type="checkbox" value="1">' +
      "<span>Send a welcome note and milestone sailing tips if I share a ship or date</span>" +
      "</label>" +
      '<p class="cc-newsletter-status" id="' + statusId + '" role="status" aria-live="polite" hidden></p>' +
      '<div class="cc-newsletter-actions">' +
      '<button type="submit" class="btn btn-gold" id="' + submitId + '">Join the newsletter</button>' +
      "</div>" +
      "</form>"
    );
  }

  function setNewsletterStatus(uid, msg, ok) {
    var statusEl = document.getElementById("ccNlStatus" + uid);
    if (!statusEl) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg || "";
    statusEl.className = "cc-newsletter-status" + (msg ? (ok ? " ok" : " err") : "");
  }

  function syncNewsletterTips(form) {
    var uid = form.getAttribute("data-cc-nl-uid");
    var shipEl = document.getElementById("ccNlShip" + uid);
    var dateEl = document.getElementById("ccNlDate" + uid);
    var tipsEl = document.getElementById("ccNlTips" + uid);
    if (!tipsEl) return;
    var hasShip = !!(shipEl && shipEl.value);
    var hasDate = !!(dateEl && dateEl.value);
    if (hasShip || hasDate) tipsEl.checked = true;
  }

  function bindNewsletterForm(form) {
    if (!form || form.getAttribute("data-cc-nl-bound") === "1") return;
    form.setAttribute("data-cc-nl-bound", "1");
    var uid = form.getAttribute("data-cc-nl-uid");
    var shipEl = document.getElementById("ccNlShip" + uid);
    var dateEl = document.getElementById("ccNlDate" + uid);
    if (shipEl) shipEl.addEventListener("change", function () { syncNewsletterTips(form); });
    if (dateEl) dateEl.addEventListener("change", function () { syncNewsletterTips(form); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var emailEl = document.getElementById("ccNlEmail" + uid);
      var nameEl = document.getElementById("ccNlName" + uid);
      var tipsEl = document.getElementById("ccNlTips" + uid);
      var submitBtn = document.getElementById("ccNlSubmit" + uid);

      var email = (emailEl && emailEl.value ? emailEl.value : "").trim();
      var name = (nameEl && nameEl.value ? nameEl.value : "").trim();
      var ship = (shipEl && shipEl.value ? shipEl.value : "").trim();
      var embarkationDate = (dateEl && dateEl.value ? dateEl.value : "").trim();
      var sailingTips = !!(tipsEl && tipsEl.checked) || !!ship || !!embarkationDate;

      if (!email || email.indexOf("@") < 1) {
        setNewsletterStatus(uid, "Please enter a valid email address.", false);
        if (emailEl) emailEl.focus();
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Joining…";
      }
      setNewsletterStatus(uid, "", true);

      var payload = {
        email: email,
        name: name,
        ship: ship,
        embarkationDate: embarkationDate,
        sailingTips: sailingTips,
        pageUrl: newsletterPageUrl(),
      };

      fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            return { ok: res.ok, status: res.status, body: body };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            if (window.CCAnalytics && CCAnalytics.reportSubmitError) {
              CCAnalytics.reportSubmitError("Newsletter signup", {
                httpStatus: result.status,
                error: (result.body && result.body.error) || ("HTTP " + result.status),
                email: payload.email,
                name: payload.name,
                path: payload.pageUrl,
              });
            }
            throw new Error((result.body && result.body.error) || "Something went wrong. Please try again.");
          }
          var okMsg =
            (result.body && result.body.message) || "You're on the list — thanks for joining.";
          setNewsletterStatus(uid, okMsg, true);
          var statusEl = document.getElementById("ccNlStatus" + uid);
          if (statusEl && !statusEl.querySelector("a")) {
            statusEl.appendChild(document.createTextNode(" "));
            var unsubLink = document.createElement("a");
            unsubLink.href = "/newsletter/unsubscribe.html";
            unsubLink.textContent = "Unsubscribe";
            statusEl.appendChild(unsubLink);
            statusEl.appendChild(document.createTextNode(" anytime."));
          }
          form.reset();
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Join the newsletter";
          }
        })
        .catch(function (err) {
          setNewsletterStatus(uid, (err && err.message) || "Something went wrong. Please try again.", false);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Join the newsletter";
          }
        });
    });
  }

  function mountNewsletterForm(container, opts) {
    if (!container || container.querySelector(".cc-newsletter-form")) return;
    opts = opts || {};
    newsletterUid += 1;
    var uid = newsletterUid;
    var wrap = document.createElement("div");
    wrap.className = "cc-newsletter-mount";
    wrap.innerHTML = buildNewsletterFormHtml(uid, !!opts.compact);
    container.appendChild(wrap);
    bindNewsletterForm(document.getElementById("ccNlForm" + uid));
  }

  function ensureNewsletterFooter() {
    if (document.querySelector("[data-cc-newsletter-footer]")) return;
    // Full form lives on /newsletter/ — skip duplicate bands on signup/unsub, privacy, marketplace.
    if (document.querySelector("[data-cc-newsletter]")) return;
    var path = location.pathname.replace(/\/+/g, "/");
    if (
      path.indexOf("/privacy") === 0 ||
      path.indexOf("/marketplace") === 0 ||
      path.indexOf("/newsletter") === 0
    ) {
      return;
    }

    var band = document.createElement("aside");
    band.className = "cc-newsletter-band cc-newsletter-band-cta";
    band.setAttribute("data-cc-newsletter-footer", "1");
    band.setAttribute("aria-label", "Newsletter");
    band.innerHTML =
      '<div class="wrap">' +
      '<div class="cc-newsletter-band-inner cc-newsletter-band-inner-cta">' +
      '<div class="cc-newsletter-copy">' +
      '<p class="cc-newsletter-eyebrow">Newsletter</p>' +
      "<h2 class=\"display\">Cruise tips in your inbox</h2>" +
      "<p>A welcome note plus sailing tips timed to your cruise — free, no spam, not weekly.</p>" +
      "</div>" +
      '<div class="cc-newsletter-cta">' +
      '<a class="btn btn-gold" href="/newsletter/">Join the newsletter</a>' +
      "</div>" +
      "</div>" +
      "</div>";

    var legal = document.querySelector(".site-legal");
    if (legal && legal.parentNode) {
      legal.parentNode.insertBefore(band, legal);
    } else {
      var footer = document.querySelector(".site-footer, footer.site-footer");
      if (footer && footer.parentNode) {
        footer.parentNode.insertBefore(band, footer);
      } else {
        var main = document.querySelector("main");
        if (main && main.parentNode) {
          main.parentNode.insertBefore(band, main.nextSibling);
        } else {
          document.body.appendChild(band);
        }
      }
    }
  }

  function ensureNewsletterCallouts() {
    document.querySelectorAll("[data-cc-newsletter]").forEach(function (el) {
      if (el.querySelector(".cc-newsletter-form")) return;
      var slot = el.querySelector("[data-cc-newsletter-slot]") || el;
      mountNewsletterForm(slot, { compact: false });
    });
  }

  function pageTitleForShare() {
    var h1 = document.querySelector(".page-hero h1, main h1, h1");
    if (h1) {
      return (h1.textContent || "").replace(/\s+/g, " ").trim();
    }
    var raw = document.title || "Cruising Cove";
    return raw.replace(/\s*[|—-]\s*Cruising Cove\s*$/i, "").trim() || raw;
  }

  function insertBeforeChrome(section) {
    var actions = document.querySelector("[data-cc-page-actions]");
    if (actions && actions.parentNode) {
      actions.parentNode.insertBefore(section, actions);
      return;
    }
    var legal = document.querySelector(".site-legal");
    if (legal && legal.parentNode) {
      legal.parentNode.insertBefore(section, legal);
      return;
    }
    var main = document.querySelector("main");
    if (main && main.parentNode) {
      main.parentNode.insertBefore(section, main.nextSibling);
    }
  }

  function ensurePageActions() {
    var path = location.pathname.replace(/\/+/g, "/");
    var isArticle = path.indexOf("/articles/") === 0;
    var isPlanning = path.indexOf("/planning/") === 0;
    if (!isArticle && !isPlanning) return;
    if (path === "/articles/" || path === "/articles/index.html") return;
    if (document.querySelector("[data-cc-page-actions]")) return;

    var title = pageTitleForShare();
    var url = location.href.split("#")[0];
    var commentSubject = "Comment on " + title;
    var commentBody =
      "Page: " + url + "\n\nYour comment:\n\n";
    var shareSubject = title + " — Cruising Cove";
    var shareBody =
      "I thought you might like this from Cruising Cove:\n\n" + title + "\n" + url + "\n";

    var section = document.createElement("section");
    section.className = "cc-page-actions";
    section.setAttribute("data-cc-page-actions", "1");
    section.setAttribute("aria-label", "Comment or share");
    section.innerHTML =
      '<div class="wrap">' +
      '<p class="cc-page-actions-label">Found this useful?</p>' +
      '<div class="cc-page-actions-row">' +
      '<a class="btn btn-outline" href="mailto:cassondra@cruisingcove.com?subject=' +
      encodeURIComponent(commentSubject) +
      "&body=" +
      encodeURIComponent(commentBody) +
      '">Leave a comment</a>' +
      '<a class="btn btn-gold" href="mailto:?subject=' +
      encodeURIComponent(shareSubject) +
      "&body=" +
      encodeURIComponent(shareBody) +
      '">Share by email</a>' +
      "</div>" +
      "</div>";

    insertBeforeChrome(section);
  }

  var PLANNING_FALLBACKS = [
    { href: "/planning/first-cruise.html", title: "First-cruise path", meta: "Plan" },
    { href: "/planning/disney-cruise-packing-list.html", title: "Disney cruise packing list", meta: "Plan" },
    { href: "/planning/kids-clubs.html", title: "Kids clubs guide", meta: "Plan" },
    { href: "/agents/", title: "Find a Disney cruise travel agent", meta: "Agents" },
    { href: "/ships/", title: "Compare the Disney fleet", meta: "Ships" },
  ];

  var SHIP_ARTICLE_IDS = {
    "disney-destiny": [
      "disney-destiny-hidden-secrets",
      "disney-destiny-halloween-high-seas",
      "disney-destiny-toddler-tips",
      "worlds-of-marvel",
      "which-disney-ship-should-you-choose",
    ],
    "disney-wish": [
      "disney-wish-vs-disney-treasure",
      "worlds-of-marvel",
      "bluey-on-disney-cruise-line-2026",
      "which-disney-ship-should-you-choose",
    ],
    "disney-treasure": [
      "disney-wish-vs-disney-treasure",
      "worlds-of-marvel",
      "which-disney-ship-should-you-choose",
    ],
    "disney-dream": [
      "midship-detective-agency",
      "bluey-on-disney-cruise-line-2026",
      "which-disney-ship-should-you-choose",
    ],
    "disney-fantasy": ["midship-detective-agency", "which-disney-ship-should-you-choose"],
    "disney-wonder": ["bluey-on-disney-cruise-line-2026", "which-disney-ship-should-you-choose"],
    "disney-magic": ["which-disney-ship-should-you-choose", "10-hidden-disney-cruise-secrets"],
    "disney-adventure": ["which-disney-ship-should-you-choose"],
    "disney-believe": ["which-disney-ship-should-you-choose", "disney-wish-vs-disney-treasure"],
  };

  var ARTICLE_EXTRA_LINKS = {
    "welcome-aboard-bels-castle-creations": [
      { href: "/marketplace/", title: "Visit the marketplace", meta: "Marketplace" },
    ],
    "disney-cruise-booking-and-cost": [
      { href: "/planning/disney-cruise-cost.html", title: "What a Disney cruise costs", meta: "Plan" },
    ],
    "before-you-go-disney-cruise-prep": [
      { href: "/planning/disney-cruise-packing-list.html", title: "Packing list", meta: "Plan" },
    ],
    "life-onboard-disney-cruise": [
      { href: "/planning/kids-clubs.html", title: "Kids clubs guide", meta: "Plan" },
    ],
    "disney-cruise-ports-money-disembarkation": [
      { href: "/ports/", title: "Port guides", meta: "Ports" },
    ],
    "castaway-cay-vs-lookout-cay": [
      { href: "/ports/castaway-cay.html", title: "Castaway Cay guide", meta: "Ports" },
    ],
    "which-disney-ship-should-you-choose": [{ href: "/ships/", title: "Ship guides", meta: "Ships" }],
    "disney-wish-vs-disney-treasure": [
      { href: "/ships/disney-wish.html", title: "Disney Wish guide", meta: "Ships" },
    ],
    "disney-destiny-hidden-secrets": [
      { href: "/ships/disney-destiny.html", title: "Disney Destiny guide", meta: "Ships" },
    ],
    "disney-destiny-halloween-high-seas": [
      { href: "/ships/disney-destiny.html", title: "Disney Destiny guide", meta: "Ships" },
    ],
    "disney-destiny-toddler-tips": [
      { href: "/planning/kids-clubs.html", title: "Kids clubs guide", meta: "Plan" },
    ],
    "worlds-of-marvel": [{ href: "/dining/", title: "Dining guides", meta: "Onboard" }],
    "disney-cruise-fish-extenders": [
      { href: "/marketplace/", title: "Marketplace essentials", meta: "Marketplace" },
    ],
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pathSlug(path, folder) {
    var prefix = "/" + folder + "/";
    if (path.indexOf(prefix) !== 0) return "";
    var rest = path.slice(prefix.length).replace(/\/+$/, "");
    if (!rest || rest === "index.html") return "";
    return rest.replace(/\.html$/, "");
  }

  function normalizePath(href) {
    if (!href) return "";
    try {
      var u = new URL(href, location.origin);
      return u.pathname.replace(/\/+/g, "/");
    } catch (e) {
      return href;
    }
  }

  function tokensFromText(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(function (t) {
        return (
          t.length > 2 &&
          "the and for with your from that this what when how are you".indexOf(t) === -1
        );
      });
  }

  function scoreArticleRelated(currentId, currentTitle, candidate) {
    if (!candidate || candidate.id === currentId) return -1;
    var score = 0;
    var curTokens = tokensFromText(currentId + " " + currentTitle);
    var candTokens = tokensFromText(candidate.id + " " + candidate.title);
    curTokens.forEach(function (t) {
      if (candTokens.indexOf(t) !== -1) score += 3;
    });
    var ships = ["destiny", "wish", "treasure", "dream", "fantasy", "wonder", "magic", "adventure"];
    ships.forEach(function (ship) {
      if (currentId.indexOf(ship) !== -1 && candidate.id.indexOf(ship) !== -1) score += 8;
    });
    if (/welcome-aboard/.test(currentId) && /welcome-aboard/.test(candidate.id)) score += 6;
    if (/marketplace|fish-extender|seller/.test(currentId) && /marketplace|fish-extender|seller/.test(candidate.id))
      score += 5;
    if (/port|castaway|lookout|disembark/.test(currentId) && /port|castaway|lookout|disembark/.test(candidate.id))
      score += 5;
    if (/toddler|kids|bluey|nursery/.test(currentId) && /toddler|kids|bluey|nursery|life-onboard/.test(candidate.id))
      score += 5;
    if (/halloween|secret|hidden/.test(currentId) && /halloween|secret|hidden/.test(candidate.id)) score += 4;
    return score;
  }

  function articleById(id) {
    if (!id || !window.CC_ARTICLES) return null;
    for (var i = 0; i < window.CC_ARTICLES.length; i++) {
      if (window.CC_ARTICLES[i].id === id) return window.CC_ARTICLES[i];
    }
    return null;
  }

  function linkItem(href, title, meta) {
    return { href: href, title: title, meta: meta || "" };
  }

  function dedupeLinks(items, currentPath) {
    var seen = {};
    var out = [];
    seen[normalizePath(currentPath)] = 1;
    items.forEach(function (item) {
      if (!item || !item.href || !item.title) return;
      var key = normalizePath(item.href);
      if (seen[key]) return;
      seen[key] = 1;
      out.push(item);
    });
    return out;
  }

  function pickRelatedForArticle(slug) {
    var articles = window.CC_ARTICLES || [];
    var current = null;
    for (var i = 0; i < articles.length; i++) {
      if (articles[i].id === slug || normalizePath(articles[i].url) === "/articles/" + slug + ".html") {
        current = articles[i];
        break;
      }
    }
    var currentId = current ? current.id : slug;
    var currentTitle = current ? current.title : pageTitleForShare();
    var scored = articles
      .map(function (a) {
        return { article: a, score: scoreArticleRelated(currentId, currentTitle, a) };
      })
      .filter(function (row) {
        return row.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    var links = [];
    scored.slice(0, 3).forEach(function (row) {
      links.push(linkItem(row.article.url, row.article.title, "Article"));
    });

    var extras = ARTICLE_EXTRA_LINKS[currentId] || [];
    extras.forEach(function (extra) {
      links.push(linkItem(extra.href, extra.title, extra.meta));
    });

    if (links.length < 3) {
      var idx = current
        ? articles.findIndex(function (a) {
            return a.id === current.id;
          })
        : -1;
      for (var j = 1; j < articles.length && links.length < 3; j++) {
        var neighbor = articles[(Math.max(idx, 0) + j) % articles.length];
        if (neighbor.id === currentId) continue;
        links.push(linkItem(neighbor.url, neighbor.title, "Article"));
      }
    }

    PLANNING_FALLBACKS.forEach(function (fb) {
      if (links.length < 3) links.push(linkItem(fb.href, fb.title, fb.meta));
    });

    return dedupeLinks(links, location.pathname).slice(0, 3);
  }

  function pickRelatedForShip(slug) {
    var links = [
      linkItem("/planning/kids-clubs.html", "Kids clubs by age", "Plan"),
      linkItem("/planning/disney-cruise-packing-list.html", "Packing list", "Plan"),
      linkItem("/agents/", "Find a travel agent", "Agents"),
      linkItem("/planning/first-cruise.html", "First-cruise path", "Plan"),
      linkItem("/articles/", "More articles", "Articles"),
    ];
    var ids = SHIP_ARTICLE_IDS[slug] || [];
    var articleLinks = [];
    ids.forEach(function (id) {
      var a = articleById(id);
      if (a) articleLinks.push(linkItem(a.url, a.title, "Article"));
    });
    // Prefer ship-specific articles, then keep useful planning links.
    var merged = articleLinks.concat(links);
    return dedupeLinks(merged, location.pathname).slice(0, 4);
  }

  function renderRelatedSection(label, ariaLabel, items) {
    if (!items || !items.length) return;
    if (document.querySelector("[data-cc-related]")) return;

    var section = document.createElement("section");
    section.className = "cc-related";
    section.setAttribute("data-cc-related", "1");
    section.setAttribute("aria-label", ariaLabel);

    var listHtml = items
      .map(function (item) {
        return (
          '<li class="cc-related-item">' +
          '<a href="' +
          escapeHtml(item.href) +
          '">' +
          (item.meta
            ? '<span class="cc-related-meta">' + escapeHtml(item.meta) + "</span>"
            : "") +
          '<span class="cc-related-title">' +
          escapeHtml(item.title) +
          "</span>" +
          "</a>" +
          "</li>"
        );
      })
      .join("");

    section.innerHTML =
      '<div class="wrap">' +
      '<p class="cc-related-label">' +
      escapeHtml(label) +
      "</p>" +
      '<ul class="cc-related-list">' +
      listHtml +
      "</ul>" +
      "</div>";

    insertBeforeChrome(section);
  }

  function withArticlesData(done) {
    if (window.CC_ARTICLES) {
      done();
      return;
    }
    var existing = document.querySelector('script[src="/assets/articles-data.js"]');
    function finish() {
      done();
    }
    if (existing) {
      if (window.CC_ARTICLES) {
        finish();
        return;
      }
      existing.addEventListener("load", finish);
      // Already-parsed scripts won't fire load; poll briefly.
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        if (window.CC_ARTICLES || tries > 40) {
          clearInterval(timer);
          finish();
        }
      }, 25);
      return;
    }
    var s = document.createElement("script");
    s.src = "/assets/articles-data.js";
    s.onload = finish;
    s.onerror = finish;
    document.head.appendChild(s);
  }

  function ensureRelatedLinks() {
    if (document.querySelector("[data-cc-related]")) return;
    var path = location.pathname.replace(/\/+/g, "/");
    var articleSlug = pathSlug(path, "articles");
    var shipSlug = pathSlug(path, "ships");

    if (articleSlug) {
      withArticlesData(function () {
        renderRelatedSection("Read next", "Read next", pickRelatedForArticle(articleSlug));
      });
      return;
    }

    if (shipSlug) {
      withArticlesData(function () {
        renderRelatedSection("Also useful", "Also useful", pickRelatedForShip(shipSlug));
      });
      return;
    }

    if (path === "/agents/" || path === "/agents/index.html") {
      renderRelatedSection(
        "Also useful",
        "Also useful",
        dedupeLinks(
          [
            linkItem("/agents/when-an-agent-helps.html", "When an agent helps", "Agents"),
            linkItem("/planning/first-cruise.html", "First-cruise path", "Plan"),
            linkItem("/ships/", "Compare the Disney fleet", "Ships"),
            linkItem("/marketplace/", "Marketplace", "Marketplace"),
          ],
          path
        )
      );
      return;
    }

    if (path === "/marketplace/" || path === "/marketplace/index.html") {
      renderRelatedSection(
        "Also useful",
        "Also useful",
        dedupeLinks(
          [
            linkItem("/marketplace/sellers/", "Browse sellers", "Marketplace"),
            linkItem("/articles/disney-cruise-fish-extenders.html", "Fish extenders guide", "Article"),
            linkItem("/planning/disney-cruise-packing-list.html", "Packing list", "Plan"),
            linkItem("/agents/", "Find a travel agent", "Agents"),
          ],
          path
        )
      );
    }
  }

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
    if (!document.documentElement.dataset.ccNavOutside) {
      document.documentElement.dataset.ccNavOutside = "1";
      document.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest(".nav-dropdown")) return;
        document.querySelectorAll(".nav-dropdown.open").forEach(function (dd) {
          dd.classList.remove("open");
          var btn = dd.querySelector(".nav-dropdown-toggle");
          if (btn) btn.setAttribute("aria-expanded", "false");
        });
      });
    }
  }

  function markCurrent() {
    var path = location.pathname.replace(/\/+/g, "/");
    var links = document.getElementById("primaryNav");
    if (!links) return;

    links.querySelectorAll(":scope > a").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (pathMatches(path, href)) a.classList.add("current");
    });

    links.querySelectorAll(".nav-dropdown").forEach(function (dd) {
      var group = dd.getAttribute("data-cc-nav-group");
      var hrefs = group === "onboard" ? ONBOARD_HREFS : group === "plan" ? PLAN_HREFS : [];
      var onGroup = hrefs.some(function (h) {
        return pathMatches(path, h);
      });
      if (!onGroup) return;
      dd.classList.add("current");
      var btn = dd.querySelector(".nav-dropdown-toggle");
      if (btn) btn.classList.add("current");
      dd.querySelectorAll(".nav-dropdown-menu a").forEach(function (a) {
        if (pathMatches(path, a.getAttribute("href") || "")) a.classList.add("current");
      });
    });
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

  var VISITOR_SESSION_KEY = "cc_site_visit_counted";

  function formatVisitorCount(n) {
    var num = Number(n);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.floor(num).toLocaleString("en-US");
  }

  function visitorCaptionMode() {
    if (window.matchMedia("(max-width:979px)").matches) return "mobile";
    if (window.matchMedia("(max-width:1180px)").matches) return "short";
    return "full";
  }

  function setVisitorCaptionText(el, total) {
    var formatted = formatVisitorCount(total);
    if (!formatted) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.setAttribute("data-count", String(Math.floor(Number(total))));
    var mode = visitorCaptionMode();
    var html;
    if (mode === "mobile") {
      html = "<strong>" + formatted + "</strong> guests aboard";
    } else if (mode === "short") {
      html = "Welcome, fellow DCL lover — <strong>" + formatted + "</strong> guests aboard";
    } else {
      html = "Welcome, fellow DCL lover — <strong>" + formatted + "</strong> guests have come aboard";
    }
    el.innerHTML = html;
  }

  function ensureVisitorCounter() {
    var links = document.getElementById("primaryNav");
    if (!links || links.querySelector("[data-cc-visitor-count]")) return;

    var el = document.createElement("p");
    el.className = "nav-visitor-count";
    el.setAttribute("data-cc-visitor-count", "1");
    el.setAttribute("aria-live", "polite");
    el.hidden = true;
    links.insertBefore(el, links.firstChild);

    var counted = false;
    try {
      counted = sessionStorage.getItem(VISITOR_SESSION_KEY) === "1";
    } catch (e) {
      /* private mode */
    }

    var method = counted ? "GET" : "POST";
    var opts = { method: method, credentials: "same-origin", cache: "no-store" };
    if (method === "POST") {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = "{}";
    }
    fetch("/api/site-visit", opts)
      .then(function (res) {
        if (!res.ok) throw new Error("visit " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!counted) {
          try {
            sessionStorage.setItem(VISITOR_SESSION_KEY, "1");
          } catch (e) {
            /* ignore */
          }
        }
        setVisitorCaptionText(el, data && data.total);
        if (!el._ccVisitorResize) {
          el._ccVisitorResize = function () {
            var n = el.getAttribute("data-count");
            if (n != null) setVisitorCaptionText(el, n);
          };
          window.addEventListener("resize", el._ccVisitorResize);
        }
      })
      .catch(function () {
        el.hidden = true;
      });
  }

  ready(function () {
    enhanceToggle();
    normalizePrimaryNav();
    removeAuthLink();
    initDropdowns();
    markCurrent();
    ensureVisitorCounter();
    ensurePrivacyNote();
    ensureFeedbackLink();
    ensureNewsletterFooter();
    ensureNewsletterCallouts();
    ensureRelatedLinks();
    ensurePageActions();
    loadAdminAuth();
  });
})();
