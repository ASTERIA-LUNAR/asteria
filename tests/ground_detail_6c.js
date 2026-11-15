#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6C: ground-level terrain appearance. Renders the SAME site, time and lighting in Orbit (60 km and 3 km camera
 * distance), Walk (2 m eye, facing across the Sun direction) and Rover, for every build given, and measures the picture
 * with the metrics of tests/ground_detail.js (luminance mean / standard deviation of the ground band, "detail" = mean
 * absolute difference between neighbouring pixels, foreground relative contrast), plus the ground footprint of one
 * screen pixel at three rows (from the inspection ray march: ground distance between neighbouring pixels) and therefore
 * screen pixels per DEM cell.
 *   node tests/ground_detail_6c.js [--other before=<checkout>] [--tag after] [--quality medium,high] [--variants]
 *        [--invariants]
 * --variants (this build only): diagnostic variants (relief off; plain Lambert; ambient occlusion off/on; ...).
 * --invariants: in every build, records what must NOT change (tile/ring/patch vertex heights hash, inspection readouts
 *   at fixed pixels, rover wheel contact and tilt, status tiles, Sun/Earth directions and readouts) and, with --other,
 *   compares them with this build (exit 1 on any difference).
 * Screenshots: docs/ground_detail/round6c/<build>_<site>_<view>_<quality>[_<variant>].jpg; numbers:
 * docs/ground_detail/round6c/measurements_<tag>.json. Overlays are hidden in the pictures. */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), url = require('url');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const TAG = arg('--tag') || 'now';
const OTHERS = process.argv.map((a, i) => a === '--other' ? process.argv[i + 1] : null).filter(Boolean).map(x => ({ label: x.split('=')[0], root: x.slice(x.indexOf('=') + 1) }));
const QUALS = (arg('--quality') || 'medium,high').split(',');
const OUT = path.join(__dirname, '..', 'docs', 'ground_detail', 'round6c'); fs.mkdirSync(OUT, { recursive: true });
// Peak near Shackleton: 2028-09-25 10:04 UTC, Sun 2.57 deg up at az 334.7 (5 m patch, 20 m tile, 25 m ring A).
// Mons Malapert: 2028-09-28 03:00 UTC, Sun 3.03 deg up at az 68.0, terrain horizon -1.21 deg (validated mask): sunlit.
// (20 m tile, 25 m ring A, no 5 m patch.)
const CASES = [
  { site: 'peak_shackleton', t: '2028-09-25T10:04' },
  { site: 'mons_malapert', t: '2028-09-28T03:00' }
];
const VIEWS = ['orbit60', 'orbit3', 'walk', 'rover'];
const HIDE = '.v3d-mini,.v3d-hud,.v3d-labels,.v3d-feat,.v3d-msgs,.v3d-shadownote,#v3dPad,.v3d-exag,.v3d-qnote,.v3d-close,.v3d-relief-note,#v3dInspect,#v3dInspMark,.v3d-lbl{visibility:hidden!important}';

async function measure(page, buf) {
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const y0 = Math.floor(img.height * 0.58), y1 = Math.floor(img.height * 0.96), x0 = Math.floor(img.width * 0.05), x1 = Math.floor(img.width * 0.95);
    const d = g.getImageData(x0, y0, x1 - x0, y1 - y0), W = x1 - x0, H = y1 - y0, L = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) L[k] = 0.2126 * d.data[4 * k] + 0.7152 * d.data[4 * k + 1] + 0.0722 * d.data[4 * k + 2];
    let s = 0, s2 = 0, gr = 0, n = 0;
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const v = L[y * W + x]; s += v; s2 += v * v; gr += Math.abs(L[y * W + x + 1] - v) + Math.abs(L[(y + 1) * W + x] - v); n++; }
    let fs = 0, fs2 = 0, fn = 0;
    for (let y = Math.floor(H * 2 / 3); y < H; y++) for (let x = 0; x < W; x++) { const v = L[y * W + x]; fs += v; fs2 += v * v; fn++; }
    const fm = fs / fn, fsd = Math.sqrt(Math.max(0, fs2 / fn - fm * fm));
    // local contrast at a 16-pixel scale (std of 16x16 block means / overall mean): the "rich surface variation" seen
    // in Orbit is variation between neighbouring areas, which the 1-pixel "detail" metric does not capture
    const B = 16, bm = [];
    for (let by = 0; by + B <= H; by += B) for (let bx = 0; bx + B <= W; bx += B) { let q = 0; for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) q += L[y * W + x]; bm.push(q / (B * B)); }
    const bmean = bm.reduce((a, b) => a + b, 0) / bm.length, bsd = Math.sqrt(bm.reduce((a, b) => a + (b - bmean) * (b - bmean), 0) / bm.length);
    const mean = s / n;
    return { mean: +mean.toFixed(1), std: +Math.sqrt(s2 / n - mean * mean).toFixed(1), detail: +(gr / n).toFixed(2), fgMean: +fm.toFixed(1), fgRel: +(fsd / Math.max(1, fm)).toFixed(3), block16Rel: +(bsd / Math.max(1, bmean)).toFixed(3), w: img.width, h: img.height };
  }, buf.toString('base64'));
}

