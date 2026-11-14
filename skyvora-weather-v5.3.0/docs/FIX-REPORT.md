# Skyvora Weather — Historical Fix Report (V3.3.0–V3.3.1)

## 1. Forecast request rejected by provider
**Cause:** The previous Forecast API URL requested daily mean variables that are not in Open-Meteo's documented Forecast API `daily` parameter list. The backend mapped the upstream non-2xx response to HTTP 502, which obscured the provider's validation response.

**Fix:** The request now uses only supported daily variables. Ten-day means for temperature, feels-like, humidity, cloud cover, dew point, pressure and visibility are computed from real hourly data by local calendar date.

## 2. Upstream timeout / gateway resilience
**Cause:** One 12-second upstream timeout immediately surfaced to the browser as 504; transient upstream errors had no retry or stale-cache fallback.

**Fix:** Added one bounded retry for transient network/provider failures, a 12-second per-attempt timeout, a 30-second frontend request ceiling, and a six-hour stale-if-error fallback from memory or MongoDB cache. Stale responses include `stale: true`, the original `fetchedAt` timestamp and an explicit warning.

## 3. PWA install console notice
**Cause:** Skyvora intentionally calls `preventDefault()` to replace the browser's default install banner with its own Install button. Chrome can log a “Banner not shown” message until the deferred event's `prompt()` is invoked.

**Fix:** The install action now calls `prompt()` from the user's button click, handles dismissal/errors, and listens for `appinstalled`. The DevTools message is informational until the user clicks Install; it is not an application runtime failure.

## 4. Historical release identity correction
The previous document mixed V3.3.0 and V3.3.1 identifiers. The shipped V3.3.1 source used package/backend/frontend version 3.3.1 and cache `skyvora-shell-v3-3-1`. V5.0.0 now uses a single 5.0.0 identity and cache `skyvora-shell-v5-0-1`.

Default development port remains 5065.

## V3.3.0 fixes

1. Replaced the ambiguous Settings glyph with a clearer gear icon and applied a consistent icon in mobile navigation.
2. Removed the Urdu option and Urdu translation table; application preference is now forced to English/LTR, including migration of old local preferences.
3. Rebuilt Weather Trends control markup into distinct Metric and Forecast Range groups. Metric chips now have explicit grid gaps, minimum tap height, clear labels, and responsive 6/4/3-column layouts.

## V3.3.0 — Worldwide Search Engine

- Replaced basic city suggestions with a polished worldwide geocoding experience backed by Open-Meteo Geocoding / GeoNames.
- Added country flags, administrative divisions, place type, population and timezone metadata when provided by the geocoder.
- Added city-country disambiguation, supported postal code queries, coordinate search, saved/recent quick access and current-location shortcut.
- Added relevance ranking, deduplication, request debouncing/cancellation, dedicated timeout, keyboard navigation and accessible combobox/listbox states.
- Added a provider coverage note; global search is not claimed to be literally exhaustive for every named settlement or address.

## V3.3.0 worldwide search implementation details

- Open-Meteo Geocoding endpoint now accepts a configurable result count (1–20 in this application), English result labels, and an optional ISO-3166-1 alpha-2 country filter.
- Search results display Unicode country flags, administrative area, place type, population and timezone where returned by the GeoNames-backed index.
- `City, Country` and `City, Region` disambiguation, supported postal-code search, and direct coordinate entry are supported.
- The autocomplete opens with saved and recently viewed places, offers a current-location shortcut, and has a polished loading/error/empty state.
- Keyboard navigation supports Arrow Up/Down, Enter and Escape. New keystrokes cancel stale requests; debounce timers and search timeouts are handled separately.
- Search result ranking is case- and accent-insensitive, deduplicates matching coordinates, and prioritizes exact/prefix place names.
- Search is available on port 5065 by default. `/api/build` identified release 3.3.1 in the V3.3.1 baseline; V5.0.0 now reports 5.0.0.


## V3.3.0 responsive update

The previous responsive rules were fragmented across the primary stylesheet and a small responsive file. A consolidated final responsive layer now coordinates the page shell, off-canvas navigation, mobile bottom bar, header/search behavior, dashboard and secondary-page grids, data visualizations, map/table overflow, and mobile dialogs. The application now supports a 320px minimum viewport, tablet transitions, landscape phones, safe areas, touch-specific hover handling and reduced-motion preferences. The mobile drawer now closes on outside click and Escape and restores focus to its trigger.


## V3.3.1 — Readable typography

- Raised the default application reading size from 14px to 15px.
- Added a dedicated `readability.css` layer after the responsive stylesheet so typography remains consistent at every viewport.
- Increased descriptive paragraphs, forecast explanations, source notes, AQI descriptions, search guidance, map notes and supporting labels; most body copy now uses 13px and supporting text 12px, with a mobile supporting-text minimum of 11.5px.
- Changed explanatory copy to regular 400 weight, improved contrast and line height, and preserved the visual hierarchy of temperatures, headings and primary values.
- Added the stylesheet to the PWA app shell and bumped cache identity to `skyvora-shell-v3-3-1`.
