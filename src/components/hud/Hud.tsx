"use client";

import { useEffect, useState } from "react";
import type { BrainNode, NodeGroup, VaultData } from "@/lib/vault/types";
import { GROUP_LABEL, GROUP_ORDER } from "@/lib/vault/types";
import { GROUP_COLOR } from "../scene/theme";

function useBrisbaneClock() {
  const [time, setTime] = useState("--:--:--");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Brisbane",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function Sparkline({ seed = 0 }: { seed?: number }) {
  const pts = Array.from({ length: 41 }, (_, i) => {
    const y = 10 + Math.sin(i * 0.7 + seed) * 4 + Math.sin(i * 1.9 + seed * 2) * 2;
    return `${i * 10},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} />
    </svg>
  );
}

function Card({ title, active, children, seed }: { title: string; active?: boolean; children: React.ReactNode; seed: number }) {
  return (
    <section className={`hud-card ${active ? "hud-card-active" : ""}`}>
      <h2 className="hud-card-title">{title}</h2>
      <div className="hud-card-body">{children}</div>
      <Sparkline seed={seed} />
    </section>
  );
}

function Row({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="truncate">{left}</span>
      {right !== undefined && <span className="hud-dim shrink-0">{right}</span>}
    </div>
  );
}

type HudProps = {
  data: VaultData;
  hoveredNode: BrainNode | null;
  hidden: Set<string>;
  onToggleGroup: (group: NodeGroup) => void;
};

export function Hud({ data, hoveredNode, hidden, onToggleGroup }: HudProps) {
  const time = useBrisbaneClock();
  const latestIn = data.log.find((l) => l.op === "ingest");
  const latestOut = data.log.find((l) => ["query", "content", "learn"].includes(l.op));
  const groupCounts = GROUP_ORDER.map((g) => [g, data.nodes.filter((n) => n.group === g).length] as const).filter(
    ([, c]) => c > 0,
  );
  const hubs = [...data.nodes].sort((a, b) => b.degree - a.degree).slice(0, 3);

  return (
    <div className="hud">
      <header className="hud-header">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-widest text-white">BRAIN</h1>
            <span className="hud-accent font-semibold">/ LEONI</span>
          </div>
          <p className="hud-dim text-xs">context / sources / linked knowledge</p>
        </div>
        <div className="text-right">
          <div className="hud-dim text-xs">LOCAL / READ-ONLY</div>
          <div className="font-bold tracking-widest text-white">{time}</div>
          <div className="hud-accent text-xs">brisbane</div>
        </div>
      </header>

      <div className="hud-top">
        <section className="hud-panel hud-card-active">
          <h2 className="hud-card-title">SOURCE / incoming</h2>
          <p className="truncate text-white">{latestIn?.title ?? "nothing yet"}</p>
          <p className="hud-dim">{latestIn ? `${latestIn.date} / ingest` : "drop files in raw/inbox"}</p>
        </section>
        <section className="hud-panel">
          <h2 className="hud-card-title">OUT / latest</h2>
          <p className="truncate text-white">{latestOut?.title ?? "nothing yet"}</p>
          <p className="hud-dim">{latestOut ? `${latestOut.date} / ${latestOut.op}` : "waiting"}</p>
        </section>
      </div>

      {hoveredNode && (
        <div className="hud-tooltip">
          <div className="flex items-center gap-2">
            <span className="hud-dot" style={{ background: GROUP_COLOR[hoveredNode.group] }} />
            <span className="hud-dim">
              {GROUP_LABEL[hoveredNode.group]}
              {hoveredNode.category ? ` / ${hoveredNode.category}` : ""}
            </span>
            <span className="hud-dim ml-auto">{hoveredNode.degree} links</span>
          </div>
          <p className="mt-1 font-semibold text-white">{hoveredNode.title}</p>
          <p className="hud-dim mt-1">{hoveredNode.summary}</p>
          <p className="hud-accent mt-2 text-[10px]">click to open in obsidian</p>
        </div>
      )}

      <div className="hud-grid">
        <Card title="INDEX / pages" active seed={1}>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {groupCounts.map(([g, c]) => (
              <button
                key={g}
                type="button"
                onClick={() => onToggleGroup(g)}
                className={`flex items-center gap-1 ${hidden.has(g) ? "opacity-30" : ""}`}
                title={hidden.has(g) ? "show" : "hide"}
              >
                <span className="hud-dot" style={{ background: GROUP_COLOR[g] }} />
                {g} <span className="hud-dim">{c}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="LINKS / graph" seed={2}>
          <Row left="connections" right={data.edges.length} />
          {hubs.map((n) => (
            <Row key={n.id} left={n.title} right={n.degree} />
          ))}
        </Card>
        <Card title="RAW / loot" seed={3}>
          <Row left="files in the chest" right={data.raw.count} />
          {data.raw.recent.slice(0, 3).map((r) => (
            <Row key={r.path} left={r.name} />
          ))}
        </Card>
        <Card title="LOG / tail" active seed={4}>
          {data.log.slice(0, 4).map((l, i) => (
            <Row key={i} left={l.title} right={l.op} />
          ))}
        </Card>
        <Card title="LEARNING" seed={5}>
          {data.learning.slice(0, 4).map((l) => (
            <Row key={l.area} left={l.area} right={l.status} />
          ))}
        </Card>
        <Card title="TOOLBOX" seed={6}>
          {Object.entries(data.toolbox)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([k, v]) => (
              <Row key={k} left={k} right={v} />
            ))}
        </Card>
        <Card title="CONTENT" seed={7}>
          {Object.entries(data.ideas).map(([k, v]) => (
            <Row key={k} left={`ideas / ${k}`} right={v} />
          ))}
          <Row left="drafts" right={data.drafts} />
        </Card>
        <Card title="PROJECTS" active seed={8}>
          {data.projects.map((p) => (
            <Row key={p.name} left={p.name} right={p.status.toLowerCase()} />
          ))}
        </Card>
      </div>

      <footer className="hud-footer">
        <span>/vault/wiki</span>
        <span>{data.modelUrl ? "model: brain.glb" : "model: procedural stand-in"} / read-only</span>
      </footer>
    </div>
  );
}
