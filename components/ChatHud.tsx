"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MessageSquare, Mic, MicOff, X } from "lucide-react";
import type { OrbState } from "./orb-state";
import { matchWake } from "@/lib/wake-phrase";
import { speechSupported } from "./useSpeechInput";
import { useJarvisTts, type TtsEngine } from "./useJarvisTts";
import { useJarvisVoice, type MicPermission, type VoiceDebug, type VoicePhase } from "./useJarvisVoice";

const CYAN = "#00e5ff";
const GOLD = "#f5a623";

type Turn = { id: string; role: "user" | "assistant"; content: string };

export type ChatMetrics = {
  command: string;
  commandFinal: number | null;
  requestStart: number | null;
  firstResponse: number | null;
  responseComplete: number | null;
  ttsStart: number | null;
  model: string;
  provider: string;
};

type Props = {
  micOn: boolean;
  onMicChange: (on: boolean) => void;
  onOrbState: (s: OrbState) => void;
  onBusy: (busy: boolean) => void;
  onVoiceEnergy?: (value: number) => void;
  onVoicePhase?: (phase: VoicePhase) => void;
  onVoicePermission?: (permission: MicPermission) => void;
  onTtsEngine?: (engine: TtsEngine) => void;
  onVoiceArmed?: (armed: boolean) => void;
  onVoiceDebug?: (debug: VoiceDebug) => void;
  onChatMetrics?: (metrics: ChatMetrics) => void;
};

function splitReady(text: string, final: boolean): { ready: string[]; leftover: string } {
  const ready: string[] = [];
  let rest = text;
  while (rest) {
    const index = rest.search(/[.!?؟]/);
    if (index < 0) break;
    const end = index + 1;
    if (!final && end >= rest.length) break;
    const sentence = rest.slice(0, end).trim();
    if (sentence) ready.push(sentence);
    rest = rest.slice(end).trim();
  }
  return { ready, leftover: rest };
}

function RailBtn({
  label,
  pressed,
  expanded,
  controls,
  onClick,
  accent = CYAN,
  badge,
  children,
}: {
  label: string;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  onClick: () => void;
  accent?: string;
  badge?: boolean;
  children: ReactNode;
}) {
  const lit = Boolean(pressed || expanded);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className="jarvis-rail-btn"
      style={{
        color: lit ? "#041018" : accent,
        background: lit ? accent : "rgba(4, 8, 15, 0.78)",
        borderColor: `${accent}80`,
        boxShadow: lit ? `0 0 20px ${accent}70, 0 0 4px ${accent}` : `0 0 16px ${accent}28`,
      }}
    >
      {children}
      {badge && <span className="jarvis-rail-badge" aria-hidden="true" />}
    </button>
  );
}

export default function ChatHud({
  micOn,
  onMicChange,
  onOrbState,
  onBusy,
  onVoiceEnergy,
  onVoicePhase,
  onVoicePermission,
  onTtsEngine,
  onVoiceArmed,
  onVoiceDebug,
  onChatMetrics,
}: Props) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [lang, setLang] = useState("en-US");
  const [hint, setHint] = useState<string | null>(null);
  const [srOk, setSrOk] = useState(false);
  const [voiceHold, setVoiceHold] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(false);
  const sendRef = useRef<(text: string, marks?: { commandFinal?: number }) => void>(() => {});
  const pendingSpeechRef = useRef("");
  const ttsRef = useRef<ReturnType<typeof useJarvisTts> | null>(null);

  const finishSpeak = useCallback(() => {
    const more = pendingSpeechRef.current.trim();
    const tts = ttsRef.current;
    if (more && tts) {
      pendingSpeechRef.current = "";
      void tts.speak(more);
      return;
    }
    onBusy(false);
    onOrbState("idle");
    setVoiceHold(false);
  }, [onBusy, onOrbState]);

  useEffect(() => {
    setSrOk(speechSupported());
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending, open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tts = useJarvisTts({
    onStart: () => onOrbState("speaking"),
    onEnd: finishSpeak,
    onBlocked: () =>
      setHint("Tap Replay to hear Jarvis — this browser blocked autoplay."),
    onError: () => setHint("Voice unavailable — the reply is still on screen."),
    onIntensity: onVoiceEnergy,
    onEngine: onTtsEngine,
  });
  ttsRef.current = tts;

  const send = useCallback(
    async (raw: string, marks?: { commandFinal?: number }) => {
      const rawText = raw.trim();
      const woken = matchWake(rawText);
      const text = woken.hit ? woken.command : rawText;
      if (!text || pendingRef.current || !ttsRef.current) return;
      pendingRef.current = true;
      setPending(true);
      setVoiceHold(true);
      onBusy(true);
      pendingSpeechRef.current = "";
      ttsRef.current?.prime();
      ttsRef.current?.interrupt();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      onOrbState("thinking");
      setDraft("");
      setHint(null);

      const user: Turn = { id: `u-${Date.now()}`, role: "user", content: text };
      const history = [...turns, user].slice(-16);
      const assistantId = `a-${Date.now()}`;
      setTurns(history);

      const requestStart = performance.now();
      const metrics: ChatMetrics = {
        command: text,
        commandFinal: marks?.commandFinal ?? requestStart,
        requestStart,
        firstResponse: null,
        responseComplete: null,
        ttsStart: null,
        model: "",
        provider: "",
      };
      onChatMetrics?.({ ...metrics });

      const speakStarted = { current: false };
      const startSpeech = (chunk: string) => {
        if (!ttsRef.current || ttsRef.current.isMuted || speakStarted.current || !chunk.trim()) return;
        speakStarted.current = true;
        metrics.ttsStart = performance.now();
        onChatMetrics?.({ ...metrics });
        void ttsRef.current.speak(chunk);
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            stream: true,
            messages: history.map((t) => ({ role: t.role, content: t.content })),
          }),
        });

        const ctype = res.headers.get("content-type") || "";
        if (!ctype.includes("text/event-stream")) {
          const data = (await res.json()) as { text?: string; error?: string; model?: string; provider?: string };
          if (!res.ok || !data.text) {
            const msg =
              res.status === 503
                ? "Jarvis brain is offline — add GEMINI_API_KEY or OPENAI_API_KEY on the server, then redeploy."
                : data.error || "Jarvis could not reply.";
            setTurns((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: msg }]);
            finishSpeak();
            setPending(false);
            pendingRef.current = false;
            return;
          }
          metrics.firstResponse = performance.now();
          metrics.responseComplete = metrics.firstResponse;
          metrics.model = data.model || "";
          metrics.provider = data.provider || "";
          setTurns((prev) => [...prev, { id: assistantId, role: "assistant", content: data.text ?? "" }]);
          setPending(false);
          pendingRef.current = false;
          onChatMetrics?.({ ...metrics });
          if (!ttsRef.current?.isMuted) startSpeech(data.text ?? "");
          else finishSpeak();
          return;
        }

        if (!res.body) throw new Error("empty stream");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        let visible = "";
        let rest = "";
        let lineBuf = "";

        const pushVisible = (next: string) => {
          visible = next;
          setTurns((prev) => {
            const without = prev.filter((t) => t.id !== assistantId);
            return [...without, { id: assistantId, role: "assistant", content: visible }];
          });
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          lineBuf += decoder.decode(value, { stream: true });
          const lines = lineBuf.split("\n");
          lineBuf = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload) continue;
            const event = JSON.parse(payload) as {
              type?: string;
              text?: string;
              model?: string;
              provider?: string;
              error?: string;
            };
            if (event.type === "meta") {
              metrics.model = event.model || "";
              metrics.provider = event.provider || "";
            } else if (event.type === "delta" && event.text) {
              if (metrics.firstResponse == null) {
                metrics.firstResponse = performance.now();
                onChatMetrics?.({ ...metrics });
              }
              acc += event.text;
              pushVisible(acc);
              rest += event.text;
              const { ready, leftover } = splitReady(rest, false);
              rest = leftover;
              for (const sentence of ready) {
                if (!speakStarted.current) startSpeech(sentence);
                else pendingSpeechRef.current = `${pendingSpeechRef.current} ${sentence}`.trim();
              }
            } else if (event.type === "done" && event.text) {
              acc = event.text;
              pushVisible(acc);
              metrics.responseComplete = performance.now();
              metrics.model = event.model || metrics.model;
              metrics.provider = event.provider || metrics.provider;
            } else if (event.type === "error") {
              throw new Error(event.error || "Chat failed.");
            }
          }
        }

        setPending(false);
        pendingRef.current = false;
        onChatMetrics?.({ ...metrics });
        const leftover = rest.trim();
        if (!ttsRef.current?.isMuted) {
          if (!speakStarted.current) startSpeech((leftover || acc).trim());
          else if (leftover) pendingSpeechRef.current = `${pendingSpeechRef.current} ${leftover}`.trim();
        } else {
          finishSpeak();
        }
      } catch {
        setTurns((prev) => [
          ...prev,
          { id: `e-${Date.now()}`, role: "assistant", content: "Network error — Jarvis is unreachable." },
        ]);
        finishSpeak();
        setPending(false);
        pendingRef.current = false;
      }
    },
    [turns, onBusy, onOrbState, finishSpeak, onChatMetrics],
  );

  sendRef.current = send;

  const voice = useJarvisVoice({
    manual: micOn,
    paused: pending || tts.isSpeaking || voiceHold || !srOk,
    commandLang: lang,
    onCommand: (text, marks) => sendRef.current(text, marks),
    onPhase: (p) => {
      onVoicePhase?.(p);
      if (pendingRef.current || ttsRef.current?.isSpeaking) return;
      if (p === "listening_for_command" || p === "waking") onOrbState("listening");
      else if (p === "listening_for_wake" || p === "standby") onOrbState("idle");
    },
    onDenied: (message) => setHint(message),
    onPermission: onVoicePermission,
    onReleaseManual: () => onMicChange(false),
    onDebug: onVoiceDebug,
  });

  useEffect(() => {
    onVoiceArmed?.(voice.armed);
  }, [onVoiceArmed, voice.armed]);

  useEffect(() => {
    if (micOn && !voice.supported) {
      setHint("This browser has no speech recognition — type instead. Chrome / Edge / Safari work best.");
    }
  }, [micOn, voice.supported]);

  const commandListen =
    !pending &&
    !tts.isSpeaking &&
    (voice.phase === "listening_for_command" || voice.phase === "waking");
  const statusLine =
    hint ||
    (voice.needsEnable
      ? "Voice ready — tap once to enable"
      : commandListen
        ? voice.interim || "Listening…"
        : "Enter to send");
  const showListenChip = commandListen && !open;
  const showEnableChip = voice.needsEnable && !open && !pending;

  return (
    <div
      className="jarvis-hud"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {open && (
        <div
          id="jarvis-chat-dock"
          role="dialog"
          aria-label="Jarvis chat"
          className="jarvis-dock"
        >
          <div
            style={{
              background: "rgba(4, 8, 15, 0.82)",
              border: `1px solid ${CYAN}33`,
              borderRadius: 16,
              boxShadow: `0 0 28px ${CYAN}14, 0 8px 28px rgba(0,0,0,0.45)`,
              backdropFilter: "blur(16px)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "inherit",
            }}
          >
            <div className="jarvis-dock-head">
              <span>COMMS</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="jarvis-dock-close"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {(turns.length > 0 || pending) && (
              <div
                ref={listRef}
                className="jarvis-hud-log"
                aria-live="polite"
                style={{
                  overflowY: "auto",
                  padding: "10px 12px 6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {turns.map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: t.role === "user" ? "flex-end" : "flex-start" }}>
                    <div
                      dir="auto"
                      style={{
                        maxWidth: "92%",
                        padding: "7px 11px",
                        borderRadius: t.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                        fontSize: 13,
                        lineHeight: 1.45,
                        color: t.role === "user" ? "#041018" : "rgba(240,237,232,0.92)",
                        background: t.role === "user" ? CYAN : "rgba(245,166,35,0.12)",
                        border: t.role === "user" ? "none" : `1px solid ${GOLD}44`,
                      }}
                    >
                      {t.content}
                    </div>
                  </div>
                ))}
                {pending && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: CYAN, opacity: 0.8 }}>
                    PROCESSING…
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                tts.prime();
                voice.unlock();
                send(draft || voice.interim);
              }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px 10px 12px" }}
            >
              <input
                ref={inputRef}
                value={draft || (commandListen ? voice.interim : "")}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={commandListen ? (voice.interim || "Listening…") : "Message Jarvis…"}
                aria-label="Message Jarvis"
                dir="auto"
                disabled={pending}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "rgba(8,16,28,0.65)",
                  border: `1px solid ${CYAN}2a`,
                  borderRadius: 10,
                  color: "#f0ede8",
                  fontSize: 14,
                  padding: "9px 12px",
                  outline: "none",
                }}
              />

              <button
                type="submit"
                disabled={pending || !(draft.trim() || voice.interim.trim())}
                aria-label="Send message"
                style={{
                  flex: "none",
                  background: GOLD,
                  color: "#1a1204",
                  border: "none",
                  borderRadius: 10,
                  padding: "9px 13px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.68rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: pending ? "wait" : "pointer",
                  opacity: pending || !(draft.trim() || voice.interim.trim()) ? 0.45 : 1,
                }}
              >
                Send
              </button>
            </form>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 12px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "rgba(240,237,232,0.4)",
              }}
            >
              <button
                type="button"
                onClick={() => setLang((l) => (l.startsWith("ar") ? "en-US" : "ar-SA"))}
                style={{
                  background: "none",
                  border: `1px solid ${CYAN}33`,
                  color: "inherit",
                  borderRadius: 999,
                  padding: "3px 8px",
                  cursor: "pointer",
                  letterSpacing: "0.14em",
                }}
              >
                {lang.startsWith("ar") ? "AR mic" : "EN mic"}
              </button>
              <button
                type="button"
                onClick={() => tts.setMuted(!tts.isMuted)}
                style={{
                  background: "none",
                  border: `1px solid ${GOLD}44`,
                  color: tts.isMuted ? "inherit" : GOLD,
                  borderRadius: 999,
                  padding: "3px 8px",
                  cursor: "pointer",
                }}
              >
                {tts.isMuted ? "Voice Off" : "Voice On"}
              </button>
              <button
                type="button"
                onClick={() => tts.stop()}
                disabled={!tts.isSpeaking}
                aria-label="Stop speaking"
                style={{
                  background: "none",
                  border: `1px solid ${CYAN}33`,
                  color: "inherit",
                  borderRadius: 999,
                  padding: "3px 8px",
                  cursor: tts.isSpeaking ? "pointer" : "default",
                  opacity: tts.isSpeaking ? 1 : 0.35,
                }}
              >
                Stop
              </button>
              <button
                type="button"
                onClick={() => {
                  tts.prime();
                  void tts.replay();
                }}
                disabled={!tts.hasLast || tts.isMuted}
                aria-label="Replay last reply"
                style={{
                  background: "none",
                  border: `1px solid ${CYAN}33`,
                  color: "inherit",
                  borderRadius: 999,
                  padding: "3px 8px",
                  cursor: tts.hasLast && !tts.isMuted ? "pointer" : "default",
                  opacity: tts.hasLast && !tts.isMuted ? 1 : 0.35,
                }}
              >
                Replay
              </button>
              <span style={{ marginLeft: "auto", textAlign: "right" }}>{statusLine}</span>
            </div>
          </div>
        </div>
      )}

      <div className="jarvis-rail" role="toolbar" aria-label="Jarvis voice and chat">
        <div className="jarvis-rail-slot">
          <RailBtn
            label={open ? "Close chat" : "Open chat"}
            expanded={open}
            controls={open ? "jarvis-chat-dock" : undefined}
            onClick={() => {
              tts.prime();
              voice.unlock();
              setOpen((v) => !v);
            }}
            badge={!open && (turns.length > 0 || pending)}
          >
            <MessageSquare size={20} strokeWidth={1.7} />
          </RailBtn>
        </div>

        <div className="jarvis-rail-slot">
          {showEnableChip && (
            <button
              type="button"
              className="jarvis-enable-chip"
              onClick={() => {
                tts.prime();
                voice.unlock();
              }}
            >
              Voice ready — tap once to enable
            </button>
          )}
          {showListenChip && (
            <div className="jarvis-listen-chip" aria-live="polite">
              {voice.interim || "Listening…"}
            </div>
          )}
          <RailBtn
            label={micOn ? "Disable microphone" : "Enable microphone"}
            pressed={micOn}
            onClick={() => {
              tts.prime();
              voice.unlock();
              onMicChange(!micOn);
            }}
          >
            {micOn ? <Mic size={20} strokeWidth={1.7} /> : <MicOff size={20} strokeWidth={1.7} />}
          </RailBtn>
        </div>
      </div>
    </div>
  );
}
