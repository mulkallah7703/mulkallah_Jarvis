# JARVIS — CURRENT STATE

Permanent technical reference for **this repository as it exists today**.

**Checkout:** `c:\Users\malak\Desktop\myprojects\MulkAllah_Jarvis`  
**Branch:** `main`  
**HEAD:** `a9f2f6ad203cbfc27c524a62820e0b19141b0edb`  
**Remote:** `https://github.com/mulkallah7703/mulkallah_Jarvis.git`  
**Working tree at audit:** clean, up to date with `origin/main`

This document records **only** what is present in the current tree (plus git history that explains deleted code). It is not a product vision. It is not a backlog. Systems named in older briefings (eve, personality modes, wake word, `/chat`, `/s/[id]`, portrait-particle sampling, scatter/reassembly) are listed here **only if they exist**, or explicitly as **MISSING**.

**Evidence labels used throughout:**

| Label | Meaning |
|---|---|
| VERIFIED FROM CODE | Present in current source |
| VERIFIED FROM GIT | Present in git history / refs |
| VERIFIED FROM CONFIGURATION | Present in package.json, tsconfig, next.config, .env.example, .gitignore, git config |
| INFERRED | Logical consequence of code; not independently observed at runtime |
| NOT VERIFIED | Not run, not deployed-inspected, or unknown |

Runtime of the UI, microphone, TTS, Gemini, OpenAI, and Vercel production was **not executed** during the audit (`node_modules` was absent; no packages were installed). Treat behavioral claims about live servers as **NOT VERIFIED** unless marked otherwise.

---

## 1. Current project identity

**VERIFIED FROM CONFIGURATION / CODE**

| Field | Value | Source |
|---|---|---|
| npm name | `mulkallah-jarvis` | `package.json` |
| Version | `1.0.0` | `package.json` |
| License | MIT | `package.json`, `LICENSE` |
| LICENSE copyright | Ruben Mouradian (Reznikov Engineering), 2026 | `LICENSE` |
| Document title | Mulkallah Jarvis | `README.md` |
| HTML title | Mulkallah Jarvis — Holographic AI Assistant | `app/layout.tsx` → `metadata` |
| On-screen badge | Mulkallah Jarvis | `app/page.tsx` |
| html lang | `ar` | `app/layout.tsx` |
| GitHub remote | `mulkallah7703/mulkallah_Jarvis` | `.git/config` |

**What the README says the product is** (`README.md`):

- Holographic AI assistant UI built on open **APEX-UI** (MIT)
- Custom Three.js particle humanoid (blue body + orange core)
- Chat HUD: Gemini primary, OpenAI fallback
- Voice: Web Speech API STT + `speechSynthesis` TTS
- Core states: listening → thinking → speaking → standby

**Assistant identity sent to the model**

```
FILE: lib/chat-server.ts
→ JARVIS_SYSTEM
→ Server-only system prompt: “You are Jarvis, a holographic AI assistant for Mulkallah.”
  Concise, lightly witty; reply in Arabic when the user writes Arabic; otherwise English.
  Short answers; no markdown tables; no secret leakage.
```

Label: **VERIFIED FROM CODE**

This repository is **not** named `jarvise`. There is no `jarvise` remote in `.git/config`.

---

## 2. Current repository structure

**VERIFIED FROM CODE / GIT** (`git ls-tree -r HEAD`)

There is no `public/`, `tests/`, `src/`, `middleware.ts`, `vercel.json`, `.github/`, `eslint.config.*`, favicon, or agent-runtime package.

```
.
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
│       ├── chat/route.ts
│       └── weather/route.ts
├── components/
│   ├── ApexWorld.tsx              ← live experience orchestrator
│   ├── ApexOverviewPanel.tsx      ← live top-left HUD
│   ├── ChatHud.tsx                ← live chat + mic rail
│   ├── HolographicHumanoid.tsx    ← live hologram
│   ├── ShaderBackground.jsx       ← live WebGL backdrop
│   ├── ReasoningWeb.jsx           ← live SVG agent graph
│   ├── OrbStatusBar.jsx           ← live bottom status
│   ├── useSpeechInput.ts          ← live STT/TTS
│   ├── useMicEnergy.ts            ← live mic RMS
│   ├── ApexHeroOrb.tsx            ← not mounted (type export only)
│   ├── ApexOrb.jsx                ← not mounted
│   ├── ApexCore3D.jsx             ← not mounted
│   └── apex-orb.css               ← imported only by unmounted ApexHeroOrb
├── lib/
│   └── chat-server.ts             ← server LLM
├── next.config.mjs
├── tsconfig.json
├── package.json
├── package-lock.json
├── README.md
├── CREDITS.md
├── LICENSE
├── .env.example
└── .gitignore
```

**Deleted from tree, still in git history (not current):**

```
FILE (historical): components/JarvisHologram.tsx
FILE (historical): public/jarvis-hologram.png
→ Removed in commit ab30788 (PR #4)
→ Label: VERIFIED FROM GIT — not part of current state
```

---

## 3. Current architecture

**VERIFIED FROM CODE** (import graph + API calls)

```
Browser
  → Next.js App Router
      app/layout.tsx
      app/page.tsx
        ├── ApexOverviewPanel  → GET /api/weather → Open-Meteo
        └── ApexWorld
              ├── ShaderBackground
              ├── ReasoningWeb
              ├── HolographicHumanoid
              ├── tap disc (boost)
              ├── ChatHud  → POST /api/chat → lib/chat-server.ts
              │                 → Gemini REST or OpenAI REST
              ├── OrbStatusBar
              └── AgentOverview (static dialog)
```

There is **no** eve runtime, **no** AI SDK, **no** AI Gateway, **no** streaming transport, **no** durable session store, **no** tool/function-calling layer.

