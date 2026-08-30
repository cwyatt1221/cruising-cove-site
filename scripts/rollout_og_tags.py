#!/usr/bin/env python3
"""Add or normalize Open Graph / Twitter meta tags on public HTML pages."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://www.cruisingcove.com"
OG_IMAGE = f"{SITE}/assets/images/og-default.jpg"
DEFAULT_DESC = (
    "Independent Disney Cruise Line planning guides from Cruising Cove. "
    "Not affiliated with Disney."
)

SKIP_DIRS = {
    "output",
    "api",
    "templates",
    "node_modules",
    ".git",
}

SKIP_FILES = {
    "google0e4a0c8797c4585d.html",
}


def path_to_url(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return f"{SITE}/"
    if rel.endswith("/index.html"):
        return f"{SITE}/{rel[:-10]}"
    return f"{SITE}/{rel}"


def extract_meta(html: str, name: str) -> str | None:
    m = re.search(
        rf'<meta\s+name="{re.escape(name)}"\s+content="([^"]*)"',
        html,
        flags=re.I,
    )
    return m.group(1) if m else None


def extract_title(html: str) -> str | None:
    m = re.search(r"<title>([^<]+)</title>", html, flags=re.I)
    return m.group(1).strip() if m else None


def og_type_for(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel.startswith("articles/") and rel != "articles/index.html":
        return "article"
    return "website"


def build_block(
    *,
    url: str,
    title: str,
    description: str,
    og_type: str,
) -> str:
    return f'''<link rel="canonical" href="{url}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Cruising Cove">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:image" content="{OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="{OG_IMAGE}">'''


def strip_existing_social(html: str) -> str:
  patterns = [
      r'\s*<link rel="canonical" href="[^"]*">\s*',
      r'\s*<meta property="og:[^"]*" content="[^"]*">\s*',
      r'\s*<meta property="og:image:width" content="[^"]*">\s*',
      r'\s*<meta property="og:image:height" content="[^"]*">\s*',
      r'\s*<meta name="twitter:[^"]*" content="[^"]*">\s*',
  ]
  for pat in patterns:
      html = re.sub(pat, "", html, flags=re.I)
  return html


def insert_block(html: str, block: str) -> str:
    if re.search(r'property="og:image"', html, flags=re.I):
        return html

    desc_match = re.search(
        r'(<meta\s+name="description"\s+content="[^"]*"\s*>)',
        html,
        flags=re.I,
    )
    if desc_match:
        insert_at = desc_match.end()
        return html[:insert_at] + "\n" + block + html[insert_at:]

    title_match = re.search(r"(</title>)", html, flags=re.I)
    if title_match:
        insert_at = title_match.end()
        return html[:insert_at] + "\n" + block + html[insert_at:]

    viewport_match = re.search(
        r'(<meta\s+name="viewport"[^>]*>)',
        html,
        flags=re.I,
    )
    if viewport_match:
        insert_at = viewport_match.end()
        return html[:insert_at] + "\n" + block + html[insert_at:]

    return html


def process_file(path: Path) -> bool:
    html = path.read_text(encoding="utf-8")
    if re.search(r'property="og:image"', html, flags=re.I):
        updated = strip_existing_social(html)
        title = extract_title(updated) or "Cruising Cove"
        description = extract_meta(updated, "description") or DEFAULT_DESC
        url = path_to_url(path)
        block = build_block(
            url=url,
            title=title,
            description=description,
            og_type=og_type_for(path),
        )
        new_html = insert_block(updated, block)
    else:
        title = extract_title(html) or "Cruising Cove"
        description = extract_meta(html, "description") or DEFAULT_DESC
        url = path_to_url(path)
        block = build_block(
            url=url,
            title=title,
            description=description,
            og_type=og_type_for(path),
        )
        new_html = insert_block(html, block)

    if new_html != html:
        path.write_text(new_html, encoding="utf-8")
        return True
    return False


def iter_html_files() -> list[Path]:
    files: list[Path] = []
    for path in sorted(ROOT.rglob("*.html")):
        rel_parts = path.relative_to(ROOT).parts
        if rel_parts[0] in SKIP_DIRS:
            continue
        if path.name in SKIP_FILES:
            continue
        files.append(path)
    return files


def main() -> None:
    changed = 0
    for path in iter_html_files():
        if process_file(path):
            changed += 1
            print(f"updated {path.relative_to(ROOT)}")
    print(f"Done. Updated {changed} file(s).")


if __name__ == "__main__":
    main()
