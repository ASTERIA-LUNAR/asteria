#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Before/after table from two tests/perf3d.js JSON files (round 6: v1-stable baseline vs the round6 branch).
 * Per viewport and quality level, over the 8 sites: average frame rate while orbiting (the browser caps it at 60),
 * median GPU-synced render time, average time from Deploy to the first frame, to the final tile (coarse first frame
 * replaced = level-of-detail refine) and to the full terrain, and the GPU resource counts reported by Three.js
 * (geometries, textures, draw calls, triangles). Exact GPU memory in bytes is not available in browsers.
 * Usage: node tests/perf3d_compare.js tests/perf/round6_baseline.json tests/perf/round6_final.json */
'use strict';
const fs = require('fs');
const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const avg = (r, k) => r.length ? r.reduce((s, x) => s + (x[k] || 0), 0) / r.length : NaN;
const rng = (r, k) => r.length ? Math.min(...r.map(x => x[k])) + '-' + Math.max(...r.map(x => x[k])) : '-';
const f0 = x => Math.round(x), f1 = x => x.toFixed(1);
let md = '| Viewport | Quality | Build | Orbit FPS (avg) | Render ms (avg of site medians) | Deploy -> first frame ms | -> final tile (LOD refine) ms | -> full terrain ms | Geometries | Textures | Draw calls | Triangles (avg) |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n';
for (const vp of ['laptop', 'phone (emulated)']) for (const q of ['low', 'medium', 'high']) for (const [name, d] of [['v1-stable', a], ['round6', b]]) {
  const r = d.filter(x => x.viewport === vp && x.quality === q);
  if (!r.length) continue;
  md += `| ${vp} | ${q} | ${name} | ${f1(avg(r, 'fps'))} | ${f1(avg(r, 'renderMs'))} | ${f0(avg(r, 'firstFramePollMs'))} | ${f0(avg(r, 'tileFinalMs'))} | ${f0(avg(r, 'fullTerrainMs'))} (${rng(r, 'fullTerrainMs')}) | ${rng(r, 'gpuGeometries')} | ${rng(r, 'gpuTextures')} | ${rng(r, 'drawCalls')} | ${f0(avg(r, 'triangles')).toLocaleString('en-US')} |\n`;
}
console.log(md);
