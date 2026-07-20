import { Router } from "express";
import { connectDB } from "../lib/mongodb.js";
import { MasterTeacher, Asana, BreathworkTechnique } from "../models/Content.js";
import { Challenge } from "../models/Challenge.js";
import { ok, fail } from "../lib/response.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const q = (req.query.q || "").trim();
    if (!q) return fail(res, "q query param is required");

    const regex = new RegExp(q, "i");

    const [masters, asanas, breathwork, challenges] = await Promise.all([
      MasterTeacher.find({ $or: [{ name: regex }, { tagline: regex }] }).limit(10),
      Asana.find({ $or: [{ name: regex }, { subtitle: regex }] }).limit(10),
      BreathworkTechnique.find({ $or: [{ name: regex }, { subtitle: regex }] }).limit(10),
      Challenge.find({ $or: [{ title: regex }, { teacher: regex }] }).limit(10),
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
