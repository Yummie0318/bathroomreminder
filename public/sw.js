// public/sw.js

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log("[SW] Installed and skipping waiting.");
  });
  
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    console.log("[SW] Activated and clients claimed.");
  });
  
  // Push event
  self.addEventListener("push", (event) => {
    console.log("[SW] Push received:", event.data?.text());
  
    let data = {};
    try {
      data = event.data?.json() || {};
    } catch (err) {
      console.error("[SW] Push event data parsing failed:", err);
    }
  
    const title = data.title || "🚽 PeePal Reminder";
    const options = {
      body: data.body || "Time for a bathroom break!",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      requireInteraction: true,
      vibrate: [200, 100, 200],
      tag: "pee-pal-reminder",
    };
  
    event.waitUntil(
      self.registration.showNotification(title, options).catch((err) => {
        console.error("[SW] showNotification failed:", err);
      })
    );
  });
  
  // Notification click
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow("/");
      })
    );
  });
  
  // Notification close → stop audio
  self.addEventListener("notificationclose", (event) => {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage("STOP_AUDIO");
        }
      })
    );
  });
  