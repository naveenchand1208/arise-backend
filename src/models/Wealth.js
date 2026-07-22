import mongoose from "mongoose";

const WealthGoalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    monthlyIntentionAmount: { type: Number, required: true }, // in smallest currency unit or rupees
    affirmationText: { type: String, default: "" },
    currentMonthReceived: { type: Number, default: 0 },
    updatedForMonth: { type: String, default: null }, // "2026-07"
  },
  { timestamps: true }
);

const WealthPracticeLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    moneyGratitudeDone: { type: Boolean, default: false },
    paradigmAffirmationDone: { type: Boolean, default: false },
    containerExpansionDone: { type: Boolean, default: false },
    affirmationsCompleted: { type: Number, default: 0 }, // out of 7 in the affirmation carousel
    receivingWorthinessReasons: [{ type: String }],
    receivingUseOfWealth: { type: String, default: "" },
    moneyGratitudes: [{ type: String }],
  },
  { timestamps: true }
);

WealthPracticeLogSchema.index({ userId: 1, date: -1 });

export const WealthGoal = mongoose.models.WealthGoal || mongoose.model("WealthGoal", WealthGoalSchema);
export const WealthPracticeLog =
  mongoose.models.WealthPracticeLog || mongoose.model("WealthPracticeLog", WealthPracticeLogSchema);
