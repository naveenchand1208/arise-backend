import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import JournalEntry from "../models/JournalEntry.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { type, limit } = req.query;
    const filter = { userId: req.userId, ...(type && { type }) };
    const entries = await JournalEntry.find(filter)
      .sort({ date: -1 })
      .limit(Number(limit) || 20);
    return ok(res, entries);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const body = req.body;
    if (!body.type || !body.content) return fail(res, "type and content are required");

    const entry = await JournalEntry.create({ userId: req.userId, date: new Date(), ...body });
    return ok(res, entry, 201);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    const entry = await JournalEntry.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!entry) return fail(res, "Journal entry not found", 404);
    return ok(res, entry);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await connectDB();
    await JournalEntry.deleteOne({ _id: req.params.id, userId: req.userId });
    return ok(res, { deleted: true });
  })
);

export default router;
