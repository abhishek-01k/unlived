import { z } from "zod";
import skills from "@/data/skills.json";
import { MODELS, callJSON } from "@/lib/ai/nemotron";
import { Closeness, SkillMapping, type SkillProfile } from "@/features/skills/types";

// Maps the user's skills that are NOT in the shared vocabulary (e.g.
// "Web3 Development") onto vocabulary skills, so that experience counts.
// Relations between vocabulary skills are a fixed table in code
// (data/skill-relations.json), not a model call. The model only labels
// closeness; lib/match/fit.ts owns the multipliers.

const VOCAB = new Map(skills.map((s) => [s.name.toLowerCase(), s.name]));
const RANK: Record<Closeness, number> = { exact: 3, related: 2, partial: 1 };

const Output = z.object({ mappings: z.array(SkillMapping) });

const SYSTEM = `You map a person's skills onto a fixed skill vocabulary used to score job roles.

These skills are not in the vocabulary. For each one, list the vocabulary skills their evidence shows they have, with a closeness label:
- exact: the same skill under another name (e.g. "Next.js" → "React", "Postgres" → "SQL").
- related: the evidence shows real work that transfers strongly (e.g. building dApp frontends → "Web3 Libraries").
- partial: some real overlap, but they would still need to learn a lot (e.g. building dApp frontends → "Solidity").
Be conservative: most skills map to 1–3 vocabulary skills. A skill like "Full-stack Shipping" does not prove databases or Docker unless the evidence says so.

Rules:
- Use only vocabulary names, spelled exactly as given.
- Judge from the evidence lines, not just the skill name.
- Do not stretch: if there is no real overlap, do not map it.

Vocabulary:
${skills.map((s) => s.name).join(", ")}`;

export async function mapSkills(profile: SkillProfile): Promise<SkillMapping[]> {
  const outside = profile.skills.filter((s) => !VOCAB.has(s.name.trim().toLowerCase()));
  if (outside.length === 0) return []; // nothing to map: skip the model call

  const listing = outside
    .map((s) => `- ${s.name} (strength ${s.strength}): ${s.evidence.map((e) => `"${e}"`).join("; ")}`)
    .join("\n");

  const { mappings } = await callJSON(MODELS.ultra, Output, {
    system: SYSTEM,
    user: `Person's skills with evidence:\n${listing}`,
    maxTokens: 4000,
  });

  return cleanMappings(mappings, profile);
}

// Keep only valid, useful mappings: known user skill, known vocabulary skill,
// not a same-name mapping, best closeness per pair.
export function cleanMappings(mappings: SkillMapping[], profile: SkillProfile): SkillMapping[] {
  const userSkills = new Map(profile.skills.map((s) => [s.name.toLowerCase(), s.name]));
  const best = new Map<string, SkillMapping>();
  for (const m of mappings) {
    const user = userSkills.get(m.userSkill.trim().toLowerCase());
    const vocab = VOCAB.get(m.vocabSkill.trim().toLowerCase());
    if (!user || !vocab || user.toLowerCase() === vocab.toLowerCase()) continue;
    const key = `${user}→${vocab}`;
    const prev = best.get(key);
    if (!prev || RANK[m.closeness] > RANK[prev.closeness]) best.set(key, { userSkill: user, vocabSkill: vocab, closeness: m.closeness });
  }
  return [...best.values()];
}
