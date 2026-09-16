# Mulkallah Jarvis

Holographic AI assistant UI for [mulkallah7703/mulkallah_Jarvis](https://github.com/mulkallah7703/mulkallah_Jarvis).

Built on the open **APEX-UI** framework (MIT), with a **custom particle humanoid** (blue body + orange core) inspired by the Astra/Apex reel look — not the paid Humanoid kit.

## Features
- APEX-style HUD, agent graph, shader backdrop
- Original Three.js holographic bust (procedural particles)
- Mic-reactive glow (Enable mic)
- Tap the center to cycle idle → thinking → speaking

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment variables

For the **visual UI only**, no API keys are required.

Later (voice / chat brain), you will need:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini (Live / chat) — get from https://aistudio.google.com/apikey |
| `OPENAI_API_KEY` | Optional alternative LLM / TTS |

Do **not** commit keys. Use Vercel Project → Settings → Environment Variables, or a local `.env.local`.

## Deploy (Vercel)

```bash
npm run build
vercel --prod
```

Or connect this GitHub repo in the Vercel dashboard (Framework: Next.js).

## Credits
- Base UI: [RubenM1990/APEX-UI](https://github.com/RubenM1990/APEX-UI) (MIT) — see `CREDITS.md`
- Humanoid face: original Mulkallah Jarvis procedural particle mesh
