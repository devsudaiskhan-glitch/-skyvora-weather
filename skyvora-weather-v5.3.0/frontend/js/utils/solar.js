const COMPASS_POINTS_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

export function compassDirection16(degrees) {
  if (!Number.isFinite(degrees)) return "—";
  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS_POINTS_16[
    Math.round(normalized / 22.5) % COMPASS_POINTS_16.length
  ];
}

function minutesOfLocalTime(value) {
  const match = String(value ?? "").match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Calculate daylight progress using local wall-clock timestamps returned by the weather provider. */
export function getDaylightProgress(sunriseValue, sunsetValue, currentValue) {
  const sunrise = minutesOfLocalTime(sunriseValue);
  const sunset = minutesOfLocalTime(sunsetValue);
  const now = minutesOfLocalTime(currentValue);
  if (
    sunrise === null ||
    sunset === null ||
    now === null ||
    sunset <= sunrise
  ) {
    return {
      available: false,
      phase: "unavailable",
      progress: 0,
      daylightMinutes: null,
      minutesToSunrise: null,
      minutesToSunset: null,
    };
  }

  const daylightMinutes = sunset - sunrise;
  if (now < sunrise) {
    return {
      available: true,
      phase: "before-sunrise",
      progress: 0,
      daylightMinutes,
      minutesToSunrise: sunrise - now,
      minutesToSunset: null,
    };
  }
  if (now > sunset) {
    return {
      available: true,
      phase: "after-sunset",
      progress: 1,
      daylightMinutes,
      minutesToSunrise: null,
      minutesToSunset: 0,
    };
  }
  const elapsed = now - sunrise;
  return {
    available: true,
    phase: "daylight",
    progress: elapsed / daylightMinutes,
    daylightMinutes,
    minutesToSunrise: 0,
    minutesToSunset: sunset - now,
  };
}
