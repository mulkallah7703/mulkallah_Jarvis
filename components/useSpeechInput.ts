"use client";

import { useEffect, useRef, useState } from "react";

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
  onend: (() => void) | null;
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

export function speechSupported(): boolean {
  return Boolean(getCtor());
}

/**
 * Web Speech API capture while `enabled`. Paused while `paused` (TTS / in-flight chat)
 * so Jarvis does not hear himself.
 */
export function useSpeechInput(
  enabled: boolean,
  paused: boolean,
  lang: string,
  onFinal: (text: string) => void,
) {
  const [supported, setSupported] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const recRef = useRef<SpeechRec | null>(null);
  const wantRef = useRef(false);

  useEffect(() => {
    setSupported(Boolean(getCtor()));
  }, []);

  useEffect(() => {
    wantRef.current = enabled && !paused;
    const Ctor = getCtor();
    if (!Ctor) return;

    if (!wantRef.current) {
      setInterim("");
      try {
        recRef.current?.abort();
      } catch {
        /* already stopped */
      }
      recRef.current = null;
      return;
    }

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let finals = "";
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0]?.transcript ?? "";
        if (ev.results[i].isFinal) finals += piece;
        else live += piece;
      }
      const trimmed = finals.trim();
      if (trimmed) {
        setInterim("");
        onFinalRef.current(trimmed);
      } else {
        setInterim(live);
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed") setError("mic permission denied");
      else if (ev.error === "no-speech" || ev.error === "aborted") return;
      else setError(ev.error);
    };
    rec.onend = () => {
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          /* Chrome throws if start() races */
        }
      }
    };

    recRef.current = rec;
    setError(null);
    try {
      rec.start();
    } catch {
      /* already started */
    }

    return () => {
      wantRef.current = false;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      if (recRef.current === rec) recRef.current = null;
    };
  }, [enabled, paused, lang]);

  return { supported, interim, error };
}

export function speakText(
  text: string,
  lang: string,
  onStart: () => void,
  onEnd: () => void,
): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onStart();
    const t = window.setTimeout(onEnd, Math.min(3500, 700 + text.length * 35));
    return () => window.clearTimeout(t);
  }

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const isAr = /[\u0600-\u06FF]/.test(text) || lang.startsWith("ar");
  u.lang = isAr ? "ar-SA" : lang || "en-US";
  u.rate = 1.02;
  const pick = () => {
    const voices = window.speechSynthesis.getVoices();
    const prefix = isAr ? "ar" : u.lang.slice(0, 2);
    const voice =
      voices.find((v) => v.lang.toLowerCase().startsWith(prefix) && v.default) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (voice) u.voice = voice;
  };
  pick();
  if (!u.voice) {
    window.speechSynthesis.addEventListener("voiceschanged", pick, { once: true });
  }
  u.onstart = onStart;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
  // Some browsers fire onstart late; kick the visual immediately.
  onStart();
  return () => {
    u.onend = null;
    u.onerror = null;
    window.speechSynthesis.cancel();
  };
}
