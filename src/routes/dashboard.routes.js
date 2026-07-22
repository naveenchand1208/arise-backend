import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import User from "../models/User.js";
import Streak from "../models/Streak.js";
import BeliefScore from "../models/BeliefScore.js";
import RitualLog from "../models/RitualLog.js";
import Task from "../models/Task.js";
import { ok } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = startOfToday();

    const [user, streak, latestScore, morningLog, middayLog, tasks] = await Promise.all([
      User.findById(req.userId).select("fullName role"),
      Streak.findOne({ userId: req.userId }),
      BeliefScore.findOne({ userId: req.userId }).sort({ date: -1 }),
      RitualLog.findOne({ userId: req.userId, type: "morning", date: today }),
      RitualLog.findOne({ userId: req.userId, type: "midday", date: today }),
      Task.find({ userId: req.userId, date: today }),
    ]);

    const toPct = (v) => (v ? Math.round((v / 10) * 100) : 0);

    return ok(res, {
      greetingName: user?.fullName?.split(" ")[0] || "Seeker",
      streak: { current: streak?.current || 0, best: streak?.best || 0 },
      beliefPercent: {
        healthy: toPct(latestScore?.health),
        wealthy: toPct(latestScore?.wealth),
        happy: toPct(latestScore?.happiness),
      },
      morningProtocol: {
        started: !!morningLog,
        completed: morningLog?.completed || false,
        stepsDone: morningLog?.steps?.filter((s) => s.completedAt).length || 0,
        stepsTotal: morningLog?.steps?.length || 4,
      },
      tasks: {
        total: tasks.length,
        done: tasks.filter((t) => t.status === "done").length,
      },
      middayCheckin: {
        completed: !!middayLog?.completed,
        mood: middayLog?.energyMood || null,
      },
    });
  })
);

export default router;
