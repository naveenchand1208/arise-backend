import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectDB } from "../lib/mongodb.js";
import User from "../models/User.js";
import Streak from "../models/Streak.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { ok, fail } from "../lib/response.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.post(
  "/googleSignUp",
  asyncHandler(async (req, res) => {
    await connectDB();

    const { name, email, uid, deviceInfo, ios } = req.body;

    if (!name || !email || !uid || !deviceInfo) {
      return fail(res, "Required Params is Missing", 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return fail(res, "Email already exists", 400);
    }

    // Create new user
    const user = await User.create({
      fullName: name,
      email: email.toLowerCase(),
      uid,
      emailVerified: true,
      ios: ios || false,
      role: "seeker", // or "user"
      lastLogin: new Date(),
      deviceInfo,
    });

    // Generate JWT Tokens
    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());

    return ok(
      res,
      {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          uid: user.uid,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        accessToken,
        refreshToken,
      },
      201
    );
  })
);

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { fullName, email, password, role } = req.body;

    if (!fullName || !email || !password) {
      return fail(res, "fullName, email and password are required");
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return fail(res, "An account with this email already exists", 409);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
      role: role || "seeker",
    });

    await Streak.create({ userId: user._id });

    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());

    return ok(
      res,
      {
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          onboardingComplete: user.onboardingComplete,
        },
        accessToken,
        refreshToken,
      },
      201
    );
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { email, password } = req.body;
    if (!email || !password) return fail(res, "email and password are required");

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return fail(res, "Invalid email or password", 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return fail(res, "Invalid email or password", 401);

    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());

    return ok(res, {
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
      },
      accessToken,
      refreshToken,
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return fail(res, "refreshToken is required");

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) return fail(res, "Invalid or expired refresh token", 401);

    const accessToken = signAccessToken(payload.sub);
    const newRefreshToken = signRefreshToken(payload.sub);

    return ok(res, { accessToken, refreshToken: newRefreshToken });
  })
);

// NOTE: wire this up to an email provider (SendGrid/Resend/SES) before production.
// Currently returns the reset token directly for local testing only.
router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    await connectDB();
    const { email } = req.body;
    if (!email) return fail(res, "email is required");

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return ok(res, { message: "If that email exists, a reset link has been sent." });

    const resetToken = jwt.sign({ sub: user._id.toString() }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: "30m",
    });

    // TODO: send resetToken via email provider instead of returning it.
    return ok(res, { message: "If that email exists, a reset link has been sent.", resetToken });
  })
);

export default router;
