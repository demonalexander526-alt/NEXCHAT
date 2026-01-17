import { auth, db, rtdb } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, onSnapshot, serverTimestamp, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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
let myUID = null;
let myUsername = null;
let myProfilePic = null;
let messageListener = null;
let contactsListener = null;
let callActive = false;
let callStartTime = null;
let callTimer = null;

const emojis = [
  '😊', '😂', '😍', '🤔', '😎', '😢', '❤️', '👍', '🔥', '✨',
  '🎉', '🎊', '😴', '😤', '😡', '😳', '😌', '🤐', '😷', '🤒',
  '🤕', '😪', '😵', '🤤', '😲', '😨', '😰', '😥', '😢', '😭',
  '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
  '👋', '👏', '🙌', '👐', '🤝', '🤲', '🤞', '🖖', '🤘', '🤟'
];

function showNotif(msg, type = "info", duration = 3000) {
  const container = document.getElementById("notificationContainer");
  if (!container) return;
  
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
  `;
  notif.textContent = msg;
  container.appendChild(notif);
  
  setTimeout(() => {
    notif.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

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
  return function(...args) {
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

document.getElementById("backBtn")?.addEventListener("click", () => {
  showChatListView();
  goBack();
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
  console.log("📱 Loading all users...");
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
      
      console.log(`👤 Processing user from Firestore - ID: ${uid}, Username: ${user.username}`);
      
      // Skip current user
      if (uid !== myUID) {
        allUsers.push(user);
      }
    });
    
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
            allUsers.push(userData);
          }
        });
      }
    } catch (rtdbErr) {
      console.warn("⚠️ Could not fetch from Realtime Database:", rtdbErr);
    }
    
    console.log("🎯 Total unique users found:", allUsers.length);
    
    if (allUsers.length === 0) {
      console.warn("⚠️ No users found in either database");
      resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #999; font-size: 14px;'>👥 No users found yet. Be the first!</div>";
      return;
    }
    
    resultsDiv.innerHTML = ""; // Clear previous results
    
    // Display all users
    allUsers.forEach(user => {
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
      const displayName = user.username || user.name || user.email || "Unknown User";
      const profilePic = user.profilePic || user.profilePicUrl || null;
      
      console.log(`🎨 Creating UI for: ${displayName}, has profilePic: ${!!profilePic}`);
      
      // Create profile image or fallback
      let profileHTML = '';
      if (profilePic && typeof profilePic === 'string' && (profilePic.startsWith('data:') || profilePic.startsWith('http'))) {
        profileHTML = `<img src="${escape(profilePic)}" alt="${escape(displayName)}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #00ff66; flex-shrink: 0;">`;
      } else {
        const initials = displayName.charAt(0).toUpperCase();
        profileHTML = `<div style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #00ff66, #00d4ff); color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; flex-shrink: 0;">${initials}</div>`;
      }
      
      resultItem.innerHTML = `
        ${profileHTML}
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <h4 style="margin: 0; color: #00ff66; font-weight: 600; word-break: break-word; flex: 1;">@${escape(displayName)}</h4>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; white-space: nowrap; font-weight: 600; background: ${user.online === true ? 'rgba(76, 175, 80, 0.3)' : user.online === false ? 'rgba(153, 153, 153, 0.3)' : 'rgba(255, 165, 0, 0.3)'}; color: ${user.online === true ? '#4CAF50' : user.online === false ? '#999' : '#ffa500'};">${user.online === true ? '🟢 Online' : user.online === false ? '⚫ Offline' : '❓ Unknown'}</span>
          </div>
          <p style="margin: 4px 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>📧 Email:</strong> ${escape(user.email || 'N/A')}</p>
          <p style="margin: 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>🆔 UID:</strong> ${escape(user.uid)}</p>
        </div>
      `;
      
      resultItem.addEventListener("click", async () => {
        try {
          console.log(`📞 Opening chat with ${displayName} (${user.uid})`);
          await openChat(user.uid, displayName, profilePic);
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
    
    showNotif(`✅ Found ${allUsers.length} user${allUsers.length !== 1 ? 's' : ''}`, "success", 2000);
    console.log("✅ Loaded " + allUsers.length + " users");
  } catch (err) {
    console.error("❌ Error loading users:", err);
    const resultsDiv = document.getElementById("search-results");
    if (resultsDiv) {
      resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #ff4d4d;'>❌ Error loading users: " + escape(err.message) + "</div>";
    }
    showNotif("Error loading users: " + err.message, "error");
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
    
    let foundUsers = [];
    snap.forEach(docSnap => {
      const user = docSnap.data();
      user.uid = docSnap.id;
      
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
          foundUsers.push(user);
        }
      }
    });
    
    // Sort by priority (exact matches first)
    foundUsers.sort((a, b) => a.matchPriority - b.matchPriority);
    
    const resultsDiv = document.getElementById("search-results");
    
    if (foundUsers.length === 0) {
      resultsDiv.innerHTML = `
        <div style='padding: 16px; text-align: center; color: #ff6b6b; font-size: 14px;'>
          ❌ User with UID/Email/Username "${escape(searchTerm)}" not found
        </div>
      `;
      return;
    }

    resultsDiv.innerHTML = "";
    
    // Show notification that user was found
    if (foundUsers.length > 0) {
      showNotif(`✅ Found ${foundUsers.length} result(s)!`, "success", 2000);
    }

    foundUsers.forEach(user => {
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
      
      const displayName = user.username || user.name || user.uid;
      const profilePic = user.profilePic || user.profilePicUrl || '👤';
      
      // Create profile image or fallback
      let profileHTML = '';
      if (typeof profilePic === 'string' && (profilePic.startsWith('data:') || profilePic.startsWith('http'))) {
        profileHTML = `<img src="${escape(profilePic)}" alt="" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #00ff66;">`;
      } else {
        profileHTML = `<div style="width: 50px; height: 50px; border-radius: 50%; background: #00ff66; color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">${displayName.charAt(0).toUpperCase()}</div>`;
      }
      
      resultItem.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          ${profileHTML}
          <div style="flex: 1;">
            <h4 style="margin: 0; color: #00ff66; font-weight: 600;">${escape(displayName)}</h4>
            <p style="margin: 4px 0 0 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>📧 Email:</strong> ${escape(user.email || 'N/A')}</p>
            <p style="margin: 4px 0 0 0; color: #00d4ff; font-size: 11px; word-break: break-all;"><strong>🆔 UID:</strong> ${escape(user.uid)}</p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: ${user.online === true ? '#4CAF50' : user.online === false ? '#999' : '#ffa500'};">${user.online === true ? '🟢 Online' : user.online === false ? '⚫ Offline' : '❓ Status Unknown'}</p>
          </div>
        </div>
        <button id="chat-btn-${user.uid}" style="
          width: 100%;
          padding: 10px;
          background: #00ff66;
          color: #000;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        ">💬 Start Chatting</button>
      `;
      
      // Add click handler to the "Start Chatting" button
      const chatBtn = resultItem.querySelector(`#chat-btn-${user.uid}`);
      chatBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          console.log("💬 Starting chat with:", displayName);
          await openChat(user.uid, displayName, profilePic);
          closeSearch();
          showChatDetailView();
          showNotif(`✅ Chat opened with ${displayName}`, "success");
        } catch (chatErr) {
          console.error("Error opening chat:", chatErr);
          showNotif("Error opening chat: " + chatErr.message, "error");
        }
      });
      
      chatBtn.addEventListener("mouseover", () => {
        chatBtn.style.background = "#00dd55";
        chatBtn.style.transform = "scale(1.02)";
      });
      
      chatBtn.addEventListener("mouseout", () => {
        chatBtn.style.background = "#00ff66";
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

document.getElementById("shop-btn-header")?.addEventListener("click", () => {
  window.location.href = "cart.html";
});

document.getElementById("search-btn-header")?.addEventListener("click", openSearch);
document.getElementById("search-btn-header")?.addEventListener("touchstart", (e) => {
  e.preventDefault();
  openSearch();
}, { passive: false });

// New Chat button - opens search
document.getElementById("newChatBtn")?.addEventListener("click", openSearch);
document.getElementById("newChatBtn")?.addEventListener("touchstart", (e) => {
  e.preventDefault();
  openSearch();
}, { passive: false });

document.getElementById("close-search-btn")?.addEventListener("click", closeSearch);
document.getElementById("close-search-btn")?.addEventListener("touchstart", (e) => {
  e.preventDefault();
  closeSearch();
}, { passive: false });

// Browse all users button
document.getElementById("browse-users-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  document.getElementById("search-input").value = "";
  loadAllUsers();
  showNotif("👥 Showing all users", "info", 1500);
});

// Close search when clicking outside (but not on modal content)
document.getElementById("search-overlay")?.addEventListener("click", (e) => {
  if (e.target.id === "search-overlay") {
    closeSearch();
  }
});

document.getElementById("search-submit-btn")?.addEventListener("click", searchUser);

// Real-time search as user types (debounced)
let searchTimeout;
document.getElementById("search-input")?.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  // Debounce search: wait 300ms after user stops typing
  searchTimeout = setTimeout(() => {
    searchUser(e);
  }, 300);
});

