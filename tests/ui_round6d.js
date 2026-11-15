#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6D browser checks (laptop and emulated phone):
 *  Part 1 - Mission requirements on the Compare page: verdicts follow from the displayed values exactly; the values
 *           equal the existing Compare / Power / slope values; "Can't assess" cases (custom point slope, invalid power
 *           inputs); requirement edits re-render without recomputing; the share link restores the requirements.
 *  Part 2 - Mission casefile (see the second block).
 *   node tests/ui_round6d.js [--shots] [--only laptop|phone] [--part 1|2] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url'), fs = require('fs');
const SHOTS = process.argv.includes('--shots'), OUT = path.join(__dirname, 'screenshots');
const arg = n => (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf(n));
const ONLY = arg('--only'), PART = arg('--part');
if (SHOTS) fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? ' - ' + info : '')); if (!ok) fails++; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const T0 = '2028-09-25T10:04';

async function load(page, hash) {
  await page.goto('about:blank');
  await page.goto(BASE + '#' + hash);
  await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
  await page.evaluate(() => AsteriaApp.ready());
}
// Compare table as text, by row label -> [cell texts]
const cmpTable = page => page.evaluate(() => {
  const o = {};
  document.querySelectorAll('#cmpResult tbody tr').forEach(tr => { const c = [...tr.children]; if (c[0].tagName === 'TD') o[c[0].textContent.trim()] = c.slice(1).map(td => td.textContent.replace(/\s+/g, ' ').trim()); });
  return o;
});

