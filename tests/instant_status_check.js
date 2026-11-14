#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Instant status check (independent: JPL Horizons + Python terrain).
 *
 * For every curated south-pole site with a terrain horizon, at the "current time" (whole minute when the cases were
 * chosen) and at 20 random whole-minute times in 2026-2028 (seeded, per site):
 *   - Sun and Earth apparent azimuth/elevation are taken DIRECTLY from the JPL Horizons API (same settings as
 *     tests/horizons_api.js; one TLIST query per site and body; responses cached in tests/horizons_cache/);
 *   - the terrain horizon height at exactly those azimuths is computed by tools/terrain.py horizon_at from the LOLA
 *     DEMs (Python, not the app's JavaScript and not the stored data/horizons masks; result cached in
 *     tests/instant_terrain.json so the check reruns without the DEMs);
 *   - independent status: "Sun up" = Sun centre above that horizon; "Earth visible" = Earth centre above it
 *     (minimum link elevation 0);
 *   - the app's status for the same site and time: the engine's series sample with the stored horizon mask, exactly
 *     as the main view computes it (js/engine.js series(): el > maskAt(mask, az)).
 * They must agree in every case, except where the body is within EDGE_DEG of the horizon ("on the edge", reported
 * separately). Writes data/instant_status.js (read by tests/validate.js and the Validation page).
 *
 * Usage: node tests/instant_status_check.js [--new]   (--new chooses new cases, with "now" = the current minute)
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const E = require('../js/engine.js');
const HZ = require('./horizons_api.js');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'instant_status.js');
const TERR = path.join(__dirname, 'instant_terrain.json');
const EDGE_DEG = 0.05, N_RANDOM = 20;

global.window = global.window || {};
require('../data/sites.js');
const HDIR = path.join(ROOT, 'data', 'horizons');
for (const f of fs.readdirSync(HDIR)) require(path.join(HDIR, f));

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const isoMin = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';

function loadOld() {
  if (!fs.existsSync(OUT)) return null;
  const w = {}; new Function('window', fs.readFileSync(OUT, 'utf8'))(w); return w.LUNA_INSTANT;
}
function chooseCases() {
  const now = Math.floor(Date.now() / 60000) * 60000;
  const t0 = Date.UTC(2026, 0, 1), minutes = (Date.UTC(2029, 0, 1) - t0) / 60000;
  return window.LUNA_HORIZON_IDS.map((id, k) => {
    const s = window.LUNA_SITES.find(x => x.id === id), rnd = mulberry32(20261114 + 97 * k), times = [isoMin(now)];
    while (times.length < 1 + N_RANDOM) { const t = isoMin(t0 + Math.floor(rnd() * minutes) * 60000); if (!times.includes(t)) times.push(t); }
    const nowT = times[0]; times.sort();       // Horizons returns TLIST rows in time order
    return { siteId: id, name: s.name, lat: s.lat, lon: s.lon, now: nowT, times };
  });
}

async function horizonsRows(site, cmd) {
  const tl = site.times.map(t => `'${HZ.fmtH(new Date(t))}'`).join(' ');
  const h = await HZ.horizons({ COMMAND: cmd, SITE_COORD: HZ.siteCoord(site), TLIST: tl });
  const rows = HZ.parseRows(h.text);
  if (rows.length !== site.times.length) throw new Error('Horizons returned ' + rows.length + ' rows for ' + site.times.length + ' times');
  rows.forEach((r, i) => { if (Math.abs(r.t - Date.parse(site.times[i])) > 1000) throw new Error('time mismatch ' + site.siteId); });
  return { rows, file: path.relative(ROOT, h.file).replace(/\\/g, '/'), url: h.url };
}

