/* eslint-disable no-console */
const express = require("express");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const cors = require("cors");
const next = require("next");
require("dotenv").config();

/* ------------------ Next.js boot ------------------ */
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

/* ------------------ Express init ------------------ */
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(bodyParser.json({ limit: "1mb" }));

/* ------------------ VAPID setup ------------------- */
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (!publicVapidKey || !privateVapidKey) {
  console.error("[SERVER] Missing VAPID keys! Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
  process.exit(1);
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:you@example.com",
  publicVapidKey,
  privateVapidKey
);

/* ---------------------------------------------------
   In-memory “DB” for demo (replace with Redis/DB later)
   USERS: Map<endpoint, { subscription, frequencyMinutes, language, nextAt }>
---------------------------------------------------- */
const USERS = new Map();

/* -------------- Helpers -------------- */
function localizedBody(language) {
  switch (language) {
    case "de": return "Zeit für eine kurze Toilettenpause 💧";
    case "zh": return "该小憩一下去洗手间啦 💧";
    default:   return "Time for a quick bathroom break 💧";
  }
}

async function sendReminder(user) {
  const payload = JSON.stringify({
    title: "🚽 PeePal Reminder",
    body: localizedBody(user.language || "en"),
    url: "/dashboard",
    // icon/badge optional: your SW has defaults
  });

  // TTL helps delivery timeliness on mobile
  await webpush.sendNotification(user.subscription, payload, { TTL: 60 });
}

/* -------------- Routes -------------- */

// Save subscription (first time)
app.post("/api/save-subscription", (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ success: false, error: "No subscription provided" });
  }

  const existing = USERS.get(subscription.endpoint);
  if (!existing) {
    USERS.set(subscription.endpoint, {
      subscription,
      frequencyMinutes: 60,
      language: "en",
      nextAt: Date.now() + 60 * 60 * 1000,
    });
    console.log("[SERVER] New subscription:", subscription.endpoint);
  } else {
    // Update subscription details if they changed
    USERS.set(subscription.endpoint, { ...existing, subscription: subscription });
    console.log("[SERVER] Subscription refreshed:", subscription.endpoint);
  }

  return res.json({ success: true });
});

// Save preferences (frequency & language) and reschedule next tick
app.post("/api/set-preferences", (req, res) => {
  const { endpoint, frequencyMinutes, language } = req.body;
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  const user = USERS.get(endpoint);
  if (!user) return res.status(404).json({ ok: false, error: "Unknown endpoint" });

  const freq = Math.max(5, Number(frequencyMinutes) || 60); // minimum 5 min in production
  const lang = ["en", "de", "zh"].includes(language) ? language : "en";

  user.frequencyMinutes = freq;
  user.language = lang;
  user.nextAt = Date.now() + freq * 60 * 1000; // schedule from now
  USERS.set(endpoint, user);

  console.log("[SERVER] Preferences updated:", { endpoint, freq, lang });
  return res.json({ ok: true });
});

// Manual “send push to all” (kept from your original for testing)
app.post("/api/send-push", async (req, res) => {
  const message = req.body?.message || "Time for a quick bathroom break 💧";

  const payload = JSON.stringify({
    title: "🚽 PeePal Reminder",
    body: message,
    url: "/dashboard",
  });

  const allUsers = Array.from(USERS.values());
  const results = await Promise.all(
    allUsers.map(async (user) => {
      try {
        await webpush.sendNotification(user.subscription, payload, { TTL: 60 });
        return { endpoint: user.subscription.endpoint, success: true };
      } catch (err) {
        // Remove dead endpoints
        if (err.statusCode === 410 || err.statusCode === 404) {
          USERS.delete(user.subscription.endpoint);
        }
        return { endpoint: user.subscription.endpoint, success: false, error: String(err) };
      }
    })
  );

  res.json({ ok: true, results });
});

/* -------------- Simple scheduler loop -------------- */
/* Runs every 30s and sends reminders that are due.
   NOTE: This resets on server restarts. Use Redis/DB+queue in prod. */
setInterval(async () => {
  const now = Date.now();
  for (const [endpoint, user] of USERS.entries()) {
    if (!user.nextAt || now < user.nextAt) continue;

    try {
      await sendReminder(user);
      user.nextAt = now + user.frequencyMinutes * 60 * 1000;
      USERS.set(endpoint, user);
      console.log("[SERVER] Sent scheduled reminder to:", endpoint);
    } catch (e) {
      console.error("[SERVER] Push error:", e?.statusCode || e?.message || e);
      // Clean up expired subscriptions
      if (String(e?.statusCode).startsWith("4")) {
        USERS.delete(endpoint);
      }
    }
  }
}, 30 * 1000);

/* -------------- Next catch-all -------------- */
nextApp.prepare().then(() => {
  // Express 5: use regex for catch-all
  app.all(/.*/, (req, res) => handle(req, res));

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
});
