"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { setLenis } from "@/lib/lenis";
import { useAnimationConfig } from "@/lib/content/client";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in
 * sync. Disabled entirely when the visitor prefers reduced motion.
 */
export function SmoothScroll() {
  const reducedMotion = useReducedMotion();
  const lerp = useAnimationConfig().global.smoothScrollLerp;

  useEffect(() => {
    if (reducedMotion) return;

    const lenis = new Lenis({ lerp, smoothWheel: true, autoRaf: false });
    setLenis(lenis);

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Arriving with a hash (e.g. /#experience from a project page).
    if (window.location.hash) {
      const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (el) lenis.scrollTo(el, { immediate: true }); // uses CSS scroll-margin-top
    }

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      setLenis(null);
    };
  }, [reducedMotion, lerp]);

  return null;
}
