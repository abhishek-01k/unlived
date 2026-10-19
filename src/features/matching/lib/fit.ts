import relations from "@/data/skill-relations.json";
import { score100 } from "@/lib/format";
import type { Closeness, SkillMapping, SkillProfile } from "@/features/skills/types";
import type { Field } from "@/lib/fields";
import type { FieldMatch, Gap } from "@/features/matching/types";

// Skill match ("fit") for a field:
//   fit = Σ(weight × your strength in that core skill) / Σ(weight)
// Your strength in a core skill is the best of:
//   - a profile skill with the same name (exact),
//   - a vocabulary skill you have that relates to it (data/skill-relations.json,
//     a fixed, reviewed table), or
//   - one of your own skills the mapping agent placed on it (for skill names
//     outside the vocabulary),
// multiplied by the closeness multiplier below. Pure code, no model calls.

export const RELATIONS = relations as { from: string; to: string; closeness: Closeness }[];

export const CLOSENESS_MULTIPLIER: Record<Closeness, number> = {
  exact: 1,
  related: 0.7,
  partial: 0.4,
};

// Below this effective strength a core skill counts as a gap.
export const GAP_THRESHOLD = 0.5;

export type BreakdownRow = {
  skill: string;
  weight: number;
  via: string | null;
  closeness: Closeness | null;
  strength: number; // effective strength after the multiplier
  points: number; // weight × strength
};

export type FieldScore = {
  fieldId: string;
  fit: number;
  rows: BreakdownRow[];
  totalWeight: number;
};

const key = (s: string) => s.trim().toLowerCase();

// Rough learning time for a gap, in weeks: heavier and weaker means longer.
export function weeksToLearn(weight: number, strength: number): number {
  return Math.max(1, Math.round(weight * (1 - strength) * 4));
}

function bestCoverage(coreSkill: string, profile: SkillProfile, mappings: SkillMapping[]) {
  let best: { via: string; closeness: Closeness; strength: number } | null = null;
  const consider = (via: string, closeness: Closeness, raw: number) => {
    const strength = raw * CLOSENESS_MULTIPLIER[closeness];
    if (!best || strength > best.strength) best = { via, closeness, strength };
  };

  const byName = new Map(profile.skills.map((s) => [key(s.name), s]));
  const same = byName.get(key(coreSkill));
  if (same) consider(same.name, "exact", same.strength);

  for (const m of [...RELATIONS.map((r) => ({ userSkill: r.from, vocabSkill: r.to, closeness: r.closeness })), ...mappings]) {
    if (key(m.vocabSkill) !== key(coreSkill)) continue;
    const user = byName.get(key(m.userSkill));
    if (user) consider(user.name, m.closeness, user.strength);
  }
  return best as { via: string; closeness: Closeness; strength: number } | null;
}

export function scoreField(field: Field, profile: SkillProfile, mappings: SkillMapping[] = []): FieldScore {
  const rows: BreakdownRow[] = field.coreSkills.map(({ name, weight }) => {
    const cover = bestCoverage(name, profile, mappings);
    const strength = cover ? Math.round(cover.strength * 100) / 100 : 0;
    return {
      skill: name,
      weight,
      via: cover?.via ?? null,
      closeness: cover?.closeness ?? null,
      strength,
      points: Math.round(weight * strength * 100) / 100,
    };
  });
  const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0);
  const totalPoints = rows.reduce((sum, r) => sum + r.weight * r.strength, 0);
  const fit = totalWeight ? Math.round((totalPoints / totalWeight) * 1000) / 1000 : 0;
  return { fieldId: field.id, fit, rows, totalWeight };
}

export function toFieldMatch(score: FieldScore, interested: boolean): FieldMatch {
  const matchedSkills = score.rows
    .filter((r) => r.via && r.closeness && r.strength > 0)
    .map((r) => ({ skill: r.skill, via: r.via!, closeness: r.closeness!, strength: r.strength }));
  const gaps: Gap[] = score.rows
    .filter((r) => r.strength < GAP_THRESHOLD)
    .map((r) => ({
      skill: r.skill,
      status: r.strength > 0 ? "partial" : "missing",
      weeksToLearn: weeksToLearn(r.weight, r.strength),
    }));
  return { fieldId: score.fieldId, fit: score.fit, interested, matchedSkills, gaps };
}

export function computeMatches(
  profile: SkillProfile,
  fields: Field[],
  mappings: SkillMapping[] = [],
  interests: string[] = [],
): FieldMatch[] {
  const picked = new Set(interests);
  return fields.map((f) => toFieldMatch(scoreField(f, profile, mappings), picked.has(f.id)));
}

export type Ranked<T> = T & { rank: number; score: number };

// Rank by the score people see (0–100). Equal scores share a rank
// (1, 2, 2, 4…), so ties never look arbitrary.
export function rankByFit<T extends { fit: number }>(items: T[]): Ranked<T>[] {
  const sorted = [...items]
    .map((item) => ({ ...item, score: score100(item.fit) }))
    .sort((a, b) => b.score - a.score);
  let rank = 0;
  return sorted.map((item, i) => {
    if (i === 0 || item.score !== sorted[i - 1].score) rank = i + 1;
    return { ...item, rank };
  });
}
