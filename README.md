# Resume builder (Next.js)

Build a resume in the browser and download it as an **editable Word file (.docx)** or a **PDF**.

The resume is always **one page, two columns**: a tinted sidebar (photo, contact, skills, languages…) and a main column (name, summary, experience, education…). In Design you can move any section between columns, reorder or hide sections, put the sidebar left or right, and pick the style, accent colour and paper size.

## How the one-page fit works

1. The live preview binary-searches a text scale (100% down to 72%) so both columns fit the page, and shows the result ("One page, text at 91%").
2. On download, the server renders the PDF at that scale, counts pages, and searches downward if needed, so the PDF is guaranteed to be one page.
3. The Word file uses the same scale (with a 3% safety margin for Word's fonts) and is laid out as a single full-page, borderless two-cell table, so it stays plain, editable text.
4. If the content can't fit even at 72%, the download is refused with a message asking you to trim, instead of silently spilling onto a second page.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production
```

Requires Node 18.18+. Deploys to Vercel as-is (bundled fonts are traced into the PDF route via `next.config.mjs`).

## Structure

```
src/
  app/
    page.tsx, layout.tsx, globals.css
    api/export/docx/route.ts   POST resume JSON -> .docx
    api/export/pdf/route.ts    POST resume JSON -> .pdf
  components/
    Builder.tsx      state, autosave, toolbar, downloads, undo
    editors.tsx      one panel per section + Design panel
    fields.tsx       inputs, toggles, repeatable item list
    PhotoInput.tsx   optional photo, cropped to a circle client-side
    Preview.tsx      live HTML preview (pt units, mirrors the PDF)
  lib/
    schema.ts        Zod schema: single source of truth, lenient loading
    layout.ts        page geometry, type scale, default columns (shared by all renderers)
    model.ts         renderer-agnostic content model + text sanitising
    sample.ts        sample resume
    export/docx.ts   Word builder (docx)
    export/pdf.tsx   PDF builder + one-page fitter (@react-pdf/renderer)
    server/request.ts  validation, size limits, rate limit, file response
assets/fonts/        Inter + Lora TTFs (SIL OFL) used by the PDF
```

## How it stays robust

- Server re-validates everything with Zod; 4 MB body cap; PNG/JPEG-only photos; name required.
- Strips XML-illegal control characters (would corrupt .docx) and unsafe links (`javascript:` etc).
- PDF fonts are bundled (no network), with Inter as glyph fallback for Lora. Emoji are removed from the PDF only (no glyphs).
- Autosave to localStorage with corrupt-data recovery; JSON backup/restore; undo for deletes.
- In-memory rate limit is per instance; use a shared store (e.g. Upstash) if you need a strict limit across serverless instances.
