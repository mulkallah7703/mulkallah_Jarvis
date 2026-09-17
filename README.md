# Mulkallah Jarvis

Holographic AI assistant UI for [mulkallah7703/mulkallah_Jarvis](https://github.com/mulkallah7703/mulkallah_Jarvis).

Built on the open **APEX-UI** framework (MIT), with a **center hologram portrait** (`public/jarvis-hologram.png`) instead of a procedural particle mesh.

## Features
- APEX-style HUD, agent graph, shader backdrop
- Center hologram: the provided particle-portrait artwork, served as a static PNG
- Chat HUD: type a message and get a reply (Gemini primary, OpenAI fallback)
- Voice: mic captures speech (Web Speech API in Chrome / Edge / Safari) and Jarvis can speak replies (browser `speechSynthesis`)
- Core / humanoid state: listening → thinking → speaking → standby

## Run locally

```bash
npm install
cp .env.example .env.local   # then paste keys — never commit this file
npm run dev
```

Open http://localhost:3000

Open chat from the **right-side comms button**. The **mic** stays on that same right stack and works even when chat is closed. Use **EN mic / AR mic** inside the panel to switch recognition language. Toggle **Voice replies** if you only want text.

## Environment variables

Keys stay on the server (`app/api/chat`). Do not prefix them with `NEXT_PUBLIC_`.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini (preferred) — https://aistudio.google.com/apikey |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Same Gemini key, alternate name — used if `GEMINI_API_KEY` is unset |
| `OPENAI_API_KEY` | Fallback LLM if Gemini fails |

On Vercel: Project → Settings → Environment Variables (Production / Preview / Development).

### Check the brain route

```bash
# missing body → 400
curl -sS -o /tmp/j.json -w "%{http_code}\n" -X POST https://YOUR-APP.vercel.app/api/chat \
  -H 'content-type: application/json'

# health (no secrets) — { "ok": true, "configured": true|false }
curl -sS https://YOUR-APP.vercel.app/api/chat

# with a message → 200 when keys are set
curl -sS https://YOUR-APP.vercel.app/api/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say hi in one sentence."}]}'
```

## Deploy (Vercel)

```bash
npm run build
vercel --prod
```

Or connect this GitHub repo in the Vercel dashboard (Framework: Next.js). After merge to `main`, Production auto-deploys.

## Credits
- Base UI: [RubenM1990/APEX-UI](https://github.com/RubenM1990/APEX-UI) (MIT) — see `CREDITS.md`
- Hologram face: `public/jarvis-hologram.png` (static portrait artwork)
