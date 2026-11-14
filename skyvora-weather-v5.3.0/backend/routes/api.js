import { Router } from "express";
import mongoose from "mongoose";
import WeatherCache from "../models/WeatherCache.js";
import ApiMetric from "../models/ApiMetric.js";
import { fetchWeatherJson, providerStatus } from "../services/openMeteo.js";
import { FORECAST_DAILY_FIELDS } from "../services/openMeteoFields.js";
import {
  parseCoordinates,
  validateHistoricalRange,
  normalizeSearchCount,
} from "../utils/validation.js";

const router = Router();

const CURRENT_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "surface_pressure",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
].join(",");
const HOURLY_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "uv_index",
  "visibility",
  "dew_point_2m",
  "pressure_msl",
  "shortwave_radiation",
  "sunshine_duration",
].join(",");
const DAILY_FIELDS = FORECAST_DAILY_FIELDS.join(",");

function coordinates(req) {
  const parsed = parseCoordinates(req.query.latitude, req.query.longitude);
  if (!parsed) {
    const error = new Error("Valid latitude and longitude are required.");
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}
function safeTimezone(value) {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !/^[A-Za-z0-9_+./-]+$/.test(value)
  )
    return "auto";
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return "auto";
  }
}
function responseFor(res, result) {
  res.set("X-Data-Provider", "Open-Meteo");
  res.set("X-Data-Cached", String(result.cached));
  res.set("X-Data-Stale", String(Boolean(result.stale)));
  return res.json({
    success: true,
    provider: "Open-Meteo",
    cached: result.cached,
    stale: Boolean(result.stale),
    fetchedAt: result.fetchedAt,
    staleAgeMs: result.staleAgeMs ?? null,
    warning: result.warning ?? null,
    durationMs: result.durationMs ?? null,
    data: result.data,
  });
}
function makeUrl(base, params) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );
  const apiKey = process.env.OPEN_METEO_CUSTOMER_API_KEY;
  if (apiKey) url.searchParams.set("apikey", apiKey);
  return url.toString();
}

router.get("/health", async (_req, res) => {
  let cacheRecords = null;
  let apiMetrics = null;
  if (mongoose.connection.readyState === 1) {
    try {
      [cacheRecords, apiMetrics] = await Promise.all([
        WeatherCache.estimatedDocumentCount(),
        ApiMetric.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 86400000) },
        }),
      ]);
    } catch {
      /* health response must remain available */
    }
  }
  res.json({
    success: true,
    status: "ok",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : process.env.MONGODB_URI
          ? "not-connected"
          : "not-configured",
    persistenceEnabled: mongoose.connection.readyState === 1,
    provider: providerStatus(),
    cacheRecords,
    apiMetricsLast24h: apiMetrics,
    timestamp: new Date().toISOString(),
  });
});

router.get("/geocoding/search", async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    if (query.length < 2 || query.length > 90)
      return res
        .status(400)
        .json({
          success: false,
          message: "Search must contain 2–90 characters.",
        });

    const count = normalizeSearchCount(req.query.count);
    if (count === null)
      return res
        .status(400)
        .json({
          success: false,
          message: "Result count must be a whole number from 1 to 20.",
        });
    const countryCode = String(req.query.countryCode || "")
      .trim()
      .toUpperCase();
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Country filter must be a two-letter ISO country code.",
        });
    }
    const requestedLanguage = String(req.query.language || "en")
      .trim()
      .toLowerCase();
    const language = /^[a-z]{2,3}(?:-[a-z]{2})?$/.test(requestedLanguage)
      ? requestedLanguage
      : "en";
    const params = { name: query, count, language, format: "json" };
    if (countryCode) params.countryCode = countryCode;

    const url = makeUrl(
      process.env.OPEN_METEO_GEOCODING_BASE ||
        "https://geocoding-api.open-meteo.com/v1/search",
      params,
    );
    const result = await fetchWeatherJson(url, {
      category: "geocoding",
      ttl: 60 * 60 * 1000,
    });
    responseFor(res, result);
  } catch (error) {
    next(error);
  }
});

