import type { SkillProfile } from "@/features/skills/types";

// The parser must back every skill with quoted resume lines. Models
// sometimes paraphrase or invent evidence, so keep only evidence we can find
// in the (redacted) resume, and drop skills left with none.

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[“”"'’`]/g, "")
    .replace(/[^a-z0-9+#.%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const words = (s: string) => normalize(s).split(" ").filter((w) => w.length > 2);

export function isGrounded(evidence: string, resume: string, minOverlap = 0.75): boolean {
  const ev = normalize(evidence);
  if (!ev) return false;
  const doc = normalize(resume);
  if (doc.includes(ev)) return true;

  const evWords = words(evidence);
  if (evWords.length === 0) return false;
  const docWords = new Set(words(resume));
  const hits = evWords.filter((w) => docWords.has(w)).length;
  return hits / evWords.length >= minOverlap;
}

// A line like "Tooling: Git, Docker, Jest" only names skills; it proves
// nothing about depth. Skills backed only by such lines are capped.
export const LIST_ONLY_CAP = 0.3;
const LIST_LINE = /^\s*[A-Za-z /&+-]{2,30}:\s*[^.]+$/;
const isListLine = (evidence: string) => LIST_LINE.test(evidence) && evidence.split(",").length >= 3;

export function groundProfile(profile: SkillProfile, resume: string): { profile: SkillProfile; droppedSkills: string[] } {
  const droppedSkills: string[] = [];
  const merged = new Map<string, SkillProfile["skills"][number]>();

  for (const skill of profile.skills) {
    const evidence = skill.evidence.filter((e) => isGrounded(e, resume));
    if (evidence.length === 0) {
      droppedSkills.push(skill.name);
      continue;
    }
    const strength = evidence.every(isListLine) ? Math.min(skill.strength, LIST_ONLY_CAP) : skill.strength;
    const k = skill.name.trim().toLowerCase();
    const prev = merged.get(k);
    if (!prev) {
      merged.set(k, { ...skill, evidence, strength });
    } else {
      // Same skill listed twice: keep the stronger reading and all evidence.
      merged.set(k, {
        ...prev,
        strength: Math.max(prev.strength, strength),
        evidence: [...new Set([...prev.evidence, ...evidence])],
      });
    }
  }

  const skills = [...merged.values()].sort((a, b) => b.strength - a.strength);
  return { profile: { ...profile, skills }, droppedSkills };
}
