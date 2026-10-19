// Pull a JSON value out of a model reply. Models sometimes wrap JSON in
// ```json fences, add a sentence before it, or (reasoning models) emit a
// <think>…</think> block first.
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : cleaned;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to the outermost {...} or [...] span.
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start === -1 || end <= start) throw new Error("No JSON found in model reply");
    return JSON.parse(candidate.slice(start, end + 1));
  }
}
