// Step 0 smoke test: checks the Token Factory key, base URL and each Nemotron
// model ID. Run with `npm run smoke` after filling in .env.local.
import { z } from "zod";
import { MODELS, callJSON, nemotron } from "@/lib/ai/nemotron";

async function main() {
  for (const [label, model] of Object.entries({ nano: MODELS.nano, super: MODELS.super, ultra: MODELS.ultra })) {
    const started = Date.now();
    const res = await nemotron().chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with exactly: Unlived is alive." }],
      max_tokens: 256,
    });
    const reply = res.choices[0]?.message?.content?.trim();
    console.log(`${label.padEnd(5)} ${model} (${Date.now() - started} ms): ${reply}`);
  }

  const started = Date.now();
  const out = await callJSON(MODELS.nano, z.object({ skills: z.array(z.string()).min(1) }), {
    system: "You extract skills from text.",
    user: "I build React apps in TypeScript and write blog posts about CSS.",
  });
  console.log(`callJSON nano (${Date.now() - started} ms):`, out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
