import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { Notification } from "../models/Community.js";
import {
  DeviceToken,
  NotificationPreference,
} from "../models/NotificationSystem.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validTimezone } from "../services/notificationTime.js";

const router = Router();
router.use(requireAuth);

async function preferencesFor(userId) {
  return NotificationPreference.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

router.post(
  "/device-token",
  asyncHandler(async (req, res) => {
    await connectDB();
    const token = String(req.body.token || "").trim();
    if (token.length < 20) return fail(res, "A valid device token is required");
    const platform = ["android", "ios", "web"].includes(req.body.platform)
      ? req.body.platform
      : "unknown";
    const device = await DeviceToken.findOneAndUpdate(
      { token },
      {
        $set: {
          userId: req.userId,
          platform,
          deviceId: req.body.deviceId
            ? String(req.body.deviceId).slice(0, 200)
            : null,
          isActive: true,
          lastSeenAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return ok(res, {
      id: device._id,
      platform: device.platform,
      isActive: device.isActive,
    });
  })
);

router.delete(
  "/device-token",
  asyncHandler(async (req, res) => {
    await connectDB();
    const token = String(req.body?.token || req.query.token || "").trim();
    if (!token) return fail(res, "token is required");
    await DeviceToken.updateOne(
      { userId: req.userId, token },
      { $set: { isActive: false, lastSeenAt: new Date() } }
    );
    return ok(res, { deactivated: true });
  })
);

router.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    await connectDB();
    return ok(res, await preferencesFor(req.userId));
  })
);

router.patch(
  "/preferences",
  asyncHandler(async (req, res) => {
    await connectDB();
    const allowed = [
      "pushEnabled",
      "permissionPrompted",
      "timezone",
      "morningReminder",
      "morningFollowUp",
      "nightReminder",
      "challengeReminder",
      "challengeFollowUp",
      "journalReminder",
      "streakReminderEnabled",
      "weeklyInsightEnabled",
      "achievementEnabled",
      "productUpdatesEnabled",
      "privacyMode",
      "quietHours",
    ];
    const updates = Object.fromEntries(
      allowed
        .filter((key) => req.body[key] !== undefined)
        .map((key) => [key, req.body[key]])
    );
    if (updates.timezone && !validTimezone(updates.timezone)) {
      return fail(res, "Invalid IANA timezone");
    }
    const preference = await NotificationPreference.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates, $setOnInsert: { userId: req.userId } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );
    return ok(res, preference);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const items = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit);
    return ok(res, items);
  })
);

router.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    await connectDB();
    const count = await Notification.countDocuments({
      userId: req.userId,
      read: false,
    });
    return ok(res, { count });
  })
);

router.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await connectDB();
    await Notification.updateMany(
      { userId: req.userId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return ok(res, { updated: true });
  })
);

router.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await connectDB();
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!item) return fail(res, "Notification not found", 404);
    return ok(res, item);
  })
);

router.delete(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    await Notification.deleteMany({ userId: req.userId });
    return ok(res, { cleared: true });
  })
);

export default router;
