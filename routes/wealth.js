const express = require('express');
const router = express.Router();
const { verifyToken, requirePremium } = require('../middleware/auth');
const { db } = require('../config/firebase');

// POST /api/wealth/intention  — set monthly income intention
router.post('/intention', verifyToken, requirePremium, async (req, res) => {
  try {
    const { targetAmount, currency = 'INR' } = req.body;
    if (!targetAmount || isNaN(targetAmount)) return res.status(400).json({ success: false, message: 'Valid target amount required' });
    const now = new Date().toISOString();
    const month = now.substring(0, 7); // YYYY-MM
    await db.collection('incomeIntentions').doc(`${req.user.uid}_${month}`).set({
      uid: req.user.uid, targetAmount: parseFloat(targetAmount), currency, month, createdAt: now, updatedAt: now,
    });
    res.json({ success: true, message: 'Income intention set', data: { targetAmount, month } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/wealth/income-entry  — log actual income
router.post('/income-entry', verifyToken, requirePremium, async (req, res) => {
  try {
    const { source, amount, currency = 'INR', beliefScoreAtTime } = req.body;
    if (!source || !amount) return res.status(400).json({ success: false, message: 'Source and amount required' });
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const ref = await db.collection('incomeEntries').add({
      uid: req.user.uid, source, amount: parseFloat(amount), currency,
      beliefScore: beliefScoreAtTime || userDoc.data().beliefScore || 0,
      date: today, createdAt: now,
    });
    res.status(201).json({ success: true, message: 'Income logged', data: { id: ref.id, amount, source } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/wealth/income-summary  — monthly summary
router.get('/income-summary', verifyToken, requirePremium, async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM, defaults to current month
    const targetMonth = month || new Date().toISOString().substring(0, 7);
    const [intentionDoc, entriesSnap] = await Promise.all([
      db.collection('incomeIntentions').doc(`${req.user.uid}_${targetMonth}`).get(),
      db.collection('incomeEntries').where('uid', '==', req.user.uid).where('date', '>=', `${targetMonth}-01`).where('date', '<=', `${targetMonth}-31`).get(),
    ]);
    const target = intentionDoc.exists ? intentionDoc.data().targetAmount : 0;
    const entries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const actual = entries.reduce((sum, e) => sum + e.amount, 0);
    const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
    res.json({ success: true, data: { month: targetMonth, target, actual, pct, entries } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
