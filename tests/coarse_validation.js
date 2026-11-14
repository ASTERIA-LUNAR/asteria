#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Validation of terrain horizons for CLICKED points (downsampled DEM, data/dem_coarse.js), before enabling them.
 *  (1) Every curated south-pole site: horizon from the downsampled DEM vs the curated 20 m-based horizon
 *      (data/horizons/*.js): mean / max |difference| in degrees, and 2027 % sunlit and % Earth visible
 *      (30-minute steps, Sun/Earth centre vs horizon, minimum link elevation 0).
 *  (2) 50 random points in 85-90 S (fixed seed, uniform in area): 18.6-year average illumination (average visible
 *      solar-disk fraction, hourly, the same method and Sun-direction file as the cross-check,
 *      tools/illum_crosscheck.py) vs NASA's published map AVGVISIB_85S_060M_201608 (bilinear).
 * Pass criteria (set before running): (1) mean |d % sunlit| <= 5 points and max <= 10 points;
 *                                     (2) mean |d| vs the published map <= 5 points.
 * Writes data/coarse_validation.js (used by the app and VALIDATION_REPORT.md).
 * Needs dem/work/sun_18p6y.bin and dem/pgda/AVGVISIB_85S_060M_201608.IMG/.LBL (see README).
 * Usage: node tests/coarse_validation.js */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const E = require('../js/engine.js');
const ROOT = path.join(__dirname, '..');
global.window = {};
require('../data/sites.js');
require('../data/dem_coarse.js');
const hzDir = path.join(ROOT, 'data', 'horizons');
for (const f of fs.readdirSync(hzDir)) if (f !== 'index.js') require(path.join(hzDir, f));
window.LunaEngine = E; require('../js/jobs.js');
const J = window.ASTERIA_JOBS(E);

// ---- decode the shipped DEM exactly as the browser does (inflate, undo row differences)
function decodeDem(M) {
  const raw = zlib.inflateSync(Buffer.from(M.b64, 'base64'));
  const h = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2).slice();
  for (let j = 0; j < M.n; j++) { const o = j * M.n; for (let i = 1; i < M.n; i++) h[o + i] = h[o + i] + h[o + i - 1]; }
  return { n: M.n, px: M.pixel_m, h };
}
const M = window.LUNA_DEM_COARSE, dem = decodeDem(M);
const SITES = window.LUNA_SITES.filter(s => window.LUNA_HORIZONS[s.id]);
const fileMB = fs.statSync(path.join(ROOT, 'data', 'dem_coarse.js')).size / 1e6;
console.log(`Downsampled DEM: ${M.n} x ${M.n} at ${M.pixel_m} m, file ${fileMB.toFixed(2)} MB`);

// ---- (1) curated sites
const Y0 = new Date('2027-01-01T00:00:00Z'), Y1 = new Date('2028-01-01T00:00:00Z');
const sites = [];
for (const s of SITES) {
  const ref = window.LUNA_HORIZONS[s.id].elevations;
  const t0 = Date.now(), c = J.terrainHorizon(dem, s.lat, s.lon, 2), ms = Date.now() - t0;
  const d = ref.map((v, i) => Math.abs(c.elevations[i] - v));
  const site = { lat: s.lat, lon: s.lon };
  const a = E.stats(E.series(site, Y0, Y1, 30, ref)), b = E.stats(E.series(site, Y0, Y1, 30, c.elevations));
  sites.push({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, hzMeanDiff: d.reduce((x, y) => x + y, 0) / 360, hzMaxDiff: Math.max(...d),
    height20: window.LUNA_HORIZONS[s.id].siteHeight_m, heightCoarse: c.siteHeight_m, minReach_km: Math.min(...c.reach_km), ms,
    sun20: a.pctSun, sunCoarse: b.pctSun, earth20: a.pctEarth, earthCoarse: b.pctEarth });
}
const dSun = sites.map(r => Math.abs(r.sunCoarse - r.sun20)), dEarth = sites.map(r => Math.abs(r.earthCoarse - r.earth20));
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const part1 = { meanAbsSun: mean(dSun), maxAbsSun: Math.max(...dSun), meanAbsEarth: mean(dEarth), maxAbsEarth: Math.max(...dEarth),
  meanHz: mean(sites.map(r => r.hzMeanDiff)), maxHz: Math.max(...sites.map(r => r.hzMaxDiff)) };