// Also search on Enter key
document.getElementById("search-input")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(searchTimeout);
    searchUser(e);
  }
});

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

document.getElementById("backBtn")?.addEventListener("click", goBack);

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
      
      const statusesRef = collection(db, "statuses");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await addDoc(statusesRef, {
        userId: myUID,
        text: text,
        timestamp: serverTimestamp(),
        expiresAt: expiresAt,
        likes: 0,
        comments: [],
        visibleTo: chattedUsers // Only visible to chatted users
      });

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
  
  if (!currentChatUser) {
    showNotif("Select a chat first", "error");
    return;
  }

  const messageText = document.getElementById("message-input");
  const text = messageText?.value.trim();
  
  if (!text) {
    showNotif("Message cannot be empty", "error");
    return;
  }

  // Check if user has tokens
  if (!myUID) {
    showNotif("❌ Please log in first", "error");
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
    
    // Send message
    await addDoc(collection(db, "messages"), {
      from: myUID,
      to: currentChatUser,
      text: text,
      time: serverTimestamp(),
      read: false,
      type: "text",
      edited: false,
      reactions: []
    });

    // Deduct 1 token
    const newTokens = currentTokens - 1;
    await updateDoc(userRef, {
      tokens: newTokens,
      lastMessageSentAt: serverTimestamp()
    });

    // Update token display
    const tokenDisplay = document.getElementById("tokenCount");
    if (tokenDisplay) {
      tokenDisplay.textContent = newTokens;
    }

    messageText.value = "";
    hapticFeedback('success');
    showNotif(`✓ Message sent (-1 token, ${newTokens} remaining)`, "success", 2000);
    document.getElementById("emoji-picker").style.display = "none";
  } catch (err) {
    hapticFeedback('heavy');
    console.error("Error sending message:", err);
    showNotif("Error sending message: " + err.message, "error");
  }
}

