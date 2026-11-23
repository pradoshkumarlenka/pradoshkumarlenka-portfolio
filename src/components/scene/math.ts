import { Vector3 } from "three";
import type { PlanetKey } from "./sceneConfig";

/** "#rrggbb" → Vector3 in 0–1 (display space, no colour-space conversion). */
export function rgb(hex: string): Vector3 {
  const value = parseInt(hex.replace("#", ""), 16);
  return new Vector3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/**
 * Position on a planet's path at scroll progress p. Pure function of p:
 * the same p always gives the same position, so scrolling back reverses
 * the motion exactly. Curves pass smoothly through every key.
 */
export function samplePath(keys: PlanetKey[], p: number, out: { x: number; y: number; z: number }) {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (keys.length === 1 || p <= first.p) {
    out.x = first.x;
    out.y = first.y;
    out.z = first.z;
    return out;
  }
  if (p >= last.p) {
    out.x = last.x;
    out.y = last.y;
    out.z = last.z;
    return out;
  }
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].p) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(keys.length - 1, i + 2)];
  const t = (p - k1.p) / (k2.p - k1.p);
  out.x = catmullRom(k0.x, k1.x, k2.x, k3.x, t);
  out.y = catmullRom(k0.y, k1.y, k2.y, k3.y, t);
  out.z = catmullRom(k0.z, k1.z, k2.z, k3.z, t);
  return out;
}

/** 0 → 1 → 0 visibility for planets that emerge from and sink into darkness. */
export function revealAt(reveal: { in: [number, number]; out?: [number, number] } | undefined, p: number) {
  if (!reveal) return 1;
  const fadeIn = smoothstep(reveal.in[0], reveal.in[1], p);
  const fadeOut = reveal.out ? 1 - smoothstep(reveal.out[0], reveal.out[1], p) : 1;
  return fadeIn * fadeOut;
}
