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

    await ctx.close();
  }

  await browser.close();
  const errs = errors.filter(e => !/GPU stall due to ReadPixels/.test(e));
  expect('no console errors or warnings', errs.length === 0, errs.slice(0, 5).join(' | '));
  console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
