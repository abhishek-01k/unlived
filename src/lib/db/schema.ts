import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { MarketSignal } from "@/features/market/types";

// Live market signal per role, shared by all users. Refreshed when older than 24 h.
export const marketSignals = pgTable("market_signals", {
  fieldId: text("field_id").primaryKey(),
  signal: jsonb("signal").$type<MarketSignal>().notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});
