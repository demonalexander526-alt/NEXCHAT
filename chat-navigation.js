
// ============================================================
// NAVIGATION HANDLER
// ============================================================

window.handleNavigation = function (navSection) {
    console.log(`🧭 Navigating to: ${navSection}`);

    // Hide all main sections first
    const sections = [
        'chatListView',
        'statusContainer',
        'groupsContainer',
        'announcementsContainer',
        'chatDetailView'
    ];

    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Show specific section
    switch (navSection) {
        case 'chats':
            const chatList = document.getElementById('chatListView');
            if (chatList) {
                chatList.classList.remove('hidden');
                chatList.style.display = 'flex';
            }
            break;

        case 'updates': // Status
            const statusCont = document.getElementById('statusContainer');
            if (statusCont) {
                statusCont.style.display = 'flex';
                statusCont.style.zIndex = '15'; // Ensure above others
            }
            break;

        case 'communities': // Groups
            const groupsCont = document.getElementById('groupsContainer');
            if (groupsCont) {
                groupsCont.style.display = 'block';
                groupsCont.style.paddingTop = '60px'; // Account for header

                // Refresh groups list if needed
                if (typeof loadGroupsList === 'function') loadGroupsList();
            }
            break;

        case 'announcements':
            const announceCont = document.getElementById('announcementsContainer');
            if (announceCont) {
                announceCont.style.display = 'flex';
                announceCont.style.paddingTop = '60px'; // Account for header
            }
            break;

        default:
            // Default to chats
            const defList = document.getElementById('chatListView');
            if (defList) defList.style.display = 'flex';
    }

    // Ensure header is updated if needed
    const headerLogo = document.getElementById('headerLogoText');
    if (headerLogo) {
        if (navSection === 'updates') headerLogo.textContent = 'Status';
        else if (navSection === 'communities') headerLogo.textContent = 'Groups';
        else if (navSection === 'announcements') headerLogo.textContent = 'Announcements';
        else headerLogo.textContent = 'NEXCHAT';
    }
};
