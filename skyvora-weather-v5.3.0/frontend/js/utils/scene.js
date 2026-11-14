const SCENE_PHOTOS = Object.freeze({
  clear: {
    day: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1600&q=82",
    night:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=82",
  },
  "partly-cloudy": {
    day: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1600&q=82",
    night:
      "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&w=1600&q=82",
  },
  overcast: {
    day: "https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=1600&q=82",
    night:
      "https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=1600&q=82",
  },
  cloudy: {
    day: "https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1600&q=82",
    night:
      "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&w=1600&q=82",
  },
  drizzle: {
    day: "https://images.unsplash.com/photo-1512511708753-3150cd2ec8ee?auto=format&fit=crop&w=1800&q=85",
    night:
      "https://images.unsplash.com/photo-1512511708753-3150cd2ec8ee?auto=format&fit=crop&w=1800&q=85",
  },
  rain: {
    day: "https://images.unsplash.com/photo-1512511708753-3150cd2ec8ee?auto=format&fit=crop&w=1800&q=85",
    night:
      "https://images.unsplash.com/photo-1512511708753-3150cd2ec8ee?auto=format&fit=crop&w=1800&q=85",
  },
  "heavy-rain": {
    day: "https://images.unsplash.com/photo-1512511708753-3150cd2ec8ee?auto=format&fit=crop&w=1800&q=85",
    night:
      "https://images.unsplash.com/photo-1512511708753-3150cd2ec8ee?auto=format&fit=crop&w=1800&q=85",
  },
  storm: {
    day: "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?auto=format&fit=crop&w=1600&q=82",
    night:
      "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?auto=format&fit=crop&w=1600&q=82",
  },
  snow: {
    day: "https://images.unsplash.com/photo-1478265409131-1f65c88f965c?auto=format&fit=crop&w=1600&q=82",
    night:
      "https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=1600&q=82",
  },
  fog: {
    day: "https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?auto=format&fit=crop&w=1600&q=82",
    night:
      "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1600&q=82",
  },
  windy: {
    day: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=82",
    night:
      "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?auto=format&fit=crop&w=1600&q=82",
  },
  unknown: {
    day: "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1600&q=82",
    night:
      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1600&q=82",
  },
});

export function resolveWeatherSceneTone(current) {
  const code = Number(current?.weather_code);
  const wind = Number(current?.wind_speed_10m);
  if ([95, 96, 99].includes(code)) return "storm";
  if ([71, 73, 75, 77, 85, 86, 56, 57, 66, 67].includes(code)) return "snow";
  if ([45, 48].includes(code)) return "fog";
  if ([65, 82].includes(code)) return "heavy-rain";
  if ([51, 53, 55].includes(code)) return "drizzle";
  if ([61, 63, 80, 81].includes(code)) return "rain";
  if (code === 3) return "overcast";
  if (code === 2) return "partly-cloudy";
  if ([0, 1].includes(code) && Number.isFinite(wind) && wind >= 45)
    return "windy";
  if ([0, 1].includes(code)) return "clear";
  return "unknown";
}

export function getWeatherScenePhotos(tone = "unknown") {
  const normalized = Object.hasOwn(SCENE_PHOTOS, tone) ? tone : "unknown";
  return { ...SCENE_PHOTOS[normalized], tone: normalized };
}

export function resolveIsDay(current, firstDay, fallbackDate = new Date()) {
  if (
    current?.is_day !== null &&
    current?.is_day !== undefined &&
    current?.is_day !== "" &&
    Number.isFinite(Number(current.is_day))
  ) {
    return Number(current.is_day) === 1;
  }
  const time = String(current?.time || "");
  const sunrise = String(firstDay?.sunrise || "").slice(11, 16);
  const sunset = String(firstDay?.sunset || "").slice(11, 16);
  const localTime = time.slice(11, 16);
  if (
    /^\d{2}:\d{2}$/.test(localTime) &&
    /^\d{2}:\d{2}$/.test(sunrise) &&
    /^\d{2}:\d{2}$/.test(sunset)
  ) {
    return localTime >= sunrise && localTime < sunset;
  }
  return fallbackDate.getHours() >= 6 && fallbackDate.getHours() < 18;
}
