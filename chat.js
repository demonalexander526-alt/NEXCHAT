import { auth, db, rtdb } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, onSnapshot, serverTimestamp, orderBy, limit, Timestamp, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const storage = getStorage();

const isAndroid = /Android/.test(navigator.userAgent);
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isMobile = isAndroid || isIOS;

function vibrate(duration = 10) {
  if (navigator.vibrate && isAndroid) {
    navigator.vibrate(duration);
  }
}

function hapticFeedback(intensity = 'medium') {
  if (isAndroid && navigator.vibrate) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [50],
      success: [10, 50, 10]
    };
    navigator.vibrate(patterns[intensity] || patterns.medium);
  }
}

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    myUID = user.uid;
    myUsername = user.displayName || user.email.split('@')[0];
    myProfilePic = user.photoURL;

    console.log("✅ User authenticated:", myUID);

    // Setup listeners that require auth
    setupAuthListeners();

    // Initial data load
    if (typeof loadContacts === 'function') loadContacts();
    if (typeof loadStatusFeed === 'function') loadStatusFeed();
    if (typeof loadGroups === 'function') loadGroups();

    monitorConnectivity();
  } else {
    console.log("❌ User not authenticated, redirecting...");
    window.location.href = 'index.html';
  }
});

let currentChatUser = null;
let currentChatType = 'direct'; // 'direct' or 'group'
let myUID = null;
let myUsername = null;
let myProfilePic = null;
let messageListener = null;
let contactsListener = null;
let callActive = false;
let callStartTime = null;
let callTimer = null;
let mentionPopupOpen = false;
let groupMembers = []; // Store current group members for mentions

// Notification sounds - use data URLs for better compatibility
const notificationSounds = {
  success: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  error: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  info: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='
};

const emojis = [
  '😊', '😂', '😍', '🤔', '😎', '😢', '❤️', '👍', '🔥', '✨',
  '🎉', '🎊', '😴', '😤', '😡', '😳', '😌', '🤐', '😷', '🤒',
  '🤕', '😪', '😵', '🤤', '😲', '😨', '😰', '😥', '😢', '😭',
  '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
  '👋', '👏', '🙌', '👐', '🤝', '🤲', '🤞', '🖖', '🤘', '🤟'
];

// ============ GLOBAL UTILITY FUNCTIONS ============

// Fullscreen toggle function
function toggleFullscreen() {
  const elem = document.documentElement;
  const app = document.querySelector('.app');
  const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

  if (!isFullscreen) {
    // Try native fullscreen first
    let fullscreenPromise = null;

    if (elem.requestFullscreen) {
      fullscreenPromise = elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      fullscreenPromise = elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      fullscreenPromise = elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      fullscreenPromise = elem.msRequestFullscreen();
    }

    // If native fullscreen fails or is not supported, use CSS maximization
    if (fullscreenPromise) {
      fullscreenPromise.catch(() => {
        // Fallback to CSS-based fullscreen
        applyMaximizedView();
      });
    } else {
      // Fallback to CSS-based fullscreen if native fullscreen not available
      applyMaximizedView();
    }

    showNotif("📺 Fullscreen mode", "success", 1500);
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }

    // Also remove CSS maximization if applied
    removeMaximizedView();
    showNotif("📺 Normal view", "success", 1500);
  }
}

function applyMaximizedView() {
  const app = document.querySelector('.app');
  if (app) {
    app.dataset.maximized = 'true';
    document.body.style.overflow = 'hidden';
    console.log('✅ Fullscreen applied');
  }
}

function removeMaximizedView() {
  const app = document.querySelector('.app');
  if (app && app.dataset.maximized === 'true') {
    app.dataset.maximized = 'false';
    document.body.style.overflow = 'auto';
    console.log('✅ Fullscreen removed');
  }
}

function showNotif(msg, type = "info", duration = 3000) {
  const container = document.getElementById("notificationContainer");
  if (!container) {
    console.warn("⚠️ Notification container not found");
    // Fallback to alert if container doesn't exist
    if (type === "error") {
      alert("❌ " + msg);
    }
    return;
  }

  const notif = document.createElement("div");
  notif.className = `notification ${type}`;
  notif.style.cssText = `
    padding: 12px 20px;
    margin: 10px;
    border-radius: 8px;
    background: ${type === "success" ? "#4CAF50" : type === "error" ? "#f44336" : "#2196F3"};
    color: white;
    font-weight: 500;
    animation: slideInRight 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-size: 14px;
    max-width: 90%;
  `;
  notif.textContent = msg;
  container.appendChild(notif);

  // Play notification sound
  playNotificationSound(type);

  setTimeout(() => {
    notif.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

// Play notification sound
function playNotificationSound(type = "info") {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const frequencies = {
      success: 800,
      error: 300,
      info: 500
    };

    const frequency = frequencies[type] || 500;
    const duration = 0.2;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (err) {
    console.warn("Could not play notification sound:", err);
  }
}

// Voice notification for incoming messages
function announceIncomingMessage(contactName) {
  try {
    // Check if speech synthesis is available
    if (!window.speechSynthesis) {
      console.warn("Speech synthesis not supported");
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Create the announcement message
    const message = `NEXCHAT says you have an unread message in ${contactName}`;

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1;
    utterance.volume = 1;

    // Speak the message
    window.speechSynthesis.speak(utterance);

    console.log(`🔊 Voice notification: ${message}`);
  } catch (err) {
    console.warn("Could not play voice notification:", err);
  }
}

// Show group admin controls panel for managing members
async function showGroupInfoPanel(groupId) {
  try {
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (!groupDoc.exists()) {
      showNotif('❌ Group not found', 'error');
      return;
    }

    const groupData = groupDoc.data();
    const members = groupData.members || [];
    const infoPic = groupData.groupPic || '👥';

    // Update header
    document.getElementById('infoName').textContent = groupData.name || 'Group';
    document.getElementById('infoPic').src = infoPic || '👥';
    document.getElementById('infoMemberCount').textContent = `Group · ${members.length} members`;

    // Load and display media
    try {
      const messagesQuery = query(
        collection(db, 'groupMessages'),
        where('groupId', '==', groupId),
        limit(50)
      );
      const messagesSnapshot = await getDocs(messagesQuery);

      const mediaItems = [];
      let mediaCount = 0;

      messagesSnapshot.forEach(doc => {
        const msg = doc.data();
        if (msg.attachment) {
          mediaCount++;
          if (mediaItems.length < 9) {
            mediaItems.push(msg.attachment);
          }
        }
      });

      document.getElementById('mediaCount').textContent = mediaCount;
      const mediaPreview = document.getElementById('mediaPreview');
      mediaPreview.innerHTML = '';

      mediaItems.forEach(attachment => {
        if (attachment.downloadURL) {
          const item = document.createElement('div');
          item.className = 'media-item';
          if (attachment.fileType && attachment.fileType.startsWith('image/')) {
            item.innerHTML = `<img src="${attachment.downloadURL}" alt="media">`;
          } else if (attachment.fileType && attachment.fileType.startsWith('video/')) {
            item.innerHTML = `<video src="${attachment.downloadURL}"></video>`;
          } else {
            item.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #1a1a1a; color: #00ff66;">📄</div>`;
          }
          mediaPreview.appendChild(item);
        }
      });
    } catch (err) {
      console.log('Media loading skipped:', err.message);
      document.getElementById('mediaCount').textContent = '0';
    }

    // Load members list
    const membersContent = document.getElementById('membersListContent');
    membersContent.innerHTML = '';
    const adminMembers = groupData.admins || [groupData.createdBy];

    for (const memberId of members) {
      const userDoc = await getDoc(doc(db, 'users', memberId));
      const userData = userDoc.data() || {};
      const username = userData.username || userData.name || 'Unknown';
      const isAdmin = adminMembers.includes(memberId);
      const isYou = memberId === myUID;

      const memberDiv = document.createElement('div');
      memberDiv.className = 'member-item';
      memberDiv.innerHTML = `
        <div class="member-avatar">${username.charAt(0).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${escape(username)} ${isYou ? '(You)' : ''}</div>
          <div class="member-role">${isAdmin ? '👑 Admin' : 'Member'}</div>
        </div>
      `;
      membersContent.appendChild(memberDiv);
    }

    // Show the panel
    document.getElementById('infoSidebar').style.display = 'block';
    document.getElementById('membersList').style.display = 'block';

  } catch (error) {
    console.error('Error showing group info panel:', error);
    showNotif('Error loading group info: ' + error.message, 'error');
  }
}

async function showUserInfoPanel(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      showNotif('❌ User not found', 'error');
      return;
    }

    const userData = userDoc.data();

    // Update header
    document.getElementById('infoName').textContent = userData.username || userData.name || 'User';
    document.getElementById('infoPic').src = userData.profilePic || userData.profilePicUrl || '👤';
    document.getElementById('infoMemberCount').textContent = userData.email || 'User Profile';

    // Hide members list for direct chats
    document.getElementById('membersList').style.display = 'none';

    // Show the panel
    document.getElementById('infoSidebar').style.display = 'block';

  } catch (error) {
    console.error('Error showing user info panel:', error);
    showNotif('Error loading user info: ' + error.message, 'error');
  }
}

// Close info panel
document.getElementById('closeInfoBtn')?.addEventListener('click', () => {
  document.getElementById('infoSidebar').style.display = 'none';
});

document.getElementById('closeInfoBtn2')?.addEventListener('click', () => {
  document.getElementById('infoSidebar').style.display = 'none';
});

async function showGroupAdminPanel(groupId) {
  try {
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (!groupDoc.exists()) {
      showNotif('❌ Group not found', 'error');
      return;
    }

    const groupData = groupDoc.data();
    const adminMembers = groupData.admins || [groupData.createdBy];

    // Check if current user is admin
    if (!adminMembers.includes(myUID)) {
      showNotif('❌ Only admins can manage members', 'error');
      return;
    }

    // Create admin panel modal
    let adminPanel = document.getElementById('groupAdminPanel');
    if (!adminPanel) {
      adminPanel = document.createElement('div');
      adminPanel.id = 'groupAdminPanel';
      document.body.appendChild(adminPanel);
    }

    const members = groupData.members || [];
    const suspendedMembers = groupData.suspendedMembers || [];

    let membersHTML = '<div style="max-height: 400px; overflow-y: auto;">';

    for (const memberId of members) {
      if (memberId === myUID) continue; // Don't show controls for self

      const userDoc = await getDoc(doc(db, 'users', memberId));
      const userData = userDoc.data() || {};
      const username = userData.username || userData.name || memberId;
      const isSuspended = suspendedMembers.includes(memberId);
      const isAdmin = adminMembers.includes(memberId);

      const suspendStatus = isSuspended ? '🚫 Suspended' : '✅ Active';
      const adminBadge = isAdmin ? ' 👑' : '';

      membersHTML += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #00ff66; gap: 10px;">
          <div style="flex: 1; min-width: 0;">
            <p style="margin: 0; font-weight: 600; color: #00ff66;">${escape(username)}${adminBadge}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: ${isSuspended ? '#ff6b6b' : '#4CAF50'};">${suspendStatus}</p>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${!isAdmin ? `<button onclick="promoteToAdmin('${groupId}', '${memberId}')" style="padding: 6px 10px; background: #00d4ff; color: #000; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">👑 Promote</button>` : '<span style="color: #00ff66; font-size: 12px;">Admin</span>'}\n            <button onclick="toggleSuspendMember('${groupId}', '${memberId}', ${isSuspended})" style="padding: 6px 10px; background: ${isSuspended ? '#4CAF50' : '#ff6b6b'}; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">${isSuspended ? '✓ Unsuspend' : '🚫 Suspend'}</button>\n            <button onclick="kickMember('${groupId}', '${memberId}')" style="padding: 6px 10px; background: #ff4444; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">❌ Kick</button>\n          </div>\n        </div>\n      `;
    }
    membersHTML += '</div>';

    adminPanel.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;" onclick="document.getElementById('groupAdminPanel').style.display='none'">
        <div style="background: #0a0f1a; border: 2px solid #00ff66; border-radius: 12px; padding: 20px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation()">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #00ff66;">👥 Manage Members</h3>\n            <button onclick="document.getElementById('groupAdminPanel').style.display='none'" style="background: none; border: none; color: #00ff66; font-size: 24px; cursor: pointer;">×</button>\n          </div>\n          ${membersHTML}\n        </div>\n      </div>\n    `;
    adminPanel.style.display = 'block';
  } catch (error) {
    console.error('Error showing admin panel:', error);
    showNotif('Error loading admin panel: ' + error.message, 'error');
  }
}

// Toggle suspend status for a member
async function toggleSuspendMember(groupId, memberId, currentlySuspended) {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    const groupData = groupDoc.data() || {};
    let suspendedMembers = groupData.suspendedMembers || [];

    if (currentlySuspended) {
      // Unsuspend
      suspendedMembers = suspendedMembers.filter(id => id !== memberId);
      await updateDoc(groupRef, { suspendedMembers });
      showNotif('✅ Member unsuspended', 'success');
    } else {
      // Suspend
      if (!suspendedMembers.includes(memberId)) {
        suspendedMembers.push(memberId);
      }
      await updateDoc(groupRef, { suspendedMembers });
      showNotif('✅ Member suspended', 'success');
    }

    // Refresh admin panel
    await showGroupAdminPanel(groupId);
  } catch (error) {
    console.error('Error toggling suspend:', error);
    showNotif('Error: ' + error.message, 'error');
  }
}

// Promote member to admin
async function promoteToAdmin(groupId, memberId) {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    const groupData = groupDoc.data() || {};
    let admins = groupData.admins || [groupData.createdBy];

    if (!admins.includes(memberId)) {
      admins.push(memberId);
    }

    await updateDoc(groupRef, { admins });
    showNotif('👑 Member promoted to admin', 'success');

    // Refresh admin panel
    await showGroupAdminPanel(groupId);
  } catch (error) {
    console.error('Error promoting member:', error);
    showNotif('Error: ' + error.message, 'error');
  }
}

// Kick member from group
async function kickMember(groupId, memberId) {
  try {
    if (!confirm('Are you sure you want to kick this member?')) return;

    const groupRef = doc(db, 'groups', groupId);
    const groupDoc = await getDoc(groupRef);
    const groupData = groupDoc.data() || {};
    let members = groupData.members || [];
    let admins = groupData.admins || [groupData.createdBy];

    // Remove from members
    members = members.filter(id => id !== memberId);

    // Remove from admins if admin
    admins = admins.filter(id => id !== memberId);

    await updateDoc(groupRef, {
      members,
      admins
    });

    showNotif('❌ Member kicked from group', 'success');

    // Refresh admin panel
    await showGroupAdminPanel(groupId);
  } catch (error) {
    console.error('Error kicking member:', error);
    showNotif('Error: ' + error.message, 'error');
  }
}

// Setup mention popup for group chat
function setupMentionInput() {
  const input = document.getElementById('message-input');
  if (!input || currentChatType !== 'group') {
    console.log("Mention input setup skipped - not a group chat or input missing");
    return;
  }

  // Check if listener is already attached to prevent duplicates
  if (input.dataset.mentionListenerAttached === 'true') {
    console.log("Mention listener already attached, skipping");
    return;
  }

  input.addEventListener('keyup', (e) => {
    const text = input.value;
    const lastAtIndex = text.lastIndexOf('@');

    if (lastAtIndex !== -1 && lastAtIndex === text.length - 1) {
      // User just typed @, show member list
      showMentionPopup(input);
    } else if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1);
      if (afterAt.match(/^\w*$/)) {
        // User is typing after @, filter members
        filterMentionPopup(afterAt);
      } else if (afterAt.includes(' ')) {
        // User typed a space after mention, close popup
        hideMentionPopup();
      }
    } else {
      hideMentionPopup();
    }
  });

  // Mark that listener is attached
  input.dataset.mentionListenerAttached = 'true';
  console.log("✅ Mention input listener attached");
}

function showMentionPopup(input) {
  let popup = document.getElementById('mentionPopup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'mentionPopup';
    document.body.appendChild(popup);
  }

  let html = '<div style="position: fixed; background: #1a1f3a; border: 1px solid #00ff66; border-radius: 8px; max-height: 200px; overflow-y: auto; z-index: 500; padding: 8px; min-width: 150px;">';

  groupMembers.forEach(member => {
    if (member.uid !== myUID) {
      html += `
        <div onclick="insertMention('${member.username || member.name}')" style="padding: 8px; cursor: pointer; color: #00ff66; border-radius: 4px;">
          ${escape(member.username || member.name)} <span style="color: #00d4ff; font-size: 11px;">(${escape(member.uid)})</span>
        </div>
      `;
    }
  });

  html += '</div>';
  popup.innerHTML = html;
  popup.style.display = 'block';
  mentionPopupOpen = true;

  // Position popup
  const rect = input.getBoundingClientRect();
  popup.style.top = (rect.top - 220) + 'px';
  popup.style.left = rect.left + 'px';
}

function filterMentionPopup(filter) {
  const popup = document.getElementById('mentionPopup');
  if (!popup) return;

  const filtered = groupMembers.filter(m =>
    (m.username || m.name).toLowerCase().includes(filter.toLowerCase()) && m.uid !== myUID
  );

  if (filtered.length === 0) {
    popup.style.display = 'none';
    return;
  }

  let html = '<div style="position: fixed; background: #1a1f3a; border: 1px solid #00ff66; border-radius: 8px; max-height: 200px; overflow-y: auto; z-index: 500; padding: 8px; min-width: 150px;">';

  filtered.forEach(member => {
    html += `
      <div onclick="insertMention('${member.username || member.name}')" style="padding: 8px; cursor: pointer; color: #00ff66; border-radius: 4px; background: rgba(0, 255, 102, 0.1);">
        ${escape(member.username || member.name)}
      </div>
    `;
  });

  html += '</div>';
  popup.innerHTML = html;
  popup.style.display = 'block';
}

function hideMentionPopup() {
  const popup = document.getElementById('mentionPopup');
  if (popup) {
    popup.style.display = 'none';
  }
  mentionPopupOpen = false;
}

function insertMention(username) {
  const input = document.getElementById('message-input');
  if (!input) return;

  const text = input.value;
  const lastAtIndex = text.lastIndexOf('@');

  if (lastAtIndex !== -1) {
    const beforeAt = text.substring(0, lastAtIndex);
    const afterAt = text.substring(lastAtIndex + 1);
    const afterSpace = afterAt.includes(' ') ? afterAt.substring(afterAt.indexOf(' ')) : '';

    input.value = beforeAt + '@' + username + ' ' + afterSpace;
    input.focus();
    hideMentionPopup();
  }
}

// Ensure notification container exists (fallback) and expose a quick test helper
window.addEventListener('DOMContentLoaded', () => {
  let container = document.getElementById('notificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    container.className = 'notification-container';
    document.body.appendChild(container);
    console.warn('⚠️ `notificationContainer` was missing. Created fallback container.');
  }

  // helper for quick manual testing from the browser console
  window.testNotif = function (msg = 'Test notification', type = 'info', duration = 3000) {
    try {
      showNotif(msg, type, duration);
    } catch (e) {
      console.error('Failed to show test notification:', e);
    }
  };
});

function escape(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function showChatListView() {
  const listView = document.getElementById("chatListView");
  const detailView = document.getElementById("chatDetailView");
  const statusContainer = document.getElementById("statusContainer");
  const bottomNav = document.querySelector(".bottom-nav");
  if (listView) {
    listView.classList.remove("hidden");
    listView.style.display = "flex";
    listView.style.zIndex = "10";
  }
  if (detailView) {
    detailView.classList.add("hidden");
    detailView.style.display = "none";
    detailView.style.zIndex = "0";
  }
  // Show NEX-STATUS on list view
  if (statusContainer) {
    statusContainer.style.display = "block";
  }
  // Show bottom nav on list view
  if (bottomNav) {
    bottomNav.style.display = "flex";
  }
}

function showChatDetailView() {
  const listView = document.getElementById("chatListView");
  const detailView = document.getElementById("chatDetailView");
  const statusContainer = document.getElementById("statusContainer");
  const bottomNav = document.querySelector(".bottom-nav");
  if (listView) {
    listView.classList.add("hidden");
    listView.style.display = "none";
    listView.style.zIndex = "0";
  }
  if (detailView) {
    detailView.classList.remove("hidden");
    detailView.style.display = "flex";
    detailView.style.zIndex = "20";
  }
  // Hide NEX-STATUS on detail view
  if (statusContainer) {
    statusContainer.style.display = "none";
  }
  // Hide bottom nav on detail view
  if (bottomNav) {
    bottomNav.style.display = "none";
  }
}

// ============ SEARCH AND FILTER FUNCTIONS ============

function filterChats(query) {
  const chatItems = document.querySelectorAll(".chat-list li[data-chat-id]");
  chatItems.forEach(item => {
    const name = item.textContent.toLowerCase();
    if (query === "" || name.includes(query)) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });
}

function applyFilter(filter) {
  const chatItems = document.querySelectorAll(".chat-list li[data-chat-id]");
  chatItems.forEach(item => {
    const isUnread = item.dataset.unread === "true";
    const isFavorite = item.dataset.favorite === "true";
    const isGroup = item.dataset.isGroup === "true";

    let shouldShow = true;

    switch (filter) {
      case "unread":
        shouldShow = isUnread;
        break;
      case "favorites":
        shouldShow = isFavorite;
        break;
      case "groups":
        shouldShow = isGroup;
        break;
      case "all":
        shouldShow = true;
        break;
    }

    item.style.display = shouldShow ? "block" : "none";
  });
}

async function archiveChat(chatId) {
  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const archivedChats = userDoc.data().archivedChats || [];
      if (!archivedChats.includes(chatId)) {
        archivedChats.push(chatId);
        await updateDoc(userRef, {
          archivedChats: archivedChats
        });
        showNotif("✅ Chat archived", "success", 1500);
        loadContacts(); // Reload to update UI
      }
    }
  } catch (err) {
    console.error("Error archiving chat:", err);
    showNotif("❌ Failed to archive chat", "error");
  }
}

