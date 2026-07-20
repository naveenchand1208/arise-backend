import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import User from "../models/User.js";
import { ok } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const user = await User.findById(req.userId).select("subscription");
    return ok(res, user.subscription);
  })
);

// NOTE: In production, do NOT let the client set plan directly.
// This endpoint should only be called by a verified RevenueCat/Stripe webhook.
// Kept here as a stub so the Flutter app has a contract to build against.
router.patch(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { plan, trialEndsAt, renewsAt } = req.body;
    const user = await User.findByIdAndUpdate(req.userId, { subscription: { plan, trialEndsAt, renewsAt } }, { new: true });
    return ok(res, user.subscription);
  })
);

export default router;
