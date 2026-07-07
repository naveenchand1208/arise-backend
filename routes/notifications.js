const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/auth');
const { db, messaging } = require('../config/firebase');

// POST /api/notifications/send-to-user  — targeted push (admin only)
router.post('/send-to-user', verifyAdmin, async (req, res) => {
  try {
    const { uid, title, body, data } = req.body;
    if (!uid || !title || !body) return res.status(400).json({ success: false, message: 'uid, title, body required' });
    const userDoc = await db.collection('users').doc(uid).get();
    const tokens = userDoc.data()?.fcmTokens || [];
    if (!tokens.length) return res.status(404).json({ success: false, message: 'No FCM tokens for user' });
    const result = await messaging.sendEachForMulticast({ tokens, notification: { title, body }, data: data || {} });
    await db.collection('notificationLogs').add({ uid, title, body, type: 'targeted', sentAt: new Date().toISOString(), successCount: result.successCount });
    res.json({ success: true, data: { sent: result.successCount, failed: result.failureCount } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/notifications/broadcast  — send to a segment (admin only)
router.post('/broadcast', verifyAdmin, async (req, res) => {
  try {
    const { segment, title, body, data } = req.body;
    // segment: 'all' | 'free' | 'core' | 'premium' | 'inactive_7d' | 'streak_7'
    if (!title || !body) return res.status(400).json({ success: false, message: 'title and body required' });
    let query = db.collection('users');
    if (segment === 'free') query = query.where('plan', '==', 'free');
    else if (segment === 'core') query = query.where('plan', '==', 'core');
    else if (segment === 'premium') query = query.where('plan', '==', 'premium');
    const snap = await query.limit(500).get();
    const allTokens = snap.docs.flatMap(d => d.data().fcmTokens || []).filter(Boolean);
    if (!allTokens.length) return res.json({ success: true, message: 'No tokens found for segment', data: { sent: 0 } });
    // Send in batches of 500 (FCM limit)
    let totalSuccess = 0;
    for (let i = 0; i < allTokens.length; i += 500) {
      const batch = allTokens.slice(i, i + 500);
      const result = await messaging.sendEachForMulticast({ tokens: batch, notification: { title, body }, data: data || {} });
      totalSuccess += result.successCount;
    }
    await db.collection('notificationLogs').add({ segment, title, body, type: 'broadcast', sentAt: new Date().toISOString(), successCount: totalSuccess, adminId: req.admin.uid });
    res.json({ success: true, data: { sent: totalSuccess, segment } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/notifications/history  — user's notification history
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const snap = await db.collection('notificationLogs')
      .where('uid', '==', req.user.uid)
      .orderBy('sentAt', 'desc')
      .limit(parseInt(limit))
      .get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
