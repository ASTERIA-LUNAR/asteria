#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Prompt 7C browser checks: the page scrolls on the Explore tab after the tour (owner report: after finishing the tour
 * and returning to Explore, wheel / touchpad / arrow keys no longer scrolled the page in Microsoft Edge).
 * Edge engine (Playwright channel "msedge") when installed, otherwise Chromium. Fresh profile per sequence.
 * Viewports: laptop 1366 x 768, laptop 1440 x 900, phone 390 x 844 (touch).
 *  1 The owner's sequence: tour run to its end with Next ... Finish (it ends on the Power tab), then the Compare tab,
 *    then Explore. Same after the tour is closed with Esc, with X, by choosing another tab, and after Getting started
 *    is completed with Done.
 *  2 Nothing of the guide stays behind: no spotlight, no extra bottom space, no step box, no dimming overlay, no
 *    overflow/height styles on html/body, focus not in the map (parked on the main content).
 *  3 A plain wheel over the map, over the side card / status tiles and over an empty page area scrolls the page; the
 *    map does not zoom and shows the short hint "Use Ctrl + scroll to zoom the map".
 *  4 Arrow Down, Page Down and Space scroll the page (focus where the sequence leaves it).
 *  5 Ctrl + wheel over the map zooms it (page does not move); after a click/drag into the map a plain wheel zooms
 *    and the arrow keys pan the map; after a click outside the map they scroll the page again.
 *  6 Unchanged: +/- buttons, "Show all", double-click zoom, drag to pan, touch pinch-zoom (phone, CDP pinch gesture)
 *    and one-finger drag (phone).
 *  7 No console errors.
 *   node tests/ui_scroll.js [--only l1366|l1440|phone] [--chromium] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only');
let fails = 0, passes = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? ' - ' + String(info).slice(0, 700) : '')); if (ok) passes++; else fails++; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const VPS = [
  { name: 'l1366', w: 1366, h: 768 },
  { name: 'l1440', w: 1440, h: 900 },
  { name: 'phone', w: 390, h: 844, mobile: true, dpr: 2 }
].filter(v => !ONLY || v.name === ONLY);

