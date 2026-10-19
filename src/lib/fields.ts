import { z } from "zod";
import fieldsData from "@/data/fields.json";

// The curated catalogue of 50 tech roles (data/fields.json), shared by every feature.

export const FAMILIES = {
  software: "Software Engineering",
  "ai-data": "AI & Data",
  infra: "Infrastructure & Cloud",
  security: "Security",
  web3: "Web3",
  quality: "Quality",
  "product-design": "Product & Design",
  "developer-facing": "Developer-facing",
  leadership: "Leadership",
  independent: "Independent",
} as const;
export const Family = z.enum(Object.keys(FAMILIES) as [keyof typeof FAMILIES, ...(keyof typeof FAMILIES)[]]);
export type Family = z.infer<typeof Family>;

export const CoreSkill = z.object({
  name: z.string().min(1),
  weight: z.number().int().min(1).max(3), // 3 = essential, 1 = nice to have
});
export type CoreSkill = z.infer<typeof CoreSkill>;

export const Field = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  family: Family,
  tagline: z.string().min(1),
  overview: z.string().min(1),
  dayToDay: z.array(z.string().min(1)).min(2),
  payRange: z.object({
    min: z.number().min(0), // 0 = can earn nothing (founders, indie)
    max: z.number().positive(),
    currency: z.string().length(3),
  }),
  coreSkills: z.array(CoreSkill).min(5),
});
export type Field = z.infer<typeof Field>;

export const FieldList = z.array(Field).min(1);

export const FIELDS = FieldList.parse(fieldsData);

export function fieldOf(id: string): Field {
  const f = FIELDS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown field ${id}`);
  return f;
}
