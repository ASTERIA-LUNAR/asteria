#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Custom point, one-year check against JPL Horizons.
 * Point (-70.9457, 67.9235 E), smooth horizon (it is outside the south-pole map, so the app uses a smooth
 * horizon there, as for any typed point outside the map). Horizons apparent azimuth/elevation of the Earth (399)
 * and the Sun (10) every hour from 2026-11-14 00:00 to 2027-11-14 00:00 UT (same settings as tests/validate.js).
 *  1. Angle errors of the engine at every hourly row (max / mean).
 *  2. Horizons' minimum Earth elevation over the year, when it occurs, and whether Earth goes below 0 deg.
 *  3. Every 0-deg crossing in the hourly table is refined with a 1-minute Horizons table (crossing linearly
 *     interpolated) and compared with the events the app computes (the app's own Explore job, js/jobs.js:
 *     365-day window, and the "next event" shown for 30-day windows started every 14 days). Pass: within 2 min,
 *     and no event missing or extra.
 * All responses are cached in tests/horizons_cache/ (first line = exact query URL), so reruns are offline.
 * Writes data/one_year_check.js (for the Validation page). tests/validate.js includes the result in
 * VALIDATION_REPORT.md. Usage: node tests/one_year_check.js */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('../js/engine.js');
const { fmtH, siteCoord, horizons, parseRows, azDiff } = require('./horizons_api.js');
const ROOT = path.join(__dirname, '..');

const SITE = { lat: -70.9457, lon: 67.9235 };
const START = new Date('2026-11-14T00:00:00Z'), STOP = new Date('2027-11-14T00:00:00Z');
const STEP = '1h';
const TOL_EL = 0.1, TOL_AZ = 0.2, TOL_EVENT_MIN = 2;
const DAY = 86400000;

function loadJobs() {
  global.window = global.window || {};
  window.LunaEngine = E;
  require('../js/jobs.js');
  return window.ASTERIA_JOBS(E);
}
function stat(a) { const b = a.map(Math.abs); return { max: Math.max(...b), mean: b.reduce((x, y) => x + y, 0) / b.length }; }

