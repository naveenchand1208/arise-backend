import mongoose from "mongoose";

const DeviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: { type: String, required: true, unique: true },
    platform: {
      type: String,
      enum: ["android", "ios", "web", "unknown"],
      default: "unknown",
    },
    deviceId: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

DeviceTokenSchema.index({ userId: 1, isActive: 1, lastSeenAt: -1 });

const ReminderSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    time: { type: String, default: "08:00", match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

const NotificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    pushEnabled: { type: Boolean, default: true },
    permissionPrompted: { type: Boolean, default: false },
    timezone: { type: String, default: "Asia/Kolkata" },
    morningReminder: {
      type: ReminderSchema,
      default: () => ({ enabled: true, time: "06:00" }),
    },
    morningFollowUp: {
      type: ReminderSchema,
      default: () => ({ enabled: false, time: "08:00" }),
    },
    nightReminder: {
      type: ReminderSchema,
      default: () => ({ enabled: true, time: "21:00" }),
    },
    challengeReminder: {
      type: ReminderSchema,
      default: () => ({ enabled: true, time: "08:00" }),
    },
    challengeFollowUp: {
      type: ReminderSchema,
      default: () => ({ enabled: false, time: "19:00" }),
    },
    journalReminder: {
      type: ReminderSchema,
      default: () => ({ enabled: false, time: "20:30" }),
    },
    streakReminderEnabled: { type: Boolean, default: true },
    weeklyInsightEnabled: { type: Boolean, default: true },
    achievementEnabled: { type: Boolean, default: true },
    productUpdatesEnabled: { type: Boolean, default: false },
    privacyMode: {
      type: String,
      enum: ["detailed", "private"],
      default: "detailed",
    },
    quietHours: {
      enabled: { type: Boolean, default: true },
      start: { type: String, default: "22:00" },
      end: { type: String, default: "06:00" },
    },
    maxDailyBehavioralNotifications: { type: Number, default: 4, min: 1, max: 8 },
  },
  { timestamps: true }
);

const NotificationHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String, required: true, unique: true },
    scheduledFor: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["sent", "failed", "skipped"],
      required: true,
      index: true,
    },
    skipReason: { type: String, default: null },
    fcmMessageIds: [{ type: String }],
    error: { type: String, default: null },
    relatedEntityType: { type: String, default: null },
    relatedEntityId: { type: String, default: null },
  },
  { timestamps: true }
);

NotificationHistorySchema.index({ userId: 1, createdAt: -1 });
NotificationHistorySchema.index({ userId: 1, status: 1, sentAt: -1 });

export const DeviceToken =
  mongoose.models.DeviceToken || mongoose.model("DeviceToken", DeviceTokenSchema);
export const NotificationPreference =
  mongoose.models.NotificationPreference ||
  mongoose.model("NotificationPreference", NotificationPreferenceSchema);
export const NotificationHistory =
  mongoose.models.NotificationHistory ||
  mongoose.model("NotificationHistory", NotificationHistorySchema);
