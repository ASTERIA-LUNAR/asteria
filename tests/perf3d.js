#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* 3D view performance: for every site with a 3D tile, the time from clicking Deploy to the first rendered frame
 * (and to the refined frame, when progressive loading is used) and the frame rate while orbiting, at every
 * quality level the view offers (or the default when it has none). Laptop viewport and an emulated phone
 * (phone = screen size and touch only; it still runs on this computer's GPU).
 * Round 6: also records the loading timeline (first frame, coarse tile replaced by the final tile = "LOD refine",
 * each terrain layer added, full terrain), the number of terrain layers/vertices, and the GPU resource counts
 * Three.js reports (renderer.info.memory geometries/textures, renderer.info.render calls/triangles of the last frame).
 * Exact GPU memory in bytes is not available to web pages (WebGL exposes no memory query), so it is not reported.
 * Usage: node tests/perf3d.js [--json out.json] [--sites a,b] [--quality low,medium,high] [--phone] [--orbit-ms 2000] */
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
        await page.evaluate(i => {
          window.__t0 = performance.now(); window.__tl = { layers: [] };
          // timeline poller (every animation frame): first frame, coarse tile replaced, each terrain layer added, full terrain
          const poll = () => {
            const V3 = window.AsteriaView3D, s = V3 && V3.testScene && V3.testScene(), now = performance.now() - window.__t0, tl = window.__tl;
            if (s && V3.debug().frames >= 1 && tl.first === undefined) tl.first = now;
            if (s && tl.first !== undefined && !s.coarse && tl.tileFinal === undefined) tl.tileFinal = now;
            if (s && s.layers) { const names = s.layers.map(l => l.name).join(','); if (names !== tl.lastNames) { tl.lastNames = names; tl.layers.push({ ms: Math.round(now), layers: names }); } }
            if (s && tl.first !== undefined && !s.refinePending && tl.full === undefined) tl.full = now;
            if (tl.full === undefined || now < 4000) requestAnimationFrame(poll);
          };
          requestAnimationFrame(poll);
          AsteriaApp.selectSiteById(i); document.getElementById('deployBtn').click();
        }, id);
        await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().frames >= 1, null, { timeout: 60000 });
        const first = await page.evaluate(() => performance.now() - window.__t0);
        await page.waitForFunction(() => { const d = AsteriaView3D.debug(); return !d.refining; }, null, { timeout: 60000 });
        const refined = await page.evaluate(() => performance.now() - window.__t0);
        await page.waitForTimeout(300);
        const info = await page.evaluate(() => { const d = AsteriaView3D.debug(), s = AsteriaView3D.testScene(), ri = s.renderer.info;
          return { q: d.quality, v: d.vertices, ext: d.extVertices || 0, geometries: ri.memory.geometries, textures: ri.memory.textures, calls: ri.render.calls, triangles: ri.render.triangles,
            layers: (s.layers || []).map(l => l.name + ':' + l.vertices), shadowMap: d.shadowMapSize, texel: d.shadowCamera && d.shadowCamera.texel, tl: window.__tl }; });
        await page.evaluate(() => AsteriaView3D.testKey('ArrowLeft', true));
        const f0 = await page.evaluate(() => [AsteriaView3D.debug().frames, performance.now()]);
        await page.waitForTimeout(+(arg('--orbit-ms') || 2000));
        const f1 = await page.evaluate(() => [AsteriaView3D.debug().frames, performance.now()]);
        await page.evaluate(() => AsteriaView3D.testKey('ArrowLeft', false));
        const fps = (f1[0] - f0[0]) / ((f1[1] - f0[1]) / 1000);
        // frame cost without the 60 frames/s display cap: 20 renders of the current view, each followed by a 1-pixel
        // readPixels so the time includes the GPU work (shadow passes + main pass); median in ms
        const renderMs = await page.evaluate(() => {
          const s = AsteriaView3D.testScene(), r = s.renderer, gl = r.getContext(), px = new Uint8Array(4), ts = [];
          for (let k = 0; k < 22; k++) { const t = performance.now(); r.render(s.scene, s.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ts.push(performance.now() - t); }
          ts.splice(0, 2); ts.sort((a, b) => a - b); return +ts[10].toFixed(1);
        });
        const tl = info.tl || {};
        const row = { viewport: vp.name, site: id, quality: info.q || '-', firstFrameMs: Math.round(first), refinedMs: Math.round(refined), fps: Math.round(fps), renderMs, vertices: info.v, extVertices: info.ext,
          firstFramePollMs: tl.first !== undefined ? Math.round(tl.first) : null, tileFinalMs: tl.tileFinal !== undefined ? Math.round(tl.tileFinal) : null, fullTerrainMs: tl.full !== undefined ? Math.round(tl.full) : null, layerSteps: tl.layers || [],
          gpuGeometries: info.geometries, gpuTextures: info.textures, drawCalls: info.calls, triangles: info.triangles, layers: info.layers, shadowMap: info.shadowMap, shadowTexel_m: info.texel ? +info.texel.toFixed(1) : null };
        rows.push(row);
        console.log(`${vp.name.padEnd(17)} ${id.padEnd(20)} ${String(row.quality).padEnd(7)} first frame ${String(row.firstFrameMs).padStart(5)} ms  refined ${String(row.refinedMs).padStart(5)} ms  ${String(row.fps).padStart(3)} fps ${String(row.renderMs).padStart(5)} ms/render  ${row.vertices} + ${row.extVertices} vertices  tile final ${row.tileFinalMs} ms  full terrain ${row.fullTerrainMs} ms  GPU geo ${row.gpuGeometries} tex ${row.gpuTextures} calls ${row.drawCalls} tris ${row.triangles}`);
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
