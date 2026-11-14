export const WEATHER = {
  0: { label: "Clear sky", icon: "sun", tone: "clear" },
  1: { label: "Mainly clear", icon: "sun", tone: "clear" },
  2: { label: "Partly cloudy", icon: "cloud-sun", tone: "cloudy" },
  3: { label: "Overcast", icon: "cloud", tone: "cloudy" },
  45: { label: "Fog", icon: "cloud-fog", tone: "fog" },
  48: { label: "Depositing rime fog", icon: "cloud-fog", tone: "fog" },
  51: { label: "Light drizzle", icon: "cloud-drizzle", tone: "rain" },
  53: { label: "Drizzle", icon: "cloud-drizzle", tone: "rain" },
  55: { label: "Dense drizzle", icon: "cloud-rain", tone: "rain" },
  56: { label: "Freezing drizzle", icon: "cloud-drizzle", tone: "snow" },
  57: { label: "Heavy freezing drizzle", icon: "cloud-drizzle", tone: "snow" },
  61: { label: "Slight rain", icon: "cloud-rain", tone: "rain" },
  63: { label: "Moderate rain", icon: "cloud-rain", tone: "rain" },
  65: { label: "Heavy rain", icon: "cloud-rain", tone: "rain" },
  66: { label: "Light freezing rain", icon: "cloud-rain", tone: "snow" },
  67: { label: "Heavy freezing rain", icon: "cloud-rain", tone: "snow" },
  71: { label: "Slight snow", icon: "cloud-snow", tone: "snow" },
  73: { label: "Moderate snow", icon: "cloud-snow", tone: "snow" },
  75: { label: "Heavy snow", icon: "cloud-snow", tone: "snow" },
  77: { label: "Snow grains", icon: "cloud-snow", tone: "snow" },
  80: { label: "Rain showers", icon: "cloud-sun-rain", tone: "rain" },
  81: { label: "Moderate rain showers", icon: "cloud-rain", tone: "rain" },
  82: { label: "Violent rain showers", icon: "cloud-rain", tone: "storm" },
  85: { label: "Snow showers", icon: "cloud-snow", tone: "snow" },
  86: { label: "Heavy snow showers", icon: "cloud-snow", tone: "snow" },
  95: { label: "Thunderstorm", icon: "cloud-lightning", tone: "storm" },
  96: {
    label: "Thunderstorm with hail",
    icon: "cloud-lightning",
    tone: "storm",
  },
  99: {
    label: "Thunderstorm with heavy hail",
    icon: "cloud-lightning",
    tone: "storm",
  },
};