const ready = page => page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series && !AsteriaApp.state.computing, null, { timeout: 90000 }).then(() => page.evaluate(() => AsteriaApp.ready()));
const waitTour = page => page.waitForFunction(() => document.getElementById('tourText').textContent !== 'Working...', null, { timeout: 120000 });
const sY = page => page.evaluate(() => window.scrollY);
const zoom = page => page.evaluate(() => AsteriaMap.leaflet().getZoom());
const top0 = async page => { await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(250); };
// centre of an element's part inside the viewport (after scrolling to the top)
const spot = (page, sel) => page.evaluate(sel => {
  const e = document.querySelector(sel); if (!e) return null;
  const r = e.getBoundingClientRect(), t = Math.max(r.top, document.querySelector('.topbar').getBoundingClientRect().bottom + 4), b = Math.min(r.bottom, innerHeight - 4);
  if (b - t < 20) return null;
  return { x: Math.round((Math.max(r.left, 0) + Math.min(r.right, innerWidth)) / 2), y: Math.round(t + (b - t) / 2) };
}, sel);
// a point on the map clear of markers, labels and controls (after scrolling to the top)
const mapFree = page => page.evaluate(() => {
  const r = document.getElementById('lmap').getBoundingClientRect(), t = Math.max(r.top, document.querySelector('.topbar').getBoundingClientRect().bottom + 4), b = Math.min(r.bottom, innerHeight - 4);
  const ok = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest('#lmap') && !e.closest('.leaflet-marker-icon, .leaflet-control, .leaflet-tooltip, .leaflet-popup, .maplbl, .mapwheelhint'); };
  const cx = (r.left + r.right) / 2, cy = (t + b) / 2;
  for (let k = 0; k < 400; k++) {
    const a = k * 0.7, d = k * 3, x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.6);
    if (x > r.left + 60 && x < r.right - 60 && y > t + 40 && y < b - 40 && ok(x, y) && ok(x + 40, y + 30) && ok(x - 20, y - 20)) return { x, y };
  }
  return { x: Math.round(cx), y: Math.round(cy) };
});
const leftovers = page => page.evaluate(() => {
  const b = document.body, h = document.documentElement, cs = e => getComputedStyle(e), a = document.activeElement;
  const m = document.getElementById('lmap').getBoundingClientRect(), cx = m.left + m.width / 2, cy = Math.min(m.top + m.height / 2, innerHeight - 10);
  const hitEl = cy > 0 ? document.elementFromPoint(cx, cy) : null;
  return {
    guiding: b.classList.contains('guiding'), spotOn: b.classList.contains('spot-on'), hl: document.querySelectorAll('.tour-hl').length,
    tour: !document.getElementById('tour').hidden, hint: !document.getElementById('hint').hidden, spot: !document.getElementById('spot').hidden, intro: !!document.getElementById('intro'),
    ov: [cs(h).overflow, cs(b).overflow, cs(h).overflowY, cs(b).overflowY], inline: (h.getAttribute('style') || '') + (b.getAttribute('style') || ''),
    mainPb: parseFloat(cs(document.querySelector('main')).paddingBottom), vh: innerHeight,
    active: a ? a.tagName + (a.id ? '#' + a.id : '') + (a.className && typeof a.className === 'string' ? '.' + a.className.split(' ')[0] : '') : null,
    activeInMap: !!(a && a.closest && a.closest('#lmap')),
    mapHit: !!(hitEl && hitEl.closest('#lmap')), hitTag: hitEl ? hitEl.tagName + '.' + String(hitEl.className).slice(0, 30) : null
  };
});
const noLeftovers = L => !L.guiding && !L.spotOn && !L.hl && !L.tour && !L.hint && !L.spot && !L.intro && L.ov.every(v => v === 'visible') && !/overflow|height|padding/.test(L.inline) && L.mainPb < 0.3 * L.vh && !L.activeInMap && L.mapHit;

async function newPage(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr || 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
  await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE); await ready(page);
  await page.waitForSelector('#hint:not([hidden])', { timeout: 20000 });   // fresh profile: Getting started opens by itself
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

