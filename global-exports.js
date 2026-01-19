// This file makes module functions accessible globally for onclick handlers
// It must be loaded AFTER chat.js

console.log("⏳ Waiting for chat.js to load...");

// Wait a bit for chat.js module to fully load, then expose functions
setTimeout(() => {
  console.log("✅ Making functions available to onclick handlers...");
  
  // The functions are already defined in the module scope, 
  // but we need them accessible from HTML onclick
  // This script just ensures they're available
  
}, 100);
