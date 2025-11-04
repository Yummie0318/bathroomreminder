"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./MapComponent"), { ssr: false });

export default function MapPage() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setErrorMsg("Please allow location access to use this feature.")
    );
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!userLocation) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/suggest_restrooms?lat=${userLocation.lat}&lon=${userLocation.lng}&radius=1500`
        );
        const data = await res.json();
        if (data.suggestions?.length) setSuggestions(data.suggestions);
        else {
          // ChatGPT fallback if no suggestions from API
          setSuggestions([
            {
              name: "SM City Tuguegarao",
              type: "Shopping mall",
              lat: userLocation.lat + 0.002,
              lon: userLocation.lng + 0.003,
              tips: "Best chance for clean public restrooms. Check near main atrium or food court.",
            },
            {
              name: "Vita Bella – Caritan Highway",
              type: "Coffee shop",
              lat: userLocation.lat + 0.0015,
              lon: userLocation.lng + 0.0025,
              tips: "Ask politely if you can use the restroom.",
            },
            {
              name: "Starbucks SM City Tuguegarao",
              type: "Coffee shop",
              lat: userLocation.lat + 0.0022,
              lon: userLocation.lng + 0.0028,
              tips: "Alternate restroom if main mall ones are crowded.",
            },
          ]);
        }
      } catch (e) {
        console.error(e);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSuggestions();
  }, [userLocation]);

  if (errorMsg) return <p className="p-4 text-red-600">{errorMsg}</p>;
  if (!userLocation) return <p className="p-4">Detecting your location…</p>;
  if (loading) return <p className="p-4">Finding nearby restrooms…</p>;
  if (!suggestions?.length) return <p className="p-4">No nearby restrooms found.</p>;

  return (
    <div className="h-screen w-full">
      <MapComponent userLocation={userLocation} suggestions={suggestions} />
    </div>
  );
}
