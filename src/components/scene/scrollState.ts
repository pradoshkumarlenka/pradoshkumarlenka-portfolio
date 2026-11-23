/**
 * Shared, mutable scroll state for the cosmic background.
 *
 * Written by the single ScrollTrigger in <CosmicBackground />, read every
 * frame inside the WebGL scene. It is a plain object (not React state) so
 * scrolling never triggers React re-renders.
 */
export const sceneScroll = {
  /** Whole-page progress, 0 at the top → 1 at the bottom. */
  progress: 0,
  /** Hero exit, 0 = Hero fully in view → 1 = Hero fully scrolled out. 1 on pages without a Hero. */
  hero: 0,
  /** Visitor prefers reduced motion: planets stay in their opening composition. */
  reducedMotion: false,
};

/**
 * Eased copies of the values above, updated once per rendered frame by the
 * scene's driver. Every object in the scene reads these, so the whole
 * background moves as one deterministic function of scroll.
 */
export const sceneMotion = {
  progress: 0,
  hero: 0,
};

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to scroll changes (used to request a new WebGL frame). */
export function onSceneScroll(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSceneScroll() {
  listeners.forEach((listener) => listener());
}
