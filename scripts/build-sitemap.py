#!/usr/bin/env python3
"""Build sitemap.xml from public HTML pages for search engines."""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "sitemap.xml"
BASE = "https://www.cruisingcove.com"

SKIP_DIRS = {"api", "node_modules", ".git", "assets", "scripts"}
SKIP_URLS = {
    "/planning/my-cruise-admin.html",
}


def url_for(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def has_noindex(html: str) -> bool:
    return bool(re.search(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\'][^"\']*noindex', html, re.I))


def main() -> None:
    urls: list[tuple[str, str]] = []
    today = date.today().isoformat()

    for path in sorted(ROOT.rglob("*.html")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        html = path.read_text(encoding="utf-8", errors="ignore")
        if has_noindex(html):
            continue
        loc = url_for(path)
        if loc in SKIP_URLS:
            continue
        mtime = date.fromtimestamp(path.stat().st_mtime).isoformat()
        urls.append((loc, mtime))

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, lastmod in urls:
        abs_url = BASE if loc == "/" else BASE + loc
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(abs_url)}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(urls)} URLs → {OUT.relative_to(ROOT)} (generated {today})")


if __name__ == "__main__":
    main()
