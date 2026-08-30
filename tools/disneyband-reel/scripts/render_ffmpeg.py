#!/usr/bin/env python3
"""
Fallback renderer for DisneyBand+ reel when Remotion/Chrome can't launch.
Single photo + continuous Ken Burns (boy → wristband), 1080x1920, 30fps, 45s.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PHOTO = ROOT / "public" / "photos" / "boy-disneyband.png"
FONT_PATH = ROOT / "public" / "fonts" / "Montserrat-SemiBold.ttf"
OUT = ROOT / "out" / "disneyband-reel.mp4"

W, H, FPS = 1080, 1920, 30
TOTAL = 45 * FPS

# Continuous camera path keyframes (t 0–1 → fx, fy, scale)
JOURNEY = [
    (0.0, 0.50, 0.40, 1.05),
    (0.12, 0.46, 0.405, 1.18),
    (0.45, 0.38, 0.41, 1.50),
    (0.78, 0.30, 0.418, 1.85),
    (1.0, 0.272, 0.422, 2.00),
]

# start_s, end_s, lines, position ('bottom'|'center')
TEXT_BEATS = [
    (0, 4, ["This tiny band was my room key,", "wallet, AND ticket on our", "Disney cruise 🌊✨"], "bottom"),
    (4, 8, ["Room key. Payments."], "bottom"),
    (8, 12, ["Magic moments.", "All on my wrist."], "bottom"),
    (12, 16, ["It's DisneyBand+"], "bottom"),
    (16, 20, ["Link it before you sail —", "it does everything your", "room key card does."], "bottom"),
    (20, 25, ["Comes in solid colors"], "bottom"),
    (25, 30, ["or themed designs 🎨"], "bottom"),
    (30, 34, ["No digging through my bag."], "bottom"),
    (34, 38, ["No losing a paper key card.", "Just relaxing."], "bottom"),
    (38, 45, ["Save this for your next", "Disney cruise! 🚢"], "center"),
]

FADE_IN = 0.2
FADE_OUT = 0.15
SLIDE_PX = 12


def ease_in_out_quad(t: float) -> float:
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    if t < 0.5:
        return 2 * t * t
    return 1 - (-2 * t + 2) ** 2 / 2


def ease_in_out_cubic(t: float) -> float:
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    if t < 0.5:
        return 4 * t * t * t
    return 1 - (-2 * t + 2) ** 3 / 2


def path_progress(t: float) -> float:
    """Wall-clock seconds → path progress with open/hold on boy and CTA hold."""
    if t <= 4:
        return ease_in_out_quad(t / 4) * 0.08
    if t <= 40:
        return 0.08 + ease_in_out_cubic((t - 4) / 36) * 0.92
    return 1.0


def sample_journey(progress: float) -> tuple[float, float, float]:
    keys = JOURNEY
    if progress <= keys[0][0]:
        return keys[0][1], keys[0][2], keys[0][3]
    if progress >= keys[-1][0]:
        return keys[-1][1], keys[-1][2], keys[-1][3]
    for i in range(len(keys) - 1):
        t0, fx0, fy0, s0 = keys[i]
        t1, fx1, fy1, s1 = keys[i + 1]
        if t0 <= progress <= t1:
            local = ease_in_out_quad((progress - t0) / max(t1 - t0, 1e-9))
            return (
                fx0 + (fx1 - fx0) * local,
                fy0 + (fy1 - fy0) * local,
                s0 + (s1 - s0) * local,
            )
    return keys[-1][1], keys[-1][2], keys[-1][3]


def cover_crop(img: Image.Image, scale: float, fx: float, fy: float) -> Image.Image:
    """Cover-fit crop into WxH at given scale around focus (fx, fy)."""
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


def load_font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_PATH), size=size)


def text_alpha(local_t: float, duration: float) -> tuple[float, float]:
    """Return (opacity, translateY) for text overlay."""
    if local_t < FADE_IN:
        p = local_t / FADE_IN
        return p, SLIDE_PX * (1 - p)
    if local_t > duration - FADE_OUT:
        p = (duration - local_t) / FADE_OUT
        return max(0.0, p), 0.0
    return 1.0, 0.0


def render_text_layer(lines: list[str], opacity: float, translate_y: float, position: str) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if opacity <= 0.01:
        return layer

    draw = ImageDraw.Draw(layer)
    font = load_font(68)
    line_gap = 14
    pads = (28, 18)

    sizes = [draw.textbbox((0, 0), line, font=font) for line in lines]
    text_w = max(b[2] - b[0] for b in sizes)
    text_h = sum(b[3] - b[1] for b in sizes) + line_gap * (len(lines) - 1)
    box_w = text_w + pads[0] * 2
    box_h = text_h + pads[1] * 2

    if position == "center":
        box_y = int(H * 0.42 - box_h / 2 + translate_y)
    else:
        box_y = int(H - 150 - box_h + translate_y)
    box_x = (W - box_w) // 2

    alpha = int(255 * 0.45 * opacity)
    draw.rounded_rectangle(
        [box_x, box_y, box_x + box_w, box_y + box_h],
        radius=18,
        fill=(0, 0, 0, alpha),
    )

    y = box_y + pads[1]
    for line, bbox in zip(lines, sizes):
        lw = bbox[2] - bbox[0]
        lh = bbox[3] - bbox[1]
        x = box_x + (box_w - lw) // 2
        shadow_a = int(180 * opacity)
        draw.text((x + 2, y + 2), line, font=font, fill=(0, 0, 0, shadow_a))
        draw.text((x, y), line, font=font, fill=(255, 255, 255, int(255 * opacity)))
        y += lh + line_gap

    return layer


def find_text(frame: int):
    t = frame / FPS
    for start, end, lines, pos in TEXT_BEATS:
        if start <= t < end or (frame == TOTAL - 1 and end == 45):
            return start, end, lines, pos
    for start, end, lines, pos in TEXT_BEATS:
        if start <= t <= end:
            return start, end, lines, pos
    return None


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if not FONT_PATH.exists():
        print(f"Missing font: {FONT_PATH}", file=sys.stderr)
        return 1
    if not PHOTO.exists():
        print(f"Missing photo: {PHOTO}", file=sys.stderr)
        return 1

    src = Image.open(PHOTO).convert("RGB")
    print(f"Source: {PHOTO.name} ({src.size[0]}×{src.size[1]})")

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

    print(f"Rendering {TOTAL} frames → {OUT}")
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdin is not None

    try:
        for frame in range(TOTAL):
            t = frame / FPS
            fx, fy, scale = sample_journey(path_progress(t))
            base = cover_crop(src, scale, fx, fy)

            vignette = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            vd = ImageDraw.Draw(vignette)
            for i in range(H // 2):
                a = int(140 * (1 - i / (H / 2)) ** 1.6)
                y = H - 1 - i
                vd.line([(0, y), (W, y)], fill=(0, 0, 0, a))
            frame_img = Image.alpha_composite(base.convert("RGBA"), vignette)

            info = find_text(frame)
            if info:
                t0, t1, lines, pos = info
                dur = t1 - t0
                local_t = t - t0
                opacity, ty = text_alpha(local_t, dur)
                text_layer = render_text_layer(lines, opacity, ty, pos)
                frame_img = Image.alpha_composite(frame_img, text_layer)

            proc.stdin.write(frame_img.convert("RGB").tobytes())
            if frame % 90 == 0:
                print(f"  frame {frame}/{TOTAL} ({t:.1f}s) scale={scale:.2f} focus=({fx:.2f},{fy:.2f})")

        proc.stdin.close()
        err = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
        code = proc.wait()
        if code != 0:
            print(err[-4000:], file=sys.stderr)
            return code
        size_mb = OUT.stat().st_size / (1024 * 1024)
        print(f"Done: {OUT} ({size_mb:.1f} MB)")
        return 0
    except BrokenPipeError:
        err = proc.stderr.read().decode("utf-8", errors="replace") if proc.stderr else ""
        print(err[-4000:], file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
