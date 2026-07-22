import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { connectDB } from "../lib/mongodb.js";
import { ok, fail } from "../lib/response.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signAdminAccessToken } from "../lib/adminAuth.js";
import { requireAdmin, requireAdminPermission } from "../middleware/adminAuth.js";
import Admin from "../models/Admin.js";
import AuditLog from "../models/AuditLog.js";
import DeleteAccountRequest from "../models/deleteAccountRequest.js";
import DeletedAccount from "../models/deletedAccount.js";
import User from "../models/User.js";
import Streak from "../models/Streak.js";
import Task from "../models/Task.js";
import RitualLog from "../models/RitualLog.js";
import JournalEntry from "../models/JournalEntry.js";
import { CommunityPost, Comment, Notification } from "../models/Community.js";
import { MasterTeacher, Asana, BreathworkTechnique, WealthAffirmation, Quote } from "../models/Content.js";
import { Challenge, ChallengeProgress } from "../models/Challenge.js";
import { archiveAndDeleteUser } from "../lib/archiveUser.js";

const router = Router();

const CONTENT_MODELS = {
  masters: MasterTeacher,
  asanas: Asana,
  breathwork: BreathworkTechnique,
  affirmations: WealthAffirmation,
  quotes: Quote,
};

const CONTENT_REQUIRED_FIELDS = {
  masters: ["name"],
  asanas: ["name"],
  breathwork: ["name"],
  affirmations: ["text"],
  quotes: ["text", "author"],
};

function adminPayload(admin) {
  return {
    id: admin._id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    permissions: admin.permissions || [],
    status: admin.status,
    lastLoginAt: admin.lastLoginAt,
  };
}

function requireBootstrapToken(req, res) {
  const expected = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!expected) return fail(res, "Admin bootstrap is not configured", 403);
  if (req.headers["x-admin-bootstrap-token"] !== expected) {
    return fail(res, "Invalid admin bootstrap token", 403);
  }
  return null;
}

function parsePage(req) {
  return {
    page: Math.max(Number(req.query.page || req.body?.page || 1), 1),
    limit: Math.min(Math.max(Number(req.query.limit || req.body?.limit || 20), 1), 100),
  };
}

function searchRegex(value) {
  const search = String(value || "").trim();
  return search ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
}

async function audit(req, action, resourceType, resourceId = "", metadata = {}) {
  if (!req.admin) return;
  await AuditLog.create({
    adminId: req.adminId,
    adminEmail: req.admin.email,
    action,
    resourceType,
    resourceId: String(resourceId || ""),
    metadata,
  });
}

function communityPostPayload(post) {
  return {
    id: post._id,
    author: post.authorName || post.userId?.fullName || "ARISE",
    authorEmail: post.userId?.email || null,
    role: post.authorRole || post.userId?.role || null,
    isAdminPost: post.isAdminPost,
    category: post.category,
    content: post.content,
    dayBadge: post.dayBadge,
    likeCount: post.likes?.length || 0,
    commentCount: post.commentCount || 0,
    flagged: post.flagged,
    reportCount: post.reportCount || 0,
    moderationStatus: post.moderationStatus || "pending",
    rejectionReason: post.rejectionReason,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    moderatedAt: post.moderatedAt,
  };
}

router.post(
  "/auth/bootstrap",
  asyncHandler(async (req, res) => {
    await connectDB();
    const guard = requireBootstrapToken(req, res);
    if (guard) return guard;

    const existingAdmins = await Admin.countDocuments();
    if (existingAdmins > 0) return fail(res, "Admin bootstrap has already been completed", 409);

    const { name, email, password } = req.body;
    if (!name || !email || !password) return fail(res, "name, email and password are required", 400);
    if (String(password).length < 12) return fail(res, "Admin password must be at least 12 characters", 400);

    const admin = await Admin.create({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      passwordHash: hashPassword(password),
      role: "SUPER_ADMIN",
    });

    return ok(res, { admin: adminPayload(admin), accessToken: signAdminAccessToken(admin) }, 201);
  })
);

router.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { email, password } = req.body;
    if (!email || !password) return fail(res, "email and password are required", 400);

    const admin = await Admin.findOne({ email: String(email).toLowerCase().trim() });
    if (!admin || admin.status !== "active" || !verifyPassword(password, admin.passwordHash)) {
      return fail(res, "Invalid admin credentials", 401);
    }

    admin.lastLoginAt = new Date();
    await admin.save();
    await AuditLog.create({
      adminId: admin._id,
      adminEmail: admin.email,
      action: "admin.login",
      resourceType: "admin",
      resourceId: admin._id.toString(),
    });

    return ok(res, { admin: adminPayload(admin), accessToken: signAdminAccessToken(admin) });
  })
);

