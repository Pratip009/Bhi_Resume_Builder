"use client";

import { useId, useState, type ReactNode } from "react";

type BaseProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  maxLength?: number;
  required?: boolean;
  id?: string;
};

export function Field({
  type = "text",
  autoComplete,
  inputMode,
  ...p
}: BaseProps & {
  type?: "text" | "email" | "tel" | "url";
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "url";
}) {
  const auto = useId();
  const id = p.id ?? auto;
  const describedBy = p.error ? `${id}-err` : p.hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {p.label}
        {p.required ? <span className="req" aria-hidden> *</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={p.value}
        placeholder={p.placeholder}
        maxLength={p.maxLength ?? 200}
        autoComplete={autoComplete ?? "off"}
        inputMode={inputMode}
        aria-invalid={p.error ? true : undefined}
        aria-describedby={describedBy}
        required={p.required}
        onChange={(e) => p.onChange(e.target.value)}
      />
      {p.error ? (
        <p id={`${id}-err`} className="field-error">
          {p.error}
        </p>
      ) : p.hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {p.hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextArea({ rows = 4, ...p }: BaseProps & { rows?: number }) {
  const auto = useId();
  const id = p.id ?? auto;
  const max = p.maxLength ?? 4000;
  const near = p.value.length > max * 0.85;
  return (
    <div className="field">
      <label htmlFor={id}>{p.label}</label>
      <textarea
        id={id}
        rows={rows}
        value={p.value}
        placeholder={p.placeholder}
        maxLength={max}
        aria-describedby={p.hint ? `${id}-hint` : undefined}
        onChange={(e) => p.onChange(e.target.value)}
      />
      <div className="field-foot">
        {p.hint ? (
          <p id={`${id}-hint`} className="field-hint">
            {p.hint}
          </p>
        ) : (
          <span />
        )}
        {near ? (
          <span className="count">
            {p.value.length}/{max}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <input id={id} type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        {label}
        {hint ? <span className="field-hint">{hint}</span> : null}
      </label>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="row">{children}</div>;
}

/* ------------------------------------------------------------------ */
/*  Repeatable entries                                                 */
/* ------------------------------------------------------------------ */

type ItemListProps<T extends { id: string }> = {
  items: T[];
  max?: number;
  addLabel: string;
  emptyText: string;
  titleOf: (item: T) => string;
  subtitleOf?: (item: T) => string;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  render: (item: T, index: number) => ReactNode;
};

export function ItemList<T extends { id: string }>(p: ItemListProps<T>) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const max = p.max ?? 40;
  const isOpen = (item: T, i: number) => open[item.id] ?? (i === p.items.length - 1 && !p.titleOf(item));

  return (
    <div className="item-list">
      {p.items.length === 0 ? <p className="empty">{p.emptyText}</p> : null}
      {p.items.map((item, i) => {
        const expanded = isOpen(item, i);
        const title = p.titleOf(item) || "Untitled entry";
        const sub = p.subtitleOf?.(item);
        return (
          <div key={item.id} className={`item ${expanded ? "is-open" : ""}`}>
            <div className="item-head">
              <button
                type="button"
                className="item-toggle"
                aria-expanded={expanded}
                onClick={() => setOpen((o) => ({ ...o, [item.id]: !expanded }))}
              >
                <span className="chev" aria-hidden>
                  ›
                </span>
                <span className="item-title">
                  <strong>{title}</strong>
                  {sub ? <span>{sub}</span> : null}
                </span>
              </button>
              <div className="item-actions">
                <button type="button" className="icon-btn" aria-label={`Move ${title} up`} disabled={i === 0} onClick={() => p.onMove(i, i - 1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${title} down`}
                  disabled={i === p.items.length - 1}
                  onClick={() => p.onMove(i, i + 1)}
                >
                  ↓
                </button>
                <button type="button" className="icon-btn danger" aria-label={`Delete ${title}`} onClick={() => p.onRemove(i)}>
                  ✕
                </button>
              </div>
            </div>
            {expanded ? <div className="item-body">{p.render(item, i)}</div> : null}
          </div>
        );
      })}
      <button
        type="button"
        className="btn btn-dashed"
        disabled={p.items.length >= max}
        onClick={() => {
          p.onAdd();
        }}
      >
        + {p.addLabel}
      </button>
      {p.items.length >= max ? <p className="field-hint">You’ve reached the limit of {max} entries.</p> : null}
    </div>
  );
}