```
FILE: package.json
→ dependencies
→ next 15.3.8, react ^19, three ^0.184, lucide-react, @react-three/fiber, @react-three/postprocessing
→ No eve, no @ai-sdk, no speech polyfill, no auth SDK
```

Label: **VERIFIED FROM CONFIGURATION**

Lockfile resolved versions (not necessarily what a fresh install would pick for caret ranges, but what this lock records):

| Package | Lock version |
|---|---|
| next | 15.3.8 |
| react | 19.2.8 |
| three | 0.184.0 |
| @react-three/fiber | 9.7.0 |
| @react-three/postprocessing | 3.0.5 |
| lucide-react | 0.511.0 |

Label: **VERIFIED FROM CONFIGURATION** (`package-lock.json`)

---

## 4. Current frontend architecture

**VERIFIED FROM CODE**

| Concern | Implementation | File |
|---|---|---|
| Router | App Router, single page `/` | `app/page.tsx` |
| Layout | One root layout | `app/layout.tsx` |
| Server Components | `layout.tsx`, `page.tsx` | `app/` |
| Client Components | All `components/*` (`"use client"`) | `components/` |
| Styling | `app/globals.css` + inline styles | no Tailwind |
| Icons | lucide-react | `ChatHud.tsx`, `ApexOverviewPanel.tsx` |
| App state library | none (React `useState` / `useRef`) | — |
| URL state | none | — |
| localStorage / sessionStorage | none | — |

```
FILE: app/page.tsx
→ Home
→ Renders ApexOverviewPanel + a 100vh section containing ApexWorld + corner badge “Mulkallah Jarvis”
```

```
FILE: app/layout.tsx
→ RootLayout
→ Sets metadata, imports globals.css, wraps children in <html lang="ar"><body>
```

```
FILE: components/ApexWorld.tsx
→ ApexWorld
→ Client orchestrator for layers, orb visual state, mic flag, agent dialog, ChatHud
```

Startup sequence **INFERRED FROM CODE** (not observed in a browser):

1. Server renders `Home` (dark `main#main`).
2. Client hydrates `ApexOverviewPanel` and `ApexWorld`.
3. `HolographicHumanoid` loads via `next/dynamic` `{ ssr: false }`.
4. Shader, SVG web, tap disc, chat rail, status bar mount. Chat dock starts closed. Mic starts off.

---

## 5. Current hologram implementation

**The live hologram is a procedural Three.js particle bust, not a portrait image.**

```
FILE: components/ApexWorld.tsx
→ ApexWorld (render)
→ dynamic(() => import("./HolographicHumanoid"), { ssr: false })
→ Passes mode derived from orbState / micOn
→ Passes energy = max(mic RMS, speaking 0.55, thinking 0.3)
```

```
FILE: components/HolographicHumanoid.tsx
→ HolographicHumanoid
→ Creates THREE.WebGLRenderer (antialias, alpha), PerspectiveCamera(35) at (0, 0.15, 4.2)
→ DPR capped at min(devicePixelRatio, 2)
→ No custom GLSL; uses PointsMaterial
→ No image / texture / portrait sampling
→ aria-hidden empty mount div; no WebGL failure UI
```

Modes (`HumanoidMode`): `"idle" | "listening" | "thinking" | "speaking"`.

**Portrait pipeline:** not in current tree. Historical `JarvisHologram.tsx` rendered `<img src="/jarvis-hologram.png">`. **VERIFIED FROM GIT**, not current.

**Scatter / reassembly / seed-formation ritual:** not implemented in current hologram.

---

## 6. Current particle system

```
FILE: components/HolographicHumanoid.tsx
→ sampleBust(count, rng)
→ Fills Float32Array of 3D positions: head ellipsoid (~42%), neck, shoulders/torso, chest cloud
→ Silhouette trim; not sampled from a bitmap
```

```
FILE: components/HolographicHumanoid.tsx
→ sampleCore(count, rng)
→ Smaller sphere of points around y ≈ 0.58 (orange “energy core”)
```

```
FILE: components/HolographicHumanoid.tsx
→ useEffect (seed 7703)
→ bodyCount = 14000, coreCount = 2200
→ LCG RNG seeded with 7703 (deterministic cloud)
→ Every animation frame: CPU loop updates all body and core positions, opacity, color, ring opacity; then renderer.render
```

Audio coupling:

```
FILE: components/HolographicHumanoid.tsx
→ tick()
→ energyRef displaces body points, pulses core radius, changes material size/opacity
→ thinking: body color #5ad0ff; speaking: #2cf0ff; else #1ec8ff
```

**Second particle system (not mounted on the live page):**

```
FILE: components/ApexCore3D.jsx
→ Core / ApexCore3D
→ @react-three/fiber Canvas, 1200 points, Bloom, variants geodesic/meridian/gyro/particles
→ Only imported by ApexHeroOrb, which is not rendered
```

Label: **VERIFIED FROM CODE** (present but unused in the live render tree)

**SVG motes (live, decorative):**

```
FILE: components/ReasoningWeb.jsx
→ spawn() + rAF loop
→ Cyan dots travel along spoke paths; density rises when state !== 'standby'
```

---

## 7. Current voice / STT / TTS system

There is no native audio pipeline, no cloud STT/TTS, no eve voice node.

### STT

```
FILE: components/useSpeechInput.ts
→ getCtor()
→ window.SpeechRecognition || window.webkitSpeechRecognition
```

```
FILE: components/useSpeechInput.ts
→ speechSupported()
→ Boolean(getCtor())
```

