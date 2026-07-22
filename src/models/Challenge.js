import mongoose from "mongoose";

const ChallengeSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true }, // "dispenza-21-day"
    title: { type: String, required: true },
    teacher: { type: String, default: null },
    lengthDays: { type: Number, enum: [21, 66, 90], required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "identity" },
    layer: { type: String, enum: ["BELIEF", "BEHAVIOUR", "PATTERN", "RESULT"], default: "PATTERN" },
    difficulty: { type: String, enum: ["beginner", "intermediate"], default: "beginner" },
    dailyTasks: [{ day: Number, prompt: String }], // length === lengthDays
    status: { type: String, enum: ["DRAFT", "PUBLISHED", "ARCHIVED"], default: "PUBLISHED", index: true },
    isActive: { type: Boolean, default: true, index: true },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    source: { type: String, default: "" },
    seedVersion: { type: String, default: "" },
    systemContent: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

const ChallengeProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    challengeId: { type: mongoose.Schema.Types.ObjectId, ref: "Challenge", required: true },
    startedAt: { type: Date, default: Date.now },
    currentDay: { type: Number, default: 1 },
    completedDays: [{ type: Number }],
    lastCompletedAt: { type: Date, default: null },
    status: { type: String, enum: ["active", "completed", "abandoned"], default: "active" },
  },
  { timestamps: true }
);

ChallengeProgressSchema.index({ userId: 1, challengeId: 1 }, { unique: true });

export const Challenge = mongoose.models.Challenge || mongoose.model("Challenge", ChallengeSchema);
export const ChallengeProgress =
  mongoose.models.ChallengeProgress || mongoose.model("ChallengeProgress", ChallengeProgressSchema);
