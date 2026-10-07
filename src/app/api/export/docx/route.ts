import { buildDocx } from "@/lib/export/docx";
import { buildFittedPdf } from "@/lib/export/pdf";
import { fileResponse, jsonError, parseResumeRequest } from "@/lib/server/request";
import { TOO_LONG_MESSAGE } from "@/lib/server/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const parsed = await parseResumeRequest(req);
  if (!parsed.ok) return parsed.response;
  try {
    // The PDF engine measures text exactly, so it decides the one-page scale for both formats.
    const fit = await buildFittedPdf(parsed.resume);
    if (!fit.fits) return jsonError(422, TOO_LONG_MESSAGE, { code: "too_long" });
    const buf = await buildDocx(parsed.resume, fit.scale);
    return fileResponse(buf, parsed.resume.personal.fullName, "docx");
  } catch (err) {
    console.error("[export/docx]", err);
    return jsonError(500, "The Word file could not be generated. Try again, or remove the photo if it keeps failing.");
  }
}
