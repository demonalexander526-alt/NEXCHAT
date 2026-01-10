import { auth, db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp, orderBy, signOut, increment
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { signOut as authSignOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import SecurityManager from "./security-manager.js";

// ======= SECURITY INITIALIZATION =======
const securityManager = new SecurityManager();
const csrfToken = securityManager.generateCSRFToken();

// ======= DOM ELEMENTS =======
const tokenCount = document.getElementById("tokenCount"); // May be null
const contactList = document.getElementById("contactList");
const messagesDiv = document.getElementById("messages");
const chatName = document.getElementById("chatName");
const messageText = document.getElementById("messageText");
const usernameSearch = document.getElementById("usernameSearch");
// Support multiple ID names (legacy + current)
const toggleDrawerBtn = document.getElementById("toggleDrawerBtn") || document.getElementById("toggleMenuBtn");
const closeDrawerBtn = document.getElementById("closeDrawerBtn") || document.getElementById("closeMenuBtn");
const contactsDrawer = document.getElementById("contactsDrawer") || document.getElementById("contactsSidebar");
const drawerOverlay = document.getElementById("drawerOverlay") || document.getElementById("menuOverlay");
const headerMenuBtn = document.getElementById("headerMenuBtn");
const headerMenu = document.getElementById("headerMenu"); // Updated to match new sidebar ID

// Sound and unread tracking
let soundEnabled = localStorage.getItem('nexchatSound') !== 'off';
const soundToggleBtn = document.getElementById('soundToggleBtn');
const unreadMap = new Map(); // track unread per user to detect increases

function updateSoundButton() {
  if (!soundToggleBtn) return;
  soundToggleBtn.textContent = soundEnabled ? '🔔' : '🔕';
  soundToggleBtn.classList.toggle('off', !soundEnabled);
}

if (soundToggleBtn) {
  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('nexchatSound', soundEnabled ? 'on' : 'off');
    updateSoundButton();
  });
}
updateSoundButton();
const chatProfilePic = document.getElementById("chatProfilePic");
const chatUserInfo = document.getElementById("chatUserInfo");
const emojiBtnElement = document.getElementById("emojiBtn");
const emojiPicker = document.getElementById("emojiPicker");
const emojiGrid = document.getElementById("emojiGrid");
const closeEmojiBtn = document.getElementById("closeEmojiBtn");

// ======= STATE VARIABLES =======
let currentChatUser = null;
let currentChatUsername = null;
let currentChatProfilePic = null;
let currentUserData = null;
let myTokens = 0;
let myUID = null;
let typingTimer = null;
let onlineStatusTimer = null;

// ======= EMOJI DATA =======
const emojis = [
  '😊', '😂', '😍', '🤔', '😎', '😢', '😡', '🤗',
  '😴', '🤐', '😷', '🤒', '🤕', '😳', '🥺', '😤',
  '❤️', '💔', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '🎉', '🎊', '🎈', '🎁', '🎀', '🎂', '🍰', '🎆',
  '👍', '👎', '✌️', '🤞', '🤟', '🤘', '🙏', '💪',
  '🔥', '⚡', '💥', '✨', '💫', '⭐', '🌟', '💢',
  '🎵', '🎶', '🎤', '🎸', '🎹', '🎺', '🎷', '🥁',
  '⚽', '🏀', '🏈', '🎾', '🏐', '🏉', '🥎', '🎯'
];

// ======= EMOJI PICKER INITIALIZATION =======
function initializeEmojiPicker() {
  // Populate emoji grid
  emojiGrid.innerHTML = emojis.map(emoji => 
    `<div class="emoji-item" data-emoji="${emoji}">${emoji}</div>`
  ).join('');

  // Event delegation for emoji clicks
  emojiGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-item')) {
      const emoji = e.target.getAttribute('data-emoji');
      messageText.value += emoji;
      messageText.focus();
      emojiPicker.style.display = 'none';
    }
  });

  // Emoji button click handler
  emojiBtnElement.addEventListener('click', (e) => {
    e.preventDefault();
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
  });

  // Close emoji picker button
  closeEmojiBtn.addEventListener('click', () => {
    emojiPicker.style.display = 'none';
  });

  // Close emoji picker when clicking outside
  document.addEventListener('click', (e) => {
    if (!emojiPicker.contains(e.target) && !emojiBtnElement.contains(e.target)) {
      emojiPicker.style.display = 'none';
    }
  });

  // Close emoji picker on message send
  document.getElementById("messageForm").addEventListener('submit', () => {
    emojiPicker.style.display = 'none';
  });
}

// ======= ONLINE STATUS TRACKING =======
function updateUserOnlineStatus(isOnline) {
  if (!myUID) return;
  
  const userStatusRef = doc(db, "userStatus", myUID);
  const statusData = {
    uid: myUID,
    isOnline: isOnline,
    lastSeen: serverTimestamp()
  };
  
  setDoc(userStatusRef, statusData, { merge: true }).catch(err => {
    console.error("Error updating online status:", err);
  });
}

// Update online status periodically
function startOnlineStatusUpdates() {
  updateUserOnlineStatus(true);
  onlineStatusTimer = setInterval(() => {
    updateUserOnlineStatus(true);
  }, 30000); // Update every 30 seconds
}

// Stop online status updates
function stopOnlineStatusUpdates() {
  if (onlineStatusTimer) clearInterval(onlineStatusTimer);
  updateUserOnlineStatus(false);
}

// ======= LISTEN TO ONLINE STATUS =======
function listenToUserStatus(userId) {
  if (!userId) return;
  
  const statusRef = doc(db, "userStatus", userId);
  
  return onSnapshot(statusRef, (snap) => {
    const statusElement = document.getElementById(`status-${userId}`);
    if (!statusElement) return;
    
    if (snap.exists()) {
      const data = snap.data();
      const isOnline = data.isOnline;
      
      if (isOnline) {
        statusElement.classList.add('online');
        statusElement.classList.remove('offline');
        statusElement.title = "Online now";
      } else {
        statusElement.classList.add('offline');
        statusElement.classList.remove('online');
        if (data.lastSeen) {
          const lastSeenTime = data.lastSeen.toDate();
          const timeStr = getTimeAgo(lastSeenTime);
          statusElement.title = `Last seen ${timeStr}`;
        }
      }
    }
  });
}

// ======= TIME UTILITIES =======
function getTimeAgo(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString();
}

