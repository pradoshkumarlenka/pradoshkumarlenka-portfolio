/**
 * COSMIC BACKGROUND — composition settings.
 *
 * Everything that shapes the look of the 3D background lives here: colours,
 * the light, and each planet's path as the visitor scrolls. Components only
 * read these values.
 *
 * Coordinates
 * -----------
 * x, y   Screen position at the planet's depth: -1 = left/bottom edge,
 *        +1 = right/top edge, 0 = centre. Values beyond ±1 are off-screen.
 * z      Distance from the camera (negative = into the screen). Moving a
 *        planet to a smaller |z| brings it closer, so it looks larger.
 * p      Whole-page scroll progress, 0 (top) → 1 (bottom). Between keys the
 *        planet glides smoothly; scrolling up plays the same path in reverse.
 *
 * Keep the centre (|x| < 0.55) clear so text stays readable.
 */

/** Colours are sRGB hex. The scene renders in display space (no tone mapping). */
export const scenePalette = {
  space: "#070a14", // matches --color-canvas
  skyTop: "#03050c",
  skyHorizon: "#070917",
  dust: "#3b2f6b", // faint galactic band (kept very dim)
  starCool: "#c9cfee",
  starWarm: "#d9ccff",
  groundNear: "#05060c",
  groundFar: "#0a0c18",
  groundRim: "#5d4f9a", // restrained violet edge light on the ridgeline
  horizonHaze: "#2a2552",
};

/** A single distant light placed behind the centre of the view. Planets are
 * lit from behind/the side, so they read as mostly shadowed crescents. */
export const sceneLight = {
  position: [0, 6, -115] as [number, number, number],
};

export const camera = {
  fov: 40,
};

export interface PlanetKey {
  p: number;
  x: number;
  y: number;
  z: number;
}

export interface PlanetConfig {
  id: string;
  /** Radius as a fraction of half the viewport height (or ~width on portrait screens), at the first key's depth. */
  radius: number;
  keys: PlanetKey[];
  /** Scroll range where the planet emerges from / sinks back into darkness. Omit = always visible. */
  reveal?: { in: [number, number]; out?: [number, number] };
  palette: { shadow: string; lit: string; highlight: string; atmosphere: string };
  surface: {
    seed: number;
    scale: number; // feature size: higher = finer detail
    bands: number; // 0 = rocky, 1 = soft gas-giant banding
  };
  lightStrength: number;
  ambient: number;
  /** Limb scattering (0 = none). A separate halo is drawn only when > 0.25. */
  atmosphere: number;
  /** Slow surface turn driven by scroll (radians across the whole page). */
  spin: number;
  axialTilt: number;
  /** Thin orbital lines: radius in planet radii, tilt in radians, opacity. */
  orbits?: { radius: number; tiltX: number; tiltZ: number; opacity: number }[];
  /** How much the orbit tilt changes across the scroll (radians). */
  orbitTiltDrift?: number;
}

/*
 * Nine distinct worlds, each owning its own stretch of the page and its own
 * spot on screen, so the sky changes as the visitor moves through sections.
 * Paths never overlap: verified numerically at desktop, tablet and phone sizes.
 */
