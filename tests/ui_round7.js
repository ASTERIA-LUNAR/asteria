#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Prompt 7 step 0 browser checks: the compact "About this rover" button in the 3D view (top-left, below the
 * "Vertical scale ... (true scale)" badge), at laptop 1366 x 768, laptop 1440 x 900 and an emulated phone (390 x 844).
 *  1 Visible only in Rover mode (hidden in Orbit and Walk).
 *  2 It opens and closes the existing "About this rover" section of the panel (one copy of the text, same sources);
 *    the section is scrolled into view in the panel; with the panel hidden, the button shows it first;
 *    aria-expanded follows the section's open state (also when the section is toggled in the panel).
 *  3 No overlap with the scale badge (also 5x exaggeration, whose text is longer), the Sun-hidden banner and the tip
 *    (shown for the check), the shadow note, the feature/Sun/Earth/site/rover labels, the mini-map, the compass box,
 *    the close button or the round 6F "View mode" selector; the button is inside the 3D picture.
 *  4 No console errors.
 *   node tests/ui_round7.js [--only l1366|l1440|phone] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only');
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? ' - ' + String(info).slice(0, 600) : '')); if (!ok) fails++; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const VPS = [
  { name: 'l1366', w: 1366, h: 768 },
  { name: 'l1440', w: 1440, h: 900 },
  { name: 'phone', w: 390, h: 844, mobile: true, dpr: 2 }
].filter(v => !ONLY || v.name === ONLY);
const SITES = ['peak_shackleton', 'connecting_ridge'];
const ready = page => page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series && AsteriaApp.state.site && AsteriaApp.state.seriesSite === AsteriaApp.state.site, null, { timeout: 90000 }).then(() => page.evaluate(() => AsteriaApp.ready()));
const v3dReady = page => page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining && AsteriaView3D.debug().frames > 2, null, { timeout: 90000 }).then(() => page.waitForTimeout(700));

// geometry of the button and everything it must not overlap
const geom = page => page.evaluate(() => {
  const $ = id => document.getElementById(id);
  const vis = e => e && !e.hidden && e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
  const box = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const ov = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
  const btn = $('v3dAboutBtn'), stage = $('v3dStage');
  if (!vis(btn)) return { visible: false };
  const B = box(btn), S = box(stage), bad = [];
  const named = { badge: $('v3dExagBadge'), banner: $('v3dBanner'), tip: $('v3dTip'), qnote: $('v3dQNote'), shadownote: document.querySelector('.v3d-shadownote'), minimap: $('v3dMini'), compass: $('v3dHud'), close: $('v3dClose'), pad: $('v3dPad'), viewmode: document.querySelector('.v3d-modes'), inspect: $('v3dInspect') };
  const checked = [];
  for (const k in named) { const e = named[k]; if (!vis(e)) continue; checked.push(k); if (ov(B, box(e))) bad.push(k); }
  let nl = 0;
  document.querySelectorAll('.v3d-lbl').forEach(e => { if (!vis(e)) return; nl++; if (ov(B, box(e))) bad.push('label:' + e.textContent.trim()); });
  const badge = box($('v3dExagBadge'));
  return { visible: true, bad, checked, labels: nl, inStage: B.l >= S.l && B.r <= S.r && B.t >= S.t && B.b <= S.b, belowBadge: B.t >= badge.b, leftAligned: Math.abs(B.l - badge.l) <= 1, w: B.r - B.l, h: B.b - B.t };
});

