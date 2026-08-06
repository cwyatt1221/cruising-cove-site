# Travel Agents + Marketplace Announce Reel

ffmpeg + Pillow project that builds a **~42s / 1080×1920 / 30fps** silent Instagram/Facebook Reel announcing Cruising Cove’s four free Travel Agents and the first Marketplace shop for Disney cruise decor. Ken Burns motion on a Castaway Cay still, large middle-third outlined captions, and a ~2s end card emphasizing **CruisingCove.com**.

## Paths

| Item | Path |
|------|------|
| Project | `tools/agents-marketplace-announce-reel/` |
| Export | `tools/agents-marketplace-announce-reel/out/agents-marketplace-announce-reel.mp4` |
| Photo | `tools/agents-marketplace-announce-reel/public/photos/castaway-cay-ship.png` |

## Photo

Disney ship at **Castaway Cay** / private island beach — palms framing the hull, turquoise lagoon, beach umbrellas. Source is a landscape still (~1024×768). Ken Burns crop keeps ship + beach as the hero (centered on the ship between the palms).

## Timing (text overlays)

| Scene | Time | Text |
|-------|------|------|
| 1 Hook | 0:00–0:04.5 | Big news, friends — / say goodbye to / midnight reservation panic! 🎉 |
| 2 Agents | 0:04.5–0:09.5 | We've added four Travel Agents / to help plan your cruise — / and it's 100% free to you! |
| 3 Reservations | 0:09.5–0:14 | No more midnight alarms / for Royal Gathering / or brunch at Palo |
| 4 Sleep | 0:14–0:18.5 | Let our agents do the heavy lifting / while you catch some sleep 😴✨ |
| 5 Marketplace | 0:18.5–0:23.5 | And that's not all! / Welcome our first Marketplace / for Disney cruise decor |
| 6 Products | 0:23.5–0:28.5 | Porthole magnets, / door decorations, / stateroom surprises — / we've got you covered! |
| 7 CTA links | 0:28.5–0:34 | 👉 Head to CruisingCove.com / Articles · Marketplace / · Find an Agent |
| 8 Close | 0:34–0:40 | Let's make your next cruise / the easiest one yet! ⚓🚢 |
| 9 End card | 0:40–0:42 (~2s) | **CruisingCove.com** |

Text is **large**, white with a strong black outline + shadow, centered in the **middle third** of the frame (readable over bright beach/ship lighting; away from Instagram/Facebook UI chrome).

## Commands

```bash
cd tools/agents-marketplace-announce-reel
python3 scripts/render_ffmpeg.py   # → out/agents-marketplace-announce-reel.mp4
```

Requires: `ffmpeg`, `ffprobe`, Python 3, Pillow (`pip install Pillow`).

## Audio

Export is **silent** on purpose. Add your track in Instagram/Facebook Reels after upload.

## Notes

- Specs: 1080×1920, 30fps, H.264 mp4, `+faststart`
- Motion: one continuous Ken Burns path in `scripts/render_ffmpeg.py`
- This folder is a build tool — not linked from the live site homepage
