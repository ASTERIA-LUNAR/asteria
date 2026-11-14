#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Earth orientation in the 3D view: the sub-observer point on Earth (the point of Earth facing the site, i.e. the
 * centre of Earth's disk as seen from the site) from js/view3d_math.js (Astronomy Engine sidereal time and
 * precession-nutation, the engine's Moon frame) versus JPL Horizons (quantity 14, "Observer sub-longitude &
 * sub-latitude", target Earth 399, observer on the Moon surface), at 12 site/time cases. Limit: 1 deg.
 * Horizons responses are cached in tests/horizons_cache/. Usage: node tests/earth_orientation.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = require('astronomy-engine'), E = require('../js/engine.js'), M = require('../js/view3d_math.js');
const H = require('./horizons_api.js');
const loadWin = f => { const c = { window: {} }; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), c); return c.window; };

(async () => {
  const cases = [];
  for (const id of ['peak_shackleton', 'im1', 'mons_mouton']) {
    const hz = loadWin('data/horizons/' + id + '.js').LUNA_HORIZONS[id];
    for (const iso of ['2026-12-03T05:00', '2027-03-21T17:30', '2027-09-09T11:00', '2028-06-30T23:00']) cases.push({ id, lat: hz.lat, lon: hz.lon, t: new Date(iso + ':00Z') });
  }
  let worst = 0, n = 0, fails = 0;
  for (const c of cases) {
    const p = { COMMAND: "'399'", SITE_COORD: H.siteCoord(c), QUANTITIES: "'14'", START_TIME: `'${H.fmtH(c.t)}'`, STOP_TIME: `'${H.fmtH(new Date(c.t.getTime() + 60000))}'`, STEP_SIZE: "'1 m'" };
    const r = await H.horizons(p);
    const block = r.text.split('$$SOE')[1].split('$$EOE')[0].trim().split(/\r?\n/)[0];
    const nums = block.split(',').map(x => x.trim()).filter(x => /^-?\d+(\.\d+)?$/.test(x)).map(Number);
    const hLon = nums[nums.length - 2], hLat = nums[nums.length - 1];
    const se = E.sunEarthAt({ lat: c.lat, lon: c.lon }, c.t), tl = new Date(c.t.getTime() - se.earth.lightTime_s * 1000);
    const ax = M.earthAxes(A, tl, E._moonFrame(c.t), c.lat, c.lon), so = M.subObserver(ax, M.dirFromAzEl(se.earth.az, se.earth.el));
    const dLon = Math.abs(((so.lon - hLon + 540) % 360) - 180) * Math.cos(hLat * Math.PI / 180), dLat = Math.abs(so.lat - hLat);
    const err = Math.max(dLon, dLat); worst = Math.max(worst, err); n++; if (err > 1) fails++;
    console.log(`${c.id.padEnd(16)} ${c.t.toISOString().slice(0, 16)}  app ${so.lon.toFixed(3)}E ${so.lat.toFixed(3)}  Horizons ${hLon.toFixed(3)}E ${hLat.toFixed(3)}  diff ${err.toFixed(3)} deg${r.cached ? '' : ' (fetched)'}`);
  }
  console.log(`${fails ? 'FAIL' : 'PASS'} Earth sub-observer point vs JPL Horizons: ${n} cases, worst ${worst.toFixed(3)} deg (limit 1 deg; Horizons gives geodetic latitude, the app geocentric: up to 0.19 deg apart)`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
