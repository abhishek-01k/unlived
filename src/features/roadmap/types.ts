import { z } from "zod";
import { MarketSignal } from "@/features/market/types";
import { Gap } from "@/features/matching/types";
import { SimResult, Values } from "@/features/simulation/types";
import { SkillProfile } from "@/features/skills/types";

export const FutureLetter = z.object({
  fieldId: z.string(),
  title: z.string().min(1),
  body: z.string().min(1),
});
export type FutureLetter = z.infer<typeof FutureLetter>;

export const RoadmapMonth = z.object({
  month: z.number().int().min(1).max(6),
  theme: z.string().min(1),
  learn: z.array(z.string().min(1)).min(1),
  build: z.array(z.string().min(1)).min(1),
  apply: z.array(z.string().min(1)),
});
export type RoadmapMonth = z.infer<typeof RoadmapMonth>;

export const Roadmap = z.object({
  fieldId: z.string(),
  months: z.array(RoadmapMonth).length(6),
});
export type Roadmap = z.infer<typeof Roadmap>;

export const NarrateRequest = z.object({
  profile: SkillProfile,
  fieldId: z.string(),
  simResult: SimResult,
  values: Values,
});
export type NarrateRequest = z.infer<typeof NarrateRequest>;

export const Outcome = z.enum(["thriving", "okay", "struggling"]);
export type Outcome = z.infer<typeof Outcome>;

export const LetterRequest = z.object({
  profile: SkillProfile,
  fieldId: z.string(),
  outcome: Outcome,
  simResult: SimResult,
  values: Values,
  gaps: z.array(Gap),
  market: MarketSignal.optional(),
});
export type LetterRequest = z.infer<typeof LetterRequest>;

export const RoadmapRequest = z.object({
  profile: SkillProfile,
  fieldId: z.string(),
  gaps: z.array(Gap),
  values: Values,
});
export type RoadmapRequest = z.infer<typeof RoadmapRequest>;

export const NarrateResponse = z.object({
  letter: FutureLetter,
  roadmap: Roadmap,
});
export type NarrateResponse = z.infer<typeof NarrateResponse>;
