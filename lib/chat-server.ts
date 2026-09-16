/**
 * Server-only LLM calls. Keys never leave this module.
 * Gemini is primary (GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY);
 * OpenAI is the fallback.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

export const JARVIS_SYSTEM = `You are Jarvis, a holographic AI assistant for Mulkallah.
Be concise, capable, and lightly witty — a personal operator, not a corporate chatbot.
Reply in Arabic when the user writes Arabic; otherwise reply in English.
Keep answers short unless the user asks for depth. No markdown tables. No secret leakage.`;

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash-lite",
];

const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4.1-mini"];

export function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || undefined;
}

export function openaiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || undefined;
}

export function hasAnyKey(): boolean {
  return Boolean(geminiKey() || openaiKey());
}

function geminiText(data: unknown): string {
  const d = data as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

function openaiText(data: unknown): string {
  const d = data as { choices?: { message?: { content?: string | null } }[] };
  return (d?.choices?.[0]?.message?.content ?? "").trim();
}

async function callGemini(
  model: string,
  key: string,
  turns: ChatTurn[],
  signal: AbortSignal,
): Promise<string> {
  const contents = turns.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: JARVIS_SYSTEM }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
      signal,
    },
  );

  if (!res.ok) {
    throw new Error(`gemini ${model} ${res.status}`);
  }
  const data: unknown = await res.json();
  const text = geminiText(data);
  if (!text) throw new Error(`gemini ${model} empty`);
  return text;
}

async function callOpenAI(
  model: string,
  key: string,
  turns: ChatTurn[],
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 1024,
      messages: [{ role: "system", content: JARVIS_SYSTEM }, ...turns],
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`openai ${model} ${res.status}`);
  }
  const data: unknown = await res.json();
  const text = openaiText(data);
  if (!text) throw new Error(`openai ${model} empty`);
  return text;
}

export async function completeChat(
  turns: ChatTurn[],
): Promise<{ text: string; provider: "gemini" | "openai" }> {
  const gKey = geminiKey();
  const oKey = openaiKey();
  const signal = AbortSignal.timeout(22_000);

  if (gKey) {
    for (const model of GEMINI_MODELS) {
      try {
        const text = await callGemini(model, gKey, turns, signal);
        return { text, provider: "gemini" };
      } catch {
        /* try next Gemini model, then OpenAI */
      }
    }
  }

  if (oKey) {
    for (const model of OPENAI_MODELS) {
      try {
        const text = await callOpenAI(model, oKey, turns, signal);
        return { text, provider: "openai" };
      } catch {
        /* try next OpenAI model */
      }
    }
  }

  if (!gKey && !oKey) {
    throw Object.assign(new Error("No LLM API keys configured on the server."), { status: 503 });
  }
  throw Object.assign(new Error("Jarvis could not reach Gemini or OpenAI."), { status: 502 });
}
