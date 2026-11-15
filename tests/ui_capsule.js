#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Prompt 9: Historical Capsule checks (laptop 1366 x 768 and phone 390 x 844, plus a reduced-motion pass).
 *  1 Nav button: after About, behind a divider, amber/orange fill, text contrast >= 4.5:1 on every gradient stop
 *    (normal and hover/open), soft glow, visible keyboard focus ring; the other tabs keep their size and the top bar
 *    its height (no wrap); Verified card still visible without scrolling at 1366 x 768; one light sweep (1 run,
 *    animation "capsweep"), none with prefers-reduced-motion.
 *  2 Nothing before the first open: no js/capsule.js request, no window.AsteriaCapsule, no overlay, no
 *    requestAnimationFrame from capsule.js.
 *  3 Opens on click; first frame < 1 s; autoplays in order; the speed sampled while playing is never 0; next,
 *    previous, chapter jump, pause/resume, Space, Left/Right, Esc and X work; focus stays inside while open.
 *  4 Captions: one data array (AsteriaCapsule.chapters) equals the milestone table in docs/HISTORICAL_CAPSULE.md
 *    (year, milestone, caption, every source URL); every chapter's caption is shown inside the viewport, at a
 *    readable size, never overlapping the controls, the banner or the top buttons; <= 20 words per sentence.
 *  5 Banner and Sources panel texts; the only AI wording inside the capsule is the exact credit line.
 *  6 Exit restores the app exactly (tab, map view, URL hash, scroll position, focus on the button, no overflow
 *    lock) and the page scrolls with the wheel and the keyboard afterwards; after closing no frame is drawn.
 *  7 End card: "Explore the south-pole landing sites" closes the capsule and opens Explore.
 *  8 Performance: >= 50 fps laptop, >= 30 fps phone (re-measured once if below; both numbers printed).
 *  9 No console errors. Screenshots: docs/capsule/ (with --shots).
 *   node tests/ui_capsule.js [--only laptop|phone|reduced] [--shots] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only'), SHOTS = process.argv.includes('--shots');
let fails = 0, passes = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && (!ok || process.env.VERBOSE) ? ' - ' + String(info).slice(0, 700) : '')); if (ok) passes++; else fails++; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const SHOTDIR = path.join(__dirname, '..', 'docs', 'capsule');
const CREDIT = 'Illustrations and animation are drawn by code written with Claude Code (Anthropic), an AI coding assistant; historical facts are from the sources listed.';
const BANNER = 'Historical illustrations - artistic, simplified, not to scale; not ASTERIA data';
const VPS = [
  { name: 'laptop', w: 1366, h: 768 },
  { name: 'phone', w: 390, h: 844, mobile: true, dpr: 3 },
  { name: 'reduced', w: 1366, h: 768, reduce: true }
].filter(v => !ONLY || v.name === ONLY);

