/**
 * Open-Meteo Forecast API daily variables verified against its published forecast.yml contract.
 * Do not add arbitrary daily means here: derive unsupported aggregates from the hourly series.
 */
export const FORECAST_DAILY_FIELDS = Object.freeze([
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