```
FILE: components/useSpeechInput.ts
→ useSpeechInput(enabled, paused, lang, onFinal)
→ continuous = true, interimResults = true
→ rec.lang = lang
→ Final transcripts call onFinal(trimmed)
→ Interim stored in React state
→ onend restarts rec.start() if still wanted
→ onerror: "not-allowed" → "mic permission denied"; "no-speech" and "aborted" ignored
```

```
FILE: components/ChatHud.tsx
→ ChatHud
→ Pauses STT while pending || muteMic || !srOk so TTS is not captured
→ onFinal → sendRef.current(text)  (every final utterance is a chat turn)
```

### TTS

```
FILE: components/useSpeechInput.ts
→ speakText(text, lang, onStart, onEnd)
→ speechSynthesis.cancel() then SpeechSynthesisUtterance
→ Arabic if /[\u0600-\u06FF]/ test on text OR lang.startsWith("ar"); then u.lang = "ar-SA"
→ rate = 1.02; pitch/volume not set
→ Voice pick: matching lang prefix, prefer default
→ If no speechSynthesis: timeout fallback still calls onStart/onEnd
→ Invokes onStart immediately as well as u.onstart
```

### Mic energy (separate from STT)

```
FILE: components/useMicEnergy.ts
→ useMicEnergy(enabled)
→ getUserMedia({ audio: true }) + AudioContext AnalyserNode fftSize 512
→ RMS from time-domain data, smoothed 0..1
```

When mic is on, **two** browser audio captures can run (SpeechRecognition + getUserMedia). Label: **VERIFIED FROM CODE**

Language toggle (STT + TTS hint):

```
FILE: components/ChatHud.tsx
→ setLang toggles en-US / ar-SA
→ Buttons labeled “EN mic” / “AR mic”
```

Voice-out toggle:

```
FILE: components/ChatHud.tsx
→ voiceOut state (default true)
→ If false: still sets speaking visually with a timeout based on reply length
```

Browser support on specific devices: **NOT VERIFIED**. README claims Chrome / Edge / Safari.

---

## 8. Current Gemini / OpenAI architecture

**Not** Vercel AI SDK. **Not** Google AI SDK package. Direct `fetch`.

```
FILE: lib/chat-server.ts
→ geminiKey()
→ process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
```

```
FILE: lib/chat-server.ts
→ openaiKey()
→ process.env.OPENAI_API_KEY
```

```
FILE: lib/chat-server.ts
→ hasAnyKey()
→ Boolean(geminiKey() || openaiKey())
```

```
FILE: lib/chat-server.ts
→ callGemini(model, key, turns, signal)
→ POST https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent
→ Header x-goog-api-key
→ systemInstruction = JARVIS_SYSTEM
→ contents map user→user, assistant→model
→ generationConfig temperature 0.7, maxOutputTokens 1024
```

```
FILE: lib/chat-server.ts
→ callOpenAI(model, key, turns, signal)
→ POST https://api.openai.com/v1/chat/completions
→ Bearer OPENAI_API_KEY
→ messages = [{ role: "system", content: JARVIS_SYSTEM }, ...turns]
```

```
FILE: lib/chat-server.ts
→ completeChat(turns)
→ AbortSignal.timeout(22_000) shared across ALL model attempts
→ Try GEMINI_MODELS in order, then OPENAI_MODELS
→ Return { text, provider: "gemini" | "openai" }
→ If no keys: Error status 503
→ If all fail: Error status 502
```

Gemini model list (in order):

1. `gemini-2.5-flash`
2. `gemini-2.0-flash`
3. `gemini-flash-latest`
4. `gemini-2.0-flash-lite`

OpenAI model list:

1. `gpt-4o-mini`
2. `gpt-4.1-mini`

```
FILE: components/ChatHud.tsx
→ send()
→ Parses JSON as { text?, error? } — does not use provider
```

Streaming: **MISSING** (full JSON response).  
Retries: next model name only; per-model errors swallowed.  
Live success against Google/OpenAI: **NOT VERIFIED**.

Strings **not present** in current source: `JARVIS_MODEL`, `JARVIS_USE_GATEWAY`, `AI_GATEWAY_API_KEY`, `@ai-sdk`. Label: **VERIFIED FROM CODE** (negative search during audit).

---

## 9. Current API routes

Only App Router handlers. No middleware. No eve-mounted routes.

### `GET /api/chat`

```
FILE: app/api/chat/route.ts
→ GET
→ { ok: true, configured: hasAnyKey() }
→ Never returns key material
→ Reveals whether any LLM key is set
```

`export const dynamic = "force-dynamic"`  
`export const maxDuration = 30`

### `POST /api/chat`

```
FILE: app/api/chat/route.ts
→ parseTurns(body)
→ Requires messages array; keeps last 20; role user|assistant; content string trimmed, max 8000 chars
→ Last turn must be user
```

```
FILE: app/api/chat/route.ts
→ POST
→ 400 if JSON invalid or parseTurns null
→ 200 { text, provider } on success
→ catch: status from err.status or 502; body { error: message }
→ No authentication, no rate limit, no CORS config in repo
```

### `GET /api/weather`

```
FILE: app/api/weather/route.ts
→ GET
→ Reads x-vercel-ip-latitude / longitude / city
→ If no lat/lon: { current: null, city: "your town" }
→ Else Open-Meteo forecast current temperature_2m, weather_code; fetch next.revalidate 600
→ On fetch failure: { current: null, city }
```

```
FILE: components/ApexOverviewPanel.tsx
→ Clock
→ fetch("/api/weather") on mount and every 1_200_000 ms
```

**Routes that do not exist:** `/chat`, `/s`, `/s/[id]`, any other `app/**/page.tsx`. Label: **VERIFIED FROM CODE**

---

## 10. Current state management

