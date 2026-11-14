# Changelog

## 5.3.0 — Simple photographic rain scene

- Removed the animated CSS rain layer from the dashboard.
- Replaced the rain background with a real Unsplash photograph of raindrops on a window.
- Reused the same image in the rain insight card for a consistent look.
- Kept other weather scenes and forecast behaviour unchanged.
- Simplified comments around the rain scene so the code is easier to follow.

## V5.2.8 — Provider error handling and request reliability

- Fixed read-only Fetch/DOMException message mutation that could mask forecast errors.
- Normalized provider network failures into safe, retryable application errors.
- Improved API error middleware so it safely handles malformed or non-standard errors.
- Increased forecast provider timeout to 12 seconds with one bounded retry.
- Aligned browser request timeouts with the server retry window for forecast and city search.
- Geocoding remains dependent on external network access to Open-Meteo; connectivity failures now return a clear temporary-unavailable response.

## V5.2.8

- Fixed mobile sidebar Search action so the drawer closes before the search field receives focus.
- Refined Ask button sizing, semantics and icon feedback.
- Added smooth 24-hour forecast hover interactions.
- Added one-turn wind compass hover animation that settles on the real bearing.
- Added daylight path/sun motion and restrained AQI gauge/pollutant animations.
- Honored reduced-motion preferences for all new effects.

# V5.2.3 — Worldwide Search UX Reliability\n\n- Fixed mobile search panel positioning so it stays attached below the input and does not cover the search field.\n- Improved touch targets, focus visibility, and search panel reopening behavior.\n- Updated release and service-worker cache identifiers.\n\n## V5.2.2 — More precise dynamic weather photography

- Expanded dashboard scene selection to distinguish clear, partly cloudy, overcast, drizzle, rain, heavy rain, thunderstorms, snow/freezing precipitation, fog, and high-wind clear conditions.
- Kept separate daytime and nighttime photos for each scene type.
- Added subtle condition-specific image grading while preserving the existing dashboard layout and performance strategy.
- Added automated coverage for the new WMO-to-scene mappings.

## V5.2.2 — Trace-led rendering and request-budget improvements

- Bound slow forecast and air-quality provider waits while retaining stale-cache fallback.
- Defer chart and notification modules from the initial JavaScript module graph.
- Use content visibility for below-the-fold dashboard sections to reduce first-layout work.
- Improve keyboard visibility of the skip link.
- Lighthouse 95+ remains unverified until tested on the target browser/device profile.

# Changelog

## V5.2.0 — Critical-path and first-render improvements

- Hydrate the dashboard from a validated last-known forecast in local storage before waiting for the live forecast API.
- Render a useful dashboard shell immediately on first visit; fetch weather in the background.
- Defer chart SVG generation and secondary icon hydration until after the first browser paint.
- Remove the remote Google Fonts dependency from the initial load and use a robust system font stack.
- Load only the active day/night atmospheric background and reduce scene image dimensions/quality.
- Keep API refresh, air-quality loading and existing weather features intact.
- Lighthouse/browser performance score is not claimed; retest with the same device and throttling profile.


- Render the primary weather dashboard immediately after the forecast response; fetch air quality asynchronously and update only its dashboard card.
- Load Google Fonts asynchronously, remove the unused Noto Naskh Arabic font request, and reduce requested font weights.
- Combine the ordered local stylesheets into one request while retaining the original source CSS files.
- Reduce remote weather-photo dimensions and compression quality for dashboard usage.
- Defer layout work for below-the-fold dashboard sections with intrinsic-size containment.
- Allow frontend CSS/JS assets to be revalidated in development instead of forcing `no-store`.
- Keep the service-worker shell and app version synchronized at 5.2.0.

# Changelog

## 5.0.9 — Lighthouse and accessibility fixes

