import { Notification } from "../models/Community.js";
import {
  NotificationHistory,
} from "../models/NotificationSystem.js";
import { sendFcmToUser } from "./fcm.service.js";
import { NotificationSkipReasons } from "./notificationTypes.js";

export async function recordNotificationSkip({
  userId,
  type,
  title,
  body,
  data = {},
  idempotencyKey,
  reason,
  relatedEntityType,
  relatedEntityId,
  scheduledFor,
}) {
  try {
    return await NotificationHistory.create({
      userId,
      type,
      title,
      body,
      data,
      idempotencyKey,
      scheduledFor,
      status: "skipped",
      skipReason: reason,
      relatedEntityType,
      relatedEntityId,
    });
  } catch (error) {
    if (error?.code === 11000) return null;
    throw error;
  }
}

export async function deliverNotification({
  userId,
  type,
  title,
  body,
  route,
  data = {},
  icon = "notifications",
  channelId,
  idempotencyKey,
  relatedEntityType,
  relatedEntityId,
  scheduledFor = new Date(),
}) {
  let history;
  try {
    history = await NotificationHistory.create({
      userId,
      type,
      title,
      body,
      data: { ...data, route, type },
      idempotencyKey,
      scheduledFor,
      status: "failed",
      relatedEntityType,
      relatedEntityId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return { sent: false, skipped: NotificationSkipReasons.DUPLICATE };
    }
    throw error;
  }

  try {
    const result = await sendFcmToUser(userId, {
      title,
      body,
      channelId,
      data: { ...data, route, type },
    });
    if (result.noToken) {
      history.status = "skipped";
      history.skipReason = NotificationSkipReasons.NO_VALID_TOKEN;
      await history.save();
      return { sent: false, skipped: NotificationSkipReasons.NO_VALID_TOKEN };
    }
    history.status = result.sent > 0 ? "sent" : "failed";
    history.sentAt = result.sent > 0 ? new Date() : null;
    history.fcmMessageIds = result.messageIds;
    history.error = result.sent > 0 ? null : "FCM delivery failed for all active devices";
    await history.save();

    if (result.sent > 0) {
      await Notification.create({
        userId,
        icon,
        type,
        title,
        body,
        message: body,
        route,
        data: { ...data, route, type },
        scheduledFor,
        sentAt: history.sentAt,
      });
    }
    return { sent: result.sent > 0, result };
  } catch (error) {
    history.status = "failed";
    history.error = String(error?.message || error).slice(0, 500);
    await history.save();
    return { sent: false, error };
  }
}
