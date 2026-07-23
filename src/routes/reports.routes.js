import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import RitualLog from "../models/RitualLog.js";
import Task from "../models/Task.js";
import JournalEntry from "../models/JournalEntry.js";
import BeliefScore from "../models/BeliefScore.js";
import BeliefPractice from "../models/BeliefPractice.js";
import Streak from "../models/Streak.js";
import { WealthGoal } from "../models/Wealth.js";
import PatternBreak from "../models/PatternBreak.js";
import { averageBelief, calculateLoopEngine, daysAgo, delta, percent } from "../services/loopEngine.js";
import { ok } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const monthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

router.get(
  "/weekly",
  asyncHandler(async (req, res) => {
    await connectDB();
    const since = daysAgo(7);

    const journalFilter = { userId: req.userId, date: { $gte: since } };
    const [morningLogs, nightLogs, tasks, journalCount, journalReflections, beliefPractices] = await Promise.all([
      RitualLog.find({ userId: req.userId, type: "morning", date: { $gte: since }, completed: true }),
      RitualLog.find({ userId: req.userId, type: "night", date: { $gte: since }, completed: true }),
      Task.find({ userId: req.userId, date: { $gte: since } }),
      JournalEntry.countDocuments(journalFilter),
      JournalEntry.find(journalFilter).sort({ date: -1 }).limit(5).select("type date content tag"),
      BeliefPractice.countDocuments({
        userId: req.userId,
        status: { $ne: "draft" },
        completedAt: { $gte: since },
      }),
    ]);

    return ok(res, {
      weekOf: since,
      morningRituals: { done: morningLogs.length, total: 7 },
      nightProtocols: { done: nightLogs.length, total: 7 },
      tasksDone: { done: tasks.filter((t) => t.status === "done").length, total: tasks.length },
      journalEntries: journalCount,
      journalReflections,
      beliefPractices,
    });
  })
);

router.get(
  "/monthly",
  asyncHandler(async (req, res) => {
    await connectDB();
    const since = daysAgo(30);

    const journalFilter = { userId: req.userId, date: { $gte: since } };
    const [firstScore, latestScore, morningLogs, journalCount, journalReflections, streak, wealthGoal] = await Promise.all([
      BeliefScore.findOne({ userId: req.userId, date: { $gte: since } }).sort({ date: 1 }),
      BeliefScore.findOne({ userId: req.userId }).sort({ date: -1 }),
      RitualLog.find({ userId: req.userId, type: "morning", date: { $gte: since } }),
      JournalEntry.countDocuments(journalFilter),
      JournalEntry.find(journalFilter).sort({ date: -1 }).limit(8).select("type date content tag"),
      Streak.findOne({ userId: req.userId }),
      WealthGoal.findOne({ userId: req.userId }),
    ]);

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
      journalReflections,
      incomeThisMonth: wealthGoal?.currentMonthReceived || 0,
    });
  })
);

router.get(
  "/loop-bottleneck",
  asyncHandler(async (req, res) => {
    await connectDB();
    const loop = await calculateLoopEngine(req.userId, { windowDays: 7 });
    return ok(res, { layers: loop.layers, bottleneck: loop.bottleneck, windowDays: loop.windowDays });
  })
);

router.get(
  "/result-hub",
  asyncHandler(async (req, res) => {
    await connectDB();
    const since = daysAgo(30);

    const [loop, journalEntries, patternBreaks] =
      await Promise.all([
        calculateLoopEngine(req.userId, { windowDays: 30 }),
        JournalEntry.countDocuments({ userId: req.userId, date: { $gte: since } }),
        PatternBreak.countDocuments({ userId: req.userId, loggedAt: { $gte: since } }),
      ]);

    const goal = loop.inputs.wealthGoal;
    const activeChallengeDay = loop.inputs.activeChallenge?.currentDay || loop.inputs.streak?.current || 0;
    const layerScore = (key) => loop.layers.find((layer) => layer.key === key)?.score || 0;

    return ok(res, {
      beliefScore: layerScore("belief"),
      behaviourPercent: layerScore("behaviour"),
      patternDay: activeChallengeDay,
      incomeGrowthPercent: layerScore("result"),
      currentMonthReceived: goal?.currentMonthReceived || 0,
      monthlyIntentionAmount: goal?.monthlyIntentionAmount || 0,
      journalEntries,
      patternBreaks,
      hasIncomeData: !!goal,
      loop: { layers: loop.layers, bottleneck: loop.bottleneck, windowDays: loop.windowDays },
    });
  })
);

