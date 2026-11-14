#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Ground detail in Walk / Rover (round 5, Part 3): renders the same site, time and camera and measures the visible
 * detail of the ground in the picture (overlays hidden): luminance mean and standard deviation, and the mean
 * absolute difference between neighbouring pixels ("detail"; higher = more visible relief), over the lower part of
 * the 3D canvas (the ground in front of the camera).
 *   node tests/ground_detail.js [--other <label>=<folder with another checkout, e.g. round3=... of commit 46b0fa8>] [--tag after|diag]
 * Screenshots: tests/screenshots/r5_ground_<tag>_<site>_<mode>[_<variant>].png ; numbers: printed and written to
 * tests/screenshots/r5_ground_<tag>.json. Variants (this build only): relief on/off, quality, and diagnostic
 * switches used to find the cause (Lambert instead of Lommel-Seeliger; shadow camera fitted to the 6 km tile). */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), url = require('url');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const TAG = arg('--tag') || 'now';
// other builds to measure, e.g. --other round3=<checkout of 46b0fa8> --other before=<checkout of the commit before the fix>
const OTHERS = process.argv.map((a, i) => a === '--other' ? process.argv[i + 1] : null).filter(Boolean).map(x => ({ label: x.split('=')[0], root: x.slice(x.indexOf('=') + 1) }));
const OUT = path.join(__dirname, 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
const CASES = [
  { site: 'peak_shackleton', t: '2028-09-25T10:04', note: '5 m patch available' },
  { site: 'mons_mouton', t: '2026-11-25T17:53', note: '20 m tile only' }
];
const HIDE = '.v3d-mini,.v3d-hud,.v3d-labels,.v3d-feat,.v3d-msgs,.v3d-shadownote,#v3dPad,.v3d-exag,.v3d-qnote,.v3d-close,.v3d-relief-note{visibility:hidden!important}';

async function measure(page, file) {
  const cv = await page.$('#v3dStage canvas');
  const buf = await cv.screenshot({ path: file });
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const y0 = Math.floor(img.height * 0.58), y1 = Math.floor(img.height * 0.96), x0 = Math.floor(img.width * 0.05), x1 = Math.floor(img.width * 0.95);
    const d = g.getImageData(x0, y0, x1 - x0, y1 - y0), W = x1 - x0, H = y1 - y0, L = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) L[k] = 0.2126 * d.data[4 * k] + 0.7152 * d.data[4 * k + 1] + 0.0722 * d.data[4 * k + 2];
    let s = 0, s2 = 0, gr = 0, n = 0;
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) { const v = L[y * W + x]; s += v; s2 += v * v; gr += Math.abs(L[y * W + x + 1] - v) + Math.abs(L[(y + 1) * W + x] - v); n++; }
    // foreground: the lowest third of that band (ground within a few tens of metres in Walk/Rover); relative contrast
    // = standard deviation / mean, so a brighter picture does not count as more detail
    let fs = 0, fs2 = 0, fn = 0;
    for (let y = Math.floor(H * 2 / 3); y < H; y++) for (let x = 0; x < W; x++) { const v = L[y * W + x]; fs += v; fs2 += v * v; fn++; }
    const fm = fs / fn, fsd = Math.sqrt(Math.max(0, fs2 / fn - fm * fm));
    const mean = s / n; return { mean: +mean.toFixed(1), std: +Math.sqrt(s2 / n - mean * mean).toFixed(1), detail: +(gr / n).toFixed(2), fgMean: +fm.toFixed(1), fgRel: +(fsd / Math.max(1, fm)).toFixed(3), w: img.width, h: img.height };
  }, buf.toString('base64'));
}

async function run(browser, root, label, variants) {
  const res = [];
  for (const c of CASES) for (const v of variants) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(q => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); if (q) localStorage.setItem('asteria.v3dQuality', q); } catch (e) { /* */ } }, v.quality || null);
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(url.pathToFileURL(path.join(root, 'index.html')).href + `#site=${c.site}&t=${c.t}Z&w=1`);
    await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
    await page.evaluate(() => AsteriaApp.ready());
    await page.evaluate(() => AsteriaApp.openDeploy());
    await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining, null, { timeout: 30000 });
    await page.addStyleTag({ content: HIDE });
    await page.evaluate(m => AsteriaView3D.testMode(m), v.mode);
    if (v.setup) await page.evaluate(v.setup);
    await page.waitForTimeout(1500);
    const file = path.join(OUT, `r5_ground_${label}_${c.site}_${v.mode}${v.name ? '_' + v.name : ''}.png`);
    const m = await measure(page, file);
    const dbg = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { quality: d.quality, layers: (d.layers || []).map(l => l.name + ':' + l.vertices), texel: d.shadowCamera && d.shadowCamera.texel, relief: d.relief, stride: d.stride }; });
    res.push(Object.assign({ build: label, site: c.site, t: c.t, mode: v.mode, variant: v.name || 'default', file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/'), errors: errs.length }, m, dbg));
    console.log(`${label.padEnd(7)} ${c.site.padEnd(16)} ${v.mode.padEnd(5)} ${(v.name || 'default').padEnd(22)} mean ${m.mean} std ${m.std} detail ${m.detail} | fg mean ${m.fgMean} rel ${m.fgRel}  q ${dbg.quality} texel ${dbg.texel ? dbg.texel.toFixed(1) : '-'}${errs.length ? ' ERR ' + errs[0] : ''}`);
    await ctx.close();
  }
  return res;
}

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const all = [];
  for (const o of OTHERS) {
    const r3 = !/testQuality/.test(fs.readFileSync(path.join(o.root, 'js', 'view3d.js'), 'utf8'));
    const vs = []; for (const mode of ['walk', 'rover']) for (const q of r3 ? [null] : ['low', 'medium', 'high']) vs.push(q ? { mode, quality: q, name: q } : { mode });
    if (!r3) for (const mode of ['walk', 'rover']) vs.push({ mode, quality: 'medium', name: 'medium_light_up', setup: () => AsteriaView3D.testBrightness(3) });
    all.push(...await run(browser, o.root, o.label, vs));
  }
  const here = path.join(__dirname, '..');
  const has = fs.readFileSync(path.join(here, 'js', 'view3d.js'), 'utf8');
  const V = [];
  for (const mode of ['walk', 'rover']) for (const q of ['low', 'medium', 'high']) {
    V.push({ mode, quality: q, name: q });
    if (/testRelief/.test(has)) V.push({ mode, quality: q, name: q + '_relief_off', setup: () => AsteriaView3D.testRelief(false) });
    if (q === 'medium') V.push({ mode, quality: q, name: q + '_light_up', setup: () => AsteriaView3D.testBrightness(3) });
    if (/testDiag/.test(has) && TAG === 'diag') {
      V.push({ mode, quality: q, name: q + '_lambert', setup: () => { AsteriaView3D.testRelief(false); AsteriaView3D.testDiag({ lambert: true }); } });
      V.push({ mode, quality: q, name: q + '_tile_shadow', setup: () => { AsteriaView3D.testRelief(false); AsteriaView3D.testDiag({ tileShadow: true }); } });
    }
  }
  all.push(...await run(browser, here, TAG, V));
  await browser.close();
  fs.writeFileSync(path.join(OUT, `r5_ground_${TAG}.json`), JSON.stringify(all, null, 1));
})().catch(e => { console.error(e); process.exit(2); });
