# Unlived: production plan

> Upload your resume, discover the careers you didn't know you could have, simulate which one you'll regret least, then follow a roadmap to get there.

Started as a Nebius x NVIDIA hackathon project; built to launch as a real product. The logic (AI agents, matching, simulation) comes from the hackathon prototype in `test_hackathon/unlived`. The UI and UX are redesigned from scratch: premium, production-style, with a sidebar dashboard.

## Decisions

| Area | Choice | Notes |
|---|---|---|
| App | Next.js 16 (App Router) + shadcn/ui (Base UI) | Next 16 renamed middleware to `proxy.ts` |
| Hosting | Vercel | Hobby (free) until payments go live; Hobby is non-commercial, so upgrade to Pro (~$20/mo) before Phase 8 |
| Auth | Auth.js v5: Google, GitHub, X | Sign in **before** uploading a resume. Email magic link waits for a domain (launch checklist). X may not return an email, so `users.email` is optional |
| Database | Neon Postgres (free tier) + Drizzle (`neon-http` driver) | Connected through the Vercel Marketplace |
| Cache | Postgres cache tables | Upstash Redis only if rate limiting or traffic needs it (Phase 6+) |
| AI | NVIDIA Nemotron via Nebius Token Factory | Unchanged from the prototype |
| Web data | Tavily | Market demand + learning links |
| Payments | Dodo Payments (merchant of record) | Last phase, after the MVP. Everything is free for the MVP |

## Folder structure

```
src/
  app/
    (marketing)/page.tsx                       landing
    (auth)/sign-in/page.tsx
    (app)/layout.tsx                           sidebar + main shell (signed-in only)
    (app)/analyze/page.tsx                     analysis flow
    (app)/dashboard/page.tsx                   overview
    (app)/dashboard/paths/[fieldId]/page.tsx   one role: roadmap, gaps, learning links
    (app)/dashboard/learning/page.tsx          every skill to learn, across roles
    (app)/dashboard/history/page.tsx           past analyses
    (app)/settings/page.tsx                    account, delete my data
    api/...                                    thin route handlers
  features/<feature>/
    api/          server-only code: agents, DB queries, server actions
    lib/          pure logic, safe in the browser
    components/   UI for this feature
    hooks/
    types.ts      Zod schemas + types
  features: auth, resume, skills, market, matching, simulation, roadmap, resources, dashboard, billing (last)
  components/ui/        shadcn
  components/layout/    shared shell pieces
  lib/                  ai/ (Nemotron), db/ (Drizzle), tavily, fields (role catalogue), format, limits
  data/                 fields.json, skills.json, skill-relations.json, market.json
  mocks/                sample API data (tests, demo mode)
  proxy.ts
tests/                  Vitest
scripts/                smoke test, market snapshot
drizzle/                SQL migrations
```

## Database

| Table | Purpose |
|---|---|
| Auth.js tables | users (email optional), accounts, sessions, verification tokens |
| `analyses` | user, skill profile, picks, values, what-ifs, results (JSON). The resume itself is never stored |
| `roadmaps` | analysis, role, 6 months of items |
| `progress` | user, roadmap item, done date |
| `market_signals` | role → signal, fetched at (24 h cache, shared) ✅ |
| `learning_resources` | skill → links, fetched at (7–30 day cache, shared) |
| `subscriptions` | Phase 8 |

## Dashboard

- **Sidebar:** Overview · My paths (one per picked role) · Learning · History · Settings · user menu.
- **Overview:** lowest-regret path, regret ranking, "Learn once, helps many" (gap skills shared across picks), this week's tasks, overall progress.
- **Path page:** fit / demand / AI risk / regret header, 6-month roadmap with checkboxes, skill gaps with 2–3 learning links each, the future letter.
- **Learning page:** all gap skills across paths, sorted by how many paths they help, with links.

Learning links: Tavily search limited to known learning sites (Coursera, Udemy, freeCodeCamp, YouTube, official docs…), top 3 per skill, cached in `learning_resources`; hand-written fallback for the most common skills. No model-generated URLs.

## Phases

| # | Phase | Done when | State |
|---|---|---|---|
| 0 | Foundation: port logic from the prototype into `features/`, Neon + Drizzle, env | Typecheck, lint, tests, build pass | ✅ |
| 1 | Auth: Auth.js + Drizzle adapter, Google / GitHub / X, `proxy.ts` redirect, `requireUser()` in every action and route. Check Auth.js v5 works with Next 16 and X sign-in works on X's free tier first | Signed-out visitors bounced from `/analyze` and `/dashboard`; all providers work on `.vercel.app` and previews | |
| 2 | Analysis flow, new UI: upload → skills → roles → potential → simulate, each step saved | Refresh mid-flow loses nothing; finished analysis shows in History | |
| 3 | Dashboard shell + overview + path pages; roadmap for the open role first, others in the background (`after()` or parallel client requests) | All picked roles have roadmaps; mobile sidebar works | |
| 4 | Learning links (Tavily + cache + fallback); daily Vercel Cron refreshes `market_signals` | Every gap shows real links; repeat gaps cost no new search | |
| 5 | Progress + history | Progress survives sign-out and device change | |
| 6 | Hardening: per-user daily limits on AI/Tavily, 4 MB upload cap (Vercel body limit 4.5 MB), `maxDuration` on AI routes, error/empty states, privacy + terms, delete account, landing, deploy | A stranger can sign up and use it on the live URL | |
| 7 | Hackathon deliverables: public `/demo` (cached data, no sign-in), README, video | `/demo` works signed out, offline | |
| 8 | Payments: Vercel Pro, Dodo checkout + webhook, `subscriptions`, plan check in `requireUser()`, decide paid features | Test purchase unlocks paid features | |

## Launch checklist

- Buy a domain; add Resend email magic link; update OAuth callback URLs (Google, GitHub, X).
- Vercel Pro before taking payments.
- Upstash Redis if rate limiting gets heavy.

## Risks

- Auth.js v5 is still beta; verify with Next 16 `proxy.ts` on day one of Phase 1.
- X developer access rules change often; drop X if its free tier no longer allows sign-in.
- Every analysis spends Nemotron + Tavily credits even while free: Phase 6 limits are required before public launch.
- `/demo` is the one public exception to sign-in-before-upload.
