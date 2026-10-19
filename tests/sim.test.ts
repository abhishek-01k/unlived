import { describe, expect, it } from "vitest";
import fields from "@/data/fields.json";
import market from "@/data/market.json";
import matches from "@/mocks/matches.json";
import { FieldList } from "@/lib/fields";
import { FieldMatch } from "@/features/matching/types";
import { MarketSignal } from "@/features/market/types";
import { SimResult, type Values, type WhatIf } from "@/features/simulation/types";
import { buildPaths } from "@/features/simulation/lib/paths";
import { seeded } from "@/features/simulation/lib/random";
import { simulate, type SimPath } from "@/features/simulation/lib/simulate";

const values: Values = { money: 6, stability: 5, learning: 7, freedom: 5, impact: 5 };
const whatIf: WhatIf = { aiDisruption: 0, demandShift: 0, learningSpeed: 1 };

const path = (over: Partial<SimPath> & { fieldId: string }): SimPath => ({
  fit: 0.6,
  gapWeeks: 10,
  demand: 0.6,
  aiRisk: 0.4,
  payMin: 80_000,
  payMax: 160_000,
  freedom: 0.45,
  stability: 0.8,
  ...over,
});

const picks = ["web3-frontend", "frontend", "founding-engineer", "fullstack", "indie-hacker", "ai-engineering"];
const realPaths = buildPaths(
  picks,
  FieldMatch.array().parse(matches.matches),
  MarketSignal.array().parse(market.signals),
  FieldList.parse(fields),
);

describe("seeded random", () => {
  it("repeats for the same seed", () => {
    const a = seeded(42);
    const b = seeded(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("simulate", () => {
  it("returns valid results with outcome shares and win rates that add up", () => {
    const res = simulate(realPaths, values, whatIf);
    expect(res).toHaveLength(picks.length);
    for (const r of res) {
      expect(() => SimResult.parse(r)).not.toThrow();
      expect(r.outcomes.thriving + r.outcomes.okay + r.outcomes.struggling).toBeCloseTo(1, 6);
      expect(r.drivers.length).toBeGreaterThan(0);
    }
    expect(res.reduce((s, r) => s + r.winRate, 0)).toBeGreaterThanOrEqual(1 - 1e-9);
  });

  it("is deterministic for the same seed", () => {
    expect(simulate(realPaths, values, whatIf, { seed: 7 })).toEqual(simulate(realPaths, values, whatIf, { seed: 7 }));
  });

  it("gives a clearly better path near-zero regret and most wins", () => {
    const strong = path({ fieldId: "strong", fit: 0.95, gapWeeks: 0, demand: 0.9, aiRisk: 0.1, payMin: 150_000, payMax: 250_000, freedom: 0.9 });
    const weak = path({ fieldId: "weak", fit: 0.2, gapWeeks: 60, demand: 0.2, aiRisk: 0.8, payMin: 40_000, payMax: 90_000, freedom: 0.3 });
    const [s, w] = simulate([strong, weak], values, whatIf);
    expect(s.expectedRegret).toBeLessThan(0.01);
    expect(s.winRate).toBeGreaterThan(0.95);
    expect(w.expectedRegret).toBeGreaterThan(s.expectedRegret);
  });

  it("changes the ranking when the user's values change", () => {
    const safe = path({ fieldId: "safe", fit: 0.75, gapWeeks: 5, aiRisk: 0.25, payMin: 90_000, payMax: 150_000, freedom: 0.4 });
    const free = path({ fieldId: "free", fit: 0.6, gapWeeks: 15, aiRisk: 0.35, payMin: 0, payMax: 250_000, freedom: 0.95, stability: 0.2 });
    const best = (v: Values) => [...simulate([safe, free], v, whatIf)].sort((a, b) => a.expectedRegret - b.expectedRegret)[0].fieldId;
    expect(best({ money: 3, stability: 10, learning: 0, freedom: 0, impact: 3 })).toBe("safe");
    expect(best({ money: 0, stability: 0, learning: 0, freedom: 10, impact: 3 })).toBe("free");
  });

  it("raises regret for AI-exposed roles when AI disrupts more than expected", () => {
    const exposed = path({ fieldId: "exposed", aiRisk: 0.75 });
    const safe = path({ fieldId: "safe", aiRisk: 0.15 });
    const calm = simulate([exposed, safe], values, { ...whatIf, aiDisruption: -1 })[0];
    const storm = simulate([exposed, safe], values, { ...whatIf, aiDisruption: 1 })[0];
    expect(storm.expectedRegret).toBeGreaterThan(calm.expectedRegret);
    expect(storm.outcomes.struggling).toBeGreaterThan(calm.outcomes.struggling);
  });

  it("helps paths with big gaps when you learn faster", () => {
    const stretch = path({ fieldId: "stretch", fit: 0.4, gapWeeks: 40 });
    const ready = path({ fieldId: "ready", fit: 0.7, gapWeeks: 0 });
    const slow = simulate([stretch, ready], values, { ...whatIf, learningSpeed: 0.5 })[0];
    const fast = simulate([stretch, ready], values, { ...whatIf, learningSpeed: 2 })[0];
    expect(fast.expectedRegret).toBeLessThan(slow.expectedRegret);
  });

  it("runs 50 paths × 500 futures well within one animation frame budget", () => {
    const many = Array.from({ length: 50 }, (_, i) => path({ fieldId: `p${i}`, fit: (i % 10) / 10 }));
    simulate(many, values, whatIf);
    const t = performance.now();
    simulate(many, values, whatIf);
    expect(performance.now() - t).toBeLessThan(100);
  });
});