// ======= NOTIFICATION SYSTEM =======
function showNotification(message, type = 'info') {
  // Create or get notification container
  let container = document.getElementById('notificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; max-width: 400px;';
    document.body.appendChild(container);
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: ${type === 'error' ? '#ff3366' : type === 'success' ? '#10b981' : '#00d4ff'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-weight: 500;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `;
  notification.textContent = message;
  
  container.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ======= VOICE NOTIFICATION =======
function playVoiceNotification(message = "You have an unread message") {
  // Use Web Speech API to create audio notification
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Speak the notification
    speechSynthesis.speak(utterance);
  } else {
    // Fallback: play a beep sound
    playNotificationBeep();
  }
}

// ======= NOTIFICATION BEEP SOUND =======
function playNotificationBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Frequency in Hz
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (err) {
    console.log('Beep sound not available:', err);
  }
}

// ======= ANDROID PUSH NOTIFICATIONS =======
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        localStorage.setItem('notificationPermission', 'granted');
      } else {
        console.log('❌ Notification permission denied');
        localStorage.setItem('notificationPermission', 'denied');
      }
    });
  }
}

function sendAndroidNotification(title, options = {}) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      icon: 'logo.jpg',
      badge: 'logo.jpg',
      tag: 'nexchat-notification',
      ...options
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    return notification;
  }
}

// ======= INITIALIZE NOTIFICATIONS ON PAGE LOAD =======
function initializeNotifications() {
  // Request notification permission on load if not already requested
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      requestNotificationPermission();
    }, 2000);
  }
}

// ======= MENU FUNCTIONALITY =======
// Toggle drawer (only if drawer elements exist)
if (toggleDrawerBtn && contactsDrawer) {
  toggleDrawerBtn.onclick = () => {
    contactsDrawer.classList.toggle('open');
  };
}

// Close drawer (only if drawer elements exist)
if (closeDrawerBtn && contactsDrawer) {
  closeDrawerBtn.onclick = () => {
    contactsDrawer.classList.remove('open');
  };
}

// Close drawer when clicking overlay (only if overlay exists)
if (drawerOverlay && contactsDrawer) {
  drawerOverlay.onclick = () => {
    contactsDrawer.classList.remove('open');
  };
}

// ======= HEADER MENU SIDEBAR - DEBUG =======
console.log('📌 Initializing header menu...');
console.log('headerMenuBtn:', headerMenuBtn);
console.log('headerMenu:', headerMenu);

// Toggle header menu sidebar
if (headerMenuBtn && headerMenu) {
  headerMenuBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('🔔 Menu button clicked');
    console.log('Before toggle, classes:', headerMenu.className);
    console.log('Before toggle, active:', headerMenu.classList.contains('active'));
    
    const isActive = headerMenu.classList.contains('active');
    
    if (isActive) {
      // Close menu
      headerMenu.style.right = '-400px';
      headerMenu.classList.remove('active');
    } else {
      // Open menu
      headerMenu.style.right = '0px';
      headerMenu.classList.add('active');
    }
    
    const overlay = document.getElementById('headerMenuOverlay');
    if (overlay) {
      if (isActive) {
        overlay.classList.remove('active');
      } else {
        overlay.classList.add('active');
      }
      console.log('Overlay toggled');
    }
    
    console.log('After toggle, classes:', headerMenu.className);
    console.log('After toggle, active:', headerMenu.classList.contains('active'));
    console.log('Menu right position:', window.getComputedStyle(headerMenu).right);
  };
  console.log('✅ Menu button click handler attached');
} else {
  console.error('❌ Menu button or menu not found!');
  console.error('headerMenuBtn is:', headerMenuBtn);
  console.error('headerMenu is:', headerMenu);
}

// Close menu sidebar when clicking close button
const closeHeaderMenuBtn = document.getElementById('closeHeaderMenuBtn');
if (closeHeaderMenuBtn) {
  closeHeaderMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    headerMenu.classList.remove('active');
    const overlay = document.getElementById('headerMenuOverlay');
    if (overlay) overlay.classList.remove('active');
    const creatorsMenu = document.getElementById('creatorsMenu');
    if (creatorsMenu) {
      creatorsMenu.style.display = 'none';
    }
  });
}

// Close menu when clicking overlay
const headerMenuOverlay = document.getElementById('headerMenuOverlay');
if (headerMenuOverlay) {
  headerMenuOverlay.addEventListener('click', (e) => {
    e.stopPropagation();
    headerMenu.classList.remove('active');
    headerMenuOverlay.classList.remove('active');
    const creatorsMenu = document.getElementById('creatorsMenu');
    if (creatorsMenu) {
      creatorsMenu.style.display = 'none';
    }
  });
}

// ======= SWIPE GESTURE SUPPORT FOR MOBILE/ANDROID =======
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', (e) => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}, false);

function handleSwipe() {
  const swipeThreshold = 50; // Minimum distance to trigger swipe
  const diff = touchStartX - touchEndX;
  
  // Swipe left to open menu (right edge swipe)
  if (diff > swipeThreshold && touchStartX > window.innerWidth - 80) {
    if (!headerMenu.classList.contains('active')) {
      headerMenu.classList.add('active');
      if (headerMenuOverlay) headerMenuOverlay.classList.add('active');
      console.log('Swipe left detected - Menu opened');
    }
  }
  
  // Swipe right to close menu (left edge swipe)
  if (diff < -swipeThreshold && headerMenu.classList.contains('active')) {
    headerMenu.classList.remove('active');
    if (headerMenuOverlay) headerMenuOverlay.classList.remove('active');
    const creatorsMenu = document.getElementById('creatorsMenu');
    if (creatorsMenu) creatorsMenu.style.display = 'none';
    console.log('Swipe right detected - Menu closed');
  }
}

// Close menus when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.drawer') && !e.target.closest('.drawer-toggle')) {
    contactsDrawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
  }
  if (!e.target.closest('.header-menu-sidebar') && !e.target.closest('.header-menu-btn') && !e.target.closest('.header-menu-overlay')) {
    headerMenu.classList.remove('active');
    headerMenuOverlay.classList.remove('active');
    // Reset creators submenu when menu closes
    const creatorsMenu = document.getElementById('creatorsMenu');
    if (creatorsMenu) {
      creatorsMenu.style.display = 'none';
    }
  }
});

document.getElementById("changeUsernameBtn").onclick = async () => {
  const newUsername = prompt("Enter new username (max 30 characters):");
  if (!newUsername || !newUsername.trim()) return;
  
  if (newUsername.length > 30) {
    alert("Username must be 30 characters or less!");
    return;
  }

  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { 
      username: newUsername.trim() 
    });
    alert("✅ Username updated successfully!");
    headerMenu.classList.remove('active');
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

document.getElementById("changeProfileBtn").onclick = () => {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          profilePic: event.target.result
        });
        alert("✅ Profile picture updated successfully!");
        headerMenu.classList.remove('active');
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  };
  fileInput.click();
};

document.getElementById("logoutBtn").onclick = async () => {
  headerMenu.classList.remove('active');
  if (confirm("Are you sure you want to logout?")) {
    try {
      stopOnlineStatusUpdates();
      await authSignOut(auth);
      location.href = "index.html";
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }
};

// ======= INITIALIZE USER =======
auth.onAuthStateChanged(async user => {
  if (!user) return location.href = "index.html";

  myUID = user.uid;
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await updateDoc(userRef, { tokens: 1000 });
    myTokens = 1000;
  } else {
    currentUserData = snap.data();
    myTokens = currentUserData.tokens ?? 1000;
  }

  if (tokenCount) tokenCount.textContent = myTokens;
  
  // Initialize emoji picker
  initializeEmojiPicker();
  
  // Initialize notifications
  initializeNotifications();
  // Start online status tracking
  startOnlineStatusUpdates();
  
  // Load contacts
  loadContacts();
  
  // Listen for user's own data changes
  onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      currentUserData = snap.data();
      myTokens = currentUserData.tokens ?? 1000;
      if (tokenCount) tokenCount.textContent = myTokens;
    }
  });

  // Listen for unread messages from any contact
  const messagesQuery = query(
    collection(db, 'messages'),
    where('to', '==', user.uid),
    where('read', '==', false)
  );
  
  onSnapshot(messagesQuery, async (snap) => {
    // Only notify for new documents (not initial load)
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const msg = change.doc.data();
        
        // Get sender info
        try {
          const senderRef = doc(db, 'users', msg.from);
          getDoc(senderRef).then((senderSnap) => {
            if (senderSnap.exists()) {
              const senderData = senderSnap.data();
              const senderName = senderData.username || senderData.email || 'Someone';
              
              // Only notify if not currently chatting with this person
              if (msg.from !== currentChatUser) {
                // Show toast notification
                showNotification(`💬 ${senderName}: New message`, 'success');
                
                // Play voice notification
                playVoiceNotification(`You have a new message from ${senderName}`);
                
                // Send Android notification
                sendAndroidNotification('☄️ NEXCHAT', {
                  body: `💬 ${senderName}: ${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}`,
                  tag: `message-${msg.from}`,
                  requireInteraction: false
                });
              }
            }
          });
        } catch (err) {
          console.error('Error getting sender info:', err);
        }
      }
    });
  });
});


// ======= LOAD CONTACTS WITH STATUS =======
function loadContacts() {
  onSnapshot(collection(db, "users"), async snap => {
    contactList.innerHTML = "";
    
    for (const d of snap.docs) {
      if (d.id === auth.currentUser.uid) continue;
      
      const c = d.data();
      const username = c.username || c.email || "Unknown";
      const profilePic = c.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%2300ff66'/%3E%3C/svg%3E";
      
      const li = document.createElement("li");
      li.setAttribute('data-id', d.id);
      li.setAttribute('data-username', username);
      li.setAttribute('data-profilepic', profilePic);
      li.className = "contact-item";

      li.innerHTML = `
        <div class="contact-avatar-wrapper">
          <img src="${escapeHtml(profilePic)}" alt="${escapeHtml(username)}" class="contact-avatar" />
          <div id="status-${d.id}" class="status-indicator offline"></div>
        </div>
        <div class="contact-preview">
          <div class="contact-meta">
            <div class="contact-name">${escapeHtml(username)}</div>
            <div class="contact-time" id="time-${d.id}"></div>
          </div>
          <div class="contact-last" id="last-${d.id}">No messages</div>
        </div>
      `;
      
      li.onclick = () => {
        openChat(d.id, username, profilePic, li);
        // Close sidebar when contact is selected on mobile
        const contactsSidebar = document.getElementById("contactsSidebar");
        if (contactsSidebar) {
          contactsSidebar.classList.remove('open');
        }
      };
      contactList.appendChild(li);
      
      // Listen to this user's online status
      listenToUserStatus(d.id);
      
      // Compute unread count
      try {
        const lastReadRef = doc(db, 'lastRead', `${auth.currentUser.uid}_${d.id}`);
        const lastReadSnap = await getDoc(lastReadRef);
        let qUnread;
        
        if (lastReadSnap.exists() && lastReadSnap.data().time) {
          qUnread = query(
            collection(db, 'messages'),
            where('from', '==', d.id),
            where('to', '==', auth.currentUser.uid),
            where('time', '>', lastReadSnap.data().time)
          );
        } else {
          qUnread = query(
            collection(db, 'messages'),
            where('from', '==', d.id),
            where('to', '==', auth.currentUser.uid)
          );
        }
        
        const res = await getDocs(qUnread);
        const unreadCount = res.size;
        
        if (unreadCount > 0) {
          const badge = document.createElement('span');
          badge.className = 'unread-badge';
          badge.textContent = unreadCount;
          li.querySelector('.contact-name').appendChild(badge);

          // Play a short beep when unread increases and sound enabled and not current chat
          const prev = unreadMap.get(d.id) || 0;
          if (unreadCount > prev && soundEnabled && d.id !== currentChatUser) {
            try { playNotificationBeep(); } catch(e) { console.error('Beep error', e); }
          }
          unreadMap.set(d.id, unreadCount);
        } else {
          unreadMap.set(d.id, 0);
        }
      } catch (err) {
        console.error("Error loading unread count:", err);
      }
    }
  });
}

// ======= OPEN CHAT =======
function openChat(uid, username, profilePic, element) {
  document.querySelectorAll(".contact").forEach(c => c.classList.remove("active"));
  if (element) element.classList.add("active");
  
  currentChatUser = uid;
  currentChatUsername = username;
  currentChatProfilePic = profilePic;
  
  chatName.textContent = escapeHtml(username);
  chatProfilePic.src = escapeHtml(profilePic);
  
  // Listen to chat user's online status
  listenToUserStatus(uid);
  
  loadMessages();
  
  // Close any open menu/modal if it exists
  const headerMenu = document.getElementById("headerMenu");
  if (headerMenu) headerMenu.classList.remove('active');
  
  // Mark as read
  setDoc(doc(db, 'lastRead', `${auth.currentUser.uid}_${currentChatUser}`), {
    chatWith: currentChatUser,
    time: serverTimestamp()
  });
}

// ======= LOAD MESSAGES WITH FORMATTING =======
// Track loaded message count to detect new messages
let previousMessageCount = 0;

function loadMessages() {
  messagesDiv.innerHTML = "";
  const q = query(collection(db, "messages"), orderBy("time", "asc"));
  
  let lastDateShown = null;
  let messageCount = 0;
  let hasNewIncomingMessage = false;
  let newMessageFrom = null;
  
  onSnapshot(q, snap => {
    messagesDiv.innerHTML = "";
    lastDateShown = null;
    messageCount = 0;
    hasNewIncomingMessage = false;
    
    snap.forEach(d => {
      const m = d.data();
      
      if (
        (m.from === auth.currentUser.uid && m.to === currentChatUser) ||
        (m.from === currentChatUser && m.to === auth.currentUser.uid)
      ) {
        messageCount++;
        
        // Check if this is a new incoming message
        if (m.from === currentChatUser && m.to === auth.currentUser.uid && messageCount > previousMessageCount && !m.read) {
          hasNewIncomingMessage = true;
          newMessageFrom = currentChatUsername;
        }
        
        // Show date separator if date changed
        const msgDate = m.time && m.time.toDate ? m.time.toDate() : new Date();
        const dateStr = formatDate(msgDate);
        
        if (lastDateShown !== dateStr) {
          const dateSeparator = document.createElement("div");
          dateSeparator.className = "date-separator";
          dateSeparator.textContent = dateStr;
          messagesDiv.appendChild(dateSeparator);
          lastDateShown = dateStr;
        }
        
        // Create message element
        const div = document.createElement("div");
        const isOwn = m.from === auth.currentUser.uid;
        div.className = "msg " + (isOwn ? "sent" : "received");
        
        const time = m.time && m.time.toDate ? m.time.toDate() : null;
        const timeStr = time ? formatTime(time) : '';
        
        // Add read receipt indicator for sent messages
        const readReceiptIcon = isOwn ? (m.read ? '✓✓' : '✓') : '';
        
        div.innerHTML = `
          <div class="msg-bubble">
            <div class="msg-text">${escapeHtml(m.text)}</div>
            <div class="msg-footer">
              <span class="msg-time">${timeStr}</span>
              ${readReceiptIcon ? `<span class="read-receipt">${readReceiptIcon}</span>` : ''}
            </div>
          </div>
        `;
        
        // Handle media messages (images, videos, audio)
        if (m.type === 'image' && m.image) {
          const msgBubble = div.querySelector('.msg-bubble');
          const mediaContainer = document.createElement('div');
          mediaContainer.style.marginTop = '8px';
          const img = document.createElement('img');
          img.src = m.image;
          img.alt = 'shared image';
          img.className = 'msg-image';
          img.style.cssText = 'max-width: 200px; border-radius: 8px; display: block;';
          mediaContainer.appendChild(img);
          msgBubble.insertBefore(mediaContainer, msgBubble.lastChild);
        } else if (m.type === 'video' && m.video) {
          const msgBubble = div.querySelector('.msg-bubble');
          const mediaContainer = document.createElement('div');
          mediaContainer.style.cssText = 'margin-top: 8px; position: relative; max-width: 250px;';
          const video = document.createElement('video');
          video.src = m.video;
          video.className = 'msg-video';
          video.style.cssText = 'width: 100%; height: auto; border-radius: 8px; background: #000; display: block; cursor: pointer;';
          video.controls = true;
          mediaContainer.appendChild(video);
          msgBubble.insertBefore(mediaContainer, msgBubble.lastChild);
        } else if (m.type === 'audio' && m.audio) {
          const msgBubble = div.querySelector('.msg-bubble');
          const mediaContainer = document.createElement('div');
          mediaContainer.style.cssText = 'margin-top: 8px;';
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.style.cssText = 'max-width: 100%; border-radius: 6px; display: block;';
          const source = document.createElement('source');
          source.src = m.audio;
          source.type = 'audio/webm';
          audio.appendChild(source);
          mediaContainer.appendChild(audio);
          msgBubble.insertBefore(mediaContainer, msgBubble.lastChild);
        }
        
        // Add delete button on hover for own messages
        if (isOwn) {
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'msg-delete-btn';
          deleteBtn.textContent = '✕';
          deleteBtn.onclick = () => deleteMessage(d.id);
          div.appendChild(deleteBtn);
        }
        
        messagesDiv.appendChild(div);
      }
    });
    
    // Trigger notifications for new incoming messages
    if (hasNewIncomingMessage && newMessageFrom) {
      // Show toast notification
      showNotification(`💬 New message from ${newMessageFrom}`, 'success');
      
      // Play voice notification
      playVoiceNotification(`You have an unread message from ${newMessageFrom}`);
      
      // Send Android notification
      sendAndroidNotification('☄️ NEXCHAT', {
        body: `💬 New message from ${newMessageFrom}`,
        tag: `message-${currentChatUser}`,
        requireInteraction: true
      });
    }
    
    // Update message count for next detection
    previousMessageCount = messageCount;
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });

  // Listen for typing indicator
  if (currentChatUser) {
    const typingDoc = doc(db, 'typing', `${currentChatUser}_${auth.currentUser.uid}`);
    onSnapshot(typingDoc, snap => {
      const typingIndicator = document.getElementById("typingIndicator");
      if (typingIndicator) {
        if (snap.exists() && snap.data().typing) {
          typingIndicator.style.display = 'flex';
          const typingText = typingIndicator.querySelector('.typing-text');
          if (typingText) {
            typingText.textContent = `${escapeHtml(currentChatUsername)} is typing...`;
          }
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        } else {
          typingIndicator.style.display = 'none';
        }
      }
    });
  }
}

// ======= DELETE MESSAGE =======
async function deleteMessage(messageId) {
  if (!confirm("Delete this message?")) return;
  
  try {
    await deleteDoc(doc(db, "messages", messageId));
  } catch (err) {
    alert(`Error deleting message: ${err.message}`);
  }
}

// ======= SEND MESSAGE WITH TOKEN LOGIC =======
const messageForm = document.getElementById("messageForm");
if (messageForm) {
  messageForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (!currentChatUser) {
      alert("Select a chat first!");
      return;
    }

    // Rate limiting check
    if (!canPerformAction('sendMessage')) {
      alert("⏱️ You're sending messages too fast. Please wait.");
      return;
    }

    const text = messageText.value.trim();
    if (!text) return;

    // Sanitize message to prevent XSS
    const sanitizedText = SecurityManager.sanitizeMessage(text);
    if (!SecurityManager.validateMessageLength(sanitizedText, 500)) {
      alert("Message too long or empty!");
      return;
    }

    // Calculate token cost
    let cost = sanitizedText.length > 160 ? 5 : 1;
    if (myTokens < cost) {
      alert(`Not enough ☄️NEX☄️! You have ${myTokens} but need ${cost}`);
      return;
    }

    try {
      // Add message
      const msgRef = await addDoc(collection(db, "messages"), {
        from: auth.currentUser.uid,
        to: currentChatUser,
        text: sanitizedText,
        time: serverTimestamp(),
        read: false
      });

      // Update tokens
      myTokens -= cost;
      if (tokenCount) tokenCount.textContent = myTokens;
      await updateDoc(doc(db, "users", auth.currentUser.uid), { 
        tokens: myTokens 
      });

      // Mark as read and clear typing flag
      await setDoc(doc(db, 'lastRead', `${auth.currentUser.uid}_${currentChatUser}`), {
        chatWith: currentChatUser,
        time: serverTimestamp()
      });
      
      await setDoc(doc(db, 'typing', `${auth.currentUser.uid}_${currentChatUser}`), {
        typing: false
      });

      messageText.value = "";
      messageText.focus();
    } catch (err) {
      alert(`Error sending message: ${err.message}`);
    }
  });
}

// ======= TYPING INDICATOR WITH DEBOUNCE =======
messageText.addEventListener('input', () => {
  if (!currentChatUser || !auth.currentUser) return;
  
  try {
    setDoc(doc(db, 'typing', `${auth.currentUser.uid}_${currentChatUser}`), {
      typing: true,
      username: currentUserData?.username || auth.currentUser.email,
      timestamp: serverTimestamp()
    });
    
    if (typingTimer) clearTimeout(typingTimer);
    
    typingTimer = setTimeout(() => {
      setDoc(doc(db, 'typing', `${auth.currentUser.uid}_${currentChatUser}`), {
        typing: false,
        timestamp: serverTimestamp()
      });
    }, 2000);
  } catch (err) {
    console.error('Error updating typing status:', err);
  }
});

// ======= EMAIL LOOKUP (search by registered Gmail/Email) =======
const searchBtn = document.getElementById("searchBtn");
if (searchBtn) {
  searchBtn.onclick = async () => {
    const email = usernameSearch.value.trim().toLowerCase();
    
    // Validate email format
    if (!email) {
      showNotification("❌ Please enter an email address", "error");
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showNotification("❌ Invalid email format!", "error");
      return;
    }

    try {
      // Search user by registered email
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        showNotification("❌ User not found with that email!", "error");
        return;
      }

      const d = snap.docs[0];
      const userData = d.data();
      const displayName = userData.username || userData.email || 'Unknown';
      const profilePic = userData.profilePic || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%2300ff66'/%3E%3C/svg%3E";
      const el = document.querySelector(`[data-id="${d.id}"]`);
      
      openChat(d.id, displayName, profilePic, el || null);
      showNotification(`✅ Chat opened with ${displayName}!`, "success");
      usernameSearch.value = "";
    } catch (err) {
      showNotification(`❌ Search error: ${err.message}`, "error");
      console.error("Search error:", err);
    }
  };
}

// ======= UTILITY FUNCTIONS =======
function escapeHtml(text) {
  // Use security manager's escape function
  return SecurityManager.escapeHtml(text);
}

// ======= RATE LIMITING FOR USER ACTIONS =======
function canPerformAction(action) {
  return securityManager.rateLimit(auth.currentUser?.uid + '_' + action, 30, 60000);
}

// ======= PAGE VISIBILITY - PAUSE ONLINE STATUS WHEN TAB NOT VISIBLE =======
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopOnlineStatusUpdates();
  } else {
    startOnlineStatusUpdates();
  }
});

// ======= CLEANUP ON PAGE UNLOAD =======
window.addEventListener('beforeunload', () => {
  stopOnlineStatusUpdates();
});

// Allow Enter key to send messages
messageText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById("messageForm").dispatchEvent(new Event('submit'));
  }
});

// ======= AUDIO RECORDING VARIABLES =======
let mediaRecorder = null;
let recordingChunks = [];
let recordingStartTime = null;
let recordingInterval = null;

// ======= IMAGE SHARING =======
document.getElementById("attachImageBtn").onclick = () => {
  document.getElementById("imageInput").click();
};

document.getElementById("imageInput").addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = document.getElementById("previewImage");
    img.src = event.target.result;
    document.getElementById("imagePreviewPanel").style.display = 'flex';
  };
  reader.readAsDataURL(file);
});

document.getElementById("sendImageBtn").onclick = async () => {
  const img = document.getElementById("previewImage");
  const imageData = img.src;
  
  if (!currentChatUser) {
    alert("Select a chat first!");
    return;
  }
  
  try {
    const cost = 2;
    if (myTokens < cost) {
      alert(`Not enough tokens! Need ${cost}, have ${myTokens}`);
      return;
    }
    
    await addDoc(collection(db, "messages"), {
      from: auth.currentUser.uid,
      to: currentChatUser,
      text: "[IMAGE]",
      image: imageData,
      type: "image",
      time: serverTimestamp(),
      read: false
    });
    
    myTokens -= cost;
    if (tokenCount) tokenCount.textContent = myTokens;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { tokens: myTokens });
    
    document.getElementById("imagePreviewPanel").style.display = 'none';
    document.getElementById("imageInput").value = '';
  } catch (err) {
    alert(`Error sending image: ${err.message}`);
  }
};

document.getElementById("cancelImageBtn").onclick = () => {
  document.getElementById("imagePreviewPanel").style.display = 'none';
  document.getElementById("imageInput").value = '';
};

// ======= VIDEO SHARING (WhatsApp-Style) =======
document.getElementById("attachVideoBtn").onclick = () => {
  document.getElementById("videoInput").click();
};

document.getElementById("videoInput").addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    alert("Video file too large! Maximum size is 50MB");
    document.getElementById("videoInput").value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (event) => {
    const video = document.getElementById("previewVideo");
    video.src = event.target.result;
    
    // Get video duration and file size
    video.addEventListener('loadedmetadata', () => {
      const duration = Math.floor(video.duration);
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      document.getElementById("videoDuration").textContent = 
        `Duration: ${mins}m ${secs}s`;
      
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
      document.getElementById("videoSize").textContent = 
        `Size: ${sizeInMB} MB`;
    }, { once: true });
    
    document.getElementById("videoPreviewPanel").style.display = 'flex';
  };
  reader.readAsDataURL(file);
});

document.getElementById("sendVideoBtn").onclick = async () => {
  const video = document.getElementById("previewVideo");
  const videoData = video.src;
  
  if (!currentChatUser) {
    alert("Select a chat first!");
    return;
  }
  
  try {
    const cost = 3; // Video costs more tokens
    if (myTokens < cost) {
      alert(`Not enough tokens! Need ${cost}, have ${myTokens}`);
      return;
    }
    
    await addDoc(collection(db, "messages"), {
      from: auth.currentUser.uid,
      to: currentChatUser,
      text: "[VIDEO]",
      video: videoData,
      type: "video",
      time: serverTimestamp(),
      read: false
    });
    
    myTokens -= cost;
    if (tokenCount) tokenCount.textContent = myTokens;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { tokens: myTokens });
    
    document.getElementById("videoPreviewPanel").style.display = 'none';
    document.getElementById("videoInput").value = '';
  } catch (err) {
    alert(`Error sending video: ${err.message}`);
  }
};

document.getElementById("cancelVideoBtn").onclick = () => {
  document.getElementById("videoPreviewPanel").style.display = 'none';
  document.getElementById("videoInput").value = '';
};

// ======= AUDIO RECORDING =======
document.getElementById("attachAudioBtn").onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordingChunks = [];
    recordingStartTime = Date.now();
    
    mediaRecorder.ondataavailable = (e) => recordingChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(recordingChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      document.getElementById("recordedAudio").src = audioUrl;
      document.getElementById("audioPlaybackPanel").style.display = 'flex';
    };
    
    mediaRecorder.start();
    document.getElementById("audioRecordingPanel").style.display = 'flex';
    
    // Update recording time
    recordingInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      document.getElementById("recordingTime").textContent = 
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 100);
    
  } catch (err) {
    alert(`Microphone error: ${err.message}`);
  }
};

document.getElementById("stopRecordBtn").onclick = () => {
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(t => t.stop());
  clearInterval(recordingInterval);
  document.getElementById("audioRecordingPanel").style.display = 'none';
};

document.getElementById("cancelRecordBtn").onclick = () => {
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach(t => t.stop());
  clearInterval(recordingInterval);
  document.getElementById("audioRecordingPanel").style.display = 'none';
  document.getElementById("audioPlaybackPanel").style.display = 'none';
  document.getElementById("recordedAudio").src = '';
};

document.getElementById("sendAudioBtn").onclick = async () => {
  if (!currentChatUser) {
    alert("Select a chat first!");
    return;
  }
  
  try {
    const audio = document.getElementById("recordedAudio");
    const audioData = audio.src;
    const cost = 3;
    
    if (myTokens < cost) {
      alert(`Not enough tokens! Need ${cost}, have ${myTokens}`);
      return;
    }
    
    await addDoc(collection(db, "messages"), {
      from: auth.currentUser.uid,
      to: currentChatUser,
      text: "[AUDIO]",
      audio: audioData,
      type: "audio",
      time: serverTimestamp(),
      read: false
    });
    
    myTokens -= cost;
    if (tokenCount) tokenCount.textContent = myTokens;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { tokens: myTokens });
    
    document.getElementById("audioPlaybackPanel").style.display = 'none';
    document.getElementById("recordedAudio").src = '';
  } catch (err) {
    alert(`Error sending audio: ${err.message}`);
  }
};

// ======= VOICE/VIDEO CALLS =======
document.getElementById("voiceCallMenuBtn").onclick = () => {
  if (!currentChatUser) {
    alert("Select a contact first!");
    return;
  }
  headerMenu.classList.remove('active');
  initiateCall("voice");
};

document.getElementById("videoCallMenuBtn").onclick = () => {
  if (!currentChatUser) {
    alert("Select a contact first!");
    return;
  }
  headerMenu.classList.remove('active');
  initiateCall("video");
};

function initiateCall(callType) {
  const callRef = doc(db, "calls", `${auth.currentUser.uid}_${currentChatUser}_${Date.now()}`);
  
  setDoc(callRef, {
    initiator: auth.currentUser.uid,
    receiver: currentChatUser,
    type: callType,
    status: "calling",
    startTime: serverTimestamp(),
    endTime: null
  });
  
  // Show call status
  const callStatus = document.getElementById("callStatus");
  document.getElementById("callType").textContent = callType === "voice" ? "📞 Voice Call" : "📹 Video Call";
  callStatus.style.display = 'flex';
}

document.getElementById("callEndBtn").onclick = () => {
  document.getElementById("callStatus").style.display = 'none';
  document.getElementById("callDuration").textContent = "00:00";
};

// ======= BLOCK USER FUNCTIONALITY =======
document.getElementById("blockUserMenuBtn").addEventListener("click", async () => {
  if (!currentChatUser) {
    alert("Select a chat first!");
    return;
  }
  headerMenu.classList.remove('active');

  if (!confirm(`Block ${currentChatUsername}? You won't see their messages.`)) return;

  try {
    await setDoc(doc(db, "blockedUsers", currentChatUser), {
      blockedAt: serverTimestamp(),
      blockedBy: auth.currentUser.uid,
      blockedUsername: currentChatUsername
    });

    alert(`✅ ${currentChatUsername} has been blocked!`);
    // Remove from contact list
    const contact = document.querySelector(`[data-id="${currentChatUser}"]`);
    if (contact) contact.style.opacity = "0.5";
  } catch (err) {
    alert(`Error blocking user: ${err.message}`);
  }
});

// ======= REPORT USER FUNCTIONALITY =======
document.getElementById("reportUserMenuBtn").addEventListener("click", () => {
  if (!currentChatUser) {
    alert("Select a chat first!");
    return;
  }
  headerMenu.classList.remove('active');
  document.getElementById("reportModal").style.display = "flex";
});

document.getElementById("reportForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentChatUser || !currentUserData) return;

  const reason = document.getElementById("reportReason").value;
  const details = document.getElementById("reportDetails").value;

  if (!reason) {
    alert("Please select a reason!");
    return;
  }

  try {
    await addDoc(collection(db, "reports"), {
      reporterId: auth.currentUser.uid,
      reporterName: currentUserData.username || "Unknown",
      reporterEmail: auth.currentUser.email,
      reportedUserId: currentChatUser,
      reportedUserEmail: currentChatUsername,
      reason: reason,
      details: details,
      status: "pending",
      createdAt: serverTimestamp()
    });

    alert("✅ Report submitted! Our admins will review it shortly.");
    document.getElementById("reportModal").style.display = "none";
    document.getElementById("reportForm").reset();
  } catch (err) {
    alert(`Error submitting report: ${err.message}`);
  }
});