async function unarchiveChat(chatId) {
  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      let archivedChats = userDoc.data().archivedChats || [];
      archivedChats = archivedChats.filter(id => id !== chatId);

      await updateDoc(userRef, {
        archivedChats: archivedChats
      });

      showNotif("✅ Chat unarchived", "success", 1500);
      loadContacts(); // Reload to update UI
    }
  } catch (err) {
    console.error("Error unarchiving chat:", err);
    showNotif("❌ Failed to unarchive chat", "error");
  }
}

function handleNavigation(section) {
  const chatListView = document.getElementById("chatListView");
  const statusContainer = document.getElementById("statusContainer");
  const groupsContainer = document.getElementById("groupsContainer");

  switch (section) {
    case "chats":
      console.log("📱 Showing chats");
      chatListView.style.display = "block";
      statusContainer.style.display = "none";
      groupsContainer.style.display = "none";
      break;
    case "updates":
      console.log("✨ Showing statuses");
      chatListView.style.display = "none";
      statusContainer.style.display = "block";
      groupsContainer.style.display = "none";
      loadStatusFeed();
      break;
    case "communities":
      console.log("👥 Showing groups");
      chatListView.style.display = "none";
      statusContainer.style.display = "none";
      groupsContainer.style.display = "block";
      loadGroups();
      break;
    case "calls":
      showNotif("☎️ Calls history coming soon", "info");
      break;
  }
}

function showChatContextMenu(event, chatId) {
  // Remove any existing context menu
  const existingMenu = document.querySelector(".chat-context-menu");
  if (existingMenu) {
    existingMenu.remove();
  }

  // Create context menu
  const menu = document.createElement("div");
  menu.className = "chat-context-menu";
  menu.style.cssText = `
    position: fixed;
    top: ${event.clientY}px;
    left: ${event.clientX}px;
    background: #1a1a1a;
    border: 2px solid #00ff66;
    border-radius: 8px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    min-width: 150px;
  `;

  const archiveBtn = document.createElement("button");
  archiveBtn.textContent = "📦 Archive";
  archiveBtn.style.cssText = `
    width: 100%;
    padding: 10px;
    background: transparent;
    border: none;
    color: #00ff66;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    transition: all 0.2s;
  `;
  archiveBtn.onclick = async () => {
    await archiveChat(chatId);
    menu.remove();
  };
  archiveBtn.onmouseover = () => {
    archiveBtn.style.background = "rgba(0, 255, 102, 0.1)";
  };
  archiveBtn.onmouseout = () => {
    archiveBtn.style.background = "transparent";
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "🗑️ Delete";
  deleteBtn.style.cssText = `
    width: 100%;
    padding: 10px;
    background: transparent;
    border: none;
    color: #ff6b6b;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    border-top: 1px solid #333;
    transition: all 0.2s;
  `;
  deleteBtn.onclick = async () => {
    // TODO: Implement delete chat
    showNotif("❌ Delete feature coming soon", "info");
    menu.remove();
  };
  deleteBtn.onmouseover = () => {
    deleteBtn.style.background = "rgba(255, 107, 107, 0.1)";
  };
  deleteBtn.onmouseout = () => {
    deleteBtn.style.background = "transparent";
  };

  menu.appendChild(archiveBtn);
  menu.appendChild(deleteBtn);
  document.body.appendChild(menu);

  // Close menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener("click", function closeMenu() {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    });
  }, 0);
}

// Dark Mode Preference Loading
window.addEventListener("load", () => {
  const savedDarkMode = localStorage.getItem("darkMode");
  if (savedDarkMode === "true") {
    document.body.classList.add("dark-mode");
    document.getElementById("darkModeToggle").textContent = "☀️";
  } else {
    document.body.classList.add("light-mode");
    document.getElementById("darkModeToggle").textContent = "🌙";
  }
});

async function autoPopulateTestUsers() {
  try {
    const usersRef = collection(db, "users");
    const snap = await getDocs(usersRef);

    // Only populate if database is empty
    if (snap.docs.length === 0) {
      console.log("📱 Database is empty - auto-populating test users...");

      const testUsers = [
        {
          uid: "test_user_001",
          email: "alex@gmail.com",
          name: "Alex Johnson",
          username: "alexjohnson",
          online: true,
          tokens: 1000,
          createdAt: new Date().toISOString()
        },
        {
          uid: "test_user_002",
          email: "sara@gmail.com",
          name: "Sara Ahmed",
          username: "saraahmed",
          online: true,
          tokens: 1000,
          createdAt: new Date().toISOString()
        },
        {
          uid: "test_user_003",
          email: "john@gmail.com",
          name: "John Smith",
          username: "johnsmith",
          online: false,
          tokens: 1000,
          createdAt: new Date().toISOString()
        },
        {
          uid: "test_user_004",
          email: "emma@gmail.com",
          name: "Emma Wilson",
          username: "emmawilson",
          online: true,
          tokens: 1000,
          createdAt: new Date().toISOString()
        }
      ];

      for (const user of testUsers) {
        const { uid, ...userData } = user;
        try {
          await setDoc(doc(db, "users", uid), userData);
          console.log("✅ Created test user:", uid, userData.name);
        } catch (err) {
          console.error("❌ Failed to create test user:", uid, err);
        }
      }

      showNotif("✅ Test users auto-created! Ready to test search.", "success", 3000);
    }
  } catch (err) {
    console.error("Error in auto-populate:", err);
  }
}

function openSearch() {
  console.log("🔍 Opening search...");
  console.log("📌 Current myUID:", myUID);

  // Check if user is authenticated
  if (!myUID) {
    console.error("❌ User not authenticated! Waiting for auth...");
    showNotif("Please wait, loading user data...", "info");
    return;
  }

  const overlay = document.getElementById("search-overlay");
  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");
  const resultsDiv = document.getElementById("search-results");

  if (!overlay || !modal || !input) {
    console.error("❌ Search elements not found!");
    showNotif("Search not available", "error");
    return;
  }

  // Show overlay and modal
  overlay.style.display = "flex";
  modal.style.display = "flex";

  if (resultsDiv) {
    resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #ffa500;'>⏳ Loading users...</div>";
  }

  loadAllUsers();

  // Focus input and trigger keyboard
  input.focus();
  input.select();
  console.log("✅ Search opened and input focused");
}

async function loadAllUsers() {
  console.log("📱 Loading all users and groups...");
  console.log("📌 myUID at loadAllUsers:", myUID);

  const resultsDiv = document.getElementById("search-results");

  if (!resultsDiv) {
    console.error("❌ Search results div not found!");
    return;
  }

  if (!myUID) {
    console.warn("⚠️ User not authenticated yet");
    showNotif("Please wait, authenticating...", "info");
    resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #ffa500;'>⏳ Loading user data...</div>";

    // Wait for auth to complete (max 5 seconds)
    let retries = 0;
    while (!myUID && retries < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (!myUID) {
      console.error("❌ Failed to authenticate");
      resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #ff4d4d;'>❌ Error: Not authenticated. Please refresh the page.</div>";
      showNotif("Authentication failed. Please refresh.", "error");
      return;
    }

    console.log("✅ Auth completed after waiting");
  }

  try {
    console.log("🔥 Querying Firestore users collection...");
    const usersRef = collection(db, "users");
    const q = query(usersRef);
    const snap = await getDocs(q);

    let allUsers = [];

    // Get users from Firestore
    console.log("📊 Total users in Firestore:", snap.docs.length);
    snap.forEach(docSnap => {
      const user = docSnap.data();
      const uid = docSnap.id;
      user.uid = uid;
      user.isGroup = false;

      console.log(`👤 Processing user from Firestore - ID: ${uid}, Username: ${user.username}`);

      // Skip current user
      if (uid !== myUID) {
        allUsers.push(user);
      }
    });

    // Load groups
    console.log("👥 Loading groups...");
    try {
      const groupsRef = collection(db, "groups");
      const groupsQuery = query(groupsRef, where("members", "array-contains", myUID));
      const groupsSnap = await getDocs(groupsQuery);

      console.log("📊 Total groups:", groupsSnap.docs.length);
      groupsSnap.forEach(docSnap => {
        const group = docSnap.data();
        group.uid = docSnap.id;
        group.id = docSnap.id;
        group.isGroup = true;
        group.type = 'group';

        console.log(`👥 Processing group - ID: ${group.uid}, Name: ${group.name}, Members: ${group.members?.length}`);
        allUsers.push(group);
      });
    } catch (groupErr) {
      console.warn("⚠️ Could not fetch groups:", groupErr);
    }

    // Also get users from Realtime Database
    console.log("📡 Checking Realtime Database...");
    try {
      const rtdbRef = ref(rtdb, 'users');
      const rtdbSnap = await get(rtdbRef);
      if (rtdbSnap.exists()) {
        const rtdbUsers = rtdbSnap.val();
        console.log("📊 Total users in Realtime DB:", Object.keys(rtdbUsers).length);

        Object.entries(rtdbUsers).forEach(([uid, userData]) => {
          console.log(`👤 Processing user from RTDB - ID: ${uid}, Username: ${userData.username}`);

          // Only add if not already in allUsers (avoid duplicates)
          if (uid !== myUID && !allUsers.find(u => u.uid === uid)) {
            userData.uid = uid;
            userData.isGroup = false;
            allUsers.push(userData);
          }
        });
      }
    } catch (rtdbErr) {
      console.warn("⚠️ Could not fetch from Realtime Database:", rtdbErr);
    }

    console.log("🎯 Total unique items found:", allUsers.length);

    if (allUsers.length === 0) {
      console.warn("⚠️ No users or groups found");
      resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #999; font-size: 14px;'>👥 No users or groups found yet.</div>";
      return;
    }

    resultsDiv.innerHTML = ""; // Clear previous results

    // Display all users and groups
    allUsers.forEach(item => {
      const resultItem = document.createElement("div");
      resultItem.className = "search-result-item";
      resultItem.style.cssText = `
        padding: 14px;
        border: 1.5px solid rgba(0, 255, 102, 0.3);
        border-radius: 12px;
        margin: 10px;
        cursor: pointer;
        background: linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(0, 255, 102, 0.05));
        color: #fff;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        gap: 12px;
      `;

      // Use username first, fall back to name, then email
      const displayName = item.isGroup ? item.name : (item.username || item.name || item.email || "Unknown User");
      const profilePic = item.isGroup ? '👥' : (item.profilePic || item.profilePicUrl || null);

      console.log(`🎨 Creating UI for: ${displayName}, isGroup: ${item.isGroup}, has profilePic: ${!!profilePic}`);

      // Create profile image or fallback
      let profileHTML = '';
      if (!item.isGroup && profilePic && typeof profilePic === 'string' && (profilePic.startsWith('data:') || profilePic.startsWith('http'))) {
        profileHTML = `<img src="${escape(profilePic)}" alt="${escape(displayName)}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #00ff66; flex-shrink: 0;">`;
      } else {
        const bgColor = item.isGroup ? '#00d4ff' : '#00ff66';
        const icon = item.isGroup ? '👥' : displayName.charAt(0).toUpperCase();
        profileHTML = `<div style="width: 50px; height: 50px; border-radius: 50%; background: ${bgColor}; color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; flex-shrink: 0;">${icon}</div>`;
      }

      resultItem.innerHTML = `
        ${profileHTML}
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <h4 style="margin: 0; color: #00ff66; font-weight: 600; word-break: break-word; flex: 1;">${item.isGroup ? '👥 ' : '@'}${escape(displayName)}</h4>
            ${item.isGroup ? `<span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; white-space: nowrap; font-weight: 600; background: rgba(0, 212, 255, 0.3); color: #00d4ff;">Group (${item.members?.length || 0} members)</span>` : `<span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; white-space: nowrap; font-weight: 600; background: ${item.online === true ? 'rgba(76, 175, 80, 0.3)' : item.online === false ? 'rgba(153, 153, 153, 0.3)' : 'rgba(255, 165, 0, 0.3)'}; color: ${item.online === true ? '#4CAF50' : item.online === false ? '#999' : '#ffa500'};">${item.online === true ? '🟢 Online' : item.online === false ? '⚫ Offline' : '❓ Unknown'}</span>`}
          </div>
          ${!item.isGroup ? `<p style="margin: 4px 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>📧 Email:</strong> ${escape(item.email || 'N/A')}</p>` : `<p style="margin: 4px 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>📝 Description:</strong> ${escape(item.description || 'No description')}</p>`}
          <p style="margin: 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>🆔 UID:</strong> ${escape(item.uid)}</p>
        </div>
      `;

      resultItem.addEventListener("click", async () => {
        try {
          console.log(`Opening ${item.isGroup ? 'group' : 'chat'} with ${displayName} (${item.uid})`);
          if (item.isGroup) {
            await openChat(item.uid, item.name || displayName, item.profilePic || '👥', 'group');
          } else {
            await openChat(item.uid, displayName, profilePic, 'direct');
          }
          closeSearch();
          showChatDetailView();
        } catch (chatErr) {
          console.error("Error opening chat:", chatErr);
          showNotif("Error opening chat: " + chatErr.message, "error");
        }
      });

      resultItem.addEventListener("mouseover", () => {
        resultItem.style.background = "linear-gradient(135deg, #00ff66, #00d4ff)";
        resultItem.style.borderColor = "#00ff66";
        resultItem.style.color = "#000";
        resultItem.style.boxShadow = "0 0 20px rgba(0, 255, 102, 0.4)";
      });

      resultItem.addEventListener("mouseout", () => {
        resultItem.style.background = "linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(0, 255, 102, 0.05))";
        resultItem.style.borderColor = "rgba(0, 255, 102, 0.3)";
        resultItem.style.color = "#fff";
        resultItem.style.boxShadow = "none";
      });

      resultsDiv.appendChild(resultItem);
    });

    showNotif(`✅ Found ${allUsers.length} item${allUsers.length !== 1 ? 's' : ''}`, "success", 2000);
    console.log("✅ Loaded " + allUsers.length + " items");
  } catch (err) {
    console.error("❌ Error loading users and groups:", err);
    const resultsDiv = document.getElementById("search-results");
    if (resultsDiv) {
      resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #ff4d4d;'>❌ Error loading data: " + escape(err.message) + "</div>";
    }
    showNotif("Error loading data: " + err.message, "error");
  }
}

function closeSearch() {
  console.log("❌ Closing search...");
  const overlay = document.getElementById("search-overlay");
  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");

  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
  if (input) {
    input.value = "";
    input.blur();
  }

  const resultsDiv = document.getElementById("search-results");
  if (resultsDiv) resultsDiv.innerHTML = "";
}

async function searchUser(e) {
  if (e) e.preventDefault();

  // Check if user is authenticated
  if (!myUID) {
    console.warn("⚠️ User not authenticated yet, waiting...");
    showNotif("Please wait, loading user data...", "info");
    return;
  }

  const searchInput = document.getElementById("search-input");
  if (!searchInput) {
    console.error("❌ Search input element not found!");
    showNotif("Search input error", "error");
    return;
  }

  const searchTerm = searchInput.value.trim();
  const searchTermLower = searchTerm.toLowerCase();
  console.log("🔍 Searching for:", searchTerm);

  if (!searchTerm) {
    document.getElementById("search-results").innerHTML = "";
    return;
  }

  try {
    console.log("🔍 Starting search for:", searchTerm);

    // Get all users and filter client-side
    const q = query(collection(db, "users"));
    const snap = await getDocs(q);

    console.log("📊 Total users in database:", snap.docs.length);

    let foundResults = [];
    snap.forEach(docSnap => {
      const user = docSnap.data();
      user.uid = docSnap.id;
      user.isGroup = false;

      // Skip current user
      if (user.uid !== myUID) {
        const uid = user.uid || "";
        const username = (user.username || "").toLowerCase();
        const name = (user.name || "").toLowerCase();
        const email = (user.email || "").toLowerCase();

        // PRIORITY MATCHING:
        // 1. Exact UID match (case-insensitive, full match) - HIGHEST
        // 2. Partial UID match (case-insensitive)
        // 3. Email match (case-insensitive, partial)
        // 4. Username match (case-insensitive, partial)
        // 5. Name match (case-insensitive, partial)

        let matchPriority = -1;
        const uidLower = uid.toLowerCase();

        if (uidLower === searchTermLower) {
          matchPriority = 0; // Exact UID match - highest priority
        } else if (uidLower.includes(searchTermLower)) {
          matchPriority = 1; // Partial UID match
        } else if (email.includes(searchTermLower)) {
          matchPriority = 2; // Email match
        } else if (username.includes(searchTermLower)) {
          matchPriority = 3; // Username match
        } else if (name.includes(searchTermLower)) {
          matchPriority = 4; // Name match
        }

        if (matchPriority >= 0) {
          user.matchPriority = matchPriority;
          console.log("✅ User found:", user.username || user.email, "Email:", user.email, "UID:", user.uid, "Priority:", matchPriority, "Online:", user.online);
          foundResults.push(user);
        }
      }
    });

    // Search for groups
    console.log("👥 Searching groups...");
    try {
      const groupsRef = collection(db, "groups");
      const groupsSnap = await getDocs(groupsRef);

      groupsSnap.forEach(docSnap => {
        const group = docSnap.data();
        group.uid = docSnap.id;
        group.id = docSnap.id;
        group.isGroup = true;
        group.type = 'group';

        // Check if user is in the group
        if (group.members?.includes(myUID)) {
          const groupId = group.uid || "";
          const groupName = (group.name || "").toLowerCase();
          const groupDesc = (group.description || "").toLowerCase();

          let matchPriority = -1;
          const groupIdLower = groupId.toLowerCase();

          // Similar priority matching for groups
          if (groupIdLower === searchTermLower) {
            matchPriority = 0; // Exact group ID match
          } else if (groupIdLower.includes(searchTermLower)) {
            matchPriority = 1; // Partial group ID match
          } else if (groupName.includes(searchTermLower)) {
            matchPriority = 2; // Group name match
          } else if (groupDesc.includes(searchTermLower)) {
            matchPriority = 3; // Description match
          }

          if (matchPriority >= 0) {
            group.matchPriority = matchPriority + 10; // Add 10 to prioritize users over groups
            console.log("✅ Group found:", group.name, "ID:", group.uid, "Members:", group.members?.length);
            foundResults.push(group);
          }
        }
      });
    } catch (groupErr) {
      console.warn("⚠️ Error searching groups:", groupErr);
    }

    // Sort by priority
    foundResults.sort((a, b) => a.matchPriority - b.matchPriority);

    const resultsDiv = document.getElementById("search-results");

    if (foundResults.length === 0) {
      resultsDiv.innerHTML = `
        <div style='padding: 16px; text-align: center; color: #ff6b6b; font-size: 14px;'>
          ❌ No user or group with UID/name "${escape(searchTerm)}" found
        </div>
      `;
      return;
    }

    resultsDiv.innerHTML = "";

    // Show notification that results were found
    if (foundResults.length > 0) {
      showNotif(`✅ Found ${foundResults.length} result(s)!`, "success", 2000);
    }

    foundResults.forEach(item => {
      const resultItem = document.createElement("div");
      resultItem.className = "search-result-item";
      resultItem.style.cssText = `
        padding: 14px;
        border: 1.5px solid rgba(0, 255, 102, 0.3);
        border-radius: 12px;
        margin: 10px 0;
        background: linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(0, 255, 102, 0.05));
        color: #fff;
        transition: all 0.3s;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;

      const displayName = item.isGroup ? item.name : (item.username || item.name || item.uid);
      const profilePic = item.isGroup ? '👥' : (item.profilePic || item.profilePicUrl || '👤');

      // Create profile image or fallback
      let profileHTML = '';
      if (!item.isGroup && typeof profilePic === 'string' && (profilePic.startsWith('data:') || profilePic.startsWith('http'))) {
        profileHTML = `<img src="${escape(profilePic)}" alt="" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #00ff66;">`;
      } else {
        const bgColor = item.isGroup ? '#00d4ff' : '#00ff66';
        const icon = item.isGroup ? '👥' : displayName.charAt(0).toUpperCase();
        profileHTML = `<div style="width: 50px; height: 50px; border-radius: 50%; background: ${bgColor}; color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">${icon}</div>`;
      }

      resultItem.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          ${profileHTML}
          <div style="flex: 1;">
            <h4 style="margin: 0; color: #00ff66; font-weight: 600;">${item.isGroup ? '👥 ' : ''}${escape(displayName)}</h4>
            ${item.isGroup ? `<p style="margin: 4px 0 0 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>📝 Description:</strong> ${escape(item.description || 'No description')}</p>` : `<p style="margin: 4px 0 0 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>📧 Email:</strong> ${escape(item.email || 'N/A')}</p>`}
            <p style="margin: 4px 0 0 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>🆔 UID:</strong> ${escape(item.uid)}</p>
            ${item.isGroup ? `<p style="margin: 4px 0 0 0; font-size: 11px; color: #00ff66;"><strong>👥 Members:</strong> ${item.members?.length || 0}</p>` : `<p style="margin: 4px 0 0 0; font-size: 11px; color: ${item.online === true ? '#4CAF50' : item.online === false ? '#999' : '#ffa500'};">${item.online === true ? '🟢 Online' : item.online === false ? '⚫ Offline' : '❓ Status Unknown'}</p>`}
          </div>
        </div>
        <button id="chat-btn-${item.uid}" style="
          width: 100%;
          padding: 10px;
          background: ${item.isGroup ? '#00d4ff' : '#00ff66'};
          color: #000;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        ">${item.isGroup ? '👥 Join Group' : '💬 Start Chatting'}</button>
      `;

      // Add click handler to the button
      const chatBtn = resultItem.querySelector(`#chat-btn-${item.uid}`);
      chatBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          console.log(`${item.isGroup ? '👥 Joining group' : '💬 Starting chat'} with:`, displayName);
          if (item.isGroup) {
            await openChat(item.uid, item.name || displayName, item.profilePic || '👥', 'group');
          } else {
            await openChat(item.uid, displayName, profilePic, 'direct');
          }
          closeSearch();
          showChatDetailView();
          showNotif(`✅ Opened ${item.isGroup ? 'group' : 'chat'} with ${displayName}`, "success");
        } catch (chatErr) {
          console.error("Error opening chat:", chatErr);
          showNotif("Error opening chat: " + chatErr.message, "error");
        }
      });

      chatBtn.addEventListener("mouseover", () => {
        chatBtn.style.background = item.isGroup ? "#00ccdd" : "#00dd55";
        chatBtn.style.transform = "scale(1.02)";
      });

      chatBtn.addEventListener("mouseout", () => {
        chatBtn.style.background = item.isGroup ? '#00d4ff' : '#00ff66';
        chatBtn.style.transform = "scale(1)";
      });

      resultItem.addEventListener("mouseover", () => {
        resultItem.style.background = "linear-gradient(135deg, rgba(0, 255, 102, 0.2), rgba(0, 212, 255, 0.1))";
        resultItem.style.boxShadow = "0 0 20px rgba(0, 255, 102, 0.3)";
      });

      resultItem.addEventListener("mouseout", () => {
        resultItem.style.background = "linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(0, 255, 102, 0.05))";
        resultItem.style.boxShadow = "none";
      });

      resultsDiv.appendChild(resultItem);
    });
  } catch (err) {
    console.error("Search error:", err);
    showNotif("Error: " + err.message, "error");
    document.getElementById("search-results").innerHTML = "<div style='padding: 16px; text-align: center; color: #ff4d4d;'>Error searching</div>";
  }
}

