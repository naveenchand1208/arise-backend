const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

// GET /api/tasks — load today's tasks
router.get('/', verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snap = await db.collection('tasks')
      .where('uid', '==', req.user.uid)
      .where('date', '==', today)
      .orderBy('order', 'asc')
      .get();

    // Auto-create 3 empty slots if none exist for today
    if (snap.empty) {
      const batch = db.batch();
      const slots = [1, 2, 3].map(order => {
        const ref = db.collection('tasks').doc();
        batch.set(ref, {
          uid: req.user.uid, date: today, order,
          text: '', done: false, priority: null,
          createdAt: new Date().toISOString(),
        });
        return { id: ref.id, order, text: '', done: false, priority: null, date: today };
      });
      await batch.commit();
      return res.json({ success: true, data: slots });
    }

    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/tasks — add task
router.post('/', verifyToken, async (req, res) => {
  try {
    const { text, order = 1, priority } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Text required' });
    const today = new Date().toISOString().split('T')[0];

    // Max 3 tasks per day
    const existing = await db.collection('tasks')
      .where('uid', '==', req.user.uid)
      .where('date', '==', today)
      .where('text', '!=', '')
      .get();
    if (existing.size >= 3) return res.status(400).json({ success: false, message: 'Max 3 tasks per day' });

    const now = new Date().toISOString();
    const ref = await db.collection('tasks').add({
      uid: req.user.uid, text: text.trim(),
      date: today, order, done: false,
      priority: priority || null,
      createdAt: now, updatedAt: now,
    });
    res.status(201).json({ success: true, data: { id: ref.id } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/tasks/:id — update text or toggle done
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('tasks').doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid)
      return res.status(404).json({ success: false, message: 'Task not found' });

    const { text, done } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (text !== undefined) updates.text = text.trim();
    if (done !== undefined) {
      updates.done = done;
      updates.doneAt = done ? new Date().toISOString() : null;
    }

    await doc.ref.update(updates);

    // If all 3 done → trigger celebration opportunity
    if (done) {
      const today = new Date().toISOString().split('T')[0];
      const snap = await db.collection('tasks')
        .where('uid', '==', req.user.uid)
        .where('date', '==', today).get();
      const allDone = snap.docs.filter(d => d.data().text).every(d => d.data().done);
      if (allDone) {
        await db.collection('users').doc(req.user.uid).update({
          'loopStatus.result': 70, // bump result layer when tasks complete
          updatedAt: new Date().toISOString(),
        });
      }
    }

    res.json({ success: true, message: 'Task updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/tasks/:id
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('tasks').doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid)
      return res.status(404).json({ success: false, message: 'Task not found' });
    await doc.ref.delete();
    res.json({ success: true, message: 'Task deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/tasks/history — last 7 days completion rate
router.get('/history', verifyToken, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const snap = await db.collection('tasks')
      .where('uid', '==', req.user.uid)
      .where('date', '>=', sevenDaysAgo)
      .orderBy('date', 'desc').get();

    const byDate = {};
    snap.docs.forEach(d => {
      const data = d.data();
      if (!data.text) return;
      if (!byDate[data.date]) byDate[data.date] = { total: 0, done: 0 };
      byDate[data.date].total++;
      if (data.done) byDate[data.date].done++;
    });

    const history = Object.entries(byDate).map(([date, s]) => ({
      date, total: s.total, done: s.done,
      pct: Math.round((s.done / s.total) * 100),
    }));

    res.json({ success: true, data: history });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
