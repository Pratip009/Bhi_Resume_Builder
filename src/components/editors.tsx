"use client";

import type { ReactNode } from "react";
import { SECTION_KEYS, SECTION_LABELS, blank, type Resume, type SectionKey } from "@/lib/schema";
import { isEmail, safeUrl } from "@/lib/model";
import { Field, ItemList, Row, TextArea, Toggle } from "./fields";
import { PhotoInput } from "./PhotoInput";

export type Update = (fn: (draft: Resume) => void) => void;
export type ListKey = "experience" | "education" | "skills" | "projects" | "certifications" | "awards" | "volunteer" | "languages" | "references" | "custom";

type Props = { resume: Resume; update: Update; onRemove: (key: ListKey, index: number) => void };

/* ---------- helpers ---------- */

function listHandlers<K extends ListKey>(key: K, update: Update, onRemove: Props["onRemove"]) {
  return {
    onAdd: () =>
      update((d) => {
        (d[key] as { id: string }[]).push(blank[key]());
      }),
    onRemove: (i: number) => onRemove(key, i),
    onMove: (from: number, to: number) =>
      update((d) => {
        const arr = d[key] as unknown[];
        if (to < 0 || to >= arr.length) return;
        const [it] = arr.splice(from, 1);
        arr.splice(to, 0, it);
      }),
  };
}

function patchItem<K extends ListKey>(update: Update, key: K, index: number) {
  return <F extends keyof Resume[K][number]>(field: F, value: Resume[K][number][F]) =>
    update((d) => {
      const item = (d[key] as Resume[K][number][])[index];
      if (item) item[field] = value;
    });
}

const urlError = (v: string) => (v.trim() && !safeUrl(v) ? "This doesn’t look like a web address." : undefined);

function Panel({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="panel" aria-labelledby={`panel-${title}`}>
      <header className="panel-head">
        <h2 id={`panel-${title}`}>{title}</h2>
        {intro ? <p>{intro}</p> : null}
      </header>
      {children}
    </section>
  );
}

const BULLET_HINT = "One achievement per line. Start with a verb and include a number where you can.";

/* ---------- panels ---------- */

export function ProfilePanel({ resume, update }: Props) {
  const p = resume.personal;
  const set = (k: keyof typeof p) => (v: string) =>
    update((d) => {
      d.personal[k] = v;
    });
  return (
    <Panel title="Profile" intro="How employers reach you. Only your name is required.">
      <PhotoInput value={p.photo} onChange={set("photo")} />
      <Field id="field-fullName" label="Full name" required value={p.fullName} onChange={set("fullName")} placeholder="Maya Okafor" maxLength={100} autoComplete="name" />
      <Field label="Headline" value={p.headline} onChange={set("headline")} placeholder="Senior Product Engineer" maxLength={150} hint="Your current title or the role you’re targeting." />
      <Row>
        <Field
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={p.email}
          onChange={set("email")}
          placeholder="you@example.com"
          error={p.email.trim() && !isEmail(p.email) ? "Check the email address." : undefined}
        />
        <Field label="Phone" type="tel" inputMode="tel" autoComplete="tel" value={p.phone} onChange={set("phone")} placeholder="+1 415 555 0142" maxLength={60} />
      </Row>
      <Field label="Location" value={p.location} onChange={set("location")} placeholder="City, Country" maxLength={150} />
      <Row>
        <Field label="Website" type="url" inputMode="url" value={p.website} onChange={set("website")} placeholder="yoursite.com" maxLength={300} error={urlError(p.website)} />
        <Field label="LinkedIn" type="url" inputMode="url" value={p.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/you" maxLength={300} error={urlError(p.linkedin)} />
      </Row>
      <Field label="GitHub or portfolio" type="url" inputMode="url" value={p.github} onChange={set("github")} placeholder="github.com/you" maxLength={300} error={urlError(p.github)} />
    </Panel>
  );
}

export function SummaryPanel({ resume, update }: Props) {
  return (
    <Panel title="Summary" intro="Two to four sentences on who you are and what you’re great at.">
      <TextArea
        label="Professional summary"
        rows={7}
        maxLength={3000}
        value={resume.summary}
        onChange={(v) =>
          update((d) => {
            d.summary = v;
          })
        }
        placeholder="Product engineer with 8 years building web platforms…"
        hint="Separate paragraphs with a new line."
      />
    </Panel>
  );
}

export function ExperiencePanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="Experience" intro="Most recent first. Use the arrows to reorder.">
      <ItemList
        items={resume.experience}
        addLabel="Add position"
        emptyText="No positions yet."
        titleOf={(e) => e.role || e.company}
        subtitleOf={(e) => [e.role ? e.company : "", e.current ? `${e.start} – Present` : [e.start, e.end].filter(Boolean).join(" – ")].filter(Boolean).join(" · ")}
        {...listHandlers("experience", update, onRemove)}
        render={(e, i) => {
          const set = patchItem(update, "experience", i);
          return (
            <>
              <Row>
                <Field label="Job title" value={e.role} onChange={(v) => set("role", v)} placeholder="Senior Engineer" />
                <Field label="Company" value={e.company} onChange={(v) => set("company", v)} placeholder="Company name" />
              </Row>
              <Field label="Location" value={e.location} onChange={(v) => set("location", v)} placeholder="City or Remote" />
              <Row>
                <Field label="Start" value={e.start} onChange={(v) => set("start", v)} placeholder="Mar 2021" maxLength={40} />
                {e.current ? (
                  <div className="field">
                    <label>End</label>
                    <div className="static-input">Present</div>
                  </div>
                ) : (
                  <Field label="End" value={e.end} onChange={(v) => set("end", v)} placeholder="Jun 2024" maxLength={40} />
                )}
              </Row>
              <Toggle label="I currently work here" checked={e.current} onChange={(v) => set("current", v)} />
              <TextArea label="Achievements" rows={5} value={e.bullets} onChange={(v) => set("bullets", v)} hint={BULLET_HINT} placeholder={"Led the rebuild of…\nCut costs by 30% by…"} />
            </>
          );
        }}
      />
    </Panel>
  );
}

