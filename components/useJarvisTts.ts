"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prepareSpeechText } from "@/lib/prepare-speech-text";
import { WAKE_GREETING } from "@/lib/wake-phrase";

const MUTE_KEY = "jarvis-tts-muted";
const PCM_RATE = 16000;
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

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (!a.length) return b;
  if (!b.length) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function mergeChunks(chunks: Uint8Array[]): Uint8Array {
  let size = 0;
  for (const chunk of chunks) size += chunk.length;
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
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
  const lastTextRef = useRef<string | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const elDeadRef = useRef(false);
  const genRef = useRef(0);
  const endedGenRef = useRef(-1);
  const primedRef = useRef(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pumpRef = useRef(0);
  const lastPushRef = useRef(0);
  const watchRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pcmCache = useRef<Map<string, Uint8Array>>(new Map());
  const inflight = useRef<Map<string, Promise<Uint8Array | null>>>(new Map());

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

  const clearWatch = useCallback(() => {
    window.clearTimeout(watchRef.current);
    watchRef.current = 0;
  }, []);

  const ensureOut = useCallback((): AudioContext | null => {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      if (!ctxRef.current) ctxRef.current = new AC();
      if (!gainRef.current) {
        const gain = ctxRef.current.createGain();
        const analyser = ctxRef.current.createAnalyser();
        analyser.fftSize = 256;
        gain.connect(analyser);
        analyser.connect(ctxRef.current.destination);
        gainRef.current = gain;
        analyserRef.current = analyser;
      }
      if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const kick = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener("voiceschanged", kick);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", kick);
  }, []);

  const halt = useCallback(
    (emitEnd: boolean) => {
      genRef.current += 1;
      clearWatch();
      abortRef.current?.abort();
      abortRef.current = null;
      stopPump();
      for (const src of sourcesRef.current) {
        try {
          src.onended = null;
          src.stop();
        } catch {
          /* already stopped */
        }
      }
      sourcesRef.current = [];
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      utterRef.current = null;
      setIsSpeaking(false);
      if (emitEnd) optsRef.current.onEnd?.();
    },
    [clearWatch, stopPump],
  );

  const endPlayback = useCallback(
    (gen: number) => {
      if (gen !== genRef.current || endedGenRef.current === gen) return;
      endedGenRef.current = gen;
      clearWatch();
      stopPump();
      setIsSpeaking(false);
      optsRef.current.onEnd?.();
    },
    [clearWatch, stopPump],
  );

  const markEngine = useCallback((next: TtsEngine) => {
    setEngine(next);
    optsRef.current.onEngine?.(next);
  }, []);

  const armWatch = useCallback(
    (gen: number, ctx: AudioContext, audioEnd: number) => {
      clearWatch();
      const ms = Math.max(500, (audioEnd - ctx.currentTime) * 1000 + 700);
      watchRef.current = window.setTimeout(() => endPlayback(gen), ms);
    },
    [clearWatch, endPlayback],
  );

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
      utter.rate = energetic ? 1.12 : 1.05;
      utter.pitch = energetic ? 1.12 : 1;
      utter.onend = () => endPlayback(gen);
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
      const guess = Math.min(8000, 500 + text.length * 55);
      watchRef.current = window.setTimeout(() => endPlayback(gen), guess);
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        optsRef.current.onError?.();
        endPlayback(gen);
      }
    },
    [endPlayback, markEngine, pushIntensity],
  );

  const stopSources = useCallback(() => {
    for (const src of sourcesRef.current) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        /* ignore */
      }
    }
    sourcesRef.current = [];
  }, []);

  const openPcmPlayer = useCallback(
    (gen: number) => {
      const ctx = ensureOut();
      const gain = gainRef.current;
      if (!ctx || !gain) return null;
      stopSources();
      let leftover: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
      let next = ctx.currentTime + 0.015;
      let playing = 0;
      let streamDone = false;
      let started = false;
      let cancelled = false;

      const maybeEnd = () => {
        if (cancelled || gen !== genRef.current) return;
        if (streamDone && started && playing <= 0) endPlayback(gen);
      };

      const schedule = (even: Uint8Array<ArrayBufferLike>) => {
        if (cancelled || gen !== genRef.current || even.length < 2) return;
        const view = new DataView(even.buffer, even.byteOffset, even.byteLength);
        const samples = Math.floor(view.byteLength / 2);
        if (!samples) return;
        const floats = new Float32Array(samples);
        for (let i = 0; i < samples; i++) floats[i] = view.getInt16(i * 2, true) / 32768;
        const buffer = ctx.createBuffer(1, floats.length, PCM_RATE);
        buffer.copyToChannel(floats, 0);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(gain);
        const startAt = Math.max(next, ctx.currentTime + 0.005);
        try {
          src.start(startAt);
        } catch {
          return;
        }
        next = startAt + buffer.duration;
        playing += 1;
        sourcesRef.current.push(src);
        if (!started) {
          started = true;
          if (!pumpRef.current) pump();
        }
        armWatch(gen, ctx, next);
        src.onended = () => {
          playing -= 1;
          maybeEnd();
        };
      };

      const push = (chunk: Uint8Array<ArrayBufferLike>, flush = false) => {
        if (cancelled || !chunk.length && !flush) return;
        const merged = concatBytes(leftover, chunk);
        const evenLen = merged.length - (merged.length % 2);
        if (evenLen >= 2 && (flush || evenLen >= 320)) {
          schedule(merged.subarray(0, evenLen));
          leftover = merged.subarray(evenLen);
        } else {
          leftover = merged;
        }
      };

      return {
        push: (chunk: Uint8Array<ArrayBufferLike>) => push(chunk, false),
        finish: () => {
          if (cancelled) return;
          push(new Uint8Array(0), true);
          streamDone = true;
          maybeEnd();
        },
        cancel: () => {
          cancelled = true;
          stopSources();
        },
        started: () => started,
      };
    },
    [armWatch, endPlayback, ensureOut, pump, stopSources],
  );

  const playPcm = useCallback(
    (bytes: Uint8Array, gen: number) => {
      const player = openPcmPlayer(gen);
      if (!player) {
        optsRef.current.onError?.();
        endPlayback(gen);
        return;
      }
      player.push(bytes);
      player.finish();
      if (!player.started()) {
        optsRef.current.onError?.();
        endPlayback(gen);
      }
    },
    [endPlayback, openPcmPlayer],
  );

  const fetchPcm = useCallback(async (text: string, signal: AbortSignal): Promise<Uint8Array | null> => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/octet-stream" },
      body: JSON.stringify({ text }),
      signal,
    });
    if (res.status === 503 || res.status === 401) {
      elDeadRef.current = true;
      return null;
    }
    if (!res.ok || !res.body) throw new Error(`tts ${res.status}`);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let slow: number | undefined;
    try {
      const first = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          slow = window.setTimeout(() => reject(new Error("tts slow")), 4000);
        }),
      ]);
      if (first.value?.byteLength) chunks.push(first.value.slice());
      if (!first.done) {
        while (true) {
          const part = await reader.read();
          if (part.value?.byteLength) chunks.push(part.value.slice());
          if (part.done) break;
        }
      }
    } finally {
      if (slow) window.clearTimeout(slow);
      if (signal.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
      }
    }
    if (!chunks.length) return null;
    return mergeChunks(chunks);
  }, []);

  const prefetch = useCallback(
    (raw: string) => {
      const text = prepareSpeechText(raw);
      if (!text || elDeadRef.current || pcmCache.current.has(text) || inflight.current.has(text)) return;
      const ctrl = new AbortController();
      const job = fetchPcm(text, ctrl.signal)
        .then((buf) => {
          if (buf?.length) pcmCache.current.set(text, buf);
          return buf;
        })
        .catch(() => null)
        .finally(() => {
          inflight.current.delete(text);
        });
      inflight.current.set(text, job);
    },
    [fetchPcm],
  );

  useEffect(() => {
    try {
      const muted = window.localStorage.getItem(MUTE_KEY) === "1";
      mutedRef.current = muted;
      setIsMutedState(muted);
    } catch {
      /* ignore */
    }
    prefetch(WAKE_GREETING);
    return () => {
      genRef.current += 1;
      clearWatch();
      abortRef.current?.abort();
      stopPump();
      stopSources();
      try {
        window.speechSynthesis?.cancel();
        void ctxRef.current?.close();
      } catch {
        /* ignore */
      }
      ctxRef.current = null;
      gainRef.current = null;
      analyserRef.current = null;
    };
  }, [clearWatch, prefetch, stopPump, stopSources]);

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
      ensureOut();
      prefetch(WAKE_GREETING);
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
  }, [ensureOut, prefetch]);

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
      halt(false);
      const gen = genRef.current;
      setIsSpeaking(true);
      optsRef.current.onStart?.();
      lastTextRef.current = prepared;
      setHasLast(true);

      const cached = pcmCache.current.get(prepared);
      if (cached?.length) {
        markEngine("elevenlabs");
        playPcm(cached, gen);
        return;
      }

      if (elDeadRef.current) {
        speakLocal(prepared, gen, energetic);
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const player = openPcmPlayer(gen);
      if (!player) {
        speakLocal(prepared, gen, energetic);
        return;
      }
      let slow = 0;
      try {
        slow = window.setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/octet-stream" },
          body: JSON.stringify({ text: prepared }),
          signal: ctrl.signal,
        });
        if (gen !== genRef.current) {
          player.cancel();
          return;
        }
        if (res.status === 503 || res.status === 401) elDeadRef.current = true;
        if (!res.ok || !res.body) {
          player.cancel();
          speakLocal(prepared, gen, energetic);
          return;
        }
        const reader = res.body.getReader();
        const collected: Uint8Array[] = [];
        while (true) {
          const part = await reader.read();
          if (gen !== genRef.current) {
            player.cancel();
            return;
          }
          if (part.value?.byteLength) {
            if (slow) {
              window.clearTimeout(slow);
              slow = 0;
            }
            const copy = part.value.slice();
            collected.push(copy);
            if (!player.started()) markEngine("elevenlabs");
            player.push(copy);
          }
          if (part.done) break;
        }
        player.finish();
        if (!player.started()) {
          player.cancel();
          speakLocal(prepared, gen, energetic);
          return;
        }
        const merged = mergeChunks(collected);
        if (merged.length) {
          pcmCache.current.set(prepared, merged);
          if (pcmCache.current.size > 8) {
            const oldest = pcmCache.current.keys().next().value;
            if (oldest && oldest !== prepared) pcmCache.current.delete(oldest);
          }
        }
      } catch {
        if (gen !== genRef.current) return;
        if (player.started()) {
          player.finish();
          return;
        }
        player.cancel();
        speakLocal(prepared, gen, energetic);
      } finally {
        if (slow) window.clearTimeout(slow);
      }
    },
    [halt, markEngine, openPcmPlayer, playPcm, prime, speakLocal],
  );

  const replay = useCallback(async () => {
    if (mutedRef.current) return;
    prime();
    const text = lastTextRef.current;
    if (!text) return;
    const cached = pcmCache.current.get(text);
    halt(false);
    const gen = genRef.current;
    setIsSpeaking(true);
    optsRef.current.onStart?.();
    if (cached?.length) {
      markEngine("elevenlabs");
      playPcm(cached, gen);
      return;
    }
    speakLocal(text, gen);
  }, [halt, markEngine, playPcm, prime, speakLocal]);

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
