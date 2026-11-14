import test from "node:test";
import assert from "node:assert/strict";
import {
  compassDirection16,
  getDaylightProgress,
} from "../frontend/js/utils/solar.js";
import { averageHourlyByDate } from "../frontend/js/utils/series.js";
import { FORECAST_DAILY_FIELDS } from "../backend/services/openMeteoFields.js";
import {
  countryFlagEmoji,
  locationKind,
  formatPopulation,
  normalizeGeocodingResult,
  parseCoordinateQuery,
  rankLocationResults,
} from "../frontend/js/utils/search.js";
import {
  condition,
  cToF,
  kmhToMph,
  mmToIn,
  displayTemp,
  displayWind,
  displayRain,
  direction,
  safeNumber,
  aqiCategory,
  addDaysISO,
} from "../frontend/js/utils/weather.js";

test("Celsius and Fahrenheit conversions are correct", () => {
  assert.equal(cToF(0), 32);
  assert.equal(cToF(20), 68);
  assert.equal(displayTemp(20, "f"), "68°");
  assert.equal(displayTemp(20, "c"), "20°");
  assert.equal(cToF(Number.NaN), null);
});

test("wind and rainfall unit conversions are correct", () => {
  assert.equal(Math.round(kmhToMph(100) * 100) / 100, 62.14);
  assert.equal(mmToIn(25.4), 1);
  assert.equal(displayWind(16, "mph"), "10 mph");
  assert.equal(displayRain(25.4, "in"), "1.0 in");
});

test("weather direction and WMO condition mapping handle known and unknown values", () => {
  assert.equal(direction(0), "N");
  assert.equal(direction(90), "E");
  assert.equal(direction(180), "S");
  assert.equal(direction(270), "W");
  assert.equal(direction(359), "N");
  assert.equal(direction(null), "—");
  assert.equal(condition(95).tone, "storm");
  assert.equal(condition(0).label, "Clear sky");
  assert.equal(condition(999).tone, "unknown");
});

test("AQI category boundaries are mapped consistently", () => {
  assert.equal(aqiCategory(50).className, "good");
  assert.equal(aqiCategory(100).className, "moderate");
  assert.equal(aqiCategory(150).className, "sensitive");
  assert.equal(aqiCategory(200).className, "unhealthy");
  assert.equal(aqiCategory(300).className, "very-unhealthy");
  assert.equal(aqiCategory(301).className, "hazardous");
  assert.equal(aqiCategory(Number.NaN).className, "unknown");
});

test("formatters return safe placeholders for missing numeric data", () => {
  assert.equal(displayTemp(null), "—");
  assert.equal(displayWind(Number.NaN), "—");
  assert.equal(displayRain(Number.NaN), "—");
  assert.equal(safeNumber(Number.NaN), "—");
});

test("date helper advances calendar dates without mutating the input string", () => {
  assert.equal(addDaysISO("2026-01-31", 1), "2026-02-01");
  assert.equal(addDaysISO("2024-02-28", 1), "2024-02-29");
});

test("16-point wind compass normalizes angles and reports intermediate directions", () => {
  assert.equal(compassDirection16(0), "N");
  assert.equal(compassDirection16(22.5), "NNE");
  assert.equal(compassDirection16(67.5), "ENE");
  assert.equal(compassDirection16(180), "S");
  assert.equal(compassDirection16(360), "N");
  assert.equal(compassDirection16(-45), "NW");
  assert.equal(compassDirection16(Number.NaN), "—");
});

test("daylight progress correctly handles pre-sunrise, daylight and night phases", () => {
  const sunrise = "2026-11-06T06:00";
  const sunset = "2026-11-06T18:00";
  const before = getDaylightProgress(sunrise, sunset, "2026-11-06T05:15");
  assert.equal(before.phase, "before-sunrise");
  assert.equal(before.minutesToSunrise, 45);
  assert.equal(before.progress, 0);

  const daytime = getDaylightProgress(sunrise, sunset, "2026-11-06T12:00");
  assert.equal(daytime.phase, "daylight");
  assert.equal(daytime.progress, 0.5);
  assert.equal(daytime.minutesToSunset, 360);
  assert.equal(daytime.daylightMinutes, 720);

  const night = getDaylightProgress(sunrise, sunset, "2026-11-06T20:00");
  assert.equal(night.phase, "after-sunset");
  assert.equal(night.progress, 1);
  assert.equal(
    getDaylightProgress("bad", sunset, "2026-11-06T12:00").available,
    false,
  );
});

