import { mapSkills } from "@/features/skills/api/mapping";
import { MapSkillsRequest } from "@/features/skills/types";

// POST { profile } → { mapping }: places the user's non-vocabulary skills on
// the shared skill vocabulary. Returns instantly when there is nothing to map.
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = MapSkillsRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { profile }." }, { status: 400 });
  try {
    return Response.json({ mapping: await mapSkills(parsed.data.profile) });
  } catch (err) {
    console.error("[skills-map]", err);
    // Matching still works without the mapping (exact names + relations table).
    return Response.json({ mapping: [] });
  }
}
