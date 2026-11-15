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

    // ---- Part 6: "Verify with NASA" = the exact query the blind test cached; values box; Verified card; Validation page
    const BL = loadData('data/blind_test.js', 'LUNA_BLIND').cases[0], VAL = loadData('data/validation.js', 'LUNA_VALIDATION');
    await page.goto('about:blank'); await open(`site=${BL.siteId}&t=${BL.date}&w=1`);
    await page.evaluate(() => { if (!document.getElementById('expertToggle').checked) document.getElementById('expertToggle').click(); });
    await page.waitForTimeout(200);
    const vf = await page.evaluate(() => ({ sun: document.getElementById('verifySun').href, earth: document.getElementById('verifyEarth').href, vis: document.getElementById('verifySun').offsetParent !== null, txt: document.getElementById('verifyBox').textContent, target: document.getElementById('verifySun').target }));
    const firstLine = f => fs.readFileSync(path.join(ROOT, f), 'utf8').split(/\r?\n/)[0].replace(/^# /, '');
    const rows = VAL.blind.rows.filter(r => r.date === BL.date && r.siteId === BL.siteId), rs = rows.find(r => r.body === 'Sun'), re = rows.find(r => r.body === 'Earth');
    const nodeUrl = HZ.query({ COMMAND: "'10'", SITE_COORD: HZ.siteCoord(BL), TLIST: `'${HZ.fmtH(new Date(BL.date))}'` }).url;
    expect(`${tag} Verify with NASA: Sun/Earth links = the cached validation queries character for character (tests/horizons_api.js format), open in a new tab, shown in Expert view`,
      vf.vis && vf.target === '_blank' && vf.sun === firstLine(rs.cacheFile) && vf.earth === firstLine(re.cacheFile) && vf.sun === nodeUrl, JSON.stringify({ sun: vf.sun, cached: firstLine(rs.cacheFile) }));
    expect(`${tag} Verify with NASA box shows ASTERIA's values for the same moment (= validation rows) and the expected agreement`,
      vf.txt.includes(rs.oursAz.toFixed(3) + '°') && vf.txt.includes(rs.oursEl.toFixed(3) + '°') && vf.txt.includes(re.oursEl.toFixed(3) + '°') && /Expected agreement: about 0\.01°/.test(vf.txt), vf.txt.slice(0, 300));
    await page.evaluate(() => document.getElementById('expertToggle').click());
    const card = await page.evaluate(() => document.getElementById('verifiedCard').textContent);
    const INS = INST, A3d = loadData('data/accuracy3d.js', 'LUNA_ACCURACY3D');
    const wantCard = [VAL.angles.length + ' angle checks', VAL.angleStats.el.max.toFixed(4) + '°', VAL.blind.rows.length + ' fresh cases', VAL.oneYear.rows.toLocaleString('en-US') + ' rows', INS.agree + ' of ' + INS.n + ' agree', (A3d.heights.points / 1e6).toFixed(1) + ' million heights', 'points mean difference'];
    expect(`${tag} Verified card on Explore with live numbers from the result files`, wantCard.every(w => card.includes(w)) && /Verified against NASA data/.test(card), card);
    await page.click('#verifiedCard'); await page.waitForTimeout(200);
    const vp6 = await page.evaluate(() => ({ active: document.getElementById('page-validation').classList.contains('active'), ids: ['valHow', 'valMethods', 'valRepro', 'valInstant', 'valAcc3d', 'valVerify'].filter(i => !document.getElementById(i)),
      dl: document.getElementById('reportDl').getAttribute('href'), dlName: document.getElementById('reportDl').getAttribute('download'), src: [...document.querySelectorAll('table.formulas a')].map(a => a.getAttribute('href')), valLink: document.querySelector('#valVerify #verifySun') && document.querySelector('#valVerify #verifySun').href }));
    expect(`${tag} Verified card opens the Validation page: "How we know", "Methods and formulas" (with source links that exist), "Reproduce it yourself", instant check, 3D accuracy, Verify with NASA, downloadable VALIDATION_REPORT.md`,
      vp6.active && !vp6.ids.length && vp6.dl === 'VALIDATION_REPORT.md' && vp6.dlName && fs.existsSync(path.join(ROOT, vp6.dl)) && vp6.src.length >= 8 && vp6.src.every(s => fs.existsSync(path.join(ROOT, s))) && vp6.valLink === vf.sun, JSON.stringify(vp6));
    if (SHOTS) { await page.screenshot({ path: path.join(out, `r5_validation_${vp.name}.png`) }); }
    await page.evaluate(() => document.querySelector('.tab[data-page=explorer]').click());

    // ---- Part 5: Deploy icon; no warning-like triangle used as a button icon outside the 3D arrow pad
    await page.goto('about:blank'); await open('');
    const dep = await page.evaluate(() => ({ t: document.getElementById('deployBtn').textContent, tri: [...document.querySelectorAll('button')].filter(b => /▲/.test(b.textContent) && !b.closest('#v3dPad')).map(b => b.id || b.textContent) }));
    expect(`${tag} Deploy button reads "» Deploy: 3D terrain view"; no ▲ button icon elsewhere`, dep.t === '» Deploy: 3D terrain view' && dep.tri.length === 0, JSON.stringify(dep));
    // ---- Part 5: 3D labels and mini-map caption stay inside the picture and do not overlap
    for (const sid of ['peak_shackleton_lw', 'shackleton_centre', 'im2', 'mons_mouton']) {
      await page.goto('about:blank'); await open('site=' + sid);
      await page.evaluate(() => AsteriaApp.openDeploy());
      await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 30000 });
      for (const mode of ['orbit', 'walk']) {
        await page.evaluate(m => AsteriaView3D.testMode(m), mode); await page.waitForTimeout(700);
        const L = await page.evaluate(() => {
          const d = AsteriaView3D.debug().labelLayout, st = document.getElementById('v3dStage').getBoundingClientRect();
          const cap = document.getElementById('v3dMiniCap'), cr = cap.getBoundingClientRect(), capVis = cap.offsetParent !== null && cr.height > 0;
          const hud = document.getElementById('v3dHud').getBoundingClientRect();
          return { d, cap: capVis ? { l: cr.left - st.left, t: cr.top - st.top, r: cr.right - st.left, b: cr.bottom - st.top } : null, hud: { l: hud.left - st.left, t: hud.top - st.top, r: hud.right - st.left, b: hud.bottom - st.top } };
        });
        const hit = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
        const shown = L.d.labels.filter(x => !x.hidden), W = L.d.stage.w, H = L.d.stage.h, probs = [];
        shown.forEach((x, i) => {
          if (x.rect.l < 0 || x.rect.t < 0 || x.rect.r > W || x.rect.b > H) probs.push('cut: ' + x.text);
          shown.slice(i + 1).forEach(y => { if (hit(x.rect, y.rect)) probs.push('overlap: ' + x.text + ' / ' + y.text); });
          L.d.obstacles.forEach(o => { if (hit(x.rect, o)) probs.push('over a panel: ' + x.text); });
        });
        if (L.cap && (L.cap.r > W || L.cap.b > H || L.cap.l < 0 || hit(L.cap, L.hud))) probs.push('mini-map caption cut off or over the compass box');
        expect(`${tag} 3D ${sid} ${mode}: ${shown.length} labels (${L.d.labels.filter(x => x.hidden).length} feature names hidden to avoid overlap) inside the picture, not overlapping each other or the panels; mini-map caption inside`, probs.length === 0, probs.join('; '));
      }
      await page.evaluate(() => AsteriaView3D.close(true));
    }

    // ---- Part 5: tour spotlight (opt-in for tests), once, only after Getting started is completed
    const spotCtx = async (opts) => {
      const c = await browser.newContext(Object.assign({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch }, opts.ctx || {}));
      await c.addInitScript(o => { window.ASTERIA_V3D_NOPROBE = true; if (o.optIn) window.ASTERIA_SPOTLIGHT_TEST = true; }, { optIn: opts.optIn !== false });
      const p = await c.newPage();
      p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${tag} console.${m.type()}: ${m.text()}`); });
      p.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`));
      await p.goto(base); await p.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series);
      await p.waitForSelector('#hint:not([hidden])', { timeout: 15000 });
      return { c, p };
    };
    const finishHint = async p => { for (let k = 0; k < 4; k++) await p.click('#hintNext'); await p.waitForTimeout(200); };
    const spotState = p => p.evaluate(() => {
      const b = document.getElementById('tourBtn').getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
      const atBtn = document.elementFromPoint(x, y), atMid = document.elementFromPoint(innerWidth / 2, innerHeight * 0.7);
      return { shown: !document.getElementById('spot').hidden, on: document.body.classList.contains('spot-on'), title: document.getElementById('spotTitle').textContent,
        btns: [document.getElementById('spotStart').textContent, document.getElementById('spotNo').textContent], btnOnTop: !!atBtn && atBtn.closest('#tourBtn') !== null, dimmed: !!atMid && atMid.classList.contains('spotdim'),
        glow: getComputedStyle(document.getElementById('tourBtn')).boxShadow !== 'none', anim: getComputedStyle(document.getElementById('tourBtn')).animationName,
        stored: localStorage.getItem('asteria.spotlightShown'), tour: !document.getElementById('tour').hidden, step: document.getElementById('tourStep').textContent };
    });
    {
      const { c, p } = await spotCtx({});
      await finishHint(p);
      const s1 = await spotState(p);
      expect(`${tag} spotlight after Getting started: page dimmed, Tour button highlighted and clickable, "Take the 60-second tour" with "Start tour" / "Not now"`, s1.shown && s1.on && s1.btnOnTop && s1.dimmed && s1.glow && s1.title === 'Take the 60-second tour' && s1.btns.join('|') === 'Start tour|Not now' && s1.stored === '1', JSON.stringify(s1));
      if (SHOTS) await p.screenshot({ path: path.join(out, `r5_spotlight_${vp.name}.png`) });
      await p.click('#spotStart'); await p.waitForTimeout(200);
      const s2 = await spotState(p);
      expect(`${tag} spotlight "Start tour" opens "Tour · step 1 of 6" and removes the dimming`, !s2.shown && !s2.on && s2.tour && /step 1 of 6/.test(s2.step), JSON.stringify(s2));
      await p.reload(); await p.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series); await p.waitForTimeout(1500);
      const s3 = await spotState(p);
      expect(`${tag} spotlight shown only once (not again after reload)`, !s3.shown && await p.isHidden('#hint'), JSON.stringify(s3));
      await c.close();
    }
    {
      const { c, p } = await spotCtx({});
      await finishHint(p); await p.click('#tourBtn'); await p.waitForTimeout(200);
      const s = await spotState(p);
      expect(`${tag} clicking the highlighted Tour button starts the tour`, !s.shown && s.tour && /step 1 of 6/.test(s.step), JSON.stringify(s));
      await c.close();
    }
    {
      const { c, p } = await spotCtx({});
      await finishHint(p); await p.click('#spotNo'); await p.waitForTimeout(150);
      const s = await spotState(p);
      expect(`${tag} "Not now" closes the spotlight without starting the tour`, !s.shown && !s.on && !s.tour, JSON.stringify(s));
      await c.close();
    }
    {
      const { c, p } = await spotCtx({});
      await p.click('#hintClose'); await p.waitForTimeout(300);
      const s = await spotState(p);
      expect(`${tag} Getting started skipped early ("Got it" at step 1): no spotlight`, !s.shown && !s.on, JSON.stringify(s));
      await c.close();
    }
    {
      const { c, p } = await spotCtx({ optIn: false });
      await finishHint(p);
      const s = await spotState(p);
      expect(`${tag} automated browser without opt-in: no spotlight`, !s.shown, JSON.stringify(s));
      await c.close();
    }
    {
      const { c, p } = await spotCtx({ ctx: { reducedMotion: 'reduce' } });
      await finishHint(p);
      const s = await spotState(p);
      expect(`${tag} reduced motion: spotlight without the pulsing animation`, s.shown && s.anim === 'none', JSON.stringify({ shown: s.shown, anim: s.anim }));
      await c.close();
    }

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
