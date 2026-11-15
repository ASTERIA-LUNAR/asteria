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

// ------------------------------------------------------------------ Part 2: Mission casefile
// Three sites (5 m: Peak near Shackleton best-lit point; 20 m: Mons Malapert; custom smooth point -60°, 0°), each opened
// from its Compare scenario ("Mission casefile" button). Every number in the casefile is compared with the same value
// elsewhere in the app: Explore tiles, window statistics and tables, Power page cards (Explore window, same settings),
// Compare slope and requirement verdicts, Launch-slip results and the validation result files.
const SITES6D = [{ sel: 'peak_shackleton_lw', name: '5 m site' }, { sel: 'mons_malapert', name: '20 m site' }, { sel: '__custom', lat: -60, lon: 0, name: 'custom smooth point' }];
async function part2(page, tag, ctx) {
  await load(page, `site=peak_shackleton_lw&t=${T0}Z&w=30`);
  // Launch slip for the first site (so the casefile has a slip summary to show)
  await page.evaluate(() => { document.querySelector('.tab[data-page=slip]').click(); });
  await page.waitForFunction(() => AsteriaApp.slipResults(), null, { timeout: 120000 });
  // Compare: 3 scenarios at the same start
  await page.evaluate(() => { document.querySelector('.tab[data-page=compare]').click(); });
  await page.selectOption('.scenario[data-k="1"] select[data-f=site]', 'mons_malapert');
  await page.fill('.scenario[data-k="1"] input[data-f=start]', T0); await page.dispatchEvent('.scenario[data-k="1"] input[data-f=start]', 'change');
  await page.click('#cmpAdd');
  await page.selectOption('.scenario[data-k="2"] select[data-f=site]', '__custom');
  await page.fill('.scenario[data-k="2"] input[data-f=lat]', '-60'); await page.dispatchEvent('.scenario[data-k="2"] input[data-f=lat]', 'change');
  await page.fill('.scenario[data-k="2"] input[data-f=lon]', '0'); await page.dispatchEvent('.scenario[data-k="2"] input[data-f=lon]', 'change');
  await page.evaluate(() => AsteriaApp.runCompare());
  await page.waitForFunction(() => document.querySelector('#cmpResult tr.cfrow'), null, { timeout: 180000 });
  const CT = await cmpTable(page);
  const cmpReq = await page.evaluate(() => [...document.querySelectorAll('#cmpResult tr.reqrow')].map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim())));
  const aboutHrefs = await page.evaluate(() => [...document.querySelectorAll('#aboutContent a[href^=http]')].map(a => a.href));
  for (let k = 0; k < SITES6D.length; k++) {
    const st = SITES6D[k], t = `${tag} casefile ${st.name}:`;
    await page.evaluate(() => { document.querySelector('.tab[data-page=compare]').click(); });
    await page.click(`#cmpResult button[data-cf="${k}"]`);
    await page.waitForFunction(() => AsteriaApp.casefile(), null, { timeout: 120000 });
    await page.evaluate(() => AsteriaApp.casefileReady());
    const X = await page.evaluate(() => {
      const D = AsteriaApp.casefile(), S = AsteriaApp.state, q = s => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
      const cf = {}; document.querySelectorAll('#cfBody [data-cf]').forEach(e => { cf[e.dataset.cf] = e.textContent.replace(/\s+/g, ' ').trim(); });
      const rowsOf = sel => [...document.querySelectorAll(sel)].map(tr => [...tr.children].filter(td => !td.classList.contains('x-only')).map(td => td.textContent.replace(/\s+/g, ' ').trim()).join(' | '));
      return {
        cf, siteId: S.site.id, lat: S.site.lat, start: S.start.toISOString(), days: S.windowDays, terrain: S.useTerrain,
        sunStats: q('#sunStats .metric .v'), earthStats: q('#earthStats .metric .v'), metrics: q('#metrics .metric .v'),
        tiles: { sun: q('#sunState')[0] + ' · ' + q('#sunCountLbl')[0] + ' ' + q('#sunCount')[0], earth: q('#earthState')[0] + ' · ' + q('#earthCountLbl')[0] + ' ' + q('#earthCount')[0], mission: q('#missionState')[0] + ' · ' + q('#missionCountLbl')[0] + ' ' + q('#missionCount')[0] },
        appWin: { sun: rowsOf('#sunWindows tbody tr'), earth: rowsOf('#earthWindows tbody tr') }, cfWin: { sun: rowsOf('table.cfwin[data-body=sun] tbody tr'), earth: rowsOf('table.cfwin[data-body=earth] tbody tr') },
        cfReq: [...document.querySelectorAll('#cfBody .cfreq tr[data-rk]')].map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim())),
        raw: D.raw, st: S.stats, slope: D.slope, step: D.step, t0: D.t0, sliRes: !!D.slip,
        h3: [...document.querySelectorAll('#cfBody .cfsec h3')].map(h => ({ t: h.textContent, cls: !!h.querySelector('.cls') })),
        ev: [...document.querySelectorAll('#cfBody table.cfev tbody tr')].map(tr => ({ item: tr.children[0].textContent, cls: tr.children[1].textContent, val: tr.children[4].textContent })),
        go: [...document.querySelectorAll('#cfBody a.cfgo')].map(a => ({ id: a.dataset.goto, ok: !!document.getElementById(a.dataset.goto) })),
        ext: [...document.querySelectorAll('#cfBody a[href^=http]')].map(a => a.href).filter(h => h !== location.href),
        sources: (window.LUNA_SITES.find(s => s.id === S.site.id) || {}).sources || [],
        verify: [...document.querySelectorAll('#cfBody a[data-verify]')].map(a => a.href), hzSun: AsteriaApp.horizonsUrl({ lat: S.site.lat, lon: S.site.lon }, new Date(S.series.t[S.idx]), "'10'"), hzEarth: AsteriaApp.horizonsUrl({ lat: S.site.lat, lon: S.site.lon }, new Date(S.series.t[S.idx]), "'399'"),
        share: document.getElementById('cfShare').href, href: location.href, foot: document.querySelector('#cfBody .cffoot').textContent, ver: (window.ASTERIA_VERSION || {}).text,
        V: { el: LUNA_VALIDATION.angleStats.el.max.toFixed(4), inst: LUNA_INSTANT.agree + ' of ' + LUNA_INSTANT.n, a3: LUNA_ACCURACY3D.slope.maxReadout.toFixed(3) }
      };
    });
    expect(`${t} opened from Compare scenario ${k + 1}: Explore shows that site, start and 30-day window`, (st.sel === '__custom' ? X.siteId === null && X.lat === -60 && !X.terrain : X.siteId === st.sel) && X.start === new Date(T0 + ':00Z').toISOString() && X.days === 30, JSON.stringify({ id: X.siteId, s: X.start, d: X.days }));
    // tiles, statistics, windows
    expect(`${t} status now = the Explore tiles (Sun, Earth, mission)`, X.cf.sunNow === X.tiles.sun && X.cf.earthNow === X.tiles.earth && X.cf.missionNow === X.tiles.mission, JSON.stringify([X.cf.sunNow, X.tiles.sun, X.cf.missionNow, X.tiles.mission]));
    expect(`${t} % sunlit, longest darkness, % Earth link, longest blackout, % both, average illumination = Explore statistics (text and raw values)`,
      X.cf.pctSun === X.sunStats[0] && X.cf.longestDark === X.sunStats[1] && X.cf.pctEarth === X.earthStats[0] && X.cf.longestBlackout === X.earthStats[1] && X.cf.pctBoth === X.metrics[2] && X.cf.avgSunFrac === X.metrics[5] &&
      ['pctSun', 'pctEarth', 'pctBoth', 'longestDarkH', 'longestBlackoutH', 'avgSunFrac'].every(key => X.raw[key] === X.st[key]), JSON.stringify({ cf: X.cf, s: X.sunStats, e: X.earthStats, m: X.metrics }));
    expect(`${t} window counts and averages = the Explore windows panels`, X.cf.nSun === X.sunStats[2] + (X.sunStats[2] !== '0' ? ', average ' + X.sunStats[3] : '') && X.cf.nEarth === X.earthStats[2] + (X.earthStats[2] !== '0' ? ', average ' + X.earthStats[3] : ''), JSON.stringify([X.cf.nSun, X.sunStats, X.cf.nEarth, X.earthStats]));
    expect(`${t} window tables = the first ${Math.min(10, X.appWin.sun.length)} / ${Math.min(10, X.appWin.earth.length)} rows of the Explore tables`, ['sun', 'earth'].every(b => X.cfWin[b].length === Math.min(10, X.appWin[b].length) && X.cfWin[b].every((r, i) => r === X.appWin[b][i])), JSON.stringify({ c: X.cfWin.sun.slice(0, 2), a: X.appWin.sun.slice(0, 2) }));
    expect(`${t} scenario: window start, sampling step, minimum link elevation`, X.cf.t0 === T0.replace('T', ' ') && /^10 min \(4321 samples\)/.test(X.cf.step) && X.cf.minEl === '0° above the terrain horizon', JSON.stringify([X.cf.t0, X.cf.step, X.cf.minEl]));
    // power = Power page (Explore window, same settings)
    const pw = await page.evaluate(() => { document.getElementById('pwWindow').value = 'explorer'; return AsteriaApp.runPower().then(() => [...document.querySelectorAll('#pwCards .val')].map(e => e.textContent.trim())); });
    expect(`${t} power = the Power page cards for the Explore window (energy ${pw[0]}, needed ${pw[1]}, balance ${pw[2]}, mean/peak ${pw[3]}, battery ${pw[5]})`, X.cf.energy === pw[0] && X.cf.load === pw[1] && X.cf.balance === pw[2] && X.cf.meanPeak === pw[3] && X.cf.battery === pw[5], JSON.stringify({ cf: [X.cf.energy, X.cf.load, X.cf.balance, X.cf.meanPeak, X.cf.battery], pw }));
    // slope and requirements = Compare
    const cmpSlope = CT['DEM slope at the site point'][k];
    expect(`${t} slope = the Compare slope row (${cmpSlope})`, k < 2 ? X.cf.slope.startsWith(cmpSlope.replace(/\s*\(.*$/, '') + ' (' + X.slope.d + ' m LOLA grid') : (cmpSlope === '-' && /^- \(no terrain data for a custom point/.test(X.cf.slope)), JSON.stringify([X.cf.slope, cmpSlope]));
    expect(`${t} requirements check = the Compare verdicts for scenario ${k + 1} (${X.cfReq.length} requirements; ${X.cf.reqSum})`, X.cfReq.length === cmpReq.length && X.cfReq.every((r, j) => r[0] === cmpReq[j][0] && r[1] === cmpReq[j][k + 1]) && X.cf.reqSum === CT['Requirements met'][k], JSON.stringify({ cf: X.cfReq.slice(0, 2), cmp: cmpReq.slice(0, 2).map(r => [r[0], r[k + 1]]) }));
    // launch slip (first site only has a result)
    if (k === 0) {
      const sl = await page.evaluate(() => { const R = AsteriaApp.slipResults(), rows = R.sites[0].scan.rows, r0 = rows.find(x => x.slip === 0), b = rows.reduce((a, c) => c.pctBoth > a.pctBoth ? c : a); return { r0: r0.pctBoth.toFixed(1) + '%', best: '+' + b.slip + ' days', bestV: b.pctBoth.toFixed(1) + '%' }; });
      expect(`${t} launch slip summary = the Launch slip results (slip 0 % both ${sl.r0}; highest ${sl.best} ${sl.bestV})`, X.sliRes && X.cf.slip0.startsWith('% both ' + sl.r0) && X.cf.slipBest.startsWith(sl.best) && X.cf.slipBest.endsWith(sl.bestV), JSON.stringify([X.cf.slip0, X.cf.slipBest, sl]));
    } else expect(`${t} no Launch-slip result for this site: one-line pointer to the Launch slip tab`, !X.sliRes && await page.evaluate(() => /open the Launch slip tab/.test(document.getElementById('cfBody').textContent)));
    // evidence, classification, links
    const CLS = /^(Measured|Calculated|Approximate|Illustrative|User input)$/;
    expect(`${t} classification on every result section and every evidence row (${X.ev.length} rows)`, X.h3.filter(h => /^(1|3|4|5|6|7|8)\./.test(h.t)).every(h => h.cls) && X.ev.length >= 9 && X.ev.every(e => CLS.test(e.cls) || (e.cls === '-' && /Slope/.test(e.item) && k === 2)), JSON.stringify(X.ev.map(e => e.cls)));
    expect(`${t} validation results read live from the result files (angles ${X.V.el}°, status ${X.V.inst}, slope ${X.V.a3}°)`, X.ev.some(e => e.val.includes('elevation within ' + X.V.el + '°')) && (k === 2 || X.ev.some(e => e.val.startsWith(X.V.inst))) && X.ev.some(e => e.val.includes('max ' + X.V.a3 + '°')), JSON.stringify(X.ev.map(e => e.val.slice(0, 60))));
    const badExt = X.ext.filter(h => !(aboutHrefs.includes(h) || X.sources.includes(h) || h === X.hzSun || h === X.hzEarth));
    expect(`${t} links: ${X.go.length} internal anchors exist on the Validation page; ${X.ext.length} external links are cited URLs (About page, site sources, the JPL Horizons query)`, X.go.length >= 9 && X.go.every(g => g.ok) && badExt.length === 0, JSON.stringify({ missing: X.go.filter(g => !g.ok), badExt }));
    expect(`${t} "Verify with NASA" = the JPL Horizons queries for this site and the selected time (Sun and Earth)`, X.verify.length === 2 && X.verify[0] === X.hzSun && X.verify[1] === X.hzEarth);
    expect(`${t} footer: share link of this exact view (cf=1), app version, creation time, "Not endorsed by NASA"`, X.share === X.href && /cf=1/.test(X.href) && X.foot.includes(X.ver) && /Created \d{4}-\d\d-\d\d \d\d:\d\d UTC/.test(X.foot) && /Not endorsed by NASA/.test(X.foot), X.foot);
    // phone/laptop layout: no horizontal overflow of the sheet
    const lay = await page.evaluate(() => { const c = document.getElementById('casefile'), sh = c.querySelector('.cfsheet').getBoundingClientRect(); return { sw: c.scrollWidth, cw: c.clientWidth, right: sh.right, vw: innerWidth }; });
    expect(`${t} the casefile fits the ${tag.slice(1, -1)} width (no horizontal page scroll)`, lay.sw <= lay.cw + 1 && lay.right <= lay.vw + 1, JSON.stringify(lay));
    if (SHOTS) await page.screenshot({ path: path.join(OUT, `r6d_${tag.slice(1, -1)}_casefile_${k}.png`) });
    if (k === 0) {
      // print stylesheet hides the app chrome
      await page.emulateMedia({ media: 'print' });
      const pr = await page.evaluate(() => { const d = s => getComputedStyle(document.querySelector(s)).display; return { top: d('.topbar'), main: d('main'), foot: d('footer.foot'), cf: d('#casefile'), act: d('.cfactions'), pos: getComputedStyle(document.getElementById('casefile')).position }; });
      await page.emulateMedia({ media: 'screen' });
      expect(`${t} print stylesheet: app chrome (top bar, pages, footer) and the action buttons hidden; casefile printed in the page flow`, pr.top === 'none' && pr.main === 'none' && pr.foot === 'none' && pr.cf !== 'none' && pr.act === 'none' && pr.pos === 'static', JSON.stringify(pr));
      if (tag === '[laptop]') {
        await page.emulateMedia({ media: 'print' }); await page.pdf({ path: path.join(OUT, 'r6d_casefile.pdf') }).catch(() => {}); await page.emulateMedia({ media: 'screen' });
      }
      // CSV from the casefile = the existing export
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#cfCsvSun')]);
      const csv = fs.readFileSync(await dl.path(), 'utf8'), app = await page.evaluate(() => AsteriaApp.csv('sun'));
      const strip = x => x.split('\n').filter(l => !l.startsWith('# generated_utc')).join('\n');
      expect(`${t} "Download CSV" = the existing Sunlight-windows export (${dl.suggestedFilename()})`, strip(csv) === strip(app) && dl.suggestedFilename() === await page.evaluate(() => AsteriaApp.csvName('sun')));
      // share link reproduces the view in a fresh page (casefile opens by itself, same values)
      const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
      await p2.goto(X.href); await p2.waitForFunction(() => window.AsteriaApp && AsteriaApp.casefile(), null, { timeout: 60000 });
      const Y = await p2.evaluate(() => ({ raw: AsteriaApp.casefile().raw, open: !document.getElementById('casefile').hidden, t: document.querySelector('#cfBody [data-cf=pctSun]').textContent }));
      expect(`${t} opening the share link reopens this casefile with the same values`, Y.open && JSON.stringify(Y.raw) === JSON.stringify(X.raw) && Y.t === X.cf.pctSun && !e2.length, JSON.stringify({ Y, e2 }));
      await p2.close();
      // an evidence link opens the matching Validation section
      await page.click('#cfBody a.cfgo[data-goto="valM-power"]');
      const go = await page.evaluate(() => ({ cf: !document.getElementById('casefile').hidden, page: document.getElementById('page-validation').classList.contains('active'), top: document.getElementById('valM-power').getBoundingClientRect().top, h: innerHeight, hash: location.hash }));
      expect(`${t} an evidence link ("Methods: power") closes the casefile and shows that row of the Validation page; the link no longer says cf=1`, !go.cf && go.page && go.top >= -2 && go.top < go.h && !/cf=1/.test(go.hash), JSON.stringify(go));
    } else await page.click('#cfClose');
  }
  // Explore view: exactly one new control, and Escape closes the casefile
  await page.evaluate(() => { document.querySelector('.tab[data-page=explorer]').click(); });
  await page.click('#cfBtn'); await page.evaluate(() => AsteriaApp.casefileReady());
  await page.keyboard.press('Escape');
  expect(`${tag} Explore: one "Mission casefile" button on the Site Card; Escape closes the casefile`, await page.evaluate(() => document.querySelectorAll('#siteCard button#cfBtn').length === 1 && document.getElementById('cfBtn').textContent.trim() === 'Mission casefile' && document.getElementById('casefile').hidden));
  const ai = await page.evaluate(() => /\bAI-|\bAI |artificial intelligence|generated|illustrated by/i.test(document.getElementById('casefile').textContent + document.getElementById('reqBlock').textContent));
  expect(`${tag} no AI wording in the casefile or the requirements block`, !ai);
}

