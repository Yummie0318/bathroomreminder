"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

type Suggestion = {
  name: string;
  type: string;
  lat: number;
  lon: number;
  tips?: string;
};

type LatLng = { lat: number; lng: number };

// 🔧 Map props we expect (callbacks are optional so your MapComponent can ignore them safely)
type MapProps = {
  userLocation: LatLng;
  suggestions: Suggestion[];
  onReady?: () => void;
  onUserMarkerClick?: () => void;
};

/** Dynamic import with a typed props interface + bundle-loading fallback */
const LazyMap = dynamic<MapProps>(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="relative h-[50dvh] md:h-[65dvh]">
      <MapReadyOverlay visible label="Preparing map…" sublabel="Loading map engine" />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-100 to-white animate-pulse" />
    </div>
  ),
});

export default function MapPage() {
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);

  // NEW: map readiness state
  const [mapReady, setMapReady] = useState(false);
  const [mapWaitExceeded, setMapWaitExceeded] = useState(false);

  const showToast = useCallback((t: { type: "info" | "success" | "error"; message: string }) => {
    setToast(t);
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser.");
      showToast({ type: "error", message: "Location not supported" });
      return;
    }
    setErrorMsg(null);
    showToast({ type: "info", message: "Requesting location…" });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        showToast({ type: "success", message: "Location detected" });
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Please allow location access to use this feature."
            : "Unable to fetch your location. Try again.";
        setErrorMsg(msg);
        showToast({ type: "error", message: "Location blocked or unavailable" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  }, [showToast]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!userLocation) return;
      setLoading(true);
      // reset map readiness when we’re about to render
      setMapReady(false);
      setMapWaitExceeded(false);

      try {
        const res = await fetch(
          `/api/suggest_restrooms?lat=${userLocation.lat}&lon=${userLocation.lng}&radius=1500`
        );
        const data = await res.json();
        if (data?.suggestions?.length) {
          setSuggestions(data.suggestions);
        } else {
          setSuggestions([
            {
              name: "SM City Tuguegarao",
              type: "Shopping mall",
              lat: userLocation.lat + 0.002,
              lon: userLocation.lng + 0.003,
              tips: "Clean restrooms near the main atrium & food court.",
            },
            {
              name: "Vita Bella – Caritan Highway",
              type: "Coffee shop",
              lat: userLocation.lat + 0.0015,
              lon: userLocation.lng + 0.0025,
              tips: "Kindly ask staff to use the restroom.",
            },
            {
              name: "Starbucks SM City Tuguegarao",
              type: "Coffee shop",
              lat: userLocation.lat + 0.0022,
              lon: userLocation.lng + 0.0028,
              tips: "Alternative if mall restrooms are crowded.",
            },
          ]);
        }
      } catch (e) {
        console.error(e);
        setSuggestions([]);
        showToast({ type: "error", message: "Failed to load nearby places" });
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestions();
  }, [userLocation, showToast]);

  // Patience timer while waiting for the map "load"
  useEffect(() => {
    if (!userLocation || loading || !suggestions?.length) return;
    setMapWaitExceeded(false);
    const t = setTimeout(() => setMapWaitExceeded(true), 8000);
    return () => clearTimeout(t);
  }, [userLocation, loading, suggestions]);

  return (
    <div className="relative min-h-[100dvh] bg-gradient-to-b from-sky-100 via-white to-sky-50">
      <Header />
      <main className="relative">
        <div className="mx-auto max-w-6xl">
          {/* States */}
          {errorMsg && (
            <StateCard
              type="warning"
              title="Location Needed"
              message={errorMsg}
              actionLabel="Try Again"
              onAction={requestLocation}
            />
          )}

          {!errorMsg && !userLocation && <SkeletonDetecting />}

          {userLocation && loading && <SkeletonLoading />}

          {userLocation && !loading && suggestions && suggestions.length === 0 && (
            <StateCard
              type="info"
              title="No Restrooms Found"
              message="We couldn’t find nearby restrooms within your radius. Try moving the map or expanding your search."
              actionLabel="Retry"
              onAction={() => {
                setSuggestions(null);
                setTimeout(() => {
                  setSuggestions([]);
                  window.location.reload();
                }, 0);
              }}
            />
          )}

          {userLocation && !loading && suggestions && suggestions.length > 0 && (
            <section className="relative h-[calc(100dvh-64px)]">
              <LazyMap
                userLocation={userLocation}
                suggestions={suggestions}
                onReady={() => setMapReady(true)}
                onUserMarkerClick={() => {
                  showToast({ type: "info", message: "You are here" });
                }}
              />
              <MapReadyOverlay
                visible={!mapReady}
                label={mapWaitExceeded ? "Still preparing map…" : "Loading map…"}
                sublabel={
                  mapWaitExceeded
                    ? "This is taking longer than usual. Check your connection or try zooming in."
                    : "Fetching tiles & initializing layers"
                }
              />
            </section>
          )}
        </div>
      </main>

      {/* Toast */}
      <div className="pointer-events-none fixed inset-x-0 top-3 flex justify-center px-4 z-50">
        {toast && (
          <div
            className={[
              "pointer-events-auto max-w-md w-full rounded-xl shadow-lg px-4 py-3 text-sm border",
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : toast.type === "error"
                ? "bg-rose-50 text-rose-900 border-rose-200"
                : "bg-sky-50 text-sky-900 border-sky-200",
            ].join(" ")}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- HEADER ---------------- */
function Header() {
  return (
    <header
      className="sticky top-0 z-30 px-4 pt-[max(10px,env(safe-area-inset-top))] pb-3 bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-sm"
      role="banner"
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        <BackButton />
        <div className="text-center">
          <h1 className="text-base font-semibold leading-tight">Nearby Bathrooms</h1>
          <p className="text-[11px] opacity-90">Private • Uses your location</p>
        </div>
        <div className="w-[84px]" aria-hidden />
      </div>
    </header>
  );
}

function BackButton() {
  const router = useRouter();
  const onBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    const fallback =
      typeof window !== "undefined" && window.location.host.includes("localhost")
        ? "http://localhost:3000/"
        : "/";
    window.location.href = fallback;
  }, [router]);

  return (
    <button
      onClick={onBack}
      aria-label="Go back"
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white/20 text-white border border-white/30 hover:bg-white/30 active:scale-[0.98] transition"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      <span className="text-sm font-medium">Back</span>
    </button>
  );
}

/* ---------------- STATES ---------------- */
function StateCard({
  type,
  title,
  message,
  actionLabel,
  onAction,
}: {
  type: "warning" | "info" | "error";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const palette =
    type === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-sky-200 bg-sky-50 text-sky-900";

  return (
    <div className="px-4 mt-3">
      <div className={`rounded-2xl border ${palette} shadow-sm`}>
        <div className="p-4">
          <p className="font-semibold text-sm">{title}</p>
          <p className="mt-1 text-sm opacity-90">{message}</p>
          {actionLabel && onAction && (
            <div className="mt-3">
              <button
                onClick={onAction}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-3 py-2 text-sm font-semibold hover:bg-sky-700"
              >
                {actionLabel}
              </button>
            </div>
          )}
          {type === "warning" && (
            <p className="mt-2 text-xs opacity-70">
              Tip: If you denied access, go to your browser’s site settings and enable location.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- SKELETONS ---------------- */
function SkeletonDetecting() {
  return (
    <div className="px-4 mt-4">
      <div className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur p-4 shadow">
        <p className="text-sm text-gray-700">Detecting your location…</p>
        <div className="mt-3 h-3 w-36 rounded bg-sky-100 animate-pulse" />
      </div>
      <div className="mt-4 h-[50dvh] rounded-2xl bg-gradient-to-br from-sky-100 to-white animate-pulse" />
    </div>
  );
}

function SkeletonLoading() {
  return (
    <div className="px-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <div className="hidden md:block">
          <div className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur p-4 shadow">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-sky-50/60 p-3">
                  <div className="h-3 w-40 bg-gray-200 rounded animate-pulse" />
                  <div className="mt-2 h-3 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="mt-2 h-3 w-28 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div>
          <div className="h-[50dvh] md:h-[65dvh] rounded-2xl bg-gradient-to-br from-sky-100 to-white animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- MAP OVERLAY LOADER ---------------- */
function MapReadyOverlay({
  visible,
  label = "Loading map…",
  sublabel,
}: {
  visible: boolean;
  label?: string;
  sublabel?: string;
}) {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div className="pointer-events-auto rounded-2xl border border-sky-200 bg-white/90 backdrop-blur p-5 shadow-lg flex items-center gap-4">
        <Spinner className="w-6 h-6" />
        <div>
          <p className="text-sm font-semibold text-sky-900">{label}</p>
          {sublabel && <p className="text-xs text-sky-700/80 mt-0.5">{sublabel}</p>}
        </div>
      </div>
    </div>
  );
}

function Spinner({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className} text-sky-600`} viewBox="0 0 24 24" role="img" aria-label="Loading">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
