import { auth, db, rtdb } from "./firebase-config.js";
import { chronexAI } from "./chronex-ai-service.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, onSnapshot, serverTimestamp, orderBy, limit, Timestamp, increment, runTransaction, arrayUnion, arrayRemove
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

let currentChatUser = null;
let currentChatType = 'direct'; // 'direct' or 'group'
let myUID = null;
let myUsername = null;
let myProfilePic = null;
let tokens = 0;
let messageListener = null;
let messageListener2 = null;
let contactsListener = null;
let callActive = false;
let callStartTime = null;
let callTimer = null;
let mentionPopupOpen = false;
let groupMembers = [];
let localAiMessages = []; // Local-only AI messages that haven't synced to Firestore

const notificationSounds = {
  success: 'assets/notification.mp3', // Using standard notification sound
  error: 'assets/error.mp3',
  info: 'assets/pop.mp3'
};

let basicUIInitialized = false;
let authListenersInitialized = false;
let offlineDB = null;
let settingsInitialized = false;
let authRedirectTimer = null;

const emojis = [
  '😊', '😂', '😍', '🤔', '😎', '😢', '❤️', '👍', '🔥', '✨',
  '🎉', '🎊', '😴', '😤', '😡', '😳', '😌', '🤐', '😷', '🤒',
  '🤕', '😪', '😵', '🤤', '😲', '😨', '😰', '😥', '😢', '😭',
  '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
  '👋', '👏', '🙌', '👐', '🤝', '🤲', '🤞', '🖖', '🤘', '🤟'
];

function toggleFullscreen() {
  const elem = document.documentElement;
  const app = document.querySelector('.app');
  const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

  if (!isFullscreen) {
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
    const soundPath = notificationSounds[type] || notificationSounds.info;
    const audio = new Audio(soundPath);
    audio.play().catch(() => playBeep(type));
  } catch (err) {
    playBeep(type);
  }
}

// Fallback beep function
function playBeep(type) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different frequencies for different types
    if (type === 'error') oscillator.frequency.value = 300;
    else if (type === 'success') oscillator.frequency.value = 800;
    else oscillator.frequency.value = 500;

    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    console.error("Audio context not supported", e);
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

    // Update header with null checks
    const infoNameEl = document.getElementById('infoName');
    const infoPicEl = document.getElementById('infoPic');
    const infoMemberCountEl = document.getElementById('infoMemberCount');

    if (infoNameEl) infoNameEl.textContent = groupData.name || 'Group';
    if (infoPicEl) infoPicEl.src = infoPic || '👥';
    if (infoMemberCountEl) infoMemberCountEl.textContent = `Group · ${members.length} members`;

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
      if (mediaPreview) mediaPreview.innerHTML = '';

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
          const mediaPreview = document.getElementById('mediaPreview');
          if (mediaPreview) mediaPreview.appendChild(item);
        }
      });
    } catch (err) {
      console.log('Media loading skipped:', err.message);
      const mediaCountEl = document.getElementById('mediaCount');
      if (mediaCountEl) mediaCountEl.textContent = '0';
    }

    // Load members list
    const membersContent = document.getElementById('membersListContent');
    if (membersContent) membersContent.innerHTML = '';
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
      if (membersContent) membersContent.appendChild(memberDiv);
    }

    // Show the panel
    const infoSidebarEl = document.getElementById('infoSidebar');
    const membersListEl = document.getElementById('membersList');
    if (infoSidebarEl) infoSidebarEl.style.display = 'block';
    if (membersListEl) membersListEl.style.display = 'block';

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

    // Update header with null checks
    const infoNameEl = document.getElementById('infoName');
    const infoPicEl = document.getElementById('infoPic');
    const infoMemberCountEl = document.getElementById('infoMemberCount');

    if (infoNameEl) infoNameEl.textContent = userData.username || userData.name || 'User';
    if (infoPicEl) infoPicEl.src = userData.profilePic || userData.profilePicUrl || '👤';
    if (infoMemberCountEl) infoMemberCountEl.textContent = userData.email || 'User Profile';

    // Hide members list for direct chats with null check
    const membersListEl = document.getElementById('membersList');
    if (membersListEl) membersListEl.style.display = 'none';

    // Check Block/Mute status
    if (typeof myUID !== 'undefined' && myUID) {
      try {
        const myDoc = await getDoc(doc(db, 'users', myUID));
        if (myDoc.exists()) {
          const myData = myDoc.data();
          const blockedUsers = myData.blockedUsers || [];
          const mutedUsers = myData.mutedUsers || [];

          const isBlocked = blockedUsers.includes(userId);
          const isMuted = mutedUsers.includes(userId);

          const blockBtn = document.getElementById('infoBlockBtn');
          const unblockBtn = document.getElementById('infoUnblockBtn');
          const muteToggle = document.getElementById('muteUserToggle');

          if (blockBtn && unblockBtn) {
            if (isBlocked) {
              blockBtn.style.display = 'none';
              unblockBtn.style.display = 'flex';
            } else {
              blockBtn.style.display = 'flex';
              unblockBtn.style.display = 'none';
            }
          }

          if (muteToggle) {
            muteToggle.checked = isMuted;
          }
        }
      } catch (e) {
        console.error("Error checking user status:", e);
      }
    }

    // Show the panel
    const infoSidebarEl = document.getElementById('infoSidebar');
    if (infoSidebarEl) infoSidebarEl.style.display = 'block';

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
  // Hide chat profile display when returning to list view
  hideChatProfileDisplay();

  // Restore user background when returning to list view
  if (window.loadUserBackground) window.loadUserBackground();
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

// function filterChats and applyFilter removed (duplicates). 
// See lines 6628+ for valid definitions.

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
  const announcementsContainer = document.getElementById("announcementsContainer");

  switch (section) {
    case "chats":
      console.log("📱 Showing chats");
      chatListView.style.display = "block";
      statusContainer.style.display = "none";
      groupsContainer.style.display = "none";
      announcementsContainer.style.display = "none";
      break;
    case "updates":
      console.log("✨ Showing statuses");
      chatListView.style.display = "none";
      statusContainer.style.display = "block";
      groupsContainer.style.display = "none";
      announcementsContainer.style.display = "none";
      loadStatusFeed();
      break;
    case "communities":
      console.log("👥 Showing groups");
      chatListView.style.display = "none";
      statusContainer.style.display = "none";
      groupsContainer.style.display = "block";
      announcementsContainer.style.display = "none";
      loadGroups();
      break;
    case "announcements":
      console.log("📢 Showing announcements");
      chatListView.style.display = "none";
      statusContainer.style.display = "none";
      groupsContainer.style.display = "none";
      announcementsContainer.style.display = "flex";
      loadAnnouncements();
      break;
    case "games":
      console.log("🎮 Opening Gaming Hub");
      // Open in new window to preserve fullscreen state
      window.open("gaminghub.html", "_blank");
      showNotif("🎮 Nex Gaming Hub opened in new window", "success");
      break;
    case "marketplace":
      console.log("🛍️ Opening Marketplace");
      // Open in new window to preserve fullscreen state
      window.open("advertisement.html", "_blank");
      showNotif("🛍️ Nex Marketplace opened in new window", "success");
      break;
    case "calls":
      console.log("📞 Showing call history");
      chatListView.style.display = "none";
      statusContainer.style.display = "none";
      groupsContainer.style.display = "none";
      announcementsContainer.style.display = "none";
      const callHistoryContainer = document.getElementById("callHistoryContainer");
      if (callHistoryContainer) {
        callHistoryContainer.style.display = "block";
        loadCallHistory();
      }
      break;
  }
}

async function showChatContextMenu(event, chatId) {
  // Remove any existing context menu
  const existingMenu = document.querySelector(".chat-context-menu");
  if (existingMenu) {
    existingMenu.remove();
  }

  // Check if chat is muted
  const isMuted = await isChatMuted(chatId);

  // Create context menu
  const menu = document.createElement("div");
  menu.className = "chat-context-menu";

  // Find the chat list item and position menu relative to it
  const chatItem = document.querySelector(`li[data-chat-id="${chatId}"]`);
  if (chatItem) {
    chatItem.style.position = "relative";
    chatItem.appendChild(menu);
    // Use relative positioning
    menu.style.cssText = `
      position: absolute;
      top: calc(100% + 5px);
      right: 0;
      background: #1a1a1a;
      border: 2px solid #00ff66;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      min-width: 180px;
    `;
  } else {
    // Fallback to fixed positioning if item not found
    menu.style.cssText = `
      position: fixed;
      top: ${event.clientY}px;
      left: ${event.clientX}px;
      background: #1a1a1a;
      border: 2px solid #00ff66;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      min-width: 180px;
    `;
    document.body.appendChild(menu);
    return;
  }

  const createMenuBtn = (text, color = "#00ff66", borderTop = false) => {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = `
      width: 100%;
      padding: 10px;
      background: transparent;
      border: none;
      color: ${color};
      cursor: pointer;
      text-align: left;
      font-size: 14px;
      transition: all 0.2s;
      ${borderTop ? 'border-top: 1px solid #333;' : ''}
    `;
    btn.onmouseover = () => {
      btn.style.background = `${color}20`;
    };
    btn.onmouseout = () => {
      btn.style.background = "transparent";
    };
    return btn;
  };

  // FAVORITE BUTTON
  const isFavorite = document.querySelector(`li[data-chat-id="${chatId}"]`)?.dataset.favorite === "true";
  const favoriteBtn = createMenuBtn(isFavorite ? "💔 Unfavorite" : "⭐ Favorite", "#ffd700");
  favoriteBtn.onclick = async () => {
    await toggleFavorite(chatId);
    menu.remove();
  };
  menu.appendChild(favoriteBtn);

  // MUTE / UNMUTE BUTTON
  const muteBtn = createMenuBtn(
    isMuted ? "🔊 Unmute" : "🔇 Mute",
    isMuted ? "#00ff66" : "#ffa500",
    true
  );
  muteBtn.onclick = async () => {
    if (isMuted) {
      await unmuteChat(chatId);
    } else {
      await muteChat(chatId);
    }
    menu.remove();
  };
  menu.appendChild(muteBtn);

  // GROUP INFO BUTTON
  const isGroup = document.querySelector(`li[data-chat-id="${chatId}"] .group-avatar`) !== null;
  if (isGroup) {
    const infoBtn = createMenuBtn("ℹ️ Group Info", "#00d4ff", true);
    infoBtn.onclick = () => {
      showGroupInfoPanel(chatId);
      menu.remove();
    };
    menu.appendChild(infoBtn);
  }

  // ARCHIVE BUTTON
  const archiveBtn = createMenuBtn("📦 Archive", "#00ff66", true);
  archiveBtn.onclick = async () => {
    await archiveChat(chatId);
    menu.remove();
  };
  menu.appendChild(archiveBtn);

  // DELETE BUTTON
  const deleteBtn = createMenuBtn("🗑️ Delete", "#ff6b6b", true);
  deleteBtn.onclick = async () => {
    if (confirm("Are you sure you want to delete this chat? This will remove it from your list.")) {
      await deleteChat(chatId);
      menu.remove();
    }
  };
  menu.appendChild(deleteBtn);

  document.body.appendChild(menu);

  // Close menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener("click", function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    });
  }, 0);
}

async function toggleFavorite(chatId) {
  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      let favorites = userDoc.data().favorites || [];
      const index = favorites.indexOf(chatId);

      if (index === -1) {
        favorites.push(chatId);
        showNotif("⭐ Added to favorites", "success", 1500);
      } else {
        favorites.splice(index, 1);
        showNotif("💔 Removed from favorites", "info", 1500);
      }

      await updateDoc(userRef, { favorites });

      // Update UI immediately if possible
      const item = document.querySelector(`li[data-chat-id="${chatId}"]`);
      if (item) {
        item.dataset.favorite = (index === -1) ? "true" : "false";
        // Reload contacts to ensure sort/filter consistency
        setTimeout(loadContacts, 500);
      } else {
        loadContacts();
      }
    }
  } catch (err) {
    console.error("Error toggling favorite:", err);
    showNotif("❌ Failed to update favorite", "error");
  }
}

// MUTE / UNMUTE CHAT FUNCTIONS
async function muteChat(chatId) {
  try {
    const userRef = doc(db, "users", myUID);
    await updateDoc(userRef, {
      mutedChats: arrayUnion(chatId)
    });
    showNotif("🔇 Chat muted", "success", 1500);
    if (typeof loadContacts === 'function') loadContacts();
  } catch (err) {
    console.error("Error muting chat:", err);
    showNotif("❌ Failed to mute chat", "error");
  }
}

async function unmuteChat(chatId) {
  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      let mutedChats = userDoc.data().mutedChats || [];
      mutedChats = mutedChats.filter(id => id !== chatId);

      await updateDoc(userRef, {
        mutedChats: mutedChats
      });
      showNotif("🔊 Chat unmuted", "success", 1500);
      if (typeof loadContacts === 'function') loadContacts();
    }
  } catch (err) {
    console.error("Error unmuting chat:", err);
    showNotif("❌ Failed to unmute chat", "error");
  }
}

// Check if chat is muted
async function isChatMuted(chatId) {
  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const mutedChats = userDoc.data().mutedChats || [];
      return mutedChats.includes(chatId);
    }
    return false;
  } catch (err) {
    console.error("Error checking mute status:", err);
    return false;
  }
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

