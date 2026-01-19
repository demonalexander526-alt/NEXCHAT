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
import { setDoc, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// ===== RATE LIMITING =====
const loginAttempts = new Map(); // Track login attempts: email -> {count, timestamp}
const registerAttempts = new Map(); // Track registration attempts: ip -> {count, timestamp}

function checkRateLimit(identifier, type = 'login', maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  const record = (type === 'login' ? loginAttempts : registerAttempts).get(identifier);

  if (!record) {
    // First attempt
    (type === 'login' ? loginAttempts : registerAttempts).set(identifier, { count: 1, timestamp: now });
    return { allowed: true };
  }

  // Check if time window expired
  if (now - record.timestamp > windowMs) {
    // Reset the counter
    (type === 'login' ? loginAttempts : registerAttempts).set(identifier, { count: 1, timestamp: now });
    return { allowed: true };
  }

  // Within time window, check attempt count
  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      message: `Too many attempts. Please try again in ${Math.ceil((windowMs - (now - record.timestamp)) / 1000)} seconds.`
    };
  }

  // Increment and allow
  record.count++;
  return { allowed: true };
}

// ===== PASSWORD STRENGTH VALIDATION =====
function validatePassword(password) {
  const errors = [];

  // Check minimum length (8 characters)
  if (password.length < 8) {
    errors.push('at least 8 characters');
  }

  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    errors.push('at least one uppercase letter (A-Z)');
  }

  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    errors.push('at least one lowercase letter (a-z)');
  }

  // Check for numbers
  if (!/\d/.test(password)) {
    errors.push('at least one number (0-9)');
  }

  // Check for special characters
  if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)) {
    errors.push('at least one special character (!@#$%^&*, etc)');
  }

  // Check for common weak passwords
  const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'user'];
  if (commonPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push('use a less common password');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

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

// IP and VPN Detection function
async function detectIPAndVPN() {
  try {
    console.log("🔍 Detecting IP and VPN...");

    // Fetch IP data from free API
    const response = await fetch('https://ipapi.co/json/', { timeout: 5000 });
    const data = await response.json();

    const ipInfo = {
      ip: data.ip,
      country: data.country_name,
      city: data.city,
      isp: data.org,
      isVPN: data.is_vpn === true || data.org?.toLowerCase().includes('vpn'),
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone
    };

    console.log("📍 IP Info:", ipInfo);
    return ipInfo;
  } catch (err) {
    console.warn("⚠️ Could not detect IP:", err);
    return null;
  }
}

// Check if IP already registered
async function checkIPRegistration(ipAddress) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("registrationIP", "==", ipAddress));
    const snap = await getDocs(q);

    if (snap.docs.length > 0) {
      console.warn("⚠️ IP already registered!");
      return snap.docs.map(doc => doc.data().email);
    }
    return null;
  } catch (err) {
    console.warn("Could not check IP registration:", err);
    return null;
  }
}

// Helper to show result message
function showResult(msg, isError = false) {
  const el = document.getElementById('result');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#ff4d4d' : '#00ff66';
}

