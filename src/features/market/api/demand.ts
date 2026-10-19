import { z } from "zod";
import { MODELS, callJSON } from "@/lib/ai/nemotron";
import type { Field } from "@/lib/fields";
import type { MarketSignal } from "@/features/market/types";
import { searchWeb, type WebResult } from "@/lib/tavily";

// Live market signal for one role: Tavily finds recent articles, Nemotron
// Nano reads them and scores demand, trend and AI risk. Every number must be
// traceable to the sources it cites.

const Assessment = z.object({
  demand: z.number().min(0).max(1),
  trend: z.enum(["shrinking", "stable", "growing"]),
  aiRisk: z.number().min(0).max(1),
  reason: z.string().min(1),
  confidence: z.enum(["low", "medium", "high"]),
  sourceIndexes: z.array(z.number().int().min(1)).min(1),
});

const SYSTEM = `You assess the job market for one tech role, using only the numbered sources given.

- demand (0 to 1): how much hiring there is for this role right now. 0.2 = few openings, 0.5 = steady, 0.8+ = very hot.
- trend: is hiring for this role growing, stable or shrinking over the last year?
- aiRisk (0 to 1): how likely AI tools are to reduce the number of people needed in this role. This is NOT about whether the role works with AI: building AI products is low risk if demand for those builders grows. 0.2 = AI makes them more valuable, 0.5 = some tasks automated, 0.8+ = much of the job is being automated away.
- Individual job postings are not evidence of low demand; judge demand from reports, trends and hiring data.
- reason: one plain sentence (max 25 words) a job seeker can understand, saying what drives these numbers.
- sourceIndexes: the numbers of the sources that support your answer.

- confidence: high = several sources give hiring data or clear trends for this exact role; medium = indirect or partial evidence; low = the sources barely cover this role.
- Use the full 0–1 range and two decimals. Roles differ a lot; do not default to 0.5. If evidence is thin, still give your best estimate and set confidence to low.

Calibration examples (typical for 2026, adjust to the sources): AI Engineer demand 0.85, aiRisk 0.15. Game Developer demand 0.25. QA tester (manual) aiRisk 0.7.`;

export function queriesFor(field: Field): string[] {
  return [`${field.name} job market trends and hiring demand 2026`, `how AI is changing ${field.name} jobs`];
}

export async function assessField(field: Field, results?: WebResult[], model = MODELS.ultra): Promise<MarketSignal> {
  const sources = (results ?? (await searchWeb(queriesFor(field)))).slice(0, 8);
  if (sources.length === 0) throw new Error(`No search results for ${field.name}`);

  const numbered = sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.url}\n${s.content.slice(0, 900)}`).join("\n\n");
  const a = await callJSON(model, Assessment, {
    system: SYSTEM,
    user: `Role: ${field.name}\nWhat it is: ${field.overview}\n\nSources:\n${numbered}`,
    maxTokens: 1500,
  });

  // Only keep sources the model was actually given.
  const cited = [...new Set(a.sourceIndexes)].filter((i) => i >= 1 && i <= sources.length).map((i) => sources[i - 1]);
  const used = cited.length > 0 ? cited : sources.slice(0, 2);

  return {
    fieldId: field.id,
    demand: a.demand,
    trend: a.trend,
    aiRisk: a.aiRisk,
    reason: a.reason,
    confidence: a.confidence,
    sources: used.slice(0, 4).map((s) => ({ title: s.title, url: s.url })),
    fetchedAt: new Date().toISOString(),
  };
}
