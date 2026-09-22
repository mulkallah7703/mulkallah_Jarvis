/**
 * Pure wake/session policy. The recognizer hook follows these decisions so a
 * headless check can cover multi-turn listen, mute, and arm-without-click.
 */
import { leadingWake, matchWake, normalizeSpeech } from "./wake-phrase";

export type ListenMode = "wake" | "session";

export type VoiceGates = {
  mode: ListenMode;
  muted: boolean;
  /** Mic permission armed. No further mic click is required to listen. */
  armed: boolean;
  /** Brief post-TTS window: drop short speaker-bleed fragments only. */
  echoGuard: boolean;
  recentSpoken: string[];
};

export type TranscriptDecision =
  | { type: "ignore" }
  | { type: "wake-only"; final: boolean }
  | { type: "command"; text: string; final: boolean };

const FILLER = new Set(["hey", "hi", "hello", "ok", "okay", "please", "ya", "yo", "um", "uh", "there"]);

export function shouldListen(opts: { supported: boolean; armed: boolean; muted: boolean }): boolean {
  return opts.supported && opts.armed && !opts.muted;
}

export function modeAfter(
  mode: ListenMode,
  event: "mute" | "unmute" | "wake" | "command" | "reply-done",
): ListenMode {
  if (event === "mute") return "wake";
  if (event === "wake" || event === "command") return "session";
  return mode;
}

/** True when the line is only a wake phrase (optional hey/hi), not a real question. */
export function bareWake(text: string): boolean {
  const found = matchWake(text);
  if (!found.hit || found.command) return false;
  const words = normalizeSpeech(text).split(" ").filter(Boolean);
  if (!words.length || words.length > 4) return false;
  return words.every((word) => FILLER.has(word) || /mulk|milk|molk|allah|alla|jarvis|merca|merk|mulc/.test(word));
}

export function isLikelyEcho(heard: string, recentSpoken: string[]): boolean {
  const h = normalizeSpeech(heard);
  if (!h) return true;
  for (const spoken of recentSpoken) {
    const s = normalizeSpeech(spoken);
    if (!s) continue;
    if (h === s) return true;
    if (h.length >= 10 && (s.includes(h) || h.includes(s))) return true;
  }
  return false;
}

export function decideTranscript(gates: VoiceGates, text: string, isFinal: boolean): TranscriptDecision {
  const trimmed = text.trim();
  if (!trimmed || gates.muted || !gates.armed) return { type: "ignore" };
  const norm = normalizeSpeech(trimmed);
  if (norm.length < 2) return { type: "ignore" };
  if (isLikelyEcho(trimmed, gates.recentSpoken)) return { type: "ignore" };
  if (gates.echoGuard && norm.length < 8) return { type: "ignore" };

  if (gates.mode === "wake") {
    const wake = matchWake(trimmed);
    if (!wake.hit) return { type: "ignore" };
    if (!wake.command) return { type: "wake-only", final: isFinal };
    return { type: "command", text: wake.command, final: isFinal };
  }

  const leading = leadingWake(trimmed);
  if (leading.hit && leading.command) return { type: "command", text: leading.command, final: isFinal };
  if (bareWake(trimmed)) return { type: "wake-only", final: isFinal };
  return { type: "command", text: trimmed, final: isFinal };
}

export type SessionStep =
  | { type: "arm" }
  | { type: "mute" }
  | { type: "unmute" }
  | { type: "reply-done" }
  | { type: "transcript"; text: string; final?: boolean };

export type SessionTrace = {
  mode: ListenMode;
  listening: boolean;
  greets: number;
  commands: string[];
  micClicks: number;
};

/** Headless stand-in for the recognizer loop. Does not click the mic. */
export function runVoiceSession(steps: SessionStep[]): SessionTrace {
  let mode: ListenMode = "wake";
  let muted = false;
  let armed = false;
  let greets = 0;
  let echoGuard = false;
  const commands: string[] = [];
  const spoken: string[] = [];

  for (const step of steps) {
    if (step.type === "arm") {
      armed = true;
      continue;
    }
    if (step.type === "mute") {
      muted = true;
      mode = modeAfter(mode, "mute");
      echoGuard = false;
      continue;
    }
    if (step.type === "unmute") {
      muted = false;
      continue;
    }
    if (step.type === "reply-done") {
      mode = modeAfter(mode, "reply-done");
      echoGuard = true;
      continue;
    }

    const decision = decideTranscript(
      { mode, muted, armed, echoGuard, recentSpoken: spoken },
      step.text,
      step.final !== false,
    );
    echoGuard = false;

    if (decision.type === "wake-only" && decision.final) {
      greets += 1;
      mode = modeAfter(mode, "wake");
      spoken.unshift("Hi Mulk Allah!");
    } else if (decision.type === "command" && decision.final) {
      commands.push(decision.text);
      mode = modeAfter(mode, "command");
    } else if (decision.type === "wake-only" || decision.type === "command") {
      mode = modeAfter(mode, decision.type === "command" ? "command" : "wake");
    }
  }

  return {
    mode,
    listening: shouldListen({ supported: true, armed, muted }),
    greets,
    commands,
    micClicks: 0,
  };
}
