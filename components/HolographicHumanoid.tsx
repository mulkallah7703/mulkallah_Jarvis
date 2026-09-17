"use client";

/**
 * Custom holographic particle humanoid for Mulkallah Jarvis.
 * Inspired by the Apex/Astra reel look: blue particle bust + orange energy core.
 * Mic level drives glow/energy. No paid kit — original procedural geometry.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type HumanoidMode = "idle" | "listening" | "thinking" | "speaking";

type Props = {
  mode?: HumanoidMode;
  /** 0..1 mic / voice energy */
  energy?: number;
  className?: string;
};

function sampleBust(count: number, rng: () => number): Float32Array {
  const pos = new Float32Array(count * 3);
  let i = 0;
  while (i < count) {
    const layer = rng();
    let x = 0, y = 0, z = 0, keep = false;

    if (layer < 0.42) {
      // head ellipsoid
      const u = rng() * Math.PI * 2;
      const v = Math.acos(2 * rng() - 1);
      const r = 0.55 + rng() * 0.08;
      x = r * Math.sin(v) * Math.cos(u) * 0.72;
      y = r * Math.cos(v) * 0.95 + 0.55;
      z = r * Math.sin(v) * Math.sin(u) * 0.62;
      keep = y > 0.12;
    } else if (layer < 0.55) {
      // neck
      const u = rng() * Math.PI * 2;
      const h = rng();
      const r = 0.16 + rng() * 0.04;
      x = r * Math.cos(u);
      y = 0.05 + h * 0.22;
      z = r * Math.sin(u) * 0.85;
      keep = true;
    } else if (layer < 0.82) {
      // shoulders / upper torso
      const u = rng() * Math.PI * 2;
      const h = rng();
      const shoulder = 0.55 + h * 0.55;
      const r = shoulder * (0.55 + rng() * 0.35);
      x = r * Math.cos(u);
      y = -0.05 - h * 0.95;
      z = r * Math.sin(u) * 0.35;
      keep = Math.abs(x) < 1.15 && y > -1.15;
    } else {
      // chest core cloud denser in center
      const u = rng() * Math.PI * 2;
      const h = rng();
      const r = rng() * 0.35;
      x = r * Math.cos(u);
      y = -0.15 - h * 0.55;
      z = r * Math.sin(u) * 0.4;
      keep = true;
    }

    if (!keep) continue;
    // soft silhouette trim
    if (x * x + (y - 0.1) * (y - 0.1) * 0.55 + z * z > 1.55) continue;

    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
    i++;
  }
  return pos;
}

function sampleCore(count: number, rng: () => number): Float32Array {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rng() * Math.PI * 2;
    const v = Math.acos(2 * rng() - 1);
    const r = Math.pow(rng(), 0.55) * 0.22;
    pos[i * 3] = r * Math.sin(v) * Math.cos(u);
    pos[i * 3 + 1] = 0.58 + r * Math.cos(v) * 0.7;
    pos[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
  }
  return pos;
}

export default function HolographicHumanoid({
  mode = "idle",
  energy = 0,
  className,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  const energyRef = useRef(energy);
  modeRef.current = mode;
  energyRef.current = energy;

  const seed = useMemo(() => 7703, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let alive = true;
    let raf = 0;
    // deterministic-ish RNG
    let s = seed >>> 0;
    const rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };

    const w = mount.clientWidth || 600;
    const h = mount.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 0.15, 4.2);

    const bodyCount = 14000;
    const coreCount = 2200;
    const bodyPos = sampleBust(bodyCount, rng);
    const corePos = sampleCore(coreCount, rng);

    const bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute("position", new THREE.BufferAttribute(bodyPos, 3));
    const bodyMat = new THREE.PointsMaterial({
      size: 0.018,
      color: new THREE.Color("#1ec8ff"),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const body = new THREE.Points(bodyGeo, bodyMat);
    scene.add(body);

    const coreGeo = new THREE.BufferGeometry();
    coreGeo.setAttribute("position", new THREE.BufferAttribute(corePos, 3));
    const coreMat = new THREE.PointsMaterial({
      size: 0.028,
      color: new THREE.Color("#ff7a18"),
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const core = new THREE.Points(coreGeo, coreMat);
    scene.add(core);

    // soft outer halo ring
    const ringGeo = new THREE.RingGeometry(1.15, 1.22, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: "#1ec8ff",
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.4;
    ring.position.y = -0.55;
    scene.add(ring);

    const group = new THREE.Group();
    group.add(body);
    group.add(core);
    scene.add(group);

    const baseBody = bodyPos.slice();
    const baseCore = corePos.slice();
    const clock = new THREE.Clock();

    const onResize = () => {
      if (!mount) return;
      const nw = mount.clientWidth || 600;
      const nh = mount.clientHeight || 600;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    const tick = () => {
      if (!alive) return;
      const t = clock.getElapsedTime();
      const m = modeRef.current;
      const e = Math.min(1, Math.max(0, energyRef.current));

      const breathe = 1 + Math.sin(t * 1.6) * 0.015;
      const listenBoost = m === "listening" ? 1.04 + e * 0.08 : 1;
      const speakBoost = m === "speaking" ? 1.06 + e * 0.12 : 1;
      const thinkSpin = m === "thinking" ? 0.55 : 0.18;

      group.rotation.y = Math.sin(t * thinkSpin) * 0.18 + t * 0.05;
      group.scale.setScalar(breathe * listenBoost * (m === "speaking" ? speakBoost : 1));

      // displace body points slightly for living hologram
      const bp = bodyGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < bodyCount; i++) {
        const ix = i * 3;
        const bx = baseBody[ix], by = baseBody[ix + 1], bz = baseBody[ix + 2];
        const n = Math.sin(t * 2.2 + bx * 8 + by * 6) * 0.008;
        const pulse = m === "speaking" ? e * 0.035 * Math.sin(t * 18 + i) : 0;
        bp.setXYZ(ix / 3, bx + n + pulse * bx, by + Math.sin(t * 1.3 + i) * 0.004, bz + n * 0.6);
      }
      bp.needsUpdate = true;

      const cp = coreGeo.getAttribute("position") as THREE.BufferAttribute;
      const corePulse = 1 + (m === "speaking" || m === "listening" ? e * 0.35 : 0.08) + Math.sin(t * 4) * 0.04;
      for (let i = 0; i < coreCount; i++) {
        const ix = i * 3;
        cp.setXYZ(
          i,
          baseCore[ix] * corePulse,
          baseCore[ix + 1] + (corePulse - 1) * 0.15,
          baseCore[ix + 2] * corePulse
        );
      }
      cp.needsUpdate = true;

      bodyMat.opacity = 0.7 + (m === "thinking" ? 0.15 : 0) + e * 0.15;
      coreMat.opacity = 0.75 + e * 0.25;
      coreMat.size = 0.024 + e * 0.02;
      ringMat.opacity = 0.12 + e * 0.2;

      // color shift by mode
      if (m === "thinking") bodyMat.color.set("#5ad0ff");
      else if (m === "speaking") bodyMat.color.set("#2cf0ff");
      else bodyMat.color.set("#1ec8ff");

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      bodyGeo.dispose();
      coreGeo.dispose();
      bodyMat.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [seed]);

  return (
    <div
      className={className}
      ref={mountRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
      aria-hidden
    />
  );
}
