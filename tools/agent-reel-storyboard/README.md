# Cruising Cove — Agent Reel Storyboard

ffmpeg + Pillow project that builds a **~45s / 1080×1920 / 30fps** silent Instagram/Facebook Reel from the **Agent Reel Storyboard** phone-frame HTML (`reel_preview`). Ken Burns on upright Disney ship stills (landscape cover-crop — **no 90° rotation**), large middle-third outlined captions, and a final agent-card CTA with **CruisingCove.com**.

## Paths

| Item | Path |
|------|------|
| Project | `tools/agent-reel-storyboard/` |
| Export | `tools/agent-reel-storyboard/out/agent-reel-storyboard.mp4` |
| Photos | `tools/agent-reel-storyboard/public/photos/` (`01.jpeg`–`09.jpeg` + portholes) |

## Ship orientation

All storyboard ship JPEGs are **landscape** with the hull/horizon horizontal and funnels upright. The renderer **never** rotates or EXIF-transposes them — it only scales and center-crops into 9:16 (Ken Burns zoom). Bow/hull stay horizontal like a normal beach/port photo.

## Timing (from storyboard `DURATION = 3200ms`, last slide ×2.2)

| # | Time | Background | Caption |
|---|------|------------|---------|
| 1 | 0:00–0:03.2 | 01.jpeg | Booking a Disney cruise? / Here's why families / never do it alone. |
| 2 | 0:03.2–0:06.4 | 02.jpeg | 10 reasons families use / a Disney-specialist agent / — and it costs nothing extra. |
| 3 | 0:06.4–0:09.6 | 03.jpeg | Same price, always / … |
| 4 | 0:09.6–0:12.8 | 04.jpeg | They watch the price after you book |
| 5 | 0:12.8–0:16.0 | 05.jpeg | First in line when booking windows open |
| 6 | 0:16.0–0:19.2 | 06.jpeg | A real human when plans break |
| 7 | 0:19.2–0:22.4 | 07.jpeg | Group trips without the group-chat chaos |
| 8 | 0:22.4–0:25.6 | 08.jpeg | They know the fleet, ship by ship |
| 9 | 0:25.6–0:28.8 | 09.jpeg | Deck-plan and stateroom insight |
| 10 | 0:28.8–0:32.0 | 01.jpeg | Castaway Club perks, decoded |
| 11 | 0:32.0–0:35.2 | 02.jpeg | Passport & paperwork peace of mind |
| 12 | 0:35.2–0:38.4 | 03.jpeg | An advocate, start to sail-away |
| 13 | 0:38.4–0:45.4 | Agent card | Meet your agents · CruisingCove.com/agents · **CruisingCove.com** |

Text is **large**, white with a strong black outline + shadow, centered in the **middle third**. Silent export — add audio in Instagram/Facebook after upload.

## Commands

```bash
cd tools/agent-reel-storyboard
python3 scripts/render_ffmpeg.py   # → out/agent-reel-storyboard.mp4
```

Requires: `ffmpeg`, `ffprobe`, Python 3, Pillow (`pip install Pillow`).

## Notes

- Specs: 1080×1920, 30fps, H.264 mp4, `+faststart`, no audio
- Photos extracted from the storyboard HTML data URIs
- This folder is a build tool — not linked from the live site homepage