async function part1(page, tag) {
  await load(page, `site=peak_shackleton_lw&t=${T0}Z&w=30&tab=compare`);
  // scenarios: (1) default site, (2) +7 days (added by the page), (3) Mons Malapert (20 m tile), (4) custom smooth point
  await page.click('#cmpAdd'); await page.click('#cmpAdd');
  await page.selectOption('.scenario[data-k="2"] select[data-f=site]', 'mons_malapert');
  await page.selectOption('.scenario[data-k="3"] select[data-f=site]', '__custom');
  await page.fill('.scenario[data-k="3"] input[data-f=lat]', '-60'); await page.dispatchEvent('.scenario[data-k="3"] input[data-f=lat]', 'change');
  await page.fill('.scenario[data-k="3"] input[data-f=lon]', '0'); await page.dispatchEvent('.scenario[data-k="3"] input[data-f=lon]', 'change');
  const def = await page.evaluate(() => AsteriaApp.requirements());
  expect(`${tag} requirements block: 7 requirements, all ticked by default with example values; labelled "Example values - set your mission's"; collapsible`,
    Object.keys(def).length === 7 && Object.values(def).every(r => r.on) && await page.evaluate(() => /Example values - set your mission's/.test(document.getElementById('reqExample').textContent) && document.getElementById('reqBlock').tagName === 'DETAILS'), JSON.stringify(def));
  await page.evaluate(() => AsteriaApp.runCompare());
  await page.waitForFunction(() => document.querySelector('#cmpResult tr.reqsum'), null, { timeout: 180000 });
  let T = await cmpTable(page);
  const R = await page.evaluate(() => { const R = AsteriaApp.compareResults(); return R.map((r, k) => ({ id: r.s.id, st: r.st, e: r.energyWh, l: r.loadWh, sl: r.slope, m: AsteriaApp.cmpReqMetrics(k) })); });
  // values used by the requirements = the values of the Compare rows (raw equality)
  expect(`${tag} requirement inputs are the Compare values exactly (% sunlit, % Earth, % both, darkness, blackout, energy, load, slope) for all 4 scenarios`,
    R.every(r => r.m.pctSun === r.st.pctSun && r.m.pctEarth === r.st.pctEarth && r.m.pctBoth === r.st.pctBoth && r.m.longestDarkH === r.st.longestDarkH && r.m.longestBlackoutH === r.st.longestBlackoutH &&
      (r.m.power ? r.m.power.Wh === r.e && r.m.power.loadWh === r.l : r.e === null) && (r.m.slope === r.sl || (r.m.slope && r.sl && r.m.slope.slope === r.sl.slope))));
  // verdict cells: value shown = value in the existing row; verdict follows from that shown value
  const rows = { sun: ['Sunlit ≥ 50%', 'Sunlit', '>=', 50], earth: ['Earth link ≥ 50%', 'Earth link', '>=', 50], both: ['Both ≥ 30%', 'Sunlight + Earth link', '>=', 30] };
  let okVals = true, okVerd = true, detail = [];
  for (const k of Object.keys(rows)) {
    const [lbl, src, op, thr] = rows[k];
    (T[lbl] || []).forEach((cell, j) => {
      const m = cell.match(/^(Met|Not met) ([\d.]+)%/), shown = T[src][j];
      if (!m || shown !== m[2] + '%') { okVals = false; detail.push(k + j + ':' + cell + '|' + shown); return; }
      if ((m[1] === 'Met') !== (+m[2] >= thr)) { okVerd = false; detail.push(k + j + ' verdict'); }
    });
    if (!T[lbl]) { okVals = false; detail.push('missing ' + lbl); }
  }
  for (const [lbl, key] of [['Longest darkness ≤ 72 h', 'longestDarkH'], ['Longest Earth blackout ≤ 120 h', 'longestBlackoutH']]) {
    (T[lbl] || []).forEach((cell, j) => {
      const m = cell.match(/^(Met|Not met) ([\d.]+) h/);
      if (!m || m[2] !== R[j].st[key].toFixed(1)) { okVals = false; detail.push(lbl + j); return; }
      if ((m[1] === 'Met') !== (+m[2] <= (key === 'longestDarkH' ? 72 : 120))) okVerd = false;
    });
    if (!T[lbl]) { okVals = false; detail.push('missing ' + lbl); }
  }
  expect(`${tag} % and hour verdicts show the same value as the Compare rows (same precision) and follow from it`, okVals && okVerd, detail.join(', '));
  // energy: = Power page (Explore window, same settings) and verdict = the Power page's own rule
  const en = T['Energy balance produced ≥ needed'] || [];
  await page.evaluate(() => { document.getElementById('pwWindow').value = 'explorer'; });
  await page.evaluate(() => AsteriaApp.runPower());
  const pw = await page.evaluate(() => { const r = AsteriaApp.powerResults(); return { Wh: r.Wh, loadWh: r.loadWh, verdict: document.getElementById('pwVerdict').textContent }; });
  const kWh = x => (x / 1000).toFixed(x < 10000 ? 2 : 1) + ' kWh';
  expect(`${tag} energy requirement: scenario 1 energy and load equal the Power page exactly (${kWh(pw.Wh)} vs ${kWh(pw.loadWh)}); verdict = the Power page's "Energy positive/negative"; values printed in the cell`,
    R[0].e === pw.Wh && R[0].l === pw.loadWh && en.length === 4 && /^(Met|Not met) [+−]/.test(en[0]) && (en[0].startsWith('Met') === /Energy positive/.test(pw.verdict)) && en[0].includes(kWh(pw.Wh)) && en[0].includes(kWh(pw.loadWh)), JSON.stringify({ en0: en[0], pw }));
  // slope: = the Compare slope row; custom point -> Can't assess with a reason
  const sl = T['DEM slope at the site point ≤ 15°'] || [], slRow = T['DEM slope at the site point'];
  const slOK = [0, 1, 2].every(j => { const m = sl[j] && sl[j].match(/^(Met|Not met) ([\d.]+)°/); return m && slRow[j].startsWith(m[2] + '°') && (m[1] === 'Met') === (+m[2] <= 15); });
  expect(`${tag} slope requirement: the value equals the Compare slope row (5 m and 20 m grids) and the verdict follows; custom point: "Can't assess" with the reason`,
    slOK && /^Can't assess no terrain data for a custom point's slope/.test(sl[3] || '') && slRow[3] === '-', JSON.stringify({ sl, slRow }));
  const sum = T['Requirements met'] || [];
  expect(`${tag} neutral summary "N of M requirements met" per scenario, no score or ranking`, sum.length === 4 && sum.every(s => /^\d of 7 requirements met/.test(s)) && /\(1 can't assess\)/.test(sum[3]) &&
    !await page.evaluate(() => /score|rank|confidence|recommend/i.test(document.querySelector('#cmpResult tbody').textContent) || !!document.querySelector('#cmpResult tr.reqrow td.best, #cmpResult tr.reqsum td.best')), JSON.stringify(sum));
  // edits re-render without recomputing
  const before = await page.evaluate(() => AsteriaApp.compareResults());
  await page.uncheck('#reqGrid input[data-rk=both]');
  await page.fill('#reqGrid input[data-rv=sun]', '99.5'); await page.dispatchEvent('#reqGrid input[data-rv=sun]', 'change');
  T = await cmpTable(page);
  const same = await page.evaluate(b => AsteriaApp.compareResults() === b, before).catch(() => false);
  expect(`${tag} unticking a requirement removes its row; a new threshold re-judges the same values (no recompute)`, !T['Both ≥ 30%'] && T['Sunlit ≥ 99.5%'] && T['Sunlit ≥ 99.5%'].every((c, j) => c.startsWith(+T['Sunlit'][j].replace('%', '') >= 99.5 ? 'Met' : 'Not met')) && T['Requirements met'].every(s => / of 6 requirements met/.test(s)), JSON.stringify(T['Sunlit ≥ 99.5%']));
  // invalid power inputs -> Can't assess
  await page.evaluate(() => { document.getElementById('pwArea').value = '0'; });
  await page.evaluate(() => AsteriaApp.runCompare());
  await page.waitForFunction(() => document.querySelector('#cmpResult tr.reqsum'), null, { timeout: 180000 });
  T = await cmpTable(page);
  expect(`${tag} invalid Power page inputs: energy "Can't assess" with the reason, in every scenario`, (T['Energy balance produced ≥ needed'] || []).every(c => /^Can't assess Power page inputs are invalid/.test(c)), JSON.stringify(T['Energy balance produced ≥ needed']));
  await page.evaluate(() => { document.getElementById('pwArea').value = '1'; });
  // share link restores the requirements
  const hash = await page.evaluate(() => location.hash);
  const req1 = await page.evaluate(() => AsteriaApp.requirements());
  expect(`${tag} share link carries the requirements (${hash.match(/req=[^&]*/) && decodeURIComponent(hash.match(/req=[^&]*/)[0])})`, /req=/.test(hash) && !/both/.test(decodeURIComponent(hash.match(/req=[^&]*/)[0])));
  await load(page, hash.slice(1));
  const req2 = await page.evaluate(() => ({ R: AsteriaApp.requirements(), ui: [...document.querySelectorAll('#reqGrid input[data-rk]')].map(i => i.checked), sun: document.querySelector('#reqGrid input[data-rv=sun]').value }));
  expect(`${tag} opening the share link restores the requirements (ticks and thresholds)`, JSON.stringify(req2.R) === JSON.stringify(req1) && req2.ui.join() === 'true,true,false,true,true,true,true' && req2.sun === '99.5', JSON.stringify(req2));
  await load(page, `site=peak_shackleton_lw&t=${T0}Z&w=30&tab=compare`);
  expect(`${tag} a share link without requirements restores the example defaults`, JSON.stringify(await page.evaluate(() => AsteriaApp.requirements())) === JSON.stringify(def));
  if (SHOTS) await page.screenshot({ path: path.join(OUT, `r6d_${tag.slice(1, -1)}_requirements.png`), fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  for (const vp of [{ name: 'laptop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    if (ONLY && ONLY !== vp.name) continue;
    const tag = '[' + vp.name + ']';
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, acceptDownloads: true });
    await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.introSeen', '1'); } catch (e) { /* */ } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
    if (!PART || PART === '1') await part1(page, tag);
    if ((!PART || PART === '2') && typeof part2 === 'function') await part2(page, tag, ctx);
    expect(`${tag} no console errors or warnings`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
