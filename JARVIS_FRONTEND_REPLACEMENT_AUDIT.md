# JARVIS — FRONTEND REPLACEMENT AUDIT

Read-only inspection completed **before** code changes. Backend is LOCKED.

Recorded at audit time (pre-replacement git status includes prior cleanup work plus untracked `app/particle_hologram.html`).

## Before-state (must remain functionally equivalent)

| Capability | Current status | Contract |
|---|---|---|
| Chat API | Working | `GET /api/chat` → `{ ok, configured }`; `POST /api/chat` `{ messages: [{ role, content }] }` → `{ text, provider }` |
| Gemini | Primary | `lib/chat-server.ts` `GEMINI_MODELS` then OpenAI |
| OpenAI fallback | Configured | Same module; not moved to the browser |
| Voice STT | `useSpeechInput` | Web Speech API; `onFinal(text)` → existing `send()` |
| Voice TTS | `speakText` in `useSpeechInput.ts` | Called from `ChatHud` when voice replies on |
| Personality / sessions / eve / auth | **Absent** | Do not invent |
| Build | Last cleanup: PASS | Must still pass |

## OLD FRONTEND

Fullscreen APEX-lineage stage in `app/page.tsx`:

- `OverviewPanel` — clock / weather lamp (calls `GET /api/weather`)
- `JarvisWorld` — navy gradient, `ShaderBackground`, decorative `ReasoningWeb` constellation, tap-to-energize core, agent dialog
- `HolographicHumanoid` — **procedural Three.js Points bust** (not a portrait image)
- `OrbStatusBar` — STANDBY / LISTENING / PROCESSING / SPEAKING
- `ChatHud` — right rail chat + mic; **owns all client chat/voice orchestration**

Visual identity: command-center HUD. Hologram is a generated humanoid, not the particle portrait.

## NEW FRONTEND

`app/particle_hologram.html` (~3.3 MB because of an inline PNG):

- Black full-viewport void
- One `<canvas id="hologram">` (Canvas **2D**, not WebGL, not Three.js)
- `object-fit: contain` so the portrait is not cropped or stretched
- Embedded portrait: `const IMAGE_DATA = "data:image/png;base64,..."` (PNG, natural size used as canvas buffer)
- Pixel sample `STEP=3`, skip pixels dimmer than `MIN_BRIGHT=18`
- Particles: home `(hx,hy)`, live `(x,y)`, velocity, original RGB, phase
- Loop: mouse repulsion, spring return (`RETURN=0.08`), damping `0.82`, jitter, shimmer, scan line, rare flicker
- Plot via `ImageData` / `Uint32Array` little-endian
- **No chat, no mic, no API**

This HTML must be converted into a React client component. Do **not** iframe it. Do **not** `dangerouslySetInnerHTML` the file.

Portrait asset: extract the PNG to `public/jarvis-portrait.png` and load `/jarvis-portrait.png` (same image, Next-static path). Do not substitute another face.

## FRONTEND FILES TO REMOVE

After the new stage is wired and imports are gone:

| File | Why |
|---|---|
| `components/JarvisWorld.tsx` | Old visual shell + constellation + fake agent dialog |
| `components/ReasoningWeb.jsx` | Old APEX constellation |
| `components/ShaderBackground.jsx` | Old plasma backdrop |
| `components/OrbStatusBar.jsx` | Old orb chrome (status label moves to minimal HUD) |
| `components/OverviewPanel.tsx` | Old overview lamp (weather route stays) |
| `components/HolographicHumanoid.tsx` | Replaced by 2D portrait particles |
| `app/particle_hologram.html` | Not a Next route; source extracted into component + `public/` |

Do **not** remove solely because a name looks old. Confirm zero imports first.

## FRONTEND FILES TO KEEP

| File | Why |
|---|---|
| `components/ChatHud.tsx` | Existing `send()` → `POST /api/chat`; mic; TTS; orb callbacks |
| `components/useSpeechInput.ts` | Existing STT + `speakText` |
| `components/useMicEnergy.ts` | Existing analyser RMS — drive hologram energy only |
| `components/orb-state.ts` | `idle \| thinking \| speaking \| listening` |
| `app/layout.tsx` | JARVIS metadata (copy may stay) |
| `app/globals.css` | Restyle for new stage; keep chat-rail utility classes |

`lucide-react` stays (ChatHud icons). `three` becomes unused after humanoid removal — uninstall only then.

## BACKEND FILES TO NEVER TOUCH

- `app/api/chat/route.ts`
- `app/api/weather/route.ts`
- `lib/chat-server.ts`
- `.env.local` / `.env.example`
- `GEMINI_MODELS` / `OPENAI_MODELS` / keys / fallback / prompt

No `agent/`, `server/`, or `database/` directories exist.

## API CONTRACTS

**GET `/api/chat`** → `{ ok: true, configured: boolean }` (no key material).

**POST `/api/chat`**

```json
{ "messages": [{ "role": "user"|"assistant", "content": "string" }] }
```

Last turn must be `user`. Server slices last 20, 8000 chars/message.

Success: `{ "text": string, "provider": "gemini"|"openai" }`  
Error: `{ "error": string }` with 400 / 502 / 503.

**GET `/api/weather`** — unchanged on the server. New UI does not need to call it.

Do not add a second AI route. Do not call Gemini/OpenAI from the browser.

## VOICE CONTRACTS

`useSpeechInput(enabled, paused, lang, onFinal)`:

- `enabled` = mic on
- `paused` = chat pending / TTS / unsupported
- `onFinal` → **existing** `ChatHud` `send(text)`

`speakText(text, lang, onStart, onEnd)` — existing TTS. New UI must not reimplement SpeechRecognition.

## AI CONTRACTS

Client never sees keys. `ChatHud.send` already:

1. `onOrbState("thinking")`
2. `fetch("/api/chat", { method:"POST", body: JSON.stringify({ messages }) })`
3. Append `data.text`
4. Optional `speakText` → `onOrbState("speaking")` → idle

Keep this path. New buttons only call the same handlers.

## STATE THAT MUST BE PRESERVED

| State | Owner | New UI role |
|---|---|---|
| `turns` / `draft` / `pending` | ChatHud | Unchanged |
| `micOn` | Stage (was JarvisWorld) | Same; ChatHud `onMicChange` |
| `orbState` | Stage + ChatHud `onOrbState` | Drive particle mode: idle / listening / thinking / speaking |
| `voiceOut` / `lang` | ChatHud | Unchanged |
| `energy` | `useMicEnergy` | Optional visual amplitude only |
| LLM messages / provider | Server | Unchanged |

Map: `idle + micOn` → visual `listening` (same as current stage). Do not fake thinking/speaking.

## PLANNED NEW FILES

- `public/jarvis-portrait.png` — extracted from `IMAGE_DATA`
- `components/ParticleHologram.tsx` — original 2D engine in a client component (one canvas, one rAF, cleanup on unmount)
- `components/JarvisStage.tsx` — void + hologram + minimal JARVIS HUD + existing `ChatHud`

`app/page.tsx` will mount `JarvisStage` only.

## DEPENDENCIES

No new libraries. Canvas 2D only. After humanoid removal, drop unused `three` / `@types/three` if nothing else imports them.

## BRANDING

JARVIS / The AI That Has Attitude / مساعدك الذكي... بس عنده شخصية.  
No APEX constellation, no Reznikov socials, no CLICK AN AGENT.

## GIT

Do not commit or push. Do not rewrite history.
