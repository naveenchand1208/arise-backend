import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const deleteAccountRequestSchema = new mongoose.Schema(
  {
    id: String,
    userId: String,
    name: String,
    email: String,
    phone: String,
    reason: String,
    otherReason: String,
    status: {
      type: String,
      default: "Pending",
    },
    reviewedBy: String,
    reviewedByEmail: String,
    reviewedAt: Date,
  },
  {
    timestamps: true,
  }
);

deleteAccountRequestSchema.index({ id: 1 }, { unique: true, sparse: true });
deleteAccountRequestSchema.index({ userId: 1, status: 1 });

deleteAccountRequestSchema.plugin(mongoosePaginate);

const DeleteAccountRequest = mongoose.model(
  "DeleteAccountRequest",
  deleteAccountRequestSchema
);

export default DeleteAccountRequest;