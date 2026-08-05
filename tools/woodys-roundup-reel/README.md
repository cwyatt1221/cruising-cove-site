# Woody's Roundup Breakfast Instagram Reel

ffmpeg + Pillow project that builds a **1080×1920 / 30fps** Instagram Reel about Woody's Roundup Breakfast (officially **Hey Howdy Breakfast with Woody and Friends**) at Animator's Palate on Disney Fantasy Pixar Day at Sea sailings — large middle-third text overlays and a **cruisingcove.com** end card.

## Paths

| Item | Path |
|------|------|
| Project | `tools/woodys-roundup-reel/` |
| Export | `tools/woodys-roundup-reel/out/woodys-roundup-reel.mp4` |
| Source video | `tools/woodys-roundup-reel/public/source.mp4` |
| Still (fallback) | `tools/woodys-roundup-reel/public/photos/woodys-roundup-breakfast.png` |

## Source

Renders from the real footage at `public/source.mp4` (video mode; original audio kept when present). If that file is missing, falls back to a Ken Burns pan/zoom from the still.

## Timing (text overlays)

Content beats share the clip evenly before the ~2s end card (times scale with source duration; ~28s clip shown):

| Scene | Time | Text |
|-------|------|------|
| 1 Hook | ~0.0–6.5s | Hey Howdy Breakfast / Woody's Roundup |
| 2 Where | ~6.5–13.0s | Animator's Palate / Pixar Day at Sea / on Disney Fantasy |
| 3 Vibe | ~13.0–19.4s | Meet Woody & friends / for a festive / character breakfast |
| 4 Urgency | ~19.4–25.9s | Reservations go FAST — / book as soon as / your window opens |
| 5 End card | last **~2.0s** | Follow cruisingcove.com / for more fun info |

Text is **large**, white with a strong black outline + shadow, centered in the **middle third** of the frame (away from Instagram UI chrome).

## Commands

```bash
cd tools/woodys-roundup-reel
python3 scripts/render_ffmpeg.py   # → out/woodys-roundup-reel.mp4
```

Requires: `ffmpeg`, `ffprobe`, Python 3, Pillow (`pip install Pillow`).

## Notes

- Specs: 1080×1920, 30fps, H.264 mp4, `+faststart`
- Experience is on **Disney Fantasy** Pixar Day at Sea sailings only (not Dream / Wish-class)
- This folder is a build tool — not linked from the live site homepage
