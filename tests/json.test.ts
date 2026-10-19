import { describe, expect, it } from "vitest";
import { extractJson } from "@/lib/ai/json";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON", () => {
    expect(extractJson('Here you go:\n```json\n{"a":[1,2]}\n```')).toEqual({ a: [1, 2] });
  });

  it("drops <think> blocks", () => {
    expect(extractJson('<think>let me {reason}</think>\n{"ok":true}')).toEqual({ ok: true });
  });

  it("finds JSON surrounded by prose", () => {
    expect(extractJson('Sure! {"x":"y"} Hope that helps.')).toEqual({ x: "y" });
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});
