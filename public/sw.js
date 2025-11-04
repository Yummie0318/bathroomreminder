// ✅ PeePal Service Worker — Universal Push + Local Reminder Support

// Install → activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  console.log("[SW] Installed — ready immediately");
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("[SW] Activated — controlling all clients");
});

// 🧩 Handle Push Notifications
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received:", event.data);

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "🚽 PeePal Reminder", body: "Time for a bathroom break!" };
  }

  const title = data.title || "🚽 PeePal Reminder";
  const options = {
    body: data.body || "It’s time for a quick break 💧",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    tag: "pee-pal-reminder",
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || "/dashboard" },
    actions: [
      { action: "open", title: "Open PeePal" },
      { action: "dismiss", title: "Dismiss" },
    ],
    // 👇 Prevents accidental silent notifications in browsers that honor it
    silent: false,
  };

  // Show the notification and notify clients to play audio
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);

      const clientList = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      clientList.forEach((client) =>
        client.postMessage({ type: "PLAY_AUDIO" })
      );
    })()
  );
});

// 🧭 Handle Notification Clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// 📴 Handle Notification Close → Stop Audio Playback
self.addEventListener("notificationclose", async () => {
  console.log("[SW] Notification closed — sending STOP_AUDIO");
  const clientList = await clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  clientList.forEach((client) =>
    client.postMessage({ type: "STOP_AUDIO" })
  );
});

// 💤 Handle Local Notifications from Dashboard
self.addEventListener("message", async (event) => {
  if (event.data?.type === "LOCAL_NOTIFY") {
    const bodyMessage =
      event.data.body ||
      "Stay hydrated and take a quick bathroom break 💧";
    const url = event.data.url || "/dashboard";

    console.log("[SW] Local notify triggered by page:", bodyMessage);

    await self.registration.showNotification("🚽 PeePal Reminder", {
      body: bodyMessage,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "pee-pal-local",
      requireInteraction: true,
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url },
      silent: false, // 👈 also here
    });

    const clientList = await clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    clientList.forEach((client) =>
      client.postMessage({ type: "PLAY_AUDIO" })
    );
  }
});
