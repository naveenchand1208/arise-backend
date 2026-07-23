import BeliefScore from "../models/BeliefScore.js";
import RitualLog from "../models/RitualLog.js";
import Task from "../models/Task.js";
import Streak from "../models/Streak.js";
import { ChallengeProgress } from "../models/Challenge.js";
import { WealthGoal } from "../models/Wealth.js";

export function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(days, date = new Date()) {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() - days);
  return d;
}

export function percent(value, total) {
  if (!Number.isFinite(Number(total)) || Number(total) <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value) / Number(total)) * 100)));
}

export function averageBelief(score) {
  if (!score) return 0;
  const values = ["health", "wealth", "happiness", "energy", "purpose"]
    .map((key) => Number(score[key]))
    .filter(Number.isFinite);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10);
}

export function delta(a, b) {
  return a != null && b != null ? Math.round((b - a) * 10) / 10 : null;
}

export async function calculateLoopEngine(userId, { windowDays = 30 } = {}) {
  const since = daysAgo(windowDays);

  const [latestBelief, morningLogs, tasks, streak, activeChallenge, wealthGoal] = await Promise.all([
    BeliefScore.findOne({ userId }).sort({ date: -1 }),
    RitualLog.find({ userId, type: "morning", date: { $gte: since } }).select("completed date"),
    Task.find({ userId, date: { $gte: since } }).select("status date"),
    Streak.findOne({ userId }),
    ChallengeProgress.findOne({ userId, status: "active" }),
    WealthGoal.findOne({ userId }),
  ]);

  const completedMornings = morningLogs.filter((log) => log.completed).length;
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const taskScore = tasks.length > 0 ? percent(completedTasks, tasks.length) : null;
  const morningScore = percent(completedMornings, Math.min(windowDays, 30));
  const behaviourInputs = [morningScore, taskScore].filter((value) => value != null);
  const behaviourScore = behaviourInputs.length
    ? Math.round(behaviourInputs.reduce((sum, value) => sum + value, 0) / behaviourInputs.length)
    : 0;

  const streakScore = percent(streak?.current || 0, Math.min(windowDays, 90));
  const challengeScore = activeChallenge
    ? percent(activeChallenge.completedDays?.length || 0, activeChallenge.currentDay || 1)
    : null;
  const patternInputs = [streakScore, challengeScore].filter((value) => value != null);
  const patternScore = patternInputs.length
    ? Math.round(patternInputs.reduce((sum, value) => sum + value, 0) / patternInputs.length)
    : 0;

  const resultScore = wealthGoal
    ? percent(wealthGoal.currentMonthReceived || 0, wealthGoal.monthlyIntentionAmount || 0)
    : 0;

  const layers = [
    {
      key: "belief",
      label: "Belief",
      score: averageBelief(latestBelief),
      hasData: !!latestBelief,
      inputCount: latestBelief ? 1 : 0,
      hint: "Latest five-domain belief audit average.",
    },
    {
      key: "behaviour",
      label: "Behaviour",
      score: behaviourScore,
      hasData: morningLogs.length > 0 || tasks.length > 0,
      inputCount: morningLogs.length + tasks.length,
      hint: `Morning protocol completion and task follow-through over ${windowDays} days.`,
    },
    {
      key: "pattern",
      label: "Pattern",
      score: patternScore,
      hasData: !!streak || !!activeChallenge,
      inputCount: (streak ? 1 : 0) + (activeChallenge ? 1 : 0),
      hint: "Current streak consistency and active challenge progress.",
    },
    {
      key: "result",
      label: "Result",
      score: resultScore,
      hasData: !!wealthGoal,
      inputCount: wealthGoal ? 1 : 0,
      hint: "Progress toward the current monthly wealth intention.",
    },
  ];

  const scoredLayers = layers.filter((layer) => layer.hasData);
  const bottleneck = (scoredLayers.length ? scoredLayers : layers).reduce(
    (min, layer) => (layer.score < min.score ? layer : min),
    scoredLayers[0] || layers[0]
  );

  return {
    windowDays,
    layers,
    bottleneck: bottleneck.key,
    inputs: {
      latestBelief,
      morningLogs,
      tasks,
      streak,
      activeChallenge,
      wealthGoal,
      completedMornings,
      completedTasks,
    },
  };
}
