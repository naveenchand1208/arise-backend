const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

// POST /api/onboarding/save
router.post('/save', verifyToken, async (req, res) => {
  try {
    const { role, lifeVision, priorities, beliefBaseline, paradigms, receivingContainer, stuckPattern, morningTime, nightTime } = req.body;
    const now = new Date().toISOString();
    const onboardingData = {
      role: role || null,
      lifeVision: lifeVision || '',
      priorities: priorities || [],
      beliefBaseline: beliefBaseline || {},
      paradigms: paradigms || [],
      receivingContainer: receivingContainer || 5,
      stuckPattern: stuckPattern || null,
      ritualTimes: { morning: morningTime || '05:00', night: nightTime || '21:30' },
      completedAt: now,
    };
    const avgBelief = beliefBaseline
      ? Object.values(beliefBaseline).reduce((a, b) => a + b, 0) / Object.values(beliefBaseline).length
      : 5;
    await db.collection('users').doc(req.user.uid).update({
      onboardingComplete: true,
      onboarding: onboardingData,
      beliefScore: parseFloat(avgBelief.toFixed(1)),
      updatedAt: now,
    });
    await db.collection('onboarding').doc(req.user.uid).set({ ...onboardingData, uid: req.user.uid });
    res.json({ success: true, message: 'Onboarding saved', data: { beliefScore: parseFloat(avgBelief.toFixed(1)) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/onboarding/data
router.get('/data', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('onboarding').doc(req.user.uid).get();
    if (!doc.exists) return res.json({ success: true, data: null });
    res.json({ success: true, data: doc.data() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
