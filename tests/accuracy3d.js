#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* 3D terrain accuracy (round 5, Part 2). Uses the app's own 3D code (js/view3d_math.js, js/map.js) in Node and
 * compares it with an independent Python computation from the LOLA DEMs (tools/accuracy3d.py):
 *  1. Heights: EVERY grid point of every 6 km tile, extended ring (16 km, 40 km) and 5 m patch vs a direct bilinear
 *     sample of the source LOLA DEM (Python; node positions by an independent vector formula). Limit 1 m.
 *  2. Slopes at 200 random tile grid points (25 per site) and 40 points of the 5 m patches: the rover's slope readout
 *     (view3d_math.slopeAt, as shown in Rover mode) vs Python central differences of the DEM at the same spacing
 *     (method: dh/de = (h(e+d) - h(e-d)) / 2d, dh/dn likewise, slope = atan(|grad h|), d = grid spacing, e/n = true
 *     ground east/north distances). Also vs the 2D map's slope layer at the same points (its PNG pixel class; the
 *     map uses central differences on a 37 m grid averaged to 74 m pixels, reproduced in Python).
 *  3. Positions: 20 random rover positions: the displayed lat/lon (4 decimals), projected with the 2D map's own
 *     projection (js/map.js), must land within one DEM cell of the rover's true position; the displayed elevation
 *     (1 decimal) must equal the DEM height there within 1 m.
 * Writes data/accuracy3d.js (Validation page, VALIDATION_REPORT.md section G). The Python result is cached in
 * tests/accuracy3d_python.json and reused while the sample points are unchanged (so this reruns without the DEMs).
 * Usage: node tests/accuracy3d.js [--python]   (--python forces a new Python run) */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const M = require('../js/view3d_math.js');
const ROOT = path.join(__dirname, '..');
const PTS = path.join(ROOT, 'dem', 'work', 'accuracy3d_points.json'), PYOUT = path.join(__dirname, 'accuracy3d_python.json');
const H_LIMIT = 1.0;
// Slope tolerance = what the height storage step alone can cause: each stored height is within unit/2 of the DEM,
// so each central difference is within (unit/2)/d and the gradient within sqrt(2)(unit/2)/d.
const slopeBound = (unit, d) => Math.atan(Math.SQRT2 * unit / 2 / d) * 180 / Math.PI;

global.window = {};
require('../data/sites.js'); require('../data/tiles_meta.js');
const ids = (function () { require('../data/terrain3d/index.js'); return window.ASTERIA_TERRAIN3D_IDS; })();
require('../data/terrain3d/hi5m_index.js');
for (const id of ids) require('../data/terrain3d/' + id + '.js');
for (const id of window.ASTERIA_TERRAIN3D_5M_IDS) require('../data/terrain3d/hi5m/' + id + '.js');
require('../js/map.js');
const nameOf = id => window.LUNA_SITES.find(s => s.id === id).name;

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// The pre-round-5 readout (gradient of the bilinear surface inside one cell), kept here only to report the change.
function oldSlope(T, e, n) {
  if (T.patch && Math.abs(e) <= T.patch.half && Math.abs(n) <= T.patch.half) return oldSlope(T.patch, e, n);
  const fi = e / T.d + T.c, fj = T.c - n / T.d, i = Math.max(0, Math.min(T.n - 2, Math.floor(fi))), j = Math.max(0, Math.min(T.n - 2, Math.floor(fj))), a = fi - i, b = fj - j;
  const nd = (ii, jj) => T.H[jj * T.n + ii], h00 = nd(i, j), h10 = nd(i + 1, j), h01 = nd(i, j + 1), h11 = nd(i + 1, j + 1);
  const de = ((h10 - h00) * (1 - b) + (h11 - h01) * b) / T.d, dn = -((h01 - h00) * (1 - a) + (h11 - h10) * a) / T.d;
  return Math.atan(Math.hypot(de, dn)) * 180 / Math.PI;
}
// What Rover mode displays (js/view3d.js roverReadout): same functions and formatting.
function readout(T, e, n) {
  const h = M.heightAt(T, e, n), sl = M.slopeAt(T, e, n), ll = M.latLonAt(T.meta.lat, T.meta.lon, e, n, T.R);
  return { h, slope: sl.slope, lat: ll.lat, lon: ll.lon, latTxt: ll.lat.toFixed(4), lonTxt: ll.lon.toFixed(4), elevTxt: h.toFixed(1) + ' m' };
}

