import JournalEntry from "../models/JournalEntry.js";
import { connectDB } from "../lib/mongodb.js";
import RitualLog from "../models/RitualLog.js";
import Streak from "../models/Streak.js";
import { Challenge, ChallengeProgress } from "../models/Challenge.js";
import {
  NotificationHistory,
  NotificationPreference,
} from "../models/NotificationSystem.js";
import {
  dayStatesForAttempt,
  refreshAttemptState,
} from "./challengeCompletion.js";
import {
  deliverNotification,
  recordNotificationSkip,
} from "./notificationDelivery.service.js";
import {
  NotificationSkipReasons,
  NotificationTypes,
} from "./notificationTypes.js";
import { localDayBounds, localParts, timeInRange } from "./notificationTime.js";

const MINUTE_MS = 60 * 1000;
let schedulerTimer;
let schedulerRunning = false;

function due(reminder, localTime) {
  if (reminder?.enabled !== true) return false;
  const minutes = (value) => {
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const delay = minutes(localTime) - minutes(reminder.time);
  return delay >= 0 && delay < 5;
}

function idempotencyKey(userId, type, dateKey, relatedEntityId = "none") {
  return `${userId}:${type}:${dateKey}:${relatedEntityId}`;
}

async function completedRitual(userId, type, bounds) {
  return Boolean(
    await RitualLog.exists({
      userId,
      type,
      completed: true,
      completedAt: { $gte: bounds.start, $lt: bounds.end },
    })
  );
}

async function journalCompleted(userId, bounds) {
  return Boolean(
    await JournalEntry.exists({
      userId,
      date: { $gte: bounds.start, $lt: bounds.end },
      content: { $type: "string", $ne: "" },
    })
  );
}

async function activeChallengeState(userId, at) {
  const progress = await ChallengeProgress.findOne({
    userId,
    status: "active",
  }).sort({ startedAt: -1 });
  if (!progress) return null;
  const challenge = await Challenge.findById(progress.challengeId);
  if (!challenge) return null;
  await refreshAttemptState(progress, challenge, at);
  if (progress.status !== "active") return null;
  const states = dayStatesForAttempt(progress, challenge, at);
  const today = states.find((item) => item.status === "today") ||
    states.find((item) => item.dayNumber === progress.currentDay);
  const snapshot = progress.challengeSnapshot || challenge;
  const task = (snapshot.dailyTasks || []).find(
    (item) => Number(item.day) === Number(progress.currentDay)
  );
  return {
    challenge,
    progress,
    dayNumber: Number(progress.currentDay),
    complete: today?.status === "completed",
    task,
    title: snapshot.title || challenge.title,
  };
}

async function sentToday(userId, bounds) {
  return NotificationHistory.countDocuments({
    userId,
    status: "sent",
    sentAt: { $gte: bounds.start, $lt: bounds.end },
  });
}

function candidateList(preference, local, at) {
  const items = [];
  if (due(preference.morningReminder, local.time)) {
    items.push({ type: NotificationTypes.MORNING_PROTOCOL_READY, ritual: "morning" });
  }
  if (due(preference.morningFollowUp, local.time)) {
    items.push({ type: NotificationTypes.MORNING_PROTOCOL_PENDING, ritual: "morning" });
  }
  if (due(preference.nightReminder, local.time)) {
    items.push({ type: NotificationTypes.NIGHT_PROTOCOL_READY, ritual: "night" });
  }
  if (due(preference.challengeReminder, local.time)) {
    items.push({ type: NotificationTypes.CHALLENGE_DAY_READY, challenge: true });
  }
  if (due(preference.challengeFollowUp, local.time)) {
    items.push({ type: NotificationTypes.CHALLENGE_DAY_PENDING, challenge: true });
  }
  if (due(preference.journalReminder, local.time)) {
    items.push({ type: NotificationTypes.JOURNAL_REMINDER, journal: true });
  }
  if (
    preference.streakReminderEnabled &&
    due({ enabled: true, time: "20:30" }, local.time)
  ) {
    items.push({ type: NotificationTypes.STREAK_AT_RISK, streak: true });
  }
  if (
    preference.weeklyInsightEnabled &&
    new Intl.DateTimeFormat("en-US", {
      timeZone: preference.timezone,
      weekday: "short",
    }).format(at) === "Sun" &&
    due({ enabled: true, time: "18:00" }, local.time)
  ) {
    items.push({ type: NotificationTypes.WEEKLY_INSIGHT_READY, weekly: true });
  }
  return items;
}

function copyFor(candidate, context) {
  switch (candidate.type) {
    case NotificationTypes.MORNING_PROTOCOL_READY:
      return {
        title: "Your Morning Protocol Is Ready",
        body: "Begin with intention. Your morning practice is waiting.",
        route: "/rituals/morning",
        icon: "wb_sunny",
        channelId: "daily_practices",
      };
    case NotificationTypes.MORNING_PROTOCOL_PENDING:
      return {
        title: "A few intentional minutes can change your day",
        body: "Your Morning Protocol is still waiting when you are ready.",
        route: "/rituals/morning",
        icon: "wb_sunny",
        channelId: "daily_practices",
      };
    case NotificationTypes.NIGHT_PROTOCOL_READY:
      return {
        title: "Close the Day Intentionally",
        body: "Reflect, release, and prepare your mind for tomorrow.",
        route: "/rituals/night",
        icon: "bedtime",
        channelId: "daily_practices",
      };
    case NotificationTypes.CHALLENGE_DAY_READY:
      return {
        title: `Day ${context.challenge.dayNumber} Is Ready`,
        body: `Your next step in ${context.challenge.title} is ready.`,
        route: `/challenges/${context.challenge.challenge._id}`,
        icon: "track_changes",
        channelId: "challenges",
      };
    case NotificationTypes.CHALLENGE_DAY_PENDING:
      return {
        title: `Your Day ${context.challenge.dayNumber} practice is still open`,
        body: "A few focused minutes can keep your momentum moving.",
        route: `/challenges/${context.challenge.challenge._id}`,
        icon: "track_changes",
        channelId: "challenges",
      };
    case NotificationTypes.JOURNAL_REMINDER:
      return {
        title: "A Moment to Reflect",
        body: "What shifted in you today?",
        route: "/journal/daily",
        icon: "menu_book",
        channelId: "daily_practices",
      };
    case NotificationTypes.STREAK_AT_RISK:
      return {
        title: "Keep Your Streak Alive",
        body: "You are one practice away from continuing your rhythm.",
        route: "/rituals/morning",
        icon: "local_fire_department",
        channelId: "achievements",
      };
    case NotificationTypes.WEEKLY_INSIGHT_READY:
      return {
        title: "Your Weekly Insight Is Ready",
        body: "See what shifted across your ARISE loop this week.",
        route: "/reports/weekly",
        icon: "insights",
        channelId: "insights",
      };
    default:
      return null;
  }
}

async function evaluateCandidate(preference, candidate, at, local, bounds) {
  let challenge = null;
  let relatedEntityType = null;
  let relatedEntityId = null;
  let skipReason = null;

  if (candidate.ritual) {
    if (await completedRitual(preference.userId, candidate.ritual, bounds)) {
      skipReason = NotificationSkipReasons.ALREADY_COMPLETED;
    }
  } else if (candidate.challenge) {
    challenge = await activeChallengeState(preference.userId, at);
    if (!challenge) skipReason = NotificationSkipReasons.NO_ACTIVE_CHALLENGE;
    else {
      relatedEntityType = "ChallengeProgress";
      relatedEntityId = String(challenge.progress._id);
      if (challenge.complete) skipReason = NotificationSkipReasons.ALREADY_COMPLETED;
    }
  } else if (candidate.journal) {
    if (await journalCompleted(preference.userId, bounds)) {
      skipReason = NotificationSkipReasons.ALREADY_COMPLETED;
    }
  } else if (candidate.streak) {
    const streak = await Streak.findOne({ userId: preference.userId });
    if (
      !streak ||
      (streak.lastCompletedDate &&
        streak.lastCompletedDate >= bounds.start &&
        streak.lastCompletedDate < bounds.end)
    ) {
      skipReason = NotificationSkipReasons.ALREADY_COMPLETED;
    }
  } else if (candidate.weekly) {
    const activityExists = await RitualLog.exists({
      userId: preference.userId,
      completed: true,
      completedAt: { $gte: new Date(at.getTime() - 7 * 86400000), $lte: at },
    });
    if (!activityExists) skipReason = NotificationSkipReasons.ALREADY_COMPLETED;
  }

  const context = { challenge };
  const copy = copyFor(candidate, context);
  if (!copy) return;
  const key = idempotencyKey(
    preference.userId,
    candidate.type,
    local.dateKey,
    relatedEntityId || "none"
  );

  const quiet = preference.quietHours;
  const explicitlyTimed =
    candidate.ritual || candidate.challenge || candidate.journal;
  if (
    !skipReason &&
    !explicitlyTimed &&
    quiet?.enabled &&
    timeInRange(local.time, quiet.start, quiet.end)
  ) {
    skipReason = NotificationSkipReasons.QUIET_HOURS;
  }
  if (
    !skipReason &&
    (await sentToday(preference.userId, bounds)) >=
      preference.maxDailyBehavioralNotifications
  ) {
    skipReason = NotificationSkipReasons.RATE_LIMITED;
  }

  const body =
    preference.privacyMode === "private"
      ? "Your ARISE reminder is ready."
      : copy.body;
  const common = {
    userId: preference.userId,
    type: candidate.type,
    title: copy.title,
    body,
    data: {
      route: copy.route,
      ...(challenge && {
        challengeId: String(challenge.challenge._id),
        dayNumber: String(challenge.dayNumber),
        activityType: challenge.task?.activityType || "",
      }),
    },
    idempotencyKey: key,
    relatedEntityType,
    relatedEntityId,
    scheduledFor: at,
  };
  if (skipReason) {
    await recordNotificationSkip({ ...common, reason: skipReason });
    return;
  }
  await deliverNotification({
    ...common,
    route: copy.route,
    icon: copy.icon,
    channelId: copy.channelId,
  });
}

export async function runNotificationScheduler(at = new Date()) {
  if (schedulerRunning) return;
  schedulerRunning = true;
  try {
    await connectDB();
    const preferences = await NotificationPreference.find({ pushEnabled: true });
    for (const preference of preferences) {
      let local;
      try {
        local = localParts(at, preference.timezone);
      } catch {
        continue;
      }
      const candidates = candidateList(preference, local, at);
      if (!candidates.length) continue;
      const bounds = localDayBounds(at, preference.timezone);
      for (const candidate of candidates) {
        await evaluateCandidate(preference, candidate, at, local, bounds);
      }
    }
  } finally {
    schedulerRunning = false;
  }
}

export function startNotificationScheduler() {
  if (schedulerTimer || process.env.DISABLE_NOTIFICATION_SCHEDULER === "true") return;
  const tick = () =>
    runNotificationScheduler().catch((error) => {
      console.error("Notification scheduler failed", error);
    });
  tick();
  schedulerTimer = setInterval(tick, MINUTE_MS);
  schedulerTimer.unref?.();
}

export function stopNotificationScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
}
