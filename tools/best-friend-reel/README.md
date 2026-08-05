# Best Friend Instagram Reel

ffmpeg + Pillow project that builds a **~20s / 1080×1920 / 30fps** Instagram Reel from a vertical iPhone clip of kids making friends, with large middle-third text overlays and a **cruisingcove.com** end card.

## Paths

| Item | Path |
|------|------|
| Project | `tools/best-friend-reel/` |
| Export | `tools/best-friend-reel/out/best-friend-reel.mp4` |
| Source | `tools/best-friend-reel/public/video/source.mp4` |

## Source

Vertical iPhone clip (`IMG_8834.mov`, already **1080×1920 @ 30fps**, ~20.1s). Re-encoded H.264/AAC into `public/video/source.mp4` for re-renders. Raw `.mpg` from Downloads is **not** committed (larger / redundant).

## Timing (text overlays)

| Scene | Time | Text |
|-------|------|------|
| 1 | ~0:00–0:09 | My son made a new best friend today. |
| 2 | ~0:09–0:18 | Your family could be making memories like this too. |
| 3 (end card) | last **~2.0s** | Learn more at cruisingcove.com 🐾🚢 |

Text is **large**, white with a strong black outline, centered in the **middle third** of the frame (away from Instagram UI chrome).

## Commands

```bash
cd tools/best-friend-reel
python3 scripts/render_ffmpeg.py   # → out/best-friend-reel.mp4
```

Requires: `ffmpeg`, `ffprobe`, Python 3, Pillow (`pip install Pillow`).

## Audio

Original audio from the source clip is kept when present.

## Notes

- Specs: 1080×1920, 30fps, H.264 mp4, `+faststart`
- This folder is a build tool — not linked from the live site homepage
