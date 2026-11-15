#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6B Part 3: is the 6 km tile visible as a square with relief shading ON in Orbit?
 * Peak near Shackleton, 2028-09-25 10:04 UTC, laptop 1440 x 900, Orbit at 60 km (pitch 40 deg), relief on, shadows off
 * (default). Ground points in bands 150-600 m just inside and just outside the tile edge (all four sides) are projected
 * to the screen; at each, the picture's luminance (mean of 3 x 3 pixels) and its detail (mean absolute difference
 * between neighbouring pixels in a 5 x 5 window) are read. Reported: mean luminance and mean detail inside vs outside
 * and their relative differences (smaller = the tile edge is less visible).
 *   node tests/tile_edge.js [--quality high,medium] [--tag before|after] [--json out.json] [--shots]   */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const TAG = arg('--tag') || 'run';

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const out = [];
  for (const q of (arg('--quality') || 'high,medium').split(',')) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(q => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.v3dQuality', q); } catch (e) { /* */ } }, q);
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + '#site=peak_shackleton&t=2028-09-25T10:04Z&w=1');
    await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
    await page.evaluate(() => AsteriaApp.ready());
    await page.evaluate(() => AsteriaApp.openDeploy());
    await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 60000 });
    await page.evaluate(() => { document.getElementById('v3dToggle').click(); AsteriaView3D.testRelief(true); AsteriaView3D.testCamera({ dist: 60000, pitch: 40 }); }); if (arg('--k')) await page.evaluate(k => { AsteriaView3D.testScene().U.uReliefK.value = +k; AsteriaView3D.testCamera({}); }, arg('--k'));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const s = AsteriaView3D.testScene(), M = window.AsteriaView3DMath, R = s.renderer, gl = R.getContext();
      R.render(s.scene, s.camera);
      const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const L = (x, y) => { const o = 4 * (y * W + x); return 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]; };
      const half = s.TM.half, bands = { inside: [], outside: [] };
      const groundAt = (e, n) => { const G = Math.abs(e) <= half && Math.abs(n) <= half ? s.TM : s.ringA; return M.toThree(M.enu(G, e, n, M.meshHeightAt(G, e, n))); };
      for (let side = 0; side < 4; side++) for (let u = -half + 300; u <= half - 300; u += 60) for (const [band, dl] of [['inside', -1], ['outside', 1]]) for (let dd = 150; dd <= 600; dd += 75) {
        const off = half + dl * dd, e = side === 0 ? off : side === 1 ? -off : u, n = side === 2 ? off : side === 3 ? -off : u;
        const p = groundAt(e, n), v = new THREE.Vector3(p[0], p[1], p[2]).project(s.camera);
        const x = Math.round((v.x + 1) / 2 * W), y = Math.round((v.y + 1) / 2 * H);   // GL rows from the bottom
        if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3 || v.z > 1) continue;
        let lum = 0, det = 0, nd = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) lum += L(x + i, y + j) / 9;
        for (let j = -2; j <= 2; j++) for (let i = -2; i < 2; i++) { det += Math.abs(L(x + i + 1, y + j) - L(x + i, y + j)) + Math.abs(L(x + j, y + i + 1) - L(x + j, y + i)); nd += 2; }
        bands[band].push({ lum, det: det / nd });
      }
      const mean = (a, k) => a.reduce((q, b) => q + b[k], 0) / a.length;
      const res = { n: [bands.inside.length, bands.outside.length], lumIn: mean(bands.inside, 'lum'), lumOut: mean(bands.outside, 'lum'), detIn: mean(bands.inside, 'det'), detOut: mean(bands.outside, 'det'), quality: AsteriaView3D.debug().quality, relief: AsteriaView3D.debug().relief };
      res.lumDiffPct = 100 * (res.lumIn - res.lumOut) / res.lumOut; res.detDiffPct = 100 * (res.detIn - res.detOut) / res.detOut;
      return res;
    });
    if (process.argv.includes('--shots')) { fs.mkdirSync(path.join(__dirname, '..', 'docs', 'tile_edge'), { recursive: true }); await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'tile_edge', `${TAG}_${q}_orbit60km_relief.png`) }); }
    console.log(`${TAG} ${q}: relief ${r.relief}; luminance inside ${r.lumIn.toFixed(1)} vs outside ${r.lumOut.toFixed(1)} (${r.lumDiffPct >= 0 ? '+' : ''}${r.lumDiffPct.toFixed(1)} %); detail inside ${r.detIn.toFixed(2)} vs outside ${r.detOut.toFixed(2)} (${r.detDiffPct >= 0 ? '+' : ''}${r.detDiffPct.toFixed(1)} %); points ${r.n.join('/')}${errors.length ? '; ERRORS ' + errors.join(' | ') : ''}`);
    out.push(Object.assign({ tag: TAG }, r));
    await ctx.close();
  }
  await browser.close();
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
