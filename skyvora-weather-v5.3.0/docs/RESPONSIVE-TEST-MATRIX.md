# Skyvora Weather — Responsive Test Matrix (V5.0.0)

## Viewports

| Device class | Widths | Primary checks |
|---|---|---|
| Compact phone | 320, 360 px | No horizontal page scroll; search fits; bottom-nav labels remain visible; cards do not clip. |
| Standard phone | 375, 390, 414 px | Hero hierarchy, search results, cards, metrics, bottom nav and forms. |
| Large phone | 480, 560, 600 px | Transition into compact tablet layout; chart and map panels remain inside viewport. |
| Small tablet | 768, 820 px | Off-canvas sidebar, accessible drawer dismissal, stacked dashboard sections. |
| Tablet | 900, 1024 px | 2-column content grids, compact header, chart sizing and map height. |
| Laptop | 1080, 1280, 1366 px | Sidebar/main-column balance, header search width, 2–3 column grids. |
| Desktop | 1440, 1600, 1920 px | Max content width, balanced whitespace, readable cards and data density. |

## Interaction checks

1. Open the sidebar using the menu button at tablet/mobile widths.
2. Close it using a navigation item, an outside tap, and Escape. Confirm focus returns to the menu button after Escape.
3. Open worldwide search; verify the dropdown remains inside the viewport and can be scrolled.
4. Test the Home dashboard, Forecast, Maps, Air Quality, Comparison, History, Marine, Planner, Favorites, Journal, Settings, Intelligence, Alerts, Pakistan, Diagnostics and Education views.
5. Check chart controls, hourly horizontal scrolling, 5/10-day forecast rows and map controls.
6. Check forms, selects, tables, modals, toasts and image journal cards.
7. Test both dark and light themes.
8. Test with keyboard-only navigation and `prefers-reduced-motion`.
9. Test on a touch device to ensure hover lift does not remain stuck after taps.
10. Check safe-area spacing on a phone with a bottom gesture bar.

## Automated verification

- `npm test` includes responsive-source regression tests.
- `npm run check` validates the project, assets, imports, HTML IDs, service-worker shell and responsive breakpoints.
- CSS syntax was parsed with tinycss2 in the build environment.

Automated checks do not replace screenshot-based visual inspection in an actual browser. Record any platform-specific differences before production deployment.


For the full physical-device pass and evidence checklist, see `docs/VISUAL-QA-RUNBOOK.md`.
