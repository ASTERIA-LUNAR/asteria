#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6G browser checks (laptop and emulated phone): the Launch slip result follows the current point.
 * Before round 6G the heatmap computed for the first point stayed on screen (and in the legend, line chart and summary)
 * after the point changed; only a page reload updated it. Sequences, each starting from site A with a computed heatmap:
 *   1 site B from the site list            2 custom point by a map click      3 custom point opened in 3D and closed
 *   4a share link (hash change, tab=slip)  4b share link without tab while on the Launch slip page
 *   4c share link of a custom point        5 Explore start time changed       6 terrain horizon off   7 minimum elevation
 * After every change: the Launch slip page shows either a heatmap equal cell by cell (exact) to a fresh page load for
 * the new point and window, with a header naming that point and window, or the "Out of date - recompute for <point>"
 * state with the old heatmap hidden. Also: replies of an older run are discarded (request token); the casefile slip
 * summary uses only a result for its own point and window (else the pointer); slip 0 equals the Explore metrics for the
 * same window at the new point (no calculation error); the Power page follows a share-link point change; no console errors.
 *   node tests/ui_round6g.js [--only laptop|phone] */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), url = require('url');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only');
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? ' - ' + String(info).slice(0, 500) : '')); if (!ok) fails++; };
const BASE = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const T = '2028-09-25T10:04', A = 'peak_shackleton_lw', B = 'mons_malapert';

const ready = page => page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series && AsteriaApp.state.site && AsteriaApp.state.seriesSite === AsteriaApp.state.site, null, { timeout: 90000 }).then(() => page.evaluate(() => AsteriaApp.ready()));
async function gotoHash(page, h) { await page.goto('about:blank'); await page.goto(BASE + '#' + h); await ready(page); await page.waitForTimeout(200); }
const tab = (page, p) => page.evaluate(p => document.querySelector('.tab[data-page=' + p + ']').click(), p);
// the Launch slip page has settled: no run in progress and either a current result or the out-of-date state
const settled = page => page.waitForFunction(() => { const d = AsteriaApp.slipDebug(); return !d.running && !document.getElementById('slipRun').disabled; }, null, { timeout: 240000 }).then(() => page.waitForTimeout(300));
const snap = page => page.evaluate(() => {
  const R = AsteriaApp.slipResults(), S = AsteriaApp.state, $ = id => document.getElementById(id);
  return {
    cur: { name: S.site.name, id: S.site.id, lat: S.site.lat, lon: S.site.lon }, fresh: AsteriaApp.slipFresh(),
    res: R && { nominal: +R.nominal, dur: R.dur, sites: R.sites.map(s => ({ name: s.name, lat: s.site.lat, lon: s.site.lon, mask: !!s.mask, rows: s.scan.rows })) },
    outHidden: $('slipOut').hidden, staleHidden: $('slipStale').hidden, staleText: $('slipStaleText').textContent, forText: $('slipFor').textContent,
    legend: $('slipLegend').textContent, line: $('slipLineSite').textContent, summary: $('slipSummary').textContent, nominalInput: $('slipNominal').value
  };
});
// exact equality with a fresh load: same point(s), horizon, nominal, every cell (all metrics of every landing date), labels
function sameAsFresh(a, b) {
  if (!a.res || !b.res) return 'no result';
  if (a.res.sites.length !== b.res.sites.length) return 'site count';
  const d = [];
  a.res.sites.forEach((s, i) => { const t = b.res.sites[i]; if (s.lat !== t.lat || s.lon !== t.lon || s.name !== t.name) d.push('point ' + s.name + ' vs ' + t.name); if (s.mask !== t.mask) d.push('horizon'); if (JSON.stringify(s.rows) !== JSON.stringify(t.rows)) d.push('cells'); });
  ['nominal', 'dur'].forEach(k => { if (a.res[k] !== b.res[k]) d.push(k); });
  ['legend', 'line', 'summary', 'forText'].forEach(k => { if (a[k] !== b[k]) d.push(k); });
  if (a.outHidden || !a.staleHidden || !a.fresh) d.push('not shown as current');
  return d.join(', ') || null;
}
const fmtUTC = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const headerOk = (s, name) => s.forText.startsWith('Computed for ' + name) && s.forText.includes('nominal landing ' + fmtUTC(s.res.nominal) + ' UTC') && s.forText.includes(s.res.dur + '-day mission');
async function fresh(page, hash) {    // a fresh page load, then the Launch slip tab (default inputs)
  await gotoHash(page, hash); await tab(page, 'slip');
  await page.waitForFunction(() => AsteriaApp.slipFresh(), null, { timeout: 240000 }); await settled(page); return snap(page);
}
async function casefile(page) {
  await page.evaluate(() => AsteriaApp.openCasefile()); await page.evaluate(() => AsteriaApp.casefileReady());
  const t = await page.evaluate(() => {
    const D = AsteriaApp.casefile(), R = AsteriaApp.slipResults(), sec = [...document.querySelectorAll('#cfBody .cfsec')].find(s => /Launch slip/.test(s.querySelector('h3').textContent));
    const rows = R && R.sites[0].scan.rows, r0 = rows && rows.find(x => x.slip === 0), b = rows && rows.reduce((a, c) => c.pctBoth > a.pctBoth ? c : a);
    return { site: D.site.name, has: !!D.slip, slipSite: D.slip ? D.slip.R.sites[0].name : null, text: sec.textContent, pointer: /open the Launch slip tab/.test(sec.textContent),
      r0: r0 && r0.pctBoth.toFixed(1) + '%', best: b && '+' + b.slip + ' days', fresh: AsteriaApp.slipFresh(), nomEq: !!R && +R.nominal === +AsteriaApp.state.start };
  });
  await page.evaluate(() => AsteriaApp.closeCasefile()); return t;
}
const cfOk = c => c.has ? (c.fresh && c.nomEq && c.slipSite === c.site && c.text.includes('% both ' + c.r0) && c.text.includes(c.best)) : (c.pointer && !(c.fresh && c.nomEq));