// the owner's inputs over the Explore tab; returns nothing, records PASS/FAIL
async function scrollChecks(page, vp, tag, full) {
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(`${tag}: page is taller than the window (scrollable)`, max > 200, max);
  const z0 = await zoom(page);
  const targets = [['map', '#lmap'], ['side card / status tiles', '#statusTiles'], ['empty page area (top bar)', '.topbar']];
  if (!vp.mobile) targets.splice(2, 0, ['side card text', '#siteCard h1']);
  for (const [name, sel] of targets) {
    await top0(page);
    let p = (sel === '#lmap' ? await mapFree(page) : await spot(page, sel)) || (sel === '.topbar' ? await page.evaluate(() => { const r = document.querySelector('.topbar').getBoundingClientRect(); return { x: Math.round(r.left + 4), y: Math.round(r.top + r.height / 2) }; }) : null);
    if (!p) {   // below the first screen (phone): bring it to the middle of the window first
      await page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); window.scrollTo(0, scrollY + r.top - innerHeight / 3); }, sel); await page.waitForTimeout(250);
      p = await spot(page, sel);
    }
    if (!p) { expect(`${tag}: wheel over ${name} (target in view)`, false, sel); continue; }
    const y0 = await sY(page);
    await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, 240); await page.waitForTimeout(550);
    const y = await sY(page), z = await zoom(page);
    expect(`${tag}: plain wheel over the ${name} scrolls the page, map zoom unchanged`, y > y0 + 100 && Math.abs(z - z0) < 1e-6, JSON.stringify({ y0, y, z, z0, at: p }));
    if (name === 'map') {
      const ws = await page.evaluate(() => AsteriaMap.wheelState());
      expect(`${tag}: plain wheel over the map shows the hint "${ws.text}"`, ws.hint && /^Use (Ctrl|Cmd) \+ scroll to zoom the map$/.test(ws.text) && !ws.active, JSON.stringify(ws));
      const hb = await page.evaluate(() => { const h = document.querySelector('.mapwheelhint').getBoundingClientRect(), m = document.getElementById('lmap').getBoundingClientRect(); return h.left >= m.left && h.right <= m.right && h.width > 50; });
      expect(`${tag}: the hint sits inside the map`, hb);
      await page.waitForTimeout(1800);
      expect(`${tag}: the hint is transient (gone after about 1.5 s)`, !(await page.evaluate(() => AsteriaMap.wheelState().hint)));
    }
  }
  // keyboard, focus where the sequence left it
  const act = await page.evaluate(() => { const a = document.activeElement; return a ? a.tagName + (a.id ? '#' + a.id : '') + '.' + String(a.className).split(' ')[0] : null; });
  for (const key of ['ArrowDown', 'PageDown']) {
    await top0(page); await page.keyboard.press(key); await page.waitForTimeout(450);
    const y = await sY(page);
    expect(`${tag}: ${key} scrolls the page (focus on ${act})`, y > 20, y);
  }
  // Space: on a focused button it presses the button (browser default), so check it with focus on the page content
  await top0(page);
  await page.evaluate(() => { const m = document.querySelector('main'); if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1'); m.focus({ preventScroll: true }); });
  await page.keyboard.press('Space'); await page.waitForTimeout(450);
  expect(`${tag}: Space scrolls the page (focus on the main content)`, (await sY(page)) > 100, await sY(page));
  if (!full) return;

  // Ctrl + wheel zooms the map, the page stays
  await top0(page);
  let p = await mapFree(page); await page.mouse.move(p.x, p.y);
  let z1 = await zoom(page);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -200); await page.keyboard.up('Control'); await page.waitForTimeout(700);
  let z2 = await zoom(page), y2 = await sY(page);
  expect(`${tag}: Ctrl + wheel over the map zooms the map, the page does not scroll`, z2 > z1 && y2 === 0, JSON.stringify({ z1, z2, y2 }));
  await page.keyboard.down('Control'); await page.mouse.wheel(0, 200); await page.keyboard.up('Control'); await page.waitForTimeout(700);
  expect(`${tag}: Ctrl + wheel down zooms out`, (await zoom(page)) < z2, await zoom(page));
  // click (drag) into the map: plain wheel zooms, arrows pan the map
  await top0(page); p = await mapFree(page);
  const c0 = await page.evaluate(() => AsteriaMap.leaflet().latLngToContainerPoint(AsteriaMap.leaflet().getCenter()) && AsteriaMap.leaflet().getCenter());
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 40, p.y + 30, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(600);
  const c1 = await page.evaluate(() => AsteriaMap.leaflet().getCenter());
  const ws = await page.evaluate(() => AsteriaMap.wheelState());
  expect(`${tag}: dragging pans the map and makes it active`, (Math.abs(c1.lat - c0.lat) + Math.abs(c1.lng - c0.lng)) > 1e-6 && ws.active, JSON.stringify({ c0, c1, ws }));
  z1 = await zoom(page); await page.mouse.wheel(0, -200); await page.waitForTimeout(700);
  expect(`${tag}: after a click into the map a plain wheel zooms it (page stays)`, (await zoom(page)) > z1 && (await sY(page)) === 0, JSON.stringify({ z1, z: await zoom(page), y: await sY(page) }));
  const focused = await page.evaluate(() => document.activeElement === AsteriaMap.leaflet().getContainer());
  const k0 = await page.evaluate(() => AsteriaMap.leaflet().getCenter());
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500);
  const k1 = await page.evaluate(() => AsteriaMap.leaflet().getCenter());
  expect(`${tag}: with the map focused, Arrow Down pans the map (page stays)`, focused && (Math.abs(k1.lat - k0.lat) + Math.abs(k1.lng - k0.lng)) > 1e-7 && (await sY(page)) === 0, JSON.stringify({ focused, k0, k1, y: await sY(page) }));
  // click outside the map (non-interactive text): wheel and keys go to the page again
  await page.evaluate(() => window.scrollTo(0, 0));
  const out = await page.evaluate(() => { const e = document.querySelector('#siteCard h1') || document.querySelector('.topbar'); const r = e.getBoundingClientRect(); return { x: Math.round(r.left + 6), y: Math.round(r.top + r.height / 2) }; });
  await page.mouse.click(out.x, out.y); await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ active: AsteriaMap.wheelState().active, mapFocus: document.activeElement === AsteriaMap.leaflet().getContainer() }));
  await top0(page); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(450);
  const yk = await sY(page);
  await top0(page); p = await mapFree(page); z1 = await zoom(page); await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, 240); await page.waitForTimeout(550);
  expect(`${tag}: after a click outside the map, Arrow Down and the wheel scroll the page again`, !after.active && !after.mapFocus && yk > 20 && (await sY(page)) > 100 && Math.abs((await zoom(page)) - z1) < 1e-6, JSON.stringify({ after, yk, y: await sY(page) }));
  // +/- buttons, Show all, double-click
  await top0(page);
  z1 = await zoom(page); await page.click('.leaflet-control-zoom-in'); await page.waitForTimeout(700);
  z2 = await zoom(page); await page.click('.leaflet-control-zoom-out'); await page.waitForTimeout(700);
  expect(`${tag}: + and - buttons zoom the map`, z2 > z1 && (await zoom(page)) < z2, JSON.stringify({ z1, z2, z3: await zoom(page) }));
  await page.click('#mapShowAll'); await page.waitForTimeout(900);
  expect(`${tag}: "Show all" shows the whole map extent`, Math.abs((await zoom(page)) - (await page.evaluate(() => AsteriaMap.leaflet().getMinZoom()))) < 1e-3, await page.evaluate(() => AsteriaMap.zooms()));
  await top0(page);
  if (!vp.mobile) {
    p = await mapFree(page); z1 = await zoom(page);
    await page.mouse.dblclick(p.x, p.y); await page.waitForTimeout(900);
    expect(`${tag}: double-click zooms the map in`, (await zoom(page)) > z1, JSON.stringify({ z1, z: await zoom(page) }));
    await ready(page);
  }
}

