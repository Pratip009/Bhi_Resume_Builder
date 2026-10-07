"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { coerceResume, emptyResume, type Resume } from "@/lib/schema";
import { fileBaseName, isEmail } from "@/lib/model";
import { sampleResume } from "@/lib/sample";
import * as E from "./editors";
import { Preview, type Fit } from "./Preview";

const STORAGE_KEY = "resume-builder:v1";
const EXPORT_TIMEOUT_MS = 45_000;

type PanelKey =
  | "profile"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "awards"
  | "volunteer"
  | "languages"
  | "interests"
  | "references"
  | "custom"
  | "design";

const PANELS: { key: PanelKey; label: string; C: ComponentType<{ resume: Resume; update: E.Update; onRemove: (k: E.ListKey, i: number) => void }>; count?: (r: Resume) => number }[] = [
  { key: "profile", label: "Profile", C: E.ProfilePanel },
  { key: "summary", label: "Summary", C: E.SummaryPanel },
  { key: "experience", label: "Experience", C: E.ExperiencePanel, count: (r) => r.experience.length },
  { key: "education", label: "Education", C: E.EducationPanel, count: (r) => r.education.length },
  { key: "skills", label: "Skills", C: E.SkillsPanel, count: (r) => r.skills.length },
  { key: "projects", label: "Projects", C: E.ProjectsPanel, count: (r) => r.projects.length },
  { key: "certifications", label: "Certifications", C: E.CertificationsPanel, count: (r) => r.certifications.length },
  { key: "awards", label: "Awards", C: E.AwardsPanel, count: (r) => r.awards.length },
  { key: "volunteer", label: "Volunteering", C: E.VolunteerPanel, count: (r) => r.volunteer.length },
  { key: "languages", label: "Languages", C: E.LanguagesPanel, count: (r) => r.languages.length },
  { key: "interests", label: "Interests", C: E.InterestsPanel },
  { key: "references", label: "References", C: E.ReferencesPanel, count: (r) => r.references.length },
  { key: "custom", label: "Custom", C: E.CustomPanel, count: (r) => r.custom.length },
  { key: "design", label: "Design", C: E.DesignPanel },
];

type Toast = { id: number; tone: "info" | "error" | "success"; text: string; action?: { label: string; run: () => void } };