router.get(
  "/auth/me",
  requireAdmin,
  asyncHandler(async (req, res) => ok(res, { admin: adminPayload(req.admin) }))
);

router.get(
  "/health",
  asyncHandler(async (req, res) => {
    await connectDB();
    return ok(res, {
      api: "connected",
      mongodb: mongoose.connection.readyState === 1 ? "healthy" : "error",
      notifications: process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVICE_ACCOUNT ? "configured" : "not_configured",
      revenueCat: process.env.REVENUECAT_WEBHOOK_AUTH ? "configured" : "not_configured",
    });
  })
);

router.use(requireAdmin);

router.get(
  "/dashboard",
  requireAdminPermission("dashboard:read"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalUsers,
      newUsersToday,
      newUsersThisMonth,
      premiumUsers,
      morningCompletions,
      activeChallenges,
      communityPosts,
      pendingDeletionRequests,
      notificationsSent,
      recentUsers,
      recentPosts,
      recentDeletionRequests,
      recentNotifications,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: monthStart } }),
      User.countDocuments({ "subscription.plan": "premium" }),
      RitualLog.countDocuments({ type: "morning", completed: true }),
      ChallengeProgress.countDocuments({ status: "active" }),
      CommunityPost.countDocuments(),
      DeleteAccountRequest.countDocuments({ status: "Pending" }),
      Notification.countDocuments(),
      User.find().sort({ createdAt: -1 }).limit(5).select("fullName email role onboardingComplete subscription createdAt"),
      CommunityPost.find().sort({ createdAt: -1 }).limit(5).populate("userId", "fullName email"),
      DeleteAccountRequest.find({ status: "Pending" }).sort({ createdAt: -1 }).limit(5).lean(),
      Notification.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    return ok(res, {
      stats: {
        totalUsers,
        activeUsers: totalUsers,
        newUsersToday,
        newUsersThisMonth,
        premiumUsers,
        freeUsers: totalUsers - premiumUsers,
        morningProtocolCompletions: morningCompletions,
        activeChallenges,
        communityPosts,
      pendingReports: await CommunityPost.countDocuments({
        $or: [{ flagged: true }, { moderationStatus: "pending" }, { moderationStatus: { $exists: false } }],
      }),
        pendingAccountDeletions: pendingDeletionRequests,
        notificationsSent,
      },
      recentUsers,
      recentCommunityActivity: recentPosts,
      recentAccountDeletionRequests: recentDeletionRequests,
      notificationHistory: recentNotifications,
      systemStatus: {
        backendApi: "connected",
        mongodb: mongoose.connection.readyState === 1 ? "healthy" : "error",
        notificationService: process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVICE_ACCOUNT ? "configured" : "not_configured",
        revenueCat: process.env.REVENUECAT_WEBHOOK_AUTH ? "configured" : "not_configured",
      },
    });
  })
);

