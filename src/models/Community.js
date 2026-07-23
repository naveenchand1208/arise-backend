import mongoose from "mongoose";

const CommunityPostSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    authorName: { type: String, default: null },
    authorRole: { type: String, default: null },
    isAdminPost: { type: Boolean, default: false },
    category: { type: String, enum: ["win", "insight", "gratitude"], required: true },
    content: { type: String, required: true },
    dayBadge: { type: Number, default: null },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    commentCount: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },
    moderationStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    moderatedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true }
);

CommunityPostSchema.index({ moderationStatus: 1, flagged: 1, createdAt: -1 });

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    icon: { type: String, default: "bell" },
    type: { type: String, default: "SYSTEM_ANNOUNCEMENT", index: true },
    title: { type: String, default: "ARISE" },
    body: { type: String, default: "" },
    message: { type: String, required: true },
    route: { type: String, default: "/home" },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    scheduledFor: { type: Date, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const CommentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityPost", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    flagged: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },
    moderationStatus: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
    moderatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const CommunityPost = mongoose.models.CommunityPost || mongoose.model("CommunityPost", CommunityPostSchema);
export const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
export const Comment = mongoose.models.Comment || mongoose.model("Comment", CommentSchema);
