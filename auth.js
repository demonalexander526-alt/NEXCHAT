import { auth, db, rtdb } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const randomStickers = [
  '😇', '😊', '😍', '🥰', '😘', '😙', '😚', '😗', '🤗', '🤩',
  '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '☺️', '🙂', '🤐',
  '👼', '💚', '💛', '💜', '💙', '❤️', '🧡', '💝', '💖', '💗',
  '👍', '✨', '🌟', '⭐', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇',
  '😈', '😠', '😡', '🤬', '😤', '😒', '🙁', '😕', '😔', '😞',
  '😢', '😭', '😫', '😩', '🥱', '😪', '😴', '😬', '🤥', '😳',
  '😨', '😰', '😥', '😓', '🤤', '😲', '😦', '😧', '🤯', '🤪',
  '💔', '💣', '⚡', '☠️', '💀', '🔥', '⛔', '🚫', '❌', '⚠️',
  '👿', '😈', '😹', '😾', '🐉', '🦗', '🐛', '🕷️', '🦂', '🦇',
  '🦑', '🐙', '🦈', '🐍', '🦖', '🦕', '🔱', '⚔️', '💀', '🦴',
  '🤔', '🤨', '😐', '😑', '🤠', '🥸', '😎', '🤓', '🧐', '😏',
  '😜', '😝', '😛', '🤑', '🤒', '🤕', '🤢', '🤮', '🤧', '🤨',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴',
  '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️',
  '👋', '👏', '🙌', '👐', '🤝', '🤲', '🤞', '🖖', '🤘', '🤟',
  '✊', '👊', '✌️', '🤞', '🫰', '🫱', '🫲', '💪', '🦿',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
  '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌', '💋',
  '🔥', '⚡', '✨', '💫', '⭐', '🌟', '💥', '💢', '💯', '🚀'
];

function getRandomSticker() {
  return randomStickers[Math.floor(Math.random() * randomStickers.length)];
}

// Helper to show result message
function showResult(msg, isError=false){
  const el = document.getElementById('result');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#ff4d4d' : '#00ff66';
}

// REGISTER
const registerForm = document.getElementById('registerForm');
if (registerForm){
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPassword').value;
    const passConfirm = document.getElementById('regPasswordConfirm').value;
    
    if (pass !== passConfirm) {
      showResult('❌ Passwords do not match!', true);
      return;
    }
    
    if (pass.length < 6) {
      showResult('❌ Password must be at least 6 characters!', true);
      return;
    }
    
    if (name.length < 2) {
      showResult('❌ Name must be at least 2 characters!', true);
      return;
    }

    if (username.length < 3) {
      showResult('❌ Username must be at least 3 characters!', true);
      return;
    }

    if (username.length > 20) {
      showResult('❌ Username must be 20 characters or less!', true);
      return;
    }
    
    try{
      showResult('⏳ Creating account...', false);
      
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      console.log('✅ User created in Auth:', cred.user.uid);

      const randomSticker = getRandomSticker();
      
      showResult('⏳ Saving user data to database...', false);

      const userData = {
        email,
        name,
        username,
        tokens: 2000,
        createdAt: new Date().toISOString(),
        online: true,
        profilePic: randomSticker,
        profilePicUrl: randomSticker,
        uid: cred.user.uid
      };

      // Add timeout to catch connection issues
      const savePromise = setDoc(doc(db, 'users', cred.user.uid), userData);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore write timeout - check your internet connection')), 10000)
      );
      
      await Promise.race([savePromise, timeoutPromise]);
      
      console.log('✅ User data saved successfully to Firestore:', cred.user.uid);
      
      // Also save to Realtime Database so you can see it there
      try {
        await set(ref(rtdb, 'users/' + cred.user.uid), userData);
        console.log('✅ User data also saved to Realtime Database:', cred.user.uid);
      } catch (rtdbErr) {
        console.warn('⚠️ Realtime Database save failed, but Firestore succeeded:', rtdbErr);
      }
      
      showResult('✅ Successfully registered! Redirecting...', false);

      setTimeout(() => {
        window.location.replace('profile-upload.html');
      }, 1500);

    }catch(err){
      console.error('❌ Registration error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      
      let userFriendlyMessage = err.message;
      
      if (err.code === 'auth/email-already-in-use') {
        userFriendlyMessage = '❌ This email is already registered. Please login or use a different email.';
      } else if (err.code === 'auth/invalid-email') {
        userFriendlyMessage = '❌ Invalid email address.';
      } else if (err.code === 'auth/weak-password') {
        userFriendlyMessage = '❌ Password is too weak. Use at least 6 characters.';
      } else if (err.code === 'auth/operation-not-allowed') {
        userFriendlyMessage = '❌ Registration is currently disabled. Try again later.';
      } else if (err.message && err.message.includes('Permission denied')) {
        userFriendlyMessage = '❌ Database Error: Permission denied. Check Firestore security rules in Firebase Console.';
      } else if (err.message && (err.message.includes('offline') || err.message.includes('timeout'))) {
        userFriendlyMessage = '❌ Network Error: Check your internet connection or Firestore security rules.';
      } else {
        userFriendlyMessage = '❌ Registration failed: ' + err.message;
      }
      
      showResult(userFriendlyMessage, true);
    }
  });
}