All conversation and orb state is **in-memory React state**. No global store.

```
FILE: components/ApexWorld.tsx
→ ApexWorld state
→ selected: NodeSel | null     (agent dialog)
→ reduced: boolean             (prefers-reduced-motion)
→ micOn: boolean
→ showState: OrbState          idle | thinking | speaking | listening
→ chatBusy: ref boolean        blocks boost() during chat
→ energy from useMicEnergy(micOn)
→ orbState = listening if idle && micOn, else showState
```

```
FILE: components/ApexWorld.tsx
→ boost()
→ Cycles idle/listening → thinking → speaking → idle; 8s timeout back to idle
→ No-op if chatBusy.current
```

```
FILE: components/ApexWorld.tsx
→ setChatOrb(s)
→ ChatHud-driven override of showState; clears boost timer
```

```
FILE: components/ChatHud.tsx
→ ChatHud state
→ open, turns, draft, pending, voiceOut, lang, hint, srOk, muteMic
→ turns: { id, role, content }[]  — client history, slice(-16) when sending
```

```
FILE: components/ApexHeroOrb.tsx
→ export type OrbState = "idle" | "thinking" | "speaking" | "listening"
→ Type is used by ApexWorld and ChatHud; default component is not rendered
```

`OrbState` mapping to other visuals:

| OrbState | HolographicHumanoid | ReasoningWeb | OrbStatusBar label |
|---|---|---|---|
| idle (mic off) | idle | standby | STANDBY |
| idle + micOn / listening | listening | standby* | LISTENING |
| thinking | thinking | processing | PROCESSING |
| speaking | speaking | speaking | SPEAKING |

\* `webState` in ApexWorld: thinking → processing, speaking → speaking, **else standby**. Listening therefore keeps the web in `standby` while the humanoid/status show listening.

Label: **VERIFIED FROM CODE**

```
FILE: components/ApexWorld.tsx
→ webState
→ orbState === "thinking" ? "processing" : orbState === "speaking" ? "speaking" : "standby"
```

---

## 11. Current session behavior

**There are no server sessions.**

| Question | Current behavior | Evidence |
|---|---|---|
| Session ID | None | No session code |
| Create | Each page load starts empty `turns: []` | `ChatHud.tsx` |
| Resume | None | no URL / storage |
| Persistence | Lost on refresh | React state only |
| Multi-tab | Independent memories | INFERRED |
| Multi-user | Shared unauthenticated `/api/chat` uses server keys | `route.ts` |
| Ownership | None | — |
| Deletion | Dropping the tab | — |

Turn IDs (`u-${Date.now()}` etc.) are React keys, not session IDs.

```
FILE: components/ChatHud.tsx
→ send()
→ const user = { id: `u-${Date.now()}`, role: "user", content: text }
→ history = [...turns, user].slice(-16)
```

Label: **VERIFIED FROM CODE**

---

## 12. Current personality behavior

**There is no personality engine.**

Single identity: `JARVIS_SYSTEM` in `lib/chat-server.ts` (see §1).

The 18 Apex “agents” are **UI copy**, not model modes:

```
FILE: components/ApexWorld.tsx
→ ROSTER, INFO, AgentOverview
→ Clicking a node opens a static dialog (caps / example requests / fake status)
→ Does not call /api/chat
→ Does not change JARVIS_SYSTEM
```

```
FILE: components/ReasoningWeb.jsx
→ ROSTER (duplicate coordinates/names)
→ onSelect callback only; no LLM
```

Personality does **not** persist, because it does not exist as state. User cannot select a mode. Model cannot switch a stored persona.

Label: **VERIFIED FROM CODE**

---

## 13. Current wake-word behavior

**There is no wake word.**

No matching for “Mulk Allah”, “ملك الله”, or equivalent normalization.

With mic on, **every final STT transcript** is sent to `/api/chat`.

```
FILE: components/ChatHud.tsx
→ useSpeechInput(..., (text) => sendRef.current(text))
```

```
FILE: components/useSpeechInput.ts
→ rec.onresult
→ if trimmed finals: onFinalRef.current(trimmed)
```

Silence (`no-speech`) is ignored; recognition restarts via `onend`. No scatter, no wake-only mode.

Label: **VERIFIED FROM CODE**

---

## 14. Current deployment assumptions

**VERIFIED FROM CONFIGURATION / README / GIT**

```
FILE: README.md
→ Deploy (Vercel)
→ npm run build; vercel --prod; or connect GitHub repo; Framework Next.js; Production auto-deploys after merge to main
```

```
FILE: next.config.mjs
→ empty Next config object
```

```
FILE: package.json
→ scripts: next dev | build | start | lint
→ no engines field
```

No `vercel.json`. No CI workflow in this tree. Node version not pinned.

**INFERRED:** `/api/chat` and `/api/weather` deploy as Next.js Route Handlers (`force-dynamic`). `maxDuration = 30` on chat. No filesystem persistence.

**NOT VERIFIED:** actual Vercel project name, production hostname, whether keys are set, whether the app builds on Vercel.

Git remote is `mulkallah_Jarvis`, not `jarvise`.

---

## 15. Current environment variables

```
FILE: .env.example
→ Documents GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, OPENAI_API_KEY
→ States keys are server-side only; never NEXT_PUBLIC_*
```

```
FILE: .gitignore
→ .env*.local
```

| Name | Required? | Server only? | Default | Used by |
|---|---|---|---|---|
| `GEMINI_API_KEY` | One Gemini or OpenAI key required for chat | yes | unset | `geminiKey()` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Alias if GEMINI unset | yes | unset | `geminiKey()` |
| `OPENAI_API_KEY` | Fallback / sole key | yes | unset | `openaiKey()` |

