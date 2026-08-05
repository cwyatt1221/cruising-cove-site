#!/usr/bin/env python3
"""
Best-friend Instagram reel from source video + text overlays.
1080x1920, 30fps, H.264. End card held ~2s.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "video" / "source.mp4"
FONT_PATH = ROOT / "public" / "fonts" / "Montserrat-SemiBold.ttf"
OUT = ROOT / "out" / "best-friend-reel.mp4"

W, H, FPS = 1080, 1920, 30
END_CARD_S = 2.0
FADE_IN = 0.25
FADE_OUT = 0.2

# Middle-third vertical center (~H/2)
TEXT_CENTER_Y = int(H * 0.50)

EMOJI_FONT_PATH = Path("/System/Library/Fonts/Apple Color Emoji.ttc")


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
    fill: tuple[int, int, int, int],
    outline: tuple[int, int, int, int],
    outline_w: int = 6,
) -> None:
    x, y = xy
    # Dense outline for busy warm lighting
    for dx in range(-outline_w, outline_w + 1):
        for dy in range(-outline_w, outline_w + 1):
            if dx == 0 and dy == 0:
                continue
            if dx * dx + dy * dy > outline_w * outline_w:
                continue
            draw.text((x + dx, y + dy), text, font=font, fill=outline)
    draw.text((x, y), text, font=font, fill=fill)


def split_emoji_runs(text: str) -> list[tuple[str, bool]]:
    """Split into (segment, is_emoji) runs so color emoji can use Apple Color Emoji."""
    runs: list[tuple[str, bool]] = []
    buf = ""
    emoji_mode: bool | None = None

    def is_emoji_char(ch: str) -> bool:
        o = ord(ch)
        # Misc symbols / emoticons / transport / supplemental symbols + ZWJ/VS16
        return (
            ch in "\u200d\ufe0f"
            or 0x1F300 <= o <= 0x1FAFF
            or 0x2600 <= o <= 0x27BF
            or 0x1F000 <= o <= 0x1F02F
        )

    for ch in text:
        em = is_emoji_char(ch)
        if emoji_mode is None:
            emoji_mode = em
            buf = ch
        elif em == emoji_mode:
            buf += ch
        else:
            runs.append((buf, emoji_mode))
            buf = ch
            emoji_mode = em
    if buf and emoji_mode is not None:
        runs.append((buf, emoji_mode))
    return runs


def measure_line(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    emoji_font: ImageFont.FreeTypeFont | None,
) -> tuple[int, int]:
    w = 0
    h = 0
    for seg, is_emoji in split_emoji_runs(text):
        f = emoji_font if is_emoji and emoji_font is not None else font
        bbox = draw.textbbox((0, 0), seg, font=f)
        w += bbox[2] - bbox[0]
        h = max(h, bbox[3] - bbox[1])
    return w, h


def draw_mixed_line(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    emoji_font: ImageFont.FreeTypeFont | None,
) -> None:
    cx = x
    for seg, is_emoji in split_emoji_runs(text):
        if is_emoji and emoji_font is not None:
            draw.text((cx, y - 4), seg, font=emoji_font, embedded_color=True)
            bbox = draw.textbbox((0, 0), seg, font=emoji_font)
        else:
            draw_outlined_text(
                draw,
                (cx, y),
                seg,
                font,
                fill=(255, 255, 255, 255),
                outline=(0, 0, 0, 255),
                outline_w=7,
            )
            bbox = draw.textbbox((0, 0), seg, font=font)
        cx += bbox[2] - bbox[0]


def render_text_png(lines: list[str], font_size: int, out_path: Path) -> None:
    font = load_font(font_size)
    emoji_font = None
    if EMOJI_FONT_PATH.exists():
        # Apple Color Emoji sizes are discrete; pick nearest
        emoji_size = 64 if font_size >= 60 else 48
        try:
            emoji_font = ImageFont.truetype(str(EMOJI_FONT_PATH), size=emoji_size)
        except OSError:
            emoji_font = None

    max_w = W - 120
    wrapped: list[str] = []
    for line in lines:
        # Wrap on non-emoji portion only for long lines
        plain = "".join(seg for seg, is_em in split_emoji_runs(line) if not is_em).strip()
        emoji_tail = "".join(seg for seg, is_em in split_emoji_runs(line) if is_em)
        if plain:
            parts = wrap_lines(plain, font, max_w)
            if emoji_tail and parts:
                parts[-1] = f"{parts[-1]} {emoji_tail}".strip()
            elif emoji_tail:
                parts = [emoji_tail]
            wrapped.extend(parts)
        else:
            wrapped.append(line)

    probe = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(probe)
    line_gap = 18
    sizes = [measure_line(draw, line, font, emoji_font) for line in wrapped]
    text_h = sum(h for _, h in sizes) + line_gap * max(0, len(wrapped) - 1)

    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    y = TEXT_CENTER_Y - text_h // 2
    for line, (lw, lh) in zip(wrapped, sizes):
        x = (W - lw) // 2
        draw_mixed_line(draw, x, y, line, font, emoji_font)
        y += lh + line_gap

    layer.save(out_path)


def build_overlay_filter(
    overlays: list[tuple[str, float, float]],
) -> str:
    """Chain overlay fades: overlays = [(label, start, end), ...] where labels are [1].."""
    # Input 0 = video, 1..N = PNG stills
    parts: list[str] = []
    last = "[0:v]"
    for i, (label, start, end) in enumerate(overlays):
        fade_out_st = max(start, end - FADE_OUT)
        # loop PNG as video, then fade via alpha
        parts.append(
            f"[{i + 1}:v]format=rgba,"
            f"fade=t=in:st={start}:d={FADE_IN}:alpha=1,"
            f"fade=t=out:st={fade_out_st}:d={FADE_OUT}:alpha=1[{label}]"
        )
        out = f"[v{i}]"
        enable = f"between(t\\,{start}\\,{end})"
        parts.append(f"{last}[{label}]overlay=0:0:enable='{enable}'{out}")
        last = out
    parts.append(f"{last}format=yuv420p[vout]")
    return ";".join(parts)


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if not SOURCE.exists():
        print(f"Missing source: {SOURCE}", file=sys.stderr)
        return 1
    if not FONT_PATH.exists():
        print(f"Missing font: {FONT_PATH}", file=sys.stderr)
        return 1

    src_dur = probe_duration(SOURCE)
    # First two lines across footage before end card; end card last END_CARD_S seconds
    content_end = max(src_dur - END_CARD_S, src_dur * 0.5)
    mid = content_end / 2.0
    t1_start, t1_end = 0.0, mid
    t2_start, t2_end = mid, content_end
    t3_start, t3_end = content_end, src_dur

    print(f"Source duration: {src_dur:.3f}s")
    print(f"  Line 1: {t1_start:.2f}–{t1_end:.2f}s")
    print(f"  Line 2: {t2_start:.2f}–{t2_end:.2f}s")
    print(f"  End card: {t3_start:.2f}–{t3_end:.2f}s ({t3_end - t3_start:.2f}s)")

    with tempfile.TemporaryDirectory(prefix="best-friend-reel-") as tmp:
        tmp_path = Path(tmp)
        o1 = tmp_path / "line1.png"
        o2 = tmp_path / "line2.png"
        o3 = tmp_path / "endcard.png"

        render_text_png(["My son made a new best friend today."], 72, o1)
        render_text_png(
            ["Your family could be making memories like this too."], 68, o2
        )
        render_text_png(["Learn more at cruisingcove.com 🐾🚢"], 64, o3)

        # Still images as looping video inputs matching source length
        filter_complex = build_overlay_filter(
            [
                ("ov1", t1_start, t1_end),
                ("ov2", t2_start, t2_end),
                ("ov3", t3_start, t3_end),
            ]
        )

        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(SOURCE),
            "-loop",
            "1",
            "-t",
            f"{src_dur:.3f}",
            "-i",
            str(o1),
            "-loop",
            "1",
            "-t",
            f"{src_dur:.3f}",
            "-i",
            str(o2),
            "-loop",
            "1",
            "-t",
            f"{src_dur:.3f}",
            "-i",
            str(o3),
            "-filter_complex",
            filter_complex,
            "-map",
            "[vout]",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "high",
            "-crf",
            "18",
            "-r",
            str(FPS),
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(OUT),
        ]

        print("Rendering…")
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            print(proc.stderr[-5000:], file=sys.stderr)
            return proc.returncode

    out_dur = probe_duration(OUT)
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"Done: {OUT} ({size_mb:.1f} MB, {out_dur:.3f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
