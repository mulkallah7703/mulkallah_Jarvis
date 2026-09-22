"use client";

import { useEffect, useRef, useState } from "react";
import type { OrbState } from "./orb-state";
import ChatHud, { type ChatMetrics } from "./ChatHud";
import ParticleHologram from "./ParticleHologram";
import type { TtsEngine } from "./useJarvisTts";
import type { MicPermission, VoiceDebug, VoicePhase } from "./useJarvisVoice";

function statusLabel(show: OrbState, phase: VoicePhase): string {
  if (show === "thinking") return "PROCESSING";
  if (show === "speaking") return "SPEAKING";
  if (phase === "waking") return "AWAKE";
  if (phase === "listening_for_command") return "LISTENING";
  return "STANDBY";
}

const EMPTY_DEBUG: VoiceDebug = {
  mode: "standby",
  recognition: "stopped",
  mic: "unknown",
  lastRaw: "",
  buffer: "",
  normalized: "",
  wake: "none",
  wakePhrase: "",
  wakeLatencyMs: null,
  command: "",
  commandFinal: null,
};

export default function JarvisStage() {
  const [micOn, setMicOn] = useState(false);
  const [showState, setShowState] = useState<OrbState>("idle");
  const [voiceEnergy, setVoiceEnergy] = useState(0);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>("standby");
  const [micPermission, setMicPermission] = useState<MicPermission>("unknown");
  const [voiceArmed, setVoiceArmed] = useState(false);
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>("none");
  const [wakeBoost, setWakeBoost] = useState(0);
  const [debug, setDebug] = useState(false);
  const [voiceDebug, setVoiceDebug] = useState<VoiceDebug>(EMPTY_DEBUG);
  const [metrics, setMetrics] = useState<ChatMetrics | null>(null);
  const prevPhase = useRef<VoicePhase>("standby");
  const wakeAt = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDebug(params.get("debug") === "voice");
  }, []);

  useEffect(() => {
    const fromWake =
      prevPhase.current === "listening_for_wake" &&
      (voicePhase === "waking" || voicePhase === "listening_for_command");
    prevPhase.current = voicePhase;
    if (!fromWake) return;
    wakeAt.current = performance.now();
    setWakeBoost(0.55);
    const t = window.setTimeout(() => setWakeBoost(0), 180);
    return () => window.clearTimeout(t);
  }, [voicePhase]);

  const orbState: OrbState =
    showState === "thinking" || showState === "speaking"
      ? showState
      : voicePhase === "listening_for_command" || voicePhase === "waking"
        ? "listening"
        : "idle";

  const hologramEnergy =
    orbState === "speaking"
      ? Math.max(voiceEnergy, 0.12)
      : orbState === "listening"
        ? Math.max(voiceEnergy, wakeBoost)
        : voicePhase === "listening_for_wake"
          ? Math.max(voiceEnergy, 0.08)
          : voiceEnergy;

  const firstMs =
    metrics?.requestStart != null && metrics.firstResponse != null
      ? Math.round(metrics.firstResponse - metrics.requestStart)
      : null;
  const cmdToReqMs =
    metrics?.commandFinal != null && metrics.requestStart != null
      ? Math.round(metrics.requestStart - metrics.commandFinal)
      : null;
  const audioFromFirstMs =
    metrics?.firstResponse != null && metrics.ttsStart != null
      ? Math.round(metrics.ttsStart - metrics.firstResponse)
      : null;
  const totalMs =
    metrics?.commandFinal != null && metrics.ttsStart != null
      ? Math.round(metrics.ttsStart - metrics.commandFinal)
      : metrics?.requestStart != null && metrics.ttsStart != null
        ? Math.round(metrics.ttsStart - metrics.requestStart)
        : null;

  return (
    <main className="jarvis-stage" id="main">
      <ParticleHologram mode={orbState} energy={hologramEnergy} />

      <header className="jarvis-brand">
        <div className="jarvis-brand-name">JARVIS</div>
        <div className="jarvis-brand-tag">The AI That Has Attitude</div>
        <div className="jarvis-brand-ar" dir="rtl" lang="ar">
          مساعدك الذكي... بس عنده شخصية.
        </div>
      </header>

      <div className="jarvis-status" aria-live="polite">
        {statusLabel(showState, voicePhase)}
      </div>

      {debug && (
        <pre className="jarvis-voice-debug">
          {`MODE: ${statusLabel(showState, voicePhase)} (${voiceDebug.mode})
MIC: ${voiceDebug.mic.toUpperCase()} ARMED: ${voiceArmed ? "YES" : "NO"}
RECOGNITION: ${voiceDebug.recognition.toUpperCase()}
LAST RAW: ${voiceDebug.lastRaw || "—"}
NORMALIZED: ${voiceDebug.normalized || "—"}
WAKE: ${voiceDebug.wake === "detected" ? voiceDebug.wakePhrase || "Mulk Allah" : "NONE"}
WAKE LATENCY: ${voiceDebug.wakeLatencyMs == null ? "—" : `${voiceDebug.wakeLatencyMs}ms`}
COMMAND: ${voiceDebug.command || metrics?.command || "—"}
COMMAND → REQUEST: ${cmdToReqMs == null ? "—" : `${cmdToReqMs}ms`}
REQUEST → FIRST RESPONSE: ${firstMs == null ? "—" : `${firstMs}ms`}
FIRST RESPONSE → AUDIO: ${audioFromFirstMs == null ? "—" : `${audioFromFirstMs}ms`}
TTS: ${ttsEngine.toUpperCase()}
MODEL: ${metrics?.model || "—"} ${metrics?.provider || ""}
TOTAL: ${totalMs == null ? "—" : `${totalMs}ms`}`}
        </pre>
      )}

      <ChatHud
        micOn={micOn}
        onMicChange={setMicOn}
        onOrbState={(s) => {
          setShowState(s);
          if (s !== "speaking") setVoiceEnergy(0);
        }}
        onBusy={() => {}}
        onVoiceEnergy={setVoiceEnergy}
        onVoicePhase={setVoicePhase}
        onVoicePermission={setMicPermission}
        onVoiceArmed={setVoiceArmed}
        onTtsEngine={setTtsEngine}
        onVoiceDebug={setVoiceDebug}
        onChatMetrics={setMetrics}
      />
    </main>
  );
}