// Alias for the browse button
function browseAllUsers() {
  loadAllUsers();
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
    const q = query(usersRef, limit(50));
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
  if (messageListener) {
    messageListener();
    messageListener = null;
  }
  if (messageListener2) {
    messageListener2();
    messageListener2 = null;
  }
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

  hapticFeedback('light');

  try {
    const userRef = doc(db, "users", myUID);

    // Use global tokens variable for immediate check (offline-friendly)
    if (tokens < 1) {
      showNotif("❌ Insufficient tokens! You need at least 1 token to send a message. 💳", "error");
      return;
    }

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
    if (currentChatType === 'ai') {
      try {
        console.log("🤖 Initiating Chronex AI synchronization...");

        // 1. Clear input immediately for responsiveness
        if (messageText) messageText.value = "";
        if (typeof removeAttachment === 'function') removeAttachment();

        // 2. Immediate Token Deduction (Synchronous Feedback)
        tokens--;
        const tokenDisplay = document.getElementById("currentTokenBalance");
        if (tokenDisplay) tokenDisplay.textContent = tokens;

        await updateDoc(userRef, {
          tokens: increment(-1),
          lastMessageSentAt: serverTimestamp()
        });

        // 3. Display User Message locally
        if (typeof displayChronexAIUserMessage === 'function') {
          displayChronexAIUserMessage(text);
        }

        // 4. Show "AI is thinking" indicator
        const messagesDiv = document.getElementById("messages-area");
        const typingEl = document.createElement("div");
        typingEl.id = "ai-typing-indicator";
        typingEl.className = "message-wrapper received";
        typingEl.style.cssText = "display: flex; justify-content: flex-start; margin: 8px 0; padding: 0 12px;";
        typingEl.innerHTML = `
          <img src="chronex-ai.jpg" class="message-avatar" alt="AI" style="width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #00ff66; margin-right: 8px;">
          <div class="message-bubble" style="background: linear-gradient(135deg, #111, #0a0e1a); color: #00ff66; padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(0, 255, 102, 0.3);">
            <p style="margin: 0;"><i class="fas fa-microchip pulse"></i> 📡 Synaptic processing...</p>
          </div>
        `;
        if (messagesDiv) {
          messagesDiv.appendChild(typingEl);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        // 5. Query AI with Safety Timeout
        const aiPromise = chronexAI.chat(text, `chronex-${myUID}`);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("AI_TIMEOUT")), 5000)
        );

        const aiResponse = await Promise.race([aiPromise, timeoutPromise]);

        // 6. Remove indicator
        const indicator = document.getElementById("ai-typing-indicator");
        if (indicator) indicator.remove();

        // 7. Display AI Response
        if (typeof displayChronexAIResponse === 'function') {
          displayChronexAIResponse(aiResponse);
        }

        // 8. Add to local cache so updateMessages doesn't wipe it
        localAiMessages.push({
          from: 'chronex-ai',
          to: myUID,
          text: aiResponse,
          time: { toDate: () => new Date() },
          read: true,
          type: 'text',
          localOnly: true
        });

        hapticFeedback('success');
        showNotif(`✓ Neural Sync Successful`, "success", 1500);

      } catch (aiErr) {
        console.error("❌ Chronex AI Error:", aiErr);
        const indicator = document.getElementById("ai-typing-indicator");
        if (indicator) indicator.remove();

        let errorMsg = "Neural uplink failed. Using fallback protocols.";
        if (aiErr.message === "AI_TIMEOUT") errorMsg = "Neural link timed out. Local cache engaged.";

        showNotif("❌ " + errorMsg, "error");

        // Final Fallback: Direct Local Response
        try {
          const fallback = await chronexAI.getJavaScriptResponse(text);
          if (typeof displayChronexAIResponse === 'function') {
            displayChronexAIResponse(fallback);
          }
          localAiMessages.push({
            from: 'chronex-ai',
            to: myUID,
            text: fallback,
            time: { toDate: () => new Date() },
            read: true,
            type: 'text',
            localOnly: true,
            isAiResponse: true
          });
        } catch (fErr) {
          console.error("Critical Fallback Failed:", fErr);
        }
      }
    } else if (currentChatType === 'group') {
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
        reactions: [],
        // Add reply information if replying
        ...(window.messagingFeatures && window.messagingFeatures.replyingToMessage && window.messagingFeatures.replyingToMessage() ? {
          replyTo: {
            text: window.messagingFeatures.replyingToMessage().text,
            senderName: window.messagingFeatures.replyingToMessage().senderName,
            timestamp: new Date().toISOString()
          }
        } : {})
      };
      if (attachment) messageData.attachment = attachment;
      await addDoc(collection(db, "messages"), messageData);

      // Deduct 1 token
      await updateDoc(userRef, {
        tokens: increment(-1),
        lastMessageSentAt: serverTimestamp()
      });

      // Track message activity
      try {
        await addDoc(collection(db, 'messageActivity'), {
          userId: myUID,
          recipientId: currentChatUser,
          sentAt: new Date(),
          messageLength: (text || "").length,
          hasAttachment: !!attachment,
          tokensCost: 1
        });
      } catch (trackErr) {
        console.warn('Warning: Could not track message activity:', trackErr);
      }
    }

    // Common post-send logic (Clear UI)
    if (window.messagingFeatures && window.messagingFeatures.hideReplyPreview) {
      window.messagingFeatures.hideReplyPreview();
    }
    if (messageText) messageText.value = "";
    if (typeof removeAttachment === 'function') removeAttachment();

    hapticFeedback('success');
    showNotif(`✓ Message sent`, "success", 2000);
    const emojiPicker = document.getElementById("emoji-picker");
    if (emojiPicker) emojiPicker.style.display = "none";
    console.log("✅ Message lifecycle synchronized successfully");
  } catch (err) {
    hapticFeedback('heavy');
    console.error("❌ Critical Send Error:", err);
    showNotif("Error sending message: " + err.message, "error");
  }
}

// ============ CHRONEX AI DISPLAY FUNCTIONS ============