// phone: touch pinch-zoom and one-finger drag over the map are unchanged
async function touchChecks(page, tag) {
  await top0(page);
  const cdp = await page.context().newCDPSession(page);
  let p = await mapFree(page);
  const z1 = await zoom(page);
  await cdp.send('Input.synthesizePinchGesture', { x: p.x, y: p.y, scaleFactor: 2.5, relativeSpeed: 600, gestureSourceType: 'touch' });
  await page.waitForTimeout(900);
  const z2 = await zoom(page);
  expect(`${tag}: touch pinch zooms the map`, z2 > z1, JSON.stringify({ z1, z2 }));
  await top0(page); p = await mapFree(page);
  const c0 = await page.evaluate(() => AsteriaMap.leaflet().getCenter());
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await tp('touchStart', p.x, p.y);
  for (let i = 1; i <= 8; i++) { await tp('touchMove', p.x - 8 * i, p.y - 6 * i); await page.waitForTimeout(16); }
  await tp('touchEnd'); await page.waitForTimeout(700);
  const c1 = await page.evaluate(() => AsteriaMap.leaflet().getCenter());
  expect(`${tag}: one-finger drag over the map pans it`, (Math.abs(c1.lat - c0.lat) + Math.abs(c1.lng - c0.lng)) > 1e-6, JSON.stringify({ c0, c1 }));
  await cdp.detach();
}