export function EducationPanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="Education">
      <ItemList
        items={resume.education}
        addLabel="Add education"
        emptyText="No education added yet."
        titleOf={(e) => e.degree || e.school}
        subtitleOf={(e) => (e.degree ? e.school : "")}
        {...listHandlers("education", update, onRemove)}
        render={(e, i) => {
          const set = patchItem(update, "education", i);
          return (
            <>
              <Field label="Degree or qualification" value={e.degree} onChange={(v) => set("degree", v)} placeholder="B.S. Computer Science" />
              <Row>
                <Field label="School" value={e.school} onChange={(v) => set("school", v)} placeholder="University name" />
                <Field label="Location" value={e.location} onChange={(v) => set("location", v)} />
              </Row>
              <Row>
                <Field label="Start" value={e.start} onChange={(v) => set("start", v)} placeholder="2013" maxLength={40} />
                <Field label="End" value={e.end} onChange={(v) => set("end", v)} placeholder="2017 or Expected 2026" maxLength={40} />
              </Row>
              <Field label="Grade" value={e.grade} onChange={(v) => set("grade", v)} placeholder="GPA 3.8 / First class honours" maxLength={80} />
              <TextArea label="Details" rows={3} maxLength={2000} value={e.details} onChange={(v) => set("details", v)} hint="Thesis, coursework or honours. One per line." />
            </>
          );
        }}
      />
    </Panel>
  );
}

export function SkillsPanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="Skills" intro="Group related skills so they’re easy to scan.">
      <ItemList
        items={resume.skills}
        addLabel="Add skill group"
        emptyText="No skills yet."
        titleOf={(g) => g.name || g.items.split(",")[0]?.trim() || ""}
        subtitleOf={(g) => (g.name ? g.items : "")}
        {...listHandlers("skills", update, onRemove)}
        render={(g, i) => {
          const set = patchItem(update, "skills", i);
          return (
            <>
              <Field label="Group name" value={g.name} onChange={(v) => set("name", v)} placeholder="Languages, Tools, Design…" maxLength={80} hint="Leave empty for an unlabelled list." />
              <TextArea label="Skills" rows={3} maxLength={1000} value={g.items} onChange={(v) => set("items", v)} placeholder="TypeScript, React, PostgreSQL" hint="Separate with commas." />
            </>
          );
        }}
      />
    </Panel>
  );
}

