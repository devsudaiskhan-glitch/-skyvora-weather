# Skyvora Weather 5.3.0 — Refined Weather Experience

A full-stack weather experience built with HTML5, CSS3, Vanilla JavaScript, Node.js, Express and optional MongoDB persistence. The release keeps its frontend and backend separated by responsibility, with focused helpers, automated checks and documented operational limits.

## What is included in 5.3.0

### V5.3.0 interaction polish
- Mobile sidebar Search closes before focusing the global search field, avoiding the open-drawer overlay blocking the search surface.
- Forecast Ask action has an explicit accessible submit label and consistent tap target.
- 24-hour cards, wind compass, daylight path/sun and AQI/pollutant visuals include restrained motion.
- The wind needle completes one turn and settles on the actual reported bearing.
- All added motion respects `prefers-reduced-motion`.


- Lighthouse-related fixes for robots.txt, initial map payload and accessibility semantics.
- Leaflet is loaded only when the user opens Weather Maps.

- Skyvora branding with a minimal, custom SVG mark and matching favicon.
- A dedicated brand style layer, versioned offline cache and an organized documentation tree.
- Existing browser preferences, saved locations and journal data remain compatible with the previous SkyCast release.

### Forecast API validation (502 root cause)
- The Forecast API `daily` request now contains only documented Forecast API daily parameters.
- Removed unsupported daily mean fields such as `temperature_2m_mean`, `relative_humidity_2m_mean`, `cloud_cover_mean`, `apparent_temperature_mean`, `dew_point_2m_mean`, `pressure_msl_mean` and `visibility_mean`.
- Ten-day trend charts for those metrics now calculate daily averages from the actual hourly forecast series returned by Open-Meteo. They do not use sample or fabricated values.
- The provider's HTTP status and reason are retained in server-side logs to make future provider errors diagnosable.

### Upstream reliability (504 / intermittent 502)
- Transient provider/network failures are retried once, with a short backoff.
- Each upstream attempt has a 12-second timeout; the frontend request timeout is 30 seconds to allow the bounded retry sequence to finish.
- If Open-Meteo remains unavailable, Skyvora can return the last successful in-memory or MongoDB cached forecast for up to six hours and marks the response as stale/cached.
- The dashboard identifies stale data as cached and retains the original provider timestamp. Stale data is never labelled live.
- LocalStorage remains a second fallback when the backend cannot be reached.

### PWA installation notice
- The app captures `beforeinstallprompt` to show its own Install button and invokes `prompt()` only when the user clicks it.
- Chrome's DevTools message `Banner not shown: beforeinstallpromptevent.preventDefault() called` is informational while the custom Install button has not yet been clicked. It is not a weather/API error. If installation is available, click **Install app** in Skyvora; otherwise use the browser's Install app / Add to Home screen menu.
- The app now handles the `appinstalled` event and clears the install state.

## Existing product features retained
- Unified reference-inspired interface across all routes.
- Current weather, geocoding, 24-hour forecast, 10-day forecast, Weather Trends, wind compass, daylight arc, AQI and pollutant trends, weather maps, historical weather, marine data, city comparison, favorites, preferences, weather journal, notifications, PWA and offline shell.
- Express backend with optional MongoDB cache and API metrics.

## Project structure

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the folder map, runtime flow and code conventions. [`docs/CHANGELOG.md`](docs/CHANGELOG.md) records the V5.2.0 rebrand and maintenance changes.

## Requirements
- Node.js 20 or newer
- npm
- Internet access for weather data, scenic photos, fonts, Leaflet and map tiles
- MongoDB is optional; without it, live weather remains available and an in-memory cache is used.

## Run on Windows
1. Extract this ZIP into a **new folder**; do not overwrite an older Skyvora folder.
2. Open PowerShell in that folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:5065`.

## Verify the exact build
Open `http://localhost:5065/api/build`. Expected: `version: 5.2.0`, `design: premium-atmosphere-v3`, `port: 5065`. Stop older Skyvora servers with Ctrl+C before launching this build.

## Configuration
Copy `.env.example` to `.env` if you want to configure MongoDB or override the port. The weather API works without MongoDB. Never include `.env` or real API credentials in a public repository or shared ZIP.

## Commands
- `npm start` — start server
- `npm run dev` — Node watch mode
- `npm test` — unit tests
- `npm run check` — static project checks
- `npm run audit:production` — first-party asset-size and source-safeguard audit (not Lighthouse)

## Provider and data notes
- Current weather, hourly/daily forecast, geocoding, air quality, historical weather and marine data use Open-Meteo endpoints.
- Daily forecast requests are restricted to the provider's documented Forecast API daily variables. Where a daily aggregate is not exposed by that endpoint, 10-day chart values are calculated from the corresponding actual hourly data points.
- Air-quality views use US AQI and pollutant-specific sub-indices alongside pollutant concentrations. AQI sub-indices and μg/m³ concentration values are different measurements and are not interchangeable.
- Official warnings, live radar/satellite overlays, generative AI and background push delivery are not configured in this build.

## QA and status
See `docs/FEATURE-STATUS.md`, `docs/FIX-REPORT.md`, `docs/QA-REPORT.md`, `docs/PRODUCTION-READINESS.md` and the `docs/` QA runbooks for implementation notes, tests and known limitations. Automated/unit, responsive regression, static project and CSS parser checks passed in the build environment. Live browser, API and MongoDB verification still depends on the user's machine, network and external providers.

## V3.3.0 interface refinements

