#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Prompt 7 performance check: Walk and Rover frame rate at a given quality (default Medium) for every site with a 3D
 * tile, laptop 1440 x 900. Per mode: frames/s from requestAnimationFrame over 2 s while moving forward (browser cap 60)
 * (frames actually rendered by the 3D view, counted from its frame counter; browser cap 60) and the GPU-synced render time (mean of 30 renders, each followed by a 1-pixel read-back).
 *   node tests/perf_modes.js [--quality medium] [--json out.json] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const Q = arg('--quality') || 'medium';
(async () => {
  const base = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(q => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.spotlightShown', '1'); localStorage.setItem('asteria.v3dQuality', q); } catch (e) { } }, Q);
  const page = await ctx.newPage(), errors = [], rows = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 60000 }); await page.evaluate(() => AsteriaApp.ready());
  const ids = await page.evaluate(() => window.ASTERIA_TERRAIN3D_IDS);
  let fail = 0;
  for (const id of ids) {
    await page.evaluate(i => AsteriaApp.selectSiteById(i), id); await page.evaluate(() => AsteriaApp.ready());
    await page.evaluate(() => AsteriaApp.openDeploy());
    await page.waitForFunction(() => AsteriaView3D.debug().open && !AsteriaView3D.debug().refining && AsteriaView3D.debug().frames > 2, null, { timeout: 90000 });
    await page.waitForTimeout(500);
    for (const m of ['walk', 'rover']) {
      await page.evaluate(m => AsteriaView3D.testMode(m), m); await page.waitForTimeout(600);
      const r = await page.evaluate(() => new Promise(res => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }));
        let n = 0; const t0 = performance.now(), f0 = AsteriaView3D.debug().frames;
        const f = t => { n++; if (t - t0 < 2000) requestAnimationFrame(f); else {
          window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }));
          const s = AsteriaView3D.testScene(), g = s.renderer.getContext(), px = new Uint8Array(4);
          s.renderer.render(s.scene, s.camera); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
          const a = performance.now(); for (let i = 0; i < 30; i++) { s.renderer.render(s.scene, s.camera); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); }
          const rendered = (AsteriaView3D.debug().frames - f0) / ((t - t0) / 1000);
          res({ fps: rendered, rafFps: n / ((t - t0) / 1000), renderMs: (performance.now() - a) / 30, mode: AsteriaView3D.debug().mode });
        } };
        requestAnimationFrame(f);
      }));
      const ok = r.mode === m && r.fps >= 30 && r.renderMs < 33.3;
      if (!ok) fail++;
      rows.push(Object.assign({ site: id, quality: Q }, r, { want: m }));
      console.log(`${ok ? 'PASS' : 'FAIL'} ${id.padEnd(20)} ${Q} ${m.padEnd(5)} ${r.fps.toFixed(1)} fps (rendered frames while driving)  ${r.renderMs.toFixed(2)} ms/render (GPU-synced)`);
    }
    await page.evaluate(() => AsteriaView3D.close()); await page.waitForTimeout(200);
  }
  await browser.close();
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(rows, null, 1));
  if (errors.length) { console.log('Console errors:\n' + errors.join('\n')); fail++; }
  console.log(fail ? `FAILED: ${fail}` : 'ALL PASS');
  process.exit(fail ? 1 : 0);
})();
