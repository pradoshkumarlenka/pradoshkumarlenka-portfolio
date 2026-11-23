"use client";

import { useRef, type ReactNode } from "react";

/**
 * Pulls its child slightly toward the cursor (max `max` px).
 * Inactive for touch input and for visitors who prefer reduced motion.
 */
export function Magnetic({ children, max = 6, strength = 0.25 }: { children: ReactNode; max?: number; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const clamp = (v: number) => Math.max(-max, Math.min(max, v));
    const x = clamp((e.clientX - (r.left + r.width / 2)) * strength);
    const y = clamp((e.clientY - (r.top + r.height / 2)) * strength);
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <span
      ref={ref}
      onPointerMove={move}
      onPointerLeave={reset}
      className="inline-block transition-transform duration-500 ease-premium"
    >
      {children}
    </span>
  );
}
