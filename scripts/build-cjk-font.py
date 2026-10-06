#!/usr/bin/env python3
"""Rebuild assets/fonts/NotoSansSC-Regular-ClassGraph.ttf from pinned upstream Noto Sans SC.

The PDF exporter embeds this font only when a project contains text the built-in Latin PDF font
cannot encode (for example Chinese names). pdf-lib then subsets it again per document, so a PDF
only carries the glyphs it actually uses.

Usage (needs `pip install fonttools`):

    python3 scripts/build-cjk-font.py

Coverage: Basic Latin, Latin-1, Latin Extended-A, general punctuation, arrows, geometric shapes,
CJK symbols and punctuation, Hiragana/Katakana, the full CJK Unified Ideographs block
(U+4E00-U+9FFF) and half/full-width forms. Characters outside this set make PDF export fail with
CG-5004 instead of being dropped or replaced.

Licence: Noto Sans SC is released under the SIL Open Font License 1.1 with no Reserved Font Name,
so this subset may be redistributed. assets/fonts/OFL.txt must ship next to the font.
"""

import hashlib
import sys
import tempfile
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

UPSTREAM_COMMIT = "f8d157532fbfaeda587e826d4cd5b21a49186f7c"
BASE = f"https://raw.githubusercontent.com/notofonts/noto-cjk/{UPSTREAM_COMMIT}/Sans"
SOURCES = {
    "NotoSansSC-VF.ttf": (
        f"{BASE}/Variable/TTF/Subset/NotoSansSC-VF.ttf",
        "d68bafcb48a2707749396aa12bbbd833cb70401f3a9a689fd2902c7e0d295964",
    ),
    "OFL.txt": (
        f"{BASE}/LICENSE",
        "6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2",
    ),
}

RANGES = [
    (0x0020, 0x007E),  # Basic Latin
    (0x00A0, 0x017F),  # Latin-1 Supplement, Latin Extended-A
    (0x2000, 0x206F),  # General Punctuation
    (0x2190, 0x21FF),  # Arrows
    (0x25A0, 0x25FF),  # Geometric Shapes
    (0x3000, 0x303F),  # CJK Symbols and Punctuation
    (0x3040, 0x30FF),  # Hiragana, Katakana
    (0x4E00, 0x9FFF),  # CJK Unified Ideographs
    (0xFF00, 0xFFEF),  # Half-width and Full-width Forms
]

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
OUTPUT_FONT = OUTPUT_DIR / "NotoSansSC-Regular-ClassGraph.ttf"


def fetch(url: str, expected_sha256: str, target: Path) -> None:
    with urllib.request.urlopen(url) as response:
        data = response.read()
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected_sha256:
        sys.exit(f"Checksum mismatch for {url}: {digest}")
    target.write_bytes(data)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as work:
        work_dir = Path(work)
        for name, (url, sha) in SOURCES.items():
            fetch(url, sha, work_dir / name)

        variable = TTFont(work_dir / "NotoSansSC-VF.ttf")
        regular = instancer.instantiateVariableFont(variable, {"wght": 400})

        options = subset.Options()
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.notdef_outline = True
        options.hinting = False
        subsetter = subset.Subsetter(options)
        codepoints = {cp for start, end in RANGES for cp in range(start, end + 1)}
        subsetter.populate(unicodes=codepoints)
        subsetter.subset(regular)
        # pdf-lib's fontkit subsetter writes a short-format loca table, which needs every glyph
        # to start on an even offset. fontTools leaves glyphs unpadded for long-format fonts,
        # which makes most glyphs vanish from exported PDFs. Pad to 4 bytes.
        regular["glyf"].padding = 4
        regular.save(OUTPUT_FONT)

        (OUTPUT_DIR / "OFL.txt").write_bytes((work_dir / "OFL.txt").read_bytes())

    print(f"Wrote {OUTPUT_FONT} ({OUTPUT_FONT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