router.get("/weather/forecast", async (req, res, next) => {
  try {
    const { latitude, longitude } = coordinates(req);
    const timezone = safeTimezone(req.query.timezone);
    const url = makeUrl(
      process.env.OPEN_METEO_FORECAST_BASE ||
        "https://api.open-meteo.com/v1/forecast",
      {
        latitude,
        longitude,
        timezone,
        current: CURRENT_FIELDS,
        hourly: HOURLY_FIELDS,
        daily: DAILY_FIELDS,
        forecast_days: 10,
        past_days: 1,
        wind_speed_unit: "kmh",
        temperature_unit: "celsius",
        precipitation_unit: "mm",
      },
    );
    const result = await fetchWeatherJson(url, {
      category: "forecast",
      ttl: 8 * 60 * 1000,
      timeoutMs: 12_000,
      maxAttempts: 2,
    });
    responseFor(res, result);
  } catch (error) {
    next(error);
  }
});

router.get("/air-quality", async (req, res, next) => {
  try {
    const { latitude, longitude } = coordinates(req);
    const timezone = safeTimezone(req.query.timezone);
    const url = makeUrl(
      process.env.OPEN_METEO_AIR_QUALITY_BASE ||
        "https://air-quality-api.open-meteo.com/v1/air-quality",
      {
        latitude,
        longitude,
        timezone,
        forecast_days: 3,
        hourly:
          "us_aqi,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_ozone,us_aqi_sulphur_dioxide,us_aqi_carbon_monoxide,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone",
      },
    );
    const result = await fetchWeatherJson(url, {
      category: "air-quality",
      ttl: 20 * 60 * 1000,
      timeoutMs: 6_000,
      maxAttempts: 1,
    });
    responseFor(res, result);
  } catch (error) {
    next(error);
  }
});

router.get("/weather/history", async (req, res, next) => {
  try {
    const { latitude, longitude } = coordinates(req);
    const start = String(req.query.start_date || "");
    const end = String(req.query.end_date || "");
    const range = validateHistoricalRange(start, end);
    if (!range)
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Choose a valid historical date range of 1–32 calendar dates, ending before today.",
        });
    const url = makeUrl(
      process.env.OPEN_METEO_ARCHIVE_BASE ||
        "https://archive-api.open-meteo.com/v1/archive",
      {
        latitude,
        longitude,
        start_date: start,
        end_date: end,
        timezone: safeTimezone(req.query.timezone),
        hourly:
          "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
        daily:
          "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
      },
    );
    const result = await fetchWeatherJson(url, {
      category: "historical",
      ttl: 24 * 60 * 60 * 1000,
    });
    responseFor(res, result);
  } catch (error) {
    next(error);
  }
});

router.get("/marine", async (req, res, next) => {
  try {
    const { latitude, longitude } = coordinates(req);
    const url = makeUrl(
      process.env.OPEN_METEO_MARINE_BASE ||
        "https://marine-api.open-meteo.com/v1/marine",
      {
        latitude,
        longitude,
        timezone: safeTimezone(req.query.timezone),
        forecast_days: 5,
        current:
          "wave_height,wave_direction,wave_period,sea_surface_temperature,sea_level_height_msl",
        hourly:
          "wave_height,wave_direction,wave_period,swell_wave_height,sea_surface_temperature,sea_level_height_msl",
      },
    );
    const result = await fetchWeatherJson(url, {
      category: "marine",
      ttl: 20 * 60 * 1000,
    });
    responseFor(res, result);
  } catch (error) {
    next(error);
  }
});

router.get("/alerts", (_req, res) => {
  res.json({
    success: true,
    available: false,
    provider: null,
    message:
      "No official severe-weather alert provider is configured for this deployment. Check your local meteorological authority.",
  });
});

export default router;
