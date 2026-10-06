# ClassGraph — Phase 17 Recovery Log

**Phase:** 17 — Chinese-language interface  
**Branch:** `claude/intelligent-cerf-9dyifr`  
**Base:** `main` after Phase 16  
**Status:** Implemented — PR open  
**Last updated:** 2026-10-06

## Problem

ClassGraph could read and print Chinese names, but its whole interface was in English.

## What changed

- **Language setting.** It sits next to **Appearance**, on the start screen and in the sidebar,
  with two choices: **English** and **中文（简体）**.
  - When the teacher has not chosen, ClassGraph follows the system language.
  - The choice is stored in `localStorage`. Changing it reloads the window; classes save as they
    change, so nothing is lost.
  - `<html lang>` is set to `zh-CN`, so screen readers and fonts treat the text as Chinese.
- **How translation works** (`src/i18n.ts`), on the same principle as EduBoard:
  - The English text is the key. `tr('Save')` returns the Chinese entry, or the English when no
    entry exists.
  - Sentences keep `{placeholders}`, so word order can change in Chinese.
  - Translations were written by hand, once; nothing is machine-translated while the app runs.
- **Catalogue.** `src/i18n-zh.ts` holds about 720 entries covering every screen.
  - Wording follows a fixed glossary: 学号, 指标, 缺失, 未记录, 座位安排, 候选方案, 硬性约束 and
    so on.
  - It uses 你 and full-width punctuation, with a space between Chinese and Latin text.
- **Errors.** `src/i18n-zh-errors.ts` has a Chinese summary for every `CG-xxxx` code. In Chinese
  an error shows the summary and the code, then the original English detail on the next line, so
  nothing a teacher might need to report is lost.
- **Messages from the analysis code.** `src/i18n-zh-server.ts` translates them at display time.
  This covers:
  - spreadsheet import problems;
  - constraint checks;
  - seating and grouping explanations;
  - the correlation caveat.

  These modules stay in English because exports and tests share them. A message without a
  pattern is shown in English.

- **Fonts.** The font stack falls back to PingFang SC, Microsoft YaHei and Noto Sans CJK SC.
  Buttons keep short Chinese words on one line.
- **Error codes.** Each `CG-xxxx` code now has one meaning. Six codes were each used for two
  unrelated errors. The client opened the unlock screen for any CG-2015, so a desktop transport
  error could have shown it by mistake. The new codes are:
  - desktop transport error: CG-2025;
  - local storage disabled: CG-2026;
  - damaged protected file: CG-2027;
  - unknown update action: CG-2028;
  - seating history: CG-4024 to CG-4026.

## Tests

- **`tests/i18n.test.ts`** checks that:
  - every `tr()` key in the client is a plain string literal and has a Chinese entry;
  - there are no unused entries;
  - placeholders and markup match between the English and the Chinese;
  - every error code in `src/` has a summary;
  - every analysis-message pattern is exercised by an example.
- **`e2e/chinese.e2e.ts`** runs with a Chinese browser locale and checks that:
  - the app opens in Chinese and passes axe;
  - switching to English and back works;
  - a wrong password is explained in Chinese;
  - a broken backup shows the Chinese summary, the code and the English detail.
- **English is unchanged.** All existing English end-to-end tests pass without edits.

## Limits

- **Reports and exports** (PDF, DOCX and JSON) are still written in English. Chinese names
  print correctly; Chinese report text would be a follow-up.
- **Synthetic example data** keeps its English metric names (Assessment, Participation), because
  those names are class data, not interface text.
- **The browser's file picker button** ("Choose File") comes from the browser in development
  mode. In the desktop app it follows the system language.
- **Assistance prompt help.** The example syntax stays in English, because the parser reads
  English clauses.
