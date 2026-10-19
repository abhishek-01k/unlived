import { z } from "zod";
import { unit } from "@/lib/format";

export const SkillCategory = z.enum(["technical", "design", "product", "communication", "domain", "other"]);

// ---------- Resume → skill profile ----------

export const Skill = z.object({
  name: z.string().min(1),
  category: SkillCategory,
  strength: unit, // 0 = mentioned once, 1 = deep, proven expertise
  years: z.number().min(0).optional(),
  evidence: z.array(z.string().min(1)).min(1), // quoted resume lines that prove the skill
});
export type Skill = z.infer<typeof Skill>;

export const SkillProfile = z.object({
  summary: z.string().min(1),
  seniority: z.enum(["junior", "mid", "senior"]),
  yearsExperience: z.number().min(0),
  skills: z.array(Skill).min(1),
});
export type SkillProfile = z.infer<typeof SkillProfile>;

// ---------- Skill vocabulary (data/skills.json) ----------

export const VocabSkill = z.object({
  name: z.string().min(1),
  category: SkillCategory,
});
export type VocabSkill = z.infer<typeof VocabSkill>;

// How a user's skill maps onto a vocabulary skill. The model picks the label;
// code owns the multiplier (features/matching/lib/fit.ts).
export const Closeness = z.enum(["exact", "related", "partial"]);
export type Closeness = z.infer<typeof Closeness>;

export const SkillMapping = z.object({
  userSkill: z.string().min(1),
  vocabSkill: z.string().min(1),
  closeness: Closeness,
});
export type SkillMapping = z.infer<typeof SkillMapping>;

export const MapSkillsRequest = z.object({ profile: SkillProfile });
export const MapSkillsResponse = z.object({ mapping: z.array(SkillMapping) });
export type MapSkillsResponse = z.infer<typeof MapSkillsResponse>;