function displayChronexAIUserMessage(message) {
  const messagesContainer = document.getElementById("messages-area");
  if (!messagesContainer) return;

  const div = document.createElement("div");
  div.className = "message-wrapper sent";
  div.style.cssText = "display: flex; justify-content: flex-end; margin: 8px 0; padding: 0 12px;";

  div.innerHTML = `
    <div class="message-bubble" style="background: #00ff66; color: #000; padding: 10px 14px; border-radius: 12px; max-width: 70%; word-wrap: break-word;">
      <p style="margin: 0;">${escape(message)}</p>
      <div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">✓ ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  `;

  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displayChronexAIResponse(response) {
  const messagesContainer = document.getElementById("messages-area");
  if (!messagesContainer) return;

  const div = document.createElement("div");
  div.className = "message-wrapper received";
  div.style.cssText = "display: flex; justify-content: flex-start; margin: 8px 0; padding: 0 12px;";

  div.innerHTML = `
    <img src="chronex-ai.jpg" class="message-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1.5px solid #00ff66; margin-right: 8px; flex-shrink: 0;">
    <div class="message-bubble" style="background: linear-gradient(135deg, #111, #0a0e1a); color: #00ff66; padding: 10px 14px; border-radius: 12px; max-width: 70%; word-wrap: break-word; border: 1px solid rgba(0, 255, 102, 0.3);">
      <p style="margin: 0; white-space: pre-wrap;">${response}</p>
      <div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  `;

  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displayChronexAIError(errorMessage) {
  const messagesContainer = document.getElementById("messages-area");
  if (!messagesContainer) return;

  const div = document.createElement("div");
  div.className = "message-wrapper received error";
  div.style.cssText = "display: flex; justify-content: flex-start; margin: 8px 0; padding: 0 12px;";

  div.innerHTML = `
    <img src="chronex-ai.jpg" class="message-avatar" style="width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #ff4d4d; margin-right: 8px; flex-shrink: 0;">
    <div class="message-bubble" style="background: rgba(255, 77, 77, 0.1); color: #ff4d4d; padding: 10px 14px; border-radius: 12px; max-width: 70%; word-wrap: break-word; border: 1px solid rgba(255, 77, 77, 0.3);">
      <p style="margin: 0;">⚠️ **NEURAL LINK ERROR**</p>
      <p style="margin: 4px 0 0 0; font-size: 13px;">${escape(errorMessage)}</p>
      <div style="font-size: 11px; margin-top: 4px; opacity: 0.7;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  `;

  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function loadMessages() {
  if (!currentChatUser) {
    console.warn("⚠️ loadMessages: No currentChatUser set");
    return;
  }

  console.log("📨 Loading messages for chat with:", currentChatUser);
  console.log("📨 Current user UID:", myUID);

  // Unsubscribe from previous listeners to prevent memory leaks
  if (messageListener) {
    messageListener();
    messageListener = null;
  }
  if (messageListener2) {
    messageListener2();
    messageListener2 = null;
  }

  const messagesDiv = document.getElementById("messages-area");
  if (!messagesDiv) {
    console.error("❌ messages-area element not found");
    return;
  }

  // NORMALIZE AI CHAT: Load records like a standard direct link
  if (currentChatType === 'ai') {
    console.log("📨 Loading neural history for Chronex AI...");
    messagesDiv.innerHTML = "<p style='text-align: center; color: #00ff66; padding: 20px; font-family: Orbitron;'>📡 Synchronizing Neural Uplink...</p>";
  } else {
    messagesDiv.innerHTML = "<p style='text-align: center; color: #888; padding: 20px;'>Loading messages...</p>";
  }

  // Query for messages sent by current user to chat user OR from chat user to current user
  // Note: Using limit without orderBy to avoid composite index requirement, we'll sort in JS
  const q = query(
    collection(db, "messages"),
    where("from", "==", myUID),
    where("to", "==", currentChatUser),
    limit(50) // Reduced limit for better performance
  );

  const q2 = query(
    collection(db, "messages"),
    where("from", "==", currentChatUser),
    where("to", "==", myUID),
    limit(50) // Reduced limit for better performance
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

    // Filter out local AI messages that are now present in the database messages to prevent duplicates
    const dbMessages = [...messages1, ...messages2];
    const uniqueLocalAiMessages = localAiMessages.filter(localMsg => {
      // Keep local message ONLY if it's NOT found in DB messages
      // We match by text and approximate time (within 10 seconds)
      const isDuplicate = dbMessages.some(dbMsg => {
        const dbTime = dbMsg.time?.toMillis ? dbMsg.time.toMillis() : (dbMsg.time || 0);
        const localTime = localMsg.time?.toMillis ? localMsg.time.toMillis() : (localMsg.time?.toDate ? localMsg.time.toDate().getTime() : Date.now());
        return dbMsg.text === localMsg.text && Math.abs(dbTime - localTime) < 10000;
      });
      return !isDuplicate;
    });

    const allMessages = [...dbMessages, ...uniqueLocalAiMessages].sort((a, b) => {
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

    // Mark incoming unread messages as read
    allMessages.forEach(async (m) => {
      if (m.from !== myUID && m.read === false && m.docId) {
        try {
          await updateDoc(doc(db, "messages", m.docId), { read: true });
        } catch (e) {
          console.error("Error marking message as read:", e);
        }
      }
    });

    // Reload contacts to update unread badges
    setTimeout(() => {
      if (typeof loadContacts === 'function') {
        loadContacts();
      }
    }, 500);

    allMessages.forEach((m) => {
      let isOwn = m.from === myUID;
      const isAI = m.from === 'chronex-ai' || m.isAiResponse;

      // If it's an AI response, it should always be treated as "received" (not own)
      if (isAI) isOwn = false;

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

      // Add reply indicator if message is a reply
      if (m.replyTo) {
        const replyIndicator = document.createElement("div");
        replyIndicator.className = "swipe-reply-indicator";
        replyIndicator.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        width: 4px;
        height: 100%;
        background: ${isOwn ? "#00aa44" : "#00d4ff"};
        border-radius: 2px;
      `;
        bubble.style.position = "relative";
        bubble.style.paddingLeft = "14px";
        bubble.appendChild(replyIndicator);

        const replyQuote = document.createElement("div");
        replyQuote.style.cssText = `
        background: ${isOwn ? "rgba(0,170,68,0.2)" : "rgba(0,212,255,0.2)"};
        border-left: 3px solid ${isOwn ? "#00aa44" : "#00d4ff"};
        padding: 8px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 12px;
        font-style: italic;
      `;
        replyQuote.innerHTML = `<strong>↩️ ${escape(m.replyTo.senderName)}:</strong> ${escape(m.replyTo.text.substring(0, 60))}${m.replyTo.text.length > 60 ? '...' : ''}`;
        bubble.appendChild(replyQuote);
      }

      const content = document.createElement("p");
      content.style.margin = "0";

      // Check if message is an audio file
      if (m.attachment && m.attachment.fileType && m.attachment.fileType.startsWith('audio/')) {
        // Create audio player
        const audioPlayer = window.messagingFeatures.createAudioPlayerElement(
          m.attachment.downloadURL,
          m.attachment.duration || 0
        );
        bubble.appendChild(audioPlayer);
      } else {
        // Regular text message
        if (isAI || (currentChatType === 'ai' && !isOwn)) {
          const aiAvatar = document.createElement("img");
          aiAvatar.src = "chronex-ai.jpg";
          aiAvatar.className = "message-avatar";
          aiAvatar.style.cssText = `width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1.5px solid #00ff66; margin-right: 8px; flex-shrink: 0;`;

          div.appendChild(aiAvatar); // Append avatar FIRST
          bubble.style.background = "linear-gradient(135deg, #111, #0a0e1a)";
          bubble.style.border = "1px solid rgba(0, 255, 102, 0.3)";
          bubble.style.color = "#00ff66";
        }
        content.textContent = m.text;
        bubble.appendChild(content);
      }

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
    loaded1 = true; // Mark as loaded even with error
    updateMessages();
  });

  // Assign second listener to messageListener2 to avoid leaks
  messageListener2 = onSnapshot(q2, (snap) => {
    console.log("✅ Query 2 snapshot received:", snap.docs.length, "messages");
    messages2 = snap.docs.map(docSnap => ({ ...docSnap.data(), docId: docSnap.id }));
    loaded2 = true;
    updateMessages();
  }, (err) => {
    console.error("❌ Error loading incoming messages:", err);
    loaded2 = true; // Mark as loaded even with error
    updateMessages();
  });
}

// ============================================================
// CONTACTS & USER MANAGEMENT
// ============================================================

// NOTE: loadContacts is defined in the DYNAMICALLY ADDED FUNCTIONS section below (line ~6198)
// This prevents duplicate function declarations

// ============================================================
// OPEN CHAT & UPDATE UI
// ============================================================

// Update profile display in header and message input area
function updateChatProfileDisplay(username, profilePic, status = 'Online') {
  // Update header active chat info
  const headerLogoContainer = document.getElementById("headerLogoContainer");
  const activeChatHeader = document.getElementById("activeChatHeader");

  if (headerLogoContainer && activeChatHeader) {
    headerLogoContainer.style.display = 'none';
    activeChatHeader.style.display = 'flex';

    const activeChatName = document.getElementById("activeChatName");
    const activeChatStatus = document.getElementById("activeChatStatus");
    const activeChatAvatar = document.getElementById("activeChatAvatar");

    if (activeChatName) activeChatName.textContent = username;
    if (activeChatStatus) activeChatStatus.textContent = status;
    if (activeChatAvatar) {
      if (profilePic) {
        activeChatAvatar.src = profilePic;
        activeChatAvatar.style.display = 'block';
      } else {
        activeChatAvatar.src = 'logo.jpg';
      }

      // AVATAR CLICK → Show Profile Picture Modal (Like Nex Avatars)
      activeChatAvatar.style.cursor = 'pointer';
      activeChatAvatar.onclick = (e) => {
        e.stopPropagation();
        const modal = document.getElementById('profilePicModal');
        const modalImg = document.getElementById('profileModalImg');
        const modalName = document.getElementById('profileModalName');
        const modalDesc = document.getElementById('profileModalDesc');
        const modalWordmark = document.getElementById('profileModalBrandWordmark');

        if (modal && modalImg && modalName) {
          modalImg.src = profilePic || 'logo.jpg';
          modalName.textContent = username;

          if (modalWordmark) modalWordmark.style.display = (username === "Chronex AI") ? 'block' : 'none';

          if (modalDesc) {
            if (username === "Chronex AI") {
              modalDesc.textContent = "Official NEX_DEV Neural Assistant. Primary interface for the NEXCHAT ecosystem. Advanced robotic intelligence designed for cross-sector synchronization.";
            } else if (status.includes("Group")) {
              modalDesc.textContent = "Secure NEX_CORE Communication Node. Restricted access unit for multi-user data stream processing.";
            } else {
              modalDesc.textContent = "Registered NEXCHAT Neural Entity. Secure direct-link established.";
            }
          }

          modal.style.display = 'flex';

          // Hide edit button (not their profile)
          const editBtn = document.getElementById('editProfileBtnModal');
          if (editBtn) editBtn.style.display = 'none';
        }
      };
    }
  }

  // USERNAME CLICK → Open User Info Panel
  if (activeChatName) {
    activeChatName.style.cursor = 'pointer';
    activeChatName.onclick = (e) => {
      e.stopPropagation();
      if (currentChatUser && currentChatType === 'direct') {
        showUserInfoPanel(currentChatUser);
      } else if (currentChatUser && currentChatType === 'group') {
        showGroupInfoPanel(currentChatUser);
      }
    };
  }

  // Update message input area profile display
  const chatUserProfile = document.getElementById("chatUserProfile");
  if (chatUserProfile) {
    chatUserProfile.style.display = 'flex';

    const chatUserName = document.getElementById("chatUserName");
    const chatUserStatus = document.getElementById("chatUserStatus");
    const chatUserAvatar = document.getElementById("chatUserAvatar");

    if (chatUserName) chatUserName.textContent = username;
    if (chatUserStatus) chatUserStatus.textContent = status;
    if (chatUserAvatar) {
      chatUserAvatar.src = profilePic || "👤";

      // AVATAR CLICK → Show Profile Picture Modal (input area)
      chatUserAvatar.style.cursor = 'pointer';
      chatUserAvatar.onclick = (e) => {
        e.stopPropagation();
        if (profilePic) {
          const modal = document.getElementById('profilePicModal');
          const modalImg = document.getElementById('profileModalImg');
          const modalName = document.getElementById('profileModalName');
          const modalDesc = document.getElementById('profileModalDesc');
          const modalWordmark = document.getElementById('profileModalBrandWordmark');

          if (modal && modalImg && modalName) {
            modalImg.src = profilePic || 'logo.jpg';
            modalName.textContent = username;

            if (modalWordmark) modalWordmark.style.display = (username === "Chronex AI") ? 'block' : 'none';

            if (modalDesc) {
              if (username === "Chronex AI") {
                modalDesc.textContent = "Official NEX_DEV Neural Assistant. Primary interface for the NEXCHAT ecosystem. Advanced robotic intelligence designed for cross-sector synchronization.";
              } else if (status.includes("Group")) {
                modalDesc.textContent = "Secure NEX_CORE Communication Node. Restricted access unit for multi-user data stream processing.";
              } else {
                modalDesc.textContent = "Registered NEXCHAT Neural Entity. Secure direct-link established.";
              }
            }

            modal.style.display = 'flex';

            // Hide edit button
            const editBtn = document.getElementById('editProfileBtnModal');
            if (editBtn) editBtn.style.display = 'none';
          }
        }
      };
    }

    // USERNAME CLICK → Open User Info Panel (input area)
    if (chatUserName) {
      chatUserName.style.cursor = 'pointer';
      chatUserName.onclick = (e) => {
        e.stopPropagation();
        if (currentChatUser && currentChatType === 'direct') {
          showUserInfoPanel(currentChatUser);
        } else if (currentChatUser && currentChatType === 'group') {
          showGroupInfoPanel(currentChatUser);
        }
      };
    }
  }
}

// Hide profile display (when not in a chat)
function hideChatProfileDisplay() {
  const headerLogoContainer = document.getElementById("headerLogoContainer");
  const activeChatHeader = document.getElementById("activeChatHeader");
  const chatUserProfile = document.getElementById("chatUserProfile");

  if (headerLogoContainer) headerLogoContainer.style.display = 'block';
  if (activeChatHeader) activeChatHeader.style.display = 'none';
  if (chatUserProfile) chatUserProfile.style.display = 'none';
}

async function openChat(uid, username, profilePic, chatType = 'direct') {
  currentChatUser = uid;
  currentChatType = chatType;

  // Clear or load local AI history for this session
  if (uid === 'chronex-ai' || chatType === 'ai') {
    // We keep localAiMessages for the active session
  } else {
    localAiMessages = [];
  }

  // Update the profile display immediately
  updateChatProfileDisplay(username, profilePic, "Loading...");


  // Update chat header elements (with null checks)
  const chatNameEl = document.getElementById("chatName");
  if (chatNameEl) chatNameEl.textContent = username;

  const chatProfilePicEl = document.getElementById("chatProfilePic");
  if (chatProfilePicEl) {
    if (profilePic && (profilePic.startsWith('http') || profilePic.startsWith('data:') || profilePic.includes('.'))) {
      chatProfilePicEl.src = profilePic;
    } else {
      chatProfilePicEl.src = 'logo.jpg';
    }
  }

  // Update info sidebar (with null checks)
  const infoNameEl = document.getElementById("infoName");
  if (infoNameEl) infoNameEl.textContent = username;

  const infoPicEl = document.getElementById("infoPic");
  if (infoPicEl) {
    if (profilePic && (profilePic.startsWith('http') || profilePic.startsWith('data:') || profilePic.includes('.'))) {
      infoPicEl.src = profilePic;
    } else {
      infoPicEl.src = 'logo.jpg';
    }
  }

  try {
    if (chatType === 'group') {
      // Load group info
      const groupDoc = await getDoc(doc(db, "groups", uid));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        const infoEmailEl = document.getElementById("infoEmail");
        if (infoEmailEl) infoEmailEl.textContent = `Members: ${groupData.members.length} `;

        const statusTextEl = document.getElementById("statusText");
        if (statusTextEl) statusTextEl.textContent = `👥 Group Chat`;

        const infoStatusEl = document.getElementById("infoStatus");
        if (infoStatusEl) infoStatusEl.textContent = `👥 Group Chat`;

        // Update profile display with group status
        updateChatProfileDisplay(username, profilePic, "👥 Group Chat");

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
    } else if (chatType === 'ai') {
      // Handle AI chat type (Chronex AI)
      const infoEmailEl = document.getElementById("infoEmail");
      if (infoEmailEl) infoEmailEl.textContent = "Advanced AI Assistant";

      const statusTextEl = document.getElementById("statusText");
      if (statusTextEl) statusTextEl.textContent = "🤖 AI Ready";

      const infoStatusEl = document.getElementById("infoStatus");
      if (infoStatusEl) infoStatusEl.textContent = "🤖 AI Ready";

      // Update profile display with AI status
      updateChatProfileDisplay(username, profilePic, "🤖 AI Ready");

      // Update info sidebar with AI profile and logo
      const infoDescEl = document.getElementById("infoDesc");
      const infoBrandLogo = document.getElementById("infoBrandLogo");
      if (infoDescEl) infoDescEl.textContent = "Official NEX_DEV Neural Assistant. Primary interface for the NEXCHAT ecosystem. Advanced robotic intelligence designed for cross-sector synchronization.";
      if (infoBrandLogo) infoBrandLogo.style.display = 'block';

      showNotif("💬 Welcome to Chronex AI! Ask me anything!", "info");
    } else {
      // Load individual user info
      const userDoc = await getDoc(doc(db, "users", uid));
      let userData = {};

      if (userDoc.exists()) {
        userData = userDoc.data();
        const infoEmail = document.getElementById("infoEmail");
        if (infoEmail) infoEmail.textContent = userData.email || "";

        const statusText = userData.online ? "🟢 Online" : "⚫ Offline";
        const statusTextEl = document.getElementById("statusText");
        if (statusTextEl) statusTextEl.textContent = statusText;

        const infoStatusEl = document.getElementById("infoStatus");
        if (infoStatusEl) infoStatusEl.textContent = statusText;

        // Update profile display with user status
        updateChatProfileDisplay(username, profilePic, statusText);
      } else {
        // User document doesn't exist yet, but allow chatting with UID
        console.warn("User document not found in database, but proceeding with UID:", uid);
        const infoEmail = document.getElementById("infoEmail");
        if (infoEmail) infoEmail.textContent = "Profile pending...";

        const statusTextEl = document.getElementById("statusText");
        if (statusTextEl) statusTextEl.textContent = "⚪ Pending";

        const infoStatusEl = document.getElementById("infoStatus");
        if (infoStatusEl) infoStatusEl.textContent = "⚪ Pending";

        // Update profile display with pending status
        updateChatProfileDisplay(username, profilePic, "⚪ Pending");

        showNotif("ℹ️ User profile not fully synced yet. Chat enabled via UID.", "info");
      }
    }

    // NEX_CORE: Reset info brand logo and desc for non-AI chats
    const infoDescEl = document.getElementById("infoDesc");
    const infoBrandLogo = document.getElementById("infoBrandLogo");
    if (chatType === 'ai') {
      if (infoDescEl) infoDescEl.textContent = "Official NEX_DEV Neural Assistant. Primary interface for the NEXCHAT ecosystem. Advanced robotic intelligence designed for cross-sector synchronization.";
      if (infoBrandLogo) infoBrandLogo.style.display = 'block';
    } else {
      if (infoDescEl) infoDescEl.textContent = "";
      if (infoBrandLogo) infoBrandLogo.style.display = 'none';
    }

    // If it's a direct chat (not group and not AI), auto-add to contacts if not already there
    if (chatType === 'direct' && myUID && uid !== myUID) {
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
            if (typeof loadContacts === 'function') loadContacts();
          }, 300);
        }
      } catch (contactErr) {
        console.warn("Could not update contacts:", contactErr);
      }
    }

    // Show chat view
    showChatDetailView();

    // Load chat-specific background
    await loadChatBackground(uid, chatType);

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
  // Get active chat avatar
  const avatarSrc = document.getElementById('activeChatAvatar')?.src || '';

  // Create call overlay
  const callOverlay = document.createElement('div');
  callOverlay.id = 'call-overlay';
  callOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 999;
    padding: 20px;
    backdrop-filter: blur(10px);
    `;

  callOverlay.innerHTML = `
      <div style="text-align: center; color: #fff; display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%;">
        ${isVideo ? `
        <!-- Video Call UI with actual camera feed -->
        <div id="video-container" style="
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          <!-- Remote Video (Other person's camera - full screen) -->
          <video id="remote-video" autoplay playsinline style="
            width: 100%;
            max-width: 800px;
            height: 70vh;
            max-height: 600px;
            background: #000;
            border: 3px solid #00ff66;
            border-radius: 12px;
            object-fit: cover;
            box-shadow: 0 0 30px rgba(0,255,102,0.3);
          "></video>
          
          <!-- Placeholder for remote video (shown until connection established) -->
          <div id="remote-placeholder" style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 1;
          ">
            <img src="${avatarSrc}" style="
              width: 120px;
              height: 120px;
              border-radius: 50%;
              border: 3px solid #00ff66;
              margin-bottom: 15px;
              object-fit: cover;
              box-shadow: 0 0 20px rgba(0,255,102,0.4);
            ">
            <p style="color: #00ff66; font-size: 16px; margin: 0;">📹 Connecting...</p>
          </div>
          
          <!-- Local Video (Your camera - small preview in corner) -->
          <video id="local-video" autoplay playsinline muted style="
            position: absolute;
            bottom: 120px;
            right: 30px;
            width: 150px;
            height: 200px;
            background: #000;
            border: 2px solid #00ff66;
            border-radius: 8px;
            object-fit: cover;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            z-index: 10;
          "></video>
          
          <!-- "You" label on local video -->
          <div style="
            position: absolute;
            bottom: 125px;
            right: 35px;
            background: rgba(0,255,102,0.9);
            color: #000;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            z-index: 11;
          ">YOU</div>
        </div>
      ` : `
        <!-- Audio Call Profile Pic -->
        <div style="
          width: 120px; 
          height: 120px; 
          border-radius: 50%; 
          border: 3px solid #00ff66; 
          padding: 3px;
          margin-bottom: 30px;
          box-shadow: 0 0 30px rgba(0,255,102,0.3);
          animation: pulse-ring 2s infinite;
        ">
          <img src="${avatarSrc}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">
        </div>
      `}
      
      <h2 style="margin: ${isVideo ? '15px 0 5px 0' : '0 0 10px 0'}; color: #00ff66; font-size: 24px;">${isVideo ? 'Video' : 'Voice'} Call Active</h2>
      <p id="call-duration" style="margin: 0 0 10px 0; font-size: ${isVideo ? '32px' : '42px'}; color: #fff; font-weight: 300; font-family: monospace;">0:00</p>
      <p style="margin: 0 0 ${isVideo ? '15px' : '30px'} 0; color: #888; font-size: 16px;">with <span style="color: #00ff66; font-weight: bold;">${currentChatUser}</span></p>
      
      <!-- Call Controls -->
      <div style="display: flex; gap: 15px; align-items: center;">
        ${isVideo ? `
          <!-- Toggle Camera Button -->
          <button id="toggle-camera-btn" style="
            padding: 12px;
            background: rgba(255,255,255,0.1);
            color: #fff;
            border: 2px solid #00ff66;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            width: 55px;
            height: 55px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          " title="Toggle Camera">📹</button>
          
          <!-- Toggle Microphone Button -->
          <button id="toggle-mic-btn" style="
            padding: 12px;
            background: rgba(255,255,255,0.1);
            color: #fff;
            border: 2px solid #00ff66;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            width: 55px;
            height: 55px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          " title="Toggle Microphone">🎤</button>
        ` : ''}
        
        <!-- End Call Button -->
        <button id="end-call-btn" style="
          padding: 15px 40px;
          background: #ff4444;
          color: #fff;
          border: none;
          border-radius: 50px;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);
          display: flex;
          align-items: center;
          gap: 10px;
        ">
          <span style="font-size: 24px;">📞</span> End Call
        </button>
      </div>
      
      <style>
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(0, 255, 102, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(0, 255, 102, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 255, 102, 0); }
        }
        
        #toggle-camera-btn:hover, #toggle-mic-btn:hover {
          background: rgba(0,255,102,0.2);
          transform: scale(1.05);
        }
        
        #toggle-camera-btn.disabled, #toggle-mic-btn.disabled {
          background: rgba(255,68,68,0.3);
          border-color: #ff4444;
        }
      </style>
    </div>
      `;

  document.body.appendChild(callOverlay);

  // If video call, set up the video streams
  if (isVideo) {
    setupVideoStreams();
  }

  // End call button
  const endBtn = document.getElementById('end-call-btn');
  endBtn.addEventListener('click', () => {
    endCall();
    callOverlay.remove();
  });

  // Video controls (if video call)
  if (isVideo) {
    let cameraEnabled = true;
    let micEnabled = true;

    const toggleCameraBtn = document.getElementById('toggle-camera-btn');
    const toggleMicBtn = document.getElementById('toggle-mic-btn');

    toggleCameraBtn?.addEventListener('click', () => {
      cameraEnabled = !cameraEnabled;
      const localVideo = document.getElementById('local-video');
      if (localVideo && localVideo.srcObject) {
        const videoTrack = localVideo.srcObject.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = cameraEnabled;
          toggleCameraBtn.classList.toggle('disabled', !cameraEnabled);
          toggleCameraBtn.textContent = cameraEnabled ? '📹' : '🚫';
        }
      }
    });

    toggleMicBtn?.addEventListener('click', () => {
      micEnabled = !micEnabled;
      const localVideo = document.getElementById('local-video');
      if (localVideo && localVideo.srcObject) {
        const audioTrack = localVideo.srcObject.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = micEnabled;
          toggleMicBtn.classList.toggle('disabled', !micEnabled);
          toggleMicBtn.textContent = micEnabled ? '🎤' : '🔇';
        }
      }
    });
  }

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

// NEW: Setup video streams for video calls
async function setupVideoStreams() {
  try {
    // Get local video element
    const localVideo = document.getElementById('local-video');

    if (!localVideo) {
      console.error('Local video element not found');
      return;
    }

    // Get user media (camera and microphone)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // Display local video stream (your camera)
    localVideo.srcObject = stream;

    // Store the stream globally so we can stop it later
    window.currentCallStream = stream;

    console.log('✅ Video stream connected successfully');
    showNotif('📹 Camera connected', 'success', 2000);

    // In a real implementation, you would use WebRTC to connect to the remote peer
    // For now, we'll simulate the remote video by hiding the placeholder
    // NOTE: Full WebRTC P2P implementation requires signaling server

    // Simulate connection after 2 seconds
    setTimeout(() => {
      const placeholder = document.getElementById('remote-placeholder');
      if (placeholder) {
        // In real implementation, this would show the remote peer's video
        // For demo purposes, we show a message
        placeholder.innerHTML = `
          <p style="color: #00ff66; font-size: 14px;">📡 Waiting for ${currentChatUser} to join...</p>
          <p style="color: #888; font-size: 12px; margin-top: 10px;">For full P2P video calling, WebRTC signaling server required</p>
        `;
      }
    }, 2000);

  } catch (error) {
    console.error('Error setting up video streams:', error);
    showNotif(`❌ Camera error: ${error.message}`, 'error', 4000);
  }
}

// Add listener for instant audio sending
document.addEventListener('audioMessageReady', (e) => {
  if (e.detail && e.detail.file) {
    console.log("🎤 Audio message ready received in chat.js");
    // Set the selected file
    selectedFile = e.detail.file;

    // Trigger submit on the form
    const form = document.getElementById('message-form');
    if (form) {
      // Create and dispatch event
      const submitEvent = new Event('submit', {
        'bubbles': true,
        'cancelable': true
      });
      form.dispatchEvent(submitEvent);
    }
  }
});

function endCall() {
  // Calculate call duration
  const callDuration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
  const callType = document.getElementById('local-video') ? 'video' : 'voice';

  // Save call to history before cleaning up
  if (currentChatUser && myUID) {
    saveCallToHistory(currentChatUser, callType, callDuration).catch(err => {
      console.warn('Could not save call to history:', err);
    });
  }

  if (callTimer) clearInterval(callTimer);
  callActive = false;
  callStartTime = null;

  // Stop all media tracks from the current call stream
  if (window.currentCallStream) {
    window.currentCallStream.getTracks().forEach(track => {
      track.stop();
    });
    window.currentCallStream = null;
  }

  // Also try to stop any other active streams
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

document.getElementById("infoAddBtn")?.addEventListener("click", () => {
  if (currentChatType === 'group') {
    // Open group members modal to add new members
    const modal = document.getElementById("addMembersModal");
    if (modal) {
      modal.style.display = "block";
      showNotif("👥 Add group members", "info");
    } else {
      showNotif("👥 Create a popup to add members", "info");
    }
  } else {
    showNotif("👥 Add members to convert to group chat", "info");
  }
});

document.getElementById("infoSearchBtn")?.addEventListener("click", () => {
  // Open search within this chat
  openSearch();
  showNotif("🔍 Search within this chat", "info");
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

document.getElementById("nav-announcements")?.addEventListener("click", () => {
  const announcementsContainer = document.getElementById("announcementsContainer");
  const chatListView = document.getElementById("chatListView");
  const statusContainer = document.getElementById("statusContainer");
  const groupsContainer = document.getElementById("groupsContainer");

  if (announcementsContainer.style.display === "none") {
    chatListView.style.display = "none";
    statusContainer.style.display = "none";
    groupsContainer.style.display = "none";
    announcementsContainer.style.display = "flex";

    // Remove active from other nav items
    document.getElementById("nav-messages").classList.remove("active");
    document.getElementById("nav-status").classList.remove("active");
    document.getElementById("nav-groups").classList.remove("active");
    document.getElementById("nav-announcements").classList.add("active");

    loadAnnouncements();
    showNotif("📢 Announcements", "info", 800);
  } else {
    announcementsContainer.style.display = "none";
    chatListView.style.display = "block";
    document.getElementById("nav-announcements").classList.remove("active");
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
  try { document.dispatchEvent(new CustomEvent('selectedFileChanged')); } catch (e) { }
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
  try { document.dispatchEvent(new CustomEvent('selectedFileChanged')); } catch (e) { }
}

async function uploadFileToStorage(file, chatId, isGroup = false) {
  try {
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    const folderPath = isGroup ? `group-attachments/${chatId}/${myUID}` : `chat-attachments/${myUID}`;
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



async function transferTokens() {
  console.log("🚀 Transfer Tokens button clicked!");
  console.log("📌 Current myUID:", myUID);

  const recipientUID = document.getElementById("recipientUID")?.value.trim();
  const amount = parseInt(document.getElementById("transferAmount")?.value || 0);
  const resultEl = document.getElementById("transferResult");
  const transferBtn = document.getElementById("transferTokensBtn");

  console.log("📝 Recipient UID input:", recipientUID);
  console.log("💰 Amount input:", amount);
  console.log("🎯 Result element:", resultEl);
  console.log("🔘 Transfer button:", transferBtn);

  // Check if user is authenticated
  if (!myUID) {
    if (resultEl) {
      resultEl.innerHTML = `<span style="color: #ff6b6b;">❌ Please log in first. If you are logged in, try refreshing the page.</span>`;
    }
    showNotif("❌ Authentication required", "error");
    console.error("❌ myUID is null - user not authenticated");
    return;
  }

  if (!resultEl) {
    console.error("❌ Transfer result element not found!");
    return;
  }

  // Validation
  if (!recipientUID) {
    resultEl.innerHTML = `<span style="color: #ff6b6b;">❌ Please enter recipient UID</span>`;
    return;
  }

  if (!amount || amount <= 0) {
    resultEl.innerHTML = `<span style="color: #ff6b6b;">❌ Please enter a valid amount</span>`;
    return;
  }

  if (amount > 99999) {
    resultEl.innerHTML = `<span style="color: #ff6b6b;">❌ Amount cannot exceed 99,999 tokens</span>`;
    return;
  }

  if (recipientUID === myUID) {
    resultEl.innerHTML = `<span style="color: #ff6b6b;">❌ Cannot transfer tokens to yourself</span>`;
    return;
  }

  try {
    // Disable button and show loading
    if (transferBtn) {
      transferBtn.disabled = true;
      transferBtn.textContent = "⏳ Processing...";
    }

    resultEl.innerHTML = `<span style="color: #00ff66;">⏳ Verifying recipient...</span>`;

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
        throw new Error("Recipient not found - invalid UID");
      }

      const senderTokens = senderDoc.data()?.tokens ?? 0;
      const recipientTokens = recipientDoc.data()?.tokens ?? 0;

      // Validate tokens are numbers
      if (typeof senderTokens !== 'number' || typeof recipientTokens !== 'number') {
        throw new Error("Invalid token data format");
      }

      if (senderTokens < amount) {
        throw new Error(`Insufficient balance - You have ${senderTokens} tokens, but trying to send ${amount}`);
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
        recipientName: recipientDoc.data()?.username || "User",
        recipientEmail: recipientDoc.data()?.email || "unknown",
        amount,
        newSenderTokens,
        newRecipientTokens
      };
    });

    // Success message with details
    resultEl.innerHTML = `
      <div style="background: rgba(0, 255, 102, 0.1); border-left: 3px solid #00ff66; padding: 12px; border-radius: 6px; margin-top: 12px;">
        <p style="color: #00ff66; margin: 0; font-weight: 600;">✅ Transfer Successful!</p>
        <p style="color: #e0e0e0; margin: 6px 0 0 0; font-size: 13px;">
          Sent <strong>${result.amount} tokens</strong> to <strong>${result.recipientName}</strong>
        </p>
        <p style="color: #888; margin: 4px 0 0 0; font-size: 12px;">
          Your new balance: <strong style="color: #00ff66;">${result.newSenderTokens}</strong> tokens
        </p>
      </div>
    `;

    console.log(`✅ Transfer complete: ${result.amount} tokens sent to ${result.recipientName}`);

    // Clear inputs
    document.getElementById("recipientUID").value = "";
    document.getElementById("transferAmount").value = "";

    // Re-enable button after delay
    setTimeout(() => {
      if (transferBtn) {
        transferBtn.disabled = false;
        transferBtn.textContent = "🚀 Send Tokens";
      }
      resultEl.innerHTML = "";
    }, 4000);

  } catch (err) {
    console.error("Transfer error:", err);
    console.error("Error code:", err.code);
    console.error("Error message:", err.message);

    let errorMsg = err.message;
    let errorTitle = "Transfer Failed";

    if (err.message && err.message.includes('offline')) {
      errorMsg = "Network error - Check your internet connection";
      errorTitle = "Offline";
    } else if (err.code === 'permission-denied' || err.message?.includes('Permission denied')) {
      errorMsg = "You don't have permission to transfer tokens";
      errorTitle = "Permission Denied";
    } else if (err.code === 'not-found') {
      errorMsg = "User or data not found";
      errorTitle = "Not Found";
    } else if (err.code === 'invalid-argument') {
      errorMsg = "Invalid data - ensure all fields are correct";
      errorTitle = "Invalid Input";
    } else if (err.message?.includes('Insufficient balance')) {
      errorTitle = "Insufficient Balance";
    } else if (err.message?.includes('Recipient not found')) {
      errorMsg = "Recipient UID not found";
      errorTitle = "User Not Found";
    } else if (err.message?.includes('Your user data not found')) {
      errorMsg = "Your account data not found";
      errorTitle = "Account Error";
    }

    resultEl.innerHTML = `
      <div style="background: rgba(255, 107, 107, 0.1); border-left: 3px solid #ff6b6b; padding: 12px; border-radius: 6px; margin-top: 12px;">
        <p style="color: #ff6b6b; margin: 0; font-weight: 600;">❌ ${errorTitle}</p>
        <p style="color: #e0e0e0; margin: 6px 0 0 0; font-size: 13px;">${errorMsg}</p>
      </div>
    `;

    // Re-enable button
    if (transferBtn) {
      transferBtn.disabled = false;
      transferBtn.textContent = "🚀 Send Tokens";
    }
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

    // Load current token balance
    loadTokenBalance();

    // Add vibration feedback on Android
    if (isAndroid && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }
}

async function loadTokenBalance() {
  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const tokens = userDoc.data()?.tokens ?? 0;
      const balanceEl = document.getElementById("currentTokenBalance");
      if (balanceEl) {
        balanceEl.textContent = tokens.toLocaleString();
      }
    }
  } catch (err) {
    console.error("Error loading token balance:", err);
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

    // Load chat size preference
    const chatSize = prefs.chatSize || "medium";
    // Convert "extra-large" to "ExtraLarge" for element ID lookup
    const chatSizeFormatted = chatSize.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
    const chatSizeEl = document.getElementById("chatSize" + chatSizeFormatted);
    if (chatSizeEl) chatSizeEl.checked = true;

    // Load text adjustment preferences
    const fontFamilySelect = document.getElementById("fontFamilySelect");
    if (fontFamilySelect && prefs.fontFamily) {
      fontFamilySelect.value = prefs.fontFamily;
    }

    const letterSpacingRange = document.getElementById("letterSpacingRange");
    if (letterSpacingRange && prefs.letterSpacing !== undefined) {
      letterSpacingRange.value = prefs.letterSpacing;
      document.getElementById("letterSpacingValue").textContent = prefs.letterSpacing;
    }

    const lineHeightRange = document.getElementById("lineHeightRange");
    if (lineHeightRange && prefs.lineHeight !== undefined) {
      lineHeightRange.value = prefs.lineHeight;
      document.getElementById("lineHeightValue").textContent = prefs.lineHeight;
    }

    // Load text alignment preference
    const alignButtons = document.querySelectorAll(".text-align-btn");
    alignButtons.forEach(btn => {
      btn.style.background = "#444";
      btn.style.color = "#fff";
    });
    const alignmentBtn = document.getElementById("align" + (prefs.textAlignment || "left").charAt(0).toUpperCase() + (prefs.textAlignment || "left").slice(1));
    if (alignmentBtn) {
      alignmentBtn.style.background = "#00ff66";
      alignmentBtn.style.color = "#000";
    }

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

    // Get text alignment from active button
    let textAlignment = "left";
    const activeAlignBtn = document.querySelector(".text-align-btn[style*='background: rgb(0, 255, 102)']");
    if (activeAlignBtn) {
      if (activeAlignBtn.id === "alignLeft") textAlignment = "left";
      else if (activeAlignBtn.id === "alignCenter") textAlignment = "center";
      else if (activeAlignBtn.id === "alignRight") textAlignment = "right";
    }

    const prefs = {
      notifications: notifEl?.checked ?? true,
      sound: soundEl?.checked ?? true,
      onlineStatus: onlineEl?.checked ?? true,
      readReceipts: readEl?.checked ?? true,
      theme: document.querySelector('input[name="theme"]:checked')?.value || "dark",
      chatSize: document.querySelector('input[name="chatSize"]:checked')?.value || "medium",
      fontFamily: document.getElementById("fontFamilySelect")?.value || "Arial, sans-serif",
      letterSpacing: parseFloat(document.getElementById("letterSpacingRange")?.value) || 0,
      lineHeight: parseFloat(document.getElementById("lineHeightRange")?.value) || 1.5,
      textAlignment: textAlignment,
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

    // Apply chat size
    const chatSize = prefs.chatSize || "medium";
    document.documentElement.setAttribute("data-chat-size", chatSize);
    document.body.classList.remove("chat-size-small", "chat-size-medium", "chat-size-large", "chat-size-extra-large");
    document.body.classList.add(`chat-size-${chatSize}`);

    // Apply text adjustments to messages
    const messagesContainer = document.querySelector('.messages');
    if (messagesContainer) {
      const fontFamily = prefs.fontFamily || "Arial, sans-serif";
      const letterSpacing = (prefs.letterSpacing || 0) + "px";
      const lineHeight = prefs.lineHeight || 1.5;
      const textAlignment = prefs.textAlignment || "left";

      messagesContainer.style.fontFamily = fontFamily;
      messagesContainer.style.letterSpacing = letterSpacing;
      messagesContainer.style.lineHeight = lineHeight;

      // Apply alignment to message items
      document.querySelectorAll('.message-item').forEach(msg => {
        msg.style.textAlign = textAlignment;
      });
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

// ============================================================
// BACKGROUND MANAGEMENT FUNCTIONS
// ============================================================

function applyBackgroundImage(imageUrl) {
  const app = document.querySelector(".app");
  if (app) {
    app.style.backgroundImage = `url('${imageUrl}')`;
    app.style.backgroundSize = 'cover';
    app.style.backgroundPosition = 'center';

    // Android Optimization: 'fixed' attachment is buggy on mobile, use 'scroll'
    // and ensure the container is tall enough
    if (typeof isAndroid !== 'undefined' && isAndroid) {
      app.style.backgroundAttachment = 'scroll';
      app.style.minHeight = '100dvh'; // Use dynamic viewport height
    } else {
      app.style.backgroundAttachment = 'fixed';
    }

    app.style.backgroundRepeat = 'no-repeat';
    app.style.backgroundColor = 'transparent';
    app.setAttribute('data-custom-bg', 'true');
    console.log("✅ Background applied:", imageUrl, typeof isAndroid !== 'undefined' && isAndroid ? "(Android optimized)" : "");
  }
}

function removeBackgroundImage() {
  const app = document.querySelector(".app");
  if (app) {
    app.style.backgroundImage = "none";
    app.style.backgroundColor = ""; // Reset to default CSS value
    app.setAttribute('data-custom-bg', 'false');
    console.log("✅ Background removed");
  }
}

function updateBackgroundPreview(imageUrl) {
  const preview = document.getElementById("backgroundPreview");
  if (preview) {
    preview.style.backgroundImage = `url('${imageUrl}')`;
  }
}

async function loadChatBackground(chatId, chatType) {
  // Normalize parameters
  const uid = chatId || currentChatUser;
  const type = chatType || currentChatType;

  try {
    // Check Local Cache First for instant loading
    const cachedBg = localStorage.getItem(`chat_bg_${uid}`);
    if (cachedBg) {
      applyBackgroundImage(cachedBg);
      return;
    }

    if (type === 'ai') {
      // Default AI background if no custom one exists
      applyBackgroundImage('chronex-background.jpg');
    }

    if (!myUID || !uid) return;

    const bgDocPath = chatType === 'group'
      ? `groupBackgrounds/${chatId}`
      : `directMessageBackgrounds/${myUID}_${chatId}`;

    const bgDoc = await getDoc(doc(db, bgDocPath.split('/')[0], bgDocPath.split('/')[1]));

    if (bgDoc.exists() && bgDoc.data().backgroundUrl) {
      applyBackgroundImage(bgDoc.data().backgroundUrl);
    } else {
      // Revert to user global background
      loadUserBackground();
    }
  } catch (error) {
    console.warn("Could not load chat background:", error);
    loadUserBackground();
  }
}

async function loadUserBackground() {
  try {
    const savedBg = localStorage.getItem("nexchat_background");
    if (savedBg) {
      applyBackgroundImage(savedBg);
      updateBackgroundPreview(savedBg);
      return;
    }

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
}

window.loadChatBackground = loadChatBackground;
window.loadUserBackground = loadUserBackground;
window.loadUserBackgroundOnAuth = loadUserBackground;

// Initialize app after DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupInitialization);
} else {
  setupInitialization();
}

async function setupInitialization() {
  // Setup initial listeners on DOM ready
  initializeBasicUI();

  // Setup auth listener for post-auth initialization
  onAuthStateChanged(auth, async (user) => {
    // Clear any pending redirect timer immediately when the auth state changes
    if (authRedirectTimer) {
      clearTimeout(authRedirectTimer);
      authRedirectTimer = null;
    }
    if (user) {
      myUID = user.uid;
      console.log("✅ User authenticated:", myUID);

      // Initialize Chronex AI with user ID
      if (typeof chronexAI !== 'undefined' && chronexAI.setUserId) {
        chronexAI.setUserId(myUID);
      }

      try {
        const userDoc = await getDoc(doc(db, "users", myUID));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          myUsername = userData.username || "";
          myProfilePic = userData.profilePic || userData.profilePicUrl || "";

          if (myProfilePic && (myProfilePic.startsWith('http') || myProfilePic.startsWith('data:'))) {
            const profileBtn = document.getElementById('profile-sticker');
            if (profileBtn) {
              profileBtn.style.backgroundImage = `url('${myProfilePic}')`;
              profileBtn.style.backgroundSize = 'cover';
              profileBtn.style.backgroundPosition = 'center';
              profileBtn.style.fontSize = '0';
              profileBtn.style.borderRadius = '50%';
              profileBtn.onclick = (e) => {
                e.preventDefault();
                // Open modal logic
                const modal = document.getElementById('profilePicModal');
                const modalImg = document.getElementById('profileModalImg');
                const modalName = document.getElementById('profileModalName');

                if (modal && modalImg) {
                  modalImg.src = myProfilePic;
                  if (modalName) modalName.innerText = myUsername || "ME";
                  modal.style.display = 'flex';

                  const editBtn = document.getElementById('editProfileBtnModal');
                  if (editBtn) {
                    editBtn.style.display = 'block';
                    editBtn.onclick = () => window.location.href = 'profile-upload.html';
                  }
                }
              };
            }
            const statusImg = document.getElementById('myStatusPic');
            if (statusImg) {
              statusImg.src = myProfilePic;
            }
          }

          // Also handle close modal
          const closeProfileModal = document.getElementById('closeProfileModal');
          if (closeProfileModal) {
            closeProfileModal.onclick = () => {
              document.getElementById('profilePicModal').style.display = 'none';
            };
          }

          const profilePicModal = document.getElementById('profilePicModal');
          if (profilePicModal) {
            profilePicModal.onclick = (e) => {
              if (e.target === profilePicModal) {
                profilePicModal.style.display = 'none';
              }
            };
          }

          // Listener for avatar selection from other pages (profile-upload or profile-avatars)
          window.addEventListener('message', (event) => {
            if (event.data.type === 'avatarSelected') {
              const avatar = event.data.avatar;
              const newPic = avatar.url || avatar.svg;
              if (newPic) {
                myProfilePic = newPic;
                const profileBtn = document.getElementById('profile-sticker');
                if (profileBtn) {
                  profileBtn.style.backgroundImage = `url('${newPic}')`;
                  profileBtn.style.fontSize = '0';
                }
                const statusImg = document.getElementById('myStatusPic');
                if (statusImg) statusImg.src = newPic;
              }
            }
          });
          const tokenCount = userData.tokens ?? 0;
          tokens = tokenCount; // Sync initial tokens to global variable
          console.log("💰 Token count from Firebase:", tokenCount);
          console.log("💰 User data:", userData);

          const tokenDisplay = document.getElementById("tokenCount");
          console.log("💰 Token display element:", tokenDisplay);

          if (tokenDisplay) {
            tokenDisplay.textContent = tokenCount;
            console.log("✅ Token display updated to:", tokenCount);
          } else {
            console.error("❌ Token display element not found!");
          }

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

        // --- HANDLE MARKETPLACE REDIRECTION ---
        const fromAd = sessionStorage.getItem('fromAdvertisement');
        const targetUID = sessionStorage.getItem('targetUserUID');
        const targetName = sessionStorage.getItem('targetUsername');
        const productName = sessionStorage.getItem('productName');

        if (fromAd === 'true' && targetUID && targetUID !== myUID) {
          console.log(`🛍️ Redirected from Marketplace to chat with ${targetName}`);

          // Clear flags
          sessionStorage.removeItem('fromAdvertisement');
          sessionStorage.removeItem('targetUserUID');
          sessionStorage.removeItem('targetUsername');
          sessionStorage.removeItem('productName');

          // Open the chat
          setTimeout(async () => {
            const initialText = productName ? `Hi, I'm interested in your advertisement: "${productName}"` : "Hi, I'm interested in your advertisement!";
            await openChat(targetUID, targetName, null, 'direct');

            const messageInput = document.getElementById('message-input');
            if (messageInput) {
              messageInput.value = initialText;
              messageInput.focus();
            }
          }, 1000);
        }

        // Listen for real-time token updates - ONLY update token display, don't reset
        const tokenSnapshotUnsubscribe = onSnapshot(doc(db, "users", myUID), (userDocSnapshot) => {
          if (userDocSnapshot.exists()) {
            const snapshotData = userDocSnapshot.data();
            const currentTokens = snapshotData.tokens;

            // Only update if tokens field exists and has a valid value
            if (typeof currentTokens === 'number' && currentTokens >= 0) {
              tokens = currentTokens; // Sync global tokens variable
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
        // Listen for incoming messages to auto-add users to chat list
        // OPTIMIZED: Added limit and orderBy to prevent fetching entire history causing lag
        // Also removed sequential awaits inside loop
        const incomingMessagesQuery = query(
          collection(db, "messages"),
          where("to", "==", myUID),
          orderBy("timestamp", "desc"),
          limit(50)
        );

        const incomingMessagesUnsubscribe = onSnapshot(incomingMessagesQuery, async (snapshot) => {
          // Collect new senders first to avoid multiple DB operations
          const newSenders = new Set();

          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data.from && data.from !== myUID) {
                newSenders.add(data.from);
              }
            }
          });

          if (newSenders.size === 0) return;

          try {
            // Fetch user doc ONCE instead of N times
            const myUserRef = doc(db, "users", myUID);
            const myUserDoc = await getDoc(myUserRef);

            if (!myUserDoc.exists()) return;

            const myContacts = myUserDoc.data()?.contacts || [];
            let updated = false;

            for (const senderUID of newSenders) {
              if (!myContacts.includes(senderUID)) {
                myContacts.push(senderUID);
                updated = true;
                console.log("✅ Auto-added", senderUID, "to contacts");
              }
            }

            if (updated) {
              await updateDoc(myUserRef, { contacts: myContacts });
              // Reload contacts to show new senders
              if (typeof loadContacts === 'function') loadContacts();
            }
          } catch (err) {
            console.warn("Could not auto-add sender to contacts:", err);
          }
        }, (error) => {
          if (error.code === 'failed-precondition') {
            console.warn("⚠️ Index missing for incoming messages query. Please create 'messages' index: to (Asc) + timestamp (Desc)");
          }
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
        } catch (contactErr) {
          console.error("Error loading contacts:", contactErr);
        }

        // Successfully authenticated, so we can clear the redirect block for future use
        sessionStorage.removeItem('auth_redirect_block');

      } catch (err) {
        console.error("Error loading user data:", err);
        showNotif("Error loading user data: " + err.message, "error");
      }
    } else {
      // Prevent infinite redirect loop
      console.warn("User not authenticated. Redirecting to login...");

      // Show a friendly message before redirecting
      const chatMain = document.querySelector('.chat-main');
      if (chatMain) {
        chatMain.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;text-align:center;padding:20px;">
            <div style="font-size:60px;margin-bottom:20px;">🔒</div>
            <h2 style="color:#00ff66;margin-bottom:10px;">Authentication Required</h2>
            <p style="color:#888;margin-bottom:30px;">Please log in to access NEXCHAT</p>
            <div style="color:#00ff66;font-size:14px;">Redirecting to login in <span id="countdown">3</span>...</div>
          </div>
        `;

        // Countdown timer
        let timeLeft = 3;
        const countdownEl = document.getElementById('countdown');
        const countdownTimer = setInterval(() => {
          timeLeft--;
          if (countdownEl) countdownEl.textContent = timeLeft;
          if (timeLeft <= 0) {
            clearInterval(countdownTimer);
          }
        }, 1000);
      }

      // Check if we've already tried redirecting
      if (!sessionStorage.getItem('auth_redirect_block')) {
        sessionStorage.setItem('auth_redirect_block', 'true');
        authRedirectTimer = setTimeout(() => {
          window.location.href = "index.html";
        }, 3000); // Increased to 3 seconds
      } else {
        // If we're stuck in a loop, it means we redirected once and still have no user.
        // Don't clear the block yet so we don't keep looping. 
        // Just show the manual option.
        if (chatMain) {
          chatMain.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;text-align:center;padding:20px;">
              <div style="font-size:60px;margin-bottom:20px;">⚠️</div>
              <h2 style="color:#ff6666;margin-bottom:10px;">Authentication Issue</h2>
              <p style="color:#888;margin-bottom:30px;">We couldn't verify your login details automatically.</p>
              <button onclick="sessionStorage.removeItem('auth_redirect_block'); window.location.href='index.html'" style="padding:15px 30px;background:#00ff66;color:#000;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:16px;box-shadow: 0 4px 12px rgba(0,255,102,0.3);">Go to Login Page</button>
            </div>
          `;
        }
      }
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
}

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

