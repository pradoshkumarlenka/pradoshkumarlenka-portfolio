"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import TechText from "@/components/reactbits/TechText";
import { heroAlreadySeen } from "./HeroReplayGuard";
import { useAnimationConfig } from "@/lib/content/client";

const MAX_SIZE = 104; // px, desktop cap (≈ previous 6.4rem)
const LINE_HEIGHT = 1.18; // canvas height per line, × font size (room for the selection frame)
const LETTER_SPACING = -0.01; // em
const INSET = 0.05; // TechText insets left-aligned text by 5% of its width
/**
 * The text name is revealed 0.25 s after the first paint (CSS). If scripts take over
 * within this much of the first paint, the text has not shown yet and the original
 * canvas draw-in plays; otherwise the canvas silently replaces the visible text.
 */
const INTRO_WITHIN_MS_OF_PAINT = 200;
/** In intro mode, fall back to the text name if the canvas has drawn nothing by then. */
const INTRO_WATCHDOG_MS = 1500;

type Mode = "pending" | "intro" | "static" | "painted";

/** Tells the 3D background the name is on screen, so it can start loading (once per page load). */
function announceReady() {
  const w = window as Window & { __heroNameReady?: boolean };
  if (w.__heroNameReady) return;
  w.__heroNameReady = true;
  window.dispatchEvent(new Event("hero-name-ready"));
}

/**
 * The Hero name — progressive enhancement:
 *  1. A plain-text name is in the server HTML (same font, size, colour). It needs
 *     no JavaScript or WebGL: CSS reveals it 0.25 s after the first paint (instantly
 *     with reduced motion), so the name always appears quickly, even on slow phones or if
 *     scripts fail. It also gives the block its final height (no layout shift).
 *  2. The React Bits TechText canvases take over:
 *     - fast load (interactive within INTRO_WITHIN_MS_OF_PAINT of the first paint): the original draw-in plays
 *       and the text name never shows;
 *     - otherwise: the canvas draws the final name invisibly, then replaces the
 *       text name in the same frame (identical appearance, no flicker).
 * Decorative: the <h1> carries the real text for assistive technology.
 */
export function HeroName({ firstNames, lastName }: { firstNames: string; lastName: string }) {
  const introDuration = useAnimationConfig().hero.nameIntroSeconds;
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("pending");
  const paints = useRef(0);

  // Decide before the first client paint (no flash of the wrong state).
  useLayoutEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
    const early = fcp === undefined || performance.now() - fcp < INTRO_WITHIN_MS_OF_PAINT;
    // Browser-only facts (timing, motion preference) cannot be the initial state without a
    // hydration mismatch; decided once, before the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(!reduced && !heroAlreadySeen() && early ? "intro" : "static");
  }, []);

  useEffect(() => {
    if (mode !== "intro") return;
    const id = window.setTimeout(() => { if (paints.current === 0) setMode("static"); }, INTRO_WATCHDOG_MS);
    return () => window.clearTimeout(id);
  }, [mode]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) return;
      ctx.font = `400 100px ${getComputedStyle(el).fontFamily}`;
      const per100 = ctx.measureText(firstNames).width * (1 + LETTER_SPACING);
      // Usable width inside TechText = 90% of its (widened) box = 0.9 / (1 - INSET) of the column.
      const usable = (el.clientWidth * 0.9) / (1 - INSET);
      setSize(Math.min(MAX_SIZE, Math.floor((usable / per100) * 100 * 0.98)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [firstNames]);

  // Both lines must have painted before the canvas replaces the text name.
  const onPaint = () => {
    paints.current += 1;
    if (paints.current >= 2) setMode((m) => (m === "static" ? "painted" : m));
    if (paints.current === 1 || paints.current === 2) announceReady();
  };

  const box = size
    ? { height: size * LINE_HEIGHT, width: `${100 / (1 - INSET)}%`, marginLeft: `-${(INSET / (1 - INSET)) * 100}%` }
    : undefined;
  const shared = {
    fontWeight: 400,
    letterSpacing: LETTER_SPACING,
    align: "left" as const,
    accentColor: "#d5c4ff",
    reveal: "letter" as const,
    dashLength: 4,
    dashGap: 2,
    strokeWidth: 1.25,
    specks: 10,
    sweep: false, // no constant motion; reacts only to the pointer
    draggable: false,
    clickKick: true,
    guides: false,
    intro: mode === "intro" ? ("metrics" as const) : ("none" as const),
    introDuration,
    ariaHidden: true,
    onPaint,
  };

  return (
    <div ref={wrap} aria-hidden="true" className="hero-name font-display" data-mode={mode}>
      <div className="hero-name-text">
        <span>{firstNames}</span>
        <span>{lastName}</span>
      </div>
      {size && mode !== "pending" && (
        <div className="hero-name-canvas">
          <div className="text-fg" style={box}>
            <TechText key={`a-${mode === "intro" ? "i" : "s"}`} text={firstNames} fontSize={size} {...shared} />
          </div>
          <div className="text-fg" style={box}>
            <TechText key={`b-${mode === "intro" ? "i" : "s"}`} text={lastName} fontSize={size} {...shared} />
          </div>
        </div>
      )}
    </div>
  );
}
