import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { connectDatabase } from "./config/database.js";
import apiRouter from "./routes/api.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.resolve(__dirname, "../frontend");
const app = express();
const isProduction = process.env.NODE_ENV === "production";
const BUILD_VERSION = "5.3.0";

app.use((_req, res, next) => {
  res.setHeader("X-Skyvora-Build", BUILD_VERSION);
  next();
});

app.disable("x-powered-by");
const trustProxySetting = String(process.env.TRUST_PROXY || "false")
  .trim()
  .toLowerCase();
const trustProxyHops = Number(trustProxySetting);
app.set(
  "trust proxy",
  trustProxySetting === "true"
    ? 1
    : Number.isInteger(trustProxyHops) && trustProxyHops >= 0
      ? trustProxyHops
      : false,
);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://unpkg.com"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://unpkg.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://images.unsplash.com",
          "https://images.pexels.com",
          "https://tile.openstreetmap.org",
          "https://unpkg.com",
        ],
        connectSrc: [
          "'self'",
          "https://unpkg.com",
          "https://api.open-meteo.com",
          "https://geocoding-api.open-meteo.com",
          "https://air-quality-api.open-meteo.com",
          "https://archive-api.open-meteo.com",
          "https://marine-api.open-meteo.com",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);
app.use(compression());
app.use(express.json({ limit: "80kb" }));
const rateWindow = Number(process.env.API_RATE_LIMIT_WINDOW_MS);
const rateMax = Number(process.env.API_RATE_LIMIT_MAX);
const rateLimitWindowMs =
  Number.isInteger(rateWindow) && rateWindow >= 10000 && rateWindow <= 3600000
    ? rateWindow
    : 60000;
const rateLimitMax =
  Number.isInteger(rateMax) && rateMax >= 10 && rateMax <= 1000 ? rateMax : 100;
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(
  "/api",
  rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests. Please wait a moment.",
    },
  }),
);
app.get("/api/build", (_req, res) =>
  res.set("Cache-Control", "no-store").json({
    app: "Skyvora Weather",
    version: BUILD_VERSION,
    dashboard: "reference-night",
    design: "premium-atmosphere-v3",
    search: "worldwide-geonames-autocomplete",
    release: "rebrand-maintainability-reliability-qa",
    port: Number(process.env.PORT) || 5065,
  }),
);

app.use("/api", apiRouter);
app.use("/api", notFound);
app.use(
  express.static(frontendPath, {
    etag: true,
    maxAge: isProduction ? "1h" : 0,
    setHeaders(res, filePath) {
      const alwaysRevalidate =
        filePath.endsWith("service-worker.js") ||
        filePath.endsWith("manifest.webmanifest");
      if (alwaysRevalidate || (!isProduction && /\.html$/i.test(filePath)))
        res.setHeader("Cache-Control", "no-cache");
      else if (!isProduction && /\.(?:css|js)$/i.test(filePath))
        res.setHeader("Cache-Control", "no-cache, must-revalidate");
    },
  }),
);
app.get("/{*path}", (_req, res) =>
  res.sendFile(path.join(frontendPath, "index.html")),
);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 5065;
await connectDatabase();
const server = app.listen(port, () =>
  console.info(
    `[skyvora ${BUILD_VERSION}] running at http://localhost:${port} | Dashboard: reference-night | Frontend: ${frontendPath} | MongoDB: ${mongoose.connection.readyState === 1 ? "connected" : "not connected"}`,
  ),
);

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[skyvora] ${signal} received; draining requests…`);
  const forceExit = setTimeout(() => {
    console.error(
      "[skyvora] graceful shutdown timed out; closing remaining connections.",
    );
    server.closeAllConnections?.();
    process.exit(1);
  }, 10000);
  forceExit.unref();
  server.close(async (error) => {
    if (mongoose.connection.readyState !== 0)
      await mongoose.disconnect().catch(() => {});
    clearTimeout(forceExit);
    if (error) {
      console.error("[skyvora] server close failed:", error.message);
      process.exit(1);
      return;
    }
    console.info("[skyvora] shutdown complete.");
    process.exit(0);
  });
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

export { app };
