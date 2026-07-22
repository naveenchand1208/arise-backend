import mongoose from "mongoose";

const StepSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // sunlight | body_activation | breathwork | mind_programming | wins | revision | sats
    technique: { type: String, default: null }, // e.g. "wim_hof", "silva_alpha"
    durationSeconds: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const RitualLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["morning", "night", "midday"], required: true },
    date: { type: Date, required: true },
    steps: [StepSchema],
    intentionWord: { type: String, default: null }, // morning
    gratitudes: [{ type: String }], // morning
    wins: [{ type: String }], // night
    revisionPracticeText: { type: String, default: null }, // night
    satsScene: { type: String, default: null }, // night
    energyMood: { type: String, enum: ["tired", "low", "steady", "energized", "peak", null], default: null }, // midday
    loopAlignment: { type: String, enum: ["old_pattern", "aligned", null], default: null }, // midday
    loopReflection: { type: String, default: null }, // midday
    totalDurationSeconds: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RitualLogSchema.index({ userId: 1, type: 1, date: -1 });

export default mongoose.models.RitualLog || mongoose.model("RitualLog", RitualLogSchema);