async function run(log) {
  log = log || (() => {});
  const res = { site: SITE, period: { start: START.toISOString(), stop: STOP.toISOString(), step: STEP }, horizon: 'smooth (0 deg)', tolerances: { elDeg: TOL_EL, azDeg: TOL_AZ, eventMin: TOL_EVENT_MIN } };
  const tables = {}, files = {};
  for (const [body, cmd] of [['earth', "'399'"], ['sun', "'10'"]]) {
    const h = await horizons({ COMMAND: cmd, SITE_COORD: siteCoord(SITE), START_TIME: `'${fmtH(START)}'`, STOP_TIME: `'${fmtH(STOP)}'`, STEP_SIZE: `'${STEP}'` });
    tables[body] = parseRows(h.text); files[body] = path.relative(ROOT, h.file).replace(/\\/g, '/');
    log(`${body}: ${tables[body].length} hourly rows (${h.cached ? 'cache' : 'fetched'})`);
  }
  res.cacheFiles = files;
  res.rows = tables.earth.length;

  // 1. angle errors at every row
  const d = { earth: { el: [], az: [] }, sun: { el: [], az: [] } };
  for (let i = 0; i < tables.earth.length; i++) {
    const t = tables.earth[i].t;
    if (tables.sun[i].t !== t) throw new Error('row times differ');
    const o = E.sunEarthAt(SITE, new Date(t));
    for (const b of ['earth', 'sun']) { d[b].el.push(o[b].el - tables[b][i].el); d[b].az.push(azDiff(o[b].az, tables[b][i].az)); }
  }
  res.angles = {};
  for (const b of ['earth', 'sun']) {
    const el = stat(d[b].el), az = stat(d[b].az);
    const hz = tables[b].map(r => r.el), maxHz = Math.max(...hz);
    res.angles[b] = { el, az, maxElHorizons: maxHz, pass: el.max < TOL_EL && az.max < TOL_AZ };
  }

  // 2. Horizons' minimum Earth elevation
  let iMin = 0; tables.earth.forEach((r, i) => { if (r.el < tables.earth[iMin].el) iMin = i; });
  const below = tables.earth.filter(r => r.el < 0).length;
  // refine the minimum with a 1-minute Horizons table over +-1 hour around the hourly minimum
  const r0 = new Date(tables.earth[iMin].t - 3600000), r1 = new Date(tables.earth[iMin].t + 3600000);
  const hm = await horizons({ COMMAND: "'399'", SITE_COORD: siteCoord(SITE), START_TIME: `'${fmtH(r0)}'`, STOP_TIME: `'${fmtH(r1)}'`, STEP_SIZE: "'1m'" });
  const mrows = parseRows(hm.text); let jMin = 0; mrows.forEach((r, j) => { if (r.el < mrows[jMin].el) jMin = j; });
  const mt = new Date(mrows[jMin].t);
  res.earthMin = { hourly: { el: tables.earth[iMin].el, time: new Date(tables.earth[iMin].t).toISOString() },
    el: mrows[jMin].el, time: mt.toISOString(), engineEl: E.sunEarthAt(SITE, mt).earth.el, minuteFile: path.relative(ROOT, hm.file).replace(/\\/g, '/'),
    engineYearMin: Math.min(...tables.earth.map(r => E.sunEarthAt(SITE, new Date(r.t)).earth.el)),
    hoursBelow0: below, pctBelow0: 100 * below / tables.earth.length, setsAtAll: below > 0 || mrows[jMin].el <= 0 };

  // 3. crossings: hourly table -> 1-minute Horizons table around each crossing
  const J = loadJobs();
  res.events = {};
  for (const [body, cmd] of [['earth', "'399'"], ['sun', "'10'"]]) {
    const rows = tables[body], hz = [];
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i - 1].el > 0) === (rows[i].el > 0)) continue;
      const t0 = new Date(rows[i - 1].t - 10 * 60000), t1 = new Date(rows[i].t + 10 * 60000);
      const h = await horizons({ COMMAND: cmd, SITE_COORD: siteCoord(SITE), START_TIME: `'${fmtH(t0)}'`, STOP_TIME: `'${fmtH(t1)}'`, STEP_SIZE: "'1m'" });
      const m = parseRows(h.text); let when = null;
      for (let k = 1; k < m.length; k++) if ((m[k - 1].el > 0) !== (m[k].el > 0)) { const f = m[k - 1].el / (m[k - 1].el - m[k].el); when = m[k - 1].t + f * (m[k].t - m[k - 1].t); break; }
      hz.push({ type: rows[i].el > 0 ? 'rise' : 'set', time: when, file: path.relative(ROOT, h.file).replace(/\\/g, '/') });
    }
    log(`${body}: ${hz.length} Horizons crossings in the year`);
    // the app's 365-day Explore window (same job the page runs; mask null = smooth horizon, minimum elevation 0)
    const ex = J.explorer({ site: SITE, start: START.getTime(), end: STOP.getTime(), step: E.defaultStepMin(START, STOP), mask: null, minEl: 0 });
    const app = ex.events[body].map(e => ({ type: e.type, time: e.time.getTime() }));
    const pairs = hz.map(h => {
      let best = null; app.forEach(a => { if (a.type === h.type && (!best || Math.abs(a.time - h.time) < Math.abs(best.time - h.time))) best = a; });
      const dMin = best && h.time !== null ? (best.time - h.time) / 60000 : null;
      return { type: h.type, horizons: h.time === null ? null : new Date(h.time).toISOString(), app: best ? new Date(best.time).toISOString() : null, dMin, pass: dMin !== null && Math.abs(dMin) < TOL_EVENT_MIN, file: h.file };
    });
    const matched = new Set(pairs.filter(p => p.pass).map(p => p.app));
    const extra = app.filter(a => !matched.has(new Date(a.time).toISOString())).map(a => ({ type: a.type, time: new Date(a.time).toISOString() }));
    // "next event" countdown targets for 30-day windows started every 14 days (events in the window, else the
    // 400-day search after it), compared with the first refined Horizons crossing after the window start.
    const next = [];
    for (let t = START.getTime(); t < STOP.getTime() - 30 * DAY; t += 14 * DAY) {
      const end = t + 30 * DAY, w = J.explorer({ site: SITE, start: t, end, step: E.defaultStepMin(new Date(t), new Date(end)), mask: null, minEl: 0 });
      const ev = w.events[body].find(e => e.time.getTime() > t) || w.after[body];
      const h = hz.find(x => x.time > t);
      const dMin = ev && h ? (ev.time.getTime() - h.time) / 60000 : null;
      // No Horizons crossing left in the year: agreement means the app finds none before STOP either
      // (an app event after STOP is beyond the fetched year and cannot be checked here).
      const ok = h ? !!(ev && ev.type === h.type && Math.abs(dMin) < TOL_EVENT_MIN) : (!ev || ev.time.getTime() > STOP.getTime());
      next.push({ from: new Date(t).toISOString(), app: ev ? ev.type + ' ' + ev.time.toISOString() : 'none within ' + Math.round((end - t) / DAY + J.SEARCH_DAYS_AFTER) + ' days (search limit)',
        horizons: h ? h.type + ' ' + new Date(h.time).toISOString() : 'none before ' + STOP.toISOString().slice(0, 10), dMin, pass: ok });
    }
    const ds = pairs.filter(p => p.dMin !== null).map(p => p.dMin);
    res.events[body] = { horizonsCount: hz.length, appCount: app.length, pairs, extra, next,
      maxAbsMin: ds.length ? Math.max(...ds.map(Math.abs)) : null, meanAbsMin: ds.length ? ds.reduce((a, b) => a + Math.abs(b), 0) / ds.length : null,
      pass: pairs.every(p => p.pass) && extra.length === 0 && next.every(n => n.pass) };
  }
  res.pass = res.angles.earth.pass && res.angles.sun.pass && res.events.earth.pass && res.events.sun.pass;
  return res;
}

