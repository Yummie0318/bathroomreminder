"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Droplet, Pause, Play, StopCircle, MapPin, Settings, X, Bell } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";

/* ----------------------- TRANSLATIONS ----------------------- */
const translations = {
  en: {
    title: "PeePal",
    subtitle: "Active Reminder",
    nextReminder: "Next reminder in",
    reminderFrequency: "Reminder Frequency",
    testNotification: "Test Notification",
    sendLocalReminder: "Send Local Reminder",
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
    iosInstallTip:
      "On iPhone, install PeePal first: Share → Add to Home Screen, then open it from the Home Screen to enable notifications & sound.",
    iosPrimeTip:
      "Tap “Enable Sound” once to let PeePal play a tone when you return to the app after a reminder.",
    language: "Language",
  },
  de: {
    title: "PeePal",
    subtitle: "Aktive Erinnerung",
    nextReminder: "Nächste Erinnerung in",
    reminderFrequency: "Erinnerungsfrequenz",
    testNotification: "Testbenachrichtigung",
    sendLocalReminder: "Lokale Erinnerung senden",
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
    iosInstallTip:
      "Auf dem iPhone zuerst installieren: Teilen → Zum Home-Bildschirm, dann von dort öffnen, um Benachrichtigungen & Ton zu aktivieren.",
    iosPrimeTip:
      "Tippe einmal auf „Ton aktivieren“, damit PeePal beim Zurückkehren einen Ton abspielen kann.",
    language: "Sprache",
  },
  zh: {
    title: "PeePal",
    subtitle: "活动提醒",
    nextReminder: "下一次提醒",
    reminderFrequency: "提醒频率",
    testNotification: "测试通知",
    sendLocalReminder: "发送本地提醒",
    findBathroom: "寻找最近的洗手间",
    settings: "设置",
    done: "完成",
    frequencyNote: "您希望多久提醒一次 💧",
    pause: "暂停",
    resume: "继续",
    stop: "停止",
    message: "嗨！温馨提醒一下——该去洗手间休息一下啦。保持舒适，照顾好自己哦 💧",
    enableSound: "启用声音",
    soundEnabled: "声音已启用",
    iosInstallTip:
      "在 iPhone 上请先安装：分享 → 添加到主屏幕，然后从主屏幕打开以启用通知和声音。",
    iosPrimeTip:
      "请先点一次“启用声音”，这样返回应用时 PeePal 才能播放提示音。",
    language: "语言",
  },
} as const;

type Lang = keyof typeof translations;

/* ----------------------- CONSTANTS ----------------------- */
const ringtone = "/ringtone.mp3";
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

/* -------------------- WEB AUDIO RINGTONE -------------------- */
function useWebAudioRingtone() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [ready, setReady] = useState(false);
  const pendingPlayRef = useRef(false);

  const stopInternal = () => {
    try {
      sourceRef.current?.stop();
    } catch {}
    sourceRef.current?.disconnect();
    sourceRef.current = null;
  };

  const play = async () => {
    if (!audioCtxRef.current || !bufferRef.current) {
      pendingPlayRef.current = true;
      return;
    }
    if (document.hidden) {
      pendingPlayRef.current = true;
      return;
    }
    if (audioCtxRef.current.state !== "running") {
      try {
        await audioCtxRef.current.resume();
      } catch {}
    }
    stopInternal();
    const src = audioCtxRef.current.createBufferSource();
    src.buffer = bufferRef.current!;
    src.loop = true;
    if (!gainRef.current) {
      gainRef.current = audioCtxRef.current.createGain();
      gainRef.current.gain.value = 1.0;
      gainRef.current.connect(audioCtxRef.current.destination);
    }
    src.connect(gainRef.current);
    src.start(0);
    sourceRef.current = src;
  };

  const stop = () => {
    pendingPlayRef.current = false;
    stopInternal();
  };

  const prime = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch {}
    }
    if (!bufferRef.current) {
      const res = await fetch(ringtone, { cache: "no-store" });
      const arr = await res.arrayBuffer();
      bufferRef.current = await ctx.decodeAudioData(arr);
    }
    setReady(true);
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      await play();
    }
  };

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden && ready && pendingPlayRef.current) {
        pendingPlayRef.current = false;
        play();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [ready]);

  return { prime, play, stop, ready, pendingPlayRef };
}

