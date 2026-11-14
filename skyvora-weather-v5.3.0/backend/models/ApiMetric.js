import mongoose from "mongoose";

const apiMetricSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    category: { type: String, required: true },
    durationMs: { type: Number, min: 0, required: true },
    status: {
      type: String,
      enum: ["success", "error", "cache"],
      required: true,
    },
    statusCode: { type: Number },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
  },
  { versionKey: false },
);

export default mongoose.models.ApiMetric ||
  mongoose.model("ApiMetric", apiMetricSchema);
