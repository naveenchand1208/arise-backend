import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { connectDB } from "../lib/mongodb.js";
import { ok, fail } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import DeleteAccountRequest from "../models/DeleteAccountRequest.js";
import DeletedAccount from "../models/deletedAccount.js"
import User from "../models/User.js";
import { archiveAndDeleteUser } from "../lib/archiveUser.js";
//import { verifyAdminPassword } from "../lib/admin.js"

const router = Router();

router.post(
  "/delete-account-requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();

    const page = Number(req.body.page || 1);
    const limit = Number(req.body.limit || 20);
    const search = (req.body.search || "").trim();
    const status = req.body.status || "Pending";

    const match = {};

    if (status && status !== "all") {
      match.status = status;
    }

    if (search) {
      match.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
      ];
    }

    const result = await DeleteAccountRequest.paginate(match, {
      page,
      limit,
      sort: { createdAt: -1 },
      lean: true,
    });

    return ok(res, result);
  })
);

router.post(
  "/delete-account-request-action",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();
    const adminUser = await User.findById(req.userId);

    if (!adminUser) {
      return fail(res, "User not found", 404);
    }

    if (adminUser.role !== "ceo_founder") {
      return fail(res, "Unauthorized", 403);
    }

    const { requestId, action } = req.body;
    if (!requestId || !action) {
      return fail(res, "requestId and action are required", 400);
    }

    const request = await DeleteAccountRequest.findOne({ id: requestId });

    if (!request) {
      return fail(res, "Request not found", 404);
    }

    if (action === "reject") {
      request.status = "Rejected";
      request.reviewedBy = req.userId;
      request.reviewedAt = new Date();

      await request.save();

      return ok(res, request);
    }

    if (action !== "delete") {
      return fail(res, "Unsupported action", 400);
    }

    // const passwordOk = await verifyAdminPassword(req.userId, adminPassword);

    // if (!passwordOk) {
    //   return fail(res, "Admin password is required or invalid", 403);
    // }

    // const user = await User.findOne({
    //   id: request.userId,
    //   //role: "user",
    // });

    const user = await User.findById({
      _id: request.userId,
    });

    if (!user) {
      request.status = "User Missing";
      request.reviewedBy = req.userId;
      request.reviewedAt = new Date();

      await request.save();

      return fail(res, "User not found", 404);
    }

    const archive = await archiveAndDeleteUser({
      user,
      request,
      admin: req.userId,
    });

    return ok(res, archive);
  })
);

router.post(
  "/deleted-accounts",
  requireAuth,
  asyncHandler(async (req, res) => {
    await connectDB();

    const page = Number(req.body.page || 1);
    const limit = Number(req.body.limit || 20);
    const search = (req.body.search || "").trim();

    const match = {};

    if (search) {
      match.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { userId: { $regex: search, $options: "i" } },
        { reason: { $regex: search, $options: "i" } },
      ];
    }

    const result = await DeletedAccount.paginate(match, {
      page,
      limit,
      sort: {
        deletedAt: -1,
        createdAt: -1,
      },
      lean: true,
    });

    return ok(res, result);
  })
);

export default router;