import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { MasterTeacher, Asana, BreathworkTechnique, WealthAffirmation, Quote } from "../models/Content.js";
import { ok, fail } from "../lib/response.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { affirmations, asanas, breathwork, masters, quotes } from "../seeds/data/systemContent.js";

const router = Router();
const publicContentFilter = { status: "PUBLISHED", isActive: true };

async function ensureLibraryContent(type) {
  if (type === "masters" && (await MasterTeacher.countDocuments(publicContentFilter)) === 0) {
    await MasterTeacher.insertMany(masters);
  }

  if (type === "asanas" && (await Asana.countDocuments(publicContentFilter)) === 0) {
    await Asana.insertMany(asanas);
  }

  if (type === "breathwork" && (await BreathworkTechnique.countDocuments(publicContentFilter)) === 0) {
    await BreathworkTechnique.insertMany(breathwork);
  }

  if (type === "affirmations" && (await WealthAffirmation.countDocuments(publicContentFilter)) === 0) {
    await WealthAffirmation.insertMany(affirmations);
  }

  if (type === "quotes" && (await Quote.countDocuments(publicContentFilter)) === 0) {
    await Quote.insertMany(quotes);
  }
}

router.get(
  "/masters",
  asyncHandler(async (req, res) => {
    await connectDB();
    await ensureLibraryContent("masters");
    const teachers = await MasterTeacher.find(publicContentFilter).sort({ order: 1, name: 1 });
    return ok(res, teachers);
  })
);

router.get(
  "/asanas",
  asyncHandler(async (req, res) => {
    await connectDB();
    await ensureLibraryContent("asanas");
    const { intent } = req.query;
    const filter = intent ? { ...publicContentFilter, intentTags: intent } : publicContentFilter;
    const asanasResult = await Asana.find(filter).sort({ order: 1, name: 1 });
    return ok(res, asanasResult);
  })
);

router.get(
  "/breathwork",
  asyncHandler(async (req, res) => {
    await connectDB();
    await ensureLibraryContent("breathwork");
    const techniques = await BreathworkTechnique.find(publicContentFilter).sort({ order: 1, name: 1 });
    return ok(res, techniques);
  })
);

router.get(
  "/affirmations",
  asyncHandler(async (req, res) => {
    await connectDB();
    await ensureLibraryContent("affirmations");
    const affirmationDocs = await WealthAffirmation.find(publicContentFilter).sort({ order: 1 });
    return ok(res, affirmationDocs.map((a) => a.text));
  })
);

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / (1000 * 60 * 60 * 24));
}

const dailyQuoteHandler = asyncHandler(async (req, res) => {
  await connectDB();
  await ensureLibraryContent("quotes");
  const { category } = req.query;
  const filter = category ? { ...publicContentFilter, category } : publicContentFilter;
  const quoteDocs = await Quote.find(filter).sort({ order: 1, _id: 1 });
  if (quoteDocs.length === 0) return fail(res, "No quotes in the library yet", 404);

  const index = dayOfYear(new Date()) % quoteDocs.length;
  const quote = quoteDocs[index];
  return ok(res, { text: quote.text, author: quote.author, category: quote.category });
});

router.get("/quotes/daily", dailyQuoteHandler);
router.get("/daily-quote", dailyQuoteHandler);

export default router;
