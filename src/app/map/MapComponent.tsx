"use client";

import React from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";

export type Suggestion = {
  name: string;
  type: string;
  lat: number;
  lon: number;
  tips?: string;
};

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function FitBounds({
  points,
  userLocation,
}: {
  points: (Suggestion & { distance: number })[];
  userLocation: { lat: number; lng: number };
}) {
  const map = useMap();
  React.useEffect(() => {
    if (!points.length) return;
    const bounds: LatLngTuple[] = [
      [userLocation.lat, userLocation.lng],
      ...points.map((p) => [p.lat, p.lon] as LatLngTuple),
    ];
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, userLocation, map]);
  return null;
}

function usePointsWithDistance(
  userLocation: { lat: number; lng: number },
  suggestions: Suggestion[]
) {
  return React.useMemo(() => {
    const withDist = suggestions
      .map((s) => ({
        ...s,
        distance: getDistance(userLocation.lat, userLocation.lng, s.lat, s.lon),
      }))
      .sort((a, b) => a.distance - b.distance);
    return { list: withDist, nearest: withDist[0] };
  }, [suggestions, userLocation]);
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

/* ---------- Floating Map Controls ---------- */
function RecenterBtn({ userLocation }: { userLocation: { lat: number; lng: number } }) {
  const map = useMap();
  return (
    <button
      aria-label="Recenter map"
      onClick={() => map.flyTo([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })}
      className="rounded-full shadow-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 active:scale-[0.98] transition"
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor">
        <path strokeWidth="2" d="M12 8v8m-4-4h8" />
        <circle cx="12" cy="12" r="9" strokeWidth="2" />
      </svg>
    </button>
  );
}

function ZoomButtons() {
  const map = useMap();
  return (
    <div className="flex flex-col rounded-xl overflow-hidden shadow-lg border border-gray-200 bg-white">
      <button
        aria-label="Zoom in"
        onClick={() => map.zoomIn(1)}
        className="p-3 hover:bg-gray-50 active:scale-[0.98] transition"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor">
          <path strokeWidth="2" d="M12 8v8M8 12h8" />
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
        </svg>
      </button>
      <div className="h-px bg-gray-200" />
      <button
        aria-label="Zoom out"
        onClick={() => map.zoomOut(1)}
        className="p-3 hover:bg-gray-50 active:scale-[0.98] transition"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor">
          <path strokeWidth="2" d="M8 12h8" />
          <circle cx="12" cy="12" r="9" strokeWidth="2" />
        </svg>
      </button>
    </div>
  );
}

export default function MapScreen({
  userLocation,
  suggestions,
}: {
  userLocation: { lat: number; lng: number };
  suggestions: Suggestion[];
}) {
  const { list: pointsWithDistance, nearest } = usePointsWithDistance(userLocation, suggestions);

  const [showRadius, setShowRadius] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false); // start closed so the bottom CTA is always visible

  return (
    <div className="relative min-h-[100dvh] bg-gradient-to-b from-sky-100 via-white to-sky-50">
      {/* LAYOUT */}
      <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 md:gap-4">
        {/* Desktop sidebar */}
        <aside className="hidden md:block md:pl-4 md:pb-4">
          <div className="mt-4 rounded-2xl border border-sky-100 bg-white/80 backdrop-blur p-4 max-h-[calc(100dvh-110px)] overflow-y-auto shadow">
            <ListPanel pointsWithDistance={pointsWithDistance} nearest={nearest} />
          </div>
        </aside>

        {/* Map area */}
        <section className="relative">
          <div className="relative" style={{ height: "calc(100dvh - 64px)" }}>
            <MapContainer
              center={[userLocation.lat, userLocation.lng]}
              zoom={15}
              style={{ height: "100%", width: "100%" }}
              className="[&_.leaflet-control-zoom]:!hidden"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <FitBounds points={pointsWithDistance} userLocation={userLocation} />

              {/* You (blue dot) */}
              <CircleMarker
                center={[userLocation.lat, userLocation.lng]}
                radius={8}
                color="#2563eb"
                fillOpacity={0.9}
                eventHandlers={{
                  click: (e) => {
                    const map = e.target._map as ReturnType<typeof useMap> | any; // leaflet instance
                    if (map) {
                      map.flyTo([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 16), { duration: 0.5 });
                    }
                    // open the popup
                    // @ts-ignore - leaflet typing
                    e.target.openPopup?.();
                  },
                }}
              >
                <Popup>You are here</Popup>
              </CircleMarker>

              {/* Radius */}
              {showRadius && (
                <Circle
                  center={[userLocation.lat, userLocation.lng]}
                  radius={1500}
                  pathOptions={{ color: "#2563eb", fillOpacity: 0.04 }}
                />
              )}

              {/* Suggestions */}
              {pointsWithDistance.map((p, idx) => (
                <CircleMarker
                  key={`${p.name}-${idx}`}
                  center={[p.lat, p.lon]}
                  radius={p === nearest ? 10 : 7}
                  color={p === nearest ? "#ef4444" : "#16a34a"}
                  fillOpacity={0.9}
                >
                  <Popup>
                    <div style={{ minWidth: 220 }}>
                      <strong className="block">{p.name}</strong>
                      <div className="text-[12px] text-gray-600">{p.type}</div>
                      <div className="mt-2">{Math.round(p.distance)} meters away</div>
                      {p.tips && <div className="mt-2 text-[13px]">{p.tips}</div>}
                      <div className="mt-3 flex gap-2">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 underline text-sm"
                        >
                          Open in Google Maps
                        </a>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 underline text-sm"
                        >
                          Navigate
                        </a>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Floating controls (inside Map for access to map instance) */}
              <div className="absolute right-3 top-3 flex flex-col gap-2">
                <ZoomButtons />
                <RecenterBtn userLocation={userLocation} />
                <button
                  aria-label="Toggle search radius"
                  onClick={() => setShowRadius((v) => !v)}
                  className="rounded-full shadow-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 active:scale-[0.98] transition"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth="2" />
                    <circle cx="12" cy="12" r="4" strokeWidth="2" className={showRadius ? "opacity-100" : "opacity-30"} />
                  </svg>
                </button>
              </div>
            </MapContainer>
          </div>

          {/* --- Always-visible bottom-center CTA (mobile & desktop) --- */}
          <div
            className="fixed inset-x-0 bottom-3 z-30 flex justify-center md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <button
              onClick={() => setSheetOpen((v) => !v)}
              aria-expanded={sheetOpen}
              aria-controls="nearby-list-sheet"
              className="px-5 py-3 rounded-full bg-sky-600 text-white shadow-xl border border-sky-700/20 active:scale-[0.985] transition flex items-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor">
                <path strokeWidth="2" d="M4 8h16M4 12h16M4 16h16" />
              </svg>
              <span className="text-[15px] font-semibold">
                {sheetOpen ? "Hide List" : "Show List"}
              </span>
            </button>
          </div>

          {/* Mobile bottom sheet */}
          <div
            id="nearby-list-sheet"
            className={`md:hidden fixed inset-x-0 bottom-0 z-30 transition-transform duration-300 ${
              sheetOpen ? "translate-y-0" : "translate-y-[70%]"
            }`}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            role="dialog"
            aria-modal="true"
          >
            <div className="mx-auto max-w-6xl">
              <div className="mx-3 rounded-t-2xl border border-sky-100 bg-white/95 backdrop-blur shadow-2xl overflow-hidden">
                <div
                  className="flex items-center justify-center py-2 cursor-pointer"
                  onClick={() => setSheetOpen((v) => !v)}
                  aria-label="Toggle list"
                >
                  <span className="h-1.5 w-10 rounded-full bg-gray-300" />
                </div>
                <div className="px-4 pb-3">
                  <h2 className="text-sm font-semibold text-sky-700">Nearby Bathrooms</h2>
                </div>
                <div className="max-h-[48dvh] overflow-y-auto px-4 pb-4">
                  <ListPanel pointsWithDistance={pointsWithDistance} nearest={nearest} />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop show-list button (optional) */}
          <div className="hidden md:flex absolute inset-x-0 bottom-4 justify-center pointer-events-none">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="pointer-events-auto px-4 py-2 rounded-full bg-white border border-gray-200 shadow-md text-sm hover:bg-gray-50"
            >
              Top
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/** List panel used by both sidebar & bottom sheet */
function ListPanel({
  pointsWithDistance,
  nearest,
}: {
  pointsWithDistance: (Suggestion & { distance: number })[];
  nearest?: Suggestion & { distance: number };
}) {
  return (
    <div className="space-y-3">
      {pointsWithDistance.map((p, idx) => {
        const isNearest = nearest && p.name === nearest.name && p.lat === nearest.lat && p.lon === nearest.lon;
        return (
          <div
            key={`${p.name}-${idx}`}
            className={`rounded-xl border p-3 transition ${
              isNearest ? "border-rose-300 bg-rose-50/70" : "border-gray-200 bg-sky-50/60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="block text-sm">{p.name}</strong>
                <span className="text-xs text-gray-500">{p.type}</span>
                {p.tips && <div className="mt-1 text-xs text-gray-600 italic">{p.tips}</div>}
                <div className="mt-1 text-[13px] text-gray-700">{Math.round(p.distance)} meters away</div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[12px] font-medium hover:bg-gray-50"
                >
                  Open
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-sky-600 text-white px-3 py-1.5 text-[12px] font-semibold hover:bg-sky-700"
                >
                  Navigate
                </a>
              </div>
            </div>
          </div>
        );
      })}
      {!pointsWithDistance.length && <div className="text-sm text-gray-600">No places found nearby.</div>}
    </div>
  );
}
