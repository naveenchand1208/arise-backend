const admin = require('firebase-admin');
const { getFirebaseServiceAccountPath } = require('./env');

function getCredential() {
  try {
    return admin.credential.cert(require(getFirebaseServiceAccountPath()));
  } catch (fileError) {
    if (
      process.env.FIREBASE_PROJECT_ID
      && process.env.FIREBASE_PRIVATE_KEY
      && process.env.FIREBASE_CLIENT_EMAIL
    ) {
      return admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      });
    }

    throw fileError;
  }
}

try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: getCredential(),
    });
  }
} catch (err) {
  console.error('Firebase init failed:', err.message);
  throw err;
}

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();

module.exports = { admin, db, auth, messaging };
