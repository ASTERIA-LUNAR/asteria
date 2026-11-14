#!/usr/bin/env node
/* Headless UI check: opens index.html via file:// (as a double-click would), exercises every page and
 * feature at laptop and phone sizes, collects console errors/warnings, checks invariants and writes
 * screenshots to tests/screenshots/. Usage: node tests/ui_check.js */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), url = require('url');

(async () => {
  const out = path.join(__dirname, 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const base = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
  const browser = await chromium.launch();
  const errors = [], fails = [];
  const expect = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) fails.push(name); };
  const ready = page => page.evaluate(() => window.AsteriaApp.ready());
  const shot = (page, name, full) => page.screenshot({ path: path.join(out, name + '.png'), fullPage: full !== false });

  for (const vp of [{ name: 'laptop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    const page = await ctx.newPage();
    const tag = `[${vp.name}]`;
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${tag} console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`));
    await page.goto(base);
    await page.waitForFunction(() => window.AsteriaApp && window.AsteriaApp.state.series, null, { timeout: 30000 });
    await page.waitForTimeout(900);

    // ---- default view, worker, first-visit hint
    const def = await page.evaluate(() => ({ name: document.getElementById('siteName').textContent, kind: document.getElementById('siteKind').textContent, hash: location.hash, w: AsteriaApp.state.windowDays, mode: AsteriaApp.jobsMode(), title: document.title }));
    expect(`${tag} default view is the derived best-supported point near Peak near Shackleton, 30 days`, def.name.startsWith('Peak near Shackleton - best-lit point') && /Derived/.test(def.kind) && def.w === 30 && def.hash.includes('site=peak_shackleton_lw'), JSON.stringify(def));
    expect(`${tag} title is ASTERIA`, def.title.startsWith('ASTERIA - Lunar South Pole Landing Site Navigator'));
    const ping = await page.evaluate(() => AsteriaJobs.run('ping', {}));
    expect(`${tag} computations run in a Blob Web Worker under file://`, def.mode === 'worker' && ping.inWorker && ping.engine, def.mode + ' ' + JSON.stringify(ping));
    expect(`${tag} first-visit hint shows`, await page.isVisible('#hint'));
    await shot(page, vp.name + '_1_first_visit', false);
    await page.click('#hintNext'); await page.click('#hintNext'); await page.click('#hintNext');
    expect(`${tag} hint dismissed and stored`, await page.isHidden('#hint') && await page.evaluate(() => localStorage.getItem('asteria.hintDismissed') === '1'));
    await page.reload(); await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series); await page.waitForTimeout(900);
    expect(`${tag} hint not shown again after dismissal`, await page.isHidden('#hint'));

    // ---- status tiles: consistent with the series and colour classes
    const tiles = await page.evaluate(() => {
      const S = AsteriaApp.state, i = S.idx, su = S.series.sunUp[i], eu = S.series.earthUp[i];
      const cls = id => document.getElementById(id).className;
      return { su, eu, sun: cls('tileSun'), earth: cls('tileEarth'), mission: cls('tileMission'), ms: document.getElementById('missionState').textContent, cnt: document.getElementById('sunCount').textContent };
    });
    const mExp = tiles.su && tiles.eu ? 'on-both' : tiles.su ? 'on-sun' : tiles.eu ? 'on-earth' : 'off';
    expect(`${tag} status tiles match the computed state (Sun amber / Earth blue / both green / neither grey)`, tiles.sun.includes(tiles.su ? 'on-sun' : 'off') && tiles.earth.includes(tiles.eu ? 'on-earth' : 'off') && tiles.mission.includes(mExp) && /\d/.test(tiles.cnt), JSON.stringify(tiles));
    await shot(page, vp.name + '_2_explore');

    // ---- map: projection, markers, layers, click-to-pick
    const proj = await page.evaluate(() => {
      const m = AsteriaMap.leaflet(), H = LUNA_TILES.halfExtent_m, z = 5;
      const R = 1737400, lat = -89.67, lon = 129.78, r = 2 * R * Math.tan((90 + lat) * Math.PI / 360);
      const x = r * Math.sin(lon * Math.PI / 180), y = r * Math.cos(lon * Math.PI / 180);
      const want = { x: (x + H) * 256 * 32 / (2 * H), y: (H - y) * 256 * 32 / (2 * H) };
      const got = m.project([lat, lon], z);
      return { dx: got.x - want.x, dy: got.y - want.y, tile: [Math.floor(got.x / 256), Math.floor(got.y / 256)], px: [Math.floor(got.x % 256), Math.floor(got.y % 256)] };
    });
    expect(`${tag} map CRS puts Shackleton centre on the tile pixel of the DEM floor (z5 tile 16,16 px 103,86)`, Math.abs(proj.dx) < 1e-6 && Math.abs(proj.dy) < 1e-6 && proj.tile.join() === '16,16' && proj.px.join() === '103,86', JSON.stringify(proj));
    const nMarkers = await page.evaluate(() => document.querySelectorAll('.leaflet-marker-pane .mk').length);
    expect(`${tag} site markers drawn (overlapping ones grouped)`, nMarkers >= 5, nMarkers + ' marker icons');
    for (const v of ['slope', 'illum', 'none']) {
      await page.check(`input[name=ovl][value=${v}]`); await page.waitForTimeout(700); if (v !== 'none') await shot(page, `${vp.name}_3_layer_${v}`, false);
      const lg = await page.textContent('#mapLegend');
      if (v === 'illum') {
        const li = await page.evaluate(() => { const m = AsteriaMap.leaflet(); let n = 0; m.eachLayer(l => { if (l._url && /tiles\/illum(120)?\//.test(l._url)) n++; }); return n; });
        expect(`${tag} illumination layer: 60 m map + outer 120 m map, coverage note, source and both definitions`, li === 2 && /NASA's published illumination map covers about 85°S-90°S only/.test(lg) && /AVGVISIB_75S_120M_201608/.test(lg) && /two different definitions/.test(lg), lg.slice(0, 160));
      }
      if (v === 'slope') expect(`${tag} slope legend states sample spacing and pixel averaging`, /sampled every 37 m and averaged over 74 m pixels/.test(lg), lg.slice(0, 160));
    }
    const box = await page.locator('#lmap').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5 + 25, box.y + box.height * 0.5 + 35); await ready(page); await page.waitForTimeout(300);
    const pick = await page.evaluate(() => ({ id: AsteriaApp.state.site.id, lat: AsteriaApp.state.site.lat, lon: AsteriaApp.state.site.lon, name: document.getElementById('siteName').textContent, kind: document.getElementById('siteKind').textContent }));
    const pickMsg = await page.evaluate(() => ({ badge: document.getElementById('horizonBadge').textContent, msg: (document.querySelector('.custommsg') || {}).textContent || '', hz: !!AsteriaApp.state.site.hz }));
    expect(`${tag} clicking inside the map picks a custom point with a terrain horizon from 240 m data (validated), clearly labelled`, pick.id === null && pick.lat < -85 && pickMsg.hz && /terrain from coarser 240 m data \(less precise than curated sites\)/.test(pick.kind) && /240 m data/.test(pickMsg.badge) && /may differ from reality/.test(pickMsg.msg), JSON.stringify(pick) + ' ' + JSON.stringify(pickMsg).slice(0, 200));
    // clicking outside the data square selects nothing and shows the coverage message
    const outPx = await page.evaluate(() => { const m = AsteriaMap.leaflet(), H = LUNA_TILES.halfExtent_m, q = AsteriaMap.unproject(H * 1.03, 0), pt = m.latLngToContainerPoint([q.lat, q.lon]); return { x: pt.x, y: pt.y, w: m.getSize().x, h: m.getSize().y }; });
    if (outPx.x > 2 && outPx.x < outPx.w - 2 && outPx.y > 2 && outPx.y < outPx.h - 2) {
      await page.mouse.click(box.x + outPx.x, box.y + outPx.y); await page.waitForTimeout(300);
      const o = await page.evaluate(() => ({ note: document.getElementById('mapNote').hidden ? '' : document.getElementById('mapNote').textContent, lat: AsteriaApp.state.site.lat }));
      expect(`${tag} click outside the map data: no point selected, coverage message shown`, o.lat === pick.lat && /No elevation data here - this map covers the lunar south pole \(about 80°S to the pole\)\./.test(o.note), JSON.stringify(o));
    } else console.log(`${tag} (map box shows no area outside the data at this size; outside-click check skipped)`);
    // panning is limited to the data square
    const cen = await page.evaluate(() => { const m = AsteriaMap.leaflet(); m.panBy([6000, 6000], { animate: false }); const c = m.getCenter(), p = AsteriaMap.project(c.lat, c.lng), H = LUNA_TILES.halfExtent_m; return { x: p.x / H, y: p.y / H }; });
    expect(`${tag} panning is limited to the area covered by the map data`, Math.abs(cen.x) <= 1.0001 && Math.abs(cen.y) <= 1.0001, JSON.stringify(cen));
    await page.evaluate(() => AsteriaMap.home(false));
    // typed coordinates outside the map stay allowed, with a smooth horizon
    await page.click('#pickBtn'); await page.fill('#customLat', '-60'); await page.fill('#customLon', '10'); await page.click('#customGo'); await ready(page); await page.waitForTimeout(200);
    const ty = await page.evaluate(() => ({ kind: document.getElementById('siteKind').textContent, badge: document.getElementById('horizonBadge').textContent, hz: !!AsteriaApp.state.site.hz, msg: (document.querySelector('.custommsg') || {}).textContent || '' }));
    expect(`${tag} typed point outside the map: smooth horizon, clearly labelled`, !ty.hz && /outside the south-pole map/.test(ty.kind) && /terrain not included/.test(ty.badge) && /smooth Moon without mountains/.test(ty.msg), JSON.stringify(ty).slice(0, 220));

    // ---- picker: Artemis features, reference site outside the pole
    const pickSite = async id => { await page.click('#pickBtn'); await page.click(`.siteitem[data-id="${id}"]`); await ready(page); await page.waitForTimeout(250); };
    await page.click('#pickBtn');
    const pk = await page.evaluate(() => ({ ids: [...document.querySelectorAll('.siteitem')].map(e => e.dataset.id), names: (document.querySelector('.regionnames') || {}).textContent || '', link: !!document.querySelector('.regionnames a[href*="nasa.gov"]') }));
    expect(`${tag} unplotted Artemis III regions listed by name only (no point), with the NASA link`, ['haworth', 'cabeus_b', 'nobile', 'de_gerlache', 'slater', 'change7'].every(id => !pk.ids.includes(id)) && ['Peak near Cabeus B', 'Haworth', 'Mons Mouton Plateau', 'Nobile Rim 1', 'de Gerlache Rim 2', 'Slater Plain'].every(n => pk.names.includes(n)) && /not plotted, no values computed/.test(pk.names) && pk.link, JSON.stringify(pk).slice(0, 300));
    await page.click('#pickBtn');
    await pickSite('mons_malapert');
    const hw = await page.evaluate(() => ({ kind: document.getElementById('siteKind').textContent, badge: document.getElementById('horizonBadge').textContent, warn: !!document.querySelector('.warnline') }));
    expect(`${tag} Artemis landform centre labelled "centre of the named landform; region boundary not plotted" with terrain`, /Malapert Massif/.test(hw.kind) && /centre of the named landform; region boundary not plotted/.test(hw.kind) && /Terrain/.test(hw.badge) && hw.warn, JSON.stringify(hw));
    await pickSite('apollo11');
    const ap = await page.evaluate(() => ({ note: document.getElementById('mapNote').hidden ? '' : document.getElementById('mapNote').textContent, badge: document.getElementById('horizonBadge').textContent }));
    expect(`${tag} reference site outside the pole: map note + "smooth horizon, terrain not included"`, /outside this south-pole map/.test(ap.note) && /terrain not included/.test(ap.badge) && /terrain not included/.test(ap.note), JSON.stringify(ap));
    await pickSite('peak_shackleton_lw');

    // ---- long window: loader appears, UI stays responsive (worker)
    const before = await page.evaluate(() => AsteriaLoader.shownCount());
    await page.selectOption('#windowSel', '365');
    const t0 = Date.now(); let maxLag = 0;
    while (await page.evaluate(() => AsteriaApp.state.computing)) {
      const t = Date.now(); await page.evaluate(() => 1); maxLag = Math.max(maxLag, Date.now() - t);
      if (Date.now() - t0 > 60000) break;
    }
    const after = await page.evaluate(() => ({ shown: AsteriaLoader.shownCount(), n: AsteriaApp.state.series.t.length }));
    expect(`${tag} 365-day window computed off the main thread (page answered within ${maxLag} ms), took ${Date.now() - t0} ms; loader shown only if > 250 ms`, maxLag < 250 && after.n === 8761 && (Date.now() - t0 < 250 || after.shown > before), JSON.stringify(after));
    await page.selectOption('#windowSel', '30'); await ready(page);

    // ---- expert / explain
    await page.check('#expertToggle'); await page.waitForTimeout(150);
    expect(`${tag} Expert view reveals technical values`, await page.isVisible('#expertPanel') && await page.isVisible('#sunExpert'));
    await shot(page, vp.name + '_4_expert');
    await page.uncheck('#expertToggle'); await page.waitForTimeout(150);
    expect(`${tag} beginner view hides technical values`, await page.isHidden('#expertPanel') && await page.isHidden('#sunExpert'));
    await page.click('#tileSun .qb'); await page.waitForTimeout(100);
    const qtxt = await page.textContent('#qpop');
    expect(`${tag} "?" explains a metric and why it matters`, await page.isVisible('#qpop') && /Why it matters/.test(qtxt), qtxt.slice(0, 80));
    await page.mouse.click(5, 300);

    // ---- Earth communication: windows, stats, minimum elevation
    const comm = async () => page.evaluate(() => {
      const S = AsteriaApp.state, w = AsteriaApp.windows('earth'), s = S.series;
      const inside = w.reduce((a, x) => a + (x.end - x.start), 0) / (s.t[s.t.length - 1] - s.t[0]) * 100;
      return { pct: S.stats.pctEarth, inside, n: w.length, rows: document.querySelectorAll('#earthWindows tbody tr[data-k]').length, stepPct: 100 * s.stepMin / ((s.t[s.t.length - 1] - s.t[0]) / 60000) };
    });
    const c0 = await comm();
    expect(`${tag} Earth windows listed and their total time matches % Earth link (within sampling)`, c0.rows === c0.n && Math.abs(c0.inside - c0.pct) <= 2 * c0.stepPct * Math.max(1, c0.n) + 0.05, JSON.stringify(c0));
    await page.fill('#minEl', '2'); await page.dispatchEvent('#minEl', 'change'); await ready(page); await page.waitForTimeout(200);
    const c2 = await comm();
    const h2 = await page.evaluate(() => location.hash);
    expect(`${tag} minimum link elevation 2 deg lowers Earth link time and is in the URL`, c2.pct <= c0.pct && h2.includes('me=2'), `${c0.pct.toFixed(1)}% -> ${c2.pct.toFixed(1)}%`);
    await shot(page, vp.name + '_5_minel');

    // ---- launch slip: slip 0 == Explore metrics (with the minimum elevation applied)
    await page.click('.tab[data-page="slip"]');
    await page.waitForFunction(() => !document.getElementById('slipRun').disabled && /Done/.test(document.getElementById('slipProgress').textContent), null, { timeout: 60000 });
    await page.evaluate(() => {
      const S = AsteriaApp.state, pad = n => (n < 10 ? '0' : '') + n, d = S.start;
      document.getElementById('slipNominal').value = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
      document.getElementById('slipDuration').value = S.windowDays;
      document.getElementById('slipSites').value = 'current';
    });
    await page.click('#slipRun');
    await page.waitForFunction(() => !document.getElementById('slipRun').disabled && /Done/.test(document.getElementById('slipProgress').textContent), null, { timeout: 60000 });
    const cmp = await page.evaluate(() => {
      const st = AsteriaApp.state.stats, r0 = AsteriaApp.slipResults().sites[0].scan.rows[0];
      const keys = ['pctSun', 'avgSunFrac', 'pctEarth', 'pctBoth', 'longestDarkH', 'longestBlackoutH', 'samples'];
      return { same: keys.every(k => r0[k] === st[k]), minEl: AsteriaApp.slipResults().minEl, detail: keys.map(k => k + ' ' + r0[k] + '/' + st[k]).join(', ') };
    });
    expect(`${tag} heatmap slip 0 == Explore metrics (minimum elevation ${cmp.minEl} deg applied to both)`, cmp.same && cmp.minEl === 2, cmp.detail);
    await page.selectOption('#slipSites', 'terrain'); await page.fill('#slipDuration', '14');
    const t1 = Date.now();
    await page.click('#slipRun');
    await page.waitForFunction(() => /Done/.test(document.getElementById('slipProgress').textContent) && AsteriaApp.slipResults().sites.length > 1, null, { timeout: 120000 });
    console.log(`${tag} terrain-sites heatmap (${await page.evaluate(() => AsteriaApp.slipResults().sites.length)} sites x 61 slips) computed in ${Date.now() - t1} ms`);
    await page.locator('#slipHeat').scrollIntoViewIfNeeded();
    const hb = await page.locator('#slipHeat').boundingBox();
    await page.mouse.move(hb.x + hb.width * 0.6, hb.y + 20); await page.waitForTimeout(150);
    expect(`${tag} heatmap tooltip shows`, await page.isVisible('#slipTip'));
    await shot(page, vp.name + '_6_slip');
    await page.mouse.click(hb.x + hb.width * 0.6, hb.y + 20); await ready(page); await page.waitForTimeout(300);
    const aft = await page.evaluate(() => ({ tab: document.querySelector('.tab.active').dataset.page, w: AsteriaApp.state.windowDays }));
    expect(`${tag} clicking a heatmap cell opens Explore with the mission window`, aft.tab === 'explorer' && aft.w === 14, JSON.stringify(aft));

    // ---- power
    await page.click('.tab[data-page="power"]'); await page.waitForTimeout(400);
    await page.selectOption('#pwMode', 'fixed'); await page.fill('#pwFace', '90'); await page.click('#pwRun'); await page.waitForTimeout(400);
    await page.selectOption('#pwMode', 'track'); await page.click('#pwRun'); await page.waitForTimeout(400);
    const pv = await page.textContent('#pwVerdict');
    expect(`${tag} power verdict rendered`, /Energy (positive|negative)/.test(pv), pv.slice(0, 90));
    const ex = await page.textContent('#pwExample');
    expect(`${tag} power inputs labelled "example values - enter your mission's values"`, await page.isVisible('#pwExample') && /Example values - enter your mission's values/i.test(ex), ex.slice(0, 80));
    await shot(page, vp.name + '_7_power');

    // ---- compare: sunlight and Earth-link metrics side by side
    await page.click('.tab[data-page="compare"]'); await page.waitForTimeout(200);
    await page.click('#cmpRun');
    await page.waitForFunction(() => document.querySelector('#cmpResult table'), null, { timeout: 60000 });
    const ct = await page.textContent('#cmpResult');
    expect(`${tag} Compare shows Earth-link metrics next to sunlight metrics`, /Sunlight windows/.test(ct) && /Earth link windows/.test(ct) && /Longest Earth blackout/.test(ct) && /Average Earth link window/.test(ct));
    await shot(page, vp.name + '_8_compare');
    await page.click('.tab[data-page="validation"]'); await page.waitForTimeout(200);
    const vt = await page.textContent('#validationContent');
    expect(`${tag} Validation cross-check lists the landform centres and no removed crater-centre points`, /Overall: PASS/.test(vt) && /Mons Malapert \(landform centre\)/.test(vt) && !/Haworth \(feature\)|Cabeus B|Slater \(|de Gerlache \(/.test(vt));
    await shot(page, vp.name + '_9_validation');
    await page.click('.tab[data-page="about"]'); await page.waitForTimeout(200);
    const ab = await page.textContent('#aboutContent');
    expect(`${tag} About: disclaimer and the nine Artemis regions`, /Not affiliated with NASA's ASTERIA CubeSat mission\. Not endorsed by NASA\./.test(ab) && ['Peak near Cabeus B', 'Haworth', 'Malapert Massif', 'Mons Mouton Plateau', 'Nobile Rim 1', 'Nobile Rim 2', 'de Gerlache Rim 2', 'Slater Plain'].every(n => ab.includes(n)));
    await shot(page, vp.name + '_10_about');

    // ---- tour (all numbers read live)
    await page.click('#tourBtn');
    for (let i = 0; i < 5; i++) {
      await page.waitForFunction(() => !/Working/.test(document.getElementById('tourText').textContent), null, { timeout: 120000 });
      const cap = await page.textContent('#tourText');
      expect(`${tag} tour step ${i + 1} caption`, /\d/.test(cap) && !/NaN|undefined|Infinity/.test(cap), cap.replace(/\s+/g, ' ').slice(0, 420));
      await page.waitForTimeout(500);
      await shot(page, `${vp.name}_tour${i + 1}`, false);
      await page.click('#tourNext'); await page.waitForTimeout(200);
    }
    expect(`${tag} tour closes after the last step`, await page.isHidden('#tour'));

    // ---- shareable link restores state
    await page.goto('about:blank'); await page.goto(base + '#site=apollo11&t=2027-01-01T00:00Z&w=14&me=3&tab=compare'); await page.waitForTimeout(1200);
    const st = await page.evaluate(() => ({ site: AsteriaApp.state.site.id, t: AsteriaApp.state.start.toISOString(), w: AsteriaApp.state.windowDays, me: AsteriaApp.state.minEl, tab: document.querySelector('.tab.active').dataset.page }));
    expect(`${tag} URL hash restores site/date/window/min elevation/tab`, st.site === 'apollo11' && st.t === '2027-01-01T00:00:00.000Z' && st.w === 14 && st.me === 3 && st.tab === 'compare', JSON.stringify(st));
    await page.goto(base + '#lat=-89.9&lon=45&t=2027-06-01T12:30Z&w=7'); await page.waitForTimeout(500);
    await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.site && AsteriaApp.state.site.lat === -89.9 && !AsteriaApp.state.computing, null, { timeout: 30000 }); await ready(page);
    const st2 = await page.evaluate(() => ({ lat: AsteriaApp.state.site.lat, lon: AsteriaApp.state.site.lon, id: AsteriaApp.state.site.id, w: AsteriaApp.state.windowDays, hz: !!AsteriaApp.state.site.hz }));
    expect(`${tag} URL hash restores custom coordinates (terrain recomputed from 240 m data)`, st2.lat === -89.9 && st2.lon === 45 && st2.id === null && st2.w === 7 && st2.hz, JSON.stringify(st2));
    // ---- VERIFY_YOURSELF.md section 1: the share link shows Horizons' blind-test values in Expert view
    await page.goto('about:blank'); await page.goto(base + '#site=peak_shackleton&t=2026-12-04T00:50Z&w=7');
    await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series && AsteriaApp.state.site.id === 'peak_shackleton', null, { timeout: 30000 }); await ready(page);
    await page.check('#expertToggle'); await page.waitForTimeout(150);
    const vy = await page.evaluate(() => ({ cur: document.getElementById('curUtc').textContent, sEl: document.getElementById('vSunEl').textContent, sAz: document.getElementById('vSunAz').textContent, eEl: document.getElementById('vEarthEl').textContent, eAz: document.getElementById('vEarthAz').textContent }));
    const num = s => parseFloat(s.replace('−', '-'));
    expect(`${tag} VERIFY_YOURSELF share link: Expert view matches JPL Horizons within 0.01 deg`, /2026-12-04 00:50/.test(vy.cur) && Math.abs(num(vy.sEl) - 0.877258) < 0.01 && Math.abs(num(vy.sAz) - 118.656263) < 0.01 && Math.abs(num(vy.eEl) + 6.0028) < 0.01 && Math.abs(num(vy.eAz) - 242.0837) < 0.01, JSON.stringify(vy));
    await page.uncheck('#expertToggle');
    // ---- horizontal overflow (phone layout)
    await page.goto(base); await page.waitForTimeout(1200);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(`${tag} no horizontal page scroll`, ov <= 1, ov + ' px');
    await ctx.close();
  }

  // ---- reduced motion: spinner instead of the rocket, map without animation
  const rctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  rp.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[reduced] console.${m.type()}: ${m.text()}`); });
  rp.on('pageerror', e => errors.push(`[reduced] pageerror: ${e.message}`));
  await rp.goto(base); await rp.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series);
  await rp.evaluate(() => { AsteriaLoader.begin('test'); });
  await rp.waitForTimeout(400);
  const rm = await rp.evaluate(() => ({ cls: document.getElementById('loader').className, spinner: !!document.querySelector('#loader .spinner'), canvas: !!document.querySelector('#loader canvas') }));
  await rp.evaluate(() => AsteriaLoader.end());
  expect('[reduced-motion] loader is a simple spinner', rm.spinner && !rm.canvas && /reduced/.test(rm.cls), JSON.stringify(rm));
  await rctx.close();
  // ---- no artificial delay: a fast operation never shows the loader
  const fctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const fp = await fctx.newPage();
  await fp.goto(base); await fp.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series);
  const fast = await fp.evaluate(() => { const n0 = AsteriaLoader.shownCount(); return AsteriaLoader.track(new Promise(r => setTimeout(r, 50)), 'x').then(() => new Promise(r => setTimeout(() => r(AsteriaLoader.shownCount() - n0), 400))); });
  expect('loader not shown for a 50 ms operation (only after 250 ms)', fast === 0, 'shown ' + fast + ' times');
  await fctx.close();

  await browser.close();
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'No console errors or warnings.');
  console.log(fails.length ? 'UI CHECK FAILED: ' + fails.join('; ') : 'UI CHECK PASS');
  process.exit(errors.length || fails.length ? 1 : 0);
})();
