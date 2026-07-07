const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');

// Verify user JWT
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists and is active
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const userData = userDoc.data();
    if (userData.isBlocked) {
      return res.status(403).json({ success: false, message: 'Account suspended' });
    }

    req.user = { uid: decoded.uid, email: decoded.email, plan: userData.plan };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Verify admin JWT
const verifyAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    const adminDoc = await db.collection('admins').doc(decoded.uid).get();
    if (!adminDoc.exists) {
      return res.status(403).json({ success: false, message: 'Admin access denied' });
    }

    req.admin = { uid: decoded.uid, email: decoded.email, role: adminDoc.data().role };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid admin token' });
  }
};

// Premium gate — block free users from premium features
const requirePremium = (req, res, next) => {
  if (req.user.plan === 'free') {
    return res.status(403).json({
      success: false,
      message: 'Premium feature',
      code: 'UPGRADE_REQUIRED',
      upgradeUrl: '/subscription'
    });
  }
  next();
};

module.exports = { verifyToken, verifyAdmin, requirePremium };