// REGISTER
const registerForm = document.getElementById('registerForm');
if (registerForm) {
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

    // Validate password strength
    const passwordValidation = validatePassword(pass);
    if (!passwordValidation.isValid) {
      const errorMsg = `❌ Password must have: ${passwordValidation.errors.join(', ')}`;
      showResult(errorMsg, true);
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

    // ===== RATE LIMIT CHECK =====
    const registerRateLimit = checkRateLimit(email, 'register', 3, 3600000); // 3 attempts per hour
    if (!registerRateLimit.allowed) {
      showResult(`❌ ${registerRateLimit.message}`, true);
      return;
    }

    try {
      showResult('⏳ Detecting your IP and VPN status...', false);

      // Get IP and VPN info
      const ipInfo = await detectIPAndVPN();

      // Check for VPN
      if (ipInfo && ipInfo.isVPN) {
        showResult('🔒 I CAN SEE YOU!! VPN detected - Registration blocked for security', true);
        console.warn("🚫 VPN detected, blocking registration");
        return;
      }

      // Check if IP already registered
      if (ipInfo) {
        const existingUsers = await checkIPRegistration(ipInfo.ip);
        if (existingUsers) {
          showResult(`🔒 I CAN SEE YOU!! This IP (${ipInfo.ip}) already has accounts: ${existingUsers.join(', ')}`, true);
          console.warn("🚫 Duplicate IP detected, blocking registration");
          return;
        }
      }

      showResult('⏳ Creating account...', false);

      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      console.log('✅ User created in Auth:', cred.user.uid);

      const randomSticker = getRandomSticker();

      showResult('⏳ Saving user data to database...', false);

      // ===== PUBLIC USER DATA (visible to other users) =====
      const userData = {
        email,
        name,
        username,
        tokens: 2000,
        createdAt: new Date().toISOString(),
        online: true,
        profilePic: randomSticker,
        profilePicUrl: randomSticker,
        uid: cred.user.uid,
        registrationTimestamp: new Date().toISOString(),
        // NOTE: IP, country, city, ISP removed from public profile for privacy
      };

      // ===== PRIVATE SECURITY DATA (server-side only - DO NOT expose in frontend) =====
      // Store sensitive data separately with restricted access rules
      const securityData = {
        email,
        uid: cred.user.uid,
        registrationIP: ipInfo?.ip || 'unknown',
        registrationCountry: ipInfo?.country || 'unknown',
        registrationCity: ipInfo?.city || 'unknown',
        registrationISP: ipInfo?.isp || 'unknown',
        registrationTimestamp: new Date().toISOString(),
        lastLoginIP: ipInfo?.ip || 'unknown',
        lastLoginTimestamp: new Date().toISOString(),
        loginAttempts: 0
      };

      // Add timeout to catch connection issues
      const savePromise = setDoc(doc(db, 'users', cred.user.uid), userData);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore write timeout - check your internet connection')), 10000)
      );

      await Promise.race([savePromise, timeoutPromise]);

      console.log('✅ User data saved successfully to Firestore:', cred.user.uid);
      console.log('📍 Registration IP:', ipInfo?.ip);

      // Save security data with restricted access in a separate collection
      try {
        await setDoc(doc(db, 'userSecurity', cred.user.uid), securityData);
        console.log('✅ Security data saved to separate collection');
      } catch (secErr) {
        console.warn('⚠️ Could not save security data:', secErr);
      }

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

    } catch (err) {
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
if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;

    // ===== RATE LIMIT CHECK (5 attempts per 15 minutes) =====
    const loginRateLimit = checkRateLimit(email, 'login', 5, 900000);
    if (!loginRateLimit.allowed) {
      showResult(`❌ ${loginRateLimit.message}`, true);
      return;
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      showResult('✅ Successfully signed in!');

      setTimeout(() => {
        location.href = 'chat.html';
      }, 700);
    } catch (err) {
      showResult(err.message, true);
    }
  });
}

// RESET
const resetForm = document.getElementById('resetForm');
if (resetForm) {
  resetForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value.trim();

    if (!email) {
      showResult('❌ Please enter your email address!', true);
      return;
    }

    try {
      // Simplest call: just send the email. 
      // Ensure 'index.html' is in your Authorized Domains in Firebase Console if using redirects,
      // but simpler is often better for troubleshooting.
      await sendPasswordResetEmail(auth, email);

      showResult('✅ Reset link sent! Check your email inbox (or spam folder).');

      // Clear the input after successful submission
      document.getElementById('resetEmail').value = '';

    } catch (err) {
      console.error("Reset Password Error:", err);
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
  if ((path.endsWith('index.html') || path.includes('login')) && !path.includes('profile') && !path.includes('chat')) {
    location.href = 'chat.html';
  }
});

// GOOGLE SIGN-IN
function initializeGoogleSignIn() {
  const container = document.getElementById('googleSignInContainer');
  if (!container) return;

  // Render a custom button that matches the design
  container.innerHTML = `
    <button type="button" id="googleLoginBtn" class="google-btn">
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width="18" height="18" style="margin-right: 8px;">
      Sign in with Google
    </button>
  `;

  document.getElementById('googleLoginBtn').addEventListener('click', async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      showResult('✅ Google Sign-in Successful!');

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: user.email,
          username: (user.displayName || 'User').split(' ')[0] + Math.floor(Math.random() * 1000),
          name: user.displayName || 'Google User',
          profilePic: user.photoURL,
          tokens: 2000,
          createdAt: new Date().toISOString(),
          online: true
        });
      }

      setTimeout(() => {
        location.href = 'chat.html';
      }, 1000);

    } catch (error) {
      console.error("Google Sign-in Error:", error);
      showResult(`❌ ${error.message}`, true);
    }
  });
}

// Remove the handleGoogleSignIn function as we are now using inline async handler
// but keep the init call
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeGoogleSignIn);
} else {
  initializeGoogleSignIn();
}


