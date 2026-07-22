import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { MasterTeacher, Asana, BreathworkTechnique } from "../models/Content.js";
import { Challenge } from "../models/Challenge.js";
import { ok, fail } from "../lib/response.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

async function ensureSearchContent() {
  const visible = { status: "PUBLISHED", isActive: true };
  const [masters, asanas, breathwork, challenges] = await Promise.all([
    MasterTeacher.countDocuments(visible),
    Asana.countDocuments(visible),
    BreathworkTechnique.countDocuments(visible),
    Challenge.countDocuments(visible),
  ]);

  if (masters === 0) {
    await MasterTeacher.insertMany([
      { name: "Joe Dispenza", icon: "🧠", tagline: "Neuroscience and elevated emotion", tradition: "science", exerciseCount: 0 },
      { name: "Neville Goddard", icon: "✨", tagline: "Wish fulfilled and imagination", tradition: "mind", exerciseCount: 0 },
    ]);
  }
  if (asanas === 0) {
    await Asana.insertMany([
      { name: "Tadasana", icon: "🌲", subtitle: "Mountain Pose - grounding", intentTags: ["ground"], breathCount: 6 },
      { name: "Balasana", icon: "🙏", subtitle: "Child's Pose - calm clarity", intentTags: ["clarity"], breathCount: 8 },
    ]);
  }
  if (breathwork === 0) {
    await BreathworkTechnique.insertMany([
      { name: "Box Breathing", icon: "🌊", subtitle: "4-4-4-4 calm reset", rounds: 4, breathsPerRound: 4 },
      { name: "Power Breath", icon: "⚡", subtitle: "Activate and energize", rounds: 3, breathsPerRound: 20 },
    ]);
  }
  if (challenges === 0) {
    await Challenge.create({
      slug: "arise-21-day-belief-reset",
      title: "21-Day Belief Reset",
      teacher: "ARISE",
      lengthDays: 21,
      status: "PUBLISHED",
      isActive: true,
      dailyTasks: Array.from({ length: 21 }, (_, index) => ({
        day: index + 1,
        prompt: "Name one belief running your day and choose one better action.",
      })),
    });
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    await ensureSearchContent();
    const q = (req.query.q || "").trim();
    if (!q) return fail(res, "q query param is required");

    const regex = new RegExp(q, "i");
    const visible = { status: "PUBLISHED", isActive: true };

    const [masters, asanas, breathwork, challenges] = await Promise.all([
      MasterTeacher.find({ ...visible, $or: [{ name: regex }, { tagline: regex }] }).limit(10),
      Asana.find({ ...visible, $or: [{ name: regex }, { subtitle: regex }] }).limit(10),
      BreathworkTechnique.find({ ...visible, $or: [{ name: regex }, { subtitle: regex }] }).limit(10),
      Challenge.find({ ...visible, $or: [{ title: regex }, { teacher: regex }] }).limit(10),
    ]);

    return ok(res, {
      masters: masters.map((m) => ({ id: m._id, type: "master", icon: m.icon, title: m.name, subtitle: m.tagline })),
      asanas: asanas.map((a) => ({ id: a._id, type: "asana", icon: a.icon, title: a.name, subtitle: a.subtitle })),
      breathwork: breathwork.map((b) => ({ id: b._id, type: "breathwork", icon: b.icon, title: b.name, subtitle: b.subtitle })),
      challenges: challenges.map((c) => ({ id: c._id, type: "challenge", icon: "🎯", title: c.title, subtitle: c.teacher })),
    });
  })
);

export default router;
