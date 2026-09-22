# JARVIS — WAKE WORD PLAN

Additive client-side upgrade. Backend / Gemini / `/api/chat` / TTS / ParticleHologram engine stay as they are.

## Existing microphone architecture

- Manual mic: `ChatHud` sets `micOn`; `JarvisStage` also runs `useMicEnergy(micOn)` for hologram RMS.
- Speech: `useSpeechInput` creates **one** `SpeechRecognition` / `webkitSpeechRecognition` instance while `enabled && !paused`.
- `continuous: true`, `interimResults: true`. Final transcripts call `send()` → `POST /api/chat`.
- Paused during chat pending, TTS playback, and `muteMic`.
- Browser TTS (`speakText`) remains unused for replies; ElevenLabs is used.
- No wake word today. Mic must be clicked. No audio is sent to Gemini until a final transcript exists.

## Existing speech recognition architecture

Chrome/Edge: Web Speech API (local decode, Google endpoint inside the browser for some engines — **not** our `/api/chat`). Safari: often `webkitSpeechRecognition`. Firefox: typically unsupported → manual/type fallback.

Limitations: needs mic permission; often a user gesture before first `start()`; `onend` fires often; one recognizer per page is safest; language is a single `lang` per session.

## Proposed wake-word architecture

**No new npm dependency.** Continuous **local** Web Speech API matching is enough for the English phrase `"Mulk Allah Jarvis"` on Chrome/Edge. A Porcupine-style WASM engine would add size, a wake-word model, and Next.js bundling cost without a proven need.

```
Idle / STANDBY
  → single SpeechRecognition (wake mode, typically en-US)
  → local regex on normalized transcripts only
  → on "mulk allah jarvis": WAKING visual + LISTENING_FOR_COMMAND (no /api/chat)
  → same or quickly retargeted recognizer captures the command
  → strip wake phrase
  → existing ChatHud send() → POST /api/chat → Gemini
  → existing TTS if quota allows
  → back to wake listening
```

Nothing is posted to Gemini until a **command** (non-empty after strip) is final.

Manual mic: same recognizer, command mode, no wake required.

## State machine

| Phase | Hologram (`OrbState`) | Status copy |
|---|---|---|
| LISTENING_FOR_WAKE | `idle` (calm) | STANDBY |
| WAKING | brief `listening` pulse | LISTENING |
| LISTENING_FOR_COMMAND | `listening` | LISTENING |
| THINKING | `thinking` (existing ChatHud) | PROCESSING |
| SPEAKING | `speaking` (existing TTS) | SPEAKING |
| ERROR | `idle` + existing hint | STANDBY / hint |

`ERROR` is permission/unsupported — not a Gemini failure.

## Wake matching

Normalize: lowercase, collapse space, strip punctuation (`.,!?،`). Require `\bmulk\s+allah\s+jarvis\b`. Do **not** wake on `"Mulk Allah"` or `"Jarvis"` alone. Strip that span from the original string before `send()`.

Same-utterance: `"Mulk Allah Jarvis what is the weather"` → send `"what is the weather"` immediately.

Wake-only: enter command listen; next final (or short silence) is the command. `COMMAND_SILENCE_MS` ≈ 450. Listen window ≈ 8s then return to wake.

## Single listener

`useJarvisVoice` owns the only `SpeechRecognition`. ChatHud **stops** creating its own via `useSpeechInput` (file kept for `speechSupported`). `useMicEnergy` stays tied to the **manual** mic button so wake mode does not open a second `getUserMedia` stream.

Restart on `onend` while wake/command still wanted, with abort guards and a short backoff. No overlapping instances.

## Latency

- Wake match on interim **and** final (visual + mode immediately; send only on final command).
- No extra `setTimeout` before `/api/chat`.
- Do not restart recognition when wake and command share `lang`.
- Gemini path unchanged (`gemini-3.6-flash` then fallback).

## Browser limitations

- Chrome/Edge desktop primary.
- Mic permission denied → existing-style hint; wake off; manual/type still work if later granted.
- First `start()` may need chat/mic click; after that, keep wake alive while the tab is open.
- Arabic commands: after wake, command `lang` follows ChatHud EN/AR toggle. Wake spotting uses English-friendly recognition (`en-US`) when in wake mode.
- Firefox: graceful fallback to manual mic.

## Files to create

- `JARVIS_WAKE_WORD_PLAN.md` (this file)
- `lib/wake-phrase.ts` — normalize, match, strip
- `components/useJarvisVoice.ts` — single recognizer + state machine

## Files to modify

- `components/ChatHud.tsx` — wire `useJarvisVoice` instead of `useSpeechInput` (same send/TTS/UI)
- `components/JarvisStage.tsx` — status for wake vs command; optional `?debug=voice`
- `app/globals.css` — tiny status/debug only if needed

## Files not to touch

- `app/api/chat/route.ts`, `lib/chat-server.ts`, `app/api/tts/route.ts`, `components/ParticleHologram.tsx` (engine), `components/useJarvisTts.ts` (logic)
