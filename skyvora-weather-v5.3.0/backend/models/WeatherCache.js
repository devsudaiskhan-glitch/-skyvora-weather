import mongoose from "mongoose";

const weatherCacheSchema = new mongoose.Schema(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    provider: { type: String, required: true, default: "open-meteo" },
    category: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

weatherCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.models.WeatherCache ||
  mongoose.model("WeatherCache", weatherCacheSchema);
