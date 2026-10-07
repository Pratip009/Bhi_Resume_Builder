/**
 * Turns a Resume into a renderer-agnostic document model.
 * The HTML preview, the DOCX builder and the PDF builder all render THIS,
 * so the three outputs always contain exactly the same content in the same order.
 */
import type { Resume, SectionKey } from "./schema";
import { SECTION_LABELS } from "./schema";
import type { Column } from "./layout";

export type Target = "html" | "docx" | "pdf";

export type Link = { text: string; href?: string };

export type Entry = {
  title: string;
  date?: string;
  subtitle?: string;
  link?: Link;
  body?: string;
  bullets: string[];
};

export type Block =
  | { kind: "text"; text: string }
  | { kind: "entries"; entries: Entry[] }
  | { kind: "pairs"; pairs: { label: string; value: string }[] }
  | { kind: "inline"; items: string[] }
  | { kind: "bullets"; items: string[] };

export type Section = { key: string; title: string; blocks: Block[]; column: Column };
type RawSection = Omit<Section, "column">;

export type Photo = { dataUrl: string; type: "png" | "jpg" };

export type DocModel = {
  name: string;
  headline: string;
  contacts: Link[];
  photo: Photo | null;
  sections: Section[];
  main: Section[];
  side: Section[];
  sidebar: Resume["settings"]["sidebar"];
  template: Resume["settings"]["template"];
  accent: string;
  pageSize: Resume["settings"]["pageSize"];
};

/* ------------------------------------------------------------------ */
/*  Text hygiene                                                       */
/* ------------------------------------------------------------------ */

// Characters that are illegal in XML 1.0 (they corrupt .docx files) or invisible junk.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g;
// Lone surrogates also break XML.
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
// Emoji have no glyphs in the embedded PDF fonts, so they would print as blank boxes.
const EMOJI_RE = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u20E3]/gu;

export function clean(input: string, target: Target): string {
  let s = (input ?? "").replace(CONTROL_RE, "").replace(LONE_SURROGATE_RE, "");
  if (target === "pdf") s = s.replace(EMOJI_RE, "");
  return s.replace(/\t/g, " ").replace(/[ \u00A0]{2,}/g, " ").trim();
}

/** Splits a textarea into bullet lines, removing any bullet characters people typed themselves. */
export function toLines(input: string, target: Target): string[] {
  return (input ?? "")
    .split(/\r?\n/)
    .map((l) => clean(l.replace(/^\s*(?:[-*•·▪◦–—>]|\d+[.)])\s+/, ""), target))
    .filter(Boolean);
}

