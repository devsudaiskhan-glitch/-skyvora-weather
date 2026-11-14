# Accessibility Test Guide — Skyvora Weather 5.0.0

## Implemented source-level support

- Semantic page landmarks and a keyboard skip link to the main content.
- Visible `:focus-visible` styling.
- Search combobox/listbox semantics and live status regions.
- Mobile drawer Escape/outside-click handling with focus restoration.
- Reduced-motion CSS support and touch-specific behavior.
- Labels on primary icon-only navigation controls.

These are implementation features, not proof of WCAG conformance. A human assistive-technology review remains required.

## Manual keyboard pass

1. Reload the page and press Tab. The first focusable control should be “Skip to main content”.
2. Press Enter and confirm focus moves into the main content.
3. Navigate all controls using Tab/Shift+Tab, Enter, Space and arrow keys where appropriate.
4. Open and close the mobile navigation with keyboard; Escape must close it and return focus to the menu button.
5. Operate location search without a mouse: type, arrow through suggestions, select with Enter, dismiss with Escape.
6. Confirm focus is always visible and is not hidden behind sticky headers, dialogs or navigation.
7. Confirm no essential action requires hover, dragging, color recognition or a pointer gesture alone.

## Screen-reader pass

Test with NVDA + Firefox/Chrome on Windows, VoiceOver + Safari on iOS/macOS, and TalkBack + Chrome on Android where available. Verify landmarks, headings, button names, input labels, search suggestion announcements, forecast/chart summaries, loading/error announcements and modal focus behavior.

## Contrast and text

- Check normal text against a minimum WCAG AA contrast ratio of 4.5:1.
- Check large text and meaningful non-text controls/indicators against 3:1 where WCAG applies.
- Test dark and light themes separately, including muted labels, disabled controls, chart lines and map overlays.
- Zoom to 200% and check reflow at narrow widths; text must not be clipped or require two-dimensional scrolling for ordinary content.
- Enable reduced motion at OS level and confirm nonessential movement is reduced.

Record tool, browser, OS, route, issue, screenshot and retest outcome. Do not claim WCAG compliance from automated source checks alone.