No other `process.env` reads in application source.

**Do not put secrets in this document.** None were in the repository tree.

Weather uses Vercel request headers, not env vars.

---

## 16. Current security risks

Label: **VERIFIED FROM CODE** unless noted. Not exploited. Production not tested (**NOT VERIFIED FROM PRODUCTION**).

| Severity | Risk | Location | What it does |
|---|---|---|---|
| CRITICAL | Unauthenticated LLM proxy | `app/api/chat/route.ts` → `POST` | Any caller can consume Gemini/OpenAI quota bound to server keys |
| HIGH | Key-presence oracle | `app/api/chat/route.ts` → `GET` → `configured` | Tells clients whether keys exist |
| HIGH | Unconstrained user text to model | `lib/chat-server.ts` → `callGemini` / `callOpenAI` | Turns forwarded as content; only a short system prompt |
| MEDIUM | Error message echo | `route.ts` POST catch | `{ error: err.message }` |
| MEDIUM | No rate limit / no body-size cap beyond 20×8000 | `parseTurns` | Abuse / function cost |
| MEDIUM | Visitor city shown in HUD | `weather/route.ts` + `ApexOverviewPanel` Clock | IP-geo city string in UI when on Vercel |
| LOW | Leftover third-party social destinations | `ApexOverviewPanel.tsx` → `TILES` | Instagram/Facebook/LinkedIn of Reznikov Engineering / Ruben Mouradian |
| INFO | Prompt is public in git | `JARVIS_SYSTEM` | Anyone can read identity instructions |
| INFO | Chat text is React text nodes | `ChatHud.tsx` turn bubbles | Not `dangerouslySetInnerHTML` |

Keys are not prefixed `NEXT_PUBLIC_` and live in a server module. Label: **VERIFIED FROM CODE**

```
FILE: lib/chat-server.ts
→ module comment + geminiKey/openaiKey
→ “Keys never leave this module.”
```

---

## 17. Current performance risks

| Risk | Where | Why |
|---|---|---|
| CPU particle update | `HolographicHumanoid.tsx` → `tick()` | 16,200 `setXYZ` per frame |
| Extra WebGL context | `ShaderBackground.jsx` → `render()` | Fullscreen fragment shader every frame |
| SVG rAF | `ReasoningWeb.jsx` → `loop` | Per-frame DOM attribute writes + motes |
| Dual mic | `useSpeechInput` + `useMicEnergy` | Two audio pipelines when mic on |
| Unused but shipped deps | `package.json` fiber + postprocessing | Installed for unmounted `ApexCore3D` |
| Shared 22s abort | `completeChat` | One timeout for the entire fallback chain |
| Reduced motion incomplete | `ApexWorld.tsx` | Shader skipped; humanoid and web still animate |

```
FILE: components/HolographicHumanoid.tsx
→ tick()
→ for (let i = 0; i < bodyCount; i++) bp.setXYZ(...)
→ for (let i = 0; i < coreCount; i++) cp.setXYZ(...)
```

Device cost on phones: **INFERRED**, not measured.

`ApexCore3D` Bloom path is **not** on the live page unless `ApexHeroOrb` is mounted.

---

## 18. Current mobile limitations

**VERIFIED FROM CODE** (layout/API). Device behavior **NOT VERIFIED**.

```
FILE: app/page.tsx
→ Home section style height: "100vh", minHeight: 620
→ Not 100dvh; no safe-area insets anywhere in CSS/TS
```

```
FILE: app/globals.css
→ @media (max-width: 1000px) .apex-overview position absolute (not fixed)
→ @media (max-width: 700px) hide .sb-hint; tighten rail/dock
```

```
FILE: components/ChatHud.tsx
→ speechSupported() hint: Chrome / Edge / Safari
```

Implications **INFERRED**: iOS 100vh vs browser chrome; Web Speech gaps on some mobile browsers; same 14k particle budget as desktop.

---

## 19. Current accessibility limitations

**Present (VERIFIED FROM CODE):**

- `main#main`
- `.visually-hidden` agent button list in `ApexWorld.tsx`
- Chat `role="dialog"`, Escape to close, `aria-live="polite"` on log
- `AgentOverview` dialog, focus to close button, restore focus, Escape
- Rail `role="toolbar"`, `aria-pressed` / `aria-expanded`
- `dir="auto"` on messages and input
- `prefers-reduced-motion`: dock animation off; shader unmounted
- `.jarvis-rail-btn:focus-visible` outline

**Limitations (VERIFIED FROM CODE):**

- ReasoningWeb wrapped `aria-hidden="true"` while node hits still set `pointer-events: all`
- Humanoid `aria-hidden` with no spoken-state live region (status bar is SVG text, not ARIA live)
- Tap disc `onMouseDown preventDefault`
- `html lang="ar"` while chrome is English
- Fonts `'Share Tech Mono'` / `'Inter'` referenced in SVG, never loaded
- Humanoid and ReasoningWeb ignore reduced motion
- Overview social labels English-only

---

## 20. Current legacy code

Code copied from APEX-UI / Apex app that still ships and still **renders**, but describes another product:

| File | Legacy character |
|---|---|
| `components/ReasoningWeb.jsx` | Apex “reasoning web”, comments mention missing `APEX_ARCHITECTURE.md` and backend `trace` WS |
| `components/ApexOverviewPanel.tsx` | Comments: Tel-Aviv weather, “What is Apex” tiles — code is visitor weather + Reznikov socials |
| `components/OrbStatusBar.jsx` | Apex standby cluster; hint “CLICK AN AGENT” |
| `components/ShaderBackground.jsx` | 21st.dev plasma waves (`CREDITS.md`); `isRenderCalm` leftover always false |
| `LICENSE` | APEX/Reznikov copyright |
| `components/ApexWorld.tsx` `INFO` / `ROSTER` | Fake “online / integration” specialists |

