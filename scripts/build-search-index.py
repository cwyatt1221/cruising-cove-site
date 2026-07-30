#!/usr/bin/env python3
"""Build assets/search-index.json from site HTML pages for client-side search."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "search-index.json"

SKIP_DIRS = {"api", "node_modules", ".git", "assets", "scripts"}
SKIP_NAMES = set()


def strip_tags(html: str) -> str:
    html = re.sub(r"(?is)<script[^>]*>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style[^>]*>.*?</style>", " ", html)
    html = re.sub(r"(?is)<noscript[^>]*>.*?</noscript>", " ", html)
    html = re.sub(r"(?is)<!--.*?-->", " ", html)
    html = re.sub(r"(?is)<[^>]+>", " ", html)
    html = (
        html.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&mdash;", "—")
        .replace("&ndash;", "–")
        .replace("&rsquo;", "'")
        .replace("&lsquo;", "'")
        .replace("&rdquo;", '"')
        .replace("&ldquo;", '"')
    )
    html = re.sub(r"\s+", " ", html).strip()
    return html


def first(pattern: str, html: str, flags: int = re.I | re.S) -> str:
    m = re.search(pattern, html, flags)
    return strip_tags(m.group(1)).strip() if m else ""


def url_for(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def main() -> None:
    pages = []
    for path in sorted(ROOT.rglob("*.html")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_NAMES:
            continue

        html = path.read_text(encoding="utf-8", errors="ignore")
        title = first(r"<title>(.*?)</title>", html)
        if title:
            title = re.sub(r"\s*\|\s*Cruising Cove\s*$", "", title).strip()
        description = first(
            r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']',
            html,
        )
        if not description:
            description = first(
                r'<meta\s+content=["\'](.*?)["\']\s+name=["\']description["\']',
                html,
            )
        h1 = first(r"<h1[^>]*>(.*?)</h1>", html)
        body = strip_tags(html)
        # Drop nav/footer noise by keeping a bounded body sample.
        body = body[:6000]

        pages.append(
            {
                "url": url_for(path),
                "title": title or h1 or path.stem.replace("-", " ").title(),
                "description": description,
                "h1": h1,
                "body": body,
            }
        )

    OUT.write_text(json.dumps({"pages": pages}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(pages)} pages → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
