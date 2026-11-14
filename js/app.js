/* ASTERIA web app. No build step; all data comes from <script> tags (works from file://).
 * Heavy computation runs in a Blob Web Worker via js/jobs.js (main-thread fallback). */
(function () {
  'use strict';
  var E = window.LunaEngine;
  var SITES = window.LUNA_SITES || [];
  var HZ = window.LUNA_HORIZONS || {};
  var REG = window.LUNA_ARTEMIS_REGIONS || { regions: [] };
  var EXPL = window.ASTERIA_EXPLAIN || {};
  var Jobs = window.AsteriaJobs, Loader = window.AsteriaLoader, Map = window.AsteriaMap;
  var DAY = 86400000;
  var DEFAULT_SITE = 'peak_shackleton_lw';
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (id) { return document.getElementById(id); };
  // One colour per meaning, everywhere: Sun amber, Earth blue, both green, neither grey.
  var C = {
    sun: '#ffc23d', earth: '#4ea8ff', both: '#5ee27a', neither: '#6f7890', terrain: '#3a3128', terrainLine: '#9c8670',
    grid: '#1c2a45', text: '#8fa1bf', bg: '#070b14', smooth: '#262d3d'
  };

  // ------------------------------------------------------------------ state
  var S = {
    site: null, useTerrain: true, start: null, windowDays: 30, minEl: 0,
    series: null, events: { sun: [], earth: [] }, after: {}, stats: null, idx: 0, playing: false, speed: 4,
    fullSky: false, computing: false, token: 0, ready: null
  };

  // ------------------------------------------------------------- utilities
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtUTC(d) {
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }
  function fmtShort(d) { return pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  // Riyadh: Arabia Standard Time, UTC+3 all year (no daylight saving).
  function fmtRiyadh(d) { return fmtUTC(new Date(d.getTime() + 3 * 3600000)); }
  function toInput(d) { return fmtUTC(d).replace(' ', 'T'); }
  function fromInput(v) { var d = new Date(v + ':00Z'); return isNaN(d) ? null : d; }
  function fmtDur(ms) {
    if (ms < 0) ms = 0;
    var m = Math.round(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    if (d > 0) return d + 'd ' + pad(h) + 'h ' + pad(mm) + 'm';
    return h + 'h ' + pad(mm) + 'm';
  }
  function fmtHours(h) { return h >= 48 ? (h / 24).toFixed(1) + ' d' : h.toFixed(1) + ' h'; }
  function fmtDeg(x, n) { return (x >= 0 ? '+' : '') + x.toFixed(n === undefined ? 2 : n) + '°'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function siteById(id) { for (var i = 0; i < SITES.length; i++) if (SITES[i].id === id) return SITES[i]; return null; }
  // Terrain horizon: curated sites use the 20 m-based masks (data/horizons); a clicked/typed custom point inside
  // the map uses a horizon computed from the downsampled 240 m DEM (site.hz), only because that passed validation.
  function maskFor(site, useTerrain) {
    if (!useTerrain || !site) return null;
    if (!site.id) return site.hz ? site.hz.elevations : null;
    return HZ[site.id] ? HZ[site.id].elevations : null;
  }
  function hasTerrain(site) { return !!(site && (site.id ? HZ[site.id] : site.hz)); }
  function isCoarse(site) { return !!(site && !site.id && site.hz); }
  function terrainName(site) { return isCoarse(site) ? 'terrain from coarser 240 m data' : 'LOLA terrain'; }
  function isPolar(site) { return site && site.lat <= -79; }
  function inMap(site) { return !!(site && Map.inData && Map.inData(site.lat, site.lon)); }
  function siteObj() { return { lat: S.site.lat, lon: S.site.lon }; }
  function minElText() { return S.minEl ? 'Earth link = Earth at least ' + S.minEl + '° above the terrain horizon' : 'Earth link = Earth centre above the terrain horizon (minimum elevation 0°)'; }
  function fitCanvas(c, cssH) {
    var dpr = window.devicePixelRatio || 1;
    var w = c.clientWidth || c.parentNode.clientWidth;
    c.style.height = cssH + 'px';
    c.width = Math.round(w * dpr); c.height = Math.round(cssH * dpr);
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: cssH };
  }
  function minMax(a) { var lo = Infinity, hi = -Infinity; for (var i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; } return [lo, hi]; }
  function q(key) { return EXPL[key] ? '<span class="q" data-q="' + key + '"></span>' : ''; }

  // ---------------------------------------------------------- site groups
  function siteGroup(s) {
    if (!isPolar(s)) return 'outside';
    if (s.artemisRegions) return 'artemis';
    if (s.status === 'reference') return 'polarref';
    return 'polar';
  }
  var GROUPS = [
    ['artemis', 'NASA Artemis III candidate regions (Oct 2024)', 'A region is plotted only where a point is genuinely inside it (the centre of the named landform, or a published point). Region boundaries are not plotted.'],
    ['polar', 'South pole: missions, targets and published points', ''],
    ['polarref', 'South pole: reference feature', ''],
    ['outside', 'Reference sites (outside the south pole)', 'Smooth horizon, terrain not included. For comparison and education.']
  ];
  function regionIndex(s) {   // Artemis features in NASA's list order
    for (var i = 0; i < REG.regions.length; i++) if (REG.regions[i].sites.indexOf(s.id) >= 0) return i;
    return 99;
  }
  function siteOrder(a, b) {
    var d = (a.id === DEFAULT_SITE ? -1 : 0) - (b.id === DEFAULT_SITE ? -1 : 0);
    if (d) return d;
    if (a.artemisRegions && b.artemisRegions) return regionIndex(a) - regionIndex(b);
    return 0;
  }
  function kindText(s) {
    if (!s.id) return s.hz ? 'Custom point · terrain from coarser 240 m data (less precise than curated sites)' : inMap(s) ? 'Custom point · smooth horizon (a Moon without mountains)' : 'Custom point outside the south-pole map · smooth horizon (a Moon without mountains)';
    if (s.artemisRegions && s.landformCentre) return 'Artemis III region: ' + s.artemisRegions.join(' / ') + ' · centre of the named landform; region boundary not plotted';
    if (s.regionPoint) return 'Artemis III region: ' + s.artemisRegions.join(' / ') + ' · published point inside the region (independent study); region boundary not plotted';
    if (/^DERIVED/.test(s.coordKind)) return 'Derived by ASTERIA: best-supported point near Peak near Shackleton (not a published coordinate)';
    if (!isPolar(s)) return 'Reference site (outside the south pole) · smooth horizon, terrain not included';
    return s.coordKind;
  }

  // ------------------------------------------------------------- compute
  function nextEventAfter(body, t) {
    var ev = S.events[body];
    for (var i = 0; i < ev.length; i++) if (ev[i].time.getTime() > t) return ev[i];
    return S.after[body];
  }
  // Recompute the Explore window (worker). Returns a promise resolved when rendered.
  function recompute() {
    var token = ++S.token;
    var end = new Date(S.start.getTime() + S.windowDays * DAY);
    var step = E.defaultStepMin(S.start, end);
    var args = { site: siteObj(), start: S.start.getTime(), end: end.getTime(), step: step, mask: maskFor(S.site, S.useTerrain), minEl: S.minEl };
    S.computing = true; document.body.classList.add('computing');
    var p = Loader.track(Jobs.run('explorer', args), S.windowDays >= 90 ? 'Computing ' + S.windowDays + ' days…' : 'Computing…').then(function (r) {
      if (token !== S.token) return;
      S.series = r.series; S.events = r.events; S.after = r.after; S.stats = r.stats;
      S.computing = false; document.body.classList.remove('computing');
      var sl = $('timeSlider');
      sl.max = S.series.t.length - 1;
      if (S.idx > S.series.t.length - 1) S.idx = 0;
      sl.value = S.idx;
      $('stepNote').textContent = 'Basis: validated engine (Sun and Earth centre vs horizon); horizon = ' + (args.mask ? terrainName(S.site) + ' (observer 2 m above ground)' : 'smooth Moon (0°)') + (S.minEl ? '; Earth needs ' + S.minEl + '° above it' : '') + '. Sampling every ' + step + ' min (' + S.series.t.length + ' samples); rise/set events refined to 1 min; statistics accurate to about one sampling step. ' + (Jobs.mode() === 'worker' ? 'Computed in a background Web Worker.' : 'Computed on the main thread (' + Jobs.mode() + ').');
      renderMetrics(); renderTimeline(); renderWindows(); renderInstant(); writeHash();
    }, function (e) { S.computing = false; document.body.classList.remove('computing'); console.error(e); });
    S.ready = p;
    return p;
  }

  // ------------------------------------------------------------ site list
  function renderSiteList() {
    var qv = $('siteSearch').value.trim().toLowerCase();
    var html = '';
    GROUPS.forEach(function (g) {
      var items = SITES.filter(function (s) {
        if (siteGroup(s) !== g[0]) return false;
        if (!qv) return true;
        return (s.name + ' ' + s.mission + ' ' + s.agency + ' ' + (s.artemisRegions || []).join(' ') + ' ' + s.notes).toLowerCase().indexOf(qv) >= 0;
      }).sort(siteOrder);
      var unplotted = g[0] !== 'artemis' ? [] : REG.regions.filter(function (r) { return !r.sites.length && (!qv || r.name.toLowerCase().indexOf(qv) >= 0 || 'artemis'.indexOf(qv) >= 0); });
      if (!items.length && !unplotted.length) return;
      html += '<div class="sitegroup">' + g[1] + (g[2] ? '<span>' + g[2] + '</span>' : '') + '</div>';
      items.forEach(function (s) {
        var sel = S.site && S.site.id === s.id ? ' sel' : '';
        var sub = s.artemisRegions ? 'Region: ' + s.artemisRegions.join(' / ') : s.agency;
        html += '<div class="siteitem' + sel + '" role="option" tabindex="0" data-id="' + s.id + '"><div><div class="nm">' + esc(s.name) +
          '</div><div class="sub">' + esc(sub) + ' · ' + s.lat.toFixed(2) + '°, ' + s.lon.toFixed(2) + '°E</div></div>' +
          (hasTerrain(s) ? '<span class="tag">terrain</span>' : '<span class="tag smooth">smooth</span>') + '</div>';
      });
      if (unplotted.length) html += '<div class="regionnames"><div class="sub">Not plotted (' + unplotted.length + '): ' + unplotted.map(function (r) { return esc(r.name); }).join(', ') +
        '.<br>' + esc(REG.notPlottedNote) + ' <a href="' + esc(REG.source) + '" target="_blank" rel="noopener">NASA announcement</a></div></div>';
    });
    $('siteList').innerHTML = html || '<div class="sitegroup">No matches</div>';
  }
  function togglePicker(open) {
    var p = $('pickPanel'); open = open === undefined ? p.hidden : open;
    p.hidden = !open; $('pickBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) renderSiteList();
  }
  function selectSite(site, opts) {
    opts = opts || {};
    S.site = site;
    S.fullSky = Math.abs(site.lat) < 70;
    $('fullSky').checked = S.fullSky;
    S.useTerrain = hasTerrain(site);
    togglePicker(false);
    renderSiteHeader();
    Map.select(site, opts.fly !== false);
    renderMapNote();
    return recompute();
  }
  function renderSiteHeader() {
    var s = S.site;
    $('siteName').textContent = s.name;
    $('siteKind').textContent = kindText(s);
    $('siteKind').className = 'sitekind ' + (s.id ? siteGroup(s) : 'custom');
    var m = '<span class="mono">' + s.lat.toFixed(4) + '°, ' + s.lon.toFixed(4) + '°E</span>';
    if (s.id) {
      m += '<span class="b-only"> · <a href="' + esc(s.sources[0]) + '" target="_blank" rel="noopener">source</a></span>';
      m += '<div class="x-only"><b>Coordinate:</b> ' + esc(s.coordKind) + '. ' + esc(s.notes) + '<br>Mission/region: ' + esc(s.mission) + ' · ' + esc(s.agency) + ' · ' + esc(s.status) + (s.year ? ' (' + s.year + ')' : '') +
        '<br>Source type: ' + (s.sourceType === 'secondary' ? '<b class="secsrc">secondary source</b> (no primary source found; see GAPS_AND_ISSUES.md)' : 'primary') + (s.sourceCheck ? ' - ' + esc(s.sourceCheck) : '') +
        '<br>Sources: ' + s.sources.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//, '').slice(0, 64)) + '</a>'; }).join(' · ') +
        (hasTerrain(s) ? '<br>Terrain: LOLA, site height ' + HZ[s.id].siteHeight_m.toFixed(0) + ' m above the 1737.4 km sphere; observer 2 m above ground; horizon from ' + fmtDeg(minMax(HZ[s.id].elevations)[0], 1) + ' to ' + fmtDeg(minMax(HZ[s.id].elevations)[1], 1) + '; rays to ' + HZ[s.id].minReach_km.toFixed(0) + '-300 km.' : '') + '</div>';
      if (s.landformCentre) m += '<div class="warnline">One point at the centre of a large landform, not a landing site. NASA\'s region boundary is not plotted; conditions elsewhere in the region can be very different.</div>';
    }
    if (!s.id) {
      m += '<div class="custommsg">' + customMessage(s) + '</div>';
      if (s.hz) m += '<div class="x-only">Terrain: downsampled LOLA DEM, ' + COARSE_PX + ' m pixels (area mean of LDEM_85S_20M / 80S_80M / 75S_120M); site height ' + s.hz.siteHeight_m.toFixed(0) + ' m above the 1737.4 km sphere; observer 2 m above ground; horizon from ' + fmtDeg(minMax(s.hz.elevations)[0], 1) + ' to ' + fmtDeg(minMax(s.hz.elevations)[1], 1) + '; rays reach ' + minMax(s.hz.reach_km)[0].toFixed(0) + '-300 km (they stop at the edge of the map data). Method: same as tools/terrain.py; validation on the Validation tab.</div>';
    }
    $('siteMeta').innerHTML = m;
    renderBadge();
  }
  function renderBadge() {
    var b = $('horizonBadge');
    if (maskFor(S.site, S.useTerrain) && isCoarse(S.site)) { b.className = 'badge terrain coarse'; b.textContent = 'Terrain horizon (240 m data)'; b.title = 'Terrain from coarser 240 m data (less precise than curated sites), 360 azimuths, observer 2 m above ground'; }
    else if (maskFor(S.site, S.useTerrain)) { b.className = 'badge terrain'; b.textContent = 'Terrain horizon (LOLA)'; b.title = 'LOLA DEMs (20 m/px near the site, 80-120 m/px further away), 360 azimuths, observer 2 m above ground'; }
    else { b.className = 'badge smooth'; b.textContent = 'Smooth horizon - terrain not included'; b.title = 'A perfectly smooth Moon without mountains: real hills and crater walls can change when the Sun and Earth rise and set'; }
  }
  var OUTSIDE_MSG = 'No elevation data here - this map covers the lunar south pole (about 80°S to the pole).';
  var outsideTimer = null;
  function renderMapNote() {
    var n = $('mapNote');
    clearTimeout(outsideTimer);
    if (S.site && !inMap(S.site)) {
      n.hidden = false;
      n.innerHTML = '<b>' + esc(S.site.name) + '</b> (' + S.site.lat.toFixed(2) + '°, ' + S.site.lon.toFixed(2) + '°E) is outside this south-pole map. ' + (S.site.id ? 'It is a reference site: smooth horizon, terrain not included.' : 'Smooth horizon (a Moon without mountains).');
    } else n.hidden = true;
  }
  function showOutside() {          // map click outside the data square: nothing is selected
    var n = $('mapNote');
    n.hidden = false; n.textContent = OUTSIDE_MSG;
    clearTimeout(outsideTimer); outsideTimer = setTimeout(renderMapNote, 6000);
  }

  // ---------------------------------------------- terrain for clicked points
  var CV = window.LUNA_COARSE_VALIDATION;
  var COARSE_OK = !!(CV && CV.pass);      // shipped only because tests/coarse_validation.js passed
  var COARSE_PX = CV ? CV.dem.pixel_m : 240;
  var demPromise = null, customToken = 0;
  // Load data/dem_coarse.js on first use (8-9 MB), inflate it, undo the row differences, hand it to the jobs.
  function loadDem() {
    if (demPromise) return demPromise;
    demPromise = new Promise(function (resolve, reject) {
      if (window.LUNA_DEM_COARSE) { resolve(); return; }
      var sc = document.createElement('script'); sc.src = 'data/dem_coarse.js';
      sc.onload = function () { resolve(); }; sc.onerror = function () { reject(new Error('data/dem_coarse.js could not be loaded')); };
      document.head.appendChild(sc);
    }).then(function () {
      var M = window.LUNA_DEM_COARSE;
      if (!window.DecompressionStream || !window.Response) throw new Error('this browser cannot decompress the elevation data');
      var bin = atob(M.b64), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer().then(function (buf) {
        var h = new Int16Array(buf), n = M.n;
        for (var j = 0; j < n; j++) { var o = j * n; for (var k = 1; k < n; k++) h[o + k] = h[o + k] + h[o + k - 1]; }
        var dem = { n: n, px: M.pixel_m, h: h };
        Jobs.local().setDem(dem);
        return Jobs.run('setDem', dem);
      });
    });
    demPromise.then(null, function () { demPromise = null; });
    return demPromise;
  }
  // Plain-language note for custom points; every number is read live from the validation data.
  function customMessage(s) {
    var V = window.LUNA_VALIDATION, I = window.LUNA_ILLUMINATION;
    var eng = 'Sun and Earth positions come from the validated engine' + (V ? ' (elevations within ' + V.angleStats.el.max.toFixed(3) + '° of NASA/JPL Horizons in the tests)' : '') + '; ';
    if (s.hz) {
      return '<b>Custom point.</b> ' + eng + 'the horizon is <b>terrain from coarser ' + COARSE_PX + ' m data</b> (less precise than curated sites), so results may differ from reality: at the curated sites, yearly % sunlit from this data differed from the 20 m terrain by ' + CV.part1.meanAbsSun.toFixed(1) + ' percentage points on average (up to ' + CV.part1.maxAbsSun.toFixed(1) + ', at ' + esc(worstCoarseSite()) + '). Terrain features smaller than about ' + COARSE_PX + ' m across, boulders and the lander are not included.';
    }
    var maxD = I ? Math.max.apply(null, I.rows.map(function (r) { return Math.abs(r.sunTerrain - r.sunSmooth); })) : null;
    return '<b>Custom point.</b> ' + eng + 'the horizon is a <b>smooth Moon without mountains</b>, so results may differ from reality a lot' + (maxD !== null ? ': at the curated south-pole sites, real terrain changes the yearly % sunlit by up to ' + maxD.toFixed(0) + ' percentage points' : '') + '.' +
      (inMap(s) ? (s.hzError ? ' (Terrain could not be computed here: ' + esc(s.hzError) + '.)' : '') : ' This point is outside the south-pole elevation data.');
  }
  function worstCoarseSite() {
    var w = CV.sites.reduce(function (a, b) { return Math.abs(b.sunCoarse - b.sun20) > Math.abs(a.sunCoarse - a.sun20) ? b : a; });
    var s = siteById(w.id); return s ? s.name : w.id;
  }
  function useCustom(lat, lon) {
    if (lat === undefined) { lat = parseFloat($('customLat').value); lon = parseFloat($('customLon').value); }
    if (!(lat >= -90 && lat <= 90) || !(lon >= -360 && lon <= 360)) { alert('Latitude must be -90..90 and longitude -360..360 (east positive).'); return; }
    $('customLat').value = (+lat).toFixed(4); $('customLon').value = (+lon).toFixed(4);
    var site = { id: null, name: 'Custom point', lat: +(+lat).toFixed(4), lon: +(+lon).toFixed(4) };
    if (!(COARSE_OK && inMap(site))) return selectSite(site, { fly: false });
    var tok = ++customToken;
    var p = Loader.track(loadDem().then(function () { return Jobs.run('horizon', { lat: site.lat, lon: site.lon, obsH: 2 }); }), 'Computing the terrain horizon…')
      .then(function (hz) { site.hz = hz; }, function (e) { site.hzError = e && e.message || String(e); });
    S.ready = p.then(function () { if (tok === customToken) return selectSite(site, { fly: false }); });
    return S.ready;
  }

  // ------------------------------------------------------------- map legend
  function renderLegend(name) {
    var LY = (window.LUNA_TILES || {}).layers || {}, el = $('mapLegend'), h = '';
    var TMp = (window.LUNA_TILES || {}).pixelSize_m || {};
    if (name === 'slope' && LY.slope) {
      h = '<div class="lgtitle">Slope (°) ' + q('overlay_slope') + '</div><div class="lgbar">' + LY.slope.colors.map(function (c, i) {
        var a = LY.slope.edges[i], b = LY.slope.edges[i + 1]; return '<span style="background:rgb(' + c.join(',') + ')" title="' + a + '-' + (b > 90 ? 90 : b) + '°">' + (b > 90 ? '>' + a : a) + '</span>';
      }).join('') + '</div><div class="lgnote">From the LOLA DEM: slope sampled every ' + (TMp['6'] || 37.1).toFixed(0) + ' m and averaged over ' + (TMp['5'] || 74.2).toFixed(0) + ' m pixels (zoomed out: averaged over larger pixels). Steeper slopes over a few metres are not shown.</div>';
    } else if (name === 'illum' && LY.illum) {
      h = '<div class="lgtitle">Average illumination, published by NASA (%) ' + q('overlay_illum') + '</div><div class="lgbar">' + LY.illum.colors.map(function (c, i) {
        var a = LY.illum.edges[i]; return '<span style="background:rgb(' + c.join(',') + ')">' + (i === 0 ? '0' : Math.round(a * 100)) + '</span>';
      }).join('') + '</div><div class="lgnote"><b>NASA\'s published illumination map covers about 85°S-90°S only</b> (inside the dashed yellow square: AVGVISIB_85S_060M_201608, 60 m/px).' +
        (LY.illum120 ? ' Outside the square: NASA\'s coarser map AVGVISIB_75S_120M_201608 (120 m/px, 75°S-90°S), shown on ' + (TMp[String(LY.illum120.maxNativeZoom)] || 148).toFixed(0) + ' m pixels.' : '') +
        ' Source: <a href="https://pgda.gsfc.nasa.gov/products/69" target="_blank" rel="noopener">NASA PGDA product 69</a> (Mazarico et al. 2011), hourly steps over 18.6 years. Its documentation gives two different definitions: % of time steps sunlit by any part of the solar disc, and average solar disc visibility. 0 = permanent shadow.</div>';
    } else {
      h = '<div class="lgtitle">Terrain ' + q('overlay_none') + '</div><div class="lgnote">Hillshade from LOLA elevation data - synthetic lighting, not real illumination. Up to ' + (TMp['7'] || 18.6).toFixed(1) + ' m/px near the pole.</div>';
    }
    h += '<div class="lgmk"><span><i class="mk mk-feature"></i>Point inside an Artemis III region</span><span><i class="mk mk-point"></i>Mission / published point</span><span><i class="mk mk-derived"></i>Derived</span><span><i class="mk mk-reference"></i>Reference</span><span><i class="mk mk-group"><b>2</b></i>Overlapping</span></div>';
    el.innerHTML = h;
    initQ(el);
  }

  // ----------------------------------------------------- instant / tiles
  function renderInstant() {
    var s = S.series; if (!s) return;
    var i = S.idx, t = s.t[i], d = new Date(t);
    $('curUtc').textContent = fmtUTC(d) + ' UTC';
    $('curRiyadh').textContent = '(' + fmtRiyadh(d) + ' Riyadh)';
    var r = E.sunEarthAt(siteObj(), d);
    var mask = maskFor(S.site, S.useTerrain);
    var hs = E.maskAt(mask, r.sun.az), he = E.maskAt(mask, r.earth.az);
    var frac = E.diskFractionAbove(r.sun.el, r.sun.radius_deg, hs);
    $('vSunEl').textContent = fmtDeg(r.sun.el, 3);
    $('vSunAz').textContent = r.sun.az.toFixed(3) + '°';
    $('vSunFrac').textContent = (100 * frac).toFixed(0) + '%';
    $('vEarthEl').textContent = fmtDeg(r.earth.el, 3);
    $('vEarthAz').textContent = r.earth.az.toFixed(3) + '°';
    $('vHz').textContent = fmtDeg(hs, 1) + ' / ' + fmtDeg(he, 1);
    var sunUp = s.sunUp[i], earthUp = s.earthUp[i];
    tile('tileSun', sunUp ? 'on-sun' : 'off', $('sunState'), sunUp ? 'Sun up' : 'Sun down');
    tile('tileEarth', earthUp ? 'on-earth' : 'off', $('earthState'), earthUp ? 'Earth in view' : 'Earth hidden');
    countdown('sun', sunUp, t, 'Sunset in', 'Sunrise in');
    countdown('earth', earthUp, t, 'Earthset in', 'Earthrise in');
    $('sunExpert').textContent = 'el ' + fmtDeg(r.sun.el) + ' · az ' + r.sun.az.toFixed(1) + '° · horizon ' + fmtDeg(hs, 1) + ' · disk ' + (100 * frac).toFixed(0) + '% visible · disk diameter ' + (2 * r.sun.radius_deg).toFixed(3) + '°';
    $('earthExpert').textContent = 'el ' + fmtDeg(r.earth.el) + ' · az ' + r.earth.az.toFixed(1) + '° · horizon ' + fmtDeg(he, 1) + (S.minEl ? ' + ' + S.minEl + '° min' : '') + ' · disk diameter ' + (2 * r.earth.radius_deg).toFixed(2) + '°';
    var ms, cls, why;
    if (sunUp && earthUp) { ms = 'Power + Earth link'; cls = 'on-both'; why = 'Both at once: power and a line of sight to Earth.'; }
    else if (sunUp) { ms = 'Sunlight only'; cls = 'on-sun'; why = 'Power, but no line of sight to Earth.'; }
    else if (earthUp) { ms = 'Earth link only'; cls = 'on-earth'; why = 'Line of sight to Earth, but running on batteries.'; }
    else { ms = 'Neither'; cls = 'off'; why = 'No sunlight and no line of sight to Earth: batteries and autonomy.'; }
    tile('tileMission', cls, $('missionState'), ms);
    $('missionWhy').textContent = why;
    var ns = nextEventAfter('sun', t), ne = nextEventAfter('earth', t);
    var nx = [ns, ne].filter(Boolean).sort(function (a, b) { return a.time - b.time; })[0];
    if (nx) {
      $('missionCountLbl').textContent = 'Changes in';
      $('missionCount').textContent = fmtDur(nx.time.getTime() - t); $('missionCount').className = 'mono';
      $('missionLimitWhy').textContent = '';
    } else {
      var md = searchDaysAhead(t);
      $('missionCountLbl').textContent = 'Next change:';
      $('missionCount').textContent = notWithinText(md); $('missionCount').className = 'nolimit';
      $('missionLimitWhy').textContent = limitWhy('change of sunlight or Earth link', md);
    }
    renderSky(r);
    drawTimelineCursor();
    drawChartCursors();
    markCurrentWindows();
  }
  function tile(id, cls, stateEl, text) { $(id).className = 'tile ' + cls; stateEl.textContent = text; }
  // Days ahead of time t that the next-event search covers: the rest of the window, then SEARCH_DAYS_AFTER more.
  function searchDaysAhead(t) { return Math.round((S.series.t[S.series.t.length - 1] - t) / DAY) + Jobs.local().SEARCH_DAYS_AFTER; }
  function notWithinText(days) { return 'Not within the next ' + days + ' days (search limit)'; }
  function limitWhy(what, days) {
    return 'ASTERIA searched ' + days + ' days ahead (the selected window, then ' + Jobs.local().SEARCH_DAYS_AFTER + ' more days in 60-minute steps) and found no ' + what + '; if there is one, it is later.';
  }
  function countdown(body, up, t, setW, riseW) {
    var ev = nextEventAfter(body, t), c = $(body + 'Count');
    if (ev) {
      $(body + 'CountLbl').textContent = up ? setW : riseW;
      c.textContent = fmtDur(ev.time.getTime() - t); c.className = 'mono';
      c.title = 'at ' + fmtUTC(ev.time) + ' UTC';
      $(body + 'LimitWhy').textContent = '';
    } else {
      var maxD = searchDaysAhead(t), what = up ? (body === 'sun' ? 'sunset' : 'Earthset') : (body === 'sun' ? 'sunrise' : 'Earthrise');
      $(body + 'CountLbl').textContent = 'Next ' + what + ':';
      c.textContent = notWithinText(maxD); c.className = 'nolimit';
      c.title = 'No ' + what + ' found within the search limit';
      $(body + 'LimitWhy').textContent = limitWhy(what, maxD);
    }
  }

  // -------------------------------------------------------------- sky view
  function renderSky(cur) {
    var c = $('sky');
    if (!c.clientWidth) return;
    var cssH = Math.max(220, Math.min(360, (c.clientWidth || 600) * 0.3));
    var f = fitCanvas(c, cssH), ctx = f.ctx, w = f.w, h = f.h;
    var s = S.series, mask = maskFor(S.site, S.useTerrain);
    var L = 36, R = 8, T = 10, B = 24, pw = w - L - R, ph = h - T - B;
    var ymin, ymax;
    if (S.fullSky) { ymin = -10; ymax = 90; }
    else {
      var mmax = 0, mmin = 0;
      if (mask) { var mm = minMax(mask); mmin = mm[0]; mmax = mm[1]; }
      var smax = minMax(s.sunEl)[1], emax = minMax(s.earthEl)[1];
      ymin = Math.floor(Math.min(-3, mmin - 1));
      ymax = Math.ceil(Math.max(6, mmax + 2, Math.min(smax, 25) + 1, Math.min(emax, 25) + 1, S.minEl + 2));
    }
    var X = function (az) { return L + az / 360 * pw; };
    var Y = function (el) { return T + (ymax - el) / (ymax - ymin) * ph; };
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    var g = ctx.createLinearGradient(0, T, 0, Y(0));
    g.addColorStop(0, '#060a14'); g.addColorStop(1, '#0d1a33');
    ctx.fillStyle = g; ctx.fillRect(L, T, pw, Math.max(0, Y(0) - T));
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.fillStyle = C.text; ctx.font = '11px system-ui';
    var dirs = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW', 360: 'N' };
    var narrow = pw < 420;
    for (var az = 0; az <= 360; az += 45) {
      ctx.beginPath(); ctx.moveTo(X(az), T); ctx.lineTo(X(az), T + ph); ctx.stroke();
      if (!narrow || az % 90 === 0) { ctx.textAlign = 'center'; ctx.fillText(dirs[az] + (narrow ? '' : ' ' + az + '°'), X(az), h - 7); }
    }
    var span = ymax - ymin, stepY = span > 60 ? 15 : span > 20 ? 5 : span > 10 ? 2 : 1;
    ctx.textAlign = 'right';
    for (var el = Math.ceil(ymin / stepY) * stepY; el <= ymax; el += stepY) {
      ctx.beginPath(); ctx.moveTo(L, Y(el)); ctx.lineTo(L + pw, Y(el)); ctx.stroke();
      ctx.fillText(el + '°', L - 4, Y(el) + 4);
    }
    ctx.beginPath(); ctx.moveTo(X(0), T + ph);
    for (var a = 0; a <= 360; a++) ctx.lineTo(X(a), Y(mask ? mask[a % 360] : 0));
    ctx.lineTo(X(360), T + ph); ctx.closePath();
    ctx.fillStyle = mask ? C.terrain : C.smooth; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = mask ? C.terrainLine : '#55607a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (a = 0; a <= 360; a++) { var yy = Y(mask ? mask[a % 360] : 0); if (a === 0) ctx.moveTo(X(a), yy); else ctx.lineTo(X(a), yy); }
    ctx.stroke();
    if (S.minEl) {
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(78,168,255,.6)'; ctx.beginPath();
      for (a = 0; a <= 360; a++) { var y2 = Y((mask ? mask[a % 360] : 0) + S.minEl); if (a === 0) ctx.moveTo(X(a), y2); else ctx.lineTo(X(a), y2); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (mask) {
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(200,210,230,.35)';
      ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(L + pw, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.save(); ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();
    var n = s.t.length, every = Math.max(1, Math.floor(n / 1500));
    [['sun', C.sun], ['earth', C.earth]].forEach(function (b) {
      var azA = b[0] === 'sun' ? s.sunAz : s.earthAz, elA = b[0] === 'sun' ? s.sunEl : s.earthEl, upA = b[0] === 'sun' ? s.sunUp : s.earthUp;
      ctx.fillStyle = b[1];
      for (var i = 0; i < n; i += every) { ctx.globalAlpha = upA[i] ? 0.55 : 0.16; ctx.fillRect(X(azA[i]) - 1, Y(elA[i]) - 1, 2, 2); }
    });
    ctx.globalAlpha = 1;
    var pxPerDeg = ph / (ymax - ymin);
    drawBody(ctx, X(cur.earth.az), Y(cur.earth.el), Math.max(4, cur.earth.radius_deg * pxPerDeg), C.earth, 'Earth');
    drawBody(ctx, X(cur.sun.az), Y(cur.sun.el), Math.max(4, cur.sun.radius_deg * pxPerDeg), C.sun, 'Sun');
    ctx.restore();
    ctx.strokeStyle = '#2a3a5c'; ctx.strokeRect(L, T, pw, ph);
    $('skyCaption').textContent = (mask ? 'Brown: ' + terrainName(S.site) + ' skyline (2 m above ground); dashed: smooth-Moon horizon (0°). '
      : 'Smooth Moon horizon - terrain not included. ') + (S.minEl ? 'Blue dotted: minimum usable link elevation. ' : '') +
      'Vertical scale ' + (S.fullSky ? 'full sky' : 'zoomed to the horizon') + '. Dots: computed positions over the window (faint = hidden). Play steps through computed samples only.';
  }
  function drawBody(ctx, x, y, r, col, lbl) {
    var gl = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
    gl.addColorStop(0, col); gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 2 * Math.PI); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '600 11px system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText(lbl, x + r + 4, y - r - 2);
  }

  // -------------------------------------------------------------- timeline
  var TL = null;
  function dateTicks(ctx, L, pw, t0, t1, yLabel, yTop, yBot) {
    var days = (t1 - t0) / DAY, maxTicks = Math.max(2, Math.floor(pw / 80));
    var tickD = [1, 2, 5, 7, 10, 15, 30, 60, 90, 120].filter(function (d) { return days / d <= maxTicks; })[0] || 180;
    var first = new Date(t0); first.setUTCHours(0, 0, 0, 0);
    ctx.fillStyle = C.text; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (var td = first.getTime(); td <= t1; td += tickD * DAY) {
      if (td < t0) continue;
      var x = L + (td - t0) / (t1 - t0) * pw;
      ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x, yBot); ctx.stroke();
      var d = new Date(td);
      ctx.fillText((pw < 500 ? '' : d.getUTCFullYear() + '-') + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), x, yLabel);
    }
  }
  function renderTimeline() {
    var c = $('timeline');
    if (!c.clientWidth || !S.series) { TL = null; return; }
    var f = fitCanvas(c, 150), ctx = f.ctx, w = f.w, h = f.h;
    var s = S.series, n = s.t.length;
    var L = w < 500 ? 70 : 96, R = 10, T = 8, rowH = 28, gap = 10;
    var pw = w - L - R;
    TL = { L: L, pw: pw, w: w, h: h, t0: s.t[0], t1: s.t[n - 1] };
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    var y0 = T + 3 * (rowH + gap) - gap + 4;
    dateTicks(ctx, L, pw, TL.t0, TL.t1, y0 + 13, T, y0);
    var rows = [['Sunlight', C.sun, s.sunUp], ['Earth link', C.earth, s.earthUp], ['Both', C.both, null]];
    rows.forEach(function (r, k) {
      var y = T + k * (rowH + gap);
      ctx.fillStyle = 'rgba(111,120,144,.22)'; ctx.fillRect(L, y, pw, rowH);   // grey = not available
      ctx.fillStyle = C.text; ctx.textAlign = 'left'; ctx.font = (w < 500 ? '11px' : '12px') + ' system-ui';
      ctx.fillText(r[0], 6, y + rowH / 2 + 4);
      ctx.fillStyle = r[1];
      var runStart = -1;
      for (var i = 0; i <= n; i++) {
        var on = i < n && (r[2] ? r[2][i] : (s.sunUp[i] && s.earthUp[i]));
        if (on && runStart < 0) runStart = i;
        if (!on && runStart >= 0) {
          var x0 = L + runStart / (n - 1) * pw, x1 = L + Math.min(i, n - 1) / (n - 1) * pw;
          ctx.fillRect(x0, y, Math.max(1, x1 - x0), rowH);
          runStart = -1;
        }
      }
    });
    TL.base = document.createElement('canvas');
    TL.base.width = c.width; TL.base.height = c.height;
    TL.base.getContext('2d').drawImage(c, 0, 0);
    drawTimelineCursor();
  }
  function drawTimelineCursor() {
    if (!TL || !TL.base || !S.series) return;
    var c = $('timeline'), ctx = c.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(TL.base, 0, 0); ctx.restore();
    var n = S.series.t.length, x = TL.L + S.idx / (n - 1) * TL.pw;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x, 8 + 3 * 38 - 6); ctx.stroke();
  }
  function chartClick(ev, layout) {
    if (!layout || !S.series) return;
    var rect = ev.target.getBoundingClientRect();
    var fr = (ev.clientX - rect.left - layout.L) / layout.pw;
    if (fr < 0 || fr > 1) return;
    setIdx(Math.round(fr * (S.series.t.length - 1)));
  }
  function metric(label, value, key, cls) {
    return '<div class="metric ' + (cls || '') + '"><div class="v">' + value + '</div><div class="k">' + label + ' ' + (key ? q(key) : '') + '</div></div>';
  }
  function renderMetrics() {
    var st = S.stats, whole = S.windowDays * 24 - 0.01;
    $('metrics').innerHTML =
      metric('Sunlit', st.pctSun.toFixed(1) + '%', 'pctSun', 'c-sun') +
      metric('Earth link', st.pctEarth.toFixed(1) + '%', 'pctEarth', 'c-earth') +
      metric('Both', st.pctBoth.toFixed(1) + '%', 'pctBoth', 'c-both') +
      metric('Longest darkness', st.longestDarkH >= whole ? 'whole window' : fmtHours(st.longestDarkH), 'longestDark') +
      metric('Longest Earth blackout', st.longestBlackoutH >= whole ? 'whole window' : fmtHours(st.longestBlackoutH), 'longestBlackout') +
      '<div class="x-only metricx">' + metric('Average illumination (solar-disk fraction)', (100 * st.avgSunFrac).toFixed(1) + '%', 'avgSunFrac') +
      metric('Samples', String(st.samples) + ' × ' + S.series.stepMin + ' min', null) + '</div>';
    initQ($('metrics'));
  }

  // ------------------------------------------------------ windows (Sun/Earth)
  // Visibility windows from the refined events. Windows cut by the period start/end are flagged.
  function computeWindows(body) {
    var s = S.series, ev = S.events[body], up = body === 'sun' ? s.sunUp : s.earthUp, elA = body === 'sun' ? s.sunEl : s.earthEl;
    var azA = body === 'sun' ? s.sunAz : s.earthAz, mask = maskFor(S.site, S.useTerrain);
    var t0 = s.t[0], t1 = s.t[s.t.length - 1], wins = [], open = up[0] ? { start: t0, cutStart: true } : null;
    ev.forEach(function (e) {
      if (e.type === 'rise' && !open) open = { start: e.time.getTime(), cutStart: false };
      else if (e.type === 'set' && open) { open.end = e.time.getTime(); open.cutEnd = false; wins.push(open); open = null; }
    });
    if (open) { open.end = t1; open.cutEnd = true; wins.push(open); }
    var step = s.stepMin * 60000;
    wins.forEach(function (w) {
      var i0 = Math.max(0, Math.ceil((w.start - t0) / step)), i1 = Math.min(s.t.length - 1, Math.floor((w.end - t0) / step));
      var mx = -Infinity, mxAbove = -Infinity;
      for (var i = i0; i <= i1; i++) { if (elA[i] > mx) mx = elA[i]; var ab = elA[i] - E.maskAt(mask, azA[i]); if (ab > mxAbove) mxAbove = ab; }
      w.maxEl = isFinite(mx) ? mx : null; w.maxAbove = isFinite(mxAbove) ? mxAbove : null; w.durH = (w.end - w.start) / 3600000;
    });
    return wins;
  }
  function windowSummary(wins, body) {
    var st = S.stats, totH = S.windowDays * 24;
    var avg = wins.length ? wins.reduce(function (a, w) { return a + w.durH; }, 0) / wins.length : 0;
    return { n: wins.length, avgH: avg, pct: body === 'sun' ? st.pctSun : st.pctEarth, gapH: body === 'sun' ? st.longestDarkH : st.longestBlackoutH, whole: totH };
  }
  var WIN = { sun: [], earth: [] };
  function renderWindows() {
    if (!S.series) return;
    ['earth', 'sun'].forEach(function (body) {
      var wins = WIN[body] = computeWindows(body), sm = windowSummary(wins, body);
      var B = body === 'sun' ? 'Sun' : 'Earth', gapLbl = body === 'sun' ? 'Longest darkness' : 'Longest blackout';
      var gap = sm.gapH >= sm.whole - 0.01 ? 'whole window' : fmtHours(sm.gapH);
      $(body + 'Stats').innerHTML =
        metric(body === 'sun' ? 'Sunlit' : 'Earth link', sm.pct.toFixed(1) + '%', body === 'sun' ? 'pctSun' : 'pctEarth', 'c-' + body) +
        metric(gapLbl, gap, body === 'sun' ? 'longestDark' : 'longestBlackout') +
        metric('Windows', String(sm.n), 'nWindows') +
        metric('Average window', sm.n ? fmtHours(sm.avgH) : '-', 'avgWindow');
      initQ($(body + 'Stats'));
      var rise = body === 'sun' ? 'Sunrise' : 'Earthrise', set = body === 'sun' ? 'Sunset' : 'Earthset';
      var h = '<table class="wtable"><thead><tr><th>' + rise + ' (UTC)</th><th>' + set + ' (UTC)</th><th class="num">Duration</th><th class="num">Max ' + B + ' el.</th><th class="num x-only">Max above terrain</th></tr></thead><tbody>';
      if (!wins.length) h += '<tr><td colspan="5" class="hint">' + (body === 'sun' ? 'The Sun stays below the horizon for the whole window.' : 'Earth stays below the usable horizon for the whole window.') + '</td></tr>';
      wins.forEach(function (w, k) {
        h += '<tr data-k="' + k + '" data-s="' + w.start + '" data-e="' + w.end + '"><td class="mono">' + (w.cutStart ? '<span class="cut" title="Already visible at the start of the period">before</span> ' : '') + fmtShort(new Date(w.start)) +
          '</td><td class="mono">' + (w.cutEnd ? '<span class="cut" title="Still visible at the end of the period">after</span> ' : '') + fmtShort(new Date(w.end)) +
          '</td><td class="num mono">' + fmtHours(w.durH) + (w.cutStart || w.cutEnd ? '+' : '') + '</td><td class="num mono">' + (w.maxEl === null ? '-' : fmtDeg(w.maxEl, 1)) + '</td><td class="num mono x-only">' + (w.maxAbove === null ? '-' : fmtDeg(w.maxAbove, 1)) + '</td></tr>';
      });
      h += '</tbody></table>';
      if (wins.some(function (w) { return w.cutStart || w.cutEnd; })) h += '<p class="fineprint">"before"/"after": the window continues beyond the period; its duration counts only the part inside (marked +). Max elevation from the computed samples.</p>';
      $(body + 'Windows').innerHTML = h;
      renderElevChart(body);
    });
    markCurrentWindows();
  }
  function markCurrentWindows() {
    if (!S.series) return;
    var t = S.series.t[S.idx];
    ['sun', 'earth'].forEach(function (b) {
      document.querySelectorAll('#' + b + 'Windows tbody tr[data-k]').forEach(function (tr) {
        tr.classList.toggle('now', +tr.dataset.s <= t && t < +tr.dataset.e);
        tr.classList.toggle('past', +tr.dataset.e <= t);
      });
    });
  }
  // Elevation vs time with the terrain horizon at the body's azimuth.
  var CH = {};
  function renderElevChart(body) {
    var c = $(body + 'Chart'); if (!c.clientWidth || !S.series) return;
    var s = S.series, n = s.t.length, mask = maskFor(S.site, S.useTerrain);
    var elA = body === 'sun' ? s.sunEl : s.earthEl, azA = body === 'sun' ? s.sunAz : s.earthAz, upA = body === 'sun' ? s.sunUp : s.earthUp;
    var col = body === 'sun' ? C.sun : C.earth, thr = body === 'earth' ? S.minEl : 0;
    var hz = new Array(n); for (var i = 0; i < n; i++) hz[i] = E.maskAt(mask, azA[i]);
    var f = fitCanvas(c, 170), ctx = f.ctx, w = f.w, h = f.h, L = 40, R = 8, T = 8, B = 22, pw = w - L - R, ph = h - T - B;
    var a = minMax(elA), b = minMax(hz);
    var lo = Math.floor(Math.min(a[0], b[0] + thr, 0) - 0.5), hi = Math.ceil(Math.max(a[1], b[1] + thr, 1) + 0.5);
    var X = function (k) { return L + k / (n - 1) * pw; }, Y = function (v) { return T + (hi - v) / (hi - lo) * ph; };
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = body === 'sun' ? 'rgba(255,194,61,.10)' : 'rgba(78,168,255,.12)';
    for (i = 0; i < n; i++) {   // one rectangle per visible run (no overlapping alpha)
      if (!upA[i]) continue;
      var j = i; while (j + 1 < n && upA[j + 1]) j++;
      ctx.fillRect(X(i), T, Math.max(1, X(j) - X(i)), ph); i = j;
    }
    var span = hi - lo, st = span > 60 ? 15 : span > 24 ? 5 : span > 10 ? 2 : 1;
    ctx.strokeStyle = C.grid; ctx.fillStyle = C.text; ctx.font = '11px system-ui'; ctx.textAlign = 'right'; ctx.lineWidth = 1;
    for (var v = Math.ceil(lo / st) * st; v <= hi; v += st) { ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(L + pw, Y(v)); ctx.stroke(); ctx.fillText(v + '°', L - 4, Y(v) + 4); }
    dateTicks(ctx, L, pw, s.t[0], s.t[n - 1], h - 6, T + ph, T + ph + 4);
    function line(arr, add, color, dash, width) {
      ctx.setLineDash(dash || []); ctx.strokeStyle = color; ctx.lineWidth = width || 1.5; ctx.beginPath();
      for (var k = 0; k < n; k++) { var y = Y(arr[k] + add); if (k === 0) ctx.moveTo(X(k), y); else ctx.lineTo(X(k), y); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    line(hz, 0, C.terrainLine, null, 1.5);
    if (thr) line(hz, thr, 'rgba(78,168,255,.7)', [3, 4], 1.2);
    line(elA, 0, col, null, 1.8);
    var bc = document.createElement('canvas'); bc.width = c.width; bc.height = c.height; bc.getContext('2d').drawImage(c, 0, 0);
    CH[body] = { L: L, pw: pw, T: T, ph: ph, base: bc };
    $(body + 'ChartCap').textContent = (body === 'sun' ? 'Amber: Sun centre elevation. ' : 'Blue: Earth centre elevation. ') + 'Brown: ' + (mask ? terrainName(S.site) + ' horizon' : 'smooth horizon (0°)') + ' at the ' + (body === 'sun' ? 'Sun' : 'Earth') + '\'s azimuth' + (thr ? '; dotted: horizon + ' + thr + '° minimum link elevation' : '') + '. Shaded: ' + (body === 'sun' ? 'sunlit' : 'usable link') + '. Computed every ' + s.stepMin + ' min; click to jump.';
    drawChartCursors();
  }
  function drawChartCursors() {
    if (!S.series) return;
    ['sun', 'earth'].forEach(function (b) {
      var L = CH[b]; if (!L || !L.base) return;
      var c = $(b + 'Chart'), ctx = c.getContext('2d');
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.base, 0, 0); ctx.restore();
      var x = L.L + S.idx / (S.series.t.length - 1) * L.pw;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, L.T); ctx.lineTo(x, L.T + L.ph); ctx.stroke();
    });
  }

  // ------------------------------------------------------------ animation
  // Steps through computed samples only (no interpolation between samples).
  function setIdx(i) {
    if (!S.series) return;
    S.idx = Math.max(0, Math.min(S.series.t.length - 1, i));
    $('timeSlider').value = S.idx;
    renderInstant();
  }
  var lastFrame = 0;
  function tick(ts) {
    if (!S.playing) return;
    if (ts - lastFrame > 60) {
      lastFrame = ts;
      var next = S.idx + S.speed;
      if (next >= S.series.t.length) next = 0;
      setIdx(next);
    }
    requestAnimationFrame(tick);
  }
  function setPlaying(p) {
    S.playing = p && !!S.series;
    $('playBtn').innerHTML = S.playing ? '&#10074;&#10074;' : '&#9654;';
    $('playBtn').setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
    if (S.playing) requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- compare
  var CMP = [];
  function siteOptions(selId) {
    var html = '';
    GROUPS.forEach(function (g) {
      html += '<optgroup label="' + g[1] + '">';
      SITES.filter(function (s) { return siteGroup(s) === g[0]; }).sort(siteOrder).forEach(function (s) {
        html += '<option value="' + s.id + '"' + (s.id === selId ? ' selected' : '') + '>' + esc(s.name) + (hasTerrain(s) ? ' (terrain)' : '') + '</option>';
      });
      html += '</optgroup>';
    });
    html += '<option value="__custom"' + (selId === '__custom' ? ' selected' : '') + '>Custom coordinates...</option>';
    return html;
  }
  function renderScenarios() {
    $('cmpScenarios').innerHTML = CMP.map(function (c, k) {
      return '<div class="scenario" data-k="' + k + '"><div class="head"><span class="num">Scenario ' + (k + 1) + '</span>' +
        (CMP.length > 1 ? '<button class="x" data-del="' + k + '" aria-label="Remove">&times;</button>' : '') + '</div>' +
        '<label>Site<select data-f="site">' + siteOptions(c.siteId) + '</select></label>' +
        (c.siteId === '__custom' ? '<div class="row"><label>Lat<input data-f="lat" type="number" step="0.0001" value="' + c.lat + '"></label><label>Lon E<input data-f="lon" type="number" step="0.0001" value="' + c.lon + '"></label></div>' : '') +
        '<label>Start (UTC)<input data-f="start" type="datetime-local" step="60" value="' + toInput(c.start) + '"></label>' +
        '<label class="smallswitch" style="flex-direction:row"><input data-f="terrain" type="checkbox"' + (c.terrain ? ' checked' : '') + (hasTerrain(siteById(c.siteId)) || c.hz ? '' : ' disabled') + '> use terrain horizon' + (c.hz ? ' (240 m data)' : '') + '</label></div>';
    }).join('');
    $('cmpAdd').disabled = CMP.length >= 4; $('cmpSlip').disabled = CMP.length >= 4;
  }
  function addScenario(siteId, start, lat, lon) {
    if (CMP.length >= 4) return;
    var s = siteById(siteId);
    var hz = (!s && S.site && !S.site.id && S.site.hz && S.site.lat === lat && S.site.lon === lon) ? S.site.hz : null;
    CMP.push({ siteId: siteId, start: start, lat: lat === undefined ? (s ? s.lat : -89.5) : lat, lon: lon === undefined ? (s ? s.lon : 0) : lon, hz: hz, terrain: hasTerrain(s) || !!hz });
    renderScenarios();
  }
  function scenarioChange(ev) {
    var el = ev.target, box = el.closest('.scenario'); if (!box) return;
    var c = CMP[+box.dataset.k], f = el.dataset.f;
    if (f === 'site') {
      c.siteId = el.value;
      var s = siteById(c.siteId);
      if (s) { c.lat = s.lat; c.lon = s.lon; }
      c.hz = null; c.terrain = hasTerrain(s);
      renderScenarios();
    } else if (f === 'start') { var d = fromInput(el.value); if (d) c.start = d; }
    else if (f === 'lat') { c.lat = parseFloat(el.value); if (c.hz) { c.hz = null; c.terrain = false; renderScenarios(); } }
    else if (f === 'lon') { c.lon = parseFloat(el.value); if (c.hz) { c.hz = null; c.terrain = false; renderScenarios(); } }
    else if (f === 'terrain') c.terrain = el.checked;
  }
  // Window count and mean length from refined events (windows cut by the period edges count their inside part).
  function windowsOf(ser, events, body) {
    var up = body === 'sun' ? ser.sunUp : ser.earthUp, t0 = ser.t[0], t1 = ser.t[ser.t.length - 1], n = 0, tot = 0, open = up[0] ? t0 : null;
    events[body].forEach(function (e) {
      if (e.type === 'rise' && open === null) open = e.time.getTime();
      else if (e.type === 'set' && open !== null) { n++; tot += e.time.getTime() - open; open = null; }
    });
    if (open !== null) { n++; tot += t1 - open; }
    return { n: n, avgH: n ? tot / n / 3600000 : 0 };
  }
  var CMPRES = null;
  function runCompare() {
    $('cmpResult').innerHTML = '<p class="hint">Computing...</p>';
    $('cmpMinElNote').textContent = minElText() + '. Geometric line-of-sight only; antenna, power and ground-station availability are not modelled.';
    var days = +$('cmpWindow').value;
    var jobs = CMP.map(function (c) {
      var s = siteById(c.siteId) || { id: null, name: 'Custom (' + c.lat + ', ' + c.lon + ')', lat: c.lat, lon: c.lon };
      if (!s.id && c.hz) s.hz = c.hz;
      var mask = c.terrain ? maskFor(s, true) : null;
      return Jobs.run('scenario', { site: { lat: c.lat, lon: c.lon }, start: c.start.getTime(), days: days, mask: mask, minEl: S.minEl }).then(function (r) {
        var ser = r.series, st = r.stats;
        var firstOf = function (list, type) { for (var i = 0; i < list.length; i++) if (list[i].type === type) return list[i]; return null; };
        var sunSet = ser.sunUp[0] ? firstOf(r.events.sun, 'set') : null, earthSet = ser.earthUp[0] ? firstOf(r.events.earth, 'set') : null;
        return { c: c, s: s, mask: mask, ser: ser, st: st, sw: windowsOf(ser, r.events, 'sun'), ew: windowsOf(ser, r.events, 'earth'),
          sunLeftH: ser.sunUp[0] ? (sunSet ? (sunSet.time - c.start) / 3600000 : days * 24) : 0,
          earthLeftH: ser.earthUp[0] ? (earthSet ? (earthSet.time - c.start) / 3600000 : days * 24) : 0,
          maxSun: minMax(ser.sunEl)[1], maxEarth: minMax(ser.earthEl)[1] };
      });
    });
    return Loader.track(Promise.all(jobs), 'Comparing scenarios…').then(function (res) {
      CMPRES = res;
      var pctF = function (v) { return v.toFixed(1) + '%'; };
      var left = function (lbl, setW) { return function (v) { return v >= days * 24 ? 'Whole ' + days + '-day window (no ' + setW + ' within it)' : v === 0 ? lbl : fmtHours(v); }; };
      var rows = [
        ['Site', function (r) { return esc(r.s.name); }],
        ['Start (UTC)', function (r) { return fmtUTC(r.c.start); }],
        ['Horizon model', function (r) { return r.mask ? (r.s.id ? 'LOLA terrain' : 'Terrain from coarser 240 m data') : 'Smooth (terrain not included)'; }],
        ['§sun', 'Sunlight'],
        ['Sunlit', function (r) { return r.st.pctSun; }, 'max', pctF],
        ['Average illumination', function (r) { return 100 * r.st.avgSunFrac; }, 'max', pctF],
        ['Sunlight left at start', function (r) { return r.sunLeftH; }, 'max', left('Sun down', 'sunset')],
        ['Longest darkness', function (r) { return r.st.longestDarkH; }, 'min', fmtHours],
        ['Sunlight windows', function (r) { return r.sw.n; }, null, String],
        ['Average sunlight window', function (r) { return r.sw.avgH; }, 'max', function (v) { return v ? fmtHours(v) : '-'; }],
        ['Max Sun elevation', function (r) { return r.maxSun; }, 'max', function (v) { return v.toFixed(2) + '°'; }],
        ['§earth', 'Earth link' + (S.minEl ? ' (≥ ' + S.minEl + '° above terrain)' : '')],
        ['Earth link', function (r) { return r.st.pctEarth; }, 'max', pctF],
        ['Earth link left at start', function (r) { return r.earthLeftH; }, 'max', left('Earth hidden', 'Earthset')],
        ['Longest Earth blackout', function (r) { return r.st.longestBlackoutH; }, 'min', fmtHours],
        ['Earth link windows', function (r) { return r.ew.n; }, null, String],
        ['Average Earth link window', function (r) { return r.ew.avgH; }, 'max', function (v) { return v ? fmtHours(v) : '-'; }],
        ['Max Earth elevation', function (r) { return r.maxEarth; }, 'max', function (v) { return v.toFixed(2) + '°'; }],
        ['§both', 'Both'],
        ['Sunlight + Earth link', function (r) { return r.st.pctBoth; }, 'max', pctF]
      ];
      var html = '<table class="cmptable"><thead><tr><th>Metric (' + days + '-day window)</th>' + res.map(function (r, k) { return '<th class="num">Scenario ' + (k + 1) + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.forEach(function (row) {
        if (row[0][0] === '§') { html += '<tr class="sec sec-' + row[0].slice(1) + '"><th colspan="' + (res.length + 1) + '">' + row[1] + '</th></tr>'; return; }
        var vals = res.map(row[1]);
        var best = null;
        if (row[2] && res.length > 1) {
          var b = row[2] === 'max' ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
          var allSame = vals.every(function (v) { return Math.abs(v - vals[0]) < 1e-9; });
          if (!allSame) best = b;
        }
        html += '<tr><td>' + row[0] + '</td>' + vals.map(function (v) {
          var isBest = best !== null && Math.abs(v - best) < 1e-9;
          return '<td class="num' + (isBest ? ' best' : '') + '">' + (row[3] ? row[3](v) : v) + '</td>';
        }).join('') + '</tr>';
      });
      html += '</tbody></table><p class="hint">Highlighted = best in row (higher % and longer windows are better; shorter darkness/blackout is better). Ties are not highlighted. Windows cut by the period start/end count only their part inside it.</p>' +
        (res.some(function (r) { return r.sunLeftH >= days * 24 || r.earthLeftH >= days * 24; }) ? '<p class="explain">"Whole ' + days + '-day window": the Sun (or Earth) was up at the start and no sunset (or Earthset) was found within the compared window, so the next one, if any, is later. Compare searches only inside its window.</p>' : '') +
        '<p class="hint x-only">Basis: validated engine, one series per scenario sampled every ' + res[0].ser.stepMin + ' min, horizon as in the "Horizon model" row, events refined to 1 min; statistics accurate to about one sampling step.</p>';
      $('cmpResult').innerHTML = html;
      $('cmpBars').innerHTML = res.map(function (r, k) { return '<div class="cmpbar"><div class="lbl">Scenario ' + (k + 1) + ': ' + esc(r.s.name) + ' from ' + fmtUTC(r.c.start) + ' UTC</div><canvas id="cmpc' + k + '" style="width:100%"></canvas></div>'; }).join('');
      res.forEach(function (r, k) {
        var c = $('cmpc' + k), f = fitCanvas(c, 46), ctx = f.ctx, n = r.ser.t.length;
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, f.w, f.h);
        [[r.ser.sunUp, C.sun, 0], [r.ser.earthUp, C.earth, 15], [null, C.both, 30]].forEach(function (row) {
          ctx.fillStyle = 'rgba(111,120,144,.22)'; ctx.fillRect(0, row[2], f.w, 13);
          ctx.fillStyle = row[1];
          for (var i = 0; i < n; i++) {
            var on = row[0] ? row[0][i] : (r.ser.sunUp[i] && r.ser.earthUp[i]);
            if (on) ctx.fillRect(i / n * f.w, row[2], Math.max(1, f.w / n + 0.5), 13);
          }
        });
      });
    });
  }

  // ------------------------------------------------------------- validation
  function renderValidation() {
    var V = window.LUNA_VALIDATION, el = $('validationContent');
    if (!V) { el.innerHTML = '<p>Validation data missing (run node tests/validate.js).</p>'; return; }
    var f = function (x, n) { return x.toFixed(n); };
    var h = '<h2>Ephemeris validation against NASA/JPL Horizons</h2>';
    h += '<div class="bigresult ' + (V.overall ? 'pass' : 'fail') + '">Overall: ' + (V.overall ? 'PASS' : 'FAIL') + '</div>';
    h += '<p class="hint">Generated ' + esc(V.generated) + ' by <code>node tests/validate.js</code>. Raw Horizons responses are cached in <code>tests/horizons_cache/</code>. Full write-up: VALIDATION_REPORT.md.</p>';
    h += '<div class="tablewrap"><table><thead><tr><th>Part</th><th>Result</th><th>Detail</th></tr></thead><tbody>';
    h += '<tr><td>Angles vs Horizons (' + V.angles.length + ' comparisons)</td><td class="' + (V.anglePass ? 'pass' : 'fail') + '">' + (V.anglePass ? 'PASS' : 'FAIL') + '</td><td>Elevation error max ' + f(V.angleStats.el.max, 4) + '° (mean ' + f(V.angleStats.el.mean, 4) + '°), limit ' + V.tolerances.elDeg + '°. Azimuth error max ' + f(V.angleStats.az.max, 4) + '° (mean ' + f(V.angleStats.az.mean, 4) + '°), limit ' + V.tolerances.azDeg + '°.</td></tr>';
    h += '<tr><td>Event times vs Horizons (' + V.events.length + ')</td><td class="' + (V.eventPass ? 'pass' : 'fail') + '">' + (V.eventPass ? 'PASS' : 'FAIL') + '</td><td>Max ' + f(V.eventStats.max, 2) + ' min (mean ' + f(V.eventStats.mean, 2) + ' min), limit ' + V.tolerances.eventMin + ' min.</td></tr>';
    h += '<tr><td>Physics sanity tests (' + V.sanity.tests.length + ')</td><td class="' + (V.sanityPass ? 'pass' : 'fail') + '">' + (V.sanityPass ? 'PASS' : 'FAIL') + '</td><td>' + esc(V.sanity.period) + '</td></tr>';
    if (V.blind) h += '<tr><td>Blind test vs Horizons (' + V.blind.rows.length + ' comparisons)</td><td class="' + (V.blind.pass ? 'pass' : 'fail') + '">' + (V.blind.pass ? 'PASS' : 'FAIL') + '</td><td>' + V.blind.cases.length + ' new random cases fetched fresh; elevation max ' + f(V.blind.el.max, 4) + '°, azimuth max ' + f(V.blind.az.max, 4) + '°.</td></tr>';
    var OY = V.oneYear;
    if (OY) h += '<tr><td>Custom point, one-year check (' + OY.rows + ' hourly rows × 2 bodies)</td><td class="' + (OY.pass ? 'pass' : 'fail') + '">' + (OY.pass ? 'PASS' : 'FAIL') + '</td><td>Elevation error max ' + f(Math.max(OY.angles.earth.el.max, OY.angles.sun.el.max), 4) + '°, azimuth max ' + f(Math.max(OY.angles.earth.az.max, OY.angles.sun.az.max), 4) + '°; sunrise/sunset max ' + f(OY.events.sun.maxAbsMin, 2) + ' min.</td></tr>';
    h += '</tbody></table></div>';
    h += '<h3>Method</h3><p>Our engine vs Horizons with the observer on the Moon (<code>CENTER=\'coord@301\'</code>, <code>COORD_TYPE=\'GEODETIC\'</code>, height 0 km on the 1737.4 km sphere), targets Sun (10) and Earth (399), quantity 4 (apparent azimuth/elevation), <code>APPARENT=\'AIRLESS\'</code>. Azimuth tolerance is relaxed (' + V.tolerances.azDeg + '°/cos el) only above 80° elevation, where azimuth becomes ill-defined near the zenith.</p>';
    h += '<details><summary>Angle cases (' + V.angles.length + ')</summary><div class="tablewrap"><table><thead><tr><th>Site</th><th class="num">Lat</th><th class="num">E-lon</th><th>UTC</th><th>Body</th><th class="num">Az ours</th><th class="num">Az Horizons</th><th class="num">ΔAz</th><th class="num">El ours</th><th class="num">El Horizons</th><th class="num">ΔEl</th><th>Pass</th></tr></thead><tbody>';
    V.angles.forEach(function (c) {
      h += '<tr><td>' + esc(c.site) + '</td><td class="num">' + c.lat + '</td><td class="num">' + c.lon + '</td><td>' + c.date.replace('T', ' ').replace(':00Z', '') + '</td><td>' + c.body + '</td><td class="num">' + f(c.oursAz, 4) + '</td><td class="num">' + f(c.hzAz, 4) + '</td><td class="num">' + f(c.dAz, 4) + '</td><td class="num">' + f(c.oursEl, 4) + '</td><td class="num">' + f(c.hzEl, 4) + '</td><td class="num">' + f(c.dEl, 4) + '</td><td class="' + (c.pass ? 'pass' : 'fail') + '">' + (c.pass ? 'PASS' : 'FAIL') + '</td></tr>';
    });
    h += '</tbody></table></div></details>';
    h += '<h3>Event times (smooth-Moon horizon)</h3><div class="tablewrap"><table><thead><tr><th>Event</th><th class="num">Lat</th><th class="num">E-lon</th><th>Ours (UTC)</th><th>Horizons (UTC)</th><th class="num">Δ (min)</th><th>Pass</th></tr></thead><tbody>';
    V.events.forEach(function (e) {
      h += '<tr><td>' + esc(e.label) + '</td><td class="num">' + e.lat + '</td><td class="num">' + e.lon + '</td><td>' + (e.ours || '-') + '</td><td>' + (e.horizons || '-') + '</td><td class="num">' + (e.dMin !== undefined ? f(e.dMin, 2) : esc(e.error || '-')) + '</td><td class="' + (e.pass ? 'pass' : 'fail') + '">' + (e.pass ? 'PASS' : 'FAIL') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    if (V.blind) {
      h += '<h3>Blind test: new random cases fetched fresh from JPL Horizons</h3><p class="hint">' + esc(V.blind.selection) + '. Chosen on ' + esc(V.blind.generated.slice(0, 10)) + '. Result: <b class="' + (V.blind.pass ? 'pass' : 'fail') + '">' + (V.blind.pass ? 'PASS' : 'FAIL') + '</b>, elevation error max ' + f(V.blind.el.max, 4) + '°, azimuth error max ' + f(V.blind.az.max, 4) + '°. VERIFY_YOURSELF.md shows how to repeat one case in a browser.</p>';
      h += '<div class="tablewrap"><table><thead><tr><th>Site</th><th>UTC</th><th>Body</th><th class="num">Az ours</th><th class="num">Az Horizons</th><th class="num">El ours</th><th class="num">El Horizons</th><th>Pass</th></tr></thead><tbody>';
      V.blind.rows.forEach(function (c) { h += '<tr><td>' + esc(c.name) + '</td><td>' + esc(c.date) + '</td><td>' + c.body + '</td><td class="num">' + f(c.oursAz, 4) + '</td><td class="num">' + f(c.hzAz, 4) + '</td><td class="num">' + f(c.oursEl, 4) + '</td><td class="num">' + f(c.hzEl, 4) + '</td><td class="' + (c.pass ? 'pass' : 'fail') + '">' + (c.pass ? 'PASS' : 'FAIL') + '</td></tr>'; });
      h += '</tbody></table></div>';
    }
    h += '<h3>Physics sanity tests</h3><div class="tablewrap"><table><thead><tr><th>Test</th><th>Result</th><th>Pass</th></tr></thead><tbody>';
    V.sanity.tests.forEach(function (t) { h += '<tr><td>' + esc(t.name) + '</td><td>' + esc(t.value) + '</td><td class="' + (t.pass ? 'pass' : 'fail') + '">' + (t.pass ? 'PASS' : 'FAIL') + '</td></tr>'; });
    h += '</tbody></table></div>';
    var SM = V.sanity.sunMax;
    if (SM) {
      h += '<details><summary>Maximum Sun elevation at ' + SM.rows.length + ' random southern latitudes (seed ' + SM.seed + ')</summary><p class="hint">Rule: over one year the Sun’s centre should reach within 0.2° of 90° − |lat| + 1.54° and never exceed 90° − |lat| + 1.6°. The IAU/WGCCRE Moon orientation model used by the engine tilts the Moon’s equator ' + f(SM.tiltMin, 3) + '-' + f(SM.tiltMax, 3) + '° to the J2000 ecliptic over the period.</p><div class="tablewrap"><table><thead><tr><th class="num">Lat</th><th class="num">E-lon</th><th class="num">Max Sun el</th><th>When (UTC)</th><th class="num">90° − |lat| + 1.54°</th><th class="num">Δ</th><th>Pass</th></tr></thead><tbody>';
      SM.rows.forEach(function (x) { h += '<tr><td class="num">' + x.lat + '</td><td class="num">' + x.lon + '</td><td class="num">' + f(x.maxEl, 4) + '°</td><td>' + x.when.slice(0, 16).replace('T', ' ') + '</td><td class="num">' + f(x.expected, 4) + '°</td><td class="num">' + f(x.dev, 4) + '°</td><td class="' + (x.pass ? 'pass' : 'fail') + '">' + (x.pass ? 'PASS' : 'FAIL') + '</td></tr>'; });
      h += '</tbody></table></div></details>';
    }
    if (OY) {
      var m = OY.earthMin, E1 = OY.events.earth, S1 = OY.events.sun, ts = function (x) { return x.slice(0, 16).replace('T', ' '); };
      h += '<h3>Custom point, one-year check</h3><p>Point ' + OY.site.lat + '°, ' + OY.site.lon + '°E, smooth horizon (outside the south-pole map). JPL Horizons Earth and Sun apparent azimuth/elevation every hour from ' + ts(OY.period.start) + ' to ' + ts(OY.period.stop) + ' UTC (' + OY.rows + ' rows each), compared with the engine at every row. Result: <b class="' + (OY.pass ? 'pass' : 'fail') + '">' + (OY.pass ? 'PASS' : 'FAIL') + '</b>.</p>';
      h += '<div class="tablewrap"><table><thead><tr><th>Body</th><th class="num">|ΔEl| max</th><th class="num">|ΔEl| mean</th><th class="num">|ΔAz| max</th><th class="num">|ΔAz| mean</th><th>Pass</th></tr></thead><tbody>';
      ['earth', 'sun'].forEach(function (b) { var a = OY.angles[b]; h += '<tr><td>' + (b === 'earth' ? 'Earth' : 'Sun') + '</td><td class="num">' + f(a.el.max, 4) + '°</td><td class="num">' + f(a.el.mean, 4) + '°</td><td class="num">' + f(a.az.max, 4) + '°</td><td class="num">' + f(a.az.mean, 4) + '°</td><td class="' + (a.pass ? 'pass' : 'fail') + '">' + (a.pass ? 'PASS' : 'FAIL') + '</td></tr>'; });
      h += '</tbody></table></div>';
      h += '<p>Horizons’ lowest Earth elevation in the year: <b>' + f(m.el, 4) + '°</b> at ' + ts(m.time) + ' UTC (engine ' + f(m.engineEl, 4) + '°). ' + (m.setsAtAll ? 'Earth goes below 0° in ' + m.hoursBelow0 + ' hourly rows.' : 'Earth never goes below 0° in the year according to Horizons, so there is no Earthset or Earthrise; the app finds none either and shows "Not within the next N days (search limit)".') +
        ' Sunrises and sunsets: Horizons ' + S1.horizonsCount + ', app ' + S1.appCount + ', largest difference ' + f(S1.maxAbsMin, 2) + ' min (limit ' + OY.tolerances.eventMin + ' min); the app’s next-event predictions for 30-day windows every 14 days agree in ' + (S1.next.filter(function (n) { return n.pass; }).length + E1.next.filter(function (n) { return n.pass; }).length) + ' of ' + (S1.next.length + E1.next.length) + ' cases.</p>';
    }
    var I = window.LUNA_ILLUMINATION;
    if (I) {
      h += '<h3>Terrain illumination and Earth visibility (one year, LOLA horizons)</h3><p class="hint">' + esc(I.period) + ', ' + I.stepMin + '-minute steps, Sun/Earth centre vs horizon (Earth minimum elevation 0°), observer ' + I.observerHeight_m + ' m above ground. Artemis III points are landform centres or a published point inside a region, not landing sites.</p>';
      h += '<div class="tablewrap"><table><thead><tr><th>Site</th><th class="num">Height (m)</th><th class="num">Sunlit % terrain</th><th class="num">Sunlit % smooth</th><th class="num">Earth % terrain</th><th class="num">Both %</th><th class="num">Longest dark</th><th class="num">Longest Earth blackout</th></tr></thead><tbody>';
      I.rows.forEach(function (r) {
        h += '<tr><td>' + esc(r.name) + '</td><td class="num">' + r.siteHeight_m.toFixed(0) + '</td><td class="num">' + r.sunTerrain.toFixed(1) + '</td><td class="num">' + r.sunSmooth.toFixed(1) + '</td><td class="num">' + r.earthTerrain.toFixed(1) + '</td><td class="num">' + r.bothTerrain.toFixed(1) + '</td><td class="num">' + fmtHours(r.longestDarkH) + '</td><td class="num">' + fmtHours(r.longestBlackoutH) + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    h += renderXcheck();
    h += renderCoarse();
    el.innerHTML = h;
  }
  function renderCoarse() {
    var V = window.LUNA_COARSE_VALIDATION;
    if (!V) return '<h3>Terrain for clicked points</h3><p class="hint">Not validated (run node tests/coarse_validation.js); clicked points use a smooth horizon.</p>';
    var f1 = function (x) { return x.toFixed(1); }, P1 = V.part1, P2 = V.part2;
    var h = '<h3>Terrain for clicked points: downsampled ' + V.dem.pixel_m + ' m elevation data</h3>';
    h += '<div class="bigresult ' + (V.pass ? 'pass' : 'fail') + '">' + (V.pass ? 'PASS - shipped, labelled "terrain from coarser ' + V.dem.pixel_m + ' m data (less precise than curated sites)"' : 'FAIL - not shipped; clicked points use a smooth horizon') + '</div>';
    h += '<p class="hint">A ' + V.dem.n + ' × ' + V.dem.n + ' grid (' + V.dem.pixel_m + ' m pixels, ' + V.dem.fileMB.toFixed(1) + ' MB) made from the LOLA DEMs by area averaging. The browser computes the horizon with the same method as the curated sites (360 azimuths, rays to 300 km, lunar curvature, observer 2 m above the surface). Pass criteria, set before running: ' + esc(V.criteria.sites) + '; ' + esc(V.criteria.random) + '.</p>';
    h += '<h4>(1) Curated south-pole sites: ' + V.dem.pixel_m + ' m data vs the 20 m-based horizon (2027, 30-minute steps)</h4><div class="tablewrap"><table><thead><tr><th>Site</th><th class="num">Horizon |Δ| mean / max</th><th class="num">Sunlit % 20 m</th><th class="num">Sunlit % ' + V.dem.pixel_m + ' m</th><th class="num">Earth % 20 m</th><th class="num">Earth % ' + V.dem.pixel_m + ' m</th></tr></thead><tbody>';
    V.sites.forEach(function (r) { var s = siteById(r.id); h += '<tr><td>' + esc(s ? s.name : r.id) + '</td><td class="num">' + r.hzMeanDiff.toFixed(2) + '° / ' + r.hzMaxDiff.toFixed(2) + '°</td><td class="num">' + f1(r.sun20) + '</td><td class="num">' + f1(r.sunCoarse) + '</td><td class="num">' + f1(r.earth20) + '</td><td class="num">' + f1(r.earthCoarse) + '</td></tr>'; });
    h += '</tbody></table></div><p>|Δ % sunlit|: mean <b>' + P1.meanAbsSun.toFixed(2) + '</b>, max <b>' + P1.maxAbsSun.toFixed(2) + '</b> points (' + (P1.pass ? 'PASS' : 'FAIL') + '). |Δ % Earth visible|: mean ' + P1.meanAbsEarth.toFixed(2) + ', max ' + P1.maxAbsEarth.toFixed(2) + ' points.</p>';
    if (P2) h += '<h4>(2) ' + P2.n + ' random points in 85°S-90°S vs NASA\'s published map (18.6 years)</h4><p>Average illumination from the ' + V.dem.pixel_m + ' m horizon (same method as the cross-check above) vs AVGVISIB_85S_060M_201608: |Δ| mean <b>' + P2.meanAbs.toFixed(2) + '</b>, median ' + P2.medianAbs.toFixed(2) + ', max ' + P2.maxAbs.toFixed(2) + ' points; ' + P2.within5 + ' of ' + P2.n + ' within 5 points; ' + P2.bothZero + ' points are in shadow in both (' + (P2.pass ? 'PASS' : 'FAIL') + ').</p>';
    if (V.impl) h += '<p class="hint">Implementation check: the browser code reproduces tools/terrain.py on the same grid to within ' + Math.max.apply(null, V.impl.map(function (r) { return r.maxAbsDeg; })).toExponential(0) + '°.</p>';
    return h;
  }
  function renderXcheck() {
    var X = window.LUNA_XCHECK, SRC = window.LUNA_XCHECK_SOURCES || [];
    if (!X) return '<h3>Terrain illumination cross-check</h3><p class="hint">Not available (run tools/illum_crosscheck.py).</p>';
    var p = function (v) { return (v === null || v === undefined) ? 'outside map' : (100 * v).toFixed(1) + '%'; };
    var h = '<h3>Terrain illumination cross-check vs the published LOLA illumination map</h3>';
    h += '<ul>' + SRC.map(function (s) { return '<li><b>' + esc(s.what) + ':</b> ' + esc(s.quote) + ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener">source</a></li>'; }).join('') + '</ul>';
    h += '<p class="hint">Sun directions from the validated engine, hourly over ' + esc(X.span) + ' (one 18.6-year cycle); LOLA terrain horizons at 2 m and 10 m above the surface. (1) average visible solar-disk fraction, (2) % time Sun centre up, (3) % time any part of the disk up.</p>';
    h += '<h4>Peak near Shackleton (-88.79, 124.5) vs the published ~80%</h4><div class="tablewrap"><table><thead><tr><th>Observer</th><th>Period</th><th class="num">(1) Avg disk fraction</th><th class="num">(2) Centre up</th><th class="num">(3) Any part up</th></tr></thead><tbody>';
    X.central.forEach(function (c) { h += '<tr><td>' + c.height_m + ' m</td><td>' + esc(c.period) + '</td><td class="num">' + p(c.avgDiskFrac) + '</td><td class="num">' + c.pctCentre.toFixed(1) + '%</td><td class="num">' + c.pctAnyPart.toFixed(1) + '%</td></tr>'; });
    h += '<tr><td colspan="2">Published map ' + esc(X.pgdaProduct) + ' at the same point</td><td class="num">' + p(X.pgdaAtPoint.bilinear) + '</td><td></td><td></td></tr>';
    h += '<tr><td colspan="2">Published text (Mahanti et al. 2024)</td><td class="num">~80%</td><td></td><td></td></tr></tbody></table></div>';
    h += '<div class="tablewrap"><table><thead><tr><th>Neighbourhood (500 m, 50 m grid)</th><th>Best point (ours)</th><th class="num">Ours (1)</th><th class="num">Published map there</th><th class="num">Map max in area</th><th class="num">r</th></tr></thead><tbody>';
    Object.keys(X.grid).forEach(function (k) {
      var g = X.grid[k], b = g.best;
      h += '<tr><td>' + k + ' m observer, ' + g.n + ' points</td><td>' + b.lat.toFixed(5) + ', ' + b.lon.toFixed(4) + '</td><td class="num">' + p(b.avgDiskFrac) + '</td><td class="num">' + p(b.pgda) + '</td><td class="num">' + p(g.bestByPgda.pgda) + '</td><td class="num">' + g.corrWithPgda.toFixed(2) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    var dpts = function (a, b) { if (b === null || b === undefined) return 'n/a'; var d = 100 * (a - b); return (d >= 0 ? '+' : '') + d.toFixed(1) + ' pts'; };
    h += '<h4>All south-pole sites vs the published maps (observer 2 m, 18.6 years)</h4><div class="tablewrap"><table><thead><tr><th>Site</th><th class="num">(1) Avg disk fraction</th><th class="num">(2) Centre up</th><th class="num">Published 60 m map</th><th class="num">(1) - 60 m map</th><th class="num">Published 120 m map</th><th class="num">(1) - 120 m map</th></tr></thead><tbody>';
    X.sites.forEach(function (s) {
      var site = siteById(s.id);
      h += '<tr><td>' + esc(site ? site.name : s.id) + '</td><td class="num">' + p(s.avgDiskFrac) + '</td><td class="num">' + s.pctCentre.toFixed(1) + '%</td><td class="num">' + p(s.pgda) + '</td><td class="num">' + dpts(s.avgDiskFrac, s.pgda) + '</td><td class="num">' + (s.pgda120 === undefined ? 'n/a' : p(s.pgda120)) + '</td><td class="num">' + dpts(s.avgDiskFrac, s.pgda120) + '</td></tr>';
    });
    h += '</tbody></table></div><p class="hint">The 60 m map (AVGVISIB_85S_060M_201608) covers about 85°S-90°S; sites further north are "outside map". The coarser 120 m map (AVGVISIB_75S_120M_201608) covers 75°S-90°S.</p>';
    var c18 = X.central.filter(function (c) { return c.height_m === 2 && c.period === '18.6 yr'; })[0];
    h += '<p><b>Finding:</b> at the published coordinate the published 60 m map itself gives ' + p(X.pgdaAtPoint.bilinear) + ' and ASTERIA gives ' + p(c18.avgDiskFrac) + ' (2 m, 18.6 years). Both are well below "approximately 80%", so that figure is not reproduced at this coordinate by the public map product.' + (X.grid['10.0'] ? ' With the observer 10 m above the surface, the best point within 500 m reaches ' + p(X.grid['10.0'].best.avgDiskFrac) + ' in our model (published map there: ' + p(X.grid['10.0'].best.pgda) + '; the map does not state its observer height).' : '') + ' The derived best-supported point (ASTERIA\'s default view) is where both models agree on the highest value. Nothing was tuned. Full tables: VALIDATION_REPORT.md.</p>';
    return h;
  }

  // ------------------------------------------------------------------ tabs
  function showPage(p) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.page === p); t.setAttribute('aria-selected', t.dataset.page === p ? 'true' : 'false'); });
    document.querySelectorAll('.page').forEach(function (s) { s.classList.toggle('active', s.id === 'page-' + p); });
    if (p === 'explorer') { Map.invalidate(); renderTimeline(); renderWindows(); renderInstant(); }
    if (p === 'compare' && !CMP.length) {
      addScenario(S.site.id || '__custom', S.start, S.site.lat, S.site.lon);
      addScenario(S.site.id || '__custom', new Date(S.start.getTime() + 7 * DAY), S.site.lat, S.site.lon);
    }
    if (p === 'compare') $('cmpMinElNote').textContent = minElText() + '. Geometric line-of-sight only; antenna, power and ground-station availability are not modelled.';
    if (p === 'slip') {
      if (!$('slipNominal').value) $('slipNominal').value = toInput(S.start);
      if (SLIP.res) renderSlip(); else runSlip();
    }
    if (p === 'power') {
      if (!$('slipNominal').value) $('slipNominal').value = toInput(S.start);
      runPower();
    }
    writeHash();
  }

  // ================================================================ LAUNCH SLIP
  var SLIP_METRICS = {
    pctBoth: { label: '% both (power + Earth link)', short: '% both', better: 'max', fmt: function (v) { return v.toFixed(1) + '%'; } },
    pctSun: { label: '% sunlit', short: '% sunlit', better: 'max', fmt: function (v) { return v.toFixed(1) + '%'; } },
    avgSunFrac: { label: 'Average illumination (disk fraction)', short: 'Avg illum.', better: 'max', fmt: function (v) { return (100 * v).toFixed(1) + '%'; } },
    pctEarth: { label: '% Earth link', short: '% Earth', better: 'max', fmt: function (v) { return v.toFixed(1) + '%'; } },
    longestDarkH: { label: 'Longest darkness', short: 'Longest dark', better: 'min', fmt: function (v) { return fmtHours(v); } },
    longestBlackoutH: { label: 'Longest Earth blackout', short: 'Longest blackout', better: 'min', fmt: function (v) { return fmtHours(v); } },
    hoursToFirstSunset: { label: 'Hours until first sunset', short: 'To 1st sunset', better: 'max', fmt: null }
  };
  var SLIP_KEYS = ['pctBoth', 'pctSun', 'avgSunFrac', 'pctEarth', 'longestDarkH', 'longestBlackoutH', 'hoursToFirstSunset'];
  var SLIP = { res: null, layout: null };
  function slipVal(row, key, durDays) { var v = row[key]; return (key === 'hoursToFirstSunset' && v === null) ? durDays * 24 : v; }
  function slipFmt(row, key) {
    if (key === 'hoursToFirstSunset') { var v = row[key]; return v === null ? 'No sunset within the ' + (SLIP.res && SLIP.res.dur ? SLIP.res.dur + '-day ' : '') + 'mission' : v === 0 ? 'Sun down at landing' : fmtHours(v); }
    return SLIP_METRICS[key].fmt(row[key]);
  }
  function slipSites(mode) {
    var list = [];
    function add(site, useTerrain) {
      var key = site.id || (site.lat + ',' + site.lon);
      if (list.some(function (x) { return x.key === key; })) return;
      list.push({ key: key, site: site, name: site.name, mask: maskFor(site, useTerrain) });
    }
    if (mode === 'terrain') SITES.forEach(function (s) { if (hasTerrain(s)) add(s, true); });
    else if (mode === 'compare' && CMP.length) CMP.forEach(function (c) {
      var s = siteById(c.siteId) || { id: null, name: 'Custom (' + c.lat + ', ' + c.lon + ')', lat: c.lat, lon: c.lon };
      if (!s.id && c.hz) s.hz = c.hz;
      add(s, c.terrain);
    });
    else add(S.site, S.useTerrain);
    return list;
  }
  function runSlip(done) {
    var nominal = fromInput($('slipNominal').value) || S.start;
    var dur = Math.round(+$('slipDuration').value), from = Math.round(+$('slipFrom').value), to = Math.round(+$('slipTo').value), step = Math.max(1, Math.round(+$('slipStep').value));
    if (!(dur >= 1 && dur <= 120) || !(from >= 0) || !(to > from) || to - from > 365) {
      $('slipProgress').textContent = 'Check inputs: mission 1-120 days, slip range up to 365 days.'; return;
    }
    var sites = slipSites($('slipSites').value);
    var res = { nominal: nominal, dur: dur, from: from, to: to, step: step, minEl: S.minEl, sites: [] };
    $('slipRun').disabled = true;
    $('slipMinElNote').textContent = minElText() + ' (set in Explore, Earth link windows). Geometric line-of-sight only.';
    var k = 0;
    Loader.begin('Computing launch-slip heatmap…');
    (function nextSite() {
      if (k >= sites.length) {
        Loader.end();
        $('slipRun').disabled = false;
        $('slipProgress').textContent = 'Done: ' + sites.length + ' site(s) x ' + res.sites[0].scan.rows.length + ' landing dates, ' + res.sites[0].scan.stepMin + '-minute sampling.';
        SLIP.res = res; renderSlip(); if (done) done(); return;
      }
      $('slipProgress').textContent = 'Computing ' + (k + 1) + ' / ' + sites.length + ': ' + sites[k].name + ' ...';
      var it = sites[k];
      Jobs.run('slip', { site: { lat: it.site.lat, lon: it.site.lon }, nominal: nominal.getTime(), dur: dur, from: from, to: to, step: step, mask: it.mask, minEl: S.minEl }).then(function (scan) {
        it.scan = scan; res.sites.push(it); k++; nextSite();
      }, function (e) { Loader.end(); $('slipRun').disabled = false; $('slipProgress').textContent = 'Error: ' + e.message; });
    })();
  }
  function heatColor(f) {
    var stops = [[13, 27, 62], [27, 110, 140], [64, 190, 140], [255, 214, 74]];
    f = Math.max(0, Math.min(1, f)); var x = f * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), t = x - i;
    var a = stops[i], b = stops[i + 1];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')';
  }
  function renderSlip() {
    var R = SLIP.res; if (!R) return;
    var c = $('slipHeat'); if (!c.clientWidth) return;
    var key = $('slipMetric').value, M = SLIP_METRICS[key];
    var bySite = R.sites.length > 1;
    var w = c.clientWidth, narrow = w < 560;
    var rows = bySite ? R.sites.map(function (s) { return { label: s.name.replace(' (landform centre)', '').replace(' - best-lit point (derived)', ' (derived)'), site: s, key: key }; })
      : SLIP_KEYS.map(function (k) { return { label: narrow ? SLIP_METRICS[k].short : SLIP_METRICS[k].label, site: R.sites[0], key: k }; });
    var nS = R.sites[0].scan.rows.length;
    var labW = narrow ? Math.max(84, Math.min(120, w * 0.3)) : Math.min(230, Math.max(90, w * 0.24)), rowH = narrow ? 22 : 26, top = 6, bottom = 24;
    var f = fitCanvas(c, top + rows.length * rowH + bottom), ctx = f.ctx;
    var pw = w - labW - 8, cw = pw / nS;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, f.h);
    function rangeOf(rs) {
      var lo = Infinity, hi = -Infinity;
      rs.forEach(function (r) { r.site.scan.rows.forEach(function (x) { var v = slipVal(x, r.key, R.dur); if (v < lo) lo = v; if (v > hi) hi = v; }); });
      return [lo, hi];
    }
    var globalRange = bySite ? rangeOf(rows) : null;
    SLIP.layout = { labW: labW, rowH: rowH, top: top, cw: cw, rows: rows, nS: nS };
    rows.forEach(function (r, ri) {
      var rg = globalRange || rangeOf([r]), better = SLIP_METRICS[r.key].better;
      var y = top + ri * rowH;
      ctx.fillStyle = C.text; ctx.font = (narrow ? '10px' : '11px') + ' system-ui'; ctx.textAlign = 'right';
      var lbl = r.label;
      while (lbl.length > 4 && ctx.measureText(lbl).width > labW - 8) lbl = lbl.slice(0, -2) + '…';
      ctx.fillText(lbl, labW - 5, y + rowH / 2 + 4);
      var vals = r.site.scan.rows.map(function (x) { return slipVal(x, r.key, R.dur); });
      var bestV = better === 'max' ? Math.max.apply(null, vals) : Math.min.apply(null, vals), bestI = vals.indexOf(bestV);
      vals.forEach(function (v, i) {
        var fr = rg[1] > rg[0] ? (v - rg[0]) / (rg[1] - rg[0]) : 0.5;
        if (better === 'min') fr = 1 - fr;
        ctx.fillStyle = heatColor(fr);
        ctx.fillRect(labW + i * cw, y + 1, Math.max(1, cw - (cw > 4 ? 1 : 0)), rowH - 2);
      });
      var allSame = vals.every(function (v) { return Math.abs(v - vals[0]) < 1e-9; });
      if (!allSame) { ctx.strokeStyle = '#5ee27a'; ctx.lineWidth = 2; ctx.strokeRect(labW + bestI * cw + 1, y + 2, Math.max(2, cw - 2), rowH - 4); }
      r.bestI = allSame ? -1 : bestI;
    });
    var i0 = R.sites[0].scan.rows.findIndex(function (x) { return x.slip === 0; });
    if (i0 >= 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(labW + i0 * cw, top, Math.max(2, cw), rows.length * rowH); }
    ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.font = (narrow ? '10px' : '11px') + ' system-ui';
    var every = Math.max(1, Math.ceil(nS / Math.max(2, Math.floor(pw / (narrow ? 38 : 45)))));
    R.sites[0].scan.rows.forEach(function (x, i) { if (i % every === 0) ctx.fillText('+' + x.slip + 'd', labW + (i + 0.5) * cw, f.h - 8); });
    $('slipLegend').innerHTML = (bySite ? 'Rows: sites, coloured by <b>' + esc(M.label) + '</b> on a common scale.' : 'Rows: metrics for <b>' + esc(R.sites[0].name) + '</b>, each row on its own scale.') +
      ' Brighter = better. White outline = nominal landing (slip 0); green outline = best in range. Mission ' + R.dur + ' days; sampling ' + R.sites[0].scan.stepMin + ' min' + (R.minEl ? '; Earth link needs ≥ ' + R.minEl + '° above terrain' : '') + '. Hover (or tap) for values, click to open in Explore.' +
      '<span class="x-only"> Basis: one engine series per site covering the whole slip range; each landing date uses the samples of its own mission window (slip 0 equals the Explore metrics for the same window, tested); horizons as in the badge above.</span>';
    var note = $('slipHorizonNote'), anyTerrain = R.sites.some(function (s) { return s.mask; }), allTerrain = R.sites.every(function (s) { return s.mask; });
    note.className = 'badge ' + (allTerrain ? 'terrain' : 'smooth');
    note.textContent = allTerrain ? 'Terrain horizons (LOLA)' : anyTerrain ? 'Mixed: some sites smooth horizon - terrain not included' : 'Smooth horizon - terrain not included';
    renderSlipLine();
  }
  function slipLineSite() {
    var R = SLIP.res; if (!R) return null;
    for (var i = 0; i < R.sites.length; i++) if (S.site && R.sites[i].site.id && R.sites[i].site.id === S.site.id) return R.sites[i];
    return R.sites[0];
  }
  function renderSlipLine() {
    var R = SLIP.res, it = slipLineSite(); if (!R || !it) return;
    var c = $('slipLine'); if (!c.clientWidth) return;
    var key = $('slipMetric').value, M = SLIP_METRICS[key];
    var f = fitCanvas(c, 210), ctx = f.ctx, w = f.w, h = f.h, L = 56, Rr = 12, T = 14, B = 28, pw = w - L - Rr, ph = h - T - B;
    var rows = it.scan.rows, vals = rows.map(function (x) { return slipVal(x, key, R.dur); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    var pad2 = (hi - lo) * 0.08; lo = Math.max(0, lo - pad2); hi += pad2;
    var X = function (i) { return L + (rows.length > 1 ? i / (rows.length - 1) : 0.5) * pw; };
    var Y = function (v) { return T + (hi - v) / (hi - lo) * ph; };
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.grid; ctx.fillStyle = C.text; ctx.font = '11px system-ui'; ctx.textAlign = 'right';
    for (var g = 0; g <= 4; g++) {
      var v = lo + (hi - lo) * g / 4; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(L + pw, Y(v)); ctx.stroke();
      ctx.fillText(key === 'avgSunFrac' ? (100 * v).toFixed(0) + '%' : key.indexOf('pct') === 0 ? v.toFixed(0) + '%' : fmtHours(Math.max(0, v)), L - 5, Y(v) + 4);
    }
    ctx.textAlign = 'center';
    var every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(pw / 50))));
    rows.forEach(function (x, i) { if (i % every === 0) ctx.fillText('+' + x.slip + 'd', X(i), h - 8); });
    ctx.strokeStyle = '#4cc9f0'; ctx.lineWidth = 2; ctx.beginPath();
    vals.forEach(function (v, i) { if (i === 0) ctx.moveTo(X(i), Y(v)); else ctx.lineTo(X(i), Y(v)); }); ctx.stroke();
    var best = M.better === 'max' ? Math.max.apply(null, vals) : Math.min.apply(null, vals), bi = vals.indexOf(best);
    var i0 = rows.findIndex(function (x) { return x.slip === 0; });
    if (i0 >= 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(i0), Y(vals[i0]), 5, 0, 7); ctx.fill(); ctx.textAlign = 'left'; ctx.fillText('nominal', X(i0) + 7, Y(vals[i0]) - 7); }
    ctx.fillStyle = '#5ee27a'; ctx.beginPath(); ctx.arc(X(bi), Y(best), 5, 0, 7); ctx.fill(); ctx.textAlign = bi > rows.length * 0.8 ? 'right' : 'left';
    ctx.fillText('best +' + rows[bi].slip + 'd', X(bi) + (bi > rows.length * 0.8 ? -7 : 7), Y(best) + 15);
    $('slipLineSite').textContent = it.name + ' - ' + M.label;
    var r0 = i0 >= 0 ? rows[i0] : null, rb = rows[bi], r14 = rows.filter(function (x) { return x.slip === 14; })[0];
    var s = '';
    if (r0) s += 'Nominal landing ' + fmtUTC(new Date(r0.landing)) + ' UTC: <b>' + slipFmt(r0, key) + '</b>. ';
    s += 'Best in range: <b>+' + rb.slip + ' days</b> (' + fmtUTC(new Date(rb.landing)) + ' UTC) with <b>' + slipFmt(rb, key) + '</b>.';
    if (r14 && r0) s += ' A 14-day slip gives <b>' + slipFmt(r14, key) + '</b>.';
    $('slipSummary').innerHTML = s;
  }
  function slipCellAt(ev) {
    var L = SLIP.layout, R = SLIP.res; if (!L || !R) return null;
    var rect = $('slipHeat').getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    var i = Math.floor((x - L.labW) / L.cw), ri = Math.floor((y - L.top) / L.rowH);
    if (i < 0 || i >= L.nS || ri < 0 || ri >= L.rows.length) return null;
    return { row: L.rows[ri], i: i, x: x, y: y };
  }
  function slipHover(ev) {
    var hit = slipCellAt(ev), tip = $('slipTip');
    if (!hit) { tip.hidden = true; return; }
    var row = hit.row.site.scan.rows[hit.i];
    var html = '<b>' + esc(hit.row.site.name) + '</b><br>Slip +' + row.slip + ' d · landing ' + fmtUTC(new Date(row.landing)) + ' UTC<br>';
    html += SLIP_KEYS.map(function (k) { return (k === hit.row.key ? '<b>' : '') + SLIP_METRICS[k].label + ': ' + slipFmt(row, k) + (k === hit.row.key ? '</b>' : ''); }).join('<br>');
    tip.innerHTML = html; tip.hidden = false;
    var wrapW = $('slipHeat').clientWidth;
    tip.style.left = Math.max(0, Math.min(hit.x + 14, wrapW - tip.offsetWidth - 4)) + 'px';
    tip.style.top = (hit.y + 14) + 'px';
  }
  function slipClick(ev) {
    var hit = slipCellAt(ev); if (!hit) return;
    var R = SLIP.res, row = hit.row.site.scan.rows[hit.i], site = hit.row.site.site;
    openInExplorer(site, new Date(row.landing), R.dur, !!hit.row.site.mask);
  }
  function ensureWindowOption(days) {
    var sel = $('windowSel');
    if (![].some.call(sel.options, function (o) { return +o.value === days; })) {
      var o = document.createElement('option'); o.value = days; o.textContent = days + ' days'; sel.appendChild(o);
    }
    sel.value = String(days);
  }
  function openInExplorer(site, start, days, useTerrain) {
    S.start = new Date(start.getTime()); S.start.setUTCSeconds(0, 0);
    $('startInput').value = toInput(S.start);
    S.windowDays = days; ensureWindowOption(days); S.idx = 0;
    showPage('explorer');
    var p = selectSite(site);
    if (useTerrain === false && S.useTerrain) { S.useTerrain = false; renderBadge(); p = recompute(); }
    return p;
  }

  // ===================================================================== POWER
  var PW = { res: null };
  function powerWindow() {
    var mode = $('pwWindow').value;
    var site = siteObj(), mask = maskFor(S.site, S.useTerrain);
    if (mode === 'slip') {
      var nominal = fromInput($('slipNominal').value) || S.start, dur = Math.max(1, Math.round(+$('slipDuration').value) || 14);
      var end = new Date(nominal.getTime() + dur * DAY);
      return Jobs.run('series', { site: site, start: nominal.getTime(), end: end.getTime(), mask: mask, minEl: S.minEl }).then(function (ser) {
        return { label: S.site.name + ', launch-slip mission: landing ' + fmtUTC(nominal) + ' UTC + ' + dur + ' days', start: nominal, days: dur, series: ser, mask: mask };
      });
    }
    return (S.ready || Promise.resolve()).then(function () {
      return { label: S.site.name + ', Explore window: ' + fmtUTC(S.start) + ' UTC + ' + S.windowDays + ' days', start: S.start, days: S.windowDays, series: S.series, mask: mask };
    });
  }
  function runPower() {
    var opts = { area: +$('pwArea').value, eff: (+$('pwEff').value) / 100, mode: $('pwMode').value, faceAz: +$('pwFace').value };
    var load = +$('pwLoad').value, usable = (+$('pwDod').value) / 100;
    if (!(opts.area > 0) || !(opts.eff > 0 && opts.eff <= 1) || !(load >= 0) || !(usable > 0 && usable <= 1)) { $('pwVerdict').textContent = 'Check inputs.'; return Promise.resolve(); }
    return Loader.track(powerWindow(), 'Computing power…').then(function (win) {
      var s = win.series, n = s.t.length, stepH = s.stepMin / 60;
      var P = new Array(n), peak = 0, zero = 0, maxZero = 0;
      for (var i = 0; i < n; i++) {
        P[i] = E.panelPower(opts, s.sunAz[i], s.sunEl[i], s.sunDist[i], s.sunFrac[i]);
        if (P[i] > peak) peak = P[i];
        if (P[i] <= 0) { zero++; if (zero > maxZero) maxZero = zero; } else zero = 0;
      }
      var Wh = 0; for (i = 1; i < n; i++) Wh += (P[i - 1] + P[i]) / 2 * stepH;   // trapezoid rule
      var hours = (n - 1) * stepH, loadWh = load * hours;
      var st = E.stats(s);
      var darkH = st.longestDarkH, zeroH = maxZero * stepH;
      var battery = load * darkH / usable, batteryZero = load * zeroH / usable;
      PW.res = { P: P, t: s.t, load: load, Wh: Wh, loadWh: loadWh, peak: peak, mean: Wh / hours, darkH: darkH, zeroH: zeroH, battery: battery, batteryZero: batteryZero, hours: hours, win: win, opts: opts, usable: usable };
      var kWh = function (x) { return (x / 1000).toFixed(x < 10000 ? 2 : 1) + ' kWh'; };
      var cards = [
        ['Energy generated', kWh(Wh)], ['Energy needed by load', kWh(loadWh)], ['Energy balance', (Wh >= loadWh ? '+' : '−') + kWh(Math.abs(Wh - loadWh))],
        ['Mean / peak power', PW.res.mean.toFixed(0) + ' / ' + peak.toFixed(0) + ' W'], ['Longest darkness', fmtHours(darkH)],
        ['Battery for longest darkness (estimate)', '≈ ' + kWh(battery) + ' (' + Math.round(usable * 100) + '% usable)']
      ];
      $('pwCards').innerHTML = cards.map(function (x) { return '<div class="card"><div class="cardlbl">' + x[0] + '</div><div class="val mono">' + x[1] + '</div></div>'; }).join('');
      var v = $('pwVerdict');
      v.className = 'verdict ' + (Wh >= loadWh ? 'pos' : 'neg');
      v.textContent = (Wh >= loadWh ? 'Energy positive' : 'Energy negative') + ' over the window (estimate): generates ' + kWh(Wh) + ' vs ' + kWh(loadWh) + ' needed; battery for the longest darkness ≈ ' + kWh(battery) + '.' +
        (zeroH > darkH + 1e-9 ? ' Note: with this orientation the panel produces nothing for up to ' + fmtHours(zeroH) + ' (Sun behind the panel), which would need ' + kWh(batteryZero) + '.' : '');
      $('pwWindowNote').innerHTML = esc('Window: ' + win.label + '. ' + (win.mask ? 'Horizon: ' + terrainName(S.site) + '.' : 'Smooth horizon - terrain not included.') + ' Sampling ' + s.stepMin + ' min.') +
        '<span class="x-only"> Basis: at each sample, power from the computed Sun elevation, azimuth and distance and the visible fraction of the solar disk above the horizon; energy by the trapezoid rule; longest darkness = longest run with the Sun centre below the horizon. All panel and load inputs are example values unless you entered your own.</span>';
      renderPowerChart();
    });
  }
  function renderPowerChart() {
    var R = PW.res, c = $('pwChart'); if (!R || !c.clientWidth) return;
    var f = fitCanvas(c, 230), ctx = f.ctx, w = f.w, h = f.h, L = 52, Rr = 10, T = 12, B = 26, pw = w - L - Rr, ph = h - T - B;
    var hi = Math.max(R.peak, R.load) * 1.1 || 1;
    var X = function (i) { return L + i / (R.P.length - 1) * pw; }, Y = function (v) { return T + (hi - v) / hi * ph; };
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.grid; ctx.fillStyle = C.text; ctx.font = '11px system-ui'; ctx.textAlign = 'right';
    for (var g = 0; g <= 4; g++) { var v = hi * g / 4; ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(L + pw, Y(v)); ctx.stroke(); ctx.fillText(v.toFixed(0) + ' W', L - 4, Y(v) + 4); }
    ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    R.P.forEach(function (p, i) { ctx.lineTo(X(i), Y(p)); }); ctx.lineTo(X(R.P.length - 1), Y(0)); ctx.closePath();
    ctx.fillStyle = 'rgba(255,194,61,.35)'; ctx.fill();
    ctx.strokeStyle = C.sun; ctx.lineWidth = 1.5; ctx.beginPath(); R.P.forEach(function (p, i) { if (i === 0) ctx.moveTo(X(i), Y(p)); else ctx.lineTo(X(i), Y(p)); }); ctx.stroke();
    ctx.setLineDash([6, 4]); ctx.strokeStyle = '#ff6b6b'; ctx.beginPath(); ctx.moveTo(L, Y(R.load)); ctx.lineTo(L + pw, Y(R.load)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ff9b9b'; ctx.textAlign = 'left'; ctx.fillText('load ' + R.load + ' W', L + 4, Y(R.load) - 4);
    dateTicks(ctx, L, pw, R.t[0], R.t[R.t.length - 1], h - 8, T + ph, T + ph + 4);
  }

  // ============================================================ SHAREABLE URL
  var hashReady = false;
  function writeHash() {
    if (!hashReady || !S.site) return;
    var tab = (document.querySelector('.tab.active') || {}).dataset || {};
    var p = [];
    if (S.site.id) p.push('site=' + encodeURIComponent(S.site.id));
    else p.push('lat=' + S.site.lat, 'lon=' + S.site.lon);
    p.push('t=' + toInput(S.start) + 'Z', 'w=' + S.windowDays);
    if (S.minEl) p.push('me=' + S.minEl);
    if (hasTerrain(S.site) && !S.useTerrain) p.push('terrain=0');
    if (tab.page && tab.page !== 'explorer') p.push('tab=' + tab.page);
    try { history.replaceState(null, '', '#' + p.join('&')); } catch (e) { location.hash = p.join('&'); }
  }
  function readHash() {
    var h = (location.hash || '').replace(/^#/, ''), o = {};
    if (!h) return null;
    h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) o[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
    return o;
  }
  function applyHash(o) {
    if (o.t) { var d = new Date(o.t.replace(/Z?$/, ':00Z').replace(/:00:00Z$/, ':00Z')); if (!isNaN(d)) { S.start = d; $('startInput').value = toInput(d); } }
    if (o.w && +o.w >= 1 && +o.w <= 400) { S.windowDays = Math.round(+o.w); ensureWindowOption(S.windowDays); }
    if (o.me !== undefined && +o.me >= 0 && +o.me <= 30) { S.minEl = +o.me; $('minEl').value = S.minEl; }
    var site = o.site ? siteById(o.site) : null, p;
    if (!site && o.lat !== undefined && o.lon !== undefined && isFinite(+o.lat) && isFinite(+o.lon) && Math.abs(+o.lat) <= 90) p = useCustom(+o.lat, +o.lon);
    else p = selectSite(site || siteById(DEFAULT_SITE) || SITES[0], { fly: false });
    if (o.terrain === '0') p = Promise.resolve(p).then(function () { if (S.useTerrain) { S.useTerrain = false; renderBadge(); return recompute(); } });
    if (o.tab && $('page-' + o.tab)) showPage(o.tab);
    return p;
  }
  function copyLink() {
    writeHash();
    var done = function () { $('shareBtn').textContent = 'Link copied'; setTimeout(function () { $('shareBtn').textContent = 'Copy link'; }, 1600); };
    try { navigator.clipboard.writeText(location.href).then(done, function () { window.prompt('Copy this link:', location.href); }); }
    catch (e) { window.prompt('Copy this link:', location.href); }
  }

  // ============================================================ EXPLAIN (?)
  function initQ(root) {
    (root || document).querySelectorAll('.q[data-q]').forEach(function (el) {
      if (el.firstChild) return;
      var k = el.dataset.q, x = EXPL[k]; if (!x) return;
      el.innerHTML = '<button class="qb" type="button" aria-label="Explain: ' + esc(x.t) + '" data-q="' + k + '">?</button>';
    });
  }
  function showQ(btn) {
    var x = EXPL[btn.dataset.q], pop = $('qpop'); if (!x) return;
    if (!pop.hidden && pop.dataset.k === btn.dataset.q) { pop.hidden = true; return; }
    pop.innerHTML = '<b>' + esc(x.t) + '</b><p>' + esc(x.what) + '</p><p><i>Why it matters:</i> ' + esc(x.why) + '</p>';
    pop.dataset.k = btn.dataset.q; pop.hidden = false;
    var r = btn.getBoundingClientRect(), pw = Math.min(320, window.innerWidth - 24);
    pop.style.width = pw + 'px';
    pop.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left + r.width / 2 - pw / 2)) + 'px';
    pop.style.top = (r.bottom + 8 + window.scrollY) + 'px';
  }

  // ======================================================= FIRST-VISIT HINT
  var HINT_KEY = 'asteria.hintDismissed';
  var HINTS = [
    ['mapPanel', '<b>1. The south-pole map.</b> Click a marker to open a site (violet diamonds are points inside NASA\'s Artemis III candidate regions), or click anywhere to test your own point. Drag to pan, scroll or pinch to zoom.'],
    ['siteCard', '<b>2. Three status tiles.</b> <span class="c-sun">Sunlight</span>, <span class="c-earth">Earth link</span> and <span class="c-both">mission status</span> at the selected time, each with a countdown to the next change.'],
    ['skyPanel', '<b>3. Go deeper.</b> Press play in the Sky view, switch on <b>Expert view</b> for all technical values, tap <b>?</b> for explanations, or take the <b>Tour</b>.']
  ];
  var hintI = 0, hintHl = null;
  function hintShow(i) {
    hintI = i;
    $('hintStep').textContent = 'Getting started · ' + (i + 1) + ' / ' + HINTS.length;
    $('hintText').innerHTML = HINTS[i][1];
    $('hintNext').textContent = i === HINTS.length - 1 ? 'Done' : 'Next';
    $('hint').hidden = false;
    if (hintHl) hintHl.classList.remove('tour-hl');
    hintHl = $(HINTS[i][0]); if (hintHl) hintHl.classList.add('tour-hl');
  }
  function hintClose() {
    $('hint').hidden = true; if (hintHl) hintHl.classList.remove('tour-hl'); hintHl = null;
    try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* storage unavailable: the hint just shows again next time */ }
  }

  // ===================================================================== TOUR
  var TOUR = { i: 0, hl: null };
  function highlight(id) {
    if (TOUR.hl) TOUR.hl.classList.remove('tour-hl');
    TOUR.hl = id ? $(id) : null;
    if (TOUR.hl) { TOUR.hl.classList.add('tour-hl'); TOUR.hl.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'center' }); }
  }
  function fmtD(h) { return h >= 48 ? (h / 24).toFixed(1) + ' days' : h.toFixed(0) + ' hours'; }
  function nTerrainSites() { return SITES.filter(hasTerrain).length; }
  var TOUR_STEPS = [
    function (done) { // 1. the south-pole map and why the pole matters
      var p = (S.site && S.site.id === DEFAULT_SITE && S.windowDays === 30) ? (S.ready || Promise.resolve()) : openInExplorer(siteById(DEFAULT_SITE), S.start, 30, true);
      p.then(function () {
        showPage('explorer'); Map.home(true);
        var sEl = minMax(S.series.sunEl), IL = window.LUNA_ILLUMINATION;
        var bestLit = IL && IL.rows.length ? IL.rows.reduce(function (a, b) { return b.sunTerrain > a.sunTerrain ? b : a; }) : null;
        done('mapPanel', 'This is the lunar <b>south pole</b>, from about 80°S to 90°S, built from NASA LOLA elevation data. ASTERIA has <b>' + nTerrainSites() + '</b> south-pole sites with computed terrain horizons. Of NASA\'s <b>' + REG.regions.length + '</b> Artemis III candidate regions (Oct 2024), <b>' + REG.regions.filter(function (r) { return r.sites.length; }).length + '</b> have a plotted point inside them; the others are listed by name only, because their boundaries are published only as images. Why the pole? NASA notes that its permanently shadowed areas can preserve resources, including water, while some high ground is sunlit for long periods' + (bestLit ? ' (the best-lit site here, ' + esc(bestLit.name) + ', is sunlit ' + bestLit.sunTerrain.toFixed(0) + '% of 2027 in ASTERIA\'s terrain model)' : '') + '. The Sun stays low here: at the selected site its centre moves between ' + fmtDeg(sEl[0], 1) + ' and ' + fmtDeg(sEl[1], 1) + ' over the next 30 days.');
      });
    },
    function (done) { // 2. the selected polar site: Sun skims, terrain blocks; contrast with an equatorial site
      openInExplorer(siteById(DEFAULT_SITE), S.start, 30, true).then(function () {
        var st = S.stats, sEl = minMax(S.series.sunEl), m = minMax(HZ[DEFAULT_SITE].elevations), a11 = siteById('apollo11');
        return Promise.all([
          Jobs.run('scenario', { site: siteObj(), start: S.start.getTime(), days: 30, mask: null, minEl: 0 }),
          Jobs.run('scenario', { site: { lat: a11.lat, lon: a11.lon }, start: S.start.getTime(), days: 30, mask: null, minEl: 0 })
        ]).then(function (r) {
          var smooth = r[0].stats, eq = r[1].stats, eqMax = minMax(r[1].series.sunEl)[1];
          done('skyPanel', '<b>' + esc(S.site.name) + '</b>: the Sun skims around the horizon, its centre between ' + fmtDeg(sEl[0], 1) + ' and ' + fmtDeg(sEl[1], 1) + ' over these 30 days. The brown skyline is the terrain from LOLA elevation data (' + fmtDeg(m[0], 1) + ' to ' + fmtDeg(m[1], 1) + ') and it decides when the Sun is visible: Sun up <b>' + st.pctSun.toFixed(0) + '%</b> of the time, against ' + smooth.pctSun.toFixed(0) + '% for a perfectly smooth Moon. By contrast, at Apollo 11 near the equator the Sun climbs to ' + eqMax.toFixed(0) + '° and is up ' + eq.pctSun.toFixed(0) + '% of the time in one long day and night.');
        });
      });
    },
    function (done) { // 3. Earth link windows and the next Earthset
      showPage('explorer');
      (S.ready || Promise.resolve()).then(function () {
        var w = WIN.earth, st = S.stats, t = S.series.t[S.idx], ev = nextEventAfter('earth', t), up = S.series.earthUp[S.idx];
        var nextTxt = ev ? (up ? 'The next <b>Earthset</b> is in <b>' + fmtDur(ev.time.getTime() - t) + '</b> (' + fmtUTC(ev.time) + ' UTC).' : 'Earth is hidden now; the next <b>Earthrise</b> is in <b>' + fmtDur(ev.time.getTime() - t) + '</b> (' + fmtUTC(ev.time) + ' UTC).') : (up ? 'Next Earthset: ' : 'Earth is hidden now. Next Earthrise: ') + notWithinText(searchDaysAhead(t)).replace(/^N/, 'n') + '.';
        var eEl = minMax(S.series.earthEl);
        done('earthPanel', 'Earth link: seen from the pole, Earth stays near the horizon and moves up and down a little as the Moon\'s orientation toward Earth changes (libration), so a direct line of sight comes and goes. In these 30 days Earth\'s centre moves between ' + fmtDeg(eEl[0], 1) + ' and ' + fmtDeg(eEl[1], 1) + ' elevation and is in view <b>' + st.pctEarth.toFixed(0) + '%</b> of the time in <b>' + w.length + '</b> window(s); the longest blackout lasts ' + fmtD(st.longestBlackoutH) + '. ' + nextTxt + ' You can require a minimum elevation above the terrain for a usable link.');
      });
    },
    function (done) { // 4. launch slip
      showPage('slip');
      $('slipSites').value = 'current'; $('slipNominal').value = toInput(S.start); $('slipDuration').value = 14; $('slipFrom').value = 0; $('slipTo').value = 60; $('slipStep').value = 1; $('slipMetric').value = 'pctBoth';
      runSlip(function () {
        var rows = SLIP.res.sites[0].scan.rows, r0 = rows[0], r14 = rows.filter(function (x) { return x.slip === 14; })[0];
        var best = rows.reduce(function (a, b) { return b.pctBoth > a.pctBoth ? b : a; });
        done('slipHeat', 'Launch slips: each column is a landing date, each row a metric for a 14-day mission. Landing on the nominal date: Sun up <b>' + r0.pctSun.toFixed(0) + '%</b>, Earth link ' + r0.pctEarth.toFixed(0) + '%, both together <b>' + r0.pctBoth.toFixed(0) + '%</b>, longest darkness ' + fmtD(r0.longestDarkH) + '. A <b>2-week slip</b> changes that to Sun up <b>' + r14.pctSun.toFixed(0) + '%</b>, Earth link ' + r14.pctEarth.toFixed(0) + '%, both <b>' + r14.pctBoth.toFixed(0) + '%</b>, longest darkness ' + fmtD(r14.longestDarkH) + '. The best landing in the next 60 days is +' + best.slip + ' days with ' + best.pctBoth.toFixed(0) + '%. Click any square to open that date.');
      });
    },
    function (done) { // 5. power and battery verdict
      showPage('power');
      $('pwWindow').value = 'slip'; $('pwMode').value = 'track'; $('pwArea').value = 1; $('pwEff').value = 30; $('pwLoad').value = 100; $('pwDod').value = 80;
      runPower().then(function () {
        var R = PW.res;
        done('pwVerdict', 'Power check for the nominal 14-day mission: a 1 m², 30%-efficient vertical Sun-tracking panel (example values) generates <b>' + (R.Wh / 1000).toFixed(1) + ' kWh</b> against <b>' + (R.loadWh / 1000).toFixed(1) + ' kWh</b> for a 100 W load, so the mission is <b>' + (R.Wh >= R.loadWh ? 'energy positive' : 'energy negative') + '</b>. Surviving the longest darkness (' + fmtD(R.darkH) + ') needs about <b>' + (R.battery / 1000).toFixed(1) + ' kWh</b> of battery at 80% usable capacity (example values). First-order estimate only.');
      });
    }
  ];
  function tourShow(i) {
    TOUR.i = i;
    if (!$('hint').hidden) hintClose();
    $('tour').hidden = false;
    $('tourStep').textContent = 'Tour · step ' + (i + 1) + ' of ' + TOUR_STEPS.length;
    $('tourText').textContent = 'Working...';
    $('tourPrev').disabled = i === 0;
    $('tourNext').textContent = i === TOUR_STEPS.length - 1 ? 'Finish' : 'Next';
    setTimeout(function () { TOUR_STEPS[i](function (hlId, html) { if (TOUR.i !== i) return; $('tourText').innerHTML = html; highlight(hlId); }); }, 30);
  }
  function tourClose() { $('tour').hidden = true; highlight(null); }

  // ------------------------------------------------------------------ prefs
  function setExpert(on) {
    document.body.classList.toggle('expert', on); $('expertToggle').checked = on;
    try { localStorage.setItem('asteria.expert', on ? '1' : '0'); } catch (e) { /* ignore */ }
    if (S.series) { renderMetrics(); renderWindows(); renderInstant(); }
  }
  function setExplain(on) {
    document.body.classList.toggle('explain-on', on); $('explainToggle').checked = on;
    if (!on) $('qpop').hidden = true;
    try { localStorage.setItem('asteria.explain', on ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------------ init
  function init() {
    if (!E || !window.Astronomy) { document.body.innerHTML = '<p style="padding:20px">Failed to load the ephemeris library (js/core.js).</p>'; return; }
    var now = new Date(); now.setUTCSeconds(0, 0);
    S.start = now;
    $('startInput').value = toInput(now);
    var pref = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    if (pref('asteria.expert') === '1') { document.body.classList.add('expert'); $('expertToggle').checked = true; }
    if (pref('asteria.explain') === '0') setExplain(false);

    Map.init($('lmap'), {
      onSelectSite: function (s) { selectSite(s); },
      onPickPoint: function (lat, lon) { useCustom(lat, lon); },
      onOutside: showOutside,
      siteById: siteById
    });
    Map.setSites(SITES);
    renderLegend('none');
    document.querySelectorAll('input[name=ovl]').forEach(function (r) { r.addEventListener('change', function () { Map.setOverlay(this.value); renderLegend(this.value); }); });
    $('markersToggle').addEventListener('change', function () { Map.setMarkersVisible(this.checked); });
    $('homeBtn').addEventListener('click', function () { Map.home(true); });
    $('aboutRegions').innerHTML = 'NASA\'s 28 October 2024 update lists nine candidate regions. Their boundaries are published only as images, with no numeric coordinates. ASTERIA plots a region only where a point is genuinely inside it:<ul>' +
      REG.regions.map(function (r) {
        return '<li><b>' + esc(r.name) + '</b>: ' + (r.sites.length ? r.sites.map(function (id) { var s = siteById(id); return esc(s.name) + ' (' + s.lat.toFixed(2) + '°, ' + s.lon.toFixed(2) + '°E)'; }).join('; ') + ' - ' + esc(r.how) : 'not plotted. ' + esc(REG.notPlottedNote)) + '</li>';
      }).join('') + '</ul><a href="' + esc(REG.source) + '" target="_blank" rel="noopener">NASA announcement (28 Oct 2024)</a>.';

    $('pickBtn').addEventListener('click', function () { togglePicker(); });
    $('siteSearch').addEventListener('input', renderSiteList);
    $('siteList').addEventListener('click', function (ev) { var it = ev.target.closest('.siteitem'); if (it) selectSite(siteById(it.dataset.id)); });
    $('siteList').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { var it = ev.target.closest('.siteitem'); if (it) selectSite(siteById(it.dataset.id)); } });
    $('customGo').addEventListener('click', function () { useCustom(); });
    $('fullSky').addEventListener('change', function () { S.fullSky = this.checked; renderInstant(); });
    $('startInput').addEventListener('change', function () { var d = fromInput(this.value); if (d) { S.start = d; S.idx = 0; recompute(); } });
    $('nowBtn').addEventListener('click', function () { var d = new Date(); d.setUTCSeconds(0, 0); S.start = d; S.idx = 0; $('startInput').value = toInput(d); recompute(); });
    $('windowSel').addEventListener('change', function () { S.windowDays = +this.value; S.idx = 0; recompute(); });
    $('minEl').addEventListener('change', function () {
      var v = Math.max(0, Math.min(30, +this.value || 0)); this.value = v; S.minEl = v; SLIP.res = null; recompute();
    });
    $('timeSlider').addEventListener('input', function () { setIdx(+this.value); });
    $('playBtn').addEventListener('click', function () { setPlaying(!S.playing); });
    $('speedSel').addEventListener('change', function () { S.speed = +this.value; });
    $('timeline').addEventListener('click', function (ev) { chartClick(ev, TL); });
    $('earthChart').addEventListener('click', function (ev) { chartClick(ev, CH.earth); });
    $('sunChart').addEventListener('click', function (ev) { chartClick(ev, CH.sun); });
    ['earthWindows', 'sunWindows'].forEach(function (id) {
      $(id).addEventListener('click', function (ev) {
        var tr = ev.target.closest('tr[data-s]'); if (!tr || !S.series) return;
        var s = S.series; setIdx(Math.ceil((+tr.dataset.s - s.t[0]) / (s.stepMin * 60000)));
      });
    });
    $('expertToggle').addEventListener('change', function () { setExpert(this.checked); });
    $('explainToggle').addEventListener('change', function () { setExplain(this.checked); });
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('.qb');
      if (b) { ev.preventDefault(); ev.stopPropagation(); showQ(b); return; }
      if (!ev.target.closest('#qpop')) $('qpop').hidden = true;
      if (!$('pickPanel').hidden && !ev.target.closest('#pickPanel') && !ev.target.closest('#pickBtn')) togglePicker(false);
    }, true);
    initQ(document);
    document.querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { showPage(t.dataset.page); }); });
    $('cmpAdd').addEventListener('click', function () { addScenario(S.site.id || '__custom', S.start, S.site.lat, S.site.lon); });
    $('cmpSlip').addEventListener('click', function () {
      var f = CMP[0]; if (!f) return;
      addScenario(f.siteId, new Date(f.start.getTime() + (+$('cmpSlipDays').value) * DAY), f.lat, f.lon);
    });
    $('cmpScenarios').addEventListener('change', scenarioChange);
    $('cmpScenarios').addEventListener('click', function (ev) { var d = ev.target.dataset.del; if (d !== undefined) { CMP.splice(+d, 1); renderScenarios(); } });
    $('cmpRun').addEventListener('click', function () { runCompare(); });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { Map.invalidate(); renderTimeline(); renderWindows(); renderInstant(); renderSlip(); renderPowerChart(); }, 150); });
    $('slipRun').addEventListener('click', function () { runSlip(); });
    $('slipMetric').addEventListener('change', renderSlip);
    $('slipHeat').addEventListener('mousemove', slipHover);
    $('slipHeat').addEventListener('mouseleave', function () { $('slipTip').hidden = true; });
    $('slipHeat').addEventListener('click', slipClick);
    $('pwRun').addEventListener('click', function () { runPower(); });
    $('pwMode').addEventListener('change', function () { $('pwFaceWrap').style.display = this.value === 'fixed' ? '' : 'none'; });
    $('pwFaceWrap').style.display = 'none';
    $('shareBtn').addEventListener('click', copyLink);
    $('tourBtn').addEventListener('click', function () { tourShow(0); });
    $('tourNext').addEventListener('click', function () { if (TOUR.i < TOUR_STEPS.length - 1) tourShow(TOUR.i + 1); else tourClose(); });
    $('tourPrev').addEventListener('click', function () { if (TOUR.i > 0) tourShow(TOUR.i - 1); });
    $('tourClose').addEventListener('click', tourClose);
    $('hintNext').addEventListener('click', function () { if (hintI < HINTS.length - 1) hintShow(hintI + 1); else hintClose(); });
    $('hintClose').addEventListener('click', hintClose);
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!$('tour').hidden) tourClose();
      if (!$('hint').hidden) hintClose();
      $('qpop').hidden = true; togglePicker(false);
    });

    $('customHint').textContent = COARSE_OK ? 'Points clicked or typed inside the map get a terrain horizon from coarser ' + COARSE_PX + ' m data (less precise than curated sites). Points outside the map use a smooth Moon without mountains.' : 'Custom points (typed or clicked on the map) use a smooth Moon without mountains: terrain is not computed for them.';
    if (window.LUNA_VALIDATION) { $('aboutNAngles').textContent = window.LUNA_VALIDATION.angles.length; $('aboutNEvents').textContent = window.LUNA_VALIDATION.events.length; }
    renderValidation();
    var h = readHash();
    if (h) applyHash(h); else selectSite(siteById(DEFAULT_SITE) || SITES[0], { fly: false });
    hashReady = true;
    writeHash();
    window.addEventListener('hashchange', function () { var o = readHash(); if (o) { hashReady = false; applyHash(o); hashReady = true; } });
    if (pref(HINT_KEY) !== '1') setTimeout(function () { if ($('tour').hidden) hintShow(0); }, 600);
  }

  window.LunaApp = {
    state: S,
    ready: function () { return S.ready || Promise.resolve(); },
    runSlip: runSlip, slipResults: function () { return SLIP.res; },
    runPower: runPower, powerResults: function () { return PW.res; },
    runCompare: runCompare, compareResults: function () { return CMPRES; },
    windows: function (body) { return WIN[body]; },
    jobsMode: function () { return Jobs.mode(); },
    selectSiteById: function (id) { return selectSite(siteById(id)); },
    tour: { start: function () { tourShow(0); }, step: function () { return TOUR.i; } }
  };
  window.AsteriaApp = window.LunaApp;   // product name alias (internal LunaApp kept for compatibility)

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
