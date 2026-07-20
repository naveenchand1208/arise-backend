import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { MasterTeacher, Asana, BreathworkTechnique, WealthAffirmation, Quote } from "../models/Content.js";
import { ok, fail } from "../lib/response.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get(
  "/masters",
  asyncHandler(async (req, res) => {
    await connectDB();
    const teachers = await MasterTeacher.find().sort({ name: 1 });
    return ok(res, teachers);
  })
);

router.get(
  "/asanas",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { intent } = req.query;
    const filter = intent ? { intentTags: intent } : {};
    const asanas = await Asana.find(filter).sort({ name: 1 });
    return ok(res, asanas);
  })
);

router.get(
  "/breathwork",
  asyncHandler(async (req, res) => {
    await connectDB();
    const techniques = await BreathworkTechnique.find().sort({ name: 1 });
    return ok(res, techniques);
  })
);

router.get(
  "/affirmations",
  asyncHandler(async (req, res) => {
    await connectDB();
    const affirmations = await WealthAffirmation.find().sort({ order: 1 });
    return ok(res, affirmations.map((a) => a.text));
  })
);

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / (1000 * 60 * 60 * 24));
}

router.get(
  "/quotes/daily",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { category } = req.query;
    const filter = category ? { category } : {};
    const quotes = await Quote.find(filter).sort({ _id: 1 });
    if (quotes.length === 0) return fail(res, "No quotes in the library yet", 404);

    const index = dayOfYear(new Date()) % quotes.length;
    const quote = quotes[index];
    return ok(res, { text: quote.text, author: quote.author, category: quote.category });
  })
);

export default router;
