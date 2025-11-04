const express = require("express");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (!publicVapidKey || !privateVapidKey) {
  console.error("[SERVER] Missing VAPID keys!");
  process.exit(1);
}

webpush.setVapidDetails("mailto:arnold10122017@gmail.com", publicVapidKey, privateVapidKey);

const subscriptions = [];

// Save subscription
app.post("/api/save-subscription", (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: "No subscription provided" });

  const exists = subscriptions.find((s) => JSON.stringify(s) === JSON.stringify(subscription));
  if (!exists) subscriptions.push(subscription);

  console.log("[SERVER] Subscription saved:", subscription.endpoint);
  res.json({ success: true });
});

// Send push to all subscriptions
app.post("/api/send-push", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided" });

  const payload = JSON.stringify({
    title: "🚽 PeePal Reminder",
    body: message,
    icon: "/favicon.ico",
  });

  const results = await Promise.all(
    subscriptions.map(async (sub, i) => {
      try {
        await webpush.sendNotification(sub, payload);
        console.log(`[SERVER] ✅ Push sent to #${i}`);
        return { success: true };
      } catch (err) {
        console.error(`[SERVER] ❌ Push failed for #${i}`, err);
        if (err.statusCode === 410 || err.statusCode === 404) subscriptions.splice(i, 1);
        return { success: false, error: err.message };
      }
    })
  );

  res.json({ results });
});

app.listen(4000, () => console.log("[SERVER] Push server running on http://localhost:4000"));