router.get(
  "/users",
  requireAdminPermission("users:read"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { page, limit } = parsePage(req);
    const regex = searchRegex(req.query.search);
    const match = regex ? { $or: [{ fullName: regex }, { email: regex }] } : {};
    if (req.query.plan) match["subscription.plan"] = req.query.plan;
    if (req.query.onboardingComplete) match.onboardingComplete = req.query.onboardingComplete === "true";

    const [items, total] = await Promise.all([
      User.find(match).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("-refreshTokenVersion"),
      User.countDocuments(match),
    ]);

    const streaks = await Streak.find({ userId: { $in: items.map((user) => user._id) } });
    const streakByUser = Object.fromEntries(streaks.map((streak) => [streak.userId.toString(), streak]));

    return ok(res, {
      items: items.map((user) => ({ ...user.toObject(), streak: streakByUser[user._id.toString()] || null })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

router.get(
  "/users/:id",
  requireAdminPermission("users:read"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const user = await User.findById(req.params.id).select("-refreshTokenVersion");
    if (!user) return fail(res, "User not found", 404);

    const [streak, tasks, rituals, journalEntries, communityPosts, challengeProgress] = await Promise.all([
      Streak.findOne({ userId: user._id }),
      Task.countDocuments({ userId: user._id }),
      RitualLog.countDocuments({ userId: user._id }),
      JournalEntry.countDocuments({ userId: user._id }),
      CommunityPost.countDocuments({ userId: user._id }),
      ChallengeProgress.find({ userId: user._id }).populate("challengeId", "title lengthDays"),
    ]);

    return ok(res, {
      user,
      stats: { streak, tasks, rituals, journalEntries, communityPosts, challengeProgress },
    });
  })
);

router.patch(
  "/users/:id",
  requireAdminPermission("users:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const allowed = ["fullName", "phoneNumber", "role", "onboardingComplete"];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!user) return fail(res, "User not found", 404);
    await audit(req, "user.update", "user", user._id, { fields: Object.keys(updates) });
    return ok(res, user);
  })
);

router.get(
  "/content/:type",
  requireAdminPermission("content:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const Model = CONTENT_MODELS[req.params.type];
    if (!Model) return fail(res, "Unknown content type", 404);

    const regex = searchRegex(req.query.search);
    const match = regex
      ? { $or: [{ name: regex }, { title: regex }, { text: regex }, { tagline: regex }, { subtitle: regex }, { author: regex }] }
      : {};
    if (req.query.status) match.status = req.query.status;
    if (req.query.isActive) match.isActive = req.query.isActive === "true";

    const { page, limit } = parsePage(req);
    const [items, total] = await Promise.all([
      Model.find(match).sort({ order: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Model.countDocuments(match),
    ]);

    return ok(res, { items, page, limit, total, totalPages: Math.ceil(total / limit) });
  })
);

router.post(
  "/content/:type",
  requireAdminPermission("content:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const Model = CONTENT_MODELS[req.params.type];
    if (!Model) return fail(res, "Unknown content type", 404);

    for (const field of CONTENT_REQUIRED_FIELDS[req.params.type] || []) {
      if (!req.body[field]) return fail(res, `${field} is required`, 400);
    }

    const item = await Model.create(req.body);
    await audit(req, "content.create", req.params.type, item._id);
    return ok(res, item, 201);
  })
);

router.put(
  "/content/:type/:id",
  requireAdminPermission("content:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const Model = CONTENT_MODELS[req.params.type];
    if (!Model) return fail(res, "Unknown content type", 404);

    const item = await Model.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!item) return fail(res, "Content item not found", 404);
    await audit(req, "content.update", req.params.type, item._id, { fields: Object.keys(req.body) });
    return ok(res, item);
  })
);

router.delete(
  "/content/:type/:id",
  requireAdminPermission("content:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const Model = CONTENT_MODELS[req.params.type];
    if (!Model) return fail(res, "Unknown content type", 404);

    const item = await Model.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "ARCHIVED", isActive: false } },
      { new: true }
    );
    if (!item) return fail(res, "Content item not found", 404);
    await audit(req, "content.archive", req.params.type, item._id);
    return ok(res, item);
  })
);

router.get(
  "/challenges",
  requireAdminPermission("challenges:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const challenges = await Challenge.find().sort({ order: 1, createdAt: -1 });
    const participantCounts = await ChallengeProgress.aggregate([{ $group: { _id: "$challengeId", count: { $sum: 1 } } }]);
    const countById = Object.fromEntries(participantCounts.map((entry) => [entry._id.toString(), entry.count]));
    return ok(res, challenges.map((challenge) => ({ ...challenge.toObject(), participants: countById[challenge._id.toString()] || 0 })));
  })
);

router.post(
  "/challenges",
  requireAdminPermission("challenges:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    if (!req.body.slug || !req.body.title || !req.body.lengthDays) {
      return fail(res, "slug, title and lengthDays are required", 400);
    }
    const challenge = await Challenge.create(req.body);
    await audit(req, "challenge.create", "challenge", challenge._id);
    return ok(res, challenge, 201);
  })
);

router.put(
  "/challenges/:id",
  requireAdminPermission("challenges:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const participants = await ChallengeProgress.countDocuments({ challengeId: req.params.id });
    if (participants > 0 && (req.body.lengthDays || req.body.dailyTasks)) {
      return fail(res, "Challenge has participants. Archive it or create a new version before structural changes.", 409);
    }
    const challenge = await Challenge.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!challenge) return fail(res, "Challenge not found", 404);
    await audit(req, "challenge.update", "challenge", challenge._id, { fields: Object.keys(req.body) });
    return ok(res, challenge);
  })
);

