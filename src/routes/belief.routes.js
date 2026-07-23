import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import BeliefScore from "../models/BeliefScore.js";
import BeliefPractice from "../models/BeliefPractice.js";
import JournalEntry from "../models/JournalEntry.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { evaluateChallengeProgress } from "../services/challengeCompletion.js";

const SCORE_KEYS = ["health", "wealth", "happiness", "energy", "purpose"];
const CATEGORIES = new Set([...SCORE_KEYS, "other"]);

const practiceScreens = {
  "daily-check": { screenId: 18, title: "Daily Belief Check" },
  "i-am": { screenId: 19, title: "I AM Builder" },
  "paradigm-audit": { screenId: 20, title: "Paradigm Audit" },
  "inner-child": { screenId: 22, title: "Inner Child Letter" },
  reframe: { screenId: 23, title: "Belief Reframe Tool" },
  fear: { screenId: 24, title: "Fear Inventory" },
  container: { screenId: 26, title: "Container Expansion" },
};

function cleanText(value, maxLength = 5000) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, maxLength) : null;
}

function positiveLimit(value, fallback = 30, max = 60) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}

function validScore(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 1 && Number(value) <= 10;
}

function assessmentAverage(score) {
  if (!score) return null;
  const values = SCORE_KEYS.map((key) => Number(score[key])).filter(Number.isFinite);
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function assessmentFocus(score) {
  if (!score) return null;
  return SCORE_KEYS.filter((key) => Number.isFinite(Number(score[key]))).reduce(
    (lowest, key) => (lowest == null || Number(score[key]) < Number(score[lowest]) ? key : lowest),
    null
  );
}

function assessmentPayload(body) {
  return Object.fromEntries(SCORE_KEYS.map((key) => [key, Number(body[key])]));
}

function completedFilter(status) {
  return status === "draft" ? "draft" : "completed";
}

function activityDate(item) {
  return item.completedAt || item.date || item.createdAt;
}

function recentItem(type, item) {
  const date = activityDate(item);
  if (type === "audit") {
    return {
      id: item._id,
      type,
      title: "Belief Audit",
      subtitle: `Overall ${assessmentAverage(item)?.toFixed(1) || "-"}/10`,
      date,
    };
  }
  if (type === "belief-work") {
    return {
      id: item._id,
      type,
      title: "Belief Work",
      subtitle: item.category || "Reflection",
      date,
      status: item.status,
    };
  }
  if (type === "paradigm") {
    return {
      id: item._id,
      type,
      title: "Paradigm Discovery",
      subtitle: item.category || "Recurring pattern",
      date,
      status: item.status,
    };
  }
  if (type === "shadow") {
    return {
      id: item._id,
      type,
      title: "Shadow Work",
      subtitle: item.emotion || "Private reflection",
      date,
      status: item.status,
    };
  }
  return {
    id: item._id,
    type: "forgiveness",
    title: "Forgiveness",
    subtitle: item.forgivenessTargetType || "Private reflection",
    date,
    status: item.status,
  };
}

async function findOwned(model, userId, id, extra = {}) {
  return model.findOne({ _id: id, userId, ...extra });
}

export const beliefRouter = Router();
beliefRouter.use(requireAuth);

beliefRouter.get(
  "/hub",
  asyncHandler(async (req, res) => {
    await connectDB();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      assessments,
      beliefWork,
      paradigms,
      shadows,
      forgiveness,
      beliefWorkWeek,
      paradigmCount,
      shadowCount,
      forgivenessCount,
    ] = await Promise.all([
      BeliefScore.find({ userId: req.userId }).sort({ date: -1, createdAt: -1 }).limit(2),
      BeliefPractice.find({ userId: req.userId, practiceKey: "belief-work" })
        .sort({ completedAt: -1 })
        .limit(5),
      BeliefPractice.find({ userId: req.userId, practiceKey: "paradigm-discovery" })
        .sort({ completedAt: -1 })
        .limit(5),
      JournalEntry.find({ userId: req.userId, type: "shadow" }).sort({ date: -1 }).limit(5),
      JournalEntry.find({ userId: req.userId, type: "forgiveness" }).sort({ date: -1 }).limit(5),
      BeliefPractice.countDocuments({
        userId: req.userId,
        practiceKey: "belief-work",
        status: { $ne: "draft" },
        completedAt: { $gte: weekAgo },
      }),
      BeliefPractice.countDocuments({
        userId: req.userId,
        practiceKey: "paradigm-discovery",
        status: { $ne: "draft" },
      }),
      JournalEntry.countDocuments({ userId: req.userId, type: "shadow", status: { $ne: "draft" } }),
      JournalEntry.countDocuments({ userId: req.userId, type: "forgiveness", status: { $ne: "draft" } }),
    ]);

    const latestAssessment = assessments[0] || null;
    const previousAssessment = assessments[1] || null;
    const recentActivity = [
      ...(latestAssessment ? [recentItem("audit", latestAssessment)] : []),
      ...beliefWork.map((item) => recentItem("belief-work", item)),
      ...paradigms.map((item) => recentItem("paradigm", item)),
      ...shadows.map((item) => recentItem("shadow", item)),
      ...forgiveness.map((item) => recentItem("forgiveness", item)),
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    return ok(res, {
      latestAssessment,
      previousAssessment,
      overallScore: assessmentAverage(latestAssessment),
      focusArea: assessmentFocus(latestAssessment),
      counts: {
        beliefWorkThisWeek: beliefWorkWeek,
        paradigms: paradigmCount,
        shadowReflections: shadowCount,
        forgivenessReflections: forgivenessCount,
      },
      lastActivity: {
        beliefWork: beliefWork[0] || null,
        paradigm: paradigms[0] || null,
        shadow: shadows[0] || null,
        forgiveness: forgiveness[0] || null,
      },
      recentActivity,
    });
  })
);

beliefRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    await connectDB();
    const limit = positiveLimit(req.query.limit, 30, 60);
    const type = String(req.query.type || "all");
    const category = cleanText(req.query.category, 40);
    const practiceFilter = {
      userId: req.userId,
      ...(category && category !== "all" && { category }),
    };

    const [audits, practices, journals] = await Promise.all([
      type === "all" || type === "audit"
        ? BeliefScore.find({ userId: req.userId }).sort({ date: -1, createdAt: -1 }).limit(limit)
        : [],
      ["all", "belief-work", "paradigm", "practice"].includes(type)
        ? BeliefPractice.find({
            ...practiceFilter,
            ...(type === "belief-work" && { practiceKey: "belief-work" }),
            ...(type === "paradigm" && { practiceKey: "paradigm-discovery" }),
            ...(type === "practice" && {
              practiceKey: { $nin: ["belief-work", "paradigm-discovery"] },
            }),
          })
            .sort({ completedAt: -1 })
            .limit(limit)
        : [],
      ["all", "shadow", "forgiveness"].includes(type)
        ? JournalEntry.find({
            userId: req.userId,
            type: type === "all" ? { $in: ["shadow", "forgiveness"] } : type,
          })
            .sort({ date: -1 })
            .limit(limit)
        : [],
    ]);

    const items = [
      ...audits.map((item) => ({ ...item.toObject(), entryType: "audit" })),
      ...practices.map((item) => ({
        ...item.toObject(),
        entryType:
          item.practiceKey === "belief-work"
            ? "belief-work"
            : item.practiceKey === "paradigm-discovery"
              ? "paradigm"
              : "practice",
      })),
      ...journals.map((item) => ({ ...item.toObject(), entryType: item.type })),
    ]
      .sort((a, b) => new Date(activityDate(b)) - new Date(activityDate(a)))
      .slice(0, limit);

    return ok(res, { items, limit, hasMore: items.length === limit });
  })
);

