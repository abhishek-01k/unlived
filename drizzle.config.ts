import { defineConfig } from "drizzle-kit";

// Locally the URL lives in .env.local; on Vercel it is already in the environment.
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
