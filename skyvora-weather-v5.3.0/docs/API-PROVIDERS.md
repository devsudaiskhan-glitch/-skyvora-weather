# API Provider Notes

| Capability | Provider | Application use | Important limitation |
|---|---|---|---|
| Current/hourly/daily weather | Open-Meteo Forecast API | `/api/weather/forecast` | Forecast horizon/fields depend on provider product and geographic coverage |
| City lookup | Open-Meteo Geocoding API | `/api/geocoding/search` | Search result quality and coverage depend on geocoding dataset |
| Air quality | Open-Meteo Air Quality API | `/api/air-quality` | Model estimates, not personal exposure measurements; AQI standard explicitly US AQI |
| Historical weather | Open-Meteo Archive API | `/api/weather/history` | Reanalysis/model data, not necessarily station observations |
| Marine | Open-Meteo Marine API | `/api/marine` | Coverage and variable availability vary; not intended for navigation/safety decisions |
| Base map | OpenStreetMap tiles + Leaflet | Client-side map | Geographic base map only; no radar/satellite overlays configured |

All provider endpoints and query fields must be checked against official provider documentation before a production deployment. Commercial use must comply with provider licensing and attribution requirements.


## Worldwide location search
- Endpoint: `https://geocoding-api.open-meteo.com/v1/search`
- Parameters used: `name`, `count` (12 default, max 20 in Skyvora), `language=en`, `format=json`; optional `countryCode` accepts an ISO 3166-1 alpha-2 code.
- Supports globally searchable location names and postal codes; a country/region qualifier can be appended, e.g. `Paris, France`.
- Search data is based on GeoNames. Two-character terms match exact names; longer terms use normalized prefix matching.
- Attribution: Open-Meteo Geocoding API and GeoNames. The public Open-Meteo endpoints are for non-commercial use; confirm an appropriate commercial plan before commercial deployment.
