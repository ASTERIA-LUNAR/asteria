#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6B Part 1: latency of the 3D terrain inspection (height / slope / position readout) and its values at fixed
 * check positions. High quality, Peak near Shackleton, 2028-09-25 10:04 UTC, laptop viewport 1440 x 900.
 * Check positions: a 9 x 6 grid of pixels over the picture in the default Orbit view, and a 9 x 3 grid in the
 * "Site eye level (2 m)" Walk view (grazing rays).
 *   node tests/inspect_perf.js --save tests/perf/inspect_before.json      (record)
 *   node tests/inspect_perf.js --compare tests/perf/inspect_before.json   (values must be identical as displayed)
 * Timing = one full readout update (hit point + DEM values + tooltip), median and 95th percentile over 5 repeats. */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.v3dQuality', 'high'); } catch (e) { /* */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + '#site=peak_shackleton&t=2028-09-25T10:04Z&w=1');
  await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
  await page.evaluate(() => AsteriaApp.ready());
  await page.evaluate(() => AsteriaApp.openDeploy());
  await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const run = async (view) => page.evaluate(view => {
    if (view === 'walk') document.querySelector('[data-preset="eye"]').click();
    return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
      const s = AsteriaView3D.testScene(), cv = s.renderer.domElement.getBoundingClientRect(), out = [], times = [];
      const nx = 9, ny = view === 'walk' ? 3 : 6, y0 = view === 'walk' ? 0.52 : 0.1, y1 = view === 'walk' ? 0.9 : 0.92;
      for (let rep = 0; rep < 5; rep++) {
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          const cx = cv.left + cv.width * (0.06 + 0.88 * i / (nx - 1)), cy = cv.top + cv.height * (y0 + (y1 - y0) * j / (ny - 1));
          const t0 = performance.now(), r = AsteriaView3D.testInspect(cx, cy), dt = performance.now() - t0;
          times.push(dt);
          if (rep === 0) out.push(r ? { i, j, h: r.h, slope: r.slope, lat: r.lat, lon: r.lon, dist: r.dist, d: r.d, product: r.product, area: r.area, drawn: r.drawn,
            txt: [r.h.toFixed(1), r.slope.toFixed(1), r.lat.toFixed(4), r.lon.toFixed(4), r.dist >= 1000 ? (r.dist / 1000).toFixed(2) + ' km' : r.dist.toFixed(0) + ' m', r.d, r.product, r.area, r.drawn].join('|') } : { i, j, none: true });
        }
      }
      times.sort((a, b) => a - b);
      res({ view, points: out, median: times[Math.floor(times.length / 2)], p95: times[Math.floor(times.length * 0.95)], max: times[times.length - 1], n: times.length, quality: AsteriaView3D.debug().quality, layers: AsteriaView3D.debug().layers.map(l => l.name) });
    })));
  }, view);
  const orbit = await run('orbit');
  const walk = await run('walk');
  await browser.close();
  const result = { generated: new Date().toISOString(), site: 'peak_shackleton', t: '2028-09-25T10:04Z', orbit, walk };
  for (const r of [orbit, walk]) console.log(`${r.view.padEnd(5)} (${r.quality}, layers ${r.layers.join(', ')}): ${r.points.filter(p => !p.none).length}/${r.points.length} points hit; per update median ${r.median.toFixed(2)} ms, 95th percentile ${r.p95.toFixed(2)} ms, max ${r.max.toFixed(2)} ms (${r.n} updates)`);
  if (arg('--save')) { fs.writeFileSync(arg('--save'), JSON.stringify(result, null, 1)); console.log('saved ' + arg('--save')); }
  let fails = 0;
  if (arg('--compare')) {
    const ref = JSON.parse(fs.readFileSync(arg('--compare'), 'utf8'));
    for (const v of ['orbit', 'walk']) {
      let same = 0, worst = { h: 0, slope: 0, ll: 0, dist: 0 };
      ref[v].points.forEach((p, k) => {
        const q = result[v].points[k];
        if (p.none || q.none) { if (p.none === q.none) same++; else { fails++; console.log(`DIFF ${v} ${p.i},${p.j}: hit ${!p.none} vs ${!q.none}`); } return; }
        worst.h = Math.max(worst.h, Math.abs(p.h - q.h)); worst.slope = Math.max(worst.slope, Math.abs(p.slope - q.slope));
        worst.ll = Math.max(worst.ll, Math.abs(p.lat - q.lat), Math.abs(p.lon - q.lon)); worst.dist = Math.max(worst.dist, Math.abs(p.dist - q.dist));
        if (p.txt === q.txt) same++; else { fails++; console.log(`DIFF ${v} ${p.i},${p.j}: before ${p.txt}  after ${q.txt}`); }
      });
      console.log(`${fails ? 'FAIL' : 'PASS'} ${v}: ${same}/${ref[v].points.length} readouts identical as displayed (height, slope, lat/lon, distance, data resolution); largest numeric difference: height ${worst.h.toExponential(1)} m, slope ${worst.slope.toExponential(1)}°, lat/lon ${worst.ll.toExponential(1)}°, distance ${worst.dist.toExponential(1)} m; latency before median ${ref[v].median.toFixed(2)} ms (p95 ${ref[v].p95.toFixed(2)}) -> after ${result[v].median.toFixed(2)} ms (p95 ${result[v].p95.toFixed(2)})`);
    }
  }
  if (errors.length) { console.log('Console errors:\n' + errors.join('\n')); fails++; }
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
