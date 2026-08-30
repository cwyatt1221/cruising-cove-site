# DisneyBand+ Instagram Reel

Remotion project that builds a **45s / 1080×1920 / 30fps** silent Instagram Reel from a **single still** with a continuous Ken Burns journey (boy → DisneyBand+) and timed text overlays.

## Paths

| Item | Path |
|------|------|
| Project | `tools/disneyband-reel/` |
| Export | `tools/disneyband-reel/out/disneyband-reel.mp4` |
| Photo | `tools/disneyband-reel/public/photos/boy-disneyband.png` |

## Photo

Sole asset: square meet-and-greet still of a smiling boy (Star Wars Vader shirt, thumbs up) wearing a **white Stormtrooper DisneyBand+** on his right wrist (viewer’s left). Adults on the sides are cropped out by the 9:16 Ken Burns path.

Source resolution is **400×410** — zoom is capped (~2× cover) so the Stormtrooper puck stays readable rather than pixel mush.

## Motion path (45s continuous)

| Time | Camera |
|------|--------|
| 0–4s | Medium 9:16 on boy’s face/torso; band visible but not hero |
| 4–40s | Progressive zoom/pan toward the Stormtrooper wristband puck |
| 40–45s | Hold on clear band framing for CTA text |

## Timing (text overlays)

| Scene | Time | Text |
|-------|------|------|
| 1 | 0:00–0:04 | Hook line |
| 2 | 0:04–0:12 | Room key / payments / wrist (split) |
| 3 | 0:12–0:20 | DisneyBand+ explainer (split) |
| 4 | 0:20–0:30 | Colors / designs (split) |
| 5 | 0:30–0:38 | Hands-free / relaxing (split) |
| 6 | 0:38–0:45 | Save this CTA |

## Commands

### Remotion (preferred for preview / iteration)

```bash
cd tools/disneyband-reel
npm install
npm start          # Remotion Studio preview
npm run render     # → out/disneyband-reel.mp4
```

### Pillow + ffmpeg fallback (used for the checked-in export)

```bash
cd tools/disneyband-reel
python3 scripts/render_ffmpeg.py   # → out/disneyband-reel.mp4
```

Requires: `ffmpeg`, Python 3, Pillow (`pip install Pillow`).

## Audio

Export is **silent** on purpose. Add your track in Instagram Reels after upload, or drop a royalty-free `.mp3` into `public/` and wire an `<Audio>` in `DisneyBandReel.tsx`.

## Notes

- Composition id: `DisneyBandReel`
- Motion: one continuous Ken Burns path (see `src/photos.ts` / `scripts/render_ffmpeg.py`)
- Text: Montserrat SemiBold ~68px, white on semi-transparent bar, bottom third; CTA uses center
- This folder is a build tool — not linked from the live site homepage
