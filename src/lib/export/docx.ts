import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeightRule,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
  type ParagraphChild,
} from "docx";
import type { Resume } from "../schema";
import { buildModel, type Block, type DocModel, type Entry, type Link, type Section } from "../model";
import { PAD, PAGE_PT, SIDEBAR_RATIO, SPACE, TYPE, tint } from "../layout";

/*
 * Units: DXA = 1/20 pt (1440 = 1 inch). Font sizes are half-points.
 * Layout: a single borderless two-cell table filling the page (zero page margins,
 * padding lives in the cells). The sidebar cell is shaded. Everything stays plain,
 * editable text: no text boxes, no floating shapes.
 */

const INK = "1F2933";
const MUTED = "55606B";
const BULLETS = "resume-bullets";
const NO_BORDER: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

type Ctx = {
  m: DocModel;
  k: number;
  accent: string;
  classic: boolean;
  mainTextWidth: number; // DXA, for the right-aligned date tab stop
};

const dxa = (pt: number) => Math.round(pt * 20);
const hp = (ctx: Ctx, pt: number) => Math.max(8, Math.round(pt * ctx.k * 2)); // half-points
const sp = (ctx: Ctx, pt: number) => Math.round(pt * ctx.k * 20); // spacing in DXA

function linkRun(l: Link, size: number, color: string): ParagraphChild {
  const run = new TextRun({ text: l.text, size, color });
  return l.href ? new ExternalHyperlink({ link: l.href, children: [run] }) : run;
}

function heading(ctx: Ctx, title: string, side: boolean, first: boolean): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: first ? 0 : sp(ctx, SPACE.sectionGap), after: sp(ctx, SPACE.titleGap) },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: side ? tint(`#${ctx.accent}`, 0.55).slice(1) : ctx.classic ? "9AA3AB" : ctx.accent,
        space: 2,
      },
    },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: hp(ctx, side ? TYPE.sideTitle : TYPE.section),
        characterSpacing: Math.round(1.1 * ctx.k * 20),
        color: ctx.classic ? INK : ctx.accent,
      }),
    ],
  });
}

function para(ctx: Ctx, children: ParagraphChild[], after = 3, opts: Partial<{ keepNext: boolean }> = {}) {
  return new Paragraph({ spacing: { after: sp(ctx, after) }, keepNext: opts.keepNext, children });
}

function bullet(ctx: Ctx, text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: BULLETS, level: 0 },
    spacing: { before: sp(ctx, SPACE.bulletGap) },
    children: [new TextRun({ text, size: hp(ctx, TYPE.body) })],
  });
}

function mainEntry(ctx: Ctx, e: Entry, isLast: boolean): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({
      keepNext: true,
      tabStops: [{ type: TabStopType.RIGHT, position: ctx.mainTextWidth }],
      children: [
        new TextRun({ text: e.title, bold: true, size: hp(ctx, TYPE.entryTitle) }),
        ...(e.date ? [new TextRun({ children: [new Tab(), e.date], size: hp(ctx, TYPE.small), color: MUTED })] : []),
      ],
    }),
  ];
  const sub: ParagraphChild[] = [];
  if (e.subtitle) sub.push(new TextRun({ text: e.subtitle, italics: true, size: hp(ctx, TYPE.sub), color: MUTED }));
  if (e.link) {
    if (sub.length) sub.push(new TextRun({ text: "  ·  ", size: hp(ctx, TYPE.sub), color: MUTED }));
    sub.push(linkRun(e.link, hp(ctx, TYPE.sub), ctx.accent));
  }
  if (sub.length) out.push(para(ctx, sub, 0));
  if (e.body) out.push(new Paragraph({ spacing: { before: sp(ctx, 1.5) }, children: [new TextRun({ text: e.body, size: hp(ctx, TYPE.body) })] }));
  e.bullets.forEach((b) => out.push(bullet(ctx, b)));
  // Gap after the entry (attached to the last paragraph so no empty paragraphs are created).
  if (!isLast) out.push(new Paragraph({ spacing: { after: 0, line: Math.max(20, sp(ctx, SPACE.entryGap)), lineRule: LineRuleType.EXACT }, children: [] }));
  return out;
}

