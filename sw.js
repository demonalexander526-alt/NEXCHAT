// Service Worker for NEXCHAT PWA

const CACHE_NAME = 'nexchat-v2';
const STATIC_FILES = [
  './',
  './index.html',
  './chat.html',
  './profile-upload.html',
  './chat.css',
  './chat.js',
  './login.css',
  './register.css',
  './reset.css',
  './profile-upload.css',
  './manifest.json',
  './logo.jpg'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching application shell');
      return cache.addAll(STATIC_FILES.filter(file => {
        // Only cache files that exist (don't fail on non-existent files)
        return !file.includes('node_modules');
      })).catch(err => {
        console.log('Some files could not be cached:', err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Network first, then cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome extensions
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome://')) {
    return;
  }

  // Firebase requests should go to network only
  if (event.request.url.includes('firebase') || event.request.url.includes('firestore')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response('Offline - Firebase not available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
    );
    return;
  }

  // Network first strategy for other requests
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const clonedResponse = response.clone();
        
        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clonedResponse);
          });
        }
        
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((response) => {
          return response || new Response('Offline - Page not cached', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Handle Push Notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: '☄️ NEXCHAT',
    body: 'You have a new message',
    icon: './logo.jpg',
    badge: './logo.jpg',
    tag: 'nexchat-notification',
    requireInteraction: true
  };

  if (event.data) {
    try {
      notificationData = {
        ...notificationData,
        ...event.data.json()
      };
    } catch (err) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle Notification Click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if NEXCHAT window is already open
      for (let client of clientList) {
        if (client.url.includes('chat.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open it
      if (clients.openWindow) {
        return clients.openWindow('./chat.html');
      }
    })
  );
});

// Handle Notification Close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Background Sync for offline messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(
      // Sync pending messages when connection is restored
      clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_MESSAGES' });
        });
      })
    );
  }
});
