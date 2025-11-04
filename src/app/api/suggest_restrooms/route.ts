// src/app/api/suggest_restrooms/route.ts
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not set - /api/suggest_restrooms will fail.");
}

function buildPrompt(lat: number, lon: number, radiusMeters = 1000) {
  return [
    {
      role: "system",
      content:
        "You are an assistant that suggests nearby places where public restrooms are commonly available. " +
        "Return EXACTLY a JSON array (no extra text) of up to 8 objects with keys: name, type, lat, lon, tips. " +
        "The lat/lon should be approximate and within the given radius in meters. Do not explain or add commentary. " +
        "If you are unsure, still provide reasonable best-guess coordinates near the input location.",
    },
    {
      role: "user",
      content: `User coordinates: latitude ${lat}, longitude ${lon}. Radius: ${radiusMeters} meters.
Please return up to 8 likely restroom locations within the radius. Each item must be:
{
  "name": string,
  "type": string, // e.g. "shopping mall", "coffee shop", "hotel", "gas station", "public park"
  "lat": number,
  "lon": number,
  "tips": string
}
Return only valid JSON (an array).`,
    },
  ];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    const radius = Number(searchParams.get("radius") || "1000");

    if (!lat || !lon || Number.isNaN(lat) || Number.isNaN(lon)) {
      return NextResponse.json({ error: "Missing or invalid lat/lon" }, { status: 400 });
    }

    const prompt = buildPrompt(lat, lon, radius);

    // Call OpenAI Chat Completions
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // change model if needed / to one you have access to
        messages: prompt,
        temperature: 0.2,
        max_tokens: 800,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenAI error:", resp.status, t);
      return NextResponse.json({ error: "OpenAI request failed", details: t }, { status: 502 });
    }

    const json = await resp.json();
    // The assistant message should be in json. Try to parse it.
    const assistantText = json.choices?.[0]?.message?.content ?? "";
    let parsed;
    try {
      parsed = JSON.parse(assistantText);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
    } catch (e) {
      // If parsing fails, return the raw assistant text for debugging
      console.error("Failed to parse assistant output:", e);
      return NextResponse.json({ error: "Failed to parse assistant output", raw: assistantText }, { status: 500 });
    }

    // Basic sanity-filtering: keep items with lat/lon numbers
    const suggestions = parsed
      .filter((p: any) => typeof p.lat === "number" && typeof p.lon === "number" && typeof p.name === "string")
      .map((p: any) => ({
        name: p.name,
        type: p.type || "unknown",
        lat: Number(p.lat),
        lon: Number(p.lon),
        tips: p.tips || "",
      }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
