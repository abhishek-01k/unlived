import { z } from "zod";
import { score100 } from "@/lib/format";
import type { Ranked } from "@/features/matching/lib/fit";
import { MODELS, callJSON } from "@/lib/ai/nemotron";
import { FIELDS } from "@/lib/fields";
import { HiddenPotential, type FieldMatch } from "@/features/matching/types";
import { type MarketSignal } from "@/features/market/types";
import { type SkillProfile } from "@/features/skills/types";
import { isGrounded } from "@/features/resume/lib/grounding";

// Hidden potential: roles the person did NOT pick but fits well, explained
// with their own resume lines. Nemotron Ultra reasons over skill match,
// market data and their story; code enforces the rules afterwards.

const CANDIDATES = 15;

const Output = z.object({ hidden: z.array(HiddenPotential).max(3) });

const SYSTEM = `You find a person's hidden career potential: tech roles they did not pick but would be good at.

You get their profile, the roles they picked, and candidate roles with a skill-match score (0–100, how much of the role they already prove), market demand and AI risk.

Pick 1 to 3 candidates that are:
- a strong skill match (prefer the top of the list),
- NOT what they already do: skip roles that match their current or past job titles in the profile summary, since that is not hidden,
- worth considering: healthy demand and not high AI risk, unless the fit is exceptional,
- surprising but believable: explain the link between their past work and the role.

For each: fieldId (from the candidates), headline (max 10 words, second person, e.g. "You already work like a founding engineer"), reason (2 sentences, plain English, second person, mention the skill match as "N/100" and why the role suits them), evidence (1–3 lines copied word for word from the profile's evidence).

Only state facts the evidence lines support. Never exaggerate: "worked within a team of 5–8 engineers" does not mean they led or coordinated that team.`;

function describe(f: Ranked<FieldMatch>, signal?: MarketSignal) {
  const field = FIELDS.find((x) => x.id === f.fieldId)!;
  const market = signal
    ? `demand ${score100(signal.demand)}/100 ${signal.trend}, AI risk ${score100(signal.aiRisk)}/100`
    : "no market data";
  const gaps = f.gaps.slice(0, 3).map((g) => g.skill).join(", ") || "none";
  return `- ${field.id} | ${field.name} | skill match ${f.score}/100 (rank #${f.rank}) | ${market} | main gaps: ${gaps}`;
}

export async function discoverHidden(
  profile: SkillProfile,
  ranked: Ranked<FieldMatch>[],
  interests: string[],
  signals: MarketSignal[],
): Promise<HiddenPotential[]> {
  const picked = new Set(interests);
  const candidates = ranked.filter((m) => !picked.has(m.fieldId)).slice(0, CANDIDATES);
  if (candidates.length === 0) return [];
  const signalById = new Map(signals.map((s) => [s.fieldId, s]));

  const evidence = profile.skills.flatMap((s) => s.evidence);
  const user = [
    `Profile summary: ${profile.summary}`,
    `Seniority: ${profile.seniority}, ${profile.yearsExperience} years`,
    `Top skills: ${profile.skills.slice(0, 12).map((s) => `${s.name} ${score100(s.strength)}`).join(", ")}`,
    `Evidence lines:\n${[...new Set(evidence)].map((e) => `- ${e}`).join("\n")}`,
    `Roles they picked: ${interests.map((id) => FIELDS.find((f) => f.id === id)?.name ?? id).join(", ") || "none"}`,
    `Candidate roles (not picked), best match first:\n${candidates.map((c) => describe(c, signalById.get(c.fieldId))).join("\n")}`,
  ].join("\n\n");

  const { hidden } = await callJSON(MODELS.ultra, Output, {
    system: SYSTEM,
    user,
    thinking: true,
    maxTokens: 12000,
  });

  return cleanHidden(hidden, candidates.map((c) => c.fieldId), evidence);
}

// Enforce the rules in code: only candidate roles, no duplicates, evidence
// that really comes from the profile.
export function cleanHidden(hidden: HiddenPotential[], candidateIds: string[], evidence: string[]): HiddenPotential[] {
  const allowed = new Set(candidateIds);
  const corpus = evidence.join("\n");
  const seen = new Set<string>();
  return hidden.flatMap((h) => {
    if (!allowed.has(h.fieldId) || seen.has(h.fieldId)) return [];
    const ev = h.evidence.filter((e) => isGrounded(e, corpus));
    if (ev.length === 0) return [];
    seen.add(h.fieldId);
    return [{ ...h, evidence: ev }];
  });
}
