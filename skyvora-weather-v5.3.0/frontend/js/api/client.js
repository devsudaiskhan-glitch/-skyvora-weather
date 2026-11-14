import { CONFIG } from "../config.js";

function locationParams(location, timezone = true) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(
      "This location has missing or invalid coordinates. Search for the city again and retry.",
    );
  }
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  if (timezone) params.set("timezone", String(location?.timezone || "auto"));
  return params.toString();
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? options.timeoutMs
    : CONFIG.requestTimeoutMs;
  const externalSignal = options.signal;
  const { signal: _signal, timeoutMs: _timeoutMs, ...fetchOptions } = options;
  const timeout = setTimeout(
    () =>
      controller.abort(new DOMException("Request timed out.", "TimeoutError")),
    timeoutMs,
  );
  const forwardAbort = () =>
    controller.abort(
      externalSignal?.reason ||
        new DOMException("Request was cancelled.", "AbortError"),
    );
  if (externalSignal?.aborted) forwardAbort();
  else externalSignal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    const response = await fetch(path, {
      ...fetchOptions,
      headers: { Accept: "application/json", ...(fetchOptions.headers || {}) },
      signal: controller.signal,
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        payload.message || `Request failed (${response.status})`,
      );
      error.status = response.status;
      error.requestPath = path;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", forwardAbort);
  }
}

export const api = {
  health: () => request("/api/health"),
  search: (
    query,
    language = "en",
    { count = 12, countryCode = "", signal } = {},
  ) => {
    const params = new URLSearchParams({
      q: query,
      language,
      count: String(count),
    });
    if (countryCode) params.set("countryCode", countryCode);
    return request(`/api/geocoding/search?${params}`, {
      signal,
      timeoutMs: CONFIG.searchTimeoutMs,
    });
  },
  forecast: (location) =>
    request(`/api/weather/forecast?${locationParams(location)}`),
  airQuality: (location) =>
    request(`/api/air-quality?${locationParams(location)}`, {
      timeoutMs: CONFIG.airQualityTimeoutMs,
    }),
  history: (location, startDate, endDate) =>
    request(
      `/api/weather/history?${locationParams(location)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
    ),
  marine: (location) => request(`/api/marine?${locationParams(location)}`),
};
