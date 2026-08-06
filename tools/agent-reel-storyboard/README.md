# Cruising Cove — Agent Reel Storyboard

ffmpeg + Pillow project that builds a **~45s / 1080×1920 / 30fps** silent Instagram/Facebook Reel from the **Agent Reel Storyboard** phone-frame HTML (`reel_preview`). Ken Burns on Disney ship stills (landscape cover-crop; **CW 90°** on `07.jpeg` / `09.jpeg` so port stills sit upright), large middle-third navy captions with white outline, and a final agent-card CTA with **CruisingCove.com**.

## Paths

| Item | Path |
|------|------|
| Project | `tools/agent-reel-storyboard/` |
| Export | `tools/agent-reel-storyboard/out/agent-reel-storyboard.mp4` |
| Photos | `tools/agent-reel-storyboard/public/photos/` (`01.jpeg`–`09.jpeg` + portholes) |

## Ship orientation

Most storyboard ship JPEGs are **landscape** with the hull/horizon horizontal. `07.jpeg` and `09.jpeg` are stored sideways (sky on the left); the renderer rotates them **90° clockwise** at load, then scales and cover-crops into 9:16 (Ken Burns zoom). No EXIF transpose.

## Timing (each background holds **two** tip beats @ 3.2s each)

| BG | Time | Background | Tip captions |
|----|------|------------|--------------|
| 1 | 0:00–0:06.4 | 01.jpeg | Booking a Disney cruise?… · 10 reasons families use… |
| 2 | 0:06.4–0:12.8 | 03.jpeg | Same price, always… · They watch the price after you book… |
| 3 | 0:12.8–0:19.2 | 06.jpeg | First in line when booking windows open… · A real human when plans break… |
| 4 | 0:19.2–0:25.6 | 07.jpeg (CW 90°) | Group trips without the group-chat chaos… · They know the fleet, ship by ship… |
| 5 | 0:25.6–0:32.0 | 09.jpeg (CW 90°) | Deck-plan and stateroom insight… · Castaway Club perks, decoded… |
| 6 | 0:32.0–0:38.4 | 02.jpeg | Passport & paperwork peace of mind… · An advocate, start to sail-away… |
| 7 | 0:38.4–0:45.4 | Agent card | Meet your agents · CruisingCove.com/agents · **CruisingCove.com** |

Text is **large**, **navy fill + thick white outline** (readable on bright sand/sky and dark navy), centered in the **middle third**. Agent-card planner portholes are **vertically centered** in the 9:16 frame. Silent export — add audio in Instagram/Facebook after upload.

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
