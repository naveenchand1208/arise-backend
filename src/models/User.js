import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phoneNumber: { type: String, default: "" },
    uid: {
      type: String,
      default: null,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    ios: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
      default: null,
    },

    deviceInfo: {
      platform: String,
      model: String,
      version: Number,
      deviceId: String,
    },

    role: {
      type: String,
      enum: ["ceo_founder", "professional", "entrepreneur", "seeker"],
      default: "seeker",
    },
    ritualTimes: {
      morning: { type: String, default: "05:30" },
      midday: { type: String, default: "13:00" },
      night: { type: String, default: "21:30" },
    },
    onboardingComplete: { type: Boolean, default: false },
    subscription: {
      plan: { type: String, enum: ["free", "premium"], default: "free" },
      trialEndsAt: { type: Date, default: null },
      renewsAt: { type: Date, default: null },
    },
    settings: {
      darkMode: { type: Boolean, default: true },
      language: { type: String, default: "en" },
      biometricLock: { type: Boolean, default: false },
      notifications: {
        morning: { type: Boolean, default: true },
        night: { type: Boolean, default: true },
        wealth: { type: Boolean, default: true },
      },
      morningDuration: { type: String, default: "full" }, // quick | standard | full
      backgroundMusic: { type: String, default: "528hz" },
    },
    refreshTokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
