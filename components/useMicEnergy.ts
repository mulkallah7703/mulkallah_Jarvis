"use client";

import { useEffect, useRef, useState } from "react";

/** Returns smoothed 0..1 mic level when `enabled`. */
export function useMicEnergy(enabled: boolean) {
  const [energy, setEnergy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setEnergy(0);
      return;
    }
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let alive = true;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const loop = () => {
          if (!alive) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setEnergy((prev) => prev * 0.7 + Math.min(1, rms * 4) * 0.3);
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        setError(e instanceof Error ? e.message : "mic denied");
        setEnergy(0);
      }
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf.current);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
    };
  }, [enabled]);

  return { energy, error };
}
