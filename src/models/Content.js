import mongoose from "mongoose";

const MasterTeacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Joe Dispenza"
    icon: { type: String, default: "🧠" },
    tagline: { type: String, default: "" },
    tradition: { type: String, enum: ["mind", "science", "ancient"], default: "mind" },
    exerciseCount: { type: Number, default: 0 },
    exercises: [
      {
        title: String,
        description: String,
        durationMinutes: Number,
        steps: [String],
      },
    ],
  },
  { timestamps: true }
);

const AsanaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Virabhadrasana I"
    icon: { type: String, default: "🧘" },
    subtitle: { type: String, default: "" }, // "Warrior I · 5 breaths each"
    intentTags: [{ type: String }], // ["confidence", "ground", "open_heart", "clarity", "detox"]
    cueText: { type: String, default: "" }, // guidance shown during active session
    breathCount: { type: Number, default: 5 },
  },
  { timestamps: true }
);

const BreathworkTechniqueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "Wim Hof — Power Breath"
    icon: { type: String, default: "💨" },
    subtitle: { type: String, default: "" },
    rounds: { type: Number, default: 3 },
    breathsPerRound: { type: Number, default: 30 },
    guidanceText: { type: String, default: "" },
  },
  { timestamps: true }
);

const WealthAffirmationSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const QuoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    author: { type: String, required: true },
    category: { type: String, default: "general" }, // general | wealth | discipline | belief
  },
  { timestamps: true }
);

export const MasterTeacher = mongoose.models.MasterTeacher || mongoose.model("MasterTeacher", MasterTeacherSchema);
export const Asana = mongoose.models.Asana || mongoose.model("Asana", AsanaSchema);
export const BreathworkTechnique =
  mongoose.models.BreathworkTechnique || mongoose.model("BreathworkTechnique", BreathworkTechniqueSchema);
export const WealthAffirmation =
  mongoose.models.WealthAffirmation || mongoose.model("WealthAffirmation", WealthAffirmationSchema);
export const Quote = mongoose.models.Quote || mongoose.model("Quote", QuoteSchema);
