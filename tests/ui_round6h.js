#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6H browser checks: laptop 1366 x 768, laptop 1440 x 900 and an emulated phone (390 x 844).
 *  1 Map extent: the first view fills the map box with data; zooming out reaches the WHOLE data square (minimum zoom =
 *    contain zoom); the "Show all" control fits it from any view; panning at the minimum zoom keeps it whole; at larger
 *    zooms panning never shows area outside the data (round 2b restriction) and an outside click shows the message.
 *  2 Markers: clickable box >= 32 px (laptop) / >= 40 px (phone), visual >= 16 px; labels do not overlap; markers sit
 *    above the custom point and the 3D-coverage outlines (outlines not interactive); a click inside a marker's box next
 *    to a custom point selects the site; a click just outside places a custom point; keyboard Enter selects.
 *  3 Explore first screen (laptops): map, Site Card essentials, status tiles and the full "Verified against NASA data"
 *    card inside the window without page scrolling; phone: map, then tiles, then the Verified card.
 *  4 Guided steps: every Getting-started step (4) and tour step (6): right tab, target highlighted, its top inside the
 *    viewport below the top bar and above the step box, and (most of) it visible; reduced motion scrolls instantly.
 *  5 No console errors.
 *   node tests/ui_round6h.js [--only l1366|l1440|phone] [--shots] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only'), SHOTS = process.argv.includes('--shots');
const OUT = path.join(__dirname, '..', 'docs', 'ui_round6h');
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? ' - ' + String(info).slice(0, 600) : '')); if (!ok) fails++; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const VPS = [
  { name: 'l1366', w: 1366, h: 768, laptop: true },
  { name: 'l1440', w: 1440, h: 900, laptop: true },
  { name: 'phone', w: 390, h: 844, mobile: true, dpr: 2 }
];
const ready = page => page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series && AsteriaApp.state.site && AsteriaApp.state.seriesSite === AsteriaApp.state.site, null, { timeout: 90000 }).then(() => page.evaluate(() => AsteriaApp.ready()));
const margins = page => page.evaluate(() => AsteriaMap.margins());
const whole = m => m.left >= -1.5 && m.top >= -1.5 && m.right >= -1.5 && m.bottom >= -1.5;           // whole square inside the box
const filled = m => m.left <= 1.5 && m.top <= 1.5 && m.right <= 1.5 && m.bottom <= 1.5;             // no area outside the data on screen

