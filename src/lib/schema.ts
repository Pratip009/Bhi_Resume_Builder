import { z } from "zod";
import { DEFAULT_COLUMNS, type Column } from "./layout";

/* ------------------------------------------------------------------ */
/*  Section registry                                                   */
/* ------------------------------------------------------------------ */

export const SECTION_KEYS = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "awards",
  "volunteer",
  "languages",
  "interests",
  "references",
  "custom",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  awards: "Awards",
  volunteer: "Volunteering",
  languages: "Languages",
  interests: "Interests",
  references: "References",
  custom: "Custom sections",
};

/* ------------------------------------------------------------------ */
/*  Field helpers                                                      */
/* ------------------------------------------------------------------ */

/** Strings never fail validation: missing/invalid becomes "", oversized input is truncated. */
const text = (max = 200) =>
  z
    .string()
    .catch("")
    .transform((s) => s.slice(0, max));
const longText = (max = 4000) => text(max);
const id = z.string().min(1).max(64);
const list = <T extends z.ZodTypeAny>(item: T, max = 40) =>
  z.array(item).max(max, `At most ${max} entries`).default([]);

// Photos are normalised client-side to a small square image; 2.5 MB of base64 is a hard ceiling.
const PHOTO_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
export const MAX_PHOTO_CHARS = 2_500_000;

const photo = z
  .string()
  .max(MAX_PHOTO_CHARS, "Photo is too large")
  .refine((v) => v === "" || PHOTO_RE.test(v), "Photo must be a PNG or JPEG image")
  .default("");

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colour must be a hex value like #2F4BD8")
  .catch("#2F4BD8")
  .default("#2F4BD8");

/* ------------------------------------------------------------------ */
/*  Entries                                                            */
/* ------------------------------------------------------------------ */

export const experienceSchema = z.object({
  id,
  role: text(),
  company: text(),
  location: text(),
  start: text(40),
  end: text(40),
  current: z.boolean().catch(false).default(false),
  bullets: longText(),
});

export const educationSchema = z.object({
  id,
  degree: text(),
  school: text(),
  location: text(),
  start: text(40),
  end: text(40),
  grade: text(80),
  details: longText(2000),
});

export const skillGroupSchema = z.object({
  id,
  name: text(80),
  items: text(1000),
});

export const projectSchema = z.object({
  id,
  name: text(),
  link: text(300),
  tech: text(300),
  start: text(40),
  end: text(40),
  bullets: longText(),
});

export const certificationSchema = z.object({
  id,
  name: text(),
  issuer: text(),
  date: text(40),
  link: text(300),
});

export const awardSchema = z.object({
  id,
  title: text(),
  issuer: text(),
  date: text(40),
  description: longText(1000),
});

export const volunteerSchema = z.object({
  id,
  role: text(),
  organization: text(),
  start: text(40),
  end: text(40),
  description: longText(2000),
});

export const languageSchema = z.object({
  id,
  name: text(80),
  level: text(80),
});

export const referenceSchema = z.object({
  id,
  name: text(),
  title: text(),
  company: text(),
  email: text(200),
  phone: text(60),
});

export const customSectionSchema = z.object({
  id,
  title: text(80),
  content: longText(),
});

/* ------------------------------------------------------------------ */
/*  Resume                                                             */
/* ------------------------------------------------------------------ */

const sectionKeyEnum = z.enum(SECTION_KEYS);

/** An object schema that treats a missing / non-object value as {} so every field falls back to its default. */
function objectOrEmpty<T extends z.ZodRawShape>(shape: T) {
  return z.preprocess((v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}), z.object(shape));
}

/** Keeps known keys, removes duplicates and appends anything missing, so the order is always complete. */
function normaliseOrder(keys: unknown[]): SectionKey[] {
  const seen = new Set<SectionKey>();
  for (const k of keys) {
    const parsed = sectionKeyEnum.safeParse(k);
    if (parsed.success) seen.add(parsed.data);
  }
  for (const k of SECTION_KEYS) seen.add(k);
  return [...seen];
}

export const settingsSchema = objectOrEmpty({
  template: z.enum(["modern", "classic"]).catch("modern").default("modern"),
  accent: hexColor,
  pageSize: z.enum(["A4", "LETTER"]).catch("A4").default("A4"),
  showPhoto: z.boolean().catch(true).default(true),
  sidebar: z.enum(["left", "right"]).catch("left").default("left"),
  /** Which column each section sits in. Missing/invalid entries fall back to the defaults. */
  columns: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform((v) => {
      const out = { ...DEFAULT_COLUMNS };
      for (const k of SECTION_KEYS) if (v[k] === "main" || v[k] === "side") out[k] = v[k] as Column;
      return out;
    }),
  /** Fit scale measured by the live preview; the server uses it as a starting point and re-verifies. */
  scaleHint: z.number().min(0.5).max(1).catch(1).default(1),
  sectionOrder: z.array(z.unknown()).catch([]).transform(normaliseOrder),
  hiddenSections: z
    .array(z.unknown())
    .catch([])
    .transform((v) => [...new Set(v.filter((k): k is SectionKey => sectionKeyEnum.safeParse(k).success))]),
});