// Close report modal on outside click
document.getElementById("reportModal").addEventListener("click", (e) => {
  if (e.target.id === "reportModal") {
    document.getElementById("reportModal").style.display = "none";
  }
});

// ======= MESSAGE REACTIONS =======
function addReactionToMessage(messageId, reaction) {
  const messageEl = document.querySelector(`[data-msg-id="${messageId}"]`);
  if (!messageEl) return;
  
  let reactionsEl = messageEl.querySelector('.message-reactions');
  if (!reactionsEl) {
    reactionsEl = document.createElement('div');
    reactionsEl.className = 'message-reactions';
    messageEl.appendChild(reactionsEl);
  }
  
  let reactionBadge = reactionsEl.querySelector(`[data-reaction="${reaction}"]`);
  if (!reactionBadge) {
    reactionBadge = document.createElement('div');
    reactionBadge.className = 'reaction-badge';
    reactionBadge.setAttribute('data-reaction', reaction);
    reactionBadge.innerHTML = `<span class="reaction-emoji">${reaction}</span><span class="reaction-count">1</span>`;
    reactionsEl.appendChild(reactionBadge);
  } else {
    const count = parseInt(reactionBadge.querySelector('.reaction-count').textContent) + 1;
    reactionBadge.querySelector('.reaction-count').textContent = count;
  }
}

