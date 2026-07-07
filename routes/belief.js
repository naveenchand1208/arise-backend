const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

// POST /api/belief/checkin  — daily belief score across 5 domains
router.post('/checkin', verifyToken, async (req, res) => {
  try {
    const { scores } = req.body; // { health, wealth, happiness, relationships, purpose }
    if (!scores) return res.status(400).json({ success: false, message: 'Scores required' });
    const vals = Object.values(scores);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const checkinRef = db.collection('beliefCheckins').doc(`${req.user.uid}_${today}`);
    await checkinRef.set({ uid: req.user.uid, scores, avg: parseFloat(avg.toFixed(2)), date: today, createdAt: now });
    await db.collection('users').doc(req.user.uid).update({
      beliefScore: parseFloat(avg.toFixed(1)),
      'loopStatus.belief': Math.min(100, Math.round(avg * 10)),
      updatedAt: now,
    });
    res.json({ success: true, message: 'Belief check-in saved', data: { avg: parseFloat(avg.toFixed(1)), scores } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/belief/checkins  — history
router.get('/checkins', verifyToken, async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    const snap = await db.collection('beliefCheckins')
      .where('uid', '==', req.user.uid)
      .orderBy('date', 'desc')
      .limit(parseInt(limit))
      .get();
    const checkins = snap.docs.map(d => d.data());
    res.json({ success: true, data: checkins });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/belief/iam  — save I AM statements
router.post('/iam', verifyToken, async (req, res) => {
  try {
    const { statements } = req.body; // string[]
    if (!Array.isArray(statements)) return res.status(400).json({ success: false, message: 'Statements array required' });
    const now = new Date().toISOString();
    await db.collection('iamStatements').doc(req.user.uid).set({
      uid: req.user.uid, statements, updatedAt: now,
    });
    await db.collection('users').doc(req.user.uid).update({ iamCount: statements.length, updatedAt: now });
    res.json({ success: true, message: 'I AM statements saved', data: { count: statements.length } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/belief/iam
router.get('/iam', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('iamStatements').doc(req.user.uid).get();
    const data = doc.exists ? doc.data().statements : [];
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/belief/reframe  — save belief reframes
router.post('/reframe', verifyToken, async (req, res) => {
  try {
    const { old: oldBelief, newBelief } = req.body;
    if (!oldBelief || !newBelief) return res.status(400).json({ success: false, message: 'Old and new belief required' });
    const now = new Date().toISOString();
    await db.collection('beliefReframes').add({ uid: req.user.uid, old: oldBelief, new: newBelief, createdAt: now });
    res.status(201).json({ success: true, message: 'Reframe saved' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;

// GET /api/belief/reframes
router.get('/reframes', verifyToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const snap = await db.collection('beliefReframes')
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/belief/reframes/:id
router.delete('/reframes/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('beliefReframes').doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid)
      return res.status(404).json({ success: false, message: 'Not found' });
    await doc.ref.delete();
    res.json({ success: true, message: 'Reframe deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
