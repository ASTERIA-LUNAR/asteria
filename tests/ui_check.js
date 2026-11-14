#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Headless UI check: opens index.html via file:// (as a double-click would), exercises every page and
 * feature at laptop and phone sizes, collects console errors/warnings, checks invariants and writes
 * screenshots to tests/screenshots/. Usage: node tests/ui_check.js */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), url = require('url');

(async () => {
  const out = path.join(__dirname, 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const base = url.pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
  // On Windows, WebGL runs on the GPU through ANGLE/D3D11. (Chromium's software GL fallback logs
  // "GPU stall due to ReadPixels" driver notices as console warnings, which this check would count.)
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  const errors = [], fails = [];
  const expect = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) fails.push(name); };
  const ready = page => page.evaluate(() => window.AsteriaApp.ready());
  const shot = (page, name, full) => page.screenshot({ path: path.join(out, name + '.png'), fullPage: full !== false });

  for (const vp of [{ name: 'laptop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    // the 3D frame-rate probe can rebuild the view at a lower quality; it is tested on its own below
    await ctx.addInitScript(() => { window.ASTERIA_V3D_NOPROBE = true; });
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
    // ---- map fit: the data square fills the map panel on first load (no empty margins)
    const fitOk = m => m && m.left <= 1 && m.top <= 1 && m.right <= 1 && m.bottom <= 1 && (Math.abs(m.left + m.right) <= 2 || Math.abs(m.top + m.bottom) <= 2);
    const m0 = await page.evaluate(() => AsteriaMap.margins());
    expect(`${tag} first load: the data-coverage square fills the map panel (no empty margins)`, fitOk(m0), JSON.stringify(m0));
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

    // ---- 3D view (Deploy): lazy loading, Sun/Earth at the engine's az/el, time sync, controls, GPU memory freed
    const pre = await page.evaluate(() => ({ three: typeof window.THREE, v3d: typeof window.AsteriaView3D, tile: typeof window.ASTERIA_TERRAIN3D, scripts: [...document.scripts].map(s => s.src).filter(s => /three|view3d|terrain3d\/(?!index)/.test(s)).length }));
    expect(`${tag} 3D: Three.js, the 3D code and terrain tiles are not loaded before Deploy`, pre.three === 'undefined' && pre.v3d === 'undefined' && pre.tile === 'undefined' && pre.scripts === 0, JSON.stringify(pre));
    expect(`${tag} 3D: Deploy button shown for a curated south-pole site with a terrain tile`, await page.isVisible('#deployBtn'));
    const tOpen = Date.now();
    await page.click('#deployBtn');
    await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().frames >= 1, null, { timeout: 30000 });
    const openMs = Date.now() - tOpen;
    await page.waitForFunction(() => !AsteriaView3D.debug().refining, null, { timeout: 30000 });
    await page.waitForTimeout(250);
    const v3at = () => page.evaluate(() => {
      const d = AsteriaView3D.debug(), S = AsteriaApp.state, r = LunaEngine.sunEarthAt({ lat: S.site.lat, lon: S.site.lon }, new Date(S.series.t[S.idx]));
      return { d, idx: S.idx, sunUp: S.series.sunUp[S.idx], earthUp: S.series.earthUp[S.idx], sun: { az: r.sun.az, el: r.sun.el, rad: r.sun.radius_deg }, earth: { az: r.earth.az, el: r.earth.el, rad: r.earth.radius_deg },
        tiles: [document.getElementById('v3dTileSun').className, document.getElementById('v3dTileEarth').className], slider: +document.getElementById('timeSlider').value };
    });
    const dAz = (a, b, el) => Math.abs(((a - b + 540) % 360) - 180) * Math.cos(el * Math.PI / 180);
    const errs = v => ({
      sun: Math.max(dAz(v.d.sunLight.az, v.sun.az, v.sun.el), Math.abs(v.d.sunLight.el - v.sun.el)),
      earth: Math.max(dAz(v.d.earthAzEl.az, v.earth.az, v.earth.el), Math.abs(v.d.earthAzEl.el - v.earth.el)),
      size: Math.max(Math.abs(v.d.sunDiskRadiusDeg - v.sun.rad), Math.abs(v.d.earthRadiusDeg - v.earth.rad))
    });
    let v3 = await v3at(), e3 = errs(v3);
    console.log(`${tag} 3D opened in ${openMs} ms (incl. loading Three.js and the ${v3.d.vertices}-vertex tile; stride ${v3.d.stride})`);
    expect(`${tag} 3D: Sun light direction = engine az/el within 0.01° (light ${v3.d.sunLight.az.toFixed(4)}°/${v3.d.sunLight.el.toFixed(4)}°, engine ${v3.sun.az.toFixed(4)}°/${v3.sun.el.toFixed(4)}°)`, e3.sun < 0.01, 'error ' + e3.sun.toExponential(2) + '°');
    expect(`${tag} 3D: Earth at engine az/el within 0.01°, Sun and Earth angular sizes from the engine`, e3.earth < 0.01 && e3.size < 1e-6 && v3.d.earthRadiusDeg > 0.85 && v3.d.earthRadiusDeg < 1.05, 'error ' + e3.earth.toExponential(2) + '°, Earth diameter ' + (2 * v3.d.earthRadiusDeg).toFixed(3) + '°');
    expect(`${tag} 3D: status tiles = validated horizon model at the same time (same colours as the main app)`, v3.tiles[0] === 'tile ' + (v3.sunUp ? 'on-sun' : 'off') && v3.tiles[1] === 'tile ' + (v3.earthUp ? 'on-earth' : 'off') && v3.d.instant.idx === v3.idx, JSON.stringify(v3.tiles));
    const lbl = await page.evaluate(() => ({ note: document.querySelector('.v3d-shadownote').textContent, badge: document.getElementById('v3dExagBadge').textContent, notes: document.getElementById('v3dNotes').textContent }));
    expect(`${tag} 3D: shadow label, true-scale badge and the accurate/approximate notes are shown`, /^(Near-field shadows \(visual approximation\); distant terrain shadows not rendered|Shadows from terrain within \d+ km \(visual approximation\); farther terrain casts no shadows here); sunlit and Earth-visible status at the site marker come from the validated horizon model\.$/.test(lbl.note) && lbl.badge === 'Vertical scale 1× (true scale)' && /near-field estimate/.test(lbl.notes), JSON.stringify(lbl).slice(0, 200));
    await shot(page, vp.name + '_11_3d_orbit', false);
    // extended real terrain around the tile (ring A to 16 km at every level; casts shadows on Medium/High)
    const exT = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { q: d.quality, layers: d.layers, err: d.extError, notes: document.getElementById('v3dNotes').textContent, note: document.querySelector('.v3d-shadownote').textContent }; });
    const rA = exT.layers.find(l => l.name === 'ringA');
    expect(`${tag} 3D: extended LOLA terrain drawn around the tile (ring A, ${rA && rA.vertices} vertices; ${exT.q}: casts shadows ${rA && rA.cast}), labelled with source and grid`, rA && !exT.err && rA.cast === (exT.q !== 'low') && /Extended terrain<\/b>|Extended terrain: real LOLA heights to (16|40) km/.test(exT.notes) && /LDEM_80S_80M|LDEM_75S_120M/.test(exT.notes) && (exT.q === 'low' ? /Near-field/.test(exT.note) : /within (16|40) km/.test(exT.note)), JSON.stringify(exT.layers.map(l => l.name)));
    // time slider in 3D drives the main app (and back)
    const target = 37;
    await page.evaluate(i => { const s = document.getElementById('v3dSlider'); s.value = i; s.dispatchEvent(new Event('input', { bubbles: true })); }, target);
    await page.waitForTimeout(150);
    v3 = await v3at(); e3 = errs(v3);
    expect(`${tag} 3D: time slider synced with the main app; Sun/Earth/lighting updated (error ${e3.sun.toExponential(1)}°)`, v3.idx === target && v3.slider === target && v3.d.instant.idx === target && e3.sun < 0.01 && e3.earth < 0.01, JSON.stringify({ idx: v3.idx, slider: v3.slider, d: v3.d.instant.idx }));
    await page.evaluate(() => AsteriaApp.setIdx(5)); await page.waitForTimeout(100);
    expect(`${tag} 3D: main-app time change updates the 3D view`, await page.evaluate(() => AsteriaView3D.debug().instant.idx === 5 && +document.getElementById('v3dSlider').value === 5));
    // vertical exaggeration is clearly shown
    await page.selectOption('#v3dExag', '3'); await page.waitForTimeout(120);
    const ex3 = await page.evaluate(() => ({ b: document.getElementById('v3dExagBadge').textContent, k: AsteriaView3D.debug().exaggeration }));
    await page.selectOption('#v3dExag', '1'); await page.waitForTimeout(120);
    expect(`${tag} 3D: vertical exaggeration toggle (default 1×) is labelled on screen`, ex3.k === 3 && /Vertical exaggeration 3×/.test(ex3.b) && await page.evaluate(() => AsteriaView3D.debug().exaggeration === 1));
    // quality levels: automatic choice shown; override rebuilds the view at that level and is remembered
    const q0 = await page.evaluate(() => ({ d: AsteriaView3D.debug(), sel: document.getElementById('v3dQuality').value, why: document.getElementById('v3dQWhy').textContent }));
    expect(`${tag} 3D quality: automatic level from device hints is selected and explained (${q0.d.quality}: ${q0.why})`, q0.sel === q0.d.quality && /automatic/.test(q0.why) && (vp.isMobile ? q0.d.quality === 'low' : q0.d.quality !== 'low'), JSON.stringify(q0.d.autoQuality));
    const qOther = q0.d.quality === 'high' ? 'medium' : 'high';
    await page.selectOption('#v3dQuality', qOther);
    await page.waitForFunction(q => AsteriaView3D.debug().quality === q && AsteriaView3D.debug().frames >= 1 && !AsteriaView3D.debug().refining, qOther);
    const q1 = await page.evaluate(() => ({ Q: AsteriaView3D.QUALITY, d: AsteriaView3D.debug(), ls: localStorage.getItem('asteria.v3dQuality'), why: document.getElementById('v3dQWhy').textContent, idx: AsteriaApp.state.idx }));
    expect(`${tag} 3D quality: override to ${qOther} rebuilds the view (shadow map ${q1.d.shadowMapSize} px, pixel ratio ≤ ${q1.Q[qOther].pr}), keeps the time and is remembered`, q1.d.shadowMapSize === q1.Q[qOther].shadow && q1.ls === qOther && /your choice/.test(q1.why) && q1.d.instant.idx === q1.idx && q1.d.mode === 'orbit', JSON.stringify({ q: q1.d.quality, sm: q1.d.shadowMapSize, ls: q1.ls }));
    await page.evaluate(() => { localStorage.removeItem('asteria.v3dQuality'); });
    await page.evaluate(q => AsteriaView3D.testQuality(q), q0.d.quality);
    await page.waitForFunction(q => AsteriaView3D.debug().quality === q && !AsteriaView3D.debug().refining, q0.d.quality);
    // brightness: display only - the light direction and the status tiles do not change
    const b0 = await page.evaluate(() => ({ d: AsteriaView3D.debug(), t: [document.getElementById('v3dTileSun').className, document.getElementById('v3dTileEarth').className] }));
    await page.click('#v3dLightUp'); await page.waitForTimeout(150);
    const b1 = await page.evaluate(() => ({ d: AsteriaView3D.debug(), t: [document.getElementById('v3dTileSun').className, document.getElementById('v3dTileEarth').className], ls: localStorage.getItem('asteria.v3dBrightness'), note: document.getElementById('v3dBrightNote').textContent }));
    const sameDir = b0.d.sunLightDir.every((x, k) => x === b1.d.sunLightDir[k]) && b0.d.sunLight.el === b1.d.sunLight.el && b0.d.sunIntensity === b1.d.sunIntensity;
    expect(`${tag} 3D brightness: "Light up" changes only display brightness (exposure ${b0.d.exposure} -> ${b1.d.exposure}, fill ${b0.d.fillIntensity.toFixed(2)} -> ${b1.d.fillIntensity.toFixed(2)}); Sun light direction, Sun intensity and status tiles unchanged; remembered; labelled`,
      b1.d.exposure > b0.d.exposure && sameDir && JSON.stringify(b0.t) === JSON.stringify(b1.t) && +b1.ls === b1.d.brightness && /Display brightness only \(like camera exposure\)\. Real polar shadows are almost black; this does not change the computed lighting\./.test(b1.note));
    await page.evaluate(() => AsteriaView3D.testBrightness(1));
    // real-data overlays: contour lines (interval labelled) and slope shading from the DEM; regolith shading + uniform albedo stated
    await page.click('#v3dContours'); await page.click('#v3dSlope'); await page.waitForTimeout(150);
    const ovl = await page.evaluate(() => ({ d: AsteriaView3D.debug().overlays, iv: document.getElementById('v3dContourInt').value, leg: document.getElementById('v3dLegend').textContent, notes: document.getElementById('v3dNotes').textContent }));
    expect(`${tag} 3D: contour lines (every ${ovl.iv} m) and slope shading toggle on, with a legend; Lommel-Seeliger shading and uniform albedo explained`, ovl.d.contour === +ovl.iv && ovl.d.slope === 1 && new RegExp("Contour lines every " + ovl.iv + " m").test(ovl.leg) && /Slope from the DEM/.test(ovl.leg) && /Lommel-Seeliger/.test(ovl.notes) && /Uniform albedo/.test(ovl.notes) && /No synthetic rocks/.test(ovl.notes), JSON.stringify(ovl.d));
    await page.click('#v3dContours'); await page.click('#v3dSlope');
    // real stars: catalogue loaded on demand, labelled; Sirius drawn at the direction computed for the shown time
    await page.click('#v3dStars');
    await page.waitForFunction(() => { const d = AsteriaView3D.debug(); return d.stars && d.stars.visible; }, null, { timeout: 15000 });
    const stv = await page.evaluate(() => {
      const d = AsteriaView3D.debug(), S = AsteriaApp.state, t = new Date(d.instant.t), r = ASTERIA_STARS.rows.find(x => x[0] === 2491);
      const yrs = (t.getTime() - Date.UTC(2000, 0, 1, 12)) / (365.25 * 86400000), dir = AsteriaView3DMath.starDirs([r], LunaEngine._moonFrame(t), S.site.lat, S.site.lon, yrs);
      return { d: d.stars, drawn: AsteriaView3D.starAzEl(2491), want: AsteriaView3DMath.azElFromDir([dir[0], dir[1], dir[2]]), note: document.getElementById('v3dStarNote').hidden ? '' : document.getElementById('v3dStarNote').textContent, notes: document.getElementById('v3dNotes').textContent };
    });
    expect(`${tag} 3D: real stars (${stv.d.n} from the Bright Star Catalogue to magnitude ${stv.d.magLimit}) drawn at their computed directions for the shown time, with the camera note`, stv.d.n > 200 && Math.abs(stv.drawn.el - stv.want.el) < 1e-3 && /Real star positions; cameras usually cannot see stars when the Sun or sunlit ground is in view\./.test(stv.note) && /Yale Bright Star Catalogue/.test(stv.notes), JSON.stringify({ drawn: stv.drawn, want: stv.want }));
    await page.click('#v3dStars');
    // Earth: Blue Marble texture; the textured mesh's point facing the site = computed sub-observer point; caption
    await page.waitForFunction(() => AsteriaView3D.debug().earthTexture, null, { timeout: 15000 });
    const ea = await page.evaluate(() => {
      const s = AsteriaView3D.testScene(), d = AsteriaView3D.debug(), THREE = window.THREE;
      const o = new THREE.Vector3().fromArray(d.earthDir).negate().applyQuaternion(s.earth.quaternion.clone().invert());   // in the sphere's own frame
      const lat = Math.asin(o.y) * 180 / Math.PI, lon = Math.atan2(-o.z, o.x) * 180 / Math.PI;
      return { tex: d.earthTexture, sub: d.subObserver, mesh: { lat, lon }, cap: document.getElementById('v3dEarthNote').textContent, phase: d.earthPhase.illuminated };
    });
    const dl = Math.max(Math.abs(ea.mesh.lat - ea.sub.lat), Math.abs(((ea.mesh.lon - ea.sub.lon + 540) % 360) - 180));
    expect(`${tag} 3D Earth: Blue Marble ${ea.tex} px map; the textured globe faces the site at the computed sub-observer point (${ea.sub.lon.toFixed(1)}°E, ${ea.sub.lat.toFixed(1)}°; mesh ${dl.toExponential(1)}° off); caption shown`, ea.tex > 0 && dl < 0.01 && /^Earth: continents from NASA Blue Marble \(cloud-free composite\); clouds not shown; orientation computed for this time\.$/.test(ea.cap), JSON.stringify(ea));
    // labels of Sun and Earth say when the validated model has them below the horizon or hidden by terrain
    const lb = await page.evaluate(() => {
      const S = AsteriaApp.state, out = [];
      for (let i = 0; i < S.series.t.length; i += 7) {
        AsteriaApp.setIdx(i);
        const d = AsteriaView3D.debug();
        out.push({ su: S.series.sunUp[i], eu: S.series.earthUp[i], sel: d.instant.sun.el, eel: d.instant.earth.el, ls: d.labelSun, le: d.labelEarth, glare: d.glare });
      }
      AsteriaApp.setIdx(0);
      return out;
    });
    const lbOk = lb.every(x => (x.su ? x.ls === 'Sun' : x.ls === (x.sel < 0 ? 'Sun (below horizon)' : 'Sun (hidden by terrain)')) && (x.eu ? x.le === 'Earth' : /^Earth \((below horizon|hidden by terrain|below your minimum link elevation)\)$/.test(x.le)) && (!x.glare || x.su));
    expect(`${tag} 3D: Sun/Earth labels follow the validated status at ${lb.length} times ("${[...new Set(lb.map(x => x.ls).concat(lb.map(x => x.le)))].join('", "')}"); no glare from a hidden Sun`, lbOk);
    // interpretation aids: oblique default framing, compass, scale bar, distance, mini-map, IAU feature labels
    const aid = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { d, cap: document.getElementById('v3dMiniCap').textContent, notes: document.getElementById('v3dNotes').innerHTML, head: document.getElementById('v3dHeading').textContent, sc: document.getElementById('v3dScaleTxt').textContent, dist: document.getElementById('v3dDist').textContent }; });
    expect(`${tag} 3D: compass ("${aid.head}"), scale bar ("${aid.sc}"), distance readout and mini-map ("${aid.cap.slice(0, 40)}…") shown`, aid.d.hud && /^Facing (N|NE|E|SE|S|SW|W|NW) \(\d+°\)$/.test(aid.head) && /\d+ (m|km) \(at the view centre\)/.test(aid.sc) && /from the site/.test(aid.dist) && aid.d.miniMap && /north up/.test(aid.cap));
    expect(`${tag} 3D: named features from the IAU Gazetteer (${(aid.d.features || []).map(f => f.name + (f.onGround ? '' : ' (direction)')).join(', ')}), with Gazetteer links in the notes`, aid.d.features && aid.d.features.length >= 1 && aid.d.features.length <= 5 && /planetarynames\.wr\.usgs\.gov\/Feature\/\d+/.test(aid.notes), JSON.stringify(aid.d.features && aid.d.features.map(f => f.text)));
    // orbit: keyboard and mouse
    const cam0 = (await v3at()).d.camera;
    await page.evaluate(() => AsteriaView3D.testKey('ArrowLeft', true)); const tf = Date.now(), f0 = (await v3at()).d.frames;
    await page.waitForTimeout(1500);
    const f1 = (await v3at()).d.frames, fps = (f1 - f0) / ((Date.now() - tf) / 1000);
    await page.evaluate(() => AsteriaView3D.testKey('ArrowLeft', false));
    const cam1 = (await v3at()).d.camera;
    console.log(`${tag} 3D: ${fps.toFixed(0)} frames/s while orbiting (headless Chromium, ${process.platform === 'win32' ? 'GPU via ANGLE/D3D11' : 'default GL'})`);
    expect(`${tag} 3D: orbit camera moves with the keyboard and renders continuously while moving`, Math.hypot(cam1[0] - cam0[0], cam1[2] - cam0[2]) > 50 && fps > 10, fps.toFixed(0) + ' fps');
    const cb = await page.locator('#v3dStage > canvas').boundingBox();
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.mouse.down(); await page.mouse.move(cb.x + cb.width / 2 + 120, cb.y + cb.height / 2 + 30, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(100);
    const cam2 = (await v3at()).d.camera;
    expect(`${tag} 3D: mouse drag rotates the orbit camera`, Math.hypot(cam2[0] - cam1[0], cam2[2] - cam1[2]) > 50);
    // walk mode follows the terrain (eye 2 m above the mesh), on-screen pad works
    await page.click('.v3d .seg button[data-mode="walk"]'); await page.waitForTimeout(100);
    const w0 = (await v3at()).d.camera;
    await page.dispatchEvent('#v3dPad button[data-k="fwd"]', 'pointerdown'); await page.waitForTimeout(900); await page.dispatchEvent('#v3dPad button[data-k="fwd"]', 'pointerup'); await page.waitForTimeout(100);
    const w1 = (await v3at()).d;
    expect(`${tag} 3D: walk mode (on-screen button) moves over the terrain with the eye 2 m above the ground`, Math.hypot(w1.camera[0] - w0[0], w1.camera[2] - w0[2]) > 3 && Math.abs(w1.eyeAboveGround - 2) < 0.05, 'eye ' + w1.eyeAboveGround.toFixed(3) + ' m');
    await shot(page, vp.name + '_12_3d_walk', false);
    // rover: drive, readouts, slope warning, near-field label
    await page.click('.v3d .seg button[data-mode="rover"]');
    await page.evaluate(() => AsteriaView3D.testKey('KeyW', true)); await page.waitForTimeout(1200); await page.evaluate(() => AsteriaView3D.testKey('KeyW', false));
    await page.fill('#v3dSlopeMax', '1'); await page.dispatchEvent('#v3dSlopeMax', 'change'); await page.waitForTimeout(400);
    await page.click('#v3dRings'); await page.waitForTimeout(150);
    const trk = await page.evaluate(() => { const d = AsteriaView3D.debug(); return { track: d.track, rings: d.distRings, dist: document.getElementById('v3dDist').textContent }; });
    expect(`${tag} 3D rover: fading track (${trk.track} points), 500 m distance rings (${trk.rings.n}) and distance driven shown`, trk.track > 1 && trk.rings.visible && trk.rings.n === 5 && /driven/.test(trk.dist), JSON.stringify(trk));
    await page.click('#v3dRings');
    const rv = await page.evaluate(() => ({ r: AsteriaView3D.debug().rover, warn: !document.getElementById('v3dRWarn').hidden, wt: document.getElementById('v3dRWarn').textContent, sun: document.getElementById('v3dRSun').textContent, slope: document.getElementById('v3dRSlope').textContent }));
    expect(`${tag} 3D rover: drives, shows position / DEM elevation / slope, warns above the user's threshold, near-field Sun labelled`, rv.r && rv.r.dist > 2 && isFinite(rv.r.h) && isFinite(rv.r.slope) && rv.warn === (rv.r.slope > 1) && /near-field estimate/.test(rv.sun), JSON.stringify(rv).slice(0, 260));
    await page.fill('#v3dSlopeMax', '15'); await page.dispatchEvent('#v3dSlopeMax', 'change');
    await shot(page, vp.name + '_13_3d_rover', false);
    // close (button on laptop, Escape on phone): GPU resources released, DOM removed, app untouched
    if (vp.isMobile) await page.keyboard.press('Escape'); else await page.click('#v3dClose');
    await page.waitForTimeout(700);
    const cl = await page.evaluate(() => ({ d: AsteriaView3D.debug(), el: !!document.getElementById('v3d'), cls: document.body.classList.contains('v3d-open'), canv: document.querySelectorAll('canvas[data-engine]').length + document.querySelectorAll('.v3d-stage canvas').length }));
    expect(`${tag} 3D: leaving 3D (${vp.isMobile ? 'Escape' : 'Close button'}) frees GPU memory (0 geometries, 0 textures) and removes the view`, !cl.d.open && cl.d.lastClosed.afterDispose.geometries === 0 && cl.d.lastClosed.afterDispose.textures === 0 && !cl.el && !cl.cls && cl.canv === 0, JSON.stringify(cl));
    expect(`${tag} 3D: on phones the mesh resolution is reduced automatically`, vp.isMobile ? v3.d.stride === 2 : v3.d.stride === 1, 'stride ' + v3.d.stride + ', ' + v3.d.vertices + ' vertices');
    await page.evaluate(() => AsteriaApp.setIdx(0));
    // frame-rate probe: a (simulated) low frame rate steps the quality down one level, with a note
    if (!vp.isMobile) {
      await page.evaluate(() => { window.ASTERIA_V3D_NOPROBE = false; window.ASTERIA_V3D_FAKE_FPS = 20; localStorage.removeItem('asteria.v3dQuality'); });
      await page.click('#deployBtn');
      await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().probe, null, { timeout: 15000 });
      const pr = await page.evaluate(() => ({ d: AsteriaView3D.debug(), note: document.getElementById('v3dQNote').textContent, hidden: document.getElementById('v3dQNote').hidden }));
      expect(`${tag} 3D quality: frame-rate probe below 30 fps (simulated 20) steps down one level and says so`, pr.d.probe.stepped && pr.d.quality === ['low', 'medium', 'high'][['low', 'medium', 'high'].indexOf(pr.d.probe.from) - 1] && !pr.hidden && /lowered to/.test(pr.note), JSON.stringify(pr.d.probe) + ' ' + pr.note);
      await page.evaluate(() => { window.ASTERIA_V3D_NOPROBE = true; delete window.ASTERIA_V3D_FAKE_FPS; AsteriaView3D.close(true); });
    }
    // the Deploy button is hidden for sites without a 3D tile (reference site outside the pole)
    await page.evaluate(() => AsteriaApp.selectSiteById('apollo11')); await ready(page);
    expect(`${tag} 3D: no Deploy button for a site without a terrain tile`, await page.isHidden('#deployBtn'));
    await page.evaluate(() => AsteriaApp.selectSiteById('peak_shackleton_lw')); await ready(page);

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
    // clicking outside the data square selects nothing and shows the coverage message. At the fitted zoom no
    // area outside the data is on screen, so the click is delivered through Leaflet's own click event.
    const selBefore = await page.evaluate(() => ({ lat: AsteriaApp.state.site.lat, lon: AsteriaApp.state.site.lon }));
    for (const f of [1.03, 1.5]) {
      await page.evaluate(f => { const m = AsteriaMap.leaflet(), H = LUNA_TILES.halfExtent_m, q = AsteriaMap.unproject(H * f, -H * 0.2), ll = L.latLng(q.lat, q.lon); m.fire('click', { latlng: ll, layerPoint: m.latLngToLayerPoint(ll), containerPoint: m.latLngToContainerPoint(ll) }); }, f);
      await page.waitForTimeout(250);
      const o = await page.evaluate(() => ({ note: document.getElementById('mapNote').hidden ? '' : document.getElementById('mapNote').textContent, lat: AsteriaApp.state.site.lat, lon: AsteriaApp.state.site.lon, computing: AsteriaApp.state.computing }));
      expect(`${tag} click outside the map data (${f} x half-width): no point selected, coverage message shown`, o.lat === selBefore.lat && o.lon === selBefore.lon && !o.computing && /No elevation data here - this map covers the lunar south pole \(about 80°S to the pole\)\./.test(o.note), JSON.stringify(o));
    }
    // panning is limited to the data square
    const cen = await page.evaluate(() => { const m = AsteriaMap.leaflet(); m.panBy([6000, 6000], { animate: false }); const c = m.getCenter(), p = AsteriaMap.project(c.lat, c.lng), H = LUNA_TILES.halfExtent_m; return { x: p.x / H, y: p.y / H }; });
    expect(`${tag} panning is limited to the area covered by the map data`, Math.abs(cen.x) <= 1.0001 && Math.abs(cen.y) <= 1.0001, JSON.stringify(cen));
    // "Whole pole" after zooming in: fills the panel again
    await page.evaluate(() => AsteriaMap.leaflet().setZoom(5, { animate: false }));
    await page.click('#homeBtn'); await page.waitForTimeout(900);
    const m1 = await page.evaluate(() => AsteriaMap.margins());
    const mc = await page.evaluate(() => { const c = AsteriaMap.leaflet().getCenter(); return Math.abs(c.lat + 90) < 1e-6; });
    expect(`${tag} "Whole pole" button: data-coverage square fills the map panel, centred on the pole`, fitOk(m1) && mc, JSON.stringify(m1));
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
    // ---- long countdowns: plain "Not within the next N days (search limit)" text, never "> N days"
    await pickSite('shackleton_centre');
    const lim = await page.evaluate(() => ({ sl: document.getElementById('sunCountLbl').textContent, s: document.getElementById('sunCount').textContent, el: document.getElementById('earthCountLbl').textContent, e: document.getElementById('earthCount').textContent,
      ml: document.getElementById('missionCountLbl').textContent, m: document.getElementById('missionCount').textContent, why: document.getElementById('sunLimitWhy').textContent,
      whyShown: getComputedStyle(document.getElementById('sunLimitWhy')).display !== 'none', w: AsteriaApp.state.windowDays }));
    const lim430 = 'Not within the next ' + (lim.w + 400) + ' days (search limit)';
    expect(`${tag} no sunrise/Earthrise found: tiles say "${lim430}" (no "> N days"), with a one-line explanation in Explain mode`,
      lim.sl === 'Next sunrise:' && lim.s === lim430 && lim.el === 'Next Earthrise:' && lim.e === lim430 && lim.ml === 'Next change:' && lim.m === lim430 &&
      ![lim.s, lim.e, lim.m].some(x => /^>/.test(x)) && lim.whyShown && /searched \d+ days ahead/.test(lim.why), JSON.stringify(lim));
    await page.uncheck('#explainToggle'); await page.waitForTimeout(100);
    expect(`${tag} limit explanation hidden when Explain mode is off`, await page.evaluate(() => getComputedStyle(document.getElementById('sunLimitWhy')).display === 'none'));
    await page.check('#explainToggle');
    await shot(page, vp.name + '_2b_search_limit', false);
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
    expect(`${tag} 365-day window computed off the main thread (page answered within ${maxLag} ms), took ${Date.now() - t0} ms; loader shown only if > 250 ms`, maxLag < 250 && after.n === 8761 && (Date.now() - t0 < 250 + 150 /* test polling overhead */ || after.shown > before), JSON.stringify(after));
    await page.selectOption('#windowSel', '30'); await ready(page);

    // ---- expert / explain
    // Sky view for beginners: plain caption, terrain named, visible/hidden tags = validated status; Expert keeps the detailed chart
    const sky0 = await page.evaluate(() => ({ cap: document.getElementById('skyCaption').textContent, lg: document.getElementById('skyTerrainLg').textContent, tags: AsteriaApp.state.skyTags, su: AsteriaApp.state.series.sunUp[AsteriaApp.state.idx], eu: AsteriaApp.state.series.earthUp[AsteriaApp.state.idx] }));
    const tagOk = sky0.tags && sky0.tags.some(t => t.startsWith('Sun now: ' + (sky0.su ? 'visible' : 'hidden'))) && sky0.tags.some(t => t.startsWith('Earth now: ' + (sky0.eu ? 'visible' : 'hidden')));
    expect(`${tag} Sky view (beginner): "How to read this" caption, terrain named "${sky0.lg}", Sun/Earth tags match the validated status (${(sky0.tags || []).join('; ')})`, /^How to read this: If the Sun or Earth is above the brown shape, it can be seen from the site; below it, it is hidden\./.test(sky0.cap) && sky0.lg === 'Mountains and crater walls (LOLA terrain)' && tagOk);
    await page.check('#expertToggle'); await page.waitForTimeout(150);
    const sky1 = await page.evaluate(() => ({ cap: document.getElementById('skyCaption').textContent, lg: document.getElementById('skyTerrainLg').textContent }));
    expect(`${tag} Sky view (Expert): the detailed chart and caption are kept`, /^Brown: /.test(sky1.cap) && sky1.lg === 'Terrain skyline', sky1.cap.slice(0, 60));
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
    const cmpLim = await page.evaluate(() => /> window/.test(document.getElementById('cmpResult').textContent));
    expect(`${tag} Compare never shows "> window"`, !cmpLim);
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
  // ---- first-visit intro (title card). Automated browsers skip it unless the test opts in with ASTERIA_INTRO_TEST.
  {
    const ictx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ictx.addInitScript(() => { window.ASTERIA_INTRO_TEST = true; });
    const ip = await ictx.newPage();
    ip.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[intro] console.${m.type()}: ${m.text()}`); });
    ip.on('pageerror', e => errors.push(`[intro] pageerror: ${e.message}`));
    const tg = Date.now();
    await ip.goto(base);
    const i0 = await ip.evaluate(() => ({ shown: !!document.getElementById('intro'), txt: (document.getElementById('intro') || {}).textContent || '', ms: AsteriaIntro.INTRO_MS, seen: localStorage.getItem('asteria.introSeen') }));
    expect('[intro] shows on a fresh first visit: rocket, "ASTERIA", subtitle, Skip; no loading claim; INTRO_MS = 3000', i0.shown && /ASTERIA/.test(i0.txt) && /Lunar South Pole Landing Site Navigator/.test(i0.txt) && /Skip/.test(i0.txt) && !/loading/i.test(i0.txt) && i0.ms === 3000 && i0.seen === '1', JSON.stringify(i0));
    await ip.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series, null, { timeout: 30000 });
    const behind = await ip.evaluate(() => ({ intro: AsteriaIntro.isShown(), hint: !document.getElementById('hint').hidden }));
    expect(`[intro] the app computes normally behind the intro (first results after ${Date.now() - tg} ms while the intro is still up; hint waits)`, behind.intro && !behind.hint && Date.now() - tg < 3000, JSON.stringify(behind));
    await shot(ip, 'intro_1_title_card', false);
    await ip.click('#introSkip'); await ip.waitForTimeout(400);
    expect('[intro] Skip button closes it; the getting-started hint follows', await ip.evaluate(() => !document.getElementById('intro') && !AsteriaIntro.isShown()) && await ip.waitForSelector('#hint', { state: 'visible', timeout: 3000 }).then(() => true, () => false));
    await ip.goto('about:blank'); await ip.goto(base); await ip.waitForTimeout(300);   // (reload() would keep the app's #site= hash)
    expect('[intro] not shown on the second visit', await ip.evaluate(() => !document.getElementById('intro') && AsteriaIntro.autoSkipReason() === 'seen'));
    // replay from the About page; any key skips
    await ip.evaluate(() => { localStorage.setItem('asteria.hintDismissed', '1'); document.getElementById('hint').hidden = true; });
    await ip.click('.tab[data-page="about"]'); await ip.click('#replayIntro'); await ip.waitForTimeout(150);
    const rp1 = await ip.evaluate(() => AsteriaIntro.isShown());
    await ip.keyboard.press('KeyX'); await ip.waitForTimeout(350);
    expect('[intro] "Replay intro" on the About page plays it; a key press skips it', rp1 && await ip.evaluate(() => !document.getElementById('intro')));
    await ictx.close();
    // auto-dismiss after INTRO_MS, tap/click anywhere skips, share link and reduced motion skip it automatically
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c2.addInitScript(() => { window.ASTERIA_INTRO_TEST = true; });
    const p2 = await c2.newPage();
    p2.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[intro2] console.${m.type()}: ${m.text()}`); });
    p2.on('pageerror', e => errors.push(`[intro2] pageerror: ${e.message}`));
    await p2.goto(base); await p2.waitForTimeout(200);
    const shownPhone = await p2.evaluate(() => AsteriaIntro.isShown());
    await shot(p2, 'intro_2_phone', false);
    await p2.waitForTimeout(3300);
    expect('[intro] phone: shown, then closes by itself after INTRO_MS (3 s)', shownPhone && await p2.evaluate(() => !document.getElementById('intro')));
    await p2.evaluate(() => { localStorage.clear(); }); await p2.goto('about:blank'); await p2.goto(base); await p2.waitForTimeout(150);
    await p2.tap('#intro'); await p2.waitForTimeout(350);
    expect('[intro] a tap anywhere skips it', await p2.evaluate(() => !document.getElementById('intro')));
    await p2.evaluate(() => { localStorage.clear(); });
    await p2.goto('about:blank'); await p2.goto(base + '#site=im2&t=2027-01-01T00:00Z&w=7'); await p2.waitForTimeout(300);
    expect('[intro] not shown when the URL has a share-link hash (#site=...)', await p2.evaluate(() => !document.getElementById('intro') && AsteriaIntro.autoSkipReason() === 'share-link'));
    await p2.evaluate(() => { localStorage.clear(); });
    await p2.goto('about:blank'); await p2.goto(base + '#lat=-89.9&lon=45'); await p2.waitForTimeout(300);
    expect('[intro] not shown with a #lat=... share link', await p2.evaluate(() => !document.getElementById('intro') && AsteriaIntro.autoSkipReason() === 'share-link'));
    await c2.close();
    const c3 = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
    await c3.addInitScript(() => { window.ASTERIA_INTRO_TEST = true; });
    const p3 = await c3.newPage(); await p3.goto(base); await p3.waitForTimeout(300);
    expect('[intro] not shown with prefers-reduced-motion', await p3.evaluate(() => !document.getElementById('intro') && AsteriaIntro.autoSkipReason() === 'reduced-motion'));
    await c3.close();
    const c4 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const p4 = await c4.newPage(); await p4.goto(base); await p4.waitForTimeout(300);
    expect('[intro] automated tests skip it unless they opt in', await p4.evaluate(() => !document.getElementById('intro') && AsteriaIntro.autoSkipReason() === 'automated'));
    await c4.close();
  }
  // ---- no artificial delay: a fast operation never shows the loader
  const fctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const fp = await fctx.newPage();
  await fp.goto(base); await fp.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series); await fp.evaluate(() => AsteriaApp.ready());
  const fast = await fp.evaluate(() => { const n0 = AsteriaLoader.shownCount(); return AsteriaLoader.track(new Promise(r => setTimeout(r, 50)), 'x').then(() => new Promise(r => setTimeout(() => r(AsteriaLoader.shownCount() - n0), 400))); });
  expect('loader not shown for a 50 ms operation (only after 250 ms)', fast === 0, 'shown ' + fast + ' times');
  await fctx.close();

  await browser.close();
  console.log(errors.length ? 'CONSOLE ERRORS:\n' + errors.join('\n') : 'No console errors or warnings.');
  console.log(fails.length ? 'UI CHECK FAILED: ' + fails.join('; ') : 'UI CHECK PASS');
  process.exit(errors.length || fails.length ? 1 : 0);
})();
