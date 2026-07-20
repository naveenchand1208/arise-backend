const express = require('express');
const router = express.Router();
const {
  socialLogin,
  logout,
  refreshToken,
  adminLogin
} = require('../controllers/authController');

// @route   POST /api/auth/google
// @desc    Login or create user with a Firebase Google identity
// @access  Public
router.post('/google', (req, res, next) => {
  req.params.provider = 'google';
  return socialLogin(req, res, next);
});

// @route   POST /api/auth/apple
// @desc    Login or create user with a Firebase Apple identity
// @access  Public
router.post('/apple', (req, res, next) => {
  req.params.provider = 'apple';
  return socialLogin(req, res, next);
});

// @route   POST /api/auth/social-login
// @desc    Login or create user with Firebase Google/Apple identity
// @access  Public
router.post('/social-login', socialLogin);

// Backward-compatible aliases for older app builds.
router.post('/googleSignUp', (req, res, next) => {
  req.params.provider = 'google';
  return socialLogin(req, res, next);
});
router.post('/googleLogin', (req, res, next) => {
  req.params.provider = 'google';
  return socialLogin(req, res, next);
});

// @route   POST /api/auth/logout
// @desc    Logout user (invalidate refresh token)
// @access  Public
router.post('/logout', logout);

// @route   POST /api/auth/refresh-token
// @desc    Get new access token using refresh token
// @access  Public
router.post('/refresh-token', refreshToken);

// @route   POST /api/auth/admin-login
// @desc    Admin panel login
// @access  Public
router.post('/admin-login', adminLogin);

module.exports = router;
