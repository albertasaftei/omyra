import type { BackgroundId } from "./backgrounds";

const common = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uEnergy;
uniform float uAccentEnergy;
uniform vec3 uColor;
uniform float uAspect;
uniform vec2 uResolution;
const float TAU = 6.28318530718;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  mat2 turn = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = turn * p * 2.03 + 4.7;
    amplitude *= 0.5;
  }
  return value;
}
float stars(vec2 p, float scale) {
  vec2 grid = p * scale;
  vec2 cell = floor(grid);
  float seed = hash(cell);
  vec2 center = vec2(hash(cell + 3.1), hash(cell + 9.7)) * 0.6 + 0.2;
  float radius = max(0.025, scale / uResolution.y * 0.7);
  float point = exp(-dot(fract(grid) - center, fract(grid) - center) / (radius * radius));
  float shimmer = 0.8 + 0.2 * sin(uTime * 0.25 + seed * 80.0);
  return step(0.968, seed) * point * shimmer;
}
vec3 starlight(vec2 p) {
  return vec3(0.38, 0.46, 0.6) * (stars(p, 28.0) + stars(p + 13.0, 53.0) * 0.45)
    * (0.75 + uAccentEnergy * 0.3);
}
`;

const nebula = /* glsl */ `
vec3 atmosphere(vec2 p) {
  float t = uTime;
  vec2 drift = vec2(t * 0.035, -t * 0.018);
  vec2 flow = p * 2.0 + drift;
  vec2 warp = vec2(fbm(flow + vec2(0.0, t * 0.035)), fbm(flow * 0.9 + vec2(8.0, -t * 0.045)));
  vec2 curled = p * 3.0 + (warp - 0.5) * 2.8;
  float clouds = fbm(curled - drift * 1.4);
  float foreground = fbm(p * 5.0 - drift * 2.0 + warp * 1.6 + 17.0);
  float ribbon = p.y - p.x * 0.22 + sin(p.x * 2.5 + t * 0.12) * 0.13;
  float shape = exp(-pow((ribbon + (warp.x - 0.5) * 0.6) * 2.5, 2.0));
  shape *= exp(-dot(p * vec2(0.55, 0.7), p * vec2(0.55, 0.7)));
  float body = smoothstep(0.25, 0.8, clouds) * shape;
  float wisps = pow(max(0.0, 1.0 - abs(foreground - 0.52) * 7.0), 3.0) * body;
  vec3 color = uColor * body * (0.85 + uEnergy * 0.22) * (0.94 + 0.06 * sin(t * 0.28));
  color += mix(uColor, vec3(0.12, 0.25, 0.29), 0.6) * wisps * 0.5;
  color += uColor * foreground * shape * 0.09;
  return color + starlight(p + vec2(t * 0.004, -t * 0.0012));
}
`;

const orbital = /* glsl */ `
vec2 orbit(float angle, float radius, float tilt) {
  vec2 q = vec2(cos(angle), sin(angle) * 0.38) * radius;
  return mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * q;
}
vec3 atmosphere(vec2 p) {
  vec2 q = p - vec2(0.15, 0.03);
  vec3 color = uColor * 0.025 * exp(-dot(q, q) * 2.0);
  float pixel = 1.0 / uResolution.y;
  for (int i = 0; i < 96; i++) {
    float seed = float(i);
    float ring = floor(seed / 24.0);
    float radius = 0.23 + ring * 0.17;
    float phase = hash(vec2(seed, 3.0)) * TAU;
    float angle = phase + uTime * (0.12 + ring * 0.025);
    vec2 point = orbit(angle, radius + sin(seed * 7.3) * 0.025, -0.45 + ring * 0.28 + sin(uTime * 0.08) * 0.12);
    float depth = 0.6 + 0.4 * sin(angle);
    float size = max(pixel * 0.85, 0.0014 + hash(vec2(seed, 8.0)) * 0.0018);
    float d = length(q - point);
    float core = exp(-d * d / (size * size));
    float glow = exp(-d * d / (size * size * 30.0));
    color += mix(uColor, vec3(0.6, 0.68, 0.8), 0.5) * (core * 0.8 + glow * 0.028)
      * depth * (1.0 + uAccentEnergy * 0.35);
  }
  return color + starlight(p) * 0.4;
}`;

const trails = /* glsl */ `
vec3 atmosphere(vec2 p) {
  vec3 color = starlight(p) * 0.65;
  // A quiet dust field gives the passing meteors a sense of distance.
  color += uColor * fbm(p * 3.0 + 19.0) * 0.012;
  float pixel = 1.0 / uResolution.y;
  for (int i = 0; i < 12; i++) {
    float seed = float(i);
    float cycle = uTime * (0.12 + hash(vec2(seed, 4.0)) * 0.09) + seed * 0.317;
    float age = fract(cycle);
    float event = floor(cycle);
    float variation = hash(vec2(seed + 21.0, event + 7.0));
    float depth = 0.35 + variation * 0.65;
    float slope = 0.4 + hash(vec2(seed, event + 12.0)) * 0.35;
    vec2 direction = normalize(vec2(-1.0, -slope));
    vec2 normal = vec2(-direction.y, direction.x);
    vec2 start = vec2((hash(vec2(seed, event)) - 0.5) * (uAspect + 0.8) + 0.5,
                      hash(vec2(seed + 9.0, event)) * 0.85 + 0.12);
    vec2 head = start + direction * age * (1.7 + depth * 0.9);
    vec2 q = p - head;
    float along = dot(q, -direction);
    float across = dot(q, normal);
    float lengthOfTail = 0.08 + depth * 0.22;
    float tailPosition = clamp(along / lengthOfTail, 0.0, 1.0);
    float width = max(pixel * 0.75, 0.001 + depth * 0.0015);
    float taper = width * (1.0 - tailPosition * 0.85);
    float behind = smoothstep(-width, width * 2.0, along);
    float fade = pow(1.0 - tailPosition, 1.8) * behind;
    float trail = exp(-across * across / (taper * taper)) * fade;
    float wake = exp(-across * across / (width * width * 20.0)) * fade;
    float core = exp(-dot(q,q) / (width * width * 2.0));
    float halo = exp(-dot(q,q) / (width * width * 36.0));
    float life = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.72, 0.98, age));
    vec3 tailTint = mix(uColor, vec3(0.37, 0.5, 0.65), 0.25);
    vec3 hot = mix(uColor, vec3(0.85, 0.8, 0.7), 0.8);
    color += (tailTint * (trail * 0.55 + wake * 0.055) + hot * (core * 0.9 + halo * 0.055)) * life * depth;
    // Three tiny embers lag behind a large meteor and drift off its trajectory.
    for (int j = 0; j < 3; j++) {
      float fj = float(j) + 1.0;
      float lag = lengthOfTail * (0.22 + fj * 0.18);
      float spread = sin(seed * 7.0 + fj * 13.0 + age * 5.0) * width * fj * 2.0;
      vec2 ember = q - (-direction * lag + normal * spread);
      float spark = exp(-dot(ember,ember) / (width * width * 0.45));
      color += tailTint * spark * life * variation * 0.2 / fj;
    }
  }
  return color;
}
`;

const waves = /* glsl */ `
vec3 atmosphere(vec2 p) {
  vec3 color = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float phase = fi * 0.23;
    float wave = sin(p.x * 3.5 + uTime * 0.09 + phase) * 0.11;
    wave += sin(p.x * 5.2 - uTime * 0.055 + phase * 0.7) * 0.045;
    wave += (fi - 5.5) * 0.026;
    float d = abs(p.y - wave);
    float width = max(0.0008, 0.65 / uResolution.y);
    float line = exp(-d * d / (width * width));
    float glow = exp(-d * d / 0.00012);
    float envelope = exp(-p.x * p.x * 0.8) * sin((fi + 1.0) / 13.0 * 3.14159);
    color += mix(uColor, vec3(0.2, 0.38, 0.4), fi / 18.0)
      * (line * 0.29 + glow * 0.035) * envelope * (1.0 + uEnergy * 0.25);
  }
  return color;
}`;

const celestial = /* glsl */ `
vec3 atmosphere(vec2 p) {
  vec2 screen = p - vec2(0.12 * min(uAspect, 1.0), 0.04);
  vec2 q = mat2(0.94, -0.342, 0.342, 0.94) * screen;
  q.y *= 1.65;
  float r = length(q);
  // Rotate the material coordinates with the arms so knots travel with the disk.
  float spin = uTime * 0.11;
  vec2 materialPoint = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * q;
  float cloud = fbm(materialPoint * 11.0 + 6.0);
  float fine = fbm(materialPoint * 38.0 + 21.0);
  vec2 disturbed = materialPoint + vec2(
    fbm(materialPoint * 8.0 + 37.0), fbm(materialPoint * 8.0 + 73.0)
  ) * 0.035;
  float angle = atan(disturbed.y, disturbed.x);
  float winding = angle + log(r + 0.075) * 3.6;
  float arms = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float phase = winding - fi * TAU / 3.0;
    phase += sin(r * (13.0 + fi * 3.0) + fi * 5.0) * 0.18 + (cloud - 0.5) * 1.7;
    float angularDistance = atan(sin(phase), cos(phase));
    float width = 0.18 + cloud * 0.28 + fi * 0.025;
    float arm = exp(-angularDistance * angularDistance / (width * width));
    // Unequal lengths, broken edges and dense stellar nurseries.
    float reach = exp(-r * (3.3 + fi * 0.65));
    arms += arm * reach * (0.35 + smoothstep(0.28, 0.7, fine) * 1.15);
  }
  float inner = smoothstep(0.045, 0.13, r);
  float dust = smoothstep(0.44, 0.72, fbm(materialPoint * 23.0 + 91.0));
  vec3 tint = mix(uColor, vec3(0.15, 0.27, 0.43), 0.22);
  vec3 color = tint * arms * inner * (1.0 - dust * 0.7) * 0.85;
  color += tint * exp(-r * 5.0) * cloud * 0.07;
  float knots = pow(smoothstep(0.48, 0.8, fine), 3.0);
  color += mix(uColor, vec3(0.65, 0.55, 0.49), 0.6) * knots * arms * inner * 0.35;
  color += starlight(materialPoint * 1.6) * arms * inner * 2.2;
  // A warm, rounded stellar bulge anchors the disk, with a compact bright nucleus.
  float bulgeRadius = length(screen * vec2(1.0, 1.12));
  vec3 coreTint = mix(uColor, vec3(0.72, 0.51, 0.29), 0.68);
  float bulge = exp(-bulgeRadius * bulgeRadius * 160.0);
  float nucleus = exp(-bulgeRadius * bulgeRadius * 2100.0);
  color += coreTint * bulge * 0.55;
  color += vec3(0.85, 0.75, 0.59) * nucleus * (0.6 + uEnergy * 0.08);
  return color + starlight(p) * 0.35;
}
`;

const finish = /* glsl */ `
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec3 color = vec3(0.0025, 0.004, 0.009) + atmosphere(p);
  color *= mix(0.72, 1.0, smoothstep(0.1, 0.8, vUv.x));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// Only the selected effect runs; alternatives do not add per-frame GPU work.
export const backgroundShaders: Record<BackgroundId, string> =
  Object.fromEntries(
    Object.entries({ nebula, orbital, trails, waves, celestial }).map(
      ([id, shader]) => [id, common + shader + finish],
    ),
  ) as Record<BackgroundId, string>;
