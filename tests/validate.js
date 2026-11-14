#!/usr/bin/env node
/*
 * ASTERIA validation (Phase 2).
 *  A) Angles vs JPL Horizons (observer on the Moon, airless apparent az/el).
 *  A2) Event times (sunset / Earthset, smooth Moon) vs Horizons 1-minute tables.
 *  B) Physics sanity tests over one year.
 * Writes VALIDATION_REPORT.md and data/validation.js (for the app's Validation page).
 * Horizons responses are cached in tests/horizons_cache/ so the test reruns offline.
 *
 * Usage: node tests/validate.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const E = require('../js/engine.js');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(__dirname, 'horizons_cache');
fs.mkdirSync(CACHE, { recursive: true });
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

// ---------------------------------------------------------------- test sites
// Test coordinates. Named mission sites use the same sourced values as data/sites.js.
const SITES = [
  { id: 'near_pole', name: 'Near south pole (test point)', lat: -89.5, lon: 0, src: 'Synthetic test coordinate' },
  { id: 'polar_test2', name: 'Polar test point near Shackleton (test geometry)', lat: -88.8, lon: 123.4, src: 'Test geometry only (not a curated site)' },
  { id: 'apollo11', name: 'Apollo 11 LM', lat: 0.67416, lon: 23.47314, src: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html' },
  { id: 'apollo15', name: 'Apollo 15 LM (mid-latitude)', lat: 26.13239, lon: 3.63330, src: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html' },
  { id: 'change4', name: "Chang'e-4 (far side)", lat: -45.457, lon: 177.589, src: 'https://lroc.im-ldi.com/images/1087' },
  { id: 'east_limb', name: 'East limb test point (Earth near horizon)', lat: 0, lon: 88, src: 'Synthetic test coordinate' }
];
const DATES = ['2026-12-01T00:00:00Z', '2027-04-17T06:30:00Z', '2027-11-03T15:00:00Z', '2028-07-22T21:45:00Z'];
// Extra case(s) chosen to give a high Sun elevation (Apollo 11 near local noon).
const EXTRA = [
  { s: SITES[2], d: '2027-08-15T06:30:00Z' },  // Sun ~89 deg (near zenith)
  { s: SITES[3], d: '2027-08-16T21:30:00Z' }   // Sun ~63.5 deg
];

const TOL_EL = 0.1, TOL_AZ = 0.2, TOL_EVENT_MIN = 2;

// --------------------------------------------------------------- Horizons IO
function fmtH(d) { // 'YYYY-MM-DD HH:MM'
  return d.toISOString().slice(0, 16).replace('T', ' ');
}
async function horizons(params) {
  const base = {
    format: 'text', OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'", QUANTITIES: "'4'", APPARENT: "'AIRLESS'",
    ANG_FORMAT: "'DEG'", EXTRA_PREC: "'YES'", CSV_FORMAT: "'YES'", TIME_TYPE: "'UT'"
  };
  const all = Object.assign(base, params);
  const qs = new URLSearchParams(all).toString();
  const key = crypto.createHash('sha1').update(qs).digest('hex').slice(0, 16);
  const file = path.join(CACHE, key + '.txt');
  if (fs.existsSync(file)) return { text: fs.readFileSync(file, 'utf8'), cached: true, url: API + '?' + qs };
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(API + '?' + qs);
      const text = await res.text();
      if (!res.ok || !text.includes('$$SOE')) throw new Error('Horizons error: ' + text.slice(0, 400));
      fs.writeFileSync(file, '# ' + API + '?' + qs + '\n' + text);
      await new Promise(r => setTimeout(r, 300));
      return { text, cached: false, url: API + '?' + qs };
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1500)); }
  }
  throw lastErr;
}
function parseRows(text) {
  const block = text.split('$$SOE')[1].split('$$EOE')[0];
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  return block.trim().split(/\r?\n/).map(line => {
    const f = line.split(',').map(s => s.trim());
    const m = f[0].match(/(\d+)-(\w+)-(\d+) (\d+):(\d+):?([\d.]*)/);
    const t = Date.UTC(+m[1], MON[m[2]], +m[3], +m[4], +m[5], m[6] ? parseFloat(m[6]) : 0);
    const nums = f.filter(s => /^-?\d+(\.\d+)?$/.test(s)).map(Number);
    return { t, az: nums[nums.length - 2], el: nums[nums.length - 1] };
  });
}
function siteCoord(s) { return `'${s.lon},${s.lat},0'`; }
function azDiff(a, b) { let d = a - b; d = ((d + 540) % 360) - 180; return d; }

// -------------------------------------------------------------------- tests
async function angleTests() {
  const cases = [];
  const list = [];
  for (const s of SITES) for (const d of DATES) list.push({ s, d });
  for (const x of EXTRA) list.push(x);
  for (const { s, d } of list) {
    const date = new Date(d);
    const ours = E.sunEarthAt({ lat: s.lat, lon: s.lon, h_km: 0 }, date);
    for (const [body, cmd] of [['Sun', "'10'"], ['Earth', "'399'"]]) {
      const h = await horizons({ COMMAND: cmd, SITE_COORD: siteCoord(s), TLIST: `'${fmtH(date)}'` });
      const row = parseRows(h.text)[0];
      const o = body === 'Sun' ? ours.sun : ours.earth;
      const dEl = o.el - row.el, dAz = azDiff(o.az, row.az);
      // Azimuth tolerance is relaxed only when the body is near the zenith (el > 80 deg),
      // where azimuth becomes geometrically ill-defined: a fixed angular error e
      // produces an azimuth error ~ e / cos(el).
      const azTol = row.el > 80 ? TOL_AZ / Math.cos(row.el * Math.PI / 180) : TOL_AZ;
      const pass = Math.abs(dEl) < TOL_EL && Math.abs(dAz) < azTol;
      cases.push({ site: s.name, siteId: s.id, lat: s.lat, lon: s.lon, date: d, body,
        oursAz: o.az, oursEl: o.el, hzAz: row.az, hzEl: row.el, dAz, dEl, azTol, pass });
    }
  }
  return cases;
}

const EVENT_CASES = [
  { site: SITES[2], body: 'sun', type: 'set', from: '2027-01-01T00:00:00Z', label: 'Apollo 11 sunset' },
  { site: { id: 'chandrayaan3', name: 'Chandrayaan-3 Vikram', lat: -69.3741, lon: 32.32 }, body: 'sun', type: 'set', from: '2027-06-01T00:00:00Z', label: 'Chandrayaan-3 sunset' },
  { site: SITES[5], body: 'earth', type: 'set', from: '2027-03-01T00:00:00Z', label: 'East-limb test point Earthset' },
  { site: SITES[4], body: 'sun', type: 'set', from: '2028-02-01T00:00:00Z', label: "Chang'e-4 sunset" }
];

async function eventTests() {
  const out = [];
  for (const c of EVENT_CASES) {
    const from = new Date(c.from);
    const r = E.findEvents(c.site, c.body, from, new Date(from.getTime() + 60 * 86400000), null, 10);
    const ev = r.events.find(e => e.type === c.type);
    if (!ev) { out.push(Object.assign({}, c, { pass: false, error: 'no event found by engine' })); continue; }
    const t0 = new Date(Math.floor(ev.time.getTime() / 60000) * 60000 - 20 * 60000);
    const t1 = new Date(t0.getTime() + 40 * 60000);
    const h = await horizons({ COMMAND: c.body === 'sun' ? "'10'" : "'399'", SITE_COORD: siteCoord(c.site),
      START_TIME: `'${fmtH(t0)}'`, STOP_TIME: `'${fmtH(t1)}'`, STEP_SIZE: "'1m'" });
    const rows = parseRows(h.text);
    let hzT = null;
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i - 1].el > 0) !== (rows[i].el > 0)) {
        const f = rows[i - 1].el / (rows[i - 1].el - rows[i].el);
        hzT = new Date(rows[i - 1].t + f * (rows[i].t - rows[i - 1].t));
        break;
      }
    }
    if (!hzT) { out.push({ label: c.label, ours: ev.time.toISOString(), pass: false, error: 'Horizons shows no 0-deg crossing within +-20 min' }); continue; }
    const dMin = (ev.time - hzT) / 60000;
    out.push({ label: c.label, lat: c.site.lat, lon: c.site.lon, body: c.body, type: c.type,
      ours: ev.time.toISOString(), horizons: hzT.toISOString(), dMin, pass: Math.abs(dMin) < TOL_EVENT_MIN });
  }
  return out;
}

function sanityTests() {
  const start = new Date('2027-01-01T00:00:00Z'), end = new Date('2028-01-01T00:00:00Z');
  const step = 10;
  const res = [];
  // 1. exact south pole
  let s = E.series({ lat: -90, lon: 0 }, start, end, step);
  const mn = Math.min(...s.sunEl), mx = Math.max(...s.sunEl);
  res.push({ name: 'Exact south pole (-90, 0): Sun centre elevation within +-1.7 deg all year',
    value: `min ${mn.toFixed(3)} deg, max ${mx.toFixed(3)} deg`, pass: mn > -1.7 && mx < 1.7 });
  // 2. Apollo 11 Earth always up
  s = E.series({ lat: 0.67416, lon: 23.47314 }, start, end, step);
  let st = E.stats(s);
  res.push({ name: 'Apollo 11: Earth above smooth horizon 100% of the year',
    value: `${st.pctEarth.toFixed(3)}% (min Earth el ${Math.min(...s.earthEl).toFixed(2)} deg)`, pass: st.pctEarth === 100 });
  // 3. Chang'e-4 Earth never up
  s = E.series({ lat: -45.457, lon: 177.589 }, start, end, step);
  st = E.stats(s);
  res.push({ name: "Chang'e-4 (far side): Earth below smooth horizon 100% of the year",
    value: `Earth up ${st.pctEarth.toFixed(3)}% (max Earth el ${Math.max(...s.earthEl).toFixed(2)} deg)`, pass: st.pctEarth === 0 });
  // 4. equatorial near-side Sun ~half the time
  s = E.series({ lat: 0, lon: 0 }, start, end, step);
  st = E.stats(s);
  res.push({ name: 'Equatorial near-side (0, 0): Sun above smooth horizon 45-55% of the year',
    value: `${st.pctSun.toFixed(2)}%`, pass: st.pctSun >= 45 && st.pctSun <= 55 });
  return { period: '2027-01-01 to 2028-01-01 UTC, 10-minute steps', tests: res };
}

function stat(arr) {
  const a = arr.map(Math.abs);
  return { max: Math.max(...a), mean: a.reduce((x, y) => x + y, 0) / a.length };
}

(async function main() {
  console.log('Running angle tests vs JPL Horizons ...');
  const angles = await angleTests();
  console.log('Running event-time tests ...');
  const events = await eventTests();
  console.log('Running physics sanity tests (one year, 10-min steps) ...');
  const sanity = sanityTests();

  const elS = stat(angles.map(c => c.dEl));
  const azS = stat(angles.map(c => c.dAz));
  const evS = stat(events.filter(e => e.dMin !== undefined).map(e => e.dMin));
  const anglePass = angles.every(c => c.pass);
  const eventPass = events.every(e => e.pass);
  const sanityPass = sanity.tests.every(t => t.pass);
  const overall = anglePass && eventPass && sanityPass;
  const maxSunEl = Math.max(...angles.filter(c => c.body === 'Sun').map(c => c.hzEl));

  const result = {
    generated: new Date().toISOString(), overall, anglePass, eventPass, sanityPass,
    tolerances: { elDeg: TOL_EL, azDeg: TOL_AZ, eventMin: TOL_EVENT_MIN },
    angleStats: { el: elS, az: azS }, eventStats: evS, maxSunElTested: maxSunEl,
    angles, events, sanity
  };
  fs.writeFileSync(path.join(ROOT, 'data', 'validation.js'),
    '// Generated by tests/validate.js - do not edit\nwindow.LUNA_VALIDATION = ' + JSON.stringify(result, null, 1) + ';\n');
  fs.writeFileSync(path.join(ROOT, 'VALIDATION_REPORT.md'), report(result));
  fs.writeFileSync(path.join(ROOT, 'data', 'illum_crosscheck_meta.js'),
    '// Generated by tests/validate.js\nwindow.LUNA_XCHECK_SOURCES = ' + JSON.stringify(XCHECK_SOURCES, null, 1) + ';\n');

  for (const c of angles) if (!c.pass) console.log('FAIL', c);
  for (const e of events) if (!e.pass) console.log('FAIL', e);
  for (const t of sanity.tests) console.log(t.pass ? 'PASS' : 'FAIL', t.name, '-', t.value);
  console.log(`Angles: ${angles.filter(c => c.pass).length}/${angles.length} pass; max |dEl| ${elS.max.toFixed(4)} mean ${elS.mean.toFixed(4)}; max |dAz| ${azS.max.toFixed(4)} mean ${azS.mean.toFixed(4)} deg`);
  console.log(`Events: ${events.filter(e => e.pass).length}/${events.length} pass; max |dt| ${evS.max.toFixed(2)} min`);
  console.log('OVERALL:', overall ? 'PASS' : 'FAIL');
  process.exit(overall ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });

function report(r) {
  const f = (x, n) => x.toFixed(n);
  let md = `# ASTERIA - Validation Report\n\nGenerated ${r.generated} by \`node tests/validate.js\`.\n\n`;
  md += `## Overall: **${r.overall ? 'PASS' : 'FAIL'}**\n\n`;
  md += `| Part | Result | Detail |\n|---|---|---|\n`;
  md += `| A. Angles vs JPL Horizons (${r.angles.length} comparisons) | ${r.anglePass ? 'PASS' : 'FAIL'} | elevation max ${f(r.angleStats.el.max, 4)} deg / mean ${f(r.angleStats.el.mean, 4)} deg; azimuth max ${f(r.angleStats.az.max, 4)} deg / mean ${f(r.angleStats.az.mean, 4)} deg |\n`;
  md += `| A. Event times vs Horizons (${r.events.length} events) | ${r.eventPass ? 'PASS' : 'FAIL'} | max ${f(r.eventStats.max, 2)} min / mean ${f(r.eventStats.mean, 2)} min |\n`;
  md += `| B. Physics sanity tests (${r.sanity.tests.length}) | ${r.sanityPass ? 'PASS' : 'FAIL'} | see below |\n\n`;
  md += `## Method\n\n`;
  md += `* **Our engine** (\`js/engine.js\`): Astronomy Engine 2.1.19 (VSOP87 Earth + Chapront lunar theory) for positions; IAU/WGCCRE Moon orientation model (\`Astronomy.RotationAxis(Body.Moon)\`) for the body-fixed frame; spherical Moon, R = 1737.4 km; site height 0 km; light-time correction (target at retarded time); first-order stellar aberration with the Moon's heliocentric velocity; no refraction. Elevation is measured from the plane perpendicular to the radial (local vertical) direction.\n`;
  md += `* **Reference**: JPL Horizons API (\`${API}\`), \`CENTER='coord@301'\`, \`COORD_TYPE='GEODETIC'\`, \`SITE_COORD='E-lon,lat,0'\`, targets Sun (10) and Earth (399), \`QUANTITIES='4'\` (apparent azimuth/elevation), \`APPARENT='AIRLESS'\`, \`TIME_TYPE='UT'\`, \`EXTRA_PREC='YES'\`. Horizons reports the lunar frame as MEAN_ME (high precision, DE-based) with radii 1737.4 km. Horizons' quantity 4 also includes gravitational light deflection, which we omit (milli-arcsecond effect).\n`;
  md += `* Raw Horizons responses are cached in \`tests/horizons_cache/\` (first line of each file = the exact query URL).\n`;
  md += `* **Pass criteria**: |elevation error| < ${r.tolerances.elDeg} deg; |azimuth error| < ${r.tolerances.azDeg} deg, relaxed to ${r.tolerances.azDeg} deg / cos(el) only when Horizons elevation > 80 deg (azimuth is ill-conditioned near the zenith: a tiny angular offset becomes a large azimuth change). Event times within ${r.tolerances.eventMin} minutes.\n`;
  md += `* The highest Sun elevation in the test set is ${f(r.maxSunElTested, 2)} deg.\n\n`;
  md += `## A. Angle comparison (ours vs Horizons)\n\n| Site | lat | E-lon | UTC | Body | Az ours | Az Horizons | dAz | El ours | El Horizons | dEl | Pass |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const c of r.angles) md += `| ${c.site} | ${c.lat} | ${c.lon} | ${c.date.replace(':00Z', 'Z')} | ${c.body} | ${f(c.oursAz, 4)} | ${f(c.hzAz, 4)} | ${f(c.dAz, 4)} | ${f(c.oursEl, 4)} | ${f(c.hzEl, 4)} | ${f(c.dEl, 4)} | ${c.pass ? 'PASS' : '**FAIL**'} |\n`;
  md += `\n## A. Event times (smooth-Moon horizon, body centre crossing 0 deg)\n\nOur time: coarse 10-minute scan + bisection to 1 minute. Horizons time: 1-minute table around our event, crossing linearly interpolated.\n\n| Event | lat | E-lon | Ours (UTC) | Horizons (UTC) | Difference (min) | Pass |\n|---|---|---|---|---|---|---|\n`;
  for (const e of r.events) md += `| ${e.label} | ${e.lat} | ${e.lon} | ${e.ours || '-'} | ${e.horizons || '-'} | ${e.dMin !== undefined ? f(e.dMin, 2) : (e.error || '-')} | ${e.pass ? 'PASS' : '**FAIL**'} |\n`;
  md += `\n## B. Physics sanity tests\n\nPeriod: ${r.sanity.period}. Smooth-Moon horizon (0 deg everywhere).\n\n| Test | Result | Pass |\n|---|---|---|\n`;
  for (const t of r.sanity.tests) md += `| ${t.name} | ${t.value} | ${t.pass ? 'PASS' : '**FAIL**'} |\n`;
  md += `\n## Test sites\n\n| Site | lat | E-lon | Source |\n|---|---|---|---|\n`;
  for (const s of SITES) md += `| ${s.name} | ${s.lat} | ${s.lon} | ${s.src} |\n`;
  md += `\nNotes: "Synthetic test coordinate" points are not landing sites; they were chosen to exercise geometry (near-pole Sun skimming, Earth near the east limb).\n`;
  md += xcheckSection();
  md += `\n## Other checks (run separately)\n\n` +
    '* `node tests/features_test.js`: power model vs S*A*eta*sin(E_Horizons); launch-slip slip 0 = timeline metrics; the optional Earth mask leaves the validated default unchanged and equals "Earth el > horizon + minimum elevation"; the worker job code gives the same series as the engine; `js/core.js` is a verbatim rebuild of the engine; every requestable map tile exists, the tile set is < 80 MB, and the browser map projection puts the IAU Shackleton centre on the same tile pixel as the tile generator.\n' +
    '* `.venv/Scripts/python -I tools/tiles.py check`: tile georeference - for 5 sites the tile pixel containing the site has the DEM height of the site, and the Shackleton IAU centre is a ~3.5 km-deep bowl relative to a 10 km ring.\n' +
    '* `node tests/ui_check.js`: the app opened via file:// at laptop and phone sizes (all features, tour, Blob Web Worker, loader, reduced motion), no console errors.\n';
  return md;
}

// ------------------------------------------------- terrain illumination cross-check
// Source quotes shared by the report and the app (data/illum_crosscheck_meta.js).
const XCHECK_SOURCES = [
  { what: 'Published claim', url: 'https://iopscience.iop.org/article/10.3847/PSJ/ad1b50',
    quote: 'Mahanti et al. 2024 (PSJ 5, 62): "a small area (\u221288.79, 124.5) receives persistent solar illumination (approximately 80% of the time; Mazarico et al. 2011)."' },
  { what: 'Original method (abstract)', url: 'https://ntrs.nasa.gov/citations/20120010094',
    quote: 'Mazarico et al. 2011, Icarus 211: horizons from "240 m-resolution polar digital elevation models"; "simulations over long periods (several 18.6-years lunar precession cycles) with a high temporal resolution (6 h)". Observer height is not stated in the abstract; the full paper (Elsevier) was not accessible.' },
  { what: 'Published map product', url: 'https://pgda.gsfc.nasa.gov/products/69',
    quote: 'NASA PGDA product 69: "Maps of the solar illumination, averaged over hourly timesteps spanning 18.6 years" (no start year given). Map AVGVISIB_85S_060M_201608 (60 m/px, based on LDEM_85S_060M), label: "average illumination by the solar disc ... indicate the percentage of timesteps where each pixel was sunlit (by any fraction of the solar disc)"; the same label\'s image description says "its average solar disc visibility". The two wordings differ, so we compute both definitions.' }
];
function xcheckSection() {
  const file = path.join(ROOT, 'data', 'illum_crosscheck.js');
  if (!fs.existsSync(file)) return '\n## Terrain illumination cross-check\n\nNot run (tools/illum_crosscheck.py has not produced data/illum_crosscheck.js).\n';
  const w = {}; new Function('window', fs.readFileSync(file, 'utf8'))(w);
  const X = w.LUNA_XCHECK;
  if (!X.supported) X.supported = supportedPoint(X);
  const p = v => (v === null || v === undefined) ? 'n/a' : (100 * v).toFixed(1) + '%';
  let md = `\n## Terrain illumination cross-check\n\nPeak near Shackleton (${X.pubLat}, ${X.pubLon}) vs the published "approximately 80%" figure. Do-not-tune policy: nothing in the model was adjusted to match.\n\n**Sources and definitions**\n\n`;
  for (const s of XCHECK_SOURCES) md += `* ${s.what}: ${s.quote} (${s.url})\n`;
  md += `\n**Method.** Sun directions from the validated ASTERIA engine (hourly, ${X.span}, ${X.records} steps = one 18.6-year nodal cycle; "2027" = calendar year 2027). Terrain horizons from LOLA LDEM_85S_20M/80S_80M/75S_120M (20 m/px near the site), 360 azimuths, rays to 300 km, at observer heights 2 m and 10 m above the surface. Three definitions: (1) average visible fraction of the solar disk, (2) % of time the Sun centre is above the horizon, (3) % of time any part of the disk is above the horizon. The published map (${X.pgdaProduct}) is sampled at the same points (bilinear; nearest-pixel in brackets).\n\n`;
  md += `| Observer height | Period | (1) Avg disk fraction | (2) Sun centre up | (3) Any part of disk up |\n|---|---|---|---|---|\n`;
  for (const c of X.central) md += `| ${c.height_m} m | ${c.period} | ${p(c.avgDiskFrac)} | ${c.pctCentre.toFixed(1)}% | ${c.pctAnyPart.toFixed(1)}% |\n`;
  md += `| Published map ${X.pgdaProduct} at the same point | 18.6 yr | ${p(X.pgdaAtPoint.bilinear)} (nearest pixel ${p(X.pgdaAtPoint.nearest)}) | | |\n| Published text (Mahanti et al. 2024) | not stated | ~80% | | |\n\n`;
  md += `**Neighbourhood scan** (all points within ${500} m of the published coordinate on a 50 m grid, 18.6-year span):\n\n| Height | Points | Best point (ours) | Ours there (1)/(2)/(3) | Published map there | Max of published map in the area | Correlation ours vs map |\n|---|---|---|---|---|---|---|\n`;
  for (const h of Object.keys(X.grid)) {
    const g = X.grid[h], b = g.best, bp = g.bestByPgda;
    md += `| ${h} m | ${g.n} | ${b.lat.toFixed(5)}, ${b.lon.toFixed(4)} (${b.dn} m N, ${b.de} m E) | ${p(b.avgDiskFrac)} / ${b.pctCentre.toFixed(1)}% / ${b.pctAnyPart.toFixed(1)}% | ${p(b.pgda)} | ${p(bp.pgda)} at ${bp.lat.toFixed(5)}, ${bp.lon.toFixed(4)} | r = ${g.corrWithPgda.toFixed(2)} |\n`;
  }
  if (X.supported) md += `\nBest point supported by both models (maximum of min(ours at 2 m, published map)): **${X.supported.lat.toFixed(5)}, ${X.supported.lon.toFixed(4)}**, ours ${p(X.supported.avgDiskFrac)}, published map ${p(X.supported.pgda)}. Added to the app as a clearly labelled derived point; the original published coordinate is kept.\n`;
  const SW = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'data', 'sites.js'), 'utf8'))(SW);
  const nameOf = id => { const s = SW.LUNA_SITES.find(x => x.id === id); return s ? s.name : id; };
  md += `\n**All south-pole sites with terrain horizons vs the published map** (observer 2 m, 18.6 years). "(landform centre)" = IAU Gazetteer centre of a landform that is itself a NASA Artemis III region (one point, not a landing site; region boundary not plotted). The 60 m published map covers ~85°S-90°S only ("outside map" = not covered); the coarser 120 m map ${X.pgda120Product || 'AVGVISIB_75S_120M_201608'} (75°S-90°S) covers every site:\n\n| Site | lat | E-lon | (1) Avg disk fraction | (2) Sun centre up | (3) Any part up | Published 60 m map | Difference (1) - 60 m map | Published 120 m map | Difference (1) - 120 m map |\n|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const s of X.sites) md += `| ${nameOf(s.id)} | ${s.lat} | ${s.lon} | ${p(s.avgDiskFrac)} | ${s.pctCentre.toFixed(1)}% | ${s.pctAnyPart.toFixed(1)}% | ${s.pgda === null ? 'outside map' : p(s.pgda)} | ${s.pgda === null ? 'n/a' : ((s.avgDiskFrac - s.pgda) * 100).toFixed(1) + ' pts'} | ${s.pgda120 === undefined ? 'n/a' : p(s.pgda120)} | ${s.pgda120 === undefined ? 'n/a' : ((s.avgDiskFrac - s.pgda120) * 100).toFixed(1) + ' pts'} |\n`;
  const cov = X.sites.filter(s => s.pgda !== null && s.id !== 'peak_shackleton_lw');
  if (cov.length) { const d = cov.map(s => Math.abs(s.avgDiskFrac - s.pgda) * 100); md += `\nSites covered by the 60 m map (excluding the derived point, which was chosen using that map): ${cov.length}; |difference| mean ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1)} pts, max ${Math.max(...d).toFixed(1)} pts.`; }
  const cov120 = X.sites.filter(s => s.pgda120 !== undefined && s.id !== 'peak_shackleton_lw');
  if (cov120.length) { const d = cov120.map(s => Math.abs(s.avgDiskFrac - s.pgda120) * 100); md += ` Against the coarser 120 m map (all ${cov120.length} sites except the derived point): |difference| mean ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1)} pts, max ${Math.max(...d).toFixed(1)} pts.`; }
  md += '\n';
  const c18 = X.central.find(c => c.height_m === 2 && c.period === '18.6 yr');
  md += `\n**Finding.** At the published coordinate, the published 60 m map itself gives ${p(X.pgdaAtPoint.bilinear)}, and our model gives ${p(c18.avgDiskFrac)} (2 m, 18.6 years). Both are well below "approximately 80%". The ~80% figure is therefore not reproduced by the public map product at that coordinate. Possible reasons: the 2011 analysis used 240 m topography and different heights or periods, the coordinate is rounded to 0.01\u00b0 (about \u00b1150 m), and illumination changes a lot over a few hundred metres. We report this as-is.`;
  const g10 = X.grid['10.0'] || X.grid['10'];
  if (g10) md += ` With the observer 10 m above the surface (the Mazarico et al. abstract notes that ~10 m height gains can greatly improve illumination), the best point within 500 m reaches ${p(g10.best.avgDiskFrac)} in our model; the published map at that point gives ${p(g10.best.pgda)} (the map does not state its observer height).`;
  md += '\n';
  return md;
}

// Grid point (2 m observer) maximising min(our average disk fraction, published map value):
// a location that both models agree is well lit.
function supportedPoint(X) {
  const g = X.grid['2.0'] || X.grid['2']; if (!g) return null;
  let best = null;
  for (const q of g.points) { if (q.pgda === null) continue; const m = Math.min(q.avgDiskFrac, q.pgda); if (!best || m > best.m) best = Object.assign({ m }, q); }
  return best;
}
module.exports = { supportedPoint };
