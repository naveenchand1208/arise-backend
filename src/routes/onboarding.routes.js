import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import Priority from "../models/Priority.js";
import BeliefScore from "../models/BeliefScore.js";
import { WealthGoal } from "../models/Wealth.js";
import User from "../models/User.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/priorities",
  asyncHandler(async (req, res) => {
    await connectDB();
    const priorities = await Priority.find({ userId: req.userId }).sort({ rank: 1 });
    return ok(res, priorities);
  })
);

router.post(
  "/priorities",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { priorities } = req.body;
    if (!Array.isArray(priorities) || priorities.length !== 3) {
      return fail(res, "Exactly 3 priorities are required");
    }
    await Priority.deleteMany({ userId: req.userId });
    const created = await Priority.insertMany(priorities.map((p) => ({ ...p, userId: req.userId })));
    return ok(res, created, 201);
  })
);

router.post(
  "/belief-audit",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { health, wealth, happiness, energy, purpose } = req.body;
    if ([health, wealth, happiness].some((v) => typeof v !== "number")) {
      return fail(res, "health, wealth and happiness scores are required");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const score = await BeliefScore.create({
      userId: req.userId,
      date: today,
      health,
      wealth,
      happiness,
      energy,
      purpose,
      isBaseline: true,
    });

    return ok(res, score, 201);
  })
);

router.post(
  "/receiving-container",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { monthlyIntentionAmount, affirmationText } = req.body;
    if (typeof monthlyIntentionAmount !== "number") {
      return fail(res, "monthlyIntentionAmount is required");
    }

    const goal = await WealthGoal.findOneAndUpdate(
      { userId: req.userId },
      {
        userId: req.userId,
        monthlyIntentionAmount,
        affirmationText: affirmationText || "",
        updatedForMonth: new Date().toISOString().slice(0, 7),
      },
      { upsert: true, new: true }
    );

    return ok(res, goal, 201);
  })
);

router.post(
  "/routine",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { morning, midday, night } = req.body;
    if (!morning || !midday || !night) return fail(res, "morning, midday and night times are required");

    const user = await User.findByIdAndUpdate(
      req.userId,
      { ritualTimes: { morning, midday, night }, onboardingComplete: true },
      { new: true }
    );

    return ok(res, { ritualTimes: user.ritualTimes, onboardingComplete: user.onboardingComplete });
  })
);

export default router;