export function condition(code) {
  return (
    WEATHER[Number(code)] || {
      label: "Conditions unavailable",
      icon: "cloud",
      tone: "unknown",
    }
  );
}
export function cToF(value) {
  return Number.isFinite(value) ? (value * 9) / 5 + 32 : null;
}
export function kmhToMph(value) {
  return Number.isFinite(value) ? value * 0.621371 : null;
}
export function mmToIn(value) {
  return Number.isFinite(value) ? value / 25.4 : null;
}
export function displayTemp(value, unit = "c") {
  if (!Number.isFinite(value)) return "—";
  const num = unit === "f" ? cToF(value) : value;
  return `${Math.round(num)}°`;
}
export function displayWind(value, unit = "kmh") {
  if (!Number.isFinite(value)) return "—";
  const n = unit === "mph" ? kmhToMph(value) : value;
  return `${Math.round(n)} ${unit === "mph" ? "mph" : "km/h"}`;
}
export function displayRain(value, unit = "mm") {
  if (!Number.isFinite(value)) return "—";
  const n = unit === "in" ? mmToIn(value) : value;
  return `${n.toFixed(1)} ${unit}`;
}
export function direction(degrees) {
  if (!Number.isFinite(degrees)) return "—";
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round(degrees / 45) % 8
  ];
}
export function safeNumber(value, digits = 0) {
  return Number.isFinite(value) ? Number(value).toFixed(digits) : "—";
}
export function timeLabel(value, locale = "en-US", options = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    ...options,
  }).format(date);
}
export function dateLabel(value, locale = "en-US", options = {}) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}
export function aqiCategory(value) {
  if (!Number.isFinite(value))
    return { label: "Unavailable", className: "unknown", color: "#8191a8" };
  if (value <= 50)
    return { label: "Good", className: "good", color: "#79d8b2" };
  if (value <= 100)
    return { label: "Moderate", className: "moderate", color: "#e9cb75" };
  if (value <= 150)
    return {
      label: "Unhealthy for sensitive groups",
      className: "sensitive",
      color: "#f3a16b",
    };
  if (value <= 200)
    return { label: "Unhealthy", className: "unhealthy", color: "#ed8080" };
  if (value <= 300)
    return {
      label: "Very unhealthy",
      className: "very-unhealthy",
      color: "#a78ce7",
    };
  return { label: "Hazardous", className: "hazardous", color: "#b96984" };
}
export function getLocalDateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
export function addDaysISO(dateString, days) {
  const d = new Date(`${dateString}T12:00:00`);
  d.setDate(d.getDate() + days);
  return getLocalDateISO(d);
}
export function skySummary(current, hourly = []) {
  const c = current || {};
  const next = hourly.slice(0, 6);
  const upcomingRain = next.findIndex(
    (h) => (h.precipitation_probability ?? 0) >= 55,
  );
  if ([95, 96, 99].includes(c.weather_code))
    return "Thunderstorm conditions are currently indicated. Keep an eye on official local advisories.";
  if (
    (c.precipitation ?? 0) > 0.2 ||
    [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(c.weather_code)
  )
    return "Wet conditions are in the picture. Check the hourly outlook before heading out.";
  if (upcomingRain > 0)
    return `A higher chance of rain appears in about ${upcomingRain} hour${upcomingRain > 1 ? "s" : ""}. Plan outdoor time with flexibility.`;
  if ((c.wind_speed_10m ?? 0) >= 30)
    return "Breezy conditions are expected. Secure loose outdoor items and allow extra time outside.";
  if ((c.relative_humidity_2m ?? 0) >= 80)
    return "The air is quite humid. Conditions may feel warmer than the thermometer suggests.";
  if ((c.uv_index ?? 0) >= 6)
    return "UV levels are elevated. Consider shade and sun protection during the strongest daylight hours.";
  return "Conditions look relatively settled over the next few hours. Check the timeline for small changes.";
}
export function buildInsights(current, hourly, daily) {
  const items = [];
  if (!current) return items;
  if ((current.wind_speed_10m ?? 0) >= 30)
    items.push({
      icon: "wind",
      title: "Breezy conditions",
      text: `Wind is around ${Math.round(current.wind_speed_10m)} km/h. Conditions may feel blustery in exposed areas.`,
      tone: "warn",
    });
  const rain = hourly
    .slice(0, 6)
    .find((h) => (h.precipitation_probability ?? 0) >= 60);
  if (rain)
    items.push({
      icon: "cloud-rain",
      title: "Rain chance ahead",
      text: `A ${Math.round(rain.precipitation_probability)}% precipitation probability appears around ${timeLabel(rain.time)}.`,
      tone: "info",
    });
  if ((current.relative_humidity_2m ?? 0) >= 80)
    items.push({
      icon: "droplet",
      title: "High humidity",
      text: `Relative humidity is ${Math.round(current.relative_humidity_2m)}%. The air may feel muggy.`,
      tone: "info",
    });
  const currentUv = Number.isFinite(current.uv_index)
    ? current.uv_index
    : hourly[0]?.uv_index;
  if ((currentUv ?? 0) >= 6)
    items.push({
      icon: "sun",
      title: "Elevated UV",
      text: `UV index is ${safeNumber(currentUv)}. Use ordinary sun protection during peak daylight.`,
      tone: "warn",
    });
  if (
    daily.length > 1 &&
    Number.isFinite(daily[0].temperature_2m_max) &&
    Number.isFinite(daily[1].temperature_2m_max)
  ) {
    const diff = daily[1].temperature_2m_max - daily[0].temperature_2m_max;
    if (Math.abs(diff) >= 3)
      items.push({
        icon: diff > 0 ? "thermometer_sun" : "thermometer",
        title: diff > 0 ? "Warmer tomorrow" : "Cooler tomorrow",
        text: `Tomorrow's high is forecast to be about ${Math.abs(Math.round(diff))}°C ${diff > 0 ? "higher" : "lower"} than today.`,
        tone: "info",
      });
  }
  if (!items.length)
    items.push({
      icon: "sparkles",
      title: "Steady outlook",
      text: "No notable threshold-based changes were identified in the available near-term forecast.",
      tone: "good",
    });
  return items.slice(0, 4);
}
