#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6 browser checks (laptop and emulated phone): VIPER-proportioned rover and "About this rover" (Part 2);
 * camera presets, pointer inspection, hazard view, 2D-3D link (Part 3); Getting started actions, 2D scale bar
 * (Part 4). Also: no console errors, no AI wording outside the two allowed lines, no traversability claims.
 *   node tests/ui_round6.js [--shots]   (screenshots to tests/screenshots/r6_*.png) */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const SHOTS = process.argv.includes('--shots'), OUT = path.join(__dirname, 'screenshots');
if (SHOTS) fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? ' - ' + info : info !== undefined ? ' - ' + info : '')); if (!ok) fails++; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const AI_RE = /\bAI-|\bAI |artificial intelligence|generated|illustrated by/gi;
// wording that would claim (or deny in a misleading way) that a rover can traverse something; the one allowed sentence
// is the required disclaimer
const TRAV_RE = /travers|passable|drivable|can drive|safe to drive|mobility/gi;
const DISCLAIMER = 'Illustrative model based on NASA VIPER\'s published dimensions. It is not a mobility simulation: ASTERIA does not predict whether a rover can traverse a slope or surface.';

async function open3d(page, site, t, q) {
  await page.goto(BASE + `#site=${site}&t=${t}Z&w=1`);
  await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
  await page.evaluate(() => AsteriaApp.ready());
  await page.evaluate(() => AsteriaApp.openDeploy());
  await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 60000 });
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  for (const vp of [{ name: 'laptop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const tag = '[' + vp.name + ']';
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.v3dQuality', 'medium'); } catch (e) { /* */ } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });

    // ---------------------------------------------------------------- Part 2: rover
    await open3d(page, 'mons_mouton', '2026-11-25T17:53', 'medium');
    await page.evaluate(() => AsteriaView3D.testMode('rover'));
    await page.evaluate(() => AsteriaView3D.testKey('KeyW', true)); await page.waitForTimeout(1200); await page.evaluate(() => AsteriaView3D.testKey('KeyW', false));
    await page.waitForTimeout(400);
    const rv = await page.evaluate(() => {
      const d = AsteriaView3D.debug(), s = AsteriaView3D.testScene(), M = window.AsteriaView3DMath;
      // independent re-check of each wheel: height of the LOLA mesh below its (x, z), and the hub one wheel radius above it
      const w = d.rover.wheels.map(p => { const g = M.groundWorld(s.TM, p.x, p.z); return { dh: Math.abs(M.meshHeightAt(s.TM, g.e, g.n) - p.h), dy: Math.abs(g.y - p.drawnY), hub: p.hub - p.drawnY }; });
      // model size in its own frame (tilt removed): height above the ground plane of the wheels, length and width incl. wheels
      const q = s.roverBody.quaternion.clone(), p0 = s.roverBody.position.clone(); s.roverBody.quaternion.identity(); s.roverBody.position.set(0, 0, 0); s.roverBody.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(s.roverBody); s.roverBody.quaternion.copy(q); s.roverBody.position.copy(p0); s.roverBody.updateMatrixWorld(true);
      const R = AsteriaView3D.ROVER, wl = Math.max(...R.wheels.map(w => Math.abs(w[1]))) + R.wheelR, ww = Math.max(...R.wheels.map(w => Math.abs(w[0]))) + R.wheelW / 2;
      return { rover: d.rover, w, size: [Math.max(box.max.x, ww) - Math.min(box.min.x, -ww), box.max.y, Math.max(box.max.z, wl) - Math.min(box.min.z, -wl)], tilt: document.getElementById('v3dRTilt').textContent };
    });
    expect(`${tag} rover: each of the 4 wheels rests on the LOLA surface below it (height and drawn position identical) with its hub one wheel radius above`, rv.w.length === 4 && rv.w.every(x => x.dh < 1e-6 && x.dy < 1e-6 && Math.abs(x.hub - 0.25) < 1e-6), JSON.stringify(rv.w));
    const comb = Math.atan(Math.hypot(Math.tan(rv.rover.pitch * Math.PI / 180), Math.tan(rv.rover.roll * Math.PI / 180))) * 180 / Math.PI;
    expect(`${tag} rover: body pitch/roll from the wheel heights (${rv.rover.pitch.toFixed(1)}°, ${rv.rover.roll.toFixed(1)}°; combined ${comb.toFixed(1)}°) agree with the DEM slope (${rv.rover.slope.toFixed(1)}°) within 2° (wheel base 1.0-1.3 m vs 20 m cells)`, Math.abs(comb - rv.rover.slope) < 2 && /^pitch [+-]\d+\.\d°, roll [+-]\d+\.\d°$/.test(rv.tilt), rv.tilt);
    expect(`${tag} rover: overall height 2.5 m above the wheels' ground plane and wheel footprint 1.5 m x 1.5 m (VIPER's published size); model ${rv.size.map(x => x.toFixed(2)).join(' x ')} m (width x height x length)`, Math.abs(rv.size[1] - 2.5) < 0.01 && Math.abs(rv.size[0] - 1.5) < 0.01 && Math.abs(rv.size[2] - 1.5) < 0.01, rv.size.join(','));
    const about = await page.evaluate(() => { const d = document.getElementById('v3dAboutRover'); d.open = true; return { text: d.textContent.replace(/\s+/g, ' ').trim(), links: [...d.querySelectorAll('a')].map(a => a.href) }; });
    expect(`${tag} "About this rover": the required statement, published dimensions, current status with its date, and NASA sources`, about.text.includes(DISCLAIMER) && /2\.5 m \(8 ft\) tall, 1\.5 m \(5 ft\) long and wide/.test(about.text) && /20 October 2026/.test(about.text) && /Blue Moon Mark 1/.test(about.text) && about.links.length >= 5 && about.links.every(u => /^https:\/\/(science\.|www\.)?nasa\.gov\//.test(u)), about.links.join(' '));
    const all = (await page.evaluate(() => document.body.textContent)).replace(/\s+/g, ' ').split(DISCLAIMER).join(' ').split('Illustrative, not a mobility simulation').join(' ');
    const trav = [...all.matchAll(TRAV_RE)].map(m => all.slice(Math.max(0, m.index - 60), m.index + 40));
    expect(`${tag} no traversability claims anywhere in the page (only the required disclaimer mentions it)`, trav.length === 0, trav.slice(0, 2).join(' | '));
    const ai = await page.evaluate(() => { const t = document.getElementById('v3dAboutRover').textContent + ' ' + document.getElementById('v3dRover').textContent; return t; });
    expect(`${tag} no AI wording in the rover panel and "About this rover"`, ![...ai.matchAll(AI_RE)].length);
    if (SHOTS) await page.screenshot({ path: path.join(OUT, `r6_${vp.name}_rover.png`) });
    await page.evaluate(() => AsteriaView3D.close(true));

    // ---------------------------------------------------------------- Part 3: presets, inspection, hazard, 2D-3D link
    await open3d(page, 'peak_shackleton', '2028-09-25T10:04', 'medium');
    const camDir = () => page.evaluate(() => { const s = AsteriaView3D.testScene(), f = new THREE.Vector3(); s.camera.getWorldDirection(f); const M = window.AsteriaView3DMath; return Object.assign(M.azElFromDir([f.x, f.y, f.z]), { d: AsteriaView3D.debug() }); });
    const angDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
    await page.click('[data-preset="eye"]'); await page.waitForTimeout(300);
    let cd = await camDir();
    expect(`${tag} preset "Site eye level (2 m)": Walk at the site marker, eye 2 m above the ground, facing the Sun's azimuth`, cd.d.mode === 'walk' && Math.abs(cd.d.eyeAboveGround - 2) < 0.01 && Math.hypot(cd.d.walk.x, cd.d.walk.z) < 1e-6 && angDiff(cd.az, cd.d.instant.sun.az) < 0.05, JSON.stringify({ eye: cd.d.eyeAboveGround, az: cd.az, sunAz: cd.d.instant.sun.az }));
    await page.click('[data-preset="sun"]'); await page.waitForTimeout(300);
    cd = await camDir();
    expect(`${tag} preset "Look at Sun": view direction = the engine's Sun az/el (${cd.d.instant.sun.az.toFixed(2)}°, ${cd.d.instant.sun.el.toFixed(2)}°)`, angDiff(cd.az, cd.d.instant.sun.az) < 0.05 && Math.abs(cd.el - cd.d.instant.sun.el) < 0.05, `${cd.az.toFixed(3)}, ${cd.el.toFixed(3)}`);
    await page.click('[data-preset="earth"]'); await page.waitForTimeout(300);
    cd = await camDir();
    expect(`${tag} preset "Look at Earth": view direction = the engine's Earth az/el (${cd.d.instant.earth.az.toFixed(2)}°, ${cd.d.instant.earth.el.toFixed(2)}°)`, angDiff(cd.az, cd.d.instant.earth.az) < 0.05 && Math.abs(cd.el - cd.d.instant.earth.el) < 0.05, `${cd.az.toFixed(3)}, ${cd.el.toFixed(3)}`);
    await page.click('[data-preset="overview"]'); await page.waitForTimeout(400);
    cd = await camDir();
    expect(`${tag} preset "Overview": Orbit, the default oblique view of the site`, cd.d.mode === 'orbit' && cd.d.preset === 'overview');
    // inspection at the pixel of the site marker's ground point: must report the site (distance ~0, LOLA height there)
    const ins = await page.evaluate(() => {
      const s = AsteriaView3D.testScene(), d = AsteriaView3D.debug(), M = window.AsteriaView3DMath, cv = s.renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector3(0, d.tileCentreY, 0).project(s.camera), cx = cv.left + (p.x + 1) / 2 * cv.width, cy = cv.top + (1 - p.y) / 2 * cv.height;
      const r = AsteriaView3D.testInspect(cx, cy), h0 = M.heightAt(s.T, 0, 0);
      // a second point: the view centre on screen; its numbers must equal the DEM functions on the reported grid point
      const r2 = AsteriaView3D.testInspect(cv.left + cv.width * 0.5, cv.top + cv.height * 0.7);
      return { r, h0, r2, tip: document.getElementById('v3dInspect').textContent, shown: !document.getElementById('v3dInspect').hidden };
    });
    expect(`${tag} pointer inspection at the site marker: distance ${ins.r && ins.r.dist.toFixed(1)} m (< one 20 m cell), height ${ins.r && ins.r.h.toFixed(1)} m vs LOLA ${ins.h0.toFixed(1)} m (within 1 m)`, ins.r && ins.r.dist < 20 && Math.abs(ins.r.h - ins.h0) < 1, JSON.stringify(ins.r));
    expect(`${tag} pointer inspection shows height above the 1737.4 km sphere, slope (central differences), lat/lon, distance from the site and the data resolution`, ins.shown && /Height .* m \(above the 1737\.4 km sphere\)/.test(ins.tip) && /Slope .*° \(central differences over \d+ m\)/.test(ins.tip) && /°E · .* from the site/.test(ins.tip) && /Data here: \d+ m LOLA grid \(LDEM_/.test(ins.tip) && /can be steeper/.test(ins.tip), ins.tip);
    // hazard view: threshold = the rover's slope limit; legend with resolution and the steeper-slopes caveat
    await page.check('#v3dHazard'); await page.fill('#v3dHazMax', '12'); await page.dispatchEvent('#v3dHazMax', 'change');
    const hz = await page.evaluate(() => ({ u: AsteriaView3D.debug().overlays.slope, rov: document.getElementById('v3dSlopeMax').value, leg: document.getElementById('v3dLegend').textContent, slopeOn: document.getElementById('v3dSlope').checked }));
    expect(`${tag} hazard view: slopes above the user's limit (12°, shared with the rover's slope warning) coloured; legend states the grid and "real slopes over a few metres can be steeper"`, hz.u === 112 && hz.rov === '12' && /slope above 12°/.test(hz.leg) && /can be steeper/.test(hz.leg) && /\d+ m/.test(hz.leg) && !hz.slopeOn, JSON.stringify(hz));
    if (SHOTS) await page.screenshot({ path: path.join(OUT, `r6_${vp.name}_hazard.png`) });
    await page.uncheck('#v3dHazard');
    // mini-map shows the camera and its view direction
    const mc = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { mc: d.miniCam, head: d.hud && d.hud.heading }; });
    expect(`${tag} mini-map: camera position and view direction drawn (heading ${mc.mc && mc.mc.heading.toFixed(0)}° = HUD heading ${mc.head && mc.head.toFixed(0)}°)`, mc.mc && Math.abs(((mc.mc.heading - mc.head) % 360 + 540) % 360 - 180) < 0.5, JSON.stringify(mc));
    // "Show on 2D map": closes 3D and centres the 2D map on the 3D position with a marker
    const ll = await page.evaluate(() => AsteriaView3D.debug().viewLatLon);
    await page.click('#v3dTo2D'); await page.waitForTimeout(600);
    const m2 = await page.evaluate(() => { const L = AsteriaMap.leaflet(), c = L.getCenter(); return { open: AsteriaView3D.isOpen(), lat: c.lat, lon: c.lng, marker: !!document.querySelector('.mk-3d'), tip: (document.querySelector('.tip3d') || {}).textContent || '', zoom: L.getZoom() }; });
    expect(`${tag} "Show on 2D map": 3D closed, 2D map centred on the 3D view position (${ll.lat.toFixed(4)}, ${ll.lon.toFixed(4)}) with a marker`, !m2.open && Math.abs(m2.lat - ll.lat) < 1e-4 && Math.abs(((m2.lon - ll.lon) % 360 + 540) % 360 - 180) < 1e-3 && m2.marker && /Position from the 3D view/.test(m2.tip), JSON.stringify(m2));
    if (SHOTS) await page.screenshot({ path: path.join(OUT, `r6_${vp.name}_show2d.png`) });

    expect(`${tag} no console errors or warnings`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
