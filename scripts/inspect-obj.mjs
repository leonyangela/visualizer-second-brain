// Lists the connected pieces of an OBJ mesh with their size and bounds.
import { readFileSync } from "node:fs";

const file = process.argv[2];
const verts = [];
const faces = [];
for (const line of readFileSync(file, "utf8").split("\n")) {
  if (line.startsWith("v ")) {
    const [, x, y, z] = line.trim().split(/\s+/).map(Number);
    verts.push([x, y, z]);
  } else if (line.startsWith("f ")) {
    faces.push(line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1));
  }
}

const parent = new Int32Array(verts.length).map((_, i) => i);
const find = (i) => {
  while (parent[i] !== i) i = parent[i] = parent[parent[i]];
  return i;
};
for (const f of faces) for (let k = 1; k < f.length; k++) parent[find(f[k])] = find(f[0]);

const parts = new Map();
faces.forEach((f) => {
  const r = find(f[0]);
  if (!parts.has(r)) parts.set(r, { faces: 0, verts: new Set(), min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  const p = parts.get(r);
  p.faces++;
  for (const v of f) {
    p.verts.add(v);
    for (let a = 0; a < 3; a++) {
      p.min[a] = Math.min(p.min[a], verts[v][a]);
      p.max[a] = Math.max(p.max[a], verts[v][a]);
    }
  }
});

const list = [...parts.values()].sort((a, b) => b.faces - a.faces);
console.log(`${verts.length} verts, ${faces.length} faces, ${list.length} pieces`);
list.slice(0, 25).forEach((p, i) => {
  const size = p.max.map((m, a) => (m - p.min[a]).toFixed(3));
  console.log(i, "faces", p.faces, "verts", p.verts.size, "size", size.join(" x "), "min", p.min.map((n) => n.toFixed(3)).join(","), "max", p.max.map((n) => n.toFixed(3)).join(","));
});

// Optional: slice one piece by height to see its shape, e.g. `node scripts/inspect-obj.mjs file.obj 1`
const sliceIndex = process.argv[3];
if (sliceIndex !== undefined) {
  const p = list[Number(sliceIndex)];
  const ys = [...p.verts].map((v) => verts[v]);
  const steps = 10;
  for (let s = 0; s < steps; s++) {
    const lo = p.min[1] + ((p.max[1] - p.min[1]) * s) / steps;
    const hi = lo + (p.max[1] - p.min[1]) / steps;
    const band = ys.filter((v) => v[1] >= lo && v[1] < hi);
    if (!band.length) continue;
    const ext = (a) => (Math.max(...band.map((v) => v[a])) - Math.min(...band.map((v) => v[a]))).toFixed(3);
    const cx = (band.reduce((t, v) => t + v[0], 0) / band.length).toFixed(3);
    const cz = (band.reduce((t, v) => t + v[2], 0) / band.length).toFixed(3);
    console.log(`  y ${lo.toFixed(2)}-${hi.toFixed(2)}  n ${band.length}  width(x) ${ext(0)}  depth(z) ${ext(2)}  centre ${cx},${cz}`);
  }
}