export default function Builder() {
  const [resume, setResume] = useState<Resume>(emptyResume);
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [panel, setPanel] = useState<PanelKey>("profile");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState<null | "docx" | "pdf">(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fit, setFit] = useState<Fit>({ scale: 1, overflow: false });
  const importRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* ---------- persistence ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setResume(coerceResume(JSON.parse(raw)));
    } catch {
      // Corrupt or unavailable storage: start fresh rather than crash.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
        setStorageOk(true);
      } catch {
        setStorageOk(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [resume, loaded]);

  /* ---------- toasts ---------- */
  const notify = useCallback((t: Omit<Toast, "id">) => setToast({ ...t, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 7000 : 4500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- menu: close on outside click / Escape ---------- */
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  /* ---------- state updates ---------- */
  const update = useCallback<E.Update>((fn) => {
    setResume((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  // Always-current snapshot, used to offer "Undo" on destructive actions.
  const resumeRef = useRef(resume);
  resumeRef.current = resume;

  const replaceWithUndo = useCallback(
    (next: Resume, message: string) => {
      const snapshot = resumeRef.current;
      setResume(next);
      notify({ tone: "info", text: message, action: { label: "Undo", run: () => setResume(snapshot) } });
    },
    [notify],
  );

  const onRemove = useCallback(
    (key: E.ListKey, index: number) => {
      const snapshot = resumeRef.current;
      const next = structuredClone(snapshot);
      (next[key] as unknown[]).splice(index, 1);
      setResume(next);
      notify({ tone: "info", text: "Entry deleted.", action: { label: "Undo", run: () => setResume(snapshot) } });
    },
    [notify],
  );

  /* ---------- export ---------- */
  async function download(kind: "docx" | "pdf") {
    if (!resume.personal.fullName.trim()) {
      setPanel("profile");
      setMobileView("edit");
      notify({ tone: "error", text: "Add your full name before downloading." });
      setTimeout(() => document.getElementById("field-fullName")?.focus(), 50);
      return;
    }
    if (fit.overflow) {
      setMobileView("preview");
      notify({ tone: "error", text: "Your resume is longer than one page. Shorten some bullet points or hide a section in Design." });
      return;
    }
    if (resume.personal.email.trim() && !isEmail(resume.personal.email)) {
      notify({ tone: "info", text: "Heads up: your email address looks incomplete." });
    }

    setBusy(kind);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/export/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The preview's measured fit is a starting hint; the server re-verifies one page.
        body: JSON.stringify({ ...resume, settings: { ...resume.settings, scaleHint: fit.scale } }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Download failed (error ${res.status}). Try again.`);
      }
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("The server returned an empty file. Try again.");
      saveBlob(blob, `${fileBaseName(resume.personal.fullName)}.${kind}`);
      notify({ tone: "success", text: kind === "pdf" ? "PDF downloaded." : "Word file downloaded. It’s fully editable." });
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "AbortError"
          ? "The download took too long. Check your connection and try again."
          : err instanceof TypeError
            ? "Couldn’t reach the server. Check your connection and try again."
            : err instanceof Error
              ? err.message
              : "Download failed. Try again.";
      notify({ tone: "error", text: msg });
    } finally {
      clearTimeout(timer);
      setBusy(null);
    }
  }

  /* ---------- JSON backup ---------- */
  function exportJson() {
    const blob = new Blob([JSON.stringify(resume, null, 2)], { type: "application/json" });
    saveBlob(blob, `${fileBaseName(resume.personal.fullName)}.json`);
    setMenuOpen(false);
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("That file is too large to be a resume backup.");
      const data = JSON.parse(await file.text());
      replaceWithUndo(coerceResume(data), "Backup loaded.");
    } catch (e) {
      notify({ tone: "error", text: e instanceof SyntaxError ? "That file isn’t a valid backup (JSON)." : e instanceof Error ? e.message : "Couldn’t load that file." });
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }

  const Active = PANELS.find((p) => p.key === panel)!.C;
  const panelIndex = PANELS.findIndex((p) => p.key === panel);
  const next = PANELS[panelIndex + 1];
  const prev = PANELS[panelIndex - 1];

  return (
    <div className="app" data-view={mobileView}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-name">Resume builder</span>
          <span className={`save-state ${storageOk ? "" : "is-error"}`} role="status">
            {!loaded ? "" : storageOk ? "Saved in this browser" : "Not saved: browser storage is full. Download a backup."}
          </span>
        </div>

        <div className="actions">
          <div className="menu" ref={menuRef}>
            <button type="button" className="btn btn-quiet" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              More
            </button>
            {menuOpen ? (
              <div className="menu-list" role="menu">
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    replaceWithUndo({ ...sampleResume(), settings: resume.settings }, "Sample loaded.");
                  }}
                >
                  Load sample resume
                </button>
                <button role="menuitem" type="button" onClick={exportJson}>
                  Download backup (.json)
                </button>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    importRef.current?.click();
                  }}
                >
                  Restore from backup…
                </button>
                <hr />
                <button
                  role="menuitem"
                  type="button"
                  className="danger-text"
                  onClick={() => {
                    setMenuOpen(false);
                    replaceWithUndo(emptyResume(), "Started over.");
                    setPanel("profile");
                  }}
                >
                  Start over
                </button>
              </div>
            ) : null}
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => void importJson(e.target.files?.[0])} />
          </div>

          <button type="button" className="btn btn-secondary" disabled={busy !== null} onClick={() => void download("docx")}>
            {busy === "docx" ? <span className="spinner" aria-hidden /> : null}
            {busy === "docx" ? "Preparing…" : "Download Word"}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void download("pdf")}>
            {busy === "pdf" ? <span className="spinner" aria-hidden /> : null}
            {busy === "pdf" ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </header>

      <div className="view-switch" role="tablist" aria-label="View">
        <button role="tab" aria-selected={mobileView === "edit"} onClick={() => setMobileView("edit")}>
          Edit
        </button>
        <button role="tab" aria-selected={mobileView === "preview"} onClick={() => setMobileView("preview")}>
          Preview
        </button>
      </div>

      <main className="workspace">
        <nav className="rail" aria-label="Resume sections">
          <ul>
            {PANELS.map((p) => {
              const n = p.count?.(resume) ?? 0;
              return (
                <li key={p.key}>
                  <button type="button" className={panel === p.key ? "is-active" : ""} aria-current={panel === p.key ? "page" : undefined} onClick={() => setPanel(p.key)}>
                    <span>{p.label}</span>
                    {n > 0 ? <span className="badge">{n}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="editor">
          {loaded ? <Active resume={resume} update={update} onRemove={onRemove} /> : <div className="loading">Loading your resume…</div>}
          <div className="pager">
            {prev ? (
              <button type="button" className="btn btn-quiet" onClick={() => setPanel(prev.key)}>
                ← {prev.label}
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button type="button" className="btn btn-quiet" onClick={() => setPanel(next.key)}>
                {next.label} →
              </button>
            ) : null}
          </div>
        </div>

        <aside className="desk" aria-label="Live preview">
          <div className="desk-bar">
            <span>Live preview</span>
            <span className={`desk-meta ${fit.overflow ? "is-error" : ""}`} role="status">
              {fit.overflow
                ? "Too long for one page. Trim content to download."
                : fit.scale < 0.995
                  ? `One page, text at ${Math.round(fit.scale * 100)}%`
                  : "One page"}
            </span>
          </div>
          <Preview resume={resume} onFit={setFit} />
        </aside>
      </main>

      {toast ? (
        <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"} key={toast.id}>
          <span>{toast.text}</span>
          {toast.action ? (
            <button
              type="button"
              onClick={() => {
                toast.action!.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setToast(null)}>
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
