# ClassGraph — Phase 11 Recovery Log

**Phase:** 11 — Chinese text in PDFs  
**Branch:** `claude/intelligent-cerf-9dyifr`  
**Base:** `main` after Phase 10  
**Status:** Implemented — PR open  
**Last updated:** 2026-10-06

## Problem

PDF reports and the landscape seating plan used only the built-in Latin PDF fonts. Any
Chinese title, name, tag or label made export fail with `CG-5004`, so classes with Chinese names
could only use DOCX.

## Decisions

- **Font:** Noto Sans SC, SIL Open Font License 1.1, no Reserved Font Name, so a subset may be
  redistributed. Pinned to upstream `notofonts/noto-cjk` commit
  `f8d157532fbfaeda587e826d4cd5b21a49186f7c` with SHA-256 checks in
  `scripts/build-cjk-font.py`.
- **Coverage:** the full CJK Unified Ideographs block (U+4E00–U+9FFF), not just GB2312. GB2312
  saves about 5 MB but misses common name characters such as 喆, 玥 and 淏.
- **Size:** 7.7 MB on disk, roughly 4.6 MB after installer compression. A typical class PDF that
  uses the font is 13–20 KB, because pdf-lib subsets it again per document.
- **One weight:** bold text in CJK PDFs uses a fill-and-outline effect instead of a second
  7.7 MB font file.
- **English-only PDFs are unchanged:** they still use Helvetica.
- **Never drop characters:** anything the bundled font lacks (emoji, Hangul, CJK Extension A/B)
  fails with `CG-5004` and names the characters.

## Bug found while building

pdf-lib's fontkit subsetter writes a short-format `loca` table, which requires every glyph to
start on an even byte offset. fontTools saves long-format fonts without glyph padding, so most
glyphs vanished from exported PDFs. The build script now pads glyphs to 4 bytes, and a unit
test checks that every glyph offset in the shipped font is even.

## Deliverables

- [x] `assets/fonts/NotoSansSC-Regular-ClassGraph.ttf` and `assets/fonts/OFL.txt`.
- [x] `scripts/build-cjk-font.py` regenerates the font reproducibly.
- [x] `src/pdf-fonts.ts`: per-document font choice, glyph coverage check, synthetic bold.
- [x] PDF report and seating plan use it; long runs of Chinese text wrap by character, and seat
      labels are clipped by measured width instead of character count.
- [x] Electron passes its assets folder to the exporter; `electron-builder.yml` packages fonts.
- [x] Native `--self-test` exports a Chinese-titled PDF from the packaged app.
- [x] `release-desktop/` (packaging output) is now ignored by git, Prettier and ESLint.

## Verification

- [x] `npm run check`: format, lint, strict typecheck, 204 tests, build.
- [x] Rendered a 12-student class with Chinese title, names, metric labels, categories and tags
      to PNG: report and seating plan both legible, bold names crisp at 200 dpi.
- [x] Packaged the Linux app locally; `--self-test` under Xvfb passed, including the Chinese
      PDF export from inside the app archive.
- [x] Native self-tests on all four platforms in PR #15 (Desktop release run `37409826177`):
      Windows x64, Linux x64, macOS Apple Silicon and macOS Intel each exported the Chinese PDF.
