import Streak from "../models/Streak.js";

const MILESTONES = [7, 21, 66, 90];

function isYesterday(date, ref) {
  const d = new Date(date);
  const r = new Date(ref);
  d.setHours(0, 0, 0, 0);
  r.setHours(0, 0, 0, 0);
  const diffDays = (r - d) / (1000 * 60 * 60 * 24);
  return diffDays === 1;
}

function isSameDay(date, ref) {
  const d = new Date(date);
  const r = new Date(ref);
  return d.toDateString() === r.toDateString();
}

/**
 * Call this once per day, the FIRST time a user completes the morning protocol.
 * Idempotent per day.
 */
export async function bumpStreak(
  userId,
  { addSessions = 1, addMeditationSeconds = 0, completedAt = new Date() } = {}
) {
  const today = new Date(completedAt);
  let streak = await Streak.findOne({ userId });
  if (!streak) streak = new Streak({ userId });

  if (streak.lastCompletedDate && isSameDay(streak.lastCompletedDate, today)) {
    if (streak.current < 1) {
      streak.current = 1;
      streak.best = Math.max(streak.best, streak.current);
      streak.lastCompletedDate = today;
    }
    streak.totalSessions += addSessions;
    streak.totalMeditationSeconds += addMeditationSeconds;
    await streak.save();
    return { streak, newlyUnlocked: [] };
  }

  if (streak.lastCompletedDate && isYesterday(streak.lastCompletedDate, today)) {
    streak.current += 1;
  } else {
    streak.current = 1;
  }

  streak.best = Math.max(streak.best, streak.current);
  streak.lastCompletedDate = today;
  streak.totalSessions += addSessions;
  streak.totalMeditationSeconds += addMeditationSeconds;

  const newlyUnlocked = MILESTONES.filter(
    (m) => streak.current >= m && !streak.milestonesUnlocked.includes(m)
  );
  streak.milestonesUnlocked.push(...newlyUnlocked);

  await streak.save();
  return { streak, newlyUnlocked };
}
