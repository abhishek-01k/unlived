import { describe, expect, it } from "vitest";
import { tidyLetter } from "@/features/roadmap/lib/letter";

describe("tidyLetter", () => {
  it("replaces em dashes with commas", () => {
    expect(tidyLetter("It was October 2027—a good year — mostly.")).toBe("It was October 2027, a good year, mostly.");
  });

  it("drops a sign-off line the model added", () => {
    expect(tidyLetter("Keep going.\n\n— Future You")).toBe("Keep going.");
    expect(tidyLetter("Keep going.\n- You, October 2027")).toBe("Keep going.");
  });

  it("keeps normal text that mentions you", () => {
    expect(tidyLetter("I owe this to you.\nYou were right to start.")).toBe("I owe this to you.\nYou were right to start.");
  });
});