const transferTokensBtnEl = document.getElementById("transferTokensBtn");
if (transferTokensBtnEl) {
  transferTokensBtnEl.addEventListener("click", transferTokens, false);
  console.log("✅ Transfer Tokens button listener attached successfully");
} else {
  console.error("❌ Transfer Tokens button not found in DOM!");
}


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

  // Chat size radio buttons
  document.querySelectorAll('input[name="chatSize"]').forEach(radio => {
    radio.addEventListener("change", saveSettingsPreferences, false);
  });

  // Text Element Adjustment - Font Family
  const fontFamilySelect = document.getElementById("fontFamilySelect");
  if (fontFamilySelect) {
    fontFamilySelect.addEventListener("change", saveSettingsPreferences, false);
  }

  // Text Element Adjustment - Letter Spacing
  const letterSpacingRange = document.getElementById("letterSpacingRange");
  if (letterSpacingRange) {
    letterSpacingRange.addEventListener("input", (e) => {
      document.getElementById("letterSpacingValue").textContent = e.target.value;
      saveSettingsPreferences();
    }, false);
  }

  // Text Element Adjustment - Line Height
  const lineHeightRange = document.getElementById("lineHeightRange");
  if (lineHeightRange) {
    lineHeightRange.addEventListener("input", (e) => {
      document.getElementById("lineHeightValue").textContent = e.target.value;
      saveSettingsPreferences();
    }, false);
  }

  // Text Element Adjustment - Text Alignment
  const alignButtons = document.querySelectorAll(".text-align-btn");
  alignButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      alignButtons.forEach(b => {
        b.style.background = "#444";
        b.style.color = "#fff";
      });
      e.target.style.background = "#00ff66";
      e.target.style.color = "#000";
      saveSettingsPreferences();
    }, false);
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



