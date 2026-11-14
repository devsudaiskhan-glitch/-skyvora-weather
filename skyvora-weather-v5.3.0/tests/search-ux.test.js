import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("search panel remains interactive and selecting a result is handled on click", () => {
  const app = read("frontend/js/app.js");
  assert.match(
    app,
    /if \(!event\.target\.closest\('#searchForm'\) && !searchResults\.contains\(event\.target\)\) hideSearchResults\(\)/,
  );
  assert.match(app, /searchResults\.addEventListener\('click'/);
  assert.match(app, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(
    app,
    /searchResults\.addEventListener\('pointerdown',[\s\S]{0,180}preventDefault/,
  );
});

test("mobile search results use viewport width and are positioned from the input", () => {
  const css = read("frontend/css/responsive.css");
  const app = read("frontend/js/app.js");
  assert.match(css, /\.search-results,[\s\S]*?position:\s*fixed !important/);
  assert.match(css, /left:\s*12px !important/);
  assert.match(css, /right:\s*12px !important/);
  assert.match(app, /function positionSearchResults\(\)/);
  assert.match(app, /searchResults\.style\.top\s*=\s*`\$\{top\}px`/);
});

test("search results keep touch targets and keyboard focus visible", () => {
  const css = read("frontend/css/responsive.css");
  assert.match(
    css,
    /\.search-results \.search-result\s*\{[^}]*min-height:\s*66px/s,
  );
  assert.match(css, /\.search-result:focus-visible/);
});

test("autocomplete panel is portalled outside the sticky blurred topbar", () => {
  const app = read("frontend/js/app.js");
  const css = read("frontend/css/responsive.css");
  assert.match(app, /document\.body\.append\(searchResults\)/);
  assert.match(app, /!searchResults\.contains\(event\.target\)/);
  assert.match(
    app,
    /function positionSearchResults\(\)[\s\S]*?searchResults\.style\.position = 'fixed'/,
  );
  assert.match(css, /body > \.search-results\s*\{[^}]*position:\s*fixed/s);
});
