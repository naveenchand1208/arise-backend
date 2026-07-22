import DeletedAccount from "../models/deletedAccount.js";
import DeleteAccountRequest from "../models/deleteAccountRequest.js";
import User from "../models/User.js"; // Change if your model name is different

export async function archiveAndDeleteUser({
  user,
  request,
  admin,
}) {
  const requestData = request || {};

  const archive = await DeletedAccount.create({
    userId: user._id,
    name: requestData.name || user.fullName || user.name,
    email: requestData.email || user.email,
    phone: requestData.phone || user.phone,
    reason: requestData.reason || "Admin deleted account",
    otherReason: requestData.otherReason || "",
    requestId: requestData.id,

    deletedBy: admin,
    deletedAt: new Date(),

    userSnapshot: user.toObject(),
  });

  // Delete user
  await User.deleteOne({
    _id: user._id,
  });

  // Update delete request status
  if (request?.id) {
    await DeleteAccountRequest.updateOne(
      { id: request.id },
      {
        $set: {
          status: "Deleted",
          reviewedBy: admin,
          reviewedAt: new Date(),
        },
      }
    );
  }

  return archive;
}
