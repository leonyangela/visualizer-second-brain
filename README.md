# Brain 3D

A futuristic 3D brain that visualizes an Obsidian vault built with the LLM Wiki pattern. Wiki pages become glowing nodes in brain regions, `[[wikilinks]]` become arcs with travelling pulses, raw sources flow in and outputs flow out, and a terminal-style HUD shows live stats from the vault.

The app reads the vault **read-only**. It never writes to it.

## Run it

```bash
cp .env.example .env.local   # then set VAULT_PATH to your vault
npm install
npm run dev
```

Open http://localhost:3000. Refresh to pick up new pages.

- Hover a node: title, summary, link count
- Click a node: opens the page in Obsidian
- Click a group in the INDEX card: hide or show it
- Drag to orbit, scroll to zoom

## Brain model

Put a model at `public/models/brain.glb`. Without one, a procedural stand-in brain is used. Model files are git-ignored so licensed assets are never committed.

If the model faces the wrong way, change `MODEL_ROTATION` in `src/components/scene/brain-geometry.ts`.

### Preparing the CGTrader brain model

The source OBJ also has the cerebellum, brain stem, and inner structures that show through the see-through particle cloud as solid shapes. `scripts/clean-model.mjs` keeps only the cerebrum (the two hemispheres):

```bash
node scripts/inspect-obj.mjs public/models/Brain_Model.obj          # list the mesh's connected pieces
node scripts/clean-model.mjs public/models/Brain_Model.obj public/models/brain-clean.obj
cd public/models
npx obj2gltf@3 -i brain-clean.obj -o brain-raw.glb
npx @gltf-transform/cli@4 meshopt brain-raw.glb brain.glb
rm brain-raw.glb brain-clean.obj
```

## Keyboard

- `H`: hide or show the HUD panels to see the whole brain

## How it works

- `src/lib/vault/read-vault.ts` reads `wiki/**` and `projects/**` (frontmatter, titles, wikilinks, summaries from `wiki/index.md`), plus `raw/` file names, `wiki/log.md`, the learning tracker, ideas, and toolbox categories. Runs on the server at request time.
- `src/components/scene/` is the React Three Fiber scene: point-cloud brain (`BrainCloud`), nodes (`NodeField`), link arcs (`LinkArcs`), file streams (`FileStream`), bloom.
- `src/components/hud/Hud.tsx` is the overlay.

## Stack

Next.js 16 (App Router, Cache Components), TypeScript, React Three Fiber, drei, postprocessing, Tailwind CSS, gray-matter.
