#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6B browser checks (laptop and emulated phone):
 *  Part 1 - inspection: click/tap to inspect (readout and marker pinned until the next click or Esc), "Inspect on hover"
 *           off by default; with it on, the readout follows the mouse.
 *   node tests/ui_round6b.js [--shots] [--only laptop|phone] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const SHOTS = process.argv.includes('--shots'), OUT = path.join(__dirname, 'screenshots');
const ONLY = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--only'));
if (SHOTS) fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' - ' + info : '')); if (!ok) fails++; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const AI_RE = /\bAI-|\bAI |artificial intelligence|generated|illustrated by/gi;

async function open3d(page, site, t) {
  await page.goto(BASE + `#site=${site}&t=${t}Z&w=1`);
  await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
  await page.evaluate(() => AsteriaApp.ready());
  await page.evaluate(() => AsteriaApp.openDeploy());
  await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 60000 });
  await page.waitForTimeout(400);
}
// screen position (page coordinates) of a ground point given in Three.js world coordinates
const screenOf = (page, x, y, z) => page.evaluate(([x, y, z]) => {
  const s = AsteriaView3D.testScene(), cv = s.renderer.domElement.getBoundingClientRect(), p = new THREE.Vector3(x, y, z).project(s.camera);
  return { x: cv.left + (p.x + 1) / 2 * cv.width, y: cv.top + (1 - p.y) / 2 * cv.height };
}, [x, y, z]);

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

    // ------------------------------------------------------------ Part 1: inspection
    await open3d(page, 'peak_shackleton', '2028-09-25T10:04');
    if (vp.name === 'phone') await page.evaluate(() => { document.getElementById('v3dToggle').click(); });   // panel out of the way
    await page.waitForTimeout(300);
    const d0 = await page.evaluate(() => AsteriaView3D.debug());
    expect(`${tag} inspection: "Inspect on hover" is off by default and nothing is shown before a click`, d0.inspectHover === false && !d0.inspect && await page.evaluate(() => !document.getElementById('v3dHover').checked && document.getElementById('v3dInspect').hidden));
    const site = await screenOf(page, 0, d0.tileCentreY, 0);
    if (vp.name === 'laptop') {
      await page.mouse.move(site.x + 40, site.y + 30); await page.waitForTimeout(150);
      expect(`${tag} inspection: with hover off, moving the mouse shows nothing`, await page.evaluate(() => document.getElementById('v3dInspect').hidden));
      await page.mouse.click(site.x, site.y);
    } else await page.touchscreen.tap(site.x, site.y);
    await page.waitForTimeout(200);
    const d1 = await page.evaluate(() => { const d = AsteriaView3D.debug(), mk = document.getElementById('v3dInspMark'); return { ins: d.inspect, pinned: d.inspectPinned, mk: !mk.hidden, tip: document.getElementById('v3dInspect').textContent, tipShown: !document.getElementById('v3dInspect').hidden }; });
    expect(`${tag} inspection: a ${vp.name === 'laptop' ? 'click' : 'tap'} at the site marker pins the readout and a marker (distance ${d1.ins && d1.ins.dist.toFixed(1)} m from the site)`, d1.ins && d1.pinned && d1.mk && d1.tipShown && d1.ins.dist < 20 && /Height .* m/.test(d1.tip), JSON.stringify({ pinned: d1.pinned, mk: d1.mk }));
    if (vp.name === 'laptop') {
      await page.mouse.move(site.x + 200, site.y + 120, { steps: 5 }); await page.waitForTimeout(150);
      const d2 = await page.evaluate(() => AsteriaView3D.debug().inspect);
      expect(`${tag} inspection: the pinned readout stays when the mouse moves on`, d2 && Math.abs(d2.e - d1.ins.e) < 1e-9 && Math.abs(d2.n - d1.ins.n) < 1e-9);
      // camera move: marker follows the ground point
      await page.evaluate(() => AsteriaView3D.testCamera({ yaw: 40 }));
      await page.waitForTimeout(250);
      const mk = await page.evaluate(() => { const r = AsteriaView3D.debug().inspect, s = AsteriaView3D.testScene(), cv = s.renderer.domElement.getBoundingClientRect(), p = new THREE.Vector3(r.x, r.y, r.z).project(s.camera), m = document.getElementById('v3dInspMark').getBoundingClientRect(); return { dx: (m.left + m.width / 2) - (cv.left + (p.x + 1) / 2 * cv.width), dy: (m.top + m.height / 2) - (cv.top + (1 - p.y) / 2 * cv.height) }; });
      expect(`${tag} inspection: after the camera turns, the marker stays on the inspected ground point (${mk.dx.toFixed(1)}, ${mk.dy.toFixed(1)} px)`, Math.abs(mk.dx) < 2 && Math.abs(mk.dy) < 2, JSON.stringify(mk));
      if (SHOTS) await page.screenshot({ path: path.join(OUT, `r6b_${vp.name}_inspect_pinned.png`) });
      await page.keyboard.press('Escape'); await page.waitForTimeout(150);
      const d3 = await page.evaluate(() => ({ open: AsteriaView3D.isOpen(), ins: AsteriaView3D.debug().inspect, mk: document.getElementById('v3dInspMark').hidden, tip: document.getElementById('v3dInspect').hidden }));
      expect(`${tag} inspection: Esc clears the readout and the marker (the 3D view stays open; a second Esc closes it)`, d3.open && !d3.ins && d3.mk && d3.tip, JSON.stringify(d3));
      // hover mode
      await page.check('#v3dHover');
      await page.evaluate(() => AsteriaView3D.testCamera({}));
      await page.waitForTimeout(150);
      const site2 = await screenOf(page, 0, d0.tileCentreY, 0);
      await page.mouse.move(site2.x + 1, site2.y + 1); await page.waitForTimeout(120);
      const h1 = await page.evaluate(() => AsteriaView3D.debug().inspect);
      await page.mouse.move(site2.x + 150, site2.y + 60); await page.waitForTimeout(120);
      const h2 = await page.evaluate(() => AsteriaView3D.debug().inspect);
      expect(`${tag} inspection: with "Inspect on hover" on, the readout follows the mouse (${h1 && h1.dist.toFixed(0)} m, then ${h2 && h2.dist.toFixed(0)} m from the site)`, h1 && h2 && h1.dist < 60 && h2.dist > h1.dist + 200, JSON.stringify([h1 && h1.dist, h2 && h2.dist]));
      await page.uncheck('#v3dHover');
    } else {
      await page.touchscreen.tap(site.x + 60, site.y + 40); await page.waitForTimeout(200);
      const d2 = await page.evaluate(() => AsteriaView3D.debug().inspect);
      expect(`${tag} inspection: a second tap moves the pinned readout to the new point`, d2 && Math.hypot(d2.e - d1.ins.e, d2.n - d1.ins.n) > 1);
    }
    await page.evaluate(() => AsteriaView3D.close(true));

    // ------------------------------------------------------------ Part 2: shadows off by default
    const OFF_NOTE = 'Shadows off: the terrain is lit from the Sun\'s real direction without cast shadows. Sunlit/shadowed status at the site comes from the validated horizon model (tiles above).';
    // a time when the Sun is above the flat horizon but hidden by terrain at Shackleton crater centre (Sun light on)
    await open3d(page, 'shackleton_centre', '2028-09-25T10:04');
    const snap = () => page.evaluate(() => {
      const d = AsteriaView3D.debug(), s = AsteriaView3D.testScene(), cv = s.renderer.domElement.getBoundingClientRect();
      const ins = AsteriaView3D.testInspect(cv.left + cv.width * 0.5, cv.top + cv.height * 0.75);
      return { tiles: [document.getElementById('v3dTileSun').className, document.getElementById('v3dSun').textContent, document.getElementById('v3dTileEarth').className, document.getElementById('v3dEarth').textContent],
        x: [document.getElementById('v3dSunX').textContent, document.getElementById('v3dEarthX').textContent], sunDir: d.sunLightDir, earth: d.earthAzEl, sunI: d.sunIntensity,
        labels: [d.labelSun, d.labelEarth], ins: ins && [ins.h, ins.slope, ins.lat, ins.lon, ins.dist], noShadow: d.noShadow, autoUpd: s.renderer.shadowMap.autoUpdate,
        box: document.getElementById('v3dShadows').checked, lbl: document.getElementById('v3dShadows').parentNode.textContent.trim(), note: document.querySelector('.v3d-shadownote').textContent,
        banner: document.getElementById('v3dBanner').hidden ? '' : document.getElementById('v3dBanner').textContent };
    });
    const sOff = await snap();
    expect(`${tag} shadows: off by default, toggle named "Shadows (approximate)", note "${OFF_NOTE.slice(0, 40)}…" shown, shadow maps not rendered`, !sOff.box && sOff.lbl === 'Shadows (approximate)' && sOff.note === OFF_NOTE && sOff.noShadow && sOff.autoUpd === false, JSON.stringify({ box: sOff.box, lbl: sOff.lbl, note: sOff.note }));
    await page.click('#v3dShadows'); await page.waitForTimeout(250);
    const sOn = await snap();
    expect(`${tag} shadows: turning them on shows the existing shadow label and renders the shadow maps`, sOn.box && !sOn.noShadow && sOn.autoUpd && /visual approximation/.test(sOn.note) && sOn.note !== OFF_NOTE, sOn.note);
    const same = JSON.stringify([sOff.tiles, sOff.x, sOff.sunDir, sOff.earth, sOff.sunI, sOff.labels, sOff.ins]) === JSON.stringify([sOn.tiles, sOn.x, sOn.sunDir, sOn.earth, sOn.sunI, sOn.labels, sOn.ins]);
    expect(`${tag} shadows: status tiles (${sOff.tiles[1]}, ${sOff.tiles[3]}), Sun/Earth positions, labels and the inspection readout are identical with shadows on and off`, same, JSON.stringify({ off: sOff.tiles, on: sOn.tiles }));
    expect(`${tag} shadows: the hidden-Sun banner says the ground is drawn lit when shadows are off (and keeps its shadow wording when on)`, (!sOff.banner || /Shadows are off in this view/.test(sOff.banner)) && (!sOn.banner || !/Shadows are off/.test(sOn.banner)), JSON.stringify([sOff.banner.slice(-120), sOn.banner.slice(-80)]));
    await page.evaluate(() => AsteriaView3D.close(true));
    await page.evaluate(() => AsteriaApp.openDeploy());
    await page.waitForFunction(() => AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 60000 });
    const re = await page.evaluate(() => ({ box: document.getElementById('v3dShadows').checked, ls: Object.keys(localStorage).filter(k => /shadow/i.test(k)) }));
    expect(`${tag} shadows: the choice is remembered for this session (re-opened 3D keeps "on"), not stored on the device`, re.box && re.ls.length === 0, JSON.stringify(re));
    await page.click('#v3dShadows');   // back off
    await page.click('#v3dEarthshine'); await page.waitForTimeout(200);
    const es = await page.evaluate(() => ({ sh: document.getElementById('v3dShadows').checked, noShadow: AsteriaView3D.debug().noShadow }));
    expect(`${tag} shadows: turning on Earthshine (which only matters in shadow) turns shadows on`, es.sh && !es.noShadow, JSON.stringify(es));
    await page.click('#v3dEarthshine'); await page.click('#v3dShadows');
    await page.evaluate(() => AsteriaView3D.close(true));

    // ------------------------------------------------------------ Part 3: relief defaults per mode
    await open3d(page, 'peak_shackleton', '2028-09-25T10:04');
    const rel = () => page.evaluate(() => ({ mode: AsteriaView3D.debug().mode, on: AsteriaView3D.debug().relief, box: document.getElementById('v3dRelief').checked }));
    const seq = [];
    seq.push(await rel());
    for (const m of ['walk', 'rover', 'orbit']) { await page.click(`.seg [data-mode="${m}"]`); await page.waitForTimeout(100); seq.push(await rel()); }
    expect(`${tag} relief: off by default in Orbit, on in Walk and Rover (checkbox follows)`, JSON.stringify(seq.map(x => [x.mode, x.on, x.box])) === JSON.stringify([['orbit', false, false], ['walk', true, true], ['rover', true, true], ['orbit', false, false]]), JSON.stringify(seq));
    await page.click('.seg [data-mode="walk"]'); await page.click('#v3dRelief'); await page.waitForTimeout(100);
    const seq2 = [await rel()];
    for (const m of ['orbit', 'rover', 'walk']) { await page.click(`.seg [data-mode="${m}"]`); await page.waitForTimeout(100); seq2.push(await rel()); }
    expect(`${tag} relief: a change made in Walk is kept for Walk; switching to Orbit and Rover re-applies their defaults`, JSON.stringify(seq2.map(x => [x.mode, x.on])) === JSON.stringify([['walk', false], ['orbit', false], ['rover', true], ['walk', false]]), JSON.stringify(seq2));
    await page.click('.seg [data-mode="orbit"]'); await page.click('#v3dRelief'); await page.waitForTimeout(150);
    const rOn = await page.evaluate(() => { const d = AsteriaView3D.debug(), s = AsteriaView3D.testScene(), cv = s.renderer.domElement.getBoundingClientRect(), r = AsteriaView3D.testInspect(cv.left + cv.width / 2, cv.top + cv.height * 0.7); AsteriaView3D.testRelief(false); const r2 = AsteriaView3D.testInspect(cv.left + cv.width / 2, cv.top + cv.height * 0.7); const d2 = AsteriaView3D.debug(); return { on: d.relief, off: d2.relief, k: d.reliefK, same: JSON.stringify([r.h, r.slope, r.lat, r.lon, d.sunLightDir, d.instant]) === JSON.stringify([r2.h, r2.slope, r2.lat, r2.lon, d2.sunLightDir, d2.instant]) }; });
    expect(`${tag} relief: display only (inspection readout, Sun direction and status identical with relief on and off; distance normalisation K = ${rOn.k})`, rOn.on && !rOn.off && rOn.same && rOn.k === 2, JSON.stringify(rOn));
    await page.evaluate(() => { AsteriaView3D.testRelief(null); AsteriaView3D.close(true); });

    // ------------------------------------------------------------ Part 5: rover model and stars
    await open3d(page, 'mons_mouton', '2026-11-25T17:53');
    await page.evaluate(() => AsteriaView3D.testMode('rover'));
    await page.evaluate(() => AsteriaView3D.testKey('KeyW', true)); await page.waitForTimeout(900); await page.evaluate(() => AsteriaView3D.testKey('KeyW', false));
    await page.waitForTimeout(300);
    const rm = await page.evaluate(() => {
      const d = AsteriaView3D.debug(), s = AsteriaView3D.testScene(), R = AsteriaView3D.ROVER, out = [];
      s.roverWheels.forEach((wh, k) => {
        const a = s.roverStruts[k], half = new THREE.Vector3(0, a.scale.y / 2, 0).applyQuaternion(a.quaternion);
        const top = new THREE.Vector3(R.wheelR + 0.17, 0, 0).applyQuaternion(wh.quaternion).add(wh.position);
        out.push({ endToHousing: a.position.clone().add(half).distanceTo(top), spin: s.roverSpin[k].rotation.y });
      });
      return { model: d.roverModel, arms: out, wheels: d.rover.wheels, dist: d.rover.dist };
    });
    expect(`${tag} rover model: ${rm.model.triangles} triangles (${rm.model.low ? 'lower-detail version for phones / Low' : 'full detail'}; budget ${rm.model.low ? 3000 : 8000})`, rm.model.low === (vp.name === 'phone') && rm.model.triangles > 1000 && rm.model.triangles < (rm.model.low ? 3000 : 8000), JSON.stringify(rm.model));
    expect(`${tag} rover model: each suspension arm ends at its wheel module's steering housing (worst ${Math.max(...rm.arms.map(a => a.endToHousing)).toExponential(1)} m) and the wheels turn with the distance driven (${rm.dist.toFixed(1)} m)`, rm.arms.every(a => a.endToHousing < 1e-6) && rm.arms.every(a => Math.abs(a.spin) > 0.1), JSON.stringify(rm.arms));
    if (SHOTS) await page.screenshot({ path: path.join(OUT, `r6b_${vp.name}_rover.png`) });
    // stars: on by default, background only
    const st0 = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { box: document.getElementById('v3dStars').checked, stars: d.stars, note: !document.getElementById('v3dStarNote').hidden }; });
    expect(`${tag} stars: on by default (${st0.stars && st0.stars.n} catalogue stars drawn, note shown)`, st0.box && st0.stars && st0.stars.visible && st0.stars.n > 100 && st0.note, JSON.stringify(st0));
    const calc = () => page.evaluate(() => {
      const d = AsteriaView3D.debug(), s = AsteriaView3D.testScene(), cv = s.renderer.domElement.getBoundingClientRect();
      const ins = AsteriaView3D.testInspect(cv.left + cv.width * 0.45, cv.top + cv.height * 0.8);
      let casters = 0; s.stars.traverse(o => { if (o.castShadow || o.receiveShadow) casters++; });
      return { ins: ins && [ins.h, ins.slope, ins.lat, ins.lon, ins.dist], tiles: [document.getElementById('v3dSun').textContent, document.getElementById('v3dEarth').textContent, document.getElementById('v3dSunX').textContent, document.getElementById('v3dEarthX').textContent],
        sun: d.sunLightDir, earth: d.earthAzEl, rover: d.rover && [d.rover.h, d.rover.slope, d.rover.lat, d.rover.lon, d.rover.pitch, d.rover.roll], casters, visible: !!(d.stars && d.stars.visible) };
    });
    const withStars = await calc();
    await page.click('#v3dShadows');
    const shOn = await page.evaluate(() => { const t = AsteriaView3D.debug().instant.t; return AsteriaView3D.shadowProbe(t); });
    await page.click('#v3dStars'); await page.waitForTimeout(150);
    const noStars = await calc();
    const shOff = await page.evaluate(() => { const t = AsteriaView3D.debug().instant.t; return AsteriaView3D.shadowProbe(t); });
    await page.click('#v3dStars'); await page.click('#v3dShadows');
    expect(`${tag} stars: background only - inspection hit and readout, status tiles, Sun/Earth directions, rover readout and the rendered shadow at the site marker are identical with stars on and off; stars cast and receive no shadows`, withStars.visible && !noStars.visible && withStars.casters === 0 && JSON.stringify([withStars.ins, withStars.tiles, withStars.sun, withStars.earth, withStars.rover]) === JSON.stringify([noStars.ins, noStars.tiles, noStars.sun, noStars.earth, noStars.rover]) && shOn.renderedLit === shOff.renderedLit && shOn.validatedSunUp === shOff.validatedSunUp, JSON.stringify({ a: withStars.ins, b: noStars.ins, lit: [shOn.renderedLit, shOff.renderedLit] }));
    await page.evaluate(() => AsteriaView3D.close(true));

    // ------------------------------------------------------------ Part 6: CSV export (Explore)
    await page.goto(BASE + '#site=peak_shackleton&t=2027-01-10T00:00Z&w=30&me=2');
    await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
    await page.evaluate(() => AsteriaApp.ready());
    await page.waitForTimeout(300);
    for (const body of ['sun', 'earth']) {
      const cv = await page.evaluate(body => {
        const S = AsteriaApp.state, s = S.series, txt = AsteriaApp.csv(body), lines = txt.trim().split('\n'), mask = window.LUNA_HORIZONS[S.site.id].elevations;
        const head = lines.filter(l => l.startsWith('#')).join('\n'), iA = lines.indexOf('start_utc,end_utc,duration_h,max_elevation_deg,max_above_terrain_deg,starts_before_period,ends_after_period'), iB = lines.indexOf('utc,sun_az_deg,sun_el_deg,sun_visible_fraction,sun_up,earth_az_deg,earth_el_deg,earth_visible,terrain_horizon_at_sun_az_deg,terrain_horizon_at_earth_az_deg');
        const wrows = []; for (let k = iA + 1; k < lines.length && lines[k] && !lines[k].startsWith('#'); k++) wrows.push(lines[k].split(','));
        const W = AsteriaApp.windows(body);
        const winOK = wrows.length === W.length && W.every((w, k) => Date.parse(wrows[k][0]) === w.start && Date.parse(wrows[k][1]) === w.end && Number(wrows[k][2]) === w.durH && (w.maxEl === null ? wrows[k][3] === '' : Number(wrows[k][3]) === w.maxEl) && Number(wrows[k][5]) === (w.cutStart ? 1 : 0) && Number(wrows[k][6]) === (w.cutEnd ? 1 : 0));
        const srows = lines.slice(iB + 1).map(l => l.split(','));
        let bad = 0;
        srows.forEach((r, i) => {
          const want = [s.t[i], s.sunAz[i], s.sunEl[i], s.sunFrac[i], s.sunUp[i] ? 1 : 0, s.earthAz[i], s.earthEl[i], s.earthUp[i] ? 1 : 0, LunaEngine.maskAt(mask, s.sunAz[i]), LunaEngine.maskAt(mask, s.earthAz[i])];
          const got = [Date.parse(r[0])].concat(r.slice(1).map(Number));
          if (got.length !== 10 || got.some((g, k) => g !== want[k])) bad++;
        });
        return { head, winOK, nWin: W.length, nRows: srows.length, nSeries: s.t.length, bad, name: AsteriaApp.csvName(body), txt };
      }, body);
      const H = cv.head;
      expect(`${tag} CSV (${body === 'sun' ? 'Sunlight' : 'Earth link'} windows): header has site, lat/lon, source, horizon model, sampling step, minimum link elevation (2°), app version (git commit), generation time and the validation sentence`,
        /# site,Peak near Shackleton/.test(H) && /# latitude_deg,-88\.79$/m.test(H) && /# longitude_deg_east,/.test(H) && /# source,https?:\/\//.test(H) && /# horizon_model,.*LOLA terrain horizon mask/.test(H) && /# sampling_step_min,\d+/.test(H) && /# minimum_link_elevation_deg,2,/.test(H) && /# app_version,ASTERIA round6 @ git [0-9a-f]{7}/.test(H) && /# generated_utc,\d{4}-\d\d-\d\dT/.test(H) && H.includes('# Computed by ASTERIA; validated against NASA/JPL Horizons - see VALIDATION_REPORT.md'), H.slice(0, 300));
      expect(`${tag} CSV (${body}): windows table equals the app's windows exactly (${cv.nWin} windows) and the time series equals the app's series exactly (${cv.nRows} rows: UTC, Sun az/el, visible fraction, Sun up, Earth az/el, Earth visible, terrain horizon at both azimuths)`, cv.winOK && cv.nRows === cv.nSeries && cv.bad === 0, JSON.stringify({ winOK: cv.winOK, rows: cv.nRows, series: cv.nSeries, bad: cv.bad }));
      if (vp.name === 'laptop') {
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#' + body + 'Csv')]);
        const file = fs.readFileSync(await dl.path(), 'utf8');
        const strip = t => t.replace(/^# generated_utc,.*$/m, '');
        expect(`${tag} CSV (${body}): the "Download CSV" link in the panel downloads ${dl.suggestedFilename()} with the same content (Blob download, works from file://)`, dl.suggestedFilename() === cv.name && strip(file) === strip(cv.txt), dl.suggestedFilename());
      }
    }

    expect(`${tag} no console errors or warnings`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
