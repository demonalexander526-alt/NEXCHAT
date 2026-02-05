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
        console.log('✅ Call saved to history:', callRecord);
    } catch (error) {
        console.error('❌ Error saving call to history:', error);
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
      <div style="font-size: 48px; margin-bottom: 15px;">📞</div>
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
          <div style="font-size: 64px; margin-bottom: 20px;">📞</div>
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

            const callIcon = call.type === 'video' ? '📹' : '📞';
            const directionIcon = call.isOutgoing ? '📤' : '📥';
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
              <span>•</span>
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
        console.log(`📞 Loaded ${allCalls.length} call(s) from history`);

    } catch (error) {
        console.error('Error loading call history:', error);
        callHistoryFeed.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #ff4444;">
        <div style="font-size: 48px; margin-bottom: 15px;">❌</div>
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
        showNotif('🗑️ Clearing call history...', 'info');

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

        showNotif('✅ Call history cleared', 'success');
        loadCallHistory(); // Reload to show empty state

    } catch (error) {
        console.error('Error clearing call history:', error);
        showNotif('❌ Failed to clear call history', 'error');
    }
}

// Clear call history button listener
document.getElementById('clearCallHistoryBtn')?.addEventListener('click', clearCallHistory);
