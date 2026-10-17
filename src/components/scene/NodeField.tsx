"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { BrainNode } from "@/lib/vault/types";
import { GROUP_COLOR } from "./theme";

type Props = {
  nodes: BrainNode[];
  positions: Float32Array;
  hovered: number | null;
  hidden: Set<string>;
  onHover: (index: number | null) => void;
  onSelect: (index: number) => void;
};

export function NodeField({ nodes, positions, hovered, hidden, onHover, onSelect }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const colors = useMemo(() => nodes.map((n) => new THREE.Color(GROUP_COLOR[n.group]).multiplyScalar(1.6)), [nodes]);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    nodes.forEach((n, i) => {
      const base = 0.028 + Math.min(n.degree, 30) * 0.0022;
      const scale = hidden.has(n.group) ? 0 : i === hovered ? base * 2 : base;
      pos.fromArray(positions, i * 3);
      matrix.makeScale(scale, scale, scale).setPosition(pos);
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, colors[i]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [nodes, positions, hovered, hidden, colors]);

  const hoverAt = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined && !hidden.has(nodes[e.instanceId].group)) onHover(e.instanceId);
  };

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, nodes.length]}
      onPointerMove={hoverAt}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onSelect(e.instanceId);
      }}
    >
      <sphereGeometry args={[1, 14, 14]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
