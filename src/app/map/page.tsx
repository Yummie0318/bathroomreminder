"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  LocateFixed,
  RefreshCcw,
  Navigation,
  ChevronRight,
  AlertCircle,
  ShieldQuestion,
  ArrowLeft,
} from "lucide-react";

const MapComponent = dynamic(() => import("./MapComponent"), { ssr: false });

type LatLng = { lat: number; lng: number };
type Suggestion = { name: string; type: string; lat: number; lon: number; tips?: string };

const DEFAULT_RADIUS = 1500;

/* ---------- COPY (EN/DE/ZH) ---------- */
const copy = {
  en: {
    title: "Find Nearest Bathroom",
    usingLocation: "Using your current location",
    locationRequired: "Location permission is required.",
    detecting: "Detecting…",
    refresh: "Refresh",
    refreshLocation: "Refresh location",
    gettingLocation: "Getting your location…",
    preparingMap: "Preparing map…",
    nearby: "Nearby restrooms",
    searching: "• searching…",
    none: "• none",
    distanceAway: "away",
    openInMaps: "Open in Maps",
    details: "Details",
    empty: "No nearby restrooms found within 1.5 km. Try refreshing.",
    back: "Back",
    recenter: "Recenter",
    allowRetry: "Allow & Retry",
    locationNeeded: "Location needed",
    howToEnable: "How to enable",
    geoErrorGeneric: "Unable to get your location right now.",
  },
  de: {
    title: "Nächstes Badezimmer finden",
    usingLocation: "Verwendet Ihren aktuellen Standort",
    locationRequired: "Standortberechtigung ist erforderlich.",
    detecting: "Ermittle…",
    refresh: "Aktualisieren",
    refreshLocation: "Standort aktualisieren",
    gettingLocation: "Standort wird ermittelt…",
    preparingMap: "Karte wird vorbereitet…",
    nearby: "Toiletten in der Nähe",
    searching: "• suche…",
    none: "• keine",
    distanceAway: "entfernt",
    openInMaps: "In Karten öffnen",
    details: "Details",
    empty: "Keine Toiletten im Umkreis von 1,5 km gefunden. Bitte aktualisieren.",
    back: "Zurück",
    recenter: "Zentrieren",
    allowRetry: "Erlauben & erneut versuchen",
    locationNeeded: "Standort benötigt",
    howToEnable: "So aktivieren",
    geoErrorGeneric: "Ihr Standort kann derzeit nicht ermittelt werden.",
  },
  zh: {
    title: "寻找最近的洗手间",
    usingLocation: "正在使用您的当前位置",
    locationRequired: "需要定位权限。",
    detecting: "正在检测…",
    refresh: "刷新",
    refreshLocation: "刷新位置",
    gettingLocation: "正在获取您的位置…",
    preparingMap: "正在准备地图…",
    nearby: "附近洗手间",
    searching: "• 搜索中…",
    none: "• 无",
    distanceAway: "距离",
    openInMaps: "在地图中打开",
    details: "详情",
    empty: "在 1.5 公里范围内未找到洗手间，请尝试刷新。",
    back: "返回",
    recenter: "回到当前位置",
    allowRetry: "允许并重试",
    locationNeeded: "需要定位",
    howToEnable: "如何开启",
    geoErrorGeneric: "暂时无法获取您的位置。",
  },
} as const;
type Lang = keyof typeof copy;

/* ---------- TYPE LOCALIZATION (lowercased keys) ---------- */
const typeMapLower = {
  "public restroom": { en: "Public restroom", de: "Öffentliche Toilette", zh: "公共洗手间" },
  "shopping mall": { en: "Shopping mall", de: "Einkaufszentrum", zh: "购物中心" },
  "coffee shop": { en: "Coffee shop", de: "Café", zh: "咖啡店" },
  restaurant: { en: "Restaurant", de: "Restaurant", zh: "餐厅" },
  park: { en: "Park", de: "Park", zh: "公园" },
  "gas station": { en: "Gas station", de: "Tankstelle", zh: "加油站" },
  "convenience store": { en: "Convenience store", de: "Spätkauf", zh: "便利店" },
  hotel: { en: "Hotel", de: "Hotel", zh: "酒店" },
  place: { en: "Place", de: "Ort", zh: "地点" },
  "fast food": { en: "Fast food", de: "Schnellimbiss", zh: "快餐" },
  "fast food restaurant": { en: "Fast food restaurant", de: "Schnellrestaurant", zh: "快餐店" },
} as const;

