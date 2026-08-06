# Midnight Panic — Travel Agents + Marketplace Reel

ffmpeg + Pillow project that builds a **~40s / 1080×1920 / 30fps** silent Instagram/Facebook Reel announcing Cruising Cove Travel Agents (free) and the first Marketplace shop for Disney cruise decor. Ken Burns motion on a Castaway Cay still, large middle-third outlined captions, and a ~2s end card.

## Paths

| Item | Path |
|------|------|
| Project | `tools/midnight-panic-reel/` |
| Export | `tools/midnight-panic-reel/out/midnight-panic-reel.mp4` |
| Photo | `tools/midnight-panic-reel/public/photos/castaway-cay-ship.png` |

## Photo

Disney ship at **Castaway Cay** / private island beach — palms, turquoise lagoon, umbrellas, dramatic sky. Source is a landscape still (~1024×768). No matching `.mp4`/`.mov` was found, so the export uses a continuous Ken Burns zoom/pan on this still.

## Timing (text overlays)

| Scene | Time | Text |
|-------|------|------|
| 1 Hook | 0:00–0:05 | Big news — / say goodbye to / midnight reservation panic! 🎉 |
| 2 Agents | 0:05–0:11 | We've added three / Travel Agents to our team — / and it's 100% free to you! |
| 3 Sleep | 0:11–0:19 | No more midnight alarms / for Royal Gathering or Palo — / let our agents handle it / while you sleep 😴✨ |
| 4 Marketplace | 0:19–0:25 | And that's not all — / welcome our first Marketplace / for Disney cruise decor! |
| 5 Products | 0:25–0:31 | Porthole magnets, / door decorations, / stateroom surprises — / we've got you covered! |
| 6 CTA | 0:31–0:38 | Head to CruisingCove.com / Articles · Marketplace / · Find an Agent |
| 7 End card | 0:38–0:40 (~2s) | Let's make your next cruise / the easiest one yet! ⚓🚢 / CruisingCove.com |

Text is **large**, white with a strong black outline + shadow, centered in the **middle third** of the frame (readable over bright outdoor beach/ship lighting; away from Instagram UI chrome).

## Commands

```bash
cd tools/midnight-panic-reel
python3 scripts/render_ffmpeg.py   # → out/midnight-panic-reel.mp4
```

Requires: `ffmpeg`, `ffprobe`, Python 3, Pillow (`pip install Pillow`).

## Audio

Export is **silent** on purpose. Add your track in Instagram/Facebook Reels after upload.

## Notes

- Specs: 1080×1920, 30fps, H.264 mp4, `+faststart`
- Motion: one continuous Ken Burns path in `scripts/render_ffmpeg.py`
- This folder is a build tool — not linked from the live site homepage
