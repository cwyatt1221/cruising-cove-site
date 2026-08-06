#!/usr/bin/env python3
"""
Cruising Cove — Agent Reel Storyboard export.
Source: reel_preview storyboard HTML (phone-frame preview).

Landscape ship stills → 1080×1920 Ken Burns crop (NO rotation / transpose).
Large middle-third white captions with black outline. Silent H.264 mp4.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PHOTOS = ROOT / "public" / "photos"
FONT_PATH = ROOT / "public" / "fonts" / "Montserrat-SemiBold.ttf"
OUT = ROOT / "out" / "agent-reel-storyboard.mp4"

W, H, FPS = 1080, 1920, 30
SLIDE_S = 3.2  # matches storyboard DURATION = 3200ms
CARD_S = SLIDE_S * 2.2  # storyboard holds final card longer
TEXT_CENTER_Y = int(H * 0.50)
FADE_IN = 0.28
FADE_OUT = 0.22

# Brand (storyboard CSS)
NAVY = (11, 42, 74, 255)
DEEP = (7, 26, 46, 255)
BRASS = (201, 162, 75, 255)
CREAM = (245, 239, 227, 255)

# shipAt(i) = SHIPS[i % 9] — same cycling as the HTML
SHIPS = [
    "01.jpeg",
    "02.jpeg",
    "03.jpeg",
    "04.jpeg",
    "05.jpeg",
    "06.jpeg",
    "07.jpeg",
    "08.jpeg",
    "09.jpeg",
]

# Per-ship Ken Burns focus (fx, fy) — keep hull horizontal / funnels up.
# No rotation: landscape cover-crop only.
SHIP_FOCUS: dict[str, tuple[float, float]] = {
    "01.jpeg": (0.48, 0.42),  # bow + Mickey radar
    "02.jpeg": (0.52, 0.48),  # red funnel + Mickey logo
    "03.jpeg": (0.42, 0.40),  # ship mid/bow
    "04.jpeg": (0.50, 0.42),
    "05.jpeg": (0.50, 0.44),
    "06.jpeg": (0.50, 0.38),  # Castaway Cay ship between palms
    "07.jpeg": (0.50, 0.40),
    "08.jpeg": (0.48, 0.42),
    "09.jpeg": (0.50, 0.42),
}

# (ship_index, caption lines, font_size) — photo slides
PHOTO_SCENES: list[tuple[int, list[str], int]] = [
    (
        0,
        ["Booking a Disney cruise?", "Here's why families", "never do it alone."],
        58,
    ),
    (
        1,
        [
            "10 reasons families use",
            "a Disney-specialist agent",
            "— and it costs nothing extra.",
        ],
        52,
    ),
    (
        2,
        [
            "Same price, always",
            "You pay the exact fare as booking direct —",
            "Disney pays the agent's commission, not you.",
        ],
        48,
    ),
    (
        3,
        [
            "They watch the price",
            "after you book",
            "Rate drops → rebook or onboard credit.",
        ],
        54,
    ),
    (
        4,
        [
            "First in line when",
            "booking windows open",
            "Palo, Remy, cabanas & excursions.",
        ],
        54,
    ),
    (
        5,
        [
            "A real human when",
            "plans break",
            "Flights, docs, last-minute surprises.",
        ],
        56,
    ),
    (
        6,
        [
            "Group trips without",
            "the group-chat chaos",
            "Multi-cabin paperwork, one contact.",
        ],
        54,
    ),
    (
        7,
        [
            "They know the fleet,",
            "ship by ship",
            "Itinerary & stateroom that fit your family.",
        ],
        54,
    ),
    (
        8,
        [
            "Deck-plan and",
            "stateroom insight",
            "Connecting rooms, quiet halls, upgrades.",
        ],
        54,
    ),
    (
        9,
        [
            "Castaway Club perks,",
            "decoded",
            "What your tier unlocks — and how to use it.",
        ],
        54,
    ),
    (
        10,
        [
            "Passport & paperwork",
            "peace of mind",
            "Disney-specific requirements, handled early.",
        ],
        52,
    ),
    (
        11,
        [
            "An advocate,",
            "start to sail-away",
            "From deposit day through the final day.",
        ],
        56,
    ),
]

AGENTS = [
    ("porthole1.png", "Rebekah Lukins", "Best Day Ever with Bek · Chicago, IL"),
    ("porthole2.png", "Shana Matos", "Friend Like Me Travel Co · Remote"),
    ("porthole3.png", "Donna Walters", "EnchantAway Travel · Celebration, FL"),
    ("porthole4.png", "Kim Fanning", "Magical World Vacations · Jackson, NJ"),
]


def probe_duration(path: Path) -> float:
    raw = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            str(path),
        ],
        text=True,
    )
    return float(json.loads(raw)["format"]["duration"])


def load_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size=size)


def wrap_lines(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    for word in words:
        trial = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [text]


def draw_outlined_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    outline_w: int = 7,
) -> None:
    x, y = xy
    outline = (0, 0, 0, 255)
    fill = (255, 255, 255, 255)
    for dx in range(-outline_w, outline_w + 1):
        for dy in range(-outline_w, outline_w + 1):
            if dx == 0 and dy == 0:
                continue
            if dx * dx + dy * dy > outline_w * outline_w:
                continue
            draw.text((x + dx, y + dy), text, font=font, fill=outline)
    draw.text((x + 2, y + 3), text, font=font, fill=(0, 0, 0, 200))
    draw.text((x, y), text, font=font, fill=fill)


def render_caption_png(lines: list[str], font_size: int, out_path: Path) -> None:
    font = load_font(font_size)
    max_w = W - 100
    wrapped: list[str] = []
    for line in lines:
        wrapped.extend(wrap_lines(line, font, max_w))

    probe = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(probe)
    line_gap = 14
    sizes = []
    for line in wrapped:
        bbox = draw.textbbox((0, 0), line, font=font)
        sizes.append((bbox[2] - bbox[0], bbox[3] - bbox[1]))
    text_h = sum(h for _, h in sizes) + line_gap * max(0, len(wrapped) - 1)

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    y = TEXT_CENTER_Y - text_h // 2
    for line, (lw, lh) in zip(wrapped, sizes):
        x = (W - lw) // 2
        draw_outlined_text(draw, (x, y), line, font)
        y += lh + line_gap
    layer.save(out_path)


def ease_in_out_quad(t: float) -> float:
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    if t < 0.5:
        return 2 * t * t
    return 1 - (-2 * t + 2) ** 2 / 2


def cover_crop_upright(
    img: Image.Image, scale: float, fx: float, fy: float
) -> Image.Image:
    """Scale+crop landscape (or any) still into 9:16. Never rotate/transpose."""
    src_w, src_h = img.size
    # Guard: if somehow handed a sideways portrait of a landscape scene
    # (w < h but content looks wrong), we still do NOT rotate — only crop.
    base = max(W / src_w, H / src_h)
    s = base * scale
    nw, nh = int(round(src_w * s)), int(round(src_h * s))
    resized = img.resize((nw, nh), Image.Resampling.LANCZOS)
    cx = fx * nw
    cy = fy * nh
    left = int(round(cx - W / 2))
    top = int(round(cy - H / 2))
    left = max(0, min(left, nw - W))
    top = max(0, min(top, nh - H))
    return resized.crop((left, top, left + W, top + H))


def make_scrim() -> Image.Image:
    """Soft radial darkening so middle-third captions stay readable."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    # vertical vignette
    for i in range(H):
        # stronger at top/bottom, lighter mid
        d = abs(i - H / 2) / (H / 2)
        a = int(40 + 90 * (d**1.4))
        draw.line([(0, i), (W, i)], fill=(7, 26, 46, a))
    return layer.filter(ImageFilter.GaussianBlur(radius=1))


