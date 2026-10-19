# How Unlived works: the flow

One resume, followed from upload to roadmap: which file runs each step, and why it's built that way.

```
 1 Upload PDF ─► 2 Skill mapping ─► 3 Market data ─► 4 Matching ─► 5 Simulation ─► 6 Letter + roadmap
   (server)        (server)           (server+DB)      (server)       (BROWSER)         (server)
```

Every "server" step is an API route in `src/app/api/<name>/route.ts`. Routes are thin: they check the input, then call the real code in `src/features/`.

---

## 1. Upload: resume → skill profile
`app/api/parse-resume/route.ts`

1. `features/resume/api/pdf.ts`: PDF → plain text.
2. `features/resume/api/redact.ts`: strips name, email, phone, links, address.
   **Why:** personal details never reach the AI.
3. `features/resume/api/parser.ts`: Nemotron Ultra reads the text and returns skills, each with a strength (0–1) and the exact resume lines that prove it.
4. `features/resume/lib/grounding.ts`: checks every quoted line really appears in the resume; skills with made-up proof are dropped.
   **Why:** AI sometimes invents evidence. Code catches it.

**Output:** a `SkillProfile`, the data shape everything after this uses.

## 2. Skill mapping
`app/api/skills-map/route.ts` → `features/skills/api/mapping.ts`

- The app has a fixed list of 95 skills (`data/skills.json`). If you have a skill outside it (e.g. "Web3 Development"), the AI says which listed skills it's close to: exact, related or partial.
- **Why:** without this, unusual skills would score zero. The AI only picks the label; the points come from fixed code, so scores can't be inflated.

## 3. Market data
`app/api/market/route.ts` → `features/market/api/signals.ts`

1. Starts from a saved file covering all 50 roles (`data/market.json`), which is instant.
2. For the roles you picked: checks the database (`market_signals` table). Under 24 hours old → use it.
3. Otherwise `features/market/api/demand.ts` asks Tavily for recent articles, Nemotron scores **demand, trend, AI risk** from them, and the result is saved to the database.

**Why the database:** on Vercel, server memory disappears between requests. The database makes one lookup serve every user for a day.

## 4. Matching
`app/api/match/route.ts`

- `features/matching/lib/fit.ts`: **pure math, no AI.** For each role:
  `fit = Σ(skill weight × your strength) / Σ(weight)`
  Core skills below 0.5 become gaps, each with an estimated number of weeks to learn.
- `features/matching/api/discovery.ts`: Nemotron (reasoning on) looks at strong-fit roles you **didn't** pick and suggests 1–3 "hidden potential" roles backed by your resume lines. Code removes anything not supported by your profile.

## 5. Simulation (in the browser, not the server)
`features/simulation/lib/paths.ts` → `features/simulation/lib/simulate.ts`

- Plays out **500 possible futures**. Each one randomly varies the job market, AI disruption, how fast you learn, and luck.
- Every role gets a score in every future, based on what you care about (money, stability, learning, freedom, impact).
- **Regret** = how much worse a role did than the best role in that same future. Lowest average regret wins.
- **Why in the browser:** it takes ~2 ms, so sliders update instantly with no server call. The same random seed always gives the same result, so it's testable.

## 6. Letter + roadmap
`app/api/letter` and `app/api/roadmap` → `features/roadmap/api/narrator.ts`

- **Letter:** "you, 12 months from now" on a chosen path, streamed word by word.
- **Roadmap:** 6 months, each with what to learn, build and apply for.

---

## The one helper everything uses
`lib/ai/nemotron.ts` → `callJSON()`

Sends a prompt to Nemotron and requires a reply in a fixed JSON format. Then checks the reply in code; if it's wrong, sends the errors back once for a fix.
**Why:** AI output is unreliable. This makes every AI step return clean, typed data or fail clearly.

## Reading order (~30 minutes)
1. `src/app/api/parse-resume/route.ts`: one full request, top to bottom
2. `src/lib/ai/nemotron.ts`: how every AI call works
3. `src/features/resume/lib/grounding.ts`: how AI output is checked
4. `src/features/matching/lib/fit.ts`: the scoring math
5. `src/features/simulation/lib/simulate.ts`: the 500 futures
