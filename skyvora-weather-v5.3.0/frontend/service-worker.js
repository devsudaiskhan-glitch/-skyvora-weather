const CACHE_NAME = "skyvora-shell-v5-3-0";
const CACHE_PREFIX = "skyvora-shell-";
const APP_SHELL = [
  "/",
  "/index.html",
  "/css/app.css",
  "/js/app.js",
  "/js/config.js",
  "/js/api/client.js",
  "/js/components/charts.js",
  "/js/services/storage.js",
  "/js/services/notifications.js",
  "/js/services/pwa.js",
  "/js/utils/icons.js",
  "/js/utils/weather.js",
  "/js/utils/solar.js",
  "/js/utils/scene.js",
  "/js/utils/outlook.js",
  "/js/utils/series.js",
  "/js/utils/search.js",
  "/js/localization/translations.js",
  "/assets/icons/skyvora-app-icon-192.png",
  "/assets/icons/skyvora-app-icon-512.png",
  "/assets/icons/skyvora-weather-logo.png",
  "/assets/icons/skyvora-apple-touch-icon.png",
  "/assets/icons/skyvora-favicon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // API responses are handled by the app/backend cache, never by the service worker.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        // Always try the current app files first so a new deployment cannot remain hidden
        // behind stale HTML, CSS or JavaScript from an older release.
        const response = await fetch(request, { cache: "no-cache" });
        if (response.ok && response.type !== "opaque") {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return (await cache.match("/index.html")) || Response.error();
        }
        throw error;
      }
    })(),
  );
});
