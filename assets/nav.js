/**
 * Shared header helpers: brand email link + mobile nav toggle.
 */
(function () {
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

  function bindNavToggle() {
    var btn = document.querySelector(".nav-toggle");
    var menu = document.getElementById("primaryNav");
    if (!btn || !menu || btn.getAttribute("data-cc-bound")) return;
    btn.setAttribute("data-cc-bound", "1");
    btn.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function init() {
    ensureBrandMail();
    bindNavToggle();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
