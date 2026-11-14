import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("V5.3.0 release identity is consistent across runtime and PWA assets", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.version, "5.3.0");
  assert.equal(
    JSON.parse(read("package-lock.json")).packages[""].version,
    pkg.version,
  );
  assert.match(read("backend/server.js"), /const BUILD_VERSION = '5\.3\.0'/);
  assert.match(read("frontend/js/config.js"), /appVersion: '5\.3\.0'/);
  assert.match(
    read("frontend/js/services/pwa.js"),
    /const BUILD_VERSION = '5\.3\.0'/,
  );
  assert.match(read("frontend/service-worker.js"), /skyvora-shell-v5-3-0/);
  assert.match(
    read("frontend/index.html"),
    /application-version" content="5\.3\.0/,
  );
  assert.match(
    read("frontend/manifest.webmanifest"),
    /Skyvora Weather 5\.3\.0/,
  );
  assert.match(read("frontend/index.html"), /app\.css/);
  assert.doesNotMatch(read("frontend/index.html"), /class="brand-copy"/);
  assert.match(read("frontend/service-worker.js"), /'\/css\/app\.css'/);
  assert.match(read("backend/server.js"), /X-Skyvora-Build/);
});

test("production hardening configures bounded rate limiting and no-store API policy", () => {
  const server = read("backend/server.js");
  assert.match(server, /Cache-Control', 'no-store/);
  assert.match(server, /API_RATE_LIMIT_WINDOW_MS/);
  assert.match(server, /API_RATE_LIMIT_MAX/);
  assert.ok(
    server.indexOf("app.use(helmet(") < server.indexOf("app.get('/api/build'"),
  );
  assert.match(server, /server\.closeAllConnections/);
  assert.match(server, /graceful shutdown timed out/);
  assert.match(
    read("docs/PRODUCTION-READINESS.md"),
    /per-process and is not a distributed limiter/,
  );
});

test("keyboard skip link, main landmark and visible focus affordance are present", () => {
  const html = read("frontend/index.html");
  assert.match(html, /class="skip-link" href="#viewRoot"/);
  assert.match(html, /<main[^>]+id="viewRoot"/);
  assert.match(read("frontend/css/tokens.css"), /:focus-visible/);
  assert.match(read("frontend/css/style.css"), /\.skip-link:focus/);
});

test("performance audit is described as static and not as Lighthouse evidence", () => {
  const audit = read("scripts/production-audit.js");
  assert.match(audit, /not a Lighthouse or browser run/);
  assert.match(read("package.json"), /audit:production/);
});

test("rebrand keeps existing local user data readable after upgrade", () => {
  const storage = read("frontend/js/services/storage.js");
  assert.match(storage, /skycast\.v2\./);
  assert.match(storage, /skycast-local/);
  assert.match(read("frontend/js/app.js"), /skycast\.v2\.theme/);
});

test("new brand icon is present and referenced by the app shell", () => {
  assert.match(read("frontend/index.html"), /skyvora-weather-logo\.png/);
  assert.doesNotMatch(read("frontend/index.html"), /skyvora-mark\.svg/);
  assert.match(
    read("frontend/manifest.webmanifest"),
    /skyvora-app-icon-192\.png/,
  );
  assert.match(read("frontend/index.html"), /skyvora-favicon\.png/);
  assert.match(read("frontend/index.html"), /shortcut icon/);
  assert.match(read("frontend/index.html"), /apple-touch-icon/);
  assert.match(read("frontend/service-worker.js"), /skyvora-app-icon-512\.png/);
  assert.match(read("frontend/service-worker.js"), /skyvora-weather-logo\.png/);
  assert.doesNotMatch(read("frontend/service-worker.js"), /skyvora-mark\.svg/);
  assert.ok(
    fs.existsSync(
      path.join(root, "frontend/assets/icons/skyvora-app-icon-512.png"),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(root, "frontend/assets/icons/skyvora-app-icon-192.png"),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(root, "frontend/assets/icons/skyvora-app-icon-512.png"),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(root, "frontend/assets/icons/skyvora-weather-logo.png"),
    ),
  );
});

test("brand mark is displayed without a square tile or cropped image", () => {
  const brandStyles = read("frontend/css/brand.css");
  const appStyles = read("frontend/css/style.css");
  assert.match(brandStyles, /background: transparent/);
  assert.match(brandStyles, /object-fit: contain/);
  assert.match(
    appStyles,
    /\.dashboard-view \.brand-mark img[^}]*object-fit: contain/s,
  );
  assert.match(read("frontend/index.html"), /SkyvoraWeather/);
});

