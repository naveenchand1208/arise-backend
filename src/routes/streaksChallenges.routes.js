import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import Streak from "../models/Streak.js";
import BeliefScore from "../models/BeliefScore.js";
import RitualLog from "../models/RitualLog.js";
import PatternBreak from "../models/PatternBreak.js";
import { WealthGoal } from "../models/Wealth.js";
import { Challenge, ChallengeProgress } from "../models/Challenge.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { challenges as seedChallenges } from "../seeds/data/systemContent.js";
import { averageBelief } from "../services/loopEngine.js";
import {
  calendarDayForAttempt,
  challengeSnapshot,
  challengeStreak,
  dayStatesForAttempt,
  refreshAttemptState,
} from "../services/challengeCompletion.js";

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
  const operations = seedChallenges.map((definition) => ({
    updateOne: {
      filter: {
        slug: definition.slug,
        $or: [
          { systemContent: true },
          { systemContent: { $exists: false } },
        ],
      },
      update: { $set: definition },
      upsert: true,
    },
  }));
  if (operations.length) await Challenge.bulkWrite(operations, { ordered: false });
}

async function metricsForUser(userId) {
  const [belief, patternBreaks, morningDays, wealth] = await Promise.all([
    BeliefScore.findOne({ userId }).sort({ date: -1 }),
    PatternBreak.countDocuments({ userId }),
    RitualLog.countDocuments({ userId, type: "morning", completed: true }),
    WealthGoal.findOne({ userId }),
  ]);
  return {
    beliefScore: belief ? averageBelief(belief) / 10 : null,
    patternBreaks,
    morningDays,
    income: wealth?.currentMonthReceived ?? null,
  };
}

async function serializeAttempt(challenge, progress, userId, includeMetrics = false) {
  if (!progress) return null;
  await refreshAttemptState(progress, challenge);
  const snapshot = progress.challengeSnapshot || challengeSnapshot(challenge);
  const duration = snapshot.lengthDays || challenge.lengthDays;
  const currentDay = calendarDayForAttempt(progress, duration);
  const completedCount = new Set(progress.completedDays || []).size;
  const dayStates = dayStatesForAttempt(progress, challenge);
  const todayTask = (snapshot.dailyTasks || []).find((item) => Number(item.day) === currentDay) || null;
  const todayState = dayStates.find((item) => item.dayNumber === currentDay);
  const elapsedDays = Math.max(1, Math.min(currentDay, duration));
  const result = {
    id: progress._id,
    challengeId: challenge._id,
    attemptNumber: progress.attemptNumber,
    challengeVersion: progress.challengeVersion,
    status: progress.status,
    startedAt: progress.startedAt,
    startDate: progress.startDate,
    completedAt: progress.completedAt,
    currentDay,
    completedDays: progress.completedDays,
    completedCount,
    completionPercent: Math.round((completedCount / duration) * 100),
    dailyCompletionRate: Math.round((completedCount / elapsedDays) * 100),
    challengeStreak: challengeStreak(progress.completedDays),
    dayStates,
    todayTask,
    todayComplete: todayState?.status === "completed",
    todayCompletedAt: todayState?.completedAt || null,
  };
  if (includeMetrics && challenge.lengthDays === 90) {
    const current = await metricsForUser(userId);
    const baseline = progress.baselineMetrics || {};
    result.transformation = {
      beliefScore: { baseline: baseline.beliefScore ?? null, current: current.beliefScore },
      patternBreaks: Math.max(0, current.patternBreaks - (baseline.patternBreaks || 0)),
      morningDays: Math.max(0, current.morningDays - (baseline.morningDays || 0)),
      income: { baseline: baseline.income ?? null, current: current.income },
    };
  }
  return result;
}

function chooseLatestProgress(progressItems) {
  return (
    progressItems.find((item) => item.status === "active") ||
    progressItems.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0] ||
    null
  );
}

challengesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    await ensureChallenges();
    const [challenges, progress] = await Promise.all([
      Challenge.find({ status: "PUBLISHED", isActive: true }).sort({ order: 1, title: 1 }),
      ChallengeProgress.find({ userId: req.userId }).sort({ startedAt: -1 }),
    ]);
    const attemptsByChallenge = {};
    for (const attempt of progress) {
      const key = attempt.challengeId.toString();
      (attemptsByChallenge[key] ||= []).push(attempt);
    }
    const results = [];
    for (const challenge of challenges) {
      const attempt = chooseLatestProgress(attemptsByChallenge[challenge._id.toString()] || []);
      results.push({
        ...challenge.toObject(),
        progress: await serializeAttempt(challenge, attempt, req.userId),
      });
    }
    return ok(res, results);
  })
);

