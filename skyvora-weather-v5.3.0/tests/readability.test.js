import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(
  path.join(root, "frontend/css/readability.css"),
  "utf8",
);
const combinedCss = fs.readFileSync(
  path.join(root, "frontend/css/app.css"),
  "utf8",
);
const html = fs.readFileSync(path.join(root, "frontend/index.html"), "utf8");
const sw = fs.readFileSync(
  path.join(root, "frontend/service-worker.js"),
  "utf8",
);
const app = fs.readFileSync(path.join(root, "frontend/js/app.js"), "utf8");

test("readability stylesheet loads after the responsive layer", () => {
  assert.ok(html.includes("/css/app.css"));
  const order = [
    "--bg:",
    ".app-shell",
    "@media (max-width:1280px)",
    "--reading-body:",
    "--brand-navy:",
  ].map((marker) => combinedCss.indexOf(marker));
  assert.ok(order.every((position) => position >= 0));
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
});

test("PWA offline shell includes the readability stylesheet", () => {
  assert.ok(sw.includes("'/css/app.css'"));
});

test("base reading size is at least 15px with a comfortable line height", () => {
  assert.match(css, /--reading-body:\s*15px/);
  assert.match(css, /--reading-leading:\s*1\.68/);
  assert.match(css, /body\s*\{[^}]*font-size:\s*var\(--reading-body\)/s);
});

test("supporting copy is larger, regular weight and higher contrast", () => {
  assert.match(css, /--reading-copy:\s*13px/);
  assert.match(css, /--reading-support:\s*12px/);
  assert.match(css, /font-weight:\s*400\s*!important/);
  assert.ok(css.includes(".smart-outlook-footnote"));
  assert.ok(css.includes(".aqi-source-note"));
  assert.ok(css.includes(".source-line"));
});

test("mobile layout preserves readable text sizes", () => {
  assert.ok(css.includes("@media (max-width: 600px)"));
  assert.ok(css.includes("font-size: 12.5px !important"));
  assert.ok(css.includes("font-size: 11.5px !important"));
});

test("font sizing keeps key numeric displays and visual headings separate", () => {
  assert.ok(!/\.reference-temperature\s*\{[^}]*font-size:\s*15px/s.test(css));
  assert.ok(!/\.reference-hero\s*\{[^}]*font-size:\s*15px/s.test(css));
});

test("the example forecast disclaimer is present and receives the reading override", () => {
  assert.ok(
    app.includes(
      "These are forecast summaries, not guarantees. Values update when the provider forecast refreshes.",
    ),
  );
  assert.ok(css.includes("#viewRoot .smart-outlook-footnote"));
});