function loadMessages() {
  if (!currentChatUser) return;
  
  if (messageListener) messageListener();
  
  const messagesDiv = document.getElementById("messages-area");
  if (!messagesDiv) return;
  
  messagesDiv.innerHTML = "<p style='text-align: center; color: #888; padding: 20px;'>Loading messages...</p>";

  const q = query(
    collection(db, "messages"),
    orderBy("time", "asc"),
    limit(100)
  );
  
  messageListener = onSnapshot(q, (snap) => {
    messagesDiv.innerHTML = "";
    
    const relevantMessages = snap.docs.filter(docSnap => {
      const m = docSnap.data();
      return (
        (m.from === myUID && m.to === currentChatUser) ||
        (m.from === currentChatUser && m.to === myUID)
      );
    });

    if (relevantMessages.length === 0) {
      messagesDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💭</div>
          <p>No messages yet</p>
          <p class="empty-hint">Start the conversation!</p>
        </div>
      `;
      return;
    }

    relevantMessages.forEach(docSnap => {
      const m = docSnap.data();
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
      timeSpan.style.cssText = `font-size: 11px; margin-top: 4px; opacity: 0.7;`;
      timeSpan.textContent = time + (m.edited ? " (edited)" : "");
      
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
      
      // Mark as read
      if (!isOwn && !m.read) {
        updateDoc(docSnap.ref, { read: true }).catch(() => {});
      }
    });
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, (err) => {
    showNotif("Error loading messages: " + err.message, "error");
  });
}

document.getElementById("message-form")?.addEventListener("submit", sendMessage);

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
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);

    let firstContact = null;
    let firstContactId = null;
    let firstContactName = null;
    let firstContactPic = null;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.uid === myUID || userDoc.id === myUID) continue;

      // Check if user has profilePic or profilePicUrl
      const profilePic = userData.profilePic || userData.profilePicUrl;
      const displayName = userData.username || userData.name || userData.email;
      
      // Only show contacts with proper data
      if (!displayName) continue;

      // Store first contact for auto-load
      if (!firstContact) {
        firstContact = userDoc;
        firstContactId = userDoc.id;
        firstContactName = displayName;
        firstContactPic = profilePic;
      }

      // Fetch last message from this user
      const messagesRef = collection(
        db,
        `users/${user.uid}/chats/${userDoc.id}/messages`
      );
      const messagesQuery = query(
        messagesRef,
        orderBy("timestamp", "desc"),
        limit(1)
      );
      
      let lastMessage = "No messages yet";
      try {
        const messagesSnapshot = await getDocs(messagesQuery);
        if (messagesSnapshot.docs.length > 0) {
          const lastMsg = messagesSnapshot.docs[0].data();
          lastMessage =
            lastMsg.message?.substring(0, 40) || "No messages yet";
          if (lastMsg.message && lastMsg.message.length > 40) {
            lastMessage += "...";
          }
        }
      } catch (msgErr) {
        // If messages don't exist, just use default
        lastMessage = "No messages yet";
      }

      const contactItem = document.createElement("div");
      contactItem.className = "chat-list-item";
      
      // Create profile image HTML
      let profileHTML = '';
      if (profilePic && (profilePic.startsWith('data:') || profilePic.startsWith('http'))) {
        profileHTML = `<img class="chat-avatar" src="${escape(profilePic)}" alt="${escape(displayName)}">`;
      } else {
        profileHTML = `<div class="chat-avatar" style="background: #00ff66; color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">${displayName.charAt(0).toUpperCase()}</div>`;
      }
      
      contactItem.innerHTML = `
        ${profileHTML}
        <div class="chat-item-content">
          <div class="chat-item-header">
            <span class="chat-name">${escape(displayName)}</span>
          </div>
          <small class="chat-preview">${escape(lastMessage)}</small>
        </div>
      `;
      contactItem.style.cursor = "pointer";
      contactItem.onclick = () => {
        openChat(userDoc.id, displayName, profilePic || '👤');
        showChatDetailView();
      };
      contactList.appendChild(contactItem);
    }

    // If no contacts found, show empty state
    if (contactList.children.length === 0) {
      const emptyState = document.createElement("li");
      emptyState.className = "empty-state";
      emptyState.innerHTML = `
        <p>No chats yet</p>
        <p class="hint">Search for friends to start chatting</p>
      `;
      contactList.appendChild(emptyState);
    }

    // Auto-load the first contact's chat if available
    if (firstContactId && firstContactName && !currentChatUser) {
      setTimeout(() => {
        openChat(firstContactId, firstContactName, firstContactPic || '👤');
        showChatDetailView();
        console.log("✅ Auto-loaded first chat with:", firstContactName);
      }, 500);
    }
  } catch (err) {
    console.error("Error loading contacts:", err);
    showNotif("Error loading contacts: " + err.message, "error");
  }
}

async function loadStories() {
  const user = auth.currentUser;
  if (!user) return;

  const storiesList = document.getElementById("storiesList");
  if (!storiesList) return;

  storiesList.innerHTML = "";

  try {
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);

    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      if (userData.uid === myUID) return;

      if (userData.name && userData.profilePicUrl) {
        const storyItem = document.createElement("div");
        storyItem.className = "story-item";
        storyItem.innerHTML = `
          <img src="${userData.profilePicUrl}" alt="${userData.name}" class="story-avatar">
          <span class="story-name">${escape(userData.name)}</span>
        `;
        storyItem.style.cursor = "pointer";
        storyItem.onclick = () => {
          openChat(userDoc.id, userData.name, userData.profilePicUrl);
          showChatDetailView();
        };
        storiesList.appendChild(storyItem);
      }
    });
  } catch (err) {
    showNotif("Error loading stories: " + err.message, "error");
  }
}

// ============================================================
// OPEN CHAT & UPDATE UI
// ============================================================

async function openChat(uid, username, profilePic) {
  currentChatUser = uid;
  
  document.getElementById("chatName").textContent = username;
  document.getElementById("chatProfilePic").src = profilePic || "👤";

  // Update info sidebar
  document.getElementById("infoName").textContent = username;
  document.getElementById("infoPic").src = profilePic || "👤";
  
  try {
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
    
    // Show chat view
    showChatDetailView();
    
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
  } catch (err) {
    console.error("Error loading user info:", err);
    showNotif("❌ Error loading user info: " + err.message, "error");
    currentChatUser = null;
    return;
  }

  loadMessages();
}

document.getElementById("menuBtn")?.addEventListener("click", () => {
  const menu = document.getElementById("chatOptionsMenu");
  if (menu) {
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  }
});

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
      showNotif("🚫 User blocked successfully", "success");
      document.getElementById("chatOptionsMenu").style.display = "none";
      setTimeout(() => goBack(), 500);
    } else {
      showNotif("⚠️ User already blocked", "error");
    }
  } catch (err) {
    console.error("Block error:", err);
    showNotif("❌ Error blocking user: " + err.message, "error");
  }
  document.getElementById("chatOptionsMenu").style.display = "none";
});

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
      showNotif(`❌ Error accessing device: ${err.message}`, 'error', 4000);
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
        callDuration.textContent = `${mins}:${secs}`;
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
    <div style="text-align: center; color: #fff;">
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
      ` : ''}
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
    </div>
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
});

document.getElementById("videoCallBtn")?.addEventListener("click", () => {
  startCall(true);
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

window.logoutUser = async function() {
  try {
    if (myUID) {
      await updateDoc(doc(db, "users", myUID), { online: false });
    }
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    showNotif("Logout error: " + err.message, "error");
  }
};

document.getElementById("logout-btn")?.addEventListener("click", logoutUser);

document.getElementById("nav-messages")?.addEventListener("click", () => {
  showChatListView();
  showNotif("Messages", "info", 800);
});

// Profile and Reels buttons are now direct links in HTML

document.getElementById("attach-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  showNotif("📎 File attachment coming soon", "info");
});

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
    
    const senderDoc = await getDoc(senderRef);
    const recipientDoc = await getDoc(recipientRef);
    
    if (!senderDoc.exists()) {
      resultEl.textContent = "❌ Your user data not found";
      resultEl.style.color = "#ff6600";
      return;
    }
    
    if (!recipientDoc.exists()) {
      resultEl.textContent = "❌ Recipient not found";
      resultEl.style.color = "#ff6600";
      return;
    }
    
    // Allow transfer to offline users - no need to check online status
    console.log("✅ Recipient found (online or offline, both allowed)");
    
    // Use nullish coalescing to ensure we don't treat missing field as 0
    const senderTokens = senderDoc.data()?.tokens ?? 0;
    const recipientTokens = recipientDoc.data()?.tokens ?? 0;
    
    // Validate tokens are numbers
    if (typeof senderTokens !== 'number' || typeof recipientTokens !== 'number') {
      resultEl.textContent = "❌ Invalid token data format";
      resultEl.style.color = "#ff6600";
      console.error("Invalid token data:", { senderTokens, recipientTokens });
      return;
    }
    
    if (senderTokens < amount) {
      resultEl.textContent = `❌ Insufficient balance (You have ${senderTokens} tokens)`;
      resultEl.style.color = "#ff6600";
      return;
    }
    
    // Perform update with proper safeguards
    const newSenderTokens = Math.max(0, senderTokens - amount);
    const newRecipientTokens = Math.max(0, recipientTokens + amount);
    
    console.log(`💰 Transferring ${amount} tokens: ${senderTokens} → ${newSenderTokens} (sender), ${recipientTokens} → ${newRecipientTokens} (recipient)`);
    
    await updateDoc(senderRef, {
      tokens: newSenderTokens,
      lastTokenTransfer: serverTimestamp()
    });
    
    await updateDoc(recipientRef, {
      tokens: newRecipientTokens,
      lastTokenReceived: serverTimestamp()
    });
    
    const recipientName = recipientDoc.data()?.username || "user";
    resultEl.textContent = `✅ Sent ${amount} tokens to ${recipientName}`;
    resultEl.style.color = "#00ff66";
    
    console.log(`✅ Transfer complete: ${amount} tokens sent to ${recipientName}`);
    
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
  window.location.href = "admin.html";
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
// DEBUG FUNCTIONS (for troubleshooting)
// ============================================================

/**
 * Test function to debug search issues
 * Usage: Call debugSearchUsers() in browser console
 */
window.debugSearchUsers = async function() {
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
window.debugAuthState = function() {
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
window.debugReloadAndSearch = async function() {
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

function initializeApp() {
  // Initialize emoji picker
  initializeEmojiPicker();
  
  // Auto-populate test users if database is empty
  autoPopulateTestUsers();
  
  // Validate and load saved settings on startup
  try {
    validateSettingsIntegrity();
    const savedSettings = JSON.parse(localStorage.getItem("nexchat_settings")) || {};
    applySettings(savedSettings);
    console.log("⚙️ Settings loaded on startup", savedSettings);
  } catch (err) {
    console.error("Error loading settings on startup:", err);
    // Reset to defaults if corrupted
    localStorage.removeItem("nexchat_settings");
  }
  
  // Load contacts and stories on startup
  try {
    loadContacts();
    loadStories();
    loadStatuses();
  } catch (e) {
    console.warn("Error loading contacts/stories/statuses:", e);
  }
  
  // Listen for auth changes
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
            if (tokenDisplay) tokenDisplay.textContent = "0";
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
      } catch (err) {
        console.error("Error loading user data:", err);
        showNotif("Error loading user data: " + err.message, "error");
      }
    } else {
      window.location.href = "index.html";
    }
  });
  
  // Cleanup on page unload
  window.addEventListener("beforeunload", async () => {
    if (myUID) {
      // Unsubscribe from token snapshot listener
      if (window.tokenSnapshotUnsubscribe) {
        window.tokenSnapshotUnsubscribe();
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
        // Show if: user posted it, or user is in the visibleTo list
        if (status.userId !== myUID && !status.visibleTo?.includes(myUID)) {
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
        
        const statusItem = document.createElement("div");
        statusItem.className = "status-item";
        const deleteBtn = status.userId === myUID ? `<button class="status-delete-btn" data-status-id="${docSnap.id}" title="Delete status">🗑️</button>` : "";
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
        `;
        
        // Add delete functionality
        if (status.userId === myUID) {
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
    });
    
    // Store unsubscribe function for cleanup
    window.statusListener = unsubscribe;
  } catch (err) {
    console.error("Error loading statuses:", err);
    statusFeed.innerHTML = '<div class="status-empty-state"><p>Error loading statuses</p></div>';
  }
}

async function postStatus() {
  const statusInput = document.getElementById("statusInput");
  if (!statusInput || !myUID) return;
  
  const text = statusInput.value.trim();
  
  if (!text) {
    showNotif("Status cannot be empty", "error");
    return;
  }
  
  if (text.length > 150) {
    showNotif("Status is too long (max 150 characters)", "error");
    return;
  }
  
  try {
    // Get list of users this person has chatted with
    const chattedUsers = await getChattedUsers(myUID);
    
    const statusesRef = collection(db, "statuses");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    await addDoc(statusesRef, {
      userId: myUID,
      text: text,
      timestamp: serverTimestamp(),
      expiresAt: expiresAt,
      likes: 0,
      comments: [],
      visibleTo: chattedUsers // Only visible to chatted users
    });
    
    statusInput.value = "";
    showNotif("✅ Status posted! (Visible only to users you've chatted with)", "success", 2000);
    hapticFeedback('success');
  } catch (err) {
    console.error("Error posting status:", err);
    showNotif("Error posting status: " + err.message, "error");
  }
}

document.getElementById("postStatusBtn")?.addEventListener("click", postStatus);
document.getElementById("statusInput")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    postStatus();
  }
});

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

