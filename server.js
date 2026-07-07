const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { validateEnv, getAllowedOrigins } = require('./config/env');

validateEnv();

const app = express();
app.set('trust proxy', 1);

// Security
app.use(helmet());
const allowedOrigins = getAllowedOrigins();
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));

// Raw body for Razorpay webhook signature verification
app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));

// Body parser (after webhook raw handler)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many auth attempts. Try after 15 minutes.' },
});
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many payment attempts. Try after 1 hour.' },
});
app.use('/api/', globalLimiter);

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const onboardingRoutes = require('./routes/onboarding');
const beliefRoutes = require('./routes/belief');
const behaviourRoutes = require('./routes/behaviour');
const patternRoutes = require('./routes/pattern');
const journalRoutes = require('./routes/journal');
const contentRoutes = require('./routes/content');
const wealthRoutes = require('./routes/wealth');
const resultRoutes = require('./routes/result');
const communityRoutes = require('./routes/community');
const subscriptionRoutes = require('./routes/subscription');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const tasksRoutes = require('./routes/tasks');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/belief', beliefRoutes);
app.use('/api/behaviour', behaviourRoutes);
app.use('/api/pattern', patternRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/wealth', wealthRoutes);
app.use('/api/result', resultRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/subscription/verify', paymentLimiter);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tasks', tasksRoutes);

// Plan expiry scheduler
const { runExpiryJob } = require('./middleware/planExpiry');
runExpiryJob();
setInterval(runExpiryJob, 60 * 60 * 1000);

// Health check
app.get('/', (req, res) => res.json({
  status: 'OK',
  app: 'ARISE API',
  version: '1.0.0',
}));

app.get('/health', (req, res) => res.json({
  status: 'OK',
  app: 'ARISE API',
  version: '1.0.0',
  routes: 15,
  uptime: Math.floor(process.uptime()),
}));

app.get('/favicon.ico', (req, res) => res.status(204).end());

// 404
app.use((req, res) => res.status(404).json({
  success: false,
  message: `Route ${req.method} ${req.path} not found`,
}));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ARISE API running on port ${PORT} - ${new Date().toISOString()}`);
});

module.exports = app;
