#!/usr/bin/env node
/* Unit tests for the solar power model and the launch-slip scan.
 * Usage: node tests/features_test.js */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('../js/engine.js');
let fails = 0;
function check(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) fails++; }

// ---- 1. Horizontal panel: P = S x A x eta x sin(E) within 0.1 %, with E taken from JPL Horizons
// (cached Apollo 11 case, 2027-04-17 06:30 UTC) and S = 1361 W/m2 scaled to the Sun distance.
global.window = {}; require('../data/validation.js');
const hz = window.LUNA_VALIDATION.angles.find(c => c.siteId === 'apollo11' && c.body === 'Sun' && c.date.startsWith('2027-04-17'));
const site = { lat: hz.lat, lon: hz.lon };
const r = E.sunEarthAt(site, new Date(hz.date));
const AU_KM = 149597870.7;                      // IAU 2012 Resolution B2
const S = 1361 * Math.pow(AU_KM / r.sun.dist_km, 2);
const A = 1, eta = 0.30;
const expected = S * A * eta * Math.sin(hz.hzEl * Math.PI / 180);
const got = E.panelPower({ mode: 'horizontal', area: A, eff: eta }, r.sun.az, r.sun.el, r.sun.dist_km, 1);
const rel = Math.abs(got - expected) / expected;
check('horizontal panel power = S*A*eta*sin(E_Horizons)', rel < 0.001, `E=${hz.hzEl.toFixed(3)} deg, expected ${expected.toFixed(3)} W, got ${got.toFixed(3)} W, rel err ${(rel * 100).toFixed(4)}%`);
// sanity on other orientations
const tr = E.panelPower({ mode: 'track', area: A, eff: eta }, r.sun.az, r.sun.el, r.sun.dist_km, 1);
check('tracking vertical panel = S*A*eta*cos(E)', Math.abs(tr / (S * A * eta * Math.cos(r.sun.el * Math.PI / 180)) - 1) < 1e-6);
const fx = E.panelPower({ mode: 'fixed', area: A, eff: eta, faceAz: r.sun.az }, r.sun.az, r.sun.el, r.sun.dist_km, 1);
check('fixed vertical panel facing the Sun = tracking', Math.abs(fx - tr) < 1e-9);
const back = E.panelPower({ mode: 'fixed', area: A, eff: eta, faceAz: r.sun.az + 180 }, r.sun.az, r.sun.el, r.sun.dist_km, 1);
check('fixed panel facing away gives 0 W', back === 0);
check('half-visible disk halves the power', Math.abs(E.panelPower({ mode: 'track', area: A, eff: eta }, r.sun.az, r.sun.el, r.sun.dist_km, 0.5) - tr / 2) < 1e-9);

