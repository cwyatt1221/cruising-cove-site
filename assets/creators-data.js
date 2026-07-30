/**
 * Cruising Cove — Founding Cruise Experts (creators).
 * Set CC_CREATORS_ENABLED to true when YouTube partners are live.
 */
window.CC_CREATORS_ENABLED = false;

window.CC_CREATORS = [
  // Empty until real creators are approved.
];

window.CC_videosForPlacement = function (placement) {
  if (window.CC_CREATORS_ENABLED === false) return [];
  var out = [];
  (window.CC_CREATORS || []).forEach(function (c) {
    (c.videos || []).forEach(function (v) {
      if (v.placement === placement) {
        out.push({
          creatorId: c.id,
          creatorName: c.name,
          channel: c.channel,
          youtubeUrl: c.youtubeUrl,
          title: v.title,
          youtubeId: v.youtubeId,
          videoId: v.id,
        });
      }
    });
  });
  return out;
};
