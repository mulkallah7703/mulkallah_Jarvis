"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMMAND_SILENCE_MS,
  createWakeBuffer,
  normalizeSpeech,
} from "@/lib/wake-phrase";
import {
  decideTranscript,
  modeAfter,
  type ListenMode,
} from "@/lib/voice-session";

export type VoicePhase =
  | "standby"
  | "listening_for_wake"
  | "waking"
  | "listening_for_command"
  | "thinking"
  | "speaking"
  | "error";

export type MicPermission = "unknown" | "granted" | "denied";

export type VoiceDebug = {
  mode: string;
  recognition: "running" | "stopped";
  mic: MicPermission;
  lastRaw: string;
  buffer: string;
  normalized: string;
  wake: "none" | "detected";
  wakePhrase: string;
  wakeLatencyMs: number | null;
  command: string;
  commandFinal: number | null;
  session: "open" | "wake";
};

export type CommandMarks = { commandFinal: number };

const RESTART_RETRY_MS = 30;
/**
 * Bare "mulk" often finalizes before the rest of the same sentence.
 * Hold the greeting just long enough to catch that tail, then speak.
 * A wake that already includes the command never waits.
 */
const WAKE_GREET_DELAY_MS = 340;
const GREET_COOLDOWN_MS = 2200;
const ECHO_GUARD_MS = 220;

type RecCtor = new () => SpeechRec;
type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: ((ev?: unknown) => void) | null;
};
type SpeechRecEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function getCtor(): RecCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecCtor;
    webkitSpeechRecognition?: RecCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type Opts = {
  /** When false the mic is muted and wake listening stays off. */
  enabled: boolean;
  manual: boolean;
  paused: boolean;
  commandLang: string;
  onCommand: (text: string, marks?: CommandMarks) => void;
  /** Return true when greeting speech actually started. */
  onGreet?: () => boolean | void;
  onPhase?: (phase: VoicePhase) => void;
  onDenied?: (message: string) => void;
  onPermission?: (permission: MicPermission) => void;
  onReleaseManual?: () => void;
  onDebug?: (debug: VoiceDebug) => void;
};

