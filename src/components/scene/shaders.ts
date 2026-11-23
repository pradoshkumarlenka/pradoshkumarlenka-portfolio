/**
 * GLSL for the cosmic background.
 *
 * Planet surfaces use 3D noise sampled on the sphere itself, so there are no
 * texture seams and no repeating tiles. The scene renders in display space
 * (no tone mapping), so colours here match the hex values in sceneConfig.ts.
 */

/* Ashima Arts 3D simplex noise (MIT). */
const noise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    sum += amp * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum;
}

/* Tiny screen-space dither to prevent banding in dark gradients. */
float dither(vec2 fragCoord) {
  return (fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
}
`;

/* ------------------------------------------------------------------ Planet */

export const planetVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vObj = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const planetFragment = /* glsl */ `
uniform vec3 uLightPos;
uniform vec3 uShadow;
uniform vec3 uLit;
uniform vec3 uHighlight;
uniform vec3 uAtmo;
uniform vec3 uSpace;
uniform float uSeed;
uniform float uScale;
uniform float uBands;
uniform float uAtmoStrength;
uniform float uLightStrength;
uniform float uAmbient;
uniform float uVisibility;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
${noise}
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 L = normalize(uLightPos - vPosW);

  // Surface: domain-warped noise on the sphere (seamless), optionally banded.
  vec3 q = normalize(vObj) * uScale + vec3(uSeed);
  float warp = fbm(q * 0.7);
  float rocky = fbm(q + warp * 0.9);
  float banded = fbm(vec3(q.x * 0.35, q.y * 3.2, q.z * 0.35) + warp * 1.6);
  float n = mix(rocky, banded, uBands);
  float detail = snoise(q * 7.0) * 0.06;
  float t = clamp(n * 0.55 + 0.5 + detail, 0.0, 1.0);

  vec3 albedo = mix(uShadow, uLit, smoothstep(0.2, 0.9, t));
  albedo = mix(albedo, uHighlight, smoothstep(0.72, 1.0, t) * 0.3);

  // Soft terminator; most of each planet stays in shadow.
  float ndl = dot(N, L);
  float diffuse = pow(smoothstep(-0.06, 0.95, ndl), 1.4);

  // Thin atmospheric scattering on the lit limb only.
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.5);
  float rim = fresnel * smoothstep(-0.2, 0.5, ndl) * uAtmoStrength;

  vec3 col = albedo * (uAmbient + diffuse * uLightStrength) + uAtmo * rim * 0.55;
  col = mix(uSpace, col, uVisibility);
  col += dither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* Halo just outside the limb, drawn only on the side facing the light. */
export const haloVertex = planetVertex;

export const haloFragment = /* glsl */ `
uniform vec3 uLightPos;
uniform vec3 uCenter;
uniform vec3 uAtmo;
uniform float uStrength;
uniform float uVisibility;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 L = normalize(uLightPos - uCenter);
  float facing = -dot(N, V);                 // 0 at the halo's outer edge
  float edge = pow(smoothstep(0.0, 0.33, facing), 3.0);
  vec3 nPerp = normalize(N - V * dot(N, V)); // outward direction on screen
  vec3 lPerp = normalize(L - V * dot(L, V) + 1e-5);
  float lit = smoothstep(-0.05, 0.85, dot(nPerp, lPerp));
  float backlit = 0.55 + 0.45 * smoothstep(0.0, 0.9, -dot(L, V));
  float a = edge * lit * backlit * uStrength * uVisibility;
  gl_FragColor = vec4(uAtmo * a, 1.0);
}
`;

/* --------------------------------------------------------------- Orbit lines */