// Upload background for current chat
document.getElementById("uploadChatBackgroundBtn")?.addEventListener("click", async (e) => {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  if (!myUID) {
    showNotif("❌ You must be logged in", "error");
    return;
  }
  if (!currentChatUser) {
    showNotif("❌ No active chat detected. Open a chat first.", "error");
    return;
  }

  const fileInput = document.getElementById("chatBackgroundImageInput");
  const file = fileInput?.files[0];

  if (!file) {
    showNotif("❌ Please select an image first", "error");
    return;
  }

  try {
    showNotif("📸 Synchronizing Background Ledger...", "info");

    const timestamp = Date.now();
    const bgPath = currentChatType === 'group'
      ? `chatBackgrounds/groups/${currentChatUser}/${timestamp}_${file.name}`
      : `chatBackgrounds/direct/${myUID}_${currentChatUser}/${timestamp}_${file.name}`;

    const bgRef = storageRef(storage, bgPath);
    const snapshot = await uploadBytes(bgRef, file);
    const bgUrl = await getDownloadURL(snapshot.ref);

    const collection_name = currentChatType === 'group' ? 'groupBackgrounds' : 'directMessageBackgrounds';
    const doc_id = currentChatType === 'group' ? currentChatUser : `${myUID}_${currentChatUser}`;

    await setDoc(doc(db, collection_name, doc_id), {
      backgroundUrl: bgUrl,
      uploadedAt: serverTimestamp(),
      fileName: file.name,
      chatId: currentChatUser,
      chatType: currentChatType,
      owner: myUID
    }, { merge: true });

    // Update UI and Cache
    applyBackgroundImage(bgUrl);
    localStorage.setItem(`chat_bg_${currentChatUser}`, bgUrl);

    showNotif("✅ Neural Atmosphere Calibrated!", "success");
    if (fileInput) fileInput.value = "";
  } catch (error) {
    console.error("❌ Background Upload Failure:", error);
    showNotif("❌ Upload Failed: " + error.message, "error");
  }
});

