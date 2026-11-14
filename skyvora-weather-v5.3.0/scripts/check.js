import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontendRoot = path.join(projectRoot, "frontend");
const failures = [];
const warnings = [];
const check = (condition, message) =>
  condition ? console.log(`✓ ${message}`) : failures.push(message);

function read(relative) {
  return fs.readFileSync(path.join(projectRoot, relative), "utf8");
}

// Validate the source tree and every local JavaScript module with Node's parser.
const jsFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && entry.name.endsWith(".js"))
      jsFiles.push(absolute);
  }
}
walk(frontendRoot);
walk(path.join(projectRoot, "backend"));
check(
  jsFiles.length > 0,
  `Found ${jsFiles.length} frontend/backend JavaScript files`,
);
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    failures.push(
      `JavaScript syntax error in ${path.relative(projectRoot, file)}: ${error.stderr?.toString() || error.message}`,
    );
  }
}
if (
  jsFiles.length &&
  !failures.some((item) => item.includes("JavaScript syntax error"))
) {
  console.log(
    `✓ JavaScript syntax validation passed (${jsFiles.length} files)`,
  );
}

const html = read("frontend/index.html");
const robots = read("frontend/robots.txt");
check(
  /^User-agent: \*\nAllow: \/\n?$/.test(robots),
  "robots.txt is a valid plain-text crawler policy",
);
check(
  !html.includes("leaflet@1.9.4/dist/leaflet.js") &&
    !html.includes("leaflet@1.9.4/dist/leaflet.css"),
  "Leaflet assets are excluded from the initial dashboard document",
);
check(
  html.includes('role="combobox"') &&
    html.includes('aria-controls="searchResults"'),
  "Worldwide search input exposes combobox semantics",
);
const accessibilitySource = read("frontend/js/app.js");
check(
  accessibilitySource.includes('role=\"meter\"') &&
    accessibilitySource.includes(
      'role=\"img\" aria-label=\"US AQI scale; current measurement unavailable\"',
    ) &&
    accessibilitySource.includes(
      'role=\"region\" aria-label=\"Interactive world map',
    ),
  "AQI scale and map expose accessible roles and names",
);
check(
  html.includes('class="top-avatar" role="img" aria-label="Guest profile"'),
  "Guest avatar has an accessible image role",
);
check(
  accessibilitySource.includes("async function loadLeaflet()") &&
    accessibilitySource.includes("leaflet.tileLayer"),
  "Leaflet is loaded on demand by the Maps view",
);
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(
  (match) => match[1],
);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
check(
  duplicates.length === 0,
  duplicates.length
    ? `Duplicate HTML IDs: ${[...new Set(duplicates)].join(", ")}`
    : `HTML IDs are unique (${ids.length} IDs)`,
);