part1.pass = part1.meanAbsSun <= 5 && part1.maxAbsSun <= 10;

// ---- (2) random points vs the published map
function readPgda(base) {
  const lbl = fs.readFileSync(base + '.LBL', 'latin1');
  const num = k => parseFloat(lbl.match(new RegExp('^\\s*' + k + '\\s*=\\s*([-\\d.]+)', 'm'))[1]);
  const n = num('LINES'), buf = fs.readFileSync(base + '.IMG');
  return { n, scale: num('MAP_SCALE'), factor: num('SCALING_FACTOR'), v: new Int16Array(buf.buffer, buf.byteOffset, n * n) };
}
function pgdaAt(P, lat, lon) {
  const p = window.AsteriaMapProject(lat, lon);
  const i = p.x / P.scale + P.n / 2 - 0.5, j = -p.y / P.scale + P.n / 2 - 0.5, i0 = Math.floor(i), j0 = Math.floor(j);
  if (i0 < 0 || j0 < 0 || i0 >= P.n - 1 || j0 >= P.n - 1) return null;
  const fi = i - i0, fj = j - j0, v = P.v, n = P.n, k = j0 * n + i0;
  return (v[k] * (1 - fi) * (1 - fj) + v[k + 1] * fi * (1 - fj) + v[k + n] * (1 - fi) * fj + v[k + n + 1] * fi * fj) * P.factor;
}
window.AsteriaMapProject = (lat, lon) => { const D = Math.PI / 180, r = 2 * 1737400 * Math.tan((90 + lat) * D / 2); return { x: r * Math.sin(lon * D), y: r * Math.cos(lon * D) }; };
// average visible solar-disk fraction (same formula as tools/illum_crosscheck.py illumination())
function avgDiskFraction(lat, lon, mask, sun) {
  const D = Math.PI / 180, la = lat * D, lo = lon * D;
  const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)], ea = [-Math.sin(lo), Math.cos(lo), 0];
  const no = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
  let sum = 0, up_ = 0; const n = sun.length / 5;
  for (let k = 0; k < n; k++) {
    const bx = sun[5 * k + 1], by = sun[5 * k + 2], bz = sun[5 * k + 3], dist = sun[5 * k + 4];
    const el = Math.asin(Math.max(-1, Math.min(1, bx * up[0] + by * up[1] + bz * up[2]))) / D;
    let az = Math.atan2(bx * ea[0] + by * ea[1], bx * no[0] + by * no[1] + bz * no[2]) / D; az = ((az % 360) + 360) % 360;
    const i = Math.floor(az) % 360, f = az - Math.floor(az), hz = mask[i] * (1 - f) + mask[(i + 1) % 360] * f;
    const r = Math.asin(695700 / dist) / D, y = hz - el;
    let fr;
    if (y >= r) fr = 0; else if (y <= -r) fr = 1;
    else fr = (r * r * Math.acos(y / r) - y * Math.sqrt(r * r - y * y)) / (Math.PI * r * r);
    sum += fr; if (el > hz) up_++;
  }
  return { avgDiskFrac: sum / n, pctCentre: 100 * up_ / n };
}
let part2 = null, randoms = [];
const sunFile = path.join(ROOT, 'dem', 'work', 'sun_18p6y.bin'), pgBase = path.join(ROOT, 'dem', 'pgda', 'AVGVISIB_85S_060M_201608');
if (fs.existsSync(sunFile) && fs.existsSync(pgBase + '.IMG')) {
  const b = fs.readFileSync(sunFile), sun = new Float64Array(b.buffer, b.byteOffset, b.length / 8);
  const P = readPgda(pgBase);
  let seed = 20261114; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const rMax = 2 * 1737400 * Math.tan(5 * Math.PI / 360);   // projected radius of 85 S
  while (randoms.length < 50) {
    const x = (2 * rnd() - 1) * rMax, y = (2 * rnd() - 1) * rMax, r = Math.hypot(x, y);
    if (r > rMax) continue;                                   // uniform in area inside 85 S
    const lat = +(-90 + 2 * Math.atan(r / (2 * 1737400)) * 180 / Math.PI).toFixed(5), lon = +(Math.atan2(x, y) * 180 / Math.PI).toFixed(5);
    const pg = pgdaAt(P, lat, lon); if (pg === null) continue;
    const c = J.terrainHorizon(dem, lat, lon, 2), il = avgDiskFraction(lat, lon, c.elevations, sun);
    randoms.push({ lat, lon, ours: il.avgDiskFrac, pctCentre: il.pctCentre, pgda: pg, diffPts: 100 * (il.avgDiskFrac - pg) });
  }
  const dd = randoms.map(r => Math.abs(r.diffPts));
  part2 = { n: randoms.length, meanAbs: mean(dd), maxAbs: Math.max(...dd), medianAbs: dd.slice().sort((a, b) => a - b)[Math.floor(dd.length / 2)],
    within5: dd.filter(v => v <= 5).length, bothZero: randoms.filter(r => r.ours < 0.005 && r.pgda < 0.005).length,
    records: sun.length / 5, span: '2027-01-01 to 2045-08-08 (hourly)', seed: 20261114 };
  part2.pass = part2.meanAbs <= 5;
}
// ---- implementation check: browser code vs tools/terrain.py ray code on the same downsampled grid
let impl = null;
const pyFile = path.join(ROOT, 'dem', 'work', 'coarse_py_horizons.json');
if (fs.existsSync(pyFile)) {
  const py = JSON.parse(fs.readFileSync(pyFile, 'utf8'));
  impl = Object.keys(py).map(id => {
    const c = J.terrainHorizon(dem, py[id].lat, py[id].lon, 2);
    return { id, maxAbsDeg: Math.max(...c.elevations.map((v, i) => Math.abs(v - py[id].elevations[i]))), dHeight_m: c.siteHeight_m - py[id].siteHeight_m };
  });
  impl.pass = impl.every(r => r.maxAbsDeg < 0.01);
  console.log('Implementation check (js/jobs.js vs tools/terrain.py on the same grid): ' + impl.map(r => `${r.id} max ${r.maxAbsDeg.toExponential(1)} deg`).join(', '));
}
const pass = part1.pass && !!part2 && part2.pass && (!impl || impl.every(r => r.maxAbsDeg < 0.01));
const out = { generated: new Date().toISOString(), dem: { pixel_m: M.pixel_m, n: M.n, fileMB, products: M.products }, criteria: {
  sites: 'mean |difference in % sunlit (2027)| <= 5 points and max <= 10 points vs the 20 m-based horizons',
  random: 'mean |difference| in 18.6-year average illumination vs the published PGDA map <= 5 points' },
  part1, sites, part2, randoms, impl, pass };
