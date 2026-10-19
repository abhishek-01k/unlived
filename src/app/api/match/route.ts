import { discoverHidden } from "@/features/matching/api/discovery";
import { computeMatches, rankByFit } from "@/features/matching/lib/fit";
import { FIELDS } from "@/lib/fields";
import { MatchRequest } from "@/features/matching/types";

export const maxDuration = 60;


export async function POST(request: Request) {
  const parsed = MatchRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { profile, mapping, interests (1–5), signals }." }, { status: 400 });
  const { profile, mapping, interests, signals } = parsed.data;

  const matches = computeMatches(profile, FIELDS, mapping, interests);
  try {
    const hidden = await discoverHidden(profile, rankByFit(matches), interests, signals);
    return Response.json({ matches, hidden });
  } catch (err) {
    console.error("[match] discovery failed", err);
    return Response.json({ matches, hidden: [] });
  }
}
