import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: Date, required: true },
    title: { type: String, required: true },
    priorityRank: { type: Number, enum: [1, 2, 3], default: null }, // links to Priority
    category: { type: String, default: "general" },
    status: { type: String, enum: ["pending", "in_progress", "done"], default: "pending" },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TaskSchema.index({ userId: 1, date: -1 });

export default mongoose.models.Task || mongoose.model("Task", TaskSchema);
