import type Lenis from "lenis";

/**
 * Shared handle to the single Lenis instance created by <SmoothScroll />.
 * It is null when reduced motion is on (native scrolling is used instead).
 */
let instance: Lenis | null = null;

export const setLenis = (lenis: Lenis | null) => {
  instance = lenis;
};

export const getLenis = () => instance;

/** Scrolls to a section id (or the top) using Lenis when available. */
export function scrollToTarget(target: string | 0) {
  const lenis = getLenis();
  if (target === 0) {
    if (lenis) lenis.scrollTo(0);
    else window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const el = document.getElementById(target);
  if (!el) return;
  // Lenis honours each section's CSS scroll-margin-top (nav height + gap), so no extra offset.
  if (lenis) lenis.scrollTo(el);
  else el.scrollIntoView({ behavior: "smooth", block: "start" });
}
