// src/app/api/suggest_restrooms/route.ts
import { NextRequest, NextResponse } from "next/server";

// Simple haversine for sorting by distance
function haversine(lat1:number, lon1:number, lat2:number, lon2:number) {
  const R = 6371e3;
  const toRad = (d:number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type Lang = "en" | "de" | "zh";

// localized, short, deterministic tips
function tipFor(type: string, lang: Lang) {
  const t = type.toLowerCase();
  const map: Record<Lang, Record<string, string>> = {
    en: {
      "public restroom": "Look for signage; some are in parks or stations.",
      "shopping mall": "Clean restrooms—check atrium or food court.",
      "coffee shop": "Kindly ask staff to use the restroom.",
      restaurant: "Most restaurants will let you use it if you ask.",
      supermarket: "Often near the customer service area.",
      "fast food": "Usually available for customers—ask staff.",
      fuel: "Gas stations often have public toilets.",
      convenience: "Small shops sometimes have restrooms—ask politely.",
      park: "Some parks have public toilets near entrances.",
    },
    de: {
      "public restroom": "Auf Beschilderung achten; oft in Parks/Bahnhöfen.",
      "shopping mall": "Saubere Toiletten – Atrium oder Food-Court.",
      "coffee shop": "Höflich fragen, ob Sie die Toilette benutzen dürfen.",
      restaurant: "Viele Restaurants erlauben die Nutzung auf Anfrage.",
      supermarket: "Oft in der Nähe vom Kundenservice.",
      "fast food": "Meist für Gäste – bitte Personal fragen.",
      fuel: "Tankstellen haben häufig öffentliche Toiletten.",
      convenience: "Kleine Läden haben manchmal Toiletten – freundlich fragen.",
      park: "In Parks oft nahe den Eingängen.",
    },
    zh: {
      "public restroom": "留意指示牌；常在公园或车站附近。",
      "shopping mall": "商场洗手间较干净—中庭或美食区附近。",
      "coffee shop": "礼貌询问店员是否可使用洗手间。",
      restaurant: "很多餐馆会在你询问后允许使用。",
      supermarket: "通常在客服台附近。",
      "fast food": "通常为顾客开放—先询问店员。",
      fuel: "加油站常有公共洗手间。",
      convenience: "小店有时也有洗手间—礼貌询问。",
      park: "一些公园入口附近设有公厕。",
    },
  };
  // normalize a few keys
  const key =
    t.includes("toilet") ? "public restroom" :
    t.includes("fast_food") ? "fast food" :
    t.includes("fuel") ? "fuel" :
    t.includes("convenience") ? "convenience" : t;

  return map[lang][key] ?? map[lang]["public restroom"];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    const radius = Number(searchParams.get("radius") || "1000");
    const lang = (searchParams.get("lang") || "en").toLowerCase() as Lang;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    // Overpass query: prioritize amenity=toilets, but also include common places
    // that typically have restrooms (mall, cafe, restaurant, fast_food, fuel, convenience, supermarket, park).
    const query = `
      [out:json][timeout:25];
      (
        nwr(around:${radius},${lat},${lon})["amenity"="toilets"];
        nwr(around:${radius},${lat},${lon})["shop"="supermarket"];
        nwr(around:${radius},${lat},${lon})["amenity"="fast_food"];
        nwr(around:${radius},${lat},${lon})["amenity"="restaurant"];
        nwr(around:${radius},${lat},${lon})["amenity"="cafe"];
        nwr(around:${radius},${lat},${lon})["amenity"="fuel"];
        nwr(around:${radius},${lat},${lon})["shop"="convenience"];
        nwr(around:${radius},${lat},${lon})["shop"="mall"];
        nwr(around:${radius},${lat},${lon})["leisure"="park"];
      );
      out center 60;
    `.trim();

    const upstream = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        // Many Overpass instances require a UA:
        "User-Agent": "bathroom-reminder/1.0 (contact@example.com)",
      },
      body: new URLSearchParams({ data: query }).toString(),
      // Prevent Next caching
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!upstream.ok) {
      console.warn("Overpass failed:", upstream.status, await upstream.text());
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    const data = await upstream.json();
    const elems: any[] = Array.isArray(data?.elements) ? data.elements : [];

    // Map OSM -> our schema
    const candidates = elems.map((el) => {
      const c = el.center || el; // nodes have lat/lon, ways/relations use center
      const tags = el.tags || {};
      const name = tags.name || tags.brand || tags.operator || tags["addr:housename"];

      // derive a simple "type"
      let type = "place";
      if (tags.amenity === "toilets") type = "public restroom";
      else if (tags.shop === "mall") type = "shopping mall";
      else if (tags.amenity === "cafe") type = "coffee shop";
      else if (tags.amenity === "restaurant") type = "restaurant";
      else if (tags.amenity === "fast_food") type = "fast food";
      else if (tags.amenity === "fuel") type = "fuel";
      else if (tags.shop === "convenience") type = "convenience";
      else if (tags.shop === "supermarket") type = "supermarket";
      else if (tags.leisure === "park") type = "park";

      return {
        name: name || (type === "public restroom" ? "Public Restroom" : (tags.name || "Place")),
        type,
        lat: Number(c.lat),
        lon: Number(c.lon),
      };
    }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));

    // Deduplicate by (rounded) coords + name
    const seen = new Set<string>();
    const unique = candidates.filter((p) => {
      const k = `${p.name}|${p.type}|${p.lat.toFixed(5)}|${p.lon.toFixed(5)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // sort by distance, then slice to 8
    unique.sort((a, b) => haversine(lat, lon, a.lat, a.lon) - haversine(lat, lon, b.lat, b.lon));
    const top = unique.slice(0, 8);

    // add localized tips
    const suggestions = top.map((p) => ({
      ...p,
      tips: tipFor(p.type, lang),
    }));

    // Always return 200 with JSON — never 502
    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (err) {
    console.error("suggest_restrooms route error:", err);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
