# Patch HTML: dual logo_arrow + name wordmark + i-tittle triangle
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

LOGO_LOCKUP = (
    '<a class="logo" href="/">\n'
    '        <span class="logo-lockup">\n'
    '            <img class="logo-mark logo-img--light" src="/logo/logo_arrow_White.svg" alt="" '
    "onerror=\"this.onerror=null;this.src='logo/logo_arrow_White.svg'\">\n"
    '            <img class="logo-mark logo-img--dark" src="/logo/logo_arrow_Black.svg" alt="" '
    "onerror=\"this.onerror=null;this.src='logo/logo_arrow_Black.svg'\">\n"
    '            <span class="logo-wordmark">\n'
    '                <img class="logo-img logo-img--light" src="/logo/glotix_Black.svg" alt="Glotix" '
    "onerror=\"this.onerror=null;this.src='logo/glotix_Black.svg'\">\n"
    '                <img class="logo-img logo-img--dark" src="/logo/glotix_White.svg" alt="" '
    "onerror=\"this.onerror=null;this.src='logo/glotix_White.svg'\">\n"
    '                <img class="logo-i-tittle" src="/logo/glotix_Triangle.svg" alt="" '
    "onerror=\"this.onerror=null;this.src='logo/glotix_Triangle.svg'\">\n"
    "            </span>\n"
    "        </span>\n"
    "    </a>"
)

LOGO_RE = re.compile(
    r'<a class="logo(?:\s+logo-sm)?" href="/">\s*'
    r'<span class="logo-lockup">\s*'
    r'(?:<img class="logo-mark[^"]*"[^>]*>\s*)+'
    r'(?:<span class="logo-wordmark">\s*)?'
    r'<img class="logo-img logo-img--light"[^>]*>\s*'
    r'<img class="logo-img logo-img--dark"[^>]*>\s*'
    r'(?:<img class="logo-i-tittle"[^>]*>\s*)?'
    r'(?:</span>\s*)?'
    r'</span>\s*'
    r'</a>',
    re.S,
)

FAVICON_RE = re.compile(
    r'<link rel="icon" type="image/svg\+xml" href="/logo/(?:favicon|logo_arrow(?:_White|_Black)?)\.svg">'
)

CONN_JS_RE = re.compile(r'13-connection\.js\?v=\d+')


def main() -> None:
    for path in ROOT.rglob("*.html"):
        if "node_modules" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        orig = text
        text = FAVICON_RE.sub(
            '<link rel="icon" type="image/svg+xml" href="/logo/logo_arrow_White.svg">',
            text,
        )
        text = CONN_JS_RE.sub("13-connection.js?v=18", text)

        def repl(m: re.Match[str]) -> str:
            block = m.group(0)
            if "logo-sm" in block.split(">", 1)[0]:
                return LOGO_LOCKUP.replace(
                    '<a class="logo" href="/">',
                    '<a class="logo logo-sm" href="/">',
                )
            return LOGO_LOCKUP

        text = LOGO_RE.sub(repl, text)
        if text != orig:
            path.write_text(text, encoding="utf-8")
            print("updated", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
