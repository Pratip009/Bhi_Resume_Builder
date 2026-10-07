"use client";

import { useRef, useState } from "react";
import { MAX_PHOTO_CHARS } from "@/lib/schema";

const OUTPUT_SIZE = 360; // px; prints sharply at ~1" and keeps the payload small
const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file couldn’t be read as an image. Try a JPG or PNG."));
    img.src = src;
  });
}

/** Centre-crops to a square, masks to a circle and re-encodes as PNG, so DOCX and PDF look identical. */
async function processPhoto(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error("Use a JPG, PNG or WebP image. (iPhone HEIC photos: export as JPG first.)");
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error("That image is over 15 MB. Choose a smaller one.");

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("That image has no size. Try another file.");
    const side = Math.min(w, h);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn’t process the image.");
    ctx.imageSmoothingQuality = "high";
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    // Bias the crop slightly upward on portrait photos so faces aren't cut off.
    const sx = (w - side) / 2;
    const sy = h > w ? Math.max(0, (h - side) * 0.3) : 0;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length > MAX_PHOTO_CHARS) throw new Error("The processed photo is too large. Try a simpler image.");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onChange(await processPhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The photo couldn’t be added.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="photo-input">
      <div
        className={`photo-drop ${value ? "has-photo" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handle(e.dataTransfer.files?.[0]);
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Your profile photo" />
        ) : (
          <span aria-hidden className="photo-placeholder">
            ☺
          </span>
        )}
      </div>
      <div className="photo-meta">
        <p className="photo-label">
          Photo <span className="optional">optional</span>
        </p>
        <p className="field-hint">Square crop from the centre. Drag an image here or choose one.</p>
        <div className="photo-actions">
          <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Processing…" : value ? "Replace photo" : "Choose photo"}
          </button>
          {value ? (
            <button type="button" className="btn btn-quiet danger-text" onClick={() => onChange("")}>
              Remove
            </button>
          ) : null}
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          hidden
          onChange={(e) => void handle(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
