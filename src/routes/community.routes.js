import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { CommunityPost, Comment } from "../models/Community.js";
import RitualLog from "../models/RitualLog.js";
import JournalEntry from "../models/JournalEntry.js";
import PatternBreak from "../models/PatternBreak.js";
import { WealthPracticeLog } from "../models/Wealth.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

async function listPosts(req, res) {
  await connectDB();
  const { category, limit } = req.query;
  const filter = { moderationStatus: "approved", flagged: false, ...(category && { category }) };
  const posts = await CommunityPost.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit) || 20)
    .populate("userId", "fullName role");

  return ok(
    res,
    posts.map((p) => ({
      id: p._id,
      author: p.authorName || p.userId?.fullName || "ARISE",
      role: p.authorRole || p.userId?.role,
      isAdminPost: p.isAdminPost,
      category: p.category,
      content: p.content,
      dayBadge: p.dayBadge,
      likeCount: p.likes.length,
      likedByMe: p.likes.some((id) => id.toString() === req.userId),
      commentCount: p.commentCount,
      createdAt: p.createdAt,
    }))
  );
}

router.get(
  "/posts",
  asyncHandler(listPosts)
);

router.get(
  "/feed",
  asyncHandler(listPosts)
);

router.get(
  "/trending",
  asyncHandler(async (req, res) => {
    await connectDB();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [
      breathwork,
      meditation,
      sats,
      patternBreaks,
      receiving,
      asana,
      beliefJournals,
    ] = await Promise.all([
      RitualLog.countDocuments({ "steps.key": "breathwork", "steps.completedAt": { $gte: since } }),
      RitualLog.countDocuments({ "steps.key": "mind_programming", "steps.completedAt": { $gte: since } }),
      RitualLog.countDocuments({ type: "night", satsScene: { $nin: [null, ""] }, updatedAt: { $gte: since } }),
      PatternBreak.countDocuments({ loggedAt: { $gte: since } }),
      WealthPracticeLog.countDocuments({ containerExpansionDone: true, updatedAt: { $gte: since } }),
      RitualLog.countDocuments({ "steps.key": { $in: ["body_activation", "tibetan-rites"] }, "steps.completedAt": { $gte: since } }),
      JournalEntry.countDocuments({ type: { $in: ["daily", "shadow", "revision"] }, date: { $gte: since } }),
    ]);

    const items = [
      { id: "mirror-mind", title: "Mirror of the Mind", subtitle: "Silva Method - Alpha problem solving", layer: "Belief", route: "/library/masters", uses: beliefJournals },
      { id: "breathwork", title: "Power Breathwork", subtitle: "Breath rounds completed", layer: "Behaviour", route: "/rituals/breathwork", uses: breathwork },
      { id: "pattern-break", title: "Pattern Break Logger", subtitle: "Pattern loops interrupted", layer: "Pattern", route: "/pattern/breaks", uses: patternBreaks },
      { id: "sats", title: "SATS Sleep Programming", subtitle: "Night subconscious scenes", layer: "Night", route: "/rituals/sats", uses: sats },
      { id: "receiving", title: "Receiving Container Journal", subtitle: "Container expansion practices", layer: "Wealth", route: "/wealth/receiving-container", uses: receiving },
      { id: "asana", title: "Asana Activation", subtitle: "Body activation completions", layer: "Ancient", route: "/rituals/asana-library", uses: asana + meditation },
    ].sort((a, b) => b.uses - a.uses);

    return ok(res, items.map((item, index) => ({ ...item, rank: index + 1 })));
  })
);

router.post(
  "/posts",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { category, content, dayBadge } = req.body;
    if (!category || !content) return fail(res, "category and content are required");

    const post = await CommunityPost.create({
      userId: req.userId,
      category,
      content: content.trim(),
      dayBadge,
      moderationStatus: "pending",
    });
    return ok(res, {
      id: post._id,
      moderationStatus: post.moderationStatus,
      message: "Post submitted for admin approval.",
    }, 201);
  })
);

router.post(
  "/posts/:id/like",
  asyncHandler(async (req, res) => {
    await connectDB();
    const post = await CommunityPost.findOne({ _id: req.params.id, moderationStatus: "approved", flagged: false });
    if (!post) return fail(res, "Post not found", 404);

    const alreadyLiked = post.likes.some((id) => id.toString() === req.userId);
    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== req.userId);
    } else {
      post.likes.push(req.userId);
    }

    await post.save();
    return ok(res, { likeCount: post.likes.length, likedByMe: !alreadyLiked });
  })
);

router.post(
  "/posts/:id/report",
  asyncHandler(async (req, res) => {
    await connectDB();
    const post = await CommunityPost.findOne({ _id: req.params.id, moderationStatus: "approved" });
    if (!post) return fail(res, "Post not found", 404);

    post.reportCount += 1;
    post.flagged = true;
    post.moderationStatus = "pending";
    await post.save();
    return ok(res, { reported: true });
  })
);

router.get(
  "/posts/:id/comments",
  asyncHandler(async (req, res) => {
    await connectDB();
    const comments = await Comment.find({ postId: req.params.id, moderationStatus: "approved", flagged: false })
      .sort({ createdAt: 1 })
      .populate("userId", "fullName role");

    return ok(
      res,
      comments.map((c) => ({
        id: c._id,
        author: c.userId?.fullName || "Seeker",
        role: c.userId?.role,
        content: c.content,
        createdAt: c.createdAt,
      }))
    );
  })
);

router.post(
  "/posts/:id/comments",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { content } = req.body;
    if (!content || !content.trim()) return fail(res, "content is required");

    const post = await CommunityPost.findOne({ _id: req.params.id, moderationStatus: "approved", flagged: false });
    if (!post) return fail(res, "Post not found", 404);

    const comment = await Comment.create({ postId: req.params.id, userId: req.userId, content: content.trim() });
    await post.save();

    return ok(res, {
      id: comment._id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: "You",
      moderationStatus: comment.moderationStatus,
      message: "Comment submitted for admin approval.",
    }, 201);
  })
);

router.post(
  "/comments/:id/report",
  asyncHandler(async (req, res) => {
    await connectDB();
    const comment = await Comment.findOne({ _id: req.params.id, moderationStatus: "approved" });
    if (!comment) return fail(res, "Comment not found", 404);

    comment.reportCount += 1;
    comment.flagged = true;
    comment.moderationStatus = "pending";
    await comment.save();
    return ok(res, { reported: true });
  })
);

export default router;