Historical hologram PNG path: **VERIFIED FROM GIT**, not in tree (see §2).

---

## 21. Current dead code

Present on disk, **not in the live render tree**:

| File | Why unused |
|---|---|
| `components/ApexHeroOrb.tsx` | Live pages import **type** `OrbState` only (`import type` / `import { type OrbState }`) |
| `components/ApexOrb.jsx` | Only imported by `ApexHeroOrb` |
| `components/ApexCore3D.jsx` | Only imported by `ApexHeroOrb` (dynamic) |
| `components/apex-orb.css` | Imported only by `ApexHeroOrb`; therefore **not loaded** on `/` |

```
FILE: components/ApexWorld.tsx
→ import { type OrbState } from "./ApexHeroOrb"
→ Type-only; does not execute ApexHeroOrb or load apex-orb.css
```

```
FILE: components/ChatHud.tsx
→ import type { OrbState } from "./ApexHeroOrb"
```

**Dead API inside live files:**

```
FILE: components/ReasoningWeb.jsx
→ fire(ids) / trace effect
→ ApexWorld never passes trace; mode is always "full"; mini bloom path unused
```

```
FILE: components/ShaderBackground.jsx
→ isRenderCalm = () => false
```

```
FILE: components/ApexCore3D.jsx
→ isRenderCalm = () => false; geodesic/meridian/gyro variants unused while unmounted
```

```
FILE: components/ApexOrb.jsx
→ OrbitDot defined, not used in JSX
```

```
FILE: package.json
→ @react-three/fiber, @react-three/postprocessing
→ Only referenced by unmounted ApexCore3D
```

`OrbStatusBar` uses classes `orb-center-ring`, `orb-center`, `orb-dot-blink` defined in unused `apex-orb.css`. Inline `@keyframes sbBar` still applies. Label: **VERIFIED FROM CODE** / CSS load **INFERRED** (type-only import erases the CSS side-effect).

---

## 22. Current Git architecture / history

**VERIFIED FROM GIT**

| Item | Value |
|---|---|
| Branch | `main` tracking `origin/main` |
| HEAD | `a9f2f6a` Merge pull request #4 |
| Remote | `https://github.com/mulkallah7703/mulkallah_Jarvis.git` |
| Tags | none |

Chronology (short):

| Commit / PR | What landed |
|---|---|
| `d38c4e2` | README title |
| `594f516` | Initial APEX UI + `HolographicHumanoid` |
| PR #1 `522f720` | Chat HUD, Gemini/OpenAI, voice |
| PR #2 `a046327` | Chat behind right toggle; mic independent |
| PR #3 | Replace bust with `JarvisHologram` + `public/jarvis-hologram.png` (crop iterations) |
| PR #4 `ab30788` | Restore particle bust; delete PNG + `JarvisHologram.tsx` |

Primary implementation author in history: Cursor Agent; PRs merged by repository owner.

---

## 23. Current known limitations

1. Conversation is not durable.  
2. No authentication.  
3. No streaming.  
4. No wake word; mic-on = every phrase is a command.  
5. No personality modes.  
6. Agent graph does not invoke the model.  
7. Hologram is not a likeness / not a portrait particle field.  
8. No scatter/reassembly.  
9. No tests.  
10. No `public/` assets (no favicon).  
11. `100vh` layout.  
12. Shared 22s abort across LLM fallbacks.  
13. Dual mic capture.  
14. Reduced motion does not stop the particle bust.  
15. Overview still points at Reznikov social profiles.  
16. `html lang="ar"` vs English chrome.  
17. LLM route is a public cost center if deployed with keys.  
18. Runtime and production host **NOT VERIFIED**.

---

## 24. Current missing product features

Missing **from this repository** (not “broken”; not implemented):

- eve / durable agent runtime  
- Vercel AI SDK / AI Gateway  
- Personality engine and HUD selector  
- Wake word (“Mulk Allah” / “ملك الله”)  
- Session IDs, resume, `/s/[id]`, `/chat` page  
- Streaming tokens  
- Tools / skills / n8n  
- Auth, multi-user, billing  
- Persistent memory  
- Portrait-to-particle sampling, WebGL2 face shader, NDC portrait mapping  
- Activation ritual, silence scatter, wake reassembly  
- Tests, CI, `vercel.json`, pinned Node  
- Product-owned social links, favicon, Mulkallah LICENSE identity  

---

## 25. Exact file / function ownership map

