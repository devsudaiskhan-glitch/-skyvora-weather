/** Input validation shared by API routes and unit tests. */
export function parseCoordinates(latitudeValue, longitudeValue) {
  if (
    latitudeValue === undefined ||
    latitudeValue === null ||
    latitudeValue === "" ||
    longitudeValue === undefined ||
    longitudeValue === null ||
    longitudeValue === ""
  )
    return null;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  return { latitude, longitude };
}

export function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function validateHistoricalRange(
  start,
  end,
  today = new Date().toISOString().slice(0, 10),
) {
  if (
    !isValidISODate(start) ||
    !isValidISODate(end) ||
    start > end ||
    end >= today
  )
    return null;
  const days =
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
    86400000;
  if (!Number.isInteger(days) || days > 31) return null;
  return { start, end, days };
}

export function normalizeSearchCount(value, fallback = 12) {
  if (value === undefined || value === null || value === "") return fallback;
  const raw = String(value);
  if (!/^\d{1,3}$/.test(raw)) return null;
  const parsed = Number(raw);
  return parsed >= 1 && parsed <= 20 ? parsed : null;
}
