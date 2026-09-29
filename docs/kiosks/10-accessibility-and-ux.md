# Kiosk Domain Chunk 10: Accessibility (WCAG 2.2 Level AA) & UX

## 1. Domain Scope

This domain defines the intrinsic accessibility requirements, screen reader architecture, touch target sizing, high-contrast modes, dynamic text scaling, and cognitive simplicity to achieve full compliance with WCAG 2.2 Level AA, Section 508, and EN 301 549 (ADR-010).

---

## 2. Touch Target Architecture (WCAG 2.5.5 & 2.5.8)

- **Target Size**: All interactive elements (navigation buttons, checkboxes, radio options, keypad numbers) must meet minimum dimensions of **48x48 CSS pixels**.
- **Critical Action Size**: Primary buttons ("Next", "Hold to Confirm", "Begin Briefing") have minimum dimensions of **64x64 CSS pixels**.
- **Target Separation**: Minimum 8 CSS pixels between adjacent touchable boundaries to prevent accidental activation on physical touchscreens.

---

## 3. Accessible Authentication (WCAG 2.2 SC 3.3.8)

WCAG 2.2 explicitly prohibits cognitive function tests (such as memorized passwords or complex CAPTCHAs) as the sole method of authentication. The kiosk subsystem complies by providing:
- Barcode / QR / NFC badge scanning (zero cognitive effort).
- Short numeric employee IDs entered on a high-contrast virtual keypad.
- Visual confirmation of identity ("Welcome, Jane Doe") rather than demanding typed password verification on public glass.

---

## 4. Multi-Modal Interaction & Audio Narration

- **High Contrast Toggle**: Pinned in the universal accessibility toolbar. Flips UI to an ultra-high-contrast palette (WCAG AAA compliant ratio > 7:1; deep black background with vivid amber/cyan borders and text).
- **Text Sizing (Zoom)**: Toggle buttons for 100%, 125%, 150%, and 200% font scaling without horizontal scrolling.
- **Audio Narration**: Every step supports synchronized audio speech. Users can adjust volume or toggle mute directly from the top navigation bar.
- **Closed Captions**: Video blocks render WebVTT closed captions by default.

---

## 5. Screen Reader & ARIA Architecture

- Step transitions announce the new screen title and step counter via an `aria-live="polite"` region.
- Warning and emergency steps fire announcements via `aria-live="assertive"`.
- Keyboard & External Switch Navigation: Full tab order support, `Enter` / `Space` activation, and visible focus rings (`focus-visible: ring-4 ring-sky-500`).