document.querySelectorAll('.reaction-btn').forEach(btn => {
  btn.onclick = () => {
    const reaction = btn.getAttribute('data-reaction');
    const messageId = document.querySelector('[data-msg-id]')?.getAttribute('data-msg-id');
    if (messageId) {
      addReactionToMessage(messageId, reaction);
    }
    document.getElementById("reactionModal").style.display = 'none';
  };
});

// ======= SETTINGS MODAL =======
document.getElementById("settingsBtn").onclick = () => {
  headerMenu.classList.remove('active');
  document.getElementById("settingsModal").style.display = 'flex';
};

document.getElementById("closeSettingsBtn").onclick = () => {
  document.getElementById("settingsModal").style.display = 'none';
};

// ======= CREATORS TOGGLE =======
document.getElementById("creatorsToggleBtn").onclick = (e) => {
  e.stopPropagation();
  const creatorsMenu = document.getElementById("creatorsMenu");
  creatorsMenu.style.display = creatorsMenu.style.display === 'none' ? 'block' : 'none';
};

// Prevent creator links from closing the menu
const creatorLinks = document.querySelectorAll('.creator-link');
creatorLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.stopPropagation();
  });
});

// ======= EMOJI BUTTON =======
document.getElementById("emojiBtn").onclick = () => {
  const modal = document.getElementById("reactionModal");
  modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
};

