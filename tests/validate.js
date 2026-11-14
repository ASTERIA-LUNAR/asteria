#!/usr/bin/env node
/*
 * ASTERIA validation (Phase 2).
 *  A) Angles vs JPL Horizons (observer on the Moon, airless apparent az/el).
 *  A2) Event times (sunset / Earthset, smooth Moon) vs Horizons 1-minute tables.
 *  B) Physics sanity tests over one year.
 *  C) Blind test: random cases chosen and fetched fresh by tests/blind_test.js --new (data/blind_test.js),
 *     recomputed here from the cached raw responses.
 * Writes VALIDATION_REPORT.md and data/validation.js (for the app's Validation page).
 * Horizons responses are cached in tests/horizons_cache/ so the test reruns offline.
 *
 * Usage: node tests/validate.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');

const ROOT = path.join(__dirname, '..');
const { API, fmtH, siteCoord, horizons, parseRows, azDiff } = require('./horizons_api.js');

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
  // 5. maximum Sun elevation at 20 random southern latitudes (-60 to -90). The Moon's equator is tilted about
  // 1.54 deg to the ecliptic, so over a year the Sun's centre should reach about 90 - |lat| + 1.54 deg and never
  // more than 90 - |lat| + 1.6 deg. Seeded random points (reproducible); 30-minute scan, then 1-minute steps
  // within +-30 min of the highest sample.
  const sunMax = sunMaxRule(start, end);
  res.push({ name: `Max Sun elevation at ${sunMax.rows.length} random latitudes -60 to -90 (seed ${sunMax.seed}): never above 90 - abs(lat) + ${SUNMAX_LIMIT} deg, and within ${SUNMAX_TOL} deg of 90 - abs(lat) + ${SUNMAX_TILT} deg`,
    value: `max - (90 - abs(lat)): ${sunMax.excessMin.toFixed(3)} to ${sunMax.excessMax.toFixed(3)} deg; largest deviation from 90 - abs(lat) + ${SUNMAX_TILT}: ${sunMax.worstDev.toFixed(3)} deg`, pass: sunMax.pass, rows: sunMax.rows });
  return { period: '2027-01-01 to 2028-01-01 UTC, 10-minute steps (test 5: 30-minute scan refined to 1 minute)', tests: res, sunMax };
}

const SUNMAX_SEED = 20261114, SUNMAX_LIMIT = 1.6, SUNMAX_TILT = 1.54, SUNMAX_TOL = 0.2;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function sunMaxRule(start, end) {
  const rnd = mulberry32(SUNMAX_SEED), rows = [];
  for (let k = 0; k < 20; k++) {
    const lat = +(-60 - 30 * rnd()).toFixed(4), lon = +(-180 + 360 * rnd()).toFixed(4), site = { lat, lon };
    const s = E.series(site, start, end, 30);
    let i = 0; for (let j = 1; j < s.sunEl.length; j++) if (s.sunEl[j] > s.sunEl[i]) i = j;
    let best = s.sunEl[i], bt = s.t[i];
    for (let m = -30; m <= 30; m++) { const t = s.t[i] + m * 60000; if (t < start.getTime() || t > end.getTime()) continue; const el = E.sunEarthAt(site, new Date(t)).sun.el; if (el > best) { best = el; bt = t; } }
    const zen = 90 - Math.abs(lat), excess = best - zen, dev = best - (zen + SUNMAX_TILT);
    rows.push({ lat, lon, maxEl: best, when: new Date(bt).toISOString(), limit: zen + SUNMAX_LIMIT, expected: zen + SUNMAX_TILT, excess, dev, pass: best <= zen + SUNMAX_LIMIT && Math.abs(dev) <= SUNMAX_TOL });
  }
  const ex = rows.map(r => r.excess);
  // Tilt of the Moon's equator to the J2000 ecliptic in the IAU/WGCCRE model the engine uses (monthly over the period).
  const A = require('astronomy-engine'), tilt = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 30 * 86400000) {
    const v = A.RotateVector(A.Rotation_EQJ_ECL(), A.RotationAxis(A.Body.Moon, A.MakeTime(new Date(t))).north);
    tilt.push(Math.acos(v.z / Math.hypot(v.x, v.y, v.z)) * 180 / Math.PI);
  }
  return { seed: SUNMAX_SEED, tiltMin: Math.min(...tilt), tiltMax: Math.max(...tilt), rows, excessMin: Math.min(...ex), excessMax: Math.max(...ex), worstDev: Math.max(...rows.map(r => Math.abs(r.dev))), pass: rows.every(r => r.pass) };
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
  const BT = require('./blind_test.js'), bcases = BT.loadCases();
  const blind = bcases ? { generated: bcases.generated, selection: bcases.selection, cases: bcases.cases, rows: await BT.evaluate(bcases.cases) } : null;
  if (blind) { blind.pass = blind.rows.every(r => r.pass); blind.el = stat(blind.rows.map(r => r.dEl)); blind.az = stat(blind.rows.map(r => r.dAz)); }
  console.log('Custom point, one-year check (tests/one_year_check.js, from the cache) ...');
  const OY = require('./one_year_check.js'), oneYear = await OY.run();
  OY.write(oneYear);
  console.log(OY.summary(oneYear));

  const elS = stat(angles.map(c => c.dEl));
  const azS = stat(angles.map(c => c.dAz));
  const evS = stat(events.filter(e => e.dMin !== undefined).map(e => e.dMin));
  const anglePass = angles.every(c => c.pass);
  const eventPass = events.every(e => e.pass);
  const sanityPass = sanity.tests.every(t => t.pass);
  const overall = anglePass && eventPass && sanityPass && (!blind || blind.pass) && oneYear.pass;
  const maxSunEl = Math.max(...angles.filter(c => c.body === 'Sun').map(c => c.hzEl));

  const result = {
    generated: new Date().toISOString(), overall, anglePass, eventPass, sanityPass,
    tolerances: { elDeg: TOL_EL, azDeg: TOL_AZ, eventMin: TOL_EVENT_MIN },
    angleStats: { el: elS, az: azS }, eventStats: evS, maxSunElTested: maxSunEl,
    angles, events, sanity, blind, oneYear
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
  md += `| B. Physics sanity tests (${r.sanity.tests.length}) | ${r.sanityPass ? 'PASS' : 'FAIL'} | see below |\n`;
  md += `| E. Custom point, one-year check vs JPL Horizons (${r.oneYear.rows} hourly rows x 2 bodies) | ${r.oneYear.pass ? 'PASS' : 'FAIL'} | elevation max ${f(Math.max(r.oneYear.angles.earth.el.max, r.oneYear.angles.sun.el.max), 4)} deg; azimuth max ${f(Math.max(r.oneYear.angles.earth.az.max, r.oneYear.angles.sun.az.max), 4)} deg; sunrise/sunset max ${f(r.oneYear.events.sun.maxAbsMin, 2)} min; Earth min elevation ${f(r.oneYear.earthMin.el, 2)} deg |\n`;
  if (r.blind) md += `| C. Blind test vs JPL Horizons (${r.blind.cases.length} new random cases, ${r.blind.rows.length} comparisons, fetched fresh) | ${r.blind.pass ? 'PASS' : 'FAIL'} | elevation max ${f(r.blind.el.max, 4)} deg; azimuth max ${f(r.blind.az.max, 4)} deg |\n`;
  md += `\n`;
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
  if (r.sanity.sunMax) {
    md += `\n**Test 5 detail: maximum Sun elevation over 2027** (smooth horizon). Rule (from the test specification): the maximum should come within ${SUNMAX_TOL} deg of 90 - |lat| + ${SUNMAX_TILT} deg and never exceed 90 - |lat| + ${SUNMAX_LIMIT} deg. Reason: the Sun stays close to the ecliptic, and the Moon's equator is tilted only slightly to it; the IAU/WGCCRE orientation model used by the engine gives a tilt of ${r.sanity.sunMax.tiltMin.toFixed(3)}-${r.sanity.sunMax.tiltMax.toFixed(3)} deg to the J2000 ecliptic over the period (Astronomy Engine \`RotationAxis\`, sampled every 30 days). Random latitudes uniform in -60 to -90, longitudes uniform; 30-minute scan, then 1-minute steps within 30 minutes of the highest sample.\n\n| lat | E-lon | Max Sun el (deg) | When (UTC) | 90 - abs(lat) + ${SUNMAX_TILT} | Difference | Limit | Pass |\n|---|---|---|---|---|---|---|---|\n`;
    for (const x of r.sanity.sunMax.rows) md += `| ${x.lat} | ${x.lon} | ${f(x.maxEl, 4)} | ${x.when.slice(0, 16).replace('T', ' ')} | ${f(x.expected, 4)} | ${f(x.dev, 4)} | ${f(x.limit, 4)} | ${x.pass ? 'PASS' : '**FAIL**'} |\n`;
  }
  md += oneYearSection(r.oneYear);
  if (r.blind) {
    md += `\n## C. Blind test\n\nCases chosen by \`node tests/blind_test.js --new\` on ${r.blind.generated.slice(0, 10)}: ${r.blind.selection}. Same settings and tolerances as part A. The raw responses are in the cache files listed (first line = exact query URL).\n\n| Site | lat | E-lon | UTC | Body | Az ours | Az Horizons | dAz | El ours | El Horizons | dEl | Pass | Cache file |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    for (const c of r.blind.rows) md += `| ${c.name} | ${c.lat} | ${c.lon} | ${c.date} | ${c.body} | ${f(c.oursAz, 4)} | ${f(c.hzAz, 4)} | ${f(c.dAz, 4)} | ${f(c.oursEl, 4)} | ${f(c.hzEl, 4)} | ${f(c.dEl, 4)} | ${c.pass ? 'PASS' : '**FAIL**'} | \`${c.cacheFile}\` |\n`;
    md += `\nFetch times (UTC): ${r.blind.cases.map(c => c.fetchedAt).join(', ')}. How to repeat one case by hand: VERIFY_YOURSELF.md.\n`;
  }
  md += `\n## Test sites\n\n| Site | lat | E-lon | Source |\n|---|---|---|---|\n`;
  for (const s of SITES) md += `| ${s.name} | ${s.lat} | ${s.lon} | ${s.src} |\n`;
  md += `\nNotes: "Synthetic test coordinate" points are not landing sites; they were chosen to exercise geometry (near-pole Sun skimming, Earth near the east limb).\n`;
  md += xcheckSection();
  md += coarseSection();
  md += `\n## Other checks (run separately)\n\n` +
    '* `node tests/features_test.js`: power model vs S*A*eta*sin(E_Horizons); launch-slip slip 0 = timeline metrics; the optional Earth mask leaves the validated default unchanged and equals "Earth el > horizon + minimum elevation"; the worker job code gives the same series as the engine; `js/core.js` is a verbatim rebuild of the engine; every requestable map tile exists, the tile set is < 80 MB, and the browser map projection puts the IAU Shackleton centre on the same tile pixel as the tile generator.\n' +
    '* `.venv/Scripts/python -I tools/tiles.py check`: tile georeference - for 5 sites the tile pixel containing the site has the DEM height of the site, and the Shackleton IAU centre is a ~3.5 km-deep bowl relative to a 10 km ring.\n' +
    '* `node tests/ui_check.js`: the app opened via file:// at laptop and phone sizes (all features, tour, Blob Web Worker, loader, reduced motion, map coverage limits, clicked-point terrain, outside-click message, the VERIFY_YOURSELF.md share link), no console errors.\n' +
    '* `node tests/coarse_validation.js`: section D above. `node tests/blind_test.js`: section C (offline re-check from the cache).\n' +
    '* `node tests/features_test.js` also checks: every site has a primary/secondary source type and no Wikipedia source; the removed points have no site, horizon or computed rows; Artemis III regions are plotted only through landform centres or a published point; the downsampled DEM is <= 15 MB, decodes correctly and, with the shipped worker code, reproduces the stored validation; terrain for clicked points is gated on the validation result.\n';
  return md;
}

// Custom point, one-year check (tests/one_year_check.js).
function oneYearSection(o) {
  const f = (x, n) => x.toFixed(n), E1 = o.events.earth, S1 = o.events.sun, m = o.earthMin;
  const ts = s => s.slice(0, 16).replace('T', ' ');
  let md = `\n## E. Custom point, one-year check: **${o.pass ? 'PASS' : 'FAIL'}**\n\n`;
  md += `Point ${o.site.lat}, ${o.site.lon} E, smooth horizon (it is outside the south-pole map, so the app uses a smooth horizon there). JPL Horizons apparent azimuth/elevation of the Earth (399) and the Sun (10), same settings as part A, every hour from ${ts(o.period.start)} to ${ts(o.period.stop)} UT: ${o.rows} rows per body. Cache files: \`${o.cacheFiles.earth}\` (Earth), \`${o.cacheFiles.sun}\` (Sun). Run alone with \`node tests/one_year_check.js\`.\n\n`;
  md += `| Body | max abs dEl (deg) | mean abs dEl | max abs dAz (deg) | mean abs dAz | Pass |\n|---|---|---|---|---|---|\n`;
  for (const b of ['earth', 'sun']) { const a = o.angles[b]; md += `| ${b === 'earth' ? 'Earth' : 'Sun'} | ${f(a.el.max, 4)} | ${f(a.el.mean, 4)} | ${f(a.az.max, 4)} | ${f(a.az.mean, 4)} | ${a.pass ? 'PASS' : '**FAIL**'} |\n`; }
  md += `\n**Earth elevation (Horizons).** Minimum over the year **${f(m.el, 4)} deg** at ${ts(m.time)} UTC (1-minute Horizons table around the hourly minimum, ${f(m.hourly.el, 4)} deg at ${ts(m.hourly.time)}; \`${m.minuteFile}\`). The engine gives ${f(m.engineEl, 4)} deg at that minute. Earth is below 0 deg in ${m.hoursBelow0} of ${o.rows} hourly rows: **according to Horizons, Earth ${m.setsAtAll ? 'does go' : 'never goes'} below 0 deg (smooth horizon) in this year**${m.setsAtAll ? '' : '. There is therefore no Earthset or Earthrise to compare; the app finds none either, and its countdown shows "Not within the next N days (search limit)"'}.\n\n`;
  md += `**Events.** Every 0 deg crossing in the hourly Horizons table was refined with a 1-minute Horizons table (crossing linearly interpolated) and compared with the events from the app's own Explore job (\`js/jobs.js\`: 365-day window, 60-minute scan refined to 1 minute, smooth horizon, minimum elevation 0). Earthset/Earthrise: Horizons ${E1.horizonsCount}, app ${E1.appCount}. Sunset/sunrise: Horizons ${S1.horizonsCount}, app ${S1.appCount}; difference max **${f(S1.maxAbsMin, 2)} min**, mean ${f(S1.meanAbsMin, 2)} min; unmatched ${S1.pairs.filter(p => !p.pass).length}, extra ${S1.extra.length} (tolerance ${o.tolerances.eventMin} min). At this latitude the Sun's centre crosses the horizon slowly (about 0.003 deg per minute), so a 0.003 deg elevation difference moves a crossing by about a minute, on top of the app's 1-minute refinement.\n\n`;
  md += `**Next-event predictions.** For 30-day windows started every 14 days, the next event the app's countdown would show (inside the window, otherwise from the 400-day search after it) was compared with the first refined Horizons crossing after the window start: Earth ${E1.next.filter(n => n.pass).length}/${E1.next.length} agree (${E1.horizonsCount ? 'within ' + o.tolerances.eventMin + ' min' : 'Horizons has no crossing in the year and the app shows none'}), Sun ${S1.next.filter(n => n.pass).length}/${S1.next.length} agree within ${o.tolerances.eventMin} min.\n\n`;
  md += `| Horizons sunrise/sunset (UTC) | App (UTC) | Difference (min) | Pass |\n|---|---|---|---|\n`;
  for (const p of S1.pairs) md += `| ${p.type} ${p.horizons ? p.horizons.slice(0, 19).replace('T', ' ') : '-'} | ${p.app ? p.app.slice(0, 19).replace('T', ' ') : '-'} | ${p.dMin === null ? '-' : f(p.dMin, 2)} | ${p.pass ? 'PASS' : '**FAIL**'} |\n`;
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

// Terrain for clicked points (downsampled DEM): results of tests/coarse_validation.js.
function coarseSection() {
  const file = path.join(ROOT, 'data', 'coarse_validation.js');
  if (!fs.existsSync(file)) return '\n## D. Terrain for clicked points\n\nNot validated (run node tests/coarse_validation.js); clicked points use a smooth horizon.\n';
  const w = {}; new Function('window', fs.readFileSync(file, 'utf8'))(w);
  const V = w.LUNA_COARSE_VALIDATION, P1 = V.part1, P2 = V.part2;
  const SW = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'data', 'sites.js'), 'utf8'))(SW);
  const nameOf = id => { const s = SW.LUNA_SITES.find(x => x.id === id); return s ? s.name : id; };
  let md = `\n## D. Terrain for clicked points (downsampled ${V.dem.pixel_m} m DEM): **${V.pass ? 'PASS - shipped' : 'FAIL - not shipped'}**\n\n`;
  md += `\`tools/coarse_dem.py\` builds a ${V.dem.n} x ${V.dem.n} grid at ${V.dem.pixel_m} m covering the whole map square, as the area mean of the finest LOLA DEM fully covering each pixel (${V.dem.products.map(p => p.name).join(', ')}); heights in whole metres, row differences, zlib, base64, embedded as \`data/dem_coarse.js\` (${V.dem.fileMB.toFixed(2)} MB, loaded only when a point is clicked). The browser (Web Worker, \`js/jobs.js\`) computes the horizon with the method of \`tools/terrain.py\`: 360 azimuths, the same ray sample distances to 300 km, bilinear heights, lunar curvature, observer 2 m above the interpolated surface; rays stop at the edge of the grid.\n\n`;
  md += `Pass criteria (fixed before running \`node tests/coarse_validation.js\`): ${V.criteria.sites}; ${V.criteria.random}.\n\n`;
  md += `**(1) Curated south-pole sites** (2027, 30-minute steps, Earth minimum elevation 0):\n\n| Site | Horizon |diff| mean / max (deg) | Sunlit % (20 m) | Sunlit % (${V.dem.pixel_m} m) | Earth visible % (20 m) | Earth visible % (${V.dem.pixel_m} m) |\n|---|---|---|---|---|---|\n`;
  for (const r of V.sites) md += `| ${nameOf(r.id)} | ${r.hzMeanDiff.toFixed(2)} / ${r.hzMaxDiff.toFixed(2)} | ${r.sun20.toFixed(1)} | ${r.sunCoarse.toFixed(1)} | ${r.earth20.toFixed(1)} | ${r.earthCoarse.toFixed(1)} |\n`;
  md += `\n|difference in % sunlit|: mean **${P1.meanAbsSun.toFixed(2)}**, max **${P1.maxAbsSun.toFixed(2)}** points -> ${P1.pass ? 'PASS' : 'FAIL'}. |difference in % Earth visible|: mean ${P1.meanAbsEarth.toFixed(2)}, max ${P1.maxAbsEarth.toFixed(2)} points (reported, not a criterion). Horizon difference: mean of site means ${P1.meanHz.toFixed(2)} deg, largest single azimuth ${P1.maxHz.toFixed(2)} deg.\n\n`;
  if (P2) {
    md += `**(2) ${P2.n} random points in 85-90 S** (seed ${P2.seed}, uniform in area): 18.6-year average illumination (average visible solar-disk fraction, hourly ${P2.span}, same method and Sun-direction file as the cross-check) from the ${V.dem.pixel_m} m horizon vs the published map AVGVISIB_85S_060M_201608 (bilinear): |difference| mean **${P2.meanAbs.toFixed(2)}**, median ${P2.medianAbs.toFixed(2)}, max ${P2.maxAbs.toFixed(2)} points; ${P2.within5}/${P2.n} within 5 points; ${P2.bothZero} points are in permanent shadow in both -> ${P2.pass ? 'PASS' : 'FAIL'}.\n\n`;
    md += `| lat | E-lon | Ours (${V.dem.pixel_m} m) | Published map | Difference (pts) |\n|---|---|---|---|---|\n`;
    for (const r of V.randoms) md += `| ${r.lat} | ${r.lon} | ${(100 * r.ours).toFixed(1)}% | ${(100 * r.pgda).toFixed(1)}% | ${r.diffPts.toFixed(1)} |\n`;
  }
  if (V.impl) md += `\nImplementation check: on the same ${V.dem.pixel_m} m grid, \`tools/terrain.py\`'s own ray code and the browser code agree to ${Math.max(...V.impl.map(r => r.maxAbsDeg)).toExponential(1)} deg (${V.impl.map(r => r.id).join(', ')}).\n`;
  md += `\n${V.pass ? 'Result: shipped. Clicked or typed points inside the map get this horizon, labelled "terrain from coarser ' + V.dem.pixel_m + ' m data (less precise than curated sites)".' : 'Result: not shipped; clicked points keep the smooth horizon.'} No finer grid was needed. A 120 m grid of the same area would be about four times larger (over the 15 MB limit).\n`;
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