// ---- 2. Slip 0 of the launch-slip scan reproduces the main-timeline metrics exactly.
global.window = {}; require('../data/sites.js');
const dir = path.join(__dirname, '..', 'data', 'horizons');
for (const f of fs.readdirSync(dir)) if (f !== 'index.js') require(path.join(dir, f));
for (const [id, days] of [['peak_shackleton', 14], ['apollo11', 30], ['im2', 45]]) {
  const s = window.LUNA_SITES.find(x => x.id === id);
  const mask = window.LUNA_HORIZONS[id] ? window.LUNA_HORIZONS[id].elevations : null;
  const nominal = new Date('2027-03-10T12:00:00Z');
  const scan = E.slipScan({ lat: s.lat, lon: s.lon }, nominal, days, 0, 10, 1, mask);
  const main = E.stats(E.series({ lat: s.lat, lon: s.lon }, nominal, new Date(nominal.getTime() + days * 86400000), undefined, mask));
  const k0 = scan.rows[0];
  const keys = ['pctSun', 'avgSunFrac', 'pctEarth', 'pctBoth', 'longestDarkH', 'longestBlackoutH', 'samples'];
  const same = keys.every(k => k0[k] === main[k]);
  check(`slip 0 == timeline metrics (${id}, ${days} d)`, same, keys.map(k => `${k} ${+k0[k].toFixed(4)}/${+main[k].toFixed(4)}`).join(', '));
  // slip k == timeline starting k days later
  const k5 = scan.rows[5];
  const main5 = E.stats(E.series({ lat: s.lat, lon: s.lon }, new Date(nominal.getTime() + 5 * 86400000), new Date(nominal.getTime() + (5 + days) * 86400000), undefined, mask));
  check(`slip 5 == timeline started 5 days later (${id})`, keys.every(k => Math.abs(k5[k] - main5[k]) < 1e-9));
}
// ---- 3. Earth minimum link elevation (ASTERIA round 2): optional earthMask leaves the default untouched,
// and earthMask = terrain + m is the same as testing Earth elevation > horizon + m.
{
  const s = window.LUNA_SITES.find(x => x.id === 'peak_shackleton_lw'), mask = window.LUNA_HORIZONS[s.id].elevations;
  const a = new Date('2027-05-01T00:00:00Z'), b = new Date('2027-05-15T00:00:00Z');
  const base = E.series({ lat: s.lat, lon: s.lon }, a, b, 10, mask);
  const same = E.series({ lat: s.lat, lon: s.lon }, a, b, 10, mask, mask);
  check('earthMask omitted == earthMask = mask (validated default unchanged)', JSON.stringify(base) === JSON.stringify(same));
  const m = 1, em = mask.map(v => v + m);
  const shifted = E.series({ lat: s.lat, lon: s.lon }, a, b, 10, mask, em);
  const manual = base.earthEl.map((el, i) => el > E.maskAt(mask, base.earthAz[i]) + m);
  check('minimum link elevation 1 deg == Earth el > horizon + 1 deg', shifted.earthUp.every((u, i) => u === manual[i]) && JSON.stringify(shifted.sunUp) === JSON.stringify(base.sunUp),
    `Earth link ${E.stats(base).pctEarth.toFixed(1)}% at 0 deg -> ${E.stats(shifted).pctEarth.toFixed(1)}% at 1 deg`);
  // The worker job code (run here on the main thread) gives the same series as a direct engine call.
  global.window.LunaEngine = E; require('../js/jobs.js');
  const J = window.ASTERIA_JOBS(E);
  const r = J.explorer({ site: { lat: s.lat, lon: s.lon }, start: a.getTime(), end: b.getTime(), step: 10, mask, minEl: m });
  check('jobs.explorer series == engine series (minEl 1)', JSON.stringify(r.series) === JSON.stringify(shifted));
  const ev = r.events.earth;
  check('Earth events alternate rise/set and match the series', ev.every((e, i) => i === 0 || e.type !== ev[i - 1].type) && ev.length === shifted.earthUp.reduce((n, u, i) => n + (i && u !== shifted.earthUp[i - 1] ? 1 : 0), 0), ev.length + ' events');
  check('a minimum elevation can only shorten the Earth link', E.stats(shifted).pctEarth <= E.stats(base).pctEarth && ev.length > 0);
}

// ---- 4. Packaging: js/core.js is an exact rebuild; index.html loads every horizon file.
{
  const built = require('../tools/build_core.js')();
  check('js/core.js is up to date with lib/astronomy + js/engine.js', fs.readFileSync(path.join(__dirname, '..', 'js', 'core.js'), 'utf8') === built);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  global.window = {}; require('../data/horizons/index.js');
  const missing = window.LUNA_HORIZON_IDS.filter(id => html.indexOf('data/horizons/' + id + '.js') < 0);
  check('index.html loads every terrain horizon (' + window.LUNA_HORIZON_IDS.length + ')', !missing.length, missing.join(', '));
}

