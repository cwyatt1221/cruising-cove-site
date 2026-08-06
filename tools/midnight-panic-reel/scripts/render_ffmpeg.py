#!/usr/bin/env python3
"""
Midnight reservation panic / Travel Agents + Marketplace announce reel.
Ken Burns from Castaway Cay still → 1080x1920, 30fps, H.264, silent.
Middle-third outlined captions; ~2s end card.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PHOTO = ROOT / "public" / "photos" / "castaway-cay-ship.png"
FONT_PATH = ROOT / "public" / "fonts" / "Montserrat-SemiBold.ttf"
OUT = ROOT / "out" / "midnight-panic-reel.mp4"

W, H, FPS = 1080, 1920, 30
DURATION_S = 40
END_CARD_S = 2.0
TOTAL = DURATION_S * FPS
FADE_IN = 0.25
FADE_OUT = 0.2
TEXT_CENTER_Y = int(H * 0.50)

# (lines, font_size) — last beat is the end card
CAPTIONS: list[tuple[list[str], int]] = [
    (
        ["Big news —", "say goodbye to", "midnight reservation panic! 🎉"],
        64,
    ),
    (
        ["We've added three", "Travel Agents to our team —", "and it's 100% free to you!"],
        58,
    ),
    (
        [
            "No more midnight alarms",
            "for Royal Gathering or Palo —",
            "let our agents handle it",
            "while you sleep 😴✨",
        ],
        54,
    ),
    (
        ["And that's not all —", "welcome our first Marketplace", "for Disney cruise decor!"],
        56,
    ),
    (
        [
            "Porthole magnets,",
            "door decorations,",
            "stateroom surprises —",
            "we've got you covered!",
        ],
        56,
    ),
    (
        ["Head to CruisingCove.com", "Articles · Marketplace", "· Find an Agent"],
        58,
    ),
    (
        [
            "Let's make your next cruise",
            "the easiest one yet! ⚓🚢",
            "CruisingCove.com",
        ],
        58,
    ),
]

# Manual timing tuned for reading denser beats
# (start_s, end_s)
TIMING: list[tuple[float, float]] = [
    (0.0, 5.0),
    (5.0, 11.0),
    (11.0, 19.0),
    (19.0, 25.0),
    (25.0, 31.0),
    (31.0, 38.0),
    (38.0, 40.0),  # end card ~2s
]

# Ken Burns: landscape Castaway Cay — ship + lagoon + palms
# Open on beach/ship, push toward funnels, ease back for end card
JOURNEY = [
    (0.0, 0.50, 0.52, 1.12),
    (0.30, 0.52, 0.44, 1.28),
    (0.65, 0.54, 0.38, 1.42),
    (1.0, 0.50, 0.46, 1.20),
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


def render_text_png(lines: list[str], font_size: int, out_path: Path) -> None:
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


def text_alpha(local_t: float, duration: float) -> float:
    if local_t < FADE_IN:
        return local_t / FADE_IN
    if local_t > duration - FADE_OUT:
        return max(0.0, (duration - local_t) / FADE_OUT)
    return 1.0


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if not FONT_PATH.exists():
        print(f"Missing font: {FONT_PATH}", file=sys.stderr)
        return 1
    if not PHOTO.exists():
        print(f"Missing photo: {PHOTO}", file=sys.stderr)
        return 1
    if len(TIMING) != len(CAPTIONS):
        print("TIMING / CAPTIONS length mismatch", file=sys.stderr)
        return 1

    print(f"Mode: still Ken Burns ({PHOTO.name})")
    print(f"Duration: {DURATION_S}s @ {FPS}fps (end card last {END_CARD_S:.0f}s)")
    for i, ((start, end), (lines, _)) in enumerate(zip(TIMING, CAPTIONS), start=1):
        label = "End card" if i == len(CAPTIONS) else f"Beat {i}"
        print(f"  {label}: {start:.2f}–{end:.2f}s  {' / '.join(lines)}")

    src = Image.open(PHOTO).convert("RGB")
    with tempfile.TemporaryDirectory(prefix="midnight-panic-") as tmp:
        tmp_path = Path(tmp)
        overlays: list[tuple[Image.Image, float, float]] = []
        for i, (lines, font_size) in enumerate(CAPTIONS):
            p = tmp_path / f"cap{i}.png"
            render_text_png(lines, font_size, p)
            start, end = TIMING[i]
            overlays.append((Image.open(p).convert("RGBA"), start, end))

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
                progress = ease_in_out_quad(t / DURATION_S)
                fx, fy, scale = sample_journey(progress)
                base = cover_crop(src, scale, fx, fy).convert("RGBA")

                for ov_img, start, end in overlays:
                    if start <= t <= end or (frame == TOTAL - 1 and end == DURATION_S):
                        opacity = text_alpha(t - start, end - start)
                        if opacity > 0.01:
                            faded = ov_img.copy()
                            if opacity < 0.99:
                                alpha = faded.split()[-1].point(lambda a: int(a * opacity))
                                faded.putalpha(alpha)
                            base = Image.alpha_composite(base, faded)

                proc.stdin.write(base.convert("RGB").tobytes())
                if frame % 90 == 0:
                    print(f"  frame {frame}/{TOTAL} ({t:.1f}s) scale={scale:.2f}")

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
