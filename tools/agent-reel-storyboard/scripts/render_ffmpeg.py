#!/usr/bin/env python3
"""
Cruising Cove — Agent Reel Storyboard export.
Source: reel_preview storyboard HTML (phone-frame preview).

Landscape ship stills → 1080×1920 Ken Burns crop.
Each still/navy background holds for TWO caption beats.
Scenes using 07/09 apply a 90° clockwise rotate so sideways port stills sit upright.
Large middle-third navy captions with thick white outline. Silent H.264 mp4.
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
TIP_S = 3.2  # one caption beat (matches storyboard DURATION = 3200ms)
BG_S = TIP_S * 2  # each still/navy holds for two tips
CARD_S = TIP_S * 2.2  # storyboard holds final card longer
TEXT_CENTER_Y = int(H * 0.50)
FADE_IN = 0.28
FADE_OUT = 0.22

# Brand (storyboard CSS)
NAVY = (11, 42, 74, 255)
DEEP = (7, 26, 46, 255)
BRASS = (201, 162, 75, 255)
CREAM = (245, 239, 227, 255)

# Caption: dark navy fill + thick white outline (readable on sand/sky AND navy)
CAPTION_FILL = (11, 42, 74, 255)
CAPTION_OUTLINE = (255, 255, 255, 255)
CAPTION_OUTLINE_W = 10

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
SHIP_FOCUS: dict[str, tuple[float, float]] = {
    "01.jpeg": (0.48, 0.42),  # bow + Mickey radar
    "02.jpeg": (0.52, 0.48),  # red funnel + Mickey logo
    "03.jpeg": (0.42, 0.40),  # ship mid/bow
    "04.jpeg": (0.50, 0.42),
    "05.jpeg": (0.50, 0.44),
    "06.jpeg": (0.50, 0.38),  # Castaway Cay ship between palms
    "07.jpeg": (0.50, 0.42),  # after CW90: pier + stern upright
    "08.jpeg": (0.48, 0.42),
    "09.jpeg": (0.48, 0.42),  # after CW90: ship + umbrellas upright
}

# Degrees clockwise (applied once at load). Fixes sideways port stills (former ~20s / ~28s).
SHIP_ROTATE_CW: dict[str, int] = {
    "07.jpeg": 90,
    "09.jpeg": 90,
}

# Each background holds TWO consecutive tips.
# ship_index | None — None = navy branded bg (former ~11s / ~13–14s navy scenes).
# Tips 3+4 (price) share 03.jpeg; tips 5+6 share navy (tip 5 stays navy, tip 6 pairs on).
BACKGROUNDS: list[tuple[int | None, list[tuple[list[str], int]]]] = [
    (
        0,  # 01.jpeg
        [
            (
                ["Booking a Disney cruise?", "Here's why families", "never do it alone."],
                58,
            ),
            (
                [
                    "10 reasons families use",
                    "a Disney-specialist agent",
                    "— and it costs nothing extra.",
                ],
                52,
            ),
        ],
    ),
    (
        2,  # 03.jpeg — Same price + watch-the-price (tip 4 leaves navy, paired logically)
        [
            (
                [
                    "Same price, always",
                    "You pay the exact fare as booking direct —",
                    "Disney pays the agent's commission, not you.",
                ],
                48,
            ),
            (
                [
                    "They watch the price",
                    "after you book",
                    "Rate drops → rebook or onboard credit.",
                ],
                54,
            ),
        ],
    ),
    (
        None,  # navy — tip 5 stays navy; tip 6 pairs on
        [
            (
                [
                    "First in line when",
                    "booking windows open",
                    "Palo, Remy, cabanas & excursions.",
                ],
                54,
            ),
            (
                [
                    "A real human when",
                    "plans break",
                    "Flights, docs, last-minute surprises.",
                ],
                56,
            ),
        ],
    ),
    (
        6,  # 07.jpeg CW90 — former ~20s upright ship
        [
            (
                [
                    "Group trips without",
                    "the group-chat chaos",
                    "Multi-cabin paperwork, one contact.",
                ],
                54,
            ),
            (
                [
                    "They know the fleet,",
                    "ship by ship",
                    "Itinerary & stateroom that fit your family.",
                ],
                54,
            ),
        ],
    ),
    (
        8,  # 09.jpeg CW90 — former ~28s upright ship
        [
            (
                [
                    "Deck-plan and",
                    "stateroom insight",
                    "Connecting rooms, quiet halls, upgrades.",
                ],
                54,
            ),
            (
                [
                    "Castaway Club perks,",
                    "decoded",
                    "What your tier unlocks — and how to use it.",
                ],
                54,
            ),
        ],
    ),
    (
        1,  # 02.jpeg
        [
            (
                [
                    "Passport & paperwork",
                    "peace of mind",
                    "Disney-specific requirements, handled early.",
                ],
                52,
            ),
            (
                [
                    "An advocate,",
                    "start to sail-away",
                    "From deposit day through the final day.",
                ],
                56,
            ),
        ],
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
    outline_w: int = CAPTION_OUTLINE_W,
    fill: tuple[int, int, int, int] = CAPTION_FILL,
    outline: tuple[int, int, int, int] = CAPTION_OUTLINE,
) -> None:
    """Navy fill + thick white halo — readable on bright sand/sky and dark navy."""
    x, y = xy
    for dx in range(-outline_w, outline_w + 1):
        for dy in range(-outline_w, outline_w + 1):
            if dx == 0 and dy == 0:
                continue
            if dx * dx + dy * dy > outline_w * outline_w:
                continue
            draw.text((x + dx, y + dy), text, font=font, fill=outline)
    # Soft white shadow under fill for extra separation
    draw.text((x + 2, y + 3), text, font=font, fill=(255, 255, 255, 180))
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
    """Scale+crop still into 9:16 (rotation already applied at load when needed)."""
    src_w, src_h = img.size
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
    for i in range(H):
        d = abs(i - H / 2) / (H / 2)
        a = int(40 + 90 * (d**1.4))
        draw.line([(0, i), (W, i)], fill=(7, 26, 46, a))
    return layer.filter(ImageFilter.GaussianBlur(radius=1))


def make_branded_bg() -> Image.Image:
    """Solid navy branded backdrop (caption beats with no photo)."""
    img = Image.new("RGBA", (W, H), NAVY)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([-200, -280, 700, 520], fill=(28, 110, 140, 55))
    gd.ellipse([500, 1400, 1300, 2100], fill=(201, 162, 75, 32))
    return Image.alpha_composite(img, glow)


def text_alpha(local_t: float, duration: float) -> float:
    if local_t < FADE_IN:
        return local_t / FADE_IN
    if local_t > duration - FADE_OUT:
        return max(0.0, (duration - local_t) / FADE_OUT)
    return 1.0


def render_agent_card() -> Image.Image:
    """Final storyboard card: Meet your agents + portholes + CruisingCove URL.

    Planner portholes are vertically centered in the 9:16 frame (not pinned high).
    """
    img = Image.new("RGBA", (W, H), NAVY)

    # Soft teal / brass glows only — no diagonal stripe texture
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

    cell_w = 420
    gap_x = 40
    gap_y = 24
    label_h = 96  # name + role under each porthole
    hole_size = 280
    row_pitch = hole_size + label_h + gap_y
    grid_h = hole_size + label_h + gap_y + hole_size + label_h  # 2 rows + labels
    grid_w = cell_w * 2 + gap_x
    grid_left = (W - grid_w) // 2

    # Vertically center the full planners block (title + 2×2 + labels) in the frame,
    # with footer tucked just below — was floating high near y≈280.
    header_h = 118
    footer_h = 200
    cluster_h = header_h + grid_h
    cluster_top = (H - cluster_h - footer_h) // 2 + 100  # optical bias downward in 9:16
    ey = cluster_top
    grid_top = cluster_top + header_h

    eyebrow = "MEET YOUR AGENTS"
    bbox = draw.textbbox((0, 0), eyebrow, font=eyebrow_font)
    ew = bbox[2] - bbox[0]
    ex = (W - ew) // 2
    draw.ellipse([ex - 22, ey + 10, ex - 10, ey + 22], fill=(225, 103, 60, 255))
    draw.text((ex, ey), eyebrow, font=eyebrow_font, fill=BRASS)

    title = "Disney-specialist planners"
    bbox = draw.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, ey + 48), title, font=title_font, fill=CREAM)

    for i, (fname, name, role) in enumerate(AGENTS):
        col, row = i % 2, i // 2
        cx = grid_left + col * (cell_w + gap_x) + cell_w // 2
        top = grid_top + row * row_pitch

        ph = Image.open(PHOTOS / fname).convert("RGBA")
        ph = ph.resize((hole_size, hole_size), Image.Resampling.LANCZOS)
        img.paste(ph, (cx - hole_size // 2, top), ph)

        nb = draw.textbbox((0, 0), name, font=name_font)
        nw = nb[2] - nb[0]
        ny = top + hole_size + 14
        draw.text((cx - nw // 2, ny), name, font=name_font, fill=CREAM)

        role_lines = wrap_lines(role, role_font, cell_w - 20)
        ry = ny + 36
        for rl in role_lines:
            rb = draw.textbbox((0, 0), rl, font=role_font)
            rw = rb[2] - rb[0]
            draw.text((cx - rw // 2, ry), rl, font=role_font, fill=BRASS)
            ry += 26

    # Footer tucked under planners (no large empty navy gap)
    brand = "Cruising Cove"
    bb = draw.textbbox((0, 0), brand, font=brand_font)
    bw = bb[2] - bb[0]
    by = grid_top + grid_h + 36
    draw.text(((W - bw) // 2, by), brand, font=brand_font, fill=BRASS)

    # End-card URLs: cream fill + navy outline (already on navy card)
    url = "CruisingCove.com/agents"
    ub = draw.textbbox((0, 0), url, font=url_font)
    uw = ub[2] - ub[0]
    draw_outlined_text(
        draw,
        ((W - uw) // 2, by + 56),
        url,
        url_font,
        outline_w=5,
        fill=CREAM,
        outline=DEEP,
    )

    cta = "CruisingCove.com"
    cf = load_font(40)
    cb = draw.textbbox((0, 0), cta, font=cf)
    cw = cb[2] - cb[0]
    draw_outlined_text(
        draw,
        ((W - cw) // 2, by + 108),
        cta,
        cf,
        outline_w=5,
        fill=CREAM,
        outline=DEEP,
    )

    return img


def active_bg(backgrounds: list[dict], t: float, frame: int, total: int) -> dict:
    for b in backgrounds:
        if b["start"] <= t < b["end"]:
            return b
    if frame == total - 1:
        return backgrounds[-1]
    return backgrounds[-1]


def active_tip(tips: list[dict], t: float) -> dict | None:
    for tip in tips:
        if tip["start"] <= t < tip["end"]:
            return tip
    if tips and abs(t - tips[-1]["end"]) < 1e-6:
        return tips[-1]
    return None


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

    # Build backgrounds (each holds two tip beats) + final card
    backgrounds: list[dict] = []
    t = 0.0
    tip_n = 0
    for ship_i, tip_specs in BACKGROUNDS:
        ship = None if ship_i is None else SHIPS[ship_i % len(SHIPS)]
        kind = "brand" if ship_i is None else "photo"
        tips: list[dict] = []
        tip_t = t
        for lines, fsize in tip_specs:
            tip_n += 1
            tips.append(
                {
                    "n": tip_n,
                    "start": tip_t,
                    "end": tip_t + TIP_S,
                    "lines": lines,
                    "font_size": fsize,
                }
            )
            tip_t += TIP_S
        backgrounds.append(
            {
                "kind": kind,
                "ship": ship,
                "start": t,
                "end": t + BG_S,
                "tips": tips,
            }
        )
        t += BG_S

    backgrounds.append({"kind": "card", "ship": None, "start": t, "end": t + CARD_S, "tips": []})
    duration_s = t + CARD_S
    total = int(round(duration_s * FPS))

    print(f"Duration: {duration_s:.2f}s @ {FPS}fps ({total} frames)")
    print("Orientation: cover-crop; CW90 on 07/09 for upright ships")
    print("Captions: navy fill + white outline; 2 tips per background")
    for i, b in enumerate(backgrounds, start=1):
        if b["kind"] == "card":
            print(
                f"  BG{i:02d} {b['start']:.1f}–{b['end']:.1f}s  [agent card]  "
                f"CruisingCove.com"
            )
            continue
        if b["kind"] == "photo":
            rot = SHIP_ROTATE_CW.get(b["ship"] or "", 0)
            rot_tag = f" rotCW{rot}" if rot else ""
            label = f"{b['ship']}{rot_tag}"
        else:
            label = "navy brand"
        print(f"  BG{i:02d} {b['start']:.1f}–{b['end']:.1f}s  [{label}]")
        for tip in b["tips"]:
            print(
                f"       tip {tip['n']:02d} {tip['start']:.1f}–{tip['end']:.1f}s  "
                f"{' / '.join(tip['lines'])}"
            )

    # Preload stills (RGB). Apply explicit CW rotate where port stills are sideways.
    stills: dict[str, Image.Image] = {}
    for name in SHIPS:
        im = Image.open(PHOTOS / name).convert("RGB")
        # Do NOT call ImageOps.exif_transpose — use SHIP_ROTATE_CW only.
        cw = SHIP_ROTATE_CW.get(name, 0)
        if cw:
            # Pillow: negative degrees = clockwise
            im = im.rotate(-cw, expand=True)
        sw, sh = im.size
        stills[name] = im
        rot_note = f", rotated CW{cw}" if cw else ""
        print(f"  loaded {name}: {sw}×{sh}{rot_note}")

    scrim = make_scrim()
    branded = make_branded_bg()
    card = render_agent_card()

    with tempfile.TemporaryDirectory(prefix="agent-reel-") as tmp:
        tmp_path = Path(tmp)
        # (overlay_img, tip_start, tip_end)
        overlays: list[tuple[Image.Image, float, float]] = []
        for b in backgrounds:
            for tip in b["tips"]:
                p = tmp_path / f"cap{tip['n']}.png"
                render_caption_png(tip["lines"], tip["font_size"], p)
                overlays.append(
                    (Image.open(p).convert("RGBA"), tip["start"], tip["end"])
                )

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
                bg = active_bg(backgrounds, t, frame, total)

                if bg["kind"] == "card":
                    base = card.copy()
                elif bg["kind"] == "brand":
                    base = branded.copy()
                    tip = active_tip(bg["tips"], t)
                    if tip:
                        for ov_img, start, end in overlays:
                            if start == tip["start"] and end == tip["end"]:
                                opacity = text_alpha(t - start, end - start)
                                if opacity > 0.01:
                                    faded = ov_img.copy()
                                    if opacity < 0.99:
                                        alpha = faded.split()[-1].point(
                                            lambda a, o=opacity: int(a * o)
                                        )
                                        faded.putalpha(alpha)
                                    base = Image.alpha_composite(base, faded)
                                break
                else:
                    ship = bg["ship"]
                    src = stills[ship]
                    fx, fy = SHIP_FOCUS.get(ship, (0.50, 0.42))
                    # Ken Burns spans the full 2-tip background hold
                    local = (t - bg["start"]) / max(bg["end"] - bg["start"], 1e-9)
                    scale = 1.12 - 0.12 * ease_in_out_quad(local)
                    fx2 = fx + 0.02 * ease_in_out_quad(local)
                    fy2 = fy - 0.03 * ease_in_out_quad(local)
                    base = cover_crop_upright(src, scale, fx2, fy2).convert("RGBA")
                    base = Image.alpha_composite(base, scrim)

                    tip = active_tip(bg["tips"], t)
                    if tip:
                        for ov_img, start, end in overlays:
                            if start == tip["start"] and end == tip["end"]:
                                opacity = text_alpha(t - start, end - start)
                                if opacity > 0.01:
                                    faded = ov_img.copy()
                                    if opacity < 0.99:
                                        alpha = faded.split()[-1].point(
                                            lambda a, o=opacity: int(a * o)
                                        )
                                        faded.putalpha(alpha)
                                    base = Image.alpha_composite(base, faded)
                                break

                proc.stdin.write(base.convert("RGB").tobytes())
                if frame % 90 == 0:
                    kind = bg["kind"]
                    label = bg.get("ship") or ("navy" if kind == "brand" else "card")
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
