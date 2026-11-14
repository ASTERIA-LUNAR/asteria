/* LunaWindow web app. No build step; all data comes from <script> tags (works from file://). */
(function () {
  'use strict';
  var E = window.LunaEngine;
  var SITES = window.LUNA_SITES || [];
  var HZ = window.LUNA_HORIZONS || {};
  var MAP = window.LUNA_MAP || null;
  var DAY = 86400000;

  var $ = function (id) { return document.getElementById(id); };
  var C = {
    sun: '#ffc23d', earth: '#4ea8ff', both: '#5ee27a', terrain: '#3a3128', terrainLine: '#9c8670',
    grid: '#1c2a45', text: '#8fa1bf', bg: '#070b14', smooth: '#262d3d'
  };

  // ------------------------------------------------------------------ state
  var S = {
    site: null, useTerrain: true, start: null, windowDays: 30,
    series: null, events: { sun: [], earth: [] }, after: {}, idx: 0, playing: false, speed: 4,
    fullSky: false
  };

  // ------------------------------------------------------------- utilities
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtUTC(d) {
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' +
      pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
  }
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
  function fmtHours(h) {
    if (h >= 48) return (h / 24).toFixed(1) + ' d';
    return h.toFixed(1) + ' h';
  }
  function fmtDeg(x, n) { return (x >= 0 ? '+' : '') + x.toFixed(n === undefined ? 2 : n) + '°'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function siteById(id) { for (var i = 0; i < SITES.length; i++) if (SITES[i].id === id) return SITES[i]; return null; }
  function maskFor(site, useTerrain) {
    if (!useTerrain || !site || !site.id || !HZ[site.id]) return null;
    return HZ[site.id].elevations;
  }
  function hasTerrain(site) { return !!(site && site.id && HZ[site.id]); }
  function fitCanvas(c, cssH) {
    var dpr = window.devicePixelRatio || 1;
    var w = c.clientWidth || c.parentNode.clientWidth;
    c.style.height = cssH + 'px';
    c.width = Math.round(w * dpr); c.height = Math.round(cssH * dpr);
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: cssH };
  }

  // ------------------------------------------------------- event handling
  // Refine all up/down transitions found in a series to 1 minute.
  function eventsFromSeries(site, s, body, mask) {
    var up = body === 'sun' ? s.sunUp : s.earthUp, out = [];
    for (var i = 1; i < up.length; i++) {
      if (up[i] !== up[i - 1]) {
        var r = E.findEvents(site, body, new Date(s.t[i - 1]), new Date(s.t[i]), mask, s.stepMin);
        out.push(r.events.length ? r.events[0] : { type: up[i] ? 'rise' : 'set', time: new Date(s.t[i]) });
      }
    }
    return out;
  }
  // Next event after time t (ms) using cached events, else search beyond the window (lazily, cached).
  var SEARCH_DAYS_AFTER = 400;
  function nextEventAfter(body, t) {
    var ev = S.events[body];
    for (var i = 0; i < ev.length; i++) if (ev[i].time.getTime() > t) return ev[i];
    if (!(body in S.after)) {
      var end = new Date(S.series.t[S.series.t.length - 1]);
      var r = E.nextEvent(siteObj(), body, end, maskFor(S.site, S.useTerrain), SEARCH_DAYS_AFTER, 60);
      S.after[body] = r.event;
    }
    return S.after[body];
  }
  function siteObj() { return { lat: S.site.lat, lon: S.site.lon }; }

  // -------------------------------------------------------------- compute
  function recompute() {
    var end = new Date(S.start.getTime() + S.windowDays * DAY);
    var step = E.defaultStepMin(S.start, end);
    var mask = maskFor(S.site, S.useTerrain);
    S.series = E.series(siteObj(), S.start, end, step, mask);
    S.events = { sun: eventsFromSeries(siteObj(), S.series, 'sun', mask), earth: eventsFromSeries(siteObj(), S.series, 'earth', mask) };
    S.after = {};
    S.stats = E.stats(S.series);
    var sl = $('timeSlider');
    sl.max = S.series.t.length - 1;
    if (S.idx > S.series.t.length - 1) S.idx = 0;
    sl.value = S.idx;
    $('stepNote').textContent = 'Sampling every ' + step + ' min (' + S.series.t.length + ' points); events refined to 1 min.';
    renderMetrics();
    renderTimeline();
    renderInstant();
    writeHash();
  }

  // ------------------------------------------------------------ site list
  var GROUPS = [['candidate', 'South-pole candidates & targets'], ['planned', 'Planned'], ['landed', 'Landed missions'], ['reference', 'Reference features']];
  function renderSiteList() {
    var q = $('siteSearch').value.trim().toLowerCase();
    var html = '';
    GROUPS.forEach(function (g) {
      var items = SITES.filter(function (s) {
        if (s.status !== g[0]) return false;
        if (!q) return true;
        return (s.name + ' ' + s.mission + ' ' + s.agency + ' ' + s.country + ' ' + s.notes).toLowerCase().indexOf(q) >= 0;
      });
      if (!items.length) return;
      html += '<div class="sitegroup">' + g[1] + '</div>';
      items.forEach(function (s) {
        var sel = S.site && S.site.id === s.id ? ' sel' : '';
        html += '<div class="siteitem' + sel + '" role="option" tabindex="0" data-id="' + s.id + '"><div><div class="nm">' + esc(s.name) +
          '</div><div class="sub">' + esc(s.agency) + ' · ' + s.lat.toFixed(3) + '°, ' + s.lon.toFixed(3) + '°E</div></div>' +
          (hasTerrain(s) ? '<span class="tag">terrain</span>' : '') + '</div>';
      });
    });
    $('siteList').innerHTML = html || '<div class="sitegroup">No matches</div>';
  }
  function selectSite(site) {
    S.site = site;
    S.fullSky = Math.abs(site.lat) < 70;
    $('fullSky').checked = S.fullSky;
    S.useTerrain = hasTerrain(site);
    $('terrainToggle').checked = S.useTerrain;
    $('terrainToggle').disabled = !hasTerrain(site);
    renderSiteHeader();
    renderSiteList();
    renderMap();
    recompute();
  }
  function renderSiteHeader() {
    var s = S.site;
    $('siteName').textContent = s.name;
    var meta = s.lat.toFixed(4) + '°, ' + s.lon.toFixed(4) + '°E';
    if (s.id) {
      meta += ' · ' + esc(s.mission) + ' · ' + esc(s.agency) + ' · ' + esc(s.status) + (s.year ? ' (' + s.year + ')' : '');
      meta += '<br><b>Coordinate:</b> ' + esc(s.coordKind) + '. ' + esc(s.notes);
      meta += '<br>Source: ' + s.sources.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u.replace(/^https?:\/\//, '').slice(0, 60)) + '</a>'; }).join(' · ');
      if (hasTerrain(s)) meta += '<br>Terrain: LOLA, site height ' + HZ[s.id].siteHeight_m.toFixed(0) + ' m above the 1737.4 km sphere; observer 2 m above ground.';
    } else {
      meta += ' · custom point';
    }
    $('siteMeta').innerHTML = meta;
    renderBadge();
  }
  function renderBadge() {
    var b = $('horizonBadge');
    if (maskFor(S.site, S.useTerrain)) { b.className = 'badge terrain'; b.textContent = 'Terrain horizon: LOLA 20-120 m DEM'; }
    else { b.className = 'badge smooth'; b.textContent = 'Smooth Moon horizon - terrain not included'; }
  }

  // ------------------------------------------------------------------- map
  var mapImg = null, mapMarkers = [];
  function projXY(lat, lon) {
    var r = 2 * 1737400 * Math.tan((90 - Math.abs(lat)) * Math.PI / 360);
    var lo = lon * Math.PI / 180;
    return { x: r * Math.sin(lo), y: r * Math.cos(lo) };
  }
  function invXY(x, y) {
    var r = Math.sqrt(x * x + y * y);
    return { lat: -90 + 2 * Math.atan(0.5 * r / 1737400) * 180 / Math.PI, lon: Math.atan2(x, y) * 180 / Math.PI };
  }
  function renderMap() {
    var c = $('map');
    if (!MAP || !c.clientWidth) return;   // hidden page: nothing to draw
    var w = c.clientWidth || 300;
    var f = fitCanvas(c, w), ctx = f.ctx;
    var H = MAP.halfExtent_m;
    var toPx = function (p) { return { x: (p.x + H) / (2 * H) * w, y: (H - p.y) / (2 * H) * w }; };
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, w);
    if (mapImg && mapImg.complete && mapImg.naturalWidth) ctx.drawImage(mapImg, 0, 0, w, w);
    // graticule
    ctx.strokeStyle = 'rgba(76,201,240,.35)'; ctx.lineWidth = 1; ctx.fillStyle = 'rgba(160,220,255,.8)'; ctx.font = '10px system-ui';
    [-86, -88].forEach(function (lat) {
      var r = projXY(lat, 0).y / (2 * H) * w;
      ctx.beginPath(); ctx.arc(w / 2, w / 2, r, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillText(Math.abs(lat) + '°S', w / 2 + 3, w / 2 - r - 3);
    });
    [0, 90, 180, 270].forEach(function (lon) {
      var p = toPx(projXY(-85.2, lon));
      ctx.beginPath(); ctx.moveTo(w / 2, w / 2); ctx.lineTo(p.x, p.y); ctx.stroke();
      var lbl = lon === 0 ? '0°' : lon === 90 ? '90°E' : lon === 180 ? '180°' : '90°W';
      var q = toPx(projXY(-85.6, lon));
      ctx.fillText(lbl, q.x + 3, q.y + (lon === 180 ? -4 : 11));
    });
    // markers
    mapMarkers = [];
    SITES.forEach(function (s) {
      if (s.lat > -80) return;
      var p = toPx(projXY(s.lat, s.lon));
      if (p.x < 0 || p.y < 0 || p.x > w || p.y > w) return;
      mapMarkers.push({ s: s, x: p.x, y: p.y });
    });
    var sel = null;
    mapMarkers.forEach(function (m) {
      var isSel = S.site && S.site.id === m.s.id;
      if (isSel) sel = m;
      ctx.beginPath(); ctx.arc(m.x, m.y, isSel ? 7 : 5, 0, 2 * Math.PI);
      ctx.fillStyle = m.s.status === 'landed' ? '#5ee27a' : m.s.status === 'reference' ? '#b9b9b9' : '#ffc23d';
      ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = isSel ? '#fff' : '#000'; ctx.stroke();
    });
    if (S.site && !S.site.id && S.site.lat < -80) {
      var p = toPx(projXY(S.site.lat, S.site.lon));
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x - 8, p.y); ctx.lineTo(p.x + 8, p.y); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y + 8); ctx.stroke();
    }
    if (sel) {
      ctx.font = '600 12px system-ui';
      var tw = ctx.measureText(sel.s.name).width;
      var lx = Math.min(Math.max(sel.x + 10, 4), w - tw - 8), ly = Math.max(sel.y - 10, 14);
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(lx - 3, ly - 12, tw + 6, 16);
      ctx.fillStyle = '#fff'; ctx.fillText(sel.s.name, lx, ly);
    }
  }
  function mapClick(ev) {
    var c = $('map'), rect = c.getBoundingClientRect();
    var px = ev.clientX - rect.left, py = ev.clientY - rect.top, w = rect.width;
    for (var i = 0; i < mapMarkers.length; i++) {
      var m = mapMarkers[i];
      if (Math.hypot(m.x - px, m.y - py) < 9) { selectSite(m.s); return; }
    }
    var H = MAP.halfExtent_m;
    var ll = invXY(px / w * 2 * H - H, H - py / w * 2 * H);
    $('customLat').value = ll.lat.toFixed(4); $('customLon').value = ll.lon.toFixed(4);
    useCustom();
  }
  function mapHover(ev) {
    var c = $('map'), rect = c.getBoundingClientRect();
    var px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    var hit = mapMarkers.filter(function (m) { return Math.hypot(m.x - px, m.y - py) < 9; });
    c.title = hit.length ? hit.map(function (m) { return m.s.name; }).join(' / ') : 'Click to use this point as a custom site';
  }
  function useCustom() {
    var lat = parseFloat($('customLat').value), lon = parseFloat($('customLon').value);
    if (!(lat >= -90 && lat <= 90) || !(lon >= -360 && lon <= 360)) { alert('Latitude must be -90..90 and longitude -360..360 (east positive).'); return; }
    selectSite({ id: null, name: 'Custom point', lat: lat, lon: lon });
  }

  // ----------------------------------------------------- instant / cards
  function renderInstant() {
    var s = S.series; if (!s) return;
    var i = S.idx, t = s.t[i], d = new Date(t);
    $('curUtc').textContent = fmtUTC(d) + ' UTC';
    $('curRiyadh').textContent = fmtRiyadh(d) + ' AST';
    var r = E.sunEarthAt(siteObj(), d);
    var mask = maskFor(S.site, S.useTerrain);
    var hs = E.maskAt(mask, r.sun.az), he = E.maskAt(mask, r.earth.az);
    $('vSunEl').textContent = fmtDeg(r.sun.el);
    $('vSunAz').textContent = r.sun.az.toFixed(1) + '°';
    $('vSunFrac').textContent = (100 * E.diskFractionAbove(r.sun.el, r.sun.radius_deg, hs)).toFixed(0) + '%';
    $('vEarthEl').textContent = fmtDeg(r.earth.el);
    $('vEarthAz').textContent = r.earth.az.toFixed(1) + '°';
    $('vHz').textContent = fmtDeg(hs, 1) + ' / ' + fmtDeg(he, 1);
    countdown('sun', s.sunUp[i], t, 'sunset', 'sunrise', 'Sun');
    countdown('earth', s.earthUp[i], t, 'Earthset', 'Earthrise', 'Earth');
    renderSky(r);
    drawTimelineCursor();
  }
  function countdown(body, up, t, setW, riseW, Body) {
    var ev = nextEventAfter(body, t);
    $(body + 'CountLbl').textContent = (up ? Body + ' is UP · next ' : Body + ' is DOWN · next ') + (up ? setW : riseW);
    if (ev) {
      $(body + 'Count').textContent = fmtDur(ev.time.getTime() - t);
      $(body + 'CountSub').textContent = 'at ' + fmtUTC(ev.time) + ' UTC (' + fmtRiyadh(ev.time) + ' Riyadh)';
    } else {
      var maxD = Math.round((S.series.t[S.series.t.length - 1] - t) / DAY) + SEARCH_DAYS_AFTER;
      $(body + 'Count').textContent = '> ' + maxD + ' days';
      $(body + 'CountSub').textContent = up ? 'No ' + setW + ' found in the search range.' : 'No ' + riseW + ' found in the search range' + (body === 'sun' ? ' (permanently shadowed?)' : (S.site.lon > 90 && S.site.lon < 270 || S.site.lon < -90 ? ' (far side: Earth never rises)' : '')) + '.';
    }
  }

  // -------------------------------------------------------------- sky view
  function renderSky(cur) {
    var c = $('sky');
    if (!c.clientWidth) return;
    var cssH = Math.max(240, Math.min(380, (c.clientWidth || 600) * 0.32));
    var f = fitCanvas(c, cssH), ctx = f.ctx, w = f.w, h = f.h;
    var s = S.series, mask = maskFor(S.site, S.useTerrain);
    var L = 38, R = 8, T = 10, B = 26, pw = w - L - R, ph = h - T - B;
    var ymin, ymax;
    if (S.fullSky) { ymin = -10; ymax = 90; }
    else {
      var mmax = 0, mmin = 0;
      if (mask) { mmax = Math.max.apply(null, mask); mmin = Math.min.apply(null, mask); }
      var smax = Math.max.apply(null, s.sunEl), emax = Math.max.apply(null, s.earthEl);
      ymin = Math.floor(Math.min(-3, mmin - 1));
      ymax = Math.ceil(Math.max(6, mmax + 2, Math.min(smax, 25) + 1, Math.min(emax, 25) + 1));
    }
    var X = function (az) { return L + az / 360 * pw; };
    var Y = function (el) { return T + (ymax - el) / (ymax - ymin) * ph; };
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    // sky gradient
    var g = ctx.createLinearGradient(0, T, 0, Y(0));
    g.addColorStop(0, '#060a14'); g.addColorStop(1, '#0d1a33');
    ctx.fillStyle = g; ctx.fillRect(L, T, pw, Y(0) - T);
    // grid
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.fillStyle = C.text; ctx.font = '11px system-ui';
    var dirs = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW', 360: 'N' };
    for (var az = 0; az <= 360; az += 45) {
      ctx.beginPath(); ctx.moveTo(X(az), T); ctx.lineTo(X(az), T + ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillText(dirs[az] + ' ' + az + '°', X(az), h - 8);
    }
    var span = ymax - ymin, stepY = span > 60 ? 15 : span > 20 ? 5 : span > 10 ? 2 : 1;
    ctx.textAlign = 'right';
    for (var el = Math.ceil(ymin / stepY) * stepY; el <= ymax; el += stepY) {
      ctx.beginPath(); ctx.moveTo(L, Y(el)); ctx.lineTo(L + pw, Y(el)); ctx.stroke();
      ctx.fillText(el + '°', L - 5, Y(el) + 4);
    }
    // ground / terrain
    ctx.beginPath(); ctx.moveTo(X(0), T + ph);
    for (var a = 0; a <= 360; a++) ctx.lineTo(X(a), Y(mask ? mask[a % 360] : 0));
    ctx.lineTo(X(360), T + ph); ctx.closePath();
    ctx.fillStyle = mask ? C.terrain : C.smooth; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = mask ? C.terrainLine : '#55607a'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (a = 0; a <= 360; a++) { var yy = Y(mask ? mask[a % 360] : 0); if (a === 0) ctx.moveTo(X(a), yy); else ctx.lineTo(X(a), yy); }
    ctx.stroke();
    if (mask) { // smooth-Moon reference line
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(200,210,230,.35)';
      ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(L + pw, Y(0)); ctx.stroke(); ctx.setLineDash([]);
    }
    // tracks
    ctx.save(); ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();
    var n = s.t.length, every = Math.max(1, Math.floor(n / 1500));
    [['sun', C.sun], ['earth', C.earth]].forEach(function (b) {
      var azA = b[0] === 'sun' ? s.sunAz : s.earthAz, elA = b[0] === 'sun' ? s.sunEl : s.earthEl;
      ctx.fillStyle = b[1];
      for (var i = 0; i < n; i += every) {
        ctx.globalAlpha = (b[0] === 'sun' ? s.sunUp[i] : s.earthUp[i]) ? 0.55 : 0.18;
        ctx.fillRect(X(azA[i]) - 1, Y(elA[i]) - 1, 2, 2);
      }
    });
    ctx.globalAlpha = 1;
    // current bodies (true angular size on the vertical axis, min 4 px)
    var pxPerDeg = ph / (ymax - ymin);
    drawBody(ctx, X(cur.earth.az), Y(cur.earth.el), Math.max(4, cur.earth.radius_deg * pxPerDeg), C.earth, 'Earth');
    drawBody(ctx, X(cur.sun.az), Y(cur.sun.el), Math.max(4, cur.sun.radius_deg * pxPerDeg), C.sun, 'Sun');
    ctx.restore();
    ctx.strokeStyle = '#2a3a5c'; ctx.strokeRect(L, T, pw, ph);
    $('skyCaption').textContent = (mask ? 'Brown silhouette: LOLA terrain horizon (2 m above ground). Dashed line: smooth-Moon horizon (0°). '
      : 'Smooth Moon horizon - terrain not included. ') + 'Vertical scale ' + (S.fullSky ? 'full sky' : 'zoomed to the horizon') +
      '; Sun and Earth drawn at true angular size vertically. Dots: positions over the window (faint = below horizon).';
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
  function renderTimeline() {
    var c = $('timeline');
    if (!c.clientWidth) { TL = null; return; }
    var f = fitCanvas(c, 150), ctx = f.ctx, w = f.w, h = f.h;
    var s = S.series, n = s.t.length;
    var L = w < 500 ? 78 : 110, R = 10, T = 8, rowH = 28, gap = 10;
    var pw = w - L - R;
    TL = { L: L, pw: pw, w: w, h: h, t0: s.t[0], t1: s.t[n - 1] };
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    var days = (TL.t1 - TL.t0) / DAY, maxTicks = Math.max(2, Math.floor(pw / 85));
    var tickD = [1, 2, 5, 7, 10, 15, 30, 60, 90, 120].filter(function (d) { return days / d <= maxTicks; })[0] || 180;
    var y0 = T + 3 * (rowH + gap) - gap + 4;
    var first = new Date(TL.t0); first.setUTCHours(0, 0, 0, 0);
    ctx.fillStyle = C.text; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.strokeStyle = C.grid;
    for (var td = first.getTime(); td <= TL.t1; td += tickD * DAY) {
      if (td < TL.t0) continue;
      var x = L + (td - TL.t0) / (TL.t1 - TL.t0) * pw;
      ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, y0); ctx.stroke();
      var d = new Date(td);
      ctx.fillText(d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), x, y0 + 13);
    }
    var rows = [['Sun visible', C.sun, s.sunUp], ['Earth visible', C.earth, s.earthUp], ['Both (power+DTE)', C.both, null]];
    ctx.font = '12px system-ui'; ctx.textAlign = 'left';
    rows.forEach(function (r, k) {
      var y = T + k * (rowH + gap);
      ctx.fillStyle = '#131d31'; ctx.fillRect(L, y, pw, rowH);
      ctx.fillStyle = C.text; ctx.textAlign = 'left'; ctx.font = (w < 500 ? '10px' : '12px') + ' system-ui';
      ctx.fillText(w < 500 ? r[0].replace(' (power+DTE)', '') : r[0], 6, y + rowH / 2 + 4);
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
    // cache the static part in an offscreen canvas so the cursor can be redrawn cheaply
    TL.base = document.createElement('canvas');
    TL.base.width = c.width; TL.base.height = c.height;
    TL.base.getContext('2d').drawImage(c, 0, 0);
    drawTimelineCursor();
  }
  function drawTimelineCursor() {
    if (!TL || !TL.base) return;
    var c = $('timeline'), ctx = c.getContext('2d');
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(TL.base, 0, 0); ctx.restore();
    var n = S.series.t.length, x = TL.L + S.idx / (n - 1) * TL.pw;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 2); ctx.lineTo(x, 8 + 3 * 38 - 6); ctx.stroke();
  }
  function timelineClick(ev) {
    if (!TL) return;
    var rect = $('timeline').getBoundingClientRect();
    var f = (ev.clientX - rect.left - TL.L) / TL.pw;
    if (f < 0 || f > 1) return;
    setIdx(Math.round(f * (S.series.t.length - 1)));
  }
  function renderMetrics() {
    var st = S.stats;
    var m = [
      ['Sunlit', st.pctSun.toFixed(1) + '%'], ['Earth visible', st.pctEarth.toFixed(1) + '%'],
      ['Average illumination (solar-disk fraction)', (100 * st.avgSunFrac).toFixed(1) + '%'],
      ['Both (power + DTE)', st.pctBoth.toFixed(1) + '%'],
      ['Longest darkness', st.longestDarkH >= S.windowDays * 24 - 0.01 ? 'whole window' : fmtHours(st.longestDarkH)],
      ['Longest Earth blackout', st.longestBlackoutH >= S.windowDays * 24 - 0.01 ? 'whole window' : fmtHours(st.longestBlackoutH)]
    ];
    $('metrics').innerHTML = m.map(function (x) { return '<div class="metric"><div class="v">' + x[1] + '</div><div class="k">' + x[0] + '</div></div>'; }).join('');
  }

  // ------------------------------------------------------------ animation
  function setIdx(i) {
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
    S.playing = p;
    $('playBtn').innerHTML = p ? '&#10074;&#10074;' : '&#9654;';
    $('playBtn').setAttribute('aria-label', p ? 'Pause' : 'Play');
    if (p) requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- compare
  var CMP = [];
  function siteOptions(selId) {
    var html = '';
    GROUPS.forEach(function (g) {
      html += '<optgroup label="' + g[1] + '">';
      SITES.filter(function (s) { return s.status === g[0]; }).forEach(function (s) {
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
        '<label class="smallswitch" style="flex-direction:row"><input data-f="terrain" type="checkbox"' + (c.terrain ? ' checked' : '') + (hasTerrain(siteById(c.siteId)) ? '' : ' disabled') + '> use terrain horizon</label></div>';
    }).join('');
    $('cmpAdd').disabled = CMP.length >= 4; $('cmpSlip').disabled = CMP.length >= 4;
  }
  function addScenario(siteId, start, lat, lon) {
    if (CMP.length >= 4) return;
    var s = siteById(siteId);
    CMP.push({ siteId: siteId, start: start, lat: lat === undefined ? (s ? s.lat : -89.5) : lat, lon: lon === undefined ? (s ? s.lon : 0) : lon, terrain: hasTerrain(s) });
    renderScenarios();
  }
  function scenarioChange(ev) {
    var el = ev.target, box = el.closest('.scenario'); if (!box) return;
    var c = CMP[+box.dataset.k], f = el.dataset.f;
    if (f === 'site') {
      c.siteId = el.value;
      var s = siteById(c.siteId);
      if (s) { c.lat = s.lat; c.lon = s.lon; }
      c.terrain = hasTerrain(s);
      renderScenarios();
    } else if (f === 'start') { var d = fromInput(el.value); if (d) c.start = d; }
    else if (f === 'lat') c.lat = parseFloat(el.value);
    else if (f === 'lon') c.lon = parseFloat(el.value);
    else if (f === 'terrain') c.terrain = el.checked;
  }
  function runCompare() {
    $('cmpResult').innerHTML = '<p class="hint">Computing...</p>';
    setTimeout(function () {
      var days = +$('cmpWindow').value;
      var res = CMP.map(function (c) {
        var s = siteById(c.siteId) || { id: null, name: 'Custom (' + c.lat + ', ' + c.lon + ')', lat: c.lat, lon: c.lon };
        var site = { lat: c.lat, lon: c.lon };
        var mask = c.terrain ? maskFor(s, true) : null;
        var end = new Date(c.start.getTime() + days * DAY);
        var ser = E.series(site, c.start, end, E.defaultStepMin(c.start, end), mask);
        var st = E.stats(ser);
        var sunEv = eventsFromSeries(site, ser, 'sun', mask), earthEv = eventsFromSeries(site, ser, 'earth', mask);
        var firstOf = function (list, type) { for (var i = 0; i < list.length; i++) if (list[i].type === type) return list[i]; return null; };
        var sunSet = ser.sunUp[0] ? firstOf(sunEv, 'set') : null, earthSet = ser.earthUp[0] ? firstOf(earthEv, 'set') : null;
        return { c: c, s: s, mask: mask, ser: ser, st: st,
          sunLeftH: ser.sunUp[0] ? (sunSet ? (sunSet.time - c.start) / 3600000 : days * 24) : 0,
          earthLeftH: ser.earthUp[0] ? (earthSet ? (earthSet.time - c.start) / 3600000 : days * 24) : 0,
          maxSun: Math.max.apply(null, ser.sunEl) };
      });
      var rows = [
        ['Site', function (r) { return esc(r.s.name); }],
        ['Start (UTC)', function (r) { return fmtUTC(r.c.start); }],
        ['Horizon model', function (r) { return r.mask ? 'LOLA terrain' : 'Smooth Moon (terrain not included)'; }],
        ['Sunlit %', function (r) { return r.st.pctSun; }, 'max', function (v) { return v.toFixed(1) + '%'; }],
        ['Earth visible %', function (r) { return r.st.pctEarth; }, 'max', function (v) { return v.toFixed(1) + '%'; }],
        ['Both (power + DTE) %', function (r) { return r.st.pctBoth; }, 'max', function (v) { return v.toFixed(1) + '%'; }],
        ['Sunlight left at start', function (r) { return r.sunLeftH; }, 'max', function (v) { return v >= days * 24 ? '> window' : v === 0 ? 'Sun down' : fmtHours(v); }],
        ['Earth link left at start', function (r) { return r.earthLeftH; }, 'max', function (v) { return v >= days * 24 ? '> window' : v === 0 ? 'Earth down' : fmtHours(v); }],
        ['Longest darkness', function (r) { return r.st.longestDarkH; }, 'min', fmtHours],
        ['Longest Earth blackout', function (r) { return r.st.longestBlackoutH; }, 'min', fmtHours],
        ['Max Sun elevation', function (r) { return r.maxSun; }, 'max', function (v) { return v.toFixed(2) + '°'; }]
      ];
      var html = '<table><thead><tr><th>Metric (' + days + '-day window)</th>' + res.map(function (r, k) { return '<th class="num">Scenario ' + (k + 1) + '</th>'; }).join('') + '</tr></thead><tbody>';
      rows.forEach(function (row) {
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
      html += '</tbody></table><p class="hint">Highlighted = best in row (higher % and longer remaining windows are better; shorter darkness/blackout is better). Ties are not highlighted.</p>';
      $('cmpResult').innerHTML = html;
      // mini timelines
      $('cmpBars').innerHTML = res.map(function (r, k) { return '<div class="cmpbar"><div class="lbl">Scenario ' + (k + 1) + ': ' + esc(r.s.name) + ' from ' + fmtUTC(r.c.start) + ' UTC</div><canvas id="cmpc' + k + '" style="width:100%"></canvas></div>'; }).join('');
      res.forEach(function (r, k) {
        var c = $('cmpc' + k), f = fitCanvas(c, 46), ctx = f.ctx, n = r.ser.t.length;
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, f.w, f.h);
        [[r.ser.sunUp, C.sun, 0], [r.ser.earthUp, C.earth, 15], [null, C.both, 30]].forEach(function (row) {
          ctx.fillStyle = '#131d31'; ctx.fillRect(0, row[2], f.w, 13);
          ctx.fillStyle = row[1];
          for (var i = 0; i < n; i++) {
            var on = row[0] ? row[0][i] : (r.ser.sunUp[i] && r.ser.earthUp[i]);
            if (on) ctx.fillRect(i / n * f.w, row[2], Math.max(1, f.w / n + 0.5), 13);
          }
        });
      });
    }, 30);
  }

  // ------------------------------------------------------------- validation
  function renderValidation() {
    var V = window.LUNA_VALIDATION, el = $('validationContent');
    if (!V) { el.innerHTML = '<p>Validation data missing (run node tests/validate.js).</p>'; return; }
    var f = function (x, n) { return x.toFixed(n); };
    var h = '<h2>Ephemeris validation against NASA/JPL Horizons</h2>';
    h += '<div class="bigresult ' + (V.overall ? 'pass' : 'fail') + '">Overall: ' + (V.overall ? 'PASS' : 'FAIL') + '</div>';
    h += '<p class="hint">Generated ' + esc(V.generated) + ' by <code>node tests/validate.js</code>. Raw Horizons responses are cached in <code>tests/horizons_cache/</code>. Full write-up: VALIDATION_REPORT.md.</p>';
    h += '<table><thead><tr><th>Part</th><th>Result</th><th>Detail</th></tr></thead><tbody>';
    h += '<tr><td>Angles vs Horizons (' + V.angles.length + ' comparisons)</td><td class="' + (V.anglePass ? 'pass' : 'fail') + '">' + (V.anglePass ? 'PASS' : 'FAIL') + '</td><td>Elevation error max ' + f(V.angleStats.el.max, 4) + '° (mean ' + f(V.angleStats.el.mean, 4) + '°), limit ' + V.tolerances.elDeg + '°. Azimuth error max ' + f(V.angleStats.az.max, 4) + '° (mean ' + f(V.angleStats.az.mean, 4) + '°), limit ' + V.tolerances.azDeg + '°.</td></tr>';
    h += '<tr><td>Event times vs Horizons (' + V.events.length + ')</td><td class="' + (V.eventPass ? 'pass' : 'fail') + '">' + (V.eventPass ? 'PASS' : 'FAIL') + '</td><td>Max ' + f(V.eventStats.max, 2) + ' min (mean ' + f(V.eventStats.mean, 2) + ' min), limit ' + V.tolerances.eventMin + ' min.</td></tr>';
    h += '<tr><td>Physics sanity tests (' + V.sanity.tests.length + ')</td><td class="' + (V.sanityPass ? 'pass' : 'fail') + '">' + (V.sanityPass ? 'PASS' : 'FAIL') + '</td><td>' + esc(V.sanity.period) + '</td></tr></tbody></table>';
    h += '<h3>Method</h3><p>Our engine vs Horizons with the observer on the Moon (<code>CENTER=\'coord@301\'</code>, <code>COORD_TYPE=\'GEODETIC\'</code>, height 0 km on the 1737.4 km sphere), targets Sun (10) and Earth (399), quantity 4 (apparent azimuth/elevation), <code>APPARENT=\'AIRLESS\'</code>. Azimuth tolerance is relaxed (0.2°/cos el) only above 80° elevation, where azimuth becomes ill-defined near the zenith.</p>';
    h += '<h3>Angle cases</h3><div class="tablewrap"><table><thead><tr><th>Site</th><th class="num">Lat</th><th class="num">E-lon</th><th>UTC</th><th>Body</th><th class="num">Az ours</th><th class="num">Az Horizons</th><th class="num">ΔAz</th><th class="num">El ours</th><th class="num">El Horizons</th><th class="num">ΔEl</th><th>Pass</th></tr></thead><tbody>';
    V.angles.forEach(function (c) {
      h += '<tr><td>' + esc(c.site) + '</td><td class="num">' + c.lat + '</td><td class="num">' + c.lon + '</td><td>' + c.date.replace('T', ' ').replace(':00Z', '') + '</td><td>' + c.body + '</td><td class="num">' + f(c.oursAz, 4) + '</td><td class="num">' + f(c.hzAz, 4) + '</td><td class="num">' + f(c.dAz, 4) + '</td><td class="num">' + f(c.oursEl, 4) + '</td><td class="num">' + f(c.hzEl, 4) + '</td><td class="num">' + f(c.dEl, 4) + '</td><td class="' + (c.pass ? 'pass' : 'fail') + '">' + (c.pass ? 'PASS' : 'FAIL') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<h3>Event times (smooth-Moon horizon)</h3><div class="tablewrap"><table><thead><tr><th>Event</th><th class="num">Lat</th><th class="num">E-lon</th><th>Ours (UTC)</th><th>Horizons (UTC)</th><th class="num">Δ (min)</th><th>Pass</th></tr></thead><tbody>';
    V.events.forEach(function (e) {
      h += '<tr><td>' + esc(e.label) + '</td><td class="num">' + e.lat + '</td><td class="num">' + e.lon + '</td><td>' + (e.ours || '-') + '</td><td>' + (e.horizons || '-') + '</td><td class="num">' + (e.dMin !== undefined ? f(e.dMin, 2) : esc(e.error || '-')) + '</td><td class="' + (e.pass ? 'pass' : 'fail') + '">' + (e.pass ? 'PASS' : 'FAIL') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<h3>Physics sanity tests</h3><table><thead><tr><th>Test</th><th>Result</th><th>Pass</th></tr></thead><tbody>';
    V.sanity.tests.forEach(function (t) { h += '<tr><td>' + esc(t.name) + '</td><td>' + esc(t.value) + '</td><td class="' + (t.pass ? 'pass' : 'fail') + '">' + (t.pass ? 'PASS' : 'FAIL') + '</td></tr>'; });
    h += '</tbody></table>';
    var I = window.LUNA_ILLUMINATION;
    if (I) {
      h += '<h3>Terrain illumination check (one year, LOLA horizons)</h3><p class="hint">' + esc(I.period) + ', ' + I.stepMin + '-minute steps, Sun/Earth centre vs horizon, observer ' + I.observerHeight_m + ' m above ground.</p>';
      h += '<div class="tablewrap"><table><thead><tr><th>Site</th><th class="num">Height (m)</th><th class="num">Sunlit % terrain</th><th class="num">Sunlit % smooth</th><th class="num">Earth % terrain</th><th class="num">Both %</th><th class="num">Longest dark</th></tr></thead><tbody>';
      I.rows.forEach(function (r) {
        h += '<tr><td>' + esc(r.name) + '</td><td class="num">' + r.siteHeight_m.toFixed(0) + '</td><td class="num">' + r.sunTerrain.toFixed(1) + '</td><td class="num">' + r.sunSmooth.toFixed(1) + '</td><td class="num">' + r.earthTerrain.toFixed(1) + '</td><td class="num">' + r.bothTerrain.toFixed(1) + '</td><td class="num">' + fmtHours(r.longestDarkH) + '</td></tr>';
      });
      h += '</tbody></table></div>';
      h += '<p>The permanently shadowed Shackleton floor gets 0% sunlight while rim and ridge points 10-30 km away get 50-55%, as expected. Published comparison: Mahanti et al. 2024 (PSJ 5, 62) state that a small area at (−88.79, 124.5) receives persistent illumination "approximately 80% of the time" (citing Mazarico et al. 2011). At that exact (rounded) coordinate we get ' + (I.rows.filter(function (r) { return r.id === 'peak_shackleton'; })[0] || { sunTerrain: NaN }).sunTerrain.toFixed(1) + '% for 2027; within ±400 m of it our values range from 2% to 68% (see GAPS_AND_ISSUES.md). Illumination at the pole changes over a few hundred metres, the published value is for a different period and method, and the coordinate is only given to 0.01°, so we report the difference rather than tune the model.</p>';
    }
    h += renderXcheck();
    el.innerHTML = h;
  }
  function renderXcheck() {
    var X = window.LUNA_XCHECK, SRC = window.LUNA_XCHECK_SOURCES || [];
    if (!X) return '<h3>Terrain illumination cross-check</h3><p class="hint">Not available (run tools/illum_crosscheck.py).</p>';
    var p = function (v) { return (v === null || v === undefined) ? 'n/a' : (100 * v).toFixed(1) + '%'; };
    var h = '<h3>Terrain illumination cross-check: Peak near Shackleton vs published ~80%</h3>';
    h += '<ul>' + SRC.map(function (s) { return '<li><b>' + esc(s.what) + ':</b> ' + esc(s.quote) + ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener">source</a></li>'; }).join('') + '</ul>';
    h += '<p class="hint">Sun directions from the validated engine, hourly over ' + esc(X.span) + ' (one 18.6-year cycle); LOLA terrain horizons at 2 m and 10 m above the surface. (1) average visible solar-disk fraction, (2) % time Sun centre up, (3) % time any part of the disk up.</p>';
    h += '<div class="tablewrap"><table><thead><tr><th>Observer</th><th>Period</th><th class="num">(1) Avg disk fraction</th><th class="num">(2) Centre up</th><th class="num">(3) Any part up</th></tr></thead><tbody>';
    X.central.forEach(function (c) { h += '<tr><td>' + c.height_m + ' m</td><td>' + esc(c.period) + '</td><td class="num">' + p(c.avgDiskFrac) + '</td><td class="num">' + c.pctCentre.toFixed(1) + '%</td><td class="num">' + c.pctAnyPart.toFixed(1) + '%</td></tr>'; });
    h += '<tr><td colspan="2">Published map ' + esc(X.pgdaProduct) + ' at the same point</td><td class="num">' + p(X.pgdaAtPoint.bilinear) + '</td><td></td><td></td></tr>';
    h += '<tr><td colspan="2">Published text (Mahanti et al. 2024)</td><td class="num">~80%</td><td></td><td></td></tr></tbody></table></div>';
    h += '<div class="tablewrap"><table><thead><tr><th>Neighbourhood (500 m, 50 m grid)</th><th>Best point (ours)</th><th class="num">Ours (1)</th><th class="num">Published map there</th><th class="num">Map max in area</th><th class="num">r</th></tr></thead><tbody>';
    Object.keys(X.grid).forEach(function (k) {
      var g = X.grid[k], b = g.best;
      h += '<tr><td>' + k + ' m observer, ' + g.n + ' points</td><td>' + b.lat.toFixed(5) + ', ' + b.lon.toFixed(4) + '</td><td class="num">' + p(b.avgDiskFrac) + '</td><td class="num">' + p(b.pgda) + '</td><td class="num">' + p(g.bestByPgda.pgda) + '</td><td class="num">' + g.corrWithPgda.toFixed(2) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<div class="tablewrap"><table><thead><tr><th>Site (2 m, 18.6 yr)</th><th class="num">(1) Avg disk fraction</th><th class="num">(2) Centre up</th><th class="num">Published map</th></tr></thead><tbody>';
    X.sites.forEach(function (s) { var site = siteById(s.id); h += '<tr><td>' + esc(site ? site.name : s.id) + '</td><td class="num">' + p(s.avgDiskFrac) + '</td><td class="num">' + s.pctCentre.toFixed(1) + '%</td><td class="num">' + p(s.pgda) + '</td></tr>'; });
    h += '</tbody></table></div>';
    var c18 = X.central.filter(function (c) { return c.height_m === 2 && c.period === '18.6 yr'; })[0];
    h += '<p><b>Finding:</b> at the published coordinate the published 60 m map itself gives ' + p(X.pgdaAtPoint.bilinear) + ' and LunaWindow gives ' + p(c18.avgDiskFrac) + ' (2 m, 18.6 years). Both are well below "approximately 80%", so that figure is not reproduced at this coordinate by the public map product.' + (X.grid['10.0'] ? ' With the observer 10 m above the surface, the best point within 500 m reaches ' + p(X.grid['10.0'].best.avgDiskFrac) + ' in our model (published map there: ' + p(X.grid['10.0'].best.pgda) + '; the map does not state its observer height).' : '') + ' Nothing was tuned. Full tables: VALIDATION_REPORT.md.</p>';
    return h;
  }

  // ------------------------------------------------------------------ tabs
  function showPage(p) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.page === p); });
    document.querySelectorAll('.page').forEach(function (s) { s.classList.toggle('active', s.id === 'page-' + p); });
    if (p === 'explorer') { renderMap(); renderTimeline(); renderInstant(); }
    if (p === 'compare' && !CMP.length) {
      addScenario(S.site.id || '__custom', S.start, S.site.lat, S.site.lon);
      addScenario(S.site.id || '__custom', new Date(S.start.getTime() + 7 * DAY), S.site.lat, S.site.lon);
    }
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

  // ------------------------------------------------------------------ init
  function init() {
    if (!E || !window.Astronomy) { document.body.innerHTML = '<p style="padding:20px">Failed to load the ephemeris library (lib/astronomy.browser.min.js).</p>'; return; }
    var now = new Date(); now.setUTCSeconds(0, 0);
    S.start = now;
    $('startInput').value = toInput(now);
    if (MAP) { mapImg = new Image(); mapImg.onload = renderMap; mapImg.src = MAP.image; }
    var U = window.LUNA_UNPLOTTED_REGIONS;
    if (U) $('unplotted').innerHTML = '<b>Artemis III regions without sourced coordinates</b> (not plotted): ' + U.names.map(esc).join(', ') + '. <a href="' + esc(U.source) + '" target="_blank" rel="noopener">NASA list</a>.';

    $('siteSearch').addEventListener('input', renderSiteList);
    $('siteList').addEventListener('click', function (ev) { var it = ev.target.closest('.siteitem'); if (it) selectSite(siteById(it.dataset.id)); });
    $('siteList').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { var it = ev.target.closest('.siteitem'); if (it) selectSite(siteById(it.dataset.id)); } });
    $('map').addEventListener('click', mapClick);
    $('map').addEventListener('mousemove', mapHover);
    $('customGo').addEventListener('click', useCustom);
    $('terrainToggle').addEventListener('change', function () { S.useTerrain = this.checked; renderBadge(); recompute(); });
    $('fullSky').addEventListener('change', function () { S.fullSky = this.checked; renderInstant(); });
    $('startInput').addEventListener('change', function () { var d = fromInput(this.value); if (d) { S.start = d; S.idx = 0; recompute(); } });
    $('nowBtn').addEventListener('click', function () { var d = new Date(); d.setUTCSeconds(0, 0); S.start = d; S.idx = 0; $('startInput').value = toInput(d); recompute(); });
    $('windowSel').addEventListener('change', function () { S.windowDays = +this.value; S.idx = 0; recompute(); });
    $('timeSlider').addEventListener('input', function () { setIdx(+this.value); });
    $('playBtn').addEventListener('click', function () { setPlaying(!S.playing); });
    $('speedSel').addEventListener('change', function () { S.speed = +this.value; });
    $('timeline').addEventListener('click', timelineClick);
    $('explainToggle').addEventListener('change', function () {
      document.body.classList.toggle('explain-on', this.checked);
      try { localStorage.setItem('lw.explain', this.checked ? '1' : '0'); } catch (e) { /* ignore */ }
    });
    document.querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { showPage(t.dataset.page); }); });
    $('cmpAdd').addEventListener('click', function () { addScenario(S.site.id || '__custom', S.start, S.site.lat, S.site.lon); });
    $('cmpSlip').addEventListener('click', function () {
      var f = CMP[0]; if (!f) return;
      addScenario(f.siteId, new Date(f.start.getTime() + (+$('cmpSlipDays').value) * DAY), f.lat, f.lon);
    });
    $('cmpScenarios').addEventListener('change', scenarioChange);
    $('cmpScenarios').addEventListener('click', function (ev) { var d = ev.target.dataset.del; if (d !== undefined) { CMP.splice(+d, 1); renderScenarios(); } });
    $('cmpRun').addEventListener('click', runCompare);
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { renderMap(); renderTimeline(); renderInstant(); renderSlip(); renderPowerChart(); }, 150); });
    $('slipRun').addEventListener('click', function () { runSlip(); });
    $('slipMetric').addEventListener('change', renderSlip);
    $('slipHeat').addEventListener('mousemove', slipHover);
    $('slipHeat').addEventListener('mouseleave', function () { $('slipTip').hidden = true; });
    $('slipHeat').addEventListener('click', slipClick);
    $('pwRun').addEventListener('click', runPower);
    $('pwMode').addEventListener('change', function () { $('pwFaceWrap').style.display = this.value === 'fixed' ? '' : 'none'; });
    $('pwFaceWrap').style.display = 'none';
    $('shareBtn').addEventListener('click', copyLink);
    $('tourBtn').addEventListener('click', function () { tourShow(0); });
    $('tourNext').addEventListener('click', function () { if (TOUR.i < TOUR_STEPS.length - 1) tourShow(TOUR.i + 1); else tourClose(); });
    $('tourPrev').addEventListener('click', function () { if (TOUR.i > 0) tourShow(TOUR.i - 1); });
    $('tourClose').addEventListener('click', tourClose);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !$('tour').hidden) tourClose(); });

    try { if (localStorage.getItem('lw.explain') === '1') { $('explainToggle').checked = true; document.body.classList.add('explain-on'); } } catch (e) { /* ignore */ }
    renderValidation();
    var h = readHash();
    if (h) applyHash(h); else selectSite(siteById('peak_shackleton') || SITES[0]);   // default view
    hashReady = true;
    writeHash();
    window.addEventListener('hashchange', function () { var o = readHash(); if (o) { hashReady = false; applyHash(o); hashReady = true; } });
  }

  // Public hooks (used by the headless UI check and the tour).
  // ================================================================ LAUNCH SLIP
  var SLIP_METRICS = {
    pctBoth: { label: '% both (power + DTE)', better: 'max', fmt: function (v) { return v.toFixed(1) + '%'; } },
    pctSun: { label: '% sunlit', better: 'max', fmt: function (v) { return v.toFixed(1) + '%'; } },
    avgSunFrac: { label: 'Average illumination (disk fraction)', better: 'max', fmt: function (v) { return (100 * v).toFixed(1) + '%'; } },
    pctEarth: { label: '% Earth visible', better: 'max', fmt: function (v) { return v.toFixed(1) + '%'; } },
    longestDarkH: { label: 'Longest darkness', better: 'min', fmt: function (v) { return fmtHours(v); } },
    longestBlackoutH: { label: 'Longest Earth blackout', better: 'min', fmt: function (v) { return fmtHours(v); } },
    hoursToFirstSunset: { label: 'Hours until first sunset', better: 'max', fmt: null }
  };
  var SLIP_KEYS = ['pctBoth', 'pctSun', 'avgSunFrac', 'pctEarth', 'longestDarkH', 'longestBlackoutH', 'hoursToFirstSunset'];
  var SLIP = { res: null, layout: null };
  // hoursToFirstSunset: null means "no sunset during the mission" -> treated as the full mission length.
  function slipVal(row, key, durDays) { var v = row[key]; return (key === 'hoursToFirstSunset' && v === null) ? durDays * 24 : v; }
  function slipFmt(row, key, durDays) {
    if (key === 'hoursToFirstSunset') {
      var v = row[key];
      return v === null ? 'no sunset in mission' : v === 0 ? 'Sun down at landing' : fmtHours(v);
    }
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
    var res = { nominal: nominal, dur: dur, from: from, to: to, step: step, sites: [] };
    $('slipRun').disabled = true;
    var k = 0;
    (function nextSite() {
      if (k >= sites.length) {
        $('slipRun').disabled = false;
        $('slipProgress').textContent = 'Done: ' + sites.length + ' site(s) x ' + res.sites[0].scan.rows.length + ' landing dates, ' + res.sites[0].scan.stepMin + '-minute sampling.';
        SLIP.res = res; renderSlip(); if (done) done(); return;
      }
      $('slipProgress').textContent = 'Computing ' + (k + 1) + ' / ' + sites.length + ': ' + sites[k].name + ' ...';
      setTimeout(function () {
        var it = sites[k];
        it.scan = E.slipScan({ lat: it.site.lat, lon: it.site.lon }, nominal, dur, from, to, step, it.mask);
        res.sites.push(it); k++; nextSite();
      }, 15);
    })();
  }
  function heatColor(f) { // f in 0..1, dark blue -> teal -> yellow
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
    var rows = bySite ? R.sites.map(function (s) { return { label: s.name, site: s, key: key }; })
      : SLIP_KEYS.map(function (k) { return { label: SLIP_METRICS[k].label, site: R.sites[0], key: k }; });
    var nS = R.sites[0].scan.rows.length;
    var w = c.clientWidth, labW = Math.min(210, Math.max(90, w * 0.24)), rowH = 26, top = 6, bottom = 24;
    var f = fitCanvas(c, top + rows.length * rowH + bottom), ctx = f.ctx;
    var pw = w - labW - 8, cw = pw / nS;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, f.h);
    // global range for site mode (comparable colours), per-row range for metric mode
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
      ctx.fillStyle = C.text; ctx.font = '11px system-ui'; ctx.textAlign = 'right';
      var lbl = r.label;
      while (lbl.length > 4 && ctx.measureText(lbl).width > labW - 10) lbl = lbl.slice(0, -2) + '…';
      ctx.fillText(lbl, labW - 6, y + rowH / 2 + 4);
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
    // nominal column (slip 0)
    var i0 = R.sites[0].scan.rows.findIndex(function (x) { return x.slip === 0; });
    if (i0 >= 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(labW + i0 * cw, top, Math.max(2, cw), rows.length * rowH); }
    // x labels
    ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.font = '11px system-ui';
    var every = Math.max(1, Math.ceil(nS / Math.max(2, Math.floor(pw / 45))));
    R.sites[0].scan.rows.forEach(function (x, i) { if (i % every === 0) ctx.fillText('+' + x.slip + 'd', labW + (i + 0.5) * cw, f.h - 8); });
    $('slipLegend').innerHTML = (bySite ? 'Rows: sites, coloured by <b>' + esc(M.label) + '</b> on a common scale.' : 'Rows: metrics for <b>' + esc(R.sites[0].name) + '</b>, each row on its own scale.') +
      ' Brighter = better. White outline = nominal landing (slip 0); green outline = best in range. Mission ' + R.dur + ' days; sampling ' + R.sites[0].scan.stepMin + ' min. Hover for values, click to open in the Explorer.';
    var note = $('slipHorizonNote'), anyTerrain = R.sites.some(function (s) { return s.mask; }), allTerrain = R.sites.every(function (s) { return s.mask; });
    note.className = 'badge ' + (allTerrain ? 'terrain' : 'smooth');
    note.textContent = allTerrain ? 'Terrain horizons (LOLA)' : anyTerrain ? 'Mixed: some sites smooth Moon - terrain not included' : 'Smooth Moon horizon - terrain not included';
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
    var pad2 = (hi - lo) * 0.08; lo = Math.max(0, lo - pad2); hi += pad2;   // all metrics are >= 0
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
    // summary text
    var r0 = i0 >= 0 ? rows[i0] : null, rb = rows[bi], r14 = rows.filter(function (x) { return x.slip === 14; })[0];
    var s = '';
    if (r0) s += 'Nominal landing ' + fmtUTC(r0.landing) + ' UTC: <b>' + slipFmt(r0, key, R.dur) + '</b>. ';
    s += 'Best in range: <b>+' + rb.slip + ' days</b> (' + fmtUTC(rb.landing) + ' UTC) with <b>' + slipFmt(rb, key, R.dur) + '</b>.';
    if (r14 && r0) s += ' A 14-day slip gives <b>' + slipFmt(r14, key, R.dur) + '</b>.';
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
    var R = SLIP.res, row = hit.row.site.scan.rows[hit.i];
    var html = '<b>' + esc(hit.row.site.name) + '</b><br>Slip +' + row.slip + ' d · landing ' + fmtUTC(row.landing) + ' UTC<br>';
    html += SLIP_KEYS.map(function (k) { return (k === hit.row.key ? '<b>' : '') + SLIP_METRICS[k].label + ': ' + slipFmt(row, k, R.dur) + (k === hit.row.key ? '</b>' : ''); }).join('<br>');
    tip.innerHTML = html; tip.hidden = false;
    var wrapW = $('slipHeat').clientWidth;
    tip.style.left = Math.min(hit.x + 14, wrapW - tip.offsetWidth - 4) + 'px';
    tip.style.top = (hit.y + 14) + 'px';
  }
  function slipClick(ev) {
    var hit = slipCellAt(ev); if (!hit) return;
    var R = SLIP.res, row = hit.row.site.scan.rows[hit.i], site = hit.row.site.site;
    openInExplorer(site, row.landing, R.dur, !!hit.row.site.mask);
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
    selectSite(site);
    if (!useTerrain && S.useTerrain) { S.useTerrain = false; $('terrainToggle').checked = false; renderBadge(); recompute(); }
  }

  // ===================================================================== POWER
  var PW = { res: null };
  function powerWindow() {
    var mode = $('pwWindow').value;
    var site = siteObj(), mask = maskFor(S.site, S.useTerrain);
    if (mode === 'slip') {
      var nominal = fromInput($('slipNominal').value) || S.start, dur = Math.max(1, Math.round(+$('slipDuration').value) || 14);
      var end = new Date(nominal.getTime() + dur * DAY);
      return { label: S.site.name + ', launch-slip mission: landing ' + fmtUTC(nominal) + ' UTC + ' + dur + ' days', start: nominal, days: dur,
        series: E.series(site, nominal, end, E.defaultStepMin(nominal, end), mask), mask: mask };
    }
    return { label: S.site.name + ', Explorer window: ' + fmtUTC(S.start) + ' UTC + ' + S.windowDays + ' days', start: S.start, days: S.windowDays, series: S.series, mask: mask };
  }
  function runPower() {
    var opts = { area: +$('pwArea').value, eff: (+$('pwEff').value) / 100, mode: $('pwMode').value, faceAz: +$('pwFace').value };
    var load = +$('pwLoad').value, usable = (+$('pwDod').value) / 100;
    if (!(opts.area > 0) || !(opts.eff > 0 && opts.eff <= 1) || !(load >= 0) || !(usable > 0 && usable <= 1)) { $('pwVerdict').textContent = 'Check inputs.'; return; }
    var win = powerWindow(), s = win.series, n = s.t.length, stepH = s.stepMin / 60;
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
      ['Battery for longest darkness', kWh(battery) + ' (' + Math.round(usable * 100) + '% usable)']
    ];
    $('pwCards').innerHTML = cards.map(function (x) { return '<div class="card"><div class="cardlbl">' + x[0] + '</div><div class="val mono">' + x[1] + '</div></div>'; }).join('');
    var v = $('pwVerdict');
    v.className = 'verdict ' + (Wh >= loadWh ? 'pos' : 'neg');
    v.textContent = (Wh >= loadWh ? 'Energy positive' : 'Energy negative') + ' over the window: generates ' + kWh(Wh) + ' vs ' + kWh(loadWh) + ' needed.' +
      (zeroH > darkH + 1e-9 ? ' Note: with this orientation the panel produces nothing for up to ' + fmtHours(zeroH) + ' (Sun behind the panel), which would need ' + kWh(batteryZero) + '.' : '');
    $('pwWindowNote').textContent = 'Window: ' + win.label + '. ' + (win.mask ? 'LOLA terrain horizon.' : 'Smooth Moon horizon - terrain not included.') + ' Sampling ' + s.stepMin + ' min.';
    renderPowerChart();
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
    ctx.fillStyle = C.text; ctx.textAlign = 'center';
    var days = R.hours / 24, tick = days <= 8 ? 1 : days <= 31 ? 5 : days <= 92 ? 15 : 60, t0 = R.t[0], t1 = R.t[R.t.length - 1];
    var first = new Date(t0); first.setUTCHours(0, 0, 0, 0);
    for (var td = first.getTime(); td <= t1; td += tick * DAY) { if (td < t0) continue; var x = L + (td - t0) / (t1 - t0) * pw; var d = new Date(td); ctx.fillText(pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), x, h - 8); }
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
    if (S.site.id && hasTerrain(S.site) && !S.useTerrain) p.push('terrain=0');
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
    var site = o.site ? siteById(o.site) : null;
    if (!site && o.lat !== undefined && o.lon !== undefined && isFinite(+o.lat) && isFinite(+o.lon) && Math.abs(+o.lat) <= 90) {
      site = { id: null, name: 'Custom point', lat: +o.lat, lon: +o.lon };
      $('customLat').value = o.lat; $('customLon').value = o.lon;
    }
    selectSite(site || siteById('peak_shackleton') || SITES[0]);
    if (o.terrain === '0' && S.useTerrain) { S.useTerrain = false; $('terrainToggle').checked = false; renderBadge(); recompute(); }
    if (o.tab && $('page-' + o.tab)) showPage(o.tab);
  }
  function copyLink() {
    writeHash();
    var done = function () { $('shareBtn').textContent = 'Link copied'; setTimeout(function () { $('shareBtn').textContent = 'Copy link'; }, 1600); };
    try { navigator.clipboard.writeText(location.href).then(done, function () { window.prompt('Copy this link:', location.href); }); }
    catch (e) { window.prompt('Copy this link:', location.href); }
  }

  // ===================================================================== TOUR
  var TOUR = { i: 0, hl: null };
  function highlight(id) {
    if (TOUR.hl) TOUR.hl.classList.remove('tour-hl');
    TOUR.hl = id ? $(id) : null;
    if (TOUR.hl) { TOUR.hl.classList.add('tour-hl'); TOUR.hl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  function minMax(a) { var lo = Infinity, hi = -Infinity; for (var i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; } return [lo, hi]; }
  function fmtD(h) { return h >= 48 ? (h / 24).toFixed(1) + ' days' : h.toFixed(0) + ' hours'; }
  var TOUR_STEPS = [
    function (done) { // 1. Apollo 11
      openInExplorer(siteById('apollo11'), S.start, 30, false);
      var st = S.stats, e = minMax(S.series.earthEl);
      done('sky', 'Apollo 11, near the lunar equator on the near side. Over these 30 days Earth is above the horizon <b>' + st.pctEarth.toFixed(0) + '%</b> of the time, staying between ' + e[0].toFixed(1) + '° and ' + e[1].toFixed(1) + '° elevation: it barely moves in the sky. The Sun is up ' + st.pctSun.toFixed(0) + '% of the time; the longest night in this window lasts ' + fmtD(st.longestDarkH) + ', the normal lunar day-night cycle.');
    },
    function (done) { // 2. Peak near Shackleton
      openInExplorer(siteById('peak_shackleton'), S.start, 30, true);
      var st = S.stats, sEl = minMax(S.series.sunEl), m = minMax(HZ.peak_shackleton.elevations);
      var smooth = E.stats(E.series(siteObj(), S.start, new Date(S.start.getTime() + 30 * DAY), undefined, null));
      done('sky', 'Peak near Shackleton, 1.2° from the south pole. Over these 30 days the Sun circles the horizon with its centre between ' + fmtDeg(sEl[0], 1) + ' and ' + fmtDeg(sEl[1], 1) + '. The brown silhouette is the real LOLA terrain horizon (from ' + fmtDeg(m[0], 1) + ' to ' + fmtDeg(m[1], 1) + '): with terrain the Sun is up <b>' + st.pctSun.toFixed(0) + '%</b> of the window, against ' + smooth.pctSun.toFixed(0) + '% for a smooth Moon. A few degrees of hill decide everything here.');
    },
    function (done) { // 3. countdown
      showPage('explorer');
      done('sunCard', 'The countdown cards answer "how long until we lose the Sun or Earth?". At the selected time: <b>' + esc($('sunCountLbl').textContent) + '</b> in <b>' + esc($('sunCount').textContent) + '</b> (' + esc($('sunCountSub').textContent) + '), and <b>' + esc($('earthCountLbl').textContent) + '</b> in ' + esc($('earthCount').textContent) + '. Drag the slider or press play to watch these change.');
    },
    function (done) { // 4. launch slip
      showPage('slip');
      $('slipSites').value = 'current'; $('slipNominal').value = toInput(S.start); $('slipDuration').value = 14; $('slipFrom').value = 0; $('slipTo').value = 60; $('slipStep').value = 1; $('slipMetric').value = 'pctBoth';
      runSlip(function () {
        var rows = SLIP.res.sites[0].scan.rows, r0 = rows[0], r14 = rows.filter(function (x) { return x.slip === 14; })[0];
        var best = rows.reduce(function (a, b) { return b.pctBoth > a.pctBoth ? b : a; });
        done('slipHeat', 'Launch slips: each column is a landing date, each row a metric for a 14-day mission. Landing on the nominal date: Sun up <b>' + r0.pctSun.toFixed(0) + '%</b>, power and DTE together <b>' + r0.pctBoth.toFixed(0) + '%</b> of the mission, longest darkness ' + fmtD(r0.longestDarkH) + '. A <b>2-week slip</b> changes that to Sun up <b>' + r14.pctSun.toFixed(0) + '%</b>, both <b>' + r14.pctBoth.toFixed(0) + '%</b>, longest darkness ' + fmtD(r14.longestDarkH) + '. The best landing in the next 60 days is +' + best.slip + ' days with ' + best.pctBoth.toFixed(0) + '%. Click any square to open that date.');
      });
    },
    function (done) { // 5. power
      showPage('power');
      $('pwWindow').value = 'slip'; $('pwMode').value = 'track'; $('pwArea').value = 1; $('pwEff').value = 30; $('pwLoad').value = 100; $('pwDod').value = 80;
      runPower();
      var R = PW.res;
      done('pwCards', 'Power check for the nominal 14-day mission: a 1 m², 30%-efficient vertical Sun-tracking panel generates <b>' + (R.Wh / 1000).toFixed(1) + ' kWh</b> against <b>' + (R.loadWh / 1000).toFixed(1) + ' kWh</b> for a 100 W load, so the mission is <b>' + (R.Wh >= R.loadWh ? 'energy positive' : 'energy negative') + '</b>. Surviving the longest darkness (' + fmtD(R.darkH) + ') needs about <b>' + (R.battery / 1000).toFixed(1) + ' kWh</b> of battery at 80% usable capacity. First-order estimate only.');
    }
  ];
  function tourShow(i) {
    TOUR.i = i;
    $('tour').hidden = false;
    $('tourStep').textContent = 'Tour · step ' + (i + 1) + ' of ' + TOUR_STEPS.length;
    $('tourText').textContent = 'Working...';
    $('tourPrev').disabled = i === 0;
    $('tourNext').textContent = i === TOUR_STEPS.length - 1 ? 'Finish' : 'Next';
    setTimeout(function () { TOUR_STEPS[i](function (hlId, html) { if (TOUR.i !== i) return; $('tourText').innerHTML = html; highlight(hlId); }); }, 30);
  }
  function tourClose() { $('tour').hidden = true; highlight(null); }

  window.LunaApp = {
    state: S,
    runSlip: runSlip, slipResults: function () { return SLIP.res; },
    runPower: runPower, powerResults: function () { return PW.res; },
    tour: { start: function () { tourShow(0); }, step: function () { return TOUR.i; } }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
