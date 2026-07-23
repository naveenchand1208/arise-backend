import mongoose from "mongoose";

const JournalEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["daily", "weekly", "monthly", "shadow", "forgiveness", "revision"],
      required: true,
    },
    date: { type: Date, required: true },
    prompt: { type: String, default: null },
    content: { type: String, required: true },
    tag: { type: String, enum: ["honest", "insight", "breakthrough", "reflection", null], default: null },
    status: { type: String, enum: ["draft", "completed"], default: "completed", index: true },
    // shadow-work specific
    oldBelief: { type: String, default: null },
    newParadigm: { type: String, default: null },
    trigger: { type: String, default: null },
    emotion: { type: String, default: null },
    reaction: { type: String, default: null },
    meaning: { type: String, default: null },
    mirrorReflection: { type: String, default: null },
    compassionateResponse: { type: String, default: null },
    nextChoice: { type: String, default: null },
    // forgiveness-specific
    forgivenessTargetType: {
      type: String,
      enum: ["myself", "person", "situation", null],
      default: null,
    },
    forgivenessTarget: { type: String, default: null },
    whatHappened: { type: String, default: null },
    stillCarrying: { type: String, default: null },
    unmetNeed: { type: String, default: null },
    boundaryLesson: { type: String, default: null },
    readyToRelease: { type: String, default: null },
    releaseStatement: { type: String, default: null },
    lessonLearned: { type: String, default: null },
    // revision-practice specific
    originalEvent: { type: String, default: null },
    revisedScene: { type: String, default: null },
    feltSense: { type: String, default: null },
  },
  { timestamps: true }
);

JournalEntrySchema.index({ userId: 1, type: 1, date: -1 });

export default mongoose.models.JournalEntry || mongoose.model("JournalEntry", JournalEntrySchema);