function pythonTerrain(jobs) {
  // reuse the cached Python result when it covers exactly these sites and azimuths
  if (fs.existsSync(TERR)) {
    const c = JSON.parse(fs.readFileSync(TERR, 'utf8'));
    const ok = jobs.every(j => { const r = c.results.find(x => x.key === j.key); return r && r.rows.length === j.az.length && r.rows.every((q, i) => Math.abs(q.az - j.az[i]) < 1e-9); });
    if (ok) return c;
  }
  const py = path.join(ROOT, '.venv', 'Scripts', 'python.exe'), pyx = fs.existsSync(py) ? py : 'python';
  const tmp = path.join(ROOT, 'dem', 'work'); fs.mkdirSync(tmp, { recursive: true });
  const inp = path.join(tmp, 'instant_jobs.json');
  fs.writeFileSync(inp, JSON.stringify(jobs));
  console.log('Running tools/terrain.py horizon_at (LOLA DEMs) ...');
  cp.execFileSync(pyx, ['-I', path.join(ROOT, 'tools', 'terrain.py'), 'horizon_at', inp, TERR], { stdio: 'inherit', cwd: ROOT });
  return JSON.parse(fs.readFileSync(TERR, 'utf8'));
}

async function run(opts) {
  opts = opts || {};
  let old = loadOld(), cases;
  if (opts.fresh || !old) cases = chooseCases(); else cases = old.cases;
  const HR = {};
  for (const c of cases) {
    HR[c.siteId] = { sun: await horizonsRows(c, "'10'"), earth: await horizonsRows(c, "'399'") };
  }
  const jobs = cases.map(c => ({ key: c.siteId, lat: c.lat, lon: c.lon, az: [].concat(HR[c.siteId].sun.rows.map(r => r.az), HR[c.siteId].earth.rows.map(r => r.az)) }));
  const PT = pythonTerrain(jobs);
  const rows = [];
  for (const c of cases) {
    const mask = window.LUNA_HORIZONS[c.siteId].elevations, n = c.times.length;
    const pr = PT.results.find(x => x.key === c.siteId).rows;
    c.times.forEach((t, i) => {
      // the app's own computation for this site and time (main view: engine series sample, stored mask, min elevation 0)
      const s = E.series({ lat: c.lat, lon: c.lon }, new Date(t), new Date(t), 10, mask, mask);
      [['sun', HR[c.siteId].sun.rows[i], pr[i], s.sunUp[0], s.sunEl[0], s.sunAz[0]], ['earth', HR[c.siteId].earth.rows[i], pr[n + i], s.earthUp[0], s.earthEl[0], s.earthAz[0]]].forEach(b => {
        const hz = b[1], ph = b[2].horizon_deg, indep = hz.el > ph, app = b[3], margin = hz.el - ph;
        const edge = Math.abs(margin) < EDGE_DEG;
        rows.push({ siteId: c.siteId, name: c.name, t, now: t === c.now, body: b[0], hzAz: hz.az, hzEl: hz.el, pyHorizon: ph, pyHorizonAt_km: b[2].at_km,
          appAz: b[5], appEl: b[4], appHorizon: E.maskAt(mask, b[5]), margin, indep, app, agree: indep === app, edge });
      });
    });
  }
  const bad = rows.filter(r => !r.agree && !r.edge), edges = rows.filter(r => r.edge);
  const now = cases[0].now;
  const nowRows = rows.filter(r => r.now && r.body === 'sun');
  const res = {
    generated: new Date().toISOString(), casesChosen: old && !opts.fresh ? old.casesChosen : new Date().toISOString(), now, edgeDeg: EDGE_DEG,
    selection: 'per site: the current whole minute when the cases were chosen, plus ' + N_RANDOM + ' whole-minute times uniform in 2026-01-01..2028-12-31 UTC (seeded PRNG, seed 20261114 + 97 x site index)',
    method: 'Sun (10) and Earth (399) apparent azimuth/elevation from the JPL Horizons API (observer on the Moon at the site, geodetic, height 0, QUANTITIES 4, APPARENT AIRLESS, UT; one TLIST query per site and body); terrain horizon at exactly those azimuths from tools/terrain.py horizon_at (LOLA DEMs, observer 2 m above the surface, rays to 300 km, lunar curvature); up = centre above that horizon (Earth minimum elevation 0). App = js/engine.js series sample with the stored horizon mask (as in the main view).',
    cases, horizonsFiles: Object.fromEntries(Object.entries(HR).map(([k, v]) => [k, { sun: v.sun.file, earth: v.earth.file }])),
    n: rows.length, agree: rows.filter(r => r.agree).length, disagreeOutsideEdge: bad.length, edgeCount: edges.length,
    edgeDisagree: edges.filter(r => !r.agree).length,
    maxElDiff: Math.max(...rows.map(r => Math.abs(r.appEl - r.hzEl))),
    maxAzDiff: Math.max(...rows.map(r => Math.abs(HZ.azDiff(r.appAz, r.hzAz)))),
    maxHorizonDiff: Math.max(...rows.map(r => Math.abs(r.appHorizon - r.pyHorizon))),
    meanHorizonDiff: rows.reduce((a, r) => a + Math.abs(r.appHorizon - r.pyHorizon), 0) / rows.length,
    pass: bad.length === 0,
    nowSun: nowRows.map(r => ({ siteId: r.siteId, name: r.name, el: r.hzEl, az: r.hzAz, horizon: r.pyHorizon, at_km: r.pyHorizonAt_km, up: r.indep, app: r.app })),
    rows
  };
  res.nowSunlit = res.nowSun.filter(r => r.up).length;
  res.nowText = nowParagraph(res);
  return res;
}

