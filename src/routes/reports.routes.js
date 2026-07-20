import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import RitualLog from "../models/RitualLog.js";
import Task from "../models/Task.js";
import JournalEntry from "../models/JournalEntry.js";
import BeliefScore from "../models/BeliefScore.js";
import Streak from "../models/Streak.js";
import { ChallengeProgress } from "../models/Challenge.js";
import { WealthGoal } from "../models/Wealth.js";
import { ok } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/weekly",
  asyncHandler(async (req, res) => {
    await connectDB();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [morningLogs, nightLogs, tasks, journalCount] = await Promise.all([
      RitualLog.find({ userId: req.userId, type: "morning", date: { $gte: since }, completed: true }),
      RitualLog.find({ userId: req.userId, type: "night", date: { $gte: since }, completed: true }),
      Task.find({ userId: req.userId, date: { $gte: since } }),
      JournalEntry.countDocuments({ userId: req.userId, date: { $gte: since } }),
    ]);

    return ok(res, {
      weekOf: since,
      morningRituals: { done: morningLogs.length, total: 7 },
      nightProtocols: { done: nightLogs.length, total: 7 },
      tasksDone: { done: tasks.filter((t) => t.status === "done").length, total: tasks.length },
      journalEntries: journalCount,
    });
  })
);

router.get(
  "/monthly",
  asyncHandler(async (req, res) => {
    await connectDB();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [firstScore, latestScore, morningLogs, journalCount, streak, wealthGoal] = await Promise.all([
      BeliefScore.findOne({ userId: req.userId, date: { $gte: since } }).sort({ date: 1 }),
      BeliefScore.findOne({ userId: req.userId }).sort({ date: -1 }),
      RitualLog.find({ userId: req.userId, type: "morning", date: { $gte: since } }),
      JournalEntry.countDocuments({ userId: req.userId, date: { $gte: since } }),
      Streak.findOne({ userId: req.userId }),
      WealthGoal.findOne({ userId: req.userId }),
    ]);

    const delta = (a, b) => (a != null && b != null ? Math.round((b - a) * 10) / 10 : null);

    return ok(res, {
      month: new Date().toISOString().slice(0, 7),
      beliefEvolution: {
        health: { from: firstScore?.health, to: latestScore?.health, delta: delta(firstScore?.health, latestScore?.health) },
        wealth: { from: firstScore?.wealth, to: latestScore?.wealth, delta: delta(firstScore?.wealth, latestScore?.wealth) },
        happiness: {
          from: firstScore?.happiness,
          to: latestScore?.happiness,
          delta: delta(firstScore?.happiness, latestScore?.happiness),
        },
      },
      sessionsCompleted: morningLogs.filter((l) => l.completed).length,
      meditationSeconds: streak?.totalMeditationSeconds || 0,
      journalEntries: journalCount,
      incomeThisMonth: wealthGoal?.currentMonthReceived || 0,
    });
  })
);

router.get(
  "/loop-bottleneck",
  asyncHandler(async (req, res) => {
    await connectDB();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [latestBelief, morningLogs, streak, challengeProgress, wealthGoal] = await Promise.all([
      BeliefScore.findOne({ userId: req.userId }).sort({ date: -1 }),
      RitualLog.find({ userId: req.userId, type: "morning", date: { $gte: since } }),
      Streak.findOne({ userId: req.userId }),
      ChallengeProgress.findOne({ userId: req.userId, status: "active" }),
      WealthGoal.findOne({ userId: req.userId }),
    ]);

    const beliefScore = latestBelief
      ? Math.round(((latestBelief.health + latestBelief.wealth + latestBelief.happiness) / 3) * 10)
      : 0;

    const behaviourScore = Math.round((morningLogs.filter((l) => l.completed).length / 7) * 100);

    const streakConsistency = streak?.best ? Math.round((streak.current / streak.best) * 100) : 0;
    const challengeProgressPct = challengeProgress
      ? Math.round((challengeProgress.completedDays.length / (challengeProgress.currentDay || 1)) * 100)
      : 0;
    const patternScore = Math.round((streakConsistency + challengeProgressPct) / (challengeProgress ? 2 : 1));

    const resultScore = wealthGoal
      ? Math.min(100, Math.round((wealthGoal.currentMonthReceived / wealthGoal.monthlyIntentionAmount) * 100))
      : 0;

    const layers = [
      { key: "belief", label: "Belief", score: beliefScore, hint: "Your self-rated Health/Wealth/Happiness scores." },
      { key: "behaviour", label: "Behaviour", score: behaviourScore, hint: "Morning ritual completion, last 7 days." },
      { key: "pattern", label: "Pattern", score: patternScore, hint: "Streak consistency + active challenge progress." },
      { key: "result", label: "Result", score: resultScore, hint: "Progress toward your monthly wealth goal." },
    ];

    const bottleneck = layers.reduce((min, l) => (l.score < min.score ? l : min), layers[0]);

    return ok(res, { layers, bottleneck: bottleneck.key });
  })
);

export default router;
