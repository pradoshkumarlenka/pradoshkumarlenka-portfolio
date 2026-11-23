"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { getLenis } from "@/lib/lenis";

/** Live media-query match (false during server render). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

/** Desktop, mouse/trackpad, full motion — where scroll-linked stacks run. */
export const SCROLL_STACK_QUERY = "(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

/**
 * FINITE SCROLL TRACK — shared by the Honours prism and the Beyond-the-Classroom stack.
 *
 * Layout contract: render `trackRef` on a wrapper holding (1) a CSS-sticky block
 * with `top: calc(50vh - halfHeight px)` and (2) a spacer of `spacerHeight`
 * pixels after it. While the block is held, page scroll maps to a progress
 * value v from 0 (first card) to count − 1 (last card); scrolling up reverses
 * it. Past either end the block simply scrolls on with the page (never traps).
 *
 * `onProgress(v)` should only write styles (no React state); the hook keeps the
 * rounded index in state for labels and buttons.
 */
export function useScrollTrack({
  count,
  stepPx,
  halfHeight,
  active,
  onProgress,
}: {
  count: number;
  stepPx: number;
  halfHeight: number;
  active: boolean;
  onProgress: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const progress = useRef(onProgress);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    progress.current = onProgress;
  });

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !active || count < 2) return;
    progress.current(0);
    // Measured from layout (offsetTop), not from the screen position, so a running
    // entrance animation (a translateY on an ancestor) cannot shift the start.
    const begin = () => {
      let y = 0;
      for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) y += node.offsetTop;
      return y - (innerHeight / 2 - halfHeight);
    };
    const st = ScrollTrigger.create({
      trigger: el,
      start: begin,
      end: () => begin() + (count - 1) * stepPx,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const v = self.progress * (count - 1);
        progress.current(v);
        setIndex(Math.round(v)); // React skips the render when the index is unchanged
      },
    });
    trigger.current = st;
    ScrollTrigger.refresh();
    return () => {
      st.kill(true);
      trigger.current = null;
      ScrollTrigger.refresh();
    };
  }, [active, count, stepPx, halfHeight]);

  /** Scroll the page to card i (buttons, arrow keys). */
  const go = (i: number) => {
    const st = trigger.current;
    if (!st || i < 0 || i >= count) return;
    const top = st.start + (i / (count - 1)) * (st.end - st.start);
    const lenis = getLenis();
    if (lenis) lenis.scrollTo(top, { duration: 0.9 });
    else window.scrollTo({ top, behavior: "smooth" });
  };

  return { trackRef, index, go, spacerHeight: (count - 1) * stepPx };
}