export function ProjectsPanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="Projects">
      <ItemList
        items={resume.projects}
        addLabel="Add project"
        emptyText="No projects yet."
        titleOf={(p) => p.name}
        subtitleOf={(p) => p.tech}
        {...listHandlers("projects", update, onRemove)}
        render={(p, i) => {
          const set = patchItem(update, "projects", i);
          return (
            <>
              <Field label="Project name" value={p.name} onChange={(v) => set("name", v)} />
              <Row>
                <Field label="Link" type="url" value={p.link} onChange={(v) => set("link", v)} placeholder="github.com/you/project" maxLength={300} error={urlError(p.link)} />
                <Field label="Technologies" value={p.tech} onChange={(v) => set("tech", v)} placeholder="Next.js, Postgres" maxLength={300} />
              </Row>
              <Row>
                <Field label="Start" value={p.start} onChange={(v) => set("start", v)} maxLength={40} />
                <Field label="End" value={p.end} onChange={(v) => set("end", v)} maxLength={40} />
              </Row>
              <TextArea label="Highlights" rows={4} value={p.bullets} onChange={(v) => set("bullets", v)} hint={BULLET_HINT} />
            </>
          );
        }}
      />
    </Panel>
  );
}

export function CertificationsPanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="Certifications">
      <ItemList
        items={resume.certifications}
        addLabel="Add certification"
        emptyText="No certifications yet."
        titleOf={(c) => c.name}
        subtitleOf={(c) => c.issuer}
        {...listHandlers("certifications", update, onRemove)}
        render={(c, i) => {
          const set = patchItem(update, "certifications", i);
          return (
            <>
              <Field label="Name" value={c.name} onChange={(v) => set("name", v)} />
              <Row>
                <Field label="Issuer" value={c.issuer} onChange={(v) => set("issuer", v)} />
                <Field label="Date" value={c.date} onChange={(v) => set("date", v)} maxLength={40} placeholder="2024" />
              </Row>
              <Field label="Credential link" type="url" value={c.link} onChange={(v) => set("link", v)} maxLength={300} error={urlError(c.link)} />
            </>
          );
        }}
      />
    </Panel>
  );
}

export function AwardsPanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="Awards">
      <ItemList
        items={resume.awards}
        addLabel="Add award"
        emptyText="No awards yet."
        titleOf={(a) => a.title}
        subtitleOf={(a) => a.issuer}
        {...listHandlers("awards", update, onRemove)}
        render={(a, i) => {
          const set = patchItem(update, "awards", i);
          return (
            <>
              <Field label="Award" value={a.title} onChange={(v) => set("title", v)} />
              <Row>
                <Field label="Awarded by" value={a.issuer} onChange={(v) => set("issuer", v)} />
                <Field label="Date" value={a.date} onChange={(v) => set("date", v)} maxLength={40} />
              </Row>
              <TextArea label="Description" rows={3} maxLength={1000} value={a.description} onChange={(v) => set("description", v)} />
            </>
          );
        }}
      />
    </Panel>
  );
}

export function VolunteerPanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="Volunteering">
      <ItemList
        items={resume.volunteer}
        addLabel="Add volunteering"
        emptyText="No volunteering yet."
        titleOf={(v) => v.role || v.organization}
        subtitleOf={(v) => (v.role ? v.organization : "")}
        {...listHandlers("volunteer", update, onRemove)}
        render={(v, i) => {
          const set = patchItem(update, "volunteer", i);
          return (
            <>
              <Row>
                <Field label="Role" value={v.role} onChange={(x) => set("role", x)} />
                <Field label="Organisation" value={v.organization} onChange={(x) => set("organization", x)} />
              </Row>
              <Row>
                <Field label="Start" value={v.start} onChange={(x) => set("start", x)} maxLength={40} />
                <Field label="End" value={v.end} onChange={(x) => set("end", x)} maxLength={40} />
              </Row>
              <TextArea label="What you did" rows={3} maxLength={2000} value={v.description} onChange={(x) => set("description", x)} hint="One point per line." />
            </>
          );
        }}
      />
    </Panel>
  );
}

