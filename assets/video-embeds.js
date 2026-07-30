/**
 * Renders Founding Cruise Expert videos into any element with [data-cc-videos="placement"].
 * Uses window.CC_videosForPlacement from creators-data.js
 * Hidden sitewide while CC_CREATORS_ENABLED is false (no YouTube placeholders).
 */
(function () {
  function hideCreatorSurfaces() {
    document.querySelectorAll(".video-embed-section, [data-cc-videos]").forEach(function (el) {
      var section = el.classList.contains("video-embed-section") ? el : el.closest(".video-embed-section");
      if (section) section.hidden = true;
      else el.hidden = true;
    });
    document.querySelectorAll('[href="/marketplace/creators/"], [href^="/marketplace/creators"]').forEach(function (a) {
      var wrap = a.closest("p, li, .mp-side-links, .creator-hub-note");
      if (wrap) wrap.hidden = true;
      else a.hidden = true;
    });
  }

  function render(el, placement) {
    var videos = (window.CC_videosForPlacement && window.CC_videosForPlacement(placement)) || [];
    if (!videos.length) {
      var section = el.closest(".video-embed-section");
      if (section) section.hidden = true;
      el.innerHTML = "";
      return;
    }

    var html = "";
    videos.forEach(function (v) {
      html +=
        '<div class="video-embed-block">' +
        "<h3>" +
        v.title +
        "</h3>" +
        '<p class="credit">Featured expert: <a href="/marketplace/creators/profile.html?id=' +
        encodeURIComponent(v.creatorId) +
        '">' +
        v.creatorName +
        '</a> · <a href="' +
        v.youtubeUrl +
        '" target="_blank" rel="noopener noreferrer">YouTube</a></p>' +
        '<div class="video-frame">' +
        '<iframe src="https://www.youtube-nocookie.com/embed/' +
        encodeURIComponent(v.youtubeId) +
        '" title="' +
        v.title.replace(/"/g, "&quot;") +
        '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' +
        "</div></div>";
    });
    el.innerHTML = html;
  }

  function init() {
    if (window.CC_CREATORS_ENABLED === false) {
      hideCreatorSurfaces();
      return;
    }
    document.querySelectorAll("[data-cc-videos]").forEach(function (el) {
      render(el, el.getAttribute("data-cc-videos"));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