// Close modals when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.settings-content') && !e.target.closest('#settingsBtn')) {
    document.getElementById("settingsModal").style.display = 'none';
  }
  if (!e.target.closest('.reaction-modal') && !e.target.closest('#emojiBtn')) {
    document.getElementById("reactionModal").style.display = 'none';
  }
});

// ======= ENHANCED MESSAGE LOADING WITH MEDIA SUPPORT =======
const originalLoadMessages = loadMessages.toString();

// Update loadMessages to handle images and audio
function handleMediaMessage(m, div, isOwn) {
  if (m.type === 'image' && m.image) {
    div.innerHTML = `<img src="${m.image}" alt="shared image" class="msg-image" style="max-width: 200px; border-radius: 8px; margin-bottom: 6px;">`;
  } else if (m.type === 'video' && m.video) {
    // WhatsApp-style video display with play button overlay
    const videoContainer = document.createElement('div');
    videoContainer.style.cssText = 'position: relative; max-width: 250px; margin-bottom: 6px;';
    
    const videoEl = document.createElement('video');
    videoEl.src = m.video;
    videoEl.className = 'msg-video';
    videoEl.style.cssText = 'width: 100%; height: auto; border-radius: 8px; background: #000; display: block;';
    videoEl.controls = true;
    
    videoContainer.appendChild(videoEl);
    div.appendChild(videoContainer);
  } else if (m.type === 'audio' && m.audio) {
    div.innerHTML = `<audio controls style="max-width: 100%; border-radius: 6px; margin-bottom: 6px;"><source src="${m.audio}" type="audio/webm"></audio>`;
  }
}

