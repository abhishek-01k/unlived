import { z } from "zod";
import { score100 } from "@/lib/format";
import { MODELS, callJSON, streamText } from "@/lib/ai/nemotron";
import { fieldOf } from "@/lib/fields";
import { RoadmapMonth, type LetterRequest, type Outcome, type RoadmapRequest } from "@/features/roadmap/types";
import { type SkillProfile } from "@/features/skills/types";

// The last step: a letter from the user, 12 months from now, on one path and
// in one kind of future (thriving / okay / struggling), plus a 6-month
// roadmap. Grounded in the resume, the simulation and the market data.


const OUTCOME_BRIEF: Record<Outcome, string> = {
  thriving:
    "This is a future where the path went well: the move worked and they are glad they made it.",
  okay: "This is a middling future: some things worked, some did not, and they are still finding their footing.",
  struggling:
    "This is a hard future: the path did not go as hoped. Be honest and kind, say what went wrong and what they would do differently. No false cheerfulness.",
};

function profileBrief(profile: SkillProfile) {
  const evidence = [
    ...new Set(profile.skills.flatMap((s) => s.evidence)),
  ].slice(0, 10);
  return [
    `Who they are now: ${profile.summary} (${profile.seniority}, ${profile.yearsExperience} years)`,
    `Strongest skills: ${profile.skills
      .slice(0, 8)
      .map((s) => s.name)
      .join(", ")}`,
    `Real lines from their resume:\n${evidence.map((e) => `- ${e}`).join("\n")}`,
  ].join("\n");
}

function monthYear(monthsAhead: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const LETTER_SYSTEM = `You write a short letter from a person to their present self, sent from 12 months in the future.

Rules:
- First person, written by future-them to present-them. Warm, specific, plain English. No headings, no lists, no sign-off line (the app adds it).
- Hard limit: 170 words, in 2 or 3 short paragraphs. Shorter is better.
- Ground every detail in the facts given: their real projects and skills, the skills they had to learn, and the job market notes. You may describe plausible events of the year (interviews, a launch, learning a skill), but never invent employers, people's names, or numbers that are not given.
- Match the kind of future you are told. Mention one or two concrete things that made the difference, taken from the simulation reasons and skill gaps.
- Describe companies generically ("an early-stage AI startup"), never by a made-up name.
- Avoid clichés ("journey", "leap of faith", "trust the process"), em dashes, and motivational-poster lines.`;

export function letterPrompt(req: LetterRequest) {
  const field = fieldOf(req.fieldId);
  const r = req.simResult;
  const sim = [
    `Path: ${field.name}. ${field.overview}`,
    `Simulation over 500 futures: thriving ${Math.round(r.outcomes.thriving * 100)}%, okay ${Math.round(r.outcomes.okay * 100)}%, struggling ${Math.round(r.outcomes.struggling * 100)}%. Best choice in ${Math.round(r.winRate * 100)}% of futures.`,
    `Main reasons from the simulation: ${r.drivers.map((d) => `${d.label} (${d.impact >= 0 ? "helps" : "hurts"})`).join("; ")}`,
    `Skills they had to close: ${req.gaps.map((g) => `${g.skill} (≈${g.weeksToLearn} weeks)`).join(", ") || "none"}`,
    req.market
      ? `Job market for this role: demand ${score100(req.market.demand)}/100, ${req.market.trend}, AI risk ${score100(req.market.aiRisk)}/100. ${req.market.reason}`
      : "",
    `What they care about (0–10): money ${req.values.money}, stability ${req.values.stability}, learning ${req.values.learning}, freedom ${req.values.freedom}, impact ${req.values.impact}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    system: LETTER_SYSTEM,
    user: `${profileBrief(req.profile)}\n\n${sim}\n\nThe letter is written in ${monthYear(12)}, a year after they chose this path. ${OUTCOME_BRIEF[req.outcome]}`,
  };
}

// Ultra (reasoning off): first words in ~0.5 s and more specific than Super in tests.
export function streamLetter(req: LetterRequest, model = MODELS.ultra) {
  return streamText(model, {
    ...letterPrompt(req),
    maxTokens: 450,
    temperature: 0.8,
  });
}

const RoadmapOutput = z.object({ months: z.array(RoadmapMonth).length(6) });

const ROADMAP_SYSTEM = `You turn a career move into a practical 6-month plan.

For each month 1–6 give: theme (max 6 words), learn (1–2 items), build (1–2 items), apply (0–2 items: applications, outreach, talks, publishing).
- Close the listed skill gaps first, biggest first, spread over the months.
- "build" items should be concrete projects that reuse their real past work where it fits.
- "apply" starts light and grows; months 5–6 should include real applications or launches.
- Each item is one short, specific line (max 14 words). No vague items like "network more".`;

export async function makeRoadmap(req: RoadmapRequest, model = MODELS.ultra) {
  const field = fieldOf(req.fieldId);
  const user = [
    profileBrief(req.profile),
    `Target path: ${field.name}. ${field.overview}`,
    `Core skills of the role: ${field.coreSkills.map((s) => s.name).join(", ")}`,
    `Skill gaps to close: ${req.gaps.map((g) => `${g.skill} (${g.status}, ≈${g.weeksToLearn} weeks)`).join(", ") || "none: focus on positioning and applying"}`,
    `What they care about (0–10): money ${req.values.money}, stability ${req.values.stability}, learning ${req.values.learning}, freedom ${req.values.freedom}, impact ${req.values.impact}`,
  ].join("\n\n");
  const { months } = await callJSON(model, RoadmapOutput, {
    system: ROADMAP_SYSTEM,
    user,
    maxTokens: 3000,
  });
  return {
    fieldId: req.fieldId,
    months: months.map((m, i) => ({ ...m, month: i + 1 })),
  };
}
