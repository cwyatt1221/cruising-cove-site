#!/usr/bin/env python3
"""
Woody's Roundup Breakfast Instagram reel.
Uses public/source.mp4 when present; otherwise Ken Burns from the still.
1080x1920, 30fps, H.264. End card held ~2s. Middle-third outlined captions.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE_VIDEO = ROOT / "public" / "source.mp4"
PHOTO = ROOT / "public" / "photos" / "woodys-roundup-breakfast.png"
FONT_PATH = ROOT / "public" / "fonts" / "Montserrat-SemiBold.ttf"
OUT = ROOT / "out" / "woodys-roundup-reel.mp4"

W, H, FPS = 1080, 1920, 30
STILL_DURATION_S = 22
END_CARD_S = 2.0
FADE_IN = 0.25
FADE_OUT = 0.2
TEXT_CENTER_Y = int(H * 0.50)

LINE1 = ["Woody's Roundup Breakfast", "at Animator's Palate"]
LINE2 = ["Meet Bullseye & friends —", "Pixar Day at Sea energy"]
END_CARD = ["Follow cruisingcove.com", "for more Disney cruise tips"]


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
    line_gap = 16
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


def build_overlay_filter(overlays: list[tuple[str, float, float]]) -> str:
    parts: list[str] = []
    last = "[0:v]"
    for i, (label, start, end) in enumerate(overlays):
        fade_out_st = max(start, end - FADE_OUT)
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


def timing_for_duration(src_dur: float) -> tuple[tuple[float, float], tuple[float, float], tuple[float, float]]:
    content_end = max(src_dur - END_CARD_S, src_dur * 0.55)
    mid = content_end / 2.0
    return (0.0, mid), (mid, content_end), (content_end, src_dur)


def render_from_video(source: Path) -> int:
    src_dur = probe_duration(source)
    (t1_start, t1_end), (t2_start, t2_end), (t3_start, t3_end) = timing_for_duration(src_dur)
    print(f"Mode: video ({source.name})")
    print(f"Source duration: {src_dur:.3f}s")
    print(f"  Line 1: {t1_start:.2f}–{t1_end:.2f}s")
    print(f"  Line 2: {t2_start:.2f}–{t2_end:.2f}s")
    print(f"  End card: {t3_start:.2f}–{t3_end:.2f}s")

    with tempfile.TemporaryDirectory(prefix="woodys-roundup-") as tmp:
        tmp_path = Path(tmp)
        o1, o2, o3 = tmp_path / "line1.png", tmp_path / "line2.png", tmp_path / "endcard.png"
        render_text_png(LINE1, 70, o1)
        render_text_png(LINE2, 66, o2)
        render_text_png(END_CARD, 64, o3)

        # Scale/pad to 1080x1920 if needed
        vf_base = (
            f"scale={W}:{H}:force_original_aspect_ratio=increase,"
            f"crop={W}:{H},fps={FPS}"
        )
        filter_complex = (
            f"[0:v]{vf_base}[base];"
            + build_overlay_filter(
                [
                    ("ov1", t1_start, t1_end),
                    ("ov2", t2_start, t2_end),
                    ("ov3", t3_start, t3_end),
                ]
            ).replace("[0:v]", "[base]")
        )

        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(source),
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
    return 0


def ease_in_out_quad(t: float) -> float:
    if t <= 0:
        return 0.0
    if t >= 1:
        return 1.0
    if t < 0.5:
        return 2 * t * t
    return 1 - (-2 * t + 2) ** 2 / 2


# Ken Burns path: focus drifts toward Bullseye mid-frame, then eases out
JOURNEY = [
    (0.0, 0.48, 0.55, 1.12),
    (0.35, 0.52, 0.48, 1.28),
    (0.70, 0.55, 0.42, 1.38),
    (1.0, 0.50, 0.50, 1.18),
]


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


def render_from_still(photo: Path) -> int:
    total = STILL_DURATION_S * FPS
    (t1_start, t1_end), (t2_start, t2_end), (t3_start, t3_end) = timing_for_duration(
        float(STILL_DURATION_S)
    )
    print(f"Mode: still Ken Burns ({photo.name})")
    print(f"Duration: {STILL_DURATION_S}s @ {FPS}fps")
    print(f"  Line 1: {t1_start:.2f}–{t1_end:.2f}s")
    print(f"  Line 2: {t2_start:.2f}–{t2_end:.2f}s")
    print(f"  End card: {t3_start:.2f}–{t3_end:.2f}s")

    src = Image.open(photo).convert("RGB")
    with tempfile.TemporaryDirectory(prefix="woodys-roundup-still-") as tmp:
        tmp_path = Path(tmp)
        o1, o2, o3 = tmp_path / "line1.png", tmp_path / "line2.png", tmp_path / "endcard.png"
        render_text_png(LINE1, 70, o1)
        render_text_png(LINE2, 66, o2)
        render_text_png(END_CARD, 64, o3)
        overlays = [
            (Image.open(o1).convert("RGBA"), t1_start, t1_end),
            (Image.open(o2).convert("RGBA"), t2_start, t2_end),
            (Image.open(o3).convert("RGBA"), t3_start, t3_end),
        ]

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
        print(f"Rendering {total} frames…")
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        assert proc.stdin is not None
        try:
            for frame in range(total):
                t = frame / FPS
                progress = ease_in_out_quad(t / STILL_DURATION_S)
                fx, fy, scale = sample_journey(progress)
                base = cover_crop(src, scale, fx, fy).convert("RGBA")

                for ov_img, start, end in overlays:
                    if start <= t <= end:
                        opacity = text_alpha(t - start, end - start)
                        if opacity > 0.01:
                            faded = ov_img.copy()
                            if opacity < 0.99:
                                alpha = faded.split()[-1].point(lambda a: int(a * opacity))
                                faded.putalpha(alpha)
                            base = Image.alpha_composite(base, faded)

                proc.stdin.write(base.convert("RGB").tobytes())
                if frame % 90 == 0:
                    print(f"  frame {frame}/{total} ({t:.1f}s)")

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
    return 0


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if not FONT_PATH.exists():
        print(f"Missing font: {FONT_PATH}", file=sys.stderr)
        return 1

    if SOURCE_VIDEO.exists():
        code = render_from_video(SOURCE_VIDEO)
    elif PHOTO.exists():
        code = render_from_still(PHOTO)
    else:
        print(f"Missing source video ({SOURCE_VIDEO}) and still ({PHOTO})", file=sys.stderr)
        return 1

    if code != 0:
        return code
    out_dur = probe_duration(OUT)
    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"Done: {OUT} ({size_mb:.1f} MB, {out_dur:.3f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
