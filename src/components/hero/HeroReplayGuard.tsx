"use client";

import { useLayoutEffect } from "react";

/** True once the Hero intro has been seen during this page load. */
let played = false;

/** For client components that run their own intro (e.g. the TechText name). */
export const heroAlreadySeen = () => played;

/**
 * Plays the Hero entrance once per page load. Returning to the homepage via
 * in-site navigation shows the final state instantly (no replay).
 * Runs before paint, so there is no flash of the start state.
 */
export function HeroReplayGuard() {
  useLayoutEffect(() => {
    if (played) document.getElementById("hero")?.classList.add("hero-static");
    const mountedAt = performance.now();
    return () => {
      // Ignore React's instant dev-mode remount; only a real visit counts.
      if (performance.now() - mountedAt > 1500) played = true;
    };
  }, []);
  return null;
}
