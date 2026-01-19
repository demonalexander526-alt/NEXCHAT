// NEXCHAT Diagnostics Script
// This script runs on app startup to help identify issues

console.log("🔍 NEXCHAT DIAGNOSTICS STARTING...\n");

// Check if critical functions exist
const criticalFunctions = [
  'showNotif', 'openSearch', 'openChat', 'sendMessage', 'openSettingsModal',
  'toggleFullscreen', 'goBackToDashboard', 'loadContacts', 'loadGroups',
  'handleNavigation', 'applyFilter', 'closeSearch', 'goBack', 'showChatListView'
];

console.log("📋 Checking critical functions:");
criticalFunctions.forEach(func => {
  if (typeof window[func] === 'function') {
    console.log(`  ✅ ${func}`);
  } else {
    console.warn(`  ❌ ${func} - NOT FOUND`);
  }
});

// Check DOM elements
console.log("\n📦 Checking critical DOM elements:");
const criticalElements = [
  'chatListView', 'chatDetailView', 'searchInput', 'messageForm',
  'chatList', 'tokenCount', 'notificationContainer', 'statusContainer',
  'groupsContainer', 'settingsModal', 'pollModal', 'createGroupModal'
];

criticalElements.forEach(id => {
  const elem = document.getElementById(id);
  if (elem) {
    console.log(`  ✅ #${id}`);
  } else {
    console.warn(`  ⚠️ #${id} - NOT FOUND`);
  }
});

// Check Firebase
console.log("\n🔥 Checking Firebase:");
if (typeof auth !== 'undefined') {
  console.log("  ✅ Firebase auth initialized");
} else {
  console.error("  ❌ Firebase auth NOT initialized");
}

if (typeof db !== 'undefined') {
  console.log("  ✅ Firebase Firestore initialized");
} else {
  console.error("  ❌ Firebase Firestore NOT initialized");
}

// Check button setup
console.log("\n🔘 Checking button setup:");
const buttons = [
  'dashboardBackBtn', 'search-btn-header', 'settings-btn-header',
  'fullscreen-btn-header', 'backBtn', 'createNewGroupBtn', 'menuBtn'
];

buttons.forEach(id => {
  const btn = document.getElementById(id);
  if (btn) {
    console.log(`  ✅ #${id}`);
  } else {
    console.warn(`  ⚠️ #${id} - NOT FOUND`);
  }
});

console.log("\n✅ DIAGNOSTICS COMPLETE");
console.log("💡 Check browser console for warnings or errors\n");
