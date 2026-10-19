import { streamLetter } from "@/features/roadmap/api/narrator";
import { LetterRequest } from "@/features/roadmap/types";

// POST LetterRequest → streamed plain text: a letter from the user, 12 months
// from now, on one path and in one kind of future. Nemotron 3 Ultra.
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = LetterRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid letter request." }, { status: 400 });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamLetter(parsed.data)) controller.enqueue(encoder.encode(chunk));
        controller.close();
      } catch (err) {
        console.error("[letter]", err);
        controller.error(err);
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
