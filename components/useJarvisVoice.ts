"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMMAND_SILENCE_MS,
  createWakeBuffer,
  matchWake,
  normalizeSpeech,
} from "@/lib/wake-phrase";

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
};

export type CommandMarks = { commandFinal: number };

const COMMAND_WINDOW_MS = 6000;
const RESTART_RETRY_MS = 50;

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
  manual: boolean;
  paused: boolean;
  commandLang: string;
  onCommand: (text: string, marks?: CommandMarks) => void;
  onPhase?: (phase: VoicePhase) => void;
  onDenied?: (message: string) => void;
  onPermission?: (permission: MicPermission) => void;
  onReleaseManual?: () => void;
  onDebug?: (debug: VoiceDebug) => void;
};

export function useJarvisVoice({
  manual,
  paused,
  commandLang,
  onCommand,
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
  const pausedRef = useRef(paused);
  const langRef = useRef(commandLang);
  const armedRef = useRef(false);
  const wantRef = useRef(false);
  const recRef = useRef<SpeechRec | null>(null);
  const startingRef = useRef(false);
  const runningRef = useRef(false);
  const commandModeRef = useRef(false);
  const commandLock = useRef(false);
  const silenceTimer = useRef(0);
  const windowTimer = useRef(0);
  const restartTimer = useRef(0);
  const buffer = useRef(createWakeBuffer());
  const lastRawRef = useRef("");
  const lastWakeRef = useRef<"none" | "detected">("none");
  const lastCommandRef = useRef("");
  const wakeHitAtRef = useRef(0);
  const wakeLatencyRef = useRef<number | null>(null);
  const commandFinalRef = useRef<number | null>(null);
  const permissionRef = useRef<MicPermission>("unknown");
  const onCommandRef = useRef(onCommand);
  const onPhaseRef = useRef(onPhase);
  const onDeniedRef = useRef(onDenied);
  const onPermissionRef = useRef(onPermission);
  const onReleaseManualRef = useRef(onReleaseManual);
  const onDebugRef = useRef(onDebug);

  onCommandRef.current = onCommand;
  onPhaseRef.current = onPhase;
  onDeniedRef.current = onDenied;
  onPermissionRef.current = onPermission;
  onReleaseManualRef.current = onReleaseManual;
  onDebugRef.current = onDebug;
  manualRef.current = manual;
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

  const publishDebug = useCallback(() => {
    onDebugRef.current?.({
      mode: phaseRef.current,
      recognition: runningRef.current ? "running" : "stopped",
      mic: permissionRef.current,
      lastRaw: lastRawRef.current,
      buffer: buffer.current.text(),
      normalized: normalizeSpeech(buffer.current.text()),
      wake: lastWakeRef.current,
      wakePhrase: lastWakeRef.current === "detected" ? "Mulk Allah" : "",
      wakeLatencyMs: wakeLatencyRef.current,
      command: lastCommandRef.current,
      commandFinal: commandFinalRef.current,
    });
  }, []);

  const clearTimers = useCallback(() => {
    window.clearTimeout(silenceTimer.current);
    window.clearTimeout(windowTimer.current);
    window.clearTimeout(restartTimer.current);
    silenceTimer.current = 0;
    windowTimer.current = 0;
    restartTimer.current = 0;
  }, []);

  const fireCommand = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || commandLock.current) return;
      commandLock.current = true;
      commandModeRef.current = false;
      lastCommandRef.current = trimmed;
      lastWakeRef.current = "detected";
      const commandFinal = performance.now();
      commandFinalRef.current = commandFinal;
      buffer.current.reset();
      clearTimers();
      setInterim("");
      setPhaseSafe("standby");
      pausedRef.current = true;
      runningRef.current = false;
      startingRef.current = false;
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      setRunning(false);
      onReleaseManualRef.current?.();
      publishDebug();
      onCommandRef.current(trimmed, { commandFinal });
    },
    [clearTimers, publishDebug, setPhaseSafe],
  );

  const enterCommandMode = useCallback(
    (extracted: string, isFinal: boolean) => {
      const hitAt = wakeHitAtRef.current || performance.now();
      lastWakeRef.current = "detected";
      commandModeRef.current = true;
      buffer.current.reset();
      setPhaseSafe("waking");
      wakeLatencyRef.current = Math.max(0, Math.round(performance.now() - hitAt));
      const promote = () => {
        if (commandModeRef.current && !commandLock.current && phaseRef.current === "waking") {
          setPhaseSafe("listening_for_command");
          wakeLatencyRef.current = Math.max(0, Math.round(performance.now() - hitAt));
          publishDebug();
        }
      };
      requestAnimationFrame(promote);
      publishDebug();

      if (extracted) {
        if (isFinal) {
          fireCommand(extracted);
          return;
        }
        setInterim(extracted);
        window.clearTimeout(silenceTimer.current);
        silenceTimer.current = window.setTimeout(() => {
          if (extracted.trim() && commandModeRef.current) fireCommand(extracted);
        }, COMMAND_SILENCE_MS);
      } else {
        setInterim("");
      }

      window.clearTimeout(windowTimer.current);
      windowTimer.current = window.setTimeout(() => {
        if (!commandModeRef.current || commandLock.current) return;
        commandModeRef.current = false;
        lastWakeRef.current = "none";
        setInterim("");
        onReleaseManualRef.current?.();
        setPhaseSafe("listening_for_wake");
        publishDebug();
      }, COMMAND_WINDOW_MS);
    },
    [fireCommand, publishDebug, setPhaseSafe],
  );

  const handleTranscript = useCallback(
    (committedPiece: string, interimPiece: string, sawFinal: boolean) => {
      if (commandLock.current || pausedRef.current) return;

      if (committedPiece) lastRawRef.current = committedPiece;
      else if (interimPiece) lastRawRef.current = interimPiece;

      const haystack = committedPiece
        ? buffer.current.pushFinal(committedPiece)
        : buffer.current.setInterim(interimPiece);

      publishDebug();

      if (manualRef.current || commandModeRef.current) {
        const { hit, command } = matchWake(haystack);
        const payload = hit ? command : haystack;
        if (!sawFinal) {
          setInterim(payload || haystack);
          window.clearTimeout(silenceTimer.current);
          silenceTimer.current = window.setTimeout(() => {
            const leftover = (payload || haystack).trim();
            if (leftover && (manualRef.current || commandModeRef.current)) fireCommand(leftover);
          }, COMMAND_SILENCE_MS);
          return;
        }
        if (payload) fireCommand(payload);
        return;
      }

      const { hit, command } = matchWake(haystack);
      if (!hit) {
        if (!sawFinal) setInterim("");
        return;
      }
      wakeHitAtRef.current = performance.now();
      enterCommandMode(command, sawFinal);
    },
    [enterCommandMode, fireCommand, publishDebug],
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
      if (ev.error === "not-allowed") {
        wantRef.current = false;
        armedRef.current = false;
        setArmed(false);
        setPermissionSafe("denied");
        setPhaseSafe("error");
        onDeniedRef.current?.(
          "Microphone permission is required for hands-free wake. Allow the mic, then tap Voice Ready once.",
        );
        return;
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
    if (!Ctor || pausedRef.current || !wantRef.current || !armedRef.current) return;
    if (permissionRef.current === "denied") return;
    if (startingRef.current || runningRef.current) return;

    startingRef.current = true;
    if (!recRef.current) {
      const rec = new Ctor();
      attach(rec);
      recRef.current = rec;
    }

    try {
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
          setPermissionSafe("granted");
          armedRef.current = true;
          setArmed(true);
        }
        s.onchange = () => {
          if (s.state === "denied") {
            setPermissionSafe("denied");
            setPhaseSafe("error");
            armedRef.current = false;
            setArmed(false);
          } else if (s.state === "granted") {
            setPermissionSafe("granted");
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
    const active = supported && armed && !paused && permissionRef.current !== "denied";
    wantRef.current = active;
    if (!active) {
      commandLock.current = false;
      if (paused) {
        setInterim("");
        if (phaseRef.current === "listening_for_command" || phaseRef.current === "waking") {
          setPhaseSafe("standby");
        }
        softStop();
      }
      return;
    }
    commandLock.current = false;
    if (manual) {
      commandModeRef.current = true;
      setPhaseSafe("listening_for_command");
    } else if (!commandModeRef.current) {
      setPhaseSafe("listening_for_wake");
    }
    startRecRef.current();
  }, [supported, armed, paused, manual, setPhaseSafe, softStop]);

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

  const unlock = useCallback(() => {
    if (!getCtor()) return;
    if (permissionRef.current === "denied") return;
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
    needsEnable: supported && !armed && permission !== "denied",
    unlock,
  };
}
