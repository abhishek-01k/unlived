// Builds src/data/market.json: a live Tavily + Nemotron signal for every role.
// Run before the demo with `npm run snapshot:market`. Roles that fail keep
// their previous snapshot entry.
import { writeFileSync } from "node:fs";
import previous from "@/data/market.json";
import { assessField } from "@/features/market/api/demand";
import { FIELDS } from "@/lib/fields";
import { MarketResponse, type MarketSignal } from "@/features/market/types";

const OLD = new Map(MarketResponse.parse(previous).signals.map((s) => [s.fieldId, s]));
const CONCURRENCY = 5;

async function main() {
  const only = process.argv.slice(2);
  const todo = only.length ? FIELDS.filter((f) => only.includes(f.id)) : FIELDS;
  const out = new Map<string, MarketSignal>(OLD);
  const failed: string[] = [];
  let next = 0;

  async function worker() {
    while (next < todo.length) {
      const field = todo[next++];
      const started = Date.now();
      try {
        const s = await assessField(field);
        out.set(field.id, s);
        console.log(`✓ ${field.id.padEnd(30)} demand ${s.demand.toFixed(2)} ${s.trend.padEnd(9)} aiRisk ${s.aiRisk.toFixed(2)} (${Date.now() - started} ms)`);
      } catch (err) {
        failed.push(field.id);
        console.error(`✗ ${field.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const signals = FIELDS.map((f) => out.get(f.id)).filter((s): s is MarketSignal => Boolean(s));
  const body = MarketResponse.parse({ signals, liveIds: [], failed: [] });
  writeFileSync(new URL("../src/data/market.json", import.meta.url), JSON.stringify(body, null, 2) + "\n");
  console.log(`\nWrote ${signals.length} signals to src/data/market.json. Failed: ${failed.length ? failed.join(", ") : "none"}`);
  if (failed.length) process.exitCode = 1;
}

main();
