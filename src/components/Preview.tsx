"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Resume } from "@/lib/schema";
import { buildModel, type Block, type Entry, type Link, type Section } from "@/lib/model";
import { MIN_SCALE, PAD, PAGE_PT, SIDEBAR_RATIO, SPACE, TYPE, tint } from "@/lib/layout";

const PT_TO_PX = 96 / 72;

export type Fit = { scale: number; overflow: boolean };

function LinkText({ l, className }: { l: Link; className?: string }) {
  return l.href ? (
    <a href={l.href} target="_blank" rel="noreferrer noopener" className={className}>
      {l.text}
    </a>
  ) : (
    <span className={className}>{l.text}</span>
  );
}

function Bullets({ items }: { items: string[] }) {
  return items.length ? (
    <ul className="rv-bullets">
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  ) : null;
}

function MainEntry({ e }: { e: Entry }) {
  return (
    <div className="rv-entry">
      <div className="rv-entry-head">
        <span className="rv-entry-title">{e.title}</span>
        {e.date ? <span className="rv-entry-date">{e.date}</span> : null}
      </div>
      {e.subtitle || e.link ? (
        <div className="rv-entry-sub">
          {e.subtitle}
          {e.subtitle && e.link ? "  ·  " : ""}
          {e.link ? <LinkText l={e.link} className="rv-link" /> : null}
        </div>
      ) : null}
      {e.body ? <p className="rv-body">{e.body}</p> : null}
      <Bullets items={e.bullets} />
    </div>
  );
}

function SideEntry({ e }: { e: Entry }) {
  return (
    <div className="rv-side-entry">
      <div className="rv-strong">{e.title}</div>
      {e.subtitle ? <div className="rv-meta">{e.subtitle}</div> : null}
      {e.date ? <div className="rv-meta">{e.date}</div> : null}
      {e.link ? (
        <div className="rv-meta">
          <LinkText l={e.link} className="rv-link" />
        </div>
      ) : null}
      {e.body ? <p className="rv-body">{e.body}</p> : null}
      <Bullets items={e.bullets} />
    </div>
  );
}

function BlockView({ b, side }: { b: Block; side: boolean }) {
  switch (b.kind) {
    case "text":
      return <p className="rv-para">{b.text}</p>;
    case "entries":
      return <>{b.entries.map((e, i) => (side ? <SideEntry key={i} e={e} /> : <MainEntry key={i} e={e} />))}</>;
    case "pairs":
      return (
        <>
          {b.pairs.map((p, i) =>
            side ? (
              <div key={i} className="rv-pair-side">
                {p.label ? <div className="rv-strong">{p.label}</div> : null}
                <div>{p.value}</div>
              </div>
            ) : (
              <p key={i} className="rv-pair">
                {p.label ? <strong>{p.label}: </strong> : null}
                {p.value}
              </p>
            ),
          )}
        </>
      );
    case "inline":
      return side ? (
        <>
          {b.items.map((t, i) => (
            <p key={i} className="rv-para">
              {t}
            </p>
          ))}
        </>
      ) : (
        <p className="rv-para">{b.items.join("  ·  ")}</p>
      );
    case "bullets":
      return <Bullets items={b.items} />;
  }
}

function SectionView({ s, side, first }: { s: Section; side: boolean; first: boolean }) {
  return (
    <section className={`rv-section ${first ? "is-first" : ""}`}>
      <h2 className={side ? "rv-side-title" : "rv-section-title"}>{s.title}</h2>
      {s.blocks.map((b, i) => (
        <BlockView key={i} b={b} side={side} />
      ))}
    </section>
  );
}