export function LanguagesPanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="Languages">
      <ItemList
        items={resume.languages}
        addLabel="Add language"
        emptyText="No languages yet."
        titleOf={(l) => l.name}
        subtitleOf={(l) => l.level}
        {...listHandlers("languages", update, onRemove)}
        render={(l, i) => {
          const set = patchItem(update, "languages", i);
          return (
            <Row>
              <Field label="Language" value={l.name} onChange={(v) => set("name", v)} maxLength={80} />
              <Field label="Level" value={l.level} onChange={(v) => set("level", v)} maxLength={80} placeholder="Native, Fluent, B2…" />
            </Row>
          );
        }}
      />
    </Panel>
  );
}

export function InterestsPanel({ resume, update }: Props) {
  return (
    <Panel title="Interests" intro="A short, human line. Keep it brief.">
      <TextArea
        label="Interests"
        rows={3}
        maxLength={1000}
        value={resume.interests}
        onChange={(v) =>
          update((d) => {
            d.interests = v;
          })
        }
        placeholder="Bouldering, film photography, community radio"
        hint="Separate with commas."
      />
    </Panel>
  );
}

export function ReferencesPanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="References">
      <Toggle
        label="Show “Available on request” when no references are listed"
        checked={resume.referencesOnRequest}
        onChange={(v) =>
          update((d) => {
            d.referencesOnRequest = v;
          })
        }
      />
      <ItemList
        items={resume.references}
        max={10}
        addLabel="Add reference"
        emptyText="No references listed."
        titleOf={(r) => r.name}
        subtitleOf={(r) => [r.title, r.company].filter(Boolean).join(", ")}
        {...listHandlers("references", update, onRemove)}
        render={(r, i) => {
          const set = patchItem(update, "references", i);
          return (
            <>
              <Field label="Name" value={r.name} onChange={(v) => set("name", v)} />
              <Row>
                <Field label="Title" value={r.title} onChange={(v) => set("title", v)} />
                <Field label="Company" value={r.company} onChange={(v) => set("company", v)} />
              </Row>
              <Row>
                <Field label="Email" type="email" value={r.email} onChange={(v) => set("email", v)} error={r.email.trim() && !isEmail(r.email) ? "Check the email address." : undefined} />
                <Field label="Phone" type="tel" value={r.phone} onChange={(v) => set("phone", v)} maxLength={60} />
              </Row>
            </>
          );
        }}
      />
    </Panel>
  );
}

export function CustomPanel({ resume, update, onRemove }: Props) {
  return (
    <Panel title="Custom sections" intro="Publications, talks, patents, anything else. Each one becomes its own section.">
      <ItemList
        items={resume.custom}
        max={10}
        addLabel="Add section"
        emptyText="No custom sections yet."
        titleOf={(c) => c.title}
        {...listHandlers("custom", update, onRemove)}
        render={(c, i) => {
          const set = patchItem(update, "custom", i);
          return (
            <>
              <Field label="Section title" value={c.title} onChange={(v) => set("title", v)} placeholder="Publications" maxLength={80} />
              <TextArea label="Content" rows={5} value={c.content} onChange={(v) => set("content", v)} hint="One item per line. Multiple lines become a bulleted list." />
            </>
          );
        }}
      />
    </Panel>
  );
}

/* ---------- design ---------- */

const ACCENTS = [
  { name: "Cobalt", hex: "#2F4BD8" },
  { name: "Pine", hex: "#0E7C66" },
  { name: "Oxblood", hex: "#8C2F39" },
  { name: "Graphite", hex: "#2E3440" },
  { name: "Plum", hex: "#6B3FA0" },
  { name: "Ochre", hex: "#9A6A0B" },
];

