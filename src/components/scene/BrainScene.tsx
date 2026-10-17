"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { BrainEdge, BrainNode, NodeGroup } from "@/lib/vault/types";
import { GROUP_LABEL } from "@/lib/vault/types";
import { BrainCloud } from "./BrainCloud";
import { LinkArcs } from "./LinkArcs";
import { NodeField } from "./NodeField";
import { FileStream } from "./FileStream";
import { REGION_ANCHORS, layoutNodes, proceduralBrainPoints, sampleModelPoints } from "./brain-geometry";
import { ACCENT, GROUP_COLOR } from "./theme";

const POINT_COUNT = 70000;

export type SceneProps = {
  nodes: BrainNode[];
  edges: BrainEdge[];
  modelUrl: string | null;
  rawCount: number;
  outCount: number;
  hovered: number | null;
  hidden: Set<string>;
  onHover: (index: number | null) => void;
  onSelect: (index: number) => void;
};

function Brain({ points, ...props }: SceneProps & { points: Float32Array }) {
  const { nodes, edges, hovered, hidden, rawCount, outCount, onHover, onSelect } = props;
  const positions = useMemo(() => layoutNodes(points, nodes.map((n) => n.group)), [points, nodes]);
  const counts = useMemo(() => {
    const c = new Map<NodeGroup, number>();
    nodes.forEach((n) => c.set(n.group, (c.get(n.group) ?? 0) + 1));
    return c;
  }, [nodes]);
  const raw = REGION_ANCHORS.raw;
  const out = REGION_ANCHORS.outputs;

  return (
    <group>
      <BrainCloud points={points} />
      <LinkArcs nodes={nodes} edges={edges} positions={positions} hovered={hovered} hidden={hidden} />
      <NodeField
        nodes={nodes}
        positions={positions}
        hovered={hovered}
        hidden={hidden}
        onHover={onHover}
        onSelect={onSelect}
      />
      <FileStream
        path={[[-3.6, -1.9, 1.8], [-1.6, -2.1, 1.2], [-0.2, -1.8, 0.5], raw]}
        count={Math.min(Math.max(rawCount, 4), 12)}
        color="#d8f5e6"
      />
      <FileStream
        path={[out, [-2.2, -0.9, -0.2], [-1.2, -2.1, 0.8], [1.8, -2.2, 1.6], [3.8, -1.7, 1.6]]}
        count={Math.min(Math.max(outCount, 3), 8)}
        color={ACCENT}
        speed={0.025}
      />
      {[...counts.entries()].map(([group, count]) => (
        <RegionTag key={group} position={REGION_ANCHORS[group]} label={GROUP_LABEL[group]} count={count} color={GROUP_COLOR[group]} />
      ))}
      <RegionTag position={raw} label="raw/" count={rawCount} color="#d8f5e6" />
    </group>
  );
}

function RegionTag({ position, label, count, color }: { position: [number, number, number]; label: string; count: number; color: string }) {
  const [x, y, z] = position;
  return (
    <Html position={[x * 1.32, y * 1.32, z * 1.32]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
      <div className="region-tag" style={{ borderColor: color, color }}>
        {label} <span className="opacity-60">{count}</span>
      </div>
    </Html>
  );
}

function ProceduralBrain(props: SceneProps) {
  const points = useMemo(() => proceduralBrainPoints(POINT_COUNT), []);
  return <Brain {...props} points={points} />;
}

function ModelBrain({ url, ...props }: SceneProps & { url: string }) {
  const { scene } = useGLTF(url);
  const points = useMemo(() => sampleModelPoints(scene, POINT_COUNT), [scene]);
  return <Brain {...props} points={points} />;
}

export function BrainScene(props: SceneProps) {
  return (
    <Canvas camera={{ position: [0, 0.4, 7.4], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={["#040806"]} />
      <Suspense fallback={null}>
        {props.modelUrl ? <ModelBrain {...props} url={props.modelUrl} /> : <ProceduralBrain {...props} />}
      </Suspense>
      <OrbitControls
        makeDefault
        enableDamping
        enablePan={false}
        autoRotate={props.hovered === null}
        autoRotateSpeed={0.35}
        minDistance={3.5}
        maxDistance={12}
      />
      <EffectComposer>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.18} luminanceSmoothing={0.3} />
      </EffectComposer>
    </Canvas>
  );
}
