/**
 * Run with: npm run seed
 * Populates CMS-style content collections so the app has real data on first run.
 * Re-running is safe — it upserts by unique name/slug.
 */
import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/mongodb.js";
import { MasterTeacher, Asana, BreathworkTechnique, WealthAffirmation, Quote } from "../src/models/Content.js";
import { Challenge } from "../src/models/Challenge.js";

async function seed() {
  await connectDB();
  console.log("Connected. Seeding...");

  const teachers = [
    {
      name: "Joe Dispenza",
      icon: "🧠",
      tagline: "Neuroscience + Elevated Emotion",
      tradition: "science",
      exercises: [
        {
          title: "Breaking the Habit of Being Yourself",
          description: "A seated meditation to interrupt automatic thought loops and open a gap for new possibility.",
          durationMinutes: 20,
          steps: [
            "Sit comfortably and close your eyes.",
            "Notice your habitual thoughts without judgment.",
            "Consciously choose one thought to release.",
            "Hold the feeling of the new reality for 3 minutes.",
            "Open your eyes and journal one insight.",
          ],
        },
        {
          title: "Elevated Emotion Practice",
          description: "Generate gratitude, joy, or love in the body before the event that would justify it.",
          durationMinutes: 12,
          steps: [
            "Recall a moment of genuine gratitude.",
            "Feel it fully in your chest for 60 seconds.",
            "Expand the feeling to your whole body.",
            "Hold the elevated state as you open your eyes.",
          ],
        },
      ],
    },
    {
      name: "Neville Goddard",
      icon: "✨",
      tagline: "Imagination creates reality · SATS",
      tradition: "mind",
      exercises: [
        {
          title: "State Akin to Sleep (SATS)",
          description: "A drowsy, hypnagogic visualization practice done at the edge of sleep.",
          durationMinutes: 15,
          steps: [
            "Lie down and relax your body completely.",
            "Bring to mind a scene implying your wish fulfilled.",
            "Feel the scene as real, using your senses.",
            "Loop the scene gently until you drift to sleep.",
          ],
        },
        {
          title: "Revision",
          description: "Replay a difficult moment from the day as you wished it had gone.",
          durationMinutes: 8,
          steps: [
            "Recall the event you want to revise.",
            "Replay it in your imagination as you wished it happened.",
            "Feel the satisfaction of the revised version.",
            "Release the original memory.",
          ],
        },
      ],
    },
    {
      name: "Jose Silva",
      icon: "🎯",
      tagline: "Alpha brain state · Mirror of the Mind",
      tradition: "mind",
      exercises: [
        {
          title: "Mirror of the Mind Technique",
          description: "Enter alpha state and visualize a problem resolving on an inner screen.",
          durationMinutes: 15,
          steps: [
            "Relax and count down from 100 to 1 slowly.",
            "Visualize a blank movie screen.",
            "Project the problem, then the solution, onto the screen.",
            "Count back up to full alertness.",
          ],
        },
        {
          title: "3-to-1 Alpha Method",
          description: "A rapid alpha-state entry technique for quick reprogramming sessions.",
          durationMinutes: 5,
          steps: [
            "Close your eyes and take 3 deep breaths.",
            "Count backward from 3 to 1, deepening with each number.",
            "State your intention clearly once in alpha.",
            "Count from 1 to 5 to return to full waking state.",
          ],
        },
      ],
    },
    {
      name: "Sadhguru",
      icon: "🕉️",
      tagline: "Inner Engineering · Bhuta Shuddhi",
      tradition: "ancient",
      exercises: [
        {
          title: "Bhuta Shuddhi",
          description: "A purification practice balancing the five elements within the body.",
          durationMinutes: 18,
          steps: [
            "Sit with spine erect, eyes closed.",
            "Bring awareness to earth, water, fire, air, and space in sequence.",
            "Offer each element back with a mental gesture of release.",
            "Sit in stillness for 2 minutes after completing all five.",
          ],
        },
        {
          title: "Nadi Shuddhi Awareness",
          description: "A subtle-energy awareness practice to prepare the mind for focused work.",
          durationMinutes: 10,
          steps: [
            "Sit comfortably and observe your natural breath.",
            "Notice the subtle channel of breath moving through the spine.",
            "Stay with this awareness without controlling the breath.",
            "Slowly return attention to the room.",
          ],
        },
      ],
    },
  ].map((t) => ({ ...t, exerciseCount: t.exercises.length }));
  for (const t of teachers) {
    await MasterTeacher.findOneAndUpdate({ name: t.name }, t, { upsert: true });
  }

  const asanas = [
    { name: "Virabhadrasana I", icon: "⚔️", subtitle: "Warrior I · 5 breaths each", intentTags: ["confidence"], breathCount: 5 },
    { name: "Virabhadrasana II", icon: "🦅", subtitle: "Warrior II · 5 breaths each", intentTags: ["confidence"], breathCount: 5 },
    { name: "Ustrasana", icon: "🐪", subtitle: "Camel Pose · Heart opener", intentTags: ["open_heart"], breathCount: 5 },
    { name: "Bhujangasana", icon: "🌿", subtitle: "Cobra Pose · Chest expansion", intentTags: ["open_heart"], breathCount: 5 },
    { name: "Tadasana", icon: "🌲", subtitle: "Mountain Pose · Root down", intentTags: ["ground"], breathCount: 6 },
    { name: "Vrksasana", icon: "🌳", subtitle: "Tree Pose · Stability", intentTags: ["ground"], breathCount: 6 },
    { name: "Ardha Matsyendrasana", icon: "🌀", subtitle: "Seated Twist · Mental clarity", intentTags: ["clarity"], breathCount: 5 },
    { name: "Balasana", icon: "🙏", subtitle: "Child's Pose · Quiet the mind", intentTags: ["clarity"], breathCount: 8 },
    { name: "Kapalabhati Prep", icon: "🔥", subtitle: "Seated Fire Breath Prep · Detox", intentTags: ["detox"], breathCount: 10 },
    { name: "Uttanasana", icon: "🙇", subtitle: "Forward Fold · Release & detox", intentTags: ["detox"], breathCount: 6 },
  ];
  for (const a of asanas) {
    await Asana.findOneAndUpdate({ name: a.name }, a, { upsert: true });
  }

  const breathwork = [
    { name: "Wim Hof — Power Breath", icon: "⚡", subtitle: "Activate, energize, burn through fog", rounds: 3, breathsPerRound: 30 },
    { name: "Box Breathing", icon: "🌊", subtitle: "4×4×4×4 — Calm, center, regulate", rounds: 4, breathsPerRound: 4 },
    { name: "Nadi Shodhana", icon: "🌸", subtitle: "Alternate Nostril — Balance hemispheres", rounds: 5, breathsPerRound: 10 },
    { name: "Bhastrika", icon: "🔥", subtitle: "Bellows Breath — Heat, power, detox", rounds: 3, breathsPerRound: 20 },
  ];
  for (const b of breathwork) {
    await BreathworkTechnique.findOneAndUpdate({ name: b.name }, b, { upsert: true });
  }

  const affirmations = [
    "I am worthy of receiving abundance.",
    "Money flows to me easily and joyfully.",
    "I am a magnet for wealth and opportunity.",
    "My income constantly increases.",
    "I trust in my ability to create wealth.",
    "I release all resistance to receiving.",
    "I am aligned with unlimited abundance.",
  ];
  for (let i = 0; i < affirmations.length; i++) {
    await WealthAffirmation.findOneAndUpdate({ text: affirmations[i] }, { text: affirmations[i], order: i }, { upsert: true });
  }

  const quotes = [
    { text: "You attract who you are, not what you want.", author: "Joe Dispenza", category: "belief" },
    { text: "Assume the feeling of your wish fulfilled.", author: "Neville Goddard", category: "belief" },
    { text: "The mind is everything. What you think you become.", author: "Buddha", category: "general" },
    { text: "Discipline is choosing between what you want now and what you want most.", author: "Sadhguru", category: "discipline" },
    { text: "Every thought you have is broadcasting energy.", author: "Joe Dispenza", category: "wealth" },
    { text: "The universe rewards action, not intention alone.", author: "ARISE", category: "discipline" },
  ];
  for (const q of quotes) {
    await Quote.findOneAndUpdate({ text: q.text }, q, { upsert: true });
  }

  const promptPool = [
    "Notice one automatic reaction today and consciously choose a different response.",
    "Spend 2 minutes feeling gratitude for something you don't yet have.",
    "Catch yourself complaining once today — reframe it as a request instead.",
    "Before reacting to stress, take 3 breaths and ask: 'Who am I being right now?'",
    "Write down one belief about yourself you're ready to outgrow.",
    "Do one small thing today as the person you're becoming, not the person you've been.",
    "Notice your energy in a conversation — are you performing or present?",
    "Practice receiving a compliment today without deflecting it.",
    "Identify one habit loop that ran on autopilot today.",
    "Speak to yourself today the way you'd speak to someone you deeply respect.",
    "Sit with discomfort for 60 seconds today instead of reaching for distraction.",
    "Notice where you're waiting for certainty before you'll act — act anyway on one thing.",
    "End today by naming one moment you chose growth over comfort.",
  ];

  const challenges = [
    { slug: "dispenza-21-day", title: "Break the Habit of Being Yourself", teacher: "Joe Dispenza", lengthDays: 21 },
    { slug: "identity-rewire-66-day", title: "Identity Rewire", teacher: "ARISE", lengthDays: 66 },
    { slug: "mastery-90-day", title: "90-Day Mastery", teacher: "ARISE", lengthDays: 90 },
  ];
  for (const c of challenges) {
    const dailyTasks = Array.from({ length: c.lengthDays }, (_, i) => ({
      day: i + 1,
      prompt: promptPool[i % promptPool.length],
    }));
    await Challenge.findOneAndUpdate({ slug: c.slug }, { ...c, dailyTasks }, { upsert: true });
  }

  console.log("Seed complete.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
