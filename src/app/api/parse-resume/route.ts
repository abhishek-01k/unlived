import { parseResume } from "@/features/resume/api/parser";
import { pdfToText } from "@/features/resume/api/pdf";
import { redactPII } from "@/features/resume/api/redact";

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const MIN_CHARS = 200;
const MAX_CHARS = 30_000;

const error = (status: number, message: string) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error(400, "Send the resume as multipart/form-data.");
  }

  let text = "";
  const file = form.get("file");
  const pasted = form.get("text");

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return error(413, "That PDF is over 5 MB. Try a smaller file.");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return error(415, "Please upload a PDF.");
    }
    try {
      text = await pdfToText(await file.arrayBuffer());
    } catch {
      return error(422, "We couldn't read that PDF. Try exporting it again, or paste the text instead.");
    }
  } else if (typeof pasted === "string") {
    text = pasted.trim();
  } else {
    return error(400, "Upload a PDF or paste your resume text.");
  }

  if (text.length < MIN_CHARS) {
    return error(422, "We found almost no text. If it's a scanned PDF, paste the text instead.");
  }

  const { text: redacted, removed } = redactPII(text.slice(0, MAX_CHARS));
  if (process.env.LOG_REDACTED === "true") console.log("[parse-resume] redacted text:\n" + redacted);

  try {
    const { profile, droppedSkills } = await parseResume(redacted);
    if (droppedSkills.length) console.warn("[parse-resume] dropped ungrounded skills:", droppedSkills);
    return Response.json(profile, { headers: { "x-redacted": JSON.stringify(removed) } });
  } catch (err) {
    console.error("[parse-resume]", err);
    return error(502, "Our AI couldn't read this resume right now. Please try again.");
  }
}
