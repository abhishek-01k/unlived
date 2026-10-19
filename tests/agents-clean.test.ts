import { describe, expect, it } from "vitest";
import relations from "@/data/skill-relations.json";
import skills from "@/data/skills.json";
import { cleanHidden } from "@/features/matching/api/discovery";
import { cleanMappings } from "@/features/skills/api/mapping";
import type { SkillProfile } from "@/features/skills/types";

const profile: SkillProfile = {
  summary: "s",
  seniority: "senior",
  yearsExperience: 4,
  skills: [
    { name: "Web3 Development", category: "domain", strength: 0.8, evidence: ["Shipped the first exchange on Push Chain"] },
    { name: "React", category: "technical", strength: 0.9, evidence: ["Built 20+ React components"] },
  ],
};

describe("cleanMappings", () => {
  it("keeps known user → vocabulary mappings and fixes casing", () => {
    expect(cleanMappings([{ userSkill: "web3 development", vocabSkill: "web3 libraries", closeness: "related" }], profile)).toEqual([
      { userSkill: "Web3 Development", vocabSkill: "Web3 Libraries", closeness: "related" },
    ]);
  });

  it("drops unknown skills, same-name mappings and keeps the closest duplicate", () => {
    const out = cleanMappings(
      [
        { userSkill: "Kubernetes", vocabSkill: "Linux", closeness: "exact" },
        { userSkill: "Web3 Development", vocabSkill: "Made Up Skill", closeness: "exact" },
        { userSkill: "React", vocabSkill: "React", closeness: "exact" },
        { userSkill: "Web3 Development", vocabSkill: "Solidity", closeness: "partial" },
        { userSkill: "Web3 Development", vocabSkill: "Solidity", closeness: "related" },
      ],
      profile,
    );
    expect(out).toEqual([{ userSkill: "Web3 Development", vocabSkill: "Solidity", closeness: "related" }]);
  });
});

describe("cleanHidden", () => {
  const evidence = profile.skills.flatMap((s) => s.evidence);
  const card = (fieldId: string, ev: string[]) => ({ fieldId, headline: "h", reason: "r", evidence: ev });

  it("only allows candidate roles, once each, with real evidence", () => {
    const out = cleanHidden(
      [
        card("founding-engineer", ["Shipped the first exchange on Push Chain", "Invented a time machine"]),
        card("founding-engineer", ["Built 20+ React components"]),
        card("frontend", ["Built 20+ React components"]), // picked by the user → not a candidate
        card("cto-cofounder", ["Invented a time machine"]), // no real evidence left
      ],
      ["founding-engineer", "cto-cofounder"],
      evidence,
    );
    expect(out).toEqual([card("founding-engineer", ["Shipped the first exchange on Push Chain"])]);
  });
});

describe("data/skill-relations.json", () => {
  it("only relates vocabulary skills, without duplicates or self-links", () => {
    const vocab = new Set(skills.map((s) => s.name));
    const pairs = new Set<string>();
    for (const r of relations) {
      expect(vocab.has(r.from), r.from).toBe(true);
      expect(vocab.has(r.to), r.to).toBe(true);
      expect(r.from).not.toBe(r.to);
      expect(pairs.has(`${r.from}>${r.to}`)).toBe(false);
      pairs.add(`${r.from}>${r.to}`);
    }
  });
});
