#!/usr/bin/env python3
"""Generate the sitewide Open Graph default image (1200x630)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "images" / "og-share.jpg"
BG = ROOT / "assets" / "images" / "gallery" / "01-2024-09-18-disney-wish-castaway-cay-pier-5-ce80a.jpg"
FONT_SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
FONT_SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"

W, H = 1200, 630


def cover_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    resized = img.resize((round(src_w * scale), round(src_h * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def main() -> None:
    base = cover_crop(Image.open(BG).convert("RGB"), W, H)
    overlay = Image.new("RGBA", (W, H))
    draw = ImageDraw.Draw(overlay)
    for y in range(H):
        t = y / H
        alpha = int(40 + 175 * (t**0.85))
        draw.line([(0, y), (W, y)], fill=(15, 28, 51, alpha))
    draw.rectangle((0, 0, W, H), fill=(15, 28, 51, 55))
    composed = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(composed)

    title_font = ImageFont.truetype(FONT_SERIF, 92)
    tag_font = ImageFont.truetype(FONT_SANS, 34)
    small_font = ImageFont.truetype(FONT_SANS, 24)

    title = "Cruising Cove"
    tagline = "Independent Disney Cruise Line planning"
    note = "Not affiliated with Disney"

    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_w = title_bbox[2] - title_bbox[0]
    title_x = (W - title_w) // 2
    title_y = 190

    draw.text((title_x + 2, title_y + 2), title, font=title_font, fill=(0, 0, 0))
    draw.text((title_x, title_y), title, font=title_font, fill=(245, 240, 225))

    line_y = title_y + 112
    draw.line([(W // 2 - 120, line_y), (W // 2 + 120, line_y)], fill=(201, 162, 75), width=4)

    tag_bbox = draw.textbbox((0, 0), tagline, font=tag_font)
    tag_w = tag_bbox[2] - tag_bbox[0]
    draw.text(((W - tag_w) // 2, line_y + 28), tagline, font=tag_font, fill=(245, 240, 225))

    note_bbox = draw.textbbox((0, 0), note, font=small_font)
    note_w = note_bbox[2] - note_bbox[0]
    draw.text(((W - note_w) // 2, line_y + 82), note, font=small_font, fill=(200, 200, 190))

    # Subtle vignette for polish.
    vignette = Image.new("L", (W, H), 0)
    vdraw = ImageDraw.Draw(vignette)
    vdraw.ellipse((-180, -120, W + 180, H + 120), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(80))
    composed = Image.composite(
        Image.new("RGB", (W, H), (10, 18, 32)),
        composed,
        Image.eval(vignette, lambda p: 255 - int(p * 0.35)),
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    composed.save(OUT, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"Wrote {OUT} ({W}x{H})")


if __name__ == "__main__":
    main()