// ======= SETTINGS PERSISTENCE =======
document.getElementById("notificationToggle").addEventListener('change', (e) => {
  localStorage.setItem('notificationsEnabled', e.target.checked);
});

document.getElementById("soundToggle").addEventListener('change', (e) => {
  localStorage.setItem('soundEnabled', e.target.checked);
});

document.getElementById("darkModeToggle").addEventListener('change', (e) => {
  localStorage.setItem('darkMode', e.target.checked);
});

document.getElementById("autoPlayToggle").addEventListener('change', (e) => {
  localStorage.setItem('autoPlayAudio', e.target.checked);
});

// Load settings on init
window.addEventListener('load', () => {
  document.getElementById("notificationToggle").checked = localStorage.getItem('notificationsEnabled') !== 'false';
  document.getElementById("soundToggle").checked = localStorage.getItem('soundEnabled') !== 'false';
  document.getElementById("darkModeToggle").checked = localStorage.getItem('darkMode') !== 'false';
  document.getElementById("autoPlayToggle").checked = localStorage.getItem('autoPlayAudio') === 'true';
});

// ======= NEX_DEVELOPER DROPDOWN FUNCTIONALITY =======
const nexDeveloperSelect = document.getElementById("nexDeveloperSelect");
const nexDeveloperLink = document.getElementById("nexDeveloperLink");

if (nexDeveloperSelect) {
  nexDeveloperSelect.addEventListener('change', (e) => {
    const phoneNumber = e.target.value;
    if (phoneNumber) {
      const whatsappUrl = `https://wa.me/${phoneNumber}`;
      nexDeveloperLink.href = whatsappUrl;
      nexDeveloperLink.style.display = 'inline-block';
    } else {
      nexDeveloperLink.style.display = 'none';
    }
  });
}

