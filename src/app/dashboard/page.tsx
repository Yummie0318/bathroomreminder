"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Droplet,
  Pause,
  Play,
  StopCircle,
  MapPin,
  Settings,
  X,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const translations = {
  en: {
    title: "PeePal",
    subtitle: "Active Reminder",
    nextReminder: "Next reminder in",
    reminderFrequency: "Reminder Frequency",
    testNotification: "Test Notification",
    findBathroom: "Find Nearest Bathroom",
    settings: "Settings",
    done: "Done",
    frequencyNote: "How often you want to be reminded 💧",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop",
    message:
      "Hi there! Just a gentle reminder — it’s time for a quick bathroom break. Stay comfortable and take care 💧",
    enableSound: "Enable Sound",
    soundEnabled: "Sound Enabled",
  },
  de: {
    title: "PeePal",
    subtitle: "Aktive Erinnerung",
    nextReminder: "Nächste Erinnerung in",
    reminderFrequency: "Erinnerungsfrequenz",
    testNotification: "Testbenachrichtigung",
    findBathroom: "Nächstes Badezimmer finden",
    settings: "Einstellungen",
    done: "Fertig",
    frequencyNote: "Wie oft Sie erinnert werden möchten 💧",
    pause: "Pause",
    resume: "Fortsetzen",
    stop: "Stopp",
    message:
      "Hallo! Nur eine kleine Erinnerung – es ist Zeit für eine kurze Toilettenpause. Bleib entspannt und pass gut auf dich auf 💧",
    enableSound: "Ton aktivieren",
    soundEnabled: "Ton aktiviert",
  },
  zh: {
    title: "PeePal",
    subtitle: "活动提醒",
    nextReminder: "下一次提醒",
    reminderFrequency: "提醒频率",
    testNotification: "测试通知",
    findBathroom: "寻找最近的洗手间",
    settings: "设置",
    done: "完成",
    frequencyNote: "您希望多久提醒一次 💧",
    pause: "暂停",
    resume: "继续",
    stop: "停止",
    message:
      "嗨！温馨提醒一下——该去洗手间休息一下啦。保持舒适，照顾好自己哦 💧",
    enableSound: "启用声音",
    soundEnabled: "声音已启用",
  },
};

// Single ringtone for all notifications
const ringtone = "/ringtone.mp3";

// API & VAPID
const API_BASE =
  process.env.NEXT_PUBLIC_PUSH_SERVER_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://bathroomreminder-zij5.onrender.com"
    : "http://localhost:4000");

const VAPID_PUBLIC_KEY =
  "BP7eA1OBdmDkLxg6-YrorPyglWaOeXqC3fNCwjyeTvcYGJYj_eMTh1qkfVFEApzl1q-dWTbF0naJh9dauCLCWXg";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

