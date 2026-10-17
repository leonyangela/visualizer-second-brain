import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { BrainEdge, BrainNode, LogEntry, NodeGroup, VaultData } from "./types";

// Read-only access to the Obsidian vault. Only readdir, readFile and access are used.

const WIKILINK = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g;
// Hub files that link to everything; drawing their edges would hide the real structure.
const NO_OUTGOING_EDGES = new Set(["wiki/index", "wiki/log"]);

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = await Promise.all(
    entries.map((e) => {
      const full = path.join(dir, e.name);
      if (e.name.startsWith(".")) return [];
      return e.isDirectory() ? walk(full) : [full];
    }),
  );
  return files.flat();
}

function groupFor(id: string): NodeGroup {
  const parts = id.split("/");
  if (parts[0] === "projects") return "projects";
  const folder = parts[1];
  switch (folder) {
    case "topics":
    case "concepts":
    case "entities":
    case "sources":
    case "learning":
    case "outputs":
    case "content":
    case "notes":
      return folder;
    default:
      return "core";
  }
}

function firstHeading(body: string, fallback: string) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function fallbackSummary(body: string) {
  const oneLine = body.match(/## In one line\s*\n+([^\n]+)/);
  if (oneLine) return oneLine[1].trim();
  const para = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith("|") && !l.startsWith(">"));
  return para ?? "";
}

function stripCode(text: string) {
  return text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");
}

function parseLog(text: string): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const m of text.matchAll(/^## \[(\d{4}-\d{2}-\d{2})\] (\w+) \| (.+)$/gm)) {
    entries.push({ date: m[1], op: m[2], title: m[3].trim() });
  }
  return entries;
}

function parseTracker(text: string) {
  const rows: { area: string; status: string }[] = [];
  for (const line of text.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 4 || cells[1] === "Area" || cells[1].startsWith("---")) continue;
    rows.push({ area: cells[1], status: cells[2] });
  }
  return rows;
}

export async function readVault(): Promise<VaultData> {
  const root = process.env.VAULT_PATH;
  if (!root) throw new Error("VAULT_PATH is not set. Add it to .env.local.");
  await fs.access(root);
  const vaultName = process.env.OBSIDIAN_VAULT_NAME || path.basename(root);

  const pageFiles = [
    ...(await walk(path.join(root, "wiki"))),
    ...(await walk(path.join(root, "projects"))),
  ].filter((f) => f.endsWith(".md"));

  const pages = await Promise.all(
    pageFiles.map(async (file) => {
      const text = await fs.readFile(file, "utf8");
      const { data, content } = matter(text);
      const id = path.relative(root, file).replace(/\\/g, "/").replace(/\.md$/, "");
      return { id, data, content };
    }),
  );

  const indexPage = pages.find((p) => p.id === "wiki/index");
  const indexSummaries = new Map<string, string>();
  if (indexPage) {
    for (const m of indexPage.content.matchAll(/^- \[\[([^\]|#]+)\]\][^–\n]*–\s*(.+)$/gm)) {
      indexSummaries.set(m[1].trim(), m[2].trim());
    }
  }

  const idToIndex = new Map(pages.map((p, i) => [p.id, i]));
  const nodes: BrainNode[] = pages.map((p) => ({
    id: p.id,
    title: firstHeading(p.content, path.basename(p.id)),
    group: groupFor(p.id),
    category: typeof p.data.category === "string" && p.data.category ? p.data.category : null,
    summary: indexSummaries.get(p.id) ?? fallbackSummary(p.content),
    degree: 0,
  }));

  const seen = new Set<string>();
  const edges: BrainEdge[] = [];
  pages.forEach((p, i) => {
    if (NO_OUTGOING_EDGES.has(p.id)) return;
    for (const m of stripCode(p.content).matchAll(WIKILINK)) {
      const j = idToIndex.get(m[1].trim());
      if (j === undefined || j === i) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: i, target: j });
      nodes[i].degree++;
      nodes[j].degree++;
    }
  });

  const rawFiles = (await walk(path.join(root, "raw"))).map((f) =>
    path.relative(root, f).replace(/\\/g, "/"),
  );
  const rawWithTime = await Promise.all(
    rawFiles.map(async (p) => ({ p, t: (await fs.stat(path.join(root, p))).mtimeMs })),
  );
  rawWithTime.sort((a, b) => b.t - a.t);

  const logPage = await fs.readFile(path.join(root, "wiki/log.md"), "utf8").catch(() => "");
  const tracker = pages.find((p) => p.id === "wiki/learning/tracker");
  const ideasPage = pages.find((p) => p.id === "wiki/content/ideas");

  const toolbox: Record<string, number> = {};
  for (const n of nodes) if (n.group === "entities" && n.category) toolbox[n.category] = (toolbox[n.category] ?? 0) + 1;

  const ideas: Record<string, number> = {};
  for (const m of ideasPage?.content.matchAll(/^- \[(\w+)\]/gm) ?? []) ideas[m[1]] = (ideas[m[1]] ?? 0) + 1;

  const projects = pages
    .filter((p) => /^projects\/[^/]+\/README$/.test(p.id))
    .map((p) => ({
      name: p.id.split("/")[1],
      status: p.content.match(/\*\*Status:\*\*\s*([^\n(]+)/)?.[1].trim() ?? "unknown",
    }));

  const hasModel = await fs
    .access(path.join(process.cwd(), "public/models/brain.glb"))
    .then(() => true)
    .catch(() => false);

  return {
    vaultName,
    nodes,
    edges,
    raw: {
      count: rawFiles.length,
      recent: rawWithTime.slice(0, 12).map(({ p }) => ({ path: p, name: path.basename(p).replace(/\.md$/, "") })),
    },
    log: parseLog(logPage).reverse(),
    learning: tracker ? parseTracker(tracker.content) : [],
    toolbox,
    ideas,
    drafts: pages.filter((p) => p.id.startsWith("wiki/content/drafts/")).length,
    projects,
    modelUrl: hasModel ? "/models/brain.glb" : null,
  };
}
