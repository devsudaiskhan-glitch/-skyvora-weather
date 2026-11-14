import mongoose from "mongoose";

const DEFAULT_CONNECT_TIMEOUT_MS = 8000;
let reconnectTimer = null;
let reconnectDelayMs = 5000;

function boundedTimeout(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1000 && parsed <= 15000
    ? parsed
    : DEFAULT_CONNECT_TIMEOUT_MS;
}

function scheduleInitialReconnect() {
  if (!process.env.MONGODB_URI?.trim() || reconnectTimer) return;
  const waitMs = reconnectDelayMs;
  reconnectDelayMs = Math.min(60_000, reconnectDelayMs * 2);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (mongoose.connection.readyState === 0) await connectDatabase();
  }, waitMs);
  reconnectTimer.unref?.();
  console.warn(
    `[database] Will retry the initial MongoDB connection in ${Math.round(waitMs / 1000)} seconds.`,
  );
}

mongoose.connection.on("connected", () => {
  reconnectDelayMs = 5000;
  console.info("[database] MongoDB connection established.");
});
mongoose.connection.on("reconnected", () =>
  console.info("[database] MongoDB connection restored."),
);
mongoose.connection.on("disconnected", () =>
  console.warn(
    "[database] MongoDB disconnected; in-memory weather cache remains available.",
  ),
);
mongoose.connection.on("error", (error) =>
  console.error("[database] MongoDB connection error:", error.message),
);

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.info(
      "[database] MONGODB_URI is not configured. MongoDB persistence is disabled; weather APIs remain available with process-local cache.",
    );
    return { connected: false, reason: "not-configured" };
  }
  if (mongoose.connection.readyState === 1) return { connected: true };
  if (mongoose.connection.readyState === 2)
    return { connected: false, reason: "connecting" };

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: boundedTimeout(
        process.env.MONGODB_CONNECT_TIMEOUT_MS,
      ),
      maxPoolSize: 10,
      minPoolSize: 0,
      autoIndex: process.env.NODE_ENV !== "production",
    });
    reconnectDelayMs = 5000;
    return { connected: true };
  } catch (error) {
    console.error(
      "[database] Initial MongoDB connection failed. Server will continue in degraded persistence mode:",
      error.message,
    );
    scheduleInitialReconnect();
    return { connected: false, reason: "connection-failed" };
  }
}
