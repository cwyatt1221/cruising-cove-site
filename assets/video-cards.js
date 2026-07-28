/**
 * Cruising Cove video cards.
 *
 * Drop-in, reusable component for embedding creator YouTube videos anywhere
 * on the site (ship pages, port pages, tip cards, etc.) — never re-uploads
 * or re-hosts video content. Always links back to the creator's channel and
 * credits them by name, per the site's creator-partnership approach.
 *
 * USAGE — put this on any page:
 *
 *   <div class="cc-video-grid" id="wish-videos"></div>
 *   <script src="/assets/video-cards.js" defer></script>
 *   <script>
 *     document.addEventListener('DOMContentLoaded', function () {
 *       CruisingCoveVideos.render('wish-videos', [
 *         {
 *           youtubeId: 'REPLACE_WITH_REAL_VIDEO_ID',
 *           title: 'Best Disney Wish Tour',
 *           creatorName: 'Creator Name',
 *           creatorChannelUrl: 'https://youtube.com/@creatorhandle'
 *         }
 *         // add more real videos here
 *       ]);
 *     });
 *   </script>
 *
 * The youtubeId is the part after "v=" in a YouTube URL
 * (e.g. https://youtube.com/watch?v=dQw4w9WgXcQ -> "dQw4w9WgXcQ").
 *
 * Videos only load the actual YouTube player (and its cookies/tracking)
 * after the person clicks play — before that, it's just a static thumbnail
 * image, which is better for page load and for visitor privacy.
 */
(function () {
  "use strict";

  const styles = `
    .cc-video-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .cc-video-card {
      background: #FBF9F1; border-radius: 10px; overflow: hidden;
      box-shadow: 0 10px 24px -12px rgba(10,39,51,0.35);
      border: 1px solid rgba(10,39,51,0.08);
    }
    .cc-video-thumb-btn {
      position: relative; display: block; width: 100%; aspect-ratio: 16/9;
      border: none; padding: 0; margin: 0; cursor: pointer; background: #0A2733;
    }
    .cc-video-thumb-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cc-video-play {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(10,39,51,0.25); transition: background 0.15s ease;
    }
    .cc-video-thumb-btn:hover .cc-video-play { background: rgba(10,39,51,0.4); }
    .cc-video-play svg { width: 56px; height: 56px; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.4)); }
    .cc-video-frame { width: 100%; aspect-ratio: 16/9; border: none; display: block; }
    .cc-video-meta { padding: 14px 16px 16px; }
    .cc-video-title { font-size: 0.95rem; font-weight: 700; color: #0A2733; margin: 0 0 6px; line-height: 1.35; }
    .cc-video-credit { font-size: 0.82rem; color: #3C5560; }
    .cc-video-credit a { color: #1E6E79; text-decoration: none; font-weight: 600; }
    .cc-video-credit a:hover { text-decoration: underline; }
    .cc-video-empty { font-size: 0.9rem; color: #3C5560; padding: 20px; text-align: center; }
  `;

  function injectStylesOnce() {
    if (document.getElementById("cc-video-cards-styles")) return;
    const tag = document.createElement("style");
    tag.id = "cc-video-cards-styles";
    tag.textContent = styles;
    document.head.appendChild(tag);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function buildCard(video) {
    const card = document.createElement("div");
    card.className = "cc-video-card";

    const thumbBtn = document.createElement("button");
    thumbBtn.className = "cc-video-thumb-btn";
    thumbBtn.type = "button";
    thumbBtn.setAttribute("aria-label", "Play video: " + video.title);
    thumbBtn.innerHTML = `
      <img src="https://i.ytimg.com/vi/${encodeURIComponent(video.youtubeId)}/hqdefault.jpg" alt="" loading="lazy">
      <span class="cc-video-play">
        <svg viewBox="0 0 68 48"><path d="M66.5 7.7c-.8-2.9-2.5-5.1-5.4-5.9C55.9.2 34 .2 34 .2s-21.9 0-27.1 1.6c-2.9.8-4.6 3-5.4 5.9C.2 12.9.2 24 .2 24s0 11.1 1.3 16.3c.8 2.9 2.5 5.1 5.4 5.9C12.1 47.8 34 47.8 34 47.8s21.9 0 27.1-1.6c2.9-.8 4.6-3 5.4-5.9C67.8 35.1 67.8 24 67.8 24s0-11.1-1.3-16.3z" fill="#C6A044"/><path d="M27 34l18-10-18-10z" fill="#0A2733"/></svg>
      </span>
    `;

    thumbBtn.addEventListener("click", function () {
      const iframe = document.createElement("iframe");
      iframe.className = "cc-video-frame";
      iframe.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.youtubeId) + "?autoplay=1";
      iframe.title = video.title;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      thumbBtn.replaceWith(iframe);
    });

    const meta = document.createElement("div");
    meta.className = "cc-video-meta";
    const creditHtml = video.creatorChannelUrl
      ? `By <a href="${escapeHtml(video.creatorChannelUrl)}" target="_blank" rel="noopener">${escapeHtml(video.creatorName)}</a>`
      : `By ${escapeHtml(video.creatorName)}`;
    meta.innerHTML = `
      <p class="cc-video-title">${escapeHtml(video.title)}</p>
      <p class="cc-video-credit">🎥 ${creditHtml}</p>
    `;

    card.appendChild(thumbBtn);
    card.appendChild(meta);
    return card;
  }

  function render(containerId, videos) {
    injectStylesOnce();
    const container = document.getElementById(containerId);
    if (!container) return;
    container.classList.add("cc-video-grid");
    container.innerHTML = "";

    if (!videos || videos.length === 0) {
      container.innerHTML = '<p class="cc-video-empty">Videos for this page are coming soon.</p>';
      return;
    }

    videos.forEach((video) => container.appendChild(buildCard(video)));
  }

  window.CruisingCoveVideos = { render: render };
})();
