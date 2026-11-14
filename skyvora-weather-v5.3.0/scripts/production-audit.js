import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "frontend/index.html",
  "frontend/css/app.css",
  "frontend/js/app.js",
  "frontend/js/config.js",
  "frontend/js/api/client.js",
  "frontend/service-worker.js",
];
const limits = {
  html: 80 * 1024,
  css: 220 * 1024,
  js: 300 * 1024,
  webmanifest: 20 * 1024,
};
let failed = false;
console.log(
  "Skyvora static production asset audit (not a Lighthouse or browser run)\n",
);
for (const relative of files) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) {
    console.error(`FAIL missing ${relative}`);
    failed = true;
    continue;
  }
  const data = fs.readFileSync(absolute);
  const ext = path.extname(relative);
  const group =
    ext === ".html"
      ? "html"
      : ext === ".css"
        ? "css"
        : ext === ".js"
          ? "js"
          : "webmanifest";
  const limit = limits[group];
  const compressed = gzipSync(data).byteLength;
  const ok = data.byteLength <= limit;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${relative.padEnd(42)} ${String(data.byteLength).padStart(8)} B raw | ${String(compressed).padStart(8)} B gzip | budget ${limit} B`,
  );
  if (!ok) failed = true;
}
const html = fs.readFileSync(path.join(root, "frontend/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "frontend/css/app.css"), "utf8");
const checks = [
  ["skip link is present", /class="skip-link" href="#viewRoot"/.test(html)],
  ["main landmark has a stable target", /<main[^>]+id="viewRoot"/.test(html)],
  ["visible keyboard focus styles exist", /:focus-visible/.test(css)],
  ["reduced-motion support exists", /prefers-reduced-motion/.test(css)],
  ["viewport metadata exists", /name="viewport"/.test(html)],
  [
    "no API key is committed in the frontend bundle",
    !/(OPEN_METEO_CUSTOMER_API_KEY|AI_API_KEY)\s*[:=]\s*['"][^'"]{8,}/.test(
      fs.readFileSync(path.join(root, "frontend/js/config.js"), "utf8"),
    ),
  ],
];
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exitCode = 1;
else
  console.log(
    "\nStatic asset audit passed. Run Lighthouse and physical-device QA separately before production release.",
  );
