import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(
  new URL("../frontend/css/app.css", import.meta.url),
  "utf8",
);
const html = fs.readFileSync(
  new URL("../frontend/index.html", import.meta.url),
  "utf8",
);
const scenes = fs.readFileSync(
  new URL("../frontend/js/utils/scene.js", import.meta.url),
  "utf8",
);

test("lightning is disabled by default and only enabled for storm scenes", () => {
  assert.match(
    css,
    /\.dashboard-view \.weather-motion-lightning\s*\{[^}]*opacity:\s*0\s*!important;[^}]*animation:\s*none\s*!important;/s,
  );
  assert.match(
    css,
    /data-weather-motion="storm"\]\s*\.weather-motion-lightning\s*\{[^}]*animation:\s*skyvora-lightning-rare/s,
  );
});

test("rain is a real photograph with no animated rain overlay", () => {
  assert.match(scenes, /photo-1512511708753-3150cd2ec8ee/);
  assert.doesNotMatch(html, /weather-motion-rain/);
  assert.doesNotMatch(css, /weather-motion-rain|skyvora-rain-fall/);
});
