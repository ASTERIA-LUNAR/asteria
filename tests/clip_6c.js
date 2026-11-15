#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Round 6C: share of clipped pixels (luminance <= 3 = black, >= 252 = white, of 255) in the ground band (lower 58-96 %,
 * central 90 %) of the round-6C pictures, before vs after, Medium, default settings. The "detail" metric of
 * tests/ground_detail_6c.js counts edges of clipped black/white areas as detail; this shows how much of each picture
 * is clipped.   node tests/clip_6c.js   (reads docs/ground_detail/round6c/{before,after}_<site>_<view>_medium.jpg) */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = [];
  for (const site of ['peak_shackleton', 'mons_malapert']) for (const view of ['orbit60', 'orbit3', 'walk', 'rover']) {
    const r = { site, view };
    for (const b of ['before', 'after']) {
      const f = path.join(__dirname, '..', 'docs', 'ground_detail', 'round6c', `${b}_${site}_${view}_medium.jpg`);
      r[b] = await page.evaluate(async b64 => {
        const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const x0 = Math.floor(img.width * 0.05), x1 = Math.floor(img.width * 0.95), y0 = Math.floor(img.height * 0.58), y1 = Math.floor(img.height * 0.96);
        const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data; let blk = 0, wht = 0, n = 0;
        for (let k = 0; k < d.length; k += 4) { const L = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; if (L <= 3) blk++; if (L >= 252) wht++; n++; }
        return { black: +(100 * blk / n).toFixed(1), white: +(100 * wht / n).toFixed(1) };
      }, fs.readFileSync(f).toString('base64'));
    }
    out.push(r);
    console.log(`${site.padEnd(16)} ${view.padEnd(8)} before: black ${String(r.before.black).padStart(5)} % white ${String(r.before.white).padStart(5)} %  |  after: black ${String(r.after.black).padStart(5)} % white ${String(r.after.white).padStart(5)} %`);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'ground_detail', 'round6c', 'clipping.json'), JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(2); });