function points() {
  const rnd = mulberry32(5150), slopes = [], positions = [];
  ids.forEach(id => {
    const T = M.decodeTile(window.ASTERIA_TERRAIN3D[id]);
    for (let k = 0; k < 25; k++) {
      const i = 1 + Math.floor(rnd() * (T.n - 2)), j = 1 + Math.floor(rnd() * (T.n - 2)), e = (i - T.c) * T.d, n = (T.c - j) * T.d;
      slopes.push({ siteId: id, grid: 'tile', dem: T.meta.demProduct, d: T.d, unit: T.meta.unit_m, i, j, e, n, readout: M.slopeAt(T, e, n).slope, mesh: null, old: oldSlope(T, e, n) });
    }
  });
  window.ASTERIA_TERRAIN3D_5M_IDS.forEach(id => {
    const P = M.decodeTile(window.ASTERIA_TERRAIN3D_5M[id]), T = M.decodeTile(window.ASTERIA_TERRAIN3D[id]);
    T.patch = P;                                   // High quality: the rover reads the 5 m patch near the site
    for (let k = 0; k < 14; k++) {
      const i = 2 + Math.floor(rnd() * (P.n - 4)), j = 2 + Math.floor(rnd() * (P.n - 4)), e = (i - P.c) * P.d, n = (P.c - j) * P.d;
      slopes.push({ siteId: id, grid: '5m', dem: P.meta.demProduct, d: P.d, unit: P.meta.unit_m, i, j, e, n, readout: M.slopeAt(T, e, n).slope, old: oldSlope(T, e, n) });
    }
  });
  // mesh slope attribute (slope shading) at the same nodes = the same formula (checked, not just assumed)
  ids.forEach(id => {
    const T = M.decodeTile(window.ASTERIA_TERRAIN3D[id]), G = M.buildGridMesh(T, 1, 0, null, T);
    slopes.filter(p => p.siteId === id && p.grid === 'tile').forEach(p => { p.mesh = G.slope[p.j * G.m + p.i]; });
  });
  for (let k = 0; k < 20; k++) {
    const id = ids[k % ids.length], T = M.decodeTile(window.ASTERIA_TERRAIN3D[id]);
    const usePatch = k >= 14 && window.ASTERIA_TERRAIN3D_5M_IDS.includes(id) ? true : false;
    const pid = usePatch ? id : null;
    let lim = T.half - T.d;
    if (k >= 14) {               // last 6: High quality at a 5 m site, within the patch
      const sid = window.ASTERIA_TERRAIN3D_5M_IDS[k % window.ASTERIA_TERRAIN3D_5M_IDS.length];
      const T2 = M.decodeTile(window.ASTERIA_TERRAIN3D[sid]), P = M.decodeTile(window.ASTERIA_TERRAIN3D_5M[sid]); T2.patch = P;
      const e = (rnd() * 2 - 1) * (P.half - 10), n = (rnd() * 2 - 1) * (P.half - 10), r = readout(T2, e, n);
      const xy = window.AsteriaMap.project(+r.latTxt, +r.lonTxt);
      positions.push(Object.assign({ siteId: sid, quality: 'High (5 m patch)', dem: P.meta.demProduct, cell_m: P.d, e, n, mapX: xy.x, mapY: xy.y, lat0: T2.meta.lat, lon0: T2.meta.lon }, r));
      continue;
    }
    const e = (rnd() * 2 - 1) * lim, n = (rnd() * 2 - 1) * lim, r = readout(T, e, n);
    const xy = window.AsteriaMap.project(+r.latTxt, +r.lonTxt);
    positions.push(Object.assign({ siteId: id, quality: 'Low/Medium (tile)', dem: T.meta.demProduct, cell_m: T.d, e, n, mapX: xy.x, mapY: xy.y, lat0: T.meta.lat, lon0: T.meta.lon }, r));
    void pid;
  }
  return { slopes, positions };
}

