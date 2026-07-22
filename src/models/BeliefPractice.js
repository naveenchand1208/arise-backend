import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false }
);

const BeliefPracticeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    practiceKey: {
      type: String,
      enum: ["daily-check", "i-am", "paradigm-audit", "inner-child", "reframe", "fear", "container"],
      required: true,
      index: true,
    },
    screenId: { type: Number, min: 18, max: 26, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    answers: { type: [answerSchema], default: [] },
    completedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

BeliefPracticeSchema.index({ userId: 1, practiceKey: 1, completedAt: -1 });

export default mongoose.models.BeliefPractice || mongoose.model("BeliefPractice", BeliefPracticeSchema);