async function run(browser, vp) {
  const tag = vp.name;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr || 1, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
  await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.spotlightShown', '1'); localStorage.setItem('asteria.v3dQuality', 'low'); } catch (e) { } });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // custom point inside Peak near Shackleton's 6 km tile (so it can be deployed in 3D); terrain from 240 m data
  await gotoHash(page, `site=${A}&t=${T}Z&w=30`);
  const pt = await page.evaluate(() => AsteriaApp.llFrom(-88.79, 124.5, 800, -600)), cLat = +pt.lat.toFixed(4), cLon = +pt.lon.toFixed(4);
  // references: fresh page loads
  const refA = await fresh(page, `site=${A}&t=${T}Z&w=30`);
  const refB = await fresh(page, `site=${B}&t=${T}Z&w=30`);
  const refC = await fresh(page, `lat=${cLat}&lon=${cLon}&t=${T}Z&w=30`);
  expect(`${tag} references: fresh loads for A, B and a custom point show a heatmap whose header names the point and window`,
    headerOk(refA, 'Peak near Shackleton') && headerOk(refB, 'Mons Malapert') && headerOk(refC, 'Custom point (' + cLat.toFixed(4) + '°, ' + cLon.toFixed(4) + '°E; terrain horizon, 240 m data)'), [refA.forText, refB.forText, refC.forText].join(' | '));
  expect(`${tag} references differ between the points (the test can see a stale heatmap)`, JSON.stringify(refA.res.sites[0].rows) !== JSON.stringify(refB.res.sites[0].rows) && JSON.stringify(refA.res.sites[0].rows) !== JSON.stringify(refC.res.sites[0].rows));
  // the fresh share link of a custom point straight to the Launch slip tab (before 6G: no heatmap at all)
  await page.goto('about:blank'); await page.goto(BASE + `#lat=${cLat}&lon=${cLon}&t=${T}Z&w=30&tab=slip`); await ready(page);
  await page.waitForFunction(() => AsteriaApp.slipFresh(), null, { timeout: 240000 }); await settled(page);
  let s = await snap(page);
  expect(`${tag} fresh share link of a custom point with tab=slip computes the heatmap for that point (exact = reference)`, !sameAsFresh(s, refC), sameAsFresh(s, refC));

  const startA = () => fresh(page, `site=${A}&t=${T}Z&w=30`);
  const check = async (label, ref, refName) => {
    await settled(page); const x = await snap(page), d = sameAsFresh(x, ref);
    expect(`${tag} ${label}: heatmap = fresh load for ${refName} (every cell exact; legend, line chart, summary, header)`, !d, d);
    const c = await casefile(page);
    expect(`${tag} ${label}: casefile slip summary for ${c.site} uses the result for that point and window`, cfOk(c) && c.has, JSON.stringify(c));
    return x;
  };

  // ---- 1 site list (Explore page), then the Launch slip tab
  await startA(); await tab(page, 'explorer');
  await page.click('#pickBtn'); await page.click(`.siteitem[data-id="${B}"]`); await ready(page);
  s = await snap(page);
  expect(`${tag} 1 site list A->B, before opening Launch slip: old heatmap hidden, "Out of date - recompute for Mons Malapert"`, s.outHidden && !s.staleHidden && /^Out of date - recompute for Mons Malapert/.test(s.staleText) && !s.fresh, JSON.stringify([s.outHidden, s.staleText]));
  let c = await casefile(page);
  expect(`${tag} 1 casefile before recomputing: no slip summary for the wrong point, pointer to the Launch slip tab`, !c.has && c.pointer, JSON.stringify(c));
  await tab(page, 'slip'); await check('1 site list A->B', refB, 'B');

  // ---- 2 custom point by a map click
  await startA(); await tab(page, 'explorer');
  await page.evaluate(([la, lo]) => AsteriaMap.leaflet().setView([la, lo], 9, { animate: false }), [cLat, cLon]); await page.waitForTimeout(500);
  const xy = await page.evaluate(([la, lo]) => { const m = AsteriaMap.leaflet(), p = m.latLngToContainerPoint([la, lo]), r = m.getContainer().getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, [cLat, cLon]);
  await page.mouse.click(xy.x, xy.y);
  await page.waitForFunction(() => !AsteriaApp.state.site.id, null, { timeout: 60000 }); await ready(page);
  const ck = await page.evaluate(() => ({ lat: AsteriaApp.state.site.lat, lon: AsteriaApp.state.site.lon }));
  s = await snap(page);
  expect(`${tag} 2 map click: out-of-date state names the custom point`, s.outHidden && /^Out of date - recompute for Custom point \(/.test(s.staleText), s.staleText);
  await tab(page, 'slip'); await settled(page);
  const after2 = await snap(page);
  const refM = (ck.lat === cLat && ck.lon === cLon) ? refC : await fresh(page, `lat=${ck.lat}&lon=${ck.lon}&t=${T}Z&w=30`);
  const d2 = sameAsFresh(after2, refM);
  expect(`${tag} 2 custom map point (${ck.lat}, ${ck.lon}): heatmap = fresh load for that point (exact)`, !d2, d2);

  // ---- 3 custom point opened in 3D and closed
  await startA(); await tab(page, 'explorer');
  await page.evaluate(([la, lo]) => { document.getElementById('customLat').value = la; document.getElementById('customLon').value = lo; document.getElementById('customGo').click(); }, [cLat, cLon]);
  await page.waitForFunction(() => !AsteriaApp.state.site.id, null, { timeout: 60000 }); await ready(page);
  await page.evaluate(() => AsteriaApp.openDeploy());
  await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && AsteriaView3D.debug().frames > 2, null, { timeout: 120000 });
  await page.evaluate(() => AsteriaView3D.close(true)); await page.waitForTimeout(300);
  await tab(page, 'slip'); await check('3 custom point, 3D opened and closed', refC, 'the custom point');

  // ---- 4a share link with tab=slip while on the Launch slip page
  await startA();
  await page.evaluate(h => { location.hash = h; }, `site=${B}&t=${T}Z&w=30&tab=slip`); await page.waitForTimeout(500); await ready(page);
  await check('4a share link A->B (tab=slip)', refB, 'B');
  // ---- 4b share link without a tab while on the Launch slip page (the page stays; recomputed automatically)
  await startA();
  await page.evaluate(h => { location.hash = h; }, `site=${B}&t=${T}Z&w=30`); await page.waitForTimeout(500); await ready(page);
  s = await check('4b share link A->B (no tab, Launch slip page open)', refB, 'B');
  // ---- 4c share link of a custom point
  await startA();
  await page.evaluate(h => { location.hash = h; }, `lat=${cLat}&lon=${cLon}&t=${T}Z&w=30&tab=slip`); await page.waitForTimeout(500);
  await page.waitForFunction(() => !AsteriaApp.state.site.id, null, { timeout: 60000 }); await ready(page);
  await check('4c share link A->custom point (tab=slip)', refC, 'the custom point');

  // ---- 5 Explore start time changed: the nominal landing follows it (= a fresh load with that t)
  const T2 = '2028-10-05T00:00';
  const refA2 = await fresh(page, `site=${A}&t=${T2}Z&w=30`);
  await startA(); await tab(page, 'explorer');
  await page.evaluate(t => { const i = document.getElementById('startInput'); i.value = t; i.dispatchEvent(new Event('change')); }, T2); await ready(page);
  s = await snap(page);
  expect(`${tag} 5 Explore start changed: nominal landing follows (${s.nominalInput}); old heatmap marked out of date`, s.nominalInput === T2 && s.outHidden && /^Out of date/.test(s.staleText), JSON.stringify([s.nominalInput, s.staleText]));
  await tab(page, 'slip'); await check('5 Explore start changed', refA2, 'A at the new start');

  // ---- 6 terrain horizon switched off (smooth horizon) and 7 minimum link elevation, while on the Launch slip page
  const refA3 = await fresh(page, `site=${A}&t=${T}Z&w=30&terrain=0`);
  await startA();
  await page.evaluate(h => { location.hash = h; }, `site=${A}&t=${T}Z&w=30&terrain=0&tab=slip`); await page.waitForTimeout(500); await ready(page);
  await check('6 terrain horizon off', refA3, 'A with a smooth horizon');
  const refA4 = await fresh(page, `site=${A}&t=${T}Z&w=30&me=5`);
  await startA();
  await page.evaluate(() => { const i = document.getElementById('minEl'); i.value = 5; i.dispatchEvent(new Event('change')); }); await ready(page);
  await check('7 minimum link elevation 5 deg', refA4, 'A with 5 deg');

  // ---- Launch slip inputs edited on the page: out-of-date state until Compute; the nominal stays the user's
  await startA();
  await page.fill('#slipDuration', '7'); await page.dispatchEvent('#slipDuration', 'change');
  s = await snap(page);
  expect(`${tag} Launch slip input changed (mission 7 days): old heatmap hidden, "Out of date - recompute for Peak near Shackleton" with a Recompute button`, s.outHidden && /^Out of date - recompute for Peak near Shackleton/.test(s.staleText) && await page.isVisible('#slipStaleRun'), s.staleText);
  await page.click('#slipStaleRun'); await page.waitForFunction(() => AsteriaApp.slipFresh(), null, { timeout: 240000 }); await settled(page);
  s = await snap(page);
  expect(`${tag} Recompute: heatmap for the 7-day mission, header says so`, s.fresh && s.res.dur === 7 && !s.outHidden && s.forText.includes('7-day mission'), s.forText);
  await page.fill('#slipNominal', '2028-11-01T00:00'); await page.dispatchEvent('#slipNominal', 'change');
  await tab(page, 'explorer'); await page.click('#pickBtn'); await page.click(`.siteitem[data-id="${B}"]`); await ready(page);
  s = await snap(page);
  expect(`${tag} a nominal landing set on the Launch slip page is kept when the point changes`, s.nominalInput === '2028-11-01T00:00', s.nominalInput);
  c = await casefile(page);
  expect(`${tag} casefile: a slip result for another window (nominal 2028-11-01, Explore start ${T}) is not used - pointer`, !c.has && c.pointer, JSON.stringify(c));

  // ---- stale replies are discarded: start A, change to B before A's run returns
  await startA();
  const d0 = await page.evaluate(() => AsteriaApp.slipDebug());
  await page.fill('#slipDuration', '14'); await page.dispatchEvent('#slipDuration', 'change');
  await page.evaluate(() => AsteriaApp.runSlip());            // run for A in flight ...
  await page.evaluate(h => { location.hash = h; }, `site=${B}&t=${T}Z&w=30`);   // ... the point changes to B immediately
  await page.waitForTimeout(300); await ready(page); await settled(page);
  const d1 = await page.evaluate(() => AsteriaApp.slipDebug());
  s = await snap(page);
  expect(`${tag} late reply for the older point discarded (request token: ${d1.discarded - d0.discarded} reply dropped); the newer point's heatmap stays (= fresh B)`, d1.discarded > d0.discarded && !sameAsFresh(s, refB), JSON.stringify([d0, d1, sameAsFresh(s, refB)]));
  // two runs for the same page in a row: only the last one is written
  await page.evaluate(() => { document.getElementById('slipFrom').value = 0; document.getElementById('slipTo').value = 30; AsteriaApp.runSlip(); document.getElementById('slipTo').value = 60; AsteriaApp.runSlip(); });
  await page.waitForFunction(() => AsteriaApp.slipFresh(), null, { timeout: 240000 }); await settled(page);
  s = await snap(page);
  expect(`${tag} two runs back to back: the result is the last one's (slips +0..+60 = fresh B), the first run's reply discarded`, !sameAsFresh(s, refB), sameAsFresh(s, refB));

  // ---- the values for the correct point: slip 0 = Explore metrics for the same window (B and the custom point)
  for (const [h, nm] of [[`site=${B}`, 'B'], [`lat=${cLat}&lon=${cLon}`, 'custom point']]) {
    await gotoHash(page, `${h}&t=${T}Z&w=14&tab=slip`); await page.waitForFunction(() => AsteriaApp.slipFresh(), null, { timeout: 240000 }); await settled(page);
    const e = await page.evaluate(() => { const st = AsteriaApp.state.stats, r0 = AsteriaApp.slipResults().sites[0].scan.rows[0], keys = ['pctSun', 'avgSunFrac', 'pctEarth', 'pctBoth', 'longestDarkH', 'longestBlackoutH', 'samples']; return { same: keys.every(k => r0[k] === st[k]), d: keys.map(k => k + ' ' + r0[k] + '/' + st[k]).join(', ') }; });
    expect(`${tag} ${nm}: heatmap slip 0 = Explore metrics for the same 14-day window (no calculation error at the new point)`, e.same, e.d);
  }

  // ---- Power page follows a share-link point change (no tab: the page stays and reruns)
  await gotoHash(page, `site=${A}&t=${T}Z&w=30&tab=power`); await page.waitForFunction(() => AsteriaApp.powerResults(), null, { timeout: 60000 }); await page.waitForTimeout(300);
  await page.evaluate(h => { location.hash = h; }, `site=${B}&t=${T}Z&w=30`); await page.waitForTimeout(500); await ready(page);
  await page.waitForFunction(() => /Mons Malapert/.test(AsteriaApp.powerResults().win.label), null, { timeout: 60000 }).catch(() => {});
  const pw = await page.evaluate(() => { const R = AsteriaApp.powerResults(), e = AsteriaApp.powerOf(); return { label: R.win.label, note: document.getElementById('pwWindowNote').textContent, same: R.Wh === e.Wh && R.darkH === e.darkH }; });
  expect(`${tag} Power page: after a share-link change to B the window, note and energy are B's (= the same model on B's Explore series)`, /^Mons Malapert/.test(pw.label) && /Mons Malapert/.test(pw.note) && pw.same, JSON.stringify(pw));

  expect(`${tag} no console errors`, errors.length === 0, errors.slice(0, 5).join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  const vps = [{ name: 'laptop', w: 1366, h: 900 }, { name: 'phone', w: 390, h: 844, mobile: true, dpr: 2 }].filter(v => !ONLY || v.name === ONLY);
  for (const vp of vps) await run(browser, vp);
  await browser.close();
  console.log(fails ? `\n${fails} check(s) FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
