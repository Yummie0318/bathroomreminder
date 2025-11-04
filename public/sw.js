// ✅ PeePal Service Worker — Universal Push + Local Reminder Support

// VAPID key (Uint8Array) will be provided by the page so the SW can resubscribe headlessly
self.PEEPAL_VAPID_KEY = null;

// Install → activate immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  console.log("[SW] Installed — ready immediately");
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("[SW] Activated — controlling all clients");
});

// 🧩 Handle Push Notifications (works even when all tabs are closed)
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    console.log("[SW] Push event received");

    // Parse payload safely (supports JSON; tolerates text/empty)
    let data = {};
    try {
      if (event.data) {
        try {
          data = event.data.json();
        } catch {
          // Some backends send plain text; optional:
          // const txt = await event.data.text();
          data = {};
        }
      }
    } catch {
      data = {};
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
      silent: false,
    };

    await self.registration.showNotification(title, options);

    // Nudge any open clients to play audio
    try {
      const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
      clientList.forEach((client) => client.postMessage({ type: "PLAY_AUDIO" }));
    } catch (e) {
      // no-op
    }
  })());
});

// 🧭 Handle Notification Clicks (open correct URL from a cold start)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  // Resolve relative URL against SW scope so it opens correctly with no tabs
  const scope = self.registration.scope || "/";
  const targetUrl = new URL(event.notification.data?.url || "/dashboard", scope).href;

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) {
      try {
        if (client.url && client.url.indexOf(targetUrl) !== -1 && "focus" in client) {
          return client.focus();
        }
      } catch {}
    }
    if (clients.openWindow) return clients.openWindow(targetUrl);
  })());
});

// 📴 Handle Notification Close → Stop Audio Playback
self.addEventListener("notificationclose", (event) => {
  event.waitUntil((async () => {
    console.log("[SW] Notification closed — sending STOP_AUDIO");
    const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    clientList.forEach((client) => client.postMessage({ type: "STOP_AUDIO" }));
  })());
});

// 💤 Messages from the page (LOCAL_NOTIFY & setting VAPID)
self.addEventListener("message", async (event) => {
  // Page provides VAPID so we can resubscribe if the browser rotates the subscription
  if (event.data?.type === "SET_VAPID") {
    self.PEEPAL_VAPID_KEY = event.data.vapidKey || null; // Uint8Array expected
    return;
  }

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
      silent: false,
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

// 🔁 Auto-resubscribe if the browser rotates the push subscription
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: self.PEEPAL_VAPID_KEY || undefined,
      });

      // Tell any open client to update server; or POST directly if no clients
      const list = await clients.matchAll({ type: "window", includeUncontrolled: true });
      if (list.length) {
        list.forEach((c) => c.postMessage({ type: "SUB_UPDATED", subscription: newSub }));
      } else {
        await fetch("/api/save-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: newSub }),
        });
      }
      console.log("[SW] pushsubscriptionchange → resubscribed");
    } catch (e) {
      console.warn("[SW] pushsubscriptionchange failed", e);
    }
  })());
});
