#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6E browser checks (laptop and emulated phone): the close-range surface texture (Illustrative) is display only.
 *  - covering OFF = pixel-identical to the round 6C build (--base <checkout of fe76cd6>; hash of the rendered pixels)
 *  - Orbit: pixel-identical with the checkbox on or off (uCover stays 0)
 *  - Walk/Rover: covering ON changes the picture; mean brightness of the ground band within 3 % of covering off
 *  - no light on back-facing or shadowed ground: with shadows on, every pixel that the Sun does not reach (identical to a
 *    render with the Sun's intensity set to 0) is identical with the covering on (all pixels checked)
 *  - readouts (inspection at 9 pixels + the cone near Peak near Shackleton), Sun/Earth directions, status tiles, rover
 *    readout/pose identical with the covering on and off
 *  - checkbox: label, Walk/Rover only, on by default, remembered for the session; disclaimer; Illustrative note; the
 *    updated "Graphics:" line is the only AI wording in the 3D panel; no console errors
 *  - frame time in Walk/Rover with the covering on vs off (GPU-synchronised renders)
 *  - screenshots: docs/ground_detail/round6e/<site>_<view>_<quality>_<device>_cover-{off,on}.jpg; numbers: results_6e.json
 *   node tests/ui_round6e.js [--only laptop|phone] [--base <path to round 6C checkout>] [--noshots] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only'), BASE_ROOT = arg('--base'), SHOTS = !process.argv.includes('--noshots');
const OUT = path.join(__dirname, '..', 'docs', 'ground_detail', 'round6e'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' - ' + info : '')); if (!ok) fails++; };
const AI_RE = /\bAI-|\bAI |artificial intelligence|generated|illustrated by/gi;
const AI_GRAPHICS = 'Graphics: the rover, the close-range surface texture in Walk and Rover, and the pixel-art rocket, Earth and Moon are drawn by code written with Claude Code (Anthropic), an AI coding assistant. Terrain shapes, maps, stars and the Earth texture are renderings of NASA and catalogue data, not generated images.';
const DISCLAIMER = 'Close-range surface texture is illustrative: fine grain and small craters are drawn for realism, not measured. Heights, slopes, readouts, shadows and the Sun direction are the LOLA data and the validated engine.';
const CASES = [
  { site: 'peak_shackleton', t: '2028-09-25T10:04' },
  { site: 'mons_malapert', t: '2028-09-28T03:00' }
];
// the isolated spike (round 6E Part 0) as seen from "Peak near Shackleton - best-lit point"
const CONE = { site: 'peak_shackleton_lw', t: '2028-09-25T10:04', lat0: -88.7851, lon0: 124.3438, lat: -88.76152, lon: 125.1511 };
function azimuth(a, b) {   // south polar stereographic: north = away from the pole, east = increasing longitude
  const R = 1737400, xy = (lat, lon) => { const r = 2 * R * Math.tan((90 - Math.abs(lat)) * Math.PI / 360), l = lon * Math.PI / 180; return [r * Math.sin(l), r * Math.cos(l)]; };
  const p = xy(a.lat0, a.lon0), q = xy(a.lat, a.lon), d = [q[0] - p[0], q[1] - p[1]], rp = Math.hypot(p[0], p[1]), l = a.lon0 * Math.PI / 180;
  const n = (d[0] * p[0] + d[1] * p[1]) / rp, e = d[0] * Math.cos(l) - d[1] * Math.sin(l);
  return { az: (Math.atan2(e, n) * 180 / Math.PI + 360) % 360, dist: Math.hypot(d[0], d[1]) };
}

