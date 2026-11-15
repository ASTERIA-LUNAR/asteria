#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6C browser checks (laptop and emulated phone): ground-level shading is display only.
 *  - per-pixel normals: the 6 km tile (and, in Walk on laptops, the 5 m patch) carries a normal map of its own LOLA grid;
 *    terrain textures use the device's maximum anisotropic filtering
 *  - openness shading (sky-view factor): checkbox off by default, labelled, Walk/Rover only (no effect in Orbit);
 *    turning it on computes the factor and changes the picture but not the inspection readout, Sun/Earth directions,
 *    status tiles, rover readout or the shadow verdict at the site marker
 *  - relief shading: bounded (no black clipping at Mons Malapert in Rover, the case that was black before round 6C)
 *  - notes: the new items carry a classification label; no AI wording added; no console errors
 *   node tests/ui_round6c.js [--only laptop|phone] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url');
const ONLY = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--only'));
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' - ' + info : '')); if (!ok) fails++; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const AI_RE = /\bAI-|\bAI |artificial intelligence|generated|illustrated by/gi;
const AI_GRAPHICS = 'Graphics: the rover, the close-range surface texture in Walk and Rover, and the pixel-art rocket, Earth and Moon are drawn by code written with Claude Code (Anthropic), an AI coding assistant. Terrain shapes, maps, stars and the Earth texture are renderings of NASA and catalogue data, not generated images.';

