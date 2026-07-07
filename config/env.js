const fs = require('fs');
const path = require('path');

const requiredEnv = [
  'JWT_SECRET',
  'ADMIN_JWT_SECRET',
];

const firebaseEnvKeys = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
];

const firebaseServiceAccountPaths = [
  path.join(__dirname, 'service-account.json'),
  //path.join(__dirname, 'firebase-service-account.json'),
];

function getFirebaseServiceAccountPath() {
  return firebaseServiceAccountPaths.find((serviceAccountPath) => fs.existsSync(serviceAccountPath))
    || firebaseServiceAccountPaths[0];
}

function hasFirebaseServiceAccountFile() {
  return fs.existsSync(getFirebaseServiceAccountPath());
}

function validateEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);

  if (!hasFirebaseServiceAccountFile()) {
    const missingFirebaseEnv = firebaseEnvKeys.filter((key) => !process.env[key]);
    if (missingFirebaseEnv.length) {
      missing.push('config/service-account.json or Firebase env credentials');
    }
  }

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const placeholders = ['REPLACE_WITH', 'replace-with', 'your-'];
  const placeholderKeys = requiredEnv.filter((key) => {
    const value = process.env[key] || '';
    return placeholders.some((placeholder) => value.includes(placeholder));
  });

  if (placeholderKeys.length) {
    throw new Error(`Environment still contains placeholder values: ${placeholderKeys.join(', ')}`);
  }
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

module.exports = {
  validateEnv,
  getAllowedOrigins,
  getFirebaseServiceAccountPath,
};
