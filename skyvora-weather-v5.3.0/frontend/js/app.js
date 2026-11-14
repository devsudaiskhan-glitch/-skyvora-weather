import { CONFIG } from "./config.js";
import { api } from "./api/client.js";
import { icon, hydrateIcons } from "./utils/icons.js";
import {
  condition,
  displayTemp,
  displayWind,
  displayRain,
  safeNumber,
  timeLabel,
  dateLabel,
  aqiCategory,
  skySummary,
  buildInsights,
  getLocalDateISO,
  addDaysISO,
} from "./utils/weather.js";
import {
  countryFlagEmoji,
  locationKind,
  formatPopulation,
  parseCoordinateQuery,
  rankLocationResults,
} from "./utils/search.js";
import { compassDirection16, getDaylightProgress } from "./utils/solar.js";
import {
  getWeatherScenePhotos,
  resolveIsDay,
  resolveWeatherSceneTone,
} from "./utils/scene.js";
import { buildWeatherOutlook } from "./utils/outlook.js";
import { selectTimeWindow, averageHourlyByDate } from "./utils/series.js";
import {
  readJSON,
  writeJSON,
  getPreference,
  setPreference,
  saveJournalPhoto,
  getJournalPhotos,
  deleteJournalPhoto,
} from "./services/storage.js";
import { translate } from "./localization/translations.js";
import { registerPWA, installPromptHandler } from "./services/pwa.js";

// Use the system font stack for the first render. Remote font requests were delaying
// the critical path on slower connections and are not required for the interface.
const savedLocation = readJSON("location", CONFIG.defaultLocation);
const initialLocation =
  savedLocation &&
  Number.isFinite(Number(savedLocation.latitude)) &&
  Number.isFinite(Number(savedLocation.longitude)) &&
  Math.abs(Number(savedLocation.latitude)) <= 90 &&
  Math.abs(Number(savedLocation.longitude)) <= 180
    ? {
        ...CONFIG.defaultLocation,
        ...savedLocation,
        latitude: Number(savedLocation.latitude),
        longitude: Number(savedLocation.longitude),
      }
    : CONFIG.defaultLocation;
const savedFavorites = readJSON("favorites", []);
const savedRecent = readJSON("recent", []);
const savedWeatherSnapshot = readJSON("last-weather", null);
const cachedForecast = savedWeatherSnapshot?.weather;
const cachedLocation = savedWeatherSnapshot?.location;
const cacheMatchesLocation =
  cachedLocation &&
  Math.abs(Number(cachedLocation.latitude) - initialLocation.latitude) < 0.02 &&
  Math.abs(Number(cachedLocation.longitude) - initialLocation.longitude) < 0.02;
const hasUsableCachedForecast = Boolean(
  cacheMatchesLocation &&
  cachedForecast?.current &&
  Array.isArray(cachedForecast.hourly?.time) &&
  cachedForecast.hourly.time.length &&
  Array.isArray(cachedForecast.daily?.time) &&
  cachedForecast.daily.time.length,
);
const state = {
  location: initialLocation,
  weather: hasUsableCachedForecast ? cachedForecast : null,
  air: readJSON("last-air", null),
  marine: null,
  history: null,
  favorites: Array.isArray(savedFavorites)
    ? savedFavorites.filter(
        (item) =>
          item &&
          Number.isFinite(Number(item.latitude)) &&
          Number.isFinite(Number(item.longitude)),
      )
    : [],
  recent: Array.isArray(savedRecent)
    ? savedRecent.filter(
        (item) =>
          item &&
          Number.isFinite(Number(item.latitude)) &&
          Number.isFinite(Number(item.longitude)),
      )
    : [],
  theme: ["dark", "light", "system", "weather"].includes(
    getPreference("theme", "dark"),
  )
    ? getPreference("theme", "dark")
    : "dark",
  language: "en",
  tempUnit: getPreference("temp-unit", "c") === "f" ? "f" : "c",
  windUnit: getPreference("wind-unit", "kmh") === "mph" ? "mph" : "kmh",
  rainUnit: getPreference("rain-unit", "mm") === "in" ? "in" : "mm",
  view: "dashboard",
  chart: "temperature",
  chartRange: "24h",
  aqiMetric: "us_aqi",
  aqiRange: "24h",
  searchResults: [],
  searchIndex: -1,
  searchTimer: null,
  searchController: null,
  searchLoading: false,
  map: null,
  mapMarker: null,
  lastUpdated: hasUsableCachedForecast
    ? savedWeatherSnapshot.updatedAt || null
    : null,
  dataCached: hasUsableCachedForecast,
  dataStale: hasUsableCachedForecast,
  airLoading: false,
  installing: null,
  installAvailable: false,
  diagnostics: [],
  comparisonCache: new Map(),
};

let chartsModulePromise;
function loadChartsModule() {
  chartsModulePromise ||= import("./components/charts.js");
  return chartsModulePromise;
}
async function drawLineChart(container, points, options) {
  if (!container) return;
  const { renderLineChart } = await loadChartsModule();
  if (container.isConnected) renderLineChart(container, points, options);
}

const root = document.getElementById("viewRoot");
const toastRegion = document.getElementById("toastRegion");
let triggerInstallPrompt = null;
const modalRoot = document.getElementById("modalRoot");
const searchInput = document.getElementById("citySearch");
const searchResults = document.getElementById("searchResults");
// Portal the autocomplete out of the blurred sticky topbar. `backdrop-filter`
// creates a containing block for fixed descendants, which otherwise traps the
// mobile dropdown inside the narrow search field. Event listeners stay attached.
document.body.append(searchResults);
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
  ...parent.querySelectorAll(selector),
];

function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
function t(key) {
  return translate(key, state.language);
}
function locale() {
  return "en-US";
}
function current() {
  return state.weather?.current || null;
}
function hourly() {
  return state.weather?.hourly || {};
}
function daily() {
  return state.weather?.daily || {};
}
function indexForCurrentTime(times = []) {
  if (!times.length) return 0;
  const now = state.weather?.current?.time || new Date().toISOString();
  let closest = 0;
  let best = Infinity;
  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - new Date(now).getTime());
    if (Number.isFinite(diff) && diff < best) {
      best = diff;
      closest = index;
    }
  });
  return closest;
}
function nextHours(count = 24) {
  const h = hourly();
  if (!Array.isArray(h.time)) return [];
  const start = indexForCurrentTime(h.time);
  return h.time.slice(start, start + count).map((time, offset) => {
    const i = start + offset;
    const item = {};
    Object.keys(h).forEach((key) => {
      if (Array.isArray(h[key])) item[key] = h[key][i];
    });
    item.time = time;
    return item;
  });
}
function dailyRows() {
  const d = daily();
  if (!Array.isArray(d.time)) return [];
  return d.time.map((date, i) => {
    const item = { date };
    Object.keys(d).forEach((key) => {
      if (Array.isArray(d[key])) item[key] = d[key][i];
    });
    return item;
  });
}
function currentAir() {
  const a = state.air?.hourly;
  if (!a?.time?.length) return null;
  const idx = indexForCurrentTime(a.time);
  return Object.fromEntries(
    Object.entries(a)
      .filter(([, values]) => Array.isArray(values))
      .map(([key, values]) => [key, values[idx]]),
  );
}
function displayTime(value) {
  return value ? String(value).slice(11, 16) : "—";
}
function displayDate(value, opts) {
  return dateLabel(value, locale(), opts);
}
function temperature(value) {
  return displayTemp(value, state.tempUnit);
}
function wind(value) {
  return displayWind(value, state.windUnit);
}
function rainfall(value) {
  return displayRain(value, state.rainUnit);
}
function weatherIcon(code, className = "") {
  return icon(condition(code).icon, className);
}
function safeLocationLabel(location = state.location) {
  return [location.name, location.admin1, location.country]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ");
}
function toast(message, type = "success") {
  const symbol =
    type === "error" ? "alert" : type === "info" ? "info" : "check";
  const node = document.createElement("div");
  node.className = "toast";
  node.innerHTML = `${icon(symbol)}<span>${escapeHTML(message)}</span>`;
  toastRegion.append(node);
  setTimeout(() => {
    node.classList.add("leaving");
    setTimeout(() => node.remove(), 220);
  }, 3300);
}
function announce(message) {
  const live = $("#liveRegion");
  live.textContent = "";
  setTimeout(() => {
    live.textContent = message;
  }, 30);
}
function showServiceStatus(label, good = true) {
  const status = $("#serviceStatus");
  if (status) {
    status.textContent = label;
    status.style.color = good ? "var(--green)" : "var(--yellow)";
  }
}
function formatUpdated(value = state.lastUpdated) {
  if (!value) return "Not updated yet";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Update time unavailable";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  return minutes < 1 ? "Updated just now" : `Updated ${minutes} min ago`;
}
function setTheme(theme = state.theme) {
  state.theme = theme;
  setPreference("theme", theme);
  const resolved =
    theme === "system"
      ? matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : theme === "weather"
        ? current()?.is_day === 0
          ? "dark"
          : "light"
        : theme;
  document.documentElement.dataset.theme = resolved;
  const colorMeta = $('meta[name="theme-color"]');
  if (colorMeta)
    colorMeta.content = resolved === "light" ? "#f2f6fb" : "#101a2c";
  const toggle = $("#themeToggle");
  if (toggle) {
    toggle.innerHTML = icon(resolved === "dark" ? "moon" : "sun");
    toggle.setAttribute(
      "aria-label",
      resolved === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );
    toggle.title =
      resolved === "dark" ? "Switch to light theme" : "Switch to dark theme";
  }
}
function syncWeatherBackdrop() {
  const c = current();
  const firstDay = dailyRows()[0];
  const isDay = resolveIsDay(c, firstDay);
  const tone = resolveWeatherSceneTone(c);
  const photos = getWeatherScenePhotos(tone);
  document.body.dataset.skyScene = isDay ? "day" : "night";
  document.body.dataset.weatherTone = tone;
  // Rain is shown as a still photograph. No CSS rain animation is used.
  document.body.dataset.weatherMotion = [
    "partly-cloudy",
    "overcast",
    "cloudy",
  ].includes(tone)
    ? "clouds"
    : tone;
  document.documentElement.dataset.skyScene = isDay ? "day" : "night";
  document.documentElement.dataset.weatherTone = tone;
  document.documentElement.style.setProperty(
    "--scene-day-photo",
    `url("${photos.day}")`,
  );
  document.documentElement.style.setProperty(
    "--scene-night-photo",
    `url("${photos.night}")`,
  );
  // The active scene is fetched by CSS only; avoid eagerly downloading an
  // additional full-size image before the primary dashboard has painted.
}

