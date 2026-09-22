# JARVIS — CLEAN ARCHITECTURE

Current application after cleanup. Not a product vision.

## What JARVIS is

A Next.js 15 single-page holographic assistant:

- Decorative constellation HUD (APEX-UI visual lineage, MIT)
- Procedural Three.js particle bust (`HolographicHumanoid`)
- Chat + mic rail (`ChatHud`)
- Server LLM proxy: Gemini, then OpenAI (`lib/chat-server.ts`)

Tagline: **The AI That Has Attitude** / مساعدك الذكي... بس عنده شخصية.

By **Mulk Allah**. This does **not** mean third-party libraries or APEX-UI-derived files are owned by Mulk Allah.

## Frontend

```
app/layout.tsx
app/page.tsx
  OverviewPanel          clock + weather lamp
  JarvisWorld
    ShaderBackground     WebGL1 plasma (21st.dev MIT)
    ReasoningWeb         SVG constellation
    HolographicHumanoid  Three.js points
    ChatHud              /api/chat + STT/TTS
    OrbStatusBar
```

Client state is React `useState` only. No sessions, no eve, no personality engine, no wake word.

## Backend / API

| Route | Role |
|---|---|
| `GET /api/chat` | `{ ok, configured }` — no key material |
| `POST /api/chat` | `{ messages }` → `{ text, provider }` |
| `GET /api/weather` | Vercel geo + Open-Meteo |

Unauthenticated LLM proxy remains a **security risk**.

## Gemini

`lib/chat-server.ts` → `callGemini` → `generativelanguage.googleapis.com`  
Models: `gemini-3.6-flash`, then `gemini-3.5-flash-lite`  
Key: `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY`

## OpenAI fallback

Same module → `callOpenAI` if Gemini fails.  
Models: `gpt-4o-mini`, `gpt-4.1-mini`  
Key: `OPENAI_API_KEY`

## Hologram

`HolographicHumanoid.tsx`: ~14k body + 2.2k core points, seed 7703, energy-reactive. Not a portrait sampler.

## Voice

`useSpeechInput.ts`: Web Speech STT + `speechSynthesis` TTS.  
`useMicEnergy.ts`: analyser RMS for the bust. No wake word.

## Environment

Server-only: `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`. Never `NEXT_PUBLIC_*` for secrets.

## Routes

`/` only, plus the two API routes.

## Dependencies (runtime)

next, react, react-dom, three, lucide-react.

## Remaining third-party licenses

See `JARVIS_LICENSE_AUDIT.md` and `CREDITS.md`. MIT/ISC/Apache obligations remain.

## Known limitations

No auth, no tests, no streaming, no durable sessions, constellation is decorative, public `/api/chat` cost risk, 21st.dev exact authors unknown.
