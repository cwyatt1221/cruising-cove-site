# DisneyBand+ Instagram Reel

Remotion project that builds a **45s / 1080×1920 / 30fps** silent Instagram Reel from still photos with Ken Burns pan/zoom and timed text overlays.

## Paths

| Item | Path |
|------|------|
| Project | `tools/disneyband-reel/` |
| Export | `tools/disneyband-reel/out/disneyband-reel.mp4` |
| Photos | `tools/disneyband-reel/public/photos/` |

## Photo mapping (current)

No dedicated DisneyBand+ product close-ups were found on Desktop/Downloads/site assets. These slots use the best available **cruise stills where a band is visible on a wrist**, plus a closing ship wide. Replace any file below (keep the filename) and re-render.

| Slot | File | Source / notes |
|------|------|----------------|
| 1 Hook | `01-hook.jpeg` | Welcome aboard_10 — boy + blue band by ship model |
| 2 Room key | `02-room-key.jpeg` | Welcome aboard — couple; red + dark bands |
| 3 Payments | `03-payments.jpeg` | Welcome aboard_2 — both wrists with bands |
| 4 Detail | `04-detail.jpeg` | Welcome aboard_3 — white patterned band on boy |
| 5 Extra | `05-glow.jpeg` | Welcome aboard_15 — family + ship model, blue band |
| 6 Variety | `06-variety.jpeg` | Chewbacca_3 — portrait; band on wrist |
| 7 Multiple | `07-multiple.jpeg` | Chewbacca family — white + dark bands |
| 8 Relaxed | `08-relaxed.jpeg` | Moana hug — blue band on wrist |
| 9 Closing | `09-closing.jpg` | Wish at Castaway Cay pier (gallery) |

Ideal upgrades (if you shoot/export them later): true band close-up on wrist for slot 1, band at cabin door for 2, band at a register/bar for 3, lit/glowing band for 4–5, color/design flat lays for 6–7.

## Timing (spec)

| Scene | Time | Photos | Text |
|-------|------|--------|------|
| 1 | 0:00–0:04 | 1 | Hook line |
| 2 | 0:04–0:12 | 2 → 3 | Room key / payments / wrist (split) |
| 3 | 0:12–0:20 | 4 → 5 | DisneyBand+ explainer (split) |
| 4 | 0:20–0:30 | 6 → 7 | Colors / designs (split) |
| 5 | 0:30–0:38 | 8 | Hands-free / relaxing (split) |
| 6 | 0:38–0:45 | 9 | Save this CTA |

## Commands

### Remotion (preferred for preview / iteration)

```bash
cd tools/disneyband-reel
npm install
npm start          # Remotion Studio preview
npm run render     # → out/disneyband-reel.mp4
```

Or explicitly:

```bash
npx remotion render DisneyBandReel out/disneyband-reel.mp4
```

### Pillow + ffmpeg fallback (used for the checked-in export)

If Chrome/Remotion can’t launch in your environment:

```bash
cd tools/disneyband-reel
python3 scripts/render_ffmpeg.py   # → out/disneyband-reel.mp4
```

Requires: `ffmpeg`, Python 3, Pillow (`pip install Pillow`).

## Audio

Export is **silent** on purpose (Instagram trending audio can’t be fetched programmatically / licensing). Add your track in Instagram Reels after upload, or drop a royalty-free `.mp3` into `public/` and wire an `<Audio>` in `DisneyBandReel.tsx` if you want it baked in.

## Notes

- Composition id: `DisneyBandReel`
- Motion: zoom 100% → ~108–112%, alternating L→R / R→L pan, ease-in-out
- Text: Montserrat SemiBold ~68px, white on semi-transparent bar, bottom third (~150px from bottom); CTA uses center
- This folder is a build tool — not linked from the live site homepage
