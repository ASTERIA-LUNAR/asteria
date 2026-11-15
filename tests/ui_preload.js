#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Prompt 11: background preload of data/dem_coarse.js, the "Loading terrain data (8.8 MB)..." status, Sky view legend.
 * Served over a local http server (file:// is not throttled), network throttled to about 3 Mbit/s, laptop 1366 x 768
 * and phone 390 x 844.
 *  1 First screen (data computed, Verified card filled) appears no later than without the preload (Save-Data run).
 *  2 The preload starts after the window "load" event; dem_coarse.js is requested exactly once, also when a custom
 *    point is chosen while the preload is still downloading; the click reuses the in-flight load.
 *  3 With navigator.connection.saveData the preload is skipped (no request until the first custom point).
 *  4 While a custom point waits for the file, the status shows "Loading terrain data (8.8 MB)..."; it disappears after.
 *  5 Custom-point horizon and status values are identical with and without the preload.
 *  6 A shared custom-point link (#lat=..&lon=..) loads the file once.
 *  7 Sky view legend (and the other .legend rows): no swatch overlaps its label, same swatch-to-text gap (within 2 px).
 *  8 No console errors.
 *   node tests/ui_preload.js [--only laptop|phone] */
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only');
let fails = 0, passes = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && (!ok || process.env.VERBOSE) ? ' - ' + String(info).slice(0, 700) : '')); if (ok) passes++; else fails++; };
const MSG = 'Loading terrain data (8.8 MB)...';
const T = '2026-12-01T00:00Z';
const PT = { lat: -88.8, lon: 124.6 };          // near Peak near Shackleton, inside the coarse DEM square
const VPS = [
  { name: 'laptop', w: 1366, h: 768 },
  { name: 'phone', w: 390, h: 844, mobile: true, dpr: 3 }
].filter(v => !ONLY || v.name === ONLY);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream', '.woff2': 'font/woff2' };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const p = path.normalize(path.join(ROOT, decodeURIComponent(q.url.split(/[?#]/)[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split(/[?#]/)[0])));
      if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
      fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(b); });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function newPage(browser, vp, opts) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: vp.dpr || 1 });
  const page = await ctx.newPage();
  const st = { errors: [], dem: [], demDone: 0 };
  page.on('console', m => { if (m.type() === 'error') st.errors.push(m.text()); });
  page.on('pageerror', e => st.errors.push('pageerror: ' + e.message));
  page.on('request', r => { if (/dem_coarse\.js/.test(r.url())) st.dem.push(Date.now()); });
  page.on('requestfinished', r => { if (/dem_coarse\.js/.test(r.url())) st.demDone = Date.now(); });
  await page.addInitScript(sd => {
    window.__t = {}; addEventListener('load', () => { window.__t.load = performance.now(); });
    if (sd) Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => ({ saveData: true, effectiveType: '4g' }) });
    // record every loader text shown, with time
    window.__msgs = [];
    const obs = () => new MutationObserver(() => { const l = document.getElementById('loader'); if (l && !l.hidden) { const t = l.textContent.trim(); if (window.__msgs[window.__msgs.length - 1] !== t) window.__msgs.push(t); } })
      .observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    if (document.documentElement) obs(); else document.addEventListener('DOMContentLoaded', obs);
  }, !!opts.saveData);
  if (opts.throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 3e6 / 8, uploadThroughput: 1e6 / 8 });
  }
  return { ctx, page, st };
}
const firstScreen = page => page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series && AsteriaApp.state.site && AsteriaApp.state.seriesSite === AsteriaApp.state.site && document.getElementById('verifiedCard').textContent.trim().length > 0, null, { timeout: 240000, polling: 50 });
const demStart = page => page.evaluate(() => { const e = performance.getEntriesByType('resource').find(x => /dem_coarse\.js/.test(x.name)); return e ? { start: e.startTime, end: e.responseEnd } : null; });
async function pickCustom(page) {
  await page.evaluate(p => { document.getElementById('customLat').value = p.lat; document.getElementById('customLon').value = p.lon; document.getElementById('customGo').click(); }, PT);
  await page.waitForFunction(() => AsteriaApp.state.site && !AsteriaApp.state.site.id && (AsteriaApp.state.site.hz || AsteriaApp.state.site.hzError) && AsteriaApp.state.seriesSite === AsteriaApp.state.site, null, { timeout: 240000 });
  await page.evaluate(() => AsteriaApp.ready()); await page.waitForTimeout(300);
}
const values = page => page.evaluate(() => ({ hz: JSON.stringify(AsteriaApp.state.site.hz), err: AsteriaApp.state.site.hzError || null, tiles: document.getElementById('statusTiles').innerText, card: document.getElementById('siteCard').innerText }));

