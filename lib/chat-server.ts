/**
 * Server-only LLM calls. Keys never leave this module.
 * Gemini Flash-Lite is primary (GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY);
 * OpenAI is the fallback. Replies stream so TTS can start on the first sentence.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

export const JARVIS_SYSTEM = `You are Jarvis, Mulkallah's holographic assistant.
Spoken reply: 1-2 short sentences, under 25 words, unless the user asks for detail.
Arabic if the user writes Arabic; otherwise English.
No markdown, lists, or preamble.`;

const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const OPENAI_MODELS = ["gpt-4o-mini"];

export function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || undefined;
}

export function openaiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || undefined;
}

export function hasAnyKey(): boolean {
  return Boolean(geminiKey() || openaiKey());
}

/** Last 6 turns, older lines trimmed, so time-to-first-token stays low. */
export function compactTurns(turns: ChatTurn[]): ChatTurn[] {
  const sliced = turns.slice(-6);
  const compact: ChatTurn[] = [];
  for (let i = 0; i < sliced.length; i++) {
    const cap = i === sliced.length - 1 ? 2000 : 500;
    const content = sliced[i].content.trim().slice(0, cap);
    if (content) compact.push({ role: sliced[i].role, content });
  }
  return compact;
}

function geminiText(data: unknown): string {
  const d = data as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  let out = "";
  for (const part of parts) {
    if (part.thought) continue;
    if (part.text) out += part.text;
  }
  return out;
}

function openaiText(data: unknown): string {
  const d = data as { choices?: { message?: { content?: string | null }; delta?: { content?: string | null } }[] };
  const choice = d?.choices?.[0];
  return (choice?.delta?.content ?? choice?.message?.content ?? "").trim();
}

function geminiBody(turns: ChatTurn[], thinking: boolean) {
  const generationConfig: {
    maxOutputTokens: number;
    thinkingConfig?: { thinkingLevel: string };
  } = { maxOutputTokens: 180 };
  if (thinking) generationConfig.thinkingConfig = { thinkingLevel: "minimal" };
  return {
    systemInstruction: { parts: [{ text: JARVIS_SYSTEM }] },
    contents: turns.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig,
  };
}

async function readSse(res: Response, onJson: (data: unknown) => void): Promise<void> {
  if (!res.body) throw new Error("empty stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        onJson(JSON.parse(payload));
      } catch {
        /* ignore a partial frame */
      }
    }
  }
}

/** Gemini sometimes sends the full text so far, sometimes only the new piece. */
function deltaFrom(previous: string, piece: string): { next: string; delta: string } {
  if (!piece) return { next: previous, delta: "" };
  if (piece.startsWith(previous)) return { next: piece, delta: piece.slice(previous.length) };
  return { next: previous + piece, delta: piece };
}

async function callGemini(
  model: string,
  key: string,
  turns: ChatTurn[],
  timeoutMs: number,
): Promise<string> {
  let res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify(geminiBody(turns, true)),
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (res.status === 400) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify(geminiBody(turns, false)),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  }
  if (!res.ok) throw new Error(`gemini ${model} ${res.status}`);
  const text = geminiText(await res.json()).trim();
  if (!text) throw new Error(`gemini ${model} empty`);
  return text;
}

async function callOpenAI(
  model: string,
  key: string,
  turns: ChatTurn[],
  timeoutMs: number,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 180,
      messages: [{ role: "system", content: JARVIS_SYSTEM }, ...turns],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`openai ${model} ${res.status}`);
  const text = openaiText(await res.json());
  if (!text) throw new Error(`openai ${model} empty`);
  return text;
}

export async function completeChat(
  turns: ChatTurn[],
): Promise<{ text: string; provider: "gemini" | "openai"; model: string; ms: number }> {
  const compact = compactTurns(turns);
  const gKey = geminiKey();
  const oKey = openaiKey();
  const t0 = Date.now();

  if (gKey) {
    for (const model of GEMINI_MODELS) {
      try {
        const text = await callGemini(model, gKey, compact, 8000);
        return { text, provider: "gemini", model, ms: Date.now() - t0 };
      } catch {
        /* next model */
      }
    }
  }

  if (oKey) {
    for (const model of OPENAI_MODELS) {
      try {
        const text = await callOpenAI(model, oKey, compact, 8000);
        return { text, provider: "openai", model, ms: Date.now() - t0 };
      } catch {
        /* next model */
      }
    }
  }

  if (!gKey && !oKey) {
    throw Object.assign(new Error("No LLM API keys configured on the server."), { status: 503 });
  }
  throw Object.assign(new Error("Jarvis could not reach Gemini or OpenAI."), { status: 502 });
}

export type ChatStreamEvent =
  | { type: "meta"; provider: "gemini" | "openai"; model: string }
  | { type: "delta"; text: string }
  | { type: "done"; text: string; provider: "gemini" | "openai"; model: string; ms: number };

async function streamGemini(
  model: string,
  key: string,
  turns: ChatTurn[],
  emit: (event: ChatStreamEvent) => void,
): Promise<void> {
  const t0 = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
  const headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": key,
  };
  let res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(geminiBody(turns, true)),
    signal: AbortSignal.timeout(12_000),
  });
  if (res.status === 400) {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(geminiBody(turns, false)),
      signal: AbortSignal.timeout(12_000),
    });
  }
  if (!res.ok || !res.body) throw new Error(`gemini ${model} ${res.status}`);

  emit({ type: "meta", provider: "gemini", model });
  let acc = "";
  await readSse(res, (data) => {
    const piece = geminiText(data);
    const next = deltaFrom(acc, piece);
    acc = next.next;
    if (next.delta) emit({ type: "delta", text: next.delta });
  });
  const text = acc.trim();
  if (!text) throw new Error(`gemini ${model} empty`);
  emit({ type: "done", text, provider: "gemini", model, ms: Date.now() - t0 });
}

async function streamOpenAI(
  model: string,
  key: string,
  turns: ChatTurn[],
  emit: (event: ChatStreamEvent) => void,
): Promise<void> {
  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 180,
      messages: [{ role: "system", content: JARVIS_SYSTEM }, ...turns],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok || !res.body) throw new Error(`openai ${model} ${res.status}`);

  emit({ type: "meta", provider: "openai", model });
  let acc = "";
  await readSse(res, (data) => {
    const piece = openaiText(data);
    if (!piece) return;
    acc += piece;
    emit({ type: "delta", text: piece });
  });
  const text = acc.trim();
  if (!text) throw new Error(`openai ${model} empty`);
  emit({ type: "done", text, provider: "openai", model, ms: Date.now() - t0 });
}

export async function completeChatStream(
  turns: ChatTurn[],
  emit: (event: ChatStreamEvent) => void,
): Promise<void> {
  const compact = compactTurns(turns);
  const gKey = geminiKey();
  const oKey = openaiKey();
  let started = false;
  const tracked = (event: ChatStreamEvent) => {
    started = true;
    emit(event);
  };

  if (gKey) {
    for (const model of GEMINI_MODELS) {
      try {
        await streamGemini(model, gKey, compact, tracked);
        return;
      } catch (err) {
        if (started) throw err;
      }
    }
  }

  if (oKey) {
    for (const model of OPENAI_MODELS) {
      try {
        await streamOpenAI(model, oKey, compact, tracked);
        return;
      } catch (err) {
        if (started) throw err;
      }
    }
  }

  if (!gKey && !oKey) {
    throw Object.assign(new Error("No LLM API keys configured on the server."), { status: 503 });
  }
  throw Object.assign(new Error("Jarvis could not reach Gemini or OpenAI."), { status: 502 });
}