export function dateRange(start: string, end: string, current: boolean, target: Target): string {
  const s = clean(start, target);
  const e = current ? "Present" : clean(end, target);
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

export function joinNonEmpty(parts: string[], sep = ", "): string {
  return parts.filter((p) => p && p.trim()).join(sep);
}

/* ------------------------------------------------------------------ */
/*  Links                                                              */
/* ------------------------------------------------------------------ */

export function safeUrl(raw: string): string | undefined {
  const v = (raw ?? "").trim();
  if (!v || /\s/.test(v)) return undefined;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (!u.hostname.includes(".")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Display form of a URL: no protocol, no "www.", no trailing slash. */
export function prettyUrl(raw: string): string {
  return (raw ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (v: string) => EMAIL_RE.test((v ?? "").trim());

function linkFor(raw: string, target: Target): Link | undefined {
  const text = clean(prettyUrl(raw), target);
  if (!text) return undefined;
  return { text, href: safeUrl(raw) };
}

/* ------------------------------------------------------------------ */
/*  Builder                                                            */
/* ------------------------------------------------------------------ */

function photoOf(dataUrl: string): Photo | null {
  const m = /^data:image\/(png|jpeg);base64,/.exec(dataUrl ?? "");
  if (!m) return null;
  return { dataUrl, type: m[1] === "png" ? "png" : "jpg" };
}

export function buildModel(r: Resume, target: Target): DocModel {
  const c = (s: string) => clean(s, target);
  const lines = (s: string) => toLines(s, target);
  const p = r.personal;

  const contacts: Link[] = [];
  if (c(p.email)) contacts.push({ text: c(p.email), href: isEmail(p.email) ? `mailto:${p.email.trim()}` : undefined });
  if (c(p.phone)) {
    const digits = p.phone.replace(/[^\d+]/g, "");
    contacts.push({ text: c(p.phone), href: digits.length >= 6 ? `tel:${digits}` : undefined });
  }
  if (c(p.location)) contacts.push({ text: c(p.location) });
  for (const raw of [p.website, p.linkedin, p.github]) {
    const l = linkFor(raw, target);
    if (l) contacts.push(l);
  }

  const hidden = new Set(r.settings.hiddenSections);
  const sections: Section[] = [];

  const build: Record<SectionKey, () => RawSection[]> = {
    summary: () => {
      const paras = lines(r.summary);
      return paras.length ? [{ key: "summary", title: SECTION_LABELS.summary, blocks: paras.map((t) => ({ kind: "text", text: t })) }] : [];
    },

    experience: () => {
      const entries: Entry[] = r.experience
        .map((e) => ({
          title: c(e.role) || c(e.company),
          subtitle: joinNonEmpty([c(e.role) ? c(e.company) : "", c(e.location)], " · "),
          date: dateRange(e.start, e.end, e.current, target),
          bullets: lines(e.bullets),
        }))
        .filter((e) => e.title || e.bullets.length);
      return entries.length ? [{ key: "experience", title: SECTION_LABELS.experience, blocks: [{ kind: "entries", entries }] }] : [];
    },

    education: () => {
      const entries: Entry[] = r.education
        .map((e) => ({
          title: c(e.degree) || c(e.school),
          subtitle: joinNonEmpty([c(e.degree) ? c(e.school) : "", c(e.location), c(e.grade)], " · "),
          date: dateRange(e.start, e.end, false, target),
          bullets: lines(e.details),
        }))
        .filter((e) => e.title);
      return entries.length ? [{ key: "education", title: SECTION_LABELS.education, blocks: [{ kind: "entries", entries }] }] : [];
    },

    skills: () => {
      const pairs = r.skills
        .map((g) => ({
          label: c(g.name),
          value: g.items
            .split(/[,\n]/)
            .map((s) => c(s))
            .filter(Boolean)
            .join(", "),
        }))
        .filter((g) => g.value);
      return pairs.length ? [{ key: "skills", title: SECTION_LABELS.skills, blocks: [{ kind: "pairs", pairs }] }] : [];
    },

    projects: () => {
      const entries: Entry[] = r.projects
        .map((e) => ({
          title: c(e.name),
          subtitle: c(e.tech),
          link: linkFor(e.link, target),
          date: dateRange(e.start, e.end, false, target),
          bullets: lines(e.bullets),
        }))
        .filter((e) => e.title);
      return entries.length ? [{ key: "projects", title: SECTION_LABELS.projects, blocks: [{ kind: "entries", entries }] }] : [];
    },

    certifications: () => {
      const entries: Entry[] = r.certifications
        .map((e) => ({ title: c(e.name), subtitle: c(e.issuer), date: c(e.date), link: linkFor(e.link, target), bullets: [] }))
        .filter((e) => e.title);
      return entries.length ? [{ key: "certifications", title: SECTION_LABELS.certifications, blocks: [{ kind: "entries", entries }] }] : [];
    },

    awards: () => {
      const entries: Entry[] = r.awards
        .map((e) => ({ title: c(e.title), subtitle: c(e.issuer), date: c(e.date), body: lines(e.description).join(" "), bullets: [] }))
        .filter((e) => e.title);
      return entries.length ? [{ key: "awards", title: SECTION_LABELS.awards, blocks: [{ kind: "entries", entries }] }] : [];
    },

    volunteer: () => {
      const entries: Entry[] = r.volunteer
        .map((e) => ({
          title: c(e.role) || c(e.organization),
          subtitle: c(e.role) ? c(e.organization) : "",
          date: dateRange(e.start, e.end, false, target),
          bullets: lines(e.description),
        }))
        .filter((e) => e.title);
      return entries.length ? [{ key: "volunteer", title: SECTION_LABELS.volunteer, blocks: [{ kind: "entries", entries }] }] : [];
    },

    languages: () => {
      const items = r.languages
        .filter((l) => c(l.name))
        .map((l) => (c(l.level) ? `${c(l.name)} (${c(l.level)})` : c(l.name)));
      return items.length ? [{ key: "languages", title: SECTION_LABELS.languages, blocks: [{ kind: "inline", items }] }] : [];
    },

    interests: () => {
      const items = r.interests
        .split(/[,\n]/)
        .map((s) => c(s))
        .filter(Boolean);
      return items.length ? [{ key: "interests", title: SECTION_LABELS.interests, blocks: [{ kind: "inline", items }] }] : [];
    },

    references: () => {
      const entries: Entry[] = r.references
        .map((e) => ({
          title: c(e.name),
          subtitle: joinNonEmpty([c(e.title), c(e.company)]),
          body: joinNonEmpty([c(e.email), c(e.phone)], " · "),
          bullets: [],
        }))
        .filter((e) => e.title);
      if (entries.length) return [{ key: "references", title: SECTION_LABELS.references, blocks: [{ kind: "entries", entries }] }];
      if (r.referencesOnRequest)
        return [{ key: "references", title: SECTION_LABELS.references, blocks: [{ kind: "text", text: "Available on request." }] }];
      return [];
    },

    custom: () =>
      r.custom
        .map((s) => ({ title: c(s.title), items: lines(s.content) }))
        .filter((s) => s.title && s.items.length)
        .map((s, i) => ({
          key: `custom-${i}`,
          title: s.title,
          blocks: [s.items.length === 1 ? { kind: "text" as const, text: s.items[0] } : { kind: "bullets" as const, items: s.items }],
        })),
  };

  for (const key of r.settings.sectionOrder) {
    if (hidden.has(key)) continue;
    const column = r.settings.columns[key];
    sections.push(...build[key]().map((s) => ({ ...s, column })));
  }

  return {
    name: c(p.fullName),
    headline: c(p.headline),
    contacts,
    photo: r.settings.showPhoto ? photoOf(p.photo) : null,
    sections,
    main: sections.filter((s) => s.column === "main"),
    side: sections.filter((s) => s.column === "side"),
    sidebar: r.settings.sidebar,
    template: r.settings.template,
    accent: r.settings.accent,
    pageSize: r.settings.pageSize,
  };
}

export function fileBaseName(name: string): string {
  const base = (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `${base || "My"}_Resume`;
}