export default function Dashboard() {
  const [frequency, setFrequency] = useState<number>(60);
  const [remaining, setRemaining] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastStart, setLastStart] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [language, setLanguage] = useState<"en" | "de" | "zh">("en");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // 🔊 sound priming + playback state
  const [soundReady, setSoundReady] = useState(false);
  const pendingPlayRef = useRef(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const t = translations[language];

  // ----------------------------
  // Priming audio (must be called from a user gesture)
  // ----------------------------
  const primeAudio = async () => {
    try {
      let a = audioRef.current;
      if (!a) {
        a = new Audio(ringtone);
        a.loop = true;
        // unlock by playing muted once in response to a gesture
        a.muted = true;
        await a.play();
        a.pause();
        a.muted = false;
        audioRef.current = a;
      }
      setSoundReady(true);
    } catch (e) {
      console.log("Audio prime failed", e);
    }
  };

  // If a PLAY_AUDIO was requested while we were hidden or blocked, retry when visible
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && pendingPlayRef.current && audioRef.current) {
        pendingPlayRef.current = false;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // ----------------------------
  // ENABLE NOTIFICATIONS
  // ----------------------------
  const handleEnableNotifications = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push notifications are not supported in this browser.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Permission denied for notifications.");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Subscribe to push
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        await fetch(`${API_BASE}/api/save-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub }),
        });
      }

      setSubscription(sub);
      setNotificationsEnabled(true);
      alert("✅ Notifications enabled!");
    } catch (err) {
      console.error("Failed to register SW or subscribe:", err);
      alert("Failed to enable notifications. See console.");
    }
  };

  // Listen to SW messages (PLAY_AUDIO / STOP_AUDIO). Do this once.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let unregistered = false;

    const attach = async () => {
      try {
        // Ensure SW is registered so LOCAL_NOTIFY works even before enabling push
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const onMessage = (event: MessageEvent) => {
          const type = (event.data && event.data.type) || null;
          if (!type) return;

          if (type === "STOP_AUDIO" && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            return;
          }

          if (type === "PLAY_AUDIO") {
            // Prefer primed element
            if (!audioRef.current && soundReady) {
              audioRef.current = new Audio(ringtone);
              audioRef.current.loop = true;
            }

            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current
                .play()
                .catch(() => {
                  // blocked or background; try again on visibility
                  pendingPlayRef.current = true;
                });
            } else {
              // not primed yet; try when visible or when user primes
              pendingPlayRef.current = true;
            }
          }
        };

        navigator.serviceWorker.addEventListener("message", onMessage);

        // clean up
        return () => {
          if (unregistered) return;
          navigator.serviceWorker.removeEventListener("message", onMessage);
        };
      } catch (e) {
        console.log("[SW] attach failed", e);
      }
    };

    const cleanupPromise = attach();
    return () => {
      (async () => {
        unregistered = true;
        await cleanupPromise;
      })();
    };
  }, [soundReady]);

  // ----------------------------
  // RESTORE SETTINGS
  // ----------------------------
  useEffect(() => {
    const freq = Number(localStorage.getItem("peePalFrequency") || "60");
    const storedStart = localStorage.getItem("peePalLastStart");
    const storedRunning = localStorage.getItem("peePalIsRunning") === "true";
    const storedLang = localStorage.getItem("peePalLang") as
      | "en"
      | "de"
      | "zh"
      | null;

    setFrequency(freq);
    setIsRunning(storedRunning);
    if (storedStart) setLastStart(Number(storedStart));
    if (storedLang) setLanguage(storedLang);
  }, []);

  // ----------------------------
  // TIMER LOGIC
  // ----------------------------
  useEffect(() => {
    if (!isRunning) return;
    const freqMs = frequency * 60 * 1000;

    if (!lastStart) {
      const now = Date.now();
      setLastStart(now);
      localStorage.setItem("peePalLastStart", String(now));
    }

    intervalRef.current = setInterval(() => {
      if (!lastStart) return;
      const elapsed = Date.now() - lastStart;
      const remainingTime = Math.max(freqMs - elapsed, 0);
      setRemaining(remainingTime / 1000);

      if (remainingTime <= 0) {
        sendLocalReminder();
        const newStart = Date.now();
        setLastStart(newStart);
        localStorage.setItem("peePalLastStart", String(newStart));
      }
    }, 1000);

    return () => clearInterval(intervalRef.current!);
  }, [isRunning, lastStart, frequency]);

  // ----------------------------
  // CONTROLS
  // ----------------------------
  const handlePause = () => {
    setIsRunning(false);
    localStorage.setItem("peePalIsRunning", "false");
    clearInterval(intervalRef.current!);
    if (audioRef.current) audioRef.current.pause();
  };

  const handleResume = () => {
    setIsRunning(true);
    localStorage.setItem("peePalIsRunning", "true");
    const now = Date.now();
    setLastStart(now);
    localStorage.setItem("peePalLastStart", String(now));
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // keep the ref so primed element remains available
    }
    setRemaining(frequency * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleTestNotification = () => sendLocalReminder();

  const handleChangeLanguage = (lang: "en" | "de" | "zh") => {
    setLanguage(lang);
    localStorage.setItem("peePalLang", lang);
  };

  // ----------------------------
  // SEND LOCAL REMINDER VIA SW
  // ----------------------------
  const sendLocalReminder = async (message?: string) => {
    if (!("serviceWorker" in navigator)) return;

    const sw = await navigator.serviceWorker.ready;
    sw.active?.postMessage({
      type: "LOCAL_NOTIFY",
      body: message || t.message,
    });
  };

  // ----------------------------
  // RENDER
  // ----------------------------
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-50 px-4 py-6 relative">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-sky-100 flex flex-col overflow-hidden relative">
        {/* SETTINGS BUTTON */}
        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 bg-white/80 hover:bg-white rounded-full p-2 shadow-md border border-sky-200 transition"
        >
          <Settings className="w-5 h-5 text-sky-600" />
        </button>

        {/* HEADER */}
        <header className="bg-gradient-to-r from-sky-500 to-sky-600 text-white py-6 px-6 flex flex-col items-center justify-center text-center">
          <Droplet className="w-10 h-10 mb-2" />
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-xs opacity-90 font-light">{t.subtitle}</p>
        </header>

        {/* TIMER */}
        <section className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
          <motion.div
            className="relative flex items-center justify-center w-40 h-40 rounded-full bg-sky-100 border-8 border-sky-200"
            animate={{ scale: isRunning ? [1, 1.05, 1] : 1 }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-4xl font-bold text-sky-700">
              {formatTime(remaining || frequency * 60)}
            </span>
          </motion.div>
          <p className="text-gray-500 text-sm">
            {t.nextReminder}{" "}
            <span className="font-semibold text-sky-600">
              {formatTime(remaining || frequency * 60)}
            </span>
          </p>
        </section>

        {/* CONTROLS */}
        <section className="px-6 pb-6 flex flex-col gap-3">
          {/* 🔊 Enable Sound (audio priming) */}
          <button
            onClick={primeAudio}
            disabled={soundReady}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl ${
              soundReady
                ? "bg-violet-400 cursor-default"
                : "bg-violet-500 hover:bg-violet-600"
            } text-white py-3 font-semibold shadow active:scale-95 transition`}
          >
            {soundReady ? "🔊 " + t.soundEnabled : "🔊 " + t.enableSound}
          </button>

          <AnimatePresence mode="wait">
            {isRunning ? (
              <motion.button
                key="pause"
                onClick={handlePause}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white py-3 font-semibold shadow active:scale-95 transition"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Pause className="w-5 h-5" /> {t.pause}
              </motion.button>
            ) : (
              <motion.button
                key="resume"
                onClick={handleResume}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white py-3 font-semibold shadow active:scale-95 transition"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Play className="w-5 h-5" /> {t.resume}
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={handleStop}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white py-3 font-semibold shadow active:scale-95 transition"
          >
            <StopCircle className="w-5 h-5" /> {t.stop}
          </button>

          <button
            onClick={() => sendLocalReminder()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white py-3 font-semibold shadow active:scale-95 transition"
          >
            <Bell className="w-5 h-5" /> Send Local Reminder
          </button>

          <button
            onClick={() => (window.location.href = "/map")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-sky-600 text-sky-700 py-3 font-semibold hover:bg-sky-50 active:scale-95 transition"
          >
            <MapPin className="w-5 h-5" /> {t.findBathroom}
          </button>
        </section>

        <footer className="text-center py-3 text-[11px] text-gray-400 border-t border-gray-100">
          Built with 💧 PeePal • Fully Responsive
        </footer>
      </div>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-80 rounded-2xl shadow-lg p-6 relative border border-sky-100"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
            >
              <button
                onClick={() => setShowSettings(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-lg font-semibold text-sky-700 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" /> {t.settings}
              </h2>

              {/* Language Dropdown */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) =>
                    handleChangeLanguage(e.target.value as "en" | "de" | "zh")
                  }
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="zh">中文</option>
                </select>
              </div>

              {/* Frequency Slider */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  {t.reminderFrequency}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={frequency}
                    onChange={(e) => {
                      const newFreq = Number(e.target.value);
                      setFrequency(newFreq);
                      localStorage.setItem("peePalFrequency", String(newFreq));
                    }}
                    className="w-full accent-sky-500"
                  />
                  <motion.span
                    key={frequency}
                    className="w-12 text-right text-sm font-semibold text-sky-600"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {frequency}m
                  </motion.span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{t.frequencyNote}</p>
              </div>

              {/* Test Notification */}
              <button
                onClick={handleTestNotification}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-700 py-2 mb-4 font-semibold shadow-sm active:scale-95 transition"
              >
                <Bell className="w-4 h-4" /> {t.testNotification}
              </button>

              {/* Done */}
              <button
                onClick={() => setShowSettings(false)}
                className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 shadow active:scale-95 transition"
              >
                {t.done}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
