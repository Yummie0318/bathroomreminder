"use client";

import React, { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap } from "react-leaflet";
import { LatLngTuple } from "leaflet";
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
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function FitBounds({ points, userLocation }: { points: Suggestion[]; userLocation: { lat: number; lng: number } }) {
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

export default function MapComponent({
  userLocation,
  suggestions,
}: {
  userLocation: { lat: number; lng: number };
  suggestions: Suggestion[];
}) {
  const pointsWithDistance = useMemo(
    () =>
      suggestions
        .map((s) => ({ ...s, distance: getDistance(userLocation.lat, userLocation.lng, s.lat, s.lon) }))
        .sort((a, b) => a.distance - b.distance),
    [suggestions, userLocation]
  );

  const nearest = pointsWithDistance[0];

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Sidebar */}
      <aside className="md:w-80 w-full max-h-screen overflow-y-auto bg-white shadow-md p-4 border border-sky-100">
        <h2 className="text-lg font-bold mb-4 text-sky-700">Nearby Bathrooms</h2>
        {pointsWithDistance.map((p, idx) => (
          <div
            key={`${p.name}-${idx}`}
            className={`p-3 mb-3 rounded-xl border ${
              p === nearest ? "border-red-500 bg-red-50" : "border-gray-200 bg-sky-50"
            }`}
          >
            <strong className="block">{p.name}</strong>
            <span className="text-xs text-gray-500">{p.type}</span>
            <div className="mt-1 text-sm text-gray-600">{Math.round(p.distance)} meters away</div>
            {p.tips && <div className="mt-1 text-xs text-gray-500 italic">{p.tips}</div>}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-blue-600 underline text-sm"
            >
              Open in Google Maps
            </a>
          </div>
        ))}
      </aside>

      {/* Map */}
      <main className="flex-1 h-screen">
        <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={15} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <FitBounds points={pointsWithDistance} userLocation={userLocation} />

          {/* User */}
          <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={8} color="blue" fillOpacity={0.9}>
            <Popup>You are here</Popup>
          </CircleMarker>

          {/* Radius */}
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={1500}
            pathOptions={{ color: "blue", fillOpacity: 0.03 }}
          />

          {/* Suggestions */}
          {pointsWithDistance.map((p, idx) => (
            <CircleMarker
              key={`${p.name}-${idx}`}
              center={[p.lat, p.lon]}
              radius={p === nearest ? 10 : 6}
              color={p === nearest ? "red" : "green"}
              fillOpacity={0.9}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: 12, color: "#555" }}>{p.type}</div>
                  <div style={{ marginTop: 6 }}>{Math.round(p.distance)} meters away</div>
                  {p.tips && <div style={{ marginTop: 6, fontSize: 13 }}>{p.tips}</div>}
                  <div style={{ marginTop: 6 }}>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open in Google Maps
                    </a>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </main>
    </div>
  );
}
