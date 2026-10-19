# Decisions

One entry per decision: **what** we chose, **why**, what else we could have done, and an honest **verdict**. Newest at the bottom. When a decision changes, don't delete it: mark it *Replaced by #N*.

Verdicts: ✅ best option for us · ⚖️ fine, with a known trade-off · ⚠️ needs checking

---

### 1. Reuse the prototype's logic, redesign all UI · 2026-10-19
- **Why:** the AI agents, matching and simulation already work and have 54 tests. Only the screens and UX are being replaced.
- **Instead:** rewrite everything from scratch (slower, same result).
- **Verdict:** ✅

### 2. Feature-based folders · 2026-10-19
- **Why:** your usual structure. Each feature (`resume`, `skills`, `market`, `matching`, `simulation`, `roadmap`, …) keeps its code together.
- **Rule:** `api/` = runs only on the server (AI calls, database). `lib/` = pure logic, safe in the browser (fit math, simulation). `types.ts` = the feature's data shapes.
- **Verdict:** ✅

### 3. Split the old `schemas.ts` into one `types.ts` per feature · 2026-10-19
- **Why:** fits rule #2. The role catalogue (`Field`, `FIELDS`, `fieldOf`) became shared `src/lib/fields.ts`, since every feature uses it.
- **Instead:** keep one shared `schemas.ts`.
- **Verdict:** ⚖️ Features now import each other's types (e.g. `roadmap` imports from `skills`, `matching`, `simulation`). Fine as long as it never becomes circular.

### 4. Auth.js v5 with Google, GitHub, X · 2026-10-19
- **Why:** free and open source, data stays in our own database.
- **Instead:** Clerk (fastest, but paid as you grow), Better Auth (similar, newer, often smoother on the newest Next.js).
- **Email magic link:** later. It needs a domain to send email from.
- **X:** may not return an email address, so `users.email` must be optional and X accounts won't auto-merge with Google/GitHub accounts.
- **Verdict:** ⚠️ Auth.js v5 is still beta; confirm it works with Next 16's `proxy.ts` and our database driver at the start of Phase 1. If it fights us, Better Auth is the fallback.

### 5. Sign in before uploading a resume · 2026-10-19
- **Why:** everything is saved to the account from the first step.
- **Instead:** let people try first, ask to sign in before the dashboard (usually more sign-ups).
- **Verdict:** ⚖️ Your call. `/demo` stays public so judges and visitors can see the app without an account.

### 6. Neon Postgres + Drizzle, `neon-http` driver · 2026-10-19
- **Why:** cheapest (free tier, sleeps when idle). The HTTP driver needs no open connections, which suits Vercel's short-lived functions. Drizzle gives typed queries and plain SQL migrations.
- **Instead:** Supabase (free projects pause after a week of no use), Convex (no SQL, different model).
- **Verdict:** ✅ for cost and Vercel. ⚠️ `neon-http` can't run multi-step transactions. Check Auth.js's database adapter doesn't need them in Phase 1.

### 7. Cache in Postgres tables, not Redis · 2026-10-19
- **Why:** what we cache (market data, learning links) changes daily or weekly. The slow part is the AI and search calls, not the database read. One less service to pay for.
- **Instead:** Upstash Redis.
- **Verdict:** ✅ for the MVP. Add Upstash when rate limiting or traffic needs it.

### 8. Market cache moved from server memory to Postgres · 2026-10-19
- **Why:** on Vercel each server instance has its own short-lived memory, so the old in-memory cache was mostly empty. Now one lookup serves every user for 24 h. If the database is down, the app falls back to the saved snapshot instead of failing.
- **Verdict:** ✅ ⚖️ The "lookup already running" de-duplication is still per server instance, so two users at the same second on different instances can both trigger a search. Rare and cheap; ignore for now.

### 9. Host on Vercel · 2026-10-19
- **Why:** built for Next.js, free to start, preview URL per branch.
- **Trade-off:** the free (Hobby) plan is non-commercial. Upgrade to Pro (~$20/mo) before taking payments.
- **Limits to design around:** ~4.5 MB request size (cap PDFs at 4 MB), function time limits (set `maxDuration`), no always-on background workers.
- **Verdict:** ✅

### 10. Payments with Dodo Payments, last · 2026-10-19
- **Why:** a merchant of record handles global sales tax for us, and it supports Indian sellers. Everything is free until the MVP is solid.
- **Instead:** Stripe (limited for Indian businesses), Lemon Squeezy, Razorpay.
- **Verdict:** ✅

### 11. Housekeeping from Phase 0 · 2026-10-19
- Node type definitions pinned to v22 to match your Node version (Vitest required it).
- Old tests kept in a root `tests/` folder; the old story-cards logic and client API helper were not copied (they belonged to the old UI).
- `drizzle.config.ts` loads `.env.local` itself, because the migration tool doesn't.
- Neon's pooled URL is fine with our HTTP driver.
- **Verdict:** ✅