- Replaced the Settings navigation glyph with a clearer gear and use it consistently in desktop and mobile navigation.
- Removed Urdu from the language selector and normalized legacy Urdu preferences to English (LTR).
- Rebuilt Weather Trends controls into separate, labeled Metric and Forecast Range groups. Metric buttons now use responsive grids with visible gaps, larger touch targets, and clear active/focus states.



## Worldwide location search (V3.3.0)

Skyvora uses the Open-Meteo Geocoding API, backed by GeoNames location data, for global city and place discovery. Search supports city names, `City, Country` or `City, Region` qualifiers, supported postal codes, and direct latitude/longitude coordinates. Results show the country flag, administrative area, location type, population (when supplied), and timezone. Duplicate coordinates are removed and exact/prefix matches are ranked first.

The search dropdown also shows saved places and recent locations, supports arrow-key navigation, Enter/Escape, request debouncing, cancellation of outdated requests, loading/error/empty states, and a current-location shortcut. To disambiguate a city with the same name elsewhere, enter the country or region, for example `Paris, France`.

**Coverage note:** the geocoder searches a worldwide GeoNames-backed index, not a literal exhaustive list of every hamlet, street, or postal address on Earth. Some small settlements and postcodes may be missing or represented under a nearby populated place. Coordinates can be entered directly when a named result is unavailable. Open-Meteo's public geocoding API is intended for non-commercial use; commercial deployment requires an appropriate plan and attribution.

Data attribution: [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) · [GeoNames](https://www.geonames.org/).


## Responsive experience (V3.3.0)

The interface now has dedicated layout behavior for large desktop, laptop, tablet, mobile, compact phones (down to 320px), and mobile landscape. The responsive layer covers the fixed desktop sidebar, off-canvas tablet/mobile drawer, mobile bottom navigation, sticky compact topbar, full-width global search, responsive reference dashboard, card grids, charts, AQI, hourly forecast, wind compass, daylight visualization, maps, comparison cards, forms, tables, modals, toasts and footer.

Mobile navigation supports outside-tap and Escape dismissal, and the drawer returns focus to its menu button. Safe-area insets are used for bottom navigation and page padding. Touch devices avoid sticky hover-lift effects. `prefers-reduced-motion` is respected.

### Responsive test matrix

| Class | Widths to verify |
|---|---|
| Compact phones | 320, 360, 375, 390, 414 px |
| Large phones | 480, 560, 600 px |
| Tablet | 768, 820, 900, 1024 px |
| Laptop | 1080, 1280, 1366 px |
| Desktop | 1440, 1600, 1920 px |

Run `npm test` and `npm run check` to execute the automated responsive regression checks. See `docs/RESPONSIVE-TEST-MATRIX.md` for a practical device and interaction checklist. Visual browser inspection should still be performed on the target device and browser because operating-system browser chrome, installed fonts, and external image/map loading can affect the final rendering.


## Readability update (V3.3.1)

- Increased the app's base reading size to 15px and brought descriptive paragraphs to approximately 13px on desktop.
- Raised most supporting labels and helper text to 12px, with an 11.5px mobile minimum for dense data labels.
- Forecast disclaimers, source notes, Weather Trends explanations, AQI descriptions, map notes, empty states and search guidance now use a larger, regular-weight style with clearer contrast and more generous line height.
- Preserved the existing heading, temperature and key metric hierarchy; the typography update targets explanatory copy rather than enlarging every number or heading.
- Added `frontend/css/readability.css` after the responsive stylesheet and included it in the service-worker app shell.

The updated typography is designed to make the app's short explanations easier to read without making the dashboard unnecessarily crowded. Actual visual review on your browser and device is still recommended.


## V5.2.0 — Initial rendering and asset performance improvements

The dashboard now paints after the primary forecast response without waiting for air-quality data. Fonts are non-blocking, local CSS is consolidated, weather imagery is lighter, and off-screen dashboard sections use content visibility.

## V5.2.0 — Reliability, security and QA hardening

- Strictly validates coordinates, historical date ranges and geocoding result counts.
- Separates provider HTTP handling into a testable module with bounded timeouts, retry rules and clear handling for transient versus non-transient failures.
- Keeps weather requests available in degraded mode if MongoDB is not configured or its initial connection fails; initial connection attempts retry with bounded backoff. MongoDB is optional and persistence must be verified with your own database.
- Makes API rate-limit window and request ceiling configurable within bounded safe ranges.
- Adds a keyboard skip link and explicit accessibility test guidance.
- Adds a static first-party asset budget audit, plus visual QA, accessibility and performance runbooks.
- Keeps a strict distinction between automated source checks and real-device, browser, Lighthouse, database and HTTPS deployment verification.

V5.0 is a hardened source release, not a production deployment or a 10/10 certification. Read `docs/QA-REPORT.md` and `docs/PRODUCTION-READINESS.md` before deploying. Physical-device checks, screen-reader review, Lighthouse, live API, MongoDB persistence and HTTPS/PWA deployment still need to be performed in the target environment.

## V5.3.0 visual updates
- Weather scenes use dedicated photographic backgrounds for the selected WMO condition and provider day/night flag, with lightweight atmospheric overlays.
- The Locations page is now a global map of eight suggested scene-testing regions. Selecting a city loads its actual provider forecast; the map's scene labels are testing guidance, not live condition claims.
- Run `npm test`, `npm run check`, and `npm run audit:production` for the local automated checks. These are static/unit checks, not a browser visual QA or Lighthouse run.
