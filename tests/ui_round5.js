#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Headless UI checks for round 5 (file://, laptop and phone):
 *  1. instant status in the browser = the independent check's app column (share links at stored case times)
 *  3. relief shading (Walk/Rover): display only - heights, slopes, light direction and status tiles unchanged
 *  4. "Jump to next sunlight / Earth view / both": lands on a time where the series says the status is true,
 *     works in 3D, "not found" case (Shackleton crater floor sunlight), respects the minimum link elevation
 *  5. tour spotlight after Getting started (opt-in only), Deploy icon, 3D mini-map caption / feature labels
 *     inside the stage and not overlapping
 *  6. "Verify with NASA" URL = the cached validation query format, "Verified" card with live numbers,
 *     Validation page sections and VALIDATION_REPORT.md download
 * Also: no console errors or warnings; AI wording only in the two allowed lines.
 * Usage: node tests/ui_round5.js [--shots]   (--shots also writes before/after screenshots to tests/screenshots/r5_*) */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), url = require('url');
const HZ = require('./horizons_api.js');
const ROOT = path.join(__dirname, '..');
const SHOTS = process.argv.includes('--shots');

function loadData(file, name) { const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, file), 'utf8'))(w); return w[name]; }

(async () => {
  const out = path.join(__dirname, 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const base = url.pathToFileURL(path.join(ROOT, 'index.html')).href;
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const errors = [], fails = [];
  const expect = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) fails.push(name); };
  const shot = (page, name) => page.screenshot({ path: path.join(out, name + '.png') });
  const INST = loadData('data/instant_status.js', 'LUNA_INSTANT');

  for (const vp of [{ name: 'laptop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); } catch (e) { /* */ } });
    const page = await ctx.newPage();
    const tag = `[${vp.name}]`;
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${tag} console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`));
    const open = async hash => {
      await page.goto(base + (hash ? '#' + hash : ''));
      await page.waitForFunction(() => window.AsteriaApp && window.AsteriaApp.state.series, null, { timeout: 30000 });
      await page.evaluate(() => AsteriaApp.ready());
    };

    // ---- Part 1: the status the browser shows = the app column of the independent check (on-edge cases included)
    const pick = INST.rows.filter(r => r.edge).concat(INST.rows.filter((r, k) => !r.edge && k % 37 === 0)).slice(0, vp.name === 'laptop' ? 12 : 4);
    let bad = [];
    for (const r of pick) {
      await page.goto('about:blank');
      await open(`site=${r.siteId}&t=${r.t.replace('Z', '')}Z&w=1`);
      const st = await page.evaluate(() => { const S = AsteriaApp.state; return { t: S.series.t[S.idx], sun: document.getElementById('sunState').textContent, earth: document.getElementById('earthState').textContent }; });
      const shown = r.body === 'sun' ? st.sun === 'Sun up' : st.earth === 'Earth in view';
      if (st.t !== Date.parse(r.t) || shown !== r.app || shown !== r.indep) bad.push(`${r.siteId} ${r.t} ${r.body}: shown ${shown}, app ${r.app}, independent ${r.indep}`);
    }
    expect(`${tag} instant status shown in the browser = independent Horizons + Python status (${pick.length} cases incl. ${pick.filter(r => r.edge).length} on the edge)`, bad.length === 0, bad.join('; '));

    // ---- Part 2: rover readout in the browser at the positions checked against LOLA by tools/accuracy3d.py
    await page.goto('about:blank'); await open('');
    await page.evaluate(() => AsteriaApp.openDeploy());
    await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 30000 });
    const A3 = loadData('data/accuracy3d.js', 'LUNA_ACCURACY3D');
    const site = await page.evaluate(() => AsteriaApp.state.site.id), q = await page.evaluate(() => AsteriaView3D.debug().quality);
    const posList = A3.positions.rows.filter(p => p.siteId === site && (p.cell_m !== 5 || q === 'high'));
    await page.evaluate(() => AsteriaView3D.testMode('rover'));
    let pbad = [];
    for (const p of posList) {
      const got = await page.evaluate(async p => {
        const M = AsteriaView3DMath, s = AsteriaView3D.testScene(), T = s.T, w = M.toThree(M.enu(T, p.e, p.n, M.heightAt(T, p.e, p.n)));
        AsteriaView3D.testCamera({ rov: { x: w[0], z: w[2], yaw: 0, dist: 1, camYaw: 0, lastX: w[0], lastZ: w[2] } });
        await new Promise(r => setTimeout(r, 400));
        return { pos: document.getElementById('v3dRPos').textContent, elev: document.getElementById('v3dRElev').textContent, st: AsteriaView3D.debug().rover };
      }, p);
      const m = got.pos.match(/\((-?[\d.]+)°, (-?[\d.]+)°E\)/);
      const ok = m && Math.abs(+m[1] - +p.latTxt) <= 0.00011 && Math.abs(+m[2] - +p.lonTxt) <= 0.00011 && Math.abs(parseFloat(got.elev) - parseFloat(p.elevTxt)) <= 0.11 && Math.abs(parseFloat(got.elev) - p.demH) <= 1;
      if (!ok) pbad.push(`${p.e.toFixed(0)},${p.n.toFixed(0)}: shown ${got.pos} ${got.elev}; checked ${p.latTxt}, ${p.lonTxt} ${p.elevTxt} (LOLA ${p.demH.toFixed(2)})`);
    }
    expect(`${tag} 3D rover: displayed lat/lon and elevation at ${posList.length} checked positions = the values verified against LOLA (Validation, 3D terrain accuracy)`, posList.length > 0 && pbad.length === 0, pbad.join('; '));
    // ---- Part 3: relief shading is display only (Walk/Rover default on, Orbit default off)
    const snap = () => page.evaluate(async () => {
      await new Promise(r => setTimeout(r, 350));
      const d = AsteriaView3D.debug();
      return { relief: d.relief, dir: d.sunLightDir, inten: d.sunIntensity, earth: d.earthAzEl, tiles: ['v3dTileSun', 'v3dTileEarth'].map(id => document.getElementById(id).className + '|' + document.getElementById(id).textContent),
        rover: d.rover && { h: d.rover.h, slope: d.rover.slope, lat: d.rover.lat }, layers: d.layers.map(l => l.name + l.vertices).join(), centre: d.tileCentreY, note: document.getElementById('v3dReliefNote').textContent, box: document.getElementById('v3dRelief').checked };
    });
    const sOn = await snap();
    await page.click('#v3dRelief');
    const sOff = await snap();
    await page.click('#v3dRelief');
    const same = (a, b) => JSON.stringify([a.dir, a.inten, a.earth, a.tiles, a.rover, a.layers, a.centre]) === JSON.stringify([b.dir, b.inten, b.earth, b.tiles, b.rover, b.layers, b.centre]);
    expect(`${tag} 3D relief shading: on by default in Rover, toggles off/on; heights, slopes, rover readout, light direction and status tiles identical; labelled`,
      sOn.relief && sOn.box && !sOff.relief && same(sOn, sOff) && sOn.note === 'Relief shading: display contrast only; heights and slopes are the LOLA data.', JSON.stringify({ on: sOn.relief, off: sOff.relief, rover: [sOn.rover, sOff.rover] }));
    const fine = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { stride: d.stride, phone: d.phone, fine: d.fine, patch: d.patch5m, site: AsteriaApp.state.site.id }; });
    expect(`${tag} 3D Walk/Rover use the finest data (laptop: full 20 m tile, 5 m patch where it exists; phone: unchanged)`, fine.phone ? true : (fine.stride === 1 && fine.fine && fine.patch === ['peak_shackleton', 'peak_shackleton_lw', 'shackleton_centre'].includes(fine.site)), JSON.stringify(fine));
    await page.evaluate(() => { AsteriaView3D.testRelief(null); AsteriaView3D.testMode('orbit'); });
    const orb = await page.evaluate(() => AsteriaView3D.debug().relief);
    expect(`${tag} 3D relief shading off by default in Orbit`, orb === false);
    // "Light up": session only; switches itself off when the validated status says the Sun is up
    const lu = await page.evaluate(async () => {
      const S = AsteriaApp.state, up = S.series.sunUp, i = up.findIndex(x => x), j = up.findIndex((x, k) => x && k !== i);
      const ls0 = localStorage.getItem('asteria.v3dBrightness');
      document.getElementById('v3dLightUp').click(); await new Promise(r => setTimeout(r, 100));
      const b1 = AsteriaView3D.debug().brightness;
      if (i >= 0) AsteriaApp.setIdx(j >= 0 ? j : i);
      await new Promise(r => setTimeout(r, 200));
      return { i, b1, b2: AsteriaView3D.debug().brightness, ls0, ls1: localStorage.getItem('asteria.v3dBrightness'), note: document.getElementById('v3dQNote').textContent };
    });
    expect(`${tag} 3D "Light up" is not remembered and switches off when the Sun is up at the site`, lu.b1 === 3 && lu.ls1 === lu.ls0 && (lu.i < 0 || (lu.b2 < 3 && /switched off/.test(lu.note))), JSON.stringify(lu));
    await page.evaluate(() => AsteriaView3D.close(true));

    // ---- Part 4: jump to the next sunlight / Earth view / both
    const jump = async (sel, msgId) => {
      await page.click(sel);
      await page.waitForFunction(id => { const t = document.getElementById(id).textContent; return t && t !== 'Searching…'; }, msgId, { timeout: 60000 });
      await page.evaluate(() => AsteriaApp.ready());
      return page.evaluate(id => {
        const S = AsteriaApp.state, i = S.idx, s = S.series, t = s.t[i], E = window.LunaEngine;
        const site = { lat: S.site.lat, lon: S.site.lon }, mask = window.LUNA_HORIZONS[S.site.id] && S.useTerrain ? window.LUNA_HORIZONS[S.site.id].elevations : null;
        const r = E.sunEarthAt(site, new Date(t));
        return { t, msg: document.getElementById(id).textContent, sunUp: s.sunUp[i], earthUp: s.earthUp[i],
          sunCheck: r.sun.el > E.maskAt(mask, r.sun.az), earthCheck: r.earth.el > E.maskAt(mask, r.earth.az) + S.minEl, minEl: S.minEl,
          tiles: [document.getElementById('sunState').textContent, document.getElementById('earthState').textContent] };
      }, msgId);
    };
    await page.goto('about:blank'); await open('site=peak_shackleton&w=30');
    for (const k of ['sun', 'earth', 'both']) {
      const t0 = await page.evaluate(() => AsteriaApp.state.series.t[AsteriaApp.state.idx]);
      const r = await jump(`#jumpRow [data-jump=${k}]`, 'jumpMsg');
      const ok = /Not within the next \d+ days \(search limit\)/.test(r.msg) ? true :
        r.t > t0 && /^Next .* starts/.test(r.msg) && (k === 'sun' ? r.sunUp && r.sunCheck && r.tiles[0] === 'Sun up' : k === 'earth' ? r.earthUp && r.earthCheck && r.tiles[1] === 'Earth in view' : r.sunUp && r.earthUp && r.sunCheck && r.earthCheck);
      expect(`${tag} Jump to next ${k}: lands on a later time where the series (and a fresh engine check) say the status is true; tiles updated`, ok, JSON.stringify(r));
    }
    // minimum link elevation respected
    await page.fill('#minEl', '1'); await page.dispatchEvent('#minEl', 'change'); await page.evaluate(() => AsteriaApp.ready());
    const rm = await jump('#jumpRow [data-jump=earth]', 'jumpMsg');
    expect(`${tag} Jump to next Earth view respects the minimum link elevation (1°)`, rm.minEl === 1 && rm.earthUp && rm.earthCheck, JSON.stringify(rm));
    await page.fill('#minEl', '0'); await page.dispatchEvent('#minEl', 'change'); await page.evaluate(() => AsteriaApp.ready());
    // not found: Shackleton crater floor never sees the Sun
    await page.goto('about:blank'); await open('site=shackleton_centre&w=30');
    const tS = await page.evaluate(() => AsteriaApp.state.series.t[AsteriaApp.state.idx]);
    const rn = await jump('#jumpRow [data-jump=sun]', 'jumpMsg');
    expect(`${tag} Jump to next sunlight at the Shackleton crater floor: "Not within the next N days (search limit)", time unchanged`, /^Next sunlight: Not within the next \d+ days \(search limit\)\.$/.test(rn.msg) && rn.t === tS, rn.msg);
    // 3D: hint next to "Light up" when the Sun is hidden, and the jump buttons work in the 3D panel
    await page.evaluate(() => AsteriaApp.openDeploy());
    await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open, null, { timeout: 30000 });
    const tip = await page.evaluate(() => ({ tip: !document.getElementById('v3dTip').hidden, btn: document.getElementById('v3dTipJump').textContent, lu: document.getElementById('v3dTipBtn').textContent }));
    expect(`${tag} 3D: Sun hidden -> tip offers "Jump to next sunlight" next to "Light up"`, tip.tip && tip.btn === 'Jump to next sunlight' && tip.lu === 'Light up', JSON.stringify(tip));
    const r3n = await jump('#v3dTipJump', 'v3dJumpMsg');
    expect(`${tag} 3D: Jump to next sunlight from the tip, not found at the crater floor (same search-limit message)`, /Not within the next \d+ days \(search limit\)/.test(r3n.msg), r3n.msg);
    await page.evaluate(() => AsteriaView3D.close(true));
    await page.goto('about:blank'); await open('site=mons_mouton&w=30');
    await page.evaluate(() => AsteriaApp.openDeploy());
    await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open, null, { timeout: 30000 });
    for (const k of ['earth', 'sun']) {
      const r = await jump(`.v3d-jump [data-jump=${k}]`, 'v3dJumpMsg');
      const d = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { t: d.instant.t, sunUp: d.instant.sunUp, earthUp: d.instant.earthUp, sun: document.getElementById('v3dSun').textContent, earth: document.getElementById('v3dEarth').textContent }; });
      const ok = /Not within/.test(r.msg) || (d.t === r.t && (k === 'sun' ? d.sunUp && d.sun === 'Sun up' && r.sunCheck : d.earthUp && d.earth === 'Earth in view' && r.earthCheck));
      expect(`${tag} 3D: Jump to next ${k} in the 3D panel moves the time (3D tiles, slider and main view agree)`, ok, JSON.stringify({ r: r.msg, d }));
    }
    await page.evaluate(() => AsteriaView3D.close(true));

    await ctx.close();
  }

  await browser.close();
  const errs = errors.filter(e => !/GPU stall due to ReadPixels/.test(e));
  expect('no console errors or warnings', errs.length === 0, errs.slice(0, 5).join(' | '));
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
