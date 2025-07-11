// src/config/firebase.ts
// Use Firebase Compat SDK for Expo Go compatibility
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAhzxsC3HzAuGeqiPbDx4CRl2DyEAzCkpk",
  authDomain: "notamy-90c4e.firebaseapp.com",
  projectId: "notamy-90c4e",
  storageBucket: "notamy-90c4e.firebasestorage.app",
  messagingSenderId: "1095505861301",
  appId: "1:1095505861301:web:70d00ff232d8248ac67cfc",
  databaseURL: "https://notamy-90c4e-default-rtdb.firebaseio.com",
  measurementId: "G-P3SXJFLNMP"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase initialized with Compat SDK');
} else {
  console.log('Firebase already initialized');
}

// Export services
export const auth = firebase.auth();
export const firestore = firebase.firestore();
export const database = firebase.database();

// Export aliases for compatibility
export const db = firestore;
export const rtdb = database;

// Export firebase instance
export { firebase };
export default firebase;