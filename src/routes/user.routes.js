import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import User from "../models/User.js";
import Streak from "../models/Streak.js";
import BeliefScore from "../models/BeliefScore.js";
import { Notification } from "../models/Community.js";
import { ok } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    await connectDB();
    const [user, streak, latestScore] = await Promise.all([
      User.findById(req.userId).select("-passwordHash"),
      Streak.findOne({ userId: req.userId }),
      BeliefScore.findOne({ userId: req.userId }).sort({ date: -1 }),
    ]);

    const avgBeliefScore = latestScore
      ? Math.round(((latestScore.health + latestScore.wealth + latestScore.happiness) / 3) * 10) / 10
      : null;

    return ok(res, {
      user,
      stats: {
        streak: streak?.current || 0,
        bestStreak: streak?.best || 0,
        sessions: streak?.totalSessions || 0,
        beliefScore: avgBeliefScore,
      },
    });
  })
);

router.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    await connectDB();
    const user = await User.findById(req.userId);
    user.settings = { ...user.settings.toObject(), ...req.body };
    await user.save();
    return ok(res, user.settings);
  })
);

router.delete(
  "/settings",
  asyncHandler(async (req, res) => {
    // "Delete All Data" — irreversible, requires confirmation on the client.
    await connectDB();
    await User.findByIdAndDelete(req.userId);
    // NOTE: in production, cascade-delete all related collections (Task, JournalEntry,
    // BeliefScore, RitualLog, Streak, WealthGoal, EnergyLog, ChallengeProgress, CommunityPost)
    // via a transaction or background job here.
    return ok(res, { deleted: true });
  })
);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    await connectDB();
    const notifications = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);
    return ok(res, notifications);
  })
);

router.delete(
  "/notifications",
  asyncHandler(async (req, res) => {
    await connectDB();
    await Notification.deleteMany({ userId: req.userId });
    return ok(res, { cleared: true });
  })
);

export default router;