function setLanguage() {
  // Skyvora currently ships with English as the only supported interface language.
  state.language = "en";
  setPreference("language", "en");
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  document.body.classList.remove("urdu");
  $$("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  searchInput.placeholder = "Search city or postcode…";
}
function persistLocation() {
  writeJSON("location", state.location);
}
function rememberLocation(location) {
  const key = `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
  state.recent = [
    location,
    ...state.recent.filter(
      (item) =>
        `${Number(item.latitude).toFixed(3)},${Number(item.longitude).toFixed(3)}` !==
        key,
    ),
  ].slice(0, CONFIG.maxRecentSearches);
  writeJSON("recent", state.recent);
}
function weatherPhotoFor(tone) {
  const photos = {
    clear:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=68",
    cloudy:
      "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=900&q=68",
    drizzle:
      "https://images.unsplash.com/photo-1512511708753-3150cd2ec8ee?auto=format&fit=crop&w=1800&q=85",
    rain: "https://images.unsplash.com/photo-1512511708753-3150cd2ec8ee?auto=format&fit=crop&w=1800&q=85",
    "heavy-rain":
      "https://images.unsplash.com/photo-1512511708753-3150cd2ec8ee?auto=format&fit=crop&w=1800&q=85",
    storm:
      "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=900&q=68",
    snow: "https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=900&q=68",
    fog: "https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?auto=format&fit=crop&w=900&q=68",
  };
  return photos[tone] || photos.cloudy;
}

async function loadWeather(location = state.location, { quiet = false } = {}) {
  if (!quiet)
    root.innerHTML = `<div class="initial-loading"><span class="loader-ring"></span><p>${escapeHTML(t("loading"))}</p></div>`;
  const started = performance.now();
  try {
    const result = await api.forecast(location);
    if (!result.data?.current || !result.data?.hourly || !result.data?.daily)
      throw new Error("Weather provider returned incomplete forecast data.");
    state.weather = result.data;
    state.lastUpdated = result.fetchedAt || new Date().toISOString();
    state.dataCached = Boolean(result.cached);
    state.dataStale = Boolean(result.stale);
    state.location = {
      ...location,
      timezone: result.data.timezone || location.timezone || "auto",
    };
    persistLocation();
    writeJSON("last-weather", {
      weather: state.weather,
      location: state.location,
      updatedAt: state.lastUpdated,
    });
    rememberLocation(state.location);
    document.documentElement.dataset.weather = condition(
      current().weather_code,
    ).tone;
    syncWeatherBackdrop();
    setTheme(state.theme);
    const elapsed = Math.round(performance.now() - started);
    state.diagnostics.unshift({
      name: "Forecast API",
      duration: elapsed,
      status: "success",
      time: new Date().toISOString(),
    });
    state.diagnostics = state.diagnostics.slice(0, 10);
    showServiceStatus(
      state.dataStale ? "Cached · provider offline" : "Online",
      !state.dataStale,
    );

    // Paint the forecast as soon as the primary weather response is ready.
    // Air quality and alert evaluation are secondary tasks and must not delay LCP.
    render();
    updateSideLocation();
    $("#footerUpdated").textContent = formatUpdated();

    void loadAirQuality({ quiet: true }).then(() => {
      if (state.view !== "dashboard") return;
      const currentAqi = root.querySelector(
        ".reference-extras-grid > .reference-panel:nth-child(3) .aqi-experience",
      );
      if (currentAqi) currentAqi.outerHTML = renderAqiCard();
    });
    void import("./services/notifications.js")
      .then(({ evaluateAlertRules }) =>
        evaluateAlertRules(
          {
            ...current(),
            precipitation_probability:
              nextHours(1)[0]?.precipitation_probability,
          },
          state.location,
        ),
      )
      .then((alerts) => {
        if (alerts.length)
          toast(
            `${alerts.length} weather rule${alerts.length > 1 ? "s" : ""} triggered.`,
            "info",
          );
      })
      .catch((alertError) =>
        console.warn("[alerts] Optional alert evaluation failed:", alertError),
      );
    if (state.dataStale && !quiet)
      toast(
        "Live weather is temporarily unavailable. Showing the last successful update.",
        "info",
      );
    else if (state.dataCached && !quiet)
      toast("Showing recently cached weather.", "info");
    return state.weather;
  } catch (error) {
    const cached = readJSON("last-weather", null);
    if (cached?.weather?.current) {
      state.weather = cached.weather;
      state.location = cached.location || location;
      state.lastUpdated = cached.updatedAt;
      state.dataCached = true;
      state.dataStale = true;
      state.air = readJSON("last-air", null);
      showServiceStatus("Offline data", false);
      render();
      if (!quiet)
        toast("Connection unavailable. Showing last saved weather.", "info");
    } else {
      showServiceStatus("Unavailable", false);
      renderDashboard();
      const errorBanner = document.createElement("div");
      errorBanner.className = "reference-error-banner";
      errorBanner.setAttribute("role", "alert");
      errorBanner.innerHTML = `<span>${icon("cloud-off")}</span><div><strong>Weather data unavailable</strong><small>${escapeHTML(error.message || "Check the connection and retry.")}</small></div><button class="reference-error-retry" type="button" data-action="refresh">${icon("refresh")} Retry</button>`;
      root.prepend(errorBanner);
      hydrateIcons(errorBanner);
    }
    state.diagnostics.unshift({
      name: "Forecast API",
      duration: Math.round(performance.now() - started),
      status: "error",
      time: new Date().toISOString(),
      message: error.message,
    });
    state.diagnostics = state.diagnostics.slice(0, 10);
    return null;
  }
}

async function loadAirQuality({ quiet = false } = {}) {
  state.airLoading = true;
  try {
    const result = await api.airQuality(state.location);
    state.air = result.data;
    state.air._meta = { cached: result.cached, fetchedAt: result.fetchedAt };
    writeJSON("last-air", state.air);
  } catch (error) {
    state.air = readJSON("last-air", null);
    if (!quiet) toast("Air quality data is currently unavailable.", "info");
  } finally {
    state.airLoading = false;
  }
}

function updateSideLocation() {
  const city = $("#sidebarCity");
  if (city) city.textContent = state.location.name;
  const date = $("#sidebarDate");
  if (date) {
    const now = current()?.time || new Date().toISOString();
    date.textContent = `${now.slice(0, 10)} · ${displayTime(now)} local`;
  }
}

function metricCard(label, value, caption, iconName, accent = "blue") {
  return `<article class="metric-card"><div class="metric-top"><span class="mini-label">${escapeHTML(label)}</span><span class="metric-icon ${accent}">${icon(iconName)}</span></div><strong class="metric-value">${escapeHTML(value)}</strong><div class="metric-caption">${escapeHTML(caption)}</div></article>`;
}
function hourlyItems() {
  const items = nextHours(24);
  if (!items.length)
    return '<div class="reference-unavailable">Hourly forecast will appear when weather data is available.</div>';

  const temperatures = items
    .map((item) => item.temperature_2m)
    .filter(Number.isFinite);
  const minTemp = temperatures.length ? Math.min(...temperatures) : null;
  const maxTemp = temperatures.length ? Math.max(...temperatures) : null;
  const spread = Math.max(1, (maxTemp ?? 1) - (minTemp ?? 0));

  return items
    .map((item, index) => {
      const meta = condition(item.weather_code);
      const hourLabel = index === 0 ? "Now" : displayTime(item.time);
      const temp = temperature(item.temperature_2m);
      const probability = Number.isFinite(item.precipitation_probability)
        ? Math.max(0, Math.min(100, Math.round(item.precipitation_probability)))
        : null;
      const tempPosition =
        Number.isFinite(item.temperature_2m) && minTemp !== null
          ? Math.max(
              4,
              Math.min(96, ((item.temperature_2m - minTemp) / spread) * 92 + 4),
            )
          : 50;
      const isDay = Number.isFinite(item.is_day) ? item.is_day === 1 : true;
      const accessible = `${hourLabel}: ${meta.label}, ${temp}, ${probability === null ? "precipitation probability unavailable" : `${probability}% precipitation probability`}`;

      return `<article class="hourly-item ${index === 0 ? "active" : ""}" role="listitem" aria-label="${escapeHTML(accessible)}">
      <div class="hourly-card-top"><span class="hour">${hourLabel}</span>${index === 0 ? '<span class="hourly-now-pulse" aria-hidden="true"></span>' : `<span class="hourly-daypart">${isDay ? icon("sun") : icon("moon")}</span>`}</div>
      <span class="hour-icon">${weatherIcon(item.weather_code, "hourly-weather-icon")}</span>
      <strong class="hourly-temperature">${escapeHTML(temp)}</strong>
      <span class="hourly-condition">${escapeHTML(meta.label)}</span>
      <div class="hourly-rain-readout"><span class="hourly-rain-icon">${icon("droplet")}</span><small>${probability === null ? "—" : `${probability}%`}</small></div>
      <span class="hourly-temperature-track" aria-hidden="true"><i style="left:${tempPosition}%"></i></span>
      <span class="hourly-rain-meter" aria-hidden="true"><i style="width:${probability ?? 0}%"></i></span>
    </article>`;
    })
    .join("");
}
function hourlySummaryMarkup(items = nextHours(24)) {
  if (!items.length) return "";
  const values = items
    .map((item) => item.temperature_2m)
    .filter(Number.isFinite);
  const peak = items.reduce(
    (best, item) =>
      Number.isFinite(item.precipitation_probability) &&
      (!best || item.precipitation_probability > best.precipitation_probability)
        ? item
        : best,
    null,
  );
  const range = values.length
    ? `${temperature(Math.min(...values))} – ${temperature(Math.max(...values))}`
    : "—";
  const peakValue = Number.isFinite(peak?.precipitation_probability)
    ? `${Math.round(peak.precipitation_probability)}%`
    : "—";
  return `<div class="hourly-summary-row">
    <span class="hourly-summary-chip"><i>${icon("clock")}</i><span><small>Forecast window</small><strong>${items.length} hourly points</strong></span></span>
    <span class="hourly-summary-chip"><i>${icon("thermometer")}</i><span><small>Temperature range</small><strong>${escapeHTML(range)}</strong></span></span>
    <span class="hourly-summary-chip"><i>${icon("cloud-rain")}</i><span><small>Peak rain chance</small><strong>${peakValue}${peak ? ` · ${escapeHTML(displayTime(peak.time))}` : ""}</strong></span></span>
  </div>`;
}
function dailyList(rows = dailyRows()) {
  if (!rows.length)
    return '<div class="empty-state"><p>Daily forecast unavailable.</p></div>';
  const min = Math.min(
    ...rows.map((r) => r.temperature_2m_min).filter(Number.isFinite),
  );
  const max = Math.max(
    ...rows.map((r) => r.temperature_2m_max).filter(Number.isFinite),
  );
  const spread = Math.max(1, max - min);
  return rows
    .slice(0, 10)
    .map((row, index) => {
      const meta = condition(row.weather_code);
      const left = Number.isFinite(row.temperature_2m_min)
        ? ((row.temperature_2m_min - min) / spread) * 72 + 5
        : 5;
      const width = Number.isFinite(
        row.temperature_2m_max - row.temperature_2m_min,
      )
        ? Math.max(
            8,
            ((row.temperature_2m_max - row.temperature_2m_min) / spread) * 90,
          )
        : 18;
      const label =
        index === 0
          ? t("today")
          : index === 1
            ? t("tomorrow")
            : displayDate(row.date, { weekday: "short" });
      return `<div class="daily-row"><div class="daily-day"><strong>${label}</strong><small>${displayDate(row.date, { month: "short", day: "numeric" })}</small></div><span class="daily-icon">${weatherIcon(row.weather_code)}</span><div class="temp-range"><strong>${temperature(row.temperature_2m_min)}</strong><div class="range-track"><span class="range-fill" style="left:${left}%;width:${width}%"></span></div><strong>${temperature(row.temperature_2m_max)}</strong></div><span class="daily-rain">${Number.isFinite(row.precipitation_probability_max) ? `${Math.round(row.precipitation_probability_max)}%` : "—"}</span></div>`;
    })
    .join("");
}
function buildChartPoints(chart = state.chart, range = state.chartRange) {
  if (range === "10d") {
    const today = String(current()?.time || new Date().toISOString()).slice(
      0,
      10,
    );
    const hourlyData = hourly();
    return dailyRows()
      .filter((item) => item.date >= today)
      .slice(0, 10)
      .map((item) => {
        const label = displayDate(item.date, {
          weekday: "short",
          day: "numeric",
        });
        // Open-Meteo Forecast API exposes a defined set of daily aggregates. For metrics
        // without a supported daily field, calculate a transparent mean from real hourly data.
        if (chart === "rain")
          return { label, value: item.precipitation_probability_max };
        if (chart === "wind") return { label, value: item.wind_speed_10m_max };
        if (chart === "uv") return { label, value: item.uv_index_max };
        if (chart === "sunshine")
          return { label, value: item.sunshine_duration };
        const hourlyField =
          {
            humidity: "relative_humidity_2m",
            clouds: "cloud_cover",
            dewpoint: "dew_point_2m",
            pressure: "pressure_msl",
            visibility: "visibility",
            feels: "apparent_temperature",
            temperature: "temperature_2m",
          }[chart] || "temperature_2m";
        return {
          label,
          value: averageHourlyByDate(hourlyData, item.date, hourlyField),
        };
      });
  }
  const items = nextHours(24);
  if (chart === "rain")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.precipitation_probability,
    }));
  if (chart === "wind")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.wind_speed_10m,
    }));
  if (chart === "humidity")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.relative_humidity_2m,
    }));
  if (chart === "uv")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.uv_index,
    }));
  if (chart === "clouds")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.cloud_cover,
    }));
  if (chart === "feels")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.apparent_temperature,
    }));
  if (chart === "dewpoint")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.dew_point_2m,
    }));
  if (chart === "pressure")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.pressure_msl,
    }));
  if (chart === "visibility")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.visibility,
    }));
  if (chart === "sunshine")
    return items.map((item) => ({
      label: displayTime(item.time),
      value: item.sunshine_duration,
    }));
  return items.map((item) => ({
    label: displayTime(item.time),
    value: item.temperature_2m,
  }));
}
function trendUnit(chart = state.chart) {
  if (chart === "rain" || chart === "humidity" || chart === "clouds")
    return "%";
  if (chart === "wind") return state.windUnit === "mph" ? " mph" : " km/h";
  if (chart === "uv") return " UV";
  if (chart === "pressure") return " hPa";
  if (chart === "visibility") return " km";
  if (chart === "sunshine") return state.chartRange === "10d" ? " h" : " min";
  return `°${state.tempUnit.toUpperCase()}`;
}
function trendValue(value, chart = state.chart) {
  if (!Number.isFinite(value)) return "—";
  if (chart === "temperature" || chart === "feels" || chart === "dewpoint")
    return temperature(value);
  if (chart === "wind") return wind(value);
  if (chart === "uv") return Number(value).toFixed(1);
  if (chart === "pressure") return `${Math.round(value)} hPa`;
  if (chart === "visibility") return `${(value / 1000).toFixed(1)} km`;
  if (chart === "sunshine")
    return state.chartRange === "10d"
      ? `${(value / 3600).toFixed(1)} h`
      : `${Math.round(value / 60)} min`;
  return `${Math.round(value)}%`;
}
function trendChangeValue(value, chart = state.chart) {
  if (!Number.isFinite(value)) return "—";
  if (chart === "temperature" || chart === "feels" || chart === "dewpoint") {
    const delta = state.tempUnit === "f" ? (value * 9) / 5 : value;
    return `${delta > 0 ? "+" : ""}${Math.round(delta)}°${state.tempUnit.toUpperCase()}`;
  }
  if (chart === "wind") {
    const delta = state.windUnit === "mph" ? value * 0.621371 : value;
    return `${delta > 0 ? "+" : ""}${Math.round(delta)} ${state.windUnit === "mph" ? "mph" : "km/h"}`;
  }
  if (chart === "uv") return `${value > 0 ? "+" : ""}${value.toFixed(1)} UV`;
  if (chart === "pressure")
    return `${value > 0 ? "+" : ""}${Math.round(value)} hPa`;
  if (chart === "visibility")
    return `${value > 0 ? "+" : ""}${(value / 1000).toFixed(1)} km`;
  if (chart === "sunshine")
    return `${value > 0 ? "+" : ""}${state.chartRange === "10d" ? (value / 3600).toFixed(1) + " h" : Math.round(value / 60) + " min"}`;
  return `${value > 0 ? "+" : ""}${Math.round(value)}%`;
}
function trendSummaryMarkup(points) {
  const values = points.map((point) => point.value).filter(Number.isFinite);
  if (!values.length)
    return '<div class="trend-summary-empty">Trend insights appear when forecast values are available.</div>';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const change = values.at(-1) - values[0];
  const labels = {
    temperature: ["Forecast high", "Forecast low"],
    feels: ["Highest feels-like", "Lowest feels-like"],
    rain: ["Peak probability", "Lowest probability"],
    wind: ["Peak wind", "Lightest wind"],
    humidity: ["Highest humidity", "Lowest humidity"],
    uv: ["Peak UV index", "Lowest UV index"],
    clouds: ["Most cloud cover", "Clearest interval"],
    dewpoint: ["Highest dew point", "Lowest dew point"],
    pressure: ["Highest pressure", "Lowest pressure"],
    visibility: ["Best visibility", "Lowest visibility"],
    sunshine: ["Most sunshine", "Least sunshine"],
  };
  const [maxLabel, minLabel] = labels[state.chart] || labels.temperature;
  const rangeLabel =
    state.chartRange === "10d" ? "10-day outlook" : "24-hour outlook";
  return `<div class="trend-summary-row">
    <div class="trend-summary-item"><span class="trend-summary-icon peak">${icon("trending-up")}</span><span><small>${maxLabel}</small><strong>${escapeHTML(trendValue(max))}</strong></span></div>
    <div class="trend-summary-item"><span class="trend-summary-icon low">${icon("trending-down")}</span><span><small>${minLabel}</small><strong>${escapeHTML(trendValue(min))}</strong></span></div>
    <div class="trend-summary-item"><span class="trend-summary-icon change">${icon("activity")}</span><span><small>Start → end</small><strong>${escapeHTML(trendChangeValue(change))}</strong></span></div>
    <span class="trend-range-caption">${rangeLabel}</span>
  </div>`;
}
function renderChart(containerSelector = "#mainChart") {
  const colors = {
    temperature: "#85d7ff",
    feels: "#b7a5ff",
    rain: "#59c6ff",
    wind: "#62e0ca",
    humidity: "#a99dff",
    uv: "#ffd36f",
    clouds: "#bdcbe0",
    dewpoint: "#78dfd5",
    pressure: "#c5b6ff",
    visibility: "#a5d8ff",
    sunshine: "#ffbd69",
  };
  const labels = {
    temperature: "Temperature",
    feels: "Feels-like temperature",
    rain: "Precipitation probability",
    wind: "Wind speed",
    humidity: "Relative humidity",
    uv: "UV index",
    clouds: "Cloud cover",
    dewpoint: "Dew point",
    pressure: "Sea-level pressure",
    visibility: "Visibility",
    sunshine: "Sunshine duration",
  };
  const points = buildChartPoints();
  const summary = $("#trendSummary", root);
  if (summary) summary.innerHTML = trendSummaryMarkup(points);
  const chartSubtitle = $("#trendSubtitle", root);
  if (chartSubtitle)
    chartSubtitle.textContent = `${state.chartRange === "10d" ? "10-day outlook" : "Next 24 hours"} · ${labels[state.chart] || "Temperature"}`;
  void drawLineChart($(containerSelector), points, {
    color: colors[state.chart] || colors.temperature,
    unit: trendUnit(),
    height: 230,
    valueFormatter: (value) => trendValue(value),
    id: `skyvora-${state.chart}-${state.chartRange}`,
  });
}

function renderWindCompass() {
  const c = current();
  if (!c)
    return '<div class="reference-unavailable">Wind direction and speed are unavailable until weather data loads.</div>';

  const hasDirection = Number.isFinite(c.wind_direction_10m);
  const degrees = hasDirection
    ? ((Math.round(c.wind_direction_10m) % 360) + 360) % 360
    : 0;
  const compassDirection = hasDirection ? compassDirection16(degrees) : "—";
  const ticks = Array.from(
    { length: 36 },
    (_, index) =>
      `<i class="wind-compass-tick ${index % 3 === 0 ? "major" : ""}" style="--tick-angle:${index * 10}deg"></i>`,
  ).join("");

  return `<div class="wind-experience">
    <div class="wind-compass-stage" role="img" aria-label="Wind is coming from ${hasDirection ? `${compassDirection}, ${degrees} degrees` : "an unavailable direction"}">
      <div class="wind-compass-halo"></div>
      <div class="wind-compass-face">
        <div class="wind-compass-ticks">${ticks}</div>
        <span class="wind-cardinal north">N</span><span class="wind-cardinal east">E</span><span class="wind-cardinal south">S</span><span class="wind-cardinal west">W</span>
        <span class="wind-intercardinal ne">NE</span><span class="wind-intercardinal se">SE</span><span class="wind-intercardinal sw">SW</span><span class="wind-intercardinal nw">NW</span>
        <div class="wind-needle ${hasDirection ? "" : "is-unavailable"}" style="--wind-bearing:${degrees}deg">
          <svg viewBox="0 0 100 160" aria-hidden="true"><path class="needle-north" d="M50 9 66 82 50 72 34 82Z"/><path class="needle-south" d="m50 151 12-73-12 10-12-10Z"/></svg>
        </div>
        <span class="wind-compass-hub"></span>
        <span class="wind-compass-center-glow"></span>
      </div>
      <span class="wind-compass-caption">WIND DIRECTION</span>
    </div>
    <div class="wind-readings">
      <div class="wind-primary-reading"><span class="wind-reading-label">Wind speed</span><strong>${escapeHTML(wind(c.wind_speed_10m))}</strong><small>Current sustained wind</small></div>
      <div class="wind-reading-grid">
        <div class="wind-reading-tile"><span>${icon("compass")}</span><small>Coming from</small><strong>${compassDirection}</strong><em>${hasDirection ? `${degrees}°` : "Unavailable"}</em></div>
        <div class="wind-reading-tile"><span>${icon("wind")}</span><small>Wind gusts</small><strong>${escapeHTML(wind(c.wind_gusts_10m))}</strong><em>Peak gust</em></div>
      </div>
    </div>
  </div>
  <p class="wind-direction-note"><span>${icon("info")}</span> Direction shows where the wind is coming from, not where it is blowing toward.</p>`;
}
function renderSunArc() {
  const row = dailyRows()[0];
  if (!row || !row.sunrise || !row.sunset)
    return '<div class="reference-unavailable">Sunrise and sunset information is not available for this location.</div>';

  const sunrise = displayTime(row.sunrise);
  const sunset = displayTime(row.sunset);
  const solar = getDaylightProgress(row.sunrise, row.sunset, current()?.time);
  const validTimes = solar.available;
  const isDaylight = solar.phase === "daylight";
  const progress = validTimes ? solar.progress : 0;
  const x = 190 - 154 * Math.cos(Math.PI * progress);
  const y = 134 - 94 * Math.sin(Math.PI * progress);
  const daySeconds =
    typeof row.daylight_duration === "number" &&
    Number.isFinite(row.daylight_duration)
      ? row.daylight_duration
      : Number.NaN;
  const daylightMinutes = Number.isFinite(daySeconds)
    ? Math.round(daySeconds / 60)
    : solar.daylightMinutes;
  const daylight = Number.isFinite(daylightMinutes)
    ? `${Math.floor(daylightMinutes / 60)}h ${daylightMinutes % 60}m`
    : "—";
  const formatDuration = (minutes) => {
    const safe = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;
    return hours ? `${hours}h ${mins}m` : `${mins}m`;
  };
  let status = "Daylight timing unavailable";
  let remaining = "—";
  if (validTimes && isDaylight) {
    status = `${Math.round(progress * 100)}% of daylight elapsed`;
    remaining = `${formatDuration(solar.minutesToSunset)} remaining`;
  } else if (validTimes && solar.phase === "before-sunrise") {
    status = `Sunrise in ${formatDuration(solar.minutesToSunrise)}`;
    remaining = "Daylight begins soon";
  } else if (validTimes && solar.phase === "after-sunset") {
    status = "Daylight has ended";
    remaining = "Sunrise tomorrow";
  }

  const marker = isDaylight
    ? `<g class="daylight-sun-marker" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="18" class="daylight-marker-glow"/><g class="daylight-sun-rays" stroke="#ffd36f" stroke-width="2.4" stroke-linecap="round"><path d="M0 -29v-7M0 29v7M-29 0h-7M29 0h7M-21 -21l-5 -5M21 21l5 5M21 -21l5 -5M-21 21l-5 5"/></g><circle r="13" fill="#ffd36f" stroke="#fff1c4" stroke-width="2"/></g>`
    : `<g class="daylight-moon-marker" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="19" class="daylight-marker-glow"/><path d="M8 -14a17 17 0 1 0 13 27A18 18 0 0 1 8 -14Z" fill="#d9e8ff" stroke="#fff" stroke-width="1.5"/><circle cx="-13" cy="-18" r="2" fill="#d9e8ff" opacity=".8"/></g>`;

  return `<div class="daylight-experience ${isDaylight ? "is-daylight" : "is-night"}">
    <div class="daylight-status-row"><span class="daylight-status-icon">${icon(isDaylight ? "sun" : "moon")}</span><span class="daylight-status-copy"><strong>${isDaylight ? "Daylight in progress" : "Night sky"}</strong><small>${escapeHTML(status)}</small></span><span class="daylight-percent">${validTimes ? `${Math.round(progress * 100)}%` : "—"}</span></div>
    <svg class="daylight-orbit" viewBox="0 0 380 180" role="img" aria-label="Sunrise at ${sunrise}, sunset at ${sunset}; ${escapeHTML(status)}" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="daylightTrack" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6aaeff"/><stop offset=".5" stop-color="#ffd36f"/><stop offset="1" stop-color="#f59b81"/></linearGradient><filter id="daylightGlow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7"/></filter></defs>
      <path d="M36 134 A154 94 0 0 1 344 134" class="daylight-track" pathLength="100"/>
      <path d="M36 134 A154 94 0 0 1 344 134" class="daylight-progress" pathLength="100" style="stroke-dasharray:${(progress * 100).toFixed(2)} 100"/>
      <path d="M36 134 A154 94 0 0 1 344 134" class="daylight-track-inner"/>
      <circle cx="36" cy="134" r="4" class="daylight-endpoint sunrise-point"/><circle cx="344" cy="134" r="4" class="daylight-endpoint sunset-point"/>
      ${marker}
      <text x="190" y="77" class="daylight-center-label" text-anchor="middle">${validTimes ? (isDaylight ? "SUN PATH" : "DAYLIGHT CYCLE") : "SUN PATH"}</text>
      <text x="190" y="96" class="daylight-center-value" text-anchor="middle">${escapeHTML(daylight)}</text>
    </svg>
    <div class="daylight-time-grid">
      <div class="daylight-time sunrise"><span class="daylight-time-icon">${icon("sunrise")}</span><small>Sunrise</small><strong>${escapeHTML(sunrise)}</strong></div>
      <div class="daylight-time total"><span class="daylight-time-icon">${icon("sun")}</span><small>Day length</small><strong>${escapeHTML(daylight)}</strong></div>
      <div class="daylight-time sunset"><span class="daylight-time-icon">${icon("sunset")}</span><small>Sunset</small><strong>${escapeHTML(sunset)}</strong></div>
    </div>
    <div class="daylight-remaining"><span>${icon("clock")}</span><strong>${escapeHTML(remaining)}</strong><small>Local solar time</small></div>
  </div>`;
}
function pollutantSparkline(values = []) {
  const start = state.air?.hourly?.time
    ? indexForCurrentTime(state.air.hourly.time)
    : 0;
  const samples = values.slice(start, start + 8).filter(Number.isFinite);
  if (samples.length < 2)
    return '<span class="pollutant-no-trend">Trend unavailable</span>';
  const min = Math.min(...samples);
  const spread = Math.max(1, Math.max(...samples) - min);
  const points = samples
    .map(
      (value, index) =>
        `${((index / (samples.length - 1)) * 88).toFixed(1)},${(22 - ((value - min) / spread) * 17).toFixed(1)}`,
    )
    .join(" ");
  return `<svg class="pollutant-sparkline" viewBox="0 0 88 26" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function aqiDescription(category, score) {
  if (!Number.isFinite(score))
    return "The provider did not return a current US AQI value for this location.";
  const descriptions = {
    good: "Air quality is in the Good range under the US AQI scale.",
    moderate: "Air quality is in the Moderate range under the US AQI scale.",
    sensitive:
      "The US AQI is elevated; sensitive groups should follow local public-health guidance.",
    unhealthy:
      "The US AQI is in the Unhealthy range. Check local environmental guidance for current advice.",
    "very-unhealthy":
      "The US AQI is Very Unhealthy. Follow official local air-quality guidance.",
    hazardous:
      "The US AQI is Hazardous. Follow official local public-health guidance.",
  };
  return (
    descriptions[category.className] ||
    "Air quality information is available for this location."
  );
}
function renderAqiCard() {
  const air = currentAir();
  const score = Number.isFinite(air?.us_aqi)
    ? Math.round(air.us_aqi)
    : Number.NaN;
  const cat = aqiCategory(score);
  const progress = Number.isFinite(score)
    ? Math.max(0, Math.min(100, (score / 500) * 100))
    : 0;
  const pollutants = [
    ["PM2.5", "pm2_5", "μg/m³"],
    ["PM10", "pm10", "μg/m³"],
    ["O₃", "ozone", "μg/m³"],
    ["NO₂", "nitrogen_dioxide", "μg/m³"],
    ["SO₂", "sulphur_dioxide", "μg/m³"],
    ["CO", "carbon_monoxide", "μg/m³"],
  ];
  const contributors = [
    ["PM2.5", "us_aqi_pm2_5"],
    ["PM10", "us_aqi_pm10"],
    ["O₃", "us_aqi_ozone"],
    ["NO₂", "us_aqi_nitrogen_dioxide"],
    ["SO₂", "us_aqi_sulphur_dioxide"],
    ["CO", "us_aqi_carbon_monoxide"],
  ]
    .map(([label, key]) => ({ label, value: air?.[key] }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value);
  const leadingContributor = contributors[0] || null;
  if (!state.air?.hourly?.time?.length) {
    return `<div class="aqi-experience aqi-unavailable"><div class="aqi-unavailable-art">${icon("wind")}</div><div><strong>Air quality data unavailable</strong><p>The air-quality provider did not return measurements for this request. Weather forecasts remain available independently.</p></div></div>`;
  }
  const hourly = state.air.hourly;
  return `<div class="aqi-experience">
    <div class="aqi-overview">
      <div class="aqi-gauge-wrap">
        <div class="aqi-gauge" style="--aqi-angle:${progress * 2.8}deg;--aqi-color:${cat.color}" role="img" aria-label="US AQI ${Number.isFinite(score) ? score : "unavailable"}; ${escapeHTML(cat.label)}">
          <div class="aqi-gauge-core"><strong>${Number.isFinite(score) ? score : "—"}</strong><small>US AQI</small></div>
        </div>
        <span class="aqi-gauge-caption">US AQI · 0–500+</span>
      </div>
      <div class="aqi-overview-copy">
        <span class="aqi-status-pill" style="--aqi-color:${cat.color}"><i></i>${escapeHTML(cat.label)}</span>
        <h3>${Number.isFinite(score) ? (score <= 50 ? "A clear-air day" : score <= 100 ? "Air quality is moderate" : "Check local air guidance") : "Current AQI unavailable"}</h3>
        <p>${escapeHTML(aqiDescription(cat, score))}</p>
        <div class="aqi-meta-line"><span>${icon("activity")} US EPA AQI</span><span>${state.air?._meta?.cached ? "Cached data" : "Provider forecast"}</span></div>
        ${leadingContributor ? `<div class="aqi-driver"><span>Leading AQI component</span><strong>${escapeHTML(leadingContributor.label)} <b>${Math.round(leadingContributor.value)}</b></strong></div>` : ""}
      </div>
    </div>
    <div class="aqi-scale" ${Number.isFinite(score) ? `role="meter" aria-label="US AQI level" aria-valuemin="0" aria-valuemax="500" aria-valuenow="${Math.max(0, Math.min(500, score))}" aria-valuetext="${score} US AQI, ${cat.label}"` : 'role="img" aria-label="US AQI scale; current measurement unavailable"'}><span class="aqi-scale-fill" style="width:${progress}%;background:${cat.color}"></span></div>
    <div class="aqi-scale-labels"><span>Good</span><span>Moderate</span><span>Unhealthy</span><span>Hazardous</span></div>
    <div class="aqi-pollutant-heading"><div><strong>Pollutant snapshot</strong><small>Current modelled concentrations</small></div><span class="aqi-data-tag">${state.air?._meta?.cached ? "CACHED" : "LIVE FEED"}</span></div>
    <div class="pollutant-grid premium-pollutant-grid">${pollutants
      .map(([name, key, unit]) => {
        const value = air?.[key];
        return `<article class="pollutant premium-pollutant"><div class="pollutant-topline"><small>${name}</small><span>${icon("activity")}</span></div><strong>${Number.isFinite(value) ? `${safeNumber(value, key === "carbon_monoxide" ? 0 : 1)} <small>${unit}</small>` : "—"}</strong>${pollutantSparkline(hourly[key] || [])}</article>`;
      })
      .join("")}</div>
    <p class="aqi-source-note">Source: Open-Meteo Air Quality API · US AQI standard. Concentrations are model estimates, not personal exposure measurements.</p>
  </div>`;
}

function renderSmartOutlook(items = nextHours(24)) {
  const outlook = buildWeatherOutlook(items);
  const descriptions = {
    rain: "Highest precipitation probability in the available outlook.",
    warmest: "Warmest point in the next 24-hour forecast.",
    wind: "Highest sustained wind speed in the available hours.",
    uv: "Maximum forecast UV index in the available hours.",
  };
  return `<section class="smart-outlook-section">
    <div class="smart-outlook-heading"><div><span class="smart-outlook-kicker">THE NEXT 24 HOURS</span><h2>Plan around the changes</h2><p>Highlights calculated from the selected location’s hourly forecast.</p></div><span class="smart-outlook-badge">${icon("sparkles")} Live forecast signals</span></div>
    <div class="smart-outlook-grid">${outlook.map((item) => `<article class="smart-outlook-card ${item.tone}" data-outlook="${item.id}"><span class="smart-outlook-icon">${icon(item.icon)}</span><div class="smart-outlook-copy"><small>${item.label}</small><strong>${escapeHTML(item.value)}</strong><p>${escapeHTML(item.detail)}</p></div><span class="smart-outlook-glow" aria-hidden="true"></span></article>`).join("")}</div>
    <p class="smart-outlook-footnote">These are forecast summaries, not guarantees. Values update when the provider forecast refreshes.</p>
  </section>`;
}

function formatHeroDate(value) {
  if (!value) return "Local time unavailable";
  const normalized = String(value).replace(" ", "T").slice(0, 16);
  const parsed = new Date(`${normalized}:00Z`);
  if (Number.isNaN(parsed.getTime())) return "Local time unavailable";
  return new Intl.DateTimeFormat(locale(), {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(parsed);
}

function uvBand(value) {
  if (!Number.isFinite(value))
    return { label: "Unavailable", className: "neutral" };
  if (value <= 2) return { label: "Low", className: "good" };
  if (value <= 5) return { label: "Moderate", className: "moderate" };
  if (value <= 7) return { label: "High", className: "warn" };
  if (value <= 10) return { label: "Very high", className: "danger" };
  return { label: "Extreme", className: "danger" };
}

function trendControlsMarkup() {
  const metrics = [
    ["temperature", "Temp"],
    ["feels", "Feels"],
    ["rain", "Rain"],
    ["wind", "Wind"],
    ["humidity", "Humidity"],
    ["uv", "UV"],
    ["clouds", "Clouds"],
    ["dewpoint", "Dew"],
    ["pressure", "Pressure"],
    ["visibility", "Visibility"],
    ["sunshine", "Sunshine"],
  ];
  const metricButtons = metrics
    .map(
      ([key, label]) =>
        `<button type="button" class="chart-tab ${state.chart === key ? "active" : ""}" aria-label="${label}" aria-pressed="${state.chart === key}" data-chart="${key}">${label}</button>`,
    )
    .join("");
  return `<div class="reference-panel-heading trend-heading">
    <div class="trend-title-wrap"><span class="trend-heading-icon">${icon("chart-no-axes-combined")}</span><div><h2>Weather Trends</h2><p id="trendSubtitle">Next 24 hours · Temperature</p></div></div>
    <div class="trend-controls">
      <div class="trend-control-group trend-metric-group">
        <span class="trend-control-label">Select metric</span>
        <div class="chart-tabs trend-metric-tabs" role="group" aria-label="Choose weather trend">${metricButtons}</div>
      </div>
      <div class="trend-control-group trend-range-group">
        <span class="trend-control-label">Forecast range</span>
        <div class="chart-tabs trend-range-tabs" role="group" aria-label="Choose forecast range">
          <button type="button" class="chart-tab ${state.chartRange === "24h" ? "active" : ""}" data-chart-range="24h" aria-pressed="${state.chartRange === "24h"}">24H</button>
          <button type="button" class="chart-tab ${state.chartRange === "10d" ? "active" : ""}" data-chart-range="10d" aria-pressed="${state.chartRange === "10d"}">10D</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderDashboard() {
  syncWeatherBackdrop();
  document.body.classList.add("dashboard-view");
  document.body.classList.remove("reference-subpage");
  const c = current();
  const meta = c
    ? condition(c.weather_code)
    : { label: "Weather data unavailable", tone: "cloudy", icon: "cloud" };
  const hours = nextHours(24);
  const localToday = String(c?.time || new Date().toISOString()).slice(0, 10);
  const forecastDays = dailyRows().filter((day) => day.date >= localToday);
  const today = forecastDays[0] || {};
  const days = forecastDays.slice(0, 5);
  const isFavorite = state.favorites.some(
    (f) =>
      Math.abs(f.latitude - state.location.latitude) < 0.001 &&
      Math.abs(f.longitude - state.location.longitude) < 0.001,
  );
  const uvValue = Number.isFinite(c?.uv_index)
    ? c.uv_index
    : hours[0]?.uv_index;
  const uv = uvBand(uvValue);
  const visibilityValue = Number.isFinite(hours[0]?.visibility)
    ? `${(hours[0].visibility / 1000).toFixed(0)} km`
    : "—";
  const rainWindow = hours
    .slice(0, 6)
    .map((item) => item.precipitation_probability)
    .filter(Number.isFinite);
  const peakRain = rainWindow.length ? `${Math.max(...rainWindow)}%` : "—";
  const locationName = [state.location.name, state.location.country]
    .filter(Boolean)
    .join(", ");
  const isIslamabad =
    /islamabad/i.test(state.location.name || "") &&
    /pakistan/i.test(state.location.country || "");
  const cityPhoto = isIslamabad
    ? "https://images.pexels.com/photos/16693762/pexels-photo-16693762/free-photo-of-faisal-masjid-in-islamabad.jpeg?auto=compress&cs=tinysrgb&w=800"
    : weatherPhotoFor(meta.tone);
  const cityPhotoAlt = isIslamabad
    ? "Faisal Mosque in Islamabad at twilight, photographed from above"
    : `Atmospheric landscape photograph accompanying weather for ${state.location.name}`;
  const dateLine = formatHeroDate(c?.time);
  const quickStats = [
    [
      "Humidity",
      `${safeNumber(c?.relative_humidity_2m)}%`,
      "droplet",
      "humidity",
    ],
    ["Wind", wind(c?.wind_speed_10m), "wind", "wind"],
    ["Pressure", `${safeNumber(c?.pressure_msl)} hPa`, "gauge", "pressure"],
    ["Visibility", visibilityValue, "eye", "visibility"],
  ];
  const highlightRows = [
    [
      "sun",
      "UV Index",
      Number.isFinite(uvValue) ? safeNumber(uvValue) : "—",
      uv.label,
      uv.className,
    ],
    ["sunrise", "Sunrise", displayTime(today.sunrise), "", "neutral"],
    ["sunset", "Sunset", displayTime(today.sunset), "", "neutral"],
    ["cloud-rain", "Peak rain chance", peakRain, "", "neutral"],
  ];
  const detailRows = [
    ["Wind", wind(c?.wind_speed_10m), "wind", "wind"],
    [
      "Humidity",
      `${safeNumber(c?.relative_humidity_2m)}%`,
      "droplet",
      "humidity",
    ],
    ["Pressure", `${safeNumber(c?.pressure_msl)} hPa`, "gauge", "pressure"],
    ["Visibility", visibilityValue, "eye", "visibility"],
  ];
  const forecastMarkup = days
    .map((day, index) => {
      const dayMeta = condition(day.weather_code);
      const dayName =
        index === 0 ? "Today" : displayDate(day.date, { weekday: "short" });
      const art = weatherArt(day.weather_code, 1);
      return `<article class="reference-day ${index === 0 ? "is-today" : ""}">
      <span class="reference-day-name">${escapeHTML(dayName)}</span>
      <span class="reference-day-date">${escapeHTML(displayDate(day.date, { month: "short", day: "numeric" }))}</span>
      <span class="reference-day-art">${art}</span>
      <strong class="reference-day-temps"><span>${temperature(day.temperature_2m_max)}</span><i>/</i><span>${temperature(day.temperature_2m_min)}</span></strong>
      <span class="reference-day-condition">${escapeHTML(dayMeta.label)}</span>
      <span class="reference-day-rain">${Number.isFinite(day.precipitation_probability_max) ? `${Math.round(day.precipitation_probability_max)}% rain` : "Rain —"}</span>
    </article>`;
    })
    .join("");

  root.innerHTML = `
    <div class="reference-dashboard">
      <section class="reference-top-grid">
        <div class="reference-main-weather" data-weather="${meta.tone}">
          <div class="reference-hero">
            <div class="reference-weather-copy">
              <div class="reference-location-line">${icon("map-pin")}<span>${escapeHTML(state.location.name)}</span><small>${escapeHTML(state.location.country || "")}</small></div>
              <div class="reference-date-line">${escapeHTML(dateLine)}</div>
              <div class="reference-temperature"><span>${escapeHTML(temperature(c?.temperature_2m).replace("°", ""))}</span><sup>°${state.tempUnit.toUpperCase()}</sup></div>
              <div class="reference-condition">${escapeHTML(meta.label)}</div>
              <div class="reference-feels">${icon("thermometer")}<span>${t("feelsLike")}: <strong>${temperature(c?.apparent_temperature)}</strong></span></div>
              <p class="reference-summary">${escapeHTML(c ? skySummary(c, hours) : "Weather data could not be loaded. Retry the request or search for another city.")}</p>
              <div class="reference-hero-actions">
                <button class="reference-round-action" data-action="refresh" aria-label="Refresh weather" title="Refresh weather">${icon("refresh")}</button>
                <button class="reference-round-action ${isFavorite ? "is-saved" : ""}" data-action="favorite" aria-label="${isFavorite ? "Remove from favorites" : "Save location"}" title="${isFavorite ? "Saved location" : "Save location"}">${icon("heart")}</button>
                <button class="reference-round-action" data-action="share" aria-label="Share weather" title="Share weather">${icon("share")}</button>
                <span class="reference-updated">${!c ? "No live data" : state.dataCached ? "Cached weather" : "Updated"} · ${escapeHTML(formatUpdated())}</span>
              </div>
            </div>
          </div>
          <div class="reference-quick-stats">
            ${quickStats.map(([label, value, symbol, kind]) => `<div class="reference-quick-stat ${kind}"><span class="reference-stat-icon">${icon(symbol)}</span><span class="reference-stat-copy"><small>${label}</small><strong>${escapeHTML(value)}</strong></span></div>`).join("")}
          </div>
        </div>

        <aside class="reference-side-top">
          <section class="reference-panel reference-highlights">
            <div class="reference-panel-heading"><span class="reference-heading-icon">${icon("chart-no-axes-combined")}</span><h2>Today's Highlights</h2><span class="reference-live-badge"><i></i>${!c ? "Unavailable" : state.dataCached ? "Cached" : "Live"}</span></div>
            <div class="reference-highlight-list">
              ${highlightRows.map(([symbol, label, value, tag, kind]) => `<div class="reference-highlight-row"><span class="reference-highlight-icon ${symbol}">${icon(symbol)}</span><span class="reference-highlight-label">${label}</span>${tag ? `<span class="reference-highlight-tag ${kind}">${escapeHTML(tag)}</span>` : ""}<strong class="reference-highlight-value">${escapeHTML(value)}</strong></div>`).join("")}
            </div>
          </section>
          <button class="reference-city-card" type="button" data-view="maps" aria-label="Explore ${escapeHTML(state.location.name)} on weather map">
            <img src="${cityPhoto}" alt="${escapeHTML(cityPhotoAlt)}" loading="lazy" referrerpolicy="no-referrer">
            <span class="reference-city-shade"></span>
            <span class="reference-city-copy"><strong>${icon("map-pin")} ${escapeHTML(state.location.name)}</strong><small>${isIslamabad ? "Faisal Mosque · Islamabad" : "Explore local conditions"}</small><em>View weather map</em></span>
            <span class="reference-city-arrow">${icon("arrow-right")}</span>
          </button>
        </aside>
      </section>

      <section class="reference-bottom-grid">
        <article class="reference-panel reference-forecast-panel">
          <div class="reference-panel-heading"><span class="reference-heading-icon">${icon("calendar-days")}</span><h2>5-Day Forecast</h2><button class="reference-see-more" data-view="forecast">See more ${icon("arrow-right")}</button></div>
          <div class="reference-forecast-grid">${forecastMarkup || '<div class="empty-state">Daily forecast unavailable.</div>'}</div>
        </article>
        <article class="reference-panel reference-details-panel">
          <div class="reference-panel-heading"><span class="reference-heading-icon info">${icon("info")}</span><h2>Weather Details</h2><span class="reference-details-subtitle">Current conditions</span></div>
          <div class="reference-detail-grid">
            ${detailRows.map(([label, value, symbol, kind]) => `<div class="reference-detail-card ${kind}"><span class="reference-detail-icon">${icon(symbol)}</span><span class="reference-detail-copy"><small>${label}</small><strong>${escapeHTML(value)}</strong></span></div>`).join("")}
          </div>
        </article>
      </section>

      ${renderSmartOutlook(hours)}

      <section class="reference-lower-grid">
        <article class="reference-panel reference-hourly-panel">
          <div class="reference-panel-heading"><span class="reference-heading-icon">${icon("clock")}</span><div class="hourly-heading-copy"><h2>24-Hour Forecast</h2><p>Hour-by-hour changes in your local time</p></div><button class="reference-see-more" data-view="forecast">Full forecast ${icon("arrow-right")}</button></div>
          ${hourlySummaryMarkup(hours)}
          <div class="hourly-track reference-hourly-track" role="list" aria-label="Next 24 hours forecast">${hourlyItems()}</div>
          <div class="hourly-scroll-caption"><span>${icon("arrow-left") + icon("arrow-right")} Scroll to explore the full day</span><span>Rain probability shown below each hour</span></div>
        </article>
        <article class="reference-panel reference-chart-panel trend-premium-panel">
          ${trendControlsMarkup()}
          <div id="trendSummary" class="trend-summary-slot"></div>
          <div class="chart-area trend-chart-area" id="mainChart"></div>
          <div class="trend-footer"><span>${icon("database")} Forecast model data</span><span>${state.dataCached ? "Last successful cached response" : "Updated with the selected location forecast"}</span></div>
        </article>
      </section>

      <section class="reference-extras-grid">
        <article class="reference-panel"><div class="reference-panel-heading"><span class="reference-heading-icon">${icon("compass")}</span><h2>Wind Compass</h2></div>${renderWindCompass()}</article>
        <article class="reference-panel"><div class="reference-panel-heading"><span class="reference-heading-icon">${icon("sunrise")}</span><h2>Daylight</h2></div>${renderSunArc()}</article>
        <article class="reference-panel"><div class="reference-panel-heading"><span class="reference-heading-icon">${icon("wind")}</span><h2>Air Quality</h2></div>${renderAqiCard()}</article>
      </section>

      <section class="reference-insights-panel reference-panel">
        <div class="reference-panel-heading"><span class="reference-heading-icon">${icon("sparkles")}</span><div><h2>Skyvora Intelligence</h2><p>Rule-based insights generated from current forecast data</p></div><button class="reference-see-more" data-view="intelligence">Explore ${icon("arrow-right")}</button></div>
        <div class="insight-list">${buildInsights(c, hours, dailyRows())
          .map(
            (item) =>
              `<div class="insight-item"><span class="insight-symbol">${icon(item.icon)}</span><div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.text)}</p></div></div>`,
          )
          .join("")}</div>
        <p class="source-line">Weather forecast and air-quality data by Open-Meteo. ${state.dataCached ? "Currently showing cached provider data." : `Provider timestamp: ${escapeHTML(state.weather?.current?.time || "not supplied")}.`} ${t("commercialNote")}</p>
      </section>
    </div>`;

  const locationText = $("#topLocationName");
  if (locationText) locationText.textContent = locationName;
  // The forecast markup is now in the DOM. Let the browser paint the hero and
  // primary metrics before building the chart SVG and hydrating secondary icons.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!root.isConnected || !root.querySelector(".reference-dashboard"))
        return;
      hydrateIcons(root);
      if (root.querySelector("#mainChart")) renderChart();
      bindViewMapButtons();
    });
  });
}
function weatherArt(code, isDay = 1) {
  const meta = condition(code);
  const sun = isDay
    ? `<circle cx="112" cy="76" r="34" fill="#f8d58a"/><circle cx="112" cy="76" r="45" fill="#f8d58a" opacity=".13"/>`
    : `<circle cx="112" cy="76" r="31" fill="#e1e8fa"/><circle cx="126" cy="64" r="31" fill="#526981"/>`;
  const cloud = `<g filter="url(#shadow)"><path d="M50 145c-17 0-29-12-29-27 0-15 12-27 28-28 8-26 40-35 60-16 8 8 12 18 12 28 20-1 34 13 34 31 0 7-2 13-7 18H50Z" fill="#eaf5ff"/><path d="M54 145h93" stroke="#c2dcef" stroke-width="5" stroke-linecap="round"/></g>`;
  const rain =
    meta.tone === "rain"
      ? '<path d="m64 159-8 15m41-15-8 15m41-15-8 15" stroke="#8ed8f4" stroke-width="5" stroke-linecap="round"/>'
      : "";
  const snow =
    meta.tone === "snow"
      ? '<g fill="#d9f2ff"><circle cx="65" cy="173" r="3"/><circle cx="105" cy="171" r="3"/><circle cx="143" cy="174" r="3"/></g>'
      : "";
  const lightning =
    meta.tone === "storm"
      ? '<path d="m103 150-14 22h14l-7 17 25-29h-15l9-10" fill="#f8cd79"/>'
      : "";
  return `<svg viewBox="0 0 190 210" role="img" aria-label="${escapeHTML(meta.label)} weather illustration" xmlns="http://www.w3.org/2000/svg"><defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="#071323" flood-opacity=".2"/></filter></defs>${meta.tone === "clear" ? sun : meta.tone === "cloudy" || meta.tone === "fog" ? sun : ""}${meta.tone === "snow" ? "" : ""}${cloud}${rain}${snow}${lightning}</svg>`;
}
function featureTile(iconName, title, description, view) {
  return `<article class="feature-card" role="button" tabindex="0" data-view="${view}"><span class="feature-icon">${icon(iconName)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(description)}</p><div class="feature-bottom"><span class="text-button">Explore ${icon("arrow-up-right")}</span></div></article>`;
}
function bindViewMapButtons() {
  $$("[data-view]", root).forEach((node) => {
    if (node.tagName === "ARTICLE")
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate(node.dataset.view);
        }
      });
  });
}

function pageHeading(kicker, title, description, actions = "") {
  return `<div class="page-heading"><div><p class="page-kicker">${escapeHTML(kicker)}</p><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function renderForecastPage() {
  const localToday = String(current()?.time || new Date().toISOString()).slice(
    0,
    10,
  );
  const rows = dailyRows().filter((day) => day.date >= localToday);
  const hours = nextHours(24);
  const rainWindow = hours.map((item) => ({
    label: displayTime(item.time),
    value: item.precipitation_probability,
  }));
  const rainPeak = hours.reduce(
    (best, item) =>
      (item.precipitation_probability ?? -1) >
      (best?.precipitation_probability ?? -1)
        ? item
        : best,
    null,
  );
  root.innerHTML = `${pageHeading("FORECAST CENTER", "A clearer view of what is ahead", `10-day outlook for ${state.location.name}, plus a detailed 24-hour timeline.`, '<button class="btn" data-action="share">' + icon("share") + " Share outlook</button>")}
    <section class="panel chart-panel"><div class="panel-heading"><div><h2>Temperature outlook</h2><p>Hourly temperature · next 24 hours</p></div><span class="badge info">${hours.length} available points</span></div><div class="chart-area" id="forecastChart"></div></section>
    <section class="panel reference-hourly-panel hourly-page-panel"><div class="reference-panel-heading"><span class="reference-heading-icon">${icon("clock")}</span><div class="hourly-heading-copy"><h2>24-Hour Weather Timeline</h2><p>Every hour, with condition and precipitation probability</p></div></div>${hourlySummaryMarkup(hours)}<div class="hourly-track reference-hourly-track" role="list" aria-label="24-hour weather timeline">${hourlyItems()}</div></section>
    <div class="content-grid" style="margin-top:15px"><article class="panel"><div class="panel-heading"><div><h2>Precipitation timeline</h2><p>Probability from the hourly model</p></div><span class="panel-icon">${icon("cloud-rain")}</span></div><div class="timeline-peak"><strong>${Number.isFinite(rainPeak?.precipitation_probability) ? `${Math.round(rainPeak.precipitation_probability)}%` : "—"}</strong><span>Highest chance in the next 24 hours</span><small>${rainPeak ? displayTime(rainPeak.time) : "Not available"}</small></div><div class="rain-bars">${rainWindow
      .filter((_, i) => i % 2 === 0)
      .map(
        (p) =>
          `<div class="rain-bar-wrap"><div class="rain-bar" style="height:${Math.max(4, Math.min(100, p.value || 0))}%" title="${p.value ?? "—"}%"></div><small>${p.label}</small></div>`,
      )
      .join("")}</div></article>
    <article class="panel"><div class="panel-heading"><div><h2>Today at a glance</h2><p>Daily summary from provider data</p></div><span class="panel-icon">${icon("calendar-days")}</span></div>${rows[0] ? `<div class="forecast-summary-icon">${weatherIcon(rows[0].weather_code, "forecast-summary-weather")}</div><h3 class="forecast-summary-condition">${escapeHTML(condition(rows[0].weather_code).label)}</h3><div class="stat-line"><span>Temperature range</span><strong>${temperature(rows[0].temperature_2m_min)} / ${temperature(rows[0].temperature_2m_max)}</strong></div><div class="stat-line"><span>Rain probability</span><strong>${safeNumber(rows[0].precipitation_probability_max)}%</strong></div><div class="stat-line"><span>Precipitation</span><strong>${rainfall(rows[0].precipitation_sum)}</strong></div><div class="stat-line"><span>Max wind</span><strong>${wind(rows[0].wind_speed_10m_max)}</strong></div>` : '<p class="text-muted">Daily summary unavailable.</p>'}</article></div>
    <div class="section-row"><div><h2>10-day outlook</h2><p>High, low and daily precipitation probability</p></div></div><section class="panel"><div class="daily-list">${dailyList(rows)}</div></section>
    <div class="section-row"><div><h2>Weather planner</h2><p>Simple forecast-based suggestions, not safety guarantees</p></div><button class="link-button" data-view="planner">Open planner ${icon("arrow-up-right")}</button></div><section class="content-grid three">${activityCards()}</section>
  `;
  hydrateIcons(root);
  void drawLineChart(
    $("#forecastChart"),
    hours.map((v) => ({ label: displayTime(v.time), value: v.temperature_2m })),
    {
      color: "#85d7f5",
      id: "forecast-temperature",
      valueFormatter: temperature,
    },
  );
}

function activityCards() {
  const c = current();
  const h = nextHours(12);
  if (!c) return "";
  const avgRain = h.length
    ? h.reduce((sum, item) => sum + (item.precipitation_probability || 0), 0) /
      h.length
    : 0;
  const avgWind = h.length
    ? h.reduce((sum, item) => sum + (item.wind_speed_10m || 0), 0) / h.length
    : c.wind_speed_10m || 0;
  const temp = c.temperature_2m;
  const activities = [
    [
      "footprints",
      "Walking",
      avgRain < 35 && avgWind < 25 && temp > 12 && temp < 34
        ? "More favorable"
        : "Check conditions",
      avgRain < 35
        ? "Lower rain probability in the available hours."
        : "Rain probability is elevated in some upcoming hours.",
    ],
    [
      "bike",
      "Cycling",
      avgWind < 25 && avgRain < 30 ? "More favorable" : "Mixed conditions",
      `Average forecast wind is around ${Math.round(avgWind)} km/h.`,
    ],
    [
      "camera",
      "Photography",
      c.cloud_cover > 20 && c.cloud_cover < 80
        ? "Some cloud texture"
        : "Simple sky conditions",
      `Cloud cover is ${Math.round(c.cloud_cover || 0)}%. Check the golden-hour timings.`,
    ],
  ];
  return activities
    .map(
      ([symbol, title, status, description]) =>
        `<article class="feature-card"><span class="feature-icon">${icon(symbol === "bike" ? "wind" : symbol === "camera" ? "sunrise" : "sun")}</span><h3>${title}</h3><p>${description}</p><div class="feature-bottom"><span class="badge info">${status}</span></div></article>`,
    )
    .join("");
}

let leafletLoadPromise = null;

async function loadLeaflet() {
  if (window.L) return window.L;
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    stylesheet.integrity =
      "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    stylesheet.crossOrigin = "";
    document.head.append(stylesheet);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.async = true;
    script.onload = () =>
      window.L
        ? resolve(window.L)
        : reject(new Error("Leaflet did not initialize."));
    script.onerror = () =>
      reject(new Error("Leaflet could not be downloaded."));
    document.head.append(script);
  }).catch((error) => {
    leafletLoadPromise = null;
    throw error;
  });

  return leafletLoadPromise;
}

const WEATHER_EXPLORER_PLACES = Object.freeze([
  {
    name: "Cherrapunji",
    country: "India",
    latitude: 25.2702,
    longitude: 91.7323,
    timezone: "Asia/Kolkata",
    tag: "Rain",
  },
  {
    name: "London",
    country: "United Kingdom",
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: "Europe/London",
    tag: "Cloudy",
  },
  {
    name: "Phoenix",
    country: "United States",
    latitude: 33.4484,
    longitude: -112.074,
    timezone: "America/Phoenix",
    tag: "Sunny",
  },
  {
    name: "Tromsø",
    country: "Norway",
    latitude: 69.6492,
    longitude: 18.9553,
    timezone: "Europe/Oslo",
    tag: "Snow",
  },
  {
    name: "San Francisco",
    country: "United States",
    latitude: 37.7749,
    longitude: -122.4194,
    timezone: "America/Los_Angeles",
    tag: "Fog",
  },
  {
    name: "Darwin",
    country: "Australia",
    latitude: -12.4634,
    longitude: 130.8456,
    timezone: "Australia/Darwin",
    tag: "Thunderstorm",
  },
  {
    name: "Reykjavík",
    country: "Iceland",
    latitude: 64.1466,
    longitude: -21.9426,
    timezone: "Atlantic/Reykjavik",
    tag: "Night",
  },
  {
    name: "Islamabad",
    country: "Pakistan",
    latitude: 33.6844,
    longitude: 73.0479,
    timezone: "Asia/Karachi",
    tag: "Search",
  },
]);

async function renderMapPage() {
  const placeCards = WEATHER_EXPLORER_PLACES.map(
    (place, index) => `
    <article class="weather-place-card">
      <span class="weather-place-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="weather-place-copy"><strong>${escapeHTML(place.name)}</strong><small>${escapeHTML(place.country)} · ${escapeHTML(place.tag)} test location</small></div>
      <button class="btn btn-ghost btn-small" data-action="open-city" data-lat="${place.latitude}" data-lon="${place.longitude}" data-name="${escapeHTML(place.name)}" data-country="${escapeHTML(place.country)}" data-tz="${escapeHTML(place.timezone)}" aria-label="View weather in ${escapeHTML(place.name)}">Explore ${icon("arrow-up-right")}</button>
    </article>`,
  ).join("");
  root.innerHTML = `${pageHeading("WORLD WEATHER EXPLORER", "Weather locations", "Explore the eight regions selected for testing Skyvora weather scenes. The map pins are real geographic locations; weather at each place always comes from the live forecast.", '<button class="btn" data-action="locate">' + icon("crosshair") + " My location</button>")}
    <section class="panel weather-explorer-panel"><div class="panel-heading"><div><h2>Global weather test map</h2><p>Eight real locations · select a pin or open a city below</p></div><span class="badge good">Interactive map</span></div><div id="weatherMap" role="region" aria-label="Interactive world map with eight weather test locations"></div><div class="map-note">${icon("info")}<span>Map tiles © OpenStreetMap contributors. Pins identify test regions only; they do not claim that the tagged weather is happening there right now. Select a city to load its current forecast.</span></div></section>
    <section class="panel weather-places-panel"><div class="panel-heading"><div><h2>Weather scene test regions</h2><p>Open any location to check its current weather and matching scene.</p></div><span class="panel-icon">${icon("map")}</span></div><div class="weather-place-grid">${placeCards}</div></section>`;
  hydrateIcons(root);
  const mapNode = $("#weatherMap");
  try {
    const leaflet = await loadLeaflet();
    if (!mapNode?.isConnected) return;
    if (state.map) {
      state.map.remove();
      state.map = null;
    }
    state.map = leaflet
      .map(mapNode, { scrollWheelZoom: false, worldCopyJump: true })
      .setView([23, 8], 2);
    leaflet
      .tileLayer(CONFIG.mapTiles, {
        minZoom: 2,
        maxZoom: 18,
        attribution: CONFIG.mapAttribution,
        crossOrigin: true,
      })
      .addTo(state.map);
    const bounds = [];
    WEATHER_EXPLORER_PLACES.forEach((place) => {
      const marker = leaflet
        .marker([place.latitude, place.longitude])
        .addTo(state.map);
      marker.bindPopup(
        `<strong>${escapeHTML(place.name)}, ${escapeHTML(place.country)}</strong><br><span>${escapeHTML(place.tag)} scene test location</span>`,
      );
      marker.on("click", () => marker.openPopup());
      bounds.push([place.latitude, place.longitude]);
    });
    if (bounds.length)
      state.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 3 });
    setTimeout(() => state.map?.invalidateSize(), 150);
  } catch (error) {
    if (mapNode?.isConnected)
      mapNode.innerHTML =
        '<div class="empty-state"><h3>Map unavailable</h3><p>Check your internet connection and reload this page. The city list below remains available.</p></div>';
    console.warn("[maps] Leaflet could not be loaded:", error.message);
  }
}

function renderAqiTrendChart() {
  const chart = $("#aqiChart", root);
  if (!chart) return;
  const metric =
    $("#aqiMetricSelect", root)?.value || state.aqiMetric || "us_aqi";
  state.aqiMetric = metric;
  const definitions = {
    us_aqi: {
      label: "Overall US AQI",
      unit: "AQI",
      kind: "index",
      color: "#63dcae",
    },
    us_aqi_pm2_5: {
      label: "PM2.5 AQI",
      unit: "AQI",
      kind: "index",
      color: "#66c9ff",
    },
    us_aqi_pm10: {
      label: "PM10 AQI",
      unit: "AQI",
      kind: "index",
      color: "#78d8d0",
    },
    us_aqi_ozone: {
      label: "Ozone AQI",
      unit: "AQI",
      kind: "index",
      color: "#b7a5ff",
    },
    us_aqi_nitrogen_dioxide: {
      label: "NO₂ AQI",
      unit: "AQI",
      kind: "index",
      color: "#f3c56a",
    },
    us_aqi_sulphur_dioxide: {
      label: "SO₂ AQI",
      unit: "AQI",
      kind: "index",
      color: "#f19a82",
    },
    us_aqi_carbon_monoxide: {
      label: "CO AQI",
      unit: "AQI",
      kind: "index",
      color: "#a8c8ff",
    },
    pm2_5: {
      label: "PM2.5 concentration",
      unit: "μg/m³",
      kind: "concentration",
      color: "#66c9ff",
    },
    pm10: {
      label: "PM10 concentration",
      unit: "μg/m³",
      kind: "concentration",
      color: "#78d8d0",
    },
    ozone: {
      label: "Ozone concentration",
      unit: "μg/m³",
      kind: "concentration",
      color: "#b7a5ff",
    },
    nitrogen_dioxide: {
      label: "NO₂ concentration",
      unit: "μg/m³",
      kind: "concentration",
      color: "#f3c56a",
    },
    sulphur_dioxide: {
      label: "SO₂ concentration",
      unit: "μg/m³",
      kind: "concentration",
      color: "#f19a82",
    },
    carbon_monoxide: {
      label: "CO concentration",
      unit: "μg/m³",
      kind: "concentration",
      color: "#a8c8ff",
    },
  };
  const definition = definitions[metric] || definitions.us_aqi;
  const series = state.air?.hourly;
  const selectedWindow = selectTimeWindow(
    series?.time || [],
    series?.[metric] || [],
    current()?.time,
    state.aqiRange === "48h" ? 48 : 24,
  );
  const points = selectedWindow.rows.map((row) => ({
    label: displayTime(row.time),
    value: row.value,
  }));
  const available = points.filter((point) => Number.isFinite(point.value));
  const summary = $("#aqiTrendSummary", root);
  if (summary) {
    if (!available.length)
      summary.innerHTML = `<span class="aqi-trend-empty">${escapeHTML(definition.label)} is unavailable from the selected provider.</span>`;
    else {
      const peak = available.reduce(
        (best, point) => (point.value > best.value ? point : best),
        available[0],
      );
      const average =
        available.reduce((sum, point) => sum + point.value, 0) /
        available.length;
      const formatter = (value) =>
        definition.kind === "index"
          ? `${Math.round(value)} AQI`
          : `${value.toFixed(1)} ${definition.unit}`;
      summary.innerHTML = `<span><small>${state.aqiRange === "48h" ? "48-hour peak" : "24-hour peak"}</small><strong>${escapeHTML(formatter(peak.value))}</strong><em>${escapeHTML(peak.label)}</em></span><span><small>Window average</small><strong>${escapeHTML(formatter(average))}</strong><em>${available.length} hourly points</em></span><span><small>Selected series</small><strong>${escapeHTML(definition.label)}</strong><em>${escapeHTML(definition.unit)}</em></span>`;
    }
  }
  void drawLineChart(chart, points, {
    color: definition.color,
    id: `air-${metric}-${state.aqiRange}`,
    valueFormatter: (value) =>
      definition.kind === "index"
        ? `${Math.round(value)} AQI`
        : `${value.toFixed(1)} ${definition.unit}`,
  });
}

function renderAirPage() {
  const air = currentAir();
  const category = aqiCategory(air?.us_aqi);
  const c = current();
  root.innerHTML = `${pageHeading("ENVIRONMENT", "Air quality & UV", `Environmental conditions near ${state.location.name}. Values are model estimates, not personal exposure measurements.`)}
    <section class="content-grid"><article class="panel"><div class="panel-heading"><div><h2>United States Air Quality Index</h2><p>Open-Meteo air quality forecast</p></div><span class="badge ${category.className === "good" ? "good" : "warn"}">${escapeHTML(category.label)}</span></div>${renderAqiCard()}</article><article class="panel"><div class="panel-heading"><div><h2>UV intelligence</h2><p>Nearest available hourly model value</p></div><span class="panel-icon">${icon("sun")}</span></div><div class="uv-display"><strong>${safeNumber(nextHours(1)[0]?.uv_index)}</strong><span>UV index</span></div><div class="uv-scale"><i></i><i></i><i></i><i></i><i></i></div><p class="small text-muted">UV categories: 0–2 Low · 3–5 Moderate · 6–7 High · 8–10 Very high · 11+ Extreme. This is general awareness information.</p></article></section>
    <section class="panel aqi-trend-panel" style="margin-top:15px"><div class="panel-heading"><div><h2>Air quality intelligence timeline</h2><p>Explore the next 24 or 48 hours of AQI sub-indices and pollutant concentrations.</p></div><div class="aqi-trend-controls"><div class="chart-tabs aqi-range-tabs" role="group" aria-label="Air quality forecast range"><button class="chart-tab ${state.aqiRange === "24h" ? "active" : ""}" data-aqi-range="24h" aria-pressed="${state.aqiRange === "24h"}">24H</button><button class="chart-tab ${state.aqiRange === "48h" ? "active" : ""}" data-aqi-range="48h" aria-pressed="${state.aqiRange === "48h"}">48H</button></div><label class="aqi-select-wrap" for="aqiMetricSelect"><span>Metric</span><select id="aqiMetricSelect"><optgroup label="United States AQI"><option value="us_aqi">Overall US AQI</option><option value="us_aqi_pm2_5">PM2.5 AQI</option><option value="us_aqi_pm10">PM10 AQI</option><option value="us_aqi_ozone">Ozone AQI</option><option value="us_aqi_nitrogen_dioxide">NO₂ AQI</option><option value="us_aqi_sulphur_dioxide">SO₂ AQI</option><option value="us_aqi_carbon_monoxide">CO AQI</option></optgroup><optgroup label="Pollutant concentration"><option value="pm2_5">PM2.5 concentration</option><option value="pm10">PM10 concentration</option><option value="ozone">Ozone concentration</option><option value="nitrogen_dioxide">NO₂ concentration</option><option value="sulphur_dioxide">SO₂ concentration</option><option value="carbon_monoxide">CO concentration</option></optgroup></select></label></div></div><div class="aqi-trend-summary" id="aqiTrendSummary"></div><div id="aqiChart" class="chart-area"></div><p class="source-line">AQI values use the US EPA AQI standard. Concentrations are model estimates in μg/m³, not personal exposure measurements. The timeline begins at the current local forecast hour. ${t("commercialNote")}</p></section>
    <section class="content-grid" style="margin-top:15px"><article class="panel"><div class="panel-heading"><h2>Weather factors</h2><span class="panel-icon">${icon("cloud")}</span></div><div class="stat-line"><span>Temperature</span><strong>${temperature(c?.temperature_2m)}</strong></div><div class="stat-line"><span>Humidity</span><strong>${safeNumber(c?.relative_humidity_2m)}%</strong></div><div class="stat-line"><span>Wind</span><strong>${wind(c?.wind_speed_10m)}</strong></div><div class="stat-line"><span>Visibility</span><strong>${Number.isFinite(nextHours(1)[0]?.visibility) ? `${(nextHours(1)[0].visibility / 1000).toFixed(1)} km` : "—"}</strong></div></article><article class="panel"><div class="panel-heading"><h2>Interpretation</h2><span class="panel-icon">${icon("info")}</span></div><p class="small text-soft">AQI categories summarize pollutant concentrations using a named standard. Different AQI standards can produce different values. The displayed US AQI should not be compared directly with national indices without conversion.</p><p class="small text-muted">General information only; not medical advice or a substitute for local environmental agency guidance.</p></article></section>`;
  hydrateIcons(root);
  const metricSelect = $("#aqiMetricSelect", root);
  if (metricSelect) metricSelect.value = state.aqiMetric || "us_aqi";
  renderAqiTrendChart();
}

async function renderComparePage() {
  const locations = [
    state.location,
    ...state.favorites.filter(
      (f) =>
        !(
          Math.abs(f.latitude - state.location.latitude) < 0.001 &&
          Math.abs(f.longitude - state.location.longitude) < 0.001
        ),
    ),
  ].slice(0, 6);
  root.innerHTML = `${pageHeading("MULTI-CITY", "Compare cities", "Compare real current conditions across your saved locations.", '<button class="btn btn-primary" data-action="focus-search">' + icon("plus") + " Add a city</button>")}
    <div class="content-grid three" id="comparisonCards">${locations.map((loc) => `<article class="panel compare-loading"><div class="skeleton" style="height:16px;width:60%"></div><div class="skeleton" style="height:42px;width:45%;margin-top:18px"></div><p class="text-muted small">Loading ${escapeHTML(loc.name)}…</p></article>`).join("")}</div>
    <p class="source-line">Each city is fetched from the same provider family. Local time and forecast values are location-specific.</p>`;
  const results = await Promise.allSettled(
    locations.map(async (loc) => ({
      location: loc,
      result: await api.forecast(loc),
    })),
  );
  const cards = results
    .map((item) => {
      if (item.status !== "fulfilled")
        return `<article class="panel"><span class="badge warn">Unavailable</span><h3>Location unavailable</h3><p class="small text-muted">${escapeHTML(item.reason?.message || "Could not load this city.")}</p></article>`;
      const { location, result } = item.value;
      const c = result.data.current;
      const meta = condition(c.weather_code);
      return `<article class="panel compare-card hoverable"><div class="compare-top"><div><h3>${escapeHTML(location.name)}</h3><p>${escapeHTML(location.country || "")}</p></div><span class="compare-weather-icon">${weatherIcon(c.weather_code)}</span></div><div class="compare-temp">${temperature(c.temperature_2m)}</div><div class="compare-condition">${escapeHTML(meta.label)}</div><div class="divider"></div><div class="stat-line"><span>Feels like</span><strong>${temperature(c.apparent_temperature)}</strong></div><div class="stat-line"><span>Humidity</span><strong>${safeNumber(c.relative_humidity_2m)}%</strong></div><div class="stat-line"><span>Wind</span><strong>${wind(c.wind_speed_10m)}</strong></div><div class="stat-line"><span>Local time</span><strong>${displayTime(c.time)}</strong></div><button class="btn btn-ghost btn-small" data-action="open-city" data-lat="${location.latitude}" data-lon="${location.longitude}" data-name="${escapeHTML(location.name)}" data-country="${escapeHTML(location.country || "")}" data-tz="${escapeHTML(result.data.timezone || "auto")}">Open this city ${icon("arrow-up-right")}</button></article>`;
    })
    .join("");
  const cardsRoot = $("#comparisonCards");
  if (cardsRoot) {
    cardsRoot.innerHTML = cards;
    hydrateIcons(cardsRoot);
  }
}

function defaultHistoryRange() {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { start: getLocalDateISO(start), end: getLocalDateISO(end) };
}
function renderHistoryPage() {
  const range = defaultHistoryRange();
  root.innerHTML = `${pageHeading("PAST CONDITIONS", "Historical weather explorer", `Explore archived modelled weather for ${state.location.name}. This is historical reanalysis, not necessarily a direct weather-station record.`)}
    <section class="panel"><div class="panel-heading"><div><h2>Choose a date range</h2><p>Up to 31 days per query</p></div><span class="panel-icon">${icon("calendar")}</span></div><form id="historyForm" class="form-grid"><div class="field"><label for="historyStart">Start date</label><input id="historyStart" type="date" required value="${range.start}" max="${range.end}"></div><div class="field"><label for="historyEnd">End date</label><input id="historyEnd" type="date" required value="${range.end}" max="${range.end}"></div><div class="field" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">${icon("search")} Load historical data</button></div></form></section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><div><h2>Historical temperature</h2><p id="historyRangeLabel">Choose a date range to explore the past.</p></div><button class="btn btn-small" data-action="export-history">${icon("download")} Export CSV</button></div><div id="historyChart" class="chart-area"><div class="empty-state"><span class="empty-icon">${icon("chart-no-axes-combined")}</span><p>Select a date range to load actual archived data.</p></div></div><div id="historyStats" class="content-grid three"></div></section>
    <div class="inline-notice" style="margin-top:15px">${icon("info")}<span>${t("historyNote")} Historical reanalysis may be delayed and may differ from a local station's observation.</span></div>`;
  hydrateIcons(root);
}

async function loadHistory(start, end) {
  const chart = $("#historyChart");
  if (chart)
    chart.innerHTML =
      '<div class="initial-loading"><span class="loader-ring"></span><p>Loading historical data…</p></div>';
  try {
    const result = await api.history(state.location, start, end);
    state.history = {
      data: result.data,
      start,
      end,
      fetchedAt: result.fetchedAt,
    };
    const d = result.data.daily;
    void drawLineChart(
      $("#historyChart"),
      (d?.time || []).map((date, i) => ({
        label: date.slice(5),
        value: d.temperature_2m_max?.[i],
      })),
      { color: "#f0b978", id: "history-chart", valueFormatter: temperature },
    );
    $("#historyRangeLabel").textContent =
      `${start} — ${end} · archived reanalysis`;
    const avg = d.temperature_2m_max?.filter(Number.isFinite) || [];
    const rain = d.precipitation_sum?.filter(Number.isFinite) || [];
    $("#historyStats").innerHTML =
      `<article class="metric-card"><span class="mini-label">AVERAGE DAILY HIGH</span><strong class="metric-value">${avg.length ? temperature(avg.reduce((a, b) => a + b, 0) / avg.length) : "—"}</strong><div class="metric-caption">Selected period</div></article><article class="metric-card"><span class="mini-label">TOTAL PRECIPITATION</span><strong class="metric-value">${rain.length ? rainfall(rain.reduce((a, b) => a + b, 0)) : "—"}</strong><div class="metric-caption">Selected period</div></article><article class="metric-card"><span class="mini-label">DAILY HIGH RECORD</span><strong class="metric-value">${avg.length ? temperature(Math.max(...avg)) : "—"}</strong><div class="metric-caption">Within this query only</div></article>`;
  } catch (error) {
    $("#historyChart").innerHTML =
      `<div class="empty-state"><span class="empty-icon">${icon("cloud-off")}</span><h3>Historical data unavailable</h3><p>${escapeHTML(error.message)}</p></div>`;
    toast("Could not load historical weather.", "error");
  }
}

async function renderMarinePage() {
  root.innerHTML = `${pageHeading("OCEAN CONDITIONS", "Marine forecast", `Wave and sea information near ${state.location.name}, only where the marine model supports the location.`)}<section class="panel"><div class="initial-loading"><span class="loader-ring"></span><p>Loading marine model data…</p></div></section>`;
  try {
    const result = await api.marine(state.location);
    state.marine = result.data;
    const c = result.data.current || {};
    const h = result.data.hourly || {};
    root.innerHTML = `${pageHeading("OCEAN CONDITIONS", "Marine forecast", `Modelled marine conditions near ${state.location.name}. Not intended for navigation or safety decisions.`)}<section class="metric-grid">${metricCard("WAVE HEIGHT", Number.isFinite(c.wave_height) ? `${safeNumber(c.wave_height, 1)} m` : "—", "Significant wave height", "waves")}${metricCard("WAVE PERIOD", Number.isFinite(c.wave_period) ? `${safeNumber(c.wave_period, 1)} s` : "—", "Mean wave period", "clock")}${metricCard("SEA TEMPERATURE", Number.isFinite(c.sea_surface_temperature) ? temperature(c.sea_surface_temperature) : "—", "Sea surface model", "thermometer")}${metricCard("SEA LEVEL", Number.isFinite(c.sea_level_height_msl) ? `${safeNumber(c.sea_level_height_msl, 2)} m` : "—", "Relative to mean sea level", "waves")}</section><section class="panel" style="margin-top:15px"><div class="panel-heading"><h2>Wave height outlook</h2><span class="badge info">Marine model</span></div><div id="marineChart" class="chart-area"></div><p class="source-line">Open-Meteo Marine API. Tide/sea-level estimates can be unreliable near some coasts and are not suitable for coastal navigation.</p></section>`;
    hydrateIcons(root);
    void drawLineChart(
      $("#marineChart"),
      (h.time || [])
        .slice(0, 48)
        .map((time, i) => ({
          label: displayTime(time),
          value: h.wave_height?.[i],
        })),
      {
        color: "#85d7f5",
        id: "marine-chart",
        valueFormatter: (v) => `${safeNumber(v, 1)} m`,
      },
    );
  } catch (error) {
    state.marine = null;
    root.innerHTML = `${pageHeading("OCEAN CONDITIONS", "Marine forecast", "The marine service did not return usable data for this location.")}<div class="empty-state panel"><span class="empty-icon">${icon("waves")}</span><h3>Marine data unavailable</h3><p>${escapeHTML(error.message)}</p></div>`;
    hydrateIcons(root);
  }
}

function plannerWindow() {
  const slots = nextHours(24);
  if (slots.length < 3) return null;
  let best = null;
  for (let i = 0; i <= slots.length - 3; i += 1) {
    const group = slots.slice(i, i + 3);
    const rain =
      group.reduce((sum, v) => sum + (v.precipitation_probability ?? 0), 0) /
      group.length;
    const windSpeed =
      group.reduce((sum, v) => sum + (v.wind_speed_10m ?? 0), 0) / group.length;
    const temp =
      group.reduce((sum, v) => sum + (v.temperature_2m ?? 20), 0) /
      group.length;
    const uv =
      group.reduce((sum, v) => sum + (v.uv_index ?? 0), 0) / group.length;
    const thermalPenalty = Math.max(0, Math.abs(temp - 23) - 5) * 2;
    const score = Math.max(
      0,
      100 -
        rain * 0.55 -
        windSpeed * 0.65 -
        thermalPenalty -
        Math.max(0, uv - 6) * 2,
    );
    if (!best || score > best.score)
      best = {
        start: group[0].time,
        end: group[2].time,
        score,
        rain,
        windSpeed,
        temp,
        uv,
      };
  }
  return best;
}
function renderPlannerPage() {
  const best = plannerWindow();
  const plans = readJSON("plans", []);
  const packing = readJSON("packing", []);
  root.innerHTML = `${pageHeading("PLAN WITH THE SKY", "Smart daily planner", `Weather-based timing suggestions for ${state.location.name}. Scores are transparent heuristics, not guarantees.`)}
    <section class="content-grid"><article class="panel planner-best"><div class="panel-heading"><div><h2>Suggested outdoor window</h2><p>Next 24 hours · 3-hour blocks</p></div><span class="panel-icon">${icon("sparkles")}</span></div>${best ? `<div class="planner-score">${Math.round(best.score)}<small>/100</small></div><h3>${displayTime(best.start)} – ${displayTime(best.end)}</h3><p class="small text-muted">This is the highest-scoring block under the current rule weights.</p><div class="stat-line"><span>Average rain probability</span><strong>${Math.round(best.rain)}%</strong></div><div class="stat-line"><span>Average wind</span><strong>${wind(best.windSpeed)}</strong></div><div class="stat-line"><span>Average temperature</span><strong>${temperature(best.temp)}</strong></div><div class="stat-line"><span>Average UV</span><strong>${safeNumber(best.uv, 1)}</strong></div>` : '<p class="text-muted">Hourly data unavailable.</p>'}</article>
    <article class="panel"><div class="panel-heading"><div><h2>Plan an event or trip</h2><p>Saved locally on this device</p></div><span class="panel-icon">${icon("calendar-check")}</span></div><form id="planForm" class="form-grid"><div class="field"><label for="planName">Plan name</label><input id="planName" required maxlength="60" placeholder="Weekend picnic"></div><div class="field"><label for="planDate">Date</label><input id="planDate" type="date" required min="${getLocalDateISO()}"></div><div class="field"><label for="planLocation">Location</label><input id="planLocation" maxlength="80" value="${escapeHTML(state.location.name)}" required></div><div class="field"><label for="planTime">Time</label><input id="planTime" type="time" value="10:00"></div><div class="field" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">${icon("plus")} Save weather plan</button></div></form></article></section>
    <section class="content-grid" style="margin-top:15px"><article class="panel"><div class="panel-heading"><h2>Saved plans</h2><span class="badge">${plans.length}</span></div><div id="savedPlans">${plans.length ? plans.map((plan) => `<div class="saved-plan"><div><strong>${escapeHTML(plan.name)}</strong><small>${escapeHTML(plan.location)} · ${escapeHTML(plan.date)} · ${escapeHTML(plan.time || "")}</small></div><button class="icon-button" data-action="delete-plan" data-id="${escapeHTML(plan.id)}" aria-label="Delete plan">${icon("trash")}</button></div>`).join("") : '<p class="text-muted small">Your saved trips and events will appear here.</p>'}</div></article>
    <article class="panel"><div class="panel-heading"><h2>Trip packing assistant</h2><span class="panel-icon">${icon("list-checks")}</span></div><p class="small text-muted">Create a starter checklist from the current forecast. Adjust it for your own trip.</p><button class="btn btn-ghost btn-small" data-action="generate-packing">Generate checklist</button><div class="packing-list" id="packingList">${packing.map((item, i) => `<label class="packing-item"><input type="checkbox" data-packing-index="${i}" ${item.done ? "checked" : ""}><span>${escapeHTML(item.label)}</span></label>`).join("") || '<p class="text-muted small">No checklist yet.</p>'}</div></article></section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><h2>How the recommendation works</h2><span class="panel-icon">${icon("info")}</span></div><p class="small text-soft">Each 3-hour block is scored using precipitation probability, wind speed, temperature distance from a configurable comfort reference, and UV. It is an informational planning aid only. It does not assess lightning risk, road conditions, medical needs, or official warnings.</p></section>`;
  hydrateIcons(root);
}

function renderFavoritesPage() {
  const isCurrentSaved = state.favorites.some(
    (f) =>
      Math.abs(f.latitude - state.location.latitude) < 0.001 &&
      Math.abs(f.longitude - state.location.longitude) < 0.001,
  );
  const recentMarkup = state.recent
    .map(
      (loc) =>
        `<button class="recent-item" data-action="open-city" data-lat="${loc.latitude}" data-lon="${loc.longitude}" data-name="${escapeHTML(loc.name)}" data-country="${escapeHTML(loc.country || "")}" data-tz="${escapeHTML(loc.timezone || "auto")}"><span class="recent-dot">${icon("map-pin")}</span><span><strong>${escapeHTML(loc.name)}</strong><small>${escapeHTML(loc.country || "")}</small></span>${icon("arrow-up-right")}</button>`,
    )
    .join("");
  root.innerHTML = `${pageHeading("YOUR PLACES", "Saved locations", "Keep the places you care about within reach.", '<button class="btn btn-primary" data-action="focus-search">' + icon("plus") + " Add location</button>")}
    <div class="content-grid three">${state.favorites.length ? state.favorites.map((loc) => `<article class="panel saved-city"><div class="saved-city-head"><span class="panel-icon">${icon("map-pin")}</span><button class="icon-button" data-action="remove-favorite" data-lat="${loc.latitude}" data-lon="${loc.longitude}" aria-label="Remove ${escapeHTML(loc.name)}">${icon("x")}</button></div><h3>${escapeHTML(loc.name)}</h3><p>${escapeHTML(loc.country || "")}</p><button class="btn btn-ghost btn-small" data-action="open-city" data-lat="${loc.latitude}" data-lon="${loc.longitude}" data-name="${escapeHTML(loc.name)}" data-country="${escapeHTML(loc.country || "")}" data-tz="${escapeHTML(loc.timezone || "auto")}">View weather ${icon("arrow-up-right")}</button></article>`).join("") : `<article class="panel" style="grid-column:1/-1"><div class="empty-state"><span class="empty-icon">${icon("heart")}</span><h3>${t("emptyFavorites")}</h3><p>${t("emptyFavoritesText")}</p><button class="btn btn-primary" data-action="favorite-current">${icon("plus")} Save current location</button></div></article>`}</div>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><div><h2>Recently viewed</h2><p>Your latest locations on this device</p></div><span class="badge">${state.recent.length}</span></div><div class="recent-list">${recentMarkup || '<p class="text-muted small">Recent searches will appear here.</p>'}</div></section>`;
  hydrateIcons(root);
}

async function renderJournalPage() {
  const photos = await getJournalPhotos().catch(() => []);
  root.innerHTML = `${pageHeading("PERSONAL COLLECTION", "Weather journal", "Save moments from the sky. Photos remain in this browser on this device.", '<button class="btn btn-primary" data-action="journal-upload">' + icon("plus") + " Add photo</button>")}
    <input type="file" id="journalFile" accept="image/*" hidden>
    <section class="panel"><div class="panel-heading"><div><h2>Your sky, remembered</h2><p>${photos.length} local photo${photos.length === 1 ? "" : "s"} · not uploaded to a server</p></div><span class="panel-icon">${icon("images")}</span></div>${photos.length ? `<div class="photo-grid">${photos.map((photo) => `<figure class="photo-card"><img src="${URL.createObjectURL(photo.blob)}" alt="${escapeHTML(photo.caption || "Weather journal photo")}" loading="lazy"><figcaption><strong>${escapeHTML(photo.caption || "Sky moment")}</strong><br><span>${new Date(photo.createdAt).toLocaleDateString(locale())}</span><button class="link-button" data-action="delete-photo" data-id="${escapeHTML(photo.id)}">Remove</button></figcaption></figure>`).join("")}</div>` : '<div class="empty-state"><span class="empty-icon">' + icon("images") + '</span><h3>No sky moments yet</h3><p>Add a photo to start your private weather journal.</p><button class="btn btn-primary" data-action="journal-upload">' + icon("plus") + " Add first photo</button></div>"}</section>
    <p class="source-line">Photos are stored in IndexedDB in this browser. Clearing site data may remove them. No image is sent to a third party by Skyvora.</p>`;
  hydrateIcons(root);
}

function renderSettingsPage() {
  root.innerHTML = `${pageHeading("MAKE IT YOURS", "Preferences", "Shape Skyvora around how you like to read the weather.")}
    <section class="content-grid"><article class="panel"><div class="panel-heading"><div><h2>Appearance</h2><p>Choose your visual environment</p></div><span class="panel-icon">${icon("sun")}</span></div><div class="field"><label for="themeSelect">Theme</label><select id="themeSelect"><option value="dark" ${state.theme === "dark" ? "selected" : ""}>Dark</option><option value="light" ${state.theme === "light" ? "selected" : ""}>Light</option><option value="system" ${state.theme === "system" ? "selected" : ""}>System</option><option value="weather" ${state.theme === "weather" ? "selected" : ""}>Weather reactive</option></select></div><div class="divider"></div><div class="toggle-row"><div class="toggle-copy"><strong>Reduce motion</strong><small>Prefer less decorative movement</small></div><label class="switch"><input type="checkbox" id="reduceMotion" ${getPreference("reduce-motion", "false") === "true" ? "checked" : ""}><span></span></label></div><div class="toggle-row"><div class="toggle-copy"><strong>High contrast</strong><small>Increase text and boundary contrast</small></div><label class="switch"><input type="checkbox" id="highContrast" ${getPreference("high-contrast", "false") === "true" ? "checked" : ""}><span></span></label></div></article>
    <article class="panel"><div class="panel-heading"><div><h2>Language & measurements</h2><p>Display preferences</p></div><span class="panel-icon">${icon("sliders-horizontal")}</span></div><div class="field"><label for="languageSelect">Language</label><select id="languageSelect"><option value="en" selected>English</option></select></div><div class="field" style="margin-top:12px"><label for="unitSelect">Temperature</label><select id="unitSelect"><option value="c" ${state.tempUnit === "c" ? "selected" : ""}>Celsius (°C)</option><option value="f" ${state.tempUnit === "f" ? "selected" : ""}>Fahrenheit (°F)</option></select></div><div class="field" style="margin-top:12px"><label for="windSelect">Wind speed</label><select id="windSelect"><option value="kmh" ${state.windUnit === "kmh" ? "selected" : ""}>Kilometers per hour</option><option value="mph" ${state.windUnit === "mph" ? "selected" : ""}>Miles per hour</option></select></div><div class="field" style="margin-top:12px"><label for="rainSelect">Precipitation</label><select id="rainSelect"><option value="mm" ${state.rainUnit === "mm" ? "selected" : ""}>Millimeters</option><option value="in" ${state.rainUnit === "in" ? "selected" : ""}>Inches</option></select></div><button class="btn btn-primary" style="margin-top:14px" data-action="save-settings">Save preferences</button></article></section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><div><h2>Install Skyvora</h2><p>Add the weather dashboard to your home screen when your browser supports installation.</p></div><span class="panel-icon">${icon("download")}</span></div><button class="btn btn-primary" id="installButtonSettings" data-action="install-pwa" ${state.installAvailable ? "" : "hidden"}>Install Skyvora</button><p class="source-line">The install option appears when this browser confirms that the app is installable.</p></section>
    <section class="content-grid" style="margin-top:15px"><article class="panel"><div class="panel-heading"><h2>Personal comfort profile</h2><span class="panel-icon">${icon("thermometer")}</span></div><form id="comfortForm" class="form-grid"><div class="field"><label for="comfortMin">Preferred minimum (°C)</label><input id="comfortMin" type="number" value="${readJSON("comfort", { min: 18, max: 28 }).min}" min="-20" max="50"></div><div class="field"><label for="comfortMax">Preferred maximum (°C)</label><input id="comfortMax" type="number" value="${readJSON("comfort", { min: 18, max: 28 }).max}" min="-20" max="50"></div><div class="field" style="grid-column:1/-1"><button class="btn btn-ghost" type="submit">Save comfort profile</button></div></form></article><article class="panel"><div class="panel-heading"><h2>Notifications</h2><span class="panel-icon">${icon("bell")}</span></div><p class="small text-muted">Browser notifications work while this app is open and checks the weather. Background push delivery is not configured in this project.</p><button class="btn btn-primary" data-action="enable-notifications">Enable browser notifications</button><p class="source-line">Permission: ${"Notification" in window ? Notification.permission : "unsupported"}</p></article></section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><h2>Data & privacy</h2><span class="panel-icon">${icon("shield-check")}</span></div><p class="small text-soft">Favorites, recent searches, and preferences are stored locally in this browser. Weather requests are proxied through the Skyvora backend. If MongoDB is configured, the backend caches provider responses and records non-personal API performance metrics.</p><button class="btn btn-ghost btn-small" data-action="clear-local">Clear local Skyvora data</button></section>`;
  hydrateIcons(root);
}

function renderIntelligencePage() {
  const c = current();
  const insights = buildInsights(c, nextHours(24), dailyRows());
  root.innerHTML = `${pageHeading("SKYVORA INTELLIGENCE", "Weather, made understandable", `A transparent interpretation of the weather data for ${state.location.name}.`)}
    <section class="hero-intelligence"><div><span class="badge info">${icon("sparkles")} Forecast-powered insights</span><h2>Read the atmosphere,<br><em>not just the numbers.</em></h2><p>${escapeHTML(skySummary(c, nextHours(24)))}</p><span class="small text-muted">This release uses deterministic, rule-based insights — it is not connected to a generative AI model.</span></div><div class="intelligence-orb">${icon("cloud-sun")}</div></section>
    <section class="content-grid three" style="margin-top:15px">${insights.map((item) => `<article class="panel"><span class="panel-icon">${icon(item.icon)}</span><h3 class="insight-title">${escapeHTML(item.title)}</h3><p class="small text-muted">${escapeHTML(item.text)}</p></article>`).join("")}</section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><div><h2>Ask about your forecast</h2><p>Answers use only the current weather and available forecast fields.</p></div><span class="badge">Rule-based</span></div><form id="weatherQuestionForm" class="question-form"><input id="weatherQuestion" type="text" maxlength="180" placeholder="e.g. Will it rain today?" aria-label="Ask a weather question"><button class="btn btn-primary ask-weather-button" type="submit" aria-label="Ask about this forecast"><span>Ask</span>${icon("arrow-right")}</button></form><div id="weatherAnswer" class="weather-answer" hidden></div></section>`;
  hydrateIcons(root);
}

function answerWeatherQuestion(question) {
  const q = question.toLowerCase();
  const c = current();
  const h = nextHours(24);
  const d = dailyRows();
  if (/rain|بارش/.test(q)) {
    const peak = h.reduce(
      (best, item) =>
        (item.precipitation_probability ?? -1) >
        (best?.precipitation_probability ?? -1)
          ? item
          : best,
      null,
    );
    return peak && Number.isFinite(peak.precipitation_probability)
      ? `The highest precipitation probability in the next 24 hours is ${Math.round(peak.precipitation_probability)}% around ${displayTime(peak.time)}. The forecast is not a guarantee.`
      : "Rain probability is not available in the current hourly response.";
  }
  if (/tomorrow|کل|warmer|cooler/.test(q)) {
    if (!d[1]) return "Tomorrow’s forecast is unavailable.";
    const difference = d[1].temperature_2m_max - d[0].temperature_2m_max;
    return `Tomorrow’s high is forecast at ${temperature(d[1].temperature_2m_max)}, compared with ${temperature(d[0].temperature_2m_max)} today. That is about ${Math.abs(Math.round(difference))}° ${difference > 0 ? "warmer" : difference < 0 ? "cooler" : "similar"}.`;
  }
  if (/wind|ہوا/.test(q))
    return `Current wind is ${wind(c.wind_speed_10m)} from ${direction(c.wind_direction_10m)} (${Math.round(c.wind_direction_10m || 0)}°). Gusts are ${wind(c.wind_gusts_10m)}.`;
  if (/outside|outdoor|باہر/.test(q)) {
    const slot = plannerWindow();
    return slot
      ? `The highest-scoring 3-hour block in this simple planner is ${displayTime(slot.start)}–${displayTime(slot.end)}. Its score is ${Math.round(slot.score)}/100 based on rain probability, wind, temperature and UV. This is not a safety assessment.`
      : "There is not enough hourly data to suggest a time window.";
  }
  return `${state.location.name} is currently ${condition(c.weather_code).label.toLowerCase()} at ${temperature(c.temperature_2m)}, with humidity of ${safeNumber(c.relative_humidity_2m)}% and wind at ${wind(c.wind_speed_10m)}. ${skySummary(c, h)}`;
}

async function renderAlertsPage() {
  const rules = readJSON("alert-rules", []);
  root.innerHTML = `${pageHeading("WEATHER ALERTS", "Alert centre", "Official warnings are shown only when a verified alert provider is configured.")}
    <div class="inline-notice">${icon("alert")}<span>No official severe-weather alert API is configured in this build. This is not confirmation that no warnings exist. Check your local meteorological authority for current official advisories.</span></div>
    <section class="content-grid" style="margin-top:15px"><article class="panel"><div class="panel-heading"><div><h2>Official sources</h2><p>Pakistan meteorological information</p></div><span class="panel-icon">${icon("shield-check")}</span></div><div class="official-link"><strong>Pakistan Meteorological Department</strong><a href="https://weather.gov.pk/" target="_blank" rel="noopener noreferrer">Open official website ${icon("arrow-up-right")}</a></div><div class="divider"></div><div class="official-link"><strong>Flood Forecasting Division</strong><a href="https://ffd.pmd.gov.pk/" target="_blank" rel="noopener noreferrer">Open official website ${icon("arrow-up-right")}</a></div></article>
    <article class="panel"><div class="panel-heading"><div><h2>Your custom thresholds</h2><p>Browser checks when the app is open</p></div><span class="panel-icon">${icon("bell")}</span></div><form id="alertRuleForm" class="form-grid"><div class="field"><label for="alertType">Condition</label><select id="alertType"><option value="rain">Rain probability</option><option value="heat">Temperature</option><option value="wind">Wind speed</option></select></div><div class="field"><label for="alertThreshold">Threshold</label><input id="alertThreshold" type="number" value="60" min="1" max="200" required></div><div class="field" style="grid-column:1/-1"><button type="submit" class="btn btn-primary">Add alert rule</button></div></form><div class="saved-rules">${rules.map((rule) => `<div class="saved-plan"><div><strong>${escapeHTML(rule.label)}</strong><small>Threshold: ${rule.threshold}</small></div><button class="icon-button" data-action="delete-rule" data-id="${rule.id}" aria-label="Delete alert rule">${icon("trash")}</button></div>`).join("") || '<p class="small text-muted">No custom rules configured.</p>'}</div></article></section>`;
  hydrateIcons(root);
}

function renderPakistanPage() {
  root.innerHTML = `${pageHeading("REGIONAL WEATHER", "Pakistan weather centre", "A Pakistan-focused entry point for official meteorological information and Skyvora forecasts.")}
    <section class="pakistan-hero"><div><span class="badge info">PAKISTAN · REGIONAL VIEW</span><h2>Local weather deserves<br>a closer look.</h2><p>Use Skyvora for location-based model forecasts, and open official agencies for warnings and bulletins.</p></div><div class="pakistan-mark">${icon("map-pin")}</div></section>
    <section class="content-grid three" style="margin-top:15px">${featureTile("cloud-sun-rain", "Monsoon monitoring", "Review rainfall forecasts and official seasonal bulletins.", "forecast")}${featureTile("thermometer_sun", "Heat & temperature", "Review current temperatures, daily highs and UV conditions.", "dashboard")}${featureTile("waves", "Flood information", "Open the official Flood Forecasting Division website.", "alerts")}</section>
    <section class="content-grid" style="margin-top:15px"><article class="panel"><div class="panel-heading"><h2>Official agencies</h2><span class="badge good">External official links</span></div><div class="official-link"><strong>Pakistan Meteorological Department (PMD)</strong><a href="https://weather.gov.pk/" target="_blank" rel="noopener noreferrer">Weather forecasts & advisories ${icon("arrow-up-right")}</a></div><div class="divider"></div><div class="official-link"><strong>Flood Forecasting Division (FFD)</strong><a href="https://ffd.pmd.gov.pk/" target="_blank" rel="noopener noreferrer">Flood information ${icon("arrow-up-right")}</a></div></article><article class="panel"><div class="panel-heading"><h2>Data availability</h2><span class="panel-icon">${icon("database")}</span></div><p class="small text-muted">This version does not have an authorized machine-readable PMD/FFD alert feed configured. Official links are provided instead of fabricated district warnings, cyclone tracks or flood maps.</p><p class="small text-muted">Skyvora forecast values are provided by Open-Meteo and should not be treated as official government warnings.</p></article></section>`;
  hydrateIcons(root);
}

function renderDiagnosticsPage() {
  const items = state.diagnostics;
  root.innerHTML = `${pageHeading("SYSTEM HEALTH", "API & data diagnostics", "Operational telemetry for this browser session and the configured backend. No private secrets are exposed.", '<button class="btn" data-action="refresh-health">' + icon("refresh") + " Check services</button>")}
    <section class="content-grid three"><article class="metric-card"><span class="mini-label">BACKEND</span><strong class="metric-value" id="diagBackend">Checking</strong><div class="metric-caption">Express API response</div></article><article class="metric-card"><span class="mini-label">DATABASE</span><strong class="metric-value" id="diagDatabase">Unknown</strong><div class="metric-caption">MongoDB connection</div></article><article class="metric-card"><span class="mini-label">WEATHER CACHE</span><strong class="metric-value" id="diagCache">—</strong><div class="metric-caption">Current browser data</div></article></section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><div><h2>Recent client requests</h2><p>Performance samples from this session</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Service</th><th>Status</th><th>Duration</th><th>Time</th></tr></thead><tbody>${items.map((item) => `<tr><td>${escapeHTML(item.name)}</td><td><span class="badge ${item.status === "success" ? "good" : "warn"}">${escapeHTML(item.status)}</span></td><td>${item.duration} ms</td><td>${new Date(item.time).toLocaleTimeString(locale())}</td></tr>`).join("") || '<tr><td colspan="4">No request samples yet.</td></tr>'}</tbody></table></div></section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><h2>Provider configuration</h2><span class="badge info">Open-Meteo</span></div><div class="stat-line"><span>Forecast provider</span><strong>Open-Meteo Forecast API</strong></div><div class="stat-line"><span>Geocoding provider</span><strong>Open-Meteo Geocoding API</strong></div><div class="stat-line"><span>Air-quality provider</span><strong>Open-Meteo Air Quality API</strong></div><div class="stat-line"><span>Official alerts</span><strong>Not configured</strong></div><div class="stat-line"><span>Weather radar</span><strong>Not configured</strong></div><div class="stat-line"><span>AI provider</span><strong>Not configured · rule-based insights active</strong></div></section>`;
  hydrateIcons(root);
  api
    .health()
    .then((health) => {
      $("#diagBackend").textContent = "Online";
      $("#diagDatabase").textContent = health.database;
      $("#diagCache").textContent = state.dataCached ? "Cached" : "Fresh";
    })
    .catch(() => {
      $("#diagBackend").textContent = "Offline";
      $("#diagDatabase").textContent = "Unknown";
    });
}

function renderEducationPage() {
  const concepts = [
    [
      "Feels-like temperature",
      "An estimate of how warm or cool conditions may feel, influenced by factors such as wind and humidity.",
    ],
    [
      "Dew point",
      "The temperature at which air would become saturated if cooled at constant pressure. Higher dew points often indicate more moisture in the air.",
    ],
    [
      "Precipitation probability",
      "The chance of measurable precipitation for the forecast period and location, as defined by the provider.",
    ],
    [
      "UV index",
      "A scale describing the strength of ultraviolet radiation at the Earth’s surface.",
    ],
    [
      "AQI",
      "An index that translates pollutant concentrations into categories under a specific national or regional standard.",
    ],
    [
      "Atmospheric pressure",
      "The force exerted by the weight of air above a location. Pressure patterns can help describe weather systems.",
    ],
    [
      "Visibility",
      "The distance at which objects can be clearly distinguished in the atmosphere.",
    ],
    [
      "Forecast uncertainty",
      "Weather predictions become less certain further into the future and can change as new observations and model runs arrive.",
    ],
  ];
  root.innerHTML = `${pageHeading("LEARN THE LANGUAGE OF WEATHER", "Weather education centre", "Short, practical explanations to help make sense of the numbers.")}
    <section class="content-grid two">${concepts.map(([title, text]) => `<article class="panel education-card"><span class="panel-icon">${icon("book-open")}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(text)}</p></article>`).join("")}</section>`;
  hydrateIcons(root);
}

async function renderView(view) {
  state.view = view;
  syncWeatherBackdrop();
  // Keep the reference-inspired visual shell active across every route.
  document.body.classList.add("dashboard-view");
  document.body.classList.toggle("reference-subpage", view !== "dashboard");
  $$(".nav-link, .mobile-nav-item").forEach((node) =>
    node.classList.toggle("active", node.dataset.view === view),
  );
  const labels = {
    dashboard: "Dashboard",
    forecast: "Forecast",
    maps: "Weather maps",
    air: "Air quality",
    compare: "City comparison",
    history: "Historical weather",
    marine: "Marine forecast",
    planner: "Smart planner",
    favorites: "Saved places",
    journal: "Weather journal",
    settings: "Preferences",
    intelligence: "Skyvora Intelligence",
    alerts: "Alert centre",
    pakistan: "Pakistan centre",
    diagnostics: "System diagnostics",
    education: "Weather education",
  };
  $("#pageTitle").textContent = labels[view] || "Skyvora";
  if (!state.weather && view !== "settings" && view !== "journal") {
    await loadWeather(state.location);
    return;
  }
  switch (view) {
    case "dashboard":
      renderDashboard();
      break;
    case "forecast":
      renderForecastPage();
      break;
    case "maps":
      await renderMapPage();
      break;
    case "air":
      renderAirPage();
      break;
    case "compare":
      await renderComparePage();
      break;
    case "history":
      renderHistoryPage();
      break;
    case "marine":
      await renderMarinePage();
      break;
    case "planner":
      renderPlannerPage();
      break;
    case "favorites":
      renderFavoritesPage();
      break;
    case "journal":
      await renderJournalPage();
      break;
    case "settings":
      renderSettingsPage();
      break;
    case "intelligence":
      renderIntelligencePage();
      break;
    case "alerts":
      await renderAlertsPage();
      break;
    case "pakistan":
      renderPakistanPage();
      break;
    case "diagnostics":
      renderDiagnosticsPage();
      break;
    case "education":
      renderEducationPage();
      break;
    default:
      renderDashboard();
  }
  root.focus({ preventScroll: true });
}
function render() {
  const view = state.view;
  if (view === "dashboard") renderDashboard();
  else renderView(view);
}
function navigate(view) {
  if (!view) return;
  const sidebar = $("#sidebar");
  sidebar?.classList.remove("open");
  $("#menuToggle")?.setAttribute("aria-expanded", "false");
  if (state.view === view) {
    render();
    return;
  }
  renderView(view);
  history.replaceState(null, "", `#${view}`);
}

function positionSearchResults() {
  if (searchResults.hidden || !searchInput.isConnected) return;
  const rect = searchInput.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportWidth = viewport?.width || document.documentElement.clientWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const viewportOffsetLeft = viewport?.offsetLeft || 0;
  const viewportOffsetTop = viewport?.offsetTop || 0;
  const mobile = viewportWidth <= 600;
  const gutter = mobile ? 12 : 16;
  const width = mobile
    ? Math.max(0, viewportWidth - gutter * 2)
    : Math.min(Math.max(rect.width, 340), viewportWidth - gutter * 2, 620);
  const left = mobile
    ? viewportOffsetLeft + gutter
    : Math.max(
        viewportOffsetLeft + gutter,
        Math.min(
          rect.left,
          viewportOffsetLeft + viewportWidth - width - gutter,
        ),
      );
  const top = Math.max(viewportOffsetTop + 8, rect.bottom + 8);
  searchResults.style.position = "fixed";
  searchResults.style.top = `${top}px`;
  searchResults.style.left = `${left}px`;
  searchResults.style.right = "auto";
  searchResults.style.width = `${width}px`;
  searchResults.style.minWidth = "0";
  searchResults.style.maxWidth = `calc(100vw - ${gutter * 2}px)`;
  searchResults.style.maxHeight = `${Math.max(160, Math.min(mobile ? 480 : 560, viewportHeight - (top - viewportOffsetTop) - gutter))}px`;
  searchResults.style.zIndex = "9999";
}

function setSearchPanel(markup, expanded = true) {
  searchResults.innerHTML = markup;
  searchResults.hidden = false;
  searchInput.setAttribute("aria-expanded", String(expanded));
  positionSearchResults();
}

function searchOptionMarkup(item, index, sourceLabel = "") {
  const flag = countryFlagEmoji(item.country_code);
  const region = [item.admin1, item.admin2]
    .filter(Boolean)
    .filter((value, i, values) => values.indexOf(value) === i)
    .join(", ");
  const placeMeta = [region, item.country]
    .filter(Boolean)
    .filter((value, i, values) => values.indexOf(value) === i)
    .join(" · ");
  const type =
    item.feature_code === "COORD"
      ? "Coordinate pin"
      : locationKind(item.feature_code);
  const population = formatPopulation(item.population);
  const timezone =
    item.timezone && item.timezone !== "auto" ? item.timezone : "";
  const secondary = [type, population, timezone, sourceLabel]
    .filter(Boolean)
    .join("  ·  ");
  return `<button class="search-result worldwide-search-result" id="search-option-${index}" type="button" role="option" aria-selected="false" data-search-index="${index}">
    <span class="search-result-flag" aria-hidden="true">${escapeHTML(flag)}</span>
    <span class="search-result-copy"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(placeMeta || "Location result")}</small><small class="search-result-detail">${escapeHTML(secondary)}</small></span>
    <span class="search-result-action" aria-hidden="true">${icon("arrow-up-right")}</span>
  </button>`;
}

function renderSearchStartPanel() {
  clearTimeout(state.searchTimer);
  state.searchTimer = null;
  state.searchController?.abort();
  state.searchController = null;
  state.searchLoading = false;
  state.searchIndex = -1;
  const recent = state.recent.slice(0, 5);
  const favoriteKeys = new Set(
    state.favorites.map(
      (item) =>
        `${Number(item.latitude).toFixed(4)}:${Number(item.longitude).toFixed(4)}`,
    ),
  );
  const saved = state.favorites.slice(0, 4);
  const quickItems = [];
  const seen = new Set();
  for (const item of [...saved, ...recent]) {
    const key = `${Number(item.latitude).toFixed(4)}:${Number(item.longitude).toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    quickItems.push({
      ...item,
      feature_code: item.feature_code || "",
      population: item.population || null,
      timezone: item.timezone || "auto",
    });
  }
  state.searchResults = quickItems;
  let markup = `<div class="search-results-head"><div><span class="search-results-kicker">WORLDWIDE LOCATION SEARCH</span><strong>Where would you like to go?</strong></div><span class="search-global-badge">GLOBAL</span></div>`;
  if (saved.length) {
    const indexes = quickItems
      .map((item, index) =>
        favoriteKeys.has(
          `${Number(item.latitude).toFixed(4)}:${Number(item.longitude).toFixed(4)}`,
        )
          ? index
          : -1,
      )
      .filter((index) => index >= 0);
    if (indexes.length)
      markup += `<div class="search-group-label">SAVED PLACES</div><div class="search-results-list">${indexes.map((index) => searchOptionMarkup(quickItems[index], index, "Saved")).join("")}</div>`;
  }
  const recentIndexes = quickItems
    .map((item, index) =>
      recent.some(
        (entry) =>
          Math.abs(Number(entry.latitude) - Number(item.latitude)) < 0.00001 &&
          Math.abs(Number(entry.longitude) - Number(item.longitude)) < 0.00001,
      ) &&
      !favoriteKeys.has(
        `${Number(item.latitude).toFixed(4)}:${Number(item.longitude).toFixed(4)}`,
      )
        ? index
        : -1,
    )
    .filter((index) => index >= 0);
  if (recentIndexes.length)
    markup += `<div class="search-group-label">RECENTLY VIEWED</div><div class="search-results-list">${recentIndexes.map((index) => searchOptionMarkup(quickItems[index], index, "Recent")).join("")}</div>`;
  if (!quickItems.length)
    markup += `<div class="search-discovery"><span class="search-discovery-icon">${icon("map")}</span><strong>Explore weather around the world</strong><p>Find cities, regions and places across countries. Search by city name, “city, country”, postal code or coordinates.</p><div class="search-example-chips"><span>Tokyo, Japan</span><span>London, UK</span><span>10001</span><span>33.6844, 73.0479</span></div></div>`;
  markup += `<button class="search-use-location" type="button" data-action="locate">${icon("crosshair")}<span><strong>Use my current location</strong><small>Find weather wherever you are</small></span>${icon("arrow-up-right")}</button>`;
  setSearchPanel(markup);
  hydrateIcons(searchResults);
}

function showSearchMessage(title, description, action = "") {
  const retry =
    action === "retry"
      ? `<button class="search-retry-button" type="button" data-action="retry-search">${icon("refresh")} Try again</button>`
      : "";
  setSearchPanel(
    `<div class="search-empty-state"><span class="search-empty-icon">${icon(action === "retry" ? "cloud-off" : "map-pin")}</span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(description)}</p>${retry}</div>`,
  );
  hydrateIcons(searchResults);
}

async function searchLocations(query) {
  const term = String(query || "").trim();
  clearTimeout(state.searchTimer);
  state.searchController?.abort();
  state.searchController = null;
  state.searchLoading = false;
  state.searchIndex = -1;
  if (!term) {
    renderSearchStartPanel();
    return;
  }
  if (term.length < 2) {
    state.searchResults = [];
    showSearchMessage(
      "Keep typing",
      "Enter at least 2 characters to search worldwide locations.",
    );
    return;
  }

  const coordinate = parseCoordinateQuery(term);
  if (coordinate) {
    state.searchResults = [coordinate];
    setSearchPanel(
      `<div class="search-results-head"><div><span class="search-results-kicker">COORDINATE SEARCH</span><strong>Exact map coordinates found</strong></div><span class="search-global-badge">PIN</span></div><div class="search-results-list">${searchOptionMarkup(coordinate, 0, "Latitude / longitude")}</div><div class="search-results-foot">Select this coordinate to load weather for the exact point.</div>`,
    );
    hydrateIcons(searchResults);
    return;
  }

  const controller = new AbortController();
  state.searchController = controller;
  state.searchLoading = true;
  state.searchResults = [];
  setSearchPanel(
    `<div class="search-loading search-loading-premium"><span class="loader-ring"></span><span><strong>Searching worldwide locations</strong><small>Matching cities, regions, countries and postal codes…</small></span><span class="search-loading-pulse"></span></div>`,
  );

  try {
    const payload = await api.search(term, "en", {
      count: CONFIG.searchResultCount,
      signal: controller.signal,
    });
    if (controller.signal.aborted || searchInput.value.trim() !== term) return;
    const results = rankLocationResults(
      payload?.data?.results || [],
      term,
    ).slice(0, CONFIG.searchResultCount);
    state.searchResults = results;
    state.searchIndex = -1;
    if (!results.length) {
      showSearchMessage(
        "No matching places found",
        "Try a city with its country (for example, “Paris, France”), a region or a supported postal code.",
      );
      return;
    }
    const countLabel = `${results.length} ${results.length === 1 ? "match" : "matches"}`;
    const markup = `<div class="search-results-head"><div><span class="search-results-kicker">GLOBAL LOCATION MATCHES</span><strong>${countLabel} for “${escapeHTML(term)}”</strong></div><span class="search-global-badge">WORLDWIDE</span></div><div class="search-results-list">${results.map((item, index) => searchOptionMarkup(item, index)).join("")}</div><div class="search-results-foot">Location search by GeoNames via Open-Meteo · Add a country to narrow similar city names.</div>`;
    setSearchPanel(markup);
    hydrateIcons(searchResults);
  } catch (error) {
    const timeoutFailure =
      error.name === "TimeoutError" ||
      controller.signal.reason?.name === "TimeoutError";
    if (
      (controller.signal.aborted && !timeoutFailure) ||
      (error.name === "AbortError" && !timeoutFailure)
    )
      return;
    if (searchInput.value.trim() !== term) return;
    state.searchResults = [];
    showSearchMessage(
      timeoutFailure
        ? "Search is taking too long"
        : "Location search is temporarily unavailable",
      timeoutFailure
        ? "The worldwide location service did not respond in time. Try again."
        : error.message || "Check your connection and try again.",
      "retry",
    );
  } finally {
    if (state.searchController === controller) state.searchController = null;
    state.searchLoading = false;
  }
}

function hideSearchResults({ abort = true } = {}) {
  clearTimeout(state.searchTimer);
  state.searchTimer = null;
  if (abort) state.searchController?.abort();
  state.searchController = null;
  state.searchLoading = false;
  searchResults.hidden = true;
  searchResults.innerHTML = "";
  searchResults.removeAttribute("style");
  searchInput.setAttribute("aria-expanded", "false");
  searchInput.removeAttribute("aria-activedescendant");
  state.searchResults = [];
  state.searchIndex = -1;
}

async function chooseLocation(location) {
  state.searchController?.abort();
  state.location = location;
  hideSearchResults();
  searchInput.value = "";
  $("#searchClear").hidden = true;
  document.activeElement?.blur?.();
  state.weather = null;
  await loadWeather(location);
  navigate("dashboard");
}
async function locateCurrentUser() {
  if (!("geolocation" in navigator)) {
    toast("Geolocation is not supported by this browser.", "error");
    return;
  }
  toast("Requesting your location…", "info");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      await chooseLocation({
        name: "Current location",
        country: "",
        latitude,
        longitude,
        timezone: "auto",
      });
    },
    (error) => {
      const messages = {
        1: "Location permission was denied. Search for a city instead.",
        2: "Your location could not be determined.",
        3: "Location request timed out.",
      };
      toast(messages[error.code] || "Could not access your location.", "error");
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}
function addFavorite(location = state.location) {
  const key = (item) =>
    `${Number(item.latitude).toFixed(3)},${Number(item.longitude).toFixed(3)}`;
  if (state.favorites.some((item) => key(item) === key(location))) {
    toast("This location is already saved.", "info");
    return;
  }
  if (state.favorites.length >= CONFIG.maxFavorites) {
    toast(`You can save up to ${CONFIG.maxFavorites} locations.`, "error");
    return;
  }
  state.favorites = [
    {
      name: location.name,
      country: location.country,
      admin1: location.admin1,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
    },
    ...state.favorites,
  ];
  writeJSON("favorites", state.favorites);
  toast(`${location.name} added to saved places.`);
  if (state.view === "dashboard") renderDashboard();
}
function removeFavorite(latitude, longitude) {
  state.favorites = state.favorites.filter(
    (item) =>
      !(
        Math.abs(item.latitude - latitude) < 0.001 &&
        Math.abs(item.longitude - longitude) < 0.001
      ),
  );
  writeJSON("favorites", state.favorites);
  toast("Location removed from saved places.");
  renderFavoritesPage();
}
function toggleFavorite() {
  const exists = state.favorites.some(
    (item) =>
      Math.abs(item.latitude - state.location.latitude) < 0.001 &&
      Math.abs(item.longitude - state.location.longitude) < 0.001,
  );
  if (exists) removeFavorite(state.location.latitude, state.location.longitude);
  else addFavorite();
  if (state.view === "dashboard") renderDashboard();
}
function shareWeather() {
  const c = current();
  if (!c) return;
  const text = `Skyvora Weather · ${state.location.name}\n${condition(c.weather_code).label} · ${temperature(c.temperature_2m)}\nFeels like ${temperature(c.apparent_temperature)} · Wind ${wind(c.wind_speed_10m)} · Humidity ${safeNumber(c.relative_humidity_2m)}%\nUpdated ${state.weather?.current?.time || ""}\nData: Open-Meteo`;
  if (navigator.share) {
    navigator
      .share({ title: `Skyvora Weather · ${state.location.name}`, text })
      .catch(() => {});
  } else if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast("Weather summary copied."))
      .catch(() => toast("Could not copy the summary.", "error"));
  } else {
    toast("Sharing is not supported in this browser.", "info");
  }
}
function exportHistoryCSV() {
  const data = state.history?.data;
  if (!data?.daily?.time) {
    toast("Load historical data before exporting.", "info");
    return;
  }
  const d = data.daily;
  const rows = [
    [
      "date",
      "max_temperature_c",
      "min_temperature_c",
      "precipitation_mm",
      "max_wind_kmh",
      "weather_code",
    ],
  ];
  d.time.forEach((date, i) =>
    rows.push([
      date,
      d.temperature_2m_max?.[i] ?? "",
      d.temperature_2m_min?.[i] ?? "",
      d.precipitation_sum?.[i] ?? "",
      d.wind_speed_10m_max?.[i] ?? "",
      d.weather_code?.[i] ?? "",
    ]),
  );
  const csv = rows
    .map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    )
    .join("\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `skyvora-history-${state.history.start}.csv`,
  );
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function savePlan(form) {
  const plans = readJSON("plans", []);
  const plan = {
    id: crypto.randomUUID(),
    name: $("#planName").value.trim(),
    date: $("#planDate").value,
    location: $("#planLocation").value.trim(),
    time: $("#planTime").value,
    createdAt: Date.now(),
  };
  if (!plan.name || !plan.date || !plan.location) return;
  plans.unshift(plan);
  writeJSON("plans", plans.slice(0, 30));
  toast("Your weather plan was saved on this device.");
  renderPlannerPage();
}
function deletePlan(id) {
  writeJSON(
    "plans",
    readJSON("plans", []).filter((item) => item.id !== id),
  );
  toast("Plan removed.");
  renderPlannerPage();
}
function generatePackingList() {
  const c = current();
  const tomorrow = dailyRows()[1] || dailyRows()[0];
  const items = ["Phone and charger", "Wallet and essentials", "Water bottle"];
  if ((tomorrow?.precipitation_probability_max ?? 0) >= 35)
    items.push("Umbrella or rain layer");
  if (
    (tomorrow?.temperature_2m_max ?? 25) >= 30 ||
    (nextHours(1)[0]?.uv_index ?? 0) >= 6
  )
    items.push("Sun hat or shade cover");
  if ((tomorrow?.temperature_2m_min ?? 20) <= 12) items.push("Warm layer");
  if ((c?.wind_speed_10m ?? 0) >= 25) items.push("Wind-resistant outer layer");
  writeJSON(
    "packing",
    items.map((label) => ({ label, done: false })),
  );
  toast("A starter packing list was generated from the forecast.");
  renderPlannerPage();
}
async function uploadJournalPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast("Choose an image file.", "error");
    return;
  }
  if (file.size > 6 * 1024 * 1024) {
    toast("Image must be 6 MB or smaller.", "error");
    return;
  }
  const caption =
    window.prompt(
      "Add a short caption (optional):",
      `${state.location.name} · ${condition(current()?.weather_code).label}`,
    ) || "";
  try {
    await saveJournalPhoto({
      id: crypto.randomUUID(),
      blob: file,
      caption: caption.slice(0, 100),
      createdAt: Date.now(),
      location: state.location.name,
    });
    toast("Photo saved privately in this browser.");
    await renderJournalPage();
  } catch (error) {
    toast(`Could not save photo: ${error.message}`, "error");
  }
}
async function enableNotifications() {
  const { requestNotificationPermission } =
    await import("./services/notifications.js");
  const permission = await requestNotificationPermission();
  if (permission === "granted")
    toast("Browser notifications enabled. Checks run while Skyvora is open.");
  else
    toast(
      permission === "denied"
        ? "Notifications are blocked in browser settings."
        : "Notifications are not supported here.",
      "info",
    );
}
function saveAlertRule(form) {
  const type = $("#alertType").value;
  const threshold = Number($("#alertThreshold").value);
  if (!Number.isFinite(threshold)) return;
  const limits = { rain: [1, 100], heat: [-30, 60], wind: [1, 250] }[type];
  if (threshold < limits[0] || threshold > limits[1]) {
    toast(`Threshold must be between ${limits[0]} and ${limits[1]}.`, "error");
    return;
  }
  const unit = type === "rain" ? "%" : type === "heat" ? "°C" : "km/h";
  const labels = {
    rain: "Rain probability",
    heat: "Temperature",
    wind: "Wind speed",
  };
  const rules = readJSON("alert-rules", []);
  rules.push({
    id: crypto.randomUUID(),
    type,
    threshold,
    label: `${labels[type]} ≥ ${threshold}${unit}`,
    enabled: true,
  });
  writeJSON("alert-rules", rules.slice(-12));
  toast("Custom weather threshold saved.");
  renderAlertsPage();
}
function saveSettings() {
  const theme = $("#themeSelect")?.value || state.theme;
  const language = "en";
  state.tempUnit = $("#unitSelect")?.value || state.tempUnit;
  state.windUnit = $("#windSelect")?.value || state.windUnit;
  state.rainUnit = $("#rainSelect")?.value || state.rainUnit;
  setPreference("temp-unit", state.tempUnit);
  setPreference("wind-unit", state.windUnit);
  setPreference("rain-unit", state.rainUnit);
  setTheme(theme);
  if (language !== state.language) setLanguage(language);
  const reduceMotion = $("#reduceMotion")?.checked;
  const highContrast = $("#highContrast")?.checked;
  setPreference("reduce-motion", reduceMotion);
  setPreference("high-contrast", highContrast);
  document.documentElement.classList.toggle(
    "reduce-motion",
    Boolean(reduceMotion),
  );
  document.documentElement.classList.toggle(
    "high-contrast",
    Boolean(highContrast),
  );
  toast("Preferences saved.");
  render();
}

function handleAction(button) {
  const action = button.dataset.action;
  if (action === "refresh") loadWeather(state.location);
  else if (action === "favorite" || action === "favorite-current")
    toggleFavorite();
  else if (action === "share") shareWeather();
  else if (action === "locate") locateCurrentUser();
  else if (action === "focus-search") {
    const sidebar = $("#sidebar");
    sidebar?.classList.remove("open");
    $("#menuToggle")?.setAttribute("aria-expanded", "false");
    requestAnimationFrame(() => {
      searchInput.focus({ preventScroll: true });
      positionSearchResults();
    });
  } else if (action === "retry-search") searchLocations(searchInput.value);
  else if (action === "cycle-theme") {
    const next = state.theme === "dark" ? "light" : "dark";
    setTheme(next);
    toast(`${next === "dark" ? "Dark" : "Light"} theme enabled.`);
  } else if (action === "remove-favorite")
    removeFavorite(Number(button.dataset.lat), Number(button.dataset.lon));
  else if (action === "open-city")
    chooseLocation({
      name: button.dataset.name,
      country: button.dataset.country,
      latitude: Number(button.dataset.lat),
      longitude: Number(button.dataset.lon),
      timezone: button.dataset.tz || "auto",
    });
  else if (action === "load-history")
    loadHistory($("#historyStart").value, $("#historyEnd").value);
  else if (action === "export-history") exportHistoryCSV();
  else if (action === "delete-plan") deletePlan(button.dataset.id);
  else if (action === "generate-packing") generatePackingList();
  else if (action === "journal-upload") $("#journalFile")?.click();
  else if (action === "delete-photo")
    deleteJournalPhoto(button.dataset.id)
      .then(() => renderJournalPage())
      .then(() => toast("Photo removed."))
      .catch(() => toast("Could not remove photo.", "error"));
  else if (action === "enable-notifications") enableNotifications();
  else if (action === "delete-rule") {
    writeJSON(
      "alert-rules",
      readJSON("alert-rules", []).filter(
        (item) => item.id !== button.dataset.id,
      ),
    );
    renderAlertsPage();
    toast("Alert rule removed.");
  } else if (action === "save-settings") saveSettings();
  else if (action === "clear-local") clearLocalData();
  else if (action === "refresh-health") renderDiagnosticsPage();
  else if (action === "install-pwa") {
    if (!triggerInstallPrompt) {
      toast(
        "Installation is not available in this browser yet. Use the browser menu and choose Install app or Add to Home screen.",
        "info",
      );
    } else {
      triggerInstallPrompt()
        .then((accepted) => {
          if (accepted) toast("Skyvora installation started.");
          else
            toast(
              "Installation was not completed. You can install Skyvora later from the browser menu.",
              "info",
            );
        })
        .catch((error) => {
          console.warn("[pwa] Install prompt failed:", error.message);
          toast(
            "The browser could not open the install prompt. Try its Install app menu.",
            "error",
          );
        });
    }
  } else if (action === "print-report") window.print();
}
function clearLocalData() {
  if (
    !window.confirm(
      "Clear Skyvora preferences, favorites, plans and cached weather from this browser?",
    )
  )
    return;
  Object.keys(localStorage)
    .filter((key) => key.startsWith("skycast.v2."))
    .forEach((key) => localStorage.removeItem(key));
  state.favorites = [];
  state.recent = [];
  state.location = CONFIG.defaultLocation;
  state.theme = "dark";
  state.language = "en";
  state.tempUnit = "c";
  state.windUnit = "kmh";
  state.rainUnit = "mm";
  setTheme("dark");
  setLanguage("en");
  toast("Local Skyvora data cleared.");
  loadWeather(state.location);
}

function attachEvents() {
  document.addEventListener("click", (event) => {
    const openSidebar = $("#sidebar");
    if (
      openSidebar?.classList.contains("open") &&
      !event.target.closest("#sidebar") &&
      !event.target.closest("#menuToggle")
    ) {
      openSidebar.classList.remove("open");
      $("#menuToggle")?.setAttribute("aria-expanded", "false");
    }
    const viewNode = event.target.closest("[data-view]");
    if (viewNode) {
      event.preventDefault();
      navigate(viewNode.dataset.view);
      return;
    }
    const searchOption = event.target.closest("[data-search-index]");
    if (searchOption) {
      const item =
        state.searchResults[Number(searchOption.dataset.searchIndex)];
      if (item) chooseLocation(item);
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) {
      handleAction(actionButton);
      return;
    }
    const aqiRangeButton = event.target.closest("[data-aqi-range]");
    if (aqiRangeButton) {
      state.aqiRange =
        aqiRangeButton.dataset.aqiRange === "48h" ? "48h" : "24h";
      $$("[data-aqi-range]", root).forEach((node) => {
        node.classList.toggle("active", node === aqiRangeButton);
        node.setAttribute("aria-pressed", String(node === aqiRangeButton));
      });
      renderAqiTrendChart();
      return;
    }
    const chartRangeButton = event.target.closest("[data-chart-range]");
    if (chartRangeButton) {
      state.chartRange =
        chartRangeButton.dataset.chartRange === "10d" ? "10d" : "24h";
      $$(".trend-range-tabs [data-chart-range]").forEach((node) => {
        node.classList.toggle("active", node === chartRangeButton);
        node.setAttribute("aria-pressed", String(node === chartRangeButton));
      });
      renderChart();
      return;
    }
    const chartButton = event.target.closest("[data-chart]");
    if (chartButton) {
      state.chart = chartButton.dataset.chart;
      $$(".trend-metric-tabs [data-chart]").forEach((node) => {
        node.classList.toggle("active", node === chartButton);
        node.setAttribute("aria-pressed", String(node === chartButton));
      });
      renderChart();
      return;
    }
    if (
      !event.target.closest("#searchForm") &&
      !searchResults.contains(event.target)
    )
      hideSearchResults();
    if (event.target === modalRoot) modalRoot.innerHTML = "";
  });

  window.addEventListener("resize", positionSearchResults, { passive: true });
  window.addEventListener("scroll", positionSearchResults, {
    passive: true,
    capture: true,
  });
  window.visualViewport?.addEventListener("resize", positionSearchResults, {
    passive: true,
  });

  searchInput.addEventListener("focus", () => {
    if (!searchInput.value.trim()) renderSearchStartPanel();
    else if (searchInput.value.trim().length >= 2 && searchResults.hidden)
      searchLocations(searchInput.value);
  });
  searchInput.addEventListener("input", () => {
    const term = searchInput.value;
    $("#searchClear").hidden = !term;
    clearTimeout(state.searchTimer);
    if (!term.trim()) {
      renderSearchStartPanel();
      return;
    }
    state.searchController?.abort();
    state.searchController = null;
    state.searchLoading = false;
    state.searchResults = [];
    state.searchIndex = -1;
    if (term.trim().length < 2) {
      searchLocations(term);
      return;
    }
    setSearchPanel(
      '<div class="search-loading search-loading-premium"><span class="loader-ring"></span><span><strong>Getting locations ready</strong><small>Searching across the global place index…</small></span></div>',
    );
    state.searchTimer = setTimeout(
      () => searchLocations(term),
      CONFIG.searchDebounceMs,
    );
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && state.searchResults.length) {
      event.preventDefault();
      state.searchIndex = (state.searchIndex + 1) % state.searchResults.length;
      updateSearchSelection();
    } else if (event.key === "ArrowUp" && state.searchResults.length) {
      event.preventDefault();
      state.searchIndex =
        (state.searchIndex - 1 + state.searchResults.length) %
        state.searchResults.length;
      updateSearchSelection();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen =
        state.searchResults[state.searchIndex] ||
        (state.searchResults.length === 1 ? state.searchResults[0] : null);
      if (chosen) chooseLocation(chosen);
      else if (!state.searchLoading) searchLocations(searchInput.value);
    } else if (event.key === "Escape") hideSearchResults();
    else if (
      event.key === "Tab" &&
      searchResults.hidden &&
      !searchInput.value.trim()
    )
      renderSearchStartPanel();
  });
  $("#searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const chosen =
      state.searchResults[state.searchIndex] ||
      (state.searchResults.length === 1 ? state.searchResults[0] : null);
    if (chosen) chooseLocation(chosen);
    else if (!state.searchLoading) searchLocations(searchInput.value);
  });
  // Do not cancel pointerdown on result buttons: on touch devices that can
  // suppress the synthesized click event and make results appear unclickable.
  searchResults.addEventListener("click", (event) => {
    const option = event.target.closest("[data-search-index]");
    if (!option) return;
    const item = state.searchResults[Number(option.dataset.searchIndex)];
    if (item) {
      event.preventDefault();
      event.stopPropagation();
      chooseLocation(item);
    }
  });
  $("#searchForm").addEventListener("click", (event) => {
    // Keep the search surface interactive on touch screens. The results panel
    // is anchored below the field so it cannot cover the input and steal taps.
    if (event.target.closest("[data-search-index]")) return;
    if (event.target.closest("#searchClear")) return;
    if (event.target !== searchInput && !searchResults.contains(event.target)) {
      searchInput.focus({ preventScroll: true });
    }
    if (searchResults.hidden) {
      const query = searchInput.value.trim();
      if (query.length >= 2) searchLocations(query);
      else renderSearchStartPanel();
    }
  });
  $("#searchClear").addEventListener("click", () => {
    searchInput.value = "";
    $("#searchClear").hidden = true;
    renderSearchStartPanel();
    searchInput.focus();
  });
  $("#locateButton").addEventListener("click", locateCurrentUser);
  $("#themeToggle").addEventListener("click", () => {
    const active = document.documentElement.dataset.theme || "dark";
    setTheme(active === "dark" ? "light" : "dark");
  });
  $("#alertsButton").addEventListener("click", () => navigate("alerts"));
  $("#menuToggle").addEventListener("click", () => {
    const isOpen = $("#sidebar").classList.toggle("open");
    $("#menuToggle").setAttribute("aria-expanded", String(isOpen));
  });

  root.addEventListener("submit", (event) => {
    if (event.target.id === "historyForm") {
      event.preventDefault();
      const start = $("#historyStart").value,
        end = $("#historyEnd").value;
      if (start >= end || end >= getLocalDateISO()) {
        toast("Choose a valid historical range ending before today.", "error");
        return;
      }
      if ((Date.parse(end) - Date.parse(start)) / 86400000 > 31) {
        toast("Choose 31 days or fewer.", "error");
        return;
      }
      loadHistory(start, end);
    }
    if (event.target.id === "planForm") {
      event.preventDefault();
      savePlan(event.target);
    }
    if (event.target.id === "alertRuleForm") {
      event.preventDefault();
      saveAlertRule(event.target);
    }
    if (event.target.id === "comfortForm") {
      event.preventDefault();
      const min = Number($("#comfortMin").value),
        max = Number($("#comfortMax").value);
      if (min >= max) {
        toast("Maximum must be higher than minimum.", "error");
        return;
      }
      writeJSON("comfort", { min, max });
      toast("Comfort profile saved.");
    }
    if (event.target.id === "weatherQuestionForm") {
      event.preventDefault();
      const question = $("#weatherQuestion").value.trim();
      if (!question) return;
      const answer = $("#weatherAnswer");
      answer.hidden = false;
      answer.textContent = answerWeatherQuestion(question);
    }
  });
  root.addEventListener("change", (event) => {
    if (event.target.id === "aqiMetricSelect") {
      state.aqiMetric = event.target.value;
      renderAqiTrendChart();
    }
    if (event.target.id === "journalFile")
      uploadJournalPhoto(event.target.files?.[0]);
    if (event.target.matches("[data-packing-index]")) {
      const list = readJSON("packing", []);
      const index = Number(event.target.dataset.packingIndex);
      if (list[index]) list[index].done = event.target.checked;
      writeJSON("packing", list);
    }
    if (event.target.id === "themeSelect") {
      state.theme = event.target.value;
      setTheme(state.theme);
    }
    if (event.target.id === "languageSelect") setLanguage(event.target.value);
  });
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === "Escape" && $("#sidebar").classList.contains("open")) {
      $("#sidebar").classList.remove("open");
      $("#menuToggle")?.setAttribute("aria-expanded", "false");
      $("#menuToggle")?.focus();
    }
  });
  window.addEventListener("online", () => {
    toast("Connection restored. Refreshing weather…");
    loadWeather(state.location, { quiet: true });
  });
  window.addEventListener("offline", () =>
    toast("You are offline. Cached weather remains available.", "info"),
  );
  window.addEventListener("storage", (event) => {
    if (event.key === "skycast.v2.theme") setTheme(event.newValue);
  });
}
function updateSearchSelection() {
  $$(".search-result[data-search-index]", searchResults).forEach((node) => {
    const selected = Number(node.dataset.searchIndex) === state.searchIndex;
    node.setAttribute("aria-selected", String(selected));
    if (selected) {
      searchInput.setAttribute("aria-activedescendant", node.id);
      node.scrollIntoView({ block: "nearest" });
    }
  });
  if (state.searchIndex < 0)
    searchInput.removeAttribute("aria-activedescendant");
}

async function initialize() {
  attachEvents();
  document.body.classList.add("dashboard-view");
  document.body.classList.toggle(
    "reference-subpage",
    state.view !== "dashboard",
  );
  setTheme(state.theme);
  state.language = "en";
  setPreference("language", "en");
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  document.body.classList.remove("urdu");
  $$("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  searchInput.placeholder = "Search any city, country or postcode…";
  document.documentElement.classList.toggle(
    "reduce-motion",
    getPreference("reduce-motion", "false") === "true",
  );
  document.documentElement.classList.toggle(
    "high-contrast",
    getPreference("high-contrast", "false") === "true",
  );
  hydrateIcons(document);
  triggerInstallPrompt = installPromptHandler(
    (available) => {
      state.installAvailable = available;
      const installButton = $("#installButton");
      const settingsInstallButton = $("#installButtonSettings");
      if (installButton) installButton.hidden = !available;
      if (settingsInstallButton) settingsInstallButton.hidden = !available;
    },
    () => toast("Skyvora has been installed successfully.", "success"),
  );
  registerPWA();

  // Paint from the last successful local forecast before waiting for the network.
  // On a first visit, render the dashboard shell immediately and hydrate it when
  // the live forecast arrives; never leave the LCP area as a network-bound spinner.
  if (state.weather) {
    document.documentElement.dataset.weather = condition(
      current().weather_code,
    ).tone;
    render();
    if (state.air) state.airLoading = false;
    document.body.classList.add("using-cache");
  } else {
    renderDashboard();
  }
  const weatherRequest = loadWeather(state.location, { quiet: true });
  const hashView = location.hash.replace("#", "");
  const allowed = [
    "dashboard",
    "forecast",
    "maps",
    "air",
    "compare",
    "history",
    "marine",
    "planner",
    "favorites",
    "journal",
    "settings",
    "intelligence",
    "alerts",
    "pakistan",
    "diagnostics",
    "education",
  ];
  if (allowed.includes(hashView) && hashView !== "dashboard") {
    if (state.weather) navigate(hashView);
    else void weatherRequest.finally(() => navigate(hashView));
  }
  updateSideLocation();
  const systemQuery = matchMedia("(prefers-color-scheme: light)");
  systemQuery.addEventListener?.("change", () => {
    if (state.theme === "system") setTheme("system");
  });
  setInterval(
    () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        loadWeather(state.location, { quiet: true });
    },
    CONFIG.refreshMinutes * 60 * 1000,
  );
}

initialize().catch((error) => {
  console.error("[skyvora] Initialization failed:", error);
  root.innerHTML =
    '<div class="empty-state panel"><h3>Skyvora could not start</h3><p>Please refresh the page. If the issue continues, check the setup guide.</p></div>';
});
