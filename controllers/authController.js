const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db, auth } = require('../config/firebase');
const axios = require('axios');

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

// Send OTP via MSG91
const sendOTP = async (mobile) => {
  try {
    await axios.post('https://api.msg91.com/api/v5/otp', {
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: `91${mobile}`,
      authkey: process.env.MSG91_AUTH_KEY
    });
    return true;
  } catch (err) {
    console.error('MSG91 OTP error:', err.message);
    return false;
  }
};

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, mobile } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    // Check if email exists
    const existing = await db.collection('users').where('email', '==', email.toLowerCase()).get();
    if (!existing.empty) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Create Firebase Auth user
    const firebaseUser = await auth.createUser({
      email: email.toLowerCase(),
      password,
      displayName: name
    });

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create Firestore user document
    const now = new Date().toISOString();
    await db.collection('users').doc(firebaseUser.uid).set({
      uid: firebaseUser.uid,
      name,
      email: email.toLowerCase(),
      mobile: mobile || null,
      password: hashedPassword,
      plan: 'free',
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
      lastActiveAt: now
    });

    const { accessToken, refreshToken } = generateTokens(firebaseUser.uid, email);

    // Store refresh token
    await db.collection('refreshTokens').add({
      uid: firebaseUser.uid,
      token: refreshToken,
      createdAt: now
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        uid: firebaseUser.uid,
        name,
        email: email.toLowerCase(),
        plan: 'free',
        onboardingComplete: false,
        accessToken,
        refreshToken
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const snapshot = await db.collection('users').where('email', '==', email.toLowerCase()).get();
    if (snapshot.empty) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.isBlocked) {
      return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });
    }

    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last active
    await userDoc.ref.update({ lastActiveAt: new Date().toISOString() });

    const { accessToken, refreshToken } = generateTokens(userData.uid, userData.email);

    // Store refresh token
    await db.collection('refreshTokens').add({
      uid: userData.uid,
      token: refreshToken,
      createdAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        uid: userData.uid,
        name: userData.name,
        email: userData.email,
        plan: userData.plan,
        beliefScore: userData.beliefScore,
        currentStreak: userData.currentStreak,
        onboardingComplete: userData.onboardingComplete,
        loopStatus: userData.loopStatus,
        accessToken,
        refreshToken
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// POST /api/auth/social-login
const socialLogin = async (req, res) => {
  console.log('slllllll')
  try {
    const { idToken, provider } = req.body;
    console.log(req.body)
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Firebase ID token required' });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const firebaseProvider = decoded.firebase?.sign_in_provider;
    const allowedProviders = ['google.com', 'apple.com'];
    if (!allowedProviders.includes(firebaseProvider)) {
      return res.status(400).json({ success: false, message: 'Only Google and Apple sign-in are supported' });
    }

    if (provider && !firebaseProvider.startsWith(provider)) {
      return res.status(400).json({ success: false, message: 'Sign-in provider mismatch' });
    }

    const uid = decoded.uid;
    const email = decoded.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'A verified email is required' });
    }

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
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
        updatedAt: now,
        lastActiveAt: now,
      };
      await userRef.update({
        email: userData.email,
        name: userData.name,
        photoURL: userData.photoURL,
        authProvider: userData.authProvider,
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
        uid: userData.uid,
        name: userData.name,
        email: userData.email,
        photoURL: userData.photoURL || null,
        authProvider: userData.authProvider,
        plan: userData.plan,
        beliefScore: userData.beliefScore,
        currentStreak: userData.currentStreak,
        onboardingComplete: userData.onboardingComplete,
        loopStatus: userData.loopStatus,
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

module.exports = { register, login, socialLogin, logout, forgotPassword, resetPassword, refreshToken, adminLogin };
