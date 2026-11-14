import mongoose from "mongoose";
import { createHash } from "node:crypto";
import WeatherCache from "../models/WeatherCache.js";
import ApiMetric from "../models/ApiMetric.js";
import { fetchProviderJson, DEFAULT_MAX_ATTEMPTS } from "./providerHttp.js";
export { fetchProviderJson } from "./providerHttp.js";

const memoryCache = new Map();
const inFlight = new Map();
const MEMORY_CACHE_LIMIT = 180;
const DEFAULT_TTL = 8 * 60 * 1000;
const MAX_STALE_AGE_MS = 6 * 60 * 60 * 1000;

function cacheKey(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete("apikey");
  const namespace = process.env.OPEN_METEO_CACHE_NAMESPACE || "default";
  return createHash("sha256")
    .update(`${namespace}:${parsed.toString()}`)
    .digest("hex");
}

function pruneCache() {
  if (memoryCache.size <= MEMORY_CACHE_LIMIT) return;
  const oldest = [...memoryCache.entries()]
    .sort((a, b) => a[1].createdAt - b[1].createdAt)
    .slice(0, memoryCache.size - MEMORY_CACHE_LIMIT);
  oldest.forEach(([key]) => memoryCache.delete(key));
}

async function recordMetric(category, durationMs, status, statusCode) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    // The schema intentionally stores only success/error/cache categories.
    const metricStatus =
      status === "success" || status === "error" ? status : "cache";
    await ApiMetric.create({
      provider: "open-meteo",
      category,
      durationMs,
      status: metricStatus,
      statusCode,
    });
  } catch (error) {
    console.warn("[metrics] Could not persist API metric:", error.message);
  }
}

async function findStaleCache(key) {
  const cutoff = Date.now() - MAX_STALE_AGE_MS;
  const inMemory = memoryCache.get(key);
  if (inMemory && inMemory.createdAt >= cutoff) {
    return {
      data: inMemory.data,
      fetchedAt: new Date(inMemory.createdAt).toISOString(),
      staleAgeMs: Date.now() - inMemory.createdAt,
    };
  }

  if (mongoose.connection.readyState === 1) {
    try {
      // TTL deletion is asynchronous, so a recently expired MongoDB record may still exist.
      const stored = await WeatherCache.findOne({
        cacheKey: key,
        expiresAt: { $gt: new Date(cutoff) },
      })
        .sort({ fetchedAt: -1 })
        .lean();

      if (stored?.payload && stored.fetchedAt) {
        const createdAt = new Date(stored.fetchedAt).getTime();
        if (Number.isFinite(createdAt) && createdAt >= cutoff) {
          memoryCache.set(key, {
            data: stored.payload,
            createdAt,
            expiresAt: new Date(stored.expiresAt).getTime(),
          });
          return {
            data: stored.payload,
            fetchedAt: new Date(createdAt).toISOString(),
            staleAgeMs: Date.now() - createdAt,
          };
        }
      }
    } catch (error) {
      console.warn(
        "[cache] Could not read stale MongoDB cache:",
        error.message,
      );
    }
  }
  return null;
}

export async function fetchWeatherJson(
  url,
  {
    category = "weather",
    ttl = DEFAULT_TTL,
    timeoutMs,
    maxAttempts,
    retryDelayBaseMs,
  } = {},
) {
  const key = cacheKey(url);
  const now = Date.now();
  const memoryHit = memoryCache.get(key);

  if (memoryHit && memoryHit.expiresAt > now) {
    await recordMetric(category, 0, "cache", 200);
    return {
      data: memoryHit.data,
      cached: true,
      stale: false,
      fetchedAt: new Date(memoryHit.createdAt).toISOString(),
    };
  }

  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    const started = performance.now();
    try {
      if (mongoose.connection.readyState === 1) {
        try {
          const stored = await WeatherCache.findOne({
            cacheKey: key,
            expiresAt: { $gt: new Date() },
          }).lean();
          if (stored?.payload) {
            const createdAt = stored.fetchedAt.getTime();
            memoryCache.set(key, {
              data: stored.payload,
              createdAt,
              expiresAt: stored.expiresAt.getTime(),
            });
            await recordMetric(category, 0, "cache", 200);
            return {
              data: stored.payload,
              cached: true,
              stale: false,
              fetchedAt: stored.fetchedAt.toISOString(),
            };
          }
        } catch (error) {
          console.warn(
            "[cache] MongoDB read failed; using live provider:",
            error.message,
          );
        }
      }

      const data = await fetchProviderJson(url, {
        category,
        started,
        timeoutMs,
        maxAttempts,
        retryDelayBaseMs,
      });
      const duration = Math.round(performance.now() - started);
      const createdAt = Date.now();
      const expiresAt = createdAt + ttl;

      memoryCache.set(key, { data, createdAt, expiresAt });
      pruneCache();

      if (mongoose.connection.readyState === 1) {
        try {
          await WeatherCache.findOneAndUpdate(
            { cacheKey: key },
            {
              cacheKey: key,
              provider: "open-meteo",
              category,
              payload: data,
              fetchedAt: new Date(createdAt),
              expiresAt: new Date(expiresAt),
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        } catch (error) {
          console.warn(
            "[cache] MongoDB write failed; memory cache remains active:",
            error.message,
          );
        }
      }

      await recordMetric(category, duration, "success", 200);
      return {
        data,
        cached: false,
        stale: false,
        fetchedAt: new Date(createdAt).toISOString(),
        durationMs: duration,
      };
    } catch (error) {
      const duration = Math.round(performance.now() - started);
      const canUseStale =
        error.retryable === true ||
        error.statusCode === 503 ||
        error.statusCode === 504;

      if (canUseStale) {
        const stale = await findStaleCache(key);
        if (stale) {
          console.warn(
            `[cache] Serving ${category} from stale cache (${Math.round(stale.staleAgeMs / 60000)} minutes old) after upstream failure: ${error.message}`,
          );
          await recordMetric(category, duration, "cache", 200);
          return {
            data: stale.data,
            cached: true,
            stale: true,
            fetchedAt: stale.fetchedAt,
            staleAgeMs: stale.staleAgeMs,
            durationMs: duration,
            warning:
              "Live provider temporarily unavailable; showing the last successful response.",
          };
        }
      }

      await recordMetric(
        category,
        duration,
        "error",
        error.providerStatus || error.statusCode || 502,
      );
      if (!Number.isInteger(error.statusCode)) error.statusCode = 502;
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export function providerStatus() {
  return {
    name: "Open-Meteo",
    live: true,
    cacheEntries: memoryCache.size,
    mongoCache: mongoose.connection.readyState === 1,
    retryAttempts: DEFAULT_MAX_ATTEMPTS,
    staleFallbackHours: MAX_STALE_AGE_MS / 3600000,
  };
}