export const personalSchema = objectOrEmpty({
  fullName: text(100),
  headline: text(150),
  email: text(200),
  phone: text(60),
  location: text(150),
  website: text(300),
  linkedin: text(300),
  github: text(300),
  photo,
});

export const resumeSchema = z.object({
  version: z.literal(1).catch(1).default(1),
  personal: personalSchema,
  summary: longText(3000),
  experience: list(experienceSchema),
  education: list(educationSchema),
  skills: list(skillGroupSchema),
  projects: list(projectSchema),
  certifications: list(certificationSchema),
  awards: list(awardSchema),
  volunteer: list(volunteerSchema),
  languages: list(languageSchema),
  interests: text(1000),
  references: list(referenceSchema, 10),
  referencesOnRequest: z.boolean().catch(false).default(false),
  custom: list(customSectionSchema, 10),
  settings: settingsSchema,
});

export type Resume = z.output<typeof resumeSchema>;
export type Experience = z.output<typeof experienceSchema>;
export type Education = z.output<typeof educationSchema>;
export type SkillGroup = z.output<typeof skillGroupSchema>;
export type Project = z.output<typeof projectSchema>;
export type Certification = z.output<typeof certificationSchema>;
export type Award = z.output<typeof awardSchema>;
export type Volunteer = z.output<typeof volunteerSchema>;
export type Language = z.output<typeof languageSchema>;
export type Reference = z.output<typeof referenceSchema>;
export type CustomSection = z.output<typeof customSectionSchema>;
export type Settings = z.output<typeof settingsSchema>;

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyResume(): Resume {
  return resumeSchema.parse({ personal: {}, settings: {} });
}

export const blank = {
  experience: (): Experience => ({ id: newId(), role: "", company: "", location: "", start: "", end: "", current: false, bullets: "" }),
  education: (): Education => ({ id: newId(), degree: "", school: "", location: "", start: "", end: "", grade: "", details: "" }),
  skills: (): SkillGroup => ({ id: newId(), name: "", items: "" }),
  projects: (): Project => ({ id: newId(), name: "", link: "", tech: "", start: "", end: "", bullets: "" }),
  certifications: (): Certification => ({ id: newId(), name: "", issuer: "", date: "", link: "" }),
  awards: (): Award => ({ id: newId(), title: "", issuer: "", date: "", description: "" }),
  volunteer: (): Volunteer => ({ id: newId(), role: "", organization: "", start: "", end: "", description: "" }),
  languages: (): Language => ({ id: newId(), name: "", level: "" }),
  references: (): Reference => ({ id: newId(), name: "", title: "", company: "", email: "", phone: "" }),
  custom: (): CustomSection => ({ id: newId(), title: "", content: "" }),
};

/**
 * Lenient load used for localStorage / imported JSON: anything invalid falls back to defaults
 * field-by-field instead of throwing away the whole resume.
 */
export function coerceResume(input: unknown): Resume {
  const parsed = resumeSchema.safeParse(input);
  if (parsed.success) return parsed.data;

  // Strip invalid list entries individually and retry once.
  if (input && typeof input === "object") {
    const obj = { ...(input as Record<string, unknown>) };
    const entrySchemas: Record<string, z.ZodTypeAny> = {
      experience: experienceSchema,
      education: educationSchema,
      skills: skillGroupSchema,
      projects: projectSchema,
      certifications: certificationSchema,
      awards: awardSchema,
      volunteer: volunteerSchema,
      languages: languageSchema,
      references: referenceSchema,
      custom: customSectionSchema,
    };
    for (const [key, schema] of Object.entries(entrySchemas)) {
      const arr = obj[key];
      obj[key] = Array.isArray(arr) ? arr.filter((e) => schema.safeParse(e).success).slice(0, 40) : [];
    }
    if (obj.personal && typeof obj.personal === "object") {
      const p = { ...(obj.personal as Record<string, unknown>) };
      if (!photo.safeParse(p.photo).success) p.photo = "";
      obj.personal = p;
    } else {
      obj.personal = {};
    }
    if (!obj.settings || typeof obj.settings !== "object") obj.settings = {};
    const retry = resumeSchema.safeParse(obj);
    if (retry.success) return retry.data;
  }
  return emptyResume();
}
