"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Droplet,
  Bell,
  MapPin,
  Info,
  AlertTriangle,
  Globe,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";


/* ---------------------- LANGUAGE TEXTS ---------------------- */
const translations = {
  en: {
    title: "PeePal",
    subtitle: "Your Smart Bathroom Reminder",
    description:
      "Stay comfortable and hydrated — we'll remind you when it's time to go.",
    freqLabel: "Reminder Frequency",
    changeNote: "You can change this anytime.",
    save: "Save",
    saving: "Saving…",
    start: "Start Reminders",
    find: "Find Nearest Bathroom",
    deniedTitle: "Notifications Disabled",
    deniedMsg: "Please enable browser notifications to receive reminders.",
    private: "Private · No data stored",
    toastSaved: (n: number) =>
      `Reminder set to every ${n === 0.25 ? "15 seconds (test)" : `${n} minutes`}`,
    toastDenied: "Reminders won’t work unless you enable notifications.",
    toastInfo: "Please allow notifications to receive reminders.",
    toastGranted: "Notifications enabled! Redirecting to dashboard…",
    toastInstall:
      "To enable reminders on iPhone, tap ‘Share → Add to Home Screen’ and open PeePal from there.",
    built: "Built with 💧 PeePal • Fully Responsive",
    waterHint: "Higher interval → fuller tank",
    every: "Every",
    seconds: "sec (test)",
    minutes: "min",
  },
  de: {
    title: "PeePal",
    subtitle: "Deine intelligente Toilettenerinnerung",
    description:
      "Bleib entspannt und hydratisiert — wir erinnern dich, wenn es Zeit ist zu gehen.",
    freqLabel: "Erinnerungsfrequenz",
    changeNote: "Du kannst dies jederzeit ändern.",
    save: "Speichern",
    saving: "Speichern…",
    start: "Erinnerungen starten",
    find: "Nächstes Badezimmer finden",
    deniedTitle: "Benachrichtigungen deaktiviert",
    deniedMsg:
      "Bitte aktiviere Benachrichtigungen, um Erinnerungen zu erhalten.",
    private: "Privat · Keine Daten gespeichert",
    toastSaved: (n: number) =>
      `Erinnerung alle ${n === 0.25 ? "15 Sekunden (Test)" : `${n} Minuten`} eingestellt`,
    toastDenied:
      "Erinnerungen funktionieren nur mit aktivierten Benachrichtigungen.",
    toastInfo:
      "Bitte erlaube Benachrichtigungen, um Erinnerungen zu erhalten.",
    toastGranted: "Benachrichtigungen aktiviert! Weiterleitung zum Dashboard…",
    toastInstall:
      "Um Erinnerungen auf dem iPhone zu aktivieren, tippe auf ‘Teilen → Zum Home-Bildschirm hinzufügen’.",
    built: "Erstellt mit 💧 PeePal • Vollständig responsiv",
    waterHint: "Längeres Intervall → vollerer Tank",
    every: "Alle",
    seconds: "Sek. (Test)",
    minutes: "Min.",
  },
  zh: {
    title: "PeePal",
    subtitle: "您的智能如厕提醒",
    description: "保持舒适与健康——到时间我们会提醒您去洗手间。",
    freqLabel: "提醒频率",
    changeNote: "您可以随时更改此设置。",
    save: "保存",
    saving: "保存中…",
    start: "开始提醒",
    find: "寻找最近的洗手间",
    deniedTitle: "通知已被禁用",
    deniedMsg: "请启用浏览器通知以接收提醒。",
    private: "隐私保护 · 不存储任何数据",
    toastSaved: (n: number) =>
      `提醒已设置为每 ${n === 0.25 ? "15 秒（测试）" : `${n} 分钟`} 一次`,
    toastDenied: "提醒功能需要启用通知权限。",
    toastInfo: "请允许通知以接收提醒。",
    toastGranted: "通知已启用！正在跳转到仪表板…",
    toastInstall: "要在 iPhone 上启用提醒，请点击“分享 → 添加到主屏幕”。",
    built: "由 💧 PeePal 构建 • 完全响应式设计",
    waterHint: "间隔越长 → 水箱越满",
    every: "每",
    seconds: "秒（测试）",
    minutes: "分钟",
  },
} as const;

