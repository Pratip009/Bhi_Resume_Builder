/**
 * Page geometry and type scale shared by the preview, the PDF and the Word file.
 * Everything is in points (1/72"). Text sizes are multiplied by a fit scale `k`
 * (MIN_SCALE..1) so the resume always lands on exactly one page.
 */
import type { SectionKey } from "./schema";

export type Column = "main" | "side";

export const PAGE_PT = {
  A4: { w: 595.28, h: 841.89 },
  LETTER: { w: 612, h: 792 },
} as const;

/** Sidebar share of the page width. */
export const SIDEBAR_RATIO = 0.34;

/** Column padding (not scaled, so margins stay consistent). */
export const PAD = { top: 34, bottom: 30, sideX: 20, mainX: 28 } as const;

/** Smallest scale we allow before asking the user to trim content (body text ≈ 6.8pt). */
export const MIN_SCALE = 0.72;

/** Base type sizes at k = 1. */
export const TYPE = {
  body: 9.4,
  small: 8.6,
  sub: 9,
  name: 24,
  headline: 11.5,
  section: 9.4,
  entryTitle: 10.2,
  sideTitle: 9.4,
  lineHeight: 1.35,
} as const;

/** Spacing at k = 1. */
export const SPACE = {
  headerGap: 12,
  sectionGap: 13,
  titleGap: 6,
  entryGap: 7,
  bulletGap: 1.5,
  photo: 92,
} as const;

export const DEFAULT_COLUMNS: Record<SectionKey, Column> = {
  summary: "main",
  experience: "main",
  education: "main",
  skills: "side",
  projects: "main",
  certifications: "side",
  awards: "side",
  volunteer: "main",
  languages: "side",
  interests: "side",
  references: "side",
  custom: "main",
};

/** Mixes a hex colour with white. amount = 0 → colour, 1 → white. */
export function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#F2F4F8";
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export const clampScale = (k: number) => Math.min(1, Math.max(MIN_SCALE, Number.isFinite(k) ? k : 1));
