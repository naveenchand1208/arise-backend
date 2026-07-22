import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { CommunityPost, Comment } from "../models/Community.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

async function listPosts(req, res) {
  await connectDB();
  const { category, limit } = req.query;
  const filter = { flagged: false, ...(category && { category }) };
  const posts = await CommunityPost.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit) || 20)
    .populate("userId", "fullName role");

  return ok(
    res,
    posts.map((p) => ({
      id: p._id,
      author: p.userId?.fullName || "Seeker",
      role: p.userId?.role,
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

router.post(
  "/posts",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { category, content, dayBadge } = req.body;
    if (!category || !content) return fail(res, "category and content are required");

    const post = await CommunityPost.create({ userId: req.userId, category, content, dayBadge });
    return ok(res, post, 201);
  })
);

router.post(
  "/posts/:id/like",
  asyncHandler(async (req, res) => {
    await connectDB();
    const post = await CommunityPost.findById(req.params.id);
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

router.get(
  "/posts/:id/comments",
  asyncHandler(async (req, res) => {
    await connectDB();
    const comments = await Comment.find({ postId: req.params.id })
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

    const post = await CommunityPost.findById(req.params.id);
    if (!post) return fail(res, "Post not found", 404);

    const comment = await Comment.create({ postId: req.params.id, userId: req.userId, content: content.trim() });
    post.commentCount += 1;
    await post.save();

    return ok(res, { id: comment._id, content: comment.content, createdAt: comment.createdAt, author: "You" }, 201);
  })
);

export default router;
