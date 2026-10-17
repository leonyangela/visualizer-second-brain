"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

type Props = {
  path: [number, number, number][];
  count: number;
  color: string;
  speed?: number;
};

// Small file cards travelling along a curve: raw sources flowing in, outputs flowing out.
export function FileStream({ path, count, color, speed = 0.035 }: Props) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(path.map((p) => new THREE.Vector3(...p))), [path]);
  const guide = useMemo(() => curve.getPoints(60), [curve]);
  const card = useMemo(() => {
    const outline = new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.17, 0.12));
    // Three "text" lines on the card, the last one shorter.
    const rows: [number, number][] = [
      [0.025, 0.055],
      [-0.005, 0.055],
      [-0.035, 0.02],
    ];
    const lines = new THREE.BufferGeometry().setFromPoints(
      rows.flatMap(([y, end]) => [new THREE.Vector3(-0.055, y, 0), new THREE.Vector3(end, y, 0)]),
    );
    return { outline, lines };
  }, []);
  const items = useRef<(THREE.Group | null)[]>([]);
  const p = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock, camera }) => {
    items.current.forEach((g, i) => {
      if (!g) return;
      const t = (clock.elapsedTime * speed + i / count) % 1;
      curve.getPoint(t, p);
      g.position.copy(p);
      g.quaternion.copy(camera.quaternion);
      const fade = Math.min(1, t * 6, (1 - t) * 6);
      g.traverse((o) => {
        const mat = (o as THREE.LineSegments).material as THREE.LineBasicMaterial | undefined;
        if (mat) mat.opacity = 0.85 * fade;
      });
    });
  });

  return (
    <group>
      <Line points={guide} color={color} lineWidth={1} transparent opacity={0.18} dashed dashSize={0.06} gapSize={0.05} />
      {Array.from({ length: count }, (_, i) => (
        <group key={i} ref={(el) => void (items.current[i] = el)}>
          <lineSegments geometry={card.outline}>
            <lineBasicMaterial color={color} transparent toneMapped={false} />
          </lineSegments>
          <lineSegments geometry={card.lines}>
            <lineBasicMaterial color={color} transparent toneMapped={false} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}