// Event listeners are now properly attached in initializeAppAfterAuth() and setupInitialization()
// to ensure DOM elements exist before attaching listeners

function goBack() {
  currentChatUser = null;
  const messages = document.getElementById("messages-area");
  if (messages) {
    messages.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <p>Select a chat to start messaging</p>
        <p class="empty-hint">Search for users or select from contacts</p>
      </div>
    `;
  }
  document.getElementById("chatName").textContent = "Select a chat";
  document.getElementById("chatProfilePic").src = "";
  document.getElementById("statusText").textContent = "Offline";
  if (messageListener) messageListener();
}

function initializeEmojiPicker() {
  const emojiGrid = document.getElementById("emoji-grid");
  if (emojiGrid) {
    emojiGrid.innerHTML = emojis.map(e =>
      `<button type="button" class="emoji-item" data-emoji="${e}" style="background: none; border: 1px solid #ddd; font-size: 20px; cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.2s">${e}</button>`
    ).join("");

    emojiGrid.addEventListener("click", (e) => {
      if (e.target.classList.contains("emoji-item")) {
        const emoji = e.target.getAttribute("data-emoji");
        const input = document.getElementById("message-input");
        input.value += emoji;
        input.focus();
      }
    });
  }
}

function toggleEmojiPicker() {
  const picker = document.getElementById("emoji-picker");
  if (picker) {
    picker.style.display = picker.style.display === "none" ? "block" : "none";
  }
}

document.getElementById("emoji-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  toggleEmojiPicker();
});

document.getElementById("close-emoji-btn")?.addEventListener("click", () => {
  document.getElementById("emoji-picker").style.display = "none";
});

// Sticker/Status button functionality
document.getElementById("sticker-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  openQuickStatusModal();
});

function openQuickStatusModal() {
  if (!myUID) {
    showNotif("Please log in first", "error");
    return;
  }

  const modal = document.createElement("div");
  modal.id = "quick-status-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: flex-end;
    z-index: 1000;
    animation: slideUpModal 0.3s ease-out;
    `;

  modal.innerHTML = `
      <div style="
    background: #1a1a1a;
    border-radius: 20px 20px 0 0;
    padding: 20px;
    width: 100%;
    max-width: 500px;
    box-shadow: 0 -4px 20px rgba(0, 255, 102, 0.2);
    border: 1px solid #00ff66;
    border-bottom: none;
    ">
      <h3 style="
    color: #00ff66;
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 8px 0;
    text-align: center;
    ">✨ Post a Quick Status</h3>

      <p style="
    color: rgba(0, 255, 102, 0.7);
    font-size: 12px;
    margin: 0 0 12px 0;
    text-align: center;
    ">Visible only to users you've chatted with 🔒</p>

      <textarea id="quick-status-input"
    placeholder="What's on your mind? (max 150 characters)"
    maxlength="150"
    style="
    width: 100%;
    padding: 12px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid #00ff66;
    border-radius: 12px;
    color: #00ff66;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    min-height: 80px;
    box-sizing: border-box;
    outline: none;
    "></textarea>

      <div style="
    display: flex;
    gap: 10px;
    margin-top: 16px;
    ">
      <button id="cancel-status-btn" style="
    flex: 1;
    padding: 12px;
    background: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    ">Cancel</button>
      <button id="post-quick-status-btn" style="
    flex: 1;
    padding: 12px;
    background: #00ff66;
    color: #000;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    ">Post Status ✨</button>
      </div>
    </div>
      `;

  // Add animation styles
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideUpModal {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    `;
  document.head.appendChild(style);

  document.body.appendChild(modal);

  const input = document.getElementById("quick-status-input");
  const postBtn = document.getElementById("post-quick-status-btn");
  const cancelBtn = document.getElementById("cancel-status-btn");

  input.focus();

  postBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) {
      showNotif("Status cannot be empty", "error");
      return;
    }

    try {
      // Get list of users this person has chatted with
      const chattedUsers = await getChattedUsers(myUID);
      console.log("📊 Quick Status posting - Chatted users:", chattedUsers);

      const statusesRef = collection(db, "statuses");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const statusData = {
        userId: myUID,
        text: text,
        timestamp: serverTimestamp(),
        expiresAt: expiresAt,
        likes: 0,
        comments: [],
        visibleTo: chattedUsers // Only visible to chatted users
      };

      console.log("📝 Saving quick status with data:", statusData);

      await addDoc(statusesRef, statusData);

      showNotif("✅ Status posted! (Visible only to users you've chatted with)", "success", 2000);
      hapticFeedback('success');
      modal.remove();
      style.remove();
    } catch (err) {
      console.error("Error posting status:", err);
      showNotif("Error posting status: " + err.message, "error");
    }
  });

  cancelBtn.addEventListener("click", () => {
    modal.remove();
    style.remove();
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      style.remove();
    }
  });
}

async function sendMessage(e) {
  if (e) e.preventDefault();

  console.log("📤 Send message triggered"); // Debug log

  if (!currentChatUser) {
    showNotif("Select a chat first", "error");
    console.warn("❌ No chat selected");
    return;
  }

  const messageText = document.getElementById("message-input");
  const text = messageText?.value.trim();

  // Allow message if there's text OR a file attachment
  if (!text && !selectedFile) {
    showNotif("Message or file attachment required", "error");
    return;
  }

  // Check if user has tokens
  if (!myUID) {
    showNotif("❌ Please log in first", "error");
    return;
  }

  // Check internet connection
  if (!navigator.onLine) {
    console.log("📵 User is offline - queueing message");
    await storeOfflineMessage(currentChatUser, text, currentChatType, selectedFile?.name || null);

    // Show optimistic UI
    messageText.value = "";
    selectedFile = null;
    document.getElementById("attachment-preview").style.display = "none";
    showNotif("📵 You're offline - message will send when online", "info", 3000);
    hapticFeedback('light');
    return;
  }

  try {
    // Get current user's tokens
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      showNotif("❌ User profile not found", "error");
      return;
    }

    const currentTokens = userDoc.data()?.tokens ?? 0;

    // Check if user has at least 1 token
    if (currentTokens < 1) {
      showNotif("❌ Insufficient tokens! You need at least 1 token to send a message. 💳", "error");
      return;
    }

    hapticFeedback('light');

    let newTokens = currentTokens - 1;
    let attachment = null;

    // Upload file if selected
    if (selectedFile) {
      showNotif("📤 Uploading file...", "info");
      try {
        attachment = await uploadFileToStorage(selectedFile, currentChatUser, currentChatType === 'group');
        showNotif("✅ File uploaded successfully!", "success", 2000);
      } catch (uploadErr) {
        console.error("❌ File upload failed:", uploadErr);
        showNotif("❌ Failed to upload file: " + uploadErr.message, "error");
        throw uploadErr;
      }
    }

    // Send message based on chat type
    if (currentChatType === 'group') {
      // Group message
      console.log("📤 Sending group message to:", currentChatUser);
      await sendGroupMessage(currentChatUser, text, attachment);
    } else {
      // Direct message
      console.log("📤 Sending direct message to:", currentChatUser);
      const messageData = {
        from: myUID,
        to: currentChatUser,
        text: text || "",
        time: serverTimestamp(),
        read: false,
        type: "text",
        edited: false,
        reactions: []
      };

      // Add attachment if present
      if (attachment) {
        messageData.attachment = attachment;
      }

      await addDoc(collection(db, "messages"), messageData);

      // Deduct 1 token
      await updateDoc(userRef, {
        tokens: newTokens,
        lastMessageSentAt: serverTimestamp()
      });

      // Track message activity
      try {
        await addDoc(collection(db, 'messageActivity'), {
          userId: myUID,
          recipientId: currentChatUser,
          sentAt: new Date(),
          messageLength: text.length,
          hasAttachment: !!attachment,
          tokensCost: 1
        });
      } catch (trackErr) {
        console.warn('Warning: Could not track message activity:', trackErr);
      }
    }

    // Update token display
    const tokenDisplay = document.getElementById("tokenCount");
    if (tokenDisplay) {
      tokenDisplay.textContent = newTokens;
    }

    messageText.value = "";
    removeAttachment();
    hapticFeedback('success');
    showNotif(`✓ Message sent(-1 token, ${newTokens} remaining)`, "success", 2000);
    document.getElementById("emoji-picker").style.display = "none";
    console.log("✅ Message sent successfully");
  } catch (err) {
    hapticFeedback('heavy');
    console.error("❌ Error sending message:", err);
    showNotif("Error sending message: " + err.message, "error");
  }
}

function loadMessages() {
  if (!currentChatUser) {
    console.warn("⚠️ loadMessages: No currentChatUser set");
    return;
  }

  console.log("📨 Loading messages for chat with:", currentChatUser);
  console.log("📨 Current user UID:", myUID);

  if (messageListener) messageListener();

  const messagesDiv = document.getElementById("messages-area");
  if (!messagesDiv) {
    console.error("❌ messages-area element not found");
    return;
  }

  messagesDiv.innerHTML = "<p style='text-align: center; color: #888; padding: 20px;'>Loading messages...</p>";

  // Query for messages sent by current user to chat user OR from chat user to current user
  // Note: Using limit without orderBy to avoid composite index requirement, we'll sort in JS
  const q = query(
    collection(db, "messages"),
    where("from", "==", myUID),
    where("to", "==", currentChatUser),
    limit(100)
  );

  const q2 = query(
    collection(db, "messages"),
    where("from", "==", currentChatUser),
    where("to", "==", myUID),
    limit(100)
  );

  let messages1 = [];
  let messages2 = [];
  let loaded1 = false;
  let loaded2 = false;

  const updateMessages = () => {
    if (!loaded1 || !loaded2) {
      console.log("📊 Progress - loaded1:", loaded1, "loaded2:", loaded2);
      return;
    }

    console.log("✅ Both queries loaded. Messages1:", messages1.length, "Messages2:", messages2.length);

    const allMessages = [...messages1, ...messages2].sort((a, b) => {
      const timeA = a.time?.toDate?.() || new Date(0);
      const timeB = b.time?.toDate?.() || new Date(0);
      return timeA - timeB;
    });

    messagesDiv.innerHTML = "";

    if (allMessages.length === 0) {
      console.log("📭 No messages found between users");
      messagesDiv.innerHTML = `
      <div class="empty-state">
          <div class="empty-icon">💭</div>
          <p>No messages yet</p>
          <p class="empty-hint">Start the conversation!</p>
        </div>
      `;
      return;
    }

    allMessages.forEach((m) => {
      const isOwn = m.from === myUID;

      const div = document.createElement("div");
      div.className = `message-wrapper ${isOwn ? "sent" : "received"}`;
      div.style.cssText = `
    display: flex;
    justify-content: ${isOwn ? "flex-end" : "flex-start"};
    margin: 8px 0;
    padding: 0 12px;
    `;

      const msgDate = m.time?.toDate?.() || new Date();
      const time = formatTime(msgDate);

      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.style.cssText = `
    background: ${isOwn ? "#00ff66" : "#222"};
    color: ${isOwn ? "#000" : "#fff"};
    padding: 10px 14px;
    border-radius: 12px;
    max-width: 70%;
    word-wrap: break-word;
    transition: all 0.2s;
    `;

      const content = document.createElement("p");
      content.style.margin = "0";
      content.textContent = m.text;

      const timeSpan = document.createElement("div");
      timeSpan.style.cssText = `font-size: 11px; margin-top: 4px; opacity: 0.7; display: flex; align-items: center; gap: 4px;`;

      // Add read receipt for sent messages
      let receiptText = time + (m.edited ? " (edited)" : "");
      if (isOwn) {
        // Show read receipt checkmarks for own messages
        if (m.read) {
          receiptText = '✓✓ ' + receiptText; // Double checkmark for read
        } else {
          receiptText = '✓ ' + receiptText;  // Single checkmark for sent
        }
      }
      timeSpan.textContent = receiptText;

      bubble.appendChild(content);
      bubble.appendChild(timeSpan);

      bubble.addEventListener("mouseenter", () => {
        bubble.style.transform = "scale(1.02)";
      });
      bubble.addEventListener("mouseleave", () => {
        bubble.style.transform = "scale(1)";
      });

      div.appendChild(bubble);
      messagesDiv.appendChild(div);
    });

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  messageListener = onSnapshot(q, (snap) => {
    console.log("✅ Query 1 snapshot received:", snap.docs.length, "messages");
    messages1 = snap.docs.map(docSnap => ({ ...docSnap.data(), docId: docSnap.id }));
    loaded1 = true;
    updateMessages();
  }, (err) => {
    console.error("❌ Error loading outgoing messages:", err);
    console.error("   Error Code:", err.code);
    console.error("   Error Message:", err.message);

    // Show error to user
    if (err.code === 'permission-denied') {
      showNotif("⚠️ Permission denied - check Firestore rules", "error", 3000);
    } else if (err.code === 'failed-precondition') {
      showNotif("📝 Creating database index... Try again in a moment", "info", 3000);
    } else {
      showNotif(`⚠️ Error: ${err.message} `, "error", 3000);
    }

    loaded1 = true; // Mark as loaded even with error
    updateMessages();
  });

  onSnapshot(q2, (snap) => {
    console.log("✅ Query 2 snapshot received:", snap.docs.length, "messages");
    messages2 = snap.docs.map(docSnap => ({ ...docSnap.data(), docId: docSnap.id }));
    loaded2 = true;
    updateMessages();
  }, (err) => {
    console.error("❌ Error loading incoming messages:", err);
    console.error("   Error Code:", err.code);
    console.error("   Error Message:", err.message);

    // Show error to user
    if (err.code === 'permission-denied') {
      showNotif("⚠️ Permission denied - check Firestore rules", "error", 3000);
    } else if (err.code === 'failed-precondition') {
      showNotif("📝 Creating database index... Try again in a moment", "info", 3000);
    } else {
      showNotif(`⚠️ Error: ${err.message} `, "error", 3000);
    }

    loaded2 = true; // Mark as loaded even with error
    updateMessages();
  });
}

// Attach message form listener
const messageForm = document.getElementById("message-form");
if (messageForm) {
  messageForm.addEventListener("submit", sendMessage);
  console.log("✅ Message form listener attached");
} else {
  console.warn("⚠️ Message form element not found");
}

// ============================================================
// CONTACTS & USER MANAGEMENT
// ============================================================

async function loadContacts() {
  const user = auth.currentUser;
  if (!user) return;

  const contactList = document.getElementById("contactList");
  if (!contactList) return;

  contactList.innerHTML = "";

  try {
    let allChats = [];
    const chatMap = new Map(); // To avoid duplicates

    // Load user's groups
    const groupsRef = collection(db, "groups");
    const groupsQuery = query(groupsRef, where("members", "array-contains", user.uid));
    const groupsSnapshot = await getDocs(groupsQuery);

    // Add groups first
    groupsSnapshot.forEach(groupDoc => {
      const groupData = groupDoc.data();
      chatMap.set(groupDoc.id, {
        id: groupDoc.id,
        name: groupData.name || "Unknown Group",
        type: 'group',
        pic: '👥',
        lastMessage: groupData.lastMessage || 'No messages yet',
        timestamp: groupData.lastMessageTime?.toMillis?.() || 0
      });
    });

    // Load all messages sent by current user
    try {
      const sentMessagesRef = collection(db, "messages");
      const sentQuery = query(sentMessagesRef, where("from", "==", user.uid));
      const sentSnapshot = await getDocs(sentQuery);

      sentSnapshot.forEach(msgDoc => {
        const msg = msgDoc.data();
        const contactId = msg.to;
        if (contactId && !chatMap.has(contactId)) {
          chatMap.set(contactId, {
            id: contactId,
            name: 'Loading...',
            type: 'direct',
            pic: '👤',
            userData: null,
            timestamp: msg.time?.toMillis?.() || Date.now()
          });
        }
      });
    } catch (err) {
      console.log("Error loading sent messages:", err);
    }

    // Load all messages received by current user
    try {
      const receivedMessagesRef = collection(db, "messages");
      const receivedQuery = query(receivedMessagesRef, where("to", "==", user.uid));
      const receivedSnapshot = await getDocs(receivedMessagesRef);

      receivedSnapshot.forEach(msgDoc => {
        const msg = msgDoc.data();
        const contactId = msg.from;
        if (contactId && !chatMap.has(contactId)) {
          chatMap.set(contactId, {
            id: contactId,
            name: 'Loading...',
            type: 'direct',
            pic: '👤',
            userData: null,
            timestamp: msg.time?.toMillis?.() || Date.now()
          });
        }
      });
    } catch (err) {
      console.log("Error loading received messages:", err);
    }

    // Load all users to get their info and check for blocked status
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);
    const userDataMap = new Map();
    let blockedUsers = [];

    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      userDataMap.set(userDoc.id, userData);

      // Get current user's blocked list
      if (userDoc.id === myUID) {
        blockedUsers = userData.blockedUsers || [];
      }
    });

    // Update chat entries with user info
    for (const [chatId, chatData] of chatMap.entries()) {
      if (chatData.type === 'direct') {
        const userData = userDataMap.get(chatId);

        if (userData && userData.uid !== myUID && chatId !== myUID) {
          const profilePic = userData.profilePic || userData.profilePicUrl;
          const displayName = userData.username || userData.name || userData.email;

          if (displayName) {
            chatData.name = displayName;
            chatData.pic = profilePic || '👤';
            chatData.userData = userData;
          }
        }
      }
    }

    // Convert map to array and sort by timestamp (most recent first)
    allChats = Array.from(chatMap.values()).sort((a, b) => b.timestamp - a.timestamp);

    // Filter out invalid entries and the current user
    allChats = allChats.filter(chat => {
      if (chat.name === 'Loading...') return false;
      if (chat.type === 'direct' && (chat.name === myUID || chat.id === myUID)) return false;
      return true;
    });

    let firstContact = null;
    let firstContactId = null;
    let firstContactName = null;
    let firstContactPic = null;

    // Display all chats
    for (const chat of allChats) {
      let lastMessage = chat.lastMessage || "No messages yet";
      let timestamp = chat.timestamp || Date.now();

      if (chat.type === 'direct') {
        // Get last message for direct chats
        try {
          const sentMsgs = await getDocs(query(
            collection(db, "messages"),
            where("from", "==", user.uid),
            where("to", "==", chat.id),
            orderBy("time", "desc"),
            limit(1)
          ));

          const receivedMsgs = await getDocs(query(
            collection(db, "messages"),
            where("from", "==", chat.id),
            where("to", "==", user.uid),
            orderBy("time", "desc"),
            limit(1)
          ));

          let latestMsg = null;
          let latestTime = 0;

          if (sentMsgs.docs.length > 0) {
            const msg = sentMsgs.docs[0].data();
            const msgTime = msg.time?.toMillis?.() || 0;
            if (msgTime > latestTime) {
              latestMsg = msg;
              latestTime = msgTime;
            }
          }

          if (receivedMsgs.docs.length > 0) {
            const msg = receivedMsgs.docs[0].data();
            const msgTime = msg.time?.toMillis?.() || 0;
            if (msgTime > latestTime) {
              latestMsg = msg;
              latestTime = msgTime;
            }
          }

          if (latestMsg) {
            lastMessage = latestMsg.text?.substring(0, 40) || "No messages yet";
            timestamp = latestTime;

            // Check if we sent or received the last message
            if (latestMsg.from === user.uid) {
              // We sent it
              chat.messageDelivered = true;
              chat.messageRead = latestMsg.read === true;
            } else {
              // We received it - check for unread
              chat.unread = !latestMsg.read;
              if (chat.unread) {
                announceIncomingMessage(chat.name);
              }
            }

            if (lastMessage.length > 40) {
              lastMessage += "...";
            }
          }
        } catch (msgErr) {
          console.log("Error fetching messages:", msgErr.message);
          lastMessage = "No messages yet";
        }

        // Store first contact for auto-load
        if (!firstContact) {
          firstContact = chat;
          firstContactId = chat.id;
          firstContactName = chat.name;
          firstContactPic = chat.pic;
        }
      }

      // Get relative time
      const now = Date.now();
      const diff = now - timestamp;
      let timeStr = "Just now";
      if (diff > 86400000) timeStr = Math.floor(diff / 86400000) + "d ago";
      else if (diff > 3600000) timeStr = Math.floor(diff / 3600000) + "h ago";
      else if (diff > 60000) timeStr = Math.floor(diff / 60000) + "m ago";
      else if (diff > 1000) timeStr = Math.floor(diff / 1000) + "s ago";

      const contactItem = document.createElement("div");
      contactItem.className = "chat-list-item";

      // Create profile image HTML
      let profileHTML = '';
      if (chat.pic && (chat.pic.startsWith('data:') || chat.pic.startsWith('http'))) {
        profileHTML = `<img class="chat-avatar" src="${escape(chat.pic)}" alt="${escape(chat.name)}">`;
      } else {
        const bgColor = chat.type === 'group' ? '#00d4ff' : '#00ff66';
        const textColor = '#000';
        profileHTML = `<div class="chat-avatar" style="background: ${bgColor}; color: ${textColor}; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">${(chat.pic && chat.pic.charAt) ? chat.pic : (chat.name && chat.name.charAt(0) ? chat.name.charAt(0).toUpperCase() : '?')}</div>`;
      }

      // Determine read receipt status (checkmarks)
      let readReceipt = '';
      if (chat.type === 'direct') {
        // For sent messages, show single or double checkmark
        if (chat.messageRead) {
          readReceipt = '✓✓'; // Double checkmark for read messages (blue would be ideal but we'll use plain)
        } else if (chat.messageDelivered) {
          readReceipt = '✓✓'; // Double checkmark for delivered
        } else {
          readReceipt = '✓'; // Single checkmark for sent
        }
      }

      // Show unread indicator
      const unreadClass = chat.unread ? 'unread' : '';

      contactItem.innerHTML = `
        ${profileHTML}
        <div class="chat-item-content ${unreadClass}">
          <div class="chat-item-header">
            <span class="chat-name">${escape(chat.name)} ${chat.type === 'group' ? '👥' : ''}</span>
          </div>
          <div class="chat-preview">
            <span class="read-receipt">${readReceipt}</span>
            ${escape(lastMessage)}
          </div>
        </div>
        <div class="chat-time-container">
          <span class="chat-item-time">${timeStr}</span>
          ${chat.unread ? '<span class="unread-badge"></span>' : ''}
        </div>
    `;

      // Add data attributes for filtering
      contactItem.setAttribute("data-chat-id", chat.id);
      contactItem.setAttribute("data-unread", chat.unread ? "true" : "false");
      contactItem.setAttribute("data-favorite", "false"); // TODO: Implement favorites
      contactItem.setAttribute("data-is-group", chat.type === 'group' ? "true" : "false");

      contactItem.style.cursor = "pointer";

      // Add right-click context menu for archive
      contactItem.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showChatContextMenu(e, chat.id);
      });

      // Regular click to open chat
      contactItem.onclick = () => {
        openChat(chat.id, chat.name, chat.pic, chat.type);
        showChatDetailView();
      };

      contactList.appendChild(contactItem);
    }

    // If no chats found, show empty state
    if (contactList.children.length === 0) {
      const emptyState = document.createElement("li");
      emptyState.className = "empty-state";
      emptyState.innerHTML = `
      < p > No chats yet</p >
        <p class="hint">Search for friends or create a group to start chatting</p>
    `;
      contactList.appendChild(emptyState);
    }

    // Auto-load the first chat if available
    if (firstContactId && firstContactName && !currentChatUser) {
      setTimeout(() => {
        openChat(firstContactId, firstContactName, firstContactPic || '👤', firstContact.type);
        showChatDetailView();
        console.log("✅ Auto-loaded first chat with:", firstContactName);
      }, 500);
    }
  } catch (err) {
    console.error("Error loading contacts:", err);
    showNotif("Error loading contacts: " + err.message, "error");
  }
}

// Stories/Reels functionality removed

// ============================================================
// OPEN CHAT & UPDATE UI
// ============================================================

async function openChat(uid, username, profilePic, chatType = 'direct') {
  currentChatUser = uid;
  currentChatType = chatType; // Store chat type (direct or group)

  document.getElementById("chatName").textContent = username;
  document.getElementById("chatProfilePic").src = profilePic || "👤";

  // Update info sidebar
  document.getElementById("infoName").textContent = username;
  document.getElementById("infoPic").src = profilePic || "👤";

  try {
    if (chatType === 'group') {
      // Load group info
      const groupDoc = await getDoc(doc(db, "groups", uid));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        document.getElementById("infoEmail").textContent = `Members: ${groupData.members.length} `;
        document.getElementById("statusText").textContent = `👥 Group Chat`;
        document.getElementById("infoStatus").textContent = `👥 Group Chat`;

        // Load group members for mention system
        groupMembers = [];
        for (const memberId of groupData.members) {
          const memberDoc = await getDoc(doc(db, 'users', memberId));
          if (memberDoc.exists()) {
            const memberData = memberDoc.data();
            groupMembers.push({
              uid: memberId,
              username: memberData.username || memberData.name,
              name: memberData.name
            });
          }
        }

        // Setup mention input listeners
        setTimeout(() => setupMentionInput(), 100);
      }
    } else {
      // Load individual user info
      const userDoc = await getDoc(doc(db, "users", uid));
      let userData = {};

      if (userDoc.exists()) {
        userData = userDoc.data();
        document.getElementById("infoEmail").textContent = userData.email || "";
        document.getElementById("statusText").textContent = userData.online ? "🟢 Online" : "⚫ Offline";
        document.getElementById("infoStatus").textContent = userData.online ? "🟢 Online" : "⚫ Offline";
      } else {
        // User document doesn't exist yet, but allow chatting with UID
        console.warn("User document not found in database, but proceeding with UID:", uid);
        document.getElementById("infoEmail").textContent = "Profile pending...";
        document.getElementById("statusText").textContent = "⚪ Pending";
        document.getElementById("infoStatus").textContent = "⚪ Pending";
        showNotif("ℹ️ User profile not fully synced yet. Chat enabled via UID.", "info");
      }

      // Automatically add to contacts if not already there
      try {
        const myUserRef = doc(db, "users", myUID);
        const myUserDoc = await getDoc(myUserRef);
        const myContacts = myUserDoc.data()?.contacts || [];

        if (!myContacts.includes(uid)) {
          myContacts.push(uid);
          await updateDoc(myUserRef, { contacts: myContacts });
          console.log("✅ Added user to contacts");

          // Reload the contacts list to show the new conversation
          setTimeout(() => {
            loadContacts();
          }, 300);
        }
      } catch (contactErr) {
        console.warn("Could not update contacts:", contactErr);
      }
    }

    // Show chat view
    showChatDetailView();

    // Update UI elements based on chat type
    const pollBtn = document.getElementById('poll-btn');

    if (chatType === 'group') {
      // Show poll button for group chats
      if (pollBtn) pollBtn.style.display = 'block';
    } else {
      // Hide poll button for direct chats
      if (pollBtn) pollBtn.style.display = 'none';
      // Update block/unblock button visibility
      setTimeout(() => updateBlockUnblockUI(), 100);
    }

  } catch (err) {
    console.error("Error loading chat info:", err);
    showNotif("❌ Error loading chat info: " + err.message, "error");
    currentChatUser = null;
    return;
  }

  // Load appropriate messages based on chat type
  if (chatType === 'group') {
    loadGroupMessages(uid);
  } else {
    loadMessages();
  }
}

document.getElementById("menuBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const menu = document.getElementById("chatOptionsMenu");
  const menuBtn = document.getElementById("menuBtn");

  if (menu) {
    const isVisible = menu.style.display !== "none";

    if (!isVisible) {
      // Position the menu when opening
      menu.style.display = "block";

      // Get button position and size
      if (menuBtn) {
        const rect = menuBtn.getBoundingClientRect();
        menu.style.top = (rect.bottom + 5) + "px";
        menu.style.right = (window.innerWidth - rect.right) + "px";
      }
    } else {
      menu.style.display = "none";
    }

    // Show/hide group admin button based on chat type
    const adminBtn = document.getElementById("groupAdminBtn");
    if (adminBtn) {
      adminBtn.style.display = currentChatType === 'group' ? 'block' : 'none';
    }
  }
});

// Close menu when clicking outside
document.addEventListener("click", (e) => {
  const menu = document.getElementById("chatOptionsMenu");
  const menuBtn = document.getElementById("menuBtn");

  if (menu && menuBtn && !menu.contains(e.target) && !menuBtn.contains(e.target)) {
    menu.style.display = "none";
  }
});

// Group admin button
document.getElementById("groupAdminBtn")?.addEventListener("click", () => {
  if (currentChatType === 'group' && currentChatUser) {
    showGroupAdminPanel(currentChatUser);
    document.getElementById("chatOptionsMenu").style.display = "none";
  }
});

// Chat header click for group settings - Open Info Panel
document.getElementById("chatHeaderProfile")?.addEventListener("click", () => {
  if (currentChatType === 'group' && currentChatUser) {
    showGroupInfoPanel(currentChatUser);
  } else if (currentChatType === 'direct' && currentChatUser) {
    showUserInfoPanel(currentChatUser);
  }
});

// Mute button functionality (if needed)
document.getElementById("muteBtn")?.addEventListener("click", async () => {
  if (!currentChatUser) return;
  showNotif("🔇 Chat muted", "success");
  document.getElementById("chatOptionsMenu").style.display = "none";
});

document.getElementById("blockBtn")?.addEventListener("click", async () => {
  if (!currentChatUser || !myUID) {
    showNotif("❌ Please log in first", "error");
    return;
  }

  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      showNotif("❌ User profile not found", "error");
      return;
    }

    const blockedUsers = userDoc.data()?.blockedUsers || [];

    if (!blockedUsers.includes(currentChatUser)) {
      await updateDoc(userRef, {
        blockedUsers: [...blockedUsers, currentChatUser]
      });
      showNotif("🚫 User blocked successfully (chat history preserved)", "success");
      // Update UI to show unblock button
      updateBlockUnblockUI();
      document.getElementById("chatOptionsMenu").style.display = "none";
    } else {
      showNotif("⚠️ User already blocked", "error");
    }
  } catch (err) {
    console.error("Block error:", err);
    showNotif("❌ Error blocking user: " + err.message, "error");
  }
  document.getElementById("chatOptionsMenu").style.display = "none";
});

// New unblock functionality
document.getElementById("unblockBtn")?.addEventListener("click", async () => {
  if (!currentChatUser || !myUID) {
    showNotif("❌ Please log in first", "error");
    return;
  }

  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      showNotif("❌ User profile not found", "error");
      return;
    }

    const blockedUsers = userDoc.data()?.blockedUsers || [];

    if (blockedUsers.includes(currentChatUser)) {
      const updatedBlockedUsers = blockedUsers.filter(uid => uid !== currentChatUser);
      await updateDoc(userRef, {
        blockedUsers: updatedBlockedUsers
      });
      showNotif("✅ User unblocked successfully", "success");
      // Update UI to show block button
      updateBlockUnblockUI();
      document.getElementById("chatOptionsMenu").style.display = "none";
    } else {
      showNotif("⚠️ User is not blocked", "error");
    }
  } catch (err) {
    console.error("Unblock error:", err);
    showNotif("❌ Error unblocking user: " + err.message, "error");
  }
  document.getElementById("chatOptionsMenu").style.display = "none";
});

// Function to update block/unblock button visibility
async function updateBlockUnblockUI() {
  if (!currentChatUser || !myUID) return;

  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    const blockedUsers = userDoc.data()?.blockedUsers || [];
    const isBlocked = blockedUsers.includes(currentChatUser);

    const blockBtn = document.getElementById("blockBtn");
    const unblockBtn = document.getElementById("unblockBtn");

    if (isBlocked) {
      if (blockBtn) blockBtn.style.display = "none";
      if (unblockBtn) unblockBtn.style.display = "block";
    } else {
      if (blockBtn) blockBtn.style.display = "block";
      if (unblockBtn) unblockBtn.style.display = "none";
    }
  } catch (err) {
    console.error("Error updating block/unblock UI:", err);
  }
}

document.getElementById("deleteBtn")?.addEventListener("click", async () => {
  if (!currentChatUser || !confirm("Delete this chat? Messages will be removed.")) return;

  try {
    const q = query(
      collection(db, "messages"),
      where("from", "in", [myUID, currentChatUser])
    );
    const snap = await getDocs(q);

    const batch = [];
    snap.forEach(docSnap => {
      const m = docSnap.data();
      if ((m.from === myUID && m.to === currentChatUser) ||
        (m.from === currentChatUser && m.to === myUID)) {
        batch.push(deleteDoc(docSnap.ref));
      }
    });

    await Promise.all(batch);
    showNotif("🗑️ Chat deleted", "success");
    goBack();
  } catch (err) {
    showNotif("Error deleting chat: " + err.message, "error");
  }
  document.getElementById("chatOptionsMenu").style.display = "none";
});

document.getElementById("reportBtn")?.addEventListener("click", async () => {
  if (!currentChatUser || !myUID) return;

  try {
    const reportRef = collection(db, "reports");
    await addDoc(reportRef, {
      reportedBy: myUID,
      reportedUser: currentChatUser,
      reason: "User reported from chat",
      timestamp: serverTimestamp(),
      status: "pending"
    });

    showNotif("✅ User reported successfully - Our team will review this", "success");
    document.getElementById("chatOptionsMenu").style.display = "none";
  } catch (err) {
    console.error("Report error:", err);
    showNotif("❌ Error submitting report: " + err.message, "error");
  }
});

// Request permissions for media devices
async function requestMediaPermissions(isVideo = false) {
  try {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: isVideo ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      } : false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (err) {
    console.error('Permission denied or device not found:', err);
    if (err.name === 'NotAllowedError') {
      showNotif('❌ Camera/Microphone permission denied. Enable in settings.', 'error', 4000);
    } else if (err.name === 'NotFoundError') {
      showNotif('❌ No camera or microphone found on this device', 'error', 4000);
    } else {
      showNotif(`❌ Error accessing device: ${err.message} `, 'error', 4000);
    }
    return null;
  }
}

function startCall(isVideo = false) {
  if (!currentChatUser) {
    showNotif('Select a chat first', 'error');
    return;
  }

  if (callActive) {
    showNotif('Call already in progress', 'info');
    return;
  }

  // Request permissions before starting call
  requestMediaPermissions(isVideo).then(stream => {
    if (!stream) return;

    callActive = true;
    callStartTime = Date.now();

    const callType = isVideo ? '📹 Video Call' : '📞 Voice Call';
    showNotif(`${callType} started with @${currentChatUser.substring(0, 8)}...`, 'success');
    hapticFeedback('medium');

    // Show call UI
    showCallUI(isVideo);

    // Start timer
    callTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = String(elapsed % 60).padStart(2, '0');
      const callDuration = document.getElementById('call-duration');
      if (callDuration) {
        callDuration.textContent = `${mins}:${secs} `;
      }
    }, 1000);

    // Stop all audio/video tracks after call ends
    stream.getTracks().forEach(track => {
      track.onended = () => {
        if (callActive) {
          endCall();
        }
      };
    });
  });
}

function showCallUI(isVideo = false) {
  // Create call overlay
  const callOverlay = document.createElement('div');
  callOverlay.id = 'call-overlay';
  callOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 999;
    padding: 20px;
    `;

  callOverlay.innerHTML = `
      < div style = "text-align: center; color: #fff;" >
        ${isVideo ? `
        <div id="video-container" style="
          width: 100%;
          max-width: 400px;
          height: 300px;
          background: #000;
          border: 2px solid #00ff66;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="color: #00ff66; font-size: 14px;">📹 Video stream active</span>
        </div>
      ` : ''
    }
      <h2 style="margin: 0 0 10px 0; color: #00ff66;">📞 ${isVideo ? 'Video' : 'Voice'} Call Active</h2>
      <p id="call-duration" style="margin: 0 0 20px 0; font-size: 32px; color: #00ff66; font-weight: 700;">0:00</p>
      <p style="margin: 0 0 20px 0; color: #aaa;">with ${currentChatUser}</p>
      <button id="end-call-btn" style="
        padding: 12px 30px;
        background: #ff4444;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      ">🔴 End Call</button>
    </div >
      `;

  document.body.appendChild(callOverlay);

  const endBtn = document.getElementById('end-call-btn');
  endBtn.addEventListener('click', () => {
    endCall();
    callOverlay.remove();
  });

  // Allow pressing Escape to end call
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      endCall();
      callOverlay.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function endCall() {
  if (callTimer) clearInterval(callTimer);
  callActive = false;
  callStartTime = null;

  // Stop all media tracks
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      devices.forEach(device => {
        // Devices will auto-stop when streams are garbage collected
      });
    }).catch(err => console.warn('Could not enumerate devices:', err));
  }

  showNotif('📞 Call ended', 'info');
  hapticFeedback('light');
}