const htmlRefs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(
  (match) => match[1],
);
for (const ref of htmlRefs) {
  if (/^(?:https?:|mailto:|tel:|#|data:|javascript:)/i.test(ref)) continue;
  const clean = ref.split(/[?#]/)[0];
  const absolute = path.join(frontendRoot, clean.replace(/^\//, ""));
  check(fs.existsSync(absolute), `HTML asset exists: ${ref}`);
}

const sw = read("frontend/service-worker.js");
const shellBlock = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
const shellItems = shellBlock
  ? [...shellBlock[1].matchAll(/'((?:\/)[^']+)'/g)].map((match) => match[1])
  : [];
check(Boolean(shellBlock), "Service worker app-shell list is present");
const serviceWorkerSource = read("frontend/service-worker.js");
check(
  serviceWorkerSource.includes("skyvora-shell-v5-3-0"),
  "Service worker cache is versioned for V5.3.0",
);
check(
  html.includes("/css/app.css") && !html.includes("/css/style.css"),
  "Initial document requests one combined local stylesheet",
);
check(
  read("frontend/js/app.js").includes("void loadAirQuality({ quiet: true })") &&
    read("frontend/js/app.js").indexOf("render();\n    updateSideLocation();") <
      read("frontend/js/app.js").indexOf(
        "void loadAirQuality({ quiet: true })",
      ),
  "Primary weather dashboard renders before secondary air-quality data",
);
check(
  read("frontend/css/app.css").includes("content-visibility:auto"),
  "Below-the-fold dashboard layout uses content visibility",
);
check(
  serviceWorkerSource.includes("fetch(request, { cache: 'no-cache' })"),
  "Service worker refreshes app assets from the network first",
);
check(
  serviceWorkerSource.includes("'/js/utils/solar.js'"),
  "Solar helper is included in the offline app shell",
);
check(
  serviceWorkerSource.includes("'/js/utils/scene.js'") &&
    serviceWorkerSource.includes("'/js/utils/outlook.js'"),
  "Scene and outlook helpers are included in the offline app shell",
);
const serverSource = read("backend/server.js");
check(
  serverSource.includes("app.get('/api/build'") &&
    serverSource.includes("'5.3.0'"),
  "Build identity endpoint is configured for V5.3.0",
);
check(
  serverSource.includes("5065") && read(".env.example").includes("PORT=5065"),
  "Isolated development port 5065 is configured",
);
check(
  serverSource.includes("server.closeAllConnections") &&
    serverSource.includes("graceful shutdown timed out"),
  "Production shutdown drains requests and has a bounded forced-exit path",
);
check(
  serverSource.includes("res.set('Cache-Control', 'no-store')"),
  "API responses are marked non-cacheable by browsers and intermediaries",
);
check(
  serverSource.includes("https://images.pexels.com"),
  "Pexels photo host is allowed by the content security policy",
);
const forecastFields = read("backend/services/openMeteoFields.js");
check(
  forecastFields.includes("FORECAST_DAILY_FIELDS") &&
    !/['\"](?:temperature_2m_mean|relative_humidity_2m_mean|cloud_cover_mean|apparent_temperature_mean|dew_point_2m_mean|pressure_msl_mean|visibility_mean)['\"]/.test(
      forecastFields,
    ),
  "Forecast daily request excludes unsupported daily mean variables",
);
check(
  read("frontend/js/utils/series.js").includes("averageHourlyByDate") &&
    read("frontend/js/app.js").includes("averageHourlyByDate(hourlyData"),
  "10-day mean trends are calculated from real hourly observations/forecast samples",
);
check(
  read("backend/routes/api.js").includes("us_aqi_pm2_5") &&
    read("backend/routes/api.js").includes("us_aqi_carbon_monoxide"),
  "Pollutant-specific US AQI sub-indices are requested from Open-Meteo",
);
check(
  read("backend/routes/api.js").includes("forecast_days: 3"),
  "Air-quality provider requests enough forecast days for a rolling 48-hour window",
);
check(
  serverSource.includes("https://unpkg.com"),
  "Leaflet source-map host is allowed by the content security policy",
);
check(
  read("frontend/css/style.css").includes(
    ".map-note > svg { display: block; width: 17px; height: 17px;",
  ),
  "Map note SVG is constrained to a compact icon size",
);
const dashboardSource = read("frontend/js/app.js");
check(
  dashboardSource.includes('class=\"reference-dashboard\"') &&
    dashboardSource.includes("Today's Highlights") &&
    dashboardSource.includes("5-Day Forecast"),
  "Reference-inspired dashboard markup is present",
);
check(
  dashboardSource.includes("24-Hour Forecast") &&
    dashboardSource.includes("hourlySummaryMarkup"),
  "Enhanced 24-hour forecast module is present",
);
check(
  dashboardSource.includes("wind-compass-stage") &&
    dashboardSource.includes("compassDirection16"),
  "Instrument-style wind compass is present",
);
check(
  dashboardSource.includes("daylight-orbit") &&
    dashboardSource.includes("getDaylightProgress"),
  "Solar daylight progress visualization is present",
);
check(
  read("frontend/css/style.css").includes(".hourly-summary-row") &&
    read("frontend/css/style.css").includes(".wind-compass-face") &&
    read("frontend/css/style.css").includes(".daylight-orbit"),
  "Premium hourly, compass and daylight styles are present",
);
check(
  dashboardSource.includes("Weather Trends") &&
    dashboardSource.includes('data-chart-range=\"10d\"') &&
    dashboardSource.includes("chart === 'clouds'") &&
    dashboardSource.includes("chart === 'uv'") &&
    dashboardSource.includes("chart === 'pressure'") &&
    dashboardSource.includes("chart === 'dewpoint'") &&
    dashboardSource.includes("chart === 'visibility'") &&
    dashboardSource.includes("chart === 'sunshine'"),
  "Weather Trends supports 11 metrics across 24-hour and 10-day ranges",
);
check(
  dashboardSource.includes("renderSmartOutlook") &&
    dashboardSource.includes("buildWeatherOutlook"),
  "Smart 24-hour outlook derives rain, temperature, wind and UV highlights from hourly data",
);
check(
  dashboardSource.includes("aqiMetricSelect") &&
    dashboardSource.includes("us_aqi_pm2_5") &&
    dashboardSource.includes("data-aqi-range") &&
    dashboardSource.includes("selectTimeWindow") &&
    dashboardSource.includes("carbon_monoxide") &&
    dashboardSource.includes("pm2_5"),
  "Air Quality page supports 24/48-hour AQI and pollutant concentration trends",
);
check(
  read("frontend/js/services/pwa.js").includes("const BUILD_VERSION = '5.3.0'"),
  "PWA install lifecycle and update identity match V5.3.0",
);
check(
  read("frontend/service-worker.js").includes("'/js/utils/series.js'"),
  "Time-series selector is included in the offline app shell",
);
check(
  dashboardSource.includes("const localToday = String(c?.time") &&
    dashboardSource.includes(
      "dailyRows().filter((day) => day.date >= localToday)",
    ),
  "Dashboard and forecast use current local dates, excluding the context-only historical day",
);
check(
  dashboardSource.includes("aqi-gauge") &&
    dashboardSource.includes("premium-pollutant-grid") &&
    dashboardSource.includes("pollutantSparkline"),
  "Premium AQI gauge and pollutant trend cards are present",
);
check(
  dashboardSource.includes("syncWeatherBackdrop") &&
    dashboardSource.includes("getWeatherScenePhotos") &&
    dashboardSource.includes("resolveIsDay"),
  "Weather scene switches by condition and provider day/night flag",
);
const trendCss = read("frontend/css/style.css");
check(
  trendCss.includes(".trend-premium-panel") &&
    trendCss.includes(".trend-summary-row") &&
    trendCss.includes(".smart-outlook-grid"),
  "Premium Weather Trends and Smart Outlook styles are present",
);
const translationSource = read("frontend/js/localization/translations.js");
check(
  !/value=\"ur\"|>اردو<|\bUrdu\b|urdu:/.test(
    dashboardSource + translationSource,
  ),
  "Urdu is removed from the language UI and translations",
);
check(
  dashboardSource.includes("language: 'en'") &&
    dashboardSource.includes("document.documentElement.dir='ltr'"),
  "Application language is fixed to English LTR",
);
check(
  dashboardSource.includes("trendControlsMarkup()") &&
    dashboardSource.includes("trend-control-label") &&
    dashboardSource.includes("trend-range-group"),
  "Weather Trends controls use distinct labeled groups",
);
check(
  trendCss.includes("grid-template-columns: repeat(6, minmax(0, 1fr))") &&
    trendCss.includes("grid-template-columns: repeat(3, minmax(0, 1fr))") &&
    trendCss.includes("gap: 7px"),
  "Weather Trends metric buttons have responsive spacing and wrapping",
);
check(
  trendCss.includes(".aqi-gauge") &&
    trendCss.includes(".premium-pollutant-grid") &&
    trendCss.includes(".aqi-driver") &&
    trendCss.includes(".aqi-trend-summary"),
  "Premium Air Quality visuals and sub-index trend styles are present",
);
check(
  trendCss.includes("var(--scene-day-photo") &&
    trendCss.includes("var(--scene-night-photo") &&
    read("frontend/js/utils/scene.js").includes("storm:") &&
    read("frontend/js/utils/scene.js").includes("current?.is_day !== null"),
  "Condition-specific day and night scenic images are configured",
);
for (const item of shellItems) {
  const absolute = path.join(frontendRoot, item.replace(/^\//, ""));
  check(fs.existsSync(absolute), `PWA shell asset exists: ${item}`);
}

// Resolve relative static imports so missing project modules are caught before ZIP delivery.
for (const file of jsFiles) {
  const source = fs.readFileSync(file, "utf8");
  const imports = [
    ...source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g),
  ].map((match) => match[1]);
  for (const specifier of imports) {
    const target = path.resolve(path.dirname(file), specifier);
    check(
      fs.existsSync(target),
      `Module import exists: ${path.relative(projectRoot, file)} → ${specifier}`,
    );
  }
}

// Verify all icon names used in literal icon() calls and static data-icon markup.
const iconSource = read("frontend/js/utils/icons.js");
check(
  iconSource.includes("settings:") && html.includes('data-icon="settings"'),
  "Consistent gear settings icon is used in desktop and mobile navigation",
);
const iconKeys = new Set(
  [...iconSource.matchAll(/(?:'([^']+)'|([A-Za-z0-9_-]+))\s*:/g)].map(
    (match) => match[1] || match[2],
  ),
);
const usedNames = new Set();
for (const sourceFile of jsFiles) {
  const source = fs.readFileSync(sourceFile, "utf8");
  for (const match of source.matchAll(/\bicon\(['"]([^'"]+)['"]/g))
    usedNames.add(match[1]);
}
for (const match of html.matchAll(/data-icon=["']([^"']+)["']/g))
  usedNames.add(match[1]);
for (const name of usedNames) check(iconKeys.has(name), `Icon exists: ${name}`);

// Check literal ID selectors used by the app against static or dynamically rendered HTML IDs.
const appSource = read("frontend/js/app.js");
const renderedIds = new Set(
  [...html.matchAll(/\bid=[\"']([^\"']+)[\"']/g)].map((match) => match[1]),
);
for (const match of appSource.matchAll(/\bid=[\"']([^\"']+)[\"']/g))
  renderedIds.add(match[1]);
const queriedIds = new Set(
  [...appSource.matchAll(/\$\(['\"]#([^'\"]+)['\"]/g)].map((match) => match[1]),
);
for (const id of queriedIds)
  check(renderedIds.has(id), `Queried element ID is defined: #${id}`);

// Check manifest JSON and package metadata.
try {
  JSON.parse(read("frontend/manifest.webmanifest"));
  console.log("✓ PWA manifest is valid JSON");
} catch (error) {
  failures.push(`Invalid PWA manifest: ${error.message}`);
}
try {
  const pkg = JSON.parse(read("package.json"));
  check(pkg.type === "module", "package.json enables ES modules");
  check(
    Boolean(
      pkg.scripts?.start &&
      pkg.scripts?.dev &&
      pkg.scripts?.test &&
      pkg.scripts?.check,
    ),
    "Required npm scripts are declared",
  );
  check(
    Boolean(pkg.dependencies?.express && pkg.dependencies?.mongoose),
    "Express and Mongoose dependencies are declared",
  );
} catch (error) {
  failures.push(`Invalid package.json: ${error.message}`);
}

// Check that no real local environment file is included in the source project.
check(
  !fs.existsSync(path.join(projectRoot, ".env")),
  "No real .env file is included in the source tree",
);
check(
  fs.existsSync(path.join(projectRoot, ".env.example")),
  "Safe .env.example exists",
);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:`);
  failures.forEach((failure) => console.error(`✗ ${failure}`));
  process.exitCode = 1;
} else {
  const searchUtils = read("frontend/js/utils/search.js");
  check(
    searchUtils.includes("countryFlagEmoji") &&
      searchUtils.includes("normalizeGeocodingResult"),
    "Worldwide search normalizes global places and shows ISO country flags",
  );
  check(
    searchUtils.includes("parseCoordinateQuery") &&
      searchUtils.includes("rankLocationResults"),
    "Search supports exact coordinates, deduplication and relevance ranking",
  );
  check(
    read("backend/routes/api.js").includes(
      "name: query, count, language, format: 'json'",
    ) &&
      read("backend/routes/api.js").includes(
        "params.countryCode = countryCode",
      ),
    "Geocoding API supports worldwide result count, language and ISO country filtering",
  );
  check(
    read("frontend/js/api/client.js").includes("searchTimeoutMs") &&
      read("frontend/js/api/client.js").includes("externalSignal"),
    "Search requests support a dedicated timeout and AbortController cancellation",
  );
  check(
    dashboardSource.includes("clearTimeout(state.searchTimer)") &&
      dashboardSource.includes("Search is taking too long"),
    "Search cancels pending debounce work and renders a useful timeout state",
  );
  check(
    dashboardSource.includes("state.searchResults = [];") &&
      dashboardSource.includes("Getting locations ready"),
    "New queries clear stale options before the autocomplete debounce expires",
  );
  check(
    searchUtils.includes("normalize('NFD')"),
    "Search ranking is accent-insensitive for international place names",
  );
  check(
    dashboardSource.includes("WORLDWIDE LOCATION MATCHES") &&
      dashboardSource.includes("SAVED PLACES") &&
      dashboardSource.includes("RECENTLY VIEWED"),
    "Search dropdown includes a premium worldwide results panel, saved places and recent locations",
  );
  check(
    dashboardSource.includes("Searching worldwide locations") &&
      dashboardSource.includes("search-retry-button") &&
      dashboardSource.includes("searchInput.setAttribute('aria-expanded'"),
    "Search has loading, retry/error and accessible combobox states",
  );
  check(
    read("frontend/service-worker.js").includes("'/js/utils/search.js'") &&
      read("frontend/service-worker.js").includes("skyvora-shell-v5-3-0"),
    "Search module is precached and service-worker cache is versioned for V5.3.0",
  );
  check(
    read("backend/server.js").includes("'5.3.0'") &&
      read("backend/server.js").includes("worldwide-geonames-autocomplete"),
    "Build endpoint identifies the V5.3.0 worldwide search release",
  );

  const responsiveSource = read("frontend/css/responsive.css");
  check(
    responsiveSource.includes("@media (max-width: 1280px)") &&
      responsiveSource.includes("@media (max-width: 1080px)") &&
      responsiveSource.includes("@media (max-width: 820px)") &&
      responsiveSource.includes("@media (max-width: 600px)") &&
      responsiveSource.includes("@media (max-width: 380px)"),
    "Responsive system covers laptop, tablet, mobile and compact phone breakpoints",
  );
  check(
    responsiveSource.includes("min-width: 320px") &&
      responsiveSource.includes("overflow-x: hidden"),
    "Responsive system protects 320px compact screens from document-level horizontal overflow",
  );
  check(
    responsiveSource.includes(".sidebar.open") &&
      responsiveSource.includes("translateX(-105%)") &&
      responsiveSource.includes(".mobile-nav"),
    "Tablet/mobile navigation uses an off-canvas drawer and fixed bottom navigation",
  );
  check(
    responsiveSource.includes("env(safe-area-inset-bottom") &&
      responsiveSource.includes("100dvh"),
    "Mobile layouts account for safe areas and dynamic viewport height",
  );
  check(
    responsiveSource.includes(
      "grid-template-columns: repeat(3, minmax(0, 1fr))",
    ) &&
      responsiveSource.includes(
        "grid-template-columns: repeat(2, minmax(0, 1fr))",
      ),
    "Responsive grids reflow across tablet and phone widths",
  );
  check(
    responsiveSource.includes("@media (hover: none), (pointer: coarse)") &&
      responsiveSource.includes("@media (prefers-reduced-motion: reduce)"),
    "Touch devices and reduced-motion preferences receive dedicated behavior",
  );
  check(
    responsiveSource.includes(".search-wrap:focus-within") &&
      responsiveSource.includes("max-height: calc(100dvh - 92px"),
    "Worldwide search dropdown remains usable within small mobile viewports",
  );
  check(
    responsiveSource.includes("#weatherMap") &&
      responsiveSource.includes(".table-wrap") &&
      responsiveSource.includes(".chart-area"),
    "Maps, tables and charts have responsive overflow and sizing rules",
  );
  check(
    dashboardSource.includes("!event.target.closest('#sidebar')") &&
      dashboardSource.includes("event.key==='Escape'"),
    "Mobile sidebar closes on outside click and Escape with focus restoration",
  );

  const readabilitySource = read("frontend/css/readability.css");
  check(
    html.includes("/css/app.css") &&
      read("frontend/service-worker.js").includes("'/css/app.css'"),
    "Combined CSS bundle is linked and included in the PWA shell",
  );
  check(
    readabilitySource.includes("--reading-copy: 13px") &&
      readabilitySource.includes("--reading-support: 12px"),
    "Readable typography tokens raise descriptive and supporting text sizes",
  );
  check(
    readabilitySource.includes(".smart-outlook-footnote") &&
      readabilitySource.includes("font-size: 12px !important"),
    "Forecast disclaimer copy uses a larger, lighter, higher-contrast reading style",
  );
  check(
    readabilitySource.includes("@media (max-width: 600px)") &&
      readabilitySource.includes("font-size: 11.5px !important"),
    "Readable minimum sizes are preserved on mobile screens",
  );

  console.log("\nAll static project checks passed.");
}
if (warnings.length)
  warnings.forEach((warning) => console.warn(`! ${warning}`));