/* ---------------------- MAIN COMPONENT ---------------------- */
export default function PeePalCard() {
  const router = useRouter();
  const [frequency, setFrequency] = useState(60);
  const [savedFrequency, setSavedFrequency] = useState(60);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [language, setLanguage] = useState<"en" | "de" | "zh">("en");

  const t = translations[language];
  const isDirty = useMemo(
    () => frequency !== savedFrequency,
    [frequency, savedFrequency]
  );

  /* ---------------------- LOAD SETTINGS ---------------------- */
  useEffect(() => {
    const storedFreq = localStorage.getItem("peePalFrequency");
    const storedPerm = localStorage.getItem("peePalNotificationPermission");
    const storedLang = localStorage.getItem("peePalLang") as
      | "en"
      | "de"
      | "zh"
      | null;

    if (storedLang) setLanguage(storedLang);
    if (storedFreq) {
      const f = Number(storedFreq);
      if (!Number.isNaN(f)) {
        setFrequency(f);
        setSavedFrequency(f);
      }
    }

    if (storedPerm === "granted") window.location.href = "/dashboard";
    else if (storedPerm === "denied") setDenied(true);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("[SW] Registration failed:", err));
    }
  }, []);

  /* ---------------------- SAVE FREQUENCY ---------------------- */
  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => {
      setSavedFrequency(frequency);
      localStorage.setItem("peePalFrequency", String(frequency));
      setToast({ type: "success", message: t.toastSaved(frequency) });
      setSaving(false);
      setTimeout(() => setToast(null), 2500);
    }, 500);
  };

  /* ---------------------- START REMINDERS ---------------------- */
  const handleStart = async () => {
    const isInstalledPWA =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (!isInstalledPWA && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      setToast({ type: "info", message: t.toastInstall });
      return;
    }

    const permission = await Notification.requestPermission();
    localStorage.setItem("peePalNotificationPermission", permission);

    if (permission === "granted") {
      setToast({ type: "success", message: t.toastGranted });
      setTimeout(() => (window.location.href = "/dashboard"), 1500);
    } else if (permission === "denied") {
      setDenied(true);
      setToast({ type: "error", message: t.toastDenied });
    } else {
      setToast({ type: "info", message: t.toastInfo });
    }
  };

  return (
    <main
      className="
        h-[100dvh] w-full overflow-hidden
        bg-gradient-to-b from-sky-100 via-white to-sky-50
        flex items-center justify-center
        px-3 sm:px-4 py-3 sm:py-6
      "
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)",
        paddingLeft: "calc(env(safe-area-inset-left) + 0.75rem)",
        paddingRight: "calc(env(safe-area-inset-right) + 0.75rem)",
      }}
    >
      {/* CARD: compact vertical grid — no page scroll */}
      <div
        className="
          w-full max-w-md
          h-full sm:h-[min(42rem,92dvh)]
          grid
          grid-rows-[auto_auto_1fr_auto]
          rounded-3xl shadow-xl
          bg-white/85 backdrop-blur-xl
          border border-sky-100
          overflow-hidden
        "
      >
        {/* HEADER (tighter) */}
        <header className="relative bg-gradient-to-r from-sky-500 to-sky-600 text-white px-6 pt-6 pb-4 text-center">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <WaveDecoration />
          </div>

          {/* Language selector */}
          <div className="absolute top-2.5 right-4 z-20">
            <div className="bg-white/20 backdrop-blur-md rounded-full px-3 py-1 flex items-center gap-2 border border-white/30">
              <Globe className="w-4 h-4 text-white/90" />
              <select
                value={language}
                onChange={(e) => {
                  const lang = e.target.value as "en" | "de" | "zh";
                  setLanguage(lang);
                  localStorage.setItem("peePalLang", lang);
                }}
                className="bg-transparent text-white text-[11px] md:text-sm font-medium focus:outline-none cursor-pointer appearance-none"
              >
                <option className="text-black" value="en">🇬🇧 English</option>
                <option className="text-black" value="de">🇩🇪 Deutsch</option>
                <option className="text-black" value="zh">🇨🇳 中文</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-white/80" />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shadow-md">
              <Droplet className="w-6 h-6" />
            </div>
            <h1 className="mt-2 text-xl font-bold leading-tight">{t.title}</h1>
            <p className="mt-0.5 text-[11px] text-white/90">{t.subtitle}</p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-[2px] text-[10px]">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {t.private}
            </div>
          </div>
        </header>

        {/* Description (small) */}
        <div className="px-5 pt-2 text-center">
          <p className="text-gray-600 text-[12.5px] leading-snug">
            {t.description}
          </p>
        </div>

        {/* BODY — **Waterline moved here** under buttons; tighter spacing */}
        <section className="px-5 py-3 flex flex-col">
          {/* Frequency */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {t.freqLabel}
            </label>
            <div className="flex gap-2">
              <select
                value={frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                className="flex-1 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-sky-400"
              >
                {[0.25, 15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {t.every} {m === 0.25 ? `15 ${t.seconds}` : `${m} ${t.minutes}`}
                  </option>
                ))}
              </select>

              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="rounded-xl bg-sky-50 border border-sky-300 text-sky-700 px-4 py-2.5 text-sm font-medium hover:bg-sky-100 disabled:opacity-50"
              >
                {saving ? t.saving : t.save}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 flex items-center gap-1">
              <Info className="w-3 h-3" />
              {t.changeNote}
            </p>
          </div>

          {/* Buttons */}
          <div className="mt-3 grid grid-cols-1 gap-2.5">
            <button
              onClick={handleStart}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white py-3 font-semibold active:scale-95 transition"
            >
              <Bell className="w-5 h-5" /> {t.start}
            </button>
            <button
              onClick={() => router.push("/map")}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-600 text-sky-700 py-3 font-semibold hover:bg-sky-50 active:scale-95 transition"
            >
              <MapPin className="w-5 h-5" /> {t.find}
            </button>

          </div>

          {denied && (
            <div className="mt-2.5 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> {t.deniedTitle}
              </p>
              <p>{t.deniedMsg}</p>
            </div>
          )}

          {/* Waterline now sits RIGHT under the buttons */}
          <div className="mt-3">
            <Waterline frequency={frequency} hint={t.waterHint} />
          </div>
        </section>

        {/* FOOTER (tighter) */}
        <footer className="text-center py-2.5 text-[11px] text-gray-400 border-t border-gray-100">
          {t.built}
        </footer>
      </div>

      {/* Toast */}
      <div className="pointer-events-none fixed inset-x-0 top-4 flex justify-center px-4 z-50">
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`pointer-events-auto max-w-md w-full rounded-xl shadow-lg px-4 py-3 text-sm border ${
                toast.type === "success"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : toast.type === "error"
                  ? "bg-rose-50 text-rose-900 border-rose-200"
                  : "bg-sky-50 text-sky-900 border-sky-200"
              }`}
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/* ---------------------- WATERLINE ---------------------- */
function Waterline({
  frequency = 60,
  hint,
}: {
  frequency?: number;
  hint: string;
}) {
  // map frequency to height (px of the 84–92px tank)
  const waterLevels: Record<number, number> = {
    30: 30,
    45: 45,
    60: 60,
    90: 75,
    120: 88,
  };
  const defined = Object.keys(waterLevels).map(Number);
  const closest = defined.reduce((p, c) =>
    Math.abs(c - frequency) < Math.abs(p - frequency) ? c : p
  );
  const targetHeight = waterLevels[closest] ?? 60;

  return (
    <div className="relative w-full h-[86px] rounded-2xl overflow-hidden border border-sky-100 bg-gradient-to-b from-sky-50 to-white">
      {/* water container */}
      <motion.div
        initial={{ y: 86 }}
        animate={{ y: 86 - targetHeight }}
        transition={{ type: "spring", stiffness: 70, damping: 12 }}
        className="absolute bottom-0 left-0 right-0"
      >
        {/* Two counter-moving waves + highlight for a more “real” look */}
        <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="w-full">
          <defs>
            <linearGradient id="wlA" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="wlB" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="gloss" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.45" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
          </defs>

          {/* back wave */}
          <motion.path
            fill="url(#wlA)"
            d="M0,70 C120,45 240,90 360,65 C420,60 480,80 600,70 L600,120 L0,120 Z"
            animate={{
              d: [
                "M0,70 C120,45 240,90 360,65 C420,60 480,80 600,70 L600,120 L0,120 Z",
                "M0,72 C120,50 240,95 360,70 C420,62 480,85 600,72 L600,120 L0,120 Z",
              ],
            }}
            transition={{
              duration: 4.2,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "mirror",
            }}
          />

          {/* front wave */}
          <motion.path
            fill="url(#wlB)"
            d="M0,66 C120,38 240,86 360,60 C420,56 480,76 600,66 L600,120 L0,120 Z"
            animate={{
              d: [
                "M0,66 C120,38 240,86 360,60 C420,56 480,76 600,66 L600,120 L0,120 Z",
                "M0,64 C120,36 240,84 360,58 C420,54 480,74 600,64 L600,120 L0,120 Z",
              ],
            }}
            transition={{
              duration: 3.2,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "mirror",
            }}
            style={{ filter: "url(#soft)" }}
          />

          {/* surface gloss */}
          <motion.rect
            x="0"
            y="0"
            width="600"
            height="16"
            fill="url(#gloss)"
            opacity={0.5}
            animate={{ opacity: [0.35, 0.6, 0.35] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      </motion.div>

      {/* hint */}
      <div className="absolute inset-0 flex items-end justify-center pb-0.5">
        <div className="text-[10.5px] text-gray-500 select-none">{hint}</div>
      </div>
    </div>
  );
}

/* ---------------------- DECORATION ---------------------- */
function WaveDecoration() {
  return (
    <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor="white" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d="M0,120 C120,180 240,60 360,110 C420,135 480,165 600,120 L600,0 L0,0 Z"
        fill="url(#g)"
      />
    </svg>
  );
}