fs.writeFileSync(path.join(ROOT, 'data', 'coarse_validation.js'), '// Generated by tests/coarse_validation.js\nwindow.LUNA_COARSE_VALIDATION = ' + JSON.stringify(out) + ';\n');

console.log('\n(1) Curated sites: downsampled-DEM horizon vs 20 m-based horizon (2027, 30-min steps)');
console.log('site                 |dHz| mean/max deg   sunlit 20m / coarse   Earth 20m / coarse   ms');
for (const r of sites) console.log(r.id.padEnd(20), (r.hzMeanDiff.toFixed(2) + ' / ' + r.hzMaxDiff.toFixed(2)).padStart(14), (r.sun20.toFixed(1) + ' / ' + r.sunCoarse.toFixed(1)).padStart(18), (r.earth20.toFixed(1) + ' / ' + r.earthCoarse.toFixed(1)).padStart(20), String(r.ms).padStart(5));
console.log(`sunlit |d| mean ${part1.meanAbsSun.toFixed(2)} max ${part1.maxAbsSun.toFixed(2)} pts; Earth |d| mean ${part1.meanAbsEarth.toFixed(2)} max ${part1.maxAbsEarth.toFixed(2)} pts -> ${part1.pass ? 'PASS' : 'FAIL'}`);
if (part2) console.log(`(2) ${part2.n} random points 85-90S vs published map: |d| mean ${part2.meanAbs.toFixed(2)} median ${part2.medianAbs.toFixed(2)} max ${part2.maxAbs.toFixed(2)} pts; within 5 pts: ${part2.within5}; both ~0: ${part2.bothZero} -> ${part2.pass ? 'PASS' : 'FAIL'}`);
else console.log('(2) skipped: dem/work/sun_18p6y.bin or the PGDA map is missing');
console.log('CLICKED-POINT TERRAIN:', pass ? 'PASS' : 'FAIL');
process.exit(0);
