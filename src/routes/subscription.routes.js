import { Router } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongodb.js";
import User from "../models/User.js";
import { fail, ok } from "../lib/response.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

const premiumMonthly = {
  plan: "premium_monthly",
  amount: 79900,
  currency: "INR",
};

function addOneMonth(date = new Date()) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function userLookupForRevenueCat(event) {
  const ids = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
  ].filter(Boolean);

  const filters = ids.map((id) => ({ uid: id }));
  for (const id of ids) {
    if (mongoose.Types.ObjectId.isValid(id)) {
      filters.push({ _id: id });
    }
  }

  return filters.length ? { $or: filters } : null;
}

function hasPremiumEntitlement(event) {
  const entitlementId = process.env.REVENUECAT_ENTITLEMENT_ID || "premium";
  const entitlementIds = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
    : [event.entitlement_id].filter(Boolean);
  return entitlementIds.includes(entitlementId);
}

function subscriptionFromRevenueCatEvent(event) {
  const activeTypes = new Set([
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "NON_RENEWING_PURCHASE",
    "SUBSCRIPTION_EXTENDED",
    "TEMPORARY_ENTITLEMENT_GRANT",
    "REFUND_REVERSED",
  ]);

  if (event.type === "EXPIRATION") {
    return {
      plan: "free",
      trialEndsAt: null,
      renewsAt: null,
    };
  }

  if (!activeTypes.has(event.type)) return null;

  return {
    plan: "premium",
    trialEndsAt: null,
    renewsAt: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
  };
}

function subscriptionFromRevenueCatSubscriber(subscriber, entitlementId) {
  const entitlement = subscriber?.entitlements?.[entitlementId];
  if (!entitlement) {
    return {
      plan: "free",
      trialEndsAt: null,
      renewsAt: null,
    };
  }

  const expiresDate = entitlement.expires_date
    ? new Date(entitlement.expires_date)
    : null;
  const isActive = !expiresDate || expiresDate > new Date();

  return {
    plan: isActive ? "premium" : "free",
    trialEndsAt: null,
    renewsAt: isActive ? expiresDate : null,
  };
}

router.post(
  "/revenuecat/webhook",
  asyncHandler(async (req, res) => {
    const expectedAuthorization = process.env.REVENUECAT_WEBHOOK_AUTH;
    if (!expectedAuthorization) {
      return fail(res, "RevenueCat webhook auth is not configured.", 503);
    }

    if (req.get("authorization") !== expectedAuthorization) {
      return fail(res, "Unauthorized RevenueCat webhook.", 401);
    }

    const event = req.body?.event;
    if (!event || !hasPremiumEntitlement(event)) {
      return ok(res, { processed: false });
    }

    const userFilter = userLookupForRevenueCat(event);
    const subscription = subscriptionFromRevenueCatEvent(event);
    if (!userFilter || !subscription) {
      return ok(res, { processed: false });
    }

    await connectDB();
    const user = await User.findOneAndUpdate(
      userFilter,
      { subscription },
      { new: true }
    ).select("subscription");

    return ok(res, {
      processed: Boolean(user),
      subscription: user?.subscription,
    });
  })
);

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    await connectDB();
    const user = await User.findById(req.userId).select("subscription");
    return ok(res, user.subscription);
  })
);

// NOTE: In production, do NOT let the client set plan directly.
// This endpoint should only be called by a verified RevenueCat/Stripe webhook.
// Kept here as a stub so the Flutter app has a contract to build against.
router.patch(
  "/",
  asyncHandler(async (req, res) => {
    return fail(res, "Subscription changes must be verified by a payment provider.", 403);
  })
);

router.patch(
  "/revenuecat/sync",
  asyncHandler(async (req, res) => {
    const apiKey = process.env.REVENUECAT_SECRET_API_KEY;
    if (!apiKey) {
      return fail(res, "RevenueCat API key is not configured on the server.", 503);
    }

    await connectDB();
    const user = await User.findById(req.userId).select("uid subscription");
    if (!user) {
      return fail(res, "User not found.", 404);
    }

    const appUserId = user.uid || user._id.toString();
    const entitlementId =
      req.body?.entitlementId || process.env.REVENUECAT_ENTITLEMENT_ID || "premium";
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Platform": "ios",
        },
      }
    );
    const customerInfo = await response.json();

    if (!response.ok) {
      return fail(
        res,
        customerInfo?.message || "Could not sync RevenueCat subscription.",
        response.status
      );
    }

    const subscription = subscriptionFromRevenueCatSubscriber(
      customerInfo.subscriber,
      entitlementId
    );
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { subscription },
      { new: true }
    ).select("subscription");

    return ok(res, updatedUser.subscription);
  })
);

router.post(
  "/razorpay/order",
  asyncHandler(async (req, res) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return fail(res, "Razorpay is not configured on the server.", 503);
    }

    const { plan = premiumMonthly.plan } = req.body;
    if (plan !== premiumMonthly.plan) {
      return fail(res, "Unsupported subscription plan.", 400);
    }

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: premiumMonthly.amount,
        currency: premiumMonthly.currency,
        receipt: `premium_${req.userId}_${Date.now()}`,
        notes: {
          userId: req.userId,
          plan,
        },
      }),
    });

    const order = await response.json();
    if (!response.ok) {
      return fail(
        res,
        order?.error?.description || "Could not create Razorpay order.",
        response.status
      );
    }

    return ok(res, {
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: "ARISE Premium",
      description: "Monthly subscription",
    });
  })
);

router.post(
  "/razorpay/verify",
  asyncHandler(async (req, res) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return fail(res, "Razorpay is not configured on the server.", 503);
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return fail(res, "Missing Razorpay verification details.", 400);
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return fail(res, "Invalid Razorpay payment signature.", 400);
    }

    await connectDB();
    const subscription = {
      plan: "premium",
      trialEndsAt: null,
      renewsAt: addOneMonth(),
    };
    const user = await User.findByIdAndUpdate(
      req.userId,
      { subscription },
      { new: true }
    ).select("subscription");

    return ok(res, user.subscription);
  })
);

export default router;
