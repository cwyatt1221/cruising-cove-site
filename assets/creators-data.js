/**
 * Cruising Cove — Founding Cruise Experts (creators).
 * Add approved partners here. Videos are placed on matching guide pages.
 *
 * creator shape:
 * {
 *   id, name, channel, youtubeUrl, bio, specialties: string[],
 *   videos: [{ id, title, youtubeId, placement: 'ship:disney-wish' | 'port:castaway-cay' | 'planning' | 'home' }]
 * }
 */
window.CC_CREATORS = [
  // Empty until real creators are approved. Example structure:
  // {
  //   id: "example-creator",
  //   name: "Example Creator",
  //   channel: "Example Cruises",
  //   youtubeUrl: "https://www.youtube.com/@example",
  //   bio: "Short bio for the profile page.",
  //   specialties: ["Wish-class", "First-timers"],
  //   videos: [
  //     {
  //       id: "wish-tour",
  //       title: "Disney Wish full ship tour",
  //       youtubeId: "dQw4w9WgXcQ",
  //       placement: "ship:disney-wish"
  //     }
  //   ]
  // }
];

window.CC_videosForPlacement = function (placement) {
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
          videoId: v.id
        });
      }
    });
  });
  return out;
};
