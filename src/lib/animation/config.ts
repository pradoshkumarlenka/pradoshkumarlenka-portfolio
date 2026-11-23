/**
 * ANIMATION CONFIGURATION — typed parameters for the site's motion.
 *
 * ANIMATION_DEFAULTS holds the exact values the site uses today, so behaviour
 * is unchanged. Groups marked "read from config" are already consumed by their
 * components through useAnimationConfig() / getAnimationConfig(); the others
 * document the current values and are wired when the Animation Studio arrives.
 *
 * Every value carries a safe range (ANIMATION_LIMITS) for future editors.
 * Reduced-motion preferences always override these settings.
 */

export type Easing = "premium" | "power1.out" | "power2.out" | "power3.out" | "linear";

export interface AnimationConfig {
  /** Global switches. */
  global: {
    /** Lenis smooth scrolling interpolation (0.05 smooth … 0.3 snappy). Read from config. */
    smoothScrollLerp: number;
  };
  /** Scroll reveals (AnimatedContent). Read from config. */
  reveal: {
    /** Defaults for every <Reveal>. */
    base: { distance: number; duration: number; blur: number; threshold: number; ease: Easing };
    /** The restrained preset used inside sections (cards, case-study blocks). */
    section: { distance: number; duration: number; blur: number; stagger: number };
  };
  /** Hero. */
  hero: {
    /** TechText name intro length (s). Read from config. */
    nameIntroSeconds: number;
    /** Delay before the halftone portrait layer starts (ms). Read from config. */
    portraitEntranceMs: number;
  };
  /** Cursor light trail (GlowCursor). Read from config. */
  cursorTrail: {
    enabled: boolean;
    startAfterMs: number;
    color: string;
    secondaryColor: string;
    intensity: number;
    trailWidth: number;
    linger: number;
    glow: number;
    hotspot: number;
    followSpeed: number;
    clickBurst: boolean;
  };
  /** Proof Bar counters. Read from config. */
  proofBar: { rollSeconds: number };
  /** Honours 3D carousel (pinned scroll). Read from config. */
  honoursCarousel: { stepPx: number; halfHeightPx: number };
  /** Certificate wall filter transition. Read from config. */
  certificateWall: { filterFadeMs: number };
  /** Beyond the Classroom carousel (pinned scroll + lens). Read from config. */
  beyondCarousel: {
    stepPx: number;
    stageHeightPx: number;
    gap: number;
    radius: number;
    dispersion: number;
    squeeze: number;
    desktop: { preset: "liquid" | "ribbon" | "vortex" | "arch"; cardHeight: number };
    mobile: { preset: "liquid" | "ribbon" | "vortex" | "arch"; cardHeight: number; bend: number };
  };
  /** Documented for the Animation Studio; still set inside their components. */
  documented: {
    experienceTimeline: { lineSeconds: number; dotSeconds: number; entrySeconds: number; stagger: number };
    proofBarEntrance: { cardSeconds: number; stagger: number };
    pairedBars: { growSeconds: number; stagger: number };
    betaChart: { growSeconds: number; stagger: number };
    halftone: { introSeconds: number; burstSeconds: number; maxBursts: number };
    techText: { spring: number; kickDecay: number; introDelay: number };
    hoverLift: { durationMs: number };
    planets: { note: string };
  };
}

export const ANIMATION_DEFAULTS: AnimationConfig = {
  global: { smoothScrollLerp: 0.1 },
  reveal: {
    base: { distance: 48, duration: 0.9, blur: 6, threshold: 0.12, ease: "premium" },
    section: { distance: 16, duration: 0.6, blur: 0, stagger: 0.08 },
  },
  hero: { nameIntroSeconds: 1.2, portraitEntranceMs: 1200 },
  cursorTrail: {
    enabled: true,
    startAfterMs: 2000,
    color: "#a56bff",
    secondaryColor: "#6f5bd6",
    intensity: 0.9,
    trailWidth: 2.5,
    linger: 1.1,
    glow: 0.7,
    hotspot: 0.45,
    followSpeed: 0.6,
    clickBurst: true,
  },
  proofBar: { rollSeconds: 1.15 },
  honoursCarousel: { stepPx: 170, halfHeightPx: 200 },
  certificateWall: { filterFadeMs: 140 },
  beyondCarousel: {
    stepPx: 160,
    stageHeightPx: 600,
    gap: 18,
    radius: 14,
    dispersion: 0.25,
    squeeze: 0.15,
    desktop: { preset: "liquid", cardHeight: 0.52 },
    mobile: { preset: "ribbon", cardHeight: 0.42, bend: 0.16 },
  },
  documented: {
    experienceTimeline: { lineSeconds: 0.4, dotSeconds: 0.45, entrySeconds: 0.5, stagger: 0.07 },
    proofBarEntrance: { cardSeconds: 0.6, stagger: 0.085 },
    pairedBars: { growSeconds: 0.9, stagger: 0.1 },
    betaChart: { growSeconds: 0.9, stagger: 0.09 },
    halftone: { introSeconds: 1.4, burstSeconds: 1.3, maxBursts: 4 },
    techText: { spring: 320, kickDecay: 0.62, introDelay: 0.15 },
    hoverLift: { durationMs: 300 },
    planets: { note: "Nine planets with per-section positions/colours in src/components/scene/CosmicScene.tsx; to be exposed as presets." },
  },
};

