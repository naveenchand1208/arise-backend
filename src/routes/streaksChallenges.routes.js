import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import Streak from "../models/Streak.js";
import { Challenge, ChallengeProgress } from "../models/Challenge.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { challenges as seedChallenges } from "../seeds/data/systemContent.js";

export const streaksRouter = Router();
streaksRouter.use(requireAuth);

streaksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const streak = await Streak.findOne({ userId: req.userId });
    return ok(
      res,
      streak || {
        userId: req.userId,
        current: 0,
        best: 0,
        totalSessions: 0,
        totalMeditationSeconds: 0,
        milestonesUnlocked: [],
      }
    );
  })
);

export const challengesRouter = Router();
challengesRouter.use(requireAuth);

async function ensureChallenges() {
  const count = await Challenge.countDocuments({ status: "PUBLISHED", isActive: true });
  if (count > 0) return;
  await Challenge.insertMany(seedChallenges);
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

challengesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    await ensureChallenges();
    const [challenges, progress] = await Promise.all([
      Challenge.find({ status: "PUBLISHED", isActive: true }).sort({ order: 1, title: 1 }),
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
  "/:id/start",
  asyncHandler(async (req, res) => {
    await connectDB();
    const challenge = await Challenge.findOne({ _id: req.params.id, status: "PUBLISHED", isActive: true });
    if (!challenge) return fail(res, "Challenge not found", 404);

    const progress = await ChallengeProgress.findOneAndUpdate(
      { userId: req.userId, challengeId: req.params.id },
      { $setOnInsert: { userId: req.userId, challengeId: req.params.id, startedAt: new Date(), currentDay: 1, status: "active" } },
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
    if (progress.status === "completed") return ok(res, progress);
    if (isSameDay(progress.lastCompletedAt, new Date())) return ok(res, progress);

    if (!progress.completedDays.includes(progress.currentDay)) {
      progress.completedDays.push(progress.currentDay);
    }
    progress.lastCompletedAt = new Date();

    if (progress.currentDay >= challenge.lengthDays) {
      progress.status = "completed";
    } else {
      progress.currentDay += 1;
    }

    await progress.save();
    return ok(res, progress);
  })
);