async function run(browser, vp) {
  const tag = vp.name;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr || 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
  await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.spotlightShown', '1'); localStorage.setItem('asteria.v3dQuality', 'low'); } catch (e) { } });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  for (const site of SITES) {
    await page.goto('about:blank'); await page.goto(BASE + '#site=' + site); await ready(page);
    await page.evaluate(() => AsteriaApp.openDeploy()); await v3dReady(page);
    // 1 visibility per mode
    const vism = {};
    for (const m of ['orbit', 'walk', 'rover']) {
      await page.evaluate(m => document.querySelector('.seg button[data-mode="' + m + '"]').click(), m); await page.waitForTimeout(250);
      vism[m] = await page.evaluate(() => { const b = document.getElementById('v3dAboutBtn'); return !b.hidden && b.offsetParent !== null && b.getBoundingClientRect().width > 0; });
    }
    expect(`${tag} ${site}: button visible only in Rover mode`, !vism.orbit && !vism.walk && vism.rover, JSON.stringify(vism));
    const txt = await page.evaluate(() => document.getElementById('v3dAboutBtn').textContent.trim());
    expect(`${tag} ${site}: button text "About this rover"`, txt === 'About this rover', txt);
    // 3 no overlap (as drawn; then with the banner and tip shown; then with the 5x badge)
    await page.waitForTimeout(400);
    let g = await geom(page);
    expect(`${tag} ${site}: below the badge, left-aligned with it, inside the 3D picture, compact`, g.visible && g.belowBadge && g.leftAligned && g.inStage && g.h <= 40 && g.w <= 200, JSON.stringify(g));
    expect(`${tag} ${site}: no overlap with badge, notes, labels, mini-map, compass, View mode (Rover view)`, g.visible && g.bad.length === 0 && g.checked.includes('badge') && g.checked.includes('minimap') && g.checked.includes('compass') && g.checked.includes('shadownote') && g.checked.includes('viewmode'), JSON.stringify(g));
    const ll = await page.evaluate(() => { const L = AsteriaView3D.debug().labelLayout; return L && L.obstacles.length; });
    expect(`${tag} ${site}: button is an obstacle for the 3D label layout`, await page.evaluate(() => { const L = AsteriaView3D.debug().labelLayout, b = document.getElementById('v3dAboutBtn').getBoundingClientRect(), s = document.getElementById('v3dStage').getBoundingClientRect(); return !!L && L.obstacles.some(o => Math.abs(o.l - (b.left - s.left)) < 1 && Math.abs(o.t - (b.top - s.top)) < 1); }), ll);
    await page.evaluate(() => {
      const b = document.getElementById('v3dBanner'), t = document.getElementById('v3dTip');
      window.__msgs = { bh: b.hidden, bt: b.textContent, th: t.hidden };
      b.hidden = false; b.textContent = 'At the site marker the Sun is hidden behind terrain (validated horizon model, Sun +0.5° vs horizon +1.2°). Terrain more than 16 km away casts no shadows in this view, so parts of the ground may still look lit.'; t.hidden = false;
    });
    await page.waitForTimeout(300);
    g = await geom(page);
    expect(`${tag} ${site}: no overlap with the Sun-hidden banner and the tip when shown`, g.visible && g.bad.length === 0 && g.checked.includes('banner') && g.checked.includes('tip'), JSON.stringify(g));
    await page.evaluate(() => { const b = document.getElementById('v3dBanner'), t = document.getElementById('v3dTip'); b.hidden = window.__msgs.bh; b.textContent = window.__msgs.bt; t.hidden = window.__msgs.th; });
    await page.evaluate(() => { const s = document.getElementById('v3dExag'); s.value = '5'; s.dispatchEvent(new Event('change')); });
    await page.waitForTimeout(600);
    g = await geom(page);
    expect(`${tag} ${site}: no overlap with the longer 5x exaggeration badge`, g.visible && g.bad.length === 0 && g.belowBadge, JSON.stringify(g));
    await page.evaluate(() => { const s = document.getElementById('v3dExag'); s.value = '1'; s.dispatchEvent(new Event('change')); });
    await page.waitForTimeout(400);
    // 2 opens the existing content
    const c0 = await page.evaluate(() => ({ n: document.querySelectorAll('details.v3d-about').length, inPanel: !!document.querySelector('#v3dPanel #v3dAboutRover'), ctrl: document.getElementById('v3dAboutBtn').getAttribute('aria-controls'), open: document.getElementById('v3dAboutRover').open, exp: document.getElementById('v3dAboutBtn').getAttribute('aria-expanded'), html: document.getElementById('v3dAboutRover').innerHTML }));
    expect(`${tag} ${site}: one "About this rover" section (in the panel), button controls it, closed at start`, c0.n === 1 && c0.inPanel && c0.ctrl === 'v3dAboutRover' && !c0.open && c0.exp === 'false', JSON.stringify(Object.assign({}, c0, { html: undefined })));
    await page.click('#v3dAboutBtn'); await page.waitForTimeout(300);
    const c1 = await page.evaluate(() => {
      const d = document.getElementById('v3dAboutRover'), p = document.getElementById('v3dPanel').getBoundingClientRect(), r = d.getBoundingClientRect();
      return { open: d.open, exp: document.getElementById('v3dAboutBtn').getAttribute('aria-expanded'), html: d.innerHTML, topVisible: r.top >= p.top - 1 && r.top < p.bottom - 20 && r.top < innerHeight - 20, links: [...d.querySelectorAll('a')].map(a => a.href), n: document.querySelectorAll('details.v3d-about').length };
    });
    expect(`${tag} ${site}: click opens the same section (same text and sources), scrolled into view in the panel`, c1.open && c1.exp === 'true' && c1.html === c0.html && c1.topVisible && c1.n === 1 && c1.links.some(h => /science\.nasa\.gov\/mission\/viper/.test(h)), JSON.stringify(Object.assign({}, c1, { html: c1.html.length })));
    await page.click('#v3dAboutBtn'); await page.waitForTimeout(200);
    const c2 = await page.evaluate(() => ({ open: document.getElementById('v3dAboutRover').open, exp: document.getElementById('v3dAboutBtn').getAttribute('aria-expanded') }));
    expect(`${tag} ${site}: second click closes it`, !c2.open && c2.exp === 'false', JSON.stringify(c2));
    await page.evaluate(() => document.querySelector('#v3dAboutRover summary').click()); await page.waitForTimeout(200);
    const c3 = await page.evaluate(() => document.getElementById('v3dAboutBtn').getAttribute('aria-expanded'));
    await page.evaluate(() => document.querySelector('#v3dAboutRover summary').click()); await page.waitForTimeout(200);
    expect(`${tag} ${site}: aria-expanded follows the section when toggled in the panel`, c3 === 'true', c3);
    // panel hidden: the button shows the panel and opens the section
    await page.click('#v3dToggle'); await page.waitForTimeout(300);
    const hid = await page.evaluate(() => document.getElementById('v3dBody').hidden);
    await page.click('#v3dAboutBtn'); await page.waitForTimeout(400);
    const c4 = await page.evaluate(() => { const d = document.getElementById('v3dAboutRover'), r = d.getBoundingClientRect(); return { body: !document.getElementById('v3dBody').hidden, open: d.open, onScreen: r.top >= 0 && r.top < innerHeight - 20 }; });
    expect(`${tag} ${site}: with the panel hidden, the button shows the panel and opens the section`, hid && c4.body && c4.open && c4.onScreen, JSON.stringify(c4));
    await page.click('#v3dAboutBtn'); await page.waitForTimeout(200);
    g = await geom(page);
    expect(`${tag} ${site}: no overlap after the panel was shown again`, g.visible && g.bad.length === 0, JSON.stringify(g));
    // keyboard
    await page.focus('#v3dAboutBtn'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    const kb = await page.evaluate(() => document.getElementById('v3dAboutRover').open);
    await page.focus('#v3dAboutBtn'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    expect(`${tag} ${site}: keyboard Enter on the button opens the section`, kb, kb);
    // back to Orbit: hidden again
    await page.evaluate(() => document.querySelector('.seg button[data-mode="orbit"]').click()); await page.waitForTimeout(200);
    expect(`${tag} ${site}: hidden again in Orbit`, await page.evaluate(() => document.getElementById('v3dAboutBtn').hidden));
    await page.evaluate(() => AsteriaView3D.close()); await page.waitForTimeout(200);
  }
  expect(`${tag} no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  for (const vp of VPS) await run(browser, vp);
  await browser.close();
  console.log(fails ? `FAILED: ${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