async function setView(page, view) {
  await page.evaluate(view => {
    const d = AsteriaView3D.debug(), sun = d.instant.sun;
    if (view === 'orbit60' || view === 'orbit3') {
      AsteriaView3D.testMode('orbit');
      // side-lit, as the default Orbit framing (camera azimuth = Sun azimuth + 145 deg)
      AsteriaView3D.testCamera(view === 'orbit60' ? { dist: 60000, pitch: 40, yaw: sun.az + 145 } : { dist: 3000, pitch: 25, yaw: sun.az + 145 });
    } else if (view === 'walk') {
      AsteriaView3D.testMode('walk');
      // eye 2 m at the site marker, looking across the Sun direction (Sun azimuth + 90 deg), 2 deg down
      AsteriaView3D.testCamera({ walk: { x: 0, z: 0, yaw: sun.az + 90, pitch: -2 } });
    } else {
      AsteriaView3D.testMode('rover');   // default rover: 25 m from the site, heading Sun azimuth + 90 deg, camera behind
    }
  }, view);
}

// ground footprint of one screen pixel (CSS px) at rows 60 / 75 / 90 % of the canvas height, centre column, from the
// inspection ray march (the same drawn surface and stored LOLA grids as the readout)
async function footprint(page) {
  return page.evaluate(() => {
    const st = document.getElementById('v3dStage').getBoundingClientRect(), out = [];
    for (const fy of [0.6, 0.75, 0.9]) {
      const cx = st.left + st.width / 2, cy = st.top + st.height * fy;
      const a = AsteriaView3D.testInspect(cx, cy), b = AsteriaView3D.testInspect(cx + 1, cy), c = AsteriaView3D.testInspect(cx, cy + 1);
      if (!a || !b || !c) { out.push({ row: fy, hit: false }); continue; }
      const dx = Math.hypot(b.x - a.x, b.z - a.z), dy = Math.hypot(c.x - a.x, c.z - a.z), fp = Math.max(dx, dy);
      out.push({ row: fy, dist: +a.dist.toFixed(0), camDist: null, area: a.area, d: a.d, drawn: a.drawn, footprint_m: +fp.toFixed(3), pxPerCell: +(a.d / fp).toFixed(1), cellsPerPx: +(fp / a.d).toFixed(3) });
    }
    AsteriaView3D.testInspect(-10, -10);   // clear the pinned readout
    return out;
  });
}

async function openSite(browser, root, c, q, phone) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(q => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.tourOffered', '1'); if (q) localStorage.setItem('asteria.v3dQuality', q); } catch (e) { /* */ } }, q || null);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url.pathToFileURL(path.join(root, 'index.html')).href + `#site=${c.site}&t=${c.t}Z&w=1`);
  await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
  await page.evaluate(() => AsteriaApp.ready());
  await page.evaluate(() => AsteriaApp.openDeploy());
  await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  return { ctx, page, errs };
}