/* ----------------------- iOS HINT BANNER ----------------------- */
function IOSHint({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm px-3 py-2 flex items-start gap-2 shadow-sm">
      <span className="mt-0.5">🍏</span>
      <div className="flex-1">{children}</div>
      <button onClick={onClose} className="text-amber-700 hover:text-amber-900 text-xs px-2 py-1 rounded-md">
        ✕
      </button>
    </div>
  );
}

/* ----------------------- TICKER ----------------------- */
function useTicker() {
  const t = useMotionValue(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      t.set(performance.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [t]);
  return t as MotionValue<number>;
}

/* =========================== PAGE =========================== */
export default function Dashboard() {
  const [frequency, setFrequency] = useState<number>(60);
  const [remaining, setRemaining] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastStart, setLastStart] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [language, setLanguage] = useState<Lang>("en");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [iosHintsDismissed, setIosHintsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const { prime, play, stop, ready, pendingPlayRef } = useWebAudioRingtone();
  const tDict = translations[language];

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const isiOS = /iPhone|iPad|iPod/i.test(ua);
    const standalone =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true);
    setIsIOS(isiOS);
    setIsStandalone(Boolean(standalone));
  }, []);

  const handleEnableNotifications = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push not supported.");
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
      console.error("SW/Push error:", err);
      alert("Failed to enable notifications. See console.");
    }
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let onMessage: any;
    const attach = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        onMessage = (event: MessageEvent) => {
          const type = (event.data && event.data.type) || null;
          if (!type) return;
          if (type === "STOP_AUDIO") return stop();
          if (type === "PLAY_AUDIO") {
            if (!ready) {
              pendingPlayRef.current = true;
              return;
            }
            play().catch(() => (pendingPlayRef.current = true));
          }
        };
        navigator.serviceWorker.addEventListener("message", onMessage);
      } catch (e) {
        console.log("[SW] attach failed", e);
      }
    };
    attach();
    return () => {
      if (onMessage) navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [ready, play, stop, pendingPlayRef]);

  useEffect(() => {
    const freq = Number(localStorage.getItem("peePalFrequency") || "60");
    const storedStart = localStorage.getItem("peePalLastStart");
    const storedRunning = localStorage.getItem("peePalIsRunning") === "true";
    const storedLang = (localStorage.getItem("peePalLang") as Lang | null) || "en";
    setFrequency(freq);
    setIsRunning(storedRunning);
    if (storedStart) setLastStart(Number(storedStart));
    setLanguage(storedLang);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const freqMs = frequency * 60 * 1000;
    if (!lastStart) {
      const now = Date.now();
      setLastStart(now);
      localStorage.setItem("peePalLastStart", String(now));
    }
    const id = setInterval(() => {
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
    return () => clearInterval(id);
  }, [isRunning, lastStart, frequency]);

  const handlePause = () => {
    setIsRunning(false);
    localStorage.setItem("peePalIsRunning", "false");
    stop();
  };
  const handleResume = () => {
    setIsRunning(true);
    localStorage.setItem("peePalIsRunning", "true");
    const now = Date.now();
    setLastStart(now);
    localStorage.setItem("peePalLastStart", String(now));
  };
  const handleStop = () => {
    stop();
    setRemaining(frequency * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleTestNotification = () => sendLocalReminder();
  const handleChangeLanguage = (lang: Lang) => {
    setLanguage(lang);
    localStorage.setItem("peePalLang", lang);
  };
  const cycleLanguage = () => {
    const order: Lang[] = ["en", "de", "zh"];
    const next = order[(order.indexOf(language) + 1) % order.length];
    handleChangeLanguage(next);
  };

  const sendLocalReminder = async (message?: string) => {
    if (!("serviceWorker" in navigator)) return;
    const sw = await navigator.serviceWorker.ready;
    sw.active?.postMessage({ type: "LOCAL_NOTIFY", body: message || tDict.message });
  };

  /* --------- water progress (smoothed) --------- */
  const total = frequency * 60;
  const secsNum = remaining || total;
  const rawProgress = Math.min(1, Math.max(0, 1 - secsNum / total)); // 0→empty, 1→full
  const progressMV = useMotionValue(rawProgress);
  const progressSpring = useSpring(progressMV, { stiffness: 80, damping: 16, mass: 0.6 });
  useEffect(() => {
    progressMV.set(rawProgress);
  }, [rawProgress, progressMV]);

  // level & height (MotionValues used directly — no casts)
  const waterY: MotionValue<number> = useTransform(progressSpring, (p: number) => 100 - p * 92 - 4);
  const waterHeight: MotionValue<number> = useTransform(progressSpring, (p: number) => p * 92 + 4);

  // slosh angle
  const tick = useTicker();
  const sloshAmp: MotionValue<number> = useTransform(progressSpring, (p: number) => (isRunning ? 1.8 + p * 1.2 : 0));
  const sloshAngle: MotionValue<number> = useTransform([tick, sloshAmp], ([tt, aa]) => Math.sin((tt as number) / 900) * (aa as number));

  // subtle shimmer (used for highlight)
  const shimmer: MotionValue<number> = useTransform(tick, (tt) => (Math.sin(tt / 1200) + 1) / 2);
  const highlightOpacity = useTransform(shimmer, (s) => 0.75 - s * 0.15);

  /* --------------------------- RENDER --------------------------- */
  return (
    <main
      className="min-h-[100dvh] w-full overflow-hidden flex items-center justify-center bg-gradient-to-b from-sky-100 via-white to-sky-50 px-3 sm:px-4 py-3 sm:py-6 relative"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)",
        paddingLeft: "calc(env(safe-area-inset-left) + 0.75rem)",
        paddingRight: "calc(env(safe-area-inset-right) + 0.75rem)",
      }}
    >
      {isIOS && !iosHintsDismissed && (
        <div className="fixed top-3 left-0 right-0 z-50 flex justify-center">
          <div className="max-w-md w-full">
            {!isStandalone ? (
              <IOSHint onClose={() => setIosHintsDismissed(true)}>{tDict.iosInstallTip}</IOSHint>
            ) : !ready ? (
              <IOSHint onClose={() => setIosHintsDismissed(true)}>{tDict.iosPrimeTip}</IOSHint>
            ) : null}
          </div>
        </div>
      )}

      {/* Card height now responsive (clamp) */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg border border-sky-100 grid grid-rows-[auto_1fr_auto_auto] overflow-hidden relative h-[min(92dvh,42rem)]">
        {/* Settings button only (back button removed) */}
        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-3 sm:top-4 right-3 sm:right-4 bg-white/80 hover:bg-white rounded-full p-2 shadow-md border border-sky-200 transition"
          aria-label={tDict.settings}
        >
          <Settings className="w-5 h-5 text-sky-600" />
        </button>

        <header className="bg-gradient-to-r from-sky-500 to-sky-600 text-white py-4 sm:py-6 px-5 sm:px-6 flex flex-col items-center justify-center text-center">
          <Droplet className="w-8 h-8 sm:w-10 sm:h-10 mb-1.5 sm:mb-2" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{tDict.title}</h1>
          <p className="text-[11px] sm:text-xs opacity-90 font-light">{tDict.subtitle}</p>
        </header>

        {/* TIMER — responsive circle with clamp() */}
        <section className="min-h-0 flex flex-col items-center justify-center gap-4 sm:gap-6 py-6 sm:py-8 px-4">
          <motion.div
            className="relative flex items-center justify-center rounded-full border-8 border-sky-200 shadow-inner bg-sky-50 overflow-hidden"
            style={{
              width: "clamp(9rem, 38vw, 12.5rem)",
              height: "clamp(9rem, 38vw, 12.5rem)",
            }}
            animate={{ scale: isRunning ? [1, 1.03, 1] : 1 }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            {/* Glass highlight */}
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(120% 100% at 0% 0%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.35) 35%, rgba(255,255,255,0) 60%)",
                opacity: highlightOpacity,
              }}
            />

            {/* SVG */}
            <svg className="absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
              <defs>
                <clipPath id="clip-circle">
                  <circle cx="50" cy="50" r="46" />
                </clipPath>

                {/* Depth gradient */}
                <linearGradient id="depth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#47c7ff" stopOpacity="0.95" />
                  <stop offset="60%" stopColor="#14a5e6" stopOpacity="0.98" />
                  <stop offset="100%" stopColor="#0b79c9" />
                </linearGradient>

                {/* Caustics moving light pattern */}
                <filter id="caustics" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.01 0.015" numOctaves="2" seed="9" result="noise" />
                  <feColorMatrix type="saturate" values="0.6" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" xChannelSelector="R" yChannelSelector="G" />
                </filter>

                {/* Subtle waves refraction */}
                <filter id="refract" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves="3" seed="4" result="n2" />
                  <feDisplacementMap in="SourceGraphic" in2="n2" scale="1.2" xChannelSelector="R" yChannelSelector="G" />
                </filter>

                {/* Soft blur for foam */}
                <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="0.6" />
                </filter>

                {/* Foam gradient (white to transparent) */}
                <linearGradient id="foam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                </linearGradient>

                {/* Sparkle highlight */}
                <radialGradient id="spark" cx="35%" cy="15%" r="30%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
                  <stop offset="60%" stopColor="rgba(255,255,255,0.25)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>

              {/* Water group with level + slosh */}
              <motion.g clipPath="url(#clip-circle)" style={{ transformOrigin: "50% 50%", rotate: sloshAngle }}>
                {/* Main water body with depth, caustics & refraction */}
                <motion.rect
                  x="4"
                  width="92"
                  y={waterY}
                  height={waterHeight}
                  rx="44"
                  fill="url(#depth)"
                  filter="url(#caustics) url(#refract)"
                />

                {/* Parallax wave layers (different phase/speed) */}
                <Wave y={waterY} amp={5.8} speed={6.5} color="#14a5e6" opacity={0.45} dir="left" density={5} />
                <Wave y={waterY} amp={3.6} speed={3.8} color="#47c7ff" opacity={0.6} dir="right" density={6} />
                <Wave y={waterY} amp={2.2} speed={2.2} color="url(#foam)" opacity={0.9} dir="left" density={7} blur />

                {/* Foam crest stroke at surface */}
                <FoamCrest y={waterY} amp={2.6} speed={2.0} opacity={0.55} />

                {/* Rising bubbles */}
                <Bubbles y={waterY} count={10} />

                {/* Specular sparkle that shifts with shimmer */}
                <motion.circle
                  cx={useTransform(shimmer, (s) => 38 + s * 8)}
                  cy={useTransform(shimmer, (s) => 30 + s * 6)}
                  r="12"
                  fill="url(#spark)"
                  style={{ mixBlendMode: "screen" as any }}
                />
              </motion.g>
            </svg>

            {/* Time text */}
            <span className="relative z-10 text-3xl sm:text-4xl font-bold text-sky-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.75)]">
              {formatTime(secsNum)}
            </span>
          </motion.div>

          <p className="text-gray-500 text-xs sm:text-sm">
            {tDict.nextReminder} <span className="font-semibold text-sky-600">{formatTime(secsNum)}</span>
          </p>
        </section>

        {/* CONTROLS */}
        <section className="px-4 sm:px-6 pb-4 sm:pb-6 flex flex-col gap-2.5 sm:gap-3">
          <button
            onClick={prime}
            disabled={ready}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl ${
              ready ? "bg-violet-400 cursor-default" : "bg-violet-500 hover:bg-violet-600"
            } text-white py-2.5 sm:py-3 font-semibold shadow active:scale-95 transition`}
          >
            {ready ? "🔊 " + tDict.soundEnabled : "🔊 " + tDict.enableSound}
          </button>

          <AnimatePresence mode="wait">
            {isRunning ? (
              <motion.button
                key="pause"
                onClick={handlePause}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white py-2.5 sm:py-3 font-semibold shadow active:scale-95 transition"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Pause className="w-5 h-5" /> {tDict.pause}
              </motion.button>
            ) : (
              <motion.button
                key="resume"
                onClick={handleResume}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 sm:py-3 font-semibold shadow active:scale-95 transition"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Play className="w-5 h-5" /> {tDict.resume}
              </motion.button>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <button
              onClick={handleStop}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white py-2.5 sm:py-3 font-semibold shadow active:scale-95 transition"
            >
              <StopCircle className="w-5 h-5" /> {tDict.stop}
            </button>
            <button
              onClick={() => sendLocalReminder()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white py-2.5 sm:py-3 font-semibold shadow active:scale-95 transition"
            >
              <Bell className="w-5 h-5" /> {tDict.sendLocalReminder}
            </button>
          </div>

          <button
            onClick={() => (window.location.href = "/map")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-sky-600 text-sky-700 py-2.5 sm:py-3 font-semibold hover:bg-sky-50 active:scale-95 transition"
          >
            <MapPin className="w-5 h-5" /> {tDict.findBathroom}
          </button>
        </section>

        <footer className="text-center py-2.5 sm:py-3 text-[10px] sm:text-[11px] text-gray-400 border-t border-gray-100">
          Built with 💧 PeePal • Fully Responsive
        </footer>
      </div>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            style={{
              paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-full max-w-sm rounded-2xl shadow-lg p-5 sm:p-6 relative border border-sky-100 max-h-[min(88dvh,30rem)] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
            >
              <button
                onClick={() => setShowSettings(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-lg font-semibold text-sky-700 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" /> {tDict.settings}
              </h2>

              {/* Language */}
              <div className="mb-4">
                <label
                  className="block text-sm font-medium text-gray-600 mb-1 cursor-pointer select-none hover:text-sky-600"
                  title="Click to switch language"
                  onClick={cycleLanguage}
                >
                  {tDict.language}
                </label>
                <select
                  value={language}
                  onChange={(e) => handleChangeLanguage(e.target.value as Lang)}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="zh">中文</option>
                </select>
              </div>

              {/* Frequency */}
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm font-medium text-gray-600 mb-2">{tDict.reminderFrequency}</label>
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
                <p className="text-xs text-gray-400 mt-1">{tDict.frequencyNote}</p>
              </div>

              {/* Test Notification */}
              <button
                onClick={handleTestNotification}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-700 py-2 mb-4 font-semibold shadow-sm active:scale-95 transition"
              >
                <Bell className="w-4 h-4" /> {tDict.testNotification}
              </button>

              {/* Done */}
              <button
                onClick={() => setShowSettings(false)}
                className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 shadow active:scale-95 transition"
              >
                {tDict.done}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ----------------------- WATER HELPERS ----------------------- */

// Layered bezier wave with density & phase drift for more “real” surface
function Wave({
  y,
  amp,
  speed,
  color,
  opacity = 1,
  dir = "left",
  blur = false,
  density = 5,
}: {
  y: MotionValue<number>;
  amp: number;
  speed: number;
  color: string;
  opacity?: number;
  dir?: "left" | "right";
  blur?: boolean;
  density?: number; // more points => smoother curve
}) {
  const t = useTicker();
  const phase = useTransform(t, (tt) => (tt / (dir === "left" ? 1400 : 1600)) % (Math.PI * 2));
  const d: MotionValue<string> = useTransform([y, phase], ([yy, ph]) => wavePath(0, yy as number, 100, amp, density, ph as number));
  return (
    <motion.path
      d={d}
      fill={color}
      opacity={opacity}
      filter={blur ? "url(#soft)" : undefined}
      animate={{ x: dir === "left" ? ["0%", "-100%"] : ["0%", "100%"] }}
      transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
    />
  );
}

// Thin foam crest stroke following the surface
function FoamCrest({ y, amp, speed, opacity = 0.6 }: { y: MotionValue<number>; amp: number; speed: number; opacity?: number }) {
  const t = useTicker();
  const phase = useTransform(t, (tt) => (tt / 1500) % (Math.PI * 2));
  const d: MotionValue<string> = useTransform([y, phase], ([yy, ph]) => waveTopPath(0, yy as number, 100, amp, ph as number));
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="white"
      strokeOpacity={opacity}
      strokeWidth="0.6"
      filter="url(#soft)"
      animate={{ x: ["0%", "-100%"] }}
      transition={{ duration: speed, repeat: Infinity, ease: "linear" }}
      style={{ mixBlendMode: "screen" as any }}
    />
  );
}

function Bubbles({ y, count = 10 }: { y: MotionValue<number>; count?: number }) {
  // Mirror the MotionValue<number> -> plain number for animate
  const [surf, setSurf] = useState<number>(80);
  useEffect(() => {
    const unsub = y.on("change", (v) => setSurf(v));
    setSurf(y.get()); // initialize
    return () => unsub?.();
  }, [y]);

  // Precompute bubble seeds (stable)
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: i,
        x: 12 + ((i * 997) % 76), // 12..88
        delay: (i * 0.37) % 2.2,
        dur: 2.8 + ((i * 131) % 100) / 100, // 2.8..3.8s
        r: 0.8 + ((i * 53) % 10) / 10, // 0.8..1.7
      })),
    [count]
  );

  return (
    <g>
      {seeds.map(({ key, x, delay, dur, r }) => (
        <motion.circle
          key={key}
          cx={x}
          cy={100}
          r={r}
          fill="white"
          fillOpacity={0.85}
          style={{ mixBlendMode: "screen" as any, filter: "url(#soft)" as any }}
          // Use plain numbers in animate, not MotionValues
          animate={{
            cy: [100, surf - 1], // rise to ~just under the surface
            opacity: [0, 0.9, 0], // fade in/out
            scale: [0.9, 1, 1.05],
          }}
          transition={{
            duration: dur,
            delay,
            repeat: Infinity,
            repeatType: "loop",
            ease: "easeOut",
          }}
        />
      ))}
    </g>
  );
}

/* ----------------------- PATH GENERATORS ----------------------- */

// Full closed wave fill beneath top line
function wavePath(x: number, y: number, w: number, a: number, density: number, phase: number) {
  const steps = Math.max(4, density) * 2; // even
  const dx = w / steps;
  let d = `M ${x - w} ${y}`;
  for (let i = -steps; i <= steps; i++) {
    const px = x + i * dx;
    const py = y + Math.sin((i / steps) * Math.PI * 2 + phase) * a * (i % 2 === 0 ? 1 : 0.85);
    // cubic curve handles (soften with small offset)
    const cx1 = px + dx * 0.3;
    const cy1 = py - a * 0.2;
    const cx2 = px + dx * 0.7;
    const cy2 = py + a * 0.2;
    const ex = px + dx;
    d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${y + Math.sin(((i + 1) / steps) * Math.PI * 2 + phase) * a}`;
  }
  d += ` L ${x + w} 100 L ${x - w} 100 Z`;
  return d;
}

// Thin top path for foam crest
function waveTopPath(x: number, y: number, w: number, a: number, phase: number) {
  const steps = 16;
  const dx = w / steps;
  let d = `M ${x - w} ${y}`;
  for (let i = -steps; i <= steps; i++) {
    const ex = x + i * dx;
    const ey = y + Math.sin((i / steps) * Math.PI * 2 + phase) * a;
    d += ` L ${ex} ${ey}`;
  }
  return d;
}
