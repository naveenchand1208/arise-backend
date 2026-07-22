import mongoose from "mongoose";

const seedMetadataFields = {
  slug: { type: String, unique: true, sparse: true, index: true },
  source: { type: String, default: "" },
  seedVersion: { type: String, default: "" },
  systemContent: { type: Boolean, default: false, index: true },
};

const publishableFields = {
  status: { type: String, enum: ["DRAFT", "PUBLISHED", "ARCHIVED"], default: "PUBLISHED", index: true },
  isActive: { type: Boolean, default: true, index: true },
  featured: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
};

const MasterTeacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ...seedMetadataFields,
    icon: { type: String, default: "mind" },
    tagline: { type: String, default: "" },
    tradition: { type: String, enum: ["mind", "science", "ancient"], default: "mind" },
    exerciseCount: { type: Number, default: 0 },
    ...publishableFields,
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
    name: { type: String, required: true },
    ...seedMetadataFields,
    icon: { type: String, default: "asana" },
    subtitle: { type: String, default: "" },
    intentTags: [{ type: String }],
    cueText: { type: String, default: "" },
    breathCount: { type: Number, default: 5 },
    ...publishableFields,
  },
  { timestamps: true }
);

const BreathworkTechniqueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ...seedMetadataFields,
    icon: { type: String, default: "breath" },
    subtitle: { type: String, default: "" },
    rounds: { type: Number, default: 3 },
    breathsPerRound: { type: Number, default: 30 },
    guidanceText: { type: String, default: "" },
    ...publishableFields,
  },
  { timestamps: true }
);

const WealthAffirmationSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    ...seedMetadataFields,
    category: { type: String, default: "wealth" },
    tags: [{ type: String }],
    ...publishableFields,
  },
  { timestamps: true }
);

const QuoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    author: { type: String, required: true },
    ...seedMetadataFields,
    category: { type: String, default: "general" },
    tags: [{ type: String }],
    ...publishableFields,
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
