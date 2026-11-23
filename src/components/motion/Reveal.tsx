"use client";

import AnimatedContent, { type AnimatedContentProps } from "@/components/reactbits/AnimatedContent";
import { useAnimationConfig } from "@/lib/content/client";

/**
 * Site-wide scroll reveal: React Bits AnimatedContent with the site's
 * restrained defaults (short rise, light blur, premium ease, plays once).
 * Defaults come from src/lib/animation/config.ts (reveal.base); change them
 * there to retune every section at once.
 * Not used in the Hero, which has its own entrance.
 */
export function Reveal(props: AnimatedContentProps) {
  const { distance, duration, ease, blur, threshold } = useAnimationConfig().reveal.base;
  return <AnimatedContent distance={distance} duration={duration} ease={ease} blur={blur} threshold={threshold} once {...props} />;
}
