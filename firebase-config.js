
// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, disableNetwork, enableNetwork } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfT1UFmoGSAanbIDTLYGeFfPE7uCa74Fw",
  authDomain: "nexchat-47326.firebaseapp.com",
  projectId: "nexchat-47326",
  storageBucket: "nexchat-47326.appspot.com",
  messagingSenderId: "327330605104",
  appId: "1:327330605104:web:ac43bb9adf7e4f1f1065f5",
  databaseURL: "https://nexchat-47326-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth, Firestore, Storage, and Realtime Database exports
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

// Enable network connection on startup
enableNetwork(db)
  .then(() => {
    console.log('✅ Firestore network enabled');
  })
  .catch((err) => {
    console.error('❌ Failed to enable Firestore network:', err);
  });

// Backwards-compatible global (some legacy code may rely on window.auth)
window.auth = auth;
window.db = db;
window.rtdb = rtdb;

// Expose enableNetwork and disableNetwork for debugging
window.enableFirestoreNetwork = () => enableNetwork(db);
window.disableFirestoreNetwork = () => disableNetwork(db);







