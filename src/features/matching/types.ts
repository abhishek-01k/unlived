import { z } from "zod";
import { unit } from "@/lib/format";
import { MarketSignal } from "@/features/market/types";
import { Closeness, SkillMapping, SkillProfile } from "@/features/skills/types";

export const Gap = z.object({
  skill: z.string().min(1),
  status: z.enum(["missing", "partial"]),
  weeksToLearn: z.number().min(0),
});
export type Gap = z.infer<typeof Gap>;

export const FieldMatch = z.object({
  fieldId: z.string(),
  fit: unit,
  interested: z.boolean(),
  matchedSkills: z.array(
    z.object({
      skill: z.string(), // core skill of the field
      via: z.string(), // the user's skill that covers it (after synonym mapping)
      closeness: Closeness,
      strength: unit, // user's strength × closeness multiplier
    }),
  ),
  gaps: z.array(Gap),
});
export type FieldMatch = z.infer<typeof FieldMatch>;

export const HiddenPotential = z.object({
  fieldId: z.string(),
  headline: z.string().min(1),
  reason: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
});
export type HiddenPotential = z.infer<typeof HiddenPotential>;

export const MatchRequest = z.object({
  profile: SkillProfile,
  mapping: z.array(SkillMapping),
  interests: z.array(z.string()).min(1).max(50),
  signals: z.array(MarketSignal),
});
export type MatchRequest = z.infer<typeof MatchRequest>;

export const MatchResponse = z.object({
  matches: z.array(FieldMatch),
  hidden: z.array(HiddenPotential).max(3),
});
export type MatchResponse = z.infer<typeof MatchResponse>;
