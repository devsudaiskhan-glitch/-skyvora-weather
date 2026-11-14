# Skyvora Weather 3.1.0 — Asset Sources

Weather scene photos are remote Unsplash images loaded by `frontend/js/utils/scene.js`. They are scenic, decorative backgrounds and are not live satellite or radar data. They require an internet connection. Please review the Unsplash license and image URLs before commercial redistribution.

The application icon set is a local custom SVG icon system in `frontend/assets/icons/skyvora-mark.svg` and `frontend/js/utils/icons.js`. Weather illustrations are generated as inline SVG from actual weather-condition codes.

Leaflet map tiles are provided by OpenStreetMap tile servers with attribution configured in the map component.

V3.1.2 settings gear and Weather Trends control styling use inline original SVG/CSS; no new external icon assets or dependencies were added.


## Worldwide Search
- Location names and administrative metadata: Open-Meteo Geocoding API, based on GeoNames. https://open-meteo.com/en/docs/geocoding-api
- Country flag display: Unicode regional-indicator emoji generated from ISO 3166-1 alpha-2 codes; no third-party flag image requests.

## V3.2.0 Worldwide Search
- Place names, country codes, administrative hierarchy, population and timezone metadata: Open-Meteo Geocoding API (GeoNames data). https://open-meteo.com/en/docs/geocoding-api
- Country flags are rendered as Unicode regional-indicator emoji generated from ISO 3166-1 alpha-2 country codes; no third-party flag image assets are requested.


## Responsive Layout (V3.3.x baseline; retained in V5.0.0)

No new image assets were introduced for the responsive update. The existing remote scenic photography, map tiles, fonts and icon sources remain documented above.


## V5.2.2 Dynamic Weather Scenes
The dashboard's decorative scene is selected from the current Open-Meteo WMO weather code and provider local day/night state. Separate day/night photographs are configured for clear, partly cloudy, overcast, drizzle, rain, heavy rain, thunderstorm, snow/freezing precipitation, fog, and high-wind clear conditions. Images are hosted by Unsplash and require internet access; they are not live radar or satellite imagery.

## Rain background photograph

- Photo: [Raindrops on clear window](https://unsplash.com/photos/raindrops-on-clear-window-Bu1zj2WbjHE)
- Photographer: Anant Jain
- Source: Unsplash
- License: Unsplash License (free to use; attribution appreciated)
- Used for: drizzle, rain and heavy-rain dashboard backgrounds
