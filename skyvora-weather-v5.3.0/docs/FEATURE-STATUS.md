# Skyvora Weather — Feature Status (V5.0.0)

## V5.0.0 reliability, security and QA improvements
- Provider HTTP retry logic extracted into a dependency-free module and unit tested for timeout, transient recovery and non-retryable responses.
- Coordinate parsing, historical date validation and geocoding result-count validation are strict and independently tested.
- MongoDB connection timeout is configurable within a safe bound; connection lifecycle and degraded-persistence behavior are logged clearly.
- API rate-limit window and request ceiling are configurable within bounded safe ranges.
- Added a keyboard skip link and explicit manual accessibility test guide.
- Added static production asset audit and documented why it does not replace Lighthouse or real-device checks.
- Added visual QA and accessibility runbooks, plus a stricter production readiness gate.

## Existing product features retained
- Current weather, worldwide geocoding, 24-hour and 10-day forecast, weather trends, wind compass, daylight, AQI, weather maps, history, marine data, city comparison, favorites, preferences, journal, notifications, PWA and offline shell.

## Provider/infrastructure-dependent or unavailable
- Official severe-weather alerts are not configured.
- Live radar/satellite data, generative AI backend, background push delivery and authenticated account sync require separate providers/services and are not represented as active.
- MongoDB persistence is optional and remains disabled until `MONGODB_URI` is configured.
- HTTPS hosting and PWA installability must be verified on the final host.

## Honest test status
- Source/unit tests: 45/45 passed in the build workspace.
- Static project checks: passed.
- Static asset budget audit: passed.
- Live server/API, MongoDB, browser/device, Lighthouse, screen-reader and deployed PWA checks: not run in this build workspace.
