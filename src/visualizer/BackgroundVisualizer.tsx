import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect, useState } from "react";
import * as THREE from "three";
import type { AudioEngine } from "../audio/AudioEngine";

import type { BackgroundId } from "./backgrounds";
import { backgroundShaders } from "./shaders";

function BackgroundScene({
  engine,
  color,
  colorMode,
  background,
}: {
  engine: AudioEngine;
  color: string;
  colorMode: "fixed" | "drift";
  background: BackgroundId;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const audioEnergy = useRef(0);
  const accentEnergy = useRef(0);
  const reducedMotion = useRef(false);
  const [uniforms] = useState(() => ({
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uAccentEnergy: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uAspect: { value: 1 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  }));
  const colorTransition = useRef({
    from: new THREE.Color(color),
    to: new THREE.Color(color),
    elapsed: 0,
    duration: 0,
  });
  useEffect(() => {
    colorTransition.current.duration = 0;
  }, [colorMode, color]);
  const targetColor = useMemo(() => new THREE.Color(color), [color]);

  useEffect(() => {
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const updateReducedMotion = () => {
      reducedMotion.current = motionPreference.matches;
    };
    updateReducedMotion();
    motionPreference.addEventListener("change", updateReducedMotion);
    return () =>
      motionPreference.removeEventListener("change", updateReducedMotion);
  }, []);
  useEffect(
    () =>
      engine.subscribe((event) => {
        audioEnergy.current = Math.min(
          1,
          audioEnergy.current + event.intensity * 0.3,
        );
        if (event.layer === "bells" || event.layer === "particles") {
          accentEnergy.current = Math.min(
            1,
            accentEnergy.current + event.intensity,
          );
        }
      }),
    [engine],
  );

  useFrame((state, delta) => {
    if (!material.current) return;
    const activeUniforms = material.current.uniforms;
    const deltaSeconds = Math.min(delta, 0.1);
    audioEnergy.current *= Math.exp(-deltaSeconds * 0.35);
    accentEnergy.current *= Math.exp(-deltaSeconds * 0.6);
    activeUniforms.uTime.value += reducedMotion.current ? 0 : deltaSeconds;
    activeUniforms.uEnergy.value = reducedMotion.current
      ? 0
      : audioEnergy.current;
    activeUniforms.uAccentEnergy.value = reducedMotion.current
      ? 0
      : accentEnergy.current;
    if (colorMode === "drift" && !document.hidden) {
      const transition = colorTransition.current;
      if (transition.elapsed >= transition.duration) {
        transition.from.copy(activeUniforms.uColor.value);
        transition.to.setHSL(Math.random(), 0.28 + Math.random() * 0.12, 0.62);
        transition.elapsed = 0;
        transition.duration = 30 + Math.random() * 30;
      }
      transition.elapsed = Math.min(
        transition.duration,
        transition.elapsed + deltaSeconds,
      );
      const progress = transition.elapsed / transition.duration;
      const eased = progress * progress * (3 - 2 * progress);
      activeUniforms.uColor.value
        .copy(transition.from)
        .lerp(transition.to, eased);
    } else if (colorMode === "fixed") {
      activeUniforms.uColor.value.lerp(
        targetColor,
        1 - Math.exp(-deltaSeconds * 0.7),
      );
    }
    activeUniforms.uAspect.value = state.size.width / state.size.height;
    state.gl.getDrawingBufferSize(activeUniforms.uResolution.value);
  });
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        key={background}
        ref={material}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
        vertexShader={
          "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }"
        }
        fragmentShader={backgroundShaders[background]}
      />
    </mesh>
  );
}

export default function BackgroundVisualizer({
  engine,
  color,
  colorMode,
  visualQuality,
  background,
  paused,
}: {
  engine: AudioEngine;
  color: string;
  colorMode: "fixed" | "drift";
  visualQuality: string;
  background: BackgroundId;
  paused: boolean;
}) {
  return (
    <Canvas
      frameloop={paused ? "never" : "always"}
      dpr={visualQuality === "high" ? 1.5 : visualQuality === "low" ? 0.6 : 1}
      gl={{ antialias: false, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        // A lost context is recoverable. Three.js rebuilds resources on restore;
        // never turn a temporary browser/GPU event into a saved preference.
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
        });
      }}
      fallback={null}
    >
      <BackgroundScene
        engine={engine}
        color={color}
        colorMode={colorMode}
        background={background}
      />
    </Canvas>
  );
}
