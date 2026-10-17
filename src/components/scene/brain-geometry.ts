import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import type { NodeGroup } from "@/lib/vault/types";

// Brain space: long axis on x (front = -x), up = +y, hemispheres split on z.
// Everything is normalised so the brain's longest side is BRAIN_SIZE.
export const BRAIN_SIZE = 4;

// The CGTrader model is y-up with its long axis on z; turn it so the long axis is x.
// If the front ends up on the right, use +Math.PI / 2 instead.
export const MODEL_ROTATION = new THREE.Euler(0, -Math.PI / 2, 0);

// Seeded random so layouts stay the same between reloads.
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalise(points: Float32Array) {
  const box = new THREE.Box3().setFromArray(points);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = BRAIN_SIZE / Math.max(size.x, size.y, size.z);
  for (let i = 0; i < points.length; i += 3) {
    points[i] = (points[i] - center.x) * scale;
    points[i + 1] = (points[i + 1] - center.y) * scale;
    points[i + 2] = (points[i + 2] - center.z) * scale;
  }
  return points;
}

// Stand-in brain until a real model is in public/models/brain.glb:
// two folded hemispheres, a cerebellum and a stem.
export function proceduralBrainPoints(count: number) {
  const rand = mulberry32(7);
  const out = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const r = rand();
    v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    const folds =
      0.06 * Math.sin(v.x * 17 + v.y * 9) * Math.sin(v.z * 13 - v.y * 11) +
      0.03 * Math.sin(v.x * 31 - v.z * 23 + v.y * 19);
    const depth = 1 - Math.pow(rand(), 3) * 0.12; // mostly surface, some depth
    let x: number, y: number, z: number;
    if (r < 0.86) {
      const side = rand() < 0.5 ? -1 : 1;
      const k = (1 + folds) * depth;
      x = v.x * 1.65 * k;
      y = v.y * 1.15 * k * (v.y < 0 ? 0.8 : 1);
      z = side * (0.08 + Math.abs(v.z) * 0.68 * k);
    } else if (r < 0.96) {
      const k = (1 + folds * 0.6) * depth;
      x = 1.05 + v.x * 0.55 * k;
      y = -0.85 + v.y * 0.35 * k;
      z = v.z * 0.85 * k;
    } else {
      const t = rand();
      x = 0.55 + v.x * 0.16;
      y = -0.9 - t * 0.9;
      z = v.z * 0.16;
    }
    out.set([x, y, z], i * 3);
  }
  return normalise(out);
}

// Sample a loaded model's surfaces, weighted by triangle count.
export function sampleModelPoints(scene: THREE.Object3D, count: number) {
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const weights = meshes.map((m) => {
    const g = m.geometry;
    return (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const out = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  const rotation = new THREE.Matrix4().makeRotationFromEuler(MODEL_ROTATION);
  let k = 0;
  meshes.forEach((mesh, mi) => {
    const n = mi === meshes.length - 1 ? count - k : Math.round((weights[mi] / total) * count);
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(rotation);
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(geometry)).build();
    for (let i = 0; i < n && k < count; i++, k++) {
      sampler.sample(p);
      out.set([p.x, p.y, p.z], k * 3);
    }
    geometry.dispose();
  });
  return normalise(out);
}

// Where each part of the vault lives in the brain, in normalised brain space.
export const REGION_ANCHORS: Record<NodeGroup | "raw", [number, number, number]> = {
  concepts: [-1.35, 0.55, 0.35],
  topics: [-0.2, 1.05, 0.2],
  learning: [0.75, 0.85, -0.3],
  entities: [-0.35, -0.35, 1.05],
  sources: [1.45, 0.25, 0.4],
  outputs: [-1.45, -0.25, -0.6],
  content: [0.35, 0.15, -1.05],
  projects: [0.95, -0.25, 0.95],
  notes: [-0.6, 0.35, -1.0],
  core: [0.0, 0.3, 0.0],
  raw: [0.45, -1.25, 0.0],
};

// Pick a spot for each node: the brain points nearest its region anchor, spread out.
export function layoutNodes(points: Float32Array, groups: NodeGroup[]) {
  const total = points.length / 3;
  const byGroup = new Map<NodeGroup, number[]>();
  groups.forEach((g, i) => byGroup.set(g, [...(byGroup.get(g) ?? []), i]));
  const positions = new Float32Array(groups.length * 3);
  const anchor = new THREE.Vector3();
  const stride = Math.max(1, Math.floor(total / 6000));
  for (const [group, members] of byGroup) {
    anchor.set(...REGION_ANCHORS[group]);
    const candidates: { i: number; d: number }[] = [];
    for (let i = 0; i < total; i += stride) {
      const dx = points[i * 3] - anchor.x;
      const dy = points[i * 3 + 1] - anchor.y;
      const dz = points[i * 3 + 2] - anchor.z;
      candidates.push({ i, d: dx * dx + dy * dy + dz * dz });
    }
    candidates.sort((a, b) => a.d - b.d);
    const pool = candidates.slice(0, Math.max(members.length * 6, 60));
    const step = pool.length / members.length;
    members.forEach((nodeIndex, m) => {
      const src = pool[Math.floor(m * step)].i;
      positions.set([points[src * 3] * 1.02, points[src * 3 + 1] * 1.02, points[src * 3 + 2] * 1.02], nodeIndex * 3);
    });
  }
  return positions;
}