async function open3d(page, site, t) {
  await page.goto(BASE + `#site=${site}&t=${t}Z&w=1`);
  await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
  await page.evaluate(() => AsteriaApp.ready());
  await page.evaluate(() => AsteriaApp.openDeploy());
  await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 60000 });
  await page.waitForTimeout(500);
}
// everything that must not depend on the display shading
const facts = page => page.evaluate(() => {
  const d = AsteriaView3D.debug(), st = document.getElementById('v3dStage').getBoundingClientRect();
  const r = AsteriaView3D.testInspect(st.left + st.width * 0.5, st.top + st.height * 0.8);
  AsteriaView3D.testInspect(-10, -10);
  const t = id => document.getElementById(id).textContent;
  return JSON.stringify({ insp: r && [r.h, r.slope, r.lat, r.lon, r.dist, r.d, r.area], sun: d.sunLightDir, earth: d.earthAzEl, tiles: [t('v3dSun'), t('v3dEarth'), t('v3dSunX'), t('v3dEarthX')], rover: d.mode === 'rover' ? [t('v3dRover'), JSON.stringify(d.rover)] : null, cam: d.camera });
});
const pixels = page => page.evaluate(() => { const s = AsteriaView3D.testScene(); s.renderer.render(s.scene, s.camera); const g = s.renderer.getContext(), w = g.drawingBufferWidth, h = g.drawingBufferHeight, b = new Uint8Array(4 * w * h); g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, b); let sum = 0, n = 0; for (let y = 0; y < Math.floor(h * 0.4); y += 2) for (let x = 0; x < w; x += 2) { const k = 4 * (y * w + x); sum += b[k] + b[k + 1] + b[k + 2]; n++; } return sum / n / 3; });

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  for (const vp of [{ name: 'laptop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    if (ONLY && ONLY !== vp.name) continue;
    const tag = '[' + vp.name + ']';
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.v3dQuality', 'medium'); } catch (e) { /* */ } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });

    await open3d(page, 'peak_shackleton', '2028-09-25T10:04');
    const d0 = await page.evaluate(() => { const d = AsteriaView3D.debug(), s = AsteriaView3D.testScene(); return { tnm: d.tileNormalMap, n: s.T.n, aniso: d.anisotropy, max: s.renderer.capabilities.getMaxAnisotropy(), texAniso: s.terrain.material.userData.local.uNMap.value && s.terrain.material.userData.local.uNMap.value.anisotropy, ao: d.ao, box: document.getElementById('v3dAO').checked, label: document.getElementById('v3dAO').parentNode.textContent.trim(), note: document.getElementById('v3dAONote').textContent }; });
    expect(`${tag} per-pixel normals: the 6 km tile has a normal map of its own LOLA grid (${d0.tnm} x ${d0.tnm} = the grid's ${d0.n} nodes)`, d0.tnm > 0 && d0.tnm === d0.n);
    expect(`${tag} anisotropic filtering at the device maximum (x${d0.max}) on the tile's normal map`, d0.aniso === d0.max && d0.texAniso === d0.max);
    expect(`${tag} openness shading: off by default, labelled "Walk and Rover", note says display only`, !d0.box && !d0.ao.on && d0.ao.def === false && /Openness shading \(Walk and Rover\)/.test(d0.label) && /display only/.test(d0.note) && /sky-view factor calculated from the LOLA heights/.test(d0.note), JSON.stringify(d0.ao));
    // Orbit: checking it has no effect in Orbit (uniform stays 0)
    await page.evaluate(() => AsteriaView3D.testAO(true));
    const orb = await page.evaluate(() => AsteriaView3D.debug().ao);
    expect(`${tag} openness shading: no effect in Orbit even when ticked`, orb.on === false && orb.pref === true);
    await page.evaluate(() => AsteriaView3D.testAO(null));

    // Walk at the site, then openness on/off: picture changes, facts identical
    await page.evaluate(() => { AsteriaView3D.testMode('walk'); AsteriaView3D.testCamera({ walk: { x: 0, z: 0, yaw: AsteriaView3D.debug().instant.sun.az + 90, pitch: -2 } }); });
    await page.waitForTimeout(vp.name === 'laptop' ? 1500 : 800);
    const dw = await page.evaluate(() => AsteriaView3D.debug());
    if (vp.name === 'laptop') expect(`${tag} per-pixel normals: in Walk the 5 m patch has a normal map of its own grid`, dw.layers.some(L => L.name === 'patch5m' && L.normalMap > 0), JSON.stringify(dw.layers.map(L => L.name + ':' + L.normalMap)));
    const fOff = await facts(page), pOff = await pixels(page);
    await page.evaluate(() => AsteriaView3D.testAO(true));
    await page.waitForFunction(() => { const a = AsteriaView3D.debug().ao; return a.on && !a.busy && a.ready.every(Boolean); }, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    const aoOn = await page.evaluate(() => ({ ao: AsteriaView3D.debug().ao, box: document.getElementById('v3dAO').checked }));
    const fOn = await facts(page), pOn = await pixels(page);
    expect(`${tag} openness shading: ticked in Walk it is computed (${aoOn.ao.ms} ms in the background) and darkens enclosed ground (mean ${pOff.toFixed(1)} -> ${pOn.toFixed(1)})`, aoOn.ao.on && aoOn.box && pOn < pOff);
    expect(`${tag} openness shading is display only: inspection readout, Sun/Earth directions, status tiles and camera identical with it on and off`, fOn === fOff, fOn === fOff ? undefined : fOff + ' vs ' + fOn);
    // shadow verdict at the site marker unchanged (shadows on)
    const sv = await page.evaluate(async () => {
      const t = AsteriaView3D.debug().instant.t; document.getElementById('v3dShadows').click(); await new Promise(r => setTimeout(r, 200));
      const a = AsteriaView3D.shadowProbe(t); AsteriaView3D.testAO(false); const b = AsteriaView3D.shadowProbe(t); document.getElementById('v3dShadows').click();
      return { a: [a.renderedLit, a.renderedLitCombined, a.validatedSunUp], b: [b.renderedLit, b.renderedLitCombined, b.validatedSunUp] };
    });
    expect(`${tag} openness shading: rendered shadow verdict at the site marker identical on and off (${JSON.stringify(sv.a)})`, JSON.stringify(sv.a) === JSON.stringify(sv.b));
    await page.evaluate(() => AsteriaView3D.testAO(null));

    // notes: classification labels, no AI wording added
    const notes = await page.evaluate(() => { const n = [...document.querySelectorAll('.v3d-notes li, #v3dNotes li')].map(li => li.textContent); return n.length ? n : [document.querySelector('.v3d-panel').textContent]; });
    const ao = notes.find(x => /Openness shading/.test(x)) || '', why = notes.find(x => /Why the ground looks smoother/.test(x)) || '';
    expect(`${tag} notes: "Openness shading" is labelled Illustrative and cites the method; "Why the ground looks smoother" explains the data limit`, /^Illustrative/.test(ao.trim()) && /Zak/.test(ao) && /not a light source/.test(ao) && /^Illustrative/.test(why.trim()) && /not in any dataset used/.test(why) && /illustrative appearance/.test(why) && /the data limit is unchanged/.test(why), ao.slice(0, 80) + ' | ' + why.slice(0, 80));
    const relief = notes.find(x => /Relief shading/.test(x)) || '';
    expect(`${tag} notes: relief shading described as a bounded factor (no pure black or white)`, /between 0\.4 and 1\.6/.test(relief) && !/70 %/.test(relief));
    // the only allowed AI wording is the round-4B "Graphics:" line (exact text, as in tests/ui_check.js)
    const panelAI = await page.evaluate(([re, g]) => { const t = document.querySelector('.v3d-panel').textContent; const rest = t.split(g).join(' '); return { has: t.indexOf(g) >= 0, hits: rest.match(new RegExp(re, 'gi')) || [] }; }, [AI_RE.source, AI_GRAPHICS]);
    expect(`${tag} no AI wording in the 3D panel except the "Graphics:" line (as updated in round 6E)`, panelAI.has && panelAI.hits.length === 0, JSON.stringify(panelAI));

    // relief bounded: Mons Malapert Rover (black before round 6C)
    if (vp.name === 'laptop') {
      await open3d(page, 'mons_malapert', '2028-09-28T03:00');
      await page.evaluate(() => AsteriaView3D.testMode('rover'));
      await page.waitForTimeout(1200);
      const fg = await page.evaluate(() => { const s = AsteriaView3D.testScene(); s.renderer.render(s.scene, s.camera); const g = s.renderer.getContext(), w = g.drawingBufferWidth, h = g.drawingBufferHeight, b = new Uint8Array(4 * w * h); g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, b); let sum = 0, n = 0; for (let y = 0; y < Math.floor(h * 0.25); y += 2) for (let x = Math.floor(w * 0.05); x < w * 0.95; x += 2) { const k = 4 * (y * w + x); sum += 0.2126 * b[k] + 0.7152 * b[k + 1] + 0.0722 * b[k + 2]; n++; } return { mean: sum / n, relief: AsteriaView3D.debug().relief }; });
      expect(`${tag} relief shading (on in Rover) no longer turns the sunlit Mons Malapert foreground black (mean luminance ${fg.mean.toFixed(1)} / 255; before round 6C: 7.9)`, fg.relief && fg.mean > 15);
    }
    expect(`${tag} no console errors or warnings`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
