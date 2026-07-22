import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import Task from "../models/Task.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const tasks = await Task.find({ userId: req.userId, date: startOfToday() }).sort({ priorityRank: 1 });
    return ok(res, tasks);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { title, priorityRank, category } = req.body;
    if (!title) return fail(res, "title is required");

    const count = await Task.countDocuments({ userId: req.userId, date: startOfToday() });
    if (count >= 3) return fail(res, "Only 3 tasks allowed per day — that's the point.", 400);

    const task = await Task.create({
      userId: req.userId,
      date: startOfToday(),
      title,
      priorityRank: priorityRank || null,
      category: category || "general",
    });

    return ok(res, task, 201);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { status } = req.body;
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { status, ...(status === "done" && { completedAt: new Date() }) },
      { new: true }
    );
    if (!task) return fail(res, "Task not found", 404);
    return ok(res, task);
  })
);

router.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { status } = req.body;
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { status, ...(status === "done" && { completedAt: new Date() }) },
      { new: true }
    );
    if (!task) return fail(res, "Task not found", 404);
    return ok(res, task);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    await Task.deleteOne({ _id: req.params.id, userId: req.userId });
    return ok(res, { deleted: true });
  })
);

export default router;
