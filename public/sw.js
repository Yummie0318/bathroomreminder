// ✅ PeePal Service Worker (Updated for iOS + Android Support)

self.addEventListener("install", (event) => {
  self.skipWaiting();
  console.log("[SW] Installed and skipping waiting.");
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("[SW] Activated and clients claimed.");
});

// 🧩 Handle Push Notifications
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received.");

  let data = {};
  try {
    // Try to parse incoming JSON payload
    data = event.data ? event.data.json() : {};
  } catch (err) {
    console.warn("[SW] Push payload not JSON, using fallback:", err);
    data = { title: "🚽 PeePal Reminder", body: event.data?.text() || "Time for a bathroom break!" };
  }

  const title = data.title || "🚽 PeePal Reminder";
  const options = {
    body: data.body || "Time for a bathroom break!",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    tag: "pee-pal-reminder",
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: "open", title: "Open PeePal" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  // Show notification
  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.error("[SW] showNotification failed:", err);
    })
  );
});

// 🧭 Handle Notification Clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return; // Do nothing

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/dashboard");
      }
    })
  );
});

// 📴 Handle Notification Close → Stop Audio Reminders
self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed, stopping audio...");
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage("STOP_AUDIO");
      }
    })
  );
});

// 🔄 Optional: Listen for messages from the main app (for sync or debug)
self.addEventListener("message", (event) => {
  console.log("[SW] Message from client:", event.data);
});