document.getElementById("callBtn")?.addEventListener("click", () => {
  startCall(false);
  document.getElementById("chatOptionsMenu").style.display = "none";
});

document.getElementById("videoCallBtn")?.addEventListener("click", () => {
  startCall(true);
  document.getElementById("chatOptionsMenu").style.display = "none";
});

document.getElementById("infoCallBtn")?.addEventListener("click", () => {
  startCall(false);
});

document.getElementById("infoVideoBtn")?.addEventListener("click", () => {
  startCall(true);
});

document.getElementById("infoBtn")?.addEventListener("click", () => {
  const sidebar = document.getElementById("infoSidebar");
  if (sidebar && currentChatUser) {
    sidebar.style.display = sidebar.style.display === "none" ? "block" : "none";
  }
});

document.getElementById("closeInfoBtn")?.addEventListener("click", () => {
  document.getElementById("infoSidebar").style.display = "none";
});

document.getElementById("infoBlockBtn")?.addEventListener("click", async () => {
  if (!currentChatUser || !myUID) {
    showNotif("❌ Please log in first", "error");
    return;
  }

  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      showNotif("❌ User profile not found", "error");
      return;
    }

    const blockedUsers = userDoc.data()?.blockedUsers || [];

    if (!blockedUsers.includes(currentChatUser)) {
      await updateDoc(userRef, {
        blockedUsers: [...blockedUsers, currentChatUser]
      });
      showNotif("🚫 User blocked successfully", "success");
      document.getElementById("infoSidebar").style.display = "none";
      setTimeout(() => goBack(), 500);
    } else {
      showNotif("⚠️ User already blocked", "error");
    }
  } catch (err) {
    console.error("Block error:", err);
    showNotif("❌ Error blocking user: " + err.message, "error");
  }
});

document.getElementById("infoDeleteBtn")?.addEventListener("click", async () => {
  if (!currentChatUser || !confirm("Delete this chat?")) return;

  try {
    const q = query(collection(db, "messages"));
    const snap = await getDocs(q);

    const batch = [];
    snap.forEach(docSnap => {
      const m = docSnap.data();
      if ((m.from === myUID && m.to === currentChatUser) ||
        (m.from === currentChatUser && m.to === myUID)) {
        batch.push(deleteDoc(docSnap.ref));
      }
    });

    await Promise.all(batch);
    showNotif("Chat deleted", "success");
    goBack();
  } catch (err) {
    showNotif("Error: " + err.message, "error");
  }
});

document.getElementById("infoReportBtn")?.addEventListener("click", async () => {
  if (!currentChatUser || !myUID) return;

  try {
    const reportRef = collection(db, "reports");
    await addDoc(reportRef, {
      reportedBy: myUID,
      reportedUser: currentChatUser,
      reason: "User reported from info panel",
      timestamp: serverTimestamp(),
      status: "pending"
    });

    showNotif("✅ User reported successfully - Our team will review this", "success");
    document.getElementById("infoSidebar").style.display = "none";
  } catch (err) {
    console.error("Report error:", err);
    showNotif("❌ Error submitting report: " + err.message, "error");
  }
});

document.getElementById("settingsBtn")?.addEventListener("click", () => {
  showNotif("⚙️ Settings - Coming soon!", "info");
});

window.logoutUser = async function () {
  if (!confirm("🚪 Are you sure you want to exit NEXCHAT?")) {
    return;
  }

  try {
    if (myUID) {
      await updateDoc(doc(db, "users", myUID), { online: false });
    }
    await signOut(auth);
    showNotif("👋 See you soon!", "success", 1000);
    setTimeout(() => {
      window.location.href = "index.html";
    }, 500);
  } catch (err) {
    showNotif("Logout error: " + err.message, "error");
  }
};

document.getElementById("logout-btn")?.addEventListener("click", logoutUser);

document.getElementById("nav-messages")?.addEventListener("click", () => {
  showChatListView();
  showNotif("Messages", "info", 800);
});

document.getElementById("nav-status")?.addEventListener("click", () => {
  const statusContainer = document.getElementById("statusContainer");
  const chatListView = document.getElementById("chatListView");

  if (statusContainer.style.display === "none") {
    // Show status view
    chatListView.style.display = "none";
    statusContainer.style.display = "block";
    document.getElementById("nav-messages").classList.remove("active");
    document.getElementById("nav-status").classList.add("active");
    showNotif("📝 NEX-STATUS", "info", 800);
  } else {
    // Show messages view
    statusContainer.style.display = "none";
    chatListView.style.display = "block";
    document.getElementById("nav-status").classList.remove("active");
    document.getElementById("nav-messages").classList.add("active");
    showNotif("Messages", "info", 800);
  }
});

