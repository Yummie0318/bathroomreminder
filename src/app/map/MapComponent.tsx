"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import type { Map as LeafletMap, LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation } from "lucide-react";

export type Suggestion = {
  name: string;
  type: string;
  lat: number;
  lon: number;
  tips?: string;
};

type LatLng = { lat: number; lng: number };

/* ---------- i18n ---------- */
type Lang = "en" | "de" | "zh";
const copy: Record<Lang, any> = {
  en: {
    youHere: "You are here",
    nearest: "Nearest",
    away: "away",
    nav: "Navigate",
    navNearest: "Navigate to Nearest",
    ariaNearest: "Navigate to nearest restroom",
  },
  de: {
    youHere: "Sie sind hier",
    nearest: "Nächstgelegen",
    away: "entfernt",
    nav: "Navigieren",
    navNearest: "Zur nächsten Toilette navigieren",
    ariaNearest: "Zur nächsten Toilette navigieren",
  },
  zh: {
    youHere: "您在这里",
    nearest: "最近",
    away: "距离",
    nav: "开始导航",
    navNearest: "导航到最近的洗手间",
    ariaNearest: "导航到最近的洗手间",
  },
};

/* localized distance */
function formatDistance(m: number, lang: Lang) {
  if (lang === "zh") {
    if (m < 1000) return `${Math.round(m)} 米`;
    return `${(m / 1000).toFixed(1)} 公里`;
  }
  // en + de share m/km formatting
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

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
  padding = [24, 24],
}: {
  points: Array<LatLngTuple>;
  userLocation: LatLng;
  padding?: [number, number];
}) {
  const map = useMap();
  useEffect(() => {
    const bounds: LatLngTuple[] = [
      [userLocation.lat, userLocation.lng],
      ...points,
    ];
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding });
      const id = setTimeout(() => map.invalidateSize(), 200);
      return () => clearTimeout(id);
    } else {
      map.setView([userLocation.lat, userLocation.lng], 16);
    }
  }, [points, userLocation, map, padding]);
  return null;
}

/** Open Google Maps directions from current location to dest */
function navigateFromCurrentLocation(lat: number, lon: number, name?: string) {
  const dest = encodeURIComponent(name ?? `${lat},${lon}`);
  const url = `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${lat},${lon}&destination_place_id=${dest}&travelmode=walking`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function MapComponent({
  userLocation,
  suggestions,
}: {
  userLocation: LatLng;
  suggestions: Suggestion[];
}) {
  const mapRef = useRef<LeafletMap | null>(null);

  /* read language from localStorage to match dashboard */
  const [lang, setLang] = useState<Lang>("en");
  const t = copy[lang];
  useEffect(() => {
    const saved = (localStorage.getItem("peePalLang") as Lang | null) || "en";
    setLang(saved);
  }, []);

  const pointsWithDistance = useMemo(
    () =>
      suggestions
        .map((s) => ({
          ...s,
          distance: getDistance(
            userLocation.lat,
            userLocation.lng,
            s.lat,
            s.lon
          ),
        }))
        .sort((a, b) => a.distance - b.distance),
    [suggestions, userLocation]
  );

  const nearest = pointsWithDistance[0] ?? null;

  const boundsPoints = useMemo<LatLngTuple[]>(
    () => pointsWithDistance.map((p) => [p.lat, p.lon] as LatLngTuple),
    [pointsWithDistance]
  );

  return (
    <div className="relative h-full w-full">
      {/* Map */}
      <MapContainer
        ref={mapRef}
        center={[userLocation.lat, userLocation.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        className="leaflet-container"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <FitBounds
          points={boundsPoints}
          userLocation={userLocation}
          padding={
            typeof window !== "undefined" && window.innerWidth < 768
              ? [18, 18]
              : [32, 32]
          }
        />

        {/* User location marker */}
        <CircleMarker
          center={[userLocation.lat, userLocation.lng]}
          radius={8}
          pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9" }}
          fillOpacity={0.95}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold text-sky-700">{t.youHere}</div>
              <div className="mt-1 text-xs text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {userLocation.lat.toFixed(5)},{" "}
                  {userLocation.lng.toFixed(5)}
                </span>
              </div>
            </div>
          </Popup>
        </CircleMarker>

        {/* Suggestions */}
        {pointsWithDistance.map((p, idx) => {
          const isNearest =
            nearest && p.name === nearest.name && p.lat === nearest.lat && p.lon === nearest.lon;
          return (
            <CircleMarker
              key={`${p.name}-${idx}`}
              center={[p.lat, p.lon]}
              radius={isNearest ? 11 : 7}
              pathOptions={{
                color: isNearest ? "#ef4444" : "#16a34a",
                fillColor: isNearest ? "#ef4444" : "#16a34a",
              }}
              fillOpacity={0.95}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sky-900">{p.name}</div>
                      <div className="text-[11px] text-sky-700/75">{p.type}</div>
                    </div>
                    {isNearest && (
                      <span className="rounded-full bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 font-semibold">
                        {t.nearest}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    {formatDistance(p.distance, lang)} {t.away}
                  </div>
                  {p.tips && (
                    <div className="mt-2 text-[12px] text-gray-600 leading-relaxed">
                      {p.tips}
                    </div>
                  )}
                  <button
                    onClick={() => navigateFromCurrentLocation(p.lat, p.lon, p.name)}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700 active:scale-[0.98] transition"
                  >
                    <Navigation className="h-4 w-4" />
                    {t.nav}
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Primary CTA: Navigate to Nearest */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4 z-[500]">
        <button
          type="button"
          onClick={() => {
            if (!nearest) return;
            navigateFromCurrentLocation(nearest.lat, nearest.lon, nearest.name);
          }}
          disabled={!nearest}
          className="pointer-events-auto w-full max-w-md inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold shadow-lg border
                     transition active:scale-[0.99]
                     disabled:opacity-60 disabled:cursor-not-allowed
                     bg-sky-600 text-white border-sky-700 hover:bg-sky-700"
          aria-label={copy[lang].ariaNearest}
          title={copy[lang].ariaNearest}
        >
          <Navigation className="h-5 w-5" />
          {t.navNearest}
        </button>
      </div>
    </div>
  );
}