router.get(
  "/belief-evolution",
  asyncHandler(async (req, res) => {
    await connectDB();
    const days = Math.min(Number(req.query.days) || 90, 365);
    const since = daysAgo(days);

    const scores = await BeliefScore.find({ userId: req.userId, date: { $gte: since } })
      .sort({ date: 1 })
      .select("date health wealth happiness energy purpose iAmStatement focusAreas");
    const first = scores[0] || null;
    const latest = scores[scores.length - 1] || null;

    return ok(res, {
      days,
      startAverage: averageBelief(first),
      currentAverage: averageBelief(latest),
      deltaAverage: latest && first ? averageBelief(latest) - averageBelief(first) : 0,
      domains: {
        health: { from: first?.health ?? null, to: latest?.health ?? null, delta: delta(first?.health, latest?.health) },
        wealth: { from: first?.wealth ?? null, to: latest?.wealth ?? null, delta: delta(first?.wealth, latest?.wealth) },
        happiness: {
          from: first?.happiness ?? null,
          to: latest?.happiness ?? null,
          delta: delta(first?.happiness, latest?.happiness),
        },
        energy: { from: firstScore?.energy, to: latestScore?.energy, delta: delta(firstScore?.energy, latestScore?.energy) },
        purpose: { from: firstScore?.purpose, to: latestScore?.purpose, delta: delta(firstScore?.purpose, latestScore?.purpose) },
        energy: {
          from: first?.energy ?? null,
          to: latest?.energy ?? null,
          delta: delta(first?.energy, latest?.energy),
        },
        purpose: {
          from: first?.purpose ?? null,
          to: latest?.purpose ?? null,
          delta: delta(first?.purpose, latest?.purpose),
        },
      },
      points: scores.map((score) => ({
        date: score.date,
        health: score.health,
        wealth: score.wealth,
        happiness: score.happiness,
        energy: score.energy,
        purpose: score.purpose,
        average: averageBelief(score),
      })),
    });
  })
);

router.get(
  "/income-vs-mindset",
  asyncHandler(async (req, res) => {
    await connectDB();
    const since = monthStart();
    const [firstScore, latestScore, wealthGoal, journalEntries] = await Promise.all([
      BeliefScore.findOne({ userId: req.userId, date: { $gte: since } }).sort({ date: 1 }),
      BeliefScore.findOne({ userId: req.userId }).sort({ date: -1 }),
      WealthGoal.findOne({ userId: req.userId }),
      JournalEntry.find({ userId: req.userId, type: { $in: ["daily", "monthly"] }, date: { $gte: since } })
        .sort({ date: -1 })
        .limit(4)
        .select("type date content tag"),
    ]);

    return ok(res, {
      month: new Date().toISOString().slice(0, 7),
      currentMonthReceived: wealthGoal?.currentMonthReceived || 0,
      monthlyIntentionAmount: wealthGoal?.monthlyIntentionAmount || 0,
      incomePercent: wealthGoal ? percent(wealthGoal.currentMonthReceived, wealthGoal.monthlyIntentionAmount) : 0,
      mindsetStart: averageBelief(firstScore),
      mindsetNow: averageBelief(latestScore),
      mindsetDelta: latestScore && firstScore ? averageBelief(latestScore) - averageBelief(firstScore) : 0,
      affirmationText: wealthGoal?.affirmationText || "",
      reflections: journalEntries,
      hasIncomeData: !!wealthGoal,
      hasMindsetTrend: !!firstScore && !!latestScore && firstScore._id.toString() !== latestScore._id.toString(),
    });
  })
);

router.get(
  "/pattern-result-timeline",
  asyncHandler(async (req, res) => {
    await connectDB();
    const since = daysAgo(30);

    const [patterns, rituals, journals, wealthGoal] = await Promise.all([
      PatternBreak.find({ userId: req.userId, loggedAt: { $gte: since } }).sort({ loggedAt: -1 }).limit(12),
      RitualLog.find({ userId: req.userId, completed: true, date: { $gte: since } }).sort({ date: -1 }).limit(12),
      JournalEntry.find({ userId: req.userId, date: { $gte: since } }).sort({ date: -1 }).limit(8).select("type date content tag"),
      WealthGoal.findOne({ userId: req.userId }),
    ]);

    const items = [
      ...patterns.map((item) => ({
        type: "pattern_break",
        date: item.loggedAt,
        title: item.oldPattern,
        detail: item.newBehaviour,
        signal: item.resultSignal,
      })),
      ...rituals.map((item) => ({
        type: `${item.type}_ritual`,
        date: item.completedAt || item.date,
        title: `${item.type} protocol completed`,
        detail: `${item.steps.filter((step) => step.completedAt).length} steps completed`,
        signal: item.intentionWord || item.energyMood || null,
      })),
      ...journals.map((item) => ({
        type: `${item.type}_journal`,
        date: item.date,
        title: `${item.type} journal`,
        detail: item.content,
        signal: item.tag,
      })),
      ...(wealthGoal
        ? [
            {
              type: "income_signal",
              date: wealthGoal.updatedAt,
              title: "Income tracked",
              detail: `Rs ${wealthGoal.currentMonthReceived} of Rs ${wealthGoal.monthlyIntentionAmount}`,
              signal: `${percent(wealthGoal.currentMonthReceived, wealthGoal.monthlyIntentionAmount)}%`,
            },
          ]
        : []),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return ok(res, { days: 30, items: items.slice(0, 24) });
  })
);

export default router;
