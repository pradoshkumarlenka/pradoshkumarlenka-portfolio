"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
} from "three";
import { emitSceneScroll, onSceneScroll, sceneMotion, sceneScroll } from "./scrollState";
import { camera as cameraConfig, planets, scenePalette, type SceneQuality } from "./sceneConfig";
import { rgb, smoothstep } from "./math";
import { Planet, createOrbitGeometry } from "./Planet";
import { groundFragment, quadVertex, skyFragment, starFragment, starVertex } from "./shaders";

/* ----------------------------------------------------------- Builders */
/* Objects are created once and only mutated through refs in useFrame.  */

function createSkyMaterial(octaves: number) {
  return new ShaderMaterial({
    defines: { OCTAVES: Math.min(octaves, 4) },
    vertexShader: quadVertex,
    fragmentShader: skyFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uResolution: { value: [1, 1] },
      uShift: { value: 0 },
      uTop: { value: rgb(scenePalette.skyTop) },
      uHorizon: { value: rgb(scenePalette.skyHorizon) },
      uDust: { value: rgb(scenePalette.dust) },
    },
  });
}

function createGroundMaterial(octaves: number) {
  return new ShaderMaterial({
    defines: { OCTAVES: octaves },
    vertexShader: quadVertex,
    fragmentShader: groundFragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uResolution: { value: [1, 1] },
      uOpacity: { value: 1 },
      uSink: { value: 0 },
      uNear: { value: rgb(scenePalette.groundNear) },
      uFar: { value: rgb(scenePalette.groundFar) },
      uRim: { value: rgb(scenePalette.groundRim) },
      uHaze: { value: rgb(scenePalette.horizonHaze) },
    },
  });
}

/** Sparse, dim star field. Seeded, so the sky is identical on every visit. */
function createStars(count: number) {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const positions: number[] = [];
  const sizes: number[] = [];
  const bright: number[] = [];
  const tint: number[] = [];
  for (let i = 0; i < count; i++) {
    positions.push(rand() * 2.2 - 1.1, rand() * 2.4 - 1.2, 0);
    const isBright = rand() > 0.965;
    sizes.push(isBright ? 2.2 + rand() * 0.8 : 1.0 + rand() * 0.9);
    bright.push(isBright ? 0.55 + rand() * 0.25 : 0.1 + Math.pow(rand(), 3) * 0.35);
    tint.push(rand());
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aBright", new Float32BufferAttribute(bright, 1));
  geometry.setAttribute("aTint", new Float32BufferAttribute(tint, 1));
  const material = new ShaderMaterial({
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uShift: { value: 0 },
      uPixelRatio: { value: 1 },
      uCool: { value: rgb(scenePalette.starCool) },
      uWarm: { value: rgb(scenePalette.starWarm) },
    },
  });
  return { geometry, material };
}

const uniformsOf = (object: Mesh | Points | null) => (object?.material as ShaderMaterial | undefined)?.uniforms;

/* ------------------------------------------------------------------ Driver */

/**
 * Eases the raw scroll values into sceneMotion and asks for another frame
 * only while they are still moving. When scrolling stops, rendering stops.
 * Mounted first so every other object reads this frame's values.
 */
function ScrollDriver() {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    sceneMotion.progress = sceneScroll.reducedMotion ? 0 : sceneScroll.progress;
    sceneMotion.hero = sceneScroll.hero;
    invalidate();
    return onSceneScroll(() => invalidate());
  }, [invalidate]);

  useFrame((_, delta) => {
    const targetProgress = sceneScroll.reducedMotion ? 0 : sceneScroll.progress;
    const targetHero = sceneScroll.hero;

    if (sceneScroll.reducedMotion) {
      sceneMotion.progress = targetProgress;
      sceneMotion.hero = targetHero;
      return;
    }
    const dt = Math.min(delta, 1 / 30);
    sceneMotion.progress = MathUtils.damp(sceneMotion.progress, targetProgress, 5, dt);
    sceneMotion.hero = MathUtils.damp(sceneMotion.hero, targetHero, 7, dt);

    const moving =
      Math.abs(sceneMotion.progress - targetProgress) > 1e-4 || Math.abs(sceneMotion.hero - targetHero) > 1e-4;
    if (moving) {
      invalidate();
    } else {
      sceneMotion.progress = targetProgress;
      sceneMotion.hero = targetHero;
    }
  });

  return null;
}

/* --------------------------------------------------------------------- Sky */

function Sky({ octaves }: { octaves: number }) {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(2, 2), []);
  const material = useMemo(() => createSkyMaterial(octaves), [octaves]);
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  useFrame(({ size }) => {
    const u = uniformsOf(ref.current);
    if (!u) return;
    u.uResolution.value = [size.width, size.height];
    u.uShift.value = sceneMotion.progress * 0.12;
  });

  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-10} />;
}

