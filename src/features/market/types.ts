import { z } from "zod";
import { unit } from "@/lib/format";

export const Source = z.object({
  title: z.string().min(1),
  url: z.url(),
});
export type Source = z.infer<typeof Source>;

export const MarketSignal = z.object({
  fieldId: z.string(),
  demand: unit, // 0 = few openings, 1 = very hot
  trend: z.enum(["shrinking", "stable", "growing"]),
  aiRisk: unit, // 0 = AI barely touches it, 1 = heavily automatable
  reason: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  sources: z.array(Source),
  fetchedAt: z.iso.datetime(),
});
export type MarketSignal = z.infer<typeof MarketSignal>;

export const MarketResponse = z.object({
  signals: z.array(MarketSignal),
  liveIds: z.array(z.string()), // roles refreshed live in this response; the rest come from the snapshot
  failed: z.array(z.string()).default([]), // live lookups that failed and fell back to the snapshot
});
export type MarketResponse = z.infer<typeof MarketResponse>;
