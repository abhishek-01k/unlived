# Unlived: how the whole project works

> Upload your resume, discover the careers you didn't know you could have, and simulate which one you'll regret least.

This file explains Unlived from start to finish: what it does, how each screen works, where the AI comes in, how the numbers are calculated, and where to find things in the code. For the product plan see [`PLAN.md`](PLAN.md). For build progress see [`EXECUTION.md`](EXECUTION.md). For how to run and deploy it see [`README.md`](README.md).

---

## 1. The problem

Most people choosing a career, or wondering whether to switch, have two problems:

1. **They only consider roles they already know about.** A frontend developer compares "senior frontend" and "full-stack", but never notices that their side projects make them a strong fit for founding engineer or developer advocate.
2. **They can't compare futures.** Every path has unknowns: AI might reshape the role, hiring might cool, learning might take longer than hoped. People end up choosing on gut feel and worrying about regret later.

Unlived tackles both. It reads your resume, shows you every tech role ranked by how well you already fit, points out roles you didn't think of, then plays out **500 possible futures** for the roles you pick to show which one you're least likely to regret.

Built for the **Nebius x NVIDIA Global AI Hackathon**. All AI runs on **NVIDIA Nemotron via Nebius Token Factory**. Live job-market data comes from **Tavily**.

---

## 2. The user journey (6 screens)

```
Upload → Skills → Fields → Potential → Simulate → Future
```

| # | Screen | What you see | What happens behind it |
|---|---|---|---|
| 1 | **Upload** | Drop a PDF resume, or try the sample | PDF → text, personal details removed, Nemotron Ultra builds a skill profile (~7 s) |
| 2 | **Skills** | Your skills, each with a strength score out of 100 and the resume line that proves it | Evidence is checked against your resume. Anything made up is dropped |
| 3 | **Fields** | All 50 tech roles ranked by skill match, with live market demand. You pick **at least 5** (no upper limit) | Skill match is plain code (instant). Market data comes from a stored snapshot plus a live Tavily refresh for your picks |
| 4 | **Potential** | Spotify Wrapped-style story cards: your top match, your rank, **hidden potential** (roles you didn't pick but fit) | Nemotron Ultra (with reasoning) compares your resume against roles you skipped (~10 s) |
| 5 | **Simulate** | A tree of your paths branching into thriving / okay / struggling, a regret ranking, a "Why?" panel, and sliders for what you value and what-if scenarios | 500-future Monte Carlo simulation in the browser (~2 ms, so sliders update live) |
| 6 | **Future** | A letter from you, a year from now, for any path and outcome, plus a 6-month roadmap | Nemotron Ultra streams the letter word by word (~3–7 s) and writes the roadmap (~3 s) |

---

## 3. Architecture

```
Browser (Next.js client components)
 │   flow state: app/analyze/state.tsx
 │   skill match + simulation run here (pure TypeScript, no network)
 │
 ├── POST /api/parse-resume ─► unpdf → redact → Nemotron Ultra (parser) → grounding check
 ├── POST /api/skills-map   ─► Nemotron Ultra maps skills outside the vocabulary
 ├── POST /api/market       ─► snapshot (data/market.json) + live Tavily → Nemotron Ultra
 ├── POST /api/match        ─► skill match (code) + Nemotron Ultra discovery (hidden potential)
 ├── POST /api/letter       ─► Nemotron Ultra, streamed as plain text
 └── POST /api/roadmap      ─► Nemotron Ultra, JSON
```

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Zod 4, the `openai` SDK pointed at Token Factory, `@tavily/core`, `unpdf`, Vitest.
