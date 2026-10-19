import { z } from "zod";

// Scores are stored as 0–1 (the simulation math uses them that way) and
// shown to people as whole numbers out of 100.
export const unit = z.number().min(0).max(1);

export function score100(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100);
}
