import { tavily } from "@tavily/core";

type Client = ReturnType<typeof tavily>;
let client: Client | undefined;

export function tavilyClient(): Client {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Missing env var TAVILY_API_KEY. Copy .env.example to .env.local and fill it in.");
  client ??= tavily({ apiKey });
  return client;
}

export type WebResult = { title: string; url: string; content: string };

// Run several searches and merge the results, best first, without duplicates.
export async function searchWeb(queries: string[], perQuery = 4): Promise<WebResult[]> {
  const responses = await Promise.all(
    queries.map((q) =>
      tavilyClient().search(q, {
        searchDepth: "basic",
        maxResults: perQuery,
        timeRange: "year",
        excludeDomains: ["youtube.com", "tiktok.com", "instagram.com"],
      }),
    ),
  );
  const seen = new Set<string>();
  return responses
    .flatMap((r) => r.results)
    .sort((a, b) => b.score - a.score)
    .filter((r) => !seen.has(r.url) && seen.add(r.url))
    .map((r) => ({ title: r.title, url: r.url, content: r.content }));
}