// ---- 5. Map tiles: every tile the map can request exists (no 404s), size budget, projection matches.
{
  global.window = {}; require('../data/tiles_meta.js');
  const TM = window.LUNA_TILES, root = path.join(__dirname, '..');
  let missing = 0, n = 0;
  const has = (tpl, z, x, y) => { n++; if (!fs.existsSync(path.join(root, tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y)))) missing++; };
  for (let z = 0; z <= 5; z++) for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) { has(TM.layers.hill.path, z, x, y); has(TM.layers.slope.path, z, x, y); }
  for (let z = 0; z <= TM.layers.illum120.maxNativeZoom; z++) for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) has(TM.layers.illum120.path, z, x, y);
  for (const [lay, rs] of [['hill', TM.layers.hill.ranges], ['illum', TM.layers.illum.ranges]])
    for (const z of Object.keys(rs)) { const r = rs[z]; for (let x = r[0]; x <= r[1]; x++) for (let y = r[2]; y <= r[3]; y++) has(TM.layers[lay].path, z, x, y); }
  check('all requestable map tiles exist', missing === 0, `${n} tiles checked, ${missing} missing`);
  const tot = Object.values(TM.sizes_bytes).reduce((a, b) => a + b, 0) / 1e6;
  check('tile set below 80 MB', tot < 80, tot.toFixed(1) + ' MB');
  // map.js projection == tools/tiles.py check: Shackleton centre (IAU) lies in z5 tile (16,16) at pixel (103,86).
  global.window = { LUNA_TILES: TM }; require('../js/map.js');
  const pr = window.AsteriaMap.project(-89.67, 129.78), H = TM.halfExtent_m, scale = 256 * 32 / (2 * H);
  const gx = (pr.x + H) * scale, gy = (H - pr.y) * scale;
  check('map.js projection: Shackleton centre in z5 tile (16,16) px (103,86)', Math.floor(gx / 256) === 16 && Math.floor(gy / 256) === 16 && Math.floor(gx % 256) === 103 && Math.floor(gy % 256) === 86, `tile (${Math.floor(gx / 256)},${Math.floor(gy / 256)}) px (${Math.floor(gx % 256)},${Math.floor(gy % 256)})`);
  const back = window.AsteriaMap.unproject(pr.x, pr.y);
  check('map.js unproject(project(p)) == p', Math.abs(back.lat + 89.67) < 1e-9 && Math.abs(back.lon - 129.78) < 1e-9);
}

// ---- 6. Sites, sources and Artemis III regions (round 2B accuracy audit)
const loadData = (...files) => { for (const f of files) new Function('window', fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))(global.window); };
{
  global.window = {}; loadData('data/sites.js', 'data/horizons/index.js');
  const S = window.LUNA_SITES, REG = window.LUNA_ARTEMIS_REGIONS, root = path.join(__dirname, '..');
  check('every site has sourceType primary/secondary and a sourceCheck', S.every(s => ['primary', 'secondary'].includes(s.sourceType) && s.sourceCheck), S.filter(s => !s.sourceType).map(s => s.id).join(', '));
  check('no Wikipedia source left; Chang\'e-7 target removed', !JSON.stringify(S).toLowerCase().includes('wikipedia') && !S.some(s => s.id === 'change7'));
  const removed = ['cabeus_b', 'haworth', 'nobile', 'de_gerlache', 'slater', 'change7'];
  check('removed points have no site, horizon file or computed rows', removed.every(id => !S.some(s => s.id === id) && !fs.existsSync(path.join(root, 'data', 'horizons', id + '.js')) && !window.LUNA_HORIZON_IDS.includes(id)));
  const plotted = REG.regions.filter(r => r.sites.length);
  check('Artemis III regions: 9 listed, plotted only via landform centres or a published point', REG.regions.length === 9 && plotted.every(r => r.sites.every(id => { const s = S.find(x => x.id === id); return s && (s.landformCentre || s.regionPoint) && s.artemisRegions.includes(r.name); })) && !!REG.notPlottedNote,
    plotted.map(r => r.name).join(', ') + ' plotted; ' + REG.regions.filter(r => !r.sites.length).map(r => r.name).join(', ') + ' by name only');
  const hzFiles = fs.readdirSync(path.join(root, 'data', 'horizons')).filter(f => f !== 'index.js').map(f => f.replace('.js', '')).sort();
  check('horizon files == index == curated south-pole sites', JSON.stringify(hzFiles) === JSON.stringify(window.LUNA_HORIZON_IDS.slice().sort()) && hzFiles.every(id => S.some(s => s.id === id && s.lat <= -79)), hzFiles.join(', '));
  global.window = {}; loadData('data/illumination.js', 'data/illum_crosscheck.js');
  check('one-year table and cross-check list exactly the terrain sites', JSON.stringify(window.LUNA_ILLUMINATION.rows.map(r => r.id).sort()) === JSON.stringify(hzFiles) && JSON.stringify(window.LUNA_XCHECK.sites.map(r => r.id).sort()) === JSON.stringify(hzFiles));
}