// LOGIN
const loginForm = document.getElementById('loginForm');
if (loginForm){
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
      try{
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        showResult('✅ Successfully signed in!');

        setTimeout(() => {
          location.href = 'chat.html';
        }, 700);
      }catch(err){
        showResult(err.message, true);
      }
  });
}

// RESET
const resetForm = document.getElementById('resetForm');
if (resetForm){
  resetForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value.trim();
    
    if (!email) {
      showResult('❌ Please enter your email address!', true);
      return;
    }

    try{
      // Configure action code settings for password reset
      const actionCodeSettings = {
        url: window.location.origin + '/index.html', // Redirect to login after reset
        handleCodeInApp: false // Open in default email client
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      showResult('✅ Reset link sent! Check your email inbox (or spam folder).');
      
      // Clear the input after successful submission
      document.getElementById('resetEmail').value = '';
      
    }catch(err){
      if (err.code === 'auth/user-not-found') {
        showResult('❌ No account found with this email address.', true);
      } else if (err.code === 'auth/invalid-email') {
        showResult('❌ Please enter a valid email address.', true);
      } else if (err.code === 'auth/too-many-requests') {
        showResult('❌ Too many requests. Please try again later.', true);
      } else {
        showResult(`❌ Error: ${err.message}`, true);
      }
    }
  });
}

onAuthStateChanged(auth, user => {
  if (!user) return;
  const path = location.pathname.toLowerCase();
  if ((path.endsWith('index.html') || path.includes('login')) && !path.includes('profile') && !path.includes('chat')){
    location.href = 'chat.html';
  }
});

// GOOGLE SIGN-IN
function initializeGoogleSignIn() {
  if (!window.google || !window.google.accounts) {
    console.warn('Google Sign-In not loaded yet');
    return;
  }

  const container = document.getElementById('googleSignInContainer');
  if (!container) return;

  window.google.accounts.id.initialize({
    client_id: '1054449935689-9p6g3sne8g6c0b5d3l2k6h1j9m8n7o0p.apps.googleusercontent.com',
    callback: handleGoogleSignIn
  });

  window.google.accounts.id.renderButton(
    container,
    {
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      width: 300
    }
  );
}

async function handleGoogleSignIn(response) {
  if (!response.credential) {
    showResult('❌ Google sign-in failed', true);
    return;
  }

  try {
    // Decode the JWT token to get user info
    const token = response.credential;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const userInfo = JSON.parse(jsonPayload);

    // Use signInWithCredential with GoogleAuthProvider
    const credential = GoogleAuthProvider.credential(token);
    const result = await signInWithCredential(auth, credential);
    const user = result.user;

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: user.email,
        gmail: user.email,
        username: userInfo.email.split('@')[0] + Math.floor(Math.random() * 1000),
        name: userInfo.name || user.displayName || 'Google User',
        displayName: userInfo.name || user.displayName,
        photoURL: userInfo.picture || user.photoURL,
        tokens: 2000,
        createdAt: new Date().toISOString(),
        signInMethod: 'google'
      });
    } else {
      await setDoc(userRef, {
        ...userDoc.data(),
        email: user.email,
        gmail: user.email,
        photoURL: userInfo.picture || user.photoURL || userDoc.data().photoURL,
        lastSignIn: new Date().toISOString(),
        signInMethod: 'google'
      }, { merge: true });
    }

    showResult('✅ Successfully signed in with Google!');
    setTimeout(() => {
      location.href = 'chat.html';
    }, 700);
  } catch (err) {
    console.error('Google sign-in error:', err);
    showResult(`❌ Sign-in failed: ${err.message}`, true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGoogleSignIn);
} else {
  initializeGoogleSignIn();
}