export function useJarvisVoice({
  enabled,
  manual,
  paused,
  commandLang,
  onCommand,
  onGreet,
  onPhase,
  onDenied,
  onPermission,
  onReleaseManual,
  onDebug,
}: Opts) {
  const [supported, setSupported] = useState(false);
  const [interim, setInterim] = useState("");
  const [phase, setPhase] = useState<VoicePhase>("standby");
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [armed, setArmed] = useState(false);
  const [running, setRunning] = useState(false);

  const phaseRef = useRef<VoicePhase>("standby");
  const manualRef = useRef(manual);
  const enabledRef = useRef(enabled);
  const pausedRef = useRef(paused);
  const wasPausedRef = useRef(false);
  const langRef = useRef(commandLang);
  const armedRef = useRef(false);
  const wantRef = useRef(false);
  const recRef = useRef<SpeechRec | null>(null);
  const startingRef = useRef(false);
  const runningRef = useRef(false);
  const commandModeRef = useRef(false);
  const commandLock = useRef(false);
  const silenceTimer = useRef(0);
  const restartTimer = useRef(0);
  const greetTimer = useRef(0);
  const greetedRef = useRef(false);
  const greetedAtRef = useRef(0);
  const echoUntilRef = useRef(0);
  const gestureNeededRef = useRef(false);
  const grantFromQueryRef = useRef(false);
  const buffer = useRef(createWakeBuffer());
  const pendingCommandRef = useRef("");
  const spokenRef = useRef<string[]>([]);
  const lastRawRef = useRef("");
  const lastWakeRef = useRef<"none" | "detected">("none");
  const lastCommandRef = useRef("");
  const wakeHitAtRef = useRef(0);
  const wakeLatencyRef = useRef<number | null>(null);
  const commandFinalRef = useRef<number | null>(null);
  const permissionRef = useRef<MicPermission>("unknown");
  const onCommandRef = useRef(onCommand);
  const onGreetRef = useRef(onGreet);
  const onPhaseRef = useRef(onPhase);
  const onDeniedRef = useRef(onDenied);
  const onPermissionRef = useRef(onPermission);
  const onReleaseManualRef = useRef(onReleaseManual);
  const onDebugRef = useRef(onDebug);

  onCommandRef.current = onCommand;
  onGreetRef.current = onGreet;
  onPhaseRef.current = onPhase;
  onDeniedRef.current = onDenied;
  onPermissionRef.current = onPermission;
  onReleaseManualRef.current = onReleaseManual;
  onDebugRef.current = onDebug;
  manualRef.current = manual;
  enabledRef.current = enabled;
  pausedRef.current = paused;
  langRef.current = commandLang;
  permissionRef.current = permission;
  armedRef.current = armed;

  const setPhaseSafe = useCallback((next: VoicePhase) => {
    if (phaseRef.current === next) return;
    phaseRef.current = next;
    setPhase(next);
    onPhaseRef.current?.(next);
  }, []);

  const setPermissionSafe = useCallback((next: MicPermission) => {
    if (permissionRef.current === next) return;
    permissionRef.current = next;
    setPermission(next);
    onPermissionRef.current?.(next);
  }, []);

  const applyMode = useCallback((event: "mute" | "unmute" | "wake" | "command" | "reply-done") => {
    const current: ListenMode = commandModeRef.current ? "session" : "wake";
    commandModeRef.current = modeAfter(current, event) === "session";
  }, []);

  const publishDebug = useCallback(() => {
    onDebugRef.current?.({
      mode: phaseRef.current,
      recognition: runningRef.current ? "running" : "stopped",
      mic: permissionRef.current,
      lastRaw: lastRawRef.current,
      buffer: buffer.current.text(),
      normalized: normalizeSpeech(buffer.current.text() || pendingCommandRef.current),
      wake: lastWakeRef.current,
      wakePhrase: lastWakeRef.current === "detected" ? "Mulk Allah" : "",
      wakeLatencyMs: wakeLatencyRef.current,
      command: lastCommandRef.current,
      commandFinal: commandFinalRef.current,
      session: commandModeRef.current ? "open" : "wake",
    });
  }, []);

  const clearTimers = useCallback(() => {
    window.clearTimeout(silenceTimer.current);
    window.clearTimeout(restartTimer.current);
    window.clearTimeout(greetTimer.current);
    silenceTimer.current = 0;
    restartTimer.current = 0;
    greetTimer.current = 0;
  }, []);

  const resetGreet = useCallback(() => {
    window.clearTimeout(greetTimer.current);
    greetTimer.current = 0;
    greetedRef.current = false;
  }, []);

  const cancelGreet = useCallback(() => {
    window.clearTimeout(greetTimer.current);
    greetTimer.current = 0;
    greetedRef.current = true;
    greetedAtRef.current = performance.now();
  }, []);

  const noteSpoken = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    spokenRef.current = [clean, ...spokenRef.current].slice(0, 4);
  }, []);

  const enterSession = useCallback(() => {
    applyMode("wake");
    lastWakeRef.current = "detected";
    const hitAt = wakeHitAtRef.current || performance.now();
    wakeLatencyRef.current = Math.max(0, Math.round(performance.now() - hitAt));
    buffer.current.reset();
    if (phaseRef.current !== "listening_for_command") {
      setPhaseSafe("waking");
      requestAnimationFrame(() => {
        if (commandModeRef.current && !commandLock.current && phaseRef.current === "waking") {
          setPhaseSafe("listening_for_command");
          publishDebug();
        }
      });
    }
    publishDebug();
  }, [applyMode, publishDebug, setPhaseSafe]);

  const greetNow = useCallback(() => {
    if (commandLock.current || pausedRef.current || !commandModeRef.current) return;
    if (greetedRef.current && performance.now() - greetedAtRef.current < GREET_COOLDOWN_MS) return;
    window.clearTimeout(greetTimer.current);
    greetTimer.current = 0;
    greetedRef.current = true;
    greetedAtRef.current = performance.now();
    pausedRef.current = true;
    runningRef.current = false;
    startingRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setRunning(false);
    let accepted = false;
    try {
      accepted = onGreetRef.current?.() === true;
    } catch {
      accepted = false;
    }
    if (!accepted) {
      pausedRef.current = false;
      if (wantRef.current && enabledRef.current) startRecRef.current();
    }
    publishDebug();
  }, [publishDebug]);

  const scheduleGreet = useCallback(() => {
    if (commandLock.current) return;
    if (greetedRef.current && performance.now() - greetedAtRef.current < GREET_COOLDOWN_MS) return;
    window.clearTimeout(greetTimer.current);
    greetTimer.current = window.setTimeout(() => {
      greetTimer.current = 0;
      greetNow();
    }, WAKE_GREET_DELAY_MS);
  }, [greetNow]);

  const fireCommand = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || commandLock.current) return;
      const gates = {
        mode: "session" as const,
        muted: false,
        armed: true,
        echoGuard: performance.now() < echoUntilRef.current,
        recentSpoken: spokenRef.current,
      };
      const verdict = decideTranscript(gates, trimmed, true);
      if (verdict.type !== "command") return;
      commandLock.current = true;
      applyMode("command");
      cancelGreet();
      lastCommandRef.current = verdict.text;
      lastWakeRef.current = "detected";
      const commandFinal = performance.now();
      commandFinalRef.current = commandFinal;
      pendingCommandRef.current = "";
      buffer.current.reset();
      window.clearTimeout(silenceTimer.current);
      window.clearTimeout(greetTimer.current);
      silenceTimer.current = 0;
      greetTimer.current = 0;
      setInterim("");
      pausedRef.current = true;
      runningRef.current = false;
      startingRef.current = false;
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      setRunning(false);
      publishDebug();
      onCommandRef.current(verdict.text, { commandFinal });
    },
    [applyMode, cancelGreet, publishDebug],
  );

  const armSilence = useCallback(() => {
    window.clearTimeout(silenceTimer.current);
    silenceTimer.current = window.setTimeout(() => {
      silenceTimer.current = 0;
      const text = pendingCommandRef.current.trim();
      pendingCommandRef.current = "";
      if (text) fireCommand(text);
    }, COMMAND_SILENCE_MS);
  }, [fireCommand]);

  const handleTranscript = useCallback(
    (committedPiece: string, interimPiece: string, sawFinal: boolean) => {
      if (commandLock.current || pausedRef.current || !enabledRef.current) return;

      if (committedPiece) lastRawRef.current = committedPiece;
      else if (interimPiece) lastRawRef.current = interimPiece;

      const haystack = committedPiece
        ? buffer.current.pushFinal(committedPiece)
        : buffer.current.setInterim(interimPiece);

      const decision = decideTranscript(
        {
          mode: manualRef.current || commandModeRef.current ? "session" : "wake",
          muted: false,
          armed: armedRef.current,
          echoGuard: performance.now() < echoUntilRef.current,
          recentSpoken: spokenRef.current,
        },
        haystack,
        sawFinal,
      );
      publishDebug();

      if (decision.type === "ignore") {
        buffer.current.reset();
        if (!commandModeRef.current) setInterim("");
        return;
      }

      if (decision.type === "wake-only") {
        if (!commandModeRef.current) {
          wakeHitAtRef.current = performance.now();
          enterSession();
        }
        buffer.current.reset();
        pendingCommandRef.current = "";
        window.clearTimeout(silenceTimer.current);
        setInterim("");
        scheduleGreet();
        return;
      }

      if (!commandModeRef.current) {
        wakeHitAtRef.current = performance.now();
        enterSession();
      }
      cancelGreet();
      buffer.current.reset();
      pendingCommandRef.current = decision.text;
      if (!decision.final) {
        setInterim(decision.text);
        armSilence();
        return;
      }
      window.clearTimeout(silenceTimer.current);
      fireCommand(decision.text);
    },
    [armSilence, cancelGreet, enterSession, fireCommand, publishDebug, scheduleGreet],
  );

  const handleTranscriptRef = useRef(handleTranscript);
  handleTranscriptRef.current = handleTranscript;

  const attach = useCallback((rec: SpeechRec) => {
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      let finals = "";
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0]?.transcript ?? "";
        if (ev.results[i].isFinal) finals += piece;
        else live += piece;
      }
      handleTranscriptRef.current(finals.trim(), live.trim(), Boolean(finals.trim()));
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        wantRef.current = false;
        armedRef.current = false;
        setArmed(false);
        runningRef.current = false;
        startingRef.current = false;
        setRunning(false);
        gestureNeededRef.current = true;
        if (permissionRef.current === "denied" || grantFromQueryRef.current) {
          if (permissionRef.current === "denied") {
            setPhaseSafe("error");
            onDeniedRef.current?.(
              "Microphone permission is required for hands-free wake. Allow the mic, then tap Voice Ready once.",
            );
          } else {
            setPhaseSafe("standby");
          }
        } else {
          setPermissionSafe("unknown");
          setPhaseSafe("standby");
        }
      }
    };
    rec.onend = () => {
      runningRef.current = false;
      startingRef.current = false;
      setRunning(false);
      if (!wantRef.current || pausedRef.current) return;
      if (permissionRef.current === "denied") return;
      window.clearTimeout(restartTimer.current);
      startRecRef.current();
      if (!runningRef.current && wantRef.current && !pausedRef.current) {
        restartTimer.current = window.setTimeout(() => startRecRef.current(), RESTART_RETRY_MS);
      }
    };
  }, [setPermissionSafe, setPhaseSafe]);

  const startRecRef = useRef<() => void>(() => {});

  const startRec = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || pausedRef.current || !wantRef.current || !armedRef.current || !enabledRef.current) return;
    if (permissionRef.current === "denied") return;
    if (startingRef.current || runningRef.current) return;

    startingRef.current = true;
    if (!recRef.current) {
      const rec = new Ctor();
      attach(rec);
      recRef.current = rec;
    }

    try {
      recRef.current.lang = "en-US";
      recRef.current.start();
      startingRef.current = false;
      runningRef.current = true;
      setRunning(true);
      setPermissionSafe("granted");
      if (manualRef.current || commandModeRef.current) setPhaseSafe("listening_for_command");
      else setPhaseSafe("listening_for_wake");
      publishDebug();
    } catch {
      startingRef.current = false;
      runningRef.current = false;
      setRunning(false);
    }
  }, [attach, publishDebug, setPermissionSafe, setPhaseSafe]);

  startRecRef.current = startRec;

  const softStop = useCallback(() => {
    const rec = recRef.current;
    if (!rec || (!runningRef.current && !startingRef.current)) return;
    runningRef.current = false;
    startingRef.current = false;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
    setRunning(false);
    publishDebug();
  }, [publishDebug]);

  useEffect(() => {
    setSupported(Boolean(getCtor()));
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let status: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((s) => {
        status = s;
        if (s.state === "denied") {
          setPermissionSafe("denied");
          setPhaseSafe("error");
          onDeniedRef.current?.(
            "Microphone permission is required for hands-free wake. Allow the mic, then tap Voice Ready once.",
          );
        } else if (s.state === "granted") {
          grantFromQueryRef.current = true;
          gestureNeededRef.current = false;
          setPermissionSafe("granted");
          if (enabledRef.current) {
            armedRef.current = true;
            setArmed(true);
          }
        }
        s.onchange = () => {
          if (s.state === "denied") {
            grantFromQueryRef.current = true;
            gestureNeededRef.current = true;
            setPermissionSafe("denied");
            setPhaseSafe("error");
            armedRef.current = false;
            setArmed(false);
          } else if (s.state === "granted") {
            grantFromQueryRef.current = true;
            gestureNeededRef.current = false;
            setPermissionSafe("granted");
            if (enabledRef.current) {
              armedRef.current = true;
              setArmed(true);
            }
          }
        };
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      if (status) status.onchange = null;
    };
  }, [setPermissionSafe, setPhaseSafe]);

  useEffect(() => {
    if (permission === "denied") {
      wantRef.current = false;
      armedRef.current = false;
      setArmed(false);
      clearTimers();
      softStop();
      setPhaseSafe("error");
    }
  }, [permission, clearTimers, setPhaseSafe, softStop]);

  useEffect(() => {
    if (
      supported &&
      enabled &&
      permission !== "denied" &&
      !gestureNeededRef.current &&
      !armedRef.current
    ) {
      armedRef.current = true;
      setArmed(true);
    }
    const active =
      supported && enabled && armedRef.current && !paused && permission !== "denied";
    const resumed = wasPausedRef.current && !paused && active;
    wasPausedRef.current = paused;
    wantRef.current = active;
    if (resumed) echoUntilRef.current = performance.now() + ECHO_GUARD_MS;
    if (!active) {
      commandLock.current = false;
      if (!paused && !enabled) {
        applyMode("mute");
        resetGreet();
        buffer.current.reset();
        pendingCommandRef.current = "";
      }
      setInterim("");
      if (
        !commandModeRef.current &&
        (phaseRef.current === "listening_for_command" || phaseRef.current === "waking")
      ) {
        setPhaseSafe(permission === "denied" ? "error" : "standby");
      } else if (!paused && !enabled && permission !== "denied") {
        setPhaseSafe("standby");
      }
      softStop();
      return;
    }
    commandLock.current = false;
    if (manual || commandModeRef.current) {
      if (manual) applyMode("command");
      setPhaseSafe("listening_for_command");
    } else {
      resetGreet();
      setPhaseSafe("listening_for_wake");
    }
    startRecRef.current();
  }, [supported, enabled, armed, paused, permission, manual, applyMode, resetGreet, setPhaseSafe, softStop]);

  useEffect(() => {
    if (!supported || permission === "denied") return;
    const onGesture = () => {
      if (!enabledRef.current || permissionRef.current === "denied" || runningRef.current) return;
      gestureNeededRef.current = false;
      armedRef.current = true;
      setArmed(true);
      wantRef.current = !pausedRef.current;
      startRecRef.current();
    };
    window.addEventListener("pointerdown", onGesture, true);
    window.addEventListener("keydown", onGesture, true);
    return () => {
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
    };
  }, [supported, permission]);

  useEffect(() => {
    return () => {
      wantRef.current = false;
      clearTimers();
      const rec = recRef.current;
      recRef.current = null;
      if (!rec) return;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [clearTimers]);

  const unlock = useCallback((force = false) => {
    if (!getCtor()) return;
    if (permissionRef.current === "denied") return;
    if (!force && !enabledRef.current) return;
    gestureNeededRef.current = false;
    armedRef.current = true;
    setArmed(true);
    wantRef.current = !pausedRef.current;
    startRecRef.current();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") !== "voice") return;
    const w = window as unknown as {
      __jarvisInjectTranscript?: (text: string, isFinal?: boolean) => void;
    };
    w.__jarvisInjectTranscript = (text: string, isFinal = true) => {
      if (isFinal) handleTranscriptRef.current(text, "", true);
      else handleTranscriptRef.current("", text, false);
    };
    return () => {
      delete w.__jarvisInjectTranscript;
    };
  }, []);

  return {
    supported,
    interim,
    phase,
    permission,
    armed,
    running,
    needsEnable: supported && enabled && !armed && permission !== "denied",
    unlock,
    noteSpoken,
  };
}
