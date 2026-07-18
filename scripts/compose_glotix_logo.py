# Compose Glotix full logos: wordmark + orange triangle as "i" tittle (above i)
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "logo"

# Triangle as the "i" tittle — larger, apex centered on the stem
TRI_SCALE = 0.85
TRI_NATIVE_W = 194.35
TRI_NATIVE_H = 175.75
TRI_W = TRI_NATIVE_W * TRI_SCALE
TRI_H = TRI_NATIVE_H * TRI_SCALE
# Apex of glotix_Triangle path (near top point)
TRI_APEX_X = 84.68

# Wordmark geometry (from glotix_Black.svg)
I_X = 1055.65
I_W = 35.75
I_TOP = 86.79
I_CENTER_X = I_X + I_W / 2

# Place triangle apex directly above the "i" stem center
GAP = 2.0
TRI_X = I_CENTER_X - TRI_APEX_X * TRI_SCALE
TRI_Y_IN_WORD = I_TOP - GAP - TRI_H  # often negative → pad viewBox

PAD_TOP = max(0.0, -TRI_Y_IN_WORD) + 4.0
WORD_Y = PAD_TOP
TRI_Y = PAD_TOP + TRI_Y_IN_WORD

VB_W = 1451.44
VB_H = WORD_Y + 357.48


def main() -> None:
    tri_svg = (ROOT / "glotix_Triangle.svg").read_text(encoding="utf-8")
    m = re.search(r'<path[^>]*\sd="([^"]+)"', tri_svg)
    if not m:
        raise SystemExit("triangle path not found")
    tri_d = m.group(1)

    black = (ROOT / "glotix_Black.svg").read_text(encoding="utf-8")
    inner = re.search(
        r'<g id="Layer_1-2"[^>]*>\s*<g>(.*?)</g>\s*</g>',
        black,
        re.S,
    )
    if inner:
        word = inner.group(1).strip()
    else:
        inner = re.search(r"<g>(.*?)</g>", black, re.S)
        if not inner:
            raise SystemExit("wordmark paths not found")
        word = inner.group(1).strip()
        word = re.sub(r'\sfill="[^"]*"', "", word)

    def compose(fill: str, out_name: str) -> None:
        w = word
        w = re.sub(r"<path(?![^>]*fill=)", f'<path fill="{fill}"', w)
        w = re.sub(r"<rect(?![^>]*fill=)", f'<rect fill="{fill}"', w)
        w = re.sub(r'fill="#[0-9a-fA-F]+"', f'fill="{fill}"', w)
        svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB_W:.2f} {VB_H:.2f}" role="img" aria-label="Glotix">
  <g transform="translate({TRI_X:.2f},{TRI_Y:.2f}) scale({TRI_SCALE})">
    <path fill="#fcca69" d="{tri_d}"/>
  </g>
  <g transform="translate(0,{WORD_Y:.2f})">
{w}
  </g>
</svg>
"""
        (ROOT / out_name).write_text(svg, encoding="utf-8")
        print("wrote", out_name)

    compose("#0a0a0a", "glotix_Full_Black.svg")
    compose("#ffffff", "glotix_Full_White.svg")
    compose("#0a0a0a", "Dark_Logo.svg")
    compose("#ffffff", "white_Logo.svg")

    white_word = re.sub(r'fill="#[0-9a-fA-F]+"', 'fill="#ffffff"', word)
    white_word = re.sub(r"<path(?![^>]*fill=)", '<path fill="#ffffff"', white_word)
    white_word = re.sub(r"<rect(?![^>]*fill=)", '<rect fill="#ffffff"', white_word)
    (ROOT / "glotix_White.svg").write_text(
        f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1451.44 357.48">
  <g>{white_word}</g>
</svg>
""",
        encoding="utf-8",
    )

    black_word = re.sub(r'fill="#[0-9a-fA-F]+"', 'fill="#0a0a0a"', word)
    black_word = re.sub(r"<path(?![^>]*fill=)", '<path fill="#0a0a0a"', black_word)
    black_word = re.sub(r"<rect(?![^>]*fill=)", '<rect fill="#0a0a0a"', black_word)
    (ROOT / "glotix_Black.svg").write_text(
        f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1451.44 357.48">
  <g>{black_word}</g>
</svg>
""",
        encoding="utf-8",
    )

    # Icon-only favicon: light-theme arrow (dark outline + gold)
    white_arrow = ROOT / "logo_arrow_White.svg"
    if white_arrow.is_file():
        shutil.copyfile(white_arrow, ROOT / "favicon.svg")
        shutil.copyfile(white_arrow, ROOT / "logo_arrow.svg")
        print("favicon.svg / logo_arrow.svg <- logo_arrow_White.svg")

    print(
        "done vb",
        round(VB_W, 1),
        round(VB_H, 1),
        "tri",
        round(TRI_W, 1),
        "x",
        round(TRI_X, 1),
        "y",
        round(TRI_Y, 1),
        "i_center",
        round(I_CENTER_X, 1),
    )


if __name__ == "__main__":
    main()