test("brand home link stays on the current origin and does not hard-code a localhost port", () => {
  const html = read("frontend/index.html");
  assert.match(
    html,
    /<a class="brand" href="#dashboard" data-view="dashboard"/,
  );
  assert.doesNotMatch(html, /https?:\/\/localhost:\d+\/#dashboard/);
});

test("robots.txt is served as a crawler policy and not the SPA document", () => {
  const robots = read("frontend/robots.txt");
  assert.match(robots, /^User-agent: \*\nAllow: \/\n?$/);
  assert.doesNotMatch(robots, /<!doctype html|<html/i);
});

test("search and data visualizations use valid accessible semantics", () => {
  const html = read("frontend/index.html");
  const app = read("frontend/js/app.js");
  assert.match(
    html,
    /id="citySearch"[^>]*role="combobox"[^>]*aria-autocomplete="list"/,
  );
  assert.match(
    html,
    /class="top-avatar" role="img" aria-label="Guest profile"/,
  );
  assert.match(
    app,
    /class="aqi-scale" \$\{Number\.isFinite\(score\) \? `role=\"meter\"/,
  );
  assert.match(
    app,
    /id="weatherMap" role="region" aria-label="Interactive world map with eight weather test locations"/,
  );
  assert.match(app, /hourly-now-pulse" aria-hidden="true"/);
});

test("Leaflet assets are lazy-loaded instead of blocking the initial dashboard", () => {
  const html = read("frontend/index.html");
  const app = read("frontend/js/app.js");
  assert.doesNotMatch(html, /leaflet@1\.9\.4\/dist\/leaflet\.(?:js|css)/);
  assert.match(app, /async function loadLeaflet\(\)/);
  assert.match(app, /await loadLeaflet\(\)/);
});

test("V5.2.3 hydrates a validated local forecast before starting the live request", () => {
  const app = read("frontend/js/app.js");
  assert.match(
    app,
    /const savedWeatherSnapshot = readJSON\('last-weather', null\)/,
  );
  assert.match(app, /const hasUsableCachedForecast = Boolean\(/);
  assert.match(
    app,
    /weather: hasUsableCachedForecast \? cachedForecast : null/,
  );
  assert.match(
    app,
    /const weatherRequest = loadWeather\(state\.location, \{ quiet: true \}\)/,
  );
  const initialize = app.slice(app.indexOf("async function initialize()"));
  assert.doesNotMatch(initialize, /await loadWeather\(state\.location/);
});

test("V5.2.3 defers chart rendering and secondary icon hydration until after paint", () => {
  const app = read("frontend/js/app.js");
  assert.match(app, /requestAnimationFrame\(\(\) => \{/);
  assert.match(
    app,
    /if \(root\.querySelector\('#mainChart'\)\) renderChart\(\)/,
  );
});

test("V5.2.3 does not request Google Fonts on the initial page path", () => {
  const html = read("frontend/index.html");
  const app = read("frontend/js/app.js");
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(app, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(read("frontend/css/tokens.css"), /--font: system-ui/);
});

test("V5.2.3 requests only the active day/night scene background", () => {
  const css = read("frontend/css/app.css");
  assert.match(
    css,
    /body\.dashboard-view\[data-sky-scene="day"\] \.scene-backdrop::after\{background-image:none!important/,
  );
  assert.match(
    css,
    /body\.dashboard-view\[data-sky-scene="night"\] \.scene-backdrop::before\{background-image:none!important/,
  );
  assert.match(read("frontend/js/utils/scene.js"), /w=1600&q=82/);
});

test("V5.2.3 bounds forecast and air-quality provider waits without retrying slow critical calls", () => {
  const routes = read("backend/routes/api.js");
  assert.match(
    routes,
    /category: 'forecast',[^}]*timeoutMs: 12_000, maxAttempts: 2/,
  );
  assert.match(
    routes,
    /category: 'air-quality',[^}]*timeoutMs: 6_000, maxAttempts: 1/,
  );
  assert.match(
    read("backend/services/openMeteo.js"),
    /timeoutMs, maxAttempts, retryDelayBaseMs/,
  );
  assert.match(read("frontend/js/config.js"), /requestTimeoutMs: 28000/);
});

test("V5.2.3 defers chart and notification modules from the initial static module graph", () => {
  const app = read("frontend/js/app.js");
  assert.doesNotMatch(app, /import \{ renderLineChart/);
  assert.doesNotMatch(app, /import \{ requestNotificationPermission/);
  assert.match(app, /import\('\.\/components\/charts\.js'\)/);
  assert.match(app, /import\('\.\/services\/notifications\.js'\)/);
});

test("V5.2.3 applies content visibility to below-the-fold dashboard sections", () => {
  const css = read("frontend/css/app.css");
  assert.match(
    css,
    /\.reference-dashboard > \.reference-bottom-grid[\s\S]*?content-visibility: auto/,
  );
  assert.match(css, /contain-intrinsic-size: auto 620px/);
});

test("V5.3.0 world explorer contains all eight test locations and opens real city forecasts", () => {
  const app = read("frontend/js/app.js");
  assert.match(app, /const WEATHER_EXPLORER_PLACES = Object\.freeze\(\[/);
  for (const place of [
    "Cherrapunji",
    "London",
    "Phoenix",
    "Tromsø",
    "San Francisco",
    "Darwin",
    "Reykjavík",
    "Islamabad",
  ]) {
    assert.ok(
      app.includes(`name: '${place}'`),
      `Missing map test region: ${place}`,
    );
  }
  assert.match(app, /data-action="open-city" data-lat=/);
  assert.match(app, /Interactive world map with eight weather test locations/);
});

test("V5.3.0 photographic weather overlays are in the served CSS bundle and honor reduced motion", () => {
  const css = read("frontend/css/app.css");
  const scenes = read("frontend/js/utils/scene.js");
  assert.match(scenes, /photo-1605727216801-e27ce1d0cc28/);
  assert.match(scenes, /photo-1485236715568-ddc5ee6ca227/);
  assert.match(css, /skyvora-cloud-drift/);
  assert.doesNotMatch(css, /weather-motion-rain|skyvora-rain-fall/);
  assert.match(scenes, /photo-1512511708753-3150cd2ec8ee/);
  assert.match(css, /skyvora-snow-fall/);
  assert.match(css, /skyvora-fog-drift/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
