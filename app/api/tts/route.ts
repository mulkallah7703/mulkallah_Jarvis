import { NextResponse } from "next/server";
import { prepareSpeechText } from "@/lib/prepare-speech-text";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_CHARS = 700;
const VOICE_ID_RE = /^[a-zA-Z0-9_-]{5,80}$/;
/** Flash first for time-to-first-audio; multilingual if the voice rejects Flash. */
const MODELS = ["eleven_flash_v2_5", "eleven_multilingual_v2"];

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

  if (!key || !voiceId || !VOICE_ID_RE.test(voiceId)) {
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

  let lastStatus = 502;
  for (const model of MODELS) {
    let upstream: Response;
    try {
      upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=pcm_16000&optimize_streaming_latency=3`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/octet-stream",
            "xi-api-key": key,
          },
          body: JSON.stringify({
            text,
            model_id: model,
          }),
          signal: AbortSignal.timeout(12_000),
        },
      );
    } catch {
      console.error("tts: network error");
      return NextResponse.json({ error: "Voice service unreachable." }, { status: 502 });
    }

    if (upstream.ok && upstream.body) {
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Audio-Format": "pcm_16000",
          "Cache-Control": "no-store",
        },
      });
    }

    lastStatus = upstream.status;
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
    console.error("tts: provider error", upstream.status, model, detail || "unspecified");
    const unauthorized = upstream.status === 401 || detail === "missing_permissions" || detail === "invalid_api_key";
    if (unauthorized) {
      return NextResponse.json(
        { error: "Voice is not authorized on the server." },
        { status: 503 },
      );
    }
    /* Flash can 400 on some voices — try the next model before failing. */
  }

  return NextResponse.json(
    { error: "Voice could not be generated." },
    { status: lastStatus === 401 ? 503 : 502 },
  );
}
