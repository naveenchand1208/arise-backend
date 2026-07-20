import mongoose from "mongoose";

const CommunityPostSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, enum: ["win", "insight", "gratitude"], required: true },
    content: { type: String, required: true },
    dayBadge: { type: Number, default: null }, // "Day 21" flair
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    commentCount: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false }, // for admin moderation queue
  },
  { timestamps: true }
);

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    icon: { type: String, default: "🔔" },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    scheduledFor: { type: Date, default: null },
  },
  { timestamps: true }
);

const CommentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export const CommunityPost = mongoose.models.CommunityPost || mongoose.model("CommunityPost", CommunityPostSchema);
export const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
export const Comment = mongoose.models.Comment || mongoose.model("Comment", CommentSchema);
