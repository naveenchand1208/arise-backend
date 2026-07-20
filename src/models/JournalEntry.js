import mongoose from "mongoose";

const JournalEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["daily", "weekly", "monthly", "shadow", "forgiveness"],
      required: true,
    },
    date: { type: Date, required: true },
    prompt: { type: String, default: null },
    content: { type: String, required: true },
    tag: { type: String, enum: ["honest", "insight", "breakthrough", "reflection", null], default: null },
    // shadow-work specific
    oldBelief: { type: String, default: null },
    newParadigm: { type: String, default: null },
    // forgiveness-specific
    forgivenessTarget: { type: String, default: null },
    releaseStatement: { type: String, default: null },
    lessonLearned: { type: String, default: null },
  },
  { timestamps: true }
);

JournalEntrySchema.index({ userId: 1, type: 1, date: -1 });

export default mongoose.models.JournalEntry || mongoose.model("JournalEntry", JournalEntrySchema);