function python(P, force) {
  const key = crypto.createHash('sha1').update(JSON.stringify(P)).digest('hex');
  if (!force && fs.existsSync(PYOUT)) { const c = JSON.parse(fs.readFileSync(PYOUT, 'utf8')); if (c.pointsKey === key) return c; }
  fs.mkdirSync(path.dirname(PTS), { recursive: true });
  fs.writeFileSync(PTS, JSON.stringify(Object.assign({ pointsKey: key }, P)));
  const py = path.join(ROOT, '.venv', 'Scripts', 'python.exe');
  console.log('Running tools/accuracy3d.py (LOLA DEMs, every grid point) ...');
  cp.execFileSync(fs.existsSync(py) ? py : 'python', ['-I', path.join(ROOT, 'tools', 'accuracy3d.py'), PTS, PYOUT], { stdio: 'inherit', cwd: ROOT });
  return JSON.parse(fs.readFileSync(PYOUT, 'utf8'));
}

function stat(a) { const b = a.map(Math.abs); return { n: b.length, max: Math.max(...b), mean: b.reduce((x, y) => x + y, 0) / b.length }; }

function run(force) {
  const P = points(), Y = python(P, force);
  // ---- heights
  const PRODUCT = { tile: '6 km tile', ringA: 'Ring A (to 16 km)', ringB: 'Ring B (to 40 km)', patch5m: '5 m patch (2 km)' };
  const hrows = Y.heights.map(r => Object.assign({ name: nameOf(r.siteId), product: PRODUCT[r.kind] }, r));
  const hpts = hrows.reduce((a, r) => a + r.points, 0), hworst = Math.max(...hrows.map(r => r.max)), hmean = hrows.reduce((a, r) => a + r.mean * r.points, 0) / hpts;
  // ---- slopes
  const S = P.slopes.map((p, k) => Object.assign({}, p, Y.slopes[k]));
  S.forEach(p => { p.bound = slopeBound(p.unit, p.d); p.ok = Math.abs(p.readout - p.py) <= p.bound; });
  const tileS = S.filter(p => p.grid === 'tile'), p5 = S.filter(p => p.grid === '5m');
  const bT = Math.max(...tileS.map(p => p.bound)), b5 = Math.max(...p5.map(p => p.bound));
  const dNew = stat(tileS.map(p => p.readout - p.py)), d5 = stat(p5.map(p => p.readout - p.py)), dOld = stat(tileS.map(p => p.old - p.py));
  const dOld5 = stat(p5.map(p => p.old - p.py)), dMesh = stat(tileS.map(p => p.mesh - p.readout));
  const mapOk = tileS.filter(p => p.mapClassPy === p.mapClassPng).length;
  const dMap = stat(tileS.map(p => p.readout - p.mapPy)), dMap74 = stat(tileS.map(p => p.py74 - p.mapPy));
  const inClass = tileS.filter(p => p.readout >= p.mapLo && p.readout < p.mapHi).length;
  const slope = {
    method: 'Same method in both: central differences over one grid spacing d of the bilinear DEM heights in the site\'s true ground east/north directions, dh/de = (h(e+d) - h(e-d)) / 2d, dh/dn = (h(n+d) - h(n-d)) / 2d, slope = atan(sqrt(dh/de^2 + dh/dn^2)). The 3D readout uses the stored grid (js/view3d_math.js slopeAt); Python samples the LOLA DEM directly at the geographic positions of those points (tools/accuracy3d.py). d = 20 m or 80 m (6 km tile) and 5 m (patch). The 2D map\'s slope layer uses the same formula on a 37 m sample grid (np.gradient), averaged over 2 x 2 samples into 74 m pixels and shown in 8 classes (tools/tiles.py).',
    rows: [
      { what: 'Rover readout vs Python, tile grid points (20 m / 80 m)', n: dNew.n, max: dNew.max, mean: dNew.mean, note: tileS.filter(p => p.ok).length + ' of ' + tileS.length + ' within the storage-step bound (' + Math.min(...tileS.map(p => p.bound)).toFixed(2) + '-' + bT.toFixed(2) + ' deg for 80 m / 20 m spacing)' },
      { what: 'Rover readout vs Python, 5 m patch points (High quality)', n: d5.n, max: d5.max, mean: d5.mean, note: p5.filter(p => p.ok).length + ' of ' + p5.length + ' within the storage-step bound (' + b5.toFixed(2) + ' deg at 5 m spacing)' },
      { what: '3D slope shading (mesh attribute) vs rover readout, same points', n: dMesh.n, max: dMesh.max, mean: dMesh.mean, note: 'same formula, same heights' },
      { what: 'Before the fix: old rover readout (bilinear gradient inside one cell) vs Python, tile points', n: dOld.n, max: dOld.max, mean: dOld.mean, note: 'different method (one-sided over one cell); fixed this round' },
      { what: 'Before the fix: old readout vs Python, 5 m patch points', n: dOld5.n, max: dOld5.max, mean: dOld5.mean, note: 'fixed this round' },
      { what: '2D map layer: Python reproduction of the 74 m pixel vs the map\'s stored class', n: tileS.length, max: 0, mean: 0, note: mapOk + ' of ' + tileS.length + ' in the same class' },
      { what: 'Rover readout (20 m / 80 m) vs the 2D map\'s 74 m pixel value at the same points', n: dMap.n, max: dMap.max, mean: dMap.mean, note: 'different pixel size, not an error; ' + inClass + ' of ' + tileS.length + ' readouts fall in the map pixel\'s class' },
      { what: 'Python at 37 m spacing (no 74 m averaging) vs the 2D map\'s 74 m pixel value', n: dMap74.n, max: dMap74.max, mean: dMap74.mean, note: 'effect of averaging alone' }
    ],
    maxReadout: Math.max(dNew.max, d5.max)
  };
  slope.bound = 'Tolerance: the error that the 0.1 m height storage step alone can cause, atan(sqrt(2) x 0.05 m / d): ' + slopeBound(0.1, 80).toFixed(2) + ' deg at 80 m, ' + slopeBound(0.1, 20).toFixed(2) + ' deg at 20 m, ' + slopeBound(0.1, 5).toFixed(2) + ' deg at 5 m spacing.';
  slope.pass = S.every(p => p.ok) && dMesh.max < 1e-3 && mapOk >= tileS.length - 2;
  slope.finding = `Finding: before this round the rover readout used the gradient of the bilinear surface inside one grid cell (one-sided differences), while the 3D slope shading used central differences; against the DEM-derived central-difference slope the old readout differed by up to ${dOld.max.toFixed(1)} deg (mean ${dOld.mean.toFixed(2)} deg) on the 6 km tiles and ${dOld5.max.toFixed(1)} deg on the 5 m patches. The readout (js/view3d_math.js slopeAt) now uses central differences over one grid spacing, the same formula as the slope shading and as the Python check: max difference ${dNew.max.toFixed(3)} deg (tile) and ${d5.max.toFixed(3)} deg (5 m), every point within the storage-step bound. The 2D map's slope layer is correct for its own 74 m pixels (${mapOk}/${tileS.length} classes reproduced); it is smoother than the 3D readout because of its larger pixels (mean difference ${dMap.mean.toFixed(1)} deg), which the map legend states.`;
  // ---- positions
  const pos = P.positions.map((p, k) => Object.assign({ name: nameOf(p.siteId) }, p, Y.positions[k]));
  pos.forEach(p => { p.elevDiff = parseFloat(p.elevTxt) - p.demH; p.pass = p.backDist_m <= p.cell_m && Math.abs(p.elevDiff) <= H_LIMIT; });
  const positions = {
    method: 'Rover positions chosen at random inside the drawn tile (14 on the 6 km tiles as at Low/Medium quality, 6 inside the 5 m patches as at High). The latitude/longitude the Rover panel displays (4 decimals) is converted with the 2D map\'s own projection (js/map.js project: south polar stereographic) and compared with the rover\'s true position, computed independently in Python (site-frame east/north -> great-circle position -> the DEM\'s stereographic grid). The displayed elevation (1 decimal) is compared with a bilinear sample of the LOLA DEM (the tile\'s product, or LDEM_875S_5M inside the patch) at the displayed latitude/longitude.',
    rows: pos, n: pos.length, maxBack_m: Math.max(...pos.map(p => p.backDist_m)), maxElev_m: Math.max(...pos.map(p => Math.abs(p.elevDiff))), pass: pos.every(p => p.pass)
  };
  const heights = { method: 'Every stored grid point of every 3D terrain product (the 6 km tile of each of the 8 sites, ring A to 16 km, ring B to 40 km, and the three 5 m patches): its geographic position is computed independently (site up vector rotated by the ground distance; not the great-circle routine the generators use), and the LOLA DEM the product names is sampled there directly (bilinear, raw PDS array). Differences come from the 0.1 m (0.2 m where the relief is larger) storage step.', rows: hrows, points: hpts, worst: hworst, mean: hmean, pass: hworst <= H_LIMIT };
  return { generated: new Date().toISOString(), pass: heights.pass && slope.pass && positions.pass, heights, slope, positions, pythonRun: Y.generated };
}

