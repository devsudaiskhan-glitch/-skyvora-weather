# Visual QA Runbook — Skyvora Weather 5.0.0

This is a manual browser/device checklist. Source-level responsive tests are useful regression checks, but they cannot certify a rendered screen on a physical device.

## Required viewport pass

Test each major route (Dashboard, Forecast, Maps, Air Quality, Comparison, History, Marine, Planner, Favorites, Journal, Settings, Intelligence, Alerts, Pakistan, Diagnostics and Education) at these CSS viewport widths:

| Class | Widths |
|---|---|
| Compact phone | 320, 360 px |
| Standard phone | 375, 390, 414 px |
| Large phone | 480, 560, 600 px |
| Tablet | 768, 820, 900, 1024 px |
| Laptop | 1080, 1280, 1366 px |
| Desktop | 1440, 1600, 1920 px |

At minimum, physically verify one Android phone, one iPhone if available, one tablet, and one Windows/macOS desktop browser. Use current Chrome/Edge, Safari on iOS, and Firefox where available.

## Visual acceptance checks

- No document-level horizontal overflow or clipped primary controls.
- Sidebar, topbar, mobile drawer and bottom navigation do not overlap content.
- Search results remain visible, scrollable and selectable inside the viewport.
- Weather hero, forecast cards, charts, map, forms, tables and modals reflow without overlap.
- Both dark and light themes preserve readable text and meaningful state contrast.
- Loading, success, empty, stale-cache, offline and error states are visually distinguishable.
- Touch controls are comfortably targetable; hover-only information is not essential.
- Safe-area padding works around mobile notches and gesture bars.
- Browser console has no uncaught errors, missing local assets or repeated failed requests.

## Evidence to record

For every failed screen, record device/browser/OS, viewport, route, steps, screenshot, console error and severity. Retest the same screen after a fix and run `npm test`, `npm run check` and `npm run audit:production` before closing the issue.