async function newCtx(browser, vp, opts) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr || 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, reducedMotion: (opts && opts.reduce) ? 'reduce' : 'no-preference' });
  const dismiss = !(opts && opts.fresh);
  await ctx.addInitScript(d => { window.ASTERIA_V3D_NOPROBE = true; try { if (d) localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.spotlightShown', '1'); localStorage.setItem('asteria.v3dQuality', 'low'); } catch (e) { } }, dismiss);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors };
}

async function mapChecks(page, vp, tag) {
  const m0 = await margins(page);
  expect(`${tag} map: first view filled with data (no area outside the data on screen)`, filled(m0), JSON.stringify(m0));
  for (let i = 0; i < 10; i++) { await page.evaluate(() => AsteriaMap.leaflet().zoomOut()); await page.waitForTimeout(260); }
  const z1 = await page.evaluate(() => AsteriaMap.zooms()), m1 = await margins(page);
  expect(`${tag} map: zooming out reaches the minimum zoom = the whole data square inside the map box`, Math.abs(z1.zoom - z1.contain) < 1e-6 && Math.abs(z1.min - z1.contain) < 1e-6 && whole(m1), JSON.stringify({ z1, m1 }));
  // drag at the minimum zoom: the square stays whole and centred (panning limited to the data)
  const box = await page.evaluate(() => { const r = document.getElementById('lmap').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.evaluate(() => AsteriaMap.leaflet().panBy([250, 180], { animate: false })); await page.waitForTimeout(300);
  const m2 = await margins(page), z2 = await page.evaluate(() => AsteriaMap.zooms());
  expect(`${tag} map: panning at the minimum zoom keeps the whole square in view (zoom not re-snapped)`, whole(m2) && Math.abs(z2.zoom - z2.contain) < 1e-6, JSON.stringify({ m2, z2 }));
  // at a larger zoom, panning far never shows area outside the data
  await page.evaluate(() => AsteriaMap.leaflet().setView([-85, 40], 4, { animate: false })); await page.waitForTimeout(200);
  await page.evaluate(() => AsteriaMap.leaflet().panBy([-5000, -5000], { animate: false })); await page.waitForTimeout(300);
  const m3 = await margins(page);
  expect(`${tag} map: at a larger zoom panning stays inside the data (no area outside it on screen)`, filled(m3), JSON.stringify(m3));
  // Show all control
  const ctl = await page.evaluate(() => { const a = document.getElementById('mapShowAll'), r = a && a.getBoundingClientRect(); return a && { title: a.title, w: r.width, h: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  expect(`${tag} map: "Show all" control present under the zoom buttons`, !!ctl && /Show all/.test(ctl.title) && ctl.w >= 26, JSON.stringify(ctl));
  await page.evaluate(() => document.getElementById('mapShowAll').scrollIntoView({ block: 'center' }));
  await page.click('#mapShowAll'); await page.waitForTimeout(900);
  const z4 = await page.evaluate(() => AsteriaMap.zooms()), m4 = await margins(page);
  expect(`${tag} map: "Show all" fits the whole data extent`, Math.abs(z4.zoom - z4.contain) < 1e-6 && whole(m4) && (Math.min(m4.left + m4.right, m4.top + m4.bottom) <= 3), JSON.stringify({ z4, m4 }));
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `map_showall_${tag}.png`) });
  // outside click (in the hatched strip at the minimum zoom) -> message, nothing selected
  const before = await page.evaluate(() => AsteriaApp.state.site.id);
  if (Math.max(m4.left, m4.top) > 6) {
    await page.evaluate(() => window.scrollTo(0, 0)); await page.evaluate(() => document.getElementById('lmap').scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
    const b2 = await page.evaluate(() => { const r = document.getElementById('lmap').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const px = m4.left > m4.top ? b2.x + Math.max(3, m4.left / 2) : b2.x + b2.w / 2, py = m4.left > m4.top ? b2.y + b2.h / 2 : b2.y + Math.max(3, m4.top / 2);
    await page.mouse.click(px, py); await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ id: AsteriaApp.state.site.id, note: !document.getElementById('mapNote').hidden, txt: document.getElementById('mapNote').textContent }));
    expect(`${tag} map: a click outside the data square selects nothing and shows the outside-data message`, after.id === before && after.note && /No elevation data here/.test(after.txt), JSON.stringify(after));
  }
  await page.evaluate(() => AsteriaMap.home(false));
}

async function markerChecks(page, vp, tag) {
  await page.evaluate(() => AsteriaMap.leaflet().setView([-84.2, 60.7], 6, { animate: false })); await page.waitForTimeout(400);   // Nobile Rim 2 (site DM2) alone on screen
  await page.evaluate(() => document.getElementById('lmap').scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
  const info = () => page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.mkmain').forEach(el => { const r = el.getBoundingClientRect(), v = el.querySelector('.mk').getBoundingClientRect(); out.push({ title: el.title, w: r.width, h: r.height, vw: v.width, vh: v.height, x: r.left + r.width / 2, y: r.top + r.height / 2, z: +el.style.zIndex }); });
    return out;
  });
  let mk = await info();
  const nob = mk.find(m => /Nobile Rim 2/.test(m.title));
  const minHit = vp.mobile ? 40 : 32;
  expect(`${tag} markers: clickable box >= ${minHit} px and visual >= 16 px`, mk.length > 0 && mk.every(m => m.w >= minHit && m.h >= minHit && Math.max(m.vw, m.vh) >= 16), JSON.stringify(mk.slice(0, 3)));
  // custom point just outside the marker's box (so both are on screen), then click inside the box near its edge
  const off = nob.w / 2 + 10;
  await page.mouse.click(nob.x + off, nob.y); await ready(page); await page.waitForTimeout(400);
  const cp = await page.evaluate(() => ({ id: AsteriaApp.state.site.id, pick: !!document.querySelector('.mkpickwrap') }));
  expect(`${tag} markers: a click just outside a site's box places a custom point (small crosshair drawn)`, cp.id === null && cp.pick, JSON.stringify(cp));
  mk = await info();
  const nob2 = mk.find(m => /Nobile Rim 2/.test(m.title));
  const z = await page.evaluate(() => { const p = document.querySelector('.mkpickwrap'), m = [...document.querySelectorAll('.mkmain')].find(e => /Nobile/.test(e.title)); return { pick: +p.style.zIndex, mk: +m.style.zIndex, pickPE: getComputedStyle(p).pointerEvents, pw: p.getBoundingClientRect().width }; });
  expect(`${tag} markers: site marker drawn above the custom point; custom point smaller and not clickable`, z.mk > z.pick && z.pw < nob2.w && !(await page.evaluate(() => document.querySelector('.mkpickwrap').classList.contains('leaflet-interactive'))), JSON.stringify(z));
  await page.mouse.click(nob2.x + nob2.w / 2 - 4, nob2.y + 2); await ready(page); await page.waitForTimeout(400);
  const sel = await page.evaluate(() => AsteriaApp.state.site.id);
  expect(`${tag} markers: a click inside the site's box near its edge (next to the custom point) selects the site`, sel === 'nobile_rim2_dm2', sel);
  // coverage outlines: never capture clicks; a marker on top of an outline line is selected
  await page.evaluate(() => AsteriaApp.selectSiteById('mons_mouton'));  await ready(page);
  const ps = await page.evaluate(() => { const s = window.LUNA_SITES.find(x => x.id === 'peak_shackleton'); return s; });
  let cov = null;
  for (const zz of [3, 3.5, 4, 2.5, 4.5, 5, 6, 7, 8]) {
  await page.evaluate(([s, zz]) => AsteriaMap.leaflet().setView([s.lat, s.lon], zz, { animate: false }), [ps, zz]); await page.waitForTimeout(350);
  cov = await page.evaluate(() => {
    const paths = [...document.querySelectorAll('path.cov3d')];
    const res = { n: paths.length, interactive: paths.filter(p => p.classList.contains('leaflet-interactive') || getComputedStyle(p).pointerEvents !== 'none').length };
    // a point on the nearest outline edge inside some marker's box: the topmost element there is the marker
    const m = AsteriaMap.leaflet(), mks = [...document.querySelectorAll('.mkmain')];
    let hit = null;
    for (const p of paths) {
      const len = p.getTotalLength();
      for (let t = 0; t < len && !hit; t += 2) {
        const pt = p.getPointAtLength(t), ctm = p.getScreenCTM(), x = pt.x * ctm.a + ctm.e, y = pt.y * ctm.d + ctm.f;
        for (const el of mks) { const r = el.getBoundingClientRect(); if (x > r.left + 2 && x < r.right - 2 && y > r.top + 2 && y < r.bottom - 2) { hit = { x, y, title: el.title }; break; } }
      }
      if (hit) break;
    }
    if (hit) { const top = document.elementFromPoint(hit.x, hit.y); hit.top = top && (top.closest('.mkmain') || {}).title; }
    void m; return Object.assign(res, { hit, zoom: m.getZoom() });
  });
  if (cov.hit) break;
  }
  expect(`${tag} outlines: 3D-coverage outlines drawn and not interactive`, cov.n === 16 && cov.interactive === 0, JSON.stringify(cov));
  if (cov.hit) {
    expect(`${tag} outlines: where an outline crosses a marker's box the marker is on top`, cov.hit.top === cov.hit.title, JSON.stringify(cov.hit));
    await page.mouse.click(cov.hit.x, cov.hit.y); await ready(page); await page.waitForTimeout(400);
    const s2 = await page.evaluate(() => ({ id: AsteriaApp.state.site.id, name: AsteriaApp.state.site.name, popup: !!document.querySelector('.leaflet-popup .grouppop') }));
    // a single marker selects its site; a group marker opens its list of sites; never a custom point
    expect(`${tag} outlines: clicking a marker on top of an outline selects the site / opens its group list (not a custom point)`, !!s2.id && (s2.popup || s2.name === cov.hit.title), JSON.stringify(s2));
    await page.evaluate(() => AsteriaMap.leaflet().closePopup());
  } else expect(`${tag} outlines: found an outline crossing a marker box to test`, false, JSON.stringify(cov));
  // Prompt 7D: the "N sites close together" popup buttons are readable: text / background contrast >= 4.5:1 (WCAG AA),
  // at rest and in the hover/focus style (keyboard focus on each button)
  const gp = await page.evaluate(async () => {
    const m = AsteriaMap.leaflet(); let mk = null;
    m.eachLayer(l => { if (!mk && l.getPopup && l.getPopup() && /grouppop/.test(String(l.getPopup().getContent()))) mk = l; });
    if (!mk) return { found: false };
    mk.openPopup(); await new Promise(r => setTimeout(r, 300));
    const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lum = s => { const v = s.match(/[\d.]+/g).map(Number); return 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const out = [];
    for (const b of document.querySelectorAll('.leaflet-popup .gp-i')) {
      const cs = getComputedStyle(b), rest = ratio(cs.color, cs.backgroundColor), border0 = cs.borderColor, bg0 = cs.backgroundColor;   // (live object: copy the values)
      b.focus(); await new Promise(r => setTimeout(r, 50)); const cf = getComputedStyle(b);
      out.push({ name: b.textContent, rest: +rest.toFixed(2), focus: +ratio(cf.color, cf.backgroundColor).toFixed(2), outline: cf.outlineStyle !== 'none' || cf.borderColor !== border0 || cf.backgroundColor !== bg0 });
      b.blur();
    }
    m.closePopup();
    return { found: true, buttons: out };
  });
  expect(`${tag} map: "sites close together" popup buttons have text contrast >= 4.5:1 at rest and on hover/focus, with a visible focus state`, gp.found && gp.buttons.length >= 2 && gp.buttons.every(b => b.rest >= 4.5 && b.focus >= 4.5 && b.outline), JSON.stringify(gp));
  // labels do not overlap (whole pole and zoomed)
  for (const view of ['home', 'z3']) {
    if (view === 'home') await page.evaluate(() => AsteriaMap.home(false)); else await page.evaluate(() => AsteriaMap.leaflet().setView([-87, 30], 3, { animate: false }));
    await page.waitForTimeout(400);
    const lab = await page.evaluate(() => {
      const L = [...document.querySelectorAll('.leaflet-tooltip.mklabel')].map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent, x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; });
      const M = [...document.querySelectorAll('.mkmain .mk')].map(e => { const r = e.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; });
      const ov = (a, b) => a.x0 < b.x1 - 0.5 && a.x1 > b.x0 + 0.5 && a.y0 < b.y1 - 0.5 && a.y1 > b.y0 + 0.5, bad = [];
      L.forEach((a, i) => { L.forEach((b, j) => { if (j > i && ov(a, b)) bad.push(a.t + ' x ' + b.t); }); M.forEach(m => { if (ov(a, m)) bad.push(a.t + ' x marker'); }); });
      return { n: L.length, bad, fs: L.length ? parseFloat(getComputedStyle(document.querySelector('.leaflet-tooltip.mklabel')).fontSize) : 0 };
    });
    expect(`${tag} labels (${view}): ${lab.n} labels, none overlapping another label or a marker, font >= 12 px`, lab.n >= (view === 'home' ? 2 : 1) && lab.bad.length === 0 && lab.fs >= 12, JSON.stringify(lab));
    if (SHOTS && view === 'home') await page.screenshot({ path: path.join(OUT, `markers_${tag}.png`) });
  }
  // keyboard: focus a marker and press Enter
  await page.evaluate(() => AsteriaMap.home(false)); await page.waitForTimeout(300);
  await page.evaluate(() => { const m = [...document.querySelectorAll('.mkmain')].find(e => /Mons Malapert/.test(e.title)); m.focus(); });
  await page.keyboard.press('Enter'); await ready(page); await page.waitForTimeout(300);
  const kb = await page.evaluate(() => AsteriaApp.state.site.id);
  expect(`${tag} markers: keyboard focus + Enter selects the site`, kb === 'mons_malapert', kb);
}

async function firstScreen(page, vp, tag) {
  await page.evaluate(() => AsteriaApp.selectSiteById('peak_shackleton_lw')); await ready(page);
  await page.evaluate(() => document.querySelector('.tab[data-page=explorer]').click());
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const g = id => { const e = typeof id === 'string' ? document.getElementById(id) : id, b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) }; };
    return { vh: innerHeight, vw: innerWidth, scrollY, map: g('lmap'), name: g('siteName'), pick: g('pickBtn'), deploy: g('deployRow'), start: g('startInput'), tiles: g('statusTiles'),
      sun: g('tileSun'), earth: g('tileEarth'), mission: g('tileMission'), verified: g('verifiedCard'), hero: g(document.querySelector('#page-explorer .hero')), docH: document.documentElement.scrollHeight,
      cardScroll: (() => { const c = document.getElementById('siteCard'); return c.scrollHeight - c.clientHeight; })() };
  });
  const inside = b => b.top >= 0 && b.bottom <= r.vh && b.h > 0;
  if (vp.laptop) {
    const ok = r.scrollY === 0 && ['map', 'name', 'pick', 'deploy', 'start', 'sun', 'earth', 'mission', 'verified'].every(k => inside(r[k])) && r.map.h >= 300 && r.cardScroll <= 1;
    expect(`${tag} Explore first screen: map, site selector, Site Card essentials, the three status tiles and the full Verified card inside ${vp.w}x${vp.h} without scrolling`, ok, JSON.stringify(r));
  } else {
    const ok = r.map.bottom <= r.tiles.top && r.tiles.bottom <= r.verified.top && r.verified.top - r.tiles.bottom < 400 && r.verified.bottom < 2.7 * r.vh;
    expect(`${tag} Explore (phone): map, then the status tiles, then the Verified card (near the top of the page)`, ok, JSON.stringify(r));
  }
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `after_explore_${tag}.png`) });
}

