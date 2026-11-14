const DEFAULT_TIMEOUT_MS = 12_000;
export const DEFAULT_MAX_ATTEMPTS = 2;
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseProviderErrorBody(bodyText) {
  if (!bodyText) return {};
  try {
    return JSON.parse(bodyText);
  } catch {
    return { message: bodyText.slice(0, 300) };
  }
}

/** Fetch JSON from the weather provider with a strict timeout and bounded retry policy. */
export async function fetchProviderJson(
  url,
  {
    category = "weather",
    started = performance.now(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    retryDelayBaseMs = 700,
  } = {},
) {
  let lastError = null;
  const safeTimeoutMs =
    Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 60_000
      ? timeoutMs
      : DEFAULT_TIMEOUT_MS;
  const safeAttempts =
    Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 3
      ? maxAttempts
      : DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 1; attempt <= safeAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), safeTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const body = parseProviderErrorBody(
          await response.text().catch(() => ""),
        );
        const providerStatus = response.status;
        const error = new Error(
          body.reason ||
            body.message ||
            `Weather provider returned HTTP ${providerStatus}.`,
        );
        error.providerStatus = providerStatus;
        error.statusCode = providerStatus === 429 ? 503 : 502;
        error.retryable = RETRYABLE_HTTP_STATUSES.has(providerStatus);
        error.retryAfterMs = Math.min(
          2500,
          Math.max(0, Number(response.headers.get("retry-after") || 0) * 1000),
        );
        throw error;
      }

      let data;
      try {
        data = await response.json();
      } catch {
        const error = new Error(
          "Weather provider returned an unreadable JSON response.",
        );
        error.statusCode = 502;
        error.retryable = true;
        throw error;
      }
      if (!data || data.error) {
        const error = new Error(
          data?.reason || "Weather provider returned an invalid response.",
        );
        error.statusCode = 502;
        error.retryable = false;
        throw error;
      }
      return data;
    } catch (caughtError) {
      // DOMException/Fetch errors can expose a getter-only `message`; never mutate
      // provider-owned errors. Normalize into a fresh, writable Error instance.
      const timedOut =
        caughtError?.name === "AbortError" ||
        caughtError?.name === "TimeoutError";
      const hasStatus = Number.isInteger(caughtError?.statusCode);
      const statusCode = timedOut
        ? 504
        : hasStatus
          ? caughtError.statusCode
          : 503;
      const message = timedOut
        ? `${category} provider request timed out after ${safeTimeoutMs / 1000} seconds.`
        : hasStatus
          ? String(
              caughtError.message || `${category} provider request failed.`,
            )
          : `${category} provider is temporarily unreachable.`;
      const error = new Error(message, { cause: caughtError });
      error.name = timedOut ? "ProviderTimeoutError" : "ProviderRequestError";
      error.statusCode = statusCode;
      error.retryable =
        timedOut || !hasStatus || Boolean(caughtError?.retryable);
      if (Number.isFinite(caughtError?.retryAfterMs))
        error.retryAfterMs = caughtError.retryAfterMs;
      if (Number.isInteger(caughtError?.providerStatus))
        error.providerStatus = caughtError.providerStatus;
      lastError = error;
      if (!error.retryable || attempt === safeAttempts) break;
      const retryAfter = Number(error.retryAfterMs) || 0;
      const waitMs =
        retryAfter > 0 ? retryAfter : attempt * Math.max(0, retryDelayBaseMs);
      console.warn(
        `[provider] ${category} attempt ${attempt}/${safeAttempts} failed (${error.statusCode}); retrying in ${waitMs}ms.`,
      );
      await delay(waitMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError) {
    lastError.durationMs = Math.round(performance.now() - started);
    throw lastError;
  }
  const fallbackError = new Error(
    "Weather provider request failed without a response.",
  );
  fallbackError.statusCode = 502;
  fallbackError.retryable = true;
  throw fallbackError;
}
