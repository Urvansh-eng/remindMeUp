self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle push notification events
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '⏰ Meeting Reminder', body: event.data.text() };
    }
  }

  const title = data.title || '⏰ Meeting Starting Soon';
  const options = {
    body: data.body || 'You have an upcoming task.',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'meeting-reminder',
    requireInteraction: true,
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Open Meeting' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click events (actions)
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;

  notification.close();

  if (action === 'dismiss') {
    return; // Silently close
  }

  // Open action or general click: navigate to application
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetUrl = notification.data?.url || '/';
      
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE_TASK', url: targetUrl });
          return client.focus();
        }
      }
      
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
