const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('../middleware/auth');
const { db } = require('../config/firebase');

const CONTENT_COLLECTIONS = {
  meditations: 'meditations',
  breathwork: 'breathwork',
  asana: 'asana',
  affirmations: 'affirmations',
  masterLibrary: 'masterLibrary',
};

function parseLimit(value, fallback = 50, max = 500) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function stripPrivateUserFields(user) {
  const { password, fcmTokens, ...safeUser } = user;
  safeUser.fcmTokenCount = Array.isArray(fcmTokens) ? fcmTokens.length : 0;
  return safeUser;
}

// GET /api/admin/dashboard  — KPI snapshot
router.get('/dashboard', verifyAdmin, async (req, res) => {
  try {
    const [usersSnap, transSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('transactions').where('status', '==', 'success').get(),
    ]);
    const users = usersSnap.docs.map(d => d.data());
    const transactions = transSnap.docs.map(d => d.data());
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const activeThisMonth = users.filter(u => u.lastActiveAt && u.lastActiveAt >= monthStart).length;
    const byPlan = users.reduce((acc, u) => { acc[u.plan] = (acc[u.plan] || 0) + 1; return acc; }, {});
    const mrr = transactions.filter(t => t.createdAt >= monthStart).reduce((s, t) => s + t.amount, 0);
    const streaking = users.filter(u => (u.currentStreak || 0) >= 7).length;
    res.json({ success: true, data: {
      totalUsers: users.length,
      activeThisMonth,
      byPlan,
      mrr,
      streaking,
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/users  — paginated user list
router.get('/users', verifyAdmin, async (req, res) => {
  try {
    const { plan, status } = req.query;
    let query = db.collection('users').orderBy('createdAt', 'desc').limit(parseLimit(req.query.limit));
    if (plan) query = query.where('plan', '==', plan);
    if (status === 'blocked') query = query.where('isBlocked', '==', true);
    if (status === 'active') query = query.where('isBlocked', '==', false);
    const snap = await query.get();
    const users = snap.docs.map(d => stripPrivateUserFields({ uid: d.id, ...d.data() }));
    res.json({ success: true, data: users, total: snap.size });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/admin/users/:uid/block
router.patch('/users/:uid/block', verifyAdmin, async (req, res) => {
  try {
    const { blocked } = req.body;
    await db.collection('users').doc(req.params.uid).update({ isBlocked: !!blocked, updatedAt: new Date().toISOString() });
    await db.collection('adminAuditLogs').add({ adminId: req.admin.uid, action: blocked ? 'BLOCK_USER' : 'UNBLOCK_USER', targetUid: req.params.uid, timestamp: new Date().toISOString() });
    res.json({ success: true, message: blocked ? 'User blocked' : 'User unblocked' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/posts/pending  — community moderation queue
router.get('/posts/pending', verifyAdmin, async (req, res) => {
  try {
    const snap = await db.collection('posts').where('status', '==', 'pending').orderBy('createdAt', 'asc').limit(parseLimit(req.query.limit, 50)).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/posts?status=pending|approved|featured|rejected
router.get('/posts', verifyAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    let query = db.collection('posts').orderBy('createdAt', 'desc').limit(parseLimit(req.query.limit, 100));
    if (status !== 'all') query = query.where('status', '==', status);
    const snap = await query.get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/admin/posts/:postId/moderate
router.patch('/posts/:postId/moderate', verifyAdmin, async (req, res) => {
  try {
    const { action } = req.body; // 'approve' | 'reject' | 'feature'
    const statusMap = { approve: 'approved', reject: 'rejected', feature: 'featured' };
    if (!statusMap[action]) return res.status(400).json({ success: false, message: 'Action must be approve, reject, or feature' });
    await db.collection('posts').doc(req.params.postId).update({ status: statusMap[action], moderatedAt: new Date().toISOString(), moderatedBy: req.admin.uid });
    await db.collection('adminAuditLogs').add({ adminId: req.admin.uid, action: `${action.toUpperCase()}_POST`, targetId: req.params.postId, timestamp: new Date().toISOString() });
    res.json({ success: true, message: `Post ${action}d` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/audit-log
router.get('/audit-log', verifyAdmin, async (req, res) => {
  try {
    const snap = await db.collection('adminAuditLogs').orderBy('timestamp', 'desc').limit(parseLimit(req.query.limit, 50)).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/transactions
router.get('/transactions', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.collection('transactions').orderBy('createdAt', 'desc').limit(parseLimit(req.query.limit, 100));
    if (status && status !== 'all') query = query.where('status', '==', status);
    const snap = await query.get();
    const transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({
      success: true,
      data: transactions,
      total: snap.size,
      summary: {
        gross: transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        success: transactions.filter(t => t.status === 'success').length,
        failed: transactions.filter(t => t.status === 'failed').length,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/notifications
router.get('/notifications', verifyAdmin, async (req, res) => {
  try {
    const snap = await db.collection('notificationLogs').orderBy('sentAt', 'desc').limit(parseLimit(req.query.limit, 100)).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/content/:collection
router.get('/content/:collection', verifyAdmin, async (req, res) => {
  try {
    const collection = CONTENT_COLLECTIONS[req.params.collection];
    if (!collection) return res.status(400).json({ success: false, message: 'Invalid content collection' });
    const snap = await db.collection(collection).orderBy('createdAt', 'desc').limit(parseLimit(req.query.limit, 100)).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/admin/content/:collection
router.post('/content/:collection', verifyAdmin, async (req, res) => {
  try {
    const collection = CONTENT_COLLECTIONS[req.params.collection];
    if (!collection) return res.status(400).json({ success: false, message: 'Invalid content collection' });
    const now = new Date().toISOString();
    const payload = {
      ...req.body,
      isActive: req.body.isActive !== false,
      createdAt: now,
      updatedAt: now,
      createdBy: req.admin.uid,
    };
    const ref = await db.collection(collection).add(payload);
    await db.collection('adminAuditLogs').add({ adminId: req.admin.uid, action: 'CREATE_CONTENT', targetId: ref.id, collection, timestamp: now });
    res.status(201).json({ success: true, data: { id: ref.id, ...payload } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/admin/content/:collection/:id
router.patch('/content/:collection/:id', verifyAdmin, async (req, res) => {
  try {
    const collection = CONTENT_COLLECTIONS[req.params.collection];
    if (!collection) return res.status(400).json({ success: false, message: 'Invalid content collection' });
    const now = new Date().toISOString();
    const payload = { ...req.body, updatedAt: now, updatedBy: req.admin.uid };
    delete payload.id;
    await db.collection(collection).doc(req.params.id).update(payload);
    await db.collection('adminAuditLogs').add({ adminId: req.admin.uid, action: 'UPDATE_CONTENT', targetId: req.params.id, collection, timestamp: now });
    res.json({ success: true, message: 'Content updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/admin/content/:collection/:id
router.delete('/content/:collection/:id', verifyAdmin, async (req, res) => {
  try {
    const collection = CONTENT_COLLECTIONS[req.params.collection];
    if (!collection) return res.status(400).json({ success: false, message: 'Invalid content collection' });
    const now = new Date().toISOString();
    await db.collection(collection).doc(req.params.id).update({ isActive: false, deletedAt: now, deletedBy: req.admin.uid });
    await db.collection('adminAuditLogs').add({ adminId: req.admin.uid, action: 'DELETE_CONTENT', targetId: req.params.id, collection, timestamp: now });
    res.json({ success: true, message: 'Content archived' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/admin/analytics/loops
router.get('/analytics/loops', verifyAdmin, async (req, res) => {
  try {
    const snap = await db.collection('users').limit(parseLimit(req.query.limit, 500, 1000)).get();
    const users = snap.docs.map(d => d.data());
    const layers = ['belief', 'behaviour', 'pattern', 'result'];
    const averages = {};
    const totals = {};
    layers.forEach(layer => { totals[layer] = 0; });

    users.forEach(user => {
      const loop = user.loopStatus || {};
      layers.forEach(layer => { totals[layer] += Number(loop[layer]) || 0; });
    });

    layers.forEach(layer => { averages[layer] = users.length ? Math.round(totals[layer] / users.length) : 0; });
    res.json({
      success: true,
      data: {
        sampleSize: users.length,
        averages,
        completion: {
          morning: users.filter(u => (u.currentStreak || 0) > 0).length,
          premium: users.filter(u => ['core', 'premium', 'corporate'].includes(u.plan)).length,
        },
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