const waitTour = page => page.waitForFunction(() => !/Working/.test(document.getElementById('tourText').textContent), null, { timeout: 240000 });
function guideOk(st) { return st && st.highlighted && st.topVisible && st.visible >= Math.min(st.wanted, st.h) * 0.75 - 2; }

async function guideChecks(browser, vp, tag) {
  const { ctx, page, errors } = await newCtx(browser, vp, { fresh: true });
  await page.goto(BASE); await ready(page);
  await page.waitForSelector('#hint:not([hidden])', { timeout: 15000 });
  const n = await page.evaluate(() => AsteriaApp.guide.hintCount);
  const want = ['mapPanel', 'statusTiles', 'mapPanel', 'skyPanel'];
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));   // start far away
    await page.waitForTimeout(150);
    await page.evaluate(i => AsteriaApp.guide.hint(i), i); await page.waitForTimeout(1300);
    const st = await page.evaluate(() => AsteriaApp.guide.state());
    expect(`${tag} Getting started ${i + 1}/${n}: target ${want[i]} on the Explore tab, highlighted and in view`, st && st.id === want[i] && st.page === 'page-explorer' && guideOk(st), JSON.stringify(st));
    if (i === 2) {
      const cov = await page.evaluate(() => { const m = AsteriaMap.leaflet(), b = m.getBounds(), s = window.LUNA_SITES.find(x => x.id === 'peak_shackleton'); const pt = m.latLngToContainerPoint([s.lat, s.lon]), sz = m.getSize(); void b; return { zoom: m.getZoom(), contains: pt.x > 0 && pt.y > 0 && pt.x < sz.x && pt.y < sz.y, outlines: [...document.querySelectorAll('path.cov3d')].filter(p => { const r = p.getBoundingClientRect(), c = document.getElementById('lmap').getBoundingClientRect(); return r.right > c.left && r.left < c.right && r.bottom > c.top && r.top < c.bottom; }).length }; });
      expect(`${tag} Getting started 3: the map shows the blue 3D squares near Peak near Shackleton`, cov.contains && cov.zoom >= 5 && cov.outlines >= 2, JSON.stringify(cov));
      await page.evaluate(() => [...document.querySelectorAll('#hintActions button')].find(b => /^Take me there/.test(b.textContent)).click());
      await page.waitForFunction(() => AsteriaApp.state.site && !AsteriaApp.state.site.id && !document.getElementById('deployBtn').disabled, null, { timeout: 60000 });
      await page.waitForTimeout(1300);
      const st2 = await page.evaluate(() => AsteriaApp.guide.state());
      expect(`${tag} Getting started 3 "Take me there": custom point inside a 3D area, Deploy enabled, highlighted and in view`, st2 && st2.id === 'deployRow' && guideOk(st2), JSON.stringify(st2));
    }
  }
  // from another tab: a step brings the Explore tab back
  await page.evaluate(() => document.querySelector('.tab[data-page=about]').click()); await page.waitForTimeout(200);
  await page.evaluate(() => AsteriaApp.guide.hint(1)); await page.waitForTimeout(1200);
  const st3 = await page.evaluate(() => ({ s: AsteriaApp.guide.state(), tab: document.querySelector('.tab.active').dataset.page }));
  expect(`${tag} Getting started from the About tab: switches to Explore and shows the tiles`, st3.tab === 'explorer' && guideOk(st3.s), JSON.stringify(st3));
  await page.evaluate(() => document.getElementById('hintClose').click());
  // tour
  const tn = await page.evaluate(() => AsteriaApp.tour.count);
  const tw = [['mapPanel', 'explorer'], ['skyPanel', 'explorer'], ['earthPanel', 'explorer'], ['deployRow', 'explorer'], ['slipHeat', 'slip'], ['pwVerdict', 'power']];
  for (let i = 0; i < tn; i++) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(i => AsteriaApp.tour.show(i), i); await waitTour(page); await page.waitForTimeout(1400);
    const st = await page.evaluate(() => ({ s: AsteriaApp.guide.state(), tab: document.querySelector('.tab.active').dataset.page }));
    expect(`${tag} tour ${i + 1}/${tn}: ${tw[i][0]} on the ${tw[i][1]} tab, highlighted and in view`, st.s && st.s.id === tw[i][0] && st.tab === tw[i][1] && guideOk(st.s), JSON.stringify(st));
    if (SHOTS && (i === 0 || i === 3)) await page.screenshot({ path: path.join(OUT, `tour${i + 1}_${tag}.png`) });
  }
  await page.evaluate(() => document.getElementById('tourClose').click());
  expect(`${tag} guided steps: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
  // reduced motion: instant scroll
  const R = await newCtx(browser, vp, { fresh: true, reduce: true });
  await R.page.goto(BASE); await ready(R.page);
  await R.page.waitForSelector('#hint:not([hidden])', { timeout: 15000 });
  await R.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await R.page.evaluate(() => AsteriaApp.guide.hint(3)); await R.page.waitForTimeout(60);
  const rs = await R.page.evaluate(() => AsteriaApp.guide.state());
  expect(`${tag} reduced motion: the step's target is in view at once (no smooth scroll)`, guideOk(rs), JSON.stringify(rs));
  await R.ctx.close();
}

(async () => {
  if (SHOTS) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const vp of VPS) {
    if (ONLY && ONLY !== vp.name) continue;
    const tag = vp.name;
    const { ctx, page, errors } = await newCtx(browser, vp);
    await page.goto(BASE); await ready(page); await page.waitForTimeout(600);
    await firstScreen(page, vp, tag);
    await mapChecks(page, vp, tag);
    await markerChecks(page, vp, tag);
    expect(`${tag} map/markers/first screen: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
    await guideChecks(browser, vp, tag);
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