// ---- 7. Clicked-point terrain: size limit, decoding, the shipped code reproduces the validation, gating.
{
  const root = path.join(__dirname, '..'), zlib = require('zlib');
  const mb = fs.statSync(path.join(root, 'data', 'dem_coarse.js')).size / 1e6;
  check('downsampled DEM file <= 15 MB', mb <= 15, mb.toFixed(2) + ' MB');
  global.window = {}; loadData('data/dem_coarse.js', 'data/coarse_validation.js', 'data/sites.js', ...fs.readdirSync(path.join(root, 'data', 'horizons')).filter(f => f !== 'index.js').map(f => 'data/horizons/' + f));
  const M = window.LUNA_DEM_COARSE, CV = window.LUNA_COARSE_VALIDATION;
  const raw = zlib.inflateSync(Buffer.from(M.b64, 'base64')), h = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2).slice();
  for (let j = 0; j < M.n; j++) for (let i = 1; i < M.n; i++) h[j * M.n + i] = h[j * M.n + i] + h[j * M.n + i - 1];
  const mn = h.reduce((a, b) => Math.min(a, b)), mx = h.reduce((a, b) => Math.max(a, b));
  check('downsampled DEM decodes to the recorded height range', h.length === M.n * M.n && mn === M.heightRange_m[0] && mx === M.heightRange_m[1], `${M.n}x${M.n}, ${mn}..${mx} m`);
  global.window.LunaEngine = E; loadData('js/jobs.js');
  const J = window.ASTERIA_JOBS(E), dem = { n: M.n, px: M.pixel_m, h };
  const s = window.LUNA_SITES.find(x => x.id === 'im2'), c = J.terrainHorizon(dem, s.lat, s.lon, 2);
  const ref = window.LUNA_HORIZONS.im2.elevations, md = ref.reduce((a, v, i) => a + Math.abs(c.elevations[i] - v), 0) / 360;
  const row = CV.sites.find(r => r.id === 'im2');
  check('shipped DEM + worker code reproduce the stored validation (IM-2 horizon difference)', Math.abs(md - row.hzMeanDiff) < 1e-9, md.toFixed(4) + ' deg');
  check('clicked-point terrain validation passed (criteria met) before shipping', CV.pass && CV.part1.meanAbsSun <= 5 && CV.part1.maxAbsSun <= 10 && CV.part2.meanAbs <= 5,
    `sites |d sunlit| mean ${CV.part1.meanAbsSun.toFixed(2)} max ${CV.part1.maxAbsSun.toFixed(2)}; random vs PGDA mean ${CV.part2.meanAbs.toFixed(2)}`);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  check('app gates terrain for clicked points on the validation result and lazy-loads the DEM', /COARSE_OK = !!\(CV && CV\.pass\)/.test(app) && html.includes('data/coarse_validation.js') && !html.includes('src="data/dem_coarse.js"'));
  check('custom points outside the data use a smooth horizon (no terrain)', J.demCovers(dem, -89, 0) && !J.demCovers(dem, -60, 10));
}

console.log(fails ? `${fails} FAILED` : 'ALL FEATURE TESTS PASS');
process.exit(fails ? 1 : 0);
