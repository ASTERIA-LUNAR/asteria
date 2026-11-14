#!/usr/bin/env node
/* Headless UI check: opens index.html via file://, exercises every page and feature at laptop and
 * phone sizes, collects console errors/warnings, checks a few invariants and writes screenshots
 * to tests/screenshots/. Usage: node tests/ui_check.js */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), url = require('url');

(async () => {
  const out = path.join(__dirname, 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const base = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
  const browser = await chromium.launch();
  const errors = [], fails = [];
  const expect = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) fails.push(name); };

  for (const vp of [{ name: 'laptop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${vp.name}] console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${vp.name}] pageerror: ${e.message}`));
    await page.goto(base);
    await page.waitForTimeout(1200);
    // default view
    const def = await page.evaluate(() => ({ name: document.getElementById('siteName').textContent, hash: location.hash, w: window.LunaApp.state.windowDays }));
    expect(`[${vp.name}] default view is Peak near Shackleton, 30 days`, def.name.startsWith('Peak near Shackleton') && def.w === 30 && def.hash.includes('site=peak_shackleton'), JSON.stringify(def));
    await page.screenshot({ path: path.join(out, vp.name + '_explorer.png'), fullPage: true });

    // explorer interactions
    for (const id of ['apollo11', 'change4', 'shackleton_centre', 'im2']) { await page.click(`.siteitem[data-id="${id}"]`); await page.waitForTimeout(250); }
    await page.selectOption('#windowSel', '365'); await page.waitForTimeout(700);
    await page.selectOption('#windowSel', '14'); await page.waitForTimeout(300);
    await page.click('#playBtn'); await page.waitForTimeout(600); await page.click('#playBtn');
    await page.fill('#customLat', '-89.9'); await page.fill('#customLon', '45'); await page.click('#customGo'); await page.waitForTimeout(300);
    await page.click('.siteitem[data-id="peak_shackleton"]'); await page.waitForTimeout(300);
    await page.selectOption('#windowSel', '30'); await page.waitForTimeout(300);

    // launch slip: slip 0 must equal the Explorer metrics for the same window
    await page.click('.tab[data-page="slip"]');
    await page.evaluate(() => {
      const S = window.LunaApp.state, pad = n => (n < 10 ? '0' : '') + n, d = S.start;
      document.getElementById('slipNominal').value = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
      document.getElementById('slipDuration').value = S.windowDays;
      document.getElementById('slipSites').value = 'current';
    });
    await page.click('#slipRun');
    await page.waitForFunction(() => !document.getElementById('slipRun').disabled && /Done/.test(document.getElementById('slipProgress').textContent), null, { timeout: 60000 });
    const cmp = await page.evaluate(() => {
      const st = window.LunaApp.state.stats, r0 = window.LunaApp.slipResults().sites[0].scan.rows[0];
      const keys = ['pctSun', 'avgSunFrac', 'pctEarth', 'pctBoth', 'longestDarkH', 'longestBlackoutH', 'samples'];
      return { same: keys.every(k => r0[k] === st[k]), detail: keys.map(k => k + ' ' + r0[k] + '/' + st[k]).join(', ') };
    });
    expect(`[${vp.name}] heatmap slip 0 == Explorer timeline metrics`, cmp.same, cmp.detail);
    // multi-site heatmap with timing
    await page.selectOption('#slipSites', 'terrain'); await page.fill('#slipDuration', '14');
    const t0 = Date.now();
    await page.click('#slipRun');
    await page.waitForFunction(() => /Done/.test(document.getElementById('slipProgress').textContent) && window.LunaApp.slipResults().sites.length > 1, null, { timeout: 60000 });
    console.log(`[${vp.name}] terrain-sites heatmap (${await page.evaluate(() => window.LunaApp.slipResults().sites.length)} sites x 61 slips) computed in ${Date.now() - t0} ms`);
    await page.locator('#slipHeat').scrollIntoViewIfNeeded();
    const box = await page.locator('#slipHeat').boundingBox();
    await page.mouse.move(box.x + box.width * 0.6, box.y + 20); await page.waitForTimeout(150);
    expect(`[${vp.name}] heatmap tooltip shows`, await page.isVisible('#slipTip'));
    await page.screenshot({ path: path.join(out, vp.name + '_slip.png'), fullPage: true });
    await page.mouse.click(box.x + box.width * 0.6, box.y + 20); await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({ tab: document.querySelector('.tab.active').dataset.page, w: window.LunaApp.state.windowDays }));
    expect(`[${vp.name}] clicking a heatmap cell opens the Explorer with the mission window`, after.tab === 'explorer' && after.w === 14, JSON.stringify(after));

    // power
    await page.click('.tab[data-page="power"]'); await page.waitForTimeout(300);
    await page.selectOption('#pwMode', 'fixed'); await page.fill('#pwFace', '90'); await page.click('#pwRun'); await page.waitForTimeout(200);
    await page.selectOption('#pwMode', 'track'); await page.click('#pwRun'); await page.waitForTimeout(200);
    const pv = await page.textContent('#pwVerdict');
    expect(`[${vp.name}] power verdict rendered`, /Energy (positive|negative)/.test(pv), pv.slice(0, 90));
    await page.screenshot({ path: path.join(out, vp.name + '_power.png'), fullPage: true });

    // compare, validation, about
    await page.click('.tab[data-page="compare"]'); await page.waitForTimeout(200);
    await page.click('#cmpRun'); await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(out, vp.name + '_compare.png'), fullPage: true });
    await page.click('.tab[data-page="validation"]'); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(out, vp.name + '_validation.png'), fullPage: true });
    await page.click('.tab[data-page="about"]'); await page.waitForTimeout(200);

    // tour
    await page.click('#tourBtn');
    for (let i = 0; i < 5; i++) {
      await page.waitForFunction(() => !/Working/.test(document.getElementById('tourText').textContent), null, { timeout: 60000 });
      const cap = await page.textContent('#tourText');
      const nums = /\d/.test(cap) && !/NaN|undefined|Infinity/.test(cap);
      expect(`[${vp.name}] tour step ${i + 1} caption`, nums, cap.replace(/\s+/g, ' ').slice(0, 400));
      await page.screenshot({ path: path.join(out, `${vp.name}_tour${i + 1}.png`), fullPage: false });
      await page.click('#tourNext'); await page.waitForTimeout(200);
    }
    expect(`[${vp.name}] tour closes after the last step`, await page.isHidden('#tour'));

    // shareable link restores state
    const shared = base + '#site=apollo11&t=2027-01-01T00:00Z&w=14&tab=compare';
    await page.goto('about:blank'); await page.goto(shared); await page.waitForTimeout(900);
    const st = await page.evaluate(() => ({ site: window.LunaApp.state.site.id, t: window.LunaApp.state.start.toISOString(), w: window.LunaApp.state.windowDays, tab: document.querySelector('.tab.active').dataset.page }));
    expect(`[${vp.name}] URL hash restores site/date/window/tab`, st.site === 'apollo11' && st.t === '2027-01-01T00:00:00.000Z' && st.w === 14 && st.tab === 'compare', JSON.stringify(st));
    await page.goto(base + '#lat=-89.9&lon=45&t=2027-06-01T12:30Z&w=7'); await page.waitForTimeout(700);
    const st2 = await page.evaluate(() => ({ lat: window.LunaApp.state.site.lat, lon: window.LunaApp.state.site.lon, id: window.LunaApp.state.site.id, w: window.LunaApp.state.windowDays }));
    expect(`[${vp.name}] URL hash restores custom coordinates`, st2.lat === -89.9 && st2.lon === 45 && st2.id === null && st2.w === 7, JSON.stringify(st2));
    await page.close();
  }
  await browser.close();
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'No console errors or warnings.');
  console.log(fails.length ? 'UI CHECK FAILED: ' + fails.join('; ') : 'UI CHECK PASS');
  process.exit(errors.length || fails.length ? 1 : 0);
})();
