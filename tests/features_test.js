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
console.log(fails ? `${fails} FAILED` : 'ALL FEATURE TESTS PASS');
process.exit(fails ? 1 : 0);