async function legendCheck(page, tag) {
  const r = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.legend').forEach(lg => {
      if (!lg.getClientRects().length) return;
      lg.querySelectorAll('.lg').forEach(sw => {
        // the label is the next text: a text node or the next element sibling's text (walk in document order)
        const w = document.createTreeWalker(lg, NodeFilter.SHOW_TEXT); let n, after = false, tn = null;
        while ((n = w.nextNode())) { if (!after) { if (sw.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) after = true; else continue; } if (n.textContent.trim()) { tn = n; break; } }
        if (!tn) return;
        const off = tn.textContent.search(/\S/), rg = document.createRange(); rg.setStart(tn, off); rg.setEnd(tn, off + 1);
        const a = sw.getBoundingClientRect(), b = rg.getClientRects()[0];
        out.push({ legend: lg.closest('.panel') ? lg.closest('.panel').id : '?', label: tn.textContent.trim().slice(0, 24), gap: +(b.left - a.right).toFixed(2), overlap: a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom, dy: +((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2).toFixed(1), sw: [Math.round(a.width), Math.round(a.height)] });
      });
    });
    return out;
  });
  const sky = r.filter(x => x.legend === 'skyPanel');
  expect(`${tag} Sky view legend: Sun, Earth and terrain items measured (${sky.map(x => x.label + ' ' + x.gap + 'px').join(', ')})`, sky.length === 3, JSON.stringify(r));
  expect(`${tag} legends: no swatch box overlaps its label's text box (${r.length} items)`, r.length >= 3 && r.every(x => !x.overlap && x.gap > 0), JSON.stringify(r.filter(x => x.overlap || x.gap <= 0)));
  const gaps = r.map(x => x.gap);
  expect(`${tag} legends: same swatch-to-text gap within 2 px (${Math.min(...gaps)}-${Math.max(...gaps)} px), same swatch size, vertically centred within 2 px`, Math.max(...gaps) - Math.min(...gaps) <= 2 && r.every(x => x.sw[0] === r[0].sw[0] && x.sw[1] === r[0].sw[1] && Math.abs(x.dy) <= 2), JSON.stringify(r));
}