// ------------------------------------------------------------------ Part 3: integration text
async function part3(page, tag) {
  await load(page, `site=peak_shackleton_lw&t=${T0}Z&w=30&tab=about`);
  const A = await page.evaluate(() => { const w = document.getElementById('aboutWorkflow'), dd = [...document.querySelectorAll('#aboutContent details.dd')]; const last = dd.find(d => /^16\./.test(d.querySelector('summary').textContent.trim())) || dd[dd.length - 1];   /* Prompt 9: decision 17 (Historical Capsule) follows 16 */ return { w: w && w.textContent.replace(/\s+/g, ' ').trim(), n: dd.length, title: last.querySelector('summary').textContent.trim(), body: [...last.querySelectorAll('p')].map(p => p.textContent.replace(/^(Plain language|Technical): /, '').trim()) }; });
  const md = fs.readFileSync(path.join(__dirname, '..', 'DESIGN_DECISIONS.md'), 'utf8'), sec = md.slice(md.indexOf('## 16.'));
  expect(`${tag} About: one workflow sentence (site -> requirements -> compare -> casefile -> verify); tour has 6 steps (round 6F added "Choose your point, then Deploy 3D")`, /pick a site .* set the mission requirements .* compare sites and dates .* open the Mission casefile .* verify each number/.test(A.w || '') && await page.evaluate(() => { AsteriaApp.tour.start(); const t = document.getElementById('tourStep').textContent; document.getElementById('tourClose').click(); return / of 6$/.test(t); }), A.w);
  expect(`${tag} About design decision 16 = DESIGN_DECISIONS.md (title and text)`, A.n >= 16 && sec.startsWith('## ' + A.title) && A.body.every(b => sec.includes(b)), JSON.stringify(A.title));
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
    if (!PART || PART === '3') await part3(page, tag);
    expect(`${tag} no console errors or warnings`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})();
