#!/usr/bin/env node
/* Headless UI smoke test: opens index.html via file://, exercises each page, collects console
 * errors and writes screenshots to tests/screenshots/. Usage: node tests/ui_check.js */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const out = path.join(__dirname, 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const url = require('url').pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
  const browser = await chromium.launch();
  const errors = [];
  for (const vp of [{ name: 'laptop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${vp.name}] console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${vp.name}] pageerror: ${e.message}`));
    await page.goto(url);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, vp.name + '_explorer.png'), fullPage: true });
    // select a few sites incl. far side and Shackleton floor, change window, play
    for (const id of ['apollo11', 'change4', 'shackleton_centre', 'im2']) {
      await page.click(`.siteitem[data-id="${id}"]`); await page.waitForTimeout(300);
    }
    await page.selectOption('#windowSel', '365'); await page.waitForTimeout(800);
    await page.selectOption('#windowSel', '7'); await page.waitForTimeout(300);
    await page.click('#playBtn'); await page.waitForTimeout(800); await page.click('#playBtn');
    await page.check('#explainToggle');
    await page.fill('#customLat', '-89.9'); await page.fill('#customLon', '45'); await page.click('#customGo'); await page.waitForTimeout(300);
    await page.click('.siteitem[data-id="peak_shackleton"]'); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, vp.name + '_explorer_explain.png'), fullPage: true });
    await page.uncheck('#explainToggle');
    await page.click('.tab[data-page="compare"]'); await page.waitForTimeout(300);
    await page.click('#cmpSlip');
    await page.click('#cmpRun'); await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, vp.name + '_compare.png'), fullPage: true });
    await page.click('.tab[data-page="validation"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, vp.name + '_validation.png'), fullPage: false });
    await page.click('.tab[data-page="about"]'); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, vp.name + '_about.png'), fullPage: false });
    const txt = await page.evaluate(() => ({ cmp: document.querySelector('#cmpResult').innerText.slice(0, 300) }));
    console.log(vp.name, 'compare excerpt:', txt.cmp.replace(/\s+/g, ' ').slice(0, 200));
    await page.click('.tab[data-page="explorer"]');
    await page.close();
  }
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No console errors or warnings.');
  process.exit(errors.length ? 1 : 0);
})();
