// Button Event Listeners Setup
// This script runs AFTER chat.js module is fully loaded
// It attaches listeners to ALL interactive buttons in the app

// Import global functions from chat.js if not already available
// Add fallbacks in case chat.js hasn't fully loaded yet
if (typeof goBackToDashboard === 'undefined') {
  window.goBackToDashboard = () => {
    console.warn('goBackToDashboard not yet loaded from chat.js');
  };
}

if (typeof openSearch === 'undefined') {
  window.openSearch = () => {
    console.warn('openSearch not yet loaded from chat.js');
  };
}

if (typeof openSettingsModal === 'undefined') {
  window.openSettingsModal = () => {
    console.warn('openSettingsModal not yet loaded from chat.js');
  };
}

if (typeof toggleFullscreen === 'undefined') {
  window.toggleFullscreen = () => {
    console.warn('toggleFullscreen not yet loaded from chat.js');
  };
}

console.log("🔗 Setting up ALL button event listeners...");

// Wait for the page to be fully loaded AND chat.js module to initialize
setTimeout(() => {
  console.log("✅ Attaching button listeners");

  // ============ HEADER BUTTONS ============
  const backBtn = document.getElementById("dashboardBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (typeof window.goBackToDashboard === 'function') {
        window.goBackToDashboard();
      } else {
        console.warn('goBackToDashboard not yet available');
      }
    });
    console.log("✅ Back button");
  }

  const searchBtn = document.getElementById("search-btn-header");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      if (typeof window.openSearch === 'function') {
        window.openSearch();
      } else {
        console.warn('openSearch not yet available');
      }
    });
    console.log("✅ Search button");
  }

  const settingsBtn = document.getElementById("settings-btn-header");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (typeof window.openSettingsModal === 'function') {
        window.openSettingsModal();
      } else {
        console.warn('openSettingsModal not yet available');
      }
    });
    console.log("✅ Settings button");
  }

  const fullscreenBtn = document.getElementById("fullscreen-btn-header");
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", () => {
      if (typeof window.toggleFullscreen === 'function') {
        window.toggleFullscreen();
      } else {
        console.warn('toggleFullscreen not yet available');
      }
    });
    console.log("✅ Fullscreen button");
  }

  // ============ CHAT LIST BUTTONS ============
  const backBtnChat = document.getElementById("backBtn");
  if (backBtnChat) {
    backBtnChat.addEventListener("click", () => {
      showChatListView();
      goBack();
    });
    console.log("✅ Back to chat list button");
  }

  const createGroupBtn = document.getElementById("createNewGroupBtn");
  if (createGroupBtn) {
    createGroupBtn.addEventListener("click", () => {
      const modal = document.getElementById('createGroupModal');
      if (modal) {
        modal.style.display = 'block';
        if (typeof loadGroupMembersList === 'function') loadGroupMembersList();
      }
    });
    console.log("✅ Create group button");
  }

  // ============ FILTER TABS ============
  const filterTabs = document.querySelectorAll(".filter-tab");
  filterTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      const filter = tab.dataset.filter;
      if (filter) {
        filterTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        if (typeof window.applyFilter === 'function') {
          window.applyFilter(filter);
        } else {
          console.warn('applyFilter not yet available');
        }
      }
    });
  });
  console.log("✅ Filter tabs (" + filterTabs.length + " buttons)");

  // ============ STATUS BUTTONS ============
  const uploadStatusBtn = document.getElementById("uploadStatusImageBtn");
  if (uploadStatusBtn) {
    uploadStatusBtn.addEventListener("click", () => {
      document.getElementById("statusImageInput")?.click();
    });
    console.log("✅ Upload status image button");
  }

  const postStatusBtn = document.getElementById("postStatusBtn");
  if (postStatusBtn) {
    postStatusBtn.addEventListener("click", async () => {
      const textInput = document.getElementById("statusInput");
      const imageInput = document.getElementById("statusImageInput");
      if (textInput) {
        const text = textInput.value;
        const file = imageInput?.files ? imageInput.files[0] : null;
        if (typeof handleStatusPost === 'function') {
          await handleStatusPost(text, file);
        }
      }
    });
    console.log("✅ Post status button");
  }

  // ============ MESSAGE INPUT BUTTONS ============
  const attachBtn = document.getElementById("attach-btn");
  if (attachBtn) {
    attachBtn.addEventListener("click", () => {
      document.getElementById("file-input")?.click();
    });
    console.log("✅ Attach file button");
  }

  const removeAttachmentBtn = document.getElementById("remove-attachment");
  if (removeAttachmentBtn) {
    removeAttachmentBtn.addEventListener("click", () => {
      document.getElementById("file-input").value = "";
      document.getElementById("attachment-preview").style.display = "none";
    });
    console.log("✅ Remove attachment button");
  }

  const emojiBtn = document.getElementById("emoji-btn");
  if (emojiBtn) {
    emojiBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const picker = document.getElementById("emoji-picker");
      if (picker) {
        picker.style.display = picker.style.display === "none" ? "block" : "none";
      }
    });
    console.log("✅ Emoji button");
  }

  const closeEmojiBtn = document.getElementById("close-emoji-btn");
  if (closeEmojiBtn) {
    closeEmojiBtn.addEventListener("click", () => {
      document.getElementById("emoji-picker").style.display = "none";
    });
    console.log("✅ Close emoji button");
  }

  const stickerBtn = document.getElementById("sticker-btn");
  if (stickerBtn) {
    stickerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const modal = document.getElementById("stickerModal");
      if (modal) {
        modal.style.display = "block";
      }
    });
    console.log("✅ Sticker button");
  }

  const pollBtn = document.getElementById("poll-btn");
  if (pollBtn) {
    pollBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof currentChatType !== 'undefined' && currentChatType === 'group') {
        document.getElementById("pollModal").style.display = "block";
      } else {
        if (typeof showNotif === 'function') {
          showNotif("📊 Polls are only available in group chats", "info");
        }
      }
    });
    console.log("✅ Poll button");
  }

  // ============ SEARCH BUTTONS ============
  const closeSearchBtn = document.getElementById("close-search-btn");
  if (closeSearchBtn) {
    closeSearchBtn.addEventListener("click", () => {
      if (typeof window.closeSearch === 'function') {
        window.closeSearch();
      } else {
        console.warn('closeSearch not yet available');
      }
    });
    console.log("✅ Close search button");
  }

  const browseUsersBtn = document.getElementById("browse-users-btn");
  if (browseUsersBtn) {
    browseUsersBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (typeof browseAllUsers === 'function') {
        browseAllUsers();
      }
    });
    console.log("✅ Browse users button");
  }

  // ============ CLOSE BUTTONS ============
  const closeInfoBtn = document.getElementById("closeInfoBtn");
  if (closeInfoBtn) {
    closeInfoBtn.addEventListener("click", () => {
      showChatListView();
      goBack();
    });
    console.log("✅ Close info button");
  }

  const closeInfoBtn2 = document.getElementById("closeInfoBtn2");
  if (closeInfoBtn2) {
    closeInfoBtn2.addEventListener("click", () => {
      const menu = document.getElementById("chatOptionsMenu");
      if (menu) menu.style.display = menu.style.display === "block" ? "none" : "block";
    });
    console.log("✅ Close info button 2");
  }

  // ============ BOTTOM NAVIGATION ============
  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const navSection = item.dataset.nav;
      
      if (navSection === 'logout') {
        // Handle logout
        if (confirm('Are you sure you want to logout?')) {
          if (typeof signOut !== 'undefined') {
            signOut(auth).then(() => {
              window.location.href = 'index.html';
            });
          }
        }
      } else if (navSection) {
        // Handle navigation
        navItems.forEach(nav => nav.classList.remove("active"));
        item.classList.add("active");
        if (typeof handleNavigation === 'function') {
          handleNavigation(navSection);
        }
      }
    });
  });
  console.log("✅ Bottom navigation buttons (" + navItems.length + " buttons)");

  // ============ MODAL CLOSE BUTTONS ============
  // Close Poll Modal
  const pollModal = document.getElementById('pollModal');
  if (pollModal) {
    const pollCloseBtn = pollModal.querySelector('.close-modal');
    if (pollCloseBtn) {
      pollCloseBtn.addEventListener("click", () => {
        pollModal.style.display = 'none';
      });
      console.log("✅ Poll modal close button");
    }
  }

  // Close Create Group Modal
  const createGroupModal = document.getElementById('createGroupModal');
  if (createGroupModal) {
    const groupCloseBtn = createGroupModal.querySelector('.close-modal');
    if (groupCloseBtn) {
      groupCloseBtn.addEventListener("click", () => {
        createGroupModal.style.display = 'none';
      });
      console.log("✅ Create group modal close button");
    }
  }

  // Close Settings Modal
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", () => {
      const settingsModal = document.getElementById('settingsModal');
      if (settingsModal) {
        settingsModal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    });
    console.log("✅ Settings modal close button");
  }

  // Logout from settings
  const logoutSettingsBtn = document.getElementById('logoutSettingsBtn');
  if (logoutSettingsBtn) {
    logoutSettingsBtn.addEventListener("click", () => {
      if (confirm('Are you sure you want to logout?')) {
        if (typeof signOut !== 'undefined') {
          signOut(auth).then(() => {
            window.location.href = 'index.html';
          });
        }
      }
    });
    console.log("✅ Settings logout button");
  }

  // File input change handler
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const attachmentName = document.getElementById("attachment-name");
        const attachmentPreview = document.getElementById("attachment-preview");
        if (attachmentName) attachmentName.textContent = file.name;
        if (attachmentPreview) attachmentPreview.style.display = "block";
      }
    });
    console.log("✅ File input change handler");
  }

  // Status image input change handler
  const statusImageInput = document.getElementById('statusImageInput');
  if (statusImageInput) {
    statusImageInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = document.getElementById('myStatusPic');
          if (img) img.src = e.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });
    console.log("✅ Status image input handler");
  }

  console.log("✅✅✅ ALL BUTTON LISTENERS ATTACHED ✅✅✅");
}, 500);
