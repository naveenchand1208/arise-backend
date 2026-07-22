import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { WealthGoal, WealthPracticeLog } from "../models/Wealth.js";
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

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function findOrCreateGoal(userId) {
  let goal = await WealthGoal.findOne({ userId });
  if (!goal) {
    goal = await WealthGoal.create({
      userId,
      monthlyIntentionAmount: 2500000,
      currentMonthReceived: 0,
      affirmationText: "Money flows to me easily, joyfully, and in ever-increasing amounts. I am a powerful receiving vessel.",
      updatedForMonth: monthKey(),
    });
  }
  return goal;
}

const getWealthGoal = asyncHandler(async (req, res) => {
  await connectDB();
  const today = startOfToday();
  const [goal, todayLog] = await Promise.all([
    findOrCreateGoal(req.userId),
    WealthPracticeLog.findOne({ userId: req.userId, date: today }),
  ]);

  const progressPercent = Math.min(
    100,
    Math.round((goal.currentMonthReceived / goal.monthlyIntentionAmount) * 100)
  );

  return ok(res, { goal, progressPercent, todayPractices: todayLog || null });
});

const updateWealthGoal = asyncHandler(async (req, res) => {
  await connectDB();
  const { monthlyIntentionAmount, currentMonthReceived, affirmationText } = req.body;
  const updates = {
    updatedForMonth: monthKey(),
    ...(monthlyIntentionAmount !== undefined && { monthlyIntentionAmount: Number(monthlyIntentionAmount) }),
    ...(currentMonthReceived !== undefined && { currentMonthReceived: Number(currentMonthReceived) }),
    ...(affirmationText !== undefined && { affirmationText: String(affirmationText).trim() }),
  };
  if (updates.monthlyIntentionAmount !== undefined && updates.monthlyIntentionAmount <= 0) {
    return fail(res, "monthlyIntentionAmount must be greater than zero");
  }
  if (updates.currentMonthReceived !== undefined && updates.currentMonthReceived < 0) {
    return fail(res, "currentMonthReceived cannot be negative");
  }

  const goal = await WealthGoal.findOneAndUpdate(
    { userId: req.userId },
    { $set: updates, $setOnInsert: { userId: req.userId } },
    { upsert: true, new: true }
  );
  return ok(res, goal);
});

const updateWealthPractices = asyncHandler(async (req, res) => {
  await connectDB();
  const today = startOfToday();
  const log = await WealthPracticeLog.findOneAndUpdate(
    { userId: req.userId, date: today },
    { userId: req.userId, date: today, ...req.body },
    { upsert: true, new: true }
  );
  return ok(res, log);
});

const updateAffirmationProgress = asyncHandler(async (req, res) => {
  await connectDB();
  const { affirmationsCompleted } = req.body;
  const today = startOfToday();
  const log = await WealthPracticeLog.findOneAndUpdate(
    { userId: req.userId, date: today },
    { userId: req.userId, date: today, affirmationsCompleted },
    { upsert: true, new: true }
  );
  return ok(res, log);
});

router.get("/", getWealthGoal);
router.get("/goal", getWealthGoal);
router.patch("/goal", updateWealthGoal);
router.patch("/", updateWealthPractices);
router.patch("/practices", updateWealthPractices);
router.post("/affirm", updateAffirmationProgress);
router.post("/affirmation-progress", updateAffirmationProgress);

export default router;
