// Load environment variables FIRST — before any other import evaluates,
// since several modules (lib/jwt.js, lib/mongodb.js) read process.env at
// call-time. ESM evaluates static imports top-to-bottom, so this must be
// the very first line.
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/auth.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import ritualsRoutes from "./routes/rituals.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import journalRoutes from "./routes/journal.routes.js";
import { beliefRouter, shadowWorkRouter, forgivenessRouter } from "./routes/belief.routes.js";
import wealthRoutes from "./routes/wealth.routes.js";
import energyRoutes from "./routes/energy.routes.js";
import { streaksRouter, challengesRouter } from "./routes/streaksChallenges.routes.js";
import communityRoutes from "./routes/community.routes.js";
import libraryRoutes from "./routes/library.routes.js";
import searchRoutes from "./routes/search.routes.js";
import userRoutes from "./routes/user.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";

const app = express();

app.use(helmet());
app.use(cors()); // mobile apps don't need this, but a future web admin panel will
app.use(express.json());

// Rate limit auth routes specifically — closes a gap flagged during the
// Next.js version's review (login/register were brute-forceable).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many attempts. Please try again later." },
});

app.get("/", (req, res) => {
  res.json({ name: "ARISE API", status: "ok" });
});

// Routes — same paths as the Next.js version, so the Flutter app needs zero changes.
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/rituals", ritualsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/journal", journalRoutes);
app.use("/api/belief", beliefRouter);
app.use("/api/shadow-work", shadowWorkRouter);
app.use("/api/forgiveness", forgivenessRouter);
app.use("/api/wealth", wealthRoutes);
app.use("/api/energy", energyRoutes);
app.use("/api/streaks", streaksRouter);
app.use("/api/challenges", challengesRouter);
app.use("/api/community", communityRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/user", userRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/subscription", subscriptionRoutes);

app.use(notFoundHandler);
app.use(errorHandler); // must be registered last

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ARISE API listening on http://localhost:${PORT}`);
});

export default app;