// NEX-REELS button - shows reels view and deducts 100 tokens for 1 hour access
// NEX-REELS functionality removed

// Profile and Reels buttons are now direct links in HTML

// ============================================================
// FILE ATTACHMENT FUNCTIONALITY
// ============================================================

let selectedFile = null;

document.getElementById("attach-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById("file-input")?.click();
});

document.getElementById("file-input")?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const maxSize = 50 * 1024 * 1024; // 50MB

  // Validate file size
  if (file.size > maxSize) {
    showNotif("❌ File too large (max 50MB)", "error", 2000);
    return;
  }

  // Validate file type
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf'
  ];

  if (!allowedTypes.includes(file.type)) {
    showNotif("❌ File type not supported. Use: Images, Videos, or PDF", "error", 2000);
    return;
  }

  selectedFile = file;
  showAttachmentPreview(file);
  showNotif(`✅ File selected: ${file.name} `, "success", 1500);
});

function showAttachmentPreview(file) {
  const preview = document.getElementById("attachment-preview");
  const nameEl = document.getElementById("attachment-name");

  if (preview && nameEl) {
    nameEl.textContent = file.name;
    preview.style.display = "block";
  }
}

document.getElementById("remove-attachment")?.addEventListener("click", (e) => {
  e.preventDefault();
  removeAttachment();
});

function removeAttachment() {
  selectedFile = null;
  const fileInput = document.getElementById("file-input");
  if (fileInput) fileInput.value = "";

  const preview = document.getElementById("attachment-preview");
  if (preview) preview.style.display = "none";

  showNotif("✗ Attachment removed", "info", 1000);
}

async function uploadFileToStorage(file, chatId, isGroup = false) {
  try {
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}_${Math.random().toString(36).substr(2, 9)}.${fileExt} `;

    const folderPath = isGroup ? `group - attachments / ${chatId} /${myUID}` : `chat-attachments/${myUID} `;
    const fileRef = storageRef(storage, `${folderPath}/${fileName}`);

    console.log(`📤 Uploading file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Upload file
    const snapshot = await uploadBytes(fileRef, file);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log(`✅ File uploaded successfully: ${downloadURL}`);

    return {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      downloadURL: downloadURL,
      uploadedAt: serverTimestamp()
    };
  } catch (error) {
    console.error("❌ Error uploading file:", error);
    throw error;
  }
}

let settingsInitialized = false;

async function transferTokens() {
  const recipientUID = document.getElementById("recipientUID")?.value.trim();
  const amount = parseInt(document.getElementById("transferAmount")?.value || 0);
  const resultEl = document.getElementById("transferResult");

  if (!resultEl) return;

  if (!recipientUID) {
    resultEl.textContent = "❌ Please enter recipient UID";
    resultEl.style.color = "#ff6600";
    return;
  }

  if (!amount || amount <= 0) {
    resultEl.textContent = "❌ Please enter a valid amount";
    resultEl.style.color = "#ff6600";
    return;
  }

  if (recipientUID === myUID) {
    resultEl.textContent = "❌ Cannot transfer to yourself";
    resultEl.style.color = "#ff6600";
    return;
  }

  try {
    resultEl.textContent = "⏳ Processing transfer...";
    resultEl.style.color = "#00ff66";

    const senderRef = doc(db, "users", myUID);
    const recipientRef = doc(db, "users", recipientUID);

    // Use transaction to ensure atomic update
    const result = await runTransaction(db, async (transaction) => {
      const senderDoc = await transaction.get(senderRef);
      const recipientDoc = await transaction.get(recipientRef);

      if (!senderDoc.exists()) {
        throw new Error("Your user data not found");
      }

      if (!recipientDoc.exists()) {
        throw new Error("Recipient not found");
      }

      const senderTokens = senderDoc.data()?.tokens ?? 0;
      const recipientTokens = recipientDoc.data()?.tokens ?? 0;

      // Validate tokens are numbers
      if (typeof senderTokens !== 'number' || typeof recipientTokens !== 'number') {
        throw new Error("Invalid token data format");
      }

      if (senderTokens < amount) {
        throw new Error(`Insufficient balance (You have ${senderTokens} tokens)`);
      }

      const newSenderTokens = Math.max(0, senderTokens - amount);
      const newRecipientTokens = Math.max(0, recipientTokens + amount);

      console.log(`💰 Transferring ${amount} tokens: ${senderTokens} → ${newSenderTokens} (sender), ${recipientTokens} → ${newRecipientTokens} (recipient)`);

      // Update both documents atomically
      transaction.update(senderRef, {
        tokens: newSenderTokens,
        lastTokenTransfer: serverTimestamp()
      });

      transaction.update(recipientRef, {
        tokens: newRecipientTokens,
        lastTokenReceived: serverTimestamp()
      });

      return {
        recipientName: recipientDoc.data()?.username || "user",
        amount,
        newSenderTokens,
        newRecipientTokens
      };
    });

    resultEl.textContent = `✅ Sent ${result.amount} tokens to ${result.recipientName}`;
    resultEl.style.color = "#00ff66";

    console.log(`✅ Transfer complete: ${result.amount} tokens sent to ${result.recipientName}`);

    document.getElementById("recipientUID").value = "";
    document.getElementById("transferAmount").value = "";

    setTimeout(() => {
      resultEl.textContent = "";
    }, 3000);

  } catch (err) {
    console.error("Transfer error:", err);
    console.error("Error code:", err.code);
    console.error("Error message:", err.message);

    let errorMsg = err.message;

    if (err.message && err.message.includes('offline')) {
      errorMsg = "❌ Network Error: Check your internet connection or Firestore security rules";
    } else if (err.code === 'permission-denied' || err.message?.includes('Permission denied')) {
      errorMsg = "❌ Permission Error: Check Firestore security rules - transfers may not be allowed";
    } else if (err.code === 'not-found') {
      errorMsg = "❌ User or data not found";
    } else if (err.code === 'invalid-argument') {
      errorMsg = "❌ Invalid data format - ensure all fields are correct";
    } else if (err.message?.includes('Insufficient balance')) {
      errorMsg = `❌ ${err.message}`;
    } else if (err.message?.includes('Recipient not found')) {
      errorMsg = "❌ Recipient not found";
    } else if (err.message?.includes('Your user data not found')) {
      errorMsg = "❌ Your user data not found";
    } else {
      errorMsg = `❌ Transfer failed: ${err.message}`;
    }

    resultEl.textContent = errorMsg;
    resultEl.style.color = "#ff6600";
  }
}

function openSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) {
    modal.style.display = "flex";
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";
    loadSettingsPreferences();

    // Display user UID
    const userUIDDisplay = document.getElementById("userUIDDisplay");
    if (userUIDDisplay && myUID) {
      userUIDDisplay.textContent = myUID;
    }

    // Add vibration feedback on Android
    if (isAndroid && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }
}

function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "auto";

    if (isAndroid && navigator.vibrate) {
      navigator.vibrate(30);
    }
  }
}

function loadSettingsPreferences() {
  try {
    const prefs = JSON.parse(localStorage.getItem("nexchat_settings")) || {};

    // Load with error handling
    const notifEl = document.getElementById("notifToggle");
    const soundEl = document.getElementById("soundToggle");
    const onlineEl = document.getElementById("onlineStatusToggle");
    const readEl = document.getElementById("readReceiptsToggle");

    if (notifEl) notifEl.checked = prefs.notifications !== false;
    if (soundEl) soundEl.checked = prefs.sound !== false;
    if (onlineEl) onlineEl.checked = prefs.onlineStatus !== false;
    if (readEl) readEl.checked = prefs.readReceipts !== false;

    const theme = prefs.theme || "dark";
    const themeEl = document.getElementById("theme" + theme.charAt(0).toUpperCase() + theme.slice(1));
    if (themeEl) themeEl.checked = true;

    console.log("✅ Settings loaded successfully", prefs);
  } catch (err) {
    console.error("Error loading settings:", err);
    showNotif("⚠️ Could not load settings", "error");
  }
}

function saveSettingsPreferences() {
  try {
    const notifEl = document.getElementById("notifToggle");
    const soundEl = document.getElementById("soundToggle");
    const onlineEl = document.getElementById("onlineStatusToggle");
    const readEl = document.getElementById("readReceiptsToggle");

    const prefs = {
      notifications: notifEl?.checked ?? true,
      sound: soundEl?.checked ?? true,
      onlineStatus: onlineEl?.checked ?? true,
      readReceipts: readEl?.checked ?? true,
      theme: document.querySelector('input[name="theme"]:checked')?.value || "dark",
      lastUpdated: new Date().toISOString()
    };

    localStorage.setItem("nexchat_settings", JSON.stringify(prefs));
    console.log("✅ Settings saved:", prefs);
    showNotif("✅ Settings saved", "success", 2000);

    // Apply settings immediately
    applySettings(prefs);
  } catch (err) {
    console.error("Error saving settings:", err);
    showNotif("❌ Failed to save settings", "error");
  }
}

function applySettings(prefs) {
  try {
    // Apply notification preferences
    if (!prefs.notifications) {
      console.log("📴 Notifications disabled");
    }

    // Apply theme
    if (prefs.theme === "light") {
      document.documentElement.style.colorScheme = "light";
      document.body.classList.add("light-theme");
      document.body.classList.remove("dark-theme");
    } else {
      document.documentElement.style.colorScheme = "dark";
      document.body.classList.add("dark-theme");
      document.body.classList.remove("light-theme");
    }

    // Vibration test on Android if enabled
    if (isAndroid && navigator.vibrate && prefs.sound) {
      // Only vibrate if explicitly enabled, don't vibrate on every load
      console.log("✅ Vibration support enabled");
    }

    // Store preferences for immediate application
    window.nexchatSettings = prefs;
  } catch (err) {
    console.error("Error applying settings:", err);
  }
}

function validateSettingsIntegrity() {
  try {
    const stored = localStorage.getItem("nexchat_settings");
    if (!stored) {
      console.log("ℹ️ No settings found, using defaults");
      return true;
    }

    const parsed = JSON.parse(stored);
    const required = ["notifications", "sound", "onlineStatus", "readReceipts", "theme"];
    const valid = required.every(key => key in parsed);

    if (!valid) {
      console.warn("⚠️ Settings missing required fields, resetting");
      localStorage.removeItem("nexchat_settings");
      return false;
    }

    console.log("✅ Settings integrity check passed");
    return true;
  } catch (err) {
    console.error("Error validating settings:", err);
    localStorage.removeItem("nexchat_settings");
    return false;
  }
}

// ============================================================
// DEBUG FUNCTIONS (for troubleshooting)
// ============================================================

/**
 * Test function to debug search issues
 * Usage: Call debugSearchUsers() in browser console
 */
window.debugSearchUsers = async function () {
  console.log("🔧 DEBUG: Testing Firestore user query...");
  console.log("📌 Current user UID:", myUID);

  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef);
    const snap = await getDocs(q);

    console.log("✅ Firestore query successful!");
    console.log("📊 Total users found:", snap.docs.length);
    console.log("📋 Users in database:");

    snap.docs.forEach(doc => {
      const userData = doc.data();
      console.log({
        uid: doc.id,
        username: userData.username,
        email: userData.email,
        name: userData.name,
        hasProfilePic: !!userData.profilePic,
        online: userData.online
      });
    });

    if (snap.docs.length === 0) {
      console.warn("⚠️  No users found in Firestore!");
    }
  } catch (err) {
    console.error("❌ Error querying users:", err);
  }
};

/**
 * Test function to check current auth state
 * Usage: Call debugAuthState() in browser console
 */
window.debugAuthState = function () {
  console.log("🔧 DEBUG: Checking auth state...");
  console.log("📌 myUID (from app):", myUID);
  console.log("📌 myUsername (from app):", myUsername);
  console.log("📌 auth.currentUser:", auth.currentUser);

  if (auth.currentUser) {
    console.log("✅ User is authenticated");
    console.log("📌 Current UID:", auth.currentUser.uid);
    console.log("📌 Current Email:", auth.currentUser.email);
  } else {
    console.log("❌ No user authenticated");
  }
};

/**
 * Force reload and test search
 * Usage: Call debugReloadAndSearch() in browser console
 */
window.debugReloadAndSearch = async function () {
  console.log("🔧 DEBUG: Reloading and testing search...");

  // Wait a moment for auth to initialize
  await new Promise(r => setTimeout(r, 1000));

  console.log("📌 Checking auth state...");
  if (!myUID) {
    console.warn("⚠️ User not authenticated yet");
    console.log("⏳ Waiting for auth...");
    let attempts = 0;
    while (!myUID && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
  }

  console.log("📌 Current myUID:", myUID);

  if (myUID) {
    console.log("✅ User authenticated, querying users...");
    await window.debugSearchUsers();
  } else {
    console.log("❌ User still not authenticated!");
  }
};

// loadReels() functionality removed - reels system disabled

// Check for video like milestones and reward tokens (1k likes = 1.5k tokens)
async function checkVideoLikeMilestones() {
  try {
    if (!myUID) return;

    // Get all videos uploaded by user
    const videosQuery = query(
      collection(db, 'videos'),
      where('authorId', '==', myUID)
    );

    const videosSnap = await getDocs(videosQuery);

    videosSnap.docs.forEach(async (docSnapshot) => {
      const video = docSnapshot.data();
      const likes = video.likes || 0;

      // Check if video has 1k likes and hasn't been rewarded yet
      if (likes >= 1000 && !video.tokensAwarded) {
        try {
          // Award 1.5k tokens to user
          const userRef = doc(db, 'users', myUID);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const currentTokens = userDoc.data()?.tokens ?? 0;
            const rewardTokens = 1500;
            const newTokens = currentTokens + rewardTokens;

            // Update user tokens
            await updateDoc(userRef, {
              tokens: newTokens
            });

            // Mark video as rewarded
            await updateDoc(docSnapshot.ref, {
              tokensAwarded: true,
              tokensAwardedAt: new Date(),
              tokenRewardAmount: rewardTokens
            });

            // Update token display
            const tokenDisplay = document.getElementById("tokenCount");
            if (tokenDisplay) {
              tokenDisplay.textContent = newTokens;
            }

            showNotif(`🎉 Milestone! Your video hit 1k likes! +1.5k tokens (${newTokens} total)`, "success", 3000);
            console.log(`✅ Rewarded ${rewardTokens} tokens for video with 1k likes`);
          }
        } catch (error) {
          console.error('Error rewarding tokens:', error);
        }
      }
    });
  } catch (error) {
    console.error('Error checking video milestones:', error);
  }
}

// Video like milestones check removed - reels disabled

// Handle video upload form submission removed - reels disabled

// Poll System Functions
async function createPoll(groupId, question, options) {
  if (!myUID || !groupId) return;

  try {
    // Deduct 1 token for poll creation
    if (tokens < 1) {
      showNotif('❌ Not enough tokens (need 1)', 'error');
      return;
    }

    await updateDoc(doc(db, 'users', myUID), {
      tokens: increment(-1)
    });

    // Create poll object
    const poll = {
      groupId,
      createdBy: myUID,
      question,
      options: options.map(opt => ({
        text: opt,
        votes: 0,
        voters: []
      })),
      timestamp: serverTimestamp(),
      totalVotes: 0
    };

    // Add poll to database
    const pollRef = await addDoc(collection(db, 'groupPolls'), poll);

    // Send poll message
    await addDoc(collection(db, 'groupMessages'), {
      groupId,
      from: myUID,
      text: `📊 Poll: ${question}`,
      pollId: pollRef.id,
      timestamp: serverTimestamp(),
      edited: false,
      isPoll: true
    });

    showNotif('✓ Poll created successfully', 'success', 1500);

    // Update group last message
    await updateDoc(doc(db, 'groups', groupId), {
      lastMessage: `📊 Poll: ${question}`,
      lastMessageTime: serverTimestamp()
    });

    // Reload messages
    loadGroupMessages(groupId);

  } catch (error) {
    console.error('Error creating poll:', error);
    showNotif(`Error: ${error.message}`, 'error');
  }
}

// Vote on a poll
async function votePoll(pollId, optionIndex) {
  if (!myUID) return;

  try {
    const pollRef = doc(db, 'groupPolls', pollId);
    const pollDoc = await getDoc(pollRef);

    if (!pollDoc.exists()) {
      showNotif('Poll not found', 'error');
      return;
    }

    const pollData = pollDoc.data();
    const options = pollData.options || [];

    // Check if user already voted
    let userVoted = false;
    options.forEach(opt => {
      if (opt.voters && opt.voters.includes(myUID)) {
        userVoted = true;
      }
    });

    if (userVoted) {
      showNotif('⚠️ You already voted on this poll', 'info');
      return;
    }

    // Remove from other options if needed (single vote)
    options.forEach((opt, idx) => {
      if (opt.voters) {
        opt.voters = opt.voters.filter(v => v !== myUID);
      }
    });

    // Add vote to selected option
    if (options[optionIndex]) {
      if (!options[optionIndex].voters) options[optionIndex].voters = [];
      options[optionIndex].voters.push(myUID);
      options[optionIndex].votes = options[optionIndex].voters.length;
    }

    // Update total votes
    const totalVotes = options.reduce((sum, opt) => sum + (opt.votes || 0), 0);

    // Update poll in database
    await updateDoc(pollRef, {
      options,
      totalVotes
    });

    showNotif('✓ Vote recorded', 'success', 1200);

    // Reload messages to show updated poll
    loadGroupMessages(pollData.groupId);

  } catch (error) {
    console.error('Error voting on poll:', error);
    showNotif(`Error: ${error.message}`, 'error');
  }
}

// Display poll in chat
function renderPoll(pollId, poll) {
  const pollHTML = document.createElement('div');
  pollHTML.style.cssText = `
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 255, 102, 0.05));
    border: 1px solid #00d4ff;
    border-radius: 12px;
    padding: 12px;
    margin: 8px 0;
  `;

  let optionsHTML = '';
  const totalVotes = poll.totalVotes || 0;
  const options = poll.options || [];

  options.forEach((opt, idx) => {
    const percentage = totalVotes > 0 ? (opt.votes / totalVotes * 100).toFixed(0) : 0;
    const userVoted = opt.voters && opt.voters.includes(myUID);
    const voteColor = userVoted ? '#00ff66' : '#00d4ff';

    optionsHTML += `
      <div style="margin: 10px 0;">
        <button onclick="votePoll('${pollId}', ${idx})" style="
          width: 100%;
          padding: 10px;
          background: linear-gradient(90deg, ${voteColor}40 0%, ${voteColor}10 ${percentage}%, transparent ${percentage}%);
          border: 1px solid ${voteColor};
          border-radius: 8px;
          color: #fff;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 13px;
          position: relative;
        ">
          <span style="font-weight: 600;">${opt.text}</span>
          <span style="float: right; color: ${voteColor}; font-weight: 700;">${opt.votes || 0} (${percentage}%)</span>
        </button>
      </div>
    `;
  });

  pollHTML.innerHTML = `
    <div style="color: #00ff66; font-weight: 600; margin-bottom: 10px;">📊 ${escape(poll.question)}</div>
    ${optionsHTML}
    <div style="color: #00d4ff; font-size: 12px; margin-top: 10px; text-align: right;">
      Total votes: ${totalVotes}
    </div>
  `;

  return pollHTML;
}

// Toggle dark mode function
function toggleDarkMode() {
  const isDarkMode = document.body.classList.contains("dark-mode");
  const toggle = document.getElementById("darkModeToggle");

  if (isDarkMode) {
    // Switch to light mode
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
    localStorage.setItem("darkMode", "false");
    toggle?.classList.remove("active");
    showNotif("☀️ Light mode enabled", "info");
  } else {
    // Switch to dark mode
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
    localStorage.setItem("darkMode", "true");
    toggle?.classList.add("active");
    showNotif("🌙 Dark mode enabled", "info");
  }
}

// Setup basic event listeners that don't require Firebase auth
function initializeBasicListeners() {
  // Dashboard back button
  document.getElementById("dashboardBackBtn")?.addEventListener("click", goBackToDashboard);

  // Message form
  const messageForm = document.getElementById("message-form");
  if (messageForm) {
    messageForm.addEventListener("submit", sendMessage);
  }

  const sendBtn = document.querySelector(".send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sendMessage(e);
    });
  }

  // Back button
  document.getElementById("backBtn")?.addEventListener("click", () => {
    showChatListView();
    goBack();
  });

  // Dark mode toggle
  const darkModeToggle = document.getElementById("darkModeToggle");
  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", toggleDarkMode);
  }

  // Poll button
  document.getElementById("poll-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentChatType === 'group') {
      document.getElementById("pollModal").style.display = "block";
    } else {
      showNotif("📊 Polls are only available in group chats", "info");
    }
  });

  // Poll form
  document.getElementById("pollForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = document.getElementById("pollQuestion").value.trim();
    const optionsText = document.getElementById("pollOptions").value.trim();
    if (!question || !optionsText) {
      showNotif("Please fill in all poll fields", "error");
      return;
    }
    const options = optionsText.split('\n').map(o => o.trim()).filter(o => o);
    if (options.length < 2) {
      showNotif("Poll must have at least 2 options", "error");
      return;
    }
    await createPoll(currentChatUser, question, options);
    document.getElementById("pollModal").style.display = "none";
    document.getElementById("pollForm").reset();
  });

  console.log("✅ Basic listeners initialized");
}

