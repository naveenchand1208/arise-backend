import mongoose from "mongoose";

export const ADMIN_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "CONTENT_MANAGER",
  "COMMUNITY_MODERATOR",
  "SUPPORT",
];

const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ADMIN_ROLES, default: "ADMIN" },
    permissions: [{ type: String }],
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
