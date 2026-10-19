import type { SimResult, Values, WhatIf } from "@/features/simulation/types";
import { clamp01, normal, seeded } from "@/features/simulation/lib/random";

// The Monte Carlo engine. Each "future" (world) is one guess at how the next
// 12 months go: the job market, how much AI changes each role, how fast you
// learn, and luck. Every path (role) gets an outcome in every future; regret
// is how much worse a path did than the best path in that same future.
// Pure function, deterministic for a given seed.

export const DEFAULT_WORLDS = 500;

export type SimPath = {
  fieldId: string;
  fit: number; // 0–1 skill match
  gapWeeks: number; // learning time to close gaps at average speed
  demand: number; // 0–1 market demand today
  aiRisk: number; // 0–1
  payMin: number; // USD per year
  payMax: number;
  freedom: number; // 0–1 baseline autonomy of the role
  stability: number; // 0–1 baseline job security of the role (startups and independent work are lower)
};

// Assumptions, in one place so the "Why?" panel and the docs can cite them.
export const ASSUMPTIONS = {
  horizonWeeks: 52, // one year
  rampWeeks: 78, // gap weeks at which you are only half ready within the year
  demandNoise: 0.12, // how far a role's demand can drift in a year (1 sd)
  aiNoise: 0.1,
  learnNoise: 0.25, // spread of learning speed (log scale)
  luck: 0.18, // spread of outcomes from luck alone
  payScale: 300_000,
  thriving: 0.65, // outcome thresholds
  struggling: 0.35,
} as const;

const DIMENSIONS = [
  "money",
  "stability",
  "learning",
  "freedom",
  "impact",
] as const;
type Dim = (typeof DIMENSIONS)[number];

const DIM_LABEL: Record<Dim, string> = {
  money: "pay potential",
  stability: "stability",
  learning: "room to learn",
  freedom: "freedom",
  impact: "impact",
};

type Options = { worlds?: number; seed?: number };

export function simulate(
  paths: SimPath[],
  values: Values,
  whatIf: WhatIf,
  { worlds = DEFAULT_WORLDS, seed = 1 }: Options = {},
): SimResult[] {
  const n = paths.length;
  if (n === 0) return [];
  const rng = seeded(seed);
  const A = ASSUMPTIONS;
  const weightSum = DIMENSIONS.reduce((s, d) => s + values[d], 0) || 1;

  const scores = paths.map(() => new Float64Array(worlds));
  const regretSum = new Float64Array(n);
  const regrets = paths.map(() => new Float64Array(worlds));
  const wins = new Float64Array(n);
  const buckets = paths.map(() => ({ thriving: 0, okay: 0, struggling: 0 }));
  const dimSum = paths.map(
    () =>
      Object.fromEntries(DIMENSIONS.map((d) => [d, 0])) as Record<Dim, number>,
  );
  const world = new Float64Array(n);

  for (let w = 0; w < worlds; w++) {
    // Shared by every path in this future: the economy and you.
    const aiShock = whatIf.aiDisruption * 0.35 + 0.08 * normal(rng);
    const demandShock = whatIf.demandShift * 0.3 + 0.06 * normal(rng);
    const learnSpeed =
      whatIf.learningSpeed * Math.exp(A.learnNoise * normal(rng));

    let best = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = paths[i];
      const demand = clamp01(
        p.demand + demandShock + A.demandNoise * normal(rng),
      );
      const ai = clamp01(
        p.aiRisk + aiShock * (0.5 + p.aiRisk) + A.aiNoise * normal(rng),
      );
      const ready = clamp01(1 - p.gapWeeks / learnSpeed / A.rampWeeks);
      const capability = 0.65 * p.fit + 0.35 * ready;

      // Chance this path goes well, then luck.
      const z =
        5 * (capability - 0.45) + 1.5 * (demand - 0.5) - 1.5 * (ai - 0.4);
      const q = clamp01(1 / (1 + Math.exp(-z)) + A.luck * normal(rng));

      // How the outcome feels on each thing the user cares about (0–1).
      const spread = p.payMax > 0 ? (p.payMax - p.payMin) / p.payMax : 0;
      const pay =
        (p.payMin + (p.payMax - p.payMin) * Math.pow(q, 1 + 2 * spread)) /
        A.payScale;
      const dims: Record<Dim, number> = {
        money: clamp01(pay),
        stability:
          clamp01(0.35 * (1 - ai) + 0.25 * demand + 0.4 * p.stability) *
          (0.5 + 0.5 * q),
        learning: clamp01((1 - p.fit) * 1.5) * (0.4 + 0.6 * ready),
        freedom: p.freedom * (0.7 + 0.3 * q),
        impact: q * (0.6 + 0.4 * demand),
      };
      let score = 0;
      for (const d of DIMENSIONS) {
        score += values[d] * dims[d];
        dimSum[i][d] += dims[d];
      }
      score /= weightSum;

      world[i] = score;
      scores[i][w] = score;
      if (score > best) best = score;
      const b = buckets[i];
      if (q >= A.thriving) b.thriving++;
      else if (q < A.struggling) b.struggling++;
      else b.okay++;
    }
    for (let i = 0; i < n; i++) {
      const r = best - world[i];
      regrets[i][w] = r;
      regretSum[i] += r;
      if (r === 0) wins[i]++;
    }
  }

  const avgDim = dimSum.map(
    (d) =>
      Object.fromEntries(DIMENSIONS.map((k) => [k, d[k] / worlds])) as Record<
        Dim,
        number
      >,
  );

  return paths.map((p, i) => {
    const sortedScores = Array.from(scores[i]).sort((a, b) => a - b);
    const sortedRegret = Array.from(regrets[i]).sort((a, b) => a - b);
    return {
      fieldId: p.fieldId,
      expectedRegret: clamp01(regretSum[i] / worlds),
      worstRegret: clamp01(sortedRegret[Math.floor(0.9 * (worlds - 1))]), // bad case: 1 in 10 futures
      winRate: wins[i] / worlds,
      outcomes: {
        thriving: buckets[i].thriving / worlds,
        okay: buckets[i].okay / worlds,
        struggling: buckets[i].struggling / worlds,
      },
      distribution: Array.from(
        { length: 40 },
        (_, k) => sortedScores[Math.floor(((k + 0.5) / 40) * worlds)],
      ),
      drivers: drivers(paths, i, values, avgDim),
    };
  });
}

