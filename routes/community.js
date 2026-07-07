const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebase');

// GET /api/community/feed
router.get('/feed', verifyToken, async (req, res) => {
  try {
    const { limit = 20, after } = req.query;
    let query = db.collection('posts')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));
    if (after) query = query.startAfter(after);
    const snap = await query.get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/community/post  — create post
router.post('/post', verifyToken, async (req, res) => {
  try {
    const { text, tags } = req.body;
    if (!text || text.trim().length < 10) return res.status(400).json({ success: false, message: 'Post must be at least 10 characters' });
    const now = new Date().toISOString();
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const u = userDoc.data();
    const ref = await db.collection('posts').add({
      uid: req.user.uid,
      authorName: u.name,
      authorCity: u.city || '',
      authorStreak: u.currentStreak || 0,
      authorPlan: u.plan,
      text: text.trim(),
      tags: tags || [],
      likes: 0,
      comments: 0,
      status: 'pending', // goes to admin moderation
      createdAt: now,
    });
    res.status(201).json({ success: true, message: 'Post submitted for review', data: { id: ref.id } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/community/like/:postId
router.post('/like/:postId', verifyToken, async (req, res) => {
  try {
    const likeRef = db.collection('postLikes').doc(`${req.user.uid}_${req.params.postId}`);
    const likeDoc = await likeRef.get();
    const postRef = db.collection('posts').doc(req.params.postId);
    if (likeDoc.exists) {
      await likeRef.delete();
      await postRef.update({ likes: require('firebase-admin').firestore.FieldValue.increment(-1) });
      return res.json({ success: true, liked: false });
    }
    await likeRef.set({ uid: req.user.uid, postId: req.params.postId, createdAt: new Date().toISOString() });
    await postRef.update({ likes: require('firebase-admin').firestore.FieldValue.increment(1) });
    res.json({ success: true, liked: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/community/post/:postId
router.get('/post/:postId', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('posts').doc(req.params.postId).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Post not found' });
    const commentsSnap = await db.collection('comments').where('postId', '==', req.params.postId).orderBy('createdAt', 'asc').get();
    res.json({ success: true, data: { id: doc.id, ...doc.data(), comments: commentsSnap.docs.map(d => ({ id: d.id, ...d.data() })) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/community/comment/:postId
router.post('/comment/:postId', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Comment text required' });
    const now = new Date().toISOString();
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const ref = await db.collection('comments').add({
      postId: req.params.postId, uid: req.user.uid,
      authorName: userDoc.data().name, text: text.trim(), createdAt: now,
    });
    await db.collection('posts').doc(req.params.postId).update({
      comments: require('firebase-admin').firestore.FieldValue.increment(1),
    });
    res.status(201).json({ success: true, data: { id: ref.id } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;

// GET /api/community/trending — top posts by likes this week
router.get('/trending', verifyToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const snap = await db.collection('posts')
      .where('status', 'in', ['approved', 'featured'])
      .where('createdAt', '>=', weekAgo)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    // Sort by likes client-side (Firestore can't orderBy two fields without composite index)
    const posts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, parseInt(limit));

    res.json({ success: true, data: posts });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/community/explore — filter by tag/topic
router.get('/explore', verifyToken, async (req, res) => {
  try {
    const { tag, limit = 20 } = req.query;
    // tag: 'belief' | 'behaviour' | 'pattern' | 'wealth' | 'meditation' | 'sats' | 'shadow'
    let query = db.collection('posts')
      .where('status', 'in', ['approved', 'featured'])
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    if (tag) query = query.where('tags', 'array-contains', tag);

    const snap = await query.get();
    res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