async function open3d(ctx, root, site, t) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url.pathToFileURL(path.join(root, 'index.html')).href + `#site=${site}&t=${t}Z&w=1`);
  await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
  await page.evaluate(() => AsteriaApp.ready());
  await page.evaluate(() => AsteriaApp.openDeploy());
  await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  return { page, errors };
}
async function setView(page, view) {
  await page.evaluate(view => {
    const d = AsteriaView3D.debug(), sun = d.instant.sun;
    if (view === 'orbit60' || view === 'orbit3') {
      AsteriaView3D.testMode('orbit');
      AsteriaView3D.testCamera(view === 'orbit60' ? { dist: 60000, pitch: 40, yaw: sun.az + 145 } : { dist: 3000, pitch: 25, yaw: sun.az + 145 });
    } else if (view === 'walk') {
      AsteriaView3D.testMode('walk');
      AsteriaView3D.testCamera({ walk: { x: 0, z: 0, yaw: sun.az + 90, pitch: -2 } });
    } else AsteriaView3D.testMode('rover');
  }, view);
  await page.waitForTimeout(400);
}
// render now and keep the pixels in the page; returns hash + ground-band (rows 4-42 % from the bottom) mean luminance
const grab = (page, key) => page.evaluate(k => {
  const s = AsteriaView3D.testScene(); s.renderer.render(s.scene, s.camera);
  const g = s.renderer.getContext(), w = g.drawingBufferWidth, h = g.drawingBufferHeight, b = new Uint8Array(4 * w * h);
  g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, b);
  (window.__img = window.__img || {})[k] = b;
  const u = new Uint32Array(b.buffer); let hs = 2166136261 >>> 0; for (let i = 0; i < u.length; i++) hs = Math.imul(hs ^ u[i], 16777619) >>> 0;
  let sum = 0, n = 0, wh = 0, bl = 0;
  for (let y = Math.floor(h * 0.04); y < Math.floor(h * 0.42); y++) for (let x = Math.floor(w * 0.05); x < Math.floor(w * 0.95); x++) {
    const i = 4 * (y * w + x), L = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2]; sum += L; n++; if (L >= 254) wh++; if (L <= 2) bl++;
  }
  let gr = 0, gn = 0;
  for (let y = Math.floor(h * 0.04); y < Math.floor(h * 0.42) - 1; y += 2) for (let x = Math.floor(w * 0.05); x < Math.floor(w * 0.95) - 1; x += 2) {
    const i = 4 * (y * w + x), L = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2], j = i + 4, k2 = i + 4 * w;
    gr += Math.abs(0.2126 * b[j] + 0.7152 * b[j + 1] + 0.0722 * b[j + 2] - L) + Math.abs(0.2126 * b[k2] + 0.7152 * b[k2 + 1] + 0.0722 * b[k2 + 2] - L); gn++;
  }
  return { hash: hs.toString(16), w, h, mean: +(sum / n).toFixed(2), detail: +(gr / gn).toFixed(2), clipWhite: +(100 * wh / n).toFixed(2), clipBlack: +(100 * bl / n).toFixed(2) };
}, key);
const ndiff = (page, a, b) => page.evaluate(([a, b]) => { const A = __img[a], B = __img[b]; let d = 0; for (let k = 0; k < A.length; k += 4) if (A[k] !== B[k] || A[k + 1] !== B[k + 1] || A[k + 2] !== B[k + 2]) d++; return d; }, [a, b]);
// pixels the Sun does not reach in "off" (identical to the render without the Sun) must be identical in "on"
const unlitCheck = page => page.evaluate(() => {
  const s = AsteriaView3D.testScene(), i0 = s.sun.intensity, j0 = s.sunNear ? s.sunNear.intensity : 0;
  s.sun.intensity = 0; if (s.sunNear) s.sunNear.intensity = 0;
  s.renderer.render(s.scene, s.camera);
  const g = s.renderer.getContext(), w = g.drawingBufferWidth, h = g.drawingBufferHeight, D = new Uint8Array(4 * w * h);
  g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, D);
  s.sun.intensity = i0; if (s.sunNear) s.sunNear.intensity = j0;
  const A = __img.off, B = __img.on; let unlit = 0, bad = 0, bad1 = 0, lit = 0;
  for (let k = 0; k < A.length; k += 4) {
    if (A[k] === D[k] && A[k + 1] === D[k + 1] && A[k + 2] === D[k + 2]) {
      unlit++;
      const m = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2]));
      if (m > 0) bad++; if (m > 1) bad1++;
    } else lit++;
  }
  return { unlit, lit, changed: bad, changedMoreThan1: bad1 };
});
const facts = page => page.evaluate(() => {
  const d = AsteriaView3D.debug(), st = document.getElementById('v3dStage').getBoundingClientRect(), insp = [];
  for (const fy of [0.55, 0.7, 0.85]) for (const fx of [0.25, 0.5, 0.75]) { const r = AsteriaView3D.testInspect(st.left + st.width * fx, st.top + st.height * fy); insp.push(r && [r.h, r.slope, r.lat, r.lon, r.dist, r.d, r.area, r.product]); }
  AsteriaView3D.testInspect(-10, -10);
  const t = id => document.getElementById(id).textContent;
  return JSON.stringify({ insp, sun: d.sunLightDir, earth: d.earthDir, earthAzEl: d.earthAzEl, tiles: [t('v3dSun'), t('v3dEarth'), t('v3dSunX'), t('v3dEarthX'), document.getElementById('v3dTileSun').className], rover: d.mode === 'rover' ? [t('v3dRover'), JSON.stringify(d.rover)] : null, camera: d.camera, eye: d.eyeAboveGround });
});
const setShadows = (page, on) => page.evaluate(on => { const b = document.getElementById('v3dShadows'); if (b.checked !== on) { b.checked = on; b.dispatchEvent(new Event('change')); } }, on);
const frameMs = page => page.evaluate(() => {
  const s = AsteriaView3D.testScene(), g = s.renderer.getContext(), px = new Uint8Array(4);
  for (let i = 0; i < 5; i++) { s.renderer.render(s.scene, s.camera); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); }
  const t0 = performance.now(), N = 40;
  for (let i = 0; i < N; i++) { s.renderer.render(s.scene, s.camera); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); }
  return +((performance.now() - t0) / N).toFixed(2);
});

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const results = [];
  const here = path.join(__dirname, '..');
  for (const vp of [{ name: 'laptop', width: 1440, height: 900, quals: ['low', 'medium', 'high'] }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, quals: ['medium'] }]) {
    if (ONLY && ONLY !== vp.name) continue;
    const tag = '[' + vp.name + ']';
    for (const c of CASES) for (const q of vp.quals) {
      const mk = async () => { const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1 }); await ctx.addInitScript(q => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.tourOffered', '1'); localStorage.setItem('asteria.v3dQuality', q); } catch (e) { /* */ } }, q); return ctx; };
      const ctx = await mk();
      const { page, errors } = await open3d(ctx, here, c.site, c.t);
      let bctx = null, bpage = null;
      if (BASE_ROOT) { bctx = await mk(); bpage = (await open3d(bctx, BASE_ROOT, c.site, c.t)).page; }
      const K = `${tag} ${c.site} ${q}`;
      for (const view of ['orbit60', 'orbit3', 'walk', 'rover']) {
        if (vp.name === 'phone' && view === 'orbit60') continue;
        await setView(page, view);
        await page.evaluate(() => AsteriaView3D.testCover(false));
        const off = await grab(page, 'off'); const fOff = await facts(page);
        if (bpage) {
          await setView(bpage, view);
          const b = await grab(bpage, 'base');
          expect(`${K} ${view}: covering off = pixel-identical to the round 6C build`, b.hash === off.hash && b.w === off.w, b.hash + ' vs ' + off.hash);
        }
        await page.evaluate(() => AsteriaView3D.testCover(true));
        const on = await grab(page, 'on'); const fOn = await facts(page);
        const dbg = await page.evaluate(() => AsteriaView3D.debug().cover);
        const changed = await ndiff(page, 'off', 'on');
        expect(`${K} ${view}: readouts, Sun/Earth directions, status tiles, rover identical with the covering on/off`, fOff === fOn);
        const rec = { device: vp.name, site: c.site, quality: q, view, off, on, changedPx: changed, cover: dbg };
        if (view.startsWith('orbit')) {
          expect(`${K} ${view}: Orbit pixel-identical with the checkbox on or off (uCover ${dbg.on ? 1 : 0})`, changed === 0 && !dbg.on && off.hash === on.hash);
        } else {
          const rel = (on.mean - off.mean) / Math.max(1, off.mean) * 100;
          rec.meanChangePct = +rel.toFixed(2);
          expect(`${K} ${view}: covering on changes the ground picture (${changed} px)`, changed > 0 && dbg.on);
          expect(`${K} ${view}: ground-band mean brightness within 3 % of covering off (${off.mean} -> ${on.mean}, ${rel.toFixed(2)} %)`, Math.abs(rel) <= 3);
          // frame time
          await page.evaluate(() => AsteriaView3D.testCover(false)); rec.msOff = await frameMs(page);
          await page.evaluate(() => AsteriaView3D.testCover(true)); rec.msOn = await frameMs(page);
          console.log(`     frame time ${view} ${q} ${vp.name}: off ${rec.msOff} ms, on ${rec.msOn} ms`);
          if (q === 'medium') expect(`${K} ${view}: >= 30 fps with the covering on (${rec.msOn} ms/frame, GPU-synchronised)`, rec.msOn <= 33.4);
          // shadows on: no light on ground the Sun does not reach
          await setShadows(page, true); await page.waitForTimeout(300);
          await page.evaluate(() => AsteriaView3D.testCover(false)); await grab(page, 'off');
          await page.evaluate(() => AsteriaView3D.testCover(true)); await grab(page, 'on');
          const u = await unlitCheck(page);
          rec.unlit = u;
          expect(`${K} ${view}: shadows on - ${u.unlit} pixels not reached by the Sun are unchanged with the covering on`, u.unlit > 0 && u.changedMoreThan1 === 0, JSON.stringify(u));
          await setShadows(page, false); await page.waitForTimeout(200);
        }
        if (SHOTS && (q === 'medium' || (q === 'high' && c.site === 'peak_shackleton'))) {
          const cv = await page.$('#v3dStage canvas');
          for (const cv0 of [false, true]) {
            await page.evaluate(o => AsteriaView3D.testCover(o), cv0); await page.waitForTimeout(500);
            const name = `${c.site}_${view}_${q}_${vp.name}_cover-${cv0 ? 'on' : 'off'}.jpg`;
            await cv.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 90 });
          }
          await page.evaluate(() => AsteriaView3D.testCover(true));
        }
        console.log(`     ${view}: mean ${off.mean} -> ${on.mean}, detail ${off.detail} -> ${on.detail}, white ${off.clipWhite} -> ${on.clipWhite} %, black ${off.clipBlack} -> ${on.clipBlack} %`);
        results.push(rec);
      }
      // UI (once per device, first case, medium)
      if (c === CASES[0] && q === 'medium') {
        await setView(page, 'orbit3');
        const ui0 = await page.evaluate(() => ({ row: document.getElementById('v3dCoverRow').hidden, note: document.getElementById('v3dCoverNote').hidden }));
        expect(`${tag} checkbox and disclaimer hidden in Orbit`, ui0.row && ui0.note);
        await page.evaluate(() => AsteriaView3D.testCover(true));
        await setView(page, 'walk');
        const ui = await page.evaluate(() => ({ row: document.getElementById('v3dCoverRow').hidden, lbl: document.getElementById('v3dCoverRow').textContent.trim(), box: document.getElementById('v3dCover').checked, note: document.getElementById('v3dCoverNote').textContent, noteHidden: document.getElementById('v3dCoverNote').hidden }));
        expect(`${tag} Walk: checkbox "Close-range surface texture (illustrative)" visible and on`, !ui.row && ui.lbl === 'Close-range surface texture (illustrative)' && ui.box, JSON.stringify(ui));
        expect(`${tag} Walk: disclaimer shown, exact text`, !ui.noteHidden && ui.note === DISCLAIMER);
        await page.evaluate(() => { const b = document.getElementById('v3dCover'); b.checked = false; b.dispatchEvent(new Event('change')); });
        await setView(page, 'rover');
        const r1 = await page.evaluate(() => ({ box: document.getElementById('v3dCover').checked, on: AsteriaView3D.debug().cover.on }));
        await setView(page, 'orbit3'); await setView(page, 'walk');
        const r2 = await page.evaluate(() => ({ box: document.getElementById('v3dCover').checked, on: AsteriaView3D.debug().cover.on }));
        expect(`${tag} choice remembered for the session (off in Walk -> still off in Rover and after Orbit)`, !r1.box && !r1.on && !r2.box && !r2.on);
        await page.evaluate(() => AsteriaView3D.testCover(true));
        const notes = await page.evaluate(() => {
          const li = [...document.querySelectorAll('#v3dPanel li, .v3d-notes li')].map(e => e.textContent.trim());
          const panel = document.querySelector('#v3dPanel') || document.querySelector('.v3d-side') || document.body;
          return { li, text: panel.textContent };
        });
        const gl = notes.li.filter(t => /^Graphics:/.test(t));
        expect(`${tag} the 3D notes have exactly one "Graphics:" line with the updated text`, gl.length === 1 && gl[0] === AI_GRAPHICS, JSON.stringify(gl).slice(0, 200));
        const ill = notes.li.filter(t => /^Illustrative\s*Close-range surface texture/.test(t));
        expect(`${tag} the notes have an Illustrative item for the close-range surface texture`, ill.length === 1);
        const hits = (notes.li.join('\n').match(AI_RE) || []).length, gHits = (AI_GRAPHICS.match(AI_RE) || []).length;
        expect(`${tag} no AI wording in the 3D notes except the "Graphics:" line`, hits === gHits, hits + ' vs ' + gHits);
        expect(`${tag} spike note on the 5 m patch item`, notes.li.some(t => /isolated spikes that are probably data artifacts/.test(t)) || !(await page.evaluate(() => AsteriaView3D.debug().patch5m)));
      }
      expect(`${K}: no console errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
      await ctx.close(); if (bctx) await bctx.close();
    }
  }
  // the cone near Peak near Shackleton: readout identical with the covering on and off
  if (!ONLY || ONLY === 'laptop' || ONLY === 'cone') {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.tourOffered', '1'); localStorage.setItem('asteria.v3dQuality', 'medium'); } catch (e) { /* */ } });
    const { page, errors } = await open3d(ctx, here, CONE.site, CONE.t);
    const a = azimuth(CONE);
    // stand 150 m before the cone on the line from the site (x = east, z = -north), looking at it
    await page.evaluate(a => { const r = a.dist - 150, t = a.az * Math.PI / 180; AsteriaView3D.testMode('walk'); AsteriaView3D.testCamera({ walk: { x: r * Math.sin(t), z: -r * Math.cos(t), yaw: a.az, pitch: 3 } }); }, a);
    await page.waitForTimeout(600);
    const probe = () => page.evaluate(() => {
      const st = document.getElementById('v3dStage').getBoundingClientRect(); let best = null;
      for (let dy = -100; dy <= 300; dy += 3) { const r = AsteriaView3D.testInspect(st.left + st.width / 2, st.top + st.height / 2 + dy); if (r && (!best || r.h > best.h)) best = { h: r.h, slope: r.slope, lat: r.lat, lon: r.lon, dist: r.dist, product: r.product }; }
      AsteriaView3D.testInspect(-10, -10); return JSON.stringify(best);
    });
    await page.evaluate(() => AsteriaView3D.testCover(false)); const c0 = await probe();
    await page.evaluate(() => AsteriaView3D.testCover(true)); const c1 = await probe();
    expect(`cone (azimuth ${a.az.toFixed(1)}°, ${a.dist.toFixed(0)} m): highest inspection readout on the screen column identical with the covering on/off`, c0 === c1 && c0 !== 'null', c1);
    if (SHOTS) { const cv = await page.$('#v3dStage canvas'); await cv.screenshot({ path: path.join(OUT, 'cone_peak_shackleton_lw_walk_medium_laptop_cover-on.jpg'), type: 'jpeg', quality: 90 }); }
    // Part 2: wheel tracks - drive the rover, then the path is drawn as faint strips (covering on) and nothing else changes
    await page.evaluate(() => AsteriaView3D.testMode('rover'));
    await page.waitForTimeout(300);
    await page.evaluate(() => AsteriaView3D.testKey('Shift' + 'Left', true));
    await page.evaluate(() => AsteriaView3D.testKey('KeyW', true)); await page.waitForTimeout(4000);
    await page.evaluate(() => AsteriaView3D.testKey('KeyW', false));
    await page.evaluate(() => AsteriaView3D.testKey('ArrowLeft', true)); await page.waitForTimeout(1200); await page.evaluate(() => AsteriaView3D.testKey('ArrowLeft', false));
    await page.evaluate(() => AsteriaView3D.testKey('ShiftLeft', false));
    await page.waitForTimeout(500);
    const wp = await page.evaluate(() => AsteriaView3D.debug().cover.wheelPoints);
    await page.evaluate(() => AsteriaView3D.testCover(false)); await grab(page, 'off'); const w0 = await facts(page);
    await page.evaluate(() => AsteriaView3D.testCover(true)); await grab(page, 'on'); const w1 = await facts(page);
    const wd = await ndiff(page, 'off', 'on');
    // the tracks alone: covering on, with and without the recorded path
    const tk = await page.evaluate(() => { const s = AsteriaView3D.testScene(), n = s.U.uTrkN.value; s.U.uTrkN.value = 0; return n; });
    await grab(page, 'off');
    await page.evaluate(n => { AsteriaView3D.testScene().U.uTrkN.value = n; }, tk);
    await grab(page, 'on');
    const wtd = await ndiff(page, 'off', 'on');
    expect(`wheel tracks: drawn (${wtd} px differ with vs without the recorded path, covering on)`, wtd > 0);
    results.push({ wheelTracks: { points: wp, pxChangedByTracks: wtd } });
    expect(`wheel tracks: ${wp} path points recorded while driving; covering on changes the picture (${wd} px); readouts, rover pose and status identical`, wp > 2 && wd > 0 && w0 === w1);
    const wpOrbit = await page.evaluate(() => { AsteriaView3D.testMode('orbit'); return AsteriaView3D.debug().cover.on; });
    expect('wheel tracks: no effect in Orbit (covering off there)', wpOrbit === false);
    await page.evaluate(() => AsteriaView3D.testMode('rover')); await page.waitForTimeout(400);
    if (SHOTS) { const cv = await page.$('#v3dStage canvas'); await cv.screenshot({ path: path.join(OUT, 'wheel_tracks_peak_shackleton_lw_rover_medium_laptop_cover-on.jpg'), type: 'jpeg', quality: 90 }); }
    results.push({ cone: JSON.parse(c1), azimuth: a });
    expect('cone page: no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'results_6e' + (ONLY ? '_' + ONLY : '') + '.json'), JSON.stringify(results, null, 1));
  await browser.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
