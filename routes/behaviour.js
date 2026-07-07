const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

// POST /api/behaviour/morning-checkin  — log morning protocol completion
router.post('/morning-checkin', verifyToken, async (req, res) => {
  try {
    const { stepsCompleted, totalSteps = 5, durationMinutes } = req.body;
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const pct = Math.round((stepsCompleted / totalSteps) * 100);
    const ref = db.collection('morningCheckins').doc(`${req.user.uid}_${today}`);
    await ref.set({ uid: req.user.uid, stepsCompleted, totalSteps, pct, durationMinutes: durationMinutes || 0, date: today, createdAt: now });

    // Update streak
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const user = userDoc.data();
    const lastCheckin = user.lastMorningCheckin;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak = lastCheckin === yesterday ? (user.currentStreak || 0) + 1 : 1;
    const longestStreak = Math.max(newStreak, user.longestStreak || 0);

    await db.collection('users').doc(req.user.uid).update({
      currentStreak: newStreak, longestStreak,
      lastMorningCheckin: today,
      'loopStatus.behaviour': pct,
      updatedAt: now,
    });

    res.json({ success: true, message: 'Morning check-in saved', data: { pct, streak: newStreak } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/behaviour/morning-history
router.get('/morning-history', verifyToken, async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const snap = await db.collection('morningCheckins')
      .where('uid', '==', req.user.uid)
      .orderBy('date', 'desc')
      .limit(parseInt(limit))
      .get();
    res.json({ success: true, data: snap.docs.map(d => d.data()) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/behaviour/intention  — save morning intention
router.post('/intention', verifyToken, async (req, res) => {
  try {
    const { iAm, intentions } = req.body;
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    await db.collection('intentions').doc(`${req.user.uid}_${today}`).set({
      uid: req.user.uid, iAm: iAm || '', intentions: intentions || [], date: today, createdAt: now,
    });
    res.json({ success: true, message: 'Intention saved' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/behaviour/midday  — midday check-in
router.post('/midday', verifyToken, async (req, res) => {
  try {
    const { energy, focus, emotion } = req.body;
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    await db.collection('middayCheckins').doc(`${req.user.uid}_${today}`).set({
      uid: req.user.uid, energy: energy || 5, focus: focus || 5, emotion: emotion || 'Neutral', date: today, createdAt: now,
    });
    res.json({ success: true, message: 'Midday check-in saved' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/behaviour/sats  — log SATS session
router.post('/sats', verifyToken, async (req, res) => {
  try {
    const { scene, feeling } = req.body;
    const now = new Date().toISOString();
    await db.collection('satsSessions').add({
      uid: req.user.uid, scene: scene || '', feeling: feeling || '', createdAt: now,
    });
    res.json({ success: true, message: 'SATS session logged' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/behaviour/celebration  — log a win celebration
router.post('/celebration', verifyToken, async (req, res) => {
  try {
    const { win, celebrationType } = req.body;
    if (!win) return res.status(400).json({ success: false, message: 'Win description required' });
    const now = new Date().toISOString();
    await db.collection('celebrations').add({
      uid: req.user.uid, win, celebrationType: celebrationType || 'fist_pump', createdAt: now,
    });
    // Slight belief score boost on celebration
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const cur = userDoc.data().beliefScore || 5;
    if (cur < 10) {
      await db.collection('users').doc(req.user.uid).update({ beliefScore: Math.min(10, parseFloat((cur + 0.05).toFixed(2))), updatedAt: now });
    }
    res.status(201).json({ success: true, message: 'Win celebrated! 🔥' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;

// GET /api/behaviour/today  — today's completion summary (reduces 4 calls to 1)
router.get('/today', verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const uid   = req.user.uid;

    const [morningSnap, middaySnap, satsSnap, intentionSnap] = await Promise.all([
      db.collection('morningCheckins').doc(`${uid}_${today}`).get(),
      db.collection('middayCheckins').doc(`${uid}_${today}`).get(),
      db.collection('satsSessions').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(1).get(),
      db.collection('intentions').doc(`${uid}_${today}`).get(),
    ]);

    const morningData = morningSnap.exists ? morningSnap.data() : null;
    const lastSATS    = satsSnap.docs[0]?.data()?.createdAt?.startsWith(today) || false;

    res.json({
      success: true,
      data: {
        date: today,
        morning: {
          done:           !!morningData,
          stepsCompleted: morningData?.stepsCompleted || 0,
          totalSteps:     morningData?.totalSteps || 5,
          pct:            morningData?.pct || 0,
        },
        midday: {
          done:    middaySnap.exists,
          energy:  middaySnap.exists ? middaySnap.data().energy : null,
          focus:   middaySnap.exists ? middaySnap.data().focus : null,
          emotion: middaySnap.exists ? middaySnap.data().emotion : null,
        },
        sats:      { done: lastSATS },
        intention: { done: intentionSnap.exists },
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
