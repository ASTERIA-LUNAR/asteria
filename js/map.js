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

  // Group markers that are closer than 16 px on screen into one marker with a count; clicking opens a list.
  function renderMarkers() {
    if (!map) return;
    markerLayer.clearLayers();
    var pts = sites.filter(function (s) { return inData(s.lat, s.lon); }).map(function (s) { return { s: s, p: map.latLngToLayerPoint([s.lat, s.lon]) }; });
    var groups = [];
    pts.forEach(function (it) {
      for (var g = 0; g < groups.length; g++) if (groups[g].p.distanceTo(it.p) < 16) { groups[g].items.push(it); return; }
      groups.push({ p: it.p, items: [it] });
    });
    groups.forEach(function (g) {
      var first = g.items[0].s, isSel = g.items.some(function (i) { return i.s.id === selId; });
      var kind = g.items.length > 1 ? 'group' : markerKind(first);
      var m = L.marker([first.lat, first.lon], {
        icon: L.divIcon({ className: 'mkwrap', html: iconHtml(kind, isSel, g.items.length), iconSize: [18, 18], iconAnchor: [9, 9] }),
        keyboard: true, title: g.items.map(function (i) { return i.s.name; }).join(' / '), riseOnHover: true, zIndexOffset: isSel ? 1000 : 0
      });
      if (g.items.length === 1) {
        m.on('click', function (e) { L.DomEvent.stopPropagation(e); opts.onSelectSite(first); });
        if (isSel) m.bindTooltip(esc(first.name), { permanent: true, direction: 'right', offset: [10, 0], className: 'mklabel' });
      } else {
        var html = '<div class="grouppop"><div class="gp-h">' + g.items.length + ' sites close together</div>' +
          g.items.map(function (i) { return '<button class="gp-i" data-id="' + i.s.id + '">' + esc(i.s.name) + '</button>'; }).join('') + '</div>';
        m.bindPopup(html, { closeButton: true, autoPan: true });
        m.on('popupopen', function (e) {
          e.popup.getElement().querySelectorAll('.gp-i').forEach(function (b) {
            b.addEventListener('click', function () { map.closePopup(); opts.onSelectSite(opts.siteById(b.dataset.id)); });
          });
        });
        var selItem = g.items.filter(function (i) { return i.s.id === selId; })[0];
        if (selItem) m.bindTooltip(esc(selItem.s.name) + ' <span class="mkmore">+' + (g.items.length - 1) + '</span>', { permanent: true, direction: 'right', offset: [10, 0], className: 'mklabel' });
      }
      m.addTo(markerLayer);
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
    map.on('mousemove', function (e) { if (readout) readout.textContent = inData(e.latlng.lat, e.latlng.lng) ? fmtLL(e.latlng.lat, e.latlng.lng) : 'No elevation data here'; });
    map.on('mouseout', function () { if (readout) readout.textContent = 'Click the map to pick a point'; });
    // readout box
    var Rd = L.Control.extend({ options: { position: 'bottomleft' }, onAdd: function () { var d = L.DomUtil.create('div', 'mapreadout'); d.textContent = 'Click the map to pick a point'; readout = d; return d; } });
    map.addControl(new Rd());
    fitMinZoom();
    map.on('resize', fitMinZoom);
    // The panel can change size without a window resize (layout, fonts): keep Leaflet's size in step.
    if (window.ResizeObserver) new ResizeObserver(function () { map.invalidateSize(); }).observe(el);
    home(false);
    return map;
  }
  // Zoom at which the data square exactly covers the map box: its side equals the longer side of the box,
  // so no area outside the data shows (on a non-square box a strip of the square along the longer axis is
  // off-screen and reachable by panning). This is also the smallest zoom (no zooming out into emptiness).
  // Fractional: Leaflet clamps to minZoom after snapping, so this exact value is kept.
  function coverZoom() {
    var size = map.getSize(), s = Math.max(size.x, size.y) || 400;
    return Math.max(0, Math.log((s + 1) / 256) / Math.LN2);
  }
  function fitMinZoom() { map.setMinZoom(coverZoom()); }
  // Is (lat, lon) inside the map data (the tile square)?
  function inData(lat, lon) { var p = project(lat, lon), H = TM ? TM.halfExtent_m : 0; return lat < 0 && Math.abs(p.x) <= H && Math.abs(p.y) <= H; }
  function fmtLL(lat, lon) { return lat.toFixed(4) + '°, ' + (((lon + 540) % 360) - 180).toFixed(4) + '°E'; }
  // "Whole pole": centre on the pole at the zoom where the data square fills the map box.
  function home(animate) {
    if (!map) return;
    fitMinZoom();
    // Leaflet rounds to zoomSnap before clamping to minZoom, which could round up past the cover zoom.
    var snap = map.options.zoomSnap; map.options.zoomSnap = 0;
    map.setView([-90, 0], coverZoom(), { animate: !!animate && !reduce });
    map.options.zoomSnap = snap;
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
      pickMarker = L.marker([site.lat, site.lon], { icon: L.divIcon({ className: 'mkwrap', html: '<span class="mk mk-pick"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }), interactive: false }).addTo(map);
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
  // Round 6: "Show on 2D map" from the 3D view - centre the map on that ground point with a marker (kept until the next one).
  var point3d = null;
  function showPoint(lat, lon) {
    if (!map || !inData(lat, lon)) return null;
    if (point3d) map.removeLayer(point3d);
    point3d = L.marker([lat, lon], { icon: L.divIcon({ className: 'mkwrap', html: '<span class="mk mk-3d"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false, keyboard: false })
      .bindTooltip('Position from the 3D view: ' + fmtLL(lat, lon), { permanent: true, direction: 'top', offset: [0, -10], className: 'tip3d' }).addTo(map);
    map.setView([lat, lon], Math.max(map.getZoom(), 7), { animate: false });
    return { lat: lat, lon: lon, zoom: map.getZoom(), centre: map.getCenter() };
  }
  return {
    init: init, setSites: setSites, select: select, setOverlay: setOverlay, setMarkersVisible: setMarkersVisible,
    invalidate: invalidate, home: home, showPoint: showPoint, margins: margins, project: project, unproject: unproject, inData: inData,
    leaflet: function () { return map; }
  };
})();
