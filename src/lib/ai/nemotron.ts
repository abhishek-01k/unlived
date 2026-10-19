import OpenAI from "openai";
import { z } from "zod";
import { extractJson } from "@/lib/ai/json";

// All AI calls go through NVIDIA Nemotron on Nebius Token Factory
// (OpenAI-compatible API). Base URL and model IDs come from the Token Factory
// console and are set in .env.local, see .env.example.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export const MODELS = {
  get nano() {
    return required("NEMOTRON_NANO_MODEL");
  },
  get super() {
    return required("NEMOTRON_SUPER_MODEL");
  },
  get ultra() {
    return required("NEMOTRON_ULTRA_MODEL");
  },
};

let client: OpenAI | undefined;

export function nemotron(): OpenAI {
  client ??= new OpenAI({
    apiKey: required("NEBIUS_API_KEY"),
    baseURL: required("NEBIUS_BASE_URL"),
  });
  return client;
}

type CallOptions = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  // Nemotron 3 reasons before answering by default. Extraction doesn't need
  // it and runs ~5x faster without; keep it for real reasoning tasks.
  thinking?: boolean;
};

// Ask a model for JSON matching `schema`. Token Factory enforces the JSON
// Schema while decoding (response_format json_schema); we still validate with
// Zod, and on failure retry once with the error appended.
export async function callJSON<S extends z.ZodType>(
  model: string,
  schema: S,
  { system, user, temperature = 0.2, maxTokens = 8192, thinking = false }: CallOptions,
): Promise<z.infer<S>> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${system}\n\nReply with only a JSON value that matches this JSON Schema, no other text:\n${JSON.stringify(jsonSchema)}`,
    },
    { role: "user", content: user },
  ];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    const res = await nemotron().chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_schema", json_schema: { name: "output", schema: jsonSchema, strict: true } },
      // Token Factory passes this to the model's chat template (vLLM extension).
      ...({ chat_template_kwargs: { enable_thinking: thinking } } as object),
    });
    const choice = res.choices[0];
    const text = choice?.message?.content ?? "";
    if (process.env.DEBUG_AI === "true") {
      console.log(
        `[nemotron] ${model} attempt ${attempt + 1}: ${Date.now() - started} ms, finish=${choice?.finish_reason},`,
        `tokens in=${res.usage?.prompt_tokens} out=${res.usage?.completion_tokens}`,
      );
    }
    if (choice?.finish_reason === "length") {
      lastError = `Reply was cut off at max_tokens=${maxTokens}`;
      continue; // a truncated reply can't be repaired by asking again with more text
    }

    try {
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return parsed.data;
      lastError = z.prettifyError(parsed.error);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    messages.push(
      { role: "assistant", content: text },
      { role: "user", content: `That reply was not valid. Fix these problems and reply with only the corrected JSON:\n${lastError}` },
    );
  }

  throw new Error(`Model ${model} did not return valid JSON after a retry: ${lastError}`);
}

// Stream plain text (no JSON), e.g. a letter that types out on screen.
export async function* streamText(
  model: string,
  { system, user, temperature = 0.7, maxTokens = 1200, thinking = false }: CallOptions,
): AsyncGenerator<string> {
  const stream = await nemotron().chat.completions.create({
    model,
    stream: true,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...({ chat_template_kwargs: { enable_thinking: thinking } } as object),
  });
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}