async function afterSequence(page, vp, tag, errors, opts) {
  await page.click('.tab[data-page=compare]'); await page.waitForTimeout(700);
  await page.click('.tab[data-page=explorer]'); await page.waitForTimeout(1200);
  await ready(page);
  const L = await leftovers(page);
  expect(`${tag}: nothing of the guide left behind (spotlight, bottom space, step box, overlay, overflow), focus not in the map`, noLeftovers(L), JSON.stringify(L));
  await scrollChecks(page, vp, tag, opts.full);
  if (opts.full && vp.mobile) await touchChecks(page, tag);
  expect(`${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
}

async function run(browser, vp) {
  // 1 the owner's exact sequence: tour to the end (Finish), Compare, Explore
  {
    const { ctx, page, errors } = await newPage(browser, vp);
    const tag = `${vp.name} tour finished`;
    await page.click('#tourBtn'); await waitTour(page); await page.waitForTimeout(700);
    const n = await page.evaluate(() => AsteriaApp.tour.count);
    for (let i = 1; i < n; i++) { await page.click('#tourNext'); await waitTour(page); await page.waitForTimeout(700); }
    const last = await page.evaluate(() => ({ btn: document.getElementById('tourNext').textContent, tab: document.querySelector('.tab.active').dataset.page }));
    expect(`${tag}: the tour reached its last step (${last.tab} tab, "Finish")`, last.btn === 'Finish', JSON.stringify(last));
    await page.click('#tourNext'); await page.waitForTimeout(500);
    const f = await page.evaluate(() => { const a = document.activeElement; return { tag: a && a.tagName, inTour: !!(a && a.closest && a.closest('#tour')), guiding: document.body.classList.contains('guiding') }; });
    expect(`${tag}: after Finish focus is on the main content (not the hidden box, not the map) and the bottom space is gone`, f.tag === 'MAIN' && !f.inTour && !f.guiding, JSON.stringify(f));
    await afterSequence(page, vp, tag, errors, { full: true });
    await ctx.close();
  }
  // 2 the other ways out of the tour / Getting started
  const ways = [
    ['tour closed with Esc', async page => { await page.click('#tourBtn'); await waitTour(page); await page.waitForTimeout(500); await page.click('#tourNext'); await waitTour(page); await page.waitForTimeout(500); await page.keyboard.press('Escape'); }],
    ['tour closed with X', async page => { await page.click('#tourBtn'); await waitTour(page); await page.waitForTimeout(500); await page.click('#tourNext'); await waitTour(page); await page.waitForTimeout(500); await page.click('#tourClose'); }],
    ['tour ended by choosing a tab', async page => { await page.click('#tourBtn'); await waitTour(page); await page.waitForTimeout(500); await page.click('#tourNext'); await waitTour(page); await page.waitForTimeout(500);
      await page.click('.tab[data-page=about]'); await page.waitForTimeout(300);
      expect(`${vp.name} tour ended by choosing a tab: the step box closes`, await page.evaluate(() => document.getElementById('tour').hidden)); }],
    ['Getting started completed (Done)', async page => { const n = await page.evaluate(() => AsteriaApp.guide.hintCount); for (let i = 0; i < n; i++) { await page.click('#hintNext'); await page.waitForTimeout(900); } }],
    ['Getting started closed with X', async page => { await page.click('#hintNext'); await page.waitForTimeout(900); await page.click('#hintClose'); }]
  ];
  for (const [name, fn] of ways) {
    const { ctx, page, errors } = await newPage(browser, vp);
    await fn(page); await page.waitForTimeout(500);
    await afterSequence(page, vp, `${vp.name} ${name}`, errors, { full: false });
    await ctx.close();
  }
}

(async () => {
  let browser, engine = 'msedge';
  if (process.argv.includes('--chromium')) { browser = await chromium.launch(); engine = 'chromium'; }
  else { try { browser = await chromium.launch({ channel: 'msedge' }); } catch (e) { browser = await chromium.launch(); engine = 'chromium (msedge not installed)'; } }
  console.log('engine: ' + engine + ' ' + browser.version());
  for (const vp of VPS) await run(browser, vp);
  await browser.close();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
