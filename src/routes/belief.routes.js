import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import BeliefScore from "../models/BeliefScore.js";
import BeliefPractice from "../models/BeliefPractice.js";
import JournalEntry from "../models/JournalEntry.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const practiceScreens = {
  "daily-check": { screenId: 18, title: "Daily Belief Check" },
  "i-am": { screenId: 19, title: "I AM Builder" },
  "paradigm-audit": { screenId: 20, title: "Paradigm Audit" },
  "inner-child": { screenId: 22, title: "Inner Child Letter" },
  reframe: { screenId: 23, title: "Belief Reframe Tool" },
  fear: { screenId: 24, title: "Fear Inventory" },
  container: { screenId: 26, title: "Container Expansion" },
};

// /api/belief
export const beliefRouter = Router();
beliefRouter.use(requireAuth);

beliefRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const days = Number(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const scores = await BeliefScore.find({ userId: req.userId, date: { $gte: since } }).sort({ date: 1 });
    return ok(res, scores);
  })
);

beliefRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const today = startOfToday();
    const score = await BeliefScore.findOneAndUpdate(
      { userId: req.userId, date: today },
      { userId: req.userId, date: today, ...req.body },
      { upsert: true, new: true }
    );
    return ok(res, score, 201);
  })
);

beliefRouter.get(
  "/practices",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { practiceKey, limit } = req.query;
    const filter = {
      userId: req.userId,
      ...(practiceKey && { practiceKey }),
    };
    const entries = await BeliefPractice.find(filter)
      .sort({ completedAt: -1 })
      .limit(Number(limit) || 30);
    return ok(res, entries);
  })
);

beliefRouter.post(
  "/practices",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { practiceKey, answers, content } = req.body;
    const practice = practiceScreens[practiceKey];
    if (!practice) return fail(res, "Valid practiceKey is required");

    const normalizedAnswers = Array.isArray(answers)
      ? answers
          .map((item) => ({
            prompt: String(item?.prompt || "").trim(),
            answer: String(item?.answer || "").trim(),
          }))
          .filter((item) => item.prompt && item.answer)
      : [];
    const normalizedContent = String(content || "").trim();
    const finalContent = normalizedContent || normalizedAnswers.map((item) => `${item.prompt}: ${item.answer}`).join("\n\n");
    if (!finalContent) return fail(res, "content or answers are required");

    const entry = await BeliefPractice.create({
      userId: req.userId,
      practiceKey,
      screenId: practice.screenId,
      title: practice.title,
      content: finalContent,
      answers: normalizedAnswers,
      completedAt: new Date(),
    });

    return ok(res, entry, 201);
  })
);

// /api/shadow-work
export const shadowWorkRouter = Router();
shadowWorkRouter.use(requireAuth);

shadowWorkRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { prompt, oldBelief, newParadigm } = req.body;
    if (!oldBelief || !newParadigm) return fail(res, "oldBelief and newParadigm are required");

    const entry = await JournalEntry.create({
      userId: req.userId,
      type: "shadow",
      date: new Date(),
      prompt,
      content: newParadigm,
      oldBelief,
      newParadigm,
    });

    return ok(res, entry, 201);
  })
);

shadowWorkRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entries = await JournalEntry.find({ userId: req.userId, type: "shadow" }).sort({ date: -1 });
    return ok(res, entries);
  })
);

// /api/forgiveness
export const forgivenessRouter = Router();
forgivenessRouter.use(requireAuth);

forgivenessRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { forgivenessTarget, releaseStatement, lessonLearned } = req.body;
    if (!forgivenessTarget || !releaseStatement) {
      return fail(res, "forgivenessTarget and releaseStatement are required");
    }

    const entry = await JournalEntry.create({
      userId: req.userId,
      type: "forgiveness",
      date: new Date(),
      content: releaseStatement,
      forgivenessTarget,
      releaseStatement,
      lessonLearned,
    });

    return ok(res, entry, 201);
  })
);
