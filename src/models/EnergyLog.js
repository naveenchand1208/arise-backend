import mongoose from "mongoose";

const PracticeSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["completed"], default: "completed" },
    method: { type: String, default: null },
    intention: { type: String, default: null },
    carryForward: { type: String, default: null },
    durationSeconds: { type: Number, min: 0, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const EnergyLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    saltCleanseDone: { type: Boolean, default: false },
    auraStrengtheningDone: { type: Boolean, default: false },
    smokeCleanseDone: { type: Boolean, default: false },
    practices: {
      saltCleanse: { type: PracticeSchema, default: null },
      auraStrengthening: { type: PracticeSchema, default: null },
      smokeCleanse: { type: PracticeSchema, default: null },
    },
    // weekly vampire audit
    drainingPeople: [{ name: String, note: String, drainLevel: { type: String, enum: ["low", "medium", "high"] } }],
    drainingHabits: [{ name: String, note: String, drainLevel: { type: String, enum: ["low", "medium", "high"] } }],
    actionPlan: { type: String, default: null },
  },
  { timestamps: true }
);

EnergyLogSchema.index({ userId: 1, date: -1 });

export default mongoose.models.EnergyLog || mongoose.model("EnergyLog", EnergyLogSchema);