export function Preview({ resume, onFit }: { resume: Resume; onFit?: (f: Fit) => void }) {
  const model = useMemo(() => buildModel(resume, "html"), [resume]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<Fit>({ scale: 1, overflow: false });
  const [fontsTick, setFontsTick] = useState(0);

  const page = PAGE_PT[model.pageSize];
  const pageWpx = page.w * PT_TO_PX;
  const pageHpx = page.h * PT_TO_PX;

  // Zoom the page to the available width.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setZoom(Math.min(1.25, Math.max(0.3, entry.contentRect.width / pageWpx))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageWpx]);

  // Re-measure once web fonts have loaded (metrics change).
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return;
    let alive = true;
    document.fonts.ready.then(() => alive && setFontsTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, []);

  // Find the largest text scale at which both columns fit on one page (same search the server does).
  useLayoutEffect(() => {
    const paper = paperRef.current;
    const side = sideRef.current;
    const main = mainRef.current;
    if (!paper || !side || !main) return;
    const tallest = (k: number) => {
      paper.style.setProperty("--k", String(k));
      return Math.max(side.offsetHeight, main.offsetHeight);
    };
    const limit = pageHpx - 1;
    let k = 1;
    let overflow = false;
    if (tallest(1) > limit) {
      if (tallest(MIN_SCALE) > limit) {
        k = MIN_SCALE;
        overflow = true;
      } else {
        let lo = MIN_SCALE;
        let hi = 1;
        for (let i = 0; i < 9; i++) {
          const mid = (lo + hi) / 2;
          if (tallest(mid) <= limit) lo = mid;
          else hi = mid;
        }
        k = Math.floor(lo * 1000) / 1000;
      }
    }
    paper.style.setProperty("--k", String(k));
    setFit((prev) => (prev.scale === k && prev.overflow === overflow ? prev : { scale: k, overflow }));
  }, [model, fontsTick]);

  useEffect(() => onFit?.(fit), [fit, onFit]);

  const style = {
    "--accent": model.accent,
    "--tint": tint(model.accent, 0.9),
    "--rule": tint(model.accent, 0.55),
    "--page-w": `${page.w}pt`,
    "--page-h": `${page.h}pt`,
    "--side-w": `${SIDEBAR_RATIO * 100}%`,
    "--pad-top": `${PAD.top}pt`,
    "--pad-bottom": `${PAD.bottom}pt`,
    "--pad-side": `${PAD.sideX}pt`,
    "--pad-main": `${PAD.mainX}pt`,
    "--t-body": `${TYPE.body}pt`,
    "--t-small": `${TYPE.small}pt`,
    "--t-sub": `${TYPE.sub}pt`,
    "--t-name": `${TYPE.name}pt`,
    "--t-headline": `${TYPE.headline}pt`,
    "--t-section": `${TYPE.section}pt`,
    "--t-entry": `${TYPE.entryTitle}pt`,
    "--lh": TYPE.lineHeight,
    "--s-header": `${SPACE.headerGap}pt`,
    "--s-section": `${SPACE.sectionGap}pt`,
    "--s-title": `${SPACE.titleGap}pt`,
    "--s-entry": `${SPACE.entryGap}pt`,
    "--s-bullet": `${SPACE.bulletGap}pt`,
    "--s-photo": `${SPACE.photo}pt`,
    transform: `scale(${zoom})`,
  } as CSSProperties;

  const empty = !model.name && model.sections.length === 0 && !model.contacts.length;
  const contentPx = Math.max(pageHpx, (sideRef.current?.offsetHeight ?? 0), (mainRef.current?.offsetHeight ?? 0));

  return (
    <div className="preview-wrap" ref={wrapRef}>
      <div className="preview-scaler" style={{ height: `${(fit.overflow ? contentPx : pageHpx) * zoom}px` }}>
        <div
          ref={paperRef}
          className={`paper rv rv-${model.template} sidebar-${model.sidebar} ${fit.overflow ? "is-overflowing" : ""}`}
          style={style}
          aria-label="Resume preview"
        >
          <div className="rv-side" ref={sideRef}>
            {model.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="rv-photo" src={model.photo.dataUrl} alt="" />
            ) : null}
            {model.contacts.length ? (
              <section className="rv-section is-first">
                <h2 className="rv-side-title">Contact</h2>
                {model.contacts.map((c, i) => (
                  <div key={i} className="rv-contact">
                    <LinkText l={c} />
                  </div>
                ))}
              </section>
            ) : null}
            {model.side.map((s, i) => (
              <SectionView key={s.key} s={s} side first={i === 0 && !model.contacts.length} />
            ))}
          </div>

          <div className="rv-main" ref={mainRef}>
            {empty ? (
              <div className="rv-empty">
                <p>Your resume will appear here.</p>
                <p>Start with your name in Profile, or load the sample from the menu.</p>
              </div>
            ) : (
              <>
                <header className="rv-header">
                  <h1 className="rv-name">{model.name || "Your name"}</h1>
                  {model.headline ? <p className="rv-headline">{model.headline}</p> : null}
                </header>
                {model.main.map((s) => (
                  <SectionView key={s.key} s={s} side={false} first={false} />
                ))}
              </>
            )}
          </div>

          {fit.overflow ? (
            <div className="page-end" style={{ top: "var(--page-h)" }} aria-hidden>
              <span>Page ends here. Content below won’t fit.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
