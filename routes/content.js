const express = require('express');
const router = express.Router();
const { verifyToken, requirePremium } = require('../middleware/auth');
const { db } = require('../config/firebase');

// GET /api/content/meditations  — list meditations
router.get('/meditations', verifyToken, async (req, res) => {
  try {
    const { master, limit = 20 } = req.query;
    let query = db.collection('meditations').where('isActive', '==', true).limit(parseInt(limit));
    if (master) query = query.where('master', '==', master);
    const snap = await query.get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/content/breathwork
router.get('/breathwork', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('breathwork').where('isActive', '==', true).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/content/asana
router.get('/asana', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('asana').where('isActive', '==', true).get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/content/master-library  — premium only
router.get('/master-library', verifyToken, requirePremium, async (req, res) => {
  try {
    const { master, limit = 20 } = req.query;
    let query = db.collection('masterLibrary').where('isActive', '==', true).limit(parseInt(limit));
    if (master) query = query.where('master', '==', master);
    const snap = await query.get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/content/affirmations
router.get('/affirmations', verifyToken, async (req, res) => {
  try {
    const { category } = req.query; // wealth | health | general
    let query = db.collection('affirmations').where('isActive', '==', true);
    if (category) query = query.where('category', '==', category);
    const snap = await query.get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/content/log-play  — track content plays
router.post('/log-play', verifyToken, async (req, res) => {
  try {
    const { contentId, contentType, durationSeconds } = req.body;
    const now = new Date().toISOString();
    await db.collection('contentPlays').add({
      uid: req.user.uid, contentId, contentType, durationSeconds: durationSeconds || 0, createdAt: now,
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;

// GET /api/content/featured-today — daily recommended practice based on weakest loop layer
router.get('/featured-today', verifyToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const user = userDoc.data() || {};
    const loop = user.loopStatus || { belief: 0, behaviour: 0, pattern: 0, result: 0 };

    // Find weakest layer
    const sorted = Object.entries(loop).sort((a, b) => (a[1] || 0) - (b[1] || 0));
    const weakest = sorted[0][0]; // 'belief' | 'behaviour' | 'pattern' | 'result'

    // Layer → content type map
    const layerContentMap = {
      belief:    { type: 'meditation', master: 'Jose Silva',        tag: 'belief' },
      behaviour: { type: 'breathwork', master: 'Wim Hof',           tag: 'behaviour' },
      pattern:   { type: 'meditation', master: 'Joe Dispenza',       tag: 'pattern' },
      result:    { type: 'meditation', master: 'Neville Goddard',    tag: 'result' },
    };

    const config = layerContentMap[weakest] || layerContentMap.belief;

    // Try to get from Firestore content first
    let content = null;
    try {
      const snap = await db.collection(config.type === 'breathwork' ? 'breathwork' : 'meditations')
        .where('isActive', '==', true)
        .where('master', '==', config.master)
        .limit(1)
        .get();
      if (!snap.empty) content = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (_) {}

    // Fallback static featured content
    if (!content) {
      const fallbacks = {
        belief:    { id: 'silva_mirror', name: 'Mirror of the Mind', master: 'Jose Silva',     duration: '10 min', type: 'meditation', icon: '🔮', layer: 'belief' },
        behaviour: { id: 'wim_hof',      name: 'Wim Hof Power Breath', master: 'Wim Hof',     duration: '10 min', type: 'breathwork', icon: '❄️', layer: 'behaviour' },
        pattern:   { id: 'dispenza_el',  name: 'Elevated Emotion',   master: 'Joe Dispenza',   duration: '15 min', type: 'meditation', icon: '🧠', layer: 'pattern' },
        result:    { id: 'neville_sats', name: 'SATS Programming',   master: 'Neville Goddard',duration: '20 min', type: 'meditation', icon: '✨', layer: 'result' },
      };
      content = fallbacks[weakest];
    }

    res.json({
      success: true,
      data: {
        ...content,
        reason: `Your ${weakest} layer needs attention — this practice targets it directly.`,
        weakestLayer: weakest,
        loopStatus: loop,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