export const lineVertex = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const lineFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(uColor, uOpacity);
}
`;

/* -------------------------------------------------------------------- Stars */
/* Screen-space points pinned to the far plane, so planets occlude them.      */

export const starVertex = /* glsl */ `
attribute float aSize;
attribute float aBright;
attribute float aTint;
uniform float uShift;
uniform float uPixelRatio;
varying float vBright;
varying float vTint;
void main() {
  vec2 p = position.xy;
  p.y = mod(p.y + uShift + 1.2, 2.4) - 1.2;
  gl_Position = vec4(p, 0.9999, 1.0);
  gl_PointSize = aSize * uPixelRatio;
  vBright = aBright;
  vTint = aTint;
}
`;

export const starFragment = /* glsl */ `
uniform vec3 uCool;
uniform vec3 uWarm;
varying float vBright;
varying float vTint;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  vec3 col = mix(uCool, uWarm, vTint) * vBright * a;
  gl_FragColor = vec4(col, 1.0);
}
`;

/* ---------------------------------------------------- Full-screen quads */

export const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/* Sky: near-black navy gradient with a very faint, broken galactic band. */
export const skyFragment = /* glsl */ `
uniform vec2 uResolution;
uniform float uShift;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uDust;
varying vec2 vUv;
${noise}
void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.8, vUv.y));

  vec2 p = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
  vec2 dir = normalize(vec2(1.0, 0.62));
  vec2 nrm = vec2(-dir.y, dir.x);
  float along = dot(p, dir);
  float across = dot(p, nrm) - 0.06 + uShift;

  float n = fbm(vec3(along * 2.0, across * 4.0, 3.0)) * 0.5 + 0.5;
  float band = exp(-across * across * 16.0) * smoothstep(0.38, 0.9, n);
  float lanes = smoothstep(0.5, 0.75, fbm(vec3(along * 5.0, across * 10.0, 8.0)) * 0.5 + 0.5);
  band *= 1.0 - lanes * 0.7;

  // Keep the reading area in the centre darker.
  float centre = mix(0.3, 1.0, smoothstep(0.12, 0.75, length(p)));
  col += uDust * band * 0.2 * centre;

  col += dither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
`;

/* Rocky horizon: two ranges, subdued texture, thin broken violet rim. */
export const groundFragment = /* glsl */ `
uniform vec2 uResolution;
uniform float uOpacity;
uniform float uSink;
uniform vec3 uNear;
uniform vec3 uFar;
uniform vec3 uRim;
uniform vec3 uHaze;
varying vec2 vUv;
${noise}
void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 uv = vUv;
  uv.y += uSink;
  float x = uv.x * aspect;
  float side = pow(abs(uv.x - 0.5) * 2.0, 2.4);   // 0 centre → 1 edges

  // Far range: low and hazy.
  float hFar = 0.075 + 0.03 * fbm(vec3(x * 1.1, 1.3, 0.0))
             + 0.012 * snoise(vec3(x * 6.0, 2.0, 0.0))
             + 0.005 * abs(snoise(vec3(x * 17.0, 6.0, 0.0))) + 0.045 * side;
  // Near range: rugged, taller toward the sides, low valley in the centre.
  float ridged = 1.0 - abs(snoise(vec3(x * 2.4, 5.0, 0.0)));
  float hNear = 0.022 + 0.04 * fbm(vec3(x * 0.9, 7.0, 0.0))
              + 0.03 * ridged * ridged + 0.016 * snoise(vec3(x * 9.0, 4.0, 0.0))
              + 0.008 * (1.0 - abs(snoise(vec3(x * 7.0, 12.0, 0.0))))
              + 0.004 * abs(snoise(vec3(x * 24.0, 3.0, 0.0)))
              + 0.12 * side;

  float px = 1.25 / max(uResolution.y, 1.0);
  float mFar = smoothstep(hFar + px, hFar - px, uv.y);
  float mNear = smoothstep(hNear + px, hNear - px, uv.y);

  float tex = fbm(vec3(x * 10.0, uv.y * 26.0, 1.0)) * 0.5 + 0.5;
  vec3 far = uFar * (0.8 + 0.35 * tex);
  vec3 near = uNear * (0.75 + 0.5 * tex);

  // Rim light: a hairline on ridges, broken up so it never reads as a glowing line.
  float dNear = max(hNear - uv.y, 0.0) * uResolution.y;
  float dFar = max(hFar - uv.y, 0.0) * uResolution.y;
  float broken = smoothstep(0.35, 0.85, snoise(vec3(x * 3.0, 9.0, 0.0)) * 0.5 + 0.5);
  near += uRim * exp(-dNear / 2.0) * broken * 0.3;
  far += uRim * exp(-dFar / 2.5) * 0.12;

  // Faint haze sitting on the far range.
  float haze = exp(-max(uv.y - hFar, 0.0) * 26.0) * (1.0 - mFar);

  vec3 col = mix(uHaze, far, mFar);
  col = mix(col, near, mNear);
  col *= mix(0.6, 1.0, smoothstep(0.0, 0.1, uv.y));
  col += dither(gl_FragCoord.xy);

  float a = max(max(mFar, mNear), haze * 0.16);
  gl_FragColor = vec4(col, a * uOpacity);
}
`;
