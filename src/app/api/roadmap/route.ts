import { makeRoadmap } from "@/features/roadmap/api/narrator";
import { RoadmapRequest } from "@/features/roadmap/types";

// POST RoadmapRequest → Roadmap: a 6-month plan for one path. Nemotron 3 Ultra.
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = RoadmapRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid roadmap request." }, { status: 400 });
  try {
    return Response.json(await makeRoadmap(parsed.data));
  } catch (err) {
    console.error("[roadmap]", err);
    return Response.json({ error: "We couldn't write the roadmap right now. Please try again." }, { status: 502 });
  }
}
