export type NodeGroup =
  | "core"
  | "topics"
  | "concepts"
  | "entities"
  | "sources"
  | "learning"
  | "outputs"
  | "content"
  | "notes"
  | "projects";

export type BrainNode = {
  id: string; // vault-relative path without .md, e.g. "wiki/concepts/mcp"
  title: string;
  group: NodeGroup;
  category: string | null;
  summary: string;
  degree: number;
};

export type BrainEdge = { source: number; target: number }; // indices into nodes

export type LogEntry = { date: string; op: string; title: string };

export type RawItem = { path: string; name: string };

export type VaultData = {
  vaultName: string;
  nodes: BrainNode[];
  edges: BrainEdge[];
  raw: { count: number; recent: RawItem[] };
  log: LogEntry[];
  learning: { area: string; status: string }[];
  toolbox: Record<string, number>;
  ideas: Record<string, number>;
  drafts: number;
  projects: { name: string; status: string }[];
  modelUrl: string | null;
};

export const GROUP_ORDER: NodeGroup[] = [
  "topics",
  "concepts",
  "entities",
  "sources",
  "learning",
  "outputs",
  "content",
  "projects",
  "notes",
  "core",
];

export const GROUP_LABEL: Record<NodeGroup, string> = {
  core: "core/",
  topics: "topics/",
  concepts: "concepts/",
  entities: "entities/",
  sources: "sources/",
  learning: "learning/",
  outputs: "outputs/",
  content: "content/",
  notes: "notes/",
  projects: "projects/",
};
