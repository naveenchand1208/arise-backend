import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import PatternBreak from "../models/PatternBreak.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { evaluateChallengeProgress } from "../services/challengeCompletion.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/breaks",
  asyncHandler(async (req, res) => {
    await connectDB();
    const limit = Number(req.query.limit) || 30;
    const entries = await PatternBreak.find({ userId: req.userId }).sort({ loggedAt: -1 }).limit(limit);

    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekCount = await PatternBreak.countDocuments({ userId: req.userId, loggedAt: { $gte: weekStart } });

    return ok(res, { entries, weekCount });
  })
);

router.post(
  "/breaks",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { oldPattern, newBehaviour, trigger, resultSignal } = req.body;
    if (!oldPattern || !newBehaviour) return fail(res, "oldPattern and newBehaviour are required");

    const entry = await PatternBreak.create({
      userId: req.userId,
      oldPattern: String(oldPattern).trim(),
      newBehaviour: String(newBehaviour).trim(),
      trigger: trigger ? String(trigger).trim() : null,
      resultSignal: resultSignal ? String(resultSignal).trim() : null,
      loggedAt: new Date(),
    });
    await evaluateChallengeProgress({
      userId: req.userId,
      activityType: "PATTERN_BREAK",
      activityId: entry._id,
      completedAt: entry.loggedAt,
    });

    return ok(res, entry, 201);
  })
);

export default router;
