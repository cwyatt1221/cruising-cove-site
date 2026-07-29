#!/usr/bin/env python3
"""Roll cream/navy/gold chrome + site.css across all Cruising Cove HTML pages."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path("/Users/cassondrawyatt/cruising-cove-site")

FONTS = '''<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">'''

LOGO_MARK = '''<span class="mark" aria-hidden="true">
          <svg viewBox="0 0 14 14" fill="none"><path d="M1 8c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" stroke="#c9a24b" stroke-width="1.4" stroke-linecap="round"/></svg>
        </span>'''

DISCLAIMER = (
    "Cruising Cove is an independent planning guide and is not affiliated with, "
    "endorsed by, or sponsored by The Walt Disney Company, Disney Cruise Line, "
    "or any of their affiliates. All ship names are used for reference purposes only."
)

NAV_SCRIPT = '''<script>
  (function(){
    var btn=document.querySelector('.nav-toggle');
    var menu=document.getElementById('primaryNav');
    if(btn&&menu){
      btn.addEventListener('click',function(){
        var open=menu.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    var path=location.pathname.replace(/\\/+/g,'/');
    document.querySelectorAll('.site-nav-bar .nav-links a').forEach(function(a){
      var href=a.getAttribute('href');
      if(!href) return;
      if(path===href || (href!=='/' && path.indexOf(href.replace(/\\.html$/,''))===0)){
        a.classList.add('current');
      }
    });
  })();
</script>'''


def header_html(current: str | None = None) -> str:
    links = [
        ("/ships/", "Ships"),
        ("/ports/", "Ports"),
        ("/dining/", "Dining"),
        ("/entertainment/", "Entertainment"),
        ("/excursions/", "Excursions"),
        ("/faq/", "FAQ"),
        ("/marketplace/", "Marketplace"),
    ]
    link_html = []
    for href, label in links:
        cls = ' class="current"' if current == href else ""
        link_html.append(f'        <a href="{href}"{cls}>{label}</a>')
    agent_cls = ' current' if current == "/agents/" else ""
    return f'''<header class="site-header">
  <div class="wrap">
    <nav class="site-nav-bar" aria-label="Primary">
      <a class="logo" href="/">
        {LOGO_MARK}
        Cruising Cove
      </a>
      <button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="primaryNav">
        <span></span><span></span><span></span>
      </button>
      <div class="nav-links" id="primaryNav">
{chr(10).join(link_html)}
      </div>
      <div class="nav-cta">
        <a href="/agents/" class="btn btn-outline{agent_cls}">Find an Agent</a>
      </div>
    </nav>
  </div>
</header>'''


def footer_html() -> str:
    return f'''<footer class="site-footer">
  <div class="wrap">
    <div class="foot-top">
      <a class="logo" href="/">
        {LOGO_MARK}
        Cruising Cove
      </a>
      <div class="foot-links">
        <a href="/ships/">Ships</a>
        <a href="/ports/">Ports</a>
        <a href="/dining/">Dining</a>
        <a href="/entertainment/">Entertainment</a>
        <a href="/planning/disney-cruise-cost.html">Plan Your Sailing</a>
        <a href="/agents/">Find an Agent</a>
      </div>
    </div>
    <p class="disclaimer">{DISCLAIMER}</p>
  </div>
</footer>
{NAV_SCRIPT}
<script src="/assets/chat-widget.js" defer></script>'''


def strip_old_font_and_css_links(html: str) -> str:
    html = re.sub(
        r'<link[^>]+fonts\.googleapis\.com[^>]*>\s*',
        '',
        html,
        flags=re.I,
    )
    html = re.sub(
        r'<link[^>]+fonts\.gstatic\.com[^>]*>\s*',
        '',
        html,
        flags=re.I,
    )
    html = re.sub(
        r'<link[^>]+href="[^"]*assets/style\.css"[^>]*>\s*',
        '',
        html,
        flags=re.I,
    )
    html = re.sub(
        r'<link[^>]+href="/assets/site\.css"[^>]*>\s*',
        '',
        html,
        flags=re.I,
    )
    return html


def inject_head_assets(html: str) -> str:
    html = strip_old_font_and_css_links(html)
    if "/assets/site.css" not in html:
        html = re.sub(
            r'(</title>\s*)',
            r'\1\n' + FONTS + '\n',
            html,
            count=1,
            flags=re.I,
        )
    return html


def remove_cc_overlay_style(html: str) -> str:
    # Remove the hybrid cc-site-header style blocks
    html = re.sub(
        r'<!-- Site-wide nav/background unification[\s\S]*?</style>\s*',
        '',
        html,
        flags=re.I,
    )
    html = re.sub(
        r'<style>\s*body\{\s*background:#BFE3DA !important;[\s\S]*?</style>\s*',
        '',
        html,
        flags=re.I,
    )
    return html


def remove_get_the_app(html: str) -> str:
    html = re.sub(
        r'\s*<a[^>]*>Get the App</a>\s*',
        '\n',
        html,
        flags=re.I,
    )
    return html


def replace_header(html: str, current: str | None) -> str:
    hdr = header_html(current)
    # cc-site-header block
    html2, n = re.subn(
        r'<header class="cc-site-header">[\s\S]*?</header>\s*',
        hdr + '\n\n',
        html,
        count=1,
        flags=re.I,
    )
    if n:
        return html2
    # hub sticky header
    html2, n = re.subn(
        r'<header>\s*<div class="nav-wrap">[\s\S]*?</header>\s*',
        hdr + '\n\n',
        html,
        count=1,
        flags=re.I,
    )
    if n:
        return html2
    # marketplace minimal header
    html2, n = re.subn(
        r'<header>\s*<div class="nav-wrap">[\s\S]*?</div>\s*</header>\s*',
        hdr + '\n\n',
        html,
        count=1,
        flags=re.I,
    )
    if n:
        return html2
    # site-nav
    html2, n = re.subn(
        r'<nav class="site-nav">[\s\S]*?</nav>\s*',
        hdr + '\n\n',
        html,
        count=1,
        flags=re.I,
    )
    if n:
        return html2
    return html


def replace_footer(html: str) -> str:
    foot = footer_html()
    # Remove existing chat widget / nav scripts before appending once
    html = re.sub(r'\s*<script src="[^"]*chat-widget\.js"[^>]*>\s*</script>\s*', '\n', html)
    # Replace site-footer if present
    if 'class="site-footer"' in html or "class='site-footer'" in html:
        html = re.sub(
            r'<footer class="site-footer">[\s\S]*?</footer>\s*(?:<script>[\s\S]*?</script>\s*)?',
            '',
            html,
            count=1,
            flags=re.I,
        )
    # Replace generic footer
    html = re.sub(
        r'<footer>[\s\S]*?</footer>\s*',
        '',
        html,
        count=1,
        flags=re.I,
    )
    # Insert before final body close
    if "</body>" in html:
        html = re.sub(r'</body>', foot + "\n</body>", html, count=1, flags=re.I)
    else:
        html += "\n" + foot
    return html


def restyle_tide_fill(html: str) -> str:
    html = html.replace('fill="#F1E3C0"', 'fill="#faf7ee"')
    html = html.replace('fill="#BFE3DA"', 'fill="#faf7ee"')
    html = html.replace("fill='#F1E3C0'", "fill='#faf7ee'")
    html = html.replace("fill='#BFE3DA'", "fill='#faf7ee'")
    return html


def slim_hub_inline_css(html: str) -> str:
    """Keep page-specific card CSS; drop duplicated chrome/root/fonts if possible."""
    # Remap common brass/seafoam token usages in remaining inline CSS
    replacements = {
        "var(--page-bg)": "var(--cream-2)",
        "var(--white)": "var(--cream)",
        "var(--brass)": "var(--gold)",
        "var(--brass-light)": "var(--gold-light)",
        "var(--navy-deep)": "var(--navy-deep)",
        "var(--navy-mid)": "var(--navy)",
        "var(--seafoam)": "var(--cream)",
        "var(--ink)": "var(--ink)",
        "var(--ink-soft)": "var(--muted)",
        "'Bodoni Moda',serif": "var(--font-serif)",
        "'Bodoni Moda', serif": "var(--font-serif)",
        "'Karla',sans-serif": "var(--font-sans)",
        "'Karla', sans-serif": "var(--font-sans)",
        "'Big Shoulders Display',sans-serif": "var(--font-sans)",
        "'Big Shoulders Display', sans-serif": "var(--font-sans)",
        "#BFE3DA": "var(--cream-2)",
        "#0A2733": "var(--navy-deep)",
        "#C6A044": "var(--gold)",
        "#E3C878": "var(--gold-light)",
        "#CFE6DC": "var(--cream)",
        "#FBF9F1": "var(--cream)",
        "#123B4E": "var(--navy)",
        "#1E6E79": "var(--teal)",
    }
    for old, new in replacements.items():
        html = html.replace(old, new)
    return html


def detect_current(rel: str) -> str | None:
    mapping = {
        "ships/index.html": "/ships/",
        "ports/index.html": "/ports/",
        "dining/index.html": "/dining/",
        "entertainment/index.html": "/entertainment/",
        "excursions/index.html": "/excursions/",
        "faq/index.html": "/faq/",
        "marketplace/index.html": "/marketplace/",
        "marketplace/sellers/index.html": "/marketplace/",
        "agents/index.html": "/agents/",
    }
    return mapping.get(rel)


def process_file(path: Path) -> None:
    rel = str(path.relative_to(ROOT)).replace("\\", "/")
    if rel == "index.html":
        return  # handled separately
    if "node_modules" in rel or "api/" in rel:
        return

    html = path.read_text(encoding="utf-8")
    original = html

    html = remove_cc_overlay_style(html)
    html = remove_get_the_app(html)
    html = inject_head_assets(html)
    html = replace_header(html, detect_current(rel))
    html = restyle_tide_fill(html)
    html = slim_hub_inline_css(html)
    html = replace_footer(html)

    # Hub heroes: add hub-hero class alongside page-hero if it's the centered hub style
    if rel in {
        "ships/index.html",
        "ports/index.html",
        "dining/index.html",
        "entertainment/index.html",
    }:
        html = html.replace('class="page-hero"', 'class="hub-hero"', 1)

    if html != original:
        path.write_text(html, encoding="utf-8")
        print(f"updated {rel}")
    else:
        print(f"unchanged {rel}")


def update_homepage() -> None:
    path = ROOT / "index.html"
    html = path.read_text(encoding="utf-8")
    html = remove_get_the_app(html)

    # Expand homepage nav to full set; keep cream header styling from inline CSS
    new_nav_links = """      <div class="nav-links">
        <a href="/ships/">Ships</a>
        <a href="/ports/">Ports</a>
        <a href="/dining/">Dining</a>
        <a href="/entertainment/">Entertainment</a>
        <a href="/excursions/">Excursions</a>
        <a href="/faq/">FAQ</a>
        <a href="/marketplace/">Marketplace</a>
      </div>
      <div class="nav-cta">
        <a href="/agents/" class="btn btn-outline">Find an Agent</a>
      </div>"""

    html = re.sub(
        r'<div class="nav-links">[\s\S]*?<div class="nav-cta">[\s\S]*?</div>',
        new_nav_links,
        html,
        count=1,
    )

    # Footer links — keep Find an Agent, drop nothing extra
    html = re.sub(
        r'<div class="foot-links">[\s\S]*?</div>',
        '''<div class="foot-links">
        <a href="/ships/">Ships</a>
        <a href="/ports/">Ports</a>
        <a href="/dining/">Dining</a>
        <a href="/entertainment/">Entertainment</a>
        <a href="/planning/disney-cruise-cost.html">Plan Your Sailing</a>
        <a href="/agents/">Find an Agent</a>
      </div>''',
        html,
        count=1,
    )

    path.write_text(html, encoding="utf-8")
    print("updated index.html")


def main() -> None:
    update_homepage()
    for path in sorted(ROOT.rglob("*.html")):
        process_file(path)


if __name__ == "__main__":
    main()
