import mongoose from "mongoose";

const BeliefScoreSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true }, // normalized to day granularity
    health: { type: Number, min: 0, max: 10, required: true },
    wealth: { type: Number, min: 0, max: 10, required: true },
    happiness: { type: Number, min: 0, max: 10, required: true },
    energy: { type: Number, min: 0, max: 10 },
    purpose: { type: Number, min: 0, max: 10 },
    isBaseline: { type: Boolean, default: false }, // true only for the onboarding entry
    iAmStatement: { type: String, default: null },
    focusAreas: [{ type: String }], // e.g. ["health", "wealth", "love", "purpose"]
  },
  { timestamps: true }
);

BeliefScoreSchema.index({ userId: 1, date: -1 });

export default mongoose.models.BeliefScore || mongoose.model("BeliefScore", BeliefScoreSchema);
