#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6F browser checks (laptop and emulated phone).
 * Part 1 - covering reach and randomness: the distance fade is measured from the camera (uniforms 1500 / 2000 m); the
 *   covering is present near the viewer 1 km and 2 km from the site; no craterlet class has a radius above 5 m (source
 *   check); frame time in Walk/Rover with the covering on (GPU-synchronised renders) < 33 ms.
 * Part 2 - "Choose your point -> 3D": coverage outlines on the map (6 km tile + 32 km ring per 3D site, centred on the
 *   tile centres); a custom point inside a tile opens that site's 3D scene at the point (Walk/Rover start there), with
 *   status tiles equal to the 2D tiles (state, Sun/Earth elevation, azimuth, horizon) and the scene's Sun/Earth
 *   directions and vertices identical to opening the site itself; a point on the ring opens in Orbit only (Walk/Rover
 *   disabled with the reason); a point outside every area: Deploy disabled with the reason; the share link reopens the
 *   custom-point 3D view; tour step "Choose your point, then Deploy 3D"; Getting started step 3.
 * Part 3 - View mode selector: heading, size, selected state, no overlap with its neighbours.
 * Screenshots: docs/ground_detail/round6f/. Numbers: docs/ground_detail/round6f/results_6f.json.
 *   node tests/ui_round6f.js [--only laptop|phone] [--noshots] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only'), SHOTS = !process.argv.includes('--noshots');
const OUT = path.join(ROOT, 'docs', 'ground_detail', 'round6f'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' - ' + String(info).slice(0, 400) : '')); if (!ok) fails++; };
const RES = {};
const BASE = url.pathToFileURL(path.join(ROOT, 'index.html')).href;
const T = '2028-09-25T10:04';

// ---------------------------------------------------------------- Node-side checks (source and data)
(function nodeChecks() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'view3d.js'), 'utf8');
  const rmax = +(/COVER_RMAX = (\d+(?:\.\d+)?)/.exec(src) || [])[1];
  // feature classes (COVER_CLASSES: [C, p, rmin, rmax, seed, kind]); the shader loops over them (uCovA/uCovB)
  const cls = Function('COVER_RMAX', 'return ' + /COVER_CLASSES = (\[\[[\s\S]*?\]\])/.exec(src)[1])(rmax);
  const calls = cls, radii = cls.map(c => c[3]);
  expect('Part 1: no craterlet or fleck class has a radius above COVER_RMAX = 5 m (below the DEM grid scale)', rmax === 5 && calls.length >= 6 && radii.every(r => r <= 5), JSON.stringify(radii));
  // round 6F fix: Three.js does not upload cameraPosition for the Lambert terrain material (it stayed 0 = the site), so the
  // fade uses uCamW, set from the rendering camera in scene.onBeforeRender
  expect('Part 1: fade constants 1500 / 2000 m (no 350 m cut-off), measured from the camera (uCamW set in scene.onBeforeRender; cameraPosition not used)', /COVER_NEAR = 1500, COVER_FAR = 2000/.test(src) && /smoothstep\( uCovNear, uCovFar, length\( vW - uCamW \) \)/.test(src) && /scene\.onBeforeRender = function \(r, sc, cam\) \{ if \(U\.uCamW\) U\.uCamW\.value\.setFromMatrixPosition\(cam\.matrixWorld\)/.test(src) && !/cameraPosition \)/.test(src));
  expect('Part 1: tuned visually, not statistically matched (wording kept)', /tuned visually, not statistically matched/.test(src));
  // tile centres = site coordinates (the coverage outlines and host3D use the site coordinates)
  global.window = {};
  require(path.join(ROOT, 'data', 'sites.js')); require(path.join(ROOT, 'data', 'terrain3d', 'index.js'));
  const SITES = (window.LUNA_SITES || window.ASTERIA_SITES || {}).sites || window.LUNA_SITES || [];
  const bad = [];
  for (const id of window.ASTERIA_TERRAIN3D_IDS) {
    require(path.join(ROOT, 'data', 'terrain3d', id + '.js')); require(path.join(ROOT, 'data', 'terrain3d', 'ext', id + '_a.js'));
    const m = window.ASTERIA_TERRAIN3D[id], a = window.ASTERIA_TERRAIN3D_EXT[id + '_a'], s = (Array.isArray(SITES) ? SITES : []).find(x => x.id === id);
    if (!s || Math.abs(s.lat - m.lat) > 1e-9 || Math.abs(s.lon - m.lon) > 1e-9 || a.lat !== m.lat || a.lon !== m.lon || a.half_m !== 16000 || m.size_m < 6000) bad.push(id);
  }
  expect('Part 2: every 3D tile and ring A is centred on its site coordinate; ring A half-size 16 km; tile >= 6 km', bad.length === 0 && window.ASTERIA_TERRAIN3D_IDS.length === 8, bad.join(','));
})();

