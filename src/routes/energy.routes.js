import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import EnergyLog from "../models/EnergyLog.js";
import { ok } from "../lib/response.js";
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
  "/shield",
  asyncHandler(async (req, res) => {
    await connectDB();
    const log = await EnergyLog.findOne({ userId: req.userId, date: startOfToday() });
    return ok(res, log);
  })
);

router.patch(
  "/shield",
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = startOfToday();
    const log = await EnergyLog.findOneAndUpdate(
      { userId: req.userId, date: today },
      { userId: req.userId, date: today, ...req.body },
      { upsert: true, new: true }
    );
    return ok(res, log);
  })
);

router.post(
  "/audit",
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = startOfToday();
    const log = await EnergyLog.findOneAndUpdate(
      { userId: req.userId, date: today },
      { userId: req.userId, date: today, ...req.body },
      { upsert: true, new: true }
    );
    return ok(res, log);
  })
);

export default router;
