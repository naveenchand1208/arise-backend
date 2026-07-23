import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import EnergyLog from "../models/EnergyLog.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const PRACTICES = {
  saltCleanse: "saltCleanseDone",
  auraStrengthening: "auraStrengtheningDone",
  smokeCleanse: "smokeCleanseDone",
};

function cleanText(value, maxLength = 500) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

const getTodayEnergy = asyncHandler(async (req, res) => {
  await connectDB();
  const log = await EnergyLog.findOne({ userId: req.userId, date: startOfToday() });
  return ok(res, log);
});

router.get("/shield", getTodayEnergy);
router.get("/today", getTodayEnergy);

router.post(
  "/shield/practices/:practiceKey/complete",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { practiceKey } = req.params;
    const legacyDoneField = PRACTICES[practiceKey];
    if (!legacyDoneField) return fail(res, "Unknown Energy Shield practice", 400);

    const durationSeconds = Number(req.body.durationSeconds ?? 0);
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
      return fail(res, "durationSeconds must be a non-negative number", 400);
    }

    const today = startOfToday();
    const existing = await EnergyLog.findOne({ userId: req.userId, date: today });
    if (existing?.practices?.[practiceKey]?.completedAt) {
      return ok(res, existing);
    }

    const completedAt = new Date();
    const log = await EnergyLog.findOneAndUpdate(
      { userId: req.userId, date: today },
      {
        $set: {
          userId: req.userId,
          date: today,
          [legacyDoneField]: true,
          [`practices.${practiceKey}`]: {
            status: "completed",
            method: cleanText(req.body.method, 80),
            intention: cleanText(req.body.intention),
            carryForward: cleanText(req.body.carryForward, 120),
            durationSeconds,
            completedAt,
          },
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return ok(res, log);
  })
);

const updateTodayEnergy = asyncHandler(async (req, res) => {
  await connectDB();
  const today = startOfToday();
  const allowed = ["saltCleanseDone", "auraStrengtheningDone", "smokeCleanseDone"];
  const updates = Object.fromEntries(
    allowed
      .filter((key) => typeof req.body[key] === "boolean")
      .map((key) => [key, req.body[key]])
  );
  const log = await EnergyLog.findOneAndUpdate(
    { userId: req.userId, date: today },
    { $set: { userId: req.userId, date: today, ...updates } },
    { upsert: true, new: true, runValidators: true }
  );
  return ok(res, log);
});

router.patch("/shield", updateTodayEnergy);
router.patch("/practices", updateTodayEnergy);

router.post(
  "/audit",
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = startOfToday();
    const log = await EnergyLog.findOneAndUpdate(
      { userId: req.userId, date: today },
      {
        $set: {
          userId: req.userId,
          date: today,
          drainingPeople: Array.isArray(req.body.drainingPeople) ? req.body.drainingPeople : [],
          drainingHabits: Array.isArray(req.body.drainingHabits) ? req.body.drainingHabits : [],
          actionPlan: cleanText(req.body.actionPlan),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    return ok(res, log);
  })
);

export default router;