// Setup post-auth event listeners
function initializeAppAfterAuth() {
  // Search
  document.getElementById("search-btn-header")?.addEventListener("click", openSearch);
  document.getElementById("close-search-btn")?.addEventListener("click", closeSearch);
  document.getElementById("newChatBtn")?.addEventListener("click", openSearch);
  document.getElementById("browse-users-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    browseAllUsers();
  });
  document.getElementById("search-submit-btn")?.addEventListener("click", searchUser);
  document.getElementById("search-input")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchUser();
  });

  // Settings
  document.getElementById("settings-btn-header")?.addEventListener("click", () => {
    document.getElementById("settingsModal").style.display = "block";
  });
  document.getElementById("closeSettingsBtn")?.addEventListener("click", () => {
    saveSettingsPreferences();
    closeSettingsModal();
  });

  // Emojis


  console.log("✅ Post-auth listeners initialized");
}

// Initialize app after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupInitialization);
} else {
  setupInitialization();
}

async function setupInitialization() {
  // Setup basic listeners that don't depend on auth
  initializeBasicListeners();

  // Setup auth listener for post-auth initialization
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      myUID = user.uid;
      console.log("✅ User authenticated:", myUID);

      try {
        const userDoc = await getDoc(doc(db, "users", myUID));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          myUsername = userData.username || "";
          myProfilePic = userData.profilePic || "";

          // Get tokens from user data - should be 2000 for new users from registration
          const tokenCount = userData.tokens ?? 0;
          const tokenDisplay = document.getElementById("tokenCount");
          if (tokenDisplay) tokenDisplay.textContent = tokenCount;

          console.log("✅ User data loaded. Username:", myUsername, "Tokens:", tokenCount);

          if (userData.isAdmin) {
            const adminBtn = document.getElementById("adminPanelBtn");
            if (adminBtn) adminBtn.style.display = "block";
          }
        } else {
          console.log("⚠️ User document doesn't exist, creating one with 2000 tokens");
          try {
            await setDoc(doc(db, "users", myUID), {
              uid: myUID,
              email: user.email || "",
              username: user.displayName || "",
              tokens: 2000,
              online: true,
              lastSeen: serverTimestamp(),
              createdAt: serverTimestamp()
            });
            const tokenDisplay = document.getElementById("tokenCount");
            if (tokenDisplay) tokenDisplay.textContent = "2000";
          } catch (createErr) {
            console.error("Error creating user document:", createErr);
          }
        }

        // Listen for real-time token updates - ONLY update token display, don't reset
        const tokenSnapshotUnsubscribe = onSnapshot(doc(db, "users", myUID), (userDocSnapshot) => {
          if (userDocSnapshot.exists()) {
            const snapshotData = userDocSnapshot.data();
            const currentTokens = snapshotData.tokens;

            // Only update if tokens field exists and has a valid value
            if (typeof currentTokens === 'number' && currentTokens >= 0) {
              const tokenDisplay = document.getElementById("tokenCount");
              if (tokenDisplay) {
                const oldValue = tokenDisplay.textContent;
                tokenDisplay.textContent = currentTokens;

                // Log if tokens changed significantly
                if (Math.abs(parseInt(oldValue) - currentTokens) > 0) {
                  console.log(`💰 Token update: ${oldValue} → ${currentTokens}`);
                }
              }
            } else if (currentTokens === undefined || currentTokens === null) {
              console.warn("⚠️ Tokens field is missing in snapshot, but not updating to prevent data loss");
            }
          }
        }, (error) => {
          console.error("Error listening to user snapshot:", error);
        });

        // Store the unsubscribe function for cleanup
        window.tokenSnapshotUnsubscribe = tokenSnapshotUnsubscribe;

        // Listen for incoming messages to auto-add users to chat list
        const incomingMessagesQuery = query(
          collection(db, "messages"),
          where("to", "==", myUID)
        );

        const incomingMessagesUnsubscribe = onSnapshot(incomingMessagesQuery, async (snapshot) => {
          for (const change of snapshot.docChanges()) {
            if (change.type === 'added') {
              const messageData = change.doc.data();
              const senderUID = messageData.from;

              // Auto-add sender to contacts if not already there
              try {
                const myUserRef = doc(db, "users", myUID);
                const myUserDoc = await getDoc(myUserRef);
                const myContacts = myUserDoc.data()?.contacts || [];

                if (!myContacts.includes(senderUID) && senderUID !== myUID) {
                  myContacts.push(senderUID);
                  await updateDoc(myUserRef, { contacts: myContacts });
                  console.log("✅ Auto-added", senderUID, "to contacts from incoming message");

                  // Reload contacts to show new sender in chat list
                  loadContacts();
                }
              } catch (err) {
                console.warn("Could not auto-add sender to contacts:", err);
              }
            }
          }
        }, (error) => {
          console.warn("Error listening to incoming messages:", error);
        });

        window.incomingMessagesUnsubscribe = incomingMessagesUnsubscribe;

        // Mark as online
        try {
          await updateDoc(doc(db, "users", myUID), {
            online: true,
            lastSeen: serverTimestamp()
          });
          console.log("🟢 Marked user as online");
        } catch (updateErr) {
          console.warn("Could not update online status:", updateErr);
        }

        // Load contacts after user is authenticated
        try {
          console.log("📋 Loading chat list after authentication...");
          loadContacts();
          loadStatuses();
          // Load user's background image
          if (window.loadUserBackgroundOnAuth) {
            window.loadUserBackgroundOnAuth();
          }
          // Initialize app event listeners after auth
          initializeAppAfterAuth();
        } catch (contactErr) {
          console.error("Error loading contacts:", contactErr);
        }
      } catch (err) {
        console.error("Error loading user data:", err);
        showNotif("Error loading user data: " + err.message, "error");
      }
    } else {
      window.location.href = "index.html";
    }
  });

  // Cleanup on page unload (no confirmation prompt)
  window.addEventListener("beforeunload", async () => {
    if (myUID) {
      // Unsubscribe from token snapshot listener
      if (window.tokenSnapshotUnsubscribe) {
        window.tokenSnapshotUnsubscribe();
      }

      // Unsubscribe from incoming messages listener
      if (window.incomingMessagesUnsubscribe) {
        window.incomingMessagesUnsubscribe();
      }

      if (messageListener) {
        messageListener();
      }
      if (contactsListener) {
        contactsListener();
      }
      try {
        await updateDoc(doc(db, "users", myUID), {
          online: false,
          lastSeen: serverTimestamp()
        });
        console.log("👋 Marked user as offline on unload");
      } catch (err) {
        console.warn("Could not mark user as offline:", err);
      }
    }
  });

  // ========== SETTINGS EVENT LISTENERS ==========

  // Fullscreen button click
  document.getElementById("fullscreen-btn-header")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFullscreen();
  }, false);

  // Settings button click
  document.getElementById("settings-btn-header")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSettingsModal();
  }, false);

  // Close settings modal with improved touch handling
  document.getElementById("closeSettingsBtn")?.addEventListener("click", () => {
    saveSettingsPreferences();
    closeSettingsModal();
  }, false);

  // Copy UID button
  document.getElementById("copyUIDBtn")?.addEventListener("click", () => {
    const userUIDDisplay = document.getElementById("userUIDDisplay");
    if (userUIDDisplay && myUID) {
      navigator.clipboard.writeText(myUID).then(() => {
        showNotif("✅ UID copied to clipboard!", "success", 2000);
        const btn = document.getElementById("copyUIDBtn");
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = "✓ Copied!";
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        }
      }).catch(() => {
        showNotif("⚠️ Failed to copy UID", "error");
      });
    }
  }, false);

  document.getElementById("transferTokensBtn")?.addEventListener("click", transferTokens, false);

  document.getElementById("adminPanelBtn")?.addEventListener("click", () => {
    window.location.href = "../NEXCHAT-ADMIN DASH BOARD/admin-dashboard.html";
  }, false);

  // Close modal when clicking outside the content area (on the overlay)
  document.getElementById("settingsModal")?.addEventListener("click", (e) => {
    if (e.target.id === "settingsModal") {
      saveSettingsPreferences();
      closeSettingsModal();
    }
  }, false);

  // Settings changes - auto save with better event handling
  const setupSettingsListeners = () => {
    const toggles = ["notifToggle", "soundToggle", "onlineStatusToggle", "readReceiptsToggle"];

    toggles.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", saveSettingsPreferences, false);
        // Add touch feedback
        el.addEventListener("touchstart", () => {
          el.style.opacity = "0.7";
        }, false);
        el.addEventListener("touchend", () => {
          el.style.opacity = "1";
        }, false);
      }
    });

    // Theme radio buttons
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.addEventListener("change", saveSettingsPreferences, false);
    });
  };

  // Setup listeners when settings are visible
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.id === "settingsModal" && mutation.target.style.display === "flex") {
        setupSettingsListeners();
      }
    });
  });

  const modalEl = document.getElementById("settingsModal");
  if (modalEl) {
    observer.observe(modalEl, { attributes: true, attributeFilter: ["style"] });
  }

  // Change password button
  document.getElementById("changePasswordBtn")?.addEventListener("click", async () => {
    if (isAndroid && navigator.vibrate) {
      navigator.vibrate(50);
    }

    const currentPass = prompt("🔑 Enter your current password:");
    if (!currentPass) return;

    const newPass = prompt("🔐 Enter new password (min 6 characters):");
    if (!newPass) return;

    if (newPass.length < 6) {
      showNotif("❌ Password must be at least 6 characters", "error");
      return;
    }

    const confirmPass = prompt("🔐 Confirm new password:");
    if (confirmPass !== newPass) {
      showNotif("❌ Passwords do not match", "error");
      return;
    }

    try {
      showNotif("⏳ Changing password...", "info");

      const user = auth.currentUser;
      if (!user || !user.email) {
        showNotif("❌ User not authenticated", "error");
        return;
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPass);
      showNotif("✅ Password changed successfully!", "success");
      console.log("✅ Password updated");
    } catch (err) {
      console.error("Password change error:", err);
      if (err.code === "auth/wrong-password") {
        showNotif("❌ Current password is incorrect", "error");
      } else if (err.code === "auth/weak-password") {
        showNotif("❌ New password is too weak", "error");
      } else {
        showNotif(`❌ Error: ${err.message}`, "error");
      }
    }
  });

  // Clear cache button
  document.getElementById("clearCacheBtn")?.addEventListener("click", () => {
    if (isAndroid && navigator.vibrate) {
      navigator.vibrate([30, 10, 30]);
    }

    if (confirm("⚠️ Are you sure? This will clear all cached data.")) {
      if (isAndroid && navigator.vibrate) {
        navigator.vibrate([50, 20, 50]);
      }

      try {
        localStorage.clear();
        sessionStorage.clear();
        showNotif("✅ Cache cleared successfully!", "success", 2000);
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1500);
      } catch (err) {
        console.error("Error clearing cache:", err);
        showNotif("❌ Error clearing cache", "error");
      }
    }
  });

  // ============================================================
  // BACKGROUND IMAGE FEATURE
  // ============================================================

  // Upload background button
  document.getElementById("uploadBackgroundBtn")?.addEventListener("click", async () => {
    const fileInput = document.getElementById("backgroundImageInput");
    const file = fileInput.files[0];

    if (!file) {
      showNotif("❌ Please select an image first", "error");
      return;
    }

    try {
      showNotif("📸 Uploading background image...", "info");

      const bgRef = storageRef(storage, `backgrounds/${myUID}/${Date.now()}`);
      await uploadBytes(bgRef, file);
      const bgUrl = await getDownloadURL(bgRef);

      // Save to Firestore
      await setDoc(doc(db, "userBackgrounds", myUID), {
        backgroundUrl: bgUrl,
        uploadedAt: serverTimestamp(),
        fileName: file.name
      }, { merge: true });

      // Apply background immediately
      applyBackgroundImage(bgUrl);

      // Save to localStorage for persistence
      localStorage.setItem("nexchat_background", bgUrl);

      showNotif("✅ Background updated!", "success");
      fileInput.value = "";
    } catch (error) {
      console.error("❌ Failed to upload background:", error);
      showNotif("❌ Failed to upload background", "error");
    }
  });

  // Remove background button
  document.getElementById("removeBackgroundBtn")?.addEventListener("click", async () => {
    if (!confirm("🗑️ Remove background image?")) return;

    try {
      showNotif("🗑️ Removing background...", "info");

      // Remove from Firestore
      await updateDoc(doc(db, "userBackgrounds", myUID), {
        backgroundUrl: null,
        removedAt: serverTimestamp()
      });

      // Remove background
      removeBackgroundImage();

      // Clear localStorage
      localStorage.removeItem("nexchat_background");

      showNotif("✅ Background removed!", "success");
    } catch (error) {
      console.error("❌ Failed to remove background:", error);
      showNotif("❌ Failed to remove background", "error");
    }
  });

  // Load saved background on init
  const loadUserBackground = async () => {
    try {
      // Check localStorage first
      const savedBg = localStorage.getItem("nexchat_background");
      if (savedBg) {
        applyBackgroundImage(savedBg);
        updateBackgroundPreview(savedBg);
        return;
      }

      // Otherwise load from Firestore
      if (!myUID) return;

      const bgDoc = await getDoc(doc(db, "userBackgrounds", myUID));
      if (bgDoc.exists() && bgDoc.data().backgroundUrl) {
        const bgUrl = bgDoc.data().backgroundUrl;
        applyBackgroundImage(bgUrl);
        updateBackgroundPreview(bgUrl);
        localStorage.setItem("nexchat_background", bgUrl);
      }
    } catch (error) {
      console.warn("⚠️ Failed to load user background:", error);
    }
  };

  // Functions to apply/remove backgrounds
  function applyBackgroundImage(imageUrl) {
    const app = document.querySelector(".app");
    if (app) {
      app.style.backgroundImage = `url('${imageUrl}')`;
      console.log("✅ Background applied");
    }
  }

  function removeBackgroundImage() {
    const app = document.querySelector(".app");
    if (app) {
      app.style.backgroundImage = "none";
      console.log("✅ Background removed");
    }
  }

  function updateBackgroundPreview(imageUrl) {
    const preview = document.getElementById("backgroundPreview");
    if (preview) {
      preview.style.backgroundImage = `url('${imageUrl}')`;
    }
  }

  // Load background when authenticated
  window.loadUserBackgroundOnAuth = loadUserBackground;

  // Logout from settings
  document.getElementById("logoutSettingsBtn")?.addEventListener("click", () => {
    if (isAndroid && navigator.vibrate) {
      navigator.vibrate([40, 20, 40]);
    }

    if (confirm("🚪 Are you sure you want to logout?")) {
      if (isAndroid && navigator.vibrate) {
        navigator.vibrate([50, 30, 50, 30, 50]);
      }

      signOut(auth)
        .then(() => {
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch (e) {
            console.warn("Could not clear storage:", e);
          }

          showNotif("👋 Logged out successfully!", "success", 2000);
          setTimeout(() => {
            window.location.href = "index.html";
          }, 1500);
        })
        .catch((err) => {
          console.error("Logout error:", err);
          showNotif("❌ Logout error: " + err.message, "error", 3000);
        });
    }
  });

  // ============================================================
  // NEX-STATUS FEATURE LISTENERS
  // ============================================================

  // Upload status image button
  document.getElementById("uploadStatusImageBtn")?.addEventListener("click", () => {
    document.getElementById("statusImageInput").click();
  });

  // Handle status image selection
  document.getElementById("statusImageInput")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showNotif("📸 Uploading status image...", "info");
      const fileRef = storageRef(storage, `statuses/${myUID}/${Date.now()}`);
      await uploadBytes(fileRef, file);
      const imageUrl = await getDownloadURL(fileRef);

      const textContent = document.getElementById("statusInput").value.trim();
      await postStatus(textContent, imageUrl);
      showNotif("✨ Status with image posted!", "success");
    } catch (error) {
      console.error("❌ Failed to upload status image:", error);
      showNotif("❌ Failed to upload image", "error");
    }
  });

  // Post text status
  document.getElementById("postStatusBtn")?.addEventListener("click", async () => {
    const textContent = document.getElementById("statusInput").value.trim();
    if (textContent) {
      await postStatus(textContent, null);
    } else {
      showNotif("❌ Please type something or upload an image", "error");
    }
  });

  // Close status viewer modal
  document.getElementById("closeStatusViewerBtn")?.addEventListener("click", () => {
    const modal = document.getElementById("statusViewerModal");
    if (modal) {
      modal.style.display = "none";
    }
  });

  // Close status viewer when clicking outside
  document.getElementById("statusViewerModal")?.addEventListener("click", (e) => {
    if (e.target.id === "statusViewerModal") {
      e.target.style.display = "none";
    }
  });

  // ============================================================
  // OFFLINE MESSAGE QUEUE LISTENERS
  // ============================================================

  // Initialize offline database and connectivity monitoring
  try {
    initOfflineDB();
    monitorConnectivity();
    console.log("✅ Offline queue system initialized");
  } catch (error) {
    console.warn("⚠️ Failed to initialize offline queue:", error);
  }
}

// Start app when DOM is ready 

// ============================================================
// NEX-STATUS FUNCTIONALITY
// ============================================================

// Helper function to get list of users the current user has chatted with
async function getChattedUsers(userId) {
  try {
    const messagesRef = collection(db, "messages");

    // Get all messages where this user is sender or receiver
    const q = query(
      messagesRef,
      where("from", "==", userId)
    );

    const snap = await getDocs(q);
    const chattedUsers = new Set([userId]); // Include self

    snap.docs.forEach(doc => {
      const msg = doc.data();
      if (msg.to) chattedUsers.add(msg.to);
    });

    // Also get messages where user is receiver
    const q2 = query(
      messagesRef,
      where("to", "==", userId)
    );

    const snap2 = await getDocs(q2);
    snap2.docs.forEach(doc => {
      const msg = doc.data();
      if (msg.from) chattedUsers.add(msg.from);
    });

    return Array.from(chattedUsers);
  } catch (err) {
    console.error("Error getting chatted users:", err);
    return [userId]; // Return at least self
  }
}

async function loadStatuses() {
  const statusFeed = document.getElementById("statusFeed");
  if (!statusFeed) return;

  // Ensure myUID is set
  if (!myUID) {
    console.warn("⚠️ myUID is not set, waiting for authentication...");
    return;
  }

  try {
    const statusesRef = collection(db, "statuses");
    const q = query(statusesRef, orderBy("timestamp", "desc"), limit(50));

    const unsubscribe = onSnapshot(q, async (snap) => {
      statusFeed.innerHTML = "";

      if (snap.docs.length === 0) {
        statusFeed.innerHTML = '<div class="status-empty-state"><p>No statuses yet</p></div>';
        return;
      }

      for (const docSnap of snap.docs) {
        const status = docSnap.data();

        // Check if status has expired
        if (status.expiresAt) {
          const expiryTime = status.expiresAt?.toDate?.() || new Date(status.expiresAt);
          if (new Date() > expiryTime) {
            // Auto-delete expired status
            try {
              await deleteDoc(doc(db, "statuses", docSnap.id));
            } catch (err) {
              console.warn("Could not delete expired status:", err);
            }
            continue;
          }
        }

        // Check if current user can see this status
        // Show if: user posted it (always see own), or user is in the visibleTo list
        const isOwnStatus = status.userId === myUID;
        const visibleToArray = Array.isArray(status.visibleTo) ? status.visibleTo : [];
        const canSeeStatus = isOwnStatus || visibleToArray.includes(myUID);

        if (!canSeeStatus) {
          continue;
        }

        const userRef = doc(db, "users", status.userId);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) continue;

        const userData = userDoc.data();
        const userName = userData.username || userData.name || "User";
        const userInitial = userName.charAt(0).toUpperCase();
        const timestamp = status.timestamp?.toDate?.() || new Date();
        const timeStr = formatTime(timestamp);

        // Calculate time remaining
        const expiryTime = status.expiresAt?.toDate?.() || new Date(status.expiresAt);
        const timeRemaining = getTimeRemaining(expiryTime);

        const statusItem = document.createElement("div");
        statusItem.className = "status-item";
        const deleteBtn = isOwnStatus ? `<button class="status-delete-btn" data-status-id="${docSnap.id}" title="Delete status">🗑️</button>` : "";
        statusItem.innerHTML = `
          <div class="status-item-header">
            <div class="status-item-user">
              <div class="status-item-avatar">${userInitial}</div>
              <div>
                <h4 class="status-item-name">@${escape(userName)}</h4>
              </div>
            </div>
            <div class="status-item-actions">
              <span class="status-item-time">${timeStr}</span>
              ${deleteBtn}
            </div>
          </div>
          <p class="status-item-text">${escape(status.text)}</p>
          <div class="status-item-footer">
            <span class="status-expiry-timer" data-expires="${expiryTime.getTime()}">⏰ Expires in ${timeRemaining}</span>
          </div>
        `;

        // Add delete functionality
        if (isOwnStatus) {
          const delBtn = statusItem.querySelector(".status-delete-btn");
          delBtn?.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (confirm("Delete this status?")) {
              try {
                await deleteDoc(doc(db, "statuses", docSnap.id));
                showNotif("✅ Status deleted", "success", 2000);
              } catch (err) {
                console.error("Error deleting status:", err);
                showNotif("Error deleting status", "error");
              }
            }
          });
        }

        statusFeed.appendChild(statusItem);
      }

      // Start timer update interval
      startStatusTimerUpdates();
    });

    // Store unsubscribe function for cleanup
    window.statusListener = unsubscribe;
  } catch (err) {
    console.error("Error loading statuses:", err);
    statusFeed.innerHTML = '<div class="status-empty-state"><p>Error loading statuses</p></div>';
  }
}

