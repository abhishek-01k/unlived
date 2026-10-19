import { describe, expect, it } from "vitest";
import { score100 } from "@/lib/format";

describe("score100", () => {
  it("turns 0–1 into a whole number out of 100", () => {
    expect(score100(0.653)).toBe(65);
    expect(score100(0.629)).toBe(63);
    expect(score100(1)).toBe(100);
  });

  it("clamps out-of-range values", () => {
    expect(score100(-0.2)).toBe(0);
    expect(score100(1.4)).toBe(100);
  });
});
