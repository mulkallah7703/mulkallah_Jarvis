"use client";

/**
 * Center Jarvis hologram — the provided particle-portrait artwork
 * (`/jarvis-hologram.png`), not the old procedural Three.js bust.
 * Modes from chat + mic only change glow / pulse intensity.
 * Full 1672×941 canvas (object-fit: contain) — no head-only crop.
 */

export type HologramMode = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  mode?: HologramMode;
  /** 0..1 mic / voice energy */
  energy?: number;
  className?: string;
};

export default function JarvisHologram({
  mode = "idle",
  energy = 0,
  className,
}: Props) {
  const e = Math.min(1, Math.max(0, energy));

  return (
    <div
      className={["jarvis-holo", `jarvis-holo--${mode}`, className].filter(Boolean).join(" ")}
      style={{ ["--holo-energy" as string]: String(e) }}
      data-mode={mode}
      aria-hidden
    >
      <div className="jarvis-holo-bloom" />
      {/* Static asset from public/ — served as /jarvis-hologram.png */}
      <img
        className="jarvis-holo-art"
        src="/jarvis-hologram.png"
        alt=""
        width={1672}
        height={941}
        draggable={false}
      />
      <div className="jarvis-holo-scan" />
    </div>
  );
}