- Added a real plain-text `/robots.txt` so the SPA fallback cannot return HTML for crawler requests.
- Corrected the location search input to expose a valid ARIA combobox role and removed an invalid label from a decorative current-hour marker.
- Exposed the AQI scale as an accessible meter and the map container as a named region.
- Deferred Leaflet JavaScript and CSS until the Maps view is opened, removing roughly 41 KiB of unused map JavaScript from the initial dashboard load.
- Changed the development HTML cache policy from `no-store` to `no-cache` to avoid unnecessarily disabling back/forward cache eligibility.
- Added regression checks for robots, combobox semantics and map lazy-loading.


## 5.0.9 — Portability and release QA correction

- Fixed the brand/home link to use the app's same-origin dashboard route instead of a hard-coded localhost port. This works regardless of the configured PORT and deployed domain.
- Synchronized package, backend, frontend, manifest and service-worker release identity to 5.0.9.
- Updated the QA report to distinguish source checks from unverified live/deployment checks and explicitly separate source checks from unverified live/deployment checks.

# Changelog

## 5.0.9 — Lighthouse and accessibility fixes

- Added a real plain-text `/robots.txt` so the SPA fallback cannot return HTML for crawler requests.
- Corrected the location search input to expose a valid ARIA combobox role and removed an invalid label from a decorative current-hour marker.
- Exposed the AQI scale as an accessible meter and the map container as a named region.
- Deferred Leaflet JavaScript and CSS until the Maps view is opened, removing roughly 41 KiB of unused map JavaScript from the initial dashboard load.
- Changed the development HTML cache policy from `no-store` to `no-cache` to avoid unnecessarily disabling back/forward cache eligibility.
- Added regression checks for robots, combobox semantics and map lazy-loading.


## 5.0.7 — Skyvora rebrand and maintainability pass

- Rebranded the product from SkyCast Weather to Skyvora Weather across the interface, backend build metadata, package metadata, PWA manifest, notifications and documentation.
- Added a small flat SVG sun-and-cloud mark and a matching favicon.
- Added a dedicated brand stylesheet with restrained blue accents, clearer active navigation states and reduced-motion safeguards.
- Updated the service-worker cache identity and precache list so the new brand assets and styles are available offline.
- Grouped project documentation under `docs/` and documented the frontend/backend architecture and contribution conventions.
- Preserved the previous local-storage and IndexedDB identifiers so existing browser data remains available after upgrading.
- Retained the existing forecast, search, AQI, charts, maps, historical, marine, comparison, favorites, journal, notification and PWA functionality.
- Updated automated release checks for the new version, brand assets and persistence compatibility.

## Verification boundary

The release checks cover source syntax, unit/regression behavior, HTML references, PWA shell assets and static asset budgets. They do not replace browser visual QA, Lighthouse, live provider verification, MongoDB acceptance or HTTPS deployment testing.

## 5.0.7 — Brand icon refresh and source cleanup

- Replaced the browser favicon, sidebar mark and installed-app icon artwork with the new standalone sun-and-cloud symbol.
- Removed the old framed logo treatment so the mark displays without a tile or border.
- Kept the existing feature modules and public API contracts intact while formatting the brand layer consistently.
- Bumped the application and service-worker cache versions so browsers fetch the updated assets.


## V5.2.4
- Fixed mobile result-panel width/positioning and touch selection event handling.
- Kept forecast 502 provider failures distinct from geocoding search behavior.


## V5.2.5
- Fixed mobile search dropdown positioning by portalling the results panel outside the sticky blurred topbar.
- Anchored autocomplete to the input using viewport coordinates and safe viewport gutters.
- Preserved search result click handling and outside-click behavior after portalling.
- Added regression checks for the search panel portal.

## V5.2.8 — Photographic scenes and global location explorer
- Replaced the previous generic weather-photo set with condition-specific day/night photography for clear, cloudy, rain, storm, snow and fog conditions.
- Added restrained cloud drift, rain, snowfall, fog movement and occasional storm-light flashes; motion respects `prefers-reduced-motion`.
- Replaced the single-location map view with a world map showing the eight weather-scene test regions. Each location can be opened to load its real forecast; map labels explicitly distinguish test-region tags from live weather.
- Versioned the app shell and PWA cache as V5.2.8.
