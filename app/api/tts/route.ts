import { NextResponse } from "next/server";
import { prepareSpeechText } from "@/lib/prepare-speech-text";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_CHARS = 4000;
const MODEL = "eleven_multilingual_v2";
const VOICE_ID_RE = /^[a-zA-Z0-9_-]{5,80}$/;

function env(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  return trimmed || undefined;
}

function configured(): boolean {
  const key = env("ELEVENLABS_API_KEY");
  const voiceId = env("ELEVENLABS_VOICE_ID");
  return Boolean(key && voiceId && VOICE_ID_RE.test(voiceId));
}

/** Health check — never returns key material. */
export async function GET() {
  return NextResponse.json({ ok: true, configured: configured() });
}

export async function POST(request: Request) {
  const key = env("ELEVENLABS_API_KEY");
  const voiceId = env("ELEVENLABS_VOICE_ID");

  if (!key || !voiceId) {
    return NextResponse.json(
      { error: "Voice is not configured on the server." },
      { status: 503 },
    );
  }

  if (!VOICE_ID_RE.test(voiceId)) {
    return NextResponse.json(
      { error: "Voice is not configured on the server." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body with text." }, { status: 400 });
  }

  const raw =
    body && typeof body === "object" && "text" in body
      ? (body as { text: unknown }).text
      : undefined;
  if (typeof raw !== "string") {
    return NextResponse.json({ error: "Expected JSON { text: string }." }, { status: 400 });
  }

  const text = prepareSpeechText(raw).slice(0, MAX_CHARS);
  if (!text) {
    return NextResponse.json({ error: "Text is empty." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": key,
        },
        body: JSON.stringify({
          text,
          model_id: MODEL,
        }),
        signal: AbortSignal.timeout(28_000),
      },
    );
  } catch {
    console.error("tts: network error");
    return NextResponse.json({ error: "Voice service unreachable." }, { status: 502 });
  }

  if (!upstream.ok) {
    let detail = "";
    try {
      const errJson: unknown = JSON.parse(await upstream.text());
      const status =
        errJson &&
        typeof errJson === "object" &&
        "detail" in errJson &&
        (errJson as { detail?: { status?: unknown } }).detail?.status;
      if (typeof status === "string" && /^[a-z0-9_]+$/i.test(status)) detail = status;
    } catch {
      /* ignore body */
    }
    console.error("tts: provider error", upstream.status, detail || "unspecified");
    const unauthorized = upstream.status === 401 || detail === "missing_permissions" || detail === "invalid_api_key";
    return NextResponse.json(
      { error: unauthorized ? "Voice is not authorized on the server." : "Voice could not be generated." },
      { status: unauthorized ? 503 : 502 },
    );
  }

  const audio = await upstream.arrayBuffer();
  if (!audio.byteLength) {
    return NextResponse.json({ error: "Voice could not be generated." }, { status: 502 });
  }

  return new NextResponse(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