function sideEntry(ctx: Ctx, e: Entry): Paragraph[] {
  const s = hp(ctx, TYPE.small);
  const out: Paragraph[] = [para(ctx, [new TextRun({ text: e.title, bold: true, size: hp(ctx, TYPE.body) })], 0, { keepNext: true })];
  if (e.subtitle) out.push(para(ctx, [new TextRun({ text: e.subtitle, size: s, color: MUTED })], 0));
  if (e.date) out.push(para(ctx, [new TextRun({ text: e.date, size: s, color: MUTED })], 0));
  if (e.link) out.push(para(ctx, [linkRun(e.link, s, ctx.accent)], 0));
  if (e.body) out.push(para(ctx, [new TextRun({ text: e.body, size: hp(ctx, TYPE.body) })], 0));
  e.bullets.forEach((b) => out.push(bullet(ctx, b)));
  out.push(new Paragraph({ spacing: { line: Math.max(20, sp(ctx, 5)), lineRule: LineRuleType.EXACT }, children: [] }));
  return out;
}

function block(ctx: Ctx, b: Block, side: boolean): Paragraph[] {
  const body = hp(ctx, TYPE.body);
  switch (b.kind) {
    case "text":
      return [para(ctx, [new TextRun({ text: b.text, size: body })])];
    case "entries":
      return b.entries.flatMap((e, i) => (side ? sideEntry(ctx, e) : mainEntry(ctx, e, i === b.entries.length - 1)));
    case "pairs":
      return b.pairs.flatMap((p) =>
        side
          ? [
              ...(p.label ? [para(ctx, [new TextRun({ text: p.label, bold: true, size: body })], 0, { keepNext: true })] : []),
              para(ctx, [new TextRun({ text: p.value, size: body })], 5),
            ]
          : [
              para(
                ctx,
                [...(p.label ? [new TextRun({ text: `${p.label}: `, bold: true, size: body })] : []), new TextRun({ text: p.value, size: body })],
                2.5,
              ),
            ],
      );
    case "inline":
      return side
        ? b.items.map((t) => para(ctx, [new TextRun({ text: t, size: body })]))
        : [para(ctx, [new TextRun({ text: b.items.join("  ·  "), size: body })])];
    case "bullets":
      return b.items.map((t) => bullet(ctx, t));
  }
}

function sectionParas(ctx: Ctx, sec: Section, side: boolean, first: boolean): Paragraph[] {
  return [heading(ctx, sec.title, side, first), ...sec.blocks.flatMap((b) => block(ctx, b, side))];
}

function sideChildren(ctx: Ctx): Paragraph[] {
  const { m } = ctx;
  const out: Paragraph[] = [];
  if (m.photo) {
    const data = Buffer.from(m.photo.dataUrl.slice(m.photo.dataUrl.indexOf(",") + 1), "base64");
    if (data.length) {
      const px = Math.round(SPACE.photo * ctx.k * (96 / 72));
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: sp(ctx, SPACE.sectionGap), line: 240, lineRule: LineRuleType.AUTO },
          children: [new ImageRun({ type: m.photo.type, data, transformation: { width: px, height: px } })],
        }),
      );
    }
  }
  if (m.contacts.length) {
    out.push(heading(ctx, "Contact", true, true));
    m.contacts.forEach((c) => out.push(para(ctx, [linkRun(c, hp(ctx, TYPE.small), INK)])));
  }
  m.side.forEach((sec, i) => out.push(...sectionParas(ctx, sec, true, i === 0 && !m.contacts.length)));
  // A table cell must end with a paragraph.
  if (!out.length) out.push(new Paragraph({ children: [] }));
  return out;
}