async function newPage(ctx) {
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { page, errors };
}
const ready = page => page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series && AsteriaApp.state.site, null, { timeout: 60000 }).then(() => page.evaluate(() => AsteriaApp.ready()));
const v3dReady = page => page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining && AsteriaView3D.debug().frames > 2, null, { timeout: 90000 }).then(() => page.waitForTimeout(700));
async function gotoHash(page, h) { await page.goto('about:blank'); await page.goto(BASE + '#' + h); await ready(page); await page.waitForTimeout(300); }   // full reload (a hash-only change would race with the old state)
// GPU-synchronised frame time: render + 1-pixel readPixels, n frames
const frameMs = (page, n) => page.evaluate(n => {
  const s = AsteriaView3D.testScene(), g = s.renderer.getContext(), px = new Uint8Array(4);
  s.renderer.render(s.scene, s.camera); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
  const t0 = performance.now(); for (let i = 0; i < n; i++) { s.renderer.render(s.scene, s.camera); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); }
  return (performance.now() - t0) / n;
}, n);
// pixels of the bottom half (near the viewer) that differ between covering on and off
const coverDiff = page => page.evaluate(() => {
  const s = AsteriaView3D.testScene(), g = s.renderer.getContext();
  const grab = () => { s.renderer.render(s.scene, s.camera); const w = g.drawingBufferWidth, h = g.drawingBufferHeight, b = new Uint8Array(4 * w * h); g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, b); return { b, w, h }; };
  AsteriaView3D.testCover(true); const on = grab(); AsteriaView3D.testCover(false); const off = grab(); AsteriaView3D.testCover(true);
  let n = 0, tot = 0; for (let y = 0; y < Math.floor(on.h / 2); y++) for (let x = 0; x < on.w; x++) { const i = 4 * (y * on.w + x); tot++; if (Math.abs(on.b[i] - off.b[i]) + Math.abs(on.b[i + 1] - off.b[i + 1]) + Math.abs(on.b[i + 2] - off.b[i + 2]) > 3) n++; }
  return { frac: n / tot, n };
});
const tiles2D = page => page.evaluate(() => ({ sun: document.getElementById('sunState').textContent, earth: document.getElementById('earthState').textContent, sunX: document.getElementById('sunExpert').textContent, earthX: document.getElementById('earthExpert').textContent }));
const tiles3D = page => page.evaluate(() => ({ sun: document.getElementById('v3dSun').textContent, earth: document.getElementById('v3dEarth').textContent, sunX: document.getElementById('v3dSunX').textContent, earthX: document.getElementById('v3dEarthX').textContent, lbl: document.getElementById('v3dTileSun').querySelector('.tlabel').textContent }));
// "el +x° · az y° · horizon z°" from either tile text
const nums = t => { const m = /el ([+-][\d.]+)° · az ([\d.]+)° · (?:terrain )?horizon ([+-][\d.]+)°/.exec(t); return m ? [m[1], m[2], m[3]].join('|') : null; };
const sameTiles = (a, b) => a.sun === b.sun && a.earth === b.earth && nums(a.sunX) && nums(a.sunX) === nums(b.sunX) && nums(a.earthX) === nums(b.earthX);