// Remove background for current chat
document.getElementById("removeChatBackgroundBtn")?.addEventListener("click", async () => {
  if (!currentChatUser) {
    showNotif("❌ No chat selected", "error");
    return;
  }

  if (!confirm("🗑️ Remove this chat's background?")) return;

  try {
    showNotif("🗑️ Removing chat background...", "info");

    const collection_name = currentChatType === 'group' ? 'groupBackgrounds' : 'directMessageBackgrounds';
    const doc_id = currentChatType === 'group' ? currentChatUser : `${myUID}_${currentChatUser}`;

    await updateDoc(doc(db, collection_name, doc_id), {
      backgroundUrl: null,
      removedAt: serverTimestamp()
    });

    removeBackgroundImage();
    localStorage.removeItem(`chat_bg_${currentChatUser}`);

    showNotif("✅ Chat background removed!", "success");
  } catch (error) {
    console.error("❌ Failed to remove chat background:", error);
    showNotif("❌ Failed to remove chat background", "error");
  }
});

// ============================================================
// BACKGROUND IMAGE FEATURE (KEPT FOR COMPATIBILITY)
// ============================================================

// Upload background button
document.getElementById("uploadBackgroundBtn")?.addEventListener("click", async (e) => {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const fileInput = document.getElementById("backgroundImageInput");
  const file = fileInput.files[0];

  if (!file) {
    showNotif("❌ Please select an image first", "error");
    return;
  }

  try {
    showNotif("📸 Uploading background image...", "info");

    const bgRef = storageRef(storage, `backgrounds/${myUID}/${Date.now()}`);
    const snapshot = await uploadBytes(bgRef, file);
    const bgUrl = await getDownloadURL(snapshot.ref);

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
            // Auto-delete expired status (only if it's mine)
            if (status.userId === myUID) {
              try {
                await deleteDoc(doc(db, "statuses", docSnap.id));
              } catch (err) {
                console.warn("Could not delete expired status:", err);
              }
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


// Generate Random Group Avatar
document.getElementById('generateGroupAvatarBtn')?.addEventListener('click', () => {
  const randomString = Math.random().toString(36).substring(7);
  const avatarUrl = `https://robohash.org/${randomString}?set=set1&size=200x200`;
  document.getElementById('groupIconPreview').src = avatarUrl;
  document.getElementById('groupIconPreview').setAttribute('data-generated', 'true');
});

async function createGroup(e) {
  e.preventDefault();

  const nameInput = document.getElementById('groupName');
  const descInput = document.getElementById('groupDescription');
  const resultDiv = document.getElementById('groupCreateResult');
  const iconInput = document.getElementById('groupIconInput');
  const iconPreview = document.getElementById('groupIconPreview');

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

    let profilePicUrl = ''; // Default or empty

    // Handle Icon Upload
    if (iconInput && iconInput.files && iconInput.files[0]) {
      try {
        showNotif('📤 Uploading group icon...', 'info');
        const file = iconInput.files[0];
        const storageRefPath = `groups/${Date.now()}_${file.name}`;
        const imgRef = storageRef(storage, storageRefPath);
        const snapshot = await uploadBytes(imgRef, file);
        profilePicUrl = await getDownloadURL(snapshot.ref);
      } catch (uploadErr) {
        console.error("Error uploading group icon:", uploadErr);
        showNotif('⚠️ Failed to upload icon, using default', 'warning');
      }
    } else if (iconPreview && iconPreview.getAttribute('data-generated') === 'true') {
      profilePicUrl = iconPreview.src;
    }

    // Create group in Firestore
    const groupRef = await addDoc(collection(db, 'groups'), {
      name: name,
      description: description,
      creatorId: myUID,
      members: membersList,
      admins: [myUID], // Creator is default admin
      profilePic: profilePicUrl,
      createdAt: serverTimestamp(),
      lastMessage: '',
      lastMessageTime: serverTimestamp()
    });

    console.log(`✅ Group created with ID: ${groupRef.id}`);
    showNotif(`✅ Group "${name}" created!`, 'success', 2000);

    // Generate group join link
    const groupJoinLink = `${window.location.origin}${window.location.pathname}?joinGroup=${groupRef.id}`;

    // Show group created message with link option
    if (resultDiv) {
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
    }

    // Reset form
    document.getElementById('createGroupForm')?.reset();
    document.getElementById('createGroupModal').style.display = 'none';

    // Reset preview
    if (iconPreview) {
      iconPreview.src = "logo.jpg";
      iconPreview.removeAttribute('data-generated');
    }

    // Reload chat list to show new group
    await loadContacts();

    // Open the new group
    await openChat(groupRef.id, name, profilePicUrl || '👥', 'group');

  } catch (error) {
    console.error('❌ Error creating group:', error);
    if (resultDiv) {
      resultDiv.style.display = 'block';
      resultDiv.style.background = '#ff6b6b';
      resultDiv.style.color = '#fff';
      resultDiv.textContent = `❌ Error: ${error.message || 'Unknown error'}`;
    }
    showNotif(`Error creating group: ${error.message}`, 'error', 3000);
  }
}

// Function to delete group (Admin only)
async function deleteGroup(groupId) {
  if (!confirm("⚠️ Are you sure you want to DELETE this group? This action cannot be undone and will remove the group for ALL members.")) return;

  try {
    await deleteDoc(doc(db, "groups", groupId));
    showNotif("✅ Group deleted successfully", "success");
    document.getElementById('groupInfoModal').style.display = 'none';
    showChatListView();
    await loadContacts();
  } catch (err) {
    console.error("Error deleting group:", err);
    showNotif("❌ Failed to delete group", "error");
  }
}



// Global functions for admin actions
window.promoteMember = async (groupId, userId) => {
  try {
    await updateDoc(doc(db, "groups", groupId), {
      admins: arrayUnion(userId)
    });
    showNotif("✅ Member promoted to Admin!", "success");
    showGroupInfoPanel(groupId); // Refresh
  } catch (err) {
    showNotif("Failed to promote member", "error");
  }
};

window.removeMember = async (groupId, userId) => {
  if (!confirm("Remove this user from the group?")) return;
  try {
    const groupRef = doc(db, "groups", groupId);
    // Note: We need arrayRemove which needs to be imported if not available, assumes available in scope like arrayUnion
    await updateDoc(groupRef, {
      members: arrayRemove(userId),
      admins: arrayRemove(userId)
    });
    showNotif("👋 Member removed", "info");
    showGroupInfoPanel(groupId); // Refresh
  } catch (err) {
    showNotif("Failed to remove member", "error");
  }
};

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
// ANNOUNCEMENTS SYSTEM
// ============================================================

async function loadAnnouncements() {
  try {
    const announcementsFeed = document.getElementById('announcementsFeed');
    if (!announcementsFeed) return;

    // Define the pinned welcome announcement HTML
    const pinnedAnnouncementHTML = `
      <div class="announcement-item pinned-announcement" style="border: 2px solid #00ff66; background: rgba(0, 255, 102, 0.05); margin-bottom: 15px;">
        <div class="announcement-header">
          <h4 class="announcement-title">WELCOME TO NEXCHAT</h4>
          <span class="announcement-badge" style="background: #00ff66; color: #000;">📢 NEX-DEV</span>
        </div>
        <p class="announcement-content" style="font-weight: 600; color: #fff;">
          WELCOME TO NEXCHAT THE FUTURE IS INIT I AM DEMON ALEX NEX DEVELOPER....
        </p>
        <p class="announcement-content">
          NEW FEATURES ARE BRINGING YOU NEX_REELS SIMILAR TO TIKTOK/SNAPCHAT BUT IT WILL BE ON NEXCHAT BY NOVEMBER 23RD... 
          IF YOU HAVE ANY COMPLAINT KINDLY GO TO NEX SETTINGS AND FILE THEM
        </p>
        <p class="announcement-content" style="color: #00ff66; font-weight: bold; margin-top: 10px; text-shadow: 0 0 10px rgba(0,255,102,0.5);">
          🚀 LIVE TERMINAL WILL BE ADDED TO NEXCHAT
        </p>
        <div class="announcement-footer">
          <span class="announcement-time">IMPORTANT Update</span>
          <span class="announcement-admin">BEST REGARDS: DEMON ALEX {LINUX-DEVELOPER}</span>
        </div>
      </div>
    `;

    const q = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(q);

    // Always start with the pinned announcement
    announcementsFeed.innerHTML = pinnedAnnouncementHTML;

    if (snapshot.empty) {
      announcementsFeed.innerHTML += `
        <div class="announcements-empty-state">
          <p>📢 No other announcements yet</p>
          <p class="hint">Stay tuned for more updates from NEXCHAT</p>
        </div>
      `;
      return;
    }

    snapshot.forEach(doc => {
      const announcement = doc.data();
      const announceDiv = document.createElement('div');
      announceDiv.className = 'announcement-item';

      const createdTime = announcement.createdAt?.toDate ? announcement.createdAt.toDate() : (announcement.createdAt ? new Date(announcement.createdAt) : new Date());
      const timeDiff = Math.floor((Date.now() - createdTime.getTime()) / 1000);

      let timeText = 'Just now';
      if (timeDiff < 60) {
        timeText = 'Just now';
      } else if (timeDiff < 3600) {
        timeText = `${Math.floor(timeDiff / 60)}m ago`;
      } else if (timeDiff < 86400) {
        timeText = `${Math.floor(timeDiff / 3600)}h ago`;
      } else {
        timeText = `${Math.floor(timeDiff / 86400)}d ago`;
      }

      announceDiv.innerHTML = `
        <div class="announcement-header">
          <h4 class="announcement-title">${escape(announcement.title || 'Announcement')}</h4>
          <span class="announcement-badge">📢 Admin</span>
        </div>
        <p class="announcement-content">${escape(announcement.content || '')}</p>
        <div class="announcement-footer">
          <span class="announcement-time">${timeText}</span>
          <span class="announcement-admin">By Admin</span>
        </div>
      `;

      announcementsFeed.appendChild(announceDiv);
    });

    showNotif('📢 Announcements updated', 'success', 2000);
  } catch (error) {
    console.error('❌ Error loading announcements:', error);
    showNotif('Error loading announcements: ' + error.message, 'error');
  }
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
  // Guard to prevent duplicate initialization
  if (basicUIInitialized) {
    console.log("ℹ️ Basic UI already initialized, skipping...");
    return;
  }
  basicUIInitialized = true;

  // Load and apply saved settings (chat size, theme, etc.)
  try {
    // NEX_CORE: Add click listener to main logo for branding modal
    const mainLogo = document.getElementById('headerLogoContainer');
    if (mainLogo) {
      mainLogo.style.cursor = 'pointer';
      mainLogo.addEventListener('click', () => {
        const modal = document.getElementById('profilePicModal');
        const modalImg = document.getElementById('profileModalImg');
        const modalName = document.getElementById('profileModalName');
        const modalDesc = document.getElementById('profileModalDesc');

        if (modal && modalImg && modalName) {
          modalImg.src = 'logo.jpg';
          modalName.textContent = "NEXCHAT SYSTEM";
          if (modalDesc) modalDesc.textContent = "Elite Robotic Communication Protocol v2.0. Powered by NEX_DEV Neural Engines. The standard in autonomous data exchange.";
          modal.style.display = 'flex';
          const editBtn = document.getElementById('editProfileBtnModal');
          if (editBtn) editBtn.style.display = 'none';
        }
      });
    }

    const savedSettings = JSON.parse(localStorage.getItem("nexchat_settings")) || {};
    applySettings(savedSettings);
  } catch (err) {
    console.log("No saved settings found, using defaults");
  }

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
    messageForm.addEventListener("submit", (e) => {
      console.log("📤 Message form submitted via enter key");
      sendMessage(e);
    });
    console.log("✅ Message form listener attached");
  } else {
    console.warn("⚠️ Message form element not found");
  }

  // Header Buttons - Search
  document.getElementById('search-btn-header')?.addEventListener('click', openSearch);
  document.getElementById('close-search-btn')?.addEventListener('click', closeSearch);
  document.getElementById('newChatBtn')?.addEventListener('click', openSearch);
  document.getElementById('browse-users-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    browseAllUsers();
  });
  document.getElementById('search-submit-btn')?.addEventListener('click', searchUser);
  document.getElementById('search-input')?.addEventListener('keypress', (e) => {
    if (e.key === "Enter") searchUser();
  });

  // Header Buttons - Settings
  document.getElementById('settings-btn-header')?.addEventListener('click', () => {
    const modal = document.getElementById('settingsModal');
    if (modal) {
      modal.style.display = 'block';
      const uidDisplay = document.getElementById('userUIDDisplay');
      if (uidDisplay) uidDisplay.textContent = myUID || 'Loading...';
    }
  });
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    saveSettingsPreferences();
    closeSettingsModal();
  });

  // Header Buttons - Fullscreen
  document.getElementById('fullscreen-btn-header')?.addEventListener('click', toggleFullscreen);

  // Create Group
  document.getElementById('createNewGroupBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('createGroupModal');
    if (modal) {
      modal.style.display = 'block';
      if (typeof loadGroupMembersList === 'function') loadGroupMembersList();
    }
  });

  // Create Group Form
  const createGroupForm = document.getElementById('createGroupForm');
  if (createGroupForm) {
    createGroupForm.addEventListener('submit', createGroup);
  }

  // Status Upload
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

  // Chat Options Menu
  document.getElementById('menuBtn')?.addEventListener('click', () => {
    const menu = document.getElementById('chatOptionsMenu');
    if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });

  // File Attachment
  document.getElementById('attach-btn')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  // Settings Modal Close
  document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
  });

  // Logout from Settings
  document.getElementById('logoutSettingsBtn')?.addEventListener('click', () => {
    signOut(auth).then(() => {
      window.location.href = 'index.html';
    });
  });

  // Logout from Main Nav
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      signOut(auth).then(() => {
        window.location.href = 'index.html';
      });
    }
  });

  console.log("✅ All header button listeners attached");

  const sendBtn = document.querySelector(".send-btn");
  const audioSendBtn = document.getElementById('audio-send-btn');
  if (sendBtn) {
    sendBtn.addEventListener("click", (e) => {
      console.log("📤 Send button clicked");
      e.preventDefault();
      sendMessage(e);
    });
  }

  if (audioSendBtn) {
    audioSendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // audio-send should trigger same send flow; sendMessage will pick up selectedFile
      sendMessage(e);
    });
  }

  // Toggle between text-send (large) and audio-send based on attachment state
  function updateSendButtons() {
    const input = document.getElementById('message-input');
    const hasText = input && input.value.trim().length > 0;
    if (typeof selectedFile !== 'undefined' && selectedFile) {
      if (sendBtn) sendBtn.style.display = 'none';
      if (audioSendBtn) audioSendBtn.style.display = 'flex';
    } else {
      if (audioSendBtn) audioSendBtn.style.display = 'none';
      if (sendBtn) {
        sendBtn.style.display = 'flex';
        if (hasText) sendBtn.classList.add('large'); else sendBtn.classList.remove('large');
      }
    }
  }

  // Listen for attachment changes
  document.addEventListener('selectedFileChanged', () => updateSendButtons());
  // Update when user types
  const messageInput = document.getElementById('message-input');
  if (messageInput) messageInput.addEventListener('input', () => updateSendButtons());
  // Run once at startup
  setTimeout(() => updateSendButtons(), 200);

  // Attach event listeners for back button
  document.getElementById("backBtn")?.addEventListener("click", () => {
    goBackToDashboard();
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
      switchDarkMode();
    }
    currentX = 0;
  });

  document.addEventListener("touchend", () => {
    if (!isSliding || !darkModeToggle) return;
    isSliding = false;

    // If dragged more than 15px, toggle
    if (Math.abs(currentX) > 15) {
      switchDarkMode();
    }
    currentX = 0;
  });

  // Click handler for direct toggle
  darkModeToggle?.addEventListener("click", () => {
    if (!isSliding) {
      switchDarkMode();
    }
  });
}

