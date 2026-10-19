import { MAX_LIVE, getSignals } from "@/features/market/api/signals";

// Live lookups take ~2–4 s; allow headroom on serverless hosts.
export const maxDuration = 60;

// GET /api/market            → snapshot signals for every role
// GET /api/market?live=a,b   → same, with up to 4 roles refreshed live via Tavily + Nemotron
export async function GET(request: Request) {
  const live = (new URL(request.url).searchParams.get("live") ?? "").split(",").filter(Boolean);
  if (live.length > MAX_LIVE) {
    return Response.json({ error: `Ask for at most ${MAX_LIVE} live roles at a time.` }, { status: 400 });
  }
  const { signals, liveIds, failed } = await getSignals(live);
  return Response.json({ signals, liveIds, failed });
}
