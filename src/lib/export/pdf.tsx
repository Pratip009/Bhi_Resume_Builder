import "server-only";
import path from "node:path";
import fs from "node:fs";
import { Document, Font, Image, Link as PdfLink, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Resume } from "../schema";
import { buildModel, type Block, type DocModel, type Entry, type Link, type Section } from "../model";
import { MIN_SCALE, PAD, PAGE_PT, SIDEBAR_RATIO, SPACE, TYPE, clampScale, tint } from "../layout";

/* ------------------------------------------------------------------ */
/*  Fonts (bundled TTFs: Latin, Latin-Ext, Greek, Cyrillic)             */
/* ------------------------------------------------------------------ */

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  const f = (file: string) => {
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) throw new Error(`Missing font file: ${p}`);
    return p;
  };
  Font.register({
    family: "Inter",
    fonts: [
      { src: f("Inter-Regular.ttf"), fontWeight: 400 },
      { src: f("Inter-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: f("Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: f("Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Lora",
    fonts: [
      { src: f("Lora-Regular.ttf"), fontWeight: 400 },
      { src: f("Lora-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: f("Lora-SemiBold.ttf"), fontWeight: 600 },
      { src: f("Lora-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // No hyphenation for normal words; very long tokens (emails, URLs) may break so they never overflow the sidebar.
  Font.registerHyphenationCallback((word) => {
    if (word.length <= 24) return [word];
    const parts: string[] = [];
    for (let i = 0; i < word.length; i += 16) parts.push(word.slice(i, i + 16));
    return parts;
  });
  fontsReady = true;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const INK = "#1F2933";
const MUTED = "#55606B";

function makeStyles(m: DocModel, k: number) {
  const S = (n: number) => n * k;
  const classic = m.template === "classic";
  const page = PAGE_PT[m.pageSize];
  const accentTitle = classic ? INK : m.accent;
  return StyleSheet.create({
    page: {
      flexDirection: m.sidebar === "left" ? "row" : "row-reverse",
      // Inter is the glyph fallback for Lora (e.g. Greek), so mixed-script text never breaks.
      fontFamily: classic ? ["Lora", "Inter"] : "Inter",
      fontSize: S(TYPE.body),
      lineHeight: TYPE.lineHeight,
      color: INK,
    },
    side: {
      width: page.w * SIDEBAR_RATIO,
      backgroundColor: tint(m.accent, 0.9),
      paddingTop: PAD.top,
      paddingBottom: PAD.bottom,
      paddingHorizontal: PAD.sideX,
    },
    main: { flex: 1, paddingTop: PAD.top, paddingBottom: PAD.bottom, paddingHorizontal: PAD.mainX },

    photo: {
      width: S(SPACE.photo),
      height: S(SPACE.photo),
      borderRadius: S(SPACE.photo) / 2,
      alignSelf: "center",
      marginBottom: S(SPACE.sectionGap),
      objectFit: "cover",
    },
    name: { fontSize: S(TYPE.name), fontWeight: 700, lineHeight: 1.12 },
    headline: { fontSize: S(TYPE.headline), color: classic ? MUTED : m.accent, marginTop: S(2) },
    header: { marginBottom: S(SPACE.headerGap) - S(SPACE.sectionGap) },

    section: { marginTop: S(SPACE.sectionGap) },
    sectionFirst: { marginTop: 0 },
    sectionTitle: {
      fontSize: S(TYPE.section),
      fontWeight: 700,
      letterSpacing: S(1.1),
      color: accentTitle,
      paddingBottom: S(2.5),
      marginBottom: S(SPACE.titleGap),
      borderBottomWidth: 0.8,
      borderBottomColor: classic ? "#9AA3AB" : m.accent,
    },
    sideTitle: {
      fontSize: S(TYPE.sideTitle),
      fontWeight: 700,
      letterSpacing: S(1.1),
      color: accentTitle,
      paddingBottom: S(2.5),
      marginBottom: S(SPACE.titleGap),
      borderBottomWidth: 0.8,
      borderBottomColor: tint(m.accent, 0.55),
    },

    para: { marginBottom: S(3) },
    contact: { fontSize: S(TYPE.small), color: INK, textDecoration: "none", marginBottom: S(3) },

    entry: { marginBottom: S(SPACE.entryGap) },
    entryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    entryTitle: { fontSize: S(TYPE.entryTitle), fontWeight: 700, flex: 1, paddingRight: S(8) },
    entryDate: { fontSize: S(TYPE.small), color: MUTED, paddingTop: S(1.3) },
    entrySub: { fontSize: S(TYPE.sub), color: MUTED, fontStyle: "italic", marginTop: S(0.5) },
    entryLink: { color: m.accent, textDecoration: "none", fontStyle: "normal" },

    sideEntry: { marginBottom: S(5) },
    sideEntryTitle: { fontWeight: 700 },
    sideMeta: { fontSize: S(TYPE.small), color: MUTED },

    body: { marginTop: S(1.5) },
    bulletRow: { flexDirection: "row", marginTop: S(SPACE.bulletGap) },
    bulletDot: { width: S(9), color: m.accent },
    bulletText: { flex: 1 },

    pairMain: { marginBottom: S(2.5) },
    pairLabel: { fontWeight: 700 },
    pairSide: { marginBottom: S(5) },
  });
}
type Styles = ReturnType<typeof makeStyles>;

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function LinkText({ l, style }: { l: Link; style: Styles[keyof Styles] }) {
  return l.href ? (
    <PdfLink src={l.href} style={style}>
      {l.text}
    </PdfLink>
  ) : (
    <Text style={style}>{l.text}</Text>
  );
}

function Bullets({ items, s }: { items: string[]; s: Styles }) {
  return (
    <>
      {items.map((t, i) => (
        <View key={i} style={s.bulletRow}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{t}</Text>
        </View>
      ))}
    </>
  );
}

function InlineLink({ l, s }: { l: Link; s: Styles }) {
  return l.href ? (
    <PdfLink src={l.href} style={s.entryLink}>
      {l.text}
    </PdfLink>
  ) : (
    <Text style={s.entryLink}>{l.text}</Text>
  );
}

function MainEntry({ e, s }: { e: Entry; s: Styles }) {
  return (
    <View style={s.entry}>
      <View style={s.entryHead}>
        <Text style={s.entryTitle}>{e.title}</Text>
        {e.date ? <Text style={s.entryDate}>{e.date}</Text> : null}
      </View>
      {e.subtitle || e.link ? (
        <Text style={s.entrySub}>
          {e.subtitle}
          {e.subtitle && e.link ? "  ·  " : ""}
          {e.link ? <InlineLink l={e.link} s={s} /> : null}
        </Text>
      ) : null}
      {e.body ? <Text style={s.body}>{e.body}</Text> : null}
      <Bullets items={e.bullets} s={s} />
    </View>
  );
}

/** Narrow column: everything stacks, no right-aligned dates. */
function SideEntry({ e, s }: { e: Entry; s: Styles }) {
  return (
    <View style={s.sideEntry}>
      <Text style={s.sideEntryTitle}>{e.title}</Text>
      {e.subtitle ? <Text style={s.sideMeta}>{e.subtitle}</Text> : null}
      {e.date ? <Text style={s.sideMeta}>{e.date}</Text> : null}
      {e.link ? (
        <Text style={s.sideMeta}>
          <InlineLink l={e.link} s={s} />
        </Text>
      ) : null}
      {e.body ? <Text style={s.body}>{e.body}</Text> : null}
      <Bullets items={e.bullets} s={s} />
    </View>
  );
}

function BlockView({ b, s, side }: { b: Block; s: Styles; side: boolean }) {
  switch (b.kind) {
    case "text":
      return <Text style={s.para}>{b.text}</Text>;
    case "entries":
      return (
        <>
          {b.entries.map((e, i) => (side ? <SideEntry key={i} e={e} s={s} /> : <MainEntry key={i} e={e} s={s} />))}
        </>
      );
    case "pairs":
      return (
        <>
          {b.pairs.map((p, i) =>
            side ? (
              <View key={i} style={s.pairSide}>
                {p.label ? <Text style={s.pairLabel}>{p.label}</Text> : null}
                <Text>{p.value}</Text>
              </View>
            ) : (
              <Text key={i} style={s.pairMain}>
                {p.label ? <Text style={s.pairLabel}>{p.label}: </Text> : null}
                {p.value}
              </Text>
            ),
          )}
        </>
      );
    case "inline":
      return side ? (
        <>
          {b.items.map((t, i) => (
            <Text key={i} style={s.para}>
              {t}
            </Text>
          ))}
        </>
      ) : (
        <Text style={s.para}>{b.items.join("  ·  ")}</Text>
      );
    case "bullets":
      return <Bullets items={b.items} s={s} />;
  }
}

function SectionView({ sec, s, side, first }: { sec: Section; s: Styles; side: boolean; first: boolean }) {
  return (
    <View style={first ? s.sectionFirst : s.section}>
      <Text style={side ? s.sideTitle : s.sectionTitle}>{sec.title.toUpperCase()}</Text>
      {sec.blocks.map((b, i) => (
        <BlockView key={i} b={b} s={s} side={side} />
      ))}
    </View>
  );
}

function ResumePdf({ m, k }: { m: DocModel; k: number }) {
  const s = makeStyles(m, k);
  return (
    <Document title={`${m.name} – Resume`} author={m.name} creator="Resume builder" producer="Resume builder">
      <Page size={m.pageSize === "LETTER" ? "LETTER" : "A4"} style={s.page}>
        <View style={s.side}>
          {m.photo ? <Image style={s.photo} src={m.photo.dataUrl} /> : null}
          {m.contacts.length ? (
            <View style={s.sectionFirst}>
              <Text style={s.sideTitle}>CONTACT</Text>
              {m.contacts.map((c, i) => (
                <LinkText key={i} l={c} style={s.contact} />
              ))}
            </View>
          ) : null}
          {m.side.map((sec, i) => (
            <SectionView key={sec.key} sec={sec} s={s} side first={i === 0 && !m.contacts.length} />
          ))}
        </View>

        <View style={s.main}>
          <View style={s.header}>
            <Text style={s.name}>{m.name}</Text>
            {m.headline ? <Text style={s.headline}>{m.headline}</Text> : null}
          </View>
          {m.main.map((sec) => (
            <SectionView key={sec.key} sec={sec} s={s} side={false} first={false} />
          ))}
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  One-page fitting                                                    */
/* ------------------------------------------------------------------ */

function pageCount(buf: Buffer): number {
  const matches = buf.toString("latin1").match(/\/Type\s*\/Page(?![a-z])/g);
  return matches ? matches.length : 1;
}

async function renderAt(m: DocModel, k: number) {
  const buf = await renderToBuffer(<ResumePdf m={m} k={k} />);
  return { buf, k, pages: pageCount(buf) };
}

export type FitResult = { buf: Buffer; scale: number; fits: boolean };

/**
 * Renders the resume at the largest text scale that still fits on one page.
 * Starts from the preview's measured hint, then binary-searches downward if needed.
 */
export async function buildFittedPdf(resume: Resume): Promise<FitResult> {
  registerFonts();
  const m = buildModel(resume, "pdf");
  const hint = clampScale(resume.settings.scaleHint);

  const first = await renderAt(m, hint);
  if (first.pages === 1) return { buf: first.buf, scale: hint, fits: true };

  const floor = await renderAt(m, MIN_SCALE);
  if (floor.pages > 1) return { buf: floor.buf, scale: MIN_SCALE, fits: false };

  let best = floor;
  let lo = MIN_SCALE;
  let hi = hint;
  for (let i = 0; i < 5 && hi - lo > 0.005; i++) {
    const mid = (lo + hi) / 2;
    const r = await renderAt(m, mid);
    if (r.pages === 1) {
      best = r;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return { buf: best.buf, scale: best.k, fits: true };
}