// ======= REELS/STORIES FUNCTIONALITY =======

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tab}Tab`).classList.add('active');
  });
});

// Delegated tab switching (covers dynamically-added or missed elements)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.getAttribute('data-tab');
  if (!tab) return;

  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');

  // Update content panels
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  const panel = document.getElementById(`${tab}Tab`);
  if (panel) panel.classList.add('active');
});

// Sidebar navigation handlers (from added nav-list)
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    const nav = item.getAttribute('data-nav');
    switch (nav) {
      case 'chats':
      case 'livechat':
        // activate Messages tab
        const messagesTabBtn = document.querySelector('.tab-btn[data-tab="messages"]');
        if (messagesTabBtn) messagesTabBtn.click();
        break;
      case 'profile':
        // open profile upload/edit page
        window.location.href = 'profile-upload.html';
        break;
      case 'logout':
        if (confirm('Are you sure you want to logout?')) {
          try {
            stopOnlineStatusUpdates();
            authSignOut(auth).then(() => { window.location.href = 'index.html'; });
          } catch (err) {
            console.error('Logout error', err);
          }
        }
        break;
      case 'users':
        // focus contacts list
        const usersBtn = document.querySelector('.tab-btn[data-tab="messages"]');
        if (usersBtn) usersBtn.click();
        showNotification('Showing contacts', 'success');
        break;
      case 'uploads':
        showPlaceholderModal('Uploads', '<p>Upload center coming soon.</p>');
        break;
      case 'market':
        showPlaceholderModal('Market', '<p>Market integration coming soon.</p>');
        break;
      case 'bank':
        showPlaceholderModal('Bank', '<p>Bank features coming soon.</p>');
        break;
      case 'settings':
        // Open settings modal if exists
        const settingsModal = document.getElementById('settingsModal');
        if (settingsModal) settingsModal.style.display = 'flex';
        break;
      default:
        showNotification('This section is not implemented in the demo yet', 'info');
        break;
    }
  });
});

// Placeholder modal helper
function showPlaceholderModal(title, html) {
  let modal = document.getElementById('placeholderModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'placeholderModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header"><h3 id="phTitle">${title}</h3><button id="phClose" class="close-btn">✕</button></div>
        <div class="modal-body" id="phBody">${html}</div>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('phClose').addEventListener('click', () => modal.style.display = 'none');
  } else {
    modal.style.display = 'flex';
    document.getElementById('phTitle').textContent = title;
    document.getElementById('phBody').innerHTML = html;
  }
}

// ======= INITIALIZE ALL BUTTON HANDLERS =======
const createReelBtn = document.getElementById('createReelBtn');
const createReelModal = document.getElementById('createReelModal');
const closeCreateReelBtn = document.getElementById('closeCreateReelBtn');
const cancelReelBtn = document.getElementById('cancelReelBtn');
const reelUploadArea = document.getElementById('reelUploadArea');
const reelVideoInput = document.getElementById('reelVideoInput');
const uploadReelBtn = document.getElementById('uploadReelBtn');
const reelPreviewPanel = document.getElementById('reelPreviewPanel');
const reelVideoPreview = document.getElementById('reelVideoPreview');
const reelCaption = document.getElementById('reelCaption');
const reelPublic = document.getElementById('reelPublic');

if (createReelBtn) {
  createReelBtn.addEventListener('click', () => {
    createReelModal.style.display = 'flex';
  });
}

[closeCreateReelBtn, cancelReelBtn].forEach(btn => {
  if (btn) {
    btn.addEventListener('click', () => {
      createReelModal.style.display = 'none';
      reelVideoInput.value = '';
      reelCaption.value = '';
      reelPreviewPanel.style.display = 'none';
      uploadReelBtn.style.display = 'none';
    });
  }
});

// Upload area click & drag
if (reelUploadArea) {
  reelUploadArea.addEventListener('click', () => reelVideoInput.click());
  
  ['dragover', 'dragenter'].forEach(event => {
    reelUploadArea.addEventListener(event, (e) => {
      e.preventDefault();
      reelUploadArea.style.borderColor = '#00ff66';
      reelUploadArea.style.background = 'rgba(0, 255, 102, 0.15)';
    });
  });
  
  ['dragleave', 'drop'].forEach(event => {
    reelUploadArea.addEventListener(event, (e) => {
      e.preventDefault();
      reelUploadArea.style.borderColor = '';
      reelUploadArea.style.background = '';
    });
  });
  
  reelUploadArea.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      reelVideoInput.files = files;
      handleReelVideoSelect();
    }
  });
}

// Video file selection
if (reelVideoInput) {
  reelVideoInput.addEventListener('change', handleReelVideoSelect);
}

function handleReelVideoSelect() {
  const file = reelVideoInput.files[0];
  if (!file) return;
  
  // Validate file size (50MB max)
  if (file.size > 50 * 1024 * 1024) {
    showNotification('❌ Video too large! Max 50MB', 'error');
    reelVideoInput.value = '';
    return;
  }
  
  // Validate video type
  if (!file.type.startsWith('video/')) {
    showNotification('❌ Please select a valid video file', 'error');
    reelVideoInput.value = '';
    return;
  }
  
  // Show preview
  const url = URL.createObjectURL(file);
  reelVideoPreview.src = url;
  reelPreviewPanel.style.display = 'block';
  uploadReelBtn.style.display = 'block';
}

// Upload reel
if (uploadReelBtn) {
  uploadReelBtn.addEventListener('click', async () => {
    const file = reelVideoInput.files[0];
    if (!file) return;
    
    if (!auth.currentUser) {
      showNotification('❌ Please sign in first', 'error');
      return;
    }
    
    uploadReelBtn.disabled = true;
    uploadReelBtn.textContent = '⏳ Uploading...';
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const videoData = e.target.result;
          
          // Get current user profile
          const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          const userData = userSnap.data() || {};
          
          // Generate thumbnail (first frame)
          const video = reelVideoPreview;
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          const thumbnail = canvas.toDataURL('image/jpeg');
          
          // Save reel to Firebase
          await addDoc(collection(db, 'reels'), {
            userId: auth.currentUser.uid,
            username: userData.username || userData.email,
            caption: reelCaption.value.trim(),
            videoData,
            thumbnail,
            profilePic: userData.profilePic || '',
            public: reelPublic.checked,
            likes: 0,
            comments: [],
            createdAt: serverTimestamp(),
            views: 0
          });
          
          showNotification('✅ Reel uploaded successfully!', 'success');
          
          // Reset and close
          createReelModal.style.display = 'none';
          reelVideoInput.value = '';
          reelCaption.value = '';
          reelPreviewPanel.style.display = 'none';
          uploadReelBtn.style.display = 'none';
          
          // Reload reels
          loadReels();
        } catch (err) {
          showNotification(`❌ Error uploading: ${err.message}`, 'error');
          console.error('Upload error:', err);
        } finally {
          uploadReelBtn.disabled = false;
          uploadReelBtn.textContent = '📤 Upload';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      showNotification(`❌ Error: ${err.message}`, 'error');
      uploadReelBtn.disabled = false;
      uploadReelBtn.textContent = '📤 Upload';
    }
  });
}

// Load reels
async function loadReels() {
  const reelsFeed = document.getElementById('reelsFeed');
  if (!reelsFeed) return;
  
  try {
    const q = query(collection(db, 'reels'), where('public', '==', true), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      reelsFeed.innerHTML = `
        <div class="empty-reels">
          <div class="empty-icon">🎬</div>
          <p>No reels yet. Create one to get started!</p>
        </div>
      `;
      return;
    }
    
    reelsFeed.innerHTML = '';
    snap.docs.forEach(doc => {
      const reel = doc.data();
      const reelCard = document.createElement('div');
      reelCard.className = 'reel-card';
      reelCard.innerHTML = `
        <img src="${reel.thumbnail}" alt="reel" class="reel-thumbnail" />
        <div class="reel-overlay">
          <div class="reel-username">@${reel.username}</div>
          <div class="reel-caption">${securityManager.escapeHtml(reel.caption || '')}</div>
        </div>
        <div class="reel-play-icon">▶️</div>
      `;
      
      reelCard.addEventListener('click', () => {
        viewReel(doc.id, reel);
      });
      
      reelsFeed.appendChild(reelCard);
    });
  } catch (err) {
    console.error('Error loading reels:', err);
  }
}

// View reel (placeholder - can be expanded)
function viewReel(reelId, reelData) {
  showNotification(`📹 Viewing reel by @${reelData.username}`, 'success');
  // Expanded viewer can be added here
}

// Load reels on page load
if (document.getElementById('reelsFeed')) {
  loadReels();
}

// ======= INITIALIZE ALL BUTTON HANDLERS =======
document.addEventListener('DOMContentLoaded', () => {
  if (typeof soundEnabled === 'undefined') window.soundEnabled = true;

  // Sidebar nav items (left menu) - using data-action attributes
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = btn.dataset.action;
      if (!action) return;

      if (action === 'chats' || action === 'livechat') {
        document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        const messagesTab = document.querySelector('.tab-btn[data-tab="messages"]');
        if (messagesTab) messagesTab.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
        const messagesSection = document.getElementById('messagesSection');
        if (messagesSection) messagesSection.classList.add('active');
      }

      if (action === 'profile') {
        window.location.href = 'profile-upload.html';
      }

      if (action === 'watch-reels') {
        window.location.href = 'reels-watch.html';
      }

      if (action === 'logout') {
        if (typeof signOut === 'function' && window.auth) {
          signOut(auth).then(() => window.location.href = 'index.html').catch(() => window.location.href = 'index.html');
        } else {
          window.location.href = 'index.html';
        }
      }

      // Show placeholder modals for other actions
      if (['uploads', 'users', 'bank', 'settings'].includes(action)) {
        const title = {
          uploads: '📤 Uploads',
          users: '👥 Users',
          bank: '🏦 Bank',
          settings: '⚙️ Settings'
        }[action];
        showNotification(`${title} feature coming soon!`, 'info');
      }
    });
  });

  // Delegated tab switching - reels and messages tabs
  const handleTabClick = (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const target = btn.dataset.tab;
    if (!target) return;
    
    // Reels tab navigates to dedicated reels page
    if (target === 'reels') {
      console.log('Redirecting to reels.html');
      window.location.href = 'reels.html';
      return;
    }
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(`${target}Section`);
    if (sec) sec.classList.add('active');
  };
  
  document.addEventListener('click', handleTabClick);

  // Search drawer handlers
  const openSearchBtn = document.getElementById('openSearchBtn');
  const closeSearchBtn = document.getElementById('closeSearchBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchDrawer = document.getElementById('searchDrawer');
  const searchBtn = document.getElementById('searchBtn');
  const searchStartChatBtn = document.getElementById('searchStartChatBtn');
  
  if (openSearchBtn) {
    openSearchBtn.onclick = () => {
      if (searchDrawer) searchDrawer.classList.add('open');
      if (searchOverlay) searchOverlay.style.display = 'block';
      const searchInput = document.getElementById('usernameSearch');
      if (searchInput) searchInput.focus();
    };
  }
  
  if (closeSearchBtn) {
    closeSearchBtn.onclick = () => {
      if (searchDrawer) searchDrawer.classList.remove('open');
      if (searchOverlay) searchOverlay.style.display = 'none';
    };
  }
  
  if (searchOverlay) {
    searchOverlay.onclick = () => {
      if (searchDrawer) searchDrawer.classList.remove('open');
      searchOverlay.style.display = 'none';
    };
  }

  // Search button - search for user by email
  if (searchBtn) {
    searchBtn.onclick = async () => {
      const email = document.getElementById('usernameSearch')?.value.trim().toLowerCase();
      if (!email) {
        alert('Please enter an email address');
        return;
      }
      
      try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          alert('User not found');
          return;
        }
        
        const userData = snap.docs[0].data();
        const userId = snap.docs[0].id;
        
        // Start chat with the found user
        currentChatUser = userId;
        currentChatUsername = userData.username || 'User';
        currentChatProfilePic = userData.profilePic || '';
        
        // Update header
        if (chatName) chatName.textContent = currentChatUsername;
        if (chatProfilePic) chatProfilePic.src = currentChatProfilePic;
        
        // Load messages
        loadMessages(userId);
        
        // Close drawer
        if (searchDrawer) searchDrawer.classList.remove('open');
        if (searchOverlay) searchOverlay.style.display = 'none';
        document.getElementById('usernameSearch').value = '';
      } catch (err) {
        console.error('Search error:', err);
        alert('Error searching for user');
      }
    };
  }

  // Open Chat button - triggers search
  if (searchStartChatBtn) {
    searchStartChatBtn.onclick = () => {
      if (searchBtn) searchBtn.click();
    };
  }

  // Sound toggle
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) {
    soundBtn.onclick = () => {
      window.soundEnabled = !window.soundEnabled;
      soundBtn.classList.toggle('disabled', !window.soundEnabled);
      soundBtn.textContent = window.soundEnabled ? '🔔' : '🔕';
    };
  }

  // Hamburger menu toggle
  const toggleBtn = document.getElementById('toggleMenuBtn');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const sidebar = document.getElementById('contactsSidebar');
      if (sidebar) sidebar.classList.toggle('open');
    };
  }

  // Back button handler
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.onclick = () => {
      currentChatUser = null;
      currentChatUsername = null;
      messagesDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>Select a chat to start messaging</p>
        </div>
      `;
      chatName.textContent = 'Select a chat';
      chatProfilePic.src = '';
      document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
      
      if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('contactsSidebar');
        if (sidebar) sidebar.classList.remove('open');
      }
    };
  }

  // Direct Reels button handler (backup)
  const reelsBtn = document.querySelector('.tab-btn[data-tab="reels"]');
  if (reelsBtn) {
    reelsBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = 'reels.html';
    };
  }

  // Voice call button
  const callBtn = document.getElementById('callBtn');
  if (callBtn) {
    callBtn.onclick = () => {
      if (!currentChatUser) {
        alert('Select a contact first!');
        return;
      }
      initiateCall('voice');
    };
  }

  // Video call button
  const videoCallBtn = document.getElementById('videoCallBtn');
  if (videoCallBtn) {
    videoCallBtn.onclick = () => {
      if (!currentChatUser) {
        alert('Select a contact first!');
        return;
      }
      initiateCall('video');
    };
  }

  // Info button
  const infoBtn = document.getElementById('infoBtn');
  if (infoBtn) {
    infoBtn.onclick = () => {
      if (!currentChatUser) {
        alert('Select a contact first!');
        return;
      }
      
      const chatInfoModal = document.getElementById('chatInfoModal');
      if (chatInfoModal) {
        const userInfoUsername = document.getElementById('chatInfoUsername');
        const userInfoProfilePic = document.getElementById('chatInfoProfilePic');
        if (userInfoUsername) userInfoUsername.textContent = escapeHtml(currentChatUsername);
        if (userInfoProfilePic) userInfoProfilePic.src = escapeHtml(currentChatProfilePic);
        chatInfoModal.style.display = 'flex';
      }
    };
  }

  // Close chat info modal
  const closeChatInfoBtn = document.getElementById('closeChatInfoBtn');
  if (closeChatInfoBtn) {
    closeChatInfoBtn.onclick = () => {
      const chatInfoModal = document.getElementById('chatInfoModal');
      if (chatInfoModal) chatInfoModal.style.display = 'none';
    };
  }

  // Reels button (create reel)
  const createReelBtn = document.getElementById('createReelBtn');
  if (createReelBtn) {
    createReelBtn.onclick = () => {
      const createReelModal = document.getElementById('createReelModal');
      if (createReelModal) createReelModal.style.display = 'flex';
    };
  }

  // Close create reel modal
  const closeCreateReelBtn = document.getElementById('closeCreateReelBtn');
  if (closeCreateReelBtn) {
    closeCreateReelBtn.onclick = () => {
      const createReelModal = document.getElementById('createReelModal');
      if (createReelModal) createReelModal.style.display = 'none';
    };
  }

  // Reel upload area (click to select)
  const reelUploadArea = document.getElementById('reelUploadArea');
  const reelVideoInput = document.getElementById('reelVideoInput');
  if (reelUploadArea && reelVideoInput) {
    reelUploadArea.onclick = () => reelVideoInput.click();
    reelVideoInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        const preview = document.getElementById('reelVideoPreview');
        const previewPanel = document.getElementById('reelPreviewPanel');
        if (preview && previewPanel) {
          preview.src = url;
          previewPanel.style.display = 'block';
        }
      }
    };
  }

  // Cancel reel upload
  const cancelReelBtn = document.getElementById('cancelReelBtn');
  if (cancelReelBtn) {
    cancelReelBtn.onclick = () => {
      const createReelModal = document.getElementById('createReelModal');
      if (createReelModal) createReelModal.style.display = 'none';
    };
  }

  // Upload reel
  const uploadReelBtn = document.getElementById('uploadReelBtn');
  if (uploadReelBtn) {
    uploadReelBtn.onclick = () => {
      const caption = document.getElementById('reelCaption')?.value || '';
      const isPublic = document.getElementById('reelPublic')?.checked ?? true;
      if (caption.trim() && reelVideoInput.files?.length > 0) {
        showNotification('📹 Reel uploaded successfully!', 'success');
        const createReelModal = document.getElementById('createReelModal');
        if (createReelModal) createReelModal.style.display = 'none';
      } else {
        alert('Please add a caption and video before uploading.');
      }
    };
  }
});