async function run(browser, root, label, variants) {
  const res = [];
  for (const c of CASES) for (const q of QUALS) {
    const { ctx, page, errs } = await openSite(browser, root, c, q);
    await page.addStyleTag({ content: HIDE });
    for (const view of VIEWS) for (const v of variants) {
      await setView(page, view);
      if (v.setup) await page.evaluate(v.setup);
      // openness shading is computed in the background the first time it is used (Walk/Rover)
      await page.waitForFunction(() => { const a = AsteriaView3D.debug().ao; return !a || !a.busy; }, null, { timeout: 30000 });
      await page.waitForTimeout(view === 'orbit60' || view === 'walk' || view === 'rover' ? 1500 : 1000);
      const cv = await page.$('#v3dStage canvas');
      const buf = await cv.screenshot();
      const name = `${label}_${c.site}_${view}_${q}${v.name ? '_' + v.name : ''}.jpg`;
      await cv.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 88 });
      const m = await measure(page, buf);
      const fp = v.name ? null : await footprint(page);
      const dbg = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { quality: d.quality, mode: d.mode, relief: d.relief, exposure: d.exposure, fill: d.fillIntensity, camera: d.camera, eye: d.eyeAboveGround, layers: d.layers.filter(L => !/skirt/.test(L.name)).map(L => L.name + ':' + L.vertices + (L.normalMap ? ' nm' + L.normalMap : '')), tileNormalMap: d.tileNormalMap || 0, ao: d.ao || null, anisotropy: d.anisotropy || null }; });
      if (v.cleanup) await page.evaluate(v.cleanup);
      res.push(Object.assign({ build: label, site: c.site, t: c.t, view, quality: q, variant: v.name || 'default', file: 'docs/ground_detail/round6c/' + name, errors: errs.length }, m, { footprint: fp }, dbg));
      console.log(`${label.padEnd(7)} ${c.site.padEnd(16)} ${view.padEnd(8)} ${q.padEnd(6)} ${(v.name || 'default').padEnd(14)} mean ${String(m.mean).padStart(5)} std ${String(m.std).padStart(5)} detail ${String(m.detail).padStart(5)} blk16 ${m.block16Rel} fgRel ${m.fgRel}` +
        (fp ? ' | px/cell ' + fp.map(f => f.hit === false ? '-' : f.pxPerCell + '@' + f.dist + 'm(' + f.d + ')').join(' ') : '') + (errs.length ? ' ERR ' + errs[0] : ''));
    }
    await ctx.close();
  }
  return res;
}

// what must not change (round 6C is display-only)
async function invariants(browser, root, label) {
  const out = {};
  for (const c of CASES) for (const q of ['low', 'medium', 'high']) {
    const { ctx, page, errs } = await openSite(browser, root, c, q);
    const key = c.site + '/' + q;
    out[key] = {};
    for (const view of ['orbit60', 'orbit3', 'walk', 'rover']) {
      await setView(page, view);
      await page.waitForTimeout(700);
      out[key][view] = await page.evaluate(() => {
        const s = AsteriaView3D.testScene(), d = AsteriaView3D.debug();
        // heights: every vertex position of every terrain layer (hash of the Float32 values) and the tile mesh
        const hash = arr => { let h1 = 2166136261 >>> 0, n = 0; const u = new Uint32Array(arr.buffer, arr.byteOffset, arr.length); for (let k = 0; k < u.length; k++) { h1 = Math.imul(h1 ^ u[k], 16777619) >>> 0; n++; } return h1.toString(16) + '/' + n; };
        const geo = { tile: hash(s.geo.attributes.position.array), tileH: s.geo.attributes.aH ? hash(s.geo.attributes.aH.array) : null, tileSlope: s.geo.attributes.aS ? hash(s.geo.attributes.aS.array) : null };
        s.layers.forEach(L => { geo[L.name] = hash(L.mesh.geometry.attributes.position.array); });
        const st = document.getElementById('v3dStage').getBoundingClientRect(), insp = [];
        for (const fy of [0.55, 0.7, 0.85]) for (const fx of [0.25, 0.5, 0.75]) {
          const r = AsteriaView3D.testInspect(st.left + st.width * fx, st.top + st.height * fy);
          insp.push(r ? [r.h, r.slope, r.lat, r.lon, r.dist, r.d, r.area, r.product, r.drawn, r.x, r.y, r.z].map(x => typeof x === 'number' ? +x.toPrecision(12) : x) : null);
        }
        AsteriaView3D.testInspect(-10, -10);
        const txt = id => { const e = document.getElementById(id); return e ? e.textContent : null; };
        return {
          geo, insp,
          tiles: [txt('v3dSun'), txt('v3dEarth'), txt('v3dSunX'), txt('v3dEarthX'), document.getElementById('v3dTileSun').className, document.getElementById('v3dTileEarth').className, txt('v3dTime')],
          banner: document.getElementById('v3dBanner').hidden ? null : txt('v3dBanner'),
          sunLightDir: d.sunLightDir.map(x => +x.toPrecision(12)), sunIntensity: d.sunIntensity, earthDir: d.earthDir.map(x => +x.toPrecision(12)), earthAzEl: d.earthAzEl,
          instant: d.instant, camera: d.camera.map(x => +x.toPrecision(10)), eye: +d.eyeAboveGround.toPrecision(10),
          rover: d.mode === 'rover' && d.rover ? JSON.stringify(d.rover) : null,
          roverReadout: d.mode === 'rover' ? txt('v3dRover') : null,
          shadowCamera: d.shadowCamera, labelSun: d.labelSun, labelEarth: d.labelEarth
        };
      });
    }
    out[key].errors = errs;
    await ctx.close();
  }
  return out;
}