def text_alpha(local_t: float, duration: float) -> float:
    if local_t < FADE_IN:
        return local_t / FADE_IN
    if local_t > duration - FADE_OUT:
        return max(0.0, (duration - local_t) / FADE_OUT)
    return 1.0


def render_agent_card() -> Image.Image:
    """Final storyboard card: Meet your agents + portholes + CruisingCove URL."""
    img = Image.new("RGBA", (W, H), NAVY)
    draw = ImageDraw.Draw(img)

    # Subtle diagonal texture
    for x in range(-H, W, 34):
        draw.line([(x, 0), (x + H, H)], fill=(255, 255, 255, 8), width=1)

    # Soft teal / brass glows
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-200, -280, 700, 520], fill=(28, 110, 140, 70))
    gd.ellipse([500, 1400, 1300, 2100], fill=(201, 162, 75, 40))
    img = Image.alpha_composite(img, glow)
    draw = ImageDraw.Draw(img)

    eyebrow_font = load_font(28)
    title_font = load_font(52)
    name_font = load_font(30)
    role_font = load_font(20)
    brand_font = load_font(44)
    url_font = load_font(36)

    # Eyebrow
    eyebrow = "MEET YOUR AGENTS"
    bbox = draw.textbbox((0, 0), eyebrow, font=eyebrow_font)
    ew = bbox[2] - bbox[0]
    ex = (W - ew) // 2
    ey = 140
    draw.ellipse([ex - 22, ey + 10, ex - 10, ey + 22], fill=(225, 103, 60, 255))
    draw.text((ex, ey), eyebrow, font=eyebrow_font, fill=BRASS)

    title = "Disney-specialist planners"
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, ey + 48), title, font=title_font, fill=CREAM)

    # 2×2 porthole grid
    cell_w = 420
    gap_x = 40
    gap_y = 36
    grid_w = cell_w * 2 + gap_x
    grid_left = (W - grid_w) // 2
    grid_top = 280
    hole_size = 280

    for i, (fname, name, role) in enumerate(AGENTS):
        col, row = i % 2, i // 2
        cx = grid_left + col * (cell_w + gap_x) + cell_w // 2
        top = grid_top + row * (hole_size + 110 + gap_y)

        ph = Image.open(PHOTOS / fname).convert("RGBA")
        ph = ph.resize((hole_size, hole_size), Image.Resampling.LANCZOS)
        img.paste(ph, (cx - hole_size // 2, top), ph)

        nb = draw.textbbox((0, 0), name, font=name_font)
        nw = nb[2] - nb[0]
        ny = top + hole_size + 14
        draw.text((cx - nw // 2, ny), name, font=name_font, fill=CREAM)

        # wrap role
        role_lines = wrap_lines(role, role_font, cell_w - 20)
        ry = ny + 36
        for rl in role_lines:
            rb = draw.textbbox((0, 0), rl, font=role_font)
            rw = rb[2] - rb[0]
            draw.text((cx - rw // 2, ry), rl, font=role_font, fill=BRASS)
            ry += 26

    # Footer brand + URL (storyboard: cruisingcove.com/agents)
    brand = "Cruising Cove"
    bb = draw.textbbox((0, 0), brand, font=brand_font)
    bw = bb[2] - bb[0]
    by = H - 280
    draw.text(((W - bw) // 2, by), brand, font=brand_font, fill=BRASS)

    url = "CruisingCove.com/agents"
    ub = draw.textbbox((0, 0), url, font=url_font)
    uw = ub[2] - ub[0]
    draw_outlined_text(draw, ((W - uw) // 2, by + 64), url, url_font, outline_w=5)

    cta = "CruisingCove.com"
    cf = load_font(40)
    cb = draw.textbbox((0, 0), cta, font=cf)
    cw = cb[2] - cb[0]
    draw_outlined_text(draw, ((W - cw) // 2, by + 120), cta, cf, outline_w=5)

    return img


def active_beat(beats: list[dict], t: float, frame: int, total: int) -> dict:
    for b in beats:
        if b["start"] <= t < b["end"]:
            return b
    if frame == total - 1:
        return beats[-1]
    return beats[-1]


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if not FONT_PATH.exists():
        print(f"Missing font: {FONT_PATH}", file=sys.stderr)
        return 1

    for name in SHIPS:
        if not (PHOTOS / name).exists():
            print(f"Missing photo: {PHOTOS / name}", file=sys.stderr)
            return 1
    for fname, _, _ in AGENTS:
        if not (PHOTOS / fname).exists():
            print(f"Missing porthole: {PHOTOS / fname}", file=sys.stderr)
            return 1

    # Build explicit timing
    beats: list[dict] = []
    t = 0.0
    for ship_i, lines, fsize in PHOTO_SCENES:
        ship = SHIPS[ship_i % len(SHIPS)]
        beats.append(
            {
                "kind": "photo",
                "ship": ship,
                "start": t,
                "end": t + SLIDE_S,
                "lines": lines,
                "font_size": fsize,
            }
        )
        t += SLIDE_S
    beats.append({"kind": "card", "ship": None, "start": t, "end": t + CARD_S})
    duration_s = t + CARD_S
    total = int(round(duration_s * FPS))

    print(f"Duration: {duration_s:.2f}s @ {FPS}fps ({total} frames)")
    print("Orientation: landscape cover-crop only (ships stay upright — no rotate)")
    for i, b in enumerate(beats, start=1):
        if b["kind"] == "photo":
            print(
                f"  {i:02d} {b['start']:.1f}–{b['end']:.1f}s  [{b['ship']}]  "
                f"{' / '.join(b['lines'])}"
            )
        else:
            print(
                f"  {i:02d} {b['start']:.1f}–{b['end']:.1f}s  [agent card]  "
                f"CruisingCove.com/agents"
            )

    # Preload stills (RGB, no EXIF transpose that would sideways-rotate content)
    stills: dict[str, Image.Image] = {}
    for name in SHIPS:
        im = Image.open(PHOTOS / name).convert("RGB")
        # Explicitly do NOT call ImageOps.exif_transpose / rotate.
        # Storyboard JPEGs are already upright landscape (hull horizontal).
        sw, sh = im.size
        if sw < sh:
            print(
                f"WARNING: {name} is portrait ({sw}×{sh}); "
                f"still cropping without rotation.",
                file=sys.stderr,
            )
        stills[name] = im
        print(f"  loaded {name}: {sw}×{sh} (upright landscape crop)")

    scrim = make_scrim()
    card = render_agent_card()

    with tempfile.TemporaryDirectory(prefix="agent-reel-") as tmp:
        tmp_path = Path(tmp)
        overlays: list[tuple[Image.Image, float, float]] = []
        for i, b in enumerate(beats):
            if b["kind"] != "photo":
                continue
            p = tmp_path / f"cap{i}.png"
            render_caption_png(b["lines"], b["font_size"], p)
            overlays.append((Image.open(p).convert("RGBA"), b["start"], b["end"]))

        cmd = [
            "ffmpeg",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "rgb24",
            "-s",
            f"{W}x{H}",
            "-r",
            str(FPS),
            "-i",
            "-",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "high",
            "-crf",
            "18",
            "-movflags",
            "+faststart",
            "-an",
            str(OUT),
        ]
        print(f"Rendering {total} frames → {OUT}")
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        assert proc.stdin is not None

        try:
            for frame in range(total):
                t = frame / FPS
                beat = active_beat(beats, t, frame, total)

                if beat["kind"] == "card":
                    base = card.copy()
                else:
                    ship = beat["ship"]
                    src = stills[ship]
                    fx, fy = SHIP_FOCUS.get(ship, (0.50, 0.42))
                    local = (t - beat["start"]) / max(beat["end"] - beat["start"], 1e-9)
                    # HTML kenburns: scale 1.12 → 1.00
                    scale = 1.12 - 0.12 * ease_in_out_quad(local)
                    # tiny drift toward center of interest
                    fx2 = fx + 0.02 * ease_in_out_quad(local)
                    fy2 = fy - 0.03 * ease_in_out_quad(local)
                    base = cover_crop_upright(src, scale, fx2, fy2).convert("RGBA")
                    base = Image.alpha_composite(base, scrim)

                    for ov_img, start, end in overlays:
                        if start <= t <= end or (frame == total - 1 and abs(end - t) < 0.05):
                            opacity = text_alpha(t - start, end - start)
                            if opacity > 0.01:
                                faded = ov_img.copy()
                                if opacity < 0.99:
                                    alpha = faded.split()[-1].point(
                                        lambda a, o=opacity: int(a * o)
                                    )
                                    faded.putalpha(alpha)
                                base = Image.alpha_composite(base, faded)

                proc.stdin.write(base.convert("RGB").tobytes())
                if frame % 90 == 0:
                    kind = beat["kind"]
                    label = beat.get("ship") or "card"
                    print(f"  frame {frame}/{total} ({t:.1f}s) {kind}:{label}")

            proc.stdin.close()
            err = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
            code = proc.wait()
            if code != 0:
                print(err[-4000:], file=sys.stderr)
                return code
        except BrokenPipeError:
            err = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
            print(err[-4000:], file=sys.stderr)
            return 1

    out_dur = probe_duration(OUT)
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"Done: {OUT} ({size_mb:.1f} MB, {out_dur:.3f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
