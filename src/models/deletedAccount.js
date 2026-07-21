import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const deletedAccountSchema = new mongoose.Schema(
  {
    id: String,
    userId: String,
    name: String,
    email: String,
    phone: String,
    reason: String,
    otherReason: String,
    requestId: String,
    deletedBy: String,
    deletedByEmail: String,
    deletedAt: Date,
    userSnapshot: Object,
  },
  {
    timestamps: true,
  }
);

deletedAccountSchema.index({ id: 1 }, { unique: true, sparse: true });
deletedAccountSchema.index({ userId: 1 });

deletedAccountSchema.plugin(mongoosePaginate);

const DeletedAccount = mongoose.model(
  "DeletedAccount",
  deletedAccountSchema
);

export default DeletedAccount;