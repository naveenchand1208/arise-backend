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
      enum: [
        "daily-check",
        "i-am",
        "paradigm-audit",
        "inner-child",
        "reframe",
        "fear",
        "container",
        "belief-work",
        "paradigm-discovery",
      ],
      required: true,
      index: true,
    },
    screenId: { type: Number, min: 18, max: 28, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    answers: { type: [answerSchema], default: [] },
    status: { type: String, enum: ["draft", "completed"], default: "completed", index: true },
    category: { type: String, default: null, index: true },
    oldBelief: { type: String, default: null },
    oldBeliefStrength: { type: Number, min: 1, max: 10, default: null },
    originReflection: { type: String, default: null },
    evidenceReflection: { type: String, default: null },
    behaviourImpact: { type: String, default: null },
    newBelief: { type: String, default: null },
    iamStatement: { type: String, default: null },
    newBeliefBelievability: { type: Number, min: 1, max: 10, default: null },
    supportingAction: { type: String, default: null },
    trigger: { type: String, default: null },
    repeatedThought: { type: String, default: null },
    automaticResponse: { type: String, default: null },
    possibleOrigin: { type: String, default: null },
    currentCost: { type: String, default: null },
    newChoice: { type: String, default: null },
    paradigmStatus: {
      type: String,
      enum: ["active", "being_practiced", "released", null],
      default: null,
    },
    completedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

BeliefPracticeSchema.index({ userId: 1, practiceKey: 1, completedAt: -1 });
BeliefPracticeSchema.index({ userId: 1, category: 1, completedAt: -1 });

export default mongoose.models.BeliefPractice || mongoose.model("BeliefPractice", BeliefPracticeSchema);