/** Safe ranges for future editors: [min, max] (inclusive). */
export const ANIMATION_LIMITS = {
  "global.smoothScrollLerp": [0.05, 0.3],
  "reveal.base.distance": [0, 120],
  "reveal.base.duration": [0, 2],
  "reveal.base.blur": [0, 12],
  "reveal.base.threshold": [0, 0.5],
  "reveal.section.distance": [0, 60],
  "reveal.section.duration": [0, 1.5],
  "reveal.section.blur": [0, 8],
  "reveal.section.stagger": [0, 0.3],
  "hero.nameIntroSeconds": [0, 3],
  "hero.portraitEntranceMs": [0, 3000],
  "cursorTrail.startAfterMs": [0, 6000],
  "cursorTrail.intensity": [0, 1.5],
  "cursorTrail.trailWidth": [0.5, 6],
  "cursorTrail.linger": [0.2, 3],
  "cursorTrail.glow": [0, 1.5],
  "cursorTrail.hotspot": [0, 1],
  "cursorTrail.followSpeed": [0.1, 1],
  "proofBar.rollSeconds": [0.3, 3],
  "honoursCarousel.stepPx": [80, 400],
  "certificateWall.filterFadeMs": [0, 600],
  "beyondCarousel.stepPx": [80, 400],
  "beyondCarousel.stageHeightPx": [420, 800],
  "beyondCarousel.dispersion": [0, 1],
  "beyondCarousel.squeeze": [0, 0.5],
  "honoursCarousel.halfHeightPx": [140, 320],
  "beyondCarousel.gap": [0, 48],
  "beyondCarousel.radius": [0, 32],
  "beyondCarousel.desktop.cardHeight": [0.3, 0.7],
  "beyondCarousel.mobile.cardHeight": [0.3, 0.7],
  "beyondCarousel.mobile.bend": [0, 0.4],
} as const satisfies Record<string, readonly [number, number]>;

type Editable = Omit<AnimationConfig, "documented">;

/**
 * Saved settings (content block "animation") applied over the defaults:
 * unknown or missing values fall back to the default, numbers are clamped
 * to ANIMATION_LIMITS, colours must be #rrggbb. The result is always complete.
 */
export function applyAnimationSettings(saved: unknown): AnimationConfig {
  const limits = ANIMATION_LIMITS as Record<string, readonly [number, number]>;
  const merge = (def: unknown, val: unknown, path: string): unknown => {
    if (def && typeof def === "object" && !Array.isArray(def)) {
      const src = val && typeof val === "object" && !Array.isArray(val) ? (val as Record<string, unknown>) : {};
      return Object.fromEntries(Object.entries(def as Record<string, unknown>).map(([k, d]) => [k, merge(d, src[k], path ? `${path}.${k}` : k)]));
    }
    if (typeof def === "number") {
      if (typeof val !== "number" || !Number.isFinite(val)) return def;
      const r = limits[path];
      return r ? Math.min(r[1], Math.max(r[0], val)) : def; // numbers without a range stay at the default
    }
    if (typeof def === "boolean") return typeof val === "boolean" ? val : def;
    if (typeof def === "string") {
      if (typeof val !== "string") return def;
      if (/^#[0-9a-fA-F]{6}$/.test(def)) return /^#[0-9a-fA-F]{6}$/.test(val) ? val : def;
      return val;
    }
    return def;
  };
  const { documented, ...editable } = ANIMATION_DEFAULTS;
  return { ...(merge(editable, saved, "") as Editable), documented };
}
