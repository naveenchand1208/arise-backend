import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import RitualLog from "../models/RitualLog.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { bumpStreak } from "../utils/streak.js";

const router = Router();
router.use(requireAuth);

const DEFAULT_STEPS = ["sunlight", "body_activation", "breathwork", "mind_programming"].map((key) => ({
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

// ── Morning ──────────────────────────────────────────────────────────
router.get(
  "/morning",
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = startOfToday();
    let log = await RitualLog.findOne({ userId: req.userId, type: "morning", date: today });
    if (!log) {
      log = await RitualLog.create({ userId: req.userId, type: "morning", date: today, steps: DEFAULT_STEPS });
    }
    return ok(res, log);
  })
);

router.patch(
  "/morning",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { stepKey, technique, durationSeconds } = req.body;
    if (!stepKey) return fail(res, "stepKey is required");

    const today = startOfToday();
    const log = await RitualLog.findOne({ userId: req.userId, type: "morning", date: today });
    if (!log) return fail(res, "No morning session started yet", 404);

    const step = log.steps.find((s) => s.key === stepKey);
    if (!step) return fail(res, "Unknown step key", 400);

    step.technique = technique ?? step.technique;
    step.durationSeconds = durationSeconds ?? step.durationSeconds;
    step.completedAt = new Date();

    await log.save();
    return ok(res, log);
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
    const { energyMood } = req.body;
    const today = startOfToday();

    const log = await RitualLog.findOneAndUpdate(
      { userId: req.userId, type: "midday", date: today },
      { $set: { energyMood, completed: true, completedAt: new Date() } },
      { new: true, upsert: true }
    );

    return ok(res, log);
  })
);

export default router;
