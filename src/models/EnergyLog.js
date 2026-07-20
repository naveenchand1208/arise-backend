import mongoose from "mongoose";

const EnergyLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    saltCleanseDone: { type: Boolean, default: false },
    auraStrengtheningDone: { type: Boolean, default: false },
    smokeCleanseDone: { type: Boolean, default: false },
    // weekly vampire audit
    drainingPeople: [{ name: String, note: String, drainLevel: { type: String, enum: ["low", "medium", "high"] } }],
    drainingHabits: [{ name: String, note: String, drainLevel: { type: String, enum: ["low", "medium", "high"] } }],
    actionPlan: { type: String, default: null },
  },
  { timestamps: true }
);

EnergyLogSchema.index({ userId: 1, date: -1 });

export default mongoose.models.EnergyLog || mongoose.model("EnergyLog", EnergyLogSchema);