function summary(r) {
  const f = (x, n) => x.toFixed(n);
  const L = [];
  L.push(`Custom point (${r.site.lat}, ${r.site.lon} E), smooth horizon, ${r.period.start.slice(0, 10)} to ${r.period.stop.slice(0, 10)}, ${r.rows} hourly rows per body`);
  for (const b of ['earth', 'sun']) L.push(`${b}: |dEl| max ${f(r.angles[b].el.max, 4)} mean ${f(r.angles[b].el.mean, 4)} deg; |dAz| max ${f(r.angles[b].az.max, 4)} mean ${f(r.angles[b].az.mean, 4)} deg -> ${r.angles[b].pass ? 'PASS' : 'FAIL'}`);
  L.push(`Horizons minimum Earth elevation ${f(r.earthMin.el, 4)} deg at ${r.earthMin.time} (1-minute table; engine there ${f(r.earthMin.engineEl, 4)}); Earth below 0 deg in ${r.earthMin.hoursBelow0} of ${r.rows} hours -> Earth ${r.earthMin.setsAtAll ? 'DOES' : 'does not'} set in this year`);
  for (const b of ['earth', 'sun']) { const e = r.events[b]; L.push(`${b} events: Horizons ${e.horizonsCount}, app ${e.appCount}, max |dt| ${e.maxAbsMin === null ? '-' : f(e.maxAbsMin, 2)} min, extra ${e.extra.length}; next-event checks ${e.next.filter(n => n.pass).length}/${e.next.length} -> ${e.pass ? 'PASS' : 'FAIL'}`); }
  L.push('ONE-YEAR CHECK: ' + (r.pass ? 'PASS' : 'FAIL'));
  return L.join('\n');
}

function write(r) {
  fs.writeFileSync(path.join(ROOT, 'data', 'one_year_check.js'), '// Generated by tests/one_year_check.js - do not edit\nwindow.LUNA_ONE_YEAR = ' + JSON.stringify(r, null, 1) + ';\n');
}

module.exports = { run, summary, write, SITE };
if (require.main === module) {
  run(console.log).then(r => { write(r); console.log(summary(r)); process.exit(r.pass ? 0 : 1); }).catch(e => { console.error(e); process.exit(2); });
}