export const planets: PlanetConfig[] = [
  /* Hero — large violet world, upper-left (from the reference), drifts out up-left. */
  {
    id: "atlas",
    radius: 0.62,
    keys: [
      { p: 0, x: -0.8, y: 0.74, z: -62 },
      { p: 0.12, x: -0.92, y: 0.95, z: -64 },
      { p: 0.24, x: -1.45, y: 1.6, z: -70 },
    ],
    palette: { shadow: "#10122a", lit: "#3a3368", highlight: "#8a7bc9", atmosphere: "#7a68d0" },
    surface: { seed: 3.1, scale: 2.2, bands: 0.15 },
    lightStrength: 0.95,
    ambient: 0.3,
    atmosphere: 0.42,
    spin: 0.5,
    axialTilt: 0.35,
    orbits: [
      { radius: 1.32, tiltX: 1.25, tiltZ: 0.42, opacity: 0.14 },
      { radius: 1.75, tiltX: 1.32, tiltZ: 0.36, opacity: 0.08 },
    ],
    orbitTiltDrift: 0.08,
  },
  /* Hero — small grey moon top-centre, between Atlas and Vesper; leaves straight up. */
  {
    id: "atlas-moon",
    radius: 0.045,
    keys: [
      { p: 0, x: 0.3, y: 0.62, z: -46 },
      { p: 0.2, x: 0.34, y: 1.4, z: -46 },
    ],
    palette: { shadow: "#10122a", lit: "#2d2b47", highlight: "#6c6990", atmosphere: "#6b5fb0" },
    surface: { seed: 11.4, scale: 3.4, bands: 0 },
    lightStrength: 0.9,
    ambient: 0.3,
    atmosphere: 0.12,
    spin: 0.3,
    axialTilt: 0.1,
  },
  /* Hero — blue-violet ringed world at the right edge, exits right. */
  {
    id: "vesper",
    radius: 0.26,
    keys: [
      { p: 0, x: 1.02, y: 0.02, z: -58 },
      { p: 0.12, x: 1.12, y: 0.1, z: -60 },
      { p: 0.24, x: 1.65, y: 0.2, z: -62 },
    ],
    palette: { shadow: "#10122a", lit: "#30336a", highlight: "#968cdc", atmosphere: "#8574e0" },
    surface: { seed: 23.5, scale: 1.8, bands: 0.7 },
    lightStrength: 0.95,
    ambient: 0.3,
    atmosphere: 0.5,
    spin: 0.35,
    axialTilt: 0.25,
    orbits: [
      { radius: 1.5, tiltX: 1.36, tiltZ: -0.32, opacity: 0.13 },
      { radius: 1.54, tiltX: 1.36, tiltZ: -0.32, opacity: 0.06 },
    ],
    orbitTiltDrift: -0.06,
  },
  /* Experience → Research — icy steel-blue world on the left. */
  {
    id: "glacier",
    radius: 0.14,
    keys: [
      { p: 0.12, x: -1.4, y: -0.4, z: -66 },
      { p: 0.24, x: -0.82, y: -0.32, z: -64 },
      { p: 0.38, x: -0.86, y: 0.4, z: -66 },
      { p: 0.5, x: -1.45, y: 1.0, z: -70 },
    ],
    palette: { shadow: "#0e1424", lit: "#2b3d5c", highlight: "#8fa6c8", atmosphere: "#7c9ad6" },
    surface: { seed: 31.7, scale: 2.8, bands: 0 },
    lightStrength: 0.85,
    ambient: 0.3,
    atmosphere: 0.35,
    spin: 0.3,
    axialTilt: 0.2,
  },
  /* Research — dusty mauve banded world on the right. */
  {
    id: "cinder",
    radius: 0.2,
    keys: [
      { p: 0.18, x: 1.4, y: -0.8, z: -72 },
      { p: 0.3, x: 0.84, y: -0.5, z: -70 },
      { p: 0.42, x: 0.86, y: 0.3, z: -72 },
      { p: 0.54, x: 1.45, y: 0.95, z: -76 },
    ],
    palette: { shadow: "#140f1e", lit: "#46344f", highlight: "#a283ac", atmosphere: "#9a78b4" },
    surface: { seed: 47.2, scale: 2.0, bands: 0.85 },
    lightStrength: 0.85,
    ambient: 0.3,
    atmosphere: 0.3,
    spin: 0.4,
    axialTilt: -0.35,
  },
  /* Leadership → Honours — tiny grey moonlet descending right of centre. */
  {
    id: "pebble",
    radius: 0.04,
    keys: [
      { p: 0.44, x: 0.5, y: 1.3, z: -60 },
      { p: 0.56, x: 0.52, y: 0.5, z: -58 },
      { p: 0.66, x: 0.54, y: -0.4, z: -58 },
      { p: 0.76, x: 0.56, y: -1.35, z: -60 },
    ],
    palette: { shadow: "#10111a", lit: "#3a3a48", highlight: "#7d7d90", atmosphere: "#6c6c88" },
    surface: { seed: 61.9, scale: 3.6, bands: 0 },
    lightStrength: 0.85,
    ambient: 0.3,
    atmosphere: 0.1,
    spin: 0.2,
    axialTilt: 0.1,
  },
  /* Leadership → Honours — teal-indigo ringed world on the left. */
  {
    id: "halcyon",
    radius: 0.18,
    keys: [
      { p: 0.46, x: -1.45, y: -0.6, z: -64 },
      { p: 0.58, x: -0.84, y: -0.45, z: -62 },
      { p: 0.7, x: -0.86, y: 0.35, z: -64 },
      { p: 0.82, x: -1.5, y: 0.95, z: -68 },
    ],
    palette: { shadow: "#0c1620", lit: "#234253", highlight: "#7fb0bf", atmosphere: "#6fa3c4" },
    surface: { seed: 73.4, scale: 1.9, bands: 0.6 },
    lightStrength: 0.85,
    ambient: 0.3,
    atmosphere: 0.35,
    spin: 0.3,
    axialTilt: 0.3,
    orbits: [{ radius: 1.6, tiltX: 1.3, tiltZ: 0.28, opacity: 0.1 }],
    orbitTiltDrift: 0.05,
  },
  /* Honours → Beyond — deep-blue giant showing only its crescent at the right edge. */
  {
    id: "nereid",
    radius: 0.42,
    keys: [
      { p: 0.6, x: 1.8, y: -0.2, z: -60 },
      { p: 0.72, x: 1.2, y: -0.1, z: -58 },
      { p: 0.84, x: 1.24, y: 0.05, z: -58 },
      { p: 0.96, x: 1.85, y: 0.2, z: -60 },
    ],
    palette: { shadow: "#0a0f22", lit: "#22336a", highlight: "#7a92d8", atmosphere: "#6c86e0" },
    surface: { seed: 83.6, scale: 1.7, bands: 0.5 },
    lightStrength: 0.9,
    ambient: 0.3,
    atmosphere: 0.45,
    spin: 0.35,
    axialTilt: -0.2,
  },
  /* Contact — large dark world rising into the lower-left. */
  {
    id: "terminus",
    radius: 0.55,
    keys: [
      { p: 0.8, x: -0.95, y: -1.9, z: -60 },
      { p: 1, x: -0.82, y: -1.0, z: -52 },
    ],
    palette: { shadow: "#10122a", lit: "#272c58", highlight: "#6b78c4", atmosphere: "#6c7be0" },
    surface: { seed: 88.1, scale: 2.0, bands: 0.25 },
    lightStrength: 0.9,
    ambient: 0.3,
    atmosphere: 0.38,
    spin: 0.4,
    axialTilt: -0.3,
  },
  /* Final sections — small lavender world settling top-right. */
  {
    id: "beacon",
    radius: 0.06,
    keys: [
      { p: 0.84, x: 1.2, y: 0.95, z: -84 },
      { p: 1, x: 0.74, y: 0.64, z: -80 },
    ],
    palette: { shadow: "#10122a", lit: "#3a3566", highlight: "#8a80c4", atmosphere: "#7466c8" },
    surface: { seed: 101.3, scale: 2.8, bands: 0.2 },
    lightStrength: 0.85,
    ambient: 0.3,
    atmosphere: 0.18,
    spin: 0.2,
    axialTilt: 0.3,
    orbits: [{ radius: 1.9, tiltX: 1.2, tiltZ: 0.5, opacity: 0.07 }],
  },
];

/* --------------------------------------------------------------- Quality */

export interface SceneQuality {
  tier: "high" | "low";
  maxDpr: number;
  stars: number;
  sphereSegments: number;
  /** Noise octaves in shaders (detail vs. GPU cost). */
  octaves: number;
  antialias: boolean;
}

/** Picks a lighter configuration for phones, touch devices and low-core CPUs. */
export function detectQuality(): SceneQuality {
  const small = window.matchMedia("(max-width: 767px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const low = small || coarse || cores <= 4 || memory <= 4;
  return low
    ? { tier: "low", maxDpr: 1.5, stars: 240, sphereSegments: 48, octaves: 4, antialias: true }
    : { tier: "high", maxDpr: 2, stars: 520, sphereSegments: 96, octaves: 5, antialias: true };
}
