# Woody's Roundup Breakfast Instagram Reel

ffmpeg + Pillow project that builds a **1080×1920 / 30fps** Instagram Reel about Woody's Roundup Breakfast (officially **Hey Howdy Breakfast with Woody and Friends**) at Animator's Palate on Disney Fantasy Pixar Day at Sea sailings — large middle-third text overlays and a **cruisingcove.com** end card.

## Paths

| Item | Path |
|------|------|
| Project | `tools/woodys-roundup-reel/` |
| Export | `tools/woodys-roundup-reel/out/woodys-roundup-reel.mp4` |
| Still (used) | `tools/woodys-roundup-reel/public/photos/woodys-roundup-breakfast.png` |
| Video (optional) | `tools/woodys-roundup-reel/public/video/source.mp4` |

## Source

The Cursor attachment arrived as a **still** (Animator's Palate / Bullseye). No matching `.mov`/`.mp4` was found under Desktop, Downloads, or Movies for UUID stem `19366427-3D5C-4CF9-B1E2-374F7C195A85`.

- **Current render:** Ken Burns pan/zoom from the still (~22s, silent).
- **To re-render from real footage:** drop an H.264 clip at `public/video/source.mp4` and run the script again (video mode takes priority; original audio is kept when present).

## Timing (text overlays)

| Scene | Time | Text |
|-------|------|------|
| 1 | first half of content | Woody's Roundup Breakfast at Animator's Palate |
| 2 | second half of content | Meet Bullseye & friends — Pixar Day at Sea energy |
| 3 (end card) | last **~2.0s** | Follow cruisingcove.com for more Disney cruise tips |

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
