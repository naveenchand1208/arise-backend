const express = require('express');
const router = express.Router();
const {
  register,
  login,
  socialLogin,
  logout,
  forgotPassword,
  resetPassword,
  refreshToken,
  adminLogin
} = require('../controllers/authController');

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', login);

// @route   POST /api/auth/social-login
// @desc    Login or create user with Firebase Google/Apple identity
// @access  Public
router.post('/social-login', socialLogin);

// @route   POST /api/auth/logout
// @desc    Logout user (invalidate refresh token)
// @access  Public
router.post('/logout', logout);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password with oobCode
// @access  Public
router.post('/reset-password', resetPassword);

// @route   POST /api/auth/refresh-token
// @desc    Get new access token using refresh token
// @access  Public
router.post('/refresh-token', refreshToken);

// @route   POST /api/auth/admin-login
// @desc    Admin panel login
// @access  Public
router.post('/admin-login', adminLogin);

module.exports = router;
