export function buildWeatherOutlook(items = []) {
  const rows = Array.isArray(items) ? items : [];
  const valid = (key) => rows.filter((item) => Number.isFinite(item?.[key]));
  const maxBy = (key) =>
    valid(key).reduce(
      (best, item) => (!best || item[key] > best[key] ? item : best),
      null,
    );
  const rain = maxBy("precipitation_probability");
  const warmest = maxBy("temperature_2m");
  const breeziest = maxBy("wind_speed_10m");
  const uvPeak = maxBy("uv_index");

  return [
    {
      id: "rain",
      icon: "cloud-rain",
      label: "Rain watch",
      value: rain ? `${Math.round(rain.precipitation_probability)}%` : "—",
      detail: rain
        ? `Peak chance around ${String(rain.time || "").slice(11, 16) || "an unavailable time"}`
        : "Precipitation probability unavailable",
      tone: rain && rain.precipitation_probability >= 60 ? "rain" : "calm",
      time: rain?.time || null,
    },
    {
      id: "warmest",
      icon: "thermometer-sun",
      label: "Warmest hour",
      value:
        warmest && Number.isFinite(warmest.temperature_2m)
          ? `${Math.round(warmest.temperature_2m)}°`
          : "—",
      detail: warmest
        ? `Expected around ${String(warmest.time || "").slice(11, 16) || "an unavailable time"}`
        : "Temperature forecast unavailable",
      tone: "warm",
      time: warmest?.time || null,
    },
    {
      id: "wind",
      icon: "wind",
      label: "Breeziest hour",
      value:
        breeziest && Number.isFinite(breeziest.wind_speed_10m)
          ? `${Math.round(breeziest.wind_speed_10m)} km/h`
          : "—",
      detail: breeziest
        ? `Highest sustained wind around ${String(breeziest.time || "").slice(11, 16) || "an unavailable time"}`
        : "Wind forecast unavailable",
      tone: breeziest && breeziest.wind_speed_10m >= 30 ? "windy" : "calm",
      time: breeziest?.time || null,
    },
    {
      id: "uv",
      icon: "sun",
      label: "UV peak",
      value:
        uvPeak && Number.isFinite(uvPeak.uv_index)
          ? Number(uvPeak.uv_index).toFixed(1)
          : "—",
      detail: uvPeak
        ? `Highest forecast value around ${String(uvPeak.time || "").slice(11, 16) || "an unavailable time"}`
        : "UV forecast unavailable",
      tone: uvPeak && uvPeak.uv_index >= 6 ? "uv-high" : "calm",
      time: uvPeak?.time || null,
    },
  ];
}
