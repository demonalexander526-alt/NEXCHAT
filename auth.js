import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { setDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Helper to show result message if element exists
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
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPassword').value;
    const passConfirm = document.getElementById('regPasswordConfirm').value;
    
    // Validate password match
    if (pass !== passConfirm) {
      showResult('❌ Passwords do not match!', true);
      return;
    }
    
    // Validate password strength
    if (pass.length < 6) {
      showResult('❌ Password must be at least 6 characters!', true);
      return;
    }
    
    // Validate name
    if (name.length < 2) {
      showResult('❌ Name must be at least 2 characters!', true);
      return;
    }
    
    try{
      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        name,
        tokens: 1000,
        createdAt: new Date().toISOString()
      });

      // ✅ SUCCESS MESSAGE
      showResult('✅ Successfully registered! Setting up your profile...');

      setTimeout(() => {
        location.href = 'profile-upload.html';
      }, 1500);

    }catch(err){
      showResult(err.message, true);
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

        // After sign in, check if user has completed profile (username/profilePic)
        const uid = cred.user.uid;
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          const data = userSnap.exists() ? userSnap.data() : {};
          const needsProfile = !data.username || !data.profilePic;
          setTimeout(() => {
            location.href = needsProfile ? 'profile-upload.html' : 'chat.html';
          }, 700);
        } catch (innerErr) {
          // Fallback to chat if DB check fails
          console.error('Error checking user profile:', innerErr);
          setTimeout(()=> location.href = 'chat.html', 700);
        }
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
      // Provide specific error messages
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

// If user is already signed in on login page, redirect straight to chat
onAuthStateChanged(auth, async user => {
  if (!user) return;
  const path = location.pathname.toLowerCase();
  // Only auto-redirect when on login/index pages (NOT on profile-upload or chat)
  if ((path.endsWith('index.html') || path.includes('login')) && !path.includes('profile') && !path.includes('chat')){
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const data = userSnap.exists() ? userSnap.data() : {};
      const needsProfile = !data.username || !data.profilePic;
      location.href = needsProfile ? 'profile-upload.html' : 'chat.html';
    } catch (err) {
      console.error('Auth redirect error:', err);
      location.href = 'chat.html';
    }
  }
});
