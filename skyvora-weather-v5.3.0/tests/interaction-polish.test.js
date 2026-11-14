import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("mobile sidebar Search closes the drawer before focusing the search input", () => {
  const app = read("frontend/js/app.js");
  assert.match(
    app,
    /action === 'focus-search'[\s\S]*?sidebar\?\.classList\.remove\('open'\)[\s\S]*?setAttribute\('aria-expanded', 'false'\)[\s\S]*?requestAnimationFrame\([\s\S]*?searchInput\.focus\(\{ preventScroll: true \}\)/,
  );
});

test("Ask forecast control is a named submit button with a dedicated layout class", () => {
  const app = read("frontend/js/app.js");
  const css = read("frontend/css/app.css");
  assert.match(
    app,
    /class="btn btn-primary ask-weather-button" type="submit" aria-label="Ask about this forecast"/,
  );
  assert.match(css, /\.question-form \.ask-weather-button/);
});

test("wind compass hover sweep is exactly one full turn and ends at the real bearing", () => {
  const app = read("frontend/js/app.js");
  const css = read("frontend/css/app.css");
  assert.match(app, /--wind-bearing:\$\{degrees\}deg/);
  assert.match(
    css,
    /@keyframes wind-compass-one-turn[\s\S]*?from \{ transform: rotate\(var\(--wind-bearing, 0deg\)\); \}[\s\S]*?to \{ transform: rotate\(calc\(var\(--wind-bearing, 0deg\) \+ 360deg\)\); \}/,
  );
});

test("daylight and air-quality motion honor reduced-motion settings", () => {
  const css = read("frontend/css/app.css");
  assert.match(css, /daylight-path-reveal/);
  assert.match(css, /daylight-ray-spin/);
  assert.match(css, /pollutant-card-enter/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.daylight-progress[\s\S]*?animation: none !important/,
  );
});

test("24-hour forecast has smooth hover transitions on fine-pointer devices", () => {
  const css = read("frontend/css/app.css");
  assert.match(
    css,
    /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.reference-hourly-track \.hourly-item:hover[\s\S]*?translateY\(-5px\) scale\(1\.015\)/,
  );
});
