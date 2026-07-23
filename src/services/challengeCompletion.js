import { Challenge, ChallengeProgress } from "../models/Challenge.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function localDayIndex(value, timezoneOffsetMinutes = 0) {
  const timestamp = new Date(value).getTime();
  return Math.floor((timestamp + timezoneOffsetMinutes * 60 * 1000) / DAY_MS);
}

export function localDateKey(value, timezoneOffsetMinutes = 0) {
  const index = localDayIndex(value, timezoneOffsetMinutes);
  return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

export function calendarDayForAttempt(progress, durationDays, at = new Date()) {
  const offset = Number(progress.timezoneOffsetMinutes) || 0;
  const start = localDayIndex(progress.startDate || progress.startedAt, offset);
  const current = localDayIndex(at, offset);
  return Math.max(1, Math.min(durationDays, current - start + 1));
}

export function rawCalendarDayForAttempt(progress, at = new Date()) {
  const offset = Number(progress.timezoneOffsetMinutes) || 0;
  const start = localDayIndex(progress.startDate || progress.startedAt, offset);
  const current = localDayIndex(at, offset);
  return current - start + 1;
}

function definitionFor(progress, challenge) {
  return progress.challengeSnapshot || {
    title: challenge.title,
    lengthDays: challenge.lengthDays,
    dailyTasks: challenge.dailyTasks,
    version: challenge.version || 1,
  };
}

function activityTypesFor(day) {
  const required = Array.isArray(day.requiredActivityTypes)
    ? day.requiredActivityTypes.filter(Boolean)
    : [];
  return required.length ? required : [day.activityType].filter(Boolean);
}

function requirementSatisfied(day, evidence) {
  const expected = activityTypesFor(day);
  const matching = evidence.filter((item) => expected.includes(item.activityType));
  const rule = day.completionRule || "RECORD_CREATED";
  const minimum = Math.max(0, Number(day.minimumRequirement) || 1);

  if (rule === "ALL_OF") {
    return expected.length > 0 && expected.every((type) => matching.some((item) => item.activityType === type));
  }
  if (rule === "ANY_OF") {
    return matching.length > 0;
  }
  if (rule === "DURATION_COMPLETED") {
    return matching.reduce((sum, item) => sum + (Number(item.durationSeconds) || 0), 0) >= minimum;
  }
  if (rule === "COUNT_REACHED") {
    return matching.reduce((sum, item) => sum + (Number(item.count) || 1), 0) >= minimum;
  }
  return matching.length > 0;
}

export function dayStatesForAttempt(progress, challenge, at = new Date()) {
  const definition = definitionFor(progress, challenge);
  const duration = definition.lengthDays || challenge.lengthDays;
  const currentDay = calendarDayForAttempt(progress, duration, at);
  const completed = new Set(progress.completedDays || []);
  return Array.from({ length: duration }, (_, index) => {
    const dayNumber = index + 1;
    const stored = progress.dailyProgress?.find((item) => item.dayNumber === dayNumber);
    let status = "future";
    if (completed.has(dayNumber) || stored?.status === "completed") status = "completed";
    else if (dayNumber < currentDay) status = "missed";
    else if (dayNumber === currentDay && progress.status === "active") status = "today";
    else if (progress.status !== "active" && dayNumber <= currentDay) status = "missed";
    return {
      dayNumber,
      status,
      completedAt: stored?.completedAt || null,
      completionSource: stored?.completionSource || null,
      completionActivityId: stored?.completionActivityId || null,
    };
  });
}

export function challengeStreak(completedDays = []) {
  const sorted = [...new Set(completedDays)].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const day of sorted) {
    run = previous != null && day === previous + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return longest;
}

export async function refreshAttemptState(progress, challenge, at = new Date()) {
  if (progress.status !== "active") return false;
  const definition = definitionFor(progress, challenge);
  const duration = definition.lengthDays || challenge.lengthDays;
  const rawDay = rawCalendarDayForAttempt(progress, at);
  progress.currentDay = calendarDayForAttempt(progress, duration, at);
  if (rawDay > duration && !progress.completedDays.includes(duration)) {
    progress.status = "abandoned";
    await progress.save();
    return true;
  }
  return false;
}

export async function evaluateChallengeProgress({
  userId,
  activityType,
  activityId,
  completedAt = new Date(),
  durationSeconds = 0,
  count = 1,
}) {
  if (!userId || !activityType || !activityId) return [];
  const attempts = await ChallengeProgress.find({ userId, status: "active" });
  if (!attempts.length) return [];
  const challengeIds = attempts.map((attempt) => attempt.challengeId);
  const challenges = await Challenge.find({ _id: { $in: challengeIds } });
  const byId = Object.fromEntries(challenges.map((item) => [item._id.toString(), item]));
  const updated = [];

  for (const progress of attempts) {
    const challenge = byId[progress.challengeId.toString()];
    if (!challenge) continue;
    await refreshAttemptState(progress, challenge, completedAt);
    if (progress.status !== "active") continue;
    if (new Date(completedAt) < new Date(progress.startedAt)) continue;

    const definition = definitionFor(progress, challenge);
    const duration = definition.lengthDays || challenge.lengthDays;
    const currentDay = calendarDayForAttempt(progress, duration, completedAt);
    const day = (definition.dailyTasks || []).find((item) => Number(item.day) === currentDay);
    if (!day || !activityTypesFor(day).includes(activityType)) continue;

    let daily = progress.dailyProgress.find((item) => item.dayNumber === currentDay);
    if (!daily) {
      daily = {
        dayNumber: currentDay,
        scheduledDateKey: localDateKey(completedAt, progress.timezoneOffsetMinutes),
        status: "in_progress",
        evidence: [],
      };
      progress.dailyProgress.push(daily);
      daily = progress.dailyProgress[progress.dailyProgress.length - 1];
    }
    if (daily.status === "completed") continue;

    const duplicate = daily.evidence.some(
      (item) => item.activityType === activityType && item.activityId === String(activityId)
    );
    if (!duplicate) {
      daily.evidence.push({
        activityType,
        activityId: String(activityId),
        completedAt,
        durationSeconds: Math.max(0, Number(durationSeconds) || 0),
        count: Math.max(1, Number(count) || 1),
      });
    }

    if (requirementSatisfied(day, daily.evidence)) {
      daily.status = "completed";
      daily.completedAt = completedAt;
      daily.completionSource = activityType;
      daily.completionActivityId = String(activityId);
      if (!progress.completedDays.includes(currentDay)) progress.completedDays.push(currentDay);
      progress.completedDays.sort((a, b) => a - b);
      progress.lastCompletedAt = completedAt;
      if (currentDay === duration) {
        progress.status = "completed";
        progress.completedAt = completedAt;
      }
    }
    progress.currentDay = currentDay;
    progress.lastEvaluatedAt = new Date();
    await progress.save();
    updated.push(progress);
  }
  return updated;
}

export function challengeSnapshot(challenge) {
  return {
    title: challenge.title,
    description: challenge.description,
    lengthDays: challenge.lengthDays,
    layer: challenge.layer,
    version: challenge.version || 1,
    dailyTasks: challenge.dailyTasks.map((item) => item.toObject?.() || item),
  };
}
