import { Router } from "express";
import jwt from "jsonwebtoken";
import { connectDB } from "../lib/mongodb.js";
import User from "../models/User.js";
import Streak from "../models/Streak.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { ok, fail } from "../lib/response.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || "arise-f74c0";
const firebaseCertUrl =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let firebaseCertCache = { expiresAt: 0, certs: {} };

function userPayload(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    uid: user.uid,
    role: user.role,
    emailVerified: user.emailVerified,
    onboardingComplete: user.onboardingComplete,
  };
}

async function firebaseCerts() {
  if (Date.now() < firebaseCertCache.expiresAt) {
    return firebaseCertCache.certs;
  }

  const response = await fetch(firebaseCertUrl);
  if (!response.ok) {
    throw new Error("Unable to fetch Firebase token certificates");
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  firebaseCertCache = {
    expiresAt: Date.now() + maxAgeSeconds * 1000,
    certs: await response.json(),
  };

  return firebaseCertCache.certs;
}

async function verifyFirebaseIdToken(idToken) {
  const decoded = jwt.decode(idToken, { complete: true });
  const keyId = decoded?.header?.kid;
  if (!keyId) {
    throw new Error("Invalid Firebase token");
  }

  const certs = await firebaseCerts();
  const cert = certs[keyId];
  if (!cert) {
    throw new Error("Unknown Firebase token certificate");
  }

  return jwt.verify(idToken, cert, {
    algorithms: ["RS256"],
    audience: firebaseProjectId,
    issuer: `https://securetoken.google.com/${firebaseProjectId}`,
  });
}

router.post(
  "/social-login",
  asyncHandler(async (req, res) => {
    await connectDB();

    const { idToken, provider, fullName, name, deviceInfo, ios, role } = req.body;
    if (!idToken) {
      return fail(res, "A valid social account is required", 400);
    }

    let decodedToken;
    try {
      decodedToken = await verifyFirebaseIdToken(idToken);
    } catch {
      return fail(res, "Invalid social token", 401);
    }

    const socialEmail = (decodedToken.email || "").toLowerCase().trim();
    const socialUid = decodedToken.user_id || decodedToken.sub;
    const displayName = fullName || name || decodedToken?.name || socialEmail.split("@")[0];

    if (!socialEmail || !socialUid) {
      return fail(res, "A valid social account is required", 400);
    }

    let user = await User.findOne({ email: socialEmail });
    const created = !user;

    if (user) {
      user.uid = user.uid || socialUid;
      user.emailVerified = true;
      user.lastLogin = new Date();
      if (deviceInfo) user.deviceInfo = deviceInfo;
      if (typeof ios === "boolean") user.ios = ios;
      await user.save();
    } else {
      user = await User.create({
        fullName: displayName,
        email: socialEmail,
        uid: socialUid,
        emailVerified: true,
        ios: ios || false,
        role: role || "seeker",
        lastLogin: new Date(),
        deviceInfo,
      });

      await Streak.create({ userId: user._id });
    }

    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());

    return ok(res, {
      user: userPayload(user),
      accessToken,
      refreshToken,
      provider: provider || decodedToken?.firebase?.sign_in_provider,
      isNewUser: created,
    }, created ? 201 : 200);
  })
);

router.post(
  ["/refresh", "/refresh-token"],
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

export default router;
