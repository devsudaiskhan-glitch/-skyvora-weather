const COMPACT_NUMBER = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function countryFlagEmoji(countryCode = "") {
  const code = String(countryCode || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(
    ...[...code].map((letter) => 127397 + letter.charCodeAt(0)),
  );
}

export function locationKind(featureCode = "") {
  const code = String(featureCode || "").toUpperCase();
  if (code === "PPLC") return "National capital";
  if (/^PPLA[1-4]?$/.test(code)) return "Administrative centre";
  if (code === "PPLX") return "Urban district";
  if (code.startsWith("PPL")) return "City or town";
  if (code.startsWith("ADM")) return "Administrative area";
  return "Mapped location";
}

export function formatPopulation(value) {
  const population = Number(value);
  if (!Number.isFinite(population) || population <= 0) return "";
  return `${COMPACT_NUMBER.format(population)} people`;
}

export function normalizeGeocodingResult(item) {
  if (!item || typeof item !== "object") return null;
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  const name = String(item.name || "").trim();
  if (
    !name ||
    item.latitude == null ||
    item.longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  return {
    id: item.id ?? `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    name,
    country: String(item.country || "").trim(),
    admin1: String(item.admin1 || "").trim(),
    admin2: String(item.admin2 || "").trim(),
    country_code: String(item.country_code || "")
      .trim()
      .toUpperCase(),
    latitude,
    longitude,
    timezone: String(item.timezone || "auto"),
    population: Number.isFinite(Number(item.population))
      ? Number(item.population)
      : null,
    feature_code: String(item.feature_code || ""),
    postcodes: Array.isArray(item.postcodes)
      ? item.postcodes.map(String).slice(0, 5)
      : [],
  };
}

export function parseCoordinateQuery(query) {
  const match = String(query || "")
    .trim()
    .match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  return {
    id: `coordinates:${latitude.toFixed(5)},${longitude.toFixed(5)}`,
    name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    country: "Coordinates",
    admin1: "Custom map location",
    country_code: "",
    latitude,
    longitude,
    timezone: "auto",
    population: null,
    feature_code: "COORD",
  };
}

function foldSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en");
}

export function rankLocationResults(items, query) {
  const term = foldSearchText(
    String(query || "")
      .split(",")[0]
      .trim(),
  );
  const normalized = (Array.isArray(items) ? items : [])
    .map(normalizeGeocodingResult)
    .filter(Boolean);
  const unique = new Map();
  for (const item of normalized) {
    const key = `${item.latitude.toFixed(4)}:${item.longitude.toFixed(4)}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()].sort((a, b) => {
    const aName = foldSearchText(a.name);
    const bName = foldSearchText(b.name);
    const aScore = aName === term ? 0 : aName.startsWith(term) ? 1 : 2;
    const bScore = bName === term ? 0 : bName.startsWith(term) ? 1 : 2;
    if (aScore !== bScore) return aScore - bScore;
    return (b.population || 0) - (a.population || 0);
  });
}
