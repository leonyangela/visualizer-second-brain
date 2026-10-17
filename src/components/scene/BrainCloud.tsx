"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./brain-geometry";

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aRand;
  varying float vRand;
  varying float vTwinkle;
  void main() {
    vec3 p = position * (1.0 + 0.006 * sin(uTime * 0.8 + position.x));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vTwinkle = 0.65 + 0.35 * sin(uTime * 1.6 + aRand * 40.0);
    vRand = aRand;
    gl_PointSize = uSize * (0.45 + aRand * 0.9) * uPixelRatio / -mv.z;
  }
`;

const fragment = /* glsl */ `
  varying float vRand;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    vec3 tint = vRand > 0.94 ? vec3(0.45, 1.0, 0.7) : vec3(0.86, 0.95, 0.9);
    gl_FragColor = vec4(tint, soft * 0.42 * vTwinkle);
  }
`;

export function BrainCloud({ points }: { points: Float32Array }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(points, 3));
    const rand = mulberry32(3);
    const r = new Float32Array(points.length / 3).map(() => rand());
    g.setAttribute("aRand", new THREE.BufferAttribute(r, 1));
    return g;
  }, [points]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uSize: { value: 26 }, uPixelRatio: { value: dpr } }),
    [dpr],
  );

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
