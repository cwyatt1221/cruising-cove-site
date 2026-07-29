/**
 * Renders Founding Cruise Expert videos into any element with [data-cc-videos="placement"].
 * Uses window.CC_videosForPlacement from creators-data.js
 */
(function () {
  function render(el, placement) {
    var videos = (window.CC_videosForPlacement && window.CC_videosForPlacement(placement)) || [];
    if (!videos.length) {
      el.innerHTML =
        '<div class="video-empty">Founding Cruise Expert videos for this page will appear here. ' +
        '<a href="/marketplace/creators/">Become a Founding Cruise Expert →</a></div>';
      return;
    }

    var html = '';
    videos.forEach(function (v) {
      html +=
        '<div class="video-embed-block">' +
        '<h3>' + v.title + '</h3>' +
        '<p class="credit">Featured expert: <a href="/marketplace/creators/profile.html?id=' + encodeURIComponent(v.creatorId) + '">' + v.creatorName +
        '</a> · <a href="' + v.youtubeUrl + '" target="_blank" rel="noopener noreferrer">YouTube</a></p>' +
        '<div class="video-frame">' +
        '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.youtubeId) +
        '" title="' + v.title.replace(/"/g, '&quot;') + '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>' +
        '</div></div>';
    });
    el.innerHTML = html;
  }

  function init() {
    document.querySelectorAll('[data-cc-videos]').forEach(function (el) {
      render(el, el.getAttribute('data-cc-videos'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