export function DesignPanel({ resume, update }: Props) {
  const s = resume.settings;
  const hidden = new Set(s.hiddenSections);
  const move = (from: number, to: number) =>
    update((d) => {
      const arr = d.settings.sectionOrder;
      if (to < 0 || to >= arr.length) return;
      const [k] = arr.splice(from, 1);
      arr.splice(to, 0, k);
    });
  const toggleHidden = (k: SectionKey, show: boolean) =>
    update((d) => {
      const set = new Set(d.settings.hiddenSections);
      if (show) set.delete(k);
      else set.add(k);
      d.settings.hiddenSections = SECTION_KEYS.filter((x) => set.has(x));
    });

  return (
    <Panel title="Design" intro="Applies to the preview, the Word file and the PDF.">
      <fieldset className="choice-group">
        <legend>Style</legend>
        <div className="template-grid">
          {(["modern", "classic"] as const).map((t) => (
            <label key={t} className={`template-card ${s.template === t ? "is-active" : ""}`}>
              <input
                type="radio"
                name="template"
                value={t}
                checked={s.template === t}
                onChange={() =>
                  update((d) => {
                    d.settings.template = t;
                  })
                }
              />
              <span className={`thumb thumb-${t}`} aria-hidden>
                <span className="thumb-side" />
                <span className="thumb-main">
                  <i />
                  <b />
                  <b />
                  <b />
                </span>
              </span>
              <span className="template-name">{t === "modern" ? "Modern" : "Classic"}</span>
              <span className="field-hint">{t === "modern" ? "Sans serif, coloured headings" : "Serif, quiet headings"}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="choice-group">
        <legend>Accent colour</legend>
        <div className="swatches">
          {ACCENTS.map((a) => (
            <button
              key={a.hex}
              type="button"
              className={`swatch ${s.accent.toUpperCase() === a.hex ? "is-active" : ""}`}
              style={{ background: a.hex }}
              aria-label={a.name}
              aria-pressed={s.accent.toUpperCase() === a.hex}
              onClick={() =>
                update((d) => {
                  d.settings.accent = a.hex;
                })
              }
            />
          ))}
          <label className="swatch-custom">
            <input
              type="color"
              value={s.accent}
              onChange={(e) =>
                update((d) => {
                  d.settings.accent = e.target.value.toUpperCase();
                })
              }
            />
            Custom
          </label>
        </div>
      </fieldset>

      <fieldset className="choice-group">
        <legend>Sidebar</legend>
        <div className="segmented">
          {(["left", "right"] as const).map((side) => (
            <label key={side} className={s.sidebar === side ? "is-active" : ""}>
              <input
                type="radio"
                name="sidebar"
                checked={s.sidebar === side}
                onChange={() =>
                  update((d) => {
                    d.settings.sidebar = side;
                  })
                }
              />
              {side === "left" ? "On the left" : "On the right"}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="choice-group">
        <legend>Paper size</legend>
        <div className="segmented">
          {(["A4", "LETTER"] as const).map((p) => (
            <label key={p} className={s.pageSize === p ? "is-active" : ""}>
              <input
                type="radio"
                name="pageSize"
                checked={s.pageSize === p}
                onChange={() =>
                  update((d) => {
                    d.settings.pageSize = p;
                  })
                }
              />
              {p === "A4" ? "A4" : "US Letter"}
            </label>
          ))}
        </div>
      </fieldset>

      <Toggle
        label="Show photo"
        checked={s.showPhoto}
        hint={resume.personal.photo ? undefined : "Add a photo in Profile to use this."}
        onChange={(v) =>
          update((d) => {
            d.settings.showPhoto = v;
          })
        }
      />

      <fieldset className="choice-group">
        <legend>Sections</legend>
        <p className="field-hint">
          Choose the column for each section and its order. Untick a section to leave it out without deleting what you wrote. The resume always fits on one page; text shrinks a little if needed.
        </p>
        <ol className="order-list">
          {s.sectionOrder.map((k, i) => (
            <li key={k} className={hidden.has(k) ? "is-hidden" : ""}>
              <label>
                <input type="checkbox" checked={!hidden.has(k)} onChange={(e) => toggleHidden(k, e.target.checked)} />
                {SECTION_LABELS[k]}
              </label>
              <span className="col-toggle" role="group" aria-label={`Column for ${SECTION_LABELS[k]}`}>
                {(["side", "main"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={s.columns[k] === c}
                    className={s.columns[k] === c ? "is-active" : ""}
                    onClick={() =>
                      update((d) => {
                        d.settings.columns[k] = c;
                      })
                    }
                  >
                    {c === "side" ? "Sidebar" : "Main"}
                  </button>
                ))}
              </span>
              <span className="item-actions">
                <button type="button" className="icon-btn" aria-label={`Move ${SECTION_LABELS[k]} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${SECTION_LABELS[k]} down`}
                  disabled={i === s.sectionOrder.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      </fieldset>
    </Panel>
  );
}
