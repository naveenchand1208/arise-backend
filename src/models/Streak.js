import mongoose from "mongoose";

const StreakSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    current: { type: Number, default: 0 },
    best: { type: Number, default: 0 },
    lastCompletedDate: { type: Date, default: null },
    totalSessions: { type: Number, default: 0 },
    totalMeditationSeconds: { type: Number, default: 0 },
    milestonesUnlocked: [{ type: Number }], // e.g. [21, 66]
  },
  { timestamps: true }
);

export default mongoose.models.Streak || mongoose.model("Streak", StreakSchema);
