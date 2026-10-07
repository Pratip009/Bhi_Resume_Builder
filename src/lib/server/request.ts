import "server-only";
import { resumeSchema, type Resume } from "../schema";
import { fileBaseName } from "../model";

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB (photo is capped at ~2.5 MB of base64)

/* ---------- tiny in-memory rate limiter (per instance, best effort) ---------- */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(req: Request): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export function jsonError(status: number, error: string, details?: unknown) {
  return Response.json({ error, details }, { status, headers: { "Cache-Control": "no-store" } });
}

type Parsed = { ok: true; resume: Resume } | { ok: false; response: Response };

export async function parseResumeRequest(req: Request): Promise<Parsed> {
  if (rateLimited(req)) {
    return { ok: false, response: jsonError(429, "Too many downloads in a short time. Wait a minute and try again.") };
  }
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return { ok: false, response: jsonError(415, "Send the resume as JSON.") };
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return { ok: false, response: jsonError(413, "Resume data is too large. Try a smaller photo.") };
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { ok: false, response: jsonError(400, "Could not read the request.") };
  }
  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, response: jsonError(413, "Resume data is too large. Try a smaller photo.") };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, response: jsonError(400, "Resume data is not valid JSON.") };
  }

  const parsed = resumeSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message }));
    const first = issues[0];
    return {
      ok: false,
      response: jsonError(422, first ? `Check "${first.path}": ${first.message}` : "Resume data is invalid.", issues),
    };
  }
  if (!parsed.data.personal.fullName.trim()) {
    return { ok: false, response: jsonError(422, "Add your full name before downloading.") };
  }
  return { ok: true, resume: parsed.data };
}

export function fileResponse(buf: Buffer, name: string, ext: "docx" | "pdf") {
  const filename = `${fileBaseName(name)}.${ext}`;
  const type =
    ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(buf.length),
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
