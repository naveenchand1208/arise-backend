import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", index: true },
    adminEmail: { type: String, default: "" },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, default: "" },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