// ======= MOBILE OPTIMIZATION =======
// Prevent body scroll when modals are open
function disableBodyScroll() {
  document.body.style.overflow = 'hidden';
}

function enableBodyScroll() {
  document.body.style.overflow = 'auto';
}

// Auto-scroll messages to bottom on new messages
function scrollMessagesToBottom() {
  setTimeout(() => {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 100);
}

// Listen to messages changes and scroll to bottom
const originalMessageHandler = messagesDiv.onchange;

// Override message display to auto-scroll
setInterval(() => {
  if (messagesDiv && messagesDiv.scrollHeight > messagesDiv.clientHeight) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}, 1000);

// Handle virtual keyboard on mobile (prevent covering input)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const inputSection = document.querySelector('.input-section');
    if (inputSection && window.visualViewport.height < window.innerHeight) {
      // Virtual keyboard is open
      setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        inputSection.scrollIntoView(false);
      }, 100);
    }
  });
}

// Prevent double-tap zoom on buttons
document.addEventListener('touchstart', (e) => {
  if (e.target.matches('button, .action-btn, .media-btn')) {
    e.preventDefault();
    e.target.click();
  }
}, { passive: false });

// Detect orientation changes
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 500);
});

// Optimize performance on mobile
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    // Lazy load contact avatars
    document.querySelectorAll('.contact-pic').forEach(img => {
      if (!img.src) {
        img.src = img.dataset.src || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%2300ff66%22/%3E%3C/svg%3E';
      }
    });
  });
}

// Ensure input stays visible when typing
messageText.addEventListener('focus', () => {
  setTimeout(() => {
    messageText.scrollIntoView(false);
  }, 300);
});

// Mobile-friendly notification positioning
if (window.innerWidth < 768) {
  const style = document.createElement('style');
  style.textContent = `
    .notification-container {
      top: 10px !important;
      left: 10px !important;
      right: 10px !important;
      max-width: calc(100vw - 20px) !important;
    }
  `;
  document.head.appendChild(style);
}