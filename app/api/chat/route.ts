import { NextResponse } from "next/server";
import {
  completeChat,
  completeChatStream,
  hasAnyKey,
  type ChatTurn,
} from "@/lib/chat-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseTurns(body: unknown): ChatTurn[] | null {
  if (!body || typeof body !== "object" || !("messages" in body)) return null;
  const raw = (body as { messages: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const turns: ChatTurn[] = [];
  for (const item of raw.slice(-20)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role === "user" || role === "assistant") && typeof content === "string") {
      const text = content.trim().slice(0, 8000);
      if (text) turns.push({ role, content: text });
    }
  }

  if (!turns.length || turns[turns.length - 1].role !== "user") return null;
  return turns;
}

function wantsStream(request: Request, body: unknown): boolean {
  if (request.headers.get("accept")?.includes("text/event-stream")) return true;
  return Boolean(body && typeof body === "object" && "stream" in body && (body as { stream?: unknown }).stream);
}

/** Health check — never returns key material. */
export async function GET() {
  return NextResponse.json({ ok: true, configured: hasAnyKey() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON body with messages." },
      { status: 400 },
    );
  }

  const turns = parseTurns(body);
  if (!turns) {
    return NextResponse.json(
      { error: "Expected JSON { messages: [{ role: 'user'|'assistant', content: string }] } with a final user turn." },
      { status: 400 },
    );
  }

  if (!wantsStream(request, body)) {
    try {
      const result = await completeChat(turns);
      return NextResponse.json({
        text: result.text,
        provider: result.provider,
        model: result.model,
        ms: result.ms,
      });
    } catch (err) {
      const status = typeof err === "object" && err && "status" in err
        ? Number((err as { status: unknown }).status) || 502
        : 502;
      const message = err instanceof Error ? err.message : "Chat failed.";
      return NextResponse.json({ error: message }, { status });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      void completeChatStream(turns, send)
        .then(() => controller.close())
        .catch((err) => {
          const message = err instanceof Error ? err.message : "Chat failed.";
          send({ type: "error", error: message });
          controller.close();
        });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
