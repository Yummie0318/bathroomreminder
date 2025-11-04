// ✅ PeePal Service Worker (Cross-Platform Optimized)

self.addEventListener("install", (event) => {
  self.skipWaiting();
  console.log("[SW] Installed — skipping waiting.");
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("[SW] Activated — clients claimed.");
});

// 🧩 Handle Push Notifications
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received.");

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    console.warn("[SW] Push payload not JSON, using fallback:", err);
    data = {
      title: "🚽 PeePal Reminder",
      body: event.data?.text() || "Time for a bathroom break!",
    };
  }

  const title = data.title || "🚽 PeePal Reminder";
  const options = {
    body: data.body || "Time for a bathroom break!",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    tag: "pee-pal-reminder",
    vibrate: [200, 100, 200],
    requireInteraction: true,
    renotify: true,
    data: { url: data.url || "/dashboard" },
    actions: [
      { action: "open", title: "Open PeePal" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  // ✅ Show the notification
  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error("[SW] showNotification failed:", err);
    })
  );
});

// 🧭 Handle Notification Clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  if (event.action === "dismiss") return;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// 📴 Handle Notification Close → Stop Audio
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed — stopping audio...");
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage("STOP_AUDIO");
      }
    })
  );
});

// 📨 Handle messages from app (for debugging/sync)
self.addEventListener("message", (event) => {
  console.log("[SW] Message from client:", event.data);
});
