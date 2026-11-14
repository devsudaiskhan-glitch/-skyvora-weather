export const CONFIG = Object.freeze({
  appName: "Skyvora Weather",
  appVersion: "5.3.0",
  defaultLocation: {
    name: "Islamabad",
    country: "Pakistan",
    admin1: "Islamabad Capital Territory",
    latitude: 33.6844,
    longitude: 73.0479,
    timezone: "Asia/Karachi",
  },
  requestTimeoutMs: 28000,
  airQualityTimeoutMs: 15000,
  searchTimeoutMs: 28000,
  searchDebounceMs: 280,
  searchResultCount: 12,
  maxRecentSearches: 8,
  maxFavorites: 16,
  refreshMinutes: 15,
  mapDefaultZoom: 10,
  mapTiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  mapAttribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
});
