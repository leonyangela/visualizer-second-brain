// Cleans the CGTrader brain OBJ for the particle view: keeps only the cerebrum (the two
// hemispheres) and drops the cerebellum, brain stem and inner structures.
//   node scripts/clean-model.mjs public/models/Brain_Model.obj public/models/brain-clean.obj
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
const verts = [];
const faces = [];
for (const line of readFileSync(input, "utf8").split("\n")) {
  if (line.startsWith("v ")) verts.push(line.trim().split(/\s+/).slice(1, 4).map(Number));
  else if (line.startsWith("f ")) faces.push(line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1));
}

// Group faces into connected pieces.
const parent = new Int32Array(verts.length).map((_, i) => i);
const find = (i) => {
  while (parent[i] !== i) i = parent[i] = parent[parent[i]];
  return i;
};
for (const f of faces) for (let k = 1; k < f.length; k++) parent[find(f[k])] = find(f[0]);
const facesByPiece = new Map();
faces.forEach((f) => {
  const r = find(f[0]);
  facesByPiece.set(r, [...(facesByPiece.get(r) ?? []), f]);
});
const pieces = [...facesByPiece.values()].sort((a, b) => b.length - a.length);

// The hemispheres are the only pieces that reach the top of the brain.
const topOf = (piece) => piece.flat().reduce((top, v) => Math.max(top, verts[v][1]), -Infinity);
const modelTop = verts.reduce((top, v) => Math.max(top, v[1]), -Infinity);
const hemispheres = pieces.filter((piece) => topOf(piece) > modelTop - 0.05);
if (hemispheres.length !== 2) throw new Error(`expected 2 hemispheres, found ${hemispheres.length}`);
const keep = hemispheres.flat();

const remap = new Map();
const outV = [];
const outF = keep.map((f) =>
  f.map((v) => {
    if (!remap.has(v)) {
      remap.set(v, remap.size + 1);
      outV.push(`v ${verts[v].join(" ")}`);
    }
    return remap.get(v);
  }),
);
writeFileSync(output, [...outV, ...outF.map((f) => `f ${f.join(" ")}`)].join("\n") + "\n");
console.log(`kept ${outF.length} of ${faces.length} faces, ${outV.length} vertices -> ${output}`);