beliefRouter.get(
  "/assessments",
  asyncHandler(async (req, res) => {
    await connectDB();
    const limit = positiveLimit(req.query.limit);
    const assessments = await BeliefScore.find({ userId: req.userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit);
    return ok(res, assessments);
  })
);

beliefRouter.get(
  "/assessments/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    const assessment = await findOwned(BeliefScore, req.userId, req.params.id);
    if (!assessment) return fail(res, "Belief assessment not found", 404);
    return ok(res, assessment);
  })
);

beliefRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const days = Number(req.query.days) || 3650;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const scores = await BeliefScore.find({
      userId: req.userId,
      date: { $gte: since },
    }).sort({ date: 1, createdAt: 1 });
    return ok(res, scores);
  })
);

beliefRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    if (SCORE_KEYS.some((key) => !validScore(req.body[key]))) {
      return fail(res, "All five belief scores must be between 1 and 10");
    }
    const isFirstAssessment = (await BeliefScore.countDocuments({ userId: req.userId })) === 0;
    const score = await BeliefScore.create({
      userId: req.userId,
      date: new Date(),
      ...assessmentPayload(req.body),
      isBaseline: isFirstAssessment,
      iAmStatement: cleanText(req.body.iAmStatement, 500),
      focusAreas: Array.isArray(req.body.focusAreas)
        ? req.body.focusAreas.map((item) => cleanText(item, 40)).filter(Boolean)
        : [],
    });
    await evaluateChallengeProgress({
      userId: req.userId,
      activityType: "BELIEF_AUDIT",
      activityId: score._id,
      completedAt: score.date || score.createdAt,
    });
    return ok(res, score, 201);
  })
);