challengesRouter.get(
  "/active",
  asyncHandler(async (req, res) => {
    await connectDB();
    const attempts = await ChallengeProgress.find({ userId: req.userId, status: "active" })
      .sort({ startedAt: -1 })
      .populate("challengeId");
    const results = [];
    for (const attempt of attempts) {
      if (!attempt.challengeId) continue;
      results.push({
        challenge: attempt.challengeId,
        progress: await serializeAttempt(attempt.challengeId, attempt, req.userId, true),
      });
    }
    return ok(res, results);
  })
);

challengesRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    await connectDB();
    const attempts = await ChallengeProgress.find({ userId: req.userId })
      .sort({ startedAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 30, 60))
      .populate("challengeId");
    const results = [];
    for (const attempt of attempts) {
      if (!attempt.challengeId) continue;
      results.push({
        challenge: attempt.challengeId,
        progress: await serializeAttempt(attempt.challengeId, attempt, req.userId, true),
      });
    }
    return ok(res, results);
  })
);

challengesRouter.get(
  "/progress/:progressId",
  asyncHandler(async (req, res) => {
    await connectDB();
    const progress = await ChallengeProgress.findOne({
      _id: req.params.progressId,
      userId: req.userId,
    }).populate("challengeId");
    if (!progress || !progress.challengeId) return fail(res, "Challenge attempt not found", 404);
    return ok(res, {
      challenge: progress.challengeId,
      progress: await serializeAttempt(progress.challengeId, progress, req.userId, true),
    });
  })
);

challengesRouter.get(
  "/:id/progress",
  asyncHandler(async (req, res) => {
    await connectDB();
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) return fail(res, "Challenge not found", 404);
    const progressItems = await ChallengeProgress.find({
      userId: req.userId,
      challengeId: challenge._id,
    }).sort({ startedAt: -1 });
    const progress = chooseLatestProgress(progressItems);
    return ok(res, {
      challenge,
      progress: await serializeAttempt(challenge, progress, req.userId, true),
    });
  })
);

challengesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    await ensureChallenges();
    const challenge = await Challenge.findOne({
      _id: req.params.id,
      status: "PUBLISHED",
      isActive: true,
    });
    if (!challenge) return fail(res, "Challenge not found", 404);
    const progressItems = await ChallengeProgress.find({
      userId: req.userId,
      challengeId: challenge._id,
    }).sort({ startedAt: -1 });
    const progress = chooseLatestProgress(progressItems);
    return ok(res, {
      ...challenge.toObject(),
      progress: await serializeAttempt(challenge, progress, req.userId, true),
    });
  })
);

challengesRouter.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    await connectDB();
    await ensureChallenges();
    const challenge = await Challenge.findOne({
      _id: req.params.id,
      status: "PUBLISHED",
      isActive: true,
    });
    if (!challenge) return fail(res, "Challenge not found", 404);

    const existing = await ChallengeProgress.findOne({
      userId: req.userId,
      challengeId: challenge._id,
      status: "active",
    });
    if (existing) {
      return ok(res, await serializeAttempt(challenge, existing, req.userId, true));
    }

    const lastAttempt = await ChallengeProgress.findOne({
      userId: req.userId,
      challengeId: challenge._id,
    }).sort({ attemptNumber: -1 });
    const timezoneOffsetMinutes = Math.max(
      -720,
      Math.min(840, Number(req.body.timezoneOffsetMinutes) || 0)
    );
    const now = new Date();
    const baselineMetrics = await metricsForUser(req.userId);
    let progress;
    try {
      progress = await ChallengeProgress.create({
        userId: req.userId,
        challengeId: challenge._id,
        attemptNumber: (lastAttempt?.attemptNumber || 0) + 1,
        challengeVersion: challenge.version || 1,
        challengeSnapshot: challengeSnapshot(challenge),
        timezoneOffsetMinutes,
        startedAt: now,
        startDate: now,
        currentDay: 1,
        completedDays: [],
        dailyProgress: [],
        baselineMetrics,
        status: "active",
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      progress = await ChallengeProgress.findOne({
        userId: req.userId,
        challengeId: challenge._id,
        status: "active",
      });
    }
    return ok(res, await serializeAttempt(challenge, progress, req.userId, true), 201);
  })
);
