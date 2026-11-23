"use client";

import Link from "next/link";
import { useRef } from "react";
import { ProjectImage } from "@/components/ui/ProjectImage";

const MAX_TILT = 5; // degrees

/**
 * The featured research picture (decorative artwork, not data). It links to the
 * research note and, for mouse users with full motion, tilts gently and catches
 * a soft light that follows the cursor. Nothing on it implies data values.
 */
export function ResearchVisual({ src, alt, position, href, label }: { src: string; alt: string; position?: string; href: string; label: string }) {
  const card = useRef<HTMLDivElement>(null);
  const live = () => matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches;

  const move = (e: React.PointerEvent) => {
    const el = card.current;
    if (!el || e.pointerType !== "mouse" || !live()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width; // 0 → 1
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * MAX_TILT * 2}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * MAX_TILT * 2}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const reset = () => {
    const el = card.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <Link href={href} aria-label={label} onPointerMove={move} onPointerLeave={reset} className="research-visual group mb-6 block rounded-card [perspective:900px]">
      <div ref={card} className="research-visual-card relative rounded-card">
        <ProjectImage src={src} alt={alt} position={position} sizes="(min-width: 1024px) 520px, 90vw" className="rounded-card border border-line transition-colors duration-300 group-hover:border-violet/55 group-focus-visible:border-violet/55" />
        <span aria-hidden="true" className="research-visual-light pointer-events-none absolute inset-0 rounded-card" />
      </div>
    </Link>
  );
}
