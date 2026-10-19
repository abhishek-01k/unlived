import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Neon over HTTP: no open connections to manage on Vercel's serverless functions.
// Created on first use so builds and tests don't need DATABASE_URL.
let client: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing env var DATABASE_URL. Copy .env.example to .env.local and fill it in.");
  client ??= drizzle(url, { schema });
  return client;
}
