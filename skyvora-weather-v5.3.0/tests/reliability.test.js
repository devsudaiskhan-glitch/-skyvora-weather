import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCoordinates,
  isValidISODate,
  validateHistoricalRange,
  normalizeSearchCount,
} from "../backend/utils/validation.js";
import { fetchProviderJson } from "../backend/services/providerHttp.js";

test("coordinate validation rejects missing, non-numeric and out-of-range values", () => {
  assert.deepEqual(parseCoordinates("33.6844", "73.0479"), {
    latitude: 33.6844,
    longitude: 73.0479,
  });
  assert.equal(parseCoordinates("", "73"), null);
  assert.equal(parseCoordinates("north", "73"), null);
  assert.equal(parseCoordinates("90.01", "73"), null);
  assert.equal(parseCoordinates("33", "-180.01"), null);
});

test("historical date validation rejects impossible dates, future dates and ranges over 31 days", () => {
  assert.equal(isValidISODate("2024-02-29"), true);
  assert.equal(isValidISODate("2025-02-29"), false);
  assert.equal(
    validateHistoricalRange("2026-01-01", "2026-01-31", "2026-02-01").days,
    30,
  );
  assert.equal(
    validateHistoricalRange("2026-01-01", "2026-02-02", "2026-02-03"),
    null,
  );
  assert.equal(
    validateHistoricalRange("2026-02-01", "2026-02-01", "2026-02-01"),
    null,
  );
});

test("geocoding result count accepts only whole numbers from 1 through 20", () => {
  assert.equal(normalizeSearchCount(undefined), 12);
  assert.equal(normalizeSearchCount("20"), 20);
  assert.equal(normalizeSearchCount("0"), null);
  assert.equal(normalizeSearchCount("21"), null);
  assert.equal(normalizeSearchCount("12abc"), null);
});

test("provider timeout is bounded and returns a retryable gateway timeout", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener(
        "abort",
        () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        },
        { once: true },
      );
    });
  try {
    await assert.rejects(
      fetchProviderJson("https://provider.invalid/weather", {
        timeoutMs: 8,
        maxAttempts: 1,
        category: "test",
      }),
      (error) =>
        error.statusCode === 504 &&
        error.retryable === true &&
        /timed out/.test(error.message),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider retries a transient HTTP error once and accepts the recovery response", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1)
      return new Response(JSON.stringify({ reason: "temporary outage" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    return new Response(JSON.stringify({ current: { temperature_2m: 22 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const result = await fetchProviderJson("https://provider.invalid/weather", {
      timeoutMs: 100,
      maxAttempts: 2,
      retryDelayBaseMs: 0,
      category: "test",
    });
    assert.deepEqual(result, { current: { temperature_2m: 22 } });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider does not retry a non-transient validation error", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ reason: "invalid request" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await assert.rejects(
      fetchProviderJson("https://provider.invalid/weather", {
        timeoutMs: 100,
        maxAttempts: 3,
        retryDelayBaseMs: 0,
        category: "test",
      }),
      (error) => error.statusCode === 502 && error.retryable === false,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider safely normalizes getter-only Fetch error messages and retries network failures", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error("network unreachable");
      Object.defineProperty(error, "message", {
        get: () => "network unreachable",
      });
      throw error;
    }
    return new Response(JSON.stringify({ current: { temperature_2m: 19 } }), {
      status: 200,
    });
  };
  try {
    const result = await fetchProviderJson("https://provider.invalid/weather", {
      timeoutMs: 100,
      maxAttempts: 2,
      retryDelayBaseMs: 0,
      category: "test",
    });
    assert.deepEqual(result, { current: { temperature_2m: 19 } });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
