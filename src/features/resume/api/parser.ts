import skills from "@/data/skills.json";
import { MODELS, callJSON } from "@/lib/ai/nemotron";
import { SkillProfile } from "@/features/skills/types";
import { groundProfile } from "@/features/resume/lib/grounding";

const VOCABULARY = Object.entries(
  skills.reduce<Record<string, string[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s.name);
    return acc;
  }, {}),
)
  .map(([category, names]) => `${category}: ${names.join(", ")}`)
  .join("\n");

const SYSTEM = `You read resumes and extract a skill profile.

Skill names:
- Use names from this vocabulary whenever one fits. Group specific tools under the closest vocabulary skill: e.g. Zustand, Redux, React Query → "Frontend Architecture"; Next.js → "React"; Tailwind → "CSS"; Jest, Cypress → "Testing"; LangChain, LangGraph → "AI Agents"; Docker → "Docker / Kubernetes".
- Only invent a new name for a real, important skill that no vocabulary skill covers (e.g. "Web3 Development"). Never list single libraries as skills.
${VOCABULARY}

Evidence:
- Every skill needs at least one "evidence" entry copied word for word from the resume (a full line or a clear part of one). Never paraphrase or invent evidence.
- Prefer achievement lines from experience and projects over the skills list.

Strength (0 to 1), judged from the evidence, not from how often a word appears:
- 0.2–0.3: only named in a skills list, or a minor mention
- 0.4–0.6: used in real work or projects
- 0.7–0.8: owned or led meaningful work with it
- 0.85–1: deep expertise with clear, measurable results (users, revenue, speed-ups, scale)

Also:
- Include non-technical skills the resume proves: leadership, launching and monetising products, rapid prototyping (e.g. hackathon wins), writing, speaking, mentoring, sales.
- years only when the resume makes it clear.
- List the 12–20 most important skills, strongest first.
- summary: 1–2 sentences about the person's career so far, third person, no name.
- Personal details were replaced with tokens like [NAME] or [EMAIL]. Ignore them.`;

// Ultra with reasoning off: follows the vocabulary and strength rules far
// better than Nano or Super on real resumes, in ~7 s (measured).
export async function parseResume(resumeText: string) {
  const raw = await callJSON(MODELS.ultra, SkillProfile, {
    system: SYSTEM,
    user: `Resume:\n"""\n${resumeText}\n"""`,
    maxTokens: 8000,
  });

  const { profile, droppedSkills } = groundProfile(raw, resumeText);
  if (profile.skills.length === 0) {
    throw new Error("No skills with evidence found in the resume");
  }
  return { profile: SkillProfile.parse(profile), droppedSkills };
}
