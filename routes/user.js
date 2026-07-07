const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

// GET /api/user/profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'User not found' });
    const { password, ...user } = doc.data();
    res.json({ success: true, data: user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/user/profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, mobile, bio } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (name) updates.name = name;
    if (mobile) updates.mobile = mobile;
    if (bio) updates.bio = bio;
    await db.collection('users').doc(req.user.uid).update(updates);
    res.json({ success: true, message: 'Profile updated' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/user/priorities
router.put('/priorities', verifyToken, async (req, res) => {
  try {
    const { priorities } = req.body; // ['Wealth','Health','Happiness']
    if (!Array.isArray(priorities) || priorities.length !== 3)
      return res.status(400).json({ success: false, message: 'Exactly 3 priorities required' });
    await db.collection('users').doc(req.user.uid).update({ priorities, updatedAt: new Date().toISOString() });
    res.json({ success: true, message: 'Priorities updated', data: { priorities } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/user/fcm-token
router.put('/fcm-token', verifyToken, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token required' });
    const doc = await db.collection('users').doc(req.user.uid).get();
    const existing = doc.data().fcmTokens || [];
    if (!existing.includes(token)) {
      await db.collection('users').doc(req.user.uid).update({ fcmTokens: [...existing, token] });
    }
    res.json({ success: true, message: 'FCM token registered' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/user/account
router.delete('/account', verifyToken, async (req, res) => {
  try {
    await db.collection('users').doc(req.user.uid).update({ isDeleted: true, deletedAt: new Date().toISOString() });
    res.json({ success: true, message: 'Account scheduled for deletion' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/user/stats
router.get('/stats', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.uid).get();
    const u = doc.data();
    res.json({ success: true, data: {
      beliefScore: u.beliefScore || 0,
      currentStreak: u.currentStreak || 0,
      longestStreak: u.longestStreak || 0,
      loopStatus: u.loopStatus || {},
      plan: u.plan,
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;

// PUT /api/user/settings — save ritual times + notification preferences
router.put('/settings', verifyToken, async (req, res) => {
  try {
    const {
      morningTime,    // '05:00'
      middayTime,     // '13:00'
      nightTime,      // '21:30'
      notifications,  // { ritualReminders, loopInsights, streakAlerts, community }
      language,       // 'en' | 'ta' | 'hi'
      backgroundMusic,
      voiceGuidance,
      appLock,
    } = req.body;

    const now = new Date().toISOString();
    const settings = {};

    if (morningTime) settings['settings.morningTime'] = morningTime;
    if (middayTime)  settings['settings.middayTime']  = middayTime;
    if (nightTime)   settings['settings.nightTime']   = nightTime;
    if (language)    settings['settings.language']    = language;
    if (backgroundMusic !== undefined) settings['settings.backgroundMusic'] = backgroundMusic;
    if (voiceGuidance   !== undefined) settings['settings.voiceGuidance']   = voiceGuidance;
    if (appLock         !== undefined) settings['settings.appLock']         = appLock;
    if (notifications)  settings['settings.notifications'] = notifications;

    settings.updatedAt = now;

    await db.collection('users').doc(req.user.uid).update(settings);

    // Save to dedicated settings collection for quick access
    await db.collection('userSettings').doc(req.user.uid).set({
      uid: req.user.uid,
      ritualTimes: {
        morning: morningTime || '05:00',
        midday:  middayTime  || '13:00',
        night:   nightTime   || '21:30',
      },
      notifications: notifications || {},
      preferences: { language, backgroundMusic, voiceGuidance, appLock },
      updatedAt: now,
    }, { merge: true });

    res.json({ success: true, message: 'Settings saved' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/user/settings
router.get('/settings', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('userSettings').doc(req.user.uid).get();
    if (!doc.exists) {
      return res.json({ success: true, data: {
        ritualTimes: { morning: '05:00', midday: '13:00', night: '21:30' },
        notifications: { ritualReminders: true, loopInsights: true, streakAlerts: true, community: true },
        preferences: { language: 'en', backgroundMusic: true, voiceGuidance: true, appLock: false },
      }});
    }
    res.json({ success: true, data: doc.data() });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
