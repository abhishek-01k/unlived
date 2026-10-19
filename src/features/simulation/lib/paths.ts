import type { Field } from "@/lib/fields";
import type { FieldMatch } from "@/features/matching/types";
import type { MarketSignal } from "@/features/market/types";
import type { SimPath } from "@/features/simulation/lib/simulate";

// Baseline autonomy by kind of role. Independent work and early startups
// trade stability for freedom.
const FREEDOM: Record<string, number> = {
  "indie-hacker": 0.95,
  "freelance-agency": 0.9,
  "content-creator": 0.9,
  "tech-consulting": 0.85,
  "cto-cofounder": 0.85,
  "founding-engineer": 0.75,
};

export function freedomOf(field: Field): number {
  return FREEDOM[field.id] ?? (field.family === "leadership" ? 0.55 : 0.45);
}

// Baseline job security: an established-company job is the reference (0.8).
const STABILITY: Record<string, number> = {
  "indie-hacker": 0.2,
  "freelance-agency": 0.3,
  "content-creator": 0.25,
  "tech-consulting": 0.45,
  "cto-cofounder": 0.3,
  "founding-engineer": 0.45,
};

export function stabilityOf(field: Field): number {
  return STABILITY[field.id] ?? 0.8;
}

// Turn the user's picks into simulation inputs. Roles without market data
// fall back to neutral demand and risk.
export function buildPaths(
  fieldIds: string[],
  matches: FieldMatch[],
  signals: MarketSignal[],
  fields: Field[],
): SimPath[] {
  return fieldIds.flatMap((id) => {
    const field = fields.find((f) => f.id === id);
    const match = matches.find((m) => m.fieldId === id);
    if (!field || !match) return [];
    const signal = signals.find((s) => s.fieldId === id);
    return [
      {
        fieldId: id,
        fit: match.fit,
        gapWeeks: match.gaps.reduce((sum, g) => sum + g.weeksToLearn, 0),
        demand: signal?.demand ?? 0.5,
        aiRisk: signal?.aiRisk ?? 0.4,
        payMin: field.payRange.min,
        payMax: field.payRange.max,
        freedom: freedomOf(field),
        stability: stabilityOf(field),
      },
    ];
  });
}
