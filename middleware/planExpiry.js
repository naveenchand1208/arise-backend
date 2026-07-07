const { db } = require('../config/firebase');

// Middleware: auto-downgrade expired plans on any authenticated request
// Lightweight — only runs a Firestore update if plan is actually expired
const checkPlanExpiry = async (req, res, next) => {
  try {
    if (!req.user?.uid) return next();
    const user = await db.collection('users').doc(req.user.uid).get();
    if (!user.exists) return next();
    const data = user.data();
    if (data.plan !== 'free' && data.planExpiresAt) {
      if (new Date(data.planExpiresAt) < new Date()) {
        await db.collection('users').doc(req.user.uid).update({
          plan: 'free',
          planId: null,
          updatedAt: new Date().toISOString(),
        });
        req.user.plan = 'free';
      }
    }
    next();
  } catch (_) {
    next(); // never block the request
  }
};

// Scheduled job: run every hour to batch-downgrade expired users
// Call this from a cron or setInterval in server.js
const runExpiryJob = async () => {
  try {
    const now = new Date().toISOString();
    const snap = await db.collection('users')
      .where('plan', '!=', 'free')
      .where('planExpiresAt', '<', now)
      .limit(100)
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { plan: 'free', planId: null, updatedAt: now });
    });
    await batch.commit();
    console.log(`[expiry-job] Downgraded ${snap.size} expired plans`);
  } catch (e) {
    console.error('[expiry-job] Error:', e.message);
  }
};

module.exports = { checkPlanExpiry, runExpiryJob };