beliefRouter.get(
  "/work",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entries = await BeliefPractice.find({
      userId: req.userId,
      practiceKey: "belief-work",
    })
      .sort({ completedAt: -1 })
      .limit(positiveLimit(req.query.limit));
    return ok(res, entries);
  })
);

beliefRouter.post(
  "/work",
  asyncHandler(async (req, res) => {
    await connectDB();
    const status = completedFilter(req.body.status);
    const category = cleanText(req.body.category, 40)?.toLowerCase();
    if (!category || !CATEGORIES.has(category)) return fail(res, "Select a valid belief category");
    if (
      status === "completed" &&
      (!cleanText(req.body.oldBelief) ||
        !cleanText(req.body.newBelief) ||
        !cleanText(req.body.supportingAction))
    ) {
      return fail(res, "Current belief, new belief, and supporting action are required");
    }

    const oldBelief = cleanText(req.body.oldBelief);
    const newBelief = cleanText(req.body.newBelief);
    const entry = await BeliefPractice.create({
      userId: req.userId,
      practiceKey: "belief-work",
      screenId: 23,
      title: "Belief Work",
      content: newBelief || oldBelief || "Belief Work draft",
      status,
      category,
      oldBelief,
      oldBeliefStrength: validScore(req.body.oldBeliefStrength)
        ? Number(req.body.oldBeliefStrength)
        : null,
      originReflection: cleanText(req.body.originReflection),
      evidenceReflection: cleanText(req.body.evidenceReflection),
      behaviourImpact: cleanText(req.body.behaviourImpact),
      newBelief,
      iamStatement: cleanText(req.body.iamStatement),
      newBeliefBelievability: validScore(req.body.newBeliefBelievability)
        ? Number(req.body.newBeliefBelievability)
        : null,
      supportingAction: cleanText(req.body.supportingAction),
      completedAt: new Date(),
    });
    if (status === "completed") {
      await evaluateChallengeProgress({
        userId: req.userId,
        activityType: "BELIEF_WORK",
        activityId: entry._id,
        completedAt: entry.completedAt,
      });
    }
    return ok(res, entry, 201);
  })
);

beliefRouter.get(
  "/work/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entry = await findOwned(BeliefPractice, req.userId, req.params.id, {
      practiceKey: "belief-work",
    });
    if (!entry) return fail(res, "Belief Work entry not found", 404);
    return ok(res, entry);
  })
);

beliefRouter.get(
  "/paradigms",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entries = await BeliefPractice.find({
      userId: req.userId,
      practiceKey: "paradigm-discovery",
    })
      .sort({ completedAt: -1 })
      .limit(positiveLimit(req.query.limit));
    return ok(res, entries);
  })
);

beliefRouter.post(
  "/paradigms",
  asyncHandler(async (req, res) => {
    await connectDB();
    const status = completedFilter(req.body.status);
    const category = cleanText(req.body.category, 40)?.toLowerCase() || "other";
    if (!CATEGORIES.has(category)) return fail(res, "Select a valid paradigm category");
    if (
      status === "completed" &&
      (!cleanText(req.body.trigger) ||
        !cleanText(req.body.repeatedThought) ||
        !cleanText(req.body.newChoice))
    ) {
      return fail(res, "Trigger, repeated thought, and new choice are required");
    }

    const repeatedThought = cleanText(req.body.repeatedThought);
    const entry = await BeliefPractice.create({
      userId: req.userId,
      practiceKey: "paradigm-discovery",
      screenId: 20,
      title: "Paradigm Discovery",
      content: repeatedThought || "Paradigm Discovery draft",
      status,
      category,
      trigger: cleanText(req.body.trigger),
      repeatedThought,
      automaticResponse: cleanText(req.body.automaticResponse),
      possibleOrigin: cleanText(req.body.possibleOrigin),
      currentCost: cleanText(req.body.currentCost),
      newChoice: cleanText(req.body.newChoice),
      paradigmStatus: status === "completed" ? "active" : null,
      completedAt: new Date(),
    });
    return ok(res, entry, 201);
  })
);

beliefRouter.get(
  "/paradigms/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entry = await findOwned(BeliefPractice, req.userId, req.params.id, {
      practiceKey: "paradigm-discovery",
    });
    if (!entry) return fail(res, "Paradigm entry not found", 404);
    return ok(res, entry);
  })
);

beliefRouter.get(
  "/practices",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { practiceKey } = req.query;
    const entries = await BeliefPractice.find({
      userId: req.userId,
      ...(practiceKey && { practiceKey }),
    })
      .sort({ completedAt: -1 })
      .limit(positiveLimit(req.query.limit));
    return ok(res, entries);
  })
);

