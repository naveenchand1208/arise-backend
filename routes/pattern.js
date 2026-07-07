const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

// POST /api/pattern/break  — log a pattern break
router.post('/break', verifyToken, async (req, res) => {
  try {
    const { patternBroken, oldLoop, icon } = req.body;
    if (!patternBroken) return res.status(400).json({ success: false, message: 'Pattern description required' });
    const now = new Date().toISOString();
    const ref = await db.collection('patternBreaks').add({
      uid: req.user.uid, patternBroken, oldLoop: oldLoop || '', icon: icon || '✅', createdAt: now,
    });
    // Update loopStatus.pattern
    const snap = await db.collection('patternBreaks').where('uid', '==', req.user.uid).get();
    const monthBreaks = snap.docs.filter(d => d.data().createdAt.startsWith(now.substring(0, 7))).length;
    const patternPct = Math.min(100, monthBreaks * 5);
    await db.collection('users').doc(req.user.uid).update({ 'loopStatus.pattern': patternPct, updatedAt: now });
    res.status(201).json({ success: true, message: 'Pattern break logged 🔁', data: { id: ref.id, monthBreaks } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/pattern/breaks
router.get('/breaks', verifyToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const snap = await db.collection('patternBreaks')
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit))
      .get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/pattern/challenge/join  — join 21/66/90 challenge
router.post('/challenge/join', verifyToken, async (req, res) => {
  try {
    const { days } = req.body; // 21 | 66 | 90
    if (![21, 66, 90].includes(days)) return res.status(400).json({ success: false, message: 'Days must be 21, 66, or 90' });
    const now = new Date().toISOString();
    const existing = await db.collection('challenges')
      .where('uid', '==', req.user.uid).where('days', '==', days).where('status', '==', 'active').get();
    if (!existing.empty) return res.status(409).json({ success: false, message: `Already in a ${days}-day challenge` });
    const ref = await db.collection('challenges').add({
      uid: req.user.uid, days, currentDay: 1, status: 'active',
      startDate: now.split('T')[0], lastCheckin: null, createdAt: now,
    });
    res.status(201).json({ success: true, message: `${days}-Day Challenge started!`, data: { id: ref.id } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/pattern/challenge/checkin  — daily challenge check-in
router.post('/challenge/checkin', verifyToken, async (req, res) => {
  try {
    const { challengeId } = req.body;
    if (!challengeId) return res.status(400).json({ success: false, message: 'Challenge ID required' });
    const ref = db.collection('challenges').doc(challengeId);
    const doc = await ref.get();
    if (!doc.exists || doc.data().uid !== req.user.uid) return res.status(404).json({ success: false, message: 'Challenge not found' });
    const data = doc.data();
    const now = new Date().toISOString();
    const today = now.split('T')[0];
    if (data.lastCheckin === today) return res.status(409).json({ success: false, message: 'Already checked in today' });
    const newDay = data.currentDay + 1;
    const status = newDay > data.days ? 'completed' : 'active';
    await ref.update({ currentDay: newDay, lastCheckin: today, status, updatedAt: now });
    res.json({ success: true, message: `Day ${newDay} checked in!`, data: { currentDay: newDay, status, days: data.days } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/pattern/challenges  — get user's active challenges
router.get('/challenges', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('challenges')
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/pattern/weekly-review
router.post('/weekly-review', verifyToken, async (req, res) => {
  try {
    const { loopRating, biggestWin, biggestChallenge, patternShift, nextWeekFocus } = req.body;
    const now = new Date().toISOString();
    const weekStart = getWeekStart(now);
    await db.collection('weeklyReviews').doc(`${req.user.uid}_${weekStart}`).set({
      uid: req.user.uid, loopRating: loopRating || {}, biggestWin: biggestWin || '',
      biggestChallenge: biggestChallenge || '', patternShift: patternShift || '',
      nextWeekFocus: nextWeekFocus || '', weekStart, createdAt: now,
    });
    res.json({ success: true, message: 'Weekly review saved' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

function getWeekStart(iso) {
  const d = new Date(iso);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

module.exports = router;

// ═══════════════════════════════════════════
// ENERGY VAMPIRES
// ═══════════════════════════════════════════

// GET /api/pattern/vampires
router.get('/vampires', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('energyVampires')
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/pattern/vampires
router.post('/vampires', verifyToken, async (req, res) => {
  try {
    const { name, type, drain, fix, icon } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name required' });
    if (drain < 1 || drain > 10) return res.status(400).json({ success: false, message: 'Drain must be 1–10' });
    const now = new Date().toISOString();
    const ref = await db.collection('energyVampires').add({
      uid: req.user.uid,
      name: name.trim(),
      type: type || 'Habit',         // Habit | Media | People | Environment
      drain: parseFloat(drain) || 5,
      fix: fix?.trim() || '',
      icon: icon || '🧛',
      dissolved: false,
      dissolvedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json({ success: true, data: { id: ref.id } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PATCH /api/pattern/vampires/:id — edit drain/fix or mark dissolved
router.patch('/vampires/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('energyVampires').doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid)
      return res.status(404).json({ success: false, message: 'Not found' });

    const { name, type, drain, fix, dissolved, icon } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (name !== undefined)      updates.name = name.trim();
    if (type !== undefined)      updates.type = type;
    if (drain !== undefined)     updates.drain = parseFloat(drain);
    if (fix !== undefined)       updates.fix = fix.trim();
    if (icon !== undefined)      updates.icon = icon;
    if (dissolved !== undefined) {
      updates.dissolved = dissolved;
      updates.dissolvedAt = dissolved ? new Date().toISOString() : null;
    }
    await doc.ref.update(updates);
    res.json({ success: true, message: 'Vampire updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/pattern/vampires/:id
router.delete('/vampires/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('energyVampires').doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid)
      return res.status(404).json({ success: false, message: 'Not found' });
    await doc.ref.delete();
    res.json({ success: true, message: 'Vampire removed' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ═══════════════════════════════════════════
// ENERGY SHIELDS
// ═══════════════════════════════════════════

// GET /api/pattern/shields/today — today's shield activations
router.get('/shields/today', verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const doc = await db.collection('energyShields').doc(`${req.user.uid}_${today}`).get();

    const defaultShields = [
      { id: 'morning_ritual',      icon: '🧘', name: 'Morning Ritual',     rule: 'Complete before checking phone', active: false },
      { id: 'phone_boundary',      icon: '📵', name: 'Phone Boundary',      rule: 'Off at 9PM. On after sunlight', active: false },
      { id: 'conversation_filter', icon: '🗣️', name: 'Conversation Filter', rule: 'No gossip, complaint or drama', active: false },
      { id: 'ambient_sound',       icon: '🌊', name: 'Ambient Sound',        rule: 'Work with nature sounds, not news', active: false },
      { id: 'movement_break',      icon: '🏃', name: 'Movement Break',       rule: 'Walk 10 min after 90 min of work', active: false },
      { id: 'gratitude_anchor',    icon: '🙏', name: 'Gratitude Anchor',     rule: '3 wins before negativity can land', active: false },
    ];

    if (!doc.exists) {
      // Load custom shields too
      const customSnap = await db.collection('customShields')
        .where('uid', '==', req.user.uid).get();
      const custom = customSnap.docs.map(d => ({ ...d.data(), id: d.id, active: false, isCustom: true }));
      return res.json({ success: true, data: { date: today, shields: [...defaultShields, ...custom], totalActive: 0 } });
    }

    const saved = doc.data();
    const activeIds = new Set(saved.activeIds || []);
    const shields = [...defaultShields, ...(saved.customShields || [])].map(s => ({
      ...s, active: activeIds.has(s.id),
    }));

    res.json({ success: true, data: { date: today, shields, totalActive: activeIds.size } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/pattern/shields/activate — toggle shield + add custom
router.post('/shields/activate', verifyToken, async (req, res) => {
  try {
    const { shieldId, active, customShield } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const ref = db.collection('energyShields').doc(`${req.user.uid}_${today}`);
    const doc = await ref.get();

    const existing = doc.exists ? doc.data() : { activeIds: [], customShields: [] };
    let activeIds = new Set(existing.activeIds || []);
    let customShields = existing.customShields || [];

    // Add custom shield
    if (customShield) {
      const newShield = { id: `custom_${Date.now()}`, icon: customShield.icon || '🛡️', name: customShield.name, rule: customShield.rule || '', isCustom: true };
      customShields = [...customShields, newShield];
      activeIds.add(newShield.id);
    }

    // Toggle existing shield
    if (shieldId) {
      active ? activeIds.add(shieldId) : activeIds.delete(shieldId);
    }

    const totalActive = activeIds.size;
    await ref.set({
      uid: req.user.uid, date: today,
      activeIds: Array.from(activeIds),
      customShields,
      totalActive,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Update pattern layer score based on shield strength
    const patternBoost = Math.min(100, totalActive * 15);
    await db.collection('users').doc(req.user.uid).update({
      'loopStatus.pattern': patternBoost,
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, data: { totalActive, shieldStrength: `${totalActive} of 6+ active` } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
