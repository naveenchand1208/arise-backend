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

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = startOfToday();
    const [goal, todayLog] = await Promise.all([
      WealthGoal.findOne({ userId: req.userId }),
      WealthPracticeLog.findOne({ userId: req.userId, date: today }),
    ]);

    if (!goal) return fail(res, "No wealth goal set — complete onboarding first", 404);

    const progressPercent = Math.min(100, Math.round((goal.currentMonthReceived / goal.monthlyIntentionAmount) * 100));

    return ok(res, { goal, progressPercent, todayPractices: todayLog || null });
  })
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = startOfToday();
    const log = await WealthPracticeLog.findOneAndUpdate(
      { userId: req.userId, date: today },
      { userId: req.userId, date: today, ...req.body },
      { upsert: true, new: true }
    );
    return ok(res, log);
  })
);

router.post(
  "/affirm",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { affirmationsCompleted } = req.body;
    const today = startOfToday();
    const log = await WealthPracticeLog.findOneAndUpdate(
      { userId: req.userId, date: today },
      { userId: req.userId, date: today, affirmationsCompleted },
      { upsert: true, new: true }
    );
    return ok(res, log);
  })
);

export default router;
