import { Router } from "express";
import crypto from "crypto";
import { connectDB } from "../lib/mongodb.js";
import User from "../models/User.js";
import Streak from "../models/Streak.js";
import BeliefScore from "../models/BeliefScore.js";
import BeliefPractice from "../models/BeliefPractice.js";
import JournalEntry from "../models/JournalEntry.js";
import { Notification } from "../models/Community.js";
import DeleteAccountRequest from "../models/deleteAccountRequest.js";
import { fail, ok } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

function createDeleteRequestId() {
  return `dar_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

async function requestAccountDeletion(req, res) {
  await connectDB();

  const user = await User.findById(req.userId).select("fullName email phone");
  if (!user) {
    return fail(res, "User not found.", 404);
  }

  const existingRequest = await DeleteAccountRequest.findOne({
    userId: req.userId,
    status: "Pending",
  }).lean();

  if (existingRequest) {
    return ok(res, {
      requested: true,
      duplicate: true,
      request: existingRequest,
    });
  }

  const request = await DeleteAccountRequest.create({
    id: createDeleteRequestId(),
    userId: req.userId,
    name: user.fullName,
    email: user.email,
    phone: user.phone || "",
    reason: req.body?.reason || "",
    otherReason: req.body?.otherReason || "",
    status: "Pending",
  });

  return ok(
    res,
    {
      requested: true,
      duplicate: false,
      request,
    },
    201
  );
}

router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    await connectDB();
    const [user, streak, latestScore, beliefPractices, beliefReflections] = await Promise.all([
      User.findById(req.userId),
      Streak.findOne({ userId: req.userId }),
      BeliefScore.findOne({ userId: req.userId }).sort({ date: -1 }),
      BeliefPractice.countDocuments({ userId: req.userId, status: { $ne: "draft" } }),
      JournalEntry.countDocuments({
        userId: req.userId,
        type: { $in: ["shadow", "forgiveness"] },
        status: { $ne: "draft" },
      }),
    ]);

    const beliefValues = latestScore
      ? ["health", "wealth", "happiness", "energy", "purpose"]
          .map((key) => Number(latestScore[key]))
          .filter(Number.isFinite)
      : [];
    const avgBeliefScore = beliefValues.length
      ? Math.round((beliefValues.reduce((sum, value) => sum + value, 0) / beliefValues.length) * 10) / 10
      : null;

    return ok(res, {
      user,
      stats: {
        streak: streak?.current || 0,
        bestStreak: streak?.best || 0,
        sessions: streak?.totalSessions || 0,
        beliefScore: avgBeliefScore,
        beliefPractices: beliefPractices + beliefReflections,
      },
    });
  })
);

router.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { fullName, phoneNumber, role } = req.body;
    const updates = {};

    if (fullName !== undefined) {
      const name = String(fullName).trim();
      if (!name) return fail(res, "Full name is required.", 400);
      updates.fullName = name;
    }

    if (phoneNumber !== undefined) updates.phoneNumber = String(phoneNumber).trim();
    if (role !== undefined) {
      const allowedRoles = ["ceo_founder", "professional", "entrepreneur", "seeker"];
      if (!allowedRoles.includes(role)) return fail(res, "Invalid role.", 400);
      updates.role = role;
    }

    const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, { new: true });
    if (!user) return fail(res, "User not found.", 404);

    return ok(res, user);
  })
);

router.patch(
  "/settings",
  asyncHandler(async (req, res) => {
    await connectDB();
    const user = await User.findById(req.userId);
    user.settings = { ...user.settings.toObject(), ...req.body };
    await user.save();
    return ok(res, user.settings);
  })
);

router.delete(
  "/settings",
  asyncHandler(requestAccountDeletion)
);

router.post(
  "/delete-account-request",
  asyncHandler(requestAccountDeletion)
);

router.post(
  "/delete-account-requests",
  asyncHandler(requestAccountDeletion)
);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    await connectDB();
    const notifications = await Notification.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(50);
    return ok(res, notifications);
  })
);

router.delete(
  "/notifications",
  asyncHandler(async (req, res) => {
    await connectDB();
    await Notification.deleteMany({ userId: req.userId });
    return ok(res, { cleared: true });
  })
);

export default router;