// The 2–3 biggest reasons a path does better or worse than your other paths.
function drivers(
  paths: SimPath[],
  i: number,
  values: Values,
  avgDim: Record<Dim, number>[],
) {
  const mean = (f: (p: SimPath) => number) =>
    paths.reduce((s, p) => s + f(p), 0) / paths.length;
  const p = paths[i];
  const pct = (x: number) => Math.round(x * 100);
  const weightSum = DIMENSIONS.reduce((s, d) => s + values[d], 0) || 1;

  const candidates = [
    {
      label: `Skill match ${pct(p.fit)}/100`,
      impact: (p.fit - mean((x) => x.fit)) * 1.2,
    },
    {
      label: `Market demand ${pct(p.demand)}/100`,
      impact: (p.demand - mean((x) => x.demand)) * 0.8,
    },
    {
      label: `AI risk ${pct(p.aiRisk)}/100`,
      impact: -(p.aiRisk - mean((x) => x.aiRisk)) * 0.8,
    },
    {
      label:
        p.gapWeeks === 0
          ? "No skill gaps to close"
          : `≈${Math.round(p.gapWeeks)} weeks of skill gaps`,
      impact:
        -((p.gapWeeks - mean((x) => x.gapWeeks)) / ASSUMPTIONS.horizonWeeks) *
        0.8,
    },
    ...DIMENSIONS.filter((d) => values[d] > 0).map((d) => {
      const avg = avgDim.reduce((s, a) => s + a[d], 0) / avgDim.length;
      const diff = avgDim[i][d] - avg;
      return {
        label: `${diff >= 0 ? "Strong" : "Weak"} on ${DIM_LABEL[d]} (you rated it ${values[d]}/10)`,
        impact: diff * 2 * (values[d] / weightSum) * DIMENSIONS.length,
      };
    }),
  ];

  return candidates
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 3)
    .map((c) => ({
      label: c.label,
      impact: Math.max(-1, Math.min(1, Math.round(c.impact * 100) / 100)),
    }));
}
