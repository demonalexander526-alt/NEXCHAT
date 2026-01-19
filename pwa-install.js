let deferredPrompt;
let installPromptShown = false;

// Listen for the install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('beforeinstallprompt event fired');
  e.preventDefault();
  deferredPrompt = e;
  console.log('Deferred prompt saved, showing install prompt');
  showInstallPrompt();
});

window.addEventListener('appinstalled', () => {
  console.log('✅ NEXCHAT installed as PWA successfully');
  deferredPrompt = null;
  removeInstallPrompt();
  localStorage.removeItem('nexchat_install_dismissed');
  localStorage.setItem('nexchat_installed', 'true');
});

// Check if PWA is already installed
window.addEventListener('load', () => {
  if (window.navigator.standalone === true) {
    console.log('✅ App is running in standalone mode (already installed)');
    localStorage.setItem('nexchat_installed', 'true');
  }
});

function showInstallPrompt() {
  // Don't show if already dismissed in last 24 hours
  const dismissedTime = localStorage.getItem('nexchat_install_dismissed_time');
  if (dismissedTime && Date.now() - parseInt(dismissedTime) < 86400000) {
    console.log('Install prompt dismissed recently, waiting...');
    return;
  }
  
  if (installPromptShown) return;
  
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #00ff66 0%, #00cc52 100%);
    color: #0a0f1a;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 255, 102, 0.3);
    font-weight: 600;
    font-size: 14px;
  `;
  
  const message = document.createElement('span');
  message.textContent = '📱 Install NEXCHAT as an app for faster access & offline support';
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 10px;';
  
  const installBtn = document.createElement('button');
  installBtn.textContent = 'Install';
  installBtn.style.cssText = `
    background: #0a0f1a;
    color: #00ff66;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s ease;
  `;
  installBtn.onmouseover = () => installBtn.style.transform = 'scale(1.05)';
  installBtn.onmouseout = () => installBtn.style.transform = 'scale(1)';
  installBtn.onclick = handleInstall;
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    background: transparent;
    color: #0a0f1a;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 0 5px;
    transition: all 0.3s ease;
  `;
  closeBtn.onmouseover = () => closeBtn.style.opacity = '0.7';
  closeBtn.onmouseout = () => closeBtn.style.opacity = '1';
  closeBtn.onclick = dismissInstall;
  
  buttonContainer.appendChild(installBtn);
  buttonContainer.appendChild(closeBtn);
  
  banner.appendChild(message);
  banner.appendChild(buttonContainer);
  document.body.insertBefore(banner, document.body.firstChild);
  
  if (document.body.firstElementChild) {
    document.body.firstElementChild.style.marginTop = '60px';
  }
  
  installPromptShown = true;
}

async function handleInstall() {
  if (!deferredPrompt) {
    console.warn('No deferred prompt available');
    return;
  }
  
  console.log('Showing install prompt');
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  
  if (result.outcome === 'accepted') {
    console.log('✅ User accepted install prompt');
    localStorage.removeItem('nexchat_install_dismissed_time');
  } else {
    console.log('User dismissed install prompt');
  }
  
  deferredPrompt = null;
  removeInstallPrompt();
}

function dismissInstall() {
  const dismissTime = Date.now();
  localStorage.setItem('nexchat_install_dismissed_time', dismissTime.toString());
  removeInstallPrompt();
  installPromptShown = false;
  console.log('Install prompt dismissed, will show again after 24 hours');
}

function removeInstallPrompt() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.style.animation = 'slideUp 0.3s ease';
    setTimeout(() => banner.remove(), 300);
  }
  const firstElement = document.body.firstElementChild;
  if (firstElement && firstElement.style.marginTop) {
    firstElement.style.marginTop = '0';
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' })
    .then(reg => {
      console.log('✅ PWA Service Worker registered successfully:', reg);
      console.log('Scope:', reg.scope);
      console.log('State:', reg.installing?.state || reg.active?.state);
      
      // Check for updates
      reg.onupdatefound = () => {
        const newWorker = reg.installing;
        newWorker.onstatechange = () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('Service Worker update available');
          }
        };
      };
    })
    .catch(err => {
      console.error('❌ Service Worker registration failed:', err);
      console.log('Details:', {
        error: err.message,
        stack: err.stack
      });
    });
} else {
  console.warn('⚠️ Service Workers not supported in this browser');
}
