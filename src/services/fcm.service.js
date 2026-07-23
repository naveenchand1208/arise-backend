import { DeviceToken } from "../models/NotificationSystem.js";

let messagingPromise;

async function messagingClient() {
  if (messagingPromise) return messagingPromise;
  messagingPromise = (async () => {
    const { applicationDefault, cert, getApps, initializeApp } = await import(
      "firebase-admin/app"
    );
    const { getMessaging } = await import("firebase-admin/messaging");
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (account.private_key) account.private_key = account.private_key.replace(/\\n/g, "\n");
      credential = cert(account);
    } else {
      credential = applicationDefault();
    }
    const app = getApps()[0] || initializeApp({ credential });
    return getMessaging(app);
  })();
  return messagingPromise;
}

const permanentTokenErrors = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

async function sendMulticastWithRetry(messaging, message) {
  try {
    return await messaging.sendEachForMulticast(message);
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    return messaging.sendEachForMulticast(message);
  }
}

export async function sendFcmToUser(userId, payload) {
  const devices = await DeviceToken.find({ userId, isActive: true }).sort({
    lastSeenAt: -1,
  });
  if (!devices.length) return { sent: 0, failed: 0, messageIds: [], noToken: true };

  const messaging = await messagingClient();
  const messageIds = [];
  let failed = 0;
  for (let index = 0; index < devices.length; index += 500) {
    const batch = devices.slice(index, index + 500);
    const response = await sendMulticastWithRetry(messaging, {
      tokens: batch.map((item) => item.token),
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: Object.fromEntries(
        Object.entries(payload.data || {}).map(([key, value]) => [
          key,
          String(value ?? ""),
        ])
      ),
      android: {
        priority: "high",
        notification: {
          channelId: payload.channelId || "daily_practices",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true,
          },
        },
      },
    });
    response.responses.forEach((item, responseIndex) => {
      if (item.success && item.messageId) {
        messageIds.push(item.messageId);
        return;
      }
      failed += 1;
      if (permanentTokenErrors.has(item.error?.code)) {
        batch[responseIndex].isActive = false;
        batch[responseIndex].save().catch(() => {});
      }
    });
  }
  return {
    sent: messageIds.length,
    failed,
    messageIds,
    noToken: false,
  };
}

export function resetFcmClientForTests() {
  messagingPromise = null;
}