// Function to go back to dashboard
function goBackToDashboard() {
  currentChatUser = null;
  showChatListView();
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


// ============ GLOBAL UTILITY FUNCTIONS ============

function filterChats(query) {
  const chatItems = document.querySelectorAll("#contactList .chat-list-item");
  query = query.toLowerCase();

  chatItems.forEach(item => {
    // Skip chronex or empty state if needed, or filter them too
    const nameEl = item.querySelector(".chat-name");
    const name = nameEl ? nameEl.textContent.toLowerCase() : "";

    // Also search in preview
    const previewEl = item.querySelector(".chat-preview");
    const preview = previewEl ? previewEl.textContent.toLowerCase() : "";

    if (name.includes(query) || preview.includes(query)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
}

function applyFilter(filterType) {
  const chatItems = document.querySelectorAll("#contactList .chat-list-item");
  // Reset all first
  if (filterType === 'all') {
    chatItems.forEach(item => {
      item.style.display = "flex";
    });
    return;
  }

  chatItems.forEach(item => {
    let shouldShow = false;

    if (filterType === 'unread') {
      // Check for unread badge or class
      const unreadBadge = item.querySelector(".unread-badge");
      const isUnread = item.classList.contains("unread") || (unreadBadge && unreadBadge.textContent.trim() !== "");
      if (isUnread) shouldShow = true;
    } else if (filterType === 'favorites') {
      // Not implemented, show all or none? Show none for now as no favorites logic exists
      shouldShow = false;
    } else if (filterType === 'groups') {
      const isGroup = item.querySelector(".group-avatar") || item.getAttribute('data-chat-id')?.length > 20; // heuristic
      if (isGroup) shouldShow = true;
    }

    item.style.display = shouldShow ? "flex" : "none";
  });
}

function switchDarkMode() {
  const body = document.body;
  const toggle = document.getElementById("darkModeToggle");
  const isDark = body.classList.contains("dark-mode");

  if (isDark) {
    body.classList.remove("dark-mode");
    body.classList.add("light-mode");
    toggle?.classList.remove("active");
    localStorage.setItem("darkMode", "false");
    // Also update settings preference if possible
    saveSettingsPreferences();
    showNotif("☀️ Light Mode Enabled", "success");
  } else {
    body.classList.remove("light-mode");
    body.classList.add("dark-mode");
    toggle?.classList.add("active");
    localStorage.setItem("darkMode", "true");
    saveSettingsPreferences();
    showNotif("🌙 Dark Mode Enabled", "success");
  }
}

// ============================================================
// EXPOSE FUNCTIONS GLOBALLY FOR ONCLICK HANDLERS
// ============================================================
// Make sure these functions are available in global scope
window.toggleFullscreen = toggleFullscreen;
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.openSettingsModal = openSettingsModal;
window.goBackToDashboard = goBackToDashboard;
window.showNotif = showNotif;
window.openChat = openChat;
window.sendMessage = sendMessage;
window.loadContacts = loadContacts;
window.switchDarkMode = switchDarkMode;
window.applyFilter = applyFilter;
window.muteChat = muteChat;
window.unmuteChat = unmuteChat;
window.archiveChat = archiveChat;
window.unarchiveChat = unarchiveChat;
window.deleteChat = deleteChat;
window.showChatContextMenu = showChatContextMenu;

console.log("✅ Functions exposed to global window");

// ===================================
// DYNAMICALLY ADDED FUNCTIONS
// ===================================


async function loadGroups() {
  const groupsList = document.getElementById("groupsList");
  if (!groupsList || !myUID) return;

  try {
    const q = query(
      collection(db, "groups"),
      where("members", "array-contains", myUID),
      orderBy("lastMessageTime", "desc"),
      limit(10)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      groupsList.innerHTML = `<li class="empty-state"><p>No groups yet</p></li>`;
      return;
    }

    groupsList.innerHTML = "";
    snapshot.forEach(async docSnap => {
      const group = docSnap.data();
      const groupId = docSnap.id;
      const li = document.createElement("li");
      li.className = "chat-list-item";
      li.setAttribute('data-chat-id', groupId);

      // Get last message and unread count
      let lastMessage = group.lastMessage || "No messages yet";
      let lastMessageTime = "";
      let unreadCount = 0;

      try {
        if (group.lastMessageTime) {
          const date = group.lastMessageTime.toDate ? group.lastMessageTime.toDate() : new Date(group.lastMessageTime);
          const now = new Date();
          const diffMs = now - date;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);

          if (diffMins < 1) {
            lastMessageTime = "Now";
          } else if (diffMins < 60) {
            lastMessageTime = `${diffMins}m`;
          } else if (diffHours < 24) {
            lastMessageTime = `${diffHours}h`;
          } else if (diffDays < 7) {
            lastMessageTime = `${diffDays}d`;
          } else {
            lastMessageTime = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        }

        // Shorten last message preview
        if (lastMessage && lastMessage.length > 40) {
          lastMessage = lastMessage.substring(0, 40) + "...";
        }

        // Count unread group messages
        const messagesRef = collection(db, "groupMessages");
        const unreadQuery = query(
          messagesRef,
          where("groupId", "==", groupId),
          where("readBy", "array-contains-any", [myUID]) // Not read by this user
        );
        // Note: This is a simplified version - a better approach would be to track unread per user
      } catch (e) {
        console.log("Error loading group message preview:", e);
      }

      const unreadBadgeHTML = unreadCount > 0 ? `<span class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : '';

      // Use group profile pic if available
      let avatarHtml;
      if (group.profilePic) {
        avatarHtml = `<img src="${group.profilePic}" class="chat-avatar group-avatar" style="object-fit:cover;" onerror="this.style.display='none';this.parentElement.innerHTML='👥';">`;
      } else {
        avatarHtml = `<div class="chat-avatar group-avatar">👥</div>`;
      }

      li.innerHTML = `
        <div class="chat-avatar-container">${avatarHtml}</div>
        <div class="chat-item-content ${unreadCount > 0 ? 'unread' : ''}">
          <div class="chat-item-header">
            <span class="chat-name">${escape(group.name)}</span>
          </div>
          <p class="chat-preview">${escape(lastMessage)}</p>
        </div>
        <div class="chat-time-container">
          <span class="chat-item-time">${lastMessageTime}</span>
          ${unreadBadgeHTML}
        </div>
        <button class="chat-menu-btn" title="Options">⋮</button>
      `;

      li.addEventListener("click", async () => {
        await openChat(groupId, group.name, group.profilePic || "👥", "group");
        if (typeof showChatDetailView === 'function') showChatDetailView();
      });
      // Right-click context menu
      li.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (typeof showChatContextMenu === 'function') showChatContextMenu(e, groupId);
      });
      // Long-press handler (250ms hold)
      let longPressTimer;
      li.addEventListener("touchstart", () => {
        longPressTimer = setTimeout(() => {
          const touchEvent = new MouseEvent('contextmenu', {
            clientX: event.touches[0].clientX,
            clientY: event.touches[0].clientY
          });
          if (typeof showChatContextMenu === 'function') showChatContextMenu(touchEvent, groupId);
        }, 250);
      });
      li.addEventListener("touchend", () => clearTimeout(longPressTimer));

      // Three-dot menu button click handler
      const menuBtn = li.querySelector(".chat-menu-btn");
      if (menuBtn) {
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (typeof showChatContextMenu === 'function') showChatContextMenu(e, groupId);
        });
      }

      groupsList.appendChild(li);
    });
  } catch (err) {
    console.error("Groups error", err);
    if (err.message.includes("index")) console.warn("Index missing for groups query");
  }
}

async function loadContacts() {
  const contactList = document.getElementById("contactList");
  if (!contactList || !myUID) return;

  contactList.innerHTML = '<li style="text-align:center; padding:10px;">Loading chats...</li>';
  try {
    // Unsubscribe previous listener if exists
    if (typeof contactsListener === 'function') {
      try { contactsListener(); } catch (e) { /* ignore */ }
    }

    // Prepare list
    const tempContainer = document.createElement("div");

    // Add Chronex AI at the top
    const chronexLi = document.createElement("li");
    chronexLi.className = "chat-list-item chronex-ai-item";
    chronexLi.setAttribute('data-chat-id', 'chronex-ai');
    chronexLi.innerHTML = `
      <div class="chat-avatar-container">
        <img src="chronex-ai.jpg" class="chat-avatar" onerror="this.src='logo.jpg';this.parentElement.innerHTML='🤖';" style="width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #00ff66;">
      </div>
      <div class="chat-item-content">
        <div class="chat-item-header">
          <span class="chat-name">Chronex AI</span>
        </div>
        <p class="chat-preview">AI Assistant</p>
      </div>
      <div class="chat-time-container">
        <span class="chat-item-time">Now</span>
      </div>
      <button class="chat-menu-btn" title="Options">⋮</button>
    `;

    chronexLi.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (myUID) chronexAI.setUserId(myUID);
      await openChat("chronex-ai", "Chronex AI", "chronex-ai.jpg", "ai");
      if (typeof showChatDetailView === 'function') showChatDetailView();

      // Trigger Profile Modal for Chronex AI immediately
      const modal = document.getElementById('profilePicModal');
      const modalImg = document.getElementById('profileModalImg');
      const modalName = document.getElementById('profileModalName');
      const modalDesc = document.getElementById('profileModalDesc');
      const modalWordmark = document.getElementById('profileModalBrandWordmark');

      if (modal && modalImg && modalName) {
        modalImg.src = "chronex-ai.jpg";
        modalName.textContent = "Chronex AI";
        if (modalWordmark) modalWordmark.style.display = 'block';
        if (modalDesc) modalDesc.textContent = "Official NEX_DEV Neural Assistant. Primary interface for the NEXCHAT ecosystem. Advanced robotic intelligence designed for cross-sector synchronization.";
        modal.style.display = 'flex';
        const editBtn = document.getElementById('editProfileBtnModal');
        if (editBtn) editBtn.style.display = 'none';
      }
    });

    // Get user's contact list
    const myUserDoc = await getDoc(doc(db, "users", myUID));
    let rawContacts = myUserDoc.data()?.contacts || [];

    // --- RECENT CONVERSATIONS OPTIMIZATION ---
    // Instead of loading all contacts (which takes forever), we find the 10 most recent partners
    let top10Contacts = [];
    try {
      const messagesRef = collection(db, "messages");
      // Query recent incoming and outgoing messages
      const qIn = query(messagesRef, where("to", "==", myUID), orderBy("timestamp", "desc"), limit(25));
      const qOut = query(messagesRef, where("from", "==", myUID), orderBy("timestamp", "desc"), limit(25));

      const [snapIn, snapOut] = await Promise.all([getDocs(qIn), getDocs(qOut)]);

      const partnerMap = new Map();
      snapIn.forEach(docSnap => {
        const d = docSnap.data();
        if (d.from && d.from !== myUID) {
          const ts = d.timestamp?.toMillis ? d.timestamp.toMillis() : (d.timestamp instanceof Date ? d.timestamp.getTime() : 0);
          if (!partnerMap.has(d.from) || ts > partnerMap.get(d.from)) partnerMap.set(d.from, ts);
        }
      });
      snapOut.forEach(docSnap => {
        const d = docSnap.data();
        if (d.to && d.to !== myUID) {
          const ts = d.timestamp?.toMillis ? d.timestamp.toMillis() : (d.timestamp instanceof Date ? d.timestamp.getTime() : 0);
          if (!partnerMap.has(d.to) || ts > partnerMap.get(d.to)) partnerMap.set(d.to, ts);
        }
      });

      // Sort partners by timestamp descending and filter out special IDs like chronex-ai
      top10Contacts = Array.from(partnerMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(e => e[0])
        .filter(uid => uid !== 'chronex-ai')
        .slice(0, 10);

      // If we still have room, add from rawContacts (most recently added first)
      if (top10Contacts.length < 10) {
        const otherContacts = [...rawContacts].reverse().filter(uid => !top10Contacts.includes(uid) && uid !== 'chronex-ai');
        top10Contacts.push(...otherContacts.slice(0, 10 - top10Contacts.length));
      }
    } catch (err) {
      console.warn("Recent conversations optimization failed, falling back to simplified list:", err);
      top10Contacts = [...rawContacts].reverse().slice(0, 10);
    }

    const myContacts = top10Contacts;

    if (myContacts.length === 0) {
      contactList.innerHTML = "";
      contactList.appendChild(chronexLi);
      contactList.innerHTML += `<li class="empty-state"><p>No chats yet. Start a conversation!</p></li>`;
      return;
    }

    // --- OPTIMIZED PARALLEL LOADING (Max 10) ---
    // Fetch only the top 10 contacts data in parallel
    const batchSize = 10;
    let contactDataList = [];

    for (let i = 0; i < myContacts.length && i < 10; i += batchSize) {
      const batch = myContacts.slice(i, i + batchSize);
      const batchPromises = batch.map(async (uid) => {
        if (uid === myUID) return null;

        try {
          // 1. Fetch User Profile
          const userDoc = await getDoc(doc(db, "users", uid));
          if (!userDoc.exists()) return null;

          const user = userDoc.data();
          const name = user.username || user.name || "User";
          const pic = user.profilePic || null;

          // 2. Fetch Messages & Unread Count in Parallel
          const messagesRef = collection(db, "messages");

          const lastMsgPromise = (async () => {
            const q1 = query(messagesRef, where("to", "==", uid), where("from", "==", myUID), orderBy("timestamp", "desc"), limit(1));
            const q2 = query(messagesRef, where("from", "==", uid), where("to", "==", myUID), orderBy("timestamp", "desc"), limit(1));
            const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

            let latestMsg = null;
            let latestTime = null;

            if (!snap1.empty) {
              latestMsg = snap1.docs[0].data();
              latestTime = latestMsg.timestamp;
            }
            if (!snap2.empty) {
              const msg2 = snap2.docs[0].data();
              const time2 = msg2.timestamp;
              if (!latestTime || (time2 && time2 > latestTime)) { // Use time2 directly if latestTime is null
                latestMsg = msg2;
                latestTime = time2;
              }
            }
            return { latestMsg, latestTime };
          })();

          const unreadPromise = getDocs(query(messagesRef, where("from", "==", uid), where("to", "==", myUID), where("read", "==", false)));

          const [msgData, unreadSnap] = await Promise.all([lastMsgPromise, unreadPromise]);
          const { latestMsg, latestTime } = msgData;
          const unreadCount = unreadSnap.size;

          return {
            uid,
            name,
            pic,
            latestMsg,
            latestTime,
            unreadCount
          };
        } catch (e) {
          console.error("Error loading contact", uid, e);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      contactDataList.push(...batchResults.filter(r => r !== null));
    }

    // Sort by timestamp (newest first)
    contactDataList.sort((a, b) => {
      const timeA = a.latestTime?.toDate ? a.latestTime.toDate() : (a.latestTime ? new Date(a.latestTime) : new Date(0));
      const timeB = b.latestTime?.toDate ? b.latestTime.toDate() : (b.latestTime ? new Date(b.latestTime) : new Date(0));
      return timeB - timeA;
    });

    // Render sorted list
    contactList.innerHTML = "";
    contactList.appendChild(chronexLi);

    contactDataList.forEach(data => {
      const { uid, name, pic, latestMsg, latestTime, unreadCount } = data;

      const li = document.createElement("li");
      li.className = "chat-list-item";
      li.setAttribute('data-chat-id', uid);

      let avatar = (pic && (pic.startsWith('http') || pic.startsWith('data:') || pic.includes('.')))
        ? `<img src="${pic}" class="chat-avatar" onerror="this.style.display='none';this.parentElement.querySelector('.avatar-placeholder').style.display='flex';">` + `<div class="chat-avatar avatar-placeholder" style="display:none; background:#333; color:#fff; align-items:center; justify-content:center; font-weight:bold;">${name.charAt(0).toUpperCase()}</div>`
        : `<div class="chat-avatar" style="background:#333; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold;">${name.charAt(0).toUpperCase()}</div>`;

      // Format preview
      let lastMessage = "No messages yet";
      let lastMessageTime = "";

      if (latestMsg) {
        if (latestMsg.text) {
          lastMessage = (latestMsg.from === myUID ? "You: " : "") + latestMsg.text.substring(0, 40);
          if (latestMsg.text.length > 40) lastMessage += "...";
        } else if (latestMsg.attachment) {
          lastMessage = (latestMsg.from === myUID ? "You: " : "") + "📎 Attachment";
        }

        if (latestTime) {
          const date = latestTime.toDate ? latestTime.toDate() : new Date(latestTime);
          const now = new Date();
          const diffMs = now - date;
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);

          if (date && !isNaN(date.getTime())) {
            if (diffMins < 1) lastMessageTime = "Now";
            else if (diffMins < 60) lastMessageTime = `${diffMins}m`;
            else if (diffHours < 24) lastMessageTime = `${diffHours}h`;
            else if (diffDays < 7) lastMessageTime = `${diffDays}d`;
            else lastMessageTime = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          } else {
            lastMessageTime = "";
          }
        }
      }

      const unreadBadgeHTML = unreadCount > 0 ? `<div class="unread-badge" title="${unreadCount} unread">${unreadCount > 99 ? '99+' : unreadCount}</div>` : '';

      li.innerHTML = `
        <div class="chat-avatar-container">${avatar}</div>
        <div class="chat-item-content ${unreadCount > 0 ? 'unread' : ''}">
          <div class="chat-item-header">
            <span class="chat-name">${escape(name)}</span>
          </div>
          <p class="chat-preview">${escape(lastMessage)}</p>
        </div>
        <div class="chat-time-container">
          <span class="chat-item-time">${lastMessageTime}</span>
          ${unreadBadgeHTML}
        </div>
        <button class="chat-menu-btn" title="Options">⋮</button>
      `;

      li.addEventListener("click", async () => {
        await openChat(uid, name, pic, "direct");
        if (typeof showChatDetailView === 'function') showChatDetailView();
      });

      li.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (typeof showChatContextMenu === 'function') showChatContextMenu(e, uid);
      });

      // Long-press
      let longPressTimer;
      li.addEventListener("touchstart", (event) => {
        longPressTimer = setTimeout(() => {
          const touchEvent = new MouseEvent('contextmenu', {
            clientX: event.touches?.[0]?.clientX || 0,
            clientY: event.touches?.[0]?.clientY || 0
          });
          if (typeof showChatContextMenu === 'function') showChatContextMenu(touchEvent, uid);
        }, 250);
      });
      li.addEventListener("touchend", () => clearTimeout(longPressTimer));

      const menuBtn = li.querySelector(".chat-menu-btn");
      if (menuBtn) {
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (typeof showChatContextMenu === 'function') showChatContextMenu(e, uid);
        });
      }

      contactList.appendChild(li);
    });

  } catch (err) {
    console.error("Contacts error", err);
    contactList.innerHTML = `<li style="text-align:center; padding:10px; color: #ff6b6b;">Error loading contacts</li>`;
  }
}

async function deleteChat(chatId, type) {
  if (!confirm("Are you sure you want to delete this chat? This will remove it from your list.")) return;

  try {
    const userRef = doc(db, "users", myUID);
    // Add the chat ID to a "deletedChats" array in the user document
    // We need arrayUnion which we imported earlier
    await updateDoc(userRef, {
      deletedChats: arrayUnion(chatId)
    });

    showNotif("🗑️ Chat deleted", "success");
    // Refresh list
    if (typeof loadContacts === 'function') loadContacts();

    // If currently open, close it
    if (currentChatUser === chatId) {
      if (typeof goBackToDashboard === 'function') goBackToDashboard();
    }
  } catch (e) {
    console.error("Error deleting chat:", e);
    showNotif("Could not delete chat", "error");
  }
}

// Expose deleteChat to global scope (unarchiveChat already defined earlier)
window.deleteChat = deleteChat;

// ============================================================
// INFO SIDEBAR ACTIONS (Added by Antigravity)
// ============================================================

document.getElementById('infoBlockBtn')?.addEventListener('click', async () => {
  if (!currentChatUser) return;
  if (!confirm('Are you sure you want to block this user?')) return;

  try {
    const userRef = doc(db, 'users', myUID);
    await updateDoc(userRef, {
      blockedUsers: arrayUnion(currentChatUser)
    });

    showNotif('🚫 User blocked', 'success');
    document.getElementById('infoBlockBtn').style.display = 'none';
    document.getElementById('infoUnblockBtn').style.display = 'flex';
  } catch (err) {
    console.error('Error blocking user:', err);
    showNotif('Failed to block user', 'error');
  }
});

document.getElementById('infoUnblockBtn')?.addEventListener('click', async () => {
  if (!currentChatUser) return;

  try {
    const userRef = doc(db, 'users', myUID);
    await updateDoc(userRef, {
      blockedUsers: arrayRemove(currentChatUser)
    });

    showNotif('✅ User unblocked', 'success');
    document.getElementById('infoBlockBtn').style.display = 'flex';
    document.getElementById('infoUnblockBtn').style.display = 'none';
  } catch (err) {
    console.error('Error unblocking user:', err);
    showNotif('Failed to unblock user', 'error');
  }
});

document.getElementById('infoDeleteBtn')?.addEventListener('click', () => {
  if (!currentChatUser) return;
  deleteChat(currentChatUser);
});

document.getElementById('muteUserToggle')?.addEventListener('change', async (e) => {
  if (!currentChatUser) return;
  const isMuted = e.target.checked;

  try {
    const userRef = doc(db, 'users', myUID);
    if (isMuted) {
      await updateDoc(userRef, {
        mutedUsers: arrayUnion(currentChatUser)
      });
      showNotif('🔕 User muted', 'success');
    } else {
      await updateDoc(userRef, {
        mutedUsers: arrayRemove(currentChatUser)
      });
      showNotif('🔔 User unmuted', 'success');
    }
  } catch (err) {
    console.error("Error toggling mute:", err);
    e.target.checked = !isMuted;
    showNotif("Failed to update mute status", "error");
  }
});
// ============ CALL HISTORY SYSTEM ============

/**
 * Save a call record to Firebase
 */
async function saveCallToHistory(contactId, callType, duration) {
  if (!myUID) {
    console.warn('Cannot save call history: User not authenticated');
    return;
  }

  try {
    const callRecord = {
      from: myUID,
      to: contactId,
      type: callType, // 'video' or 'voice'
      duration: duration, // in seconds
      timestamp: serverTimestamp(),
      status: 'completed'
    };

    await addDoc(collection(db, 'callHistory'), callRecord);
    console.log('�S&  Call saved to history:', callRecord);
  } catch (error) {
    console.error('��R Error saving call to history:', error);
    throw error;
  }
}

/**
 * Load and display call history
 */
async function loadCallHistory() {
  if (!myUID) {
    showNotif('Please log in to view call history', 'error');
    return;
  }

  const callHistoryFeed = document.getElementById('callHistoryFeed');
  if (!callHistoryFeed) return;

  // Show loading state
  callHistoryFeed.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #00ff66;">
      <div style="font-size: 48px; margin-bottom: 15px;">�x ~</div>
      <p>Loading call history...</p>
    </div>
  `;

  try {
    // Query calls where user is either caller or receiver
    const callsQuery1 = query(
      collection(db, 'callHistory'),
      where('from', '==', myUID)
    );

    const callsQuery2 = query(
      collection(db, 'callHistory'),
      where('to', '==', myUID)
    );

    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(callsQuery1),
      getDocs(callsQuery2)
    ]);

    // Combine and process all calls
    const allCalls = [];

    snapshot1.forEach(doc => {
      const data = doc.data();
      allCalls.push({
        id: doc.id,
        ...data,
        isOutgoing: true
      });
    });

    snapshot2.forEach(doc => {
      const data = doc.data();
      allCalls.push({
        id: doc.id,
        ...data,
        isOutgoing: false
      });
    });

    // Sort by timestamp (most recent first)
    allCalls.sort((a, b) => {
      const timeA = a.timestamp?.toMillis() || 0;
      const timeB = b.timestamp?.toMillis() || 0;
      return timeB - timeA;
    });

    // Display calls or show empty state
    if (allCalls.length === 0) {
      callHistoryFeed.innerHTML = `
        <div class="call-history-empty-state" style="
          text-align: center;
          padding: 60px 20px;
          color: #888;
        ">
          <div style="font-size: 64px; margin-bottom: 20px;">�x ~</div>
          <p style="font-size: 18px; color: #aaa; margin-bottom: 10px;">No Calls Yet</p>
          <p style="font-size: 14px; color: #666;">Your call history will appear here</p>
        </div>
      `;
      return;
    }

    // Render call history items
    let historyHTML = '';

    for (const call of allCalls) {
      const contactId = call.isOutgoing ? call.to : call.from;
      const contactInfo = await getContactInfo(contactId);

      const callIcon = call.type === 'video' ? '�x �' : '�x ~';
      const directionIcon = call.isOutgoing ? '�x �' : '�x �';
      const directionText = call.isOutgoing ? 'Outgoing' : 'Incoming';
      const directionColor = call.isOutgoing ? '#00ff66' : '#00aaff';

      const duration = formatCallDuration(call.duration);
      const timeAgo = call.timestamp ? formatTimeAgo(call.timestamp.toDate()) : 'Recently';

      historyHTML += `
        <div class="call-history-item" style="
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(0,255,102,0.2);
          border-radius: 10px;
          padding: 15px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 15px;
          transition: all 0.2s;
          cursor: pointer;
        " onmouseover="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='rgba(0,255,102,0.4)'" 
           onmouseout="this.style.background='rgba(255,255,255,0.02)'; this.style.borderColor='rgba(0,255,102,0.2)'"
           onclick="openChat('${contactId}', '${contactInfo.name}', '${contactInfo.profilePic}', 'direct'); showChatDetailView();">
          
          <!-- Contact Avatar -->
          <img src="${contactInfo.profilePic || 'logo.jpg'}" style="
            width: 50px;
            height: 50px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid ${directionColor};
          ">
          
          <!-- Call Details -->
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
              <span style="color: #fff; font-size: 16px; font-weight: 600;">${contactInfo.name}</span>
              <span style="font-size: 14px;">${directionIcon}</span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #888;">
              <span style="color: ${directionColor};">${callIcon} ${directionText} ${call.type}</span>
              <span>�� �</span>
              <span>${duration}</span>
            </div>
          </div>
          
          <!-- Time -->
          <div style="text-align: right; color: #666; font-size: 12px;">
            ${timeAgo}
          </div>
        </div>
      `;
    }

    callHistoryFeed.innerHTML = historyHTML;
    console.log(`�x ~ Loaded ${allCalls.length} call(s) from history`);

  } catch (error) {
    console.error('Error loading call history:', error);
    callHistoryFeed.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #ff4444;">
        <div style="font-size: 48px; margin-bottom: 15px;">��R</div>
        <p>Error loading call history</p>
        <p style="font-size: 12px; color: #888; margin-top: 10px;">${error.message}</p>
      </div>
    `;
  }
}

/**
 * Get contact information (name and profile pic)
 */
async function getContactInfo(contactId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', contactId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        name: userData.username || userData.email || 'Unknown User',
        profilePic: userData.profilePic || 'logo.jpg'
      };
    }
  } catch (error) {
    console.warn('Could not fetch contact info:', error);
  }

  return {
    name: contactId.substring(0, 12) + '...',
    profilePic: 'logo.jpg'
  };
}

/**
 * Format call duration (seconds to mm:ss format)
 */
function formatCallDuration(seconds) {
  if (!seconds || seconds < 1) return '0:00';

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago")
 */
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // For older dates, show actual date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Clear all call history
 */
async function clearCallHistory() {
  if (!myUID) return;

  const confirmed = confirm('Are you sure you want to clear all call history? This action cannot be undone.');
  if (!confirmed) return;

  try {
    showNotif('�x  ��� Clearing call history...', 'info');

    // Query all calls involving this user
    const callsQuery1 = query(collection(db, 'callHistory'), where('from', '==', myUID));
    const callsQuery2 = query(collection(db, 'callHistory'), where('to', '==', myUID));

    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(callsQuery1),
      getDocs(callsQuery2)
    ]);

    // Delete all call records
    const deletePromises = [];
    snapshot1.forEach(docSnap => {
      deletePromises.push(deleteDoc(doc(db, 'callHistory', docSnap.id)));
    });
    snapshot2.forEach(docSnap => {
      deletePromises.push(deleteDoc(doc(db, 'callHistory', docSnap.id)));
    });

    await Promise.all(deletePromises);

    showNotif('�S&  Call history cleared', 'success');
    loadCallHistory(); // Reload to show empty state

  } catch (error) {
    console.error('Error clearing call history:', error);
    showNotif('��R Failed to clear call history', 'error');
  }
}

// Clear call history button listener
document.getElementById('clearCallHistoryBtn')?.addEventListener('click', clearCallHistory);

