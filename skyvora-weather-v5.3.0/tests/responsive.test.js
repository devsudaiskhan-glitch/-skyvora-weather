import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(
  path.join(root, "frontend/css/responsive.css"),
  "utf8",
);
const app = fs.readFileSync(path.join(root, "frontend/js/app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "frontend/index.html"), "utf8");

test("responsive stylesheet defines common device breakpoints", () => {
  for (const breakpoint of ["1280px", "1080px", "820px", "600px", "380px"]) {
    assert.ok(
      css.includes(`max-width: ${breakpoint}`),
      `Missing ${breakpoint} breakpoint`,
    );
  }
});

test("compact mobile layout supports 320px wide screens", () => {
  assert.ok(css.includes("min-width: 320px"));
  assert.ok(css.includes("overflow-x: hidden"));
  assert.ok(css.includes("@media (max-width: 380px)"));
});

test("tablet and mobile navigation has an off-canvas drawer and bottom bar", () => {
  assert.ok(css.includes(".sidebar.open"));
  assert.ok(css.includes("translateX(-105%)"));
  assert.ok(css.includes(".mobile-nav"));
  assert.match(html, /id="menuToggle"/);
});

test("mobile layouts respect dynamic viewport and safe-area insets", () => {
  assert.ok(css.includes("100dvh"));
  assert.ok(css.includes("env(safe-area-inset-bottom"));
});

test("main dashboard and subpage grids have responsive reflow rules", () => {
  assert.ok(css.includes(".reference-top-grid"));
  assert.ok(css.includes(".content-grid"));
  assert.ok(css.includes(".metric-grid"));
  assert.ok(css.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"));
  assert.ok(css.includes("grid-template-columns: minmax(0, 1fr)"));
});

test("charts, maps, tables and search panel have narrow-screen handling", () => {
  for (const selector of [
    ".chart-area",
    "#weatherMap",
    ".table-wrap",
    ".search-results",
  ]) {
    assert.ok(
      css.includes(selector),
      `Missing responsive rule for ${selector}`,
    );
  }
});

test("touch and reduced-motion users receive appropriate interaction behavior", () => {
  assert.ok(css.includes("@media (hover: none), (pointer: coarse)"));
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"));
});

test("mobile navigation drawer closes with outside click and Escape", () => {
  assert.ok(app.includes("!event.target.closest('#sidebar')"));
  assert.ok(app.includes("event.key==='Escape'"));
  assert.ok(app.includes("$('#menuToggle')?.focus()"));
});
