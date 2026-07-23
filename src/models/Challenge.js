import mongoose from "mongoose";

const ChallengeDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 1 },
    title: { type: String, required: true },
    prompt: { type: String, required: true },
    activityType: { type: String, required: true },
    activityReference: { type: String, default: null },
    completionRule: {
      type: String,
      enum: [
        "EVENT_COMPLETED",
        "RECORD_CREATED",
        "DURATION_COMPLETED",
        "COUNT_REACHED",
        "ALL_OF",
        "ANY_OF",
      ],
      default: "RECORD_CREATED",
    },
    requiredActivityTypes: [{ type: String }],
    minimumRequirement: { type: Number, default: 1, min: 0 },
    ctaLabel: { type: String, default: "Begin Today's Practice" },
    route: { type: String, required: true },
    estimatedMinutes: { type: Number, default: 5, min: 1 },
  },
  { _id: false }
);

const ChallengeSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    teacher: { type: String, default: null },
    lengthDays: { type: Number, enum: [21, 66, 90], required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "identity" },
    layer: {
      type: String,
      enum: ["BELIEF", "BEHAVIOUR", "PATTERN", "RESULT"],
      default: "PATTERN",
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate"],
      default: "beginner",
    },
    version: { type: Number, default: 1, min: 1 },
    dailyTasks: { type: [ChallengeDaySchema], default: [] },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      default: "PUBLISHED",
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    source: { type: String, default: "" },
    seedVersion: { type: String, default: "" },
    systemContent: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

const CompletionEvidenceSchema = new mongoose.Schema(
  {
    activityType: { type: String, required: true },
    activityId: { type: String, required: true },
    completedAt: { type: Date, required: true },
    durationSeconds: { type: Number, default: 0 },
    count: { type: Number, default: 1 },
  },
  { _id: false }
);

const DailyProgressSchema = new mongoose.Schema(
  {
    dayNumber: { type: Number, required: true },
    scheduledDateKey: { type: String, required: true },
    status: {
      type: String,
      enum: ["in_progress", "completed", "missed"],
      default: "in_progress",
    },
    completedAt: { type: Date, default: null },
    completionSource: { type: String, default: null },
    completionActivityId: { type: String, default: null },
    evidence: { type: [CompletionEvidenceSchema], default: [] },
  },
  { _id: false }
);

const ChallengeProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: true,
      index: true,
    },
    attemptNumber: { type: Number, default: 1, min: 1 },
    challengeVersion: { type: Number, default: 1 },
    challengeSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    timezoneOffsetMinutes: { type: Number, default: 0, min: -720, max: 840 },
    startedAt: { type: Date, default: Date.now },
    startDate: { type: Date, default: Date.now },
    currentDay: { type: Number, default: 1 },
    completedDays: [{ type: Number }],
    dailyProgress: { type: [DailyProgressSchema], default: [] },
    baselineMetrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastCompletedAt: { type: Date, default: null },
    lastEvaluatedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

ChallengeProgressSchema.index(
  { userId: 1, challengeId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
    name: "one_active_challenge_attempt",
  }
);
ChallengeProgressSchema.index(
  { userId: 1, challengeId: 1, attemptNumber: 1 },
  { unique: true }
);
ChallengeProgressSchema.index({ userId: 1, startedAt: -1 });

export const Challenge =
  mongoose.models.Challenge || mongoose.model("Challenge", ChallengeSchema);
export const ChallengeProgress =
  mongoose.models.ChallengeProgress ||
  mongoose.model("ChallengeProgress", ChallengeProgressSchema);