// Helper function to format time remaining
function getTimeRemaining(expiryTime) {
  const now = new Date();
  const diff = expiryTime - now;

  if (diff <= 0) {
    return "Expired";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Update status timers every minute
function startStatusTimerUpdates() {
  // Clear existing interval
  if (window.statusTimerInterval) {
    clearInterval(window.statusTimerInterval);
  }

  window.statusTimerInterval = setInterval(() => {
    const timers = document.querySelectorAll(".status-expiry-timer");
    timers.forEach(timer => {
      const expiresAt = parseInt(timer.dataset.expires);
      const expiryTime = new Date(expiresAt);
      const timeRemaining = getTimeRemaining(expiryTime);
      timer.textContent = `⏰ Expires in ${timeRemaining}`;
    });
  }, 60000); // Update every minute
}

function openReportModal() {
  if (!currentChatUser || !myUID) {
    showNotif("❌ Please select a user first", "error");
    return;
  }

  const reportModal = document.getElementById("reportModal");
  if (!reportModal) {
    // Create the modal if it doesn't exist
    createReportModal();
    return;
  }

  reportModal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeReportModal() {
  const reportModal = document.getElementById("reportModal");
  if (reportModal) {
    reportModal.style.display = "none";
    document.body.style.overflow = "auto";
  }
}

function createReportModal() {
  const modal = document.createElement("div");
  modal.id = "reportModal";
  modal.className = "report-modal";
  modal.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  `;

  modal.innerHTML = `
    <div class="report-modal-content" style="
      background: #1a1a1a;
      border: 2px solid #00ff66;
      border-radius: 16px;
      padding: 24px;
      max-width: 90%;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      -webkit-user-select: text;
      user-select: text;
    ">
      <div class="report-header" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      ">
        <h2 style="
          margin: 0;
          color: #00ff66;
          font-size: 20px;
          font-weight: 700;
        ">📋 Report User</h2>
        <button id="closeReportModalBtn" class="close-btn" style="
          background: none;
          border: none;
          color: #00ff66;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">✕</button>
      </div>
      
      <div class="report-body" style="
        display: flex;
        flex-direction: column;
        gap: 16px;
      ">
        <div style="
          background: rgba(0, 255, 102, 0.1);
          border: 1px solid #00ff66;
          border-radius: 12px;
          padding: 12px;
          color: #00d4ff;
          font-size: 13px;
        ">
          <strong>ℹ️ Report Information:</strong><br>
          This report will be reviewed by our moderation team. Please provide accurate details.
        </div>
        
        <div style="
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <label style="
            color: #00ff66;
            font-weight: 600;
            font-size: 14px;
          ">🏷️ Report Reason:</label>
          <select id="reportReason" style="
            width: 100%;
            padding: 12px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid #00ff66;
            border-radius: 8px;
            color: #00ff66;
            font-size: 14px;
            outline: none;
            -webkit-appearance: none;
            appearance: none;
          ">
            <option value="" style="background: #1a1a1a; color: #fff;">Select a reason...</option>
            <option value="harassment" style="background: #1a1a1a; color: #fff;">🚫 Harassment/Bullying</option>
            <option value="spam" style="background: #1a1a1a; color: #fff;">📧 Spam</option>
            <option value="inappropriate" style="background: #1a1a1a; color: #fff;">🔞 Inappropriate Content</option>
            <option value="scam" style="background: #1a1a1a; color: #fff;">💰 Scam/Fraud</option>
            <option value="hate" style="background: #1a1a1a; color: #fff;">😠 Hate Speech</option>
            <option value="other" style="background: #1a1a1a; color: #fff;">❓ Other</option>
          </select>
        </div>
        
        <div style="
          display: flex;
          flex-direction: column;
          gap: 8px;
        ">
          <label style="
            color: #00ff66;
            font-weight: 600;
            font-size: 14px;
          ">📝 Detailed Description:</label>
          <textarea id="reportDescription" placeholder="Please explain what happened..." style="
            width: 100%;
            padding: 12px;
            min-height: 120px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid #00ff66;
            border-radius: 8px;
            color: #fff;
            font-size: 14px;
            font-family: inherit;
            outline: none;
            resize: vertical;
            -webkit-appearance: none;
            -webkit-user-select: text;
            user-select: text;
          "></textarea>
          <small style="
            color: rgba(255, 255, 255, 0.5);
            font-size: 12px;
          " id="reportCharCount">0 / 500</small>
        </div>
        
        <div style="
          display: flex;
          gap: 12px;
        ">
          <button id="submitReportBtn" style="
            flex: 1;
            padding: 12px;
            background: #00ff66;
            color: #000;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          ">✅ Submit Report</button>
          <button id="cancelReportBtn" style="
            flex: 1;
            padding: 12px;
            background: rgba(255, 0, 0, 0.2);
            color: #ff6b6b;
            border: 1px solid #ff6b6b;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          ">❌ Cancel</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  document.getElementById("closeReportModalBtn").addEventListener("click", closeReportModal);
  document.getElementById("cancelReportBtn").addEventListener("click", closeReportModal);
  document.getElementById("submitReportBtn").addEventListener("click", submitReport);

  // Character counter for textarea
  const textarea = document.getElementById("reportDescription");
  textarea?.addEventListener("input", () => {
    const count = textarea.value.length;
    const charCount = document.getElementById("reportCharCount");
    if (charCount) {
      charCount.textContent = `${count} / 500`;
      if (count > 500) {
        textarea.value = textarea.value.substring(0, 500);
      }
    }
  });

  // Close on overlay click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeReportModal();
    }
  });
}

async function submitReport() {
  const reason = document.getElementById("reportReason")?.value;
  const description = document.getElementById("reportDescription")?.value.trim();

  if (!reason) {
    showNotif("❌ Please select a reason", "error");
    return;
  }

  if (!description || description.length < 10) {
    showNotif("❌ Please provide a detailed description (at least 10 characters)", "error");
    return;
  }

  if (!currentChatUser || !myUID) {
    showNotif("❌ Error: User information not found", "error");
    return;
  }

  try {
    const submitBtn = document.getElementById("submitReportBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ Submitting...";
    }

    const reportsRef = collection(db, "reports");
    await addDoc(reportsRef, {
      reportedBy: myUID,
      reportedUser: currentChatUser,
      reason: reason,
      description: description,
      timestamp: serverTimestamp(),
      status: "pending",
      reviewed: false
    });

    showNotif("✅ Report submitted successfully! Our team will review it shortly.", "success", 3000);
    closeReportModal();

    // Reset form
    document.getElementById("reportReason").value = "";
    document.getElementById("reportDescription").value = "";
  } catch (err) {
    console.error("Report submission error:", err);
    showNotif("❌ Error submitting report: " + err.message, "error");
  } finally {
    const submitBtn = document.getElementById("submitReportBtn");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "✅ Submit Report";
    }
  }
}

// Update report button click handlers error safe
document.getElementById("reportBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("chatOptionsMenu").style.display = "none";
  openReportModal();
});

document.getElementById("infoReportBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  openReportModal();
});

// ==================== GROUP CREATION FUNCTIONS ====================
async function openCreateGroupModal() {
  const modal = document.getElementById('createGroupModal');
  if (!modal) {
    console.error('Create group modal not found');
    showNotif('❌ Modal not found', 'error');
    return;
  }
  modal.style.display = 'block';
  document.getElementById('groupCreateResult').style.display = 'none';
  await loadGroupMembersList();

  // Attach Add All and Clear All button listeners
  const addAllBtn = document.getElementById('addAllContactsBtn');
  const clearAllBtn = document.getElementById('clearAllContactsBtn');

  if (addAllBtn) {
    addAllBtn.onclick = (e) => {
      e.preventDefault();
      const checkboxes = document.querySelectorAll('.member-checkbox');
      checkboxes.forEach(cb => cb.checked = true);
      showNotif('✓ All contacts selected', 'success', 2000);
      console.log(`✅ Selected ${checkboxes.length} contacts`);
    };
  }

  if (clearAllBtn) {
    clearAllBtn.onclick = (e) => {
      e.preventDefault();
      const checkboxes = document.querySelectorAll('.member-checkbox');
      checkboxes.forEach(cb => cb.checked = false);
      showNotif('✗ All contacts deselected', 'info', 2000);
      console.log('✓ Cleared all selections');
    };
  }
}

async function loadGroupMembersList() {
  const membersList = document.getElementById('groupMembersList');
  if (!membersList) {
    console.error('Members list container not found');
    return;
  }
  membersList.innerHTML = '<p style="color: #888; text-align: center; padding: 10px;">Loading contacts...</p>';

  try {
    const contactsSnap = await getDocs(collection(db, 'users'));
    let contactsHtml = '';
    let contactCount = 0;

    contactsSnap.forEach(doc => {
      const user = doc.data();
      if (doc.id !== myUID && !user.blocked?.includes(myUID)) {
        const username = user.username || user.email || 'Unknown';
        const safeUsername = String(username).replace(/"/g, '&quot;');
        const uniqueId = `member-${doc.id}`;
        contactsHtml += `
          <div style="padding: 10px; border-bottom: 1px solid #333; display: flex; align-items: center; cursor: pointer;" onclick="document.getElementById('${uniqueId}').click();">
            <input type="checkbox" id="${uniqueId}" class="member-checkbox" data-uid="${doc.id}" data-username="${safeUsername}" style="margin-right: 10px; cursor: pointer;">
            <label for="${uniqueId}" style="flex: 1; cursor: pointer;">${safeUsername}</label>
          </div>
        `;
        contactCount++;
      }
    });

    if (contactCount > 0) {
      membersList.innerHTML = contactsHtml;
      console.log(`✅ Loaded ${contactCount} contacts for group creation`);
    } else {
      membersList.innerHTML = '<p style="color: #888; text-align: center; padding: 10px;">No contacts available</p>';
      showNotif('ℹ️ No contacts to add', 'info', 2000);
    }
  } catch (error) {
    console.error('❌ Error loading members:', error);
    membersList.innerHTML = `<p style="color: #ff6b6b; text-align: center; padding: 10px;">❌ Error: ${error.message}</p>`;
    showNotif(`Error loading contacts: ${error.message}`, 'error', 3000);
  }
}

async function createGroup(e) {
  e.preventDefault();

  const nameInput = document.getElementById('groupName');
  const descInput = document.getElementById('groupDescription');
  const resultDiv = document.getElementById('groupCreateResult');

  // Check if user is authenticated
  if (!myUID || !auth.currentUser) {
    showNotif('❌ You must be logged in to create a group', 'error', 3000);
    resultDiv.style.display = 'block';
    resultDiv.style.background = '#ff6b6b';
    resultDiv.style.color = '#fff';
    resultDiv.textContent = '❌ User not authenticated. Please log in again.';
    return;
  }

  if (!nameInput) {
    console.error('Group name input not found');
    showNotif('❌ Form error', 'error');
    return;
  }

  const name = nameInput.value.trim();
  const description = descInput?.value.trim() || '';

  if (!name || name.length < 1) {
    resultDiv.style.display = 'block';
    resultDiv.style.background = '#ff6b6b';
    resultDiv.style.color = '#fff';
    resultDiv.textContent = '❌ Group name is required';
    return;
  }

  if (name.length > 50) {
    resultDiv.style.display = 'block';
    resultDiv.style.background = '#ff6b6b';
    resultDiv.style.color = '#fff';
    resultDiv.textContent = '❌ Group name too long (max 50 chars)';
    return;
  }

  try {
    const selectedCheckboxes = document.querySelectorAll('.member-checkbox:checked');

    if (selectedCheckboxes.length === 0) {
      resultDiv.style.display = 'block';
      resultDiv.style.background = '#ff6b6b';
      resultDiv.style.color = '#fff';
      resultDiv.textContent = '❌ Select at least one member';
      showNotif('❌ Please select at least one member', 'error', 2000);
      return;
    }

    // Build members list with creator
    const members = new Set([myUID]);
    selectedCheckboxes.forEach(cb => {
      const uid = cb.dataset.uid;
      if (uid) members.add(uid);
    });
    const membersList = Array.from(members);

    console.log(`📝 Creating group "${name}" with ${membersList.length} members`);

    // Create group in Firestore
    const groupRef = await addDoc(collection(db, 'groups'), {
      name: name,
      description: description,
      creatorId: myUID,
      members: membersList,
      admins: [myUID],
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageTime: serverTimestamp()
    });

    console.log(`✅ Group created with ID: ${groupRef.id}`);
    showNotif(`✅ Group "${name}" created!`, 'success', 2000);

    // Generate group join link
    const groupJoinLink = `${window.location.origin}${window.location.pathname}?joinGroup=${groupRef.id}`;
    console.log(`📎 Group join link: ${groupJoinLink}`);

    // Show group created message with link option
    const resultDiv = document.getElementById('groupCreateResult');
    resultDiv.style.display = 'block';
    resultDiv.style.background = '#4CAF50';
    resultDiv.style.color = '#fff';
    resultDiv.innerHTML = `
      <div style="padding: 15px; border-radius: 6px;">
        <p>✅ Group "${name}" created successfully!</p>
        <p style="font-size: 0.9rem; margin-top: 10px; opacity: 0.9;">Share this link with others to let them join:</p>
        <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; margin: 10px 0; word-break: break-all; font-size: 0.85rem; max-height: 80px; overflow-y: auto;">
          ${groupJoinLink}
        </div>
        <button type="button" onclick="copyGroupLink('${groupJoinLink}')" style="background: #fff; color: #333; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 10px;">📋 Copy Link</button>
      </div>
    `;

    // Reset form
    document.getElementById('createGroupForm')?.reset();
    document.getElementById('createGroupModal').style.display = 'none';

    // Reload chat list to show new group
    await loadContacts();

    // Open the new group
    await openChat(groupRef.id, name, '👥', 'group');

  } catch (error) {
    console.error('❌ Error creating group:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Current user:', auth.currentUser?.uid);
    console.error('Group data being sent:', {
      creatorId: myUID,
      members: members
    });
    if (resultDiv) {
      resultDiv.style.display = 'block';
      resultDiv.style.background = '#ff6b6b';
      resultDiv.style.color = '#fff';
      resultDiv.textContent = `❌ Error: ${error.message || 'Unknown error'}`;
    }
    showNotif(`Error creating group: ${error.message}`, 'error', 3000);
  }
}

async function loadGroupMessages(groupId) {
  const messagesDiv = document.getElementById('messages-area');
  if (!messagesDiv) {
    console.error("Messages area not found!");
    return;
  }

  messagesDiv.innerHTML = '<p style="text-align: center; color: #888;">Loading group messages...</p>';

  // Clean up previous listener
  if (messageListener) {
    messageListener();
    messageListener = null;
  }

  try {
    console.log(`📨 Loading group messages for groupId: ${groupId}`);

    const q = query(
      collection(db, 'groupMessages'),
      where('groupId', '==', groupId),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    messageListener = onSnapshot(q, async (snapshot) => {
      console.log(`📨 Group message snapshot received with ${snapshot.docs.length} messages`);

      let html = '';
      const pollIds = new Set();
      const pollCache = {};
      const userCache = {}; // Cache for user data

      for (const docSnap of snapshot.docs) {
        const msg = docSnap.data();

        // Cache poll IDs for batch loading
        if (msg.isPoll && msg.pollId) {
          pollIds.add(msg.pollId);
        }

        // Cache user IDs for batch loading
        if (msg.from && !userCache[msg.from]) {
          userCache[msg.from] = null; // Mark for loading
        }
      }

      // Batch load user data
      for (const userId of Object.keys(userCache)) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            userCache[userId] = userDoc.data();
          } else {
            userCache[userId] = { username: 'Unknown User', email: userId };
          }
        } catch (e) {
          console.error('Error loading user:', e);
          userCache[userId] = { username: 'Unknown User', email: userId };
        }
      }

      // Batch load polls
      for (const pollId of pollIds) {
        try {
          const pollDoc = await getDoc(doc(db, 'groupPolls', pollId));
          if (pollDoc.exists()) {
            pollCache[pollId] = pollDoc.data();
          }
        } catch (e) {
          console.error('Error loading poll:', e);
        }
      }

      snapshot.forEach(docSnap => {
        const msg = docSnap.data();
        const msgId = docSnap.id;
        const userData = userCache[msg.from] || { username: 'Unknown User', email: msg.from };
        const sender = userData.username || userData.name || userData.email || 'Unknown';
        const isOwn = msg.from === myUID;

        const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }) : '';

        html += `
          <div style="margin: 10px 0; padding: 8px;">
            <div style="font-size: 12px; color: ${isOwn ? '#00ff66' : '#ff9500'}; margin-bottom: 4px;">
              ${sender} ${time}
            </div>
        `;

        // If message contains a poll, render it
        if (msg.isPoll && msg.pollId && pollCache[msg.pollId]) {
          html += `<div id="poll-${msg.pollId}" style="margin: 8px 0;"></div>`;
        } else {
          html += `
            <div style="background: ${isOwn ? '#00ff6633' : '#333'}; padding: 10px; border-radius: 8px; word-wrap: break-word;">
              ${msg.text}
            </div>
          `;
        }

        html += `</div>`;
      });

      messagesDiv.innerHTML = html || '<p style="text-align: center; color: #888;">No messages yet</p>';

      // Render polls after HTML is set
      for (const pollId in pollCache) {
        const pollContainer = document.getElementById(`poll-${pollId}`);
        if (pollContainer) {
          const pollHTML = renderPoll(pollId, pollCache[pollId]);
          pollContainer.appendChild(pollHTML);
        }
      }

      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      console.log('✅ Group messages loaded:', snapshot.docs.length);
    });
  } catch (error) {
    console.error('Error loading group messages:', error);
    messagesDiv.innerHTML = `<p style="color: #ff6b6b;">Error loading messages: ${error.message}</p>`;
  }
}

async function sendGroupMessage(groupId, text, attachment) {
  if ((!text || !text.trim()) && !attachment) return;

  try {
    // Check if user is suspended
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (!groupDoc.exists()) {
      showNotif('❌ Group not found', 'error');
      return;
    }

    const groupData = groupDoc.data();
    const suspendedMembers = groupData.suspendedMembers || [];
    if (suspendedMembers.includes(myUID)) {
      showNotif('❌ You are suspended from this group', 'error');
      return;
    }

    // Cost 1 token
    if (tokens < 1) {
      showNotif('❌ Not enough tokens (need 1)', 'error');
      return;
    }

    // Deduct token
    await updateDoc(doc(db, 'users', myUID), {
      tokens: increment(-1)
    });

    // Parse mentions in text
    const mentionedUsers = parseAndReplaceMentions(text || "");
    const messageData = {
      groupId: groupId,
      from: myUID,
      text: mentionedUsers.text || "",
      timestamp: serverTimestamp(),
      edited: false,
      mentionedUserIds: mentionedUsers.ids
    };

    // Add attachment if present
    if (attachment) {
      messageData.attachment = attachment;
    }

    // Send message
    const msgRef = await addDoc(collection(db, 'groupMessages'), messageData);

    // Track message activity
    try {
      await addDoc(collection(db, 'messageActivity'), {
        senderId: myUID,
        type: 'group_message',
        groupId: groupId,
        messageLength: text.length,
        cost: 1,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.log('Activity tracking skipped:', e.message);
    }

    showNotif('✓ Message sent' + (mentionedUsers.ids.length > 0 ? ` (mentioned ${mentionedUsers.ids.length})` : ''), 'success', 1500);

    // Update group last message
    await updateDoc(doc(db, 'groups', groupId), {
      lastMessage: text,
      lastMessageTime: serverTimestamp()
    });

  } catch (error) {
    showNotif(`Error: ${error.message}`, 'error');
  }
}

// Parse mentions (@username) in text
function parseAndReplaceMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentionedUsers = [];
  let replacedText = text;

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const username = match[1];
    // Store mentioned usernames
    mentionedUsers.push(username);
  }

  return {
    text: replacedText,
    ids: mentionedUsers
  };
}

// ============================================================
// GROUP JOIN LINK FUNCTIONALITY
// ============================================================

function copyGroupLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    showNotif('✅ Group link copied to clipboard!', 'success', 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    showNotif('❌ Failed to copy link', 'error', 2000);
  });
}

async function handleGroupJoinLink(groupId) {
  try {
    if (!myUID) {
      showNotif('❌ Please log in first', 'error', 3000);
      return;
    }

    console.log(`📎 Attempting to join group: ${groupId}`);

    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      showNotif('❌ Group not found', 'error', 3000);
      console.error('Group not found:', groupId);
      return;
    }

    const groupData = groupSnap.data();

    // Check if user is already a member
    if (groupData.members && groupData.members.includes(myUID)) {
      console.log('✓ User already a member of this group');
      showNotif(`✓ You're already a member of "${groupData.name}"`, 'info', 2000);
      await openChat(groupId, groupData.name, '👥', 'group');
      return;
    }

    // Add user to group members
    const updatedMembers = [...(groupData.members || []), myUID];
    await updateDoc(groupRef, {
      members: updatedMembers
    });

    console.log(`✅ Successfully joined group: ${groupData.name}`);
    showNotif(`✅ You joined "${groupData.name}"!`, 'success', 2000);

    // Reload chat list and open the group
    await loadContacts();
    await openChat(groupId, groupData.name, '👥', 'group');

  } catch (error) {
    console.error('❌ Error joining group:', error);
    showNotif(`Error joining group: ${error.message}`, 'error', 3000);
  }
}

