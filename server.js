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
app.set("trust proxy", 1);
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(bodyParser.json({ limit: "1mb" }));

/* ------------------ VAPID setup ------------------- */
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:you@example.com";

if (!publicVapidKey || !privateVapidKey) {
  console.error("[SERVER] Missing VAPID keys! Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
  process.exit(1);
}

webpush.setVapidDetails(vapidSubject, publicVapidKey, privateVapidKey);

/* ---------------------------------------------------
   In-memory “DB” (demo). Replace with Redis/DB in prod.
   USERS: Map<endpoint, { subscription, frequencyMinutes, language, nextAt }>
---------------------------------------------------- */
const USERS = new Map();

/* -------------- Helpers -------------- */
function clampFreq(minutes) {
  // In production we usually keep >= 5 minutes to be nice to users/browsers
  return Math.max(5, Math.min(24 * 60, Number(minutes) || 60));
}
function normalizeLang(lang) {
  return ["en", "de", "zh"].includes(lang) ? lang : "en";
}
function localizedBody(language) {
  switch (language) {
    case "de":
      return "Zeit für eine kurze Toilettenpause 💧";
    case "zh":
      return "该小憩一下去洗手间啦 💧";
    default:
      return "Time for a quick bathroom break 💧";
  }
}

async function sendReminder(user) {
  const payload = JSON.stringify({
    title: "🚽 PeePal Reminder",
    body: localizedBody(user.language || "en"),
    url: "/dashboard",
    // icon/badge optional – SW uses defaults if omitted
  });
  // TTL helps mobile delivery be timely
  await webpush.sendNotification(user.subscription, payload, { TTL: 60 });
}

/* -------------- Routes -------------- */

// Health/status for quick checks
app.get("/api/status", (req, res) => {
  const list = Array.from(USERS.values()).map((u) => ({
    endpoint: u.subscription?.endpoint,
    frequencyMinutes: u.frequencyMinutes,
    language: u.language,
    nextAt: u.nextAt,
  }));
  res.json({
    ok: true,
    count: USERS.size,
    serverTime: Date.now(),
    users: list,
  });
});

// Save or refresh subscription (idempotent upsert)
app.post("/api/save-subscription", (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ ok: false, error: "No subscription provided" });
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
    USERS.set(subscription.endpoint, { ...existing, subscription });
    console.log("[SERVER] Subscription refreshed:", subscription.endpoint);
  }
  return res.json({ ok: true, endpoint: subscription.endpoint });
});

// Preferences (frequency & language) → reschedule from now
app.post("/api/set-preferences", (req, res) => {
  const { endpoint, frequencyMinutes, language } = req.body || {};
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });

  const user = USERS.get(endpoint);
  if (!user) return res.status(404).json({ ok: false, error: "Unknown endpoint" });

  const freq = clampFreq(frequencyMinutes);
  const lang = normalizeLang(language);

  user.frequencyMinutes = freq;
  user.language = lang;
  user.nextAt = Date.now() + freq * 60 * 1000;
  USERS.set(endpoint, user);

  console.log("[SERVER] Preferences updated:", { endpoint, freq, lang });
  return res.json({ ok: true, nextAt: user.nextAt, frequencyMinutes: freq, language: lang });
});

// Optional: rotate subscription (if browser hands you a new one)
app.post("/api/rotate-subscription", (req, res) => {
  const { oldEndpoint, newSubscription } = req.body || {};
  if (!newSubscription?.endpoint) return res.status(400).json({ ok: false, error: "Missing new subscription" });

  if (oldEndpoint && USERS.has(oldEndpoint)) {
    const old = USERS.get(oldEndpoint);
    USERS.delete(oldEndpoint);
    USERS.set(newSubscription.endpoint, {
      ...old,
      subscription: newSubscription,
    });
    console.log("[SERVER] Rotated subscription", { from: oldEndpoint, to: newSubscription.endpoint });
    return res.json({ ok: true, endpoint: newSubscription.endpoint, rotated: true });
  }

  // If old not found, just upsert like new
  const existing = USERS.get(newSubscription.endpoint);
  if (!existing) {
    USERS.set(newSubscription.endpoint, {
      subscription: newSubscription,
      frequencyMinutes: 60,
      language: "en",
      nextAt: Date.now() + 60 * 60 * 1000,
    });
    console.log("[SERVER] New subscription (rotate fallback):", newSubscription.endpoint);
  } else {
    USERS.set(newSubscription.endpoint, { ...existing, subscription: newSubscription });
  }
  return res.json({ ok: true, endpoint: newSubscription.endpoint, rotated: false });
});

// Optional: remove a subscription (user turned off notifications)
app.post("/api/delete-subscription", (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ ok: false, error: "Missing endpoint" });
  const existed = USERS.delete(endpoint);
  if (existed) console.log("[SERVER] Deleted subscription:", endpoint);
  res.json({ ok: true, deleted: existed });
});

// Manual broadcast to all (for testing)
app.post("/api/send-push", async (req, res) => {
  const message = req.body?.message || "Time for a quick bathroom break 💧";

  const payload = JSON.stringify({
    title: "🚽 PeePal Reminder",
    body: message,
    url: "/dashboard",
  });

  const results = [];
  for (const user of USERS.values()) {
    try {
      await webpush.sendNotification(user.subscription, payload, { TTL: 60 });
      results.push({ endpoint: user.subscription.endpoint, success: true });
    } catch (err) {
      const code = err?.statusCode;
      if (code === 410 || code === 404 || code === 401) {
        USERS.delete(user.subscription.endpoint);
      }
      results.push({ endpoint: user.subscription.endpoint, success: false, error: String(err) });
    }
  }
  res.json({ ok: true, results });
});

/* -------------- Simple scheduler loop -------------- */
/* Runs every 30s and sends reminders that are due.
   NOTE: This resets on server restarts. Use Redis/DB+queue in prod. */
setInterval(async () => {
  const now = Date.now();
  for (const [endpoint, user] of USERS.entries()) {
    if (!user?.nextAt || now < user.nextAt) continue;

    try {
      await sendReminder(user);
      user.nextAt = now + user.frequencyMinutes * 60 * 1000;
      USERS.set(endpoint, user);
      console.log("[SERVER] Sent scheduled reminder to:", endpoint);
    } catch (e) {
      const code = e?.statusCode;
      console.error("[SERVER] Push error:", code || e?.message || e);
      // Clean up expired/invalid subscriptions
      if (code === 410 || code === 404 || code === 401) {
        USERS.delete(endpoint);
        console.log("[SERVER] Pruned dead endpoint:", endpoint);
      }
    }
  }
}, 30 * 1000);

/* -------------- Next catch-all -------------- */
nextApp.prepare().then(() => {
  app.all(/.*/, (req, res) => handle(req, res));
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`[SERVER] Running on port ${PORT}`));
});
