import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.YOUTUBE_API_KEY;
const BASE = "https://www.googleapis.com/youtube/v3";

function parseYouTubeId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

// Converts ISO 8601 duration (e.g. "PT3M41S") to "3:41" / "1:02:03"
function formatIsoDuration(iso: string): string | null {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  const mm = h > 0 ? String(min).padStart(2, "0") : String(min);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

async function fetchVideoDetails(videoId: string): Promise<{ title: string; thumbnail: string; duration: string | null } | null> {
  const url = `${BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return {
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    duration: formatIsoDuration(item.contentDetails.duration),
  };
}

async function searchVideoId(query: string): Promise<string | null> {
  const url = `${BASE}/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0]?.id?.videoId ?? null;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });
  if (!API_KEY) return NextResponse.json({ error: "YouTube API key not configured" }, { status: 500 });

  try {
    const videoId = parseYouTubeId(q) ?? (await searchVideoId(q));
    if (!videoId) return NextResponse.json({ error: "No results" }, { status: 404 });

    const details = await fetchVideoDetails(videoId);
    if (!details) return NextResponse.json({ error: "No results" }, { status: 404 });

    return NextResponse.json({ videoId, ...details });
  } catch (err) {
    console.error("YouTube resolve error:", err);
    return NextResponse.json({ error: "Resolve failed" }, { status: 500 });
  }
}