router.delete(
  "/challenges/:id",
  requireAdminPermission("challenges:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const challenge = await Challenge.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "ARCHIVED", isActive: false } },
      { new: true }
    );
    if (!challenge) return fail(res, "Challenge not found", 404);
    await audit(req, "challenge.archive", "challenge", challenge._id);
    return ok(res, challenge);
  })
);

router.get(
  "/community/posts",
  requireAdminPermission("community:moderate"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { page, limit } = parsePage(req);
    const regex = searchRegex(req.query.search);
    const match = {};
    if (req.query.status && req.query.status !== "all") {
      match.$or =
        req.query.status === "pending"
          ? [{ moderationStatus: "pending" }, { moderationStatus: { $exists: false } }]
          : [{ moderationStatus: req.query.status }];
    }
    if (req.query.category && req.query.category !== "all") match.category = req.query.category;
    if (req.query.flagged === "true") match.flagged = true;
    if (regex) {
      const searchOr = [{ content: regex }, { authorName: regex }];
      match.$and = match.$or ? [{ $or: match.$or }, { $or: searchOr }] : [{ $or: searchOr }];
      delete match.$or;
    }

    const [items, total] = await Promise.all([
      CommunityPost.find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "fullName email role"),
      CommunityPost.countDocuments(match),
    ]);

    return ok(res, {
      items: items.map(communityPostPayload),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

router.post(
  "/community/posts",
  requireAdminPermission("community:moderate"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { category, content, dayBadge, authorName, authorRole } = req.body;
    if (!category || !content) return fail(res, "category and content are required", 400);

    const post = await CommunityPost.create({
      authorName: String(authorName || "ARISE Team").trim(),
      authorRole: String(authorRole || "Admin").trim(),
      isAdminPost: true,
      category,
      content: String(content).trim(),
      dayBadge,
      moderationStatus: "approved",
      moderatedBy: req.adminId,
      moderatedAt: new Date(),
    });
    await audit(req, "community.post.create", "communityPost", post._id);
    return ok(res, communityPostPayload(post), 201);
  })
);

router.patch(
  "/community/posts/:id",
  requireAdminPermission("community:moderate"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const allowed = ["category", "content", "dayBadge", "authorName", "authorRole", "flagged"];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const post = await CommunityPost.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true })
      .populate("userId", "fullName email role");
    if (!post) return fail(res, "Community post not found", 404);
    await audit(req, "community.post.update", "communityPost", post._id, { fields: Object.keys(updates) });
    return ok(res, communityPostPayload(post));
  })
);

router.post(
  "/community/posts/:id/moderate",
  requireAdminPermission("community:moderate"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { action, reason } = req.body;
    if (!["approve", "reject", "flag"].includes(action)) return fail(res, "Unsupported moderation action", 400);

    const updates = {
      moderatedBy: req.adminId,
      moderatedAt: new Date(),
    };

    if (action === "approve") {
      updates.moderationStatus = "approved";
      updates.flagged = false;
      updates.rejectionReason = null;
    }
    if (action === "reject") {
      updates.moderationStatus = "rejected";
      updates.flagged = false;
      updates.rejectionReason = reason || "Rejected by moderator";
    }
    if (action === "flag") {
      updates.moderationStatus = "pending";
      updates.flagged = true;
      updates.rejectionReason = reason || null;
    }

    const post = await CommunityPost.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true })
      .populate("userId", "fullName email role");
    if (!post) return fail(res, "Community post not found", 404);

    if (action === "approve") {
      const approvedCommentCount = await Comment.countDocuments({ postId: post._id, moderationStatus: "approved", flagged: false });
      post.commentCount = approvedCommentCount;
      await post.save();
    }

    await audit(req, `community.post.${action}`, "communityPost", post._id, { reason });
    return ok(res, communityPostPayload(post));
  })
);

router.delete(
  "/community/posts/:id",
  requireAdminPermission("community:moderate"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const post = await CommunityPost.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          moderationStatus: "rejected",
          flagged: false,
          rejectionReason: "Removed by moderator",
          moderatedBy: req.adminId,
          moderatedAt: new Date(),
        },
      },
      { new: true }
    ).populate("userId", "fullName email role");
    if (!post) return fail(res, "Community post not found", 404);
    await audit(req, "community.post.remove", "communityPost", post._id);
    return ok(res, communityPostPayload(post));
  })
);

