import { describe, expect, it } from "vitest";
import { redactPII } from "@/features/resume/api/redact";

const resume = `Priya Sharma
Frontend Developer
priya.sharma@example.com | +91 98765 43210 | linkedin.com/in/priya-sharma
https://github.com/priya-dev
221 MG Road, Bengaluru 560001

Experience
Acme Corp, 2022 - 2025
- Cut dashboard load time by 45% across 12 pages
- Led migration of 40000 lines to TypeScript
US office: (415) 555-0132, 500 Market Street, San Francisco CA 94107`;

describe("redactPII", () => {
  const { text, removed } = redactPII(resume);

  it("removes contact details", () => {
    expect(text).not.toMatch(/priya\.sharma@example\.com/);
    expect(text).not.toMatch(/98765/);
    expect(text).not.toMatch(/555-0132/);
    expect(text).not.toMatch(/linkedin\.com|github\.com/);
    expect(removed.emails).toBe(1);
    expect(removed.phones).toBe(2);
    expect(removed.urls).toBe(2);
  });

  it("removes addresses and postal codes", () => {
    expect(text).not.toMatch(/MG Road/);
    expect(text).not.toMatch(/560001/);
    expect(text).not.toMatch(/Market Street/);
    expect(text).not.toMatch(/94107/);
  });

  it("removes the name header", () => {
    expect(text.split("\n")[0]).toBe("[NAME]");
    expect(text).not.toMatch(/Priya Sharma/);
  });

  it("keeps career content, years and metrics", () => {
    expect(text).toMatch("Frontend Developer");
    expect(text).toMatch("2022 - 2025");
    expect(text).toMatch("Cut dashboard load time by 45% across 12 pages");
    expect(text).toMatch("40000 lines to TypeScript");
  });

  it("removes bare personal domains but keeps tech names", () => {
    const { text } = redactPII("Portfolio: jane-doe.dev | blog.example.xyz\nBuilt apps in Next.js and Node.js on Vercel");
    expect(text).not.toMatch(/jane-doe\.dev|example\.xyz/);
    expect(text).toMatch("Next.js and Node.js on Vercel");
  });

  it("does not redact a job-title header as a name", () => {
    const { text } = redactPII("Curriculum Vitae\nSenior frontend engineer with 5 years of experience");
    expect(text).toMatch("Curriculum Vitae");
  });
});