async function run(browser, base, vp) {
  const tag = `[${vp.name}]`, U = `${base}/index.html#t=${T}&w=14`;
  // A: with the preload, choose a custom point while the file is still downloading
  const A = await newPage(browser, vp, { throttle: true });
  const t0 = Date.now(); await A.page.goto(U); await firstScreen(A.page); const fsA = Date.now() - t0;
  await A.page.waitForFunction(() => window.__t.load !== undefined, null, { timeout: 240000 });
  const waitReq = Date.now(); while (!A.st.dem.length && Date.now() - waitReq < 30000) await A.page.waitForTimeout(100);
  const loadT = await A.page.evaluate(() => window.__t.load);
  expect(`${tag} preload: dem_coarse.js requested in the background after load (no click)`, A.st.dem.length === 1, A.st.dem.length);
  const busy = !A.st.demDone, tClick = Date.now();
  expect(`${tag} preload still downloading when the custom point is chosen (throttled)`, busy);
  await pickCustom(A.page);
  console.log(`  ${tag} download finished ${((A.st.demDone - A.st.dem[0]) / 1000).toFixed(1)} s after the preload request; custom point ready ${((Date.now() - tClick) / 1000).toFixed(1)} s after the click`);
  const dsA = await demStart(A.page), msgsA = await A.page.evaluate(() => window.__msgs);
  expect(`${tag} preload started after the load event (request at ${dsA && dsA.start.toFixed(0)} ms, load at ${loadT.toFixed(0)} ms)`, dsA && dsA.start >= loadT, JSON.stringify([dsA, loadT]));
  expect(`${tag} click during the preload reuses the in-flight load: dem_coarse.js requested exactly once`, A.st.dem.length === 1, A.st.dem.length);
  expect(`${tag} status "${MSG}" shown while waiting (shown: ${JSON.stringify(msgsA)})`, msgsA.includes(MSG), JSON.stringify(msgsA));
  expect(`${tag} status disappears after the load`, await A.page.evaluate(() => !AsteriaLoader.isShown()));
  const vA = await values(A.page);
  expect(`${tag} custom point got a terrain horizon`, vA.hz && vA.hz !== 'undefined' && !vA.err, JSON.stringify(vA).slice(0, 300));
  // a second custom point after the load: no message, no new request
  await A.page.evaluate(() => { window.__msgs = []; });
  await A.page.evaluate(p => { document.getElementById('customLat').value = p.lat + 0.01; document.getElementById('customLon').value = p.lon; document.getElementById('customGo').click(); }, PT);
  await A.page.waitForFunction(() => AsteriaApp.state.site && !AsteriaApp.state.site.id && Math.abs(AsteriaApp.state.site.lat - (-88.79)) < 1e-6 && AsteriaApp.state.seriesSite === AsteriaApp.state.site, null, { timeout: 120000 });
  expect(`${tag} next custom point: no loading message, still one request`, !(await A.page.evaluate(() => window.__msgs)).includes(MSG) && A.st.dem.length === 1);
  await legendCheck(A.page, tag);
  expect(`${tag} no console errors (preload run)`, A.st.errors.length === 0, A.st.errors.join(' | '));
  await A.ctx.close();

  // B: Save-Data: no preload; the first custom point loads it (and shows the message)
  const B = await newPage(browser, vp, { throttle: true, saveData: true });
  const t1 = Date.now(); await B.page.goto(U); await firstScreen(B.page); const fsB = Date.now() - t1;
  await B.page.waitForFunction(() => window.__t.load !== undefined, null, { timeout: 240000 }); await B.page.waitForTimeout(6000);
  expect(`${tag} saveData: preload skipped (no request 6 s after load)`, B.st.dem.length === 0, B.st.dem.length);
  expect(`${tag} first screen no later than without the preload (${fsA} ms with, ${fsB} ms without; allowance 15% + 500 ms for network noise)`, fsA <= fsB * 1.15 + 500, [fsA, fsB]);
  await pickCustom(B.page);
  const msgsB = await B.page.evaluate(() => window.__msgs);
  expect(`${tag} saveData: the first custom point loads the file once and shows "${MSG}"`, B.st.dem.length === 1 && msgsB.includes(MSG), JSON.stringify([B.st.dem.length, msgsB]));
  const vB = await values(B.page);
  expect(`${tag} custom-point horizon and status values identical with and without the preload`, vA.hz === vB.hz && vA.tiles === vB.tiles && vA.card === vB.card && vA.err === vB.err, JSON.stringify({ hz: vA.hz === vB.hz, tiles: [vA.tiles, vB.tiles], card: vA.card === vB.card }));
  expect(`${tag} no console errors (saveData run)`, B.st.errors.length === 0, B.st.errors.join(' | '));
  await B.ctx.close();

  // C: shared custom-point link, unthrottled: one request, horizon computed
  const C = await newPage(browser, vp, {});
  await C.page.goto(`${base}/index.html#lat=${PT.lat}&lon=${PT.lon}&t=${T}&w=14`);
  await C.page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.site && !AsteriaApp.state.site.id && AsteriaApp.state.site.hz && AsteriaApp.state.seriesSite === AsteriaApp.state.site, null, { timeout: 120000 });
  await C.page.waitForFunction(() => window.__t.load !== undefined, null, { timeout: 60000 }); await C.page.waitForTimeout(5000);
  const vC = await values(C.page);
  expect(`${tag} shared custom-point link: dem_coarse.js requested once (the preload reuses the load), same horizon`, C.st.dem.length === 1 && vC.hz === vA.hz, JSON.stringify([C.st.dem.length, vC.hz === vA.hz]));
  expect(`${tag} no console errors (shared link)`, C.st.errors.length === 0, C.st.errors.join(' | '));
  await C.ctx.close();
}

(async () => {
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  try { for (const vp of VPS) await run(browser, base, vp); }
  catch (e) { expect('exception', false, e.stack); }
  await browser.close(); srv.close();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
