"use client";

import { useState } from "react";
import type { NodeGroup, VaultData } from "@/lib/vault/types";
import { BrainScene } from "./scene/BrainScene";
import { Hud } from "./hud/Hud";

export function BrainApp({ data }: { data: VaultData }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const toggleGroup = (group: NodeGroup) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  const openInObsidian = (index: number) => {
    const node = data.nodes[index];
    window.location.href = `obsidian://open?vault=${encodeURIComponent(data.vaultName)}&file=${encodeURIComponent(node.id)}`;
  };

  const outCount = data.nodes.filter((n) => n.group === "outputs" || n.id.startsWith("wiki/content/drafts/")).length;

  return (
    <main className={`relative h-dvh w-full overflow-hidden ${hovered !== null ? "cursor-pointer" : ""}`}>
      <div className="absolute inset-0">
        <BrainScene
          nodes={data.nodes}
          edges={data.edges}
          modelUrl={data.modelUrl}
          rawCount={data.raw.count}
          outCount={outCount}
          hovered={hovered}
          hidden={hidden}
          onHover={setHovered}
          onSelect={openInObsidian}
        />
      </div>
      <Hud
        data={data}
        hoveredNode={hovered !== null ? data.nodes[hovered] : null}
        hidden={hidden}
        onToggleGroup={toggleGroup}
      />
    </main>
  );
}
