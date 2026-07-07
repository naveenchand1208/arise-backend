const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

// POST /api/journal/entry  — create journal entry
router.post('/entry', verifyToken, async (req, res) => {
  try {
    const { type, content, prompts } = req.body;
    // type: 'daily' | 'weekly' | 'monthly' | 'shadow' | 'revision'
    const validTypes = ['daily', 'weekly', 'monthly', 'shadow', 'revision'];
    if (!type || !validTypes.includes(type)) return res.status(400).json({ success: false, message: `Type must be one of: ${validTypes.join(', ')}` });
    if (!content) return res.status(400).json({ success: false, message: 'Content required' });
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const ref = await db.collection('journalEntries').add({
      uid: req.user.uid, type, content, prompts: prompts || [],
      date: today, wordCount: content.split(' ').length, createdAt: now, updatedAt: now,
    });
    // Slight belief boost for shadow/revision work
    if (type === 'shadow' || type === 'revision') {
      const userDoc = await db.collection('users').doc(req.user.uid).get();
      const cur = userDoc.data().beliefScore || 5;
      await db.collection('users').doc(req.user.uid).update({
        beliefScore: Math.min(10, parseFloat((cur + 0.1).toFixed(2))), updatedAt: now,
      });
    }
    res.status(201).json({ success: true, message: 'Journal entry saved', data: { id: ref.id } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/journal/entries
router.get('/entries', verifyToken, async (req, res) => {
  try {
    const { type, limit = 20 } = req.query;
    let query = db.collection('journalEntries').where('uid', '==', req.user.uid).orderBy('createdAt', 'desc').limit(parseInt(limit));
    if (type) query = query.where('type', '==', type);
    const snap = await query.get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/journal/entries/:id
router.get('/entries/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('journalEntries').doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/journal/entries/:id
router.delete('/entries/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('journalEntries').doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid) return res.status(404).json({ success: false, message: 'Entry not found' });
    await db.collection('journalEntries').doc(req.params.id).delete();
    res.json({ success: true, message: 'Entry deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
