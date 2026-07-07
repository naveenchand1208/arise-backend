const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLANS = {
  core_monthly:   { price: 39900, label: 'Core Monthly', plan: 'core', durationDays: 30 },
  core_annual:    { price: 299900, label: 'Core Annual', plan: 'core', durationDays: 365 },
  premium_monthly:{ price: 79900, label: 'Premium Monthly', plan: 'premium', durationDays: 30 },
  premium_annual: { price: 599900, label: 'Premium Annual', plan: 'premium', durationDays: 365 },
};

// GET /api/subscription/plans
router.get('/plans', (req, res) => {
  res.json({ success: true, data: Object.entries(PLANS).map(([id, p]) => ({ id, ...p })) });
});

// POST /api/subscription/create-order  — create Razorpay order
router.post('/create-order', verifyToken, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = PLANS[planId];
    if (!plan) return res.status(400).json({ success: false, message: 'Invalid plan' });
    const order = await razorpay.orders.create({
      amount: plan.price,
      currency: 'INR',
      receipt: `arise_${req.user.uid}_${Date.now()}`,
      notes: { uid: req.user.uid, planId },
    });
    res.json({ success: true, data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planLabel: plan.label,
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/subscription/verify  — verify payment and activate plan
router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ success: false, message: 'Payment details required' });

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
    if (expectedSig !== razorpay_signature)
      return res.status(400).json({ success: false, message: 'Payment verification failed' });

    const plan = PLANS[planId];
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + plan.durationDays * 86400000).toISOString();

    // Save transaction
    await db.collection('transactions').add({
      uid: req.user.uid, planId, amount: plan.price / 100,
      razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id,
      status: 'success', createdAt: now,
    });

    // Upgrade user plan
    await db.collection('users').doc(req.user.uid).update({
      plan: plan.plan, planId, planExpiresAt: expiresAt, updatedAt: now,
    });

    res.json({ success: true, message: `${plan.label} activated!`, data: { plan: plan.plan, expiresAt } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/subscription/pay  — server-rendered Razorpay checkout for iOS WebView
// Renders an HTML page that opens Razorpay checkout and redirects to arise://payment/...
router.get('/pay', async (req, res) => {
  try {
    const { orderId, plan } = req.query;
    if (!orderId) return res.status(400).send('<h1>Missing orderId</h1>');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>ARISE Payment</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:system-ui,sans-serif; background:#0A0A0F; color:#E8E8F0; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#13131A; border:1px solid rgba(255,255,255,.07); border-radius:16px; padding:32px; max-width:380px; width:90%; text-align:center; }
    h2 { color:#C9A84C; font-size:22px; margin-bottom:8px; letter-spacing:2px; }
    p { color:rgba(255,255,255,.4); font-size:13px; margin-bottom:24px; }
    .spinner { width:40px; height:40px; border:3px solid rgba(201,168,76,.2); border-top-color:#C9A84C; border-radius:50%; animation:spin .8s linear infinite; margin:0 auto; }
    @keyframes spin { to { transform:rotate(360deg) } }
  </style>
</head>
<body>
  <div class="card">
    <h2>ARISE</h2>
    <p>Opening secure payment...</p>
    <div class="spinner"></div>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    window.onload = function() {
      var options = {
        key: '${process.env.RAZORPAY_KEY_ID}',
        order_id: '${orderId}',
        name: 'ARISE',
        description: 'Spiritual Life OS Subscription',
        image: 'https://arise.in/logo.png',
        theme: { color: '#C9A84C' },
        handler: function(response) {
          window.location.href = 'arise://payment/success?payment_id=' + response.razorpay_payment_id + '&order_id=' + response.razorpay_order_id + '&signature=' + response.razorpay_signature;
        },
        modal: {
          ondismiss: function() {
            window.location.href = 'arise://payment/failed?reason=cancelled';
          }
        }
      };
      var rzp = new Razorpay(options);
      rzp.on('payment.failed', function(resp) {
        window.location.href = 'arise://payment/failed?reason=' + encodeURIComponent(resp.error.description);
      });
      rzp.open();
    };
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (e) {
    res.status(500).send('<h1>Server error</h1>');
  }
});

// GET /api/subscription/status
router.get('/status', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get();
    const { plan, planId, planExpiresAt } = doc.data();
    const expired = planExpiresAt && new Date(planExpiresAt) < new Date();
    if (expired && plan !== 'free') {
      await db.collection('users').doc(req.user.uid).update({ plan: 'free', updatedAt: new Date().toISOString() });
      return res.json({ success: true, data: { plan: 'free', expired: true } });
    }
    res.json({ success: true, data: { plan, planId, planExpiresAt, expired: false } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;

// POST /api/subscription/webhook  — Razorpay webhook (no auth, signature verified)
// Add this URL in Razorpay Dashboard → Webhooks → https://api.arise.in/api/subscription/webhook
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) return res.status(400).json({ success: false });

    // Verify webhook signature
    const body = JSON.stringify(req.body);
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSig !== signature) {
      console.warn('Razorpay webhook: invalid signature');
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured') {
      const payment = payload.payment?.entity;
      if (!payment) return res.json({ success: true });

      const orderId = payment.order_id;
      const paymentId = payment.id;
      const notes = payment.notes || {};
      const uid = notes.uid;
      const planId = notes.planId;

      if (!uid || !planId) {
        // Try to find order in DB by razorpay order ID
        const snap = await db.collection('transactions')
          .where('razorpayOrderId', '==', orderId).get();
        if (!snap.empty) return res.json({ success: true }); // already processed
        console.warn('Webhook: no uid/planId in notes for order', orderId);
        return res.json({ success: true });
      }

      // Check not already processed
      const existing = await db.collection('transactions')
        .where('razorpayPaymentId', '==', paymentId).get();
      if (!existing.empty) return res.json({ success: true }); // idempotent

      const plan = PLANS[planId];
      if (!plan) return res.json({ success: true });

      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + plan.durationDays * 86400000).toISOString();

      // Save transaction
      await db.collection('transactions').add({
        uid, planId,
        amount: payment.amount / 100,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        status: 'success',
        source: 'webhook',
        createdAt: now,
      });

      // Activate plan
      await db.collection('users').doc(uid).update({
        plan: plan.plan,
        planId,
        planExpiresAt: expiresAt,
        updatedAt: now,
      });

      console.log(`Webhook: plan ${plan.plan} activated for ${uid} via ${paymentId}`);
    }

    if (event === 'payment.failed') {
      const payment = payload.payment?.entity;
      const orderId = payment?.order_id;
      const uid = payment?.notes?.uid;
      if (uid && orderId) {
        await db.collection('transactions').add({
          uid, orderId, status: 'failed',
          reason: payment?.error_description || 'unknown',
          createdAt: new Date().toISOString(),
        });
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Webhook error:', e.message);
    res.status(500).json({ success: false });
  }
});

// GET /api/subscription/gate/:feature — check if user can access a premium feature
// Flutter calls this on entering any premium screen
router.get('/gate/:feature', verifyToken, async (req, res) => {
  try {
    const { feature } = req.params;
    const doc = await db.collection('users').doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'User not found' });

    const user = doc.data();
    const plan = user.plan || 'free';

    // Feature gate map
    const gateMap = {
      // Core plan features
      'wealth_hub':         ['core', 'premium', 'corporate'],
      'challenge_66':       ['core', 'premium', 'corporate'],
      'challenge_90':       ['core', 'premium', 'corporate'],
      'all_meditations':    ['core', 'premium', 'corporate'],
      'breathwork_full':    ['core', 'premium', 'corporate'],
      'journal_unlimited':  ['core', 'premium', 'corporate'],
      // Premium only
      'master_library':     ['premium', 'corporate'],
      'ai_loop_insight':    ['premium', 'corporate'],
      'income_tracker':     ['premium', 'corporate'],
      'belief_evolution':   ['premium', 'corporate'],
      'monthly_report':     ['premium', 'corporate'],
      'corporate_dashboard':['corporate'],
    };

    const allowedPlans = gateMap[feature];
    if (!allowedPlans) return res.json({ success: true, data: { allowed: true } }); // free feature

    const allowed = allowedPlans.includes(plan);

    // Check expiry
    if (allowed && user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) {
      await doc.ref.update({ plan: 'free', updatedAt: new Date().toISOString() });
      return res.json({ success: true, data: {
        allowed: false,
        reason: 'expired',
        message: 'Your plan has expired. Renew to continue.',
        requiredPlans: allowedPlans,
        currentPlan: 'free',
      }});
    }

    res.json({ success: true, data: {
      allowed,
      currentPlan: plan,
      requiredPlans: allowedPlans,
      reason: allowed ? null : 'upgrade_required',
      message: allowed ? null : `This feature requires ${allowedPlans[0]} plan or above.`,
      upgradeUrl: '/subscription',
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
