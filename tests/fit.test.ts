import { describe, expect, it } from "vitest";
import fields from "@/data/fields.json";
import matchesMock from "@/mocks/matches.json";
import skillMapping from "@/mocks/skillMapping.json";
import skillProfile from "@/mocks/skillProfile.json";
import { CLOSENESS_MULTIPLIER, computeMatches, rankByFit, scoreField, weeksToLearn } from "@/features/matching/lib/fit";
import { Field } from "@/lib/fields";
import { SkillMapping, SkillProfile } from "@/features/skills/types";

const field = Field.parse({
  id: "test",
  name: "Test Field",
  family: "software",
  tagline: "t",
  overview: "o",
  dayToDay: ["a", "b"],
  payRange: { min: 1, max: 2, currency: "USD" },
  coreSkills: [
    { name: "React", weight: 3 },
    { name: "CSS", weight: 1 },
    { name: "Solidity", weight: 2 },
    { name: "Accessibility", weight: 2 },
    { name: "Testing", weight: 2 },
  ],
});

const profile = SkillProfile.parse({
  summary: "s",
  seniority: "mid",
  yearsExperience: 3,
  skills: [
    { name: "react", category: "technical", strength: 0.8, evidence: ["x"] },
    { name: "CSS", category: "technical", strength: 0.5, evidence: ["x"] },
    { name: "Web3 Development", category: "domain", strength: 1, evidence: ["x"] },
  ],
});

describe("scoreField", () => {
  it("matches same-named skills exactly, case-insensitive", () => {
    const { rows } = scoreField(field, profile);
    expect(rows.find((r) => r.skill === "React")).toMatchObject({ via: "react", closeness: "exact", strength: 0.8, points: 2.4 });
  });

  it("computes Σ(weight × strength) / Σ(weight)", () => {
    // React 3×0.8 + CSS 1×0.5 = 2.9 over total weight 10
    expect(scoreField(field, profile).fit).toBeCloseTo(0.29, 5);
  });

  it("applies the fixed closeness multipliers to mapped skills", () => {
    const mapping = [{ userSkill: "Web3 Development", vocabSkill: "Solidity", closeness: "partial" as const }];
    const row = scoreField(field, profile, mapping).rows.find((r) => r.skill === "Solidity");
    expect(row).toMatchObject({ via: "Web3 Development", closeness: "partial", strength: CLOSENESS_MULTIPLIER.partial });
  });

  it("uses the best coverage when several skills map to one core skill", () => {
    const mapping = [
      { userSkill: "CSS", vocabSkill: "React", closeness: "related" as const }, // 0.5×0.7 = 0.35 < exact 0.8
    ];
    expect(scoreField(field, profile, mapping).rows[0]).toMatchObject({ via: "react", strength: 0.8 });
  });

  it("ignores mappings for skills the profile does not have", () => {
    const mapping = [{ userSkill: "Kubernetes", vocabSkill: "Testing", closeness: "exact" as const }];
    expect(scoreField(field, profile, mapping).rows.find((r) => r.skill === "Testing")?.strength).toBe(0);
  });
});

describe("computeMatches", () => {
  it("lists gaps below 0.5 with learning estimates", () => {
    const [m] = computeMatches(profile, [field], [], ["test"]);
    expect(m.interested).toBe(true);
    expect(m.gaps.map((g) => [g.skill, g.status])).toEqual([
      ["Solidity", "missing"],
      ["Accessibility", "missing"],
      ["Testing", "missing"],
    ]);
    expect(weeksToLearn(2, 0)).toBe(8);
    expect(weeksToLearn(1, 0.9)).toBe(1);
  });

  it("reproduces mocks/matches.json from the sample profile and mapping", () => {
    const fresh = computeMatches(
      SkillProfile.parse(skillProfile),
      fields.map((f) => Field.parse(f)),
      SkillMapping.array().parse(skillMapping),
      ["frontend", "ai-engineering", "indie-hacker"],
    );
    expect(fresh).toEqual(matchesMock.matches);
  });
});

describe("rankByFit", () => {
  it("sorts by score and gives ties the same rank", () => {
    const ranked = rankByFit([
      { id: "a", fit: 0.3 },
      { id: "b", fit: 0.704 },
      { id: "c", fit: 0.296 },
      { id: "d", fit: 0 },
    ]);
    expect(ranked.map((r) => [r.id, r.rank, r.score])).toEqual([
      ["b", 1, 70],
      ["a", 2, 30],
      ["c", 2, 30],
      ["d", 4, 0],
    ]);
  });
});
