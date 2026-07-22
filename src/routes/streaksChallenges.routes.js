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

const DEFAULT_CHALLENGES = [
  {
    slug: "arise-21-day-belief-reset",
    title: "21-Day Belief Reset",
    teacher: "ARISE",
    lengthDays: 21,
    description: "Daily prompts to interrupt old belief loops and install aligned action.",
  },
  {
    slug: "arise-66-day-identity-rewire",
    title: "66-Day Identity Rewire",
    teacher: "ARISE",
    lengthDays: 66,
    description: "A pattern-building challenge for becoming the identity you say you want.",
  },
  {
    slug: "arise-90-day-mastery",
    title: "90-Day Mastery",
    teacher: "ARISE",
    lengthDays: 90,
    description: "A full quarter of belief, behavior, pattern, and result integration.",
  },
];

const DEFAULT_PROMPTS = [
  "Name one belief running your day and choose one better action.",
  "Complete one aligned action before checking for external validation.",
  "Pause before one automatic reaction and choose your new identity.",
  "Write one sentence of evidence that you are changing.",
  "Practice gratitude for a result before it has fully arrived.",
];

async function ensureChallenges() {
  const count = await Challenge.countDocuments({ status: "PUBLISHED", isActive: true });
  if (count > 0) return;

  await Challenge.insertMany(
    DEFAULT_CHALLENGES.map((challenge) => ({
      ...challenge,
      status: "PUBLISHED",
      isActive: true,
      dailyTasks: Array.from({ length: challenge.lengthDays }, (_, index) => ({
        day: index + 1,
        prompt: DEFAULT_PROMPTS[index % DEFAULT_PROMPTS.length],
      })),
    }))
  );
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