test("weather scene selection returns condition-specific day and night images", async () => {
  const { getWeatherScenePhotos, resolveIsDay, resolveWeatherSceneTone } =
    await import("../frontend/js/utils/scene.js");
  const clear = getWeatherScenePhotos("clear");
  const rain = getWeatherScenePhotos("rain");
  assert.match(clear.day, /^https:\/\/images\.unsplash\.com\//);
  assert.match(clear.night, /^https:\/\/images\.unsplash\.com\//);
  assert.notEqual(clear.day, clear.night);
  assert.notEqual(rain.day, clear.day);
  assert.equal(getWeatherScenePhotos("unknown").tone, "unknown");
  assert.equal(resolveWeatherSceneTone({ weather_code: 2 }), "partly-cloudy");
  assert.equal(resolveWeatherSceneTone({ weather_code: 3 }), "overcast");
  assert.equal(resolveWeatherSceneTone({ weather_code: 51 }), "drizzle");
  assert.equal(resolveWeatherSceneTone({ weather_code: 65 }), "heavy-rain");
  assert.equal(resolveWeatherSceneTone({ weather_code: 95 }), "storm");
  assert.equal(
    resolveWeatherSceneTone({ weather_code: 0, wind_speed_10m: 52 }),
    "windy",
  );
  assert.equal(resolveIsDay({ is_day: 1 }), true);
  assert.equal(resolveIsDay({ is_day: 0 }), false);
  assert.equal(
    resolveIsDay(
      { time: "2026-11-06T07:00" },
      { sunrise: "2026-11-06T06:00", sunset: "2026-11-06T17:00" },
    ),
    true,
  );
  assert.equal(
    resolveIsDay(
      { time: "2026-11-06T20:00" },
      { sunrise: "2026-11-06T06:00", sunset: "2026-11-06T17:00" },
    ),
    false,
  );
});

test("smart weather outlook selects forecast peaks without inventing unavailable values", async () => {
  const { buildWeatherOutlook } =
    await import("../frontend/js/utils/outlook.js");
  const outlook = buildWeatherOutlook([
    {
      time: "2026-11-06T06:00",
      precipitation_probability: 10,
      temperature_2m: 18,
      wind_speed_10m: 8,
      uv_index: 1,
    },
    {
      time: "2026-11-06T12:00",
      precipitation_probability: 65,
      temperature_2m: 25,
      wind_speed_10m: 12,
      uv_index: 7,
    },
    {
      time: "2026-11-06T16:00",
      precipitation_probability: 35,
      temperature_2m: 23,
      wind_speed_10m: 28,
      uv_index: 4,
    },
  ]);
  assert.equal(outlook.find((item) => item.id === "rain").value, "65%");
  assert.equal(outlook.find((item) => item.id === "warmest").value, "25°");
  assert.equal(outlook.find((item) => item.id === "wind").value, "28 km/h");
  assert.equal(outlook.find((item) => item.id === "uv").value, "7.0");
  const unavailable = buildWeatherOutlook([]);
  assert.ok(unavailable.every((item) => item.value === "—"));
});

test("weather scene falls back to local sunrise/sunset when is_day is null", async () => {
  const { resolveIsDay } = await import("../frontend/js/utils/scene.js");
  assert.equal(
    resolveIsDay(
      { is_day: null, time: "2026-11-06T09:00" },
      { sunrise: "2026-11-06T06:00", sunset: "2026-11-06T17:00" },
    ),
    true,
  );
  assert.equal(
    resolveIsDay(
      { is_day: null, time: "2026-11-06T20:00" },
      { sunrise: "2026-11-06T06:00", sunset: "2026-11-06T17:00" },
    ),
    false,
  );
});

test("time-window selector starts at the nearest current hour and caps its range", async () => {
  const { selectTimeWindow } = await import("../frontend/js/utils/series.js");
  const times = [
    "2026-11-06T00:00",
    "2026-11-06T01:00",
    "2026-11-06T02:00",
    "2026-11-06T03:00",
    "2026-11-06T04:00",
  ];
  const selected = selectTimeWindow(
    times,
    [10, 20, 30, 40, 50],
    "2026-11-06T02:20",
    3,
  );
  assert.equal(selected.startIndex, 2);
  assert.deepEqual(
    selected.rows.map((row) => row.value),
    [30, 40, 50],
  );
  assert.equal(
    selectTimeWindow(times, [10, 20, 30, 40, 50], "2026-11-06T04:00", 24).rows
      .length,
    1,
  );
  assert.deepEqual(selectTimeWindow([], [], "2026-11-06T04:00", 24).rows, []);
});

test("10-day chart means are calculated from real hourly values by provider-local date", () => {
  const hourly = {
    time: [
      "2026-11-06T00:00",
      "2026-11-06T01:00",
      "2026-11-06T02:00",
      "2026-11-07T00:00",
    ],
    temperature_2m: [10, 12, null, 20],
    relative_humidity_2m: [60, 80, 90, 50],
  };
  assert.equal(averageHourlyByDate(hourly, "2026-11-06", "temperature_2m"), 11);
  assert.equal(
    averageHourlyByDate(hourly, "2026-11-06", "relative_humidity_2m"),
    230 / 3,
  );
  assert.equal(averageHourlyByDate(hourly, "2026-11-07", "temperature_2m"), 20);
  assert.equal(
    averageHourlyByDate(hourly, "2026-11-08", "temperature_2m"),
    null,
  );
  assert.equal(
    averageHourlyByDate(hourly, "2026-11-06", "missing_field"),
    null,
  );
});

test("forecast daily request uses only documented Open-Meteo daily fields", () => {
  const supported = new Set([
    "weather_code",
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "sunrise",
    "sunset",
    "daylight_duration",
    "sunshine_duration",
    "uv_index_max",
    "uv_index_clear_sky_max",
    "rain_sum",
    "showers_sum",
    "snowfall_sum",
    "precipitation_sum",
    "precipitation_hours",
    "precipitation_probability_max",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
    "wind_direction_10m_dominant",
    "shortwave_radiation_sum",
    "et0_fao_evapotranspiration",
  ]);
  assert.ok(FORECAST_DAILY_FIELDS.length > 0);
  assert.ok(FORECAST_DAILY_FIELDS.every((field) => supported.has(field)));
  assert.ok(!FORECAST_DAILY_FIELDS.includes("temperature_2m_mean"));
  assert.ok(!FORECAST_DAILY_FIELDS.includes("relative_humidity_2m_mean"));
  assert.ok(!FORECAST_DAILY_FIELDS.includes("visibility_mean"));
});

test("worldwide search maps ISO country codes to country flag emojis", () => {
  assert.equal(countryFlagEmoji("PK"), "🇵🇰");
  assert.equal(countryFlagEmoji("JP"), "🇯🇵");
  assert.equal(countryFlagEmoji("us"), "🇺🇸");
  assert.equal(countryFlagEmoji(""), "🌐");
  assert.equal(countryFlagEmoji("XXX"), "🌐");
});

test("geocoding results are normalized and invalid coordinates are rejected", () => {
  const place = normalizeGeocodingResult({
    id: 1,
    name: "Tokyo",
    country: "Japan",
    country_code: "JP",
    latitude: 35.68,
    longitude: 139.69,
    timezone: "Asia/Tokyo",
    population: 13960000,
    feature_code: "PPLC",
  });
  assert.equal(place.name, "Tokyo");
  assert.equal(place.country_code, "JP");
  assert.equal(place.timezone, "Asia/Tokyo");
  assert.equal(
    normalizeGeocodingResult({
      name: "Bad place",
      latitude: 120,
      longitude: 500,
    }),
    null,
  );
  assert.equal(normalizeGeocodingResult(null), null);
});

test("location types and population labels are clear and safe", () => {
  assert.equal(locationKind("PPLC"), "National capital");
  assert.equal(locationKind("PPLA2"), "Administrative centre");
  assert.equal(locationKind("PPL"), "City or town");
  assert.equal(formatPopulation(0), "");
  assert.match(formatPopulation(1500000), /1\.5M people/);
});

test("coordinate search accepts valid latitude/longitude and rejects out-of-range values", () => {
  const result = parseCoordinateQuery("33.6844, 73.0479");
  assert.equal(result.latitude, 33.6844);
  assert.equal(result.longitude, 73.0479);
  assert.equal(parseCoordinateQuery("91, 73"), null);
  assert.equal(parseCoordinateQuery("33, 181"), null);
  assert.equal(parseCoordinateQuery("Islamabad"), null);
});

test("global location results are deduplicated and ranked by exact/prefix city match", () => {
  const ranked = rankLocationResults(
    [
      {
        id: 2,
        name: "Paris",
        country: "United States",
        latitude: 33.66,
        longitude: -95.55,
        population: 25000,
      },
      {
        id: 1,
        name: "Paris",
        country: "France",
        latitude: 48.85,
        longitude: 2.35,
        population: 2100000,
      },
      {
        id: 3,
        name: "Pari",
        country: "Other",
        latitude: 2,
        longitude: 2,
        population: 500,
      },
      {
        id: 4,
        name: "Paris",
        country: "France duplicate",
        latitude: 48.85,
        longitude: 2.35,
        population: 2100000,
      },
    ],
    "Paris",
  );
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].name, "Paris");
  assert.equal(ranked[0].country, "France");
  assert.equal(ranked[1].name, "Paris");
});

test("worldwide search ranking folds diacritics for natural name matching", () => {
  const ranked = rankLocationResults(
    [
      {
        name: "Sao Paulo",
        country: "Fallback",
        latitude: 1,
        longitude: 1,
        population: 200,
      },
      {
        name: "São Paulo",
        country: "Brazil",
        latitude: -23.55,
        longitude: -46.63,
        population: 12000000,
      },
    ],
    "Sao",
  );
  assert.equal(ranked[0].name, "São Paulo");
});
