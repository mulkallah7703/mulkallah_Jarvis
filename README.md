# JARVIS

**The AI That Has Attitude**

مساعدك الذكي... بس عنده شخصية.

Holographic voice-and-text assistant by **Mulk Allah**.

Repository: [mulkallah7703/mulkallah_Jarvis](https://github.com/mulkallah7703/mulkallah_Jarvis)

## Features

- Fullscreen particle-portrait hologram
- Chat (Gemini primary, OpenAI fallback)
- Browser speech recognition (microphone)
- ElevenLabs cloned-voice replies (server TTS)
- Visual states: listening → thinking → speaking → standby

## Run locally

```bash
npm install
cp .env.example .env.local   # paste keys — never commit this file
npm run dev
```

Open http://localhost:3000 (or the port Next.js prints if 3000 is busy).

Open chat from the **right-side comms button**. The **mic** stays on that stack and works when chat is closed. Use **EN mic / AR mic** to switch recognition language. Use **Voice muted / Voice replies on**, **Stop**, and **Replay** in the chat dock.

## Environment variables

Keys stay on the server (`app/api/chat`). Do not prefix them with `NEXT_PUBLIC_`.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini (preferred) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Same Gemini key, alternate name |
| `OPENAI_API_KEY` | Fallback LLM if Gemini fails |
| `ELEVENLABS_API_KEY` | Server-side Text-to-Speech |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice to speak replies |

## Credits and licenses

This project is **MIT-licensed**. It is **not** license-free.

- Original JARVIS application code: Mulk Allah (MIT)
- HUD / constellation / overview lamp lineage: [APEX-UI](https://github.com/RubenM1990/APEX-UI) by Ruben Mouradian / Reznikov Engineering (MIT) — copyright retained in `LICENSE`
- Shader backdrop and overview-lamp design: MIT community components from [21st.dev](https://21st.dev/community/components) — see `CREDITS.md`
- npm libraries: see `JARVIS_LICENSE_AUDIT.md`

Keeping `LICENSE` and `CREDITS.md` is required under those MIT terms.

## Documentation

- `JARVIS_CLEAN_ARCHITECTURE.md` — how the app is wired
- `JARVIS_LICENSE_AUDIT.md` — dependency and copied-code licenses
- `JARVIS_REMOVED_LEGACY.md` — files and branding removed in cleanup
