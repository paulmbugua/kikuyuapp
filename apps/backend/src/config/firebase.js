// src/config/firebase.js
const admin = require('firebase-admin');
const config = require('./env');

// Initialize Firebase Admin SDK
let firebaseApp;

try {
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey
    })
  });
  
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  process.exit(1);
}

// Verify Firebase token
const verifyFirebaseToken = async (idToken) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      emailVerified: decodedToken.email_verified,
      firebase: decodedToken.firebase
    };
  } catch (error) {
    throw new Error(`Firebase token verification failed: ${error.message}`);
  }
};

// Get user by Firebase UID
const getFirebaseUser = async (uid) => {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord;
  } catch (error) {
    return null;
  }
};

// Create custom token (optional, for development)
const createCustomToken = async (uid) => {
  try {
    const customToken = await admin.auth().createCustomToken(uid);
    return customToken;
  } catch (error) {
    throw new Error(`Custom token creation failed: ${error.message}`);
  }
};

module.exports = {
  admin,
  firebaseApp,
  verifyFirebaseToken,
  getFirebaseUser,
  createCustomToken
};