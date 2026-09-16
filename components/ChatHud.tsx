"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OrbState } from "./ApexHeroOrb";
import { speakText, speechSupported, useSpeechInput } from "./useSpeechInput";

const CYAN = "#00e5ff";
const GOLD = "#f5a623";

type Turn = { id: string; role: "user" | "assistant"; content: string };

type Props = {
  micOn: boolean;
  onMicChange: (on: boolean) => void;
  onOrbState: (s: OrbState) => void;
  onBusy: (busy: boolean) => void;
};

export default function ChatHud({ micOn, onMicChange, onOrbState, onBusy }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [voiceOut, setVoiceOut] = useState(true);
  const [lang, setLang] = useState("en-US");
  const [hint, setHint] = useState<string | null>(null);
  const [srOk, setSrOk] = useState(false);
  const [muteMic, setMuteMic] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const speakStop = useRef<(() => void) | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    setSrOk(speechSupported());
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  const finishSpeak = useCallback(() => {
    speakStop.current = null;
    onBusy(false);
    onOrbState("idle");
    window.setTimeout(() => setMuteMic(false), 450);
  }, [onBusy, onOrbState]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      setMuteMic(true);
      onBusy(true);
      speakStop.current?.();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      onOrbState("thinking");
      setDraft("");
      setHint(null);

      const user: Turn = { id: `u-${Date.now()}`, role: "user", content: text };
      const history = [...turns, user].slice(-16);
      setTurns(history);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((t) => ({ role: t.role, content: t.content })),
          }),
        });
        const data = (await res.json()) as { text?: string; error?: string };
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

        const reply = data.text;
        setTurns((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: reply }]);
        setPending(false);
        pendingRef.current = false;

        if (voiceOut) {
          speakStop.current = speakText(reply, lang, () => onOrbState("speaking"), finishSpeak);
        } else {
          onOrbState("speaking");
          window.setTimeout(finishSpeak, Math.min(2200, 600 + reply.length * 18));
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
    [turns, onBusy, onOrbState, voiceOut, lang, finishSpeak],
  );

  sendRef.current = send;

  const { supported, interim, error: srError } = useSpeechInput(
    micOn,
    pending || muteMic || !srOk,
    lang,
    (text) => sendRef.current(text),
  );

  useEffect(() => {
    if (micOn && !supported) {
      setHint("This browser has no speech recognition — type instead. Chrome / Edge / Safari work best.");
    }
  }, [micOn, supported]);

  return (
    <div
      className="jarvis-hud"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: "50%",
        bottom: 108,
        transform: "translateX(-50%)",
        width: "min(560px, 94vw)",
        zIndex: 22,
        pointerEvents: "auto",
        userSelect: "text",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "rgba(4, 8, 15, 0.72)",
          border: `1px solid ${CYAN}33`,
          borderRadius: 16,
          boxShadow: `0 0 28px ${CYAN}14, 0 8px 28px rgba(0,0,0,0.45)`,
          backdropFilter: "blur(16px)",
          overflow: "hidden",
        }}
      >
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
            send(draft || interim);
          }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 10px 10px 12px" }}
        >
          <button
            type="button"
            aria-pressed={micOn}
            aria-label={micOn ? "Disable microphone" : "Enable microphone"}
            onClick={() => onMicChange(!micOn)}
            style={{
              flex: "none",
              fontFamily: "var(--font-mono)",
              fontSize: "0.62rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: micOn ? "#041018" : "rgba(240,237,232,0.85)",
              background: micOn ? CYAN : "rgba(4,8,15,0.55)",
              border: `1px solid ${CYAN}73`,
              borderRadius: 999,
              padding: "8px 11px",
              cursor: "pointer",
            }}
          >
            {micOn ? "Mic on" : "Mic"}
          </button>

          <input
            value={draft || (micOn ? interim : "")}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={micOn ? (interim || "Listening…") : "Message Jarvis…"}
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
            disabled={pending || !(draft.trim() || interim.trim())}
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
              opacity: pending || !(draft.trim() || interim.trim()) ? 0.45 : 1,
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
            onClick={() => setVoiceOut((v) => !v)}
            style={{
              background: "none",
              border: `1px solid ${GOLD}44`,
              color: voiceOut ? GOLD : "inherit",
              borderRadius: 999,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            {voiceOut ? "Voice replies on" : "Voice replies off"}
          </button>
          <span style={{ marginLeft: "auto" }}>{srError || hint || (micOn ? "Speak now" : "Enter to send")}</span>
        </div>
      </div>
    </div>
  );
}
