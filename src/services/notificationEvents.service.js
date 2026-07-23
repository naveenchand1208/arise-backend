import { NotificationPreference } from "../models/NotificationSystem.js";
import { deliverNotification } from "./notificationDelivery.service.js";
import { NotificationTypes } from "./notificationTypes.js";
import { localParts } from "./notificationTime.js";

export async function notifyStreakMilestones(userId, milestones = []) {
  if (!milestones.length) return;
  const preference = await NotificationPreference.findOne({ userId });
  if (!preference?.pushEnabled || !preference.streakReminderEnabled) return;
  const dateKey = localParts(new Date(), preference.timezone).dateKey;
  for (const milestone of milestones) {
    await deliverNotification({
      userId,
      type: NotificationTypes.STREAK_MILESTONE,
      title: `${milestone}-Day Streak`,
      body: `You have shown up for ${milestone} consecutive days. Keep the rhythm alive.`,
      route: "/pattern/streaks",
      icon: "local_fire_department",
      channelId: "achievements",
      data: { milestone: String(milestone) },
      idempotencyKey: `${userId}:${NotificationTypes.STREAK_MILESTONE}:${milestone}`,
      relatedEntityType: "Streak",
      relatedEntityId: String(milestone),
    });
  }
}