function localizeType(type: string | undefined, lang: Lang) {
  if (!type) return "";
  const key = type.trim().toLowerCase();
  const entry = (typeMapLower as any)[key];
  return entry?.[lang] ?? type;
}

function haversine(a: LatLng, b: LatLng) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(s1), Math.sqrt(1 - s1));
  return R * c;
}
function formatDistance(meters: number, _lang: Lang) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
function openInMaps(lat: number, lon: number, name?: string) {
  const q = encodeURIComponent(name ?? `${lat},${lon}`);
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&query_place_id=${q}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function MapPage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = copy[lang];

  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const gotFirstFix = useRef(false);

  // read language saved by Dashboard
  useEffect(() => {
    const saved = (localStorage.getItem("peePalLang") as Lang | null) || "en";
    setLang(saved);
  }, []);

  // Acquire Location
  const getLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg(t.locationRequired);
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setErrorMsg(null);
        setGeoLoading(false);
        gotFirstFix.current = true;
      },
      (err) => {
        setErrorMsg(
          err.code === err.PERMISSION_DENIED ? t.locationRequired : t.geoErrorGeneric
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 2000 }
    );
  };

  useEffect(() => {
    getLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Fetch Suggestions when we have a location (pass lang to API)
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!userLocation) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/suggest_restrooms?lat=${userLocation.lat}&lon=${userLocation.lng}&radius=${DEFAULT_RADIUS}&lang=${lang}`
        );
        const data = await res.json();

        if (data?.suggestions?.length) {
          const normalized: Suggestion[] = data.suggestions.map((s: any) => ({
            name: s.name,
            type: s.type ?? "place",
            lat: Number(s.lat),
            lon: Number(s.lon),
            tips: s.tips,
          }));
          setSuggestions(normalized);
        } else {
          // Local demo fallback + localized tips; types also localized via badge renderer
          setSuggestions([
            {
              name: "SM City Tuguegarao",
              type: "shopping mall",
              lat: userLocation.lat + 0.002,
              lon: userLocation.lng + 0.003,
              tips:
                lang === "de"
                  ? "Saubere öffentliche Toiletten – in der Haupthalle oder im Food-Court."
                  : lang === "zh"
                  ? "干净的公共洗手间——在中庭或美食广场附近。"
                  : "Clean public restrooms—look near the main atrium or food court.",
            },
            {
              name: "Vita Bella – Caritan Highway",
              type: "coffee shop",
              lat: userLocation.lat + 0.0015,
              lon: userLocation.lng + 0.0025,
              tips:
                lang === "de"
                  ? "Freundlich fragen, ob Sie die Toilette benutzen dürfen."
                  : lang === "zh"
                  ? "礼貌询问店员可否使用洗手间。"
                  : "Kindly ask staff to use the restroom.",
            },
            {
              name: "Starbucks SM City Tuguegarao",
              type: "coffee shop",
              lat: userLocation.lat + 0.0022,
              lon: userLocation.lng + 0.0028,
              tips:
                lang === "de"
                  ? "Gute Alternative, wenn es im Einkaufszentrum voll ist."
                  : lang === "zh"
                  ? "如果商场洗手间拥挤，这是不错的备选。"
                  : "Good alternative if the mall restrooms are crowded.",
            },
          ]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestions();
  }, [userLocation, lang]);

  const withDistance = useMemo(() => {
    if (!userLocation || !suggestions) return [] as Array<Suggestion & { distance: number }>;
    return suggestions
      .map((s) => ({
        ...s,
        distance: haversine(userLocation, { lat: s.lat, lng: s.lon }),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [userLocation, suggestions]);

  /* ---------- HEADER ---------- */
  const Header = (
    <header className="sticky top-0 z-40">
      <div className="mx-auto max-w-5xl px-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="relative flex items-center justify-between rounded-2xl border border-sky-100/60 bg-white/80 backdrop-blur-md shadow-sm px-2 py-2">
          {/* Left: Back */}
          <div className="flex items-center">
            <button
              onClick={() => window.location.assign("https://bathroomreminder.vercel.app/")}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-50 active:scale-[0.98]"
              aria-label={t.back}
              title={t.back}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t.back}</span>
            </button>
          </div>

          {/* Center: Title */}
          <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-center">
            <div className="inline-flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white shadow">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="text-left">
                <h1 className="text-base sm:text-lg font-bold leading-tight text-sky-900">
                  {t.title}
                </h1>
                <p className="text-[11px] sm:text-xs text-sky-700/70 -mt-0.5">
                  {userLocation ? t.usingLocation : errorMsg ? t.locationRequired : t.detecting}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Refresh */}
          <div className="flex items-center">
            <button
              onClick={getLocation}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-white hover:bg-sky-50 active:scale-[0.98] text-sky-800"
              aria-label={t.refreshLocation}
              title={t.refreshLocation}
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );

  if (errorMsg && !userLocation) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-sky-50">
        {Header}
        <div className="mx-auto max-w-2xl p-4">
          <motion.div
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-semibold">{t.locationNeeded}</p>
                <p className="text-sm opacity-90">{t.locationRequired}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={getLocation}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 active:scale-95 transition"
                  >
                    <ShieldQuestion className="h-4 w-4" />
                    {t.allowRetry}
                  </button>
                  <button
                    onClick={() =>
                      window.open("https://support.google.com/chrome/answer/142065", "_blank")
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 active:scale-95 transition"
                  >
                    {t.howToEnable}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  return (
    <main className="h-[100dvh] w-full bg-gradient-to-b from-sky-100 via-white to-sky-50">
      {Header}

      <div className="mx-auto max-w-5xl grid grid-rows-1 lg:grid-cols-[1.6fr_1fr] gap-4 p-4">
        {/* Map area */}
        <motion.div
          layout
          className="relative h:[55vh] lg:h-[calc(100dvh-150px)] rounded-3xl overflow-hidden border border-sky-100 shadow-md bg-white"
          style={{ height: "55vh" }}
        >
          {userLocation ? (
            <MapComponent
              userLocation={userLocation}
              suggestions={withDistance.map(({ distance, ...s }) => s)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-sky-800/80 text-sm">
                {geoLoading ? t.gettingLocation : t.preparingMap}
              </div>
            </div>
          )}

          {/* Recenter FAB */}
          <button
            onClick={getLocation}
            className="absolute bottom-4 right-4 inline-flex items-center justify-center rounded-full bg-white shadow-lg border border-sky-200 h-12 w-12 hover:bg-sky-50 active:scale-95 transition"
            aria-label={t.recenter}
            title={t.recenter}
          >
            <LocateFixed className="h-5 w-5 text-sky-700" />
          </button>
        </motion.div>

        {/* List / Details */}
        <section className="h-[55vh] lg:h-[calc(100dvh-150px)] overflow-hidden rounded-3xl bg-white border border-sky-100 shadow-md">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm text-sky-900">
              {t.nearby}{" "}
              <span className="text-sky-700/60">
                {loading ? t.searching : withDistance.length ? `• ${withDistance.length}` : t.none}
              </span>
            </div>
          </div>

          <div className="h-[calc(100%-44px)] overflow-y-auto p-3">
            {/* Loading skeletons */}
            <AnimatePresence>
              {loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-sky-100 p-4 bg-gradient-to-br from-white to-sky-50">
                      <div className="h-4 w-3/5 rounded bg-sky-100 animate-pulse" />
                      <div className="mt-2 h-3 w-2/5 rounded bg-sky-100 animate-pulse" />
                      <div className="mt-3 h-3 w-4/5 rounded bg-sky-100 animate-pulse" />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {!loading && withDistance.length === 0 && (
              <div className="p-6 text-center text-sky-800/70">{t.empty}</div>
            )}

            {/* Results */}
            <AnimatePresence mode="popLayout">
              {!loading &&
                withDistance.map((s, idx) => (
                  <motion.div
                    key={`${s.name}-${idx}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="group mb-3 rounded-2xl border border-sky-100 bg-white p-4 hover:shadow-md hover:border-sky-200 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sky-900">{s.name}</h3>
                          {s.type && (
                            <span className="rounded-full border border-sky-200 bg-sky-50 text-sky-700 text-[10px] px-2 py-0.5 font-semibold">
                              {localizeType(s.type, lang)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-sky-700/70 mt-0.5">
                          {formatDistance(s.distance, lang)} {t.distanceAway}
                        </div>
                        {s.tips && (
                          <p className="text-[12px] text-gray-600 mt-2 leading-relaxed">{s.tips}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <button
                          onClick={() => openInMaps(s.lat, s.lon, s.name)}
                          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 active:scale-95 transition"
                        >
                          <Navigation className="h-4 w-4" />
                          {t.openInMaps}
                        </button>
                        <a
                          href={`#${s.name.replace(/\s+/g, "-")}`}
                          className="opacity-0 group-hover:opacity-100 text-sky-700/70 hover:text-sky-800 transition text-xs inline-flex items-center gap-1"
                        >
                          {t.details} <ChevronRight className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </main>
  );
}
