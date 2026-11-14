#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* 3D view performance: for every site with a 3D tile, the time from clicking Deploy to the first rendered frame
 * (and to the refined frame, when progressive loading is used) and the frame rate while orbiting, at every
 * quality level the view offers (or the default when it has none). Laptop viewport and an emulated phone
 * (phone = screen size and touch only; it still runs on this computer's GPU).
 * Usage: node tests/perf3d.js [--json out.json] [--sites a,b] [--quality low,medium,high] [--phone] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), url = require('url');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

(async () => {
  const base = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const vps = [{ name: 'laptop', width: 1440, height: 900 }];
  if (process.argv.includes('--phone')) vps.push({ name: 'phone (emulated)', width: 390, height: 844, isMobile: true, hasTouch: true });
  const rows = [], errors = [];
  for (const vp of vps) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
    await page.evaluate(() => AsteriaApp.ready());
    const ids = (arg('--sites') ? arg('--sites').split(',') : await page.evaluate(() => window.ASTERIA_TERRAIN3D_IDS));
    let qualities = arg('--quality') ? arg('--quality').split(',') : null;
    for (const id of ids) {
      for (const q of (qualities || [null])) {
        // Leave the site, then select it and click Deploy at once (as a user would): the open time then includes
        // whatever the 3D view has to wait for in the main app.
        await page.evaluate(() => AsteriaApp.selectSiteById('apollo11')); await page.evaluate(() => AsteriaApp.ready());
        await page.evaluate(q => { try { if (q) localStorage.setItem('asteria.v3dQuality', q); else localStorage.removeItem('asteria.v3dQuality'); } catch (e) {} window.ASTERIA_V3D_NOPROBE = true; }, q);
        await page.evaluate(i => { window.__t0 = performance.now(); AsteriaApp.selectSiteById(i); document.getElementById('deployBtn').click(); }, id);
        await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().frames >= 1, null, { timeout: 60000 });
        const first = await page.evaluate(() => performance.now() - window.__t0);
        await page.waitForFunction(() => { const d = AsteriaView3D.debug(); return !d.refining; }, null, { timeout: 60000 });
        const refined = await page.evaluate(() => performance.now() - window.__t0);
        await page.waitForTimeout(300);
        const info = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { q: d.quality, v: d.vertices, ext: d.extVertices || 0 }; });
        await page.evaluate(() => AsteriaView3D.testKey('ArrowLeft', true));
        const f0 = await page.evaluate(() => [AsteriaView3D.debug().frames, performance.now()]);
        await page.waitForTimeout(2000);
        const f1 = await page.evaluate(() => [AsteriaView3D.debug().frames, performance.now()]);
        await page.evaluate(() => AsteriaView3D.testKey('ArrowLeft', false));
        const fps = (f1[0] - f0[0]) / ((f1[1] - f0[1]) / 1000);
        const row = { viewport: vp.name, site: id, quality: info.q || '-', firstFrameMs: Math.round(first), refinedMs: Math.round(refined), fps: Math.round(fps), vertices: info.v, extVertices: info.ext };
        rows.push(row);
        console.log(`${vp.name.padEnd(17)} ${id.padEnd(20)} ${String(row.quality).padEnd(7)} first frame ${String(row.firstFrameMs).padStart(5)} ms  refined ${String(row.refinedMs).padStart(5)} ms  ${String(row.fps).padStart(3)} fps  ${row.vertices} + ${row.extVertices} vertices`);
        await page.evaluate(() => AsteriaView3D.close(true));
        await page.waitForTimeout(200);
      }
    }
    await ctx.close();
  }
  await browser.close();
  if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(rows, null, 1));
  if (errors.length) { console.log('Console errors:\n' + errors.join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