function nowParagraph(r) {
  const f = (x, n) => (x >= 0 ? '+' : '') + x.toFixed(n === undefined ? 2 : n) + '°';
  const lit = r.nowSun.filter(x => x.up), dark = r.nowSun.filter(x => !x.up);
  const els = r.nowSun.map(x => x.el);
  let s = `At ${r.now.replace('T', ' ').replace('Z', ' UTC')}, ${lit.length} of ${r.nowSun.length} south-pole sites ${lit.length === 1 ? 'is' : 'are'} sunlit. `;
  s += `Near the pole the Sun never climbs high: at these sites it is between ${f(Math.min(...els), 1)} and ${f(Math.max(...els), 1)} above the flat horizon right now, so a hill or crater wall of a degree or two in the Sun's direction decides between light and shadow. `;
  if (lit.length) s += 'Sunlit: ' + lit.map(x => `${x.name} (Sun ${f(x.el)} at azimuth ${x.az.toFixed(0)}°, terrain there ${f(x.horizon)})`).join('; ') + '. ';
  if (dark.length) s += 'In shadow: ' + dark.map(x => `${x.name} (Sun ${f(x.el)}, terrain ${f(x.horizon)}${x.el < 0 ? '; below the flat horizon too' : ''})`).join('; ') + '. ';
  s += 'Sun positions from JPL Horizons; terrain heights computed from the LOLA elevation data in the Sun\'s direction.';
  return s;
}

function write(res) {
  fs.writeFileSync(OUT, '// Generated by tests/instant_status_check.js - do not edit\nwindow.LUNA_INSTANT = ' + JSON.stringify(res, null, 1) + ';\n');
}
module.exports = { run, write, loadOld, EDGE_DEG };

if (require.main === module) (async () => {
  const res = await run({ fresh: process.argv.includes('--new') });
  write(res);
  for (const r of res.rows.filter(x => !x.agree || x.edge)) console.log(`${r.agree ? 'edge ' : 'DIFF '} ${r.siteId.padEnd(18)} ${r.t} ${r.body.padEnd(5)} Horizons el ${r.hzEl.toFixed(4)} az ${r.hzAz.toFixed(3)} | Python horizon ${r.pyHorizon.toFixed(4)} (margin ${r.margin.toFixed(4)}) | app el ${r.appEl.toFixed(4)} horizon ${r.appHorizon.toFixed(4)} -> indep ${r.indep} app ${r.app}`);
  console.log(`Instant status: ${res.agree}/${res.n} agree; on the edge (within ${EDGE_DEG} deg): ${res.edgeCount} (${res.edgeDisagree} of them disagree); disagreements outside the edge: ${res.disagreeOutsideEdge}`);
  console.log(`App vs Horizons: max |dEl| ${res.maxElDiff.toFixed(4)}, max |dAz| ${res.maxAzDiff.toFixed(4)} deg; app mask vs Python exact-azimuth horizon: max ${res.maxHorizonDiff.toFixed(3)}, mean ${res.meanHorizonDiff.toFixed(3)} deg`);
  console.log(res.nowText);
  console.log(res.pass ? 'PASS' : 'FAIL');
  process.exit(res.pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
