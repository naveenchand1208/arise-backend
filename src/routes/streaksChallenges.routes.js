import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import Streak from "../models/Streak.js";
import { Challenge, ChallengeProgress } from "../models/Challenge.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const streaksRouter = Router();
streaksRouter.use(requireAuth);

streaksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const streak = await Streak.findOne({ userId: req.userId });
    return ok(res, streak);
  })
);

export const challengesRouter = Router();
challengesRouter.use(requireAuth);

challengesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const [challenges, progress] = await Promise.all([
      Challenge.find(),
      ChallengeProgress.find({ userId: req.userId }),
    ]);
    const progressByChallengeId = Object.fromEntries(progress.map((p) => [p.challengeId.toString(), p]));
    return ok(
      res,
      challenges.map((c) => ({ ...c.toObject(), progress: progressByChallengeId[c._id.toString()] || null }))
    );
  })
);

challengesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { challengeId } = req.body;
    if (!challengeId) return fail(res, "challengeId is required");

    const progress = await ChallengeProgress.findOneAndUpdate(
      { userId: req.userId, challengeId },
      { $setOnInsert: { userId: req.userId, challengeId, startedAt: new Date(), currentDay: 1, status: "active" } },
      { upsert: true, new: true }
    );

    return ok(res, progress, 201);
  })
);

challengesRouter.post(
  "/:id/complete-day",
  asyncHandler(async (req, res) => {
    await connectDB();
    const progress = await ChallengeProgress.findOne({ userId: req.userId, challengeId: req.params.id });
    if (!progress) return fail(res, "Challenge not started", 404);

    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) return fail(res, "Challenge not found", 404);

    if (!progress.completedDays.includes(progress.currentDay)) {
      progress.completedDays.push(progress.currentDay);
    }

    if (progress.currentDay >= challenge.lengthDays) {
      progress.status = "completed";
    } else {
      progress.currentDay += 1;
    }

    await progress.save();
    return ok(res, progress);
  })
);
