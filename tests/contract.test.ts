import { describe, expect, it } from "vitest";
import fields from "@/data/fields.json";
import skills from "@/data/skills.json";
import market from "@/mocks/market.json";
import matches from "@/mocks/matches.json";
import narrate from "@/mocks/narrate.json";
import simResults from "@/mocks/simResults.json";
import skillMapping from "@/mocks/skillMapping.json";
import skillProfile from "@/mocks/skillProfile.json";
import { FieldList } from "@/lib/fields";
import { MarketResponse } from "@/features/market/types";
import { MatchResponse } from "@/features/matching/types";
import { NarrateRequest, NarrateResponse } from "@/features/roadmap/types";
import { SimResult } from "@/features/simulation/types";
import { SkillMapping, SkillProfile, VocabSkill } from "@/features/skills/types";

const fieldIds = new Set(fields.map((f) => f.id));
const vocab = new Set(skills.map((s) => s.name));

describe("data/skills.json", () => {
  it("matches the VocabSkill schema with unique names", () => {
    expect(() => VocabSkill.array().parse(skills)).not.toThrow();
    expect(vocab.size).toBe(skills.length);
  });

  it("every skill is used by at least one field", () => {
    const used = new Set(fields.flatMap((f) => f.coreSkills.map((s) => s.name)));
    expect([...vocab].filter((s) => !used.has(s))).toEqual([]);
  });
});

describe("data/fields.json", () => {
  it("matches the Field schema", () => {
    expect(() => FieldList.parse(fields)).not.toThrow();
  });

  it("has 50 fields with unique ids, covering all 10 families", () => {
    expect(fields).toHaveLength(50);
    expect(fieldIds.size).toBe(fields.length);
    expect(new Set(fields.map((f) => f.family)).size).toBe(10);
  });

  it("only uses skills from the vocabulary", () => {
    for (const f of fields) for (const s of f.coreSkills) expect(vocab.has(s.name), `${f.id}: ${s.name}`).toBe(true);
  });

  it("has sane pay ranges and no duplicate core skills", () => {
    for (const f of fields) {
      expect(f.payRange.min).toBeLessThan(f.payRange.max);
      const names = f.coreSkills.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("mocks match the API contract", () => {
  it("skillProfile.json → SkillProfile", () => {
    expect(() => SkillProfile.parse(skillProfile)).not.toThrow();
  });

  it("skillMapping.json maps real profile skills onto vocabulary skills", () => {
    const mapping = SkillMapping.array().parse(skillMapping);
    const profileSkills = new Set(skillProfile.skills.map((s) => s.name));
    for (const m of mapping) {
      expect(profileSkills.has(m.userSkill), m.userSkill).toBe(true);
      expect(vocab.has(m.vocabSkill), m.vocabSkill).toBe(true);
    }
  });

  it("market.json → MarketResponse, one signal per field", () => {
    const res = MarketResponse.parse(market);
    expect(new Set(res.signals.map((s) => s.fieldId))).toEqual(fieldIds);
  });

  it("matches.json → MatchResponse, one match per field", () => {
    const res = MatchResponse.parse(matches);
    expect(new Set(res.matches.map((m) => m.fieldId))).toEqual(fieldIds);
    for (const h of res.hidden) {
      expect(fieldIds.has(h.fieldId)).toBe(true);
      // Hidden potential means the user did not pick it.
      expect(res.matches.find((m) => m.fieldId === h.fieldId)?.interested).toBe(false);
    }
  });

  it("simResults.json → SimResult[] with win rates summing to 1", () => {
    const res = SimResult.array().parse(simResults);
    for (const r of res) expect(fieldIds.has(r.fieldId)).toBe(true);
    const total = res.reduce((sum, r) => sum + r.winRate, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("narrate.json → NarrateResponse", () => {
    const res = NarrateResponse.parse(narrate);
    expect(fieldIds.has(res.letter.fieldId)).toBe(true);
    expect(res.roadmap.months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("mocks compose into a valid NarrateRequest", () => {
    const simResult = simResults.find((r) => r.fieldId === narrate.letter.fieldId);
    expect(() =>
      NarrateRequest.parse({
        profile: skillProfile,
        fieldId: narrate.letter.fieldId,
        simResult,
        values: { money: 6, stability: 5, learning: 8, freedom: 7, impact: 6 },
      }),
    ).not.toThrow();
  });
});