router.get(
  "/community/comments",
  requireAdminPermission("community:moderate"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { page, limit } = parsePage(req);
    const match = {};
    if (req.query.status && req.query.status !== "all") match.moderationStatus = req.query.status;
    if (req.query.flagged === "true") match.flagged = true;

    const [items, total] = await Promise.all([
      Comment.find(match)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "fullName email role")
        .populate("postId", "content category moderationStatus"),
      Comment.countDocuments(match),
    ]);

    return ok(res, {
      items: items.map((comment) => ({
        id: comment._id,
        author: comment.userId?.fullName || "Seeker",
        authorEmail: comment.userId?.email || null,
        content: comment.content,
        postContent: comment.postId?.content || "",
        postStatus: comment.postId?.moderationStatus || "",
        flagged: comment.flagged,
        reportCount: comment.reportCount || 0,
        moderationStatus: comment.moderationStatus || "pending",
        createdAt: comment.createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

router.post(
  "/community/comments/:id/moderate",
  requireAdminPermission("community:moderate"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { action } = req.body;
    if (!["approve", "reject", "flag"].includes(action)) return fail(res, "Unsupported moderation action", 400);

    const updates = { moderatedBy: req.adminId, moderatedAt: new Date() };
    if (action === "approve") {
      updates.moderationStatus = "approved";
      updates.flagged = false;
    }
    if (action === "reject") {
      updates.moderationStatus = "rejected";
      updates.flagged = false;
    }
    if (action === "flag") {
      updates.moderationStatus = "pending";
      updates.flagged = true;
    }

    const comment = await Comment.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!comment) return fail(res, "Comment not found", 404);

    const approvedCommentCount = await Comment.countDocuments({ postId: comment.postId, moderationStatus: "approved", flagged: false });
    await CommunityPost.findByIdAndUpdate(comment.postId, { $set: { commentCount: approvedCommentCount } });

    await audit(req, `community.comment.${action}`, "comment", comment._id);
    return ok(res, comment);
  })
);

router.get(
  "/deletion-requests",
  requireAdminPermission("deletions:read"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { page, limit } = parsePage(req);
    const regex = searchRegex(req.query.search);
    const match = {};
    if (req.query.status && req.query.status !== "all") match.status = req.query.status;
    if (regex) match.$or = [{ name: regex }, { email: regex }, { phone: regex }, { reason: regex }];

    const result = await DeleteAccountRequest.paginate(match, { page, limit, sort: { createdAt: -1 }, lean: true });
    return ok(res, result);
  })
);

router.post(
  "/deletion-requests/:requestId/action",
  requireAdminPermission("deletions:write"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { action } = req.body;
    const request = await DeleteAccountRequest.findOne({ id: req.params.requestId });
    if (!request) return fail(res, "Request not found", 404);

    if (action === "reject") {
      request.status = "Rejected";
      request.reviewedBy = req.adminId;
      request.reviewedByEmail = req.admin.email;
      request.reviewedAt = new Date();
      await request.save();
      await audit(req, "deletion.reject", "deleteAccountRequest", request.id);
      return ok(res, request);
    }

    if (action !== "delete") return fail(res, "Unsupported action", 400);
    const user = await User.findById(request.userId);
    if (!user) return fail(res, "User not found", 404);

    const archive = await archiveAndDeleteUser({ user, request, admin: req.adminId });
    await audit(req, "deletion.process", "deleteAccountRequest", request.id);
    return ok(res, archive);
  })
);

router.get(
  "/deleted-accounts",
  requireAdminPermission("deletions:read"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { page, limit } = parsePage(req);
    const regex = searchRegex(req.query.search);
    const match = regex ? { $or: [{ name: regex }, { email: regex }, { reason: regex }] } : {};
    const result = await DeletedAccount.paginate(match, { page, limit, sort: { deletedAt: -1, createdAt: -1 }, lean: true });
    return ok(res, result);
  })
);

router.get(
  "/audit-logs",
  requireAdminPermission("dashboard:read"),
  asyncHandler(async (req, res) => {
    await connectDB();
    const { page, limit } = parsePage(req);
    const logs = await AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const total = await AuditLog.countDocuments();
    return ok(res, { items: logs, page, limit, total, totalPages: Math.ceil(total / limit) });
  })
);

export default router;