// Check for group join link on page load
function checkGroupJoinLink() {
  const params = new URLSearchParams(window.location.search);
  const groupId = params.get('joinGroup');

  if (groupId) {
    console.log(`🔗 Detected group join link: ${groupId}`);
    // Wait for user to be authenticated
    const checkInterval = setInterval(async () => {
      if (myUID && auth.currentUser) {
        clearInterval(checkInterval);
        await handleGroupJoinLink(groupId);
        // Remove the query parameter from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }, 500);

    // Timeout after 10 seconds
    setTimeout(() => clearInterval(checkInterval), 10000);
  }
}

// ============================================================
// OFFLINE MESSAGE QUEUE & STATUS SYSTEM
// ============================================================

// Initialize IndexedDB for offline message storage
let offlineDB = null;

async function initOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NEXCHATOfflineDB', 1);

    request.onerror = () => {
      console.error('❌ Failed to open offline DB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      offlineDB = request.result;
      console.log('✅ Offline DB initialized');
      resolve(offlineDB);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create stores if they don't exist
      if (!db.objectStoreNames.contains('offlineMessages')) {
        db.createObjectStore('offlineMessages', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('statuses')) {
        db.createObjectStore('statuses', { keyPath: 'id', autoIncrement: true });
      }
      console.log('✅ Offline DB schema created');
    };
  });
}

// Store message for offline sending
async function storeOfflineMessage(chatId, message, chatType = 'direct', attachmentUrl = null) {
  if (!offlineDB) return false;

  try {
    const transaction = offlineDB.transaction(['offlineMessages'], 'readwrite');
    const store = transaction.objectStore('offlineMessages');

    const offlineMsg = {
      id: Date.now(),
      chatId,
      chatType,
      message,
      attachmentUrl,
      timestamp: new Date().toISOString(),
      sent: false,
      senderUID: myUID
    };

    store.add(offlineMsg);
    console.log('💾 Message stored offline:', offlineMsg);
    return true;
  } catch (error) {
    console.error('❌ Failed to store offline message:', error);
    return false;
  }
}

// Retrieve all offline messages
async function getOfflineMessages() {
  if (!offlineDB) return [];

  return new Promise((resolve, reject) => {
    try {
      const transaction = offlineDB.transaction(['offlineMessages'], 'readonly');
      const store = transaction.objectStore('offlineMessages');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result.filter(msg => !msg.sent));
      };
      request.onerror = () => reject(request.error);
    } catch (error) {
      console.error('❌ Failed to retrieve offline messages:', error);
      reject(error);
    }
  });
}

// Mark offline message as sent
async function markOfflineMessageSent(offlineMsgId) {
  if (!offlineDB) return false;

  try {
    const transaction = offlineDB.transaction(['offlineMessages'], 'readwrite');
    const store = transaction.objectStore('offlineMessages');
    const request = store.get(offlineMsgId);

    request.onsuccess = () => {
      const msg = request.result;
      if (msg) {
        msg.sent = true;
        store.put(msg);
      }
    };
    return true;
  } catch (error) {
    console.error('❌ Failed to mark message as sent:', error);
    return false;
  }
}

// Monitor connectivity
function monitorConnectivity() {
  const offlineIndicator = document.getElementById('offlineIndicator');

  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    console.log(`🌐 Connection status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

    if (offlineIndicator) {
      if (!isOnline) {
        offlineIndicator.style.display = 'flex';
        document.querySelector('.app')?.classList.add('show-offline-indicator');
      } else {
        offlineIndicator.style.display = 'none';
        document.querySelector('.app')?.classList.remove('show-offline-indicator');
        // Try to sync offline messages when coming back online
        syncOfflineMessages();
      }
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // Check initial status
  updateOnlineStatus();
}

// Sync offline messages when connection restored
async function syncOfflineMessages() {
  if (!navigator.onLine) return;

  console.log('🔄 Attempting to sync offline messages...');
  const offlineMessages = await getOfflineMessages();

  if (offlineMessages.length === 0) {
    console.log('✅ No messages to sync');
    return;
  }

  console.log(`📤 Syncing ${offlineMessages.length} messages...`);

  for (const msg of offlineMessages) {
    try {
      if (msg.chatType === 'direct') {
        // Send direct message
        const docRef = await addDoc(collection(db, 'messages'), {
          senderId: myUID,
          senderName: myUsername,
          senderProfilePic: myProfilePic,
          receiverId: msg.chatId,
          message: msg.message,
          attachmentUrl: msg.attachmentUrl || null,
          attachmentName: msg.attachmentUrl ? 'File' : null,
          timestamp: serverTimestamp(),
          read: false
        });
        await markOfflineMessageSent(msg.id);
        console.log('✅ Synced direct message:', msg.id);
      } else if (msg.chatType === 'group') {
        // Send group message
        await addDoc(collection(db, 'groupMessages'), {
          groupId: msg.chatId,
          senderId: myUID,
          senderName: myUsername,
          senderProfilePic: myProfilePic,
          message: msg.message,
          attachmentUrl: msg.attachmentUrl || null,
          attachmentName: msg.attachmentUrl ? 'File' : null,
          timestamp: serverTimestamp()
        });
        await markOfflineMessageSent(msg.id);
        console.log('✅ Synced group message:', msg.id);
      }
    } catch (error) {
      console.error('❌ Failed to sync message:', error);
    }
  }

  showNotif('✅ All offline messages synced!', 'success', 3000);
}

// ============================================================
// NEX-STATUS SYSTEM
// ============================================================

async function postStatus(textContent = '', imageUrl = null) {
  if (!textContent && !imageUrl) {
    showNotif('❌ Please add text or image to your status', 'error');
    return;
  }

  try {
    const statusRef = await addDoc(collection(db, 'statuses'), {
      userId: myUID,
      username: myUsername,
      profilePic: myProfilePic,
      text: textContent,
      imageUrl: imageUrl,
      timestamp: serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    showNotif('✨ Status posted!', 'success');

    // Clear inputs
    document.getElementById('statusInput').value = '';
    document.getElementById('statusImageInput').value = '';

    // Reload status feed
    loadStatusFeed();
  } catch (error) {
    console.error('❌ Failed to post status:', error);
    showNotif('❌ Failed to post status', 'error');
  }
}

async function loadStatusFeed() {
  try {
    const statusFeed = document.getElementById('statusFeed');
    const now = new Date();

    const q = query(
      collection(db, 'statuses'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'desc'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      statusFeed.innerHTML = '<div class="status-empty-state"><p>No statuses from your contacts yet</p></div>';
      return;
    }

    statusFeed.innerHTML = '';
    const userStatusMap = new Map();

    // Group statuses by user (show only latest status per user)
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!userStatusMap.has(data.userId)) {
        userStatusMap.set(data.userId, { ...data, docId: doc.id });
      }
    });

    // Create status items
    userStatusMap.forEach((status) => {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'status-item';
      statusDiv.style.cursor = 'pointer';

      if (status.imageUrl) {
        statusDiv.innerHTML = `
          <img src="${status.imageUrl}" alt="status" class="status-item-image">
          <div class="status-item-overlay"></div>
          <img src="${status.profilePic}" alt="user" class="status-item-avatar" onerror="this.src='👤'">
          <p class="status-item-username">${status.username.substring(0, 10)}</p>
        `;
      } else {
        statusDiv.style.background = `linear-gradient(135deg, rgba(0, 255, 102, 0.1), rgba(0, 255, 102, 0.05))`;
        statusDiv.innerHTML = `
          <div class="status-item-overlay"></div>
          <div style="text-align: center; z-index: 3; position: relative;">
            <img src="${status.profilePic}" alt="user" class="status-item-avatar" style="margin-bottom: 8px;" onerror="this.src='👤'">
            <p class="status-item-username">${status.username.substring(0, 10)}</p>
            <p style="font-size: 11px; color: #00ff66; margin: 0; word-break: break-word; max-width: 90px; margin: 0 auto;">${status.text.substring(0, 20)}...</p>
          </div>
        `;
      }

      statusDiv.addEventListener('click', () => viewStatus(status));
      statusFeed.appendChild(statusDiv);
    });
  } catch (error) {
    console.error('❌ Failed to load status feed:', error);
  }
}

function viewStatus(status) {
  const modal = document.getElementById('statusViewerModal');
  const image = document.getElementById('statusViewerImage');
  const avatar = document.getElementById('statusViewerAvatar');
  const name = document.getElementById('statusViewerName');
  const time = document.getElementById('statusViewerTime');
  const caption = document.getElementById('statusViewerCaption');

  if (status.imageUrl) {
    image.src = status.imageUrl;
  } else {
    image.style.background = `linear-gradient(135deg, rgba(0, 255, 102, 0.1), rgba(0, 255, 102, 0.05))`;
    image.style.display = 'flex';
    image.style.alignItems = 'center';
    image.style.justifyContent = 'center';
    image.innerHTML = `<p style="color: #00ff66; font-size: 16px; max-width: 80%; word-break: break-word;">${status.text}</p>`;
  }

  avatar.src = status.profilePic || '👤';
  name.textContent = status.username;
  caption.textContent = status.text || 'No caption';

  const timeDiff = Math.floor((Date.now() - status.timestamp.toMillis()) / 1000);
  if (timeDiff < 60) {
    time.textContent = 'Just now';
  } else if (timeDiff < 3600) {
    time.textContent = `${Math.floor(timeDiff / 60)}m ago`;
  } else if (timeDiff < 86400) {
    time.textContent = `${Math.floor(timeDiff / 3600)}h ago`;
  } else {
    time.textContent = `${Math.floor(timeDiff / 86400)}d ago`;
  }

  modal.style.display = 'flex';
}

// ============================================================
// INITIALIZATION
// ============================================================

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Basic DOM setup
    initializeBasicUI();
    checkGroupJoinLink();
  });
} else {
  initializeBasicUI();
  checkGroupJoinLink();
}

// Initialize basic UI elements that don't depend on Firebase data
function initializeBasicUI() {
  // Initialize emoji picker
  initializeEmojiPicker();

  // Setup poll system for group chats
  document.getElementById("poll-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentChatType === 'group') {
      document.getElementById("pollModal").style.display = "block";
    } else {
      showNotif("📊 Polls are only available in group chats", "info");
    }
  });

  // Poll form submission
  document.getElementById("pollForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const question = document.getElementById("pollQuestion").value.trim();
    const optionsText = document.getElementById("pollOptions").value.trim();

    if (!question || !optionsText) {
      showNotif("Please fill in all poll fields", "error");
      return;
    }

    const options = optionsText.split('\n').map(o => o.trim()).filter(o => o);

    if (options.length < 2) {
      showNotif("Poll must have at least 2 options", "error");
      return;
    }

    await createPoll(currentChatUser, question, options);

    // Close modal and reset form
    document.getElementById("pollModal").style.display = "none";
    document.getElementById("pollForm").reset();
  });

  // Dashboard Back Button
  document.getElementById("dashboardBackBtn")?.addEventListener("click", goBackToDashboard);

  // Message form and send button listeners
  const messageForm = document.getElementById("message-form");
  if (messageForm) {
    messageForm.addEventListener("submit", sendMessage);
    console.log("✅ Message form listener attached");
  }

  const sendBtn = document.querySelector(".send-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", (e) => {
      console.log("📤 Send button clicked");
      e.preventDefault();
      sendMessage(e);
    });
  }

  // Attach event listeners for back button
  document.getElementById("backBtn")?.addEventListener("click", () => {
    showChatListView();
    goBack();
  });

  // ============ NEW FEATURES: Search, Filter Tabs, Archived, Bottom Nav ============

  // Search functionality
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      filterChats(query);
    });
  }

  // Filter tabs
  const filterTabs = document.querySelectorAll(".filter-tab");
  filterTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const filter = tab.dataset.filter;

      if (filter === undefined) return; // Skip if not a filter button

      // Remove active from all tabs
      filterTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // Apply filter
      applyFilter(filter);
    });
  });

  // New chat from tab
  document.getElementById("newChatFromTab")?.addEventListener("click", () => {
    document.getElementById("newChatBtn")?.click();
  });

  // Archived chats toggle
  const archivedToggle = document.getElementById("archivedToggle");
  if (archivedToggle) {
    archivedToggle.addEventListener("click", () => {
      const archivedList = document.getElementById("archivedList");
      archivedList?.classList.toggle("show");
    });
  }

  // Bottom navigation
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const navSection = item.dataset.nav;

      // Remove active from all nav items
      navItems.forEach(nav => nav.classList.remove("active"));
      item.classList.add("active");

      // Handle navigation
      handleNavigation(navSection);
    });
  });

  // Dark Mode Sliding Toggle
  const darkModeToggle = document.getElementById("darkModeToggle");
  let isSliding = false;
  let startX = 0;
  let currentX = 0;

  // Initialize toggle state from localStorage
  const savedDarkMode = localStorage.getItem("darkMode") === "true";
  if (savedDarkMode) {
    darkModeToggle?.classList.add("active");
    document.body.classList.add("dark-mode");
  } else {
    darkModeToggle?.classList.remove("active");
    document.body.classList.add("light-mode");
  }

  // Mouse/Touch events for sliding
  darkModeToggle?.addEventListener("mousedown", (e) => {
    isSliding = true;
    startX = e.clientX;
    darkModeToggle.style.cursor = "grabbing";
  });

  darkModeToggle?.addEventListener("touchstart", (e) => {
    isSliding = true;
    startX = e.touches[0].clientX;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isSliding || !darkModeToggle) return;
    currentX = e.clientX - startX;
  });

  document.addEventListener("touchmove", (e) => {
    if (!isSliding || !darkModeToggle) return;
    currentX = e.touches[0].clientX - startX;
  });

  // Mouse/Touch up - complete the toggle
  document.addEventListener("mouseup", () => {
    if (!isSliding || !darkModeToggle) return;
    isSliding = false;
    darkModeToggle.style.cursor = "pointer";

    // If dragged more than 15px, toggle
    if (Math.abs(currentX) > 15) {
      toggleDarkMode();
    }
    currentX = 0;
  });

  document.addEventListener("touchend", () => {
    if (!isSliding || !darkModeToggle) return;
    isSliding = false;

    // If dragged more than 15px, toggle
    if (Math.abs(currentX) > 15) {
      toggleDarkMode();
    }
    currentX = 0;
  });

  // Click handler for direct toggle
  darkModeToggle?.addEventListener("click", () => {
    if (!isSliding) {
      toggleDarkMode();
    }
  });
}

// Function to go back to dashboard
function goBackToDashboard() {
  // Always go back to chat.html
  window.location.href = 'chat.html';
}

function setupAuthListeners() {
  console.log("🛠️ Setting up auth-dependent event listeners...");

  // Header Buttons
  document.getElementById('search-btn-header')?.addEventListener('click', openSearch);

  document.getElementById('settings-btn-header')?.addEventListener('click', () => {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.style.display = 'block';
      const uidDisplay = document.getElementById('userUIDDisplay');
      if (uidDisplay) uidDisplay.textContent = myUID;
    }
  });

  document.getElementById('fullscreen-btn-header')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });

  // Create Group
  document.getElementById('createNewGroupBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('createGroupModal');
    if (modal) {
      modal.style.display = 'block';
      if (typeof loadGroupMembersList === 'function') loadGroupMembersList();
    }
  });

  const createGroupForm = document.getElementById('createGroupForm');
  if (createGroupForm) {
    // Remove old listener if any to prevent duplicates? 
    // Cloning node or simple addEventListener (it allows multiple, but we only run this once on auth)
    createGroupForm.addEventListener('submit', createGroup);
  }

  // Status
  document.getElementById('uploadStatusImageBtn')?.addEventListener('click', () => {
    document.getElementById('statusImageInput')?.click();
  });

  document.getElementById('statusImageInput')?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.getElementById('myStatusPic');
        if (img) img.src = e.target.result;
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  });

  document.getElementById('postStatusBtn')?.addEventListener('click', async () => {
    const textInput = document.getElementById('statusInput');
    const imageInput = document.getElementById('statusImageInput');

    if (!textInput) return;

    const text = textInput.value;
    const file = imageInput?.files ? imageInput.files[0] : null;

    await handleStatusPost(text, file);
  });

  // Chat Options
  document.getElementById('menuBtn')?.addEventListener('click', () => {
    const menu = document.getElementById('chatOptionsMenu');
    if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });

  // Attachments
  document.getElementById('attach-btn')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  // Settings Close
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
  });

  document.getElementById('logoutSettingsBtn')?.addEventListener('click', () => {
    signOut(auth).then(() => {
      window.location.href = 'index.html';
    });
  });

  // Logout Main Nav
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      signOut(auth).then(() => {
        window.location.href = 'index.html';
      });
    }
  });

  console.log("✅ Auth listeners attached");
}

async function handleStatusPost(text, file) {
  let imageUrl = null;
  if (file) {
    try {
      const storageRefPath = `status/${Date.now()}_${file.name}`;
      const imgRef = storageRef(storage, storageRefPath);
      const snapshot = await uploadBytes(imgRef, file);
      imageUrl = await getDownloadURL(snapshot.ref);
    } catch (e) {
      console.error("Status upload failed", e);
      showNotif("Failed to upload image", "error");
      return;
    }
  }
  await postStatus(text, imageUrl);
}

// ============================================================
// MISSING FUNCTIONS IMPLEMENTATION
// ============================================================

async function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  document.body.classList.toggle("light-mode", !isDark);

  const toggleBtn = document.getElementById("darkModeToggle");
  if (toggleBtn) {
    toggleBtn.classList.toggle("active", isDark);
  }

  localStorage.setItem("darkMode", isDark);
}

async function loadGroups() {
  const groupsList = document.getElementById("groupsList");
  if (!groupsList) return;

  if (!myUID) return;

  try {
    const q = query(
      collection(db, "groups"),
      where("members", "array-contains", myUID),
      orderBy("lastMessageTime", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      groupsList.innerHTML = `
        <li class="empty-state">
          <p>No groups yet</p>
          <p class="hint">Create or join a group to get started</p>
        </li>
      `;
      return;
    }

    groupsList.innerHTML = "";

    snapshot.forEach(docSnap => {
      const group = docSnap.data();
      const groupId = docSnap.id;

      const li = document.createElement("li");
      li.className = "chat-list-item";
      li.dataset.chatId = groupId;
      li.dataset.isGroup = "true";

      const time = group.lastMessageTime ? formatTime(group.lastMessageTime) : "";
      const lastMsg = group.lastMessage || "No messages yet";

      li.innerHTML = `
        <div class="chat-avatar-container">
          <div class="chat-avatar group-avatar">👥</div>
        </div>
        <div class="chat-info">
          <div class="chat-header">
            <h3>${escape(group.name)}</h3>
            <span class="chat-time">${time}</span>
          </div>
          <div class="chat-last-message">
            <p>${escape(lastMsg)}</p>
          </div>
        </div>
      `;

      li.addEventListener("click", () => {
        openChat(groupId, group.name, "👥", "group");
      });

      groupsList.appendChild(li);
    });

  } catch (error) {
    console.error("Error loading groups:", error);
    // If index error, show notification
    if (error.message.includes("index")) {
      console.warn("Missing index on groups collection. Create index: groups [members, lastMessageTime]");
    }
  }
}

async function loadContacts() {
  const contactList = document.getElementById("contactList");
  if (!contactList) return;

  // Use a simple query for now or rely on search
  // Since we don't have a 'userChats' collection based on rules review,
  // we will try to load users from 'users' collection for demo/list purposes,
  // OR we can query recent messages (expensive).
  // Better approach: Let's use `loadAllUsers` logic but formatted for the list.

  if (!myUID) return;

  contactList.innerHTML = '<li style="text-align:center; padding: 20px;">Loading chats...</li>';

  try {
    // 1. Try to fetch users from 'users' collection (limited)
    // This is a simplified "Contacts" list since we don't have a specific friend graph
    const usersRef = collection(db, "users");
    const q = query(usersRef, limit(20));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      contactList.innerHTML = `
        <li class="empty-state">
          <p>No chats yet</p>
          <p class="hint">Search for friends to start chatting</p>
        </li>
      `;
      return;
    }

    contactList.innerHTML = "";
    let count = 0;

    snapshot.forEach(docSnap => {
      if (docSnap.id === myUID) return; // Skip self

      const user = docSnap.data();
      const uid = docSnap.id;
      const username = user.username || user.name || "User";
      const profilePic = user.profilePic || user.profilePicUrl || null;

      const li = document.createElement("li");
      li.className = "chat-list-item";
      li.dataset.chatId = uid;

      let avatarHtml = `<div class="chat-avatar">${username.charAt(0).toUpperCase()}</div>`;
      if (profilePic) {
        avatarHtml = `<img src="${profilePic}" class="chat-avatar" onerror="this.replaceWith(document.createElement('div')); this.className='chat-avatar'; this.textContent='${username.charAt(0)}'">`;
      }

      li.innerHTML = `
        <div class="chat-avatar-container">
          ${avatarHtml}
          ${user.online ? '<span class="online-status"></span>' : ''}
        </div>
        <div class="chat-info">
          <div class="chat-header">
            <h3>${escape(username)}</h3>
          </div>
          <div class="chat-last-message">
            <p class="status-text">${user.online ? 'Online' : 'Offline'}</p>
          </div>
        </div>
      `;

      li.addEventListener("click", () => {
        openChat(uid, username, profilePic, "direct");
      });

      contactList.appendChild(li);
      count++;
    });

    if (count === 0) {
      contactList.innerHTML = `
        <li class="empty-state">
          <p>No other users found</p>
        </li>
      `;
    }

  } catch (error) {
    console.error("Error loading contacts:", error);
    contactList.innerHTML = `<li style="color: red; padding: 10px;">Error: ${error.message}</li>`;
  }
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY FOR ONCLICK HANDLERS
// ============================================================
// Make sure these functions are available in global scope
window.toggleFullscreen = toggleFullscreen;
window.openSearch = openSearch;
window.openSettingsModal = openSettingsModal;
window.goBackToDashboard = goBackToDashboard;
window.showNotif = showNotif;

console.log("? Functions exposed to global window");
