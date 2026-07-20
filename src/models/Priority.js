import mongoose from "mongoose";

const PrioritySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rank: { type: Number, enum: [1, 2, 3], required: true },
    label: { type: String, required: true },
    category: { type: String, default: "general" }, // business | health | focus | relationships...
  },
  { timestamps: true }
);

PrioritySchema.index({ userId: 1, rank: 1 }, { unique: true });

export default mongoose.models.Priority || mongoose.model("Priority", PrioritySchema);