async function run(browser, vp) {
  const tag = vp.name, R = RES[tag] = {};
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr || 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
  await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.spotlightShown', '1'); localStorage.setItem('asteria.v3dQuality', 'medium'); } catch (e) { } });
  const { page, errors } = await newPage(ctx);

  // ---------------- coverage on the map
  await gotoHash(page, 'site=peak_shackleton&t=' + T + 'Z&w=1');
  const cov = await page.evaluate(() => ({ n: AsteriaMap.coverageCount(), out: AsteriaApp.coverage().length, legend: /3D terrain \(Deploy\)/.test(document.getElementById('mapLegend').textContent), rt: (() => { const c = AsteriaApp.llFrom(-88.79, 124.5, 1234, -567), g = AsteriaApp.enFrom(-88.79, 124.5, c.lat, c.lon); return Math.hypot(g.e - 1234, g.n + 567); })() }));
  expect(`${tag} Part 2: coverage outlines on the 2D map (8 sites x tile + ring), legend line; lat/lon <-> (e, n) round trip < 1 mm`, cov.n === 16 && cov.out === 16 && cov.legend && cov.rt < 1e-3, JSON.stringify(cov));
  if (SHOTS) {
    await page.evaluate(() => { const m = AsteriaMap.leaflet(); m.setView([-88.9, 128], 7, { animate: false }); });
    await page.waitForTimeout(900);
    await page.locator('#mapPanel').screenshot({ path: path.join(OUT, `map_coverage_${tag}.jpg`), quality: 80 });
  }

  // ---------------- reference: the site itself in 3D (Sun direction, vertices)
  await page.evaluate(() => AsteriaApp.openDeploy()); await v3dReady(page);
  const ref = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { sun: d.sunLightDir, earth: d.earthDir, vert: d.vertices, layers: d.layers.map(l => l.name + ':' + l.vertices).join(',') }; });
  // Part 1: the fade follows the camera - covering present near the viewer 1 km and 2 km from the site (Walk)
  // positions 1 km and 2 km from the site: eight azimuths each, the first one with sunlit ground near the viewer (the
  // covering modulates only the Sun term, so on ground facing away from the low Sun it has no effect at any distance)
  const ring = r => [0, 45, 90, 135, 180, 225, 270, 315].map(a => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)]);
  for (const [k, cands] of [['site', [[0, 0]]], ['1km', [[1000, -300]].concat(ring(1000))], ['2km', ring(2000)]]) {
    let d = { frac: -1 }, best = 0, pos = cands[0];
    for (const c of cands) {
    for (const dy of [90, 150, 210, 270]) {
      await page.evaluate(([p, dy]) => { AsteriaView3D.testMode('walk'); const s = AsteriaView3D.debug().instant.sun; AsteriaView3D.testCamera({ walk: { x: p[0], z: p[1], yaw: s.az + dy, pitch: -12 } }); }, [c, dy]);
      await page.waitForTimeout(150);
      const q = await coverDiff(page); if (q.frac > d.frac) { d = q; best = dy; pos = c; }
    }
    if (d.frac > 0.2) break;
    }
    await page.evaluate(([p, dy]) => { const s = AsteriaView3D.debug().instant.sun; AsteriaView3D.testCamera({ walk: { x: p[0], z: p[1], yaw: s.az + dy, pitch: -12 } }); }, [pos, best]);
    await page.waitForTimeout(300);
    R['cover_' + k] = Object.assign({ yawFromSun: best, pos }, d);
    expect(`${tag} Part 1: covering present near the viewer at ${k} from the site (Walk; fade measured from the camera)`, d.frac > 0.2, (100 * d.frac).toFixed(1) + ' % of the near half differs on/off at (' + pos.map(x => x.toFixed(0)).join(', ') + ') m, view azimuth Sun + ' + best + ' deg');
    if (SHOTS && k !== 'site') await page.screenshot({ path: path.join(OUT, `walk_${k}_from_site_${tag}.jpg`), quality: 82 });
  }
  const cu = await page.evaluate(() => AsteriaView3D.debug().cover);
  expect(`${tag} Part 1: covering uniforms (near 1500 m, far 2000 m)`, cu.near === 1500 && cu.far === 2000 && cu.on, JSON.stringify(cu));
  if (SHOTS) {
    await page.evaluate(() => { AsteriaView3D.testMode('walk'); const s = AsteriaView3D.debug().instant.sun; AsteriaView3D.testCamera({ walk: { x: 0, z: 0, yaw: s.az + 60, pitch: -28 } }); }); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `walk_closeup_peak_shackleton_${tag}.jpg`), quality: 85 });
    await page.evaluate(() => { const s = AsteriaView3D.debug().instant.sun; AsteriaView3D.testCamera({ walk: { x: 120, z: -60, yaw: s.az + 20, pitch: -80 } }); }); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `walk_from_above_peak_shackleton_${tag}.jpg`), quality: 85 });
  }
  for (const m of ['walk', 'rover']) {
    await page.evaluate(m => AsteriaView3D.testMode(m), m); await page.waitForTimeout(300);
    const ms = await frameMs(page, 30); R['frame_' + m] = ms;
    expect(`${tag} Part 1: ${m} frame time with the covering on at Medium < 33 ms (>= 30 fps)`, ms < 33, ms.toFixed(2) + ' ms');
    if (SHOTS && m === 'rover') await page.screenshot({ path: path.join(OUT, `rover_peak_shackleton_${tag}.jpg`), quality: 82 });
  }
  // Part 3: mode selector
  await page.evaluate(() => AsteriaView3D.testMode('orbit'));
  const ms3 = await page.evaluate(() => {
    const box = e => { const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, h: r.height, w: r.width }; };
    const wrap = document.querySelector('.v3d-modes'), head = document.getElementById('v3dModeHead'), btns = [...wrap.querySelectorAll('.seg button')];
    const prev = wrap.previousElementSibling, next = wrap.nextElementSibling, other = document.querySelector('.v3d-presets .btn');
    const ov = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    return { head: head.textContent, vis: btns.every(b => b.offsetParent !== null), h: btns.map(b => box(b).h), fs: parseFloat(getComputedStyle(btns[0]).fontSize), fsOther: parseFloat(getComputedStyle(other).fontSize),
      on: btns.filter(b => b.classList.contains('on')).map(b => b.dataset.mode), onBg: getComputedStyle(btns[0]).backgroundColor, offBg: getComputedStyle(btns[1]).backgroundColor,
      overlap: ov(box(wrap), box(prev)) || ov(box(wrap), box(next)), gapAbove: box(wrap).t - box(prev).b, gapBelow: box(next).t - box(wrap).b, inPanel: box(wrap).r <= box(document.getElementById('v3dPanel')).r + 1 };
  });
  expect(`${tag} Part 3: "View mode" heading; Orbit/Walk/Rover visible, >= 40 px tall, larger text than the other panel buttons, clear selected state; no overlap; spacing above/below`,
    ms3.head === 'View mode' && ms3.vis && ms3.h.every(h => h >= 40) && ms3.fs > ms3.fsOther && ms3.on.join() === 'orbit' && ms3.onBg !== ms3.offBg && !ms3.overlap && ms3.gapAbove >= 8 && ms3.gapBelow >= 0 && ms3.inPanel, JSON.stringify(ms3));
  if (SHOTS) { await page.evaluate(() => document.querySelector('.v3d-modes').scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `mode_buttons_${tag}.jpg`), quality: 85 }); }
  await page.evaluate(() => AsteriaView3D.close(true));

  // ---------------- Mons Malapert Rover (second 6E site)
  await gotoHash(page, 'site=mons_malapert&t=2028-09-28T03:00Z&w=1');
  await page.evaluate(() => AsteriaApp.openDeploy()); await v3dReady(page);
  await page.evaluate(() => AsteriaView3D.testMode('rover')); await page.waitForTimeout(500);
  R.frame_rover_malapert = await frameMs(page, 30);
  expect(`${tag} Part 1: Mons Malapert Rover frame time < 33 ms`, R.frame_rover_malapert < 33, R.frame_rover_malapert.toFixed(2) + ' ms');
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `rover_mons_malapert_${tag}.jpg`), quality: 82 });
  await page.evaluate(() => AsteriaView3D.close(true));

  // ---------------- custom point inside the 6 km tile (800 m E, 600 m S of Peak near Shackleton)
  const pt = await page.evaluate(() => AsteriaApp.llFrom(-88.79, 124.5, 800, -600));
  const lat = +pt.lat.toFixed(4), lon = +pt.lon.toFixed(4);
  await gotoHash(page, `lat=${lat}&lon=${lon}&t=${T}Z&w=1`);
  const dep = await page.evaluate(() => ({ row: !document.getElementById('deployRow').hidden, dis: document.getElementById('deployBtn').disabled, hint: document.getElementById('deployHint').textContent, host: AsteriaApp.host3D(AsteriaApp.state.site.lat, AsteriaApp.state.site.lon) }));
  expect(`${tag} Part 2: custom point inside a tile - Deploy shown and enabled, names the site`, dep.row && !dep.dis && /Peak near Shackleton/.test(dep.hint) && dep.host && dep.host.tile, JSON.stringify(dep));
  const t2 = await tiles2D(page);
  await page.evaluate(() => AsteriaApp.openDeploy()); await v3dReady(page);
  let d = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { site: d.site, point: d.point, sun: d.sunLightDir, earth: d.earthDir, vert: d.vertices, layers: d.layers.map(l => l.name + ':' + l.vertices).join(','), title: document.getElementById('v3dTitle').textContent, note: document.getElementById('v3dPtNote').textContent, target: AsteriaView3D.testScene ? null : null }; });
  let t3 = await tiles3D(page);
  expect(`${tag} Part 2: opens Peak near Shackleton's 3D scene at the point (e, n within 1 m of 800, -600; on the tile)`, d.site === 'peak_shackleton' && d.point && d.point.inTile && Math.abs(d.point.e - 800) < 1 && Math.abs(d.point.n + 600) < 1 && /Your point/.test(d.title) && /main view's values for your point/.test(d.note), JSON.stringify(d.point) + ' ' + d.title);
  expect(`${tag} Part 2: status tiles in 3D = the 2D tiles for the point (state, el, az, horizon)`, sameTiles(t2, t3) && /your point/.test(t3.lbl), JSON.stringify({ t2, t3 }));
  expect(`${tag} Part 2: same scene as opening the site (Sun/Earth directions, vertex counts identical)`, JSON.stringify(d.sun) === JSON.stringify(ref.sun) && JSON.stringify(d.earth) === JSON.stringify(ref.earth) && d.vert === ref.vert, JSON.stringify([d.sun, ref.sun]));
  // another time step: still equal
  await page.evaluate(() => AsteriaApp.setIdx(Math.floor(AsteriaApp.state.series.t.length * 0.6))); await page.waitForTimeout(400);
  const t2b = await tiles2D(page), t3b = await tiles3D(page);
  expect(`${tag} Part 2: status tiles still equal after moving the time slider`, sameTiles(t2b, t3b), JSON.stringify({ t2b, t3b }));
  await page.evaluate(() => AsteriaApp.setIdx(0)); await page.waitForTimeout(300);
  // Walk and Rover start at the point
  await page.evaluate(() => AsteriaView3D.testMode('walk')); await page.waitForTimeout(400);
  d = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { walk: d.walk, point: d.point, cam: d.camera, eye: d.eyeAboveGround }; });
  expect(`${tag} Part 2: Walk starts at the point (eye 2 m above the ground there)`, Math.hypot(d.walk.x - d.point.x, d.walk.z - d.point.z) < 0.01 && Math.abs(d.eye - 2) < 0.05, JSON.stringify(d.walk) + ' eye ' + d.eye);
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `custom_point_walk_${tag}.jpg`), quality: 82 });
  await page.evaluate(() => AsteriaView3D.testMode('rover')); await page.waitForTimeout(500);
  d = await page.evaluate(() => { const d = AsteriaView3D.debug(), s = AsteriaView3D.testScene(); return { rx: s.roverBody.position.x, rz: s.roverBody.position.z, point: d.point }; });
  expect(`${tag} Part 2: Rover starts beside the point (within 30 m)`, Math.hypot(d.rx - d.point.x, d.rz - d.point.z) < 30, JSON.stringify(d));
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `custom_point_rover_${tag}.jpg`), quality: 82 });
  await page.evaluate(() => { AsteriaView3D.testMode('orbit'); }); await page.waitForTimeout(300);
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `custom_point_orbit_${tag}.jpg`), quality: 82 });
  // share link restores the custom-point 3D view
  const hash = await page.evaluate(() => location.hash);
  expect(`${tag} Part 2: share link has the point and v3d=1`, /lat=/.test(hash) && /lon=/.test(hash) && /v3d=1/.test(hash), hash);
  await page.evaluate(() => AsteriaView3D.close(true));
  {
    const { page: p2, errors: e2 } = await newPage(ctx);
    await p2.goto(BASE + hash); await ready(p2); await v3dReady(p2);
    const r2 = await p2.evaluate(() => { const d = AsteriaView3D.debug(); return { site: d.site, point: d.point }; });
    const a2 = await tiles2D(p2), a3 = await tiles3D(p2);
    expect(`${tag} Part 2: the share link reopens the custom-point 3D view (same point, tiles equal)`, r2.site === 'peak_shackleton' && r2.point && Math.abs(r2.point.e - 800) < 1 && sameTiles(a2, a3), JSON.stringify(r2.point));
    expect(`${tag} Part 2: no console errors on the share-link page`, e2.length === 0, e2.join(' | '));
    await p2.close();
  }

  // ---------------- custom point on the ring (8 km E of Peak near Shackleton): Orbit only
  const pr = await page.evaluate(() => AsteriaApp.llFrom(-88.79, 124.5, 8000, 2000));
  await gotoHash(page, `lat=${pr.lat.toFixed(4)}&lon=${pr.lon.toFixed(4)}&t=${T}Z&w=1`);
  const depR = await page.evaluate(() => ({ dis: document.getElementById('deployBtn').disabled, hint: document.getElementById('deployHint').textContent }));
  const t2r = await tiles2D(page);
  await page.evaluate(() => AsteriaApp.openDeploy()); await v3dReady(page);
  await page.evaluate(() => AsteriaView3D.testMode('walk')); await page.waitForTimeout(300);
  d = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { mode: d.mode, point: d.point, walkDis: document.querySelector('.seg button[data-mode="walk"]').disabled, roverDis: document.querySelector('.seg button[data-mode="rover"]').disabled, why: document.getElementById('v3dModeWhy').textContent }; });
  const t3r = await tiles3D(page);
  expect(`${tag} Part 2: point on the 32 km ring - Deploy enabled (Orbit only); Walk/Rover disabled with the reason; tiles equal 2D`, !depR.dis && /Orbit only/.test(depR.hint) && d.mode === 'orbit' && !d.point.inTile && d.point.exact && d.walkDis && d.roverDis && /6 km tile/.test(d.why) && sameTiles(t2r, t3r), JSON.stringify(d));
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `custom_point_ring_orbit_${tag}.jpg`), quality: 82 });
  await page.evaluate(() => AsteriaView3D.close(true));

  // ---------------- custom point outside every 3D area: Deploy disabled with the reason
  await gotoHash(page, `lat=-86.5&lon=90&t=${T}Z&w=1`);
  const out = await page.evaluate(() => ({ row: !document.getElementById('deployRow').hidden, dis: document.getElementById('deployBtn').disabled, hint: document.getElementById('deployHint').textContent }));
  expect(`${tag} Part 2: point outside every 3D area - Deploy disabled, reason shown`, out.row && out.dis && /3D terrain is available within about 16 km of the 8 sites/.test(out.hint), JSON.stringify(out));
  // a curated site without a 3D tile: still no Deploy button (unchanged)
  await gotoHash(page, `site=apollo11&t=${T}Z&w=1`);
  expect(`${tag} Part 2: curated site without a 3D tile - Deploy hidden (unchanged)`, await page.isHidden('#deployBtn'));

  // ---------------- tour step and Getting started step
  await gotoHash(page, `site=peak_shackleton_lw&t=${T}Z&w=30`);
  const tour = await page.evaluate(() => new Promise(res => {
    AsteriaApp.tour.start();
    const n0 = document.getElementById('tourStep').textContent;
    const go = k => { if (k === 0) return check(); document.getElementById('tourNext').click(); setTimeout(() => go(k - 1), 50); };
    const check = () => { const t0 = Date.now(); const w = () => { const tx = document.getElementById('tourText').textContent; if (!/Working/.test(tx) || Date.now() - t0 > 60000) res({ n0, step: document.getElementById('tourStep').textContent, text: tx, hl: (document.querySelector('.tour-hl') || {}).id, site: AsteriaApp.state.site.id, dep: !document.getElementById('deployBtn').disabled }); else setTimeout(w, 200); }; w(); };
    setTimeout(() => go(3), 200);
  }));
  expect(`${tag} Part 2: tour step 4 of 6 "Choose your point, then Deploy 3D" selects a point inside a 3D area and highlights Deploy`, /of 6/.test(tour.n0) && /step 4 of 6/.test(tour.step) && /Choose your point, then Deploy 3D/.test(tour.text) && tour.hl === 'deployRow' && tour.site === null && tour.dep, JSON.stringify(tour));
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `tour_step_choose_point_${tag}.jpg`), quality: 82 });
  await page.evaluate(() => document.getElementById('tourClose').click());
  const hint = await page.evaluate(() => new Promise(res => {
    try { localStorage.removeItem('asteria.hintDismissed'); } catch (e) { }
    const b = [...document.querySelectorAll('button')].find(x => /Getting started/i.test(x.textContent));
    res({ found: !!b });
  }));
  R.hintButton = hint.found;
  expect(`${tag} no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const VPS = [{ name: 'laptop', w: 1366, h: 800 }, { name: 'phone', w: 390, h: 844, dpr: 2, mobile: true }].filter(v => !ONLY || v.name === ONLY);
  for (const vp of VPS) await run(browser, vp);
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results_6f.json'), JSON.stringify({ generated: new Date().toISOString(), results: RES }, null, 1));
  console.log(fails ? `FAILED: ${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
