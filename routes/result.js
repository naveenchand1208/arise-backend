const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

// GET /api/result/loop-status  — current 4-layer loop scores
router.get('/loop-status', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get();
    const u = doc.data();
    res.json({ success: true, data: {
      loopStatus: u.loopStatus || { belief: 0, behaviour: 0, pattern: 0, result: 0 },
      beliefScore: u.beliefScore || 0,
      currentStreak: u.currentStreak || 0,
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/result/belief-evolution  — belief score over time
router.get('/belief-evolution', verifyToken, async (req, res) => {
  try {
    const { months = 6 } = req.query;
    const snap = await db.collection('beliefCheckins')
      .where('uid', '==', req.user.uid)
      .orderBy('date', 'asc')
      .get();
    // Group by month and average
    const byMonth = {};
    snap.docs.forEach(d => {
      const month = d.data().date.substring(0, 7);
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(d.data().avg);
    });
    const evolution = Object.entries(byMonth).slice(-parseInt(months)).map(([month, scores]) => ({
      month,
      avg: parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)),
    }));
    res.json({ success: true, data: evolution });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/result/monthly-report
router.get('/monthly-report', verifyToken, async (req, res) => {
  try {
    const { month } = req.query;
    const targetMonth = month || new Date().toISOString().substring(0, 7);
    const uid = req.user.uid;
    const [userDoc, checkins, mornings, breaks, journals] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('beliefCheckins').where('uid', '==', uid).where('date', '>=', `${targetMonth}-01`).get(),
      db.collection('morningCheckins').where('uid', '==', uid).where('date', '>=', `${targetMonth}-01`).get(),
      db.collection('patternBreaks').where('uid', '==', uid).where('createdAt', '>=', `${targetMonth}-01`).get(),
      db.collection('journalEntries').where('uid', '==', uid).where('date', '>=', `${targetMonth}-01`).get(),
    ]);
    const u = userDoc.data();
    const avgBelief = checkins.docs.length ? checkins.docs.reduce((s, d) => s + d.data().avg, 0) / checkins.docs.length : 0;
    res.json({ success: true, data: {
      month: targetMonth,
      beliefCheckins: checkins.docs.length,
      avgBeliefScore: parseFloat(avgBelief.toFixed(1)),
      morningProtocols: mornings.docs.length,
      patternBreaks: breaks.docs.length,
      journalEntries: journals.docs.length,
      currentStreak: u.currentStreak || 0,
      longestStreak: u.longestStreak || 0,
      loopStatus: u.loopStatus || {},
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/result/bottleneck  — identify weakest loop layer
router.get('/bottleneck', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get();
    const loop = doc.data().loopStatus || { belief: 0, behaviour: 0, pattern: 0, result: 0 };
    const sorted = Object.entries(loop).sort((a, b) => a[1] - b[1]);
    const bottleneck = sorted[0];
    const recommendations = {
      belief: 'Complete Daily Belief Check and 3 I AM statements today.',
      behaviour: 'Complete all 5 morning protocol steps tomorrow.',
      pattern: 'Log a pattern break and check in to your active challenge.',
      result: 'Track 3 specific results or wins in your Result Hub.',
    };
    res.json({ success: true, data: {
      bottleneck: { layer: bottleneck[0], score: bottleneck[1] },
      loopStatus: loop,
      recommendation: recommendations[bottleneck[0]],
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
