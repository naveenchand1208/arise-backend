const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, auth } = require('../config/firebase');

// Generate tokens
const generateTokens = (uid, email) => {
  const accessToken = jwt.sign({ uid, email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
  const refreshToken = jwt.sign({ uid, email }, process.env.JWT_SECRET + '_refresh', {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  });
  return { accessToken, refreshToken };
};

// POST /api/auth/google
// POST /api/auth/apple
const socialLogin = async (req, res) => {
  try {
    const { idToken, provider, role } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Firebase ID token required' });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const firebaseProvider = decoded.firebase?.sign_in_provider;
    const allowedProviders = ['google.com', 'apple.com'];
    if (!allowedProviders.includes(firebaseProvider)) {
      return res.status(400).json({ success: false, message: 'Only Google and Apple sign-in are supported' });
    }

    const requestedProvider = provider || req.params.provider;
    if (requestedProvider && !firebaseProvider.startsWith(requestedProvider)) {
      return res.status(400).json({ success: false, message: 'Sign-in provider mismatch' });
    }

    let uid = decoded.uid;
    const email = decoded.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'A verified email is required' });
    }

    let userRef = db.collection('users').doc(uid);
    let userDoc = await userRef.get();

    if (!userDoc.exists) {
      const emailSnapshot = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!emailSnapshot.empty) {
        userDoc = emailSnapshot.docs[0];
        userRef = userDoc.ref;
        uid = userDoc.id;
      }
    }

    const now = new Date().toISOString();
    let userData;

    if (userDoc.exists) {
      userData = userDoc.data();
      if (userData.isBlocked) {
        return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });
      }

      userData = {
        ...userData,
        uid,
        email,
        name: userData.name || decoded.name || email.split('@')[0],
        photoURL: decoded.picture || userData.photoURL || null,
        authProvider: firebaseProvider,
        role: userData.role || role || 'seeker',
        updatedAt: now,
        lastActiveAt: now,
      };
      await userRef.update({
        email: userData.email,
        name: userData.name,
        photoURL: userData.photoURL,
        authProvider: userData.authProvider,
        role: userData.role,
        updatedAt: userData.updatedAt,
        lastActiveAt: userData.lastActiveAt,
      });
    } else {
      userData = {
        uid,
        name: decoded.name || email.split('@')[0],
        email,
        mobile: null,
        photoURL: decoded.picture || null,
        authProvider: firebaseProvider,
        role: role || 'seeker',
        plan: 'free',
        planId: null,
        planExpiresAt: null,
        beliefScore: 0,
        currentStreak: 0,
        longestStreak: 0,
        loopStatus: { belief: 0, behaviour: 0, pattern: 0, result: 0 },
        onboardingComplete: false,
        isBlocked: false,
        fcmTokens: [],
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
      };
      await userRef.set(userData);
    }

    const { accessToken, refreshToken } = generateTokens(userData.uid, userData.email);
    await db.collection('refreshTokens').add({
      uid: userData.uid,
      token: refreshToken,
      createdAt: now,
    });

    res.json({
      success: true,
      message: userDoc.exists ? 'Login successful' : 'Account created successfully',
      data: {
        user: {
          id: userData.uid,
          uid: userData.uid,
          fullName: userData.name,
          name: userData.name,
          email: userData.email,
          photoURL: userData.photoURL || null,
          authProvider: userData.authProvider,
          role: userData.role || 'seeker',
          plan: userData.plan,
          beliefScore: userData.beliefScore,
          currentStreak: userData.currentStreak,
          onboardingComplete: userData.onboardingComplete,
          loopStatus: userData.loopStatus,
        },
        accessToken,
        refreshToken,
      }
    });
  } catch (err) {
    console.error('Social login error:', err);
    res.status(401).json({ success: false, message: 'Social sign-in failed' });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const snapshot = await db.collection('refreshTokens')
        .where('token', '==', refreshToken).get();
      snapshot.forEach(doc => doc.ref.delete());
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const snapshot = await db.collection('users').where('email', '==', email.toLowerCase()).get();

    // Always return success (don't reveal if email exists)
    if (!snapshot.empty) {
      await auth.generatePasswordResetLink(email.toLowerCase());
      // In production: send via SendGrid / MSG91 email
    }

    res.json({
      success: true,
      message: 'If this email is registered, a reset link has been sent.'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { oobCode, newPassword } = req.body;

    if (!oobCode || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset code and new password required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    // Firebase handles oobCode verification
    // After Firebase reset, update Firestore hashed password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    res.json({ success: true, message: 'Password reset successful. Please login.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
};

// POST /api/auth/refresh-token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET + '_refresh');

    // Verify token exists in DB
    const snapshot = await db.collection('refreshTokens').where('token', '==', token).get();
    if (snapshot.empty) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const { accessToken, refreshToken: newRefresh } = generateTokens(decoded.uid, decoded.email);

    // Rotate refresh token
    snapshot.forEach(doc => doc.ref.delete());
    await db.collection('refreshTokens').add({
      uid: decoded.uid,
      token: newRefresh,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      data: { accessToken, refreshToken: newRefresh }
    });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// POST /api/auth/admin-login (Admin panel only)
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const snapshot = await db.collection('admins').where('email', '==', email.toLowerCase()).get();
    if (snapshot.empty) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const adminData = snapshot.docs[0].data();
    const isMatch = await bcrypt.compare(password, adminData.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { uid: adminData.uid, email: adminData.email, role: adminData.role },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: '12h' }
    );

    // Audit log
    await db.collection('adminAuditLogs').add({
      adminId: adminData.uid,
      action: 'LOGIN',
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        uid: adminData.uid,
        name: adminData.name,
        email: adminData.email,
        role: adminData.role,
        token
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Admin login failed' });
  }
};

module.exports = { socialLogin, logout, refreshToken, adminLogin };