// ---- docs table
function docRows() {
  const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'HISTORICAL_CAPSULE.md'), 'utf8');
  const a = md.indexOf('<!-- MILESTONES_START -->'), b = md.indexOf('<!-- MILESTONES_END -->');
  return md.slice(a, b).split('\n').filter(l => /^\|\s*\d+\s*\|/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
}
// ---- colour helpers
const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgbOf = s => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const stops = bgimg => (bgimg.match(/rgb\([^)]*\)/g) || []).map(rgbOf);

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  // the docs table matches the data array (checked once, from the data in the page)
  for (const vp of VPS) {
    const tag = `[${vp.name}]`;
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: vp.dpr || 1, reducedMotion: vp.reduce ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(() => {
      window.ASTERIA_V3D_NOPROBE = true;
      window.__capRaf = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = function (cb) { if (/capsule\.js/.test(new Error().stack || '')) window.__capRaf++; return raf(cb); };
    });
    const page = await ctx.newPage();
    const errors = [], requests = [];
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('request', r => requests.push(r.url()));
    await page.goto(BASE);
    await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series && !AsteriaApp.state.computing, null, { timeout: 90000 });
    await page.evaluate(() => AsteriaApp.ready());
    await page.waitForTimeout(400);

    // ---- 1 nav button
    const nav = await page.evaluate(() => {
      const b = document.getElementById('capsuleBtn'), tabs = [...document.querySelectorAll('nav.tabs > *')];
      const cs = getComputedStyle(b), af = getComputedStyle(b, '::after');
      const about = document.querySelector('.tab[data-page="about"]');
      return {
        order: tabs.map(e => e.id || e.className), afterAbout: about.nextElementSibling && about.nextElementSibling.classList.contains('capsep') && about.nextElementSibling.nextElementSibling === b,
        bg: cs.backgroundImage, color: cs.color, shadow: cs.boxShadow, radius: parseFloat(cs.borderTopLeftRadius), h: b.getBoundingClientRect().height,
        anim: af.animationName, iter: af.animationIterationCount, dur: af.animationDuration,
        notTab: !b.classList.contains('tab'), text: b.textContent.trim()
      };
    });
    expect(`${tag} nav: "Historical Capsule" after About, behind a divider, not a scientific tab`, nav.afterAbout && nav.notTab && nav.text === 'Historical Capsule', JSON.stringify(nav.order));
    const st = stops(nav.bg), fg = rgbOf(nav.color);
    const amber = st.length >= 2 && st.every(c => c[0] >= 230 && c[1] >= 140 && c[1] <= 220 && c[2] <= 120);
    const minC = Math.min.apply(null, st.map(c => contrast(c, fg)));
    expect(`${tag} nav: filled amber-to-orange gradient pill with a soft glow`, amber && nav.radius >= 12 && /rgba?\(255, 1[5-9]\d/.test(nav.shadow), nav.bg + ' | ' + nav.shadow);
    expect(`${tag} nav: text contrast >= 4.5:1 on every gradient stop (min ${minC.toFixed(2)})`, minC >= 4.5, nav.color);
    await page.hover('#capsuleBtn'); await page.waitForTimeout(300);
    const hov = await page.evaluate(() => getComputedStyle(document.getElementById('capsuleBtn')).backgroundImage);
    const hst = stops(hov), hMin = Math.min.apply(null, hst.map(c => contrast(c, fg)));
    expect(`${tag} nav: hover is darker/richer and keeps contrast >= 4.5:1 (min ${hMin.toFixed(2)})`, hov !== nav.bg && hMin >= 4.5 && lum(hst[1]) < lum(st[1]), hov);
    await page.mouse.move(2, vp.h - 2);
    if (vp.reduce) expect(`${tag} nav: no light sweep with reduced motion`, nav.anim === 'none' || /^0s/.test(nav.dur), nav.anim + ' ' + nav.dur);
    else expect(`${tag} nav: one light sweep after load (capsweep, 1 iteration, about 1 s)`, nav.anim === 'capsweep' && nav.iter === '1' && nav.dur === '1s', nav.anim + ' ' + nav.iter + ' ' + nav.dur);
    // focus ring (keyboard)
    await page.keyboard.press('Shift');
    await page.evaluate(() => document.getElementById('capsuleBtn').focus());
    await page.keyboard.press('Shift');
    const ring = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById('capsuleBtn')); return { s: cs.outlineStyle, w: parseFloat(cs.outlineWidth), c: cs.outlineColor, fv: document.getElementById('capsuleBtn').matches(':focus-visible') }; });
    expect(`${tag} nav: visible keyboard focus ring`, ring.fv && ring.s !== 'none' && ring.w >= 2, JSON.stringify(ring));
    await page.evaluate(() => document.activeElement.blur());
    // other tabs not squeezed, no extra row
    const lay = await page.evaluate(() => {
      const m = () => ({ tabs: [...document.querySelectorAll('.tab')].map(t => { const r = t.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.top)]; }), bar: Math.round(document.querySelector('.topbar').getBoundingClientRect().height) });
      const b = document.getElementById('capsuleBtn'), sp = document.querySelector('.capsep'), r = b.getBoundingClientRect();
      const a = m(); b.style.display = 'none'; sp.style.display = 'none'; const z = m(); b.style.display = ''; sp.style.display = '';
      const tabRow = [...document.querySelectorAll('.tab')].map(t => Math.round(t.getBoundingClientRect().top));
      return { a, z, btnTop: Math.round(r.top), tabRow };
    });
    const sameW = lay.a.tabs.every((t, i) => Math.abs(t[0] - lay.z.tabs[i][0]) <= 1);
    expect(`${tag} nav: other tabs keep their width, stay in one row, top bar height unchanged`, sameW && lay.a.bar === lay.z.bar && new Set(lay.tabRow).size === 1 && Math.abs(lay.btnTop - lay.tabRow[0]) <= 8, JSON.stringify(lay));
    if (vp.name === 'laptop') {
      const vc = await page.evaluate(() => { const r = document.getElementById('verifiedCard').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, ih: innerHeight }; });
      expect(`${tag} Explore first screen: Verified card visible without scrolling at 1366 x 768`, vc.bottom <= vc.ih && vc.top >= 0, JSON.stringify(vc));
    }
    if (SHOTS && !vp.reduce) {
      fs.mkdirSync(SHOTDIR, { recursive: true });
      if (vp.mobile) await page.evaluate(() => document.getElementById('capsuleBtn').scrollIntoView({ inline: 'end', block: 'nearest' }));
      await page.screenshot({ path: path.join(SHOTDIR, vp.name + '_1_nav_button.png'), clip: { x: 0, y: 0, width: vp.w, height: vp.mobile ? 240 : 200 } });
      if (vp.mobile) await page.evaluate(() => { document.querySelector('nav.tabs').scrollLeft = 0; window.scrollTo(0, 0); });
    }

    // ---- 2 nothing before the first open
    const pre = await page.evaluate(() => ({ mod: typeof window.AsteriaCapsule, el: !!document.getElementById('capsule'), raf: window.__capRaf }));
    expect(`${tag} closed: capsule.js not requested, not loaded, no overlay, no animation frames`, !requests.some(u => /capsule\.js/.test(u)) && pre.mod === 'undefined' && !pre.el && pre.raf === 0, JSON.stringify(pre));

    // state to restore
    if (!vp.mobile) await page.evaluate(() => window.scrollTo(0, 120));
    else await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => { const m = AsteriaMap.leaflet(); const c = m.getCenter(); return { hash: location.hash, tab: document.querySelector('.tab.active').dataset.page, y: Math.round(scrollY), c: [c.lat.toFixed(6), c.lng.toFixed(6)], z: m.getZoom() }; });

    // ---- 3 open, first frame, autoplay
    const t0 = Date.now();
    // a DOM click (Playwright's page.click would first scroll the button into view and change the position to restore)
    await page.evaluate(() => document.getElementById('capsuleBtn').click());
    await page.waitForFunction(() => window.AsteriaCapsule && AsteriaCapsule._state().frames >= 1, null, { timeout: 5000 });
    const first = Date.now() - t0;
    expect(`${tag} open: first frame ${first} ms after the click (< 1000 ms, includes loading capsule.js)`, first < 1000);
    const o = await page.evaluate(() => ({ st: AsteriaCapsule._state(), lock: getComputedStyle(document.documentElement).overflow, focusIn: document.getElementById('capsule').contains(document.activeElement), btnExp: document.getElementById('capsuleBtn').getAttribute('aria-expanded'), modal: document.getElementById('capsule').getAttribute('aria-modal') }));
    expect(`${tag} open: full-screen dialog over the app, playing from 1957, focus inside`, o.st.open && o.st.playing && o.st.chapter === 0 && o.focusIn && o.btnExp === 'true' && o.modal === 'true', JSON.stringify(o));
    expect(`${tag} open: app intact underneath (Explore page and map still in the DOM)`, await page.evaluate(() => !!document.getElementById('lmap') && document.getElementById('page-explorer').classList.contains('active') === (document.querySelector('.tab.active').dataset.page === 'explorer')));
    // sample playback for ~12 s: chapters in order, speed never 0
    const samp = await page.evaluate(async () => { const out = []; const t = performance.now(); while (performance.now() - t < 12000) { const s = AsteriaCapsule._state(); out.push([s.chapter, s.speed, s.u]); await new Promise(r => setTimeout(r, 50)); } return out; });
    const chs = samp.map(s => s[0]), sp = samp.slice(2).map(s => s[1]);
    const inOrder = chs.every((c, i) => !i || c === chs[i - 1] || c === chs[i - 1] + 1);
    expect(`${tag} autoplay: chapters advance in order (${[...new Set(chs)].join(',')})`, inOrder && chs[chs.length - 1] >= 2, chs.join(','));
    const minSp = Math.min.apply(null, sp), maxSp = Math.max.apply(null, sp);
    expect(`${tag} rhythm: speed never 0 while playing (min ${minSp.toFixed(3)}, max ${maxSp.toFixed(2)}), slows to about 25-30 % for the caption`, minSp > 0.1 && (vp.reduce ? true : minSp <= 0.3 && maxSp >= 1.0), '');
    // fps while playing
    const fps = async () => page.evaluate(async () => { const a = AsteriaCapsule._state().frames, t = performance.now(); await new Promise(r => setTimeout(r, 3000)); return (AsteriaCapsule._state().frames - a) / ((performance.now() - t) / 1000); });
    let f1 = await fps(), f2 = null; const need = vp.mobile ? 30 : 50;
    if (f1 < need) f2 = await fps();
    expect(`${tag} performance: ${f1.toFixed(1)} fps${f2 !== null ? ', re-measured ' + f2.toFixed(1) + ' fps' : ''} (>= ${need})`, Math.max(f1, f2 || 0) >= need);

    // ---- 4 captions: data == docs; each caption shown, inside, readable, not overlapping
    const data = await page.evaluate(() => AsteriaCapsule.chapters.map(c => ({ year: c.year, title: c.title, text: c.text, src: c.src.map(s => s[1]), flags: c.flags })));
    if (vp.name === VPS[0].name) {
      const rows = docRows();
      const okRows = rows.length === data.length && data.every((c, i) => rows[i][1] === c.year && rows[i][2] === c.title && rows[i][3] === c.text && c.src.every(u => rows[i][5].includes(u)));
      expect(`captions: AsteriaCapsule.chapters (${data.length}) equals the milestone table in docs/HISTORICAL_CAPSULE.md (${rows.length} rows)`, okRows, JSON.stringify(rows.map((r, i) => [r[1], r[2], data[i] && r[3] === data[i].text])));
      expect(`captions: chronological, 10-14 milestones, one sentence of at most 20 words each`, data.length >= 10 && data.length <= 14 && data.every((c, i) => !i || +c.year >= +data[i - 1].year) && data.every(c => c.text.split(/\s+/).length <= 20 && (c.text.match(/[.!?](\s|$)/g) || []).length === 1), data.map(c => c.text.split(/\s+/).length).join(','));
      expect(`captions: flags only from the allowed set (US, USSR, China, India, Japan, Canada)`, data.every(c => c.flags.length && c.flags.every(f => ['us', 'su', 'cn', 'in', 'jp', 'ca'].includes(f))));
    }
    const capBad = [];
    for (let k = 0; k < data.length; k++) {
      await page.evaluate(k => AsteriaCapsule._go(k), k);
      await page.waitForFunction(() => { const s = AsteriaCapsule._state(); return s.u > 1.75 / (1) && !s.transition; }, null, { timeout: 8000 });
      const c = await page.evaluate(() => {
        const R = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
        const cap = document.querySelector('.cap-caption'), ov = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
        const rc = R(cap), bar = R(document.querySelector('.cap-bar')), top = R(document.querySelector('.cap-top')), ban = R(document.querySelector('.cap-banner'));
        const fs = s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
        return { year: document.querySelector('.cap-year').textContent, title: document.querySelector('.cap-title').textContent, text: document.querySelector('.cap-text').textContent, chips: [...document.querySelectorAll('.cap-chip')].length,
          op: +getComputedStyle(cap).opacity, inside: rc.l >= 0 && rc.t >= 0 && rc.r <= innerWidth && rc.b <= innerHeight, overlap: ov(rc, bar) || ov(rc, top) || ov(rc, ban),
          fText: fs('.cap-text'), fTitle: fs('.cap-title'), fYear: fs('.cap-year'), fChip: fs('.cap-chip'), cur: document.querySelector('.cap-year-btn.on').textContent };
      });
      const d = data[k];
      if (!(c.year === d.year && c.title === d.title && c.text === d.text && c.chips === d.flags.length && c.op > 0.95 && c.inside && !c.overlap && c.fText >= 14 && c.fTitle >= 16 && c.fYear >= 32 && c.fChip >= 11 && c.cur === d.year)) capBad.push(d.year + ' ' + JSON.stringify(c));
      if (SHOTS && !vp.reduce && ((vp.mobile && [5, 10].includes(k)) || (!vp.mobile && [5, 9, 12].includes(k)))) await page.screenshot({ path: path.join(SHOTDIR, vp.name + '_2_chapter_' + d.year + '.png') });
    }
    expect(`${tag} captions: all ${data.length} shown from the data array, inside the viewport, readable (text >= 14 px), not overlapping controls/banner`, capBad.length === 0, capBad.join(' || '));

    // ---- controls
    const S = () => page.evaluate(() => AsteriaCapsule._state());
    await page.evaluate(() => AsteriaCapsule._go(4));
    await page.click('.cap-bar .cap-nav >> nth=1'); await page.waitForTimeout(150);   // next
    let s = await S(); const afterNext = s.chapter;
    await page.click('.cap-bar .cap-nav >> nth=0'); await page.waitForTimeout(150);   // previous
    s = await S(); const afterPrev = s.chapter;
    await page.click('.cap-year-btn >> nth=9'); await page.waitForTimeout(150);       // jump to 2019
    s = await S(); const afterJump = s.chapter;
    expect(`${tag} controls: next (5 -> 6), previous (-> 5), chapter strip jump (-> 2019)`, afterNext === 5 && afterPrev === 4 && afterJump === 9, [afterNext, afterPrev, afterJump].join(','));
    await page.click('.cap-play'); await page.waitForTimeout(250);
    const p1 = await S(); await page.waitForTimeout(500); const p2 = await S();
    await page.click('.cap-play'); await page.waitForTimeout(400); const p3 = await S();
    expect(`${tag} controls: pause stops time and drawing; resume continues`, !p1.playing && p1.u === p2.u && p1.frames === p2.frames && !p1.raf && p3.playing && p3.u > p2.u, JSON.stringify([p1, p2, p3].map(x => [x.playing, x.u.toFixed(2), x.frames])));
    await page.focus('.cap-play');
    await page.keyboard.press('Space'); await page.waitForTimeout(100); const k1 = await S();
    await page.keyboard.press('Space'); await page.waitForTimeout(100); const k2 = await S();
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100); const k3 = await S();
    await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(100); const k4 = await S();
    expect(`${tag} keyboard: Space pauses/resumes, Right/Left change milestone`, !k1.playing && k2.playing && k3.chapter === k2.chapter + 1 && k4.chapter === k2.chapter, [k1.playing, k2.playing, k2.chapter, k3.chapter, k4.chapter].join(','));
    // focus trap
    const trap = [];
    for (let i = 0; i < 30; i++) { await page.keyboard.press(i % 7 === 6 ? 'Shift+Tab' : 'Tab'); trap.push(await page.evaluate(() => document.getElementById('capsule').contains(document.activeElement))); }
    expect(`${tag} keyboard: focus stays inside the capsule (30 Tab / Shift+Tab presses)`, trap.every(Boolean));

    // ---- 5 banner and sources
    const txt = await page.evaluate(() => ({ banner: document.querySelector('.cap-banner').textContent, inView: (() => { const r = document.querySelector('.cap-banner').getBoundingClientRect(); return r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })() }));
    expect(`${tag} banner: "${BANNER}" permanently visible`, txt.banner === BANNER && txt.inView);
    await page.click('.cap-srcbtn'); await page.waitForTimeout(150);
    const src = await page.evaluate(() => { const p = document.getElementById('capSources'); return { vis: !p.hidden && p.getBoundingClientRect().height > 50, items: p.querySelectorAll('li').length, links: p.querySelectorAll('a[href^="https://"]').length, credit: p.querySelector('.cap-credit').textContent, playing: AsteriaCapsule._state().playing, all: document.getElementById('capsule').innerText }; });
    expect(`${tag} Sources (i): panel lists every milestone with https sources and the exact credit line`, src.vis && src.items === data.length && src.links >= data.length && src.credit === CREDIT, JSON.stringify({ items: src.items, links: src.links, credit: src.credit }));
    const ai = src.all.replace(CREDIT, '').match(/\bAI\b|Claude|Anthropic|artificial intelligence|generated|illustrated by/gi);
    expect(`${tag} AI wording in the capsule: only the exact credit line`, !ai, JSON.stringify(ai));
    if (SHOTS && vp.name === 'laptop') await page.screenshot({ path: path.join(SHOTDIR, 'laptop_3_sources.png') });
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    s = await S();
    expect(`${tag} Esc closes the Sources panel first (capsule stays open, playback resumes)`, s.open && s.playing && await page.evaluate(() => document.getElementById('capSources').hidden));

    // ---- 6 exit (Esc) restores everything
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const after = await page.evaluate(() => { const m = AsteriaMap.leaflet(); const c = m.getCenter(); return { open: AsteriaCapsule.isOpen(), hash: location.hash, tab: document.querySelector('.tab.active').dataset.page, y: Math.round(scrollY), c: [c.lat.toFixed(6), c.lng.toFixed(6)], z: m.getZoom(), focus: document.activeElement && document.activeElement.id, htmlOv: getComputedStyle(document.documentElement).overflow, bodyOv: getComputedStyle(document.body).overflow, cls: document.documentElement.className, inline: document.documentElement.getAttribute('style') || '' + (document.body.getAttribute('style') || ''), shown: !document.getElementById('capsule').hidden }; });
    expect(`${tag} Esc: closes; same tab, map view, URL hash and scroll position; focus back on the button; no scroll lock left`,
      !after.open && !after.shown && after.hash === before.hash && after.tab === before.tab && after.y === before.y && after.c.join() === before.c.join() && after.z === before.z && after.focus === 'capsuleBtn' && after.htmlOv !== 'hidden' && after.bodyOv !== 'hidden' && !/capsule/.test(after.cls) && !/overflow/.test(after.inline),
      JSON.stringify({ before, after }));
    const fr0 = await page.evaluate(() => [AsteriaCapsule._state().frames, window.__capRaf]); await page.waitForTimeout(1200);
    const fr1 = await page.evaluate(() => [AsteriaCapsule._state().frames, window.__capRaf, AsteriaCapsule._state().raf]);
    expect(`${tag} closed: nothing runs (no frames, no requestAnimationFrame from capsule.js for 1.2 s)`, fr0[0] === fr1[0] && fr0[1] === fr1[1] && !fr1[2], JSON.stringify([fr0, fr1]));
    // the page scrolls normally afterwards (wheel over the side card / tiles, then keyboard)
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
    const box = await page.evaluate(() => { const r = document.getElementById(innerWidth < 700 ? 'skyPanel' : 'statusTiles').getBoundingClientRect(); return { x: r.left + Math.min(40, r.width / 2), y: Math.min(innerHeight - 20, Math.max(20, r.top + 20)) }; });
    await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, 400); await page.waitForTimeout(500);
    const y1 = await page.evaluate(() => scrollY);
    await page.evaluate(() => { document.activeElement.blur(); });
    await page.keyboard.press('PageDown'); await page.waitForTimeout(500);
    const y2 = await page.evaluate(() => scrollY);
    expect(`${tag} after exit the page scrolls with the wheel (${y1}) and the keyboard (${y2})`, y1 > 50 && y2 > y1 + 50);

    // reopen, close with X
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#capsuleBtn'); await page.waitForTimeout(300);
    const ro = await S();
    expect(`${tag} reopens from 1957 and plays`, ro.open && ro.playing && ro.chapter === 0);
    await page.click('.cap-x'); await page.waitForTimeout(200);
    expect(`${tag} X closes the capsule and restores focus`, await page.evaluate(() => !AsteriaCapsule.isOpen() && document.activeElement.id === 'capsuleBtn' && getComputedStyle(document.body).overflow !== 'hidden'));

    // ---- 7 end card -> Explore (start from another tab)
    await page.click('.tab[data-page="about"]'); await page.waitForTimeout(200);
    await page.click('#capsuleBtn'); await page.waitForTimeout(200);
    await page.evaluate(n => AsteriaCapsule._go(n - 1), data.length);
    await page.waitForFunction(() => AsteriaCapsule._state().ended, null, { timeout: 10000 });
    const end = await page.evaluate(() => ({ t: document.querySelector('.cap-endtitle').textContent, b: document.querySelector('.cap-endbtn').textContent, sp: AsteriaCapsule._state().speed, playing: AsteriaCapsule._state().playing }));
    expect(`${tag} end card: "Next: humans return to the Moon" + "Explore the south-pole landing sites"; the scene keeps moving slowly`, end.t === 'Next: humans return to the Moon' && end.b === 'Explore the south-pole landing sites' && end.playing && end.sp > 0, JSON.stringify(end));
    if (SHOTS && !vp.reduce) await page.screenshot({ path: path.join(SHOTDIR, vp.name + '_4_end_card.png') });
    await page.click('.cap-endbtn'); await page.waitForTimeout(400);
    const ex = await page.evaluate(() => ({ open: AsteriaCapsule.isOpen(), tab: document.querySelector('.tab.active').dataset.page, ov: getComputedStyle(document.body).overflow, y: scrollY }));
    expect(`${tag} end card button closes the capsule and opens Explore`, !ex.open && ex.tab === 'explorer' && ex.ov !== 'hidden' && ex.y === 0, JSON.stringify(ex));

    if (vp.reduce) {
      await page.click('#capsuleBtn'); await page.waitForTimeout(400);
      const r = await S();
      const sp2 = await page.evaluate(async () => { const o = []; for (let i = 0; i < 60; i++) { o.push(AsteriaCapsule._state().speed); await new Promise(r => setTimeout(r, 50)); } return o; });
      expect(`${tag} reduced motion: detected, gentler speed (max ${Math.max.apply(null, sp2).toFixed(2)}), never 0 while playing, plain cross-fades`, r.reduce && r.playing && Math.min.apply(null, sp2.slice(2)) > 0 && Math.max.apply(null, sp2) <= 0.8);
      await page.keyboard.press('Escape');
    }
    expect(`${tag} no console errors or warnings`, errors.length === 0, errors.slice(0, 5).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
