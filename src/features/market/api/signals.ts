import { gt } from "drizzle-orm";
import snapshot from "@/data/market.json";
import { assessField } from "@/features/market/api/demand";
import { MarketResponse, type MarketSignal } from "@/features/market/types";
import { db } from "@/lib/db";
import { marketSignals } from "@/lib/db/schema";
import { FIELDS } from "@/lib/fields";
import { LIVE_BATCH } from "@/lib/limits";

// Market signals for all roles. The committed snapshot (data/market.json,
// built by `npm run snapshot:market`) covers every role; live Tavily lookups
// run only for the roles a user picks, cached in Postgres for 24 hours so
// every user and every serverless instance shares them.

const SNAPSHOT = MarketResponse.parse(snapshot).signals;
const TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_LIVE = LIVE_BATCH;

// Same-instance de-duplication of lookups that are already running.
const inflight = new Map<string, Promise<MarketSignal>>();

const freshSince = () => new Date(Date.now() - TTL_MS);

async function freshFromDb(): Promise<Map<string, MarketSignal>> {
  const rows = await db().select().from(marketSignals).where(gt(marketSignals.fetchedAt, freshSince()));
  return new Map(rows.map((r) => [r.fieldId, r.signal]));
}

async function refresh(id: string): Promise<MarketSignal> {
  const field = FIELDS.find((f) => f.id === id);
  if (!field) throw new Error(`Unknown field ${id}`);
  let p = inflight.get(id);
  if (!p) {
    p = assessField(field)
      .then(async (signal) => {
        const row = { fieldId: id, signal, fetchedAt: new Date(signal.fetchedAt) };
        await db()
          .insert(marketSignals)
          .values(row)
          .onConflictDoUpdate({ target: marketSignals.fieldId, set: { signal: row.signal, fetchedAt: row.fetchedAt } });
        return signal;
      })
      .finally(() => inflight.delete(id));
    inflight.set(id, p);
  }
  return p;
}

export async function getSignals(liveIds: string[] = []): Promise<{ signals: MarketSignal[]; liveIds: string[]; failed: string[] }> {
  const wanted = [...new Set(liveIds)].filter((id) => FIELDS.some((f) => f.id === id)).slice(0, MAX_LIVE);

  let fresh = new Map<string, MarketSignal>();
  try {
    fresh = await freshFromDb();
  } catch (err) {
    console.error("[market] cache read failed, using snapshot:", err);
  }

  const stale = wanted.filter((id) => !fresh.has(id));
  const results = await Promise.allSettled(stale.map(refresh));
  const failed = stale.filter((_, i) => results[i].status === "rejected");
  results.forEach((r, i) => {
    if (r.status === "fulfilled") fresh.set(stale[i], r.value);
    else console.error(`[market] live lookup failed for ${stale[i]}:`, r.reason);
  });

  const byId = new Map(SNAPSHOT.map((s) => [s.fieldId, s]));
  for (const [id, s] of fresh) byId.set(id, s);
  return {
    signals: FIELDS.map((f) => byId.get(f.id)).filter((s): s is MarketSignal => Boolean(s)),
    liveIds: wanted.filter((id) => !failed.includes(id)),
    failed,
  };
}
