import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import RitualLog from "../models/RitualLog.js";
import Streak from "../models/Streak.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { bumpStreak } from "../utils/streak.js";

const router = Router();
router.use(requireAuth);

const MORNING_STEP_KEYS = ["sunlight", "body_activation", "breathwork", "mind_programming", "intention_gratitude"];

const DEFAULT_STEPS = MORNING_STEP_KEYS.map((key) => ({
  key,
  technique: null,
  durationSeconds: 0,
  completedAt: null,
}));

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function findOrCreateMorningLog(userId) {
  const today = startOfToday();
  let log = await RitualLog.findOne({ userId, type: "morning", date: today });
  if (!log) {
    log = await RitualLog.create({ userId, type: "morning", date: today, steps: DEFAULT_STEPS });
    return log;
  }

  let changed = false;
  for (const key of MORNING_STEP_KEYS) {
    if (!log.steps.some((step) => step.key === key)) {
      log.steps.push({ key, technique: null, durationSeconds: 0, completedAt: null });
      changed = true;
    }
  }
  log.steps.sort((a, b) => MORNING_STEP_KEYS.indexOf(a.key) - MORNING_STEP_KEYS.indexOf(b.key));
  if (changed) {
    await log.save();
  }
  return log;
}

async function completeMorningStep(userId, { stepKey, technique, durationSeconds }) {
  if (!stepKey) return { error: "stepKey is required", status: 400 };
  if (durationSeconds !== undefined && (!Number.isFinite(Number(durationSeconds)) || Number(durationSeconds) < 0)) {
    return { error: "durationSeconds must be a non-negative number", status: 400 };
  }

  const log = await findOrCreateMorningLog(userId);
  if (log.completed) return { error: "Morning protocol is already complete", status: 409 };

  const step = log.steps.find((s) => s.key === stepKey);
  if (!step) return { error: "Unknown step key", status: 400 };

  step.technique = technique ?? step.technique;
  step.durationSeconds = durationSeconds ?? step.durationSeconds;
  step.completedAt = step.completedAt ?? new Date();

  await log.save();
  return { log };
}

async function saveMiddayCheckin(userId, { energyMood, loopAlignment, loopReflection }) {
  const today = startOfToday();
  return RitualLog.findOneAndUpdate(
    { userId, type: "midday", date: today },
    {
      $set: {
        energyMood,
        ...(loopAlignment !== undefined && { loopAlignment }),
        ...(loopReflection !== undefined && { loopReflection }),
        completed: true,
        completedAt: new Date(),
      },
    },
    { new: true, upsert: true }
  );
}

// ── Morning ──────────────────────────────────────────────────────────
router.get(
  "/morning",
  asyncHandler(async (req, res) => {
    await connectDB();
    return ok(res, await findOrCreateMorningLog(req.userId));
  })
);

router.patch(
  "/morning",
  asyncHandler(async (req, res) => {
    await connectDB();
    const result = await completeMorningStep(req.userId, req.body);
    if (result.error) return fail(res, result.error, result.status);
    return ok(res, result.log);
  })
);

router.patch(
  "/steps/:stepKey/complete",
  asyncHandler(async (req, res) => {
    await connectDB();
    const result = await completeMorningStep(req.userId, {
      ...req.body,
      stepKey: req.params.stepKey,
    });
    if (result.error) return fail(res, result.error, result.status);
    return ok(res, result.log);
  })
);

router.post(
  "/morning/complete",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { intentionWord, gratitudes } = req.body;
    const today = startOfToday();

    const log = await RitualLog.findOne({ userId: req.userId, type: "morning", date: today });
    if (!log) return fail(res, "No morning session started yet", 404);
    if (log.completed) {
      const streak = await Streak.findOne({ userId: req.userId });
      return ok(res, { log, streak, newlyUnlocked: [] });
    }
    if (!log.steps.length || log.steps.some((step) => !step.completedAt)) {
      return fail(res, "Complete every morning protocol step before closing the practice", 409);
    }

    log.intentionWord = intentionWord || null;
    log.gratitudes = gratitudes || [];
    log.completed = true;
    log.completedAt = new Date();
    log.totalDurationSeconds = log.steps.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
    await log.save();

    const meditationStep = log.steps.find((s) => s.key === "mind_programming");
    const { streak, newlyUnlocked } = await bumpStreak(req.userId, {
      addMeditationSeconds: meditationStep?.durationSeconds || 0,
    });

    return ok(res, { log, streak, newlyUnlocked });
  })
);

// ── Night ────────────────────────────────────────────────────────────
router.get(
  "/night",
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = startOfToday();
    let log = await RitualLog.findOne({ userId: req.userId, type: "night", date: today });
    if (!log) log = await RitualLog.create({ userId: req.userId, type: "night", date: today, steps: [] });
    return ok(res, log);
  })
);

router.patch(
  "/night",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { wins, revisionPracticeText, satsScene, complete } = req.body;
    const today = startOfToday();

    const log = await RitualLog.findOneAndUpdate(
      { userId: req.userId, type: "night", date: today },
      {
        $set: {
          ...(wins !== undefined && { wins }),
          ...(revisionPracticeText !== undefined && { revisionPracticeText }),
          ...(satsScene !== undefined && { satsScene }),
          ...(complete && { completed: true, completedAt: new Date() }),
        },
      },
      { new: true, upsert: true }
    );

    return ok(res, log);
  })
);

// ── Midday check-in ──────────────────────────────────────────────────
router.post(
  "/checkin",
  asyncHandler(async (req, res) => {
    await connectDB();
    return ok(res, await saveMiddayCheckin(req.userId, req.body));
  })
);

router.post(
  "/midday-checkin",
  asyncHandler(async (req, res) => {
    await connectDB();
    return ok(res, await saveMiddayCheckin(req.userId, req.body));
  })
);

export default router;
