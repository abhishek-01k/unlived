import { describe, expect, it } from "vitest";
import { groundProfile, isGrounded } from "@/features/resume/lib/grounding";
import type { SkillProfile } from "@/features/skills/types";

const resume = `Experience
- Built and maintained 20+ React components in the company design system
- Published 8 blog posts on React performance with 15k total reads
Tooling: Git, Docker, Cypress, Jest, Figma`;

describe("isGrounded", () => {
  it("accepts exact and lightly reformatted quotes", () => {
    expect(isGrounded("Built and maintained 20+ React components in the company design system", resume)).toBe(true);
    expect(isGrounded("published 8 blog posts on React performance", resume)).toBe(true);
    expect(isGrounded("“Published 8 blog posts on React performance with 15k total reads.”", resume)).toBe(true);
  });

  it("rejects invented evidence", () => {
    expect(isGrounded("Led a team of 10 engineers at Google", resume)).toBe(false);
    expect(isGrounded("", resume)).toBe(false);
  });
});

describe("groundProfile", () => {
  it("drops ungrounded evidence and skills left with none", () => {
    const profile: SkillProfile = {
      summary: "Frontend developer.",
      seniority: "mid",
      yearsExperience: 3,
      skills: [
        {
          name: "React",
          category: "technical",
          strength: 0.8,
          evidence: ["Built and maintained 20+ React components in the company design system", "Won a React award"],
        },
        { name: "Kubernetes", category: "technical", strength: 0.6, evidence: ["Ran Kubernetes clusters in production"] },
      ],
    };
    const { profile: out, droppedSkills } = groundProfile(profile, resume);
    expect(out.skills.map((s) => s.name)).toEqual(["React"]);
    expect(out.skills[0].evidence).toHaveLength(1);
    expect(droppedSkills).toEqual(["Kubernetes"]);
  });

  it("caps skills whose only evidence is a skills-list line", () => {
    const profile: SkillProfile = {
      summary: "s",
      seniority: "mid",
      yearsExperience: 3,
      skills: [
        { name: "Docker / Kubernetes", category: "technical", strength: 0.8, evidence: ["Tooling: Git, Docker, Cypress, Jest, Figma"] },
        {
          name: "React",
          category: "technical",
          strength: 0.9,
          evidence: ["Tooling: Git, Docker, Cypress, Jest, Figma", "Built and maintained 20+ React components in the company design system"],
        },
      ],
    };
    const { profile: out } = groundProfile(profile, resume);
    expect(out.skills.find((s) => s.name === "Docker / Kubernetes")?.strength).toBe(0.3);
    expect(out.skills.find((s) => s.name === "React")?.strength).toBe(0.9);
  });

  it("merges duplicate skills, keeping the stronger one and all evidence", () => {
    const profile: SkillProfile = {
      summary: "s",
      seniority: "mid",
      yearsExperience: 3,
      skills: [
        { name: "React", category: "technical", strength: 0.6, evidence: ["Built and maintained 20+ React components in the company design system"] },
        { name: "react", category: "technical", strength: 0.8, evidence: ["Published 8 blog posts on React performance with 15k total reads"] },
      ],
    };
    const { profile: out } = groundProfile(profile, resume);
    expect(out.skills).toHaveLength(1);
    expect(out.skills[0].strength).toBe(0.8);
    expect(out.skills[0].evidence).toHaveLength(2);
  });
});
