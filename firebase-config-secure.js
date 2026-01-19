// ===== FIREBASE CONFIGURATION (SECURE VERSION WITH ENV VARS) =====
// This version uses environment variables instead of hardcoding credentials
// Create a .env.local file with your Firebase credentials (copy from .env.example)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// ===== CONFIGURATION WITH ENVIRONMENT VARIABLES =====
// If using Vite, these will be replaced at build time with actual values from .env.local
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// ===== FALLBACK FOR DEVELOPMENT (if env vars not set) =====
// Remove this in production - it's only for local development
if (!firebaseConfig.apiKey) {
  console.warn("⚠️ WARNING: Firebase environment variables not loaded. Make sure .env.local exists and contains VITE_FIREBASE_* variables");
  // You can optionally set a development config here, but it's better to use .env.local
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

// ===== NETWORK MANAGEMENT =====
// Enable/disable network based on connection status
let isNetworkEnabled = true;

export function disableNetwork() {
  isNetworkEnabled = false;
  console.log("🔴 Network disabled");
}

export function enableNetwork() {
  isNetworkEnabled = true;
  console.log("🟢 Network enabled");
}

export function isNetworkConnected() {
  return isNetworkEnabled && navigator.onLine;
}

// ===== EXPORTS =====
export { 
  auth, 
  db, 
  rtdb, 
  storage, 
  app,
  firebaseConfig
};

// ===== LEGACY GLOBAL REFERENCES =====
// These are for backward compatibility with existing code
// Ideally, you should use ES6 imports instead
if (typeof window !== 'undefined') {
  window.firebase = {
    auth,
    db,
    rtdb,
    storage
  };
}

console.log('✅ Firebase initialized with environment variables');
