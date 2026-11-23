"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineLoop,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type PerspectiveCamera,
} from "three";
import { sceneMotion } from "./scrollState";
import { scenePalette, sceneLight, type PlanetConfig } from "./sceneConfig";
import { revealAt, rgb, samplePath } from "./math";
import { haloFragment, haloVertex, lineFragment, lineVertex, planetFragment, planetVertex } from "./shaders";

/** Unit circle used by every orbital line (shared, built once). */
export function createOrbitGeometry(segments = 256): BufferGeometry {
  const points: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(Math.cos(a), Math.sin(a), 0);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  return geometry;
}

const lightPos = new Vector3(...sceneLight.position);
/** Reused every frame by all planets (updated synchronously, one at a time). */
const scratch = { x: 0, y: 0, z: 0 };
const HALO_THRESHOLD = 0.25;

interface PlanetProps {
  config: PlanetConfig;
  sphere: SphereGeometry;
  orbit: BufferGeometry;
  octaves: number;
}

/**
 * One planet: shaded body, optional limb halo and optional thin orbital lines.
 * Position, apparent size and visibility are pure functions of scroll progress.
 */
export function Planet({ config, sphere, orbit, octaves }: PlanetProps) {
  const group = useRef<Group>(null);
  const body = useRef<Mesh>(null);
  const orbits = useRef<Group>(null);
  const halo = useRef<Mesh>(null);

  const materials = useMemo(() => {
    const defines = { OCTAVES: octaves };
    const surface = new ShaderMaterial({
      defines,
      vertexShader: planetVertex,
      fragmentShader: planetFragment,
      uniforms: {
        uLightPos: { value: lightPos },
        uShadow: { value: rgb(config.palette.shadow) },
        uLit: { value: rgb(config.palette.lit) },
        uHighlight: { value: rgb(config.palette.highlight) },
        uAtmo: { value: rgb(config.palette.atmosphere) },
        uSpace: { value: rgb(scenePalette.space) },
        uSeed: { value: config.surface.seed },
        uScale: { value: config.surface.scale },
        uBands: { value: config.surface.bands },
        uAtmoStrength: { value: config.atmosphere },
        uLightStrength: { value: config.lightStrength },
        uAmbient: { value: config.ambient },
        uVisibility: { value: 1 },
      },
    });

    const haloMaterial =
      config.atmosphere > HALO_THRESHOLD
        ? new ShaderMaterial({
            vertexShader: haloVertex,
            fragmentShader: haloFragment,
            side: BackSide,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            uniforms: {
              uLightPos: { value: lightPos },
              uCenter: { value: new Vector3() },
              uAtmo: { value: rgb(config.palette.atmosphere) },
              uStrength: { value: config.atmosphere * 0.5 },
              uVisibility: { value: 1 },
            },
          })
        : null;

    const orbitMaterials = (config.orbits ?? []).map(
      (o) =>
        new ShaderMaterial({
          vertexShader: lineVertex,
          fragmentShader: lineFragment,
          transparent: true,
          depthWrite: false,
          uniforms: { uColor: { value: rgb("#b9a8f0") }, uOpacity: { value: o.opacity } },
        }),
    );

    return { surface, haloMaterial, orbitMaterials };
  }, [config, octaves]);

  useEffect(
    () => () => {
      materials.surface.dispose();
      materials.haloMaterial?.dispose();
      materials.orbitMaterials.forEach((m) => m.dispose());
    },
    [materials],
  );

  useFrame((state) => {
    const g = group.current;
    if (!g || !body.current) return;
    const p = sceneMotion.progress;
    const point = scratch;

    const visibility = revealAt(config.reveal, p);
    g.visible = visibility > 0.004;
    if (!g.visible) return;

    const cam = state.camera as PerspectiveCamera;
    const aspect = state.size.width / Math.max(state.size.height, 1);
    const tanHalf = Math.tan((cam.fov * Math.PI) / 360);

    // World radius fixed at the first key's depth; moving in z changes apparent size.
    const baseHalfH = tanHalf * Math.abs(config.keys[0].z);
    // On portrait screens allow a little more than the width so planets keep presence.
    const radius = config.radius * Math.min(baseHalfH, baseHalfH * aspect * 1.4);

    samplePath(config.keys, p, point);
    const halfH = tanHalf * Math.abs(point.z);
    g.position.set(point.x * halfH * aspect, point.y * halfH, point.z);
    g.scale.setScalar(radius);

    body.current.rotation.y = config.spin * p;
    (body.current.material as ShaderMaterial).uniforms.uVisibility.value = visibility;

    if (halo.current) {
      const u = (halo.current.material as ShaderMaterial).uniforms;
      u.uVisibility.value = visibility;
      (u.uCenter.value as Vector3).copy(g.position);
    }

    if (orbits.current) {
      if (config.orbitTiltDrift) orbits.current.rotation.z = config.orbitTiltDrift * p;
      orbits.current.children.forEach((tilt, i) => {
        const line = tilt.children[0] as LineLoop;
        (line.material as ShaderMaterial).uniforms.uOpacity.value = (config.orbits?.[i]?.opacity ?? 0) * visibility;
      });
    }
  });

  return (
    <group ref={group} rotation={[0, 0, config.axialTilt]}>
      <mesh ref={body} geometry={sphere} material={materials.surface} />
      {materials.haloMaterial && (
        <mesh ref={halo} geometry={sphere} material={materials.haloMaterial} scale={1.07} renderOrder={2} />
      )}
      {config.orbits && (
        <group ref={orbits}>
          {config.orbits.map((o, i) => (
            <group key={i} rotation={[o.tiltX, 0, o.tiltZ]} scale={o.radius}>
              <lineLoop geometry={orbit} material={materials.orbitMaterials[i]} renderOrder={1} />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
