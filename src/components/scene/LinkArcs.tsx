"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BrainEdge, BrainNode } from "@/lib/vault/types";
import { GROUP_ORDER } from "@/lib/vault/types";
import { mulberry32 } from "./brain-geometry";
import { ACCENT } from "./theme";

const SEGMENTS = 24;

const vertex = /* glsl */ `
  attribute float aT;
  attribute float aSeed;
  attribute vec2 aNodes;
  attribute vec2 aGroups;
  uniform float uVisible[10];
  varying float vT;
  varying float vSeed;
  varying vec2 vNodes;
  varying float vShow;
  void main() {
    vT = aT;
    vSeed = aSeed;
    vNodes = aNodes;
    vShow = uVisible[int(aGroups.x)] * uVisible[int(aGroups.y)];
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform vec3 uColor;
  varying float vT;
  varying float vSeed;
  varying vec2 vNodes;
  varying float vShow;
  void main() {
    if (vShow < 0.5) discard;
    float head = fract(uTime * (0.08 + vSeed * 0.12) + vSeed);
    float d = abs(vT - head);
    float pulse = exp(-d * d * 400.0);
    bool lit = abs(vNodes.x - uHover) < 0.5 || abs(vNodes.y - uHover) < 0.5;
    float dim = uHover >= 0.0 && !lit ? 0.25 : 1.0;
    float base = lit ? 0.75 : 0.1;
    gl_FragColor = vec4(uColor * (1.0 + pulse * 2.5), (base + pulse * 0.9) * dim);
  }
`;

type Props = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  positions: Float32Array;
  hovered: number | null;
  hidden: Set<string>;
};

export function LinkArcs({ nodes, edges, positions, hovered, hidden }: Props) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const verts = edges.length * SEGMENTS * 2;
    const pos = new Float32Array(verts * 3);
    const t = new Float32Array(verts);
    const seed = new Float32Array(verts);
    const ends = new Float32Array(verts * 2);
    const groups = new Float32Array(verts * 2);
    const rand = mulberry32(11);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const p = new THREE.Vector3();
    let v = 0;
    edges.forEach((e) => {
      a.fromArray(positions, e.source * 3);
      b.fromArray(positions, e.target * 3);
      // Pull the control point toward the centre so arcs run through the brain.
      c.addVectors(a, b).multiplyScalar(0.5 * 0.45);
      const curve = new THREE.QuadraticBezierCurve3(a, c, b);
      const s = rand();
      const ga = GROUP_ORDER.indexOf(nodes[e.source].group);
      const gb = GROUP_ORDER.indexOf(nodes[e.target].group);
      for (let i = 0; i < SEGMENTS; i++) {
        for (const k of [i, i + 1]) {
          curve.getPoint(k / SEGMENTS, p);
          p.toArray(pos, v * 3);
          t[v] = k / SEGMENTS;
          seed[v] = s;
          ends.set([e.source, e.target], v * 2);
          groups.set([ga, gb], v * 2);
          v++;
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aNodes", new THREE.BufferAttribute(ends, 2));
    g.setAttribute("aGroups", new THREE.BufferAttribute(groups, 2));
    return g;
  }, [nodes, edges, positions]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHover: { value: -1 },
      uColor: { value: new THREE.Color(ACCENT) },
      uVisible: { value: new Array(10).fill(1) },
    }),
    [],
  );

  useFrame(({ clock }) => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uTime.value = clock.elapsedTime;
    m.uniforms.uHover.value = hovered ?? -1;
    m.uniforms.uVisible.value = GROUP_ORDER.map((g) => (hidden.has(g) ? 0 : 1));
  });

  return (
    <lineSegments geometry={geometry}>
      <shaderMaterial
        ref={material}
        vertexShader={vertex}
        fragmentShader={fragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}
