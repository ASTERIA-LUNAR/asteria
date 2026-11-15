// Generated with Claude Code (Anthropic) under human direction.
/* ASTERIA south-pole map (Leaflet 1.9.4, local copy in lib/leaflet).
 * Custom CRS: south polar stereographic on the 1737.4 km sphere, identical to tools/terrain.py,
 * tools/tiles.py and the LOLA PDS products:
 *   r = 2R tan((90 + lat)/2),  x = r sin(lon),  y = r cos(lon)   (lon 0 up, 90E right)
 * Leaflet pixel at zoom z:  px = (x + H) * 256 * 2^z / (2H),  py = (H - y) * 256 * 2^z / (2H),
 * exactly the tile grid written by tools/tiles.py, so markers and tiles share one georeference. */
window.AsteriaMap = (function () {
  'use strict';
  var R = 1737400, DEG = Math.PI / 180;
  var TM = window.LUNA_TILES;
  var dataBounds = null, illumEdge = null;
  var map = null, layers = {}, markerLayer = null, pickMarker = null, opts = {}, sites = [], selId = null, readout = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function project(lat, lon) {
    var r = 2 * R * Math.tan((90 + lat) * DEG / 2);
    return { x: r * Math.sin(lon * DEG), y: r * Math.cos(lon * DEG) };
  }
  function unproject(x, y) {
    var r = Math.sqrt(x * x + y * y);
    return { lat: -90 + 2 * Math.atan(r / (2 * R)) / DEG, lon: Math.atan2(x, y) / DEG };
  }
  function makeCRS(H) {
    var P = {
      bounds: L.bounds([-H, -H], [H, H]),
      project: function (ll) { var p = project(ll.lat, ll.lng); return L.point(p.x, p.y); },
      unproject: function (pt) { var q = unproject(pt.x, pt.y); return L.latLng(q.lat, q.lon); }
    };
    var a = 256 / (2 * H);
    return L.extend({}, L.CRS.Simple, {
      code: 'ASTERIA:SPS', projection: P, transformation: new L.Transformation(a, 128, -a, 128),
      infinite: false, wrapLng: undefined, wrapLat: undefined
    });
  }
  // Tile layer limited to explicit per-zoom tile ranges (detail and PGDA layers cover only part of the square).
  var RangedTiles = null;   // created in init() so this file loads even without Leaflet (Node tests)
  function makeRangedTiles() {
    return L.TileLayer.extend({
      _isValidTile: function (c) {
        var r = this.options.ranges && this.options.ranges[c.z];
        if (!r) return false;
        return c.x >= r[0] && c.x <= r[1] && c.y >= r[2] && c.y <= r[3];
      }
    });
  }

  function markerKind(s) {
    if (s.artemisRegions) return 'feature';
    if (/^DERIVED/.test(s.coordKind || '')) return 'derived';
    if (s.status === 'reference') return 'reference';
    return 'point';
  }
  function iconHtml(kind, sel, count) {
    return '<span class="mk mk-' + kind + (sel ? ' sel' : '') + '">' + (count > 1 ? '<b>' + count + '</b>' : '') + '</span>';
  }

  // Round 6H: larger site markers. Visual 18-22 px; the clickable/tappable box (the Leaflet icon element) is
  // HIT px square: >= 40 px on phones / touch screens, >= 32 px with a mouse. Markers are in the marker pane, above
  // the 3D-coverage outlines (overlay pane, not interactive), and draw above the custom-point marker (zIndexOffset),
  // so a click inside a site's box selects the site and a click anywhere else places a custom point.
  function hitSize() {
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return (coarse || window.innerWidth <= 640) ? 44 : 34;
  }
  // Short map label: the name without a trailing "(...)" or " - ..." part (the Site Card shows the full name).
  function shortName(n) { return String(n).replace(/\s*\(.*\)\s*$/, '').replace(/\s+-\s+.*$/, ''); }
  var measureCtx = null;
  function textW(t, px) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = '600 ' + (px || 12.5) + 'px ' + (getComputedStyle(document.body).fontFamily || 'sans-serif');
    return measureCtx.measureText(t).width;
  }
  var labelInfo = [];   // for the UI test: placed labels (container px boxes) and the ones left out
  // Group markers that are closer than 22 px on screen into one marker with a count; clicking opens a list.
  function renderMarkers() {
    if (!map) return;
    markerLayer.clearLayers();
    labelInfo = [];
    var HIT = hitSize();
    var pts = sites.filter(function (s) { return inData(s.lat, s.lon); }).map(function (s) { return { s: s, p: map.latLngToLayerPoint([s.lat, s.lon]) }; });
    var groups = [];
    pts.forEach(function (it) {
      for (var g = 0; g < groups.length; g++) if (groups[g].p.distanceTo(it.p) < 22) { groups[g].items.push(it); return; }
      groups.push({ p: it.p, items: [it] });
    });
    // Label layout (container pixels): the selected marker first, then the others. A label goes right, left, above or
    // below its marker where it overlaps no other label, marker or map control and stays inside the map; otherwise it
    // is left out (the name still shows on hover / keyboard focus and in the site list).
    var size = map.getSize(), obst = [];
    groups.forEach(function (g) { var c = map.layerPointToContainerPoint(g.p); g.c = c; obst.push({ x0: c.x - 11, y0: c.y - 11, x1: c.x + 11, y1: c.y + 11 }); });
    var cr = map.getContainer().getBoundingClientRect();
    map.getContainer().querySelectorAll('.leaflet-control').forEach(function (el) {
      var r = el.getBoundingClientRect(); if (r.width && r.height) obst.push({ x0: r.left - cr.left - 4, y0: r.top - cr.top - 4, x1: r.right - cr.left + 4, y1: r.bottom - cr.top + 4 });
    });
    var placed = [];
    function hits(b, skip) {
      if (b.x0 < 2 || b.y0 < 2 || b.x1 > size.x - 2 || b.y1 > size.y - 2) return true;
      for (var k = 0; k < obst.length; k++) { if (k === skip) continue; var o = obst[k]; if (b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) return true; }
      for (var j = 0; j < placed.length; j++) { var q = placed[j]; if (b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0) return true; }
      return false;
    }
    function cands(c, w, h, gap) {
      return [
        ['right', { x0: c.x + gap, y0: c.y - h / 2, x1: c.x + gap + w, y1: c.y + h / 2 }, [gap, 0]],
        ['left', { x0: c.x - gap - w, y0: c.y - h / 2, x1: c.x - gap, y1: c.y + h / 2 }, [-gap, 0]],
        ['top', { x0: c.x - w / 2, y0: c.y - gap - h, x1: c.x + w / 2, y1: c.y - gap }, [0, -gap]],
        ['bottom', { x0: c.x - w / 2, y0: c.y + gap, x1: c.x + w / 2, y1: c.y + gap + h }, [0, gap]]
      ];
    }
    var order = groups.map(function (g, i) { return i; });
    var isSelG = function (g) { return g.items.some(function (i) { return i.s.id === selId; }); };
    order.sort(function (a, b) { return (isSelG(groups[b]) ? 1 : 0) - (isSelG(groups[a]) ? 1 : 0); });
    order.forEach(function (gi) {
      var g = groups[gi], selItem = g.items.filter(function (i) { return i.s.id === selId; })[0];
      var extra = g.items.length > 1 ? ' +' + (g.items.length - 1) : '';
      var texts = selItem ? [selItem.s.name, shortName(selItem.s.name)] : [shortName(g.items[0].s.name)];
      g.label = null;
      for (var t = 0; t < texts.length && !g.label; t++) {
        var w = Math.ceil(textW(texts[t] + extra, selItem && t === 0 ? 14 : 12.5)) + 18, cs = cands(g.c, w, 24, 14);
        for (var k = 0; k < cs.length; k++) if (!hits(cs[k][1], gi)) { g.label = { dir: cs[k][0], off: cs[k][2], text: texts[t], extra: extra, box: cs[k][1] }; placed.push(cs[k][1]); break; }
      }
      labelInfo.push({ ids: g.items.map(function (i) { return i.s.id; }), text: g.label ? g.label.text + g.label.extra : null, box: g.label ? g.label.box : null, dir: g.label ? g.label.dir : null });
    });
    groups.forEach(function (g) {
      var first = g.items[0].s, isSel = isSelG(g), names = g.items.map(function (i) { return i.s.name; }).join(' / ');
      var kind = g.items.length > 1 ? 'group' : markerKind(first);
      var m = L.marker([first.lat, first.lon], {
        icon: L.divIcon({ className: 'mkwrap mkmain', html: iconHtml(kind, isSel, g.items.length), iconSize: [HIT, HIT], iconAnchor: [HIT / 2, HIT / 2] }),
        keyboard: true, title: names, alt: names, riseOnHover: true, zIndexOffset: isSel ? 2000 : 1000
      });
      if (g.items.length === 1) {
        m.on('click', function (e) { L.DomEvent.stopPropagation(e); opts.onSelectSite(first); });
      } else {
        var html = '<div class="grouppop"><div class="gp-h">' + g.items.length + ' sites close together</div>' +
          g.items.map(function (i) { return '<button class="gp-i" data-id="' + i.s.id + '">' + esc(i.s.name) + '</button>'; }).join('') + '</div>';
        m.bindPopup(html, { closeButton: true, autoPan: true });
        m.on('popupopen', function (e) {
          e.popup.getElement().querySelectorAll('.gp-i').forEach(function (b) {
            b.addEventListener('click', function () { map.closePopup(); opts.onSelectSite(opts.siteById(b.dataset.id)); });
          });
        });
      }
      if (g.label) m.bindTooltip(esc(g.label.text) + (g.label.extra ? ' <span class="mkmore">' + g.label.extra + '</span>' : ''), { permanent: true, direction: g.label.dir, offset: g.label.off, className: 'mklabel' + (isSel ? ' mksel' : ' mkshort'), interactive: false });
      m.addTo(markerLayer);
      // Keyboard: Leaflet 1.9 makes markers focusable (Tab) but Enter only opens bound popups; Enter or Space on a
      // single site's marker selects it, Space on a group opens its list (Enter already does, through Leaflet).
      var el = m.getElement();
      if (el) el.addEventListener('keydown', function (ev) {
        if (g.items.length === 1 && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); opts.onSelectSite(first); }
        else if (g.items.length > 1 && ev.key === ' ') { ev.preventDefault(); m.openPopup(); }
      });
    });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function init(el, o) {
    opts = o;
    if (!window.L || !TM) { el.innerHTML = '<p class="hint" style="padding:16px">Map unavailable (lib/leaflet or data/tiles_meta.js missing).</p>'; return null; }
    var H = TM.halfExtent_m, LY = TM.layers;
    RangedTiles = RangedTiles || makeRangedTiles();
    // Data coverage = the tile square (+-H in projected metres, ~80 S on the axes, ~76 S in the corners).
    // Leaflet's maxBounds only ever projects the NE and SW (or NW and SE) corners of the box it is given.
    // A LatLngBounds made from the square's top-left and bottom-right corners (same latitude, longitudes
    // -45 and 135) therefore projects exactly onto the square, so panning is limited to the data.
    var tl = unproject(-H, H), br = unproject(H, -H);
    dataBounds = L.latLngBounds([tl.lat, tl.lon], [br.lat, br.lon]);
    map = L.map(el, {
      crs: makeCRS(H), minZoom: 0, maxZoom: 9, zoomSnap: 0.5, zoomDelta: 0.5, wheelPxPerZoomLevel: 90,
      attributionControl: true, zoomAnimation: !reduce, fadeAnimation: !reduce, markerZoomAnimation: !reduce,
      inertia: !reduce, maxBounds: dataBounds, maxBoundsViscosity: 1.0
    });
    // Round 6H: Leaflet snaps every zoom to zoomSnap before clamping, so a pan at the fractional minimum zoom (or at the
    // fractional cover zoom) rounded it up (e.g. 0.41 -> 0.5 on a phone, and the full extent was lost). A zoom equal to
    // the minimum or to the current zoom is kept as it is; everything else snaps as before.
    map._limitZoom = function (z) {
      if (Math.abs(z - this.getMinZoom()) < 1e-6 || (this._zoom !== undefined && Math.abs(z - this._zoom) < 1e-6)) return Math.max(this.getMinZoom(), Math.min(this.getMaxZoom(), z));
      return L.Map.prototype._limitZoom.call(this, z);
    };
    wheelGate(el);
    var ZMAX = 9;
    layers.hill = L.tileLayer(LY.hill.path, { tileSize: 256, minZoom: 0, maxZoom: ZMAX, maxNativeZoom: LY.hill.full[1], noWrap: true,
      attribution: 'LOLA DEMs: NASA LRO/LOLA, PDS Geosciences Node' }).addTo(map);
    Object.keys(LY.hill.ranges).forEach(function (z) {
      layers['hill' + z] = new RangedTiles(LY.hill.path, { tileSize: 256, minZoom: +z, maxZoom: ZMAX, minNativeZoom: +z, maxNativeZoom: +z, ranges: (function () { var o = {}; o[z] = LY.hill.ranges[z]; return o; })() }).addTo(map);
    });
    layers.slope = L.tileLayer(LY.slope.path, { tileSize: 256, minZoom: 0, maxZoom: ZMAX, maxNativeZoom: LY.slope.maxNativeZoom, opacity: 0.62, noWrap: true });
    layers.illum = new RangedTiles(LY.illum.path, { tileSize: 256, minZoom: 0, maxZoom: ZMAX, maxNativeZoom: LY.illum.maxNativeZoom, opacity: 0.85, ranges: LY.illum.ranges, zIndex: 4,
      attribution: 'Illumination: NASA PGDA product 69 (Mazarico et al. 2011)' });
    // Outer published layer (120 m/px, 75-90 S) under the 60 m layer, for the part the 60 m map does not cover.
    if (LY.illum120) layers.illum120 = L.tileLayer(LY.illum120.path, { tileSize: 256, minZoom: 0, maxZoom: ZMAX, maxNativeZoom: LY.illum120.maxNativeZoom, opacity: 0.85, noWrap: true, zIndex: 3 });
    // Outline of the 60 m map's coverage (its square grid, about 85 S on the axes).
    var h60 = LY.illum.halfExtent_m || 151740;
    illumEdge = L.polygon([[-h60, h60], [h60, h60], [h60, -h60], [-h60, -h60]].map(function (c) { var q = unproject(c[0], c[1]); return [q.lat, q.lon]; }),
      { color: '#ffe08a', weight: 1.5, dashArray: '3 4', fill: false, interactive: false });
    // Mark the edge of data coverage: hatch everything outside the square, outline the square.
    var big = 3 * H, ring = function (h) { return [[-h, h], [h, h], [h, -h], [-h, -h]].map(function (c) { var q = unproject(c[0], c[1]); return [q.lat, q.lon]; }); };
    L.polygon([ring(big), ring(H)], { stroke: false, fillColor: '#000', fillOpacity: 0.55, interactive: false, className: 'nodata' }).addTo(map);
    L.polygon(ring(H), { color: '#ff9f43', weight: 1.5, dashArray: '6 5', fill: false, interactive: false }).bindTooltip('Edge of the map data', { sticky: true }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    // tile loading -> loader (only shown if still loading after 250 ms)
    Object.keys(layers).forEach(function (k) {
      layers[k].on('loading', function () { if (!layers[k]._asLoading) { layers[k]._asLoading = true; window.AsteriaLoader && AsteriaLoader.begin('Loading map tiles…'); } });
      var done = function () { if (layers[k]._asLoading) { layers[k]._asLoading = false; window.AsteriaLoader && AsteriaLoader.end(); } };
      layers[k].on('load', done);
      layers[k].on('remove', done);   // a layer removed while loading never fires 'load'
    });
    map.on('click', function (e) {
      if (!inData(e.latlng.lat, e.latlng.lng)) { if (opts.onOutside) opts.onOutside(); return; }
      opts.onPickPoint(e.latlng.lat, e.latlng.lng);
    });
    map.on('zoomend', renderMarkers);
    map.on('moveend', function () { if (!map._animatingZoom && !(map._popup && map.hasLayer(map._popup))) renderMarkers(); });   // round 6H: labels are laid out for the visible area
    map.on('mousemove', function (e) { if (readout) readout.textContent = inData(e.latlng.lat, e.latlng.lng) ? fmtLL(e.latlng.lat, e.latlng.lng) : 'No elevation data here'; });
    map.on('mouseout', function () { if (readout) readout.textContent = 'Click the map to pick a point'; });
    // readout box
    var Rd = L.Control.extend({ options: { position: 'bottomleft' }, onAdd: function () { var d = L.DomUtil.create('div', 'mapreadout'); d.textContent = 'Click the map to pick a point'; readout = d; return d; } });
    map.addControl(new Rd());
    // Round 6: dynamic scale bar. Ground metres per screen pixel at the map centre = (projected metres per pixel) / k,
    // k = 2 / (1 + sin|lat|) = the south polar stereographic scale factor on the 1737.4 km sphere (1 at the pole,
    // 1.0076 at 80 S): the scale varies slightly across the map, so the bar is labelled "scale at map centre".
    var Sc = L.Control.extend({ options: { position: 'bottomright' }, onAdd: function () {
      var d = L.DomUtil.create('div', 'mapscale'); d.innerHTML = '<div class="bar"></div><div class="txt"></div>'; scaleEl = d; return d; } });
    map.addControl(new Sc());
    map.on('zoom move zoomend moveend resize', updateScale);
    // Round 6H: "Show all" (home) button under the zoom buttons: fits the whole map data extent.
    var Home = L.Control.extend({ options: { position: 'topleft' }, onAdd: function () {
      var d = L.DomUtil.create('div', 'leaflet-bar mapshowall'), a = L.DomUtil.create('a', '', d);
      a.href = '#'; a.id = 'mapShowAll'; a.setAttribute('role', 'button'); a.title = 'Show all: the whole map data extent'; a.setAttribute('aria-label', 'Show all: the whole map data extent');
      a.innerHTML = '<span aria-hidden="true">&#8962;</span>';
      L.DomEvent.disableClickPropagation(d);
      L.DomEvent.on(a, 'click', function (e) { L.DomEvent.preventDefault(e); showAll(true); });
      return d; } });
    map.addControl(new Home());
    updateScale();
    fitMinZoom();
    map.on('resize', fitMinZoom);
    // The panel can change size without a window resize (layout, fonts): keep Leaflet's size in step.
    if (window.ResizeObserver) new ResizeObserver(function () {
      // round 6H: a resize right after "Show on 2D map" (the layout settling when the 3D view closes) keeps that point
      // exactly centred (reset: Leaflet's pan path truncates the offset to whole pixels)
      if (pinned && Date.now() - pinned.t < 1500) { map.invalidateSize({ pan: false }); map.setView(pinned.ll, map.getZoom(), { reset: true }); }
      else map.invalidateSize();
    }).observe(el);
    home(false);
    return map;
  }
  // Zoom at which the data square exactly covers the map box: its side equals the longer side of the box,
  // so no area outside the data shows (on a non-square box a strip of the square along the longer axis is
  // off-screen and reachable by panning). Used for the first view and "Whole pole".
  // Fractional: Leaflet clamps to minZoom after snapping, so this exact value is kept.
  function coverZoom() {
    var size = map.getSize(), s = Math.max(size.x, size.y) || 400;
    return Math.max(0, Math.log((s + 1) / 256) / Math.LN2);
  }
  // Round 6H: zoom at which the WHOLE data square fits inside the map box (its side equals the shorter side of the
  // box). This is the smallest zoom, so zooming out always reaches the full map extent. On a non-square box the strip
  // beside the square is the hatched "no data" area; panning stays limited to the data (maxBounds, viscosity 1), so at
  // this zoom the square is held centred, and the area outside it is never reachable by panning at any larger zoom.
  function containZoom() {
    var size = map.getSize(), s = Math.min(size.x, size.y) || 400;
    return Math.max(0, Math.log((s - 1) / 256) / Math.LN2);
  }
  function fitMinZoom() { map.setMinZoom(containZoom()); }
  // Is (lat, lon) inside the map data (the tile square)?
  function inData(lat, lon) { var p = project(lat, lon), H = TM ? TM.halfExtent_m : 0; return lat < 0 && Math.abs(p.x) <= H && Math.abs(p.y) <= H; }
  function fmtLL(lat, lon) { return lat.toFixed(4) + '°, ' + (((lon + 540) % 360) - 180).toFixed(4) + '°E'; }
  // "Whole pole": centre on the pole at the zoom where the data square fills the map box.
  function setZ(z, animate) {
    // Leaflet rounds to zoomSnap before clamping to minZoom, which could round past the wanted zoom.
    var snap = map.options.zoomSnap; map.options.zoomSnap = 0;
    map.setView([-90, 0], z, { animate: !!animate && !reduce });
    map.options.zoomSnap = snap;
  }
  function home(animate) {
    if (!map) return;
    fitMinZoom();
    setZ(coverZoom(), animate);
  }
  // Round 6H "Show all": the whole map data extent (the minimum zoom).
  function showAll(animate) {
    if (!map) return;
    fitMinZoom();
    setZ(containZoom(), animate);
  }
  // How much of the map box shows area outside the data (px), for the UI test.
  function margins() {
    if (!map) return null;
    var H = TM.halfExtent_m, crs = map.options.crs, s = map.getSize();
    var a = map.latLngToContainerPoint(crs.unproject(L.point(-H, H))), b = map.latLngToContainerPoint(crs.unproject(L.point(H, -H)));
    return { left: a.x, top: a.y, right: s.x - b.x, bottom: s.y - b.y, w: s.x, h: s.y, zoom: map.getZoom() };
  }
  function setSites(list) { sites = list; renderMarkers(); }
  function select(site, fly) {
    selId = site && site.id;
    if (!map) return;
    if (pickMarker) { map.removeLayer(pickMarker); pickMarker = null; }
    if (site && !site.id && inData(site.lat, site.lon)) {
      pickMarker = L.marker([site.lat, site.lon], { icon: L.divIcon({ className: 'mkwrap mkpickwrap', html: '<span class="mk mk-pick"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, keyboard: false, zIndexOffset: -1000 }).addTo(map);   // round 6H: small amber crosshair, drawn under the site markers
    }
    renderMarkers();
    if (fly && site && inData(site.lat, site.lon)) {
      var z = Math.max(map.getZoom(), 5);
      if (reduce) map.setView([site.lat, site.lon], z, { animate: false });
      else map.flyTo([site.lat, site.lon], z, { duration: 1.1 });
    }
  }
  function setOverlay(name) {
    if (!map) return;
    var want = name === 'illum' ? ['illum120', 'illum'] : [name];
    ['slope', 'illum', 'illum120'].forEach(function (k) { if (layers[k] && map.hasLayer(layers[k]) && want.indexOf(k) < 0) map.removeLayer(layers[k]); });
    want.forEach(function (k) { if (layers[k] && !map.hasLayer(layers[k])) layers[k].addTo(map); });
    if (illumEdge) { if (name === 'illum') illumEdge.addTo(map); else map.removeLayer(illumEdge); }
  }
  function setMarkersVisible(v) { if (!map) return; if (v) markerLayer.addTo(map); else map.removeLayer(markerLayer); }
  function invalidate() { if (map) { map.invalidateSize(); fitMinZoom(); renderMarkers(); } }
  var scaleEl = null, scaleState = null;
  function niceLen(m) { var p = Math.pow(10, Math.floor(Math.log10(m))), f = m / p; return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p; }
  function scaleInfo() {
    if (!map || !map._loaded) return null;   // before the first setView
    var c = map.getCenter(), lat = Math.max(-90, Math.min(-1e-9, c.lat)), z = map.getZoom(), H = TM.halfExtent_m;
    var projPerPx = 2 * H / (256 * Math.pow(2, z)), k = 2 / (1 + Math.sin(Math.abs(lat) * DEG)), mPerPx = projPerPx / k;
    var len = niceLen(mPerPx * 110), px = len / mPerPx;
    return { lat: c.lat, lon: c.lng, zoom: z, k: k, projPerPx: projPerPx, mPerPx: mPerPx, len_m: len, px: px, text: (len >= 1000 ? (len / 1000) + ' km' : len + ' m') + ' (scale at map centre)' };
  }
  function updateScale() {
    if (!scaleEl) return;
    var q = scaleInfo(); if (!q) return;
    scaleState = q;
    scaleEl.querySelector('.bar').style.width = q.px.toFixed(1) + 'px';
    scaleEl.querySelector('.txt').textContent = q.text;
    scaleEl.title = 'Distance on the ground for the bar length, from the polar stereographic scale factor at the map centre (k = ' + q.k.toFixed(4) + '); the scale changes slightly across the map.';
  }
  // Round 6: "Show on 2D map" from the 3D view - centre the map on that ground point with a marker (kept until the next one).
  var point3d = null, pinned = null;
  function showPoint(lat, lon) {
    if (!map || !inData(lat, lon)) return null;
    if (point3d) map.removeLayer(point3d);
    point3d = L.marker([lat, lon], { icon: L.divIcon({ className: 'mkwrap', html: '<span class="mk mk-3d"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false })
      .bindTooltip('Position from the 3D view: ' + fmtLL(lat, lon), { permanent: true, direction: 'top', offset: [0, -10], className: 'tip3d' }).addTo(map);
    map.setView([lat, lon], Math.max(map.getZoom(), 7), { animate: false });
    pinned = { ll: [lat, lon], t: Date.now() };
    return { lat: lat, lon: lon, zoom: map.getZoom(), centre: map.getCenter() };
  }
  // Prompt 7C: the map fills most of the Explore first screen, so a plain mouse wheel / touchpad swipe over it scrolls
  // the PAGE. The map zooms with Ctrl (or Cmd) + wheel (this is also what a touchpad pinch sends), or with a plain wheel
  // after a click/tap into the map, until the next click outside it. A plain wheel over an inactive map shows a short
  // hint. Unchanged: the +/- and "Show all" buttons, double-click zoom, touch pinch-zoom, dragging. The arrow keys pan
  // the map only while the map itself has keyboard focus (Leaflet's keyboard handler: a click into the map focuses it,
  // a click outside removes the focus); otherwise they scroll the page.
  var wheel = { active: false, hintEl: null, timer: 0, shown: 0 };
  var WHEEL_HINT = /Mac|iPhone|iPad/.test(navigator.platform || '') ? 'Use Cmd + scroll to zoom the map' : 'Use Ctrl + scroll to zoom the map';
  function wheelGate(el) {
    // capture phase on the container: runs before Leaflet's own wheel listener (same element, bubble phase), so the
    // wheel event never reaches Leaflet and is not cancelled: the browser scrolls the page as over any other element
    el.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey || wheel.active) return;          // Leaflet zooms (and stops the browser's page zoom)
      e.stopImmediatePropagation();
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) wheelHint();
    }, { capture: true, passive: true });
    el.addEventListener('pointerdown', function () { wheel.active = true; wheelHint(false); }, true);
    document.addEventListener('pointerdown', function (e) { if (!el.contains(e.target)) wheel.active = false; }, true);
    window.addEventListener('blur', function () { wheel.active = false; });
  }
  function wheelHint(on) {
    if (!map) return;
    if (!wheel.hintEl) {
      var d = wheel.hintEl = L.DomUtil.create('div', 'mapwheelhint', map.getContainer());
      d.setAttribute('role', 'status'); d.textContent = WHEEL_HINT;
    }
    clearTimeout(wheel.timer);
    if (on === false) { wheel.hintEl.classList.remove('on'); return; }
    wheel.hintEl.classList.add('on'); wheel.shown++;
    wheel.timer = setTimeout(function () { wheel.hintEl.classList.remove('on'); }, 1500);
  }
  // round 6F: outlines of the areas with 3D terrain (subtle; not interactive). list: [{ ll: [[lat, lon], ...], tile }]
  var covLayer = null;
  function setCoverage(list) {
    if (!map) return;
    if (covLayer) map.removeLayer(covLayer);
    covLayer = L.layerGroup(list.map(function (q) {
      return L.polygon(q.ll, { color: '#7fd3ff', weight: 1, opacity: q.tile ? 0.8 : 0.45, dashArray: q.tile ? null : '3 4', fill: false, interactive: false, className: 'cov3d' + (q.tile ? ' cov3d-tile' : '') });
    })).addTo(map);
  }
  return {
    init: init, setSites: setSites, setCoverage: setCoverage, coverageCount: function () { return covLayer ? covLayer.getLayers().length : 0; }, select: select, setOverlay: setOverlay, setMarkersVisible: setMarkersVisible,
    invalidate: invalidate, home: home, showAll: showAll, zooms: function () { return map ? { cover: coverZoom(), contain: containZoom(), min: map.getMinZoom(), zoom: map.getZoom() } : null; }, showPoint: showPoint, scaleInfo: scaleInfo, scaleState: function () { return scaleState; }, margins: margins, labels: function () { return labelInfo; }, hitSize: hitSize, project: project, unproject: unproject, inData: inData,
    leaflet: function () { return map; },
    wheelState: function () { return { active: wheel.active, hint: !!(wheel.hintEl && wheel.hintEl.classList.contains('on')), shown: wheel.shown, text: WHEEL_HINT }; }   // Prompt 7C (tests)
  };
})();
