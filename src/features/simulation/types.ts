import { z } from "zod";
import { unit } from "@/lib/format";

const slider = z.number().int().min(0).max(10);

export const Values = z.object({
  money: slider,
  stability: slider,
  learning: slider,
  freedom: slider,
  impact: slider,
});
export type Values = z.infer<typeof Values>;

export const WhatIf = z.object({
  aiDisruption: z.number().min(-1).max(1), // shifts every field's aiRisk
  demandShift: z.number().min(-1).max(1), // shifts every field's demand
  learningSpeed: z.number().min(0.5).max(2), // 1 = average learner
});
export type WhatIf = z.infer<typeof WhatIf>;

export const Driver = z.object({
  label: z.string().min(1),
  impact: z.number().min(-1).max(1), // negative raises regret, positive lowers it
});
export type Driver = z.infer<typeof Driver>;

export const SimResult = z.object({
  fieldId: z.string(),
  expectedRegret: unit,
  worstRegret: unit,
  winRate: unit, // share of worlds where this field scored best
  outcomes: z.object({ thriving: unit, okay: unit, struggling: unit }),
  distribution: z.array(unit), // per-world scores, for histograms
  drivers: z.array(Driver),
});
export type SimResult = z.infer<typeof SimResult>;