| Subsystem | File | Symbol | What it does |
|---|---|---|---|
| Document shell | `app/layout.tsx` | `RootLayout` | html/body, metadata, CSS |
| Page composition | `app/page.tsx` | `Home` | Overview + world + title badge |
| Global CSS | `app/globals.css` | — | HUD, rail, dock, overview, reduced-motion dock |
| Experience orchestrator | `components/ApexWorld.tsx` | `ApexWorld` | Layers, orb state, mic, agent dialog |
| Agent marketing dialog | `components/ApexWorld.tsx` | `AgentOverview` | Draggable static panel |
| Agent copy | `components/ApexWorld.tsx` | `ROSTER`, `INFO` | Names/roles for dialog + a11y list |
| Chat / comms UI | `components/ChatHud.tsx` | `ChatHud` | Dock, rail, send, mic, TTS flags |
| Chat send | `components/ChatHud.tsx` | `send` | POST `/api/chat`, history, errors, TTS |
| Chat finish | `components/ChatHud.tsx` | `finishSpeak` | idle, unmute mic |
| STT | `components/useSpeechInput.ts` | `useSpeechInput` | Web Speech capture |
| TTS | `components/useSpeechInput.ts` | `speakText` | speechSynthesis |
| STT feature detect | `components/useSpeechInput.ts` | `speechSupported` | ctor check |
| Mic RMS | `components/useMicEnergy.ts` | `useMicEnergy` | Analyser energy |
| Hologram | `components/HolographicHumanoid.tsx` | `HolographicHumanoid` | Three.js bust |
| Particle positions | `components/HolographicHumanoid.tsx` | `sampleBust`, `sampleCore` | Geometry |
| Backdrop | `components/ShaderBackground.jsx` | `ShaderBackground` | WebGL1 plasma |
| Agent graph | `components/ReasoningWeb.jsx` | default export | Imperative SVG + rAF |
| Status HUD | `components/OrbStatusBar.jsx` | `OrbStatusBar` | Equalizer + label |
| Overview lamp | `components/ApexOverviewPanel.tsx` | `ApexOverviewPanel`, `Clock` | Time, weather, socials |
| LLM HTTP | `app/api/chat/route.ts` | `GET`, `POST`, `parseTurns` | Health + completion |
| LLM providers | `lib/chat-server.ts` | `completeChat`, `callGemini`, `callOpenAI` | Upstream calls |
| System prompt | `lib/chat-server.ts` | `JARVIS_SYSTEM` | Identity |
| Keys | `lib/chat-server.ts` | `geminiKey`, `openaiKey`, `hasAnyKey` | Env |
| Weather HTTP | `app/api/weather/route.ts` | `GET` | Geo + Open-Meteo |
| OrbState type | `components/ApexHeroOrb.tsx` | `export type OrbState` | Shared union (file otherwise unused) |
| Unmounted orb UI | `components/ApexHeroOrb.tsx` | `ApexHeroOrb` | Would mount ring + Core3D |
| Unmounted ring SVG | `components/ApexOrb.jsx` | `ApexOrb` | Gold frame |
| Unmounted R3F core | `components/ApexCore3D.jsx` | `ApexCore3D`, `Core`, `OrbBoundary` | Particle orb + bloom |

---

## 26. Complete data-flow diagrams

### A. Page load

```
User opens /
  → app/layout.tsx RootLayout
  → app/page.tsx Home
  → ApexOverviewPanel Clock → GET /api/weather
  → ApexWorld
       ShaderBackground (unless prefers-reduced-motion)
       ReasoningWeb mode="full" coreless
       HolographicHumanoid mode=idle energy=0
       ChatHud open=false micOn=false
       OrbStatusBar STANDBY
```

### B. Microphone on (not “activation ritual”)

```
User clicks mic rail
  → ChatHud onMicChange(true)
  → ApexWorld setMicOn(true)
  → orbState listening (if showState idle)
  → useSpeechInput enabled
  → useMicEnergy enabled
  → HolographicHumanoid mode=listening
  → OrbStatusBar LISTENING
```

### C. Voice command (no wake word)

```
SpeechRecognition final transcript
  → useSpeechInput onFinal
  → ChatHud send(text)
       muteMic, pending, onBusy(true), onOrbState("thinking")
  → POST /api/chat { messages: last 16 turns }
  → parseTurns → completeChat
  → Gemini models then OpenAI
  → { text, provider }
  → append assistant turn
  → speakText OR visual timeout
  → onOrbState("speaking")
  → ShaderBackground voiceActive
  → ReasoningWeb state speaking
  → finishSpeak → idle, unmute mic after 450ms
```

### D. Text command

```
Chat form submit
  → send(draft || interim)
  → same POST /api/chat path as C
```

### E. Core tap (demo, not listen)

```
Tap disc click/Enter/Space
  → ApexWorld boost()
  → if !chatBusy: cycle thinking/speaking/idle, 8s timer
  → visual only; does not start STT
```

### F. Agent click (not AI)

```
ReasoningWeb hit OR hidden nav button
  → openAgent(NodeSel)
  → AgentOverview
  → static INFO; no LLM
```

### G. Personality / session / scatter / wake

**No data flow.** Those subsystems are absent.

---

## 27. “DO NOT BREAK” components and dependencies

Changing these without a migration plan will break the current product:

| Do not break casually | Depends on | Breakage |
|---|---|---|
| `lib/chat-server.ts` `completeChat` / keys / `JARVIS_SYSTEM` | `app/api/chat/route.ts`, ChatHud | No replies, leaked keys, identity change |
| `app/api/chat/route.ts` `parseTurns` contract | ChatHud `messages` payload | 400s / silent send failures |
| `components/ChatHud.tsx` `send` / `muteMic` / STT pause | `useSpeechInput` | Echo loop (Jarvis hears itself) or dropped turns |
| `components/useSpeechInput.ts` | ChatHud | Voice dead |
| `components/HolographicHumanoid.tsx` particle counts / dispose | ApexWorld dynamic import | Blank center, GPU leak, tab freeze |
| `components/ApexWorld.tsx` orbState mapping | Humanoid, web, shader, status, ChatHud | Desynced HUD |
| `components/ApexHeroOrb.tsx` `OrbState` type export | ApexWorld, ChatHud | Type errors even though default export is unused |
| Server-only env names | `geminiKey` / `openaiKey` | Chat 503 if renamed without Vercel update |
| Not prefixing keys `NEXT_PUBLIC_` | Next bundling | Keys in the browser |
| MIT / CREDITS for remaining APEX/21st.dev files | LICENSE, CREDITS.md, ShaderBackground | Attribution/legal |

**Safe-looking but coupled:** `ROSTER` exists twice (`ApexWorld.tsx` and `ReasoningWeb.jsx`). Editing one desyncs a11y list vs SVG.