if (require.main === module) {
  const A = run(process.argv.includes('--python'));
  fs.writeFileSync(path.join(ROOT, 'data', 'accuracy3d.js'), '// Generated by tests/accuracy3d.js and tools/accuracy3d.py - do not edit\nwindow.LUNA_ACCURACY3D = ' + JSON.stringify(A, (k, v) => typeof v === 'number' ? +v.toFixed(6) : v, 1) + ';\n');
  for (const r of A.heights.rows) console.log(`${r.siteId.padEnd(20)} ${r.product.padEnd(18)} ${String(r.points).padStart(7)} pts  max ${r.max.toFixed(3)} m  mean ${r.mean.toFixed(3)} m`);
  console.log(`Heights: ${A.heights.points} grid points, max ${A.heights.worst.toFixed(3)} m, mean ${A.heights.mean.toFixed(3)} m -> ${A.heights.pass ? 'PASS' : 'FAIL'}`);
  for (const r of A.slope.rows) console.log(`Slope: ${r.what}: n ${r.n}, max ${r.max.toFixed(3)}, mean ${r.mean.toFixed(3)} (${r.note})`);
  console.log(`Slopes -> ${A.slope.pass ? 'PASS' : 'FAIL'}`);
  for (const p of A.positions.rows) console.log(`Pos ${p.siteId.padEnd(20)} ${p.quality.padEnd(18)} back ${p.backDist_m.toFixed(2)} m (cell ${p.cell_m}) elev ${p.elevTxt} vs DEM ${p.demH.toFixed(2)} (${p.elevDiff.toFixed(2)}) ${p.pass ? 'PASS' : 'FAIL'}`);
  console.log(`Positions -> ${A.positions.pass ? 'PASS' : 'FAIL'}`);
  console.log(A.pass ? 'PASS' : 'FAIL');
  process.exit(A.pass ? 0 : 1);
}
module.exports = { run };
