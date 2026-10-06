# ClassGraph — Phase 16 Recovery Log

**Phase:** 16 — Accessibility and dark mode  
**Branch:** `claude/intelligent-cerf-9dyifr`  
**Base:** `main` after Phase 15  
**Status:** Implemented — PR open  
**Last updated:** 2026-10-06

## Problem

- Several grey text colours were below the WCAG AA contrast ratio (4.5:1) on ClassGraph's light
  surfaces.
- Only text fields showed a keyboard focus indicator.
- Some controls had no accessible name: the student table cells, the seat assignment menus and the
  seat cards (which had only a hover title).
- There was no dark theme.

## What changed

### Accessibility

- **Contrast.** Every muted text colour on a light surface is now `#5a6872` or darker, which gives
  at least 4.87:1 on the darkest light surface.
- **Focus.** Every control shows a 3px focus ring on keyboard focus (`:focus-visible`). The ring
  colour is adjusted for each theme.
- **Skip link.** The first Tab in a class opens **Skip to workspace content**.
- **Navigation.**
  - The current sidebar item is marked `aria-current="page"`.
  - Choosing an item keeps keyboard focus on it, even though the sidebar is redrawn.
- **Names for controls.**
  - Student table cells are labelled with the student and the field, e.g. "Student 001,
    Assessment".
  - Seat assignment menus are labelled "Seat for …".
  - Seat cards announce their position, who is seated, whether the seat is enabled, and what
    pressing them does.
  - The scrollable synthetic preview can now be reached with the keyboard.
- **Keyboard seating.** Seats can already be assigned from the keyboard through the assignment
  table under the room grid. Dragging is optional.

### Dark mode

- **Colour tokens.** Every colour in `app/styles.css` is now a token named by its role and its
  light value:
  - `--bg-…` for surfaces;
  - `--fg-…` for text and chart strokes;
  - `--bd-…` for borders.

  Each token also has an `-rgb` triplet for translucent uses.

- **How the dark values were made.** They were derived once in OKLab, then checked by eye and by
  axe:
  - light surfaces become dark;
  - dark text becomes light;
  - surfaces that were already dark (the sidebar and the brand panel) stay as they are.
- **Hand-tuned exceptions:**
  - The primary button turns light in the dark theme, so it stays the strongest control.
  - Graph nodes take the surface colour.
- **Appearance setting.** A setting on the start screen and in the sidebar offers **Match
  system** (the default), **Light** or **Dark**.
  - The choice is stored in this browser profile's `localStorage`. If storage is unavailable, it
    still applies until ClassGraph closes.
  - The desktop window follows the operating system's setting through `prefers-color-scheme`.
- **What stays light.** Printed and exported reports (PDF, HTML, CSV) are unchanged and always
  light.

## Tests

`e2e/accessibility.e2e.ts` runs in the existing `e2e` CI job and covers four things:

1. The whole app is scanned with axe-core against the WCAG 2.0/2.1 A and AA rules, in both the
   light and the dark theme. This covers:
   - the start screen;
   - the class generator;
   - all seven workspace views, with a room grid and seating candidates on screen.

   Any violation fails the test, and the failure lists the rule and the elements.

2. Choosing **Dark** overrides a light system theme and is remembered on the next visit; choosing
   **Match system** removes the override.
3. Keyboard use works:
   - the skip link;
   - focus is kept after navigating;
   - a room can be created from the keyboard;
   - seat cards have descriptive labels.

## Limits

- Automated checks find roughly a third to a half of accessibility problems. Screen-reader testing
  with NVDA, VoiceOver and Orca has not been done yet.
- The relationship graph is visual. Its **Recorded edges and sources** table is the accessible
  equivalent, as before. Labels can overlap when a class has many students.