function diff(a, b, p, list) {
  if (typeof a !== typeof b || (a === null) !== (b === null)) { list.push(p + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); return; }
  if (a && typeof a === 'object') { const ks = new Set([...Object.keys(a), ...Object.keys(b)]); ks.forEach(k => diff(a[k], b[k], p + '.' + k, list)); return; }
  if (a !== b) list.push(p + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
}

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const here = path.join(__dirname, '..');
  if (process.argv.includes('--invariants')) {
    const mine = await invariants(browser, here, TAG);
    fs.writeFileSync(path.join(OUT, 'invariants_' + TAG + '.json'), JSON.stringify(mine, null, 1));
    let bad = 0;
    for (const o of OTHERS) {
      const theirs = await invariants(browser, o.root, o.label);
      fs.writeFileSync(path.join(OUT, 'invariants_' + o.label + '.json'), JSON.stringify(theirs, null, 1));
      const list = []; diff(theirs, mine, '', list);
      const errs = Object.values(mine).reduce((n, x) => n + x.errors.length, 0);
      console.log(`invariants ${o.label} vs ${TAG}: ${list.length} differences; console errors in ${TAG}: ${errs}`);
      list.slice(0, 40).forEach(x => console.log('  ' + x));
      const nInsp = Object.values(mine).reduce((n, x) => n + ['orbit60', 'orbit3', 'walk', 'rover'].reduce((m, v) => m + x[v].insp.length, 0), 0);
      console.log(`  compared: ${Object.keys(mine).length} site/quality combinations x 4 views; ${nInsp} inspection readouts; vertex hashes of every layer; status tiles, Sun/Earth readouts and directions; rover pose and readout`);
      bad += list.length + errs;
    }
    await browser.close();
    console.log(bad ? 'INVARIANTS: FAIL' : 'INVARIANTS: PASS');
    process.exit(bad ? 1 : 0);
  }
  const all = [];
  for (const o of OTHERS) all.push(...await run(browser, o.root, o.label, [{}]));
  const V = [{}];
  if (process.argv.includes('--variants')) {
    const has = fs.readFileSync(path.join(here, 'js', 'view3d.js'), 'utf8');
    V.push({ name: 'relief_off', setup: () => AsteriaView3D.testRelief(false), cleanup: () => AsteriaView3D.testRelief(null) });
    V.push({ name: 'lambert', setup: () => { AsteriaView3D.testRelief(false); AsteriaView3D.testDiag({ lambert: true }); }, cleanup: () => { AsteriaView3D.testDiag({ lambert: false }); AsteriaView3D.testRelief(null); } });
    if (/testAO/.test(has)) {
      V.push({ name: 'ao_on', setup: () => AsteriaView3D.testAO(true), cleanup: () => AsteriaView3D.testAO(null) });
      V.push({ name: 'ao_off', setup: () => AsteriaView3D.testAO(false), cleanup: () => AsteriaView3D.testAO(null) });
    }
    if (/lunarLambert/.test(has)) V.push({ name: 'lunar_lambert', setup: () => AsteriaView3D.testDiag({ lunarLambert: true }), cleanup: () => AsteriaView3D.testDiag({ lunarLambert: false }) });
    if (/vertexNormals/.test(has)) V.push({ name: 'vertex_normals', setup: () => AsteriaView3D.testDiag({ vertexNormals: true }), cleanup: () => AsteriaView3D.testDiag({ vertexNormals: false }) });
  }
  all.push(...await run(browser, here, TAG, V));
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'measurements_' + TAG + '.json'), JSON.stringify(all, null, 1));
})().catch(e => { console.error(e); process.exit(2); });