/* ------------------------------------------------------------------- Stars */

function Stars({ count }: { count: number }) {
  const ref = useRef<Points>(null);
  const stars = useMemo(() => createStars(count), [count]);
  useEffect(() => () => (stars.geometry.dispose(), stars.material.dispose()), [stars]);

  useFrame(({ viewport }) => {
    const u = uniformsOf(ref.current);
    if (!u) return;
    u.uPixelRatio.value = viewport.dpr;
    // Distant stars drift only slightly (least parallax of anything in the scene).
    u.uShift.value = sceneMotion.progress * 0.14;
  });

  return (
    <points ref={ref} geometry={stars.geometry} material={stars.material} frustumCulled={false} renderOrder={0} />
  );
}

/* ------------------------------------------------------------------ Ground */

/** Hero-only rocky horizon. Fades to nothing as the Hero scrolls away. */
function Ground({ octaves }: { octaves: number }) {
  const ref = useRef<Mesh>(null);
  const geometry = useMemo(() => new PlaneGeometry(2, 2), []);
  const material = useMemo(() => createGroundMaterial(octaves), [octaves]);
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  useFrame(({ size }) => {
    const mesh = ref.current;
    const u = uniformsOf(mesh);
    if (!mesh || !u) return;
    const hero = sceneMotion.hero;
    // Fully gone well before the Hero leaves the viewport.
    const opacity = 1 - smoothstep(0.04, 0.6, hero);
    mesh.visible = opacity > 0.002;
    u.uOpacity.value = opacity;
    u.uSink.value = hero * 0.08;
    u.uResolution.value = [size.width, size.height];
  });

  return <mesh ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />;
}

/* ------------------------------------------------------------------- Scene */

function Planets({ quality }: { quality: SceneQuality }) {
  const sphere = useMemo(
    () => new SphereGeometry(1, quality.sphereSegments, Math.round(quality.sphereSegments * 0.75)),
    [quality.sphereSegments],
  );
  const orbit = useMemo(() => createOrbitGeometry(), []);
  useEffect(() => () => (sphere.dispose(), orbit.dispose()), [sphere, orbit]);

  return (
    <>
      {planets.map((planet) => (
        <Planet key={planet.id} config={planet} sphere={sphere} orbit={orbit} octaves={quality.octaves} />
      ))}
    </>
  );
}

/**
 * Compiles every shader program before the first frame is drawn, without blocking the
 * page: compileAsync uses the browser's parallel shader compilation (KHR_parallel_shader_compile)
 * and only resolves when all programs are linked. Rendering starts after that, so the first
 * frame never stalls the main thread waiting for the GPU driver. Same scene, same first frame.
 */
function WarmUp({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const cam = useThree((s) => s.camera);
  useEffect(() => {
    let alive = true;
    gl.compileAsync(scene, cam)
      .catch(() => {}) // a real shader error still surfaces on the first render (SceneBoundary → CSS sky)
      .then(() => { if (alive) onDone(); });
    return () => { alive = false; };
  }, [gl, scene, cam, onDone]);
  return null;
}

/** Draws the first frame as soon as on-demand rendering is switched on after the warm-up. */
function FirstFrame() {
  const frameloop = useThree((s) => s.frameloop);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (frameloop === "demand") invalidate();
  }, [frameloop, invalidate]);
  return null;
}

interface CosmicSceneProps {
  quality: SceneQuality;
  onReady: () => void;
  onContextLost: () => void;
}

export default function CosmicScene({ quality, onReady, onContextLost }: CosmicSceneProps) {
  // "never" until the shaders are compiled (WarmUp), then on-demand rendering as before.
  const [loop, setLoop] = useState<"never" | "demand">("never");
  const warmed = useMemo(() => () => setLoop("demand"), []);
  const readyFired = useRef(false);
  useEffect(() => {
    if (loop !== "demand" || readyFired.current) return;
    readyFired.current = true;
    // Wait for the first real frame before fading the canvas in.
    requestAnimationFrame(() => requestAnimationFrame(onReady));
  }, [loop, onReady]);
  return (
    <Canvas
      frameloop={loop}
      dpr={[1, quality.maxDpr]}
      linear
      flat
      camera={{ fov: cameraConfig.fov, near: 0.5, far: 1000, position: [0, 0, 0] }}
      gl={{ antialias: quality.antialias, alpha: false, stencil: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(scenePalette.space, 1);
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onContextLost();
        });
        emitSceneScroll();
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <ScrollDriver />
      <Sky octaves={quality.octaves} />
      <Stars count={quality.stars} />
      <Planets quality={quality} />
      <Ground octaves={quality.octaves} />
      {loop === "never" ? <WarmUp onDone={warmed} /> : <FirstFrame />}
    </Canvas>
  );
}