**Dangerous to “re-enable” without review:** mounting `ApexHeroOrb` / `ApexCore3D` adds a second WebGL+Bloom stack on top of the humanoid and shader.

---

## A. What the project IS today

A Next.js 15 **single-page holographic UI** named Mulkallah Jarvis, built on an **APEX-UI** command-center shell, with:

- a **procedural Three.js particle bust**
- a **right-rail chat + mic HUD**
- a **server Route Handler** that calls **Gemini REST**, then **OpenAI REST**
- **browser Web Speech** STT/TTS
- a **decorative Apex agent constellation** and overview lamp

Label: **VERIFIED FROM CODE**

---

## B. What the project is NOT today

It is **not**:

- an eve durable agent
- a personality-mode platform
- a wake-word appliance
- a sessioned multi-route app (`/chat`, `/s/[id]`)
- a portrait-sampled particle face
- a streaming Gemini Gateway app
- an authenticated multi-user product
- a tested, production-hardened API

---

## C. What is production-ready

**NOT VERIFIED at runtime.** From code structure only:

| Piece | Readiness (code-level) |
|---|---|
| Next App Router page composition | Prototype-to-demo quality; single route |
| Server key isolation (no NEXT_PUBLIC) | Sound pattern **if** env is set correctly |
| Chat request validation (shape, 8k, last user turn) | Basic, not abuse-proof |
| LLM model fallback list | Implemented; success **NOT VERIFIED** |
| Weather no-geo fallback | Implemented |

**Not production-ready as a public AI service:** unauthenticated `/api/chat`.

---

## D. What is prototype-only

- Entire voice loop (Web Speech, no tests, browser-dependent)  
- Particle bust (fixed 16k budget, no fallback, no reduced-motion stop)  
- Apex HUD as “operating system” (agents do not work)  
- In-memory chat  
- Health `configured` flag  
- Overview social/marketing lamp  

---

## E. What is legacy

- APEX ReasoningWeb / INFO roster / status copy  
- Reznikov social TILES and LICENSE copyright  
- Unmounted `ApexHeroOrb` + `ApexOrb` + `ApexCore3D` + `apex-orb.css`  
- Comments referring to Apex app, Tel Aviv, `APEX_ARCHITECTURE.md`, WS `trace`  
- Git-only PNG hologram experiment (PR #3, reverted PR #4)  

---

## F. What is missing

Wake word, personality engine, eve, sessions, streaming, auth, memory, tools, tests, public assets, portrait particle engine, activation/scatter loop, product-owned branding on leftover APEX chrome, pinned deploy config. See §24.

---

## G. Which files control each major subsystem

| Subsystem | Controlling files |
|---|---|
| Page / routing | `app/layout.tsx`, `app/page.tsx` |
| Visual world | `components/ApexWorld.tsx` |
| Hologram / particles | `components/HolographicHumanoid.tsx` |
| Backdrop | `components/ShaderBackground.jsx` |
| Agent graph | `components/ReasoningWeb.jsx` |
| Chat + mic UX | `components/ChatHud.tsx` |
| STT/TTS | `components/useSpeechInput.ts` |
| Mic energy | `components/useMicEnergy.ts` |
| LLM | `lib/chat-server.ts`, `app/api/chat/route.ts` |
| Weather | `app/api/weather/route.ts`, `components/ApexOverviewPanel.tsx` |
| Status bar | `components/OrbStatusBar.jsx` |
| Shared orb type | `components/ApexHeroOrb.tsx` (`OrbState` only) |

---

## H. Which files are dangerous to modify

1. `lib/chat-server.ts` — keys, cost, identity, fallbacks  
2. `app/api/chat/route.ts` — public attack surface  
3. `components/ChatHud.tsx` — voice/chat coupling, echo guard  
4. `components/useSpeechInput.ts` — all voice I/O  
5. `components/HolographicHumanoid.tsx` — GPU/CPU; dispose/rAF  
6. `components/ApexWorld.tsx` — every visual system’s state bus  
7. `components/ReasoningWeb.jsx` — imperative SVG, easy to leak rAF/DOM  
8. `components/ApexCore3D.jsx` — do not mount casually (WebGL + Bloom)  

---

## I. Architectural decisions required before future development

Decide these **before** writing features. Do not implement in this document’s scope.

1. **Product identity:** Keep APEX command-center chrome, or replace it with a Jarvis-only stage?  
2. **Hologram:** Stay on procedural `HolographicHumanoid`, restore git PNG, or build real portrait particles? Do not oscillate like PR #3/#4 without a choice.  
3. **Voice contract:** Mic-on = always send (current), or introduce a wake word / push-to-talk?  
4. **`/api/chat` threat model:** Public demo with quota risk, or auth + rate limits **before** memory/tools/n8n?  
5. **Agent graph:** Delete, keep as fiction, or connect `ReasoningWeb.fire` to a real planner? It is disconnected today.  
6. **Session model:** Stay ephemeral, or add IDs/URLs/storage? There is no eve to “resume.”  
7. **Dead R3F orb:** Delete/quarantine `ApexHeroOrb` stack, or replace the humanoid with it? Do not run both unplanned.  
8. **LLM stack:** Keep raw REST, or adopt an SDK/Gateway later? Current code has neither.  
9. **Branding/legal:** LICENSE and socials are still Reznikov/APEX.  
10. **Runtime proof:** Install/build/deploy verification was **not** done; production host is **NOT VERIFIED**.

Until those decisions are made, the repository’s source of truth remains:

**a Next.js APEX-shell demo with a custom particle bust and an unauthenticated Gemini/OpenAI proxy.**

---

*End of current-state reference. Application source was not modified except for the addition of this documentation file. No packages installed. No commit created.*
