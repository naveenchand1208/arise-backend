import mongoose from "mongoose";

const PatternBreakSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    oldPattern: { type: String, required: true },
    newBehaviour: { type: String, required: true },
    trigger: { type: String, default: null },
    resultSignal: { type: String, default: null },
    loggedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

PatternBreakSchema.index({ userId: 1, loggedAt: -1 });

export default mongoose.models.PatternBreak || mongoose.model("PatternBreak", PatternBreakSchema);