beliefRouter.get(
  "/practices/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entry = await findOwned(BeliefPractice, req.userId, req.params.id);
    if (!entry) return fail(res, "Belief practice not found", 404);
    return ok(res, entry);
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
            prompt: cleanText(item?.prompt, 500),
            answer: cleanText(item?.answer),
          }))
          .filter((item) => item.prompt && item.answer)
      : [];
    const finalContent =
      cleanText(content) ||
      normalizedAnswers.map((item) => `${item.prompt}: ${item.answer}`).join("\n\n");
    if (!finalContent) return fail(res, "content or answers are required");

    const entry = await BeliefPractice.create({
      userId: req.userId,
      practiceKey,
      screenId: practice.screenId,
      title: practice.title,
      content: finalContent,
      answers: normalizedAnswers,
      status: "completed",
      completedAt: new Date(),
    });
    return ok(res, entry, 201);
  })
);

export const shadowWorkRouter = Router();
shadowWorkRouter.use(requireAuth);

shadowWorkRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entries = await JournalEntry.find({ userId: req.userId, type: "shadow" })
      .sort({ date: -1 })
      .limit(positiveLimit(req.query.limit));
    return ok(res, entries);
  })
);

shadowWorkRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entry = await findOwned(JournalEntry, req.userId, req.params.id, {
      type: "shadow",
    });
    if (!entry) return fail(res, "Shadow reflection not found", 404);
    return ok(res, entry);
  })
);

shadowWorkRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const status = completedFilter(req.body.status);
    if (
      status === "completed" &&
      (!cleanText(req.body.trigger) ||
        !cleanText(req.body.emotion) ||
        !cleanText(req.body.nextChoice))
    ) {
      return fail(res, "Trigger, emotion, and next choice are required");
    }
    const content =
      cleanText(req.body.mirrorReflection) ||
      cleanText(req.body.meaning) ||
      cleanText(req.body.trigger) ||
      "Shadow Work draft";
    const entry = await JournalEntry.create({
      userId: req.userId,
      type: "shadow",
      status,
      date: new Date(),
      prompt: "Guided Shadow Work reflection",
      content,
      trigger: cleanText(req.body.trigger),
      emotion: cleanText(req.body.emotion),
      reaction: cleanText(req.body.reaction),
      meaning: cleanText(req.body.meaning),
      mirrorReflection: cleanText(req.body.mirrorReflection),
      compassionateResponse: cleanText(req.body.compassionateResponse),
      nextChoice: cleanText(req.body.nextChoice),
      oldBelief: cleanText(req.body.oldBelief),
      newParadigm: cleanText(req.body.newParadigm) || cleanText(req.body.nextChoice),
    });
    return ok(res, entry, 201);
  })
);

export const forgivenessRouter = Router();
forgivenessRouter.use(requireAuth);

forgivenessRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entries = await JournalEntry.find({
      userId: req.userId,
      type: "forgiveness",
    })
      .sort({ date: -1 })
      .limit(positiveLimit(req.query.limit));
    return ok(res, entries);
  })
);

forgivenessRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entry = await findOwned(JournalEntry, req.userId, req.params.id, {
      type: "forgiveness",
    });
    if (!entry) return fail(res, "Forgiveness reflection not found", 404);
    return ok(res, entry);
  })
);

forgivenessRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const status = completedFilter(req.body.status);
    const targetType = cleanText(req.body.forgivenessTargetType, 20);
    if (
      status === "completed" &&
      (!["myself", "person", "situation"].includes(targetType) ||
        !cleanText(req.body.whatHappened) ||
        !cleanText(req.body.releaseStatement))
    ) {
      return fail(res, "Target, what happened, and release statement are required");
    }
    const releaseStatement = cleanText(req.body.releaseStatement);
    const entry = await JournalEntry.create({
      userId: req.userId,
      type: "forgiveness",
      status,
      date: new Date(),
      content:
        releaseStatement ||
        cleanText(req.body.readyToRelease) ||
        cleanText(req.body.whatHappened) ||
        "Forgiveness draft",
      forgivenessTargetType: ["myself", "person", "situation"].includes(targetType)
        ? targetType
        : null,
      forgivenessTarget: cleanText(req.body.forgivenessTarget),
      whatHappened: cleanText(req.body.whatHappened),
      stillCarrying: cleanText(req.body.stillCarrying),
      unmetNeed: cleanText(req.body.unmetNeed),
      boundaryLesson: cleanText(req.body.boundaryLesson),
      readyToRelease: cleanText(req.body.readyToRelease),
      releaseStatement,
      lessonLearned: cleanText(req.body.lessonLearned) || cleanText(req.body.boundaryLesson),
    });
    return ok(res, entry, 201);
  })
);
