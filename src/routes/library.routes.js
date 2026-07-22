import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { MasterTeacher, Asana, BreathworkTechnique, WealthAffirmation, Quote } from "../models/Content.js";
import { ok, fail } from "../lib/response.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
const publicContentFilter = { status: "PUBLISHED", isActive: true };

async function ensureLibraryContent(type) {
  if (type === "masters" && (await MasterTeacher.countDocuments(publicContentFilter)) === 0) {
    await MasterTeacher.insertMany([
      {
        name: "Joe Dispenza",
        icon: "🧠",
        tagline: "Neuroscience and elevated emotion",
        tradition: "science",
        exerciseCount: 1,
        exercises: [
          {
            title: "Elevated Emotion Practice",
            description: "Generate gratitude before the external result arrives.",
            durationMinutes: 12,
            steps: ["Sit comfortably.", "Recall gratitude.", "Expand the feeling.", "Open your eyes gently."],
          },
        ],
      },
      {
        name: "Neville Goddard",
        icon: "✨",
        tagline: "Assume the feeling of the wish fulfilled",
        tradition: "mind",
        exerciseCount: 1,
        exercises: [
          {
            title: "SATS Scene",
            description: "Visualize a short scene that implies fulfillment.",
            durationMinutes: 10,
            steps: ["Relax deeply.", "Choose one scene.", "Feel it real.", "Release."],
          },
        ],
      },
    ]);
  }

  if (type === "asanas" && (await Asana.countDocuments(publicContentFilter)) === 0) {
    await Asana.insertMany([
      { name: "Tadasana", icon: "🌲", subtitle: "Mountain Pose - grounding", intentTags: ["ground"], breathCount: 6 },
      { name: "Virabhadrasana II", icon: "⚔️", subtitle: "Warrior II - confidence", intentTags: ["confidence"], breathCount: 5 },
      { name: "Balasana", icon: "🙏", subtitle: "Child's Pose - calm clarity", intentTags: ["clarity"], breathCount: 8 },
    ]);
  }

  if (type === "breathwork" && (await BreathworkTechnique.countDocuments(publicContentFilter)) === 0) {
    await BreathworkTechnique.insertMany([
      { name: "Box Breathing", icon: "🌊", subtitle: "4-4-4-4 calm reset", rounds: 4, breathsPerRound: 4 },
      { name: "Nadi Shodhana", icon: "🌸", subtitle: "Alternate nostril balance", rounds: 5, breathsPerRound: 10 },
      { name: "Power Breath", icon: "⚡", subtitle: "Activate and energize", rounds: 3, breathsPerRound: 20 },
    ]);
  }

  if (type === "affirmations" && (await WealthAffirmation.countDocuments(publicContentFilter)) === 0) {
    await WealthAffirmation.insertMany([
      { text: "I am worthy of receiving abundance.", order: 1 },
      { text: "Money flows to me through aligned action.", order: 2 },
      { text: "I receive, steward, and multiply wealth with clarity.", order: 3 },
    ]);
  }

  if (type === "quotes" && (await Quote.countDocuments(publicContentFilter)) === 0) {
    await Quote.insertMany([
      { text: "Assume the feeling of your wish fulfilled.", author: "Neville Goddard", category: "belief", order: 1 },
      { text: "Your personality creates your personal reality.", author: "Joe Dispenza", category: "belief", order: 2 },
      { text: "What you practice daily becomes your identity.", author: "ARISE", category: "discipline", order: 3 },
    ]);
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
    const asanas = await Asana.find(filter).sort({ order: 1, name: 1 });
    return ok(res, asanas);
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
    const affirmations = await WealthAffirmation.find(publicContentFilter).sort({ order: 1 });
    return ok(res, affirmations.map((a) => a.text));
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
  const quotes = await Quote.find(filter).sort({ order: 1, _id: 1 });
  if (quotes.length === 0) return fail(res, "No quotes in the library yet", 404);

  const index = dayOfYear(new Date()) % quotes.length;
  const quote = quotes[index];
  return ok(res, { text: quote.text, author: quote.author, category: quote.category });
});

router.get("/quotes/daily", dailyQuoteHandler);
router.get("/daily-quote", dailyQuoteHandler);

export default router;
