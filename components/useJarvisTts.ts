"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prepareSpeechText } from "@/lib/prepare-speech-text";

const MUTE_KEY = "jarvis-tts-muted";
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

function detectSpeakLang(text: string): "ar" | "en" {
  const ar = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  return ar > lat ? "ar" : "en";
}

function pickLocalVoice(text: string): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const lang = detectSpeakLang(text);
  if (lang === "ar") {
    return (
      voices.find((v) => v.lang.toLowerCase().startsWith("ar") && /male|google|microsoft/i.test(v.name)) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("ar"))
    );
  }
  return (
    voices.find((v) => /^en-US/i.test(v.lang) && /male|david|guy|google us/i.test(v.name)) ||
    voices.find((v) => /^en/i.test(v.lang))
  );
}

export type TtsEngine = "elevenlabs" | "local" | "none";

type Opts = {
  onStart?: () => void;
  onEnd?: () => void;
  onBlocked?: () => void;
  onError?: () => void;
  onIntensity?: (value: number) => void;
  onEngine?: (engine: TtsEngine) => void;
};

export function useJarvisTts(opts: Opts = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMutedState] = useState(false);
  const [hasLast, setHasLast] = useState(false);
  const [engine, setEngine] = useState<TtsEngine>("none");

  const mutedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);
  const lastTextRef = useRef<string | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const elDeadRef = useRef(false);
  const genRef = useRef(0);
  const primedRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pumpRef = useRef(0);
  const lastPushRef = useRef(0);

  const pushIntensity = useCallback((value: number) => {
    const now = performance.now();
    if (value > 0 && now - lastPushRef.current < 50) return;
    lastPushRef.current = now;
    optsRef.current.onIntensity?.(value);
  }, []);

  const stopPump = useCallback(() => {
    cancelAnimationFrame(pumpRef.current);
    pumpRef.current = 0;
    pushIntensity(0);
  }, [pushIntensity]);

  const pump = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
    pushIntensity(rms);
    pumpRef.current = requestAnimationFrame(pump);
  }, [pushIntensity]);

  const ensureGraph = useCallback(
    (audio: HTMLAudioElement) => {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        if (!ctxRef.current) ctxRef.current = new AC();
        if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
        if (!sourceRef.current) {
          sourceRef.current = ctxRef.current.createMediaElementSource(audio);
          analyserRef.current = ctxRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(ctxRef.current.destination);
        }
      } catch {
        /* element playback still works without analyser */
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const kick = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener("voiceschanged", kick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", kick);
  }, []);

  useEffect(() => {
    try {
      const muted = window.localStorage.getItem(MUTE_KEY) === "1";
      mutedRef.current = muted;
      setIsMutedState(muted);
    } catch {
      /* ignore */
    }
    return () => {
      genRef.current += 1;
      stopPump();
      const audio = audioRef.current;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute("src");
      }
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      if (lastUrlRef.current && lastUrlRef.current !== urlRef.current) {
        URL.revokeObjectURL(lastUrlRef.current);
      }
      try {
        window.speechSynthesis?.cancel();
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        void ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      sourceRef.current = null;
      analyserRef.current = null;
      ctxRef.current = null;
    };
  }, [stopPump]);

  const halt = useCallback(
    (emitEnd: boolean) => {
      genRef.current += 1;
      stopPump();
      const audio = audioRef.current;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.currentTime = 0;
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      utterRef.current = null;
      setIsSpeaking(false);
      if (emitEnd) optsRef.current.onEnd?.();
    },
    [stopPump],
  );

  const endPlayback = useCallback(
    (gen: number) => {
      if (gen !== genRef.current) return;
      stopPump();
      setIsSpeaking(false);
      optsRef.current.onEnd?.();
    },
    [stopPump],
  );

  const markEngine = useCallback((next: TtsEngine) => {
    setEngine(next);
    optsRef.current.onEngine?.(next);
  }, []);

  const speakLocal = useCallback(
    (text: string, gen: number, energetic = false) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        optsRef.current.onError?.();
        endPlayback(gen);
        return;
      }
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      const utter = new SpeechSynthesisUtterance(text);
      const lang = detectSpeakLang(text);
      utter.lang = lang === "ar" ? "ar-SA" : "en-US";
      const voice = pickLocalVoice(text);
      if (voice) utter.voice = voice;
      utter.rate = energetic ? 1.12 : 1.02;
      utter.pitch = energetic ? 1.18 : 1;
      utter.onend = () => {
        if (gen !== genRef.current) return;
        endPlayback(gen);
      };
      utter.onerror = () => {
        if (gen !== genRef.current) return;
        optsRef.current.onError?.();
        endPlayback(gen);
      };
      markEngine("local");
      utterRef.current = utter;
      const tick = () => {
        if (gen !== genRef.current) return;
        pushIntensity(0.18 + Math.random() * 0.22);
        pumpRef.current = requestAnimationFrame(tick);
      };
      pumpRef.current = requestAnimationFrame(tick);
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        optsRef.current.onError?.();
        endPlayback(gen);
      }
    },
    [endPlayback, markEngine, pushIntensity],
  );

  const stop = useCallback(() => halt(true), [halt]);

  const setMuted = useCallback(
    (muted: boolean) => {
      mutedRef.current = muted;
      setIsMutedState(muted);
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (muted) stop();
    },
    [stop],
  );

  const prime = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.speechSynthesis?.getVoices();
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.preload = "auto";
      if (ctxRef.current?.state === "suspended") void ctxRef.current.resume();
      if (primedRef.current) return;
      const ping = new Audio(SILENT_WAV);
      ping.volume = 0;
      void ping
        .play()
        .then(() => {
          primedRef.current = true;
          ping.pause();
        })
        .catch(() => {
          /* Replay remains available */
        });
    } catch {
      /* ignore */
    }
  }, []);

  const playUrl = useCallback(
    async (url: string, gen: number) => {
      if (typeof window === "undefined") return;
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      ensureGraph(audio);
      audio.src = url;
      audio.onended = () => endPlayback(gen);
      audio.onerror = () => {
        optsRef.current.onError?.();
        endPlayback(gen);
      };
      try {
        await audio.play();
        if (gen !== genRef.current) return;
        if (analyserRef.current) pump();
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError") {
          stopPump();
          setIsSpeaking(false);
          optsRef.current.onBlocked?.();
          optsRef.current.onEnd?.();
          return;
        }
        optsRef.current.onError?.();
        endPlayback(gen);
      }
    },
    [endPlayback, ensureGraph, pump, stopPump],
  );

  const speak = useCallback(
    async (raw: string, speakOpts?: { energetic?: boolean }) => {
      const energetic = Boolean(speakOpts?.energetic);
      const prepared = prepareSpeechText(raw);
      if (!prepared) {
        optsRef.current.onEnd?.();
        return;
      }
      if (mutedRef.current) {
        lastTextRef.current = prepared;
        setHasLast(true);
        return;
      }

      prime();

      if (prepared === lastTextRef.current && lastUrlRef.current) {
        halt(false);
        const gen = genRef.current;
        setIsSpeaking(true);
        optsRef.current.onStart?.();
        await playUrl(lastUrlRef.current, gen);
        return;
      }

      lastTextRef.current = prepared;
      setHasLast(true);
      halt(false);
      const gen = genRef.current;
      setIsSpeaking(true);
      optsRef.current.onStart?.();

      if (elDeadRef.current) {
        speakLocal(prepared, gen, energetic);
        return;
      }

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: prepared }),
          signal: AbortSignal.timeout(900),
        });
        if (gen !== genRef.current) return;
        if (!res.ok) {
          elDeadRef.current = true;
          speakLocal(prepared, gen, energetic);
          return;
        }
        const buf = await res.blob();
        if (gen !== genRef.current) return;
        if (!buf.size) {
          speakLocal(prepared, gen, energetic);
          return;
        }
        if (urlRef.current && urlRef.current !== lastUrlRef.current) {
          URL.revokeObjectURL(urlRef.current);
        }
        const url = URL.createObjectURL(buf);
        urlRef.current = url;
        lastUrlRef.current = url;
        markEngine("elevenlabs");
        await playUrl(url, gen);
      } catch {
        if (gen !== genRef.current) return;
        speakLocal(prepared, gen, energetic);
      }
    },
    [halt, markEngine, playUrl, prime, speakLocal],
  );

  const replay = useCallback(async () => {
    if (mutedRef.current) return;
    prime();
    const url = lastUrlRef.current;
    const text = lastTextRef.current;
    if (url) {
      halt(false);
      const gen = genRef.current;
      setIsSpeaking(true);
      optsRef.current.onStart?.();
      markEngine("elevenlabs");
      await playUrl(url, gen);
      return;
    }
    if (text) {
      halt(false);
      const gen = genRef.current;
      setIsSpeaking(true);
      optsRef.current.onStart?.();
      speakLocal(text, gen);
    }
  }, [halt, markEngine, playUrl, prime, speakLocal]);

  return {
    speak,
    stop,
    interrupt: () => halt(false),
    replay,
    prime,
    isSpeaking,
    isMuted,
    setMuted,
    hasLast,
    engine,
  };
}