function mainChildren(ctx: Ctx): Paragraph[] {
  const { m } = ctx;
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { line: 240, lineRule: LineRuleType.AUTO },
      children: [new TextRun({ text: m.name, bold: true, size: hp(ctx, TYPE.name) })],
    }),
  ];
  if (m.headline) {
    out.push(
      new Paragraph({
        spacing: { before: sp(ctx, 2) },
        children: [new TextRun({ text: m.headline, size: hp(ctx, TYPE.headline), color: ctx.classic ? MUTED : ctx.accent })],
      }),
    );
  }
  out.push(new Paragraph({ spacing: { line: Math.max(20, sp(ctx, SPACE.headerGap - SPACE.sectionGap + 4)), lineRule: LineRuleType.EXACT }, children: [] }));
  m.main.forEach((sec) => out.push(...sectionParas(ctx, sec, false, false)));
  return out;
}

/**
 * @param scale text scale from the PDF fitter. A small safety factor is applied because
 *              Word/LibreOffice substitute fonts (Calibri/Georgia) with slightly different metrics.
 */
export async function buildDocx(resume: Resume, scale: number): Promise<Buffer> {
  const m = buildModel(resume, "docx");
  const page = PAGE_PT[m.pageSize];
  const pageW = dxa(page.w);
  const pageH = dxa(page.h);
  const sideW = Math.round(pageW * SIDEBAR_RATIO);
  const mainW = pageW - sideW;

  const ctx: Ctx = {
    m,
    k: scale * 0.97,
    accent: m.accent.replace("#", "").toUpperCase(),
    classic: m.template === "classic",
    mainTextWidth: mainW - dxa(PAD.mainX) * 2,
  };
  const font = ctx.classic ? "Georgia" : "Calibri";

  const sideCell = new TableCell({
    width: { size: sideW, type: WidthType.DXA },
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    shading: { type: ShadingType.CLEAR, color: "auto", fill: tint(m.accent, 0.9).slice(1) },
    margins: { top: dxa(PAD.top), bottom: dxa(PAD.bottom), left: dxa(PAD.sideX), right: dxa(PAD.sideX), marginUnitType: WidthType.DXA },
    children: sideChildren(ctx),
  });
  const mainCell = new TableCell({
    width: { size: mainW, type: WidthType.DXA },
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: dxa(PAD.top), bottom: dxa(PAD.bottom), left: dxa(PAD.mainX), right: dxa(PAD.mainX), marginUnitType: WidthType.DXA },
    children: mainChildren(ctx),
  });

  const table = new Table({
    width: { size: pageW, type: WidthType.DXA },
    columnWidths: m.sidebar === "left" ? [sideW, mainW] : [mainW, sideW],
    layout: TableLayoutType.FIXED,
    indent: { size: 0, type: WidthType.DXA },
    borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: [
      new TableRow({
        // At least the full page (minus room for Word's mandatory trailing paragraph) so the sidebar colour reaches the bottom.
        height: { value: pageH - 120, rule: HeightRule.ATLEAST },
        cantSplit: true,
        children: m.sidebar === "left" ? [sideCell, mainCell] : [mainCell, sideCell],
      }),
    ],
  });

  const doc = new Document({
    creator: m.name || "Resume builder",
    title: `${m.name} – Resume`,
    description: "Resume",
    styles: {
      default: {
        document: {
          run: { font, size: Math.round(TYPE.body * 2), color: INK },
          paragraph: { spacing: { after: 0, line: 264, lineRule: LineRuleType.AUTO } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 220, hanging: 180 } }, run: { color: ctx.accent, size: hp(ctx, TYPE.small) } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: pageW, height: pageH },
            margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0, gutter: 0 },
          },
        },
        children: [
          table,
          // Word requires a paragraph after a table; keep it 1pt tall so it never creates a second page.
          new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: [new TextRun({ text: "", size: 2 })] }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
