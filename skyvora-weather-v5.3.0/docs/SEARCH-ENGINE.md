# Skyvora Worldwide Search — V3.3.x baseline; retained in V5.0.0

## What it supports

- Worldwide city and populated-place search using Open-Meteo Geocoding (GeoNames-backed).
- `City, Country` and `City, Region` qualifiers to disambiguate same-name places.
- Supported postal-code lookup.
- Direct latitude/longitude coordinates, for example `33.6844, 73.0479`.
- Result details: country flag, administrative area, place type, population and timezone when supplied.
- Recent places, saved/favorite places and a current-location shortcut.
- Keyboard interaction: Arrow Up/Down, Enter and Escape.
- Debounced search, AbortController cancellation, request timeout, loading, empty, retry and error states.

## Search tips

- Enter at least two characters.
- Use `City, Country` for a city with duplicates, e.g. `Paris, France` or `Springfield, United States`.
- You can search supported postal codes.
- You can enter a latitude/longitude pair when a named place is not in the index.

## Provider and coverage

The app's server calls `https://geocoding-api.open-meteo.com/v1/search`. It requests up to 12 suggestions by default and accepts up to 20 per request in this build. The backend also supports an optional ISO-3166-1 alpha-2 `countryCode` filter.

Open-Meteo documents worldwide location search, country/admin1 qualifiers, postal-code search, up to 100 results per API request, and GeoNames attribution. This app intentionally limits its dropdown to 12 suggestions for usability. The underlying geographic dataset is broad and worldwide, but it is not a literal exhaustive database of every street address, hamlet or postal address. If a named place cannot be found, enter exact coordinates.

Provider documentation: https://open-meteo.com/en/docs/geocoding-api
GeoNames: https://www.geonames.org/

Open-Meteo's public endpoint terms distinguish non-commercial use; check the provider's current plan and terms before deploying commercially. Do not assume the no-key endpoint is licensed for a commercial product.
