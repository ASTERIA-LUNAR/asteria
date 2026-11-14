// Generated with Claude Code (Anthropic) under human direction.
/* ASTERIA compute jobs.
 * ASTERIA_JOBS(E) holds every heavy computation. The SAME function source runs either inside a Blob
 * Web Worker (preferred: keeps the page responsive) or on the main thread (fallback if the browser
 * refuses the worker). Results are identical because both call the same validated engine (js/engine.js,
 * bundled verbatim in js/core.js).
 * Why a Blob worker: pages opened by double-click (file://) cannot start a worker from a file or
 * importScripts() a local file, but a worker built from inline source works. */
window.ASTERIA_JOBS = function (E) {
  'use strict';
  var DAY = 86400000;

  // Refine every up/down transition found in a series to 1 minute (findEvents bisection).
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

  // Earth test horizon = terrain (or smooth 0 deg) + minimum link elevation (deg).
  function earthMaskFor(mask, minEl) {
    if (!minEl) return mask;
    var m = new Array(360);
    for (var i = 0; i < 360; i++) m[i] = (mask ? mask[i] : 0) + minEl;
    return m;
  }

  var SEARCH_DAYS_AFTER = 400;

  // ---- Terrain horizon from the compact downsampled DEM (data/dem_coarse.js), for clicked points.
  // Same method as tools/terrain.py: 360 azimuths (1 deg, clockwise from local north), great-circle rays
  // with the same sample distances (10 m to 2 km, 20 m to 50 km, 40 m to 150 km, 80 m to 300 km), bilinear
  // heights, exact spherical geometry (lunar curvature), observer obsH metres above the interpolated surface,
  // rays stop at the edge of the grid. Points are built in Cartesian Moon-fixed coordinates, which gives the
  // same great circle as terrain.py's destination() and the same polar stereographic projection.
  var R_M = 1737400, DISTS = null, DEM = null;
  function distances() {
    if (DISTS) return DISTS;
    var a = [], s;
    for (s = 10; s < 2000; s += 10) a.push(s);
    for (s = 2000; s < 50000; s += 20) a.push(s);
    for (s = 50000; s < 150000; s += 40) a.push(s);
    for (s = 150000; s <= 300000; s += 80) a.push(s);
    return (DISTS = a);
  }
  function demSample(dem, x, y) {     // bilinear height (m) at projected x, y; NaN outside the grid
    var i = x / dem.px + dem.n / 2 - 0.5, j = -y / dem.px + dem.n / 2 - 0.5;
    if (!(i >= 0 && j >= 0 && i < dem.n - 1 && j < dem.n - 1)) return NaN;
    var i0 = Math.floor(i), j0 = Math.floor(j), fi = i - i0, fj = j - j0, n = dem.n, h = dem.h, k = j0 * n + i0;
    return h[k] * (1 - fi) * (1 - fj) + h[k + 1] * fi * (1 - fj) + h[k + n] * (1 - fi) * fj + h[k + n + 1] * fi * fj;
  }
  function demProject(lat, lon) {
    var D = Math.PI / 180, r = 2 * R_M * Math.tan((90 + lat) * D / 2);
    return { x: r * Math.sin(lon * D), y: r * Math.cos(lon * D) };
  }
  function demCovers(dem, lat, lon) { var p = demProject(lat, lon); return isFinite(demSample(dem, p.x, p.y)); }
  function terrainHorizon(dem, lat, lon, obsH) {
    var D = Math.PI / 180, p0 = demProject(lat, lon), h0 = demSample(dem, p0.x, p0.y);
    if (!isFinite(h0)) throw new Error('point outside the elevation data');
    var la = lat * D, lo = lon * D;
    var U = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    var N = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
    var Ea = [-Math.sin(lo), Math.cos(lo), 0];
    var s = distances(), ns = s.length, cd = new Float64Array(ns), sd = new Float64Array(ns);
    for (var q = 0; q < ns; q++) { cd[q] = Math.cos(s[q] / R_M); sd[q] = Math.sin(s[q] / R_M); }
    var ro = R_M + h0 + (obsH === undefined ? 2 : obsH), elev = new Array(360), reach = new Array(360);
    for (var az = 0; az < 360; az++) {
      var ca = Math.cos(az * D), sa = Math.sin(az * D);
      var dx = ca * N[0] + sa * Ea[0], dy = ca * N[1] + sa * Ea[1], dz = ca * N[2] + sa * Ea[2];
      var best = -Infinity, last = 0;
      for (q = 0; q < ns; q++) {
        var px = cd[q] * U[0] + sd[q] * dx, py = cd[q] * U[1] + sd[q] * dy, pz = cd[q] * U[2] + sd[q] * dz;
        var f = 2 * R_M / (1 - pz);            // south polar stereographic: x = 2R Py/(1-Pz), y = 2R Px/(1-Pz)
        var h = demSample(dem, f * py, f * px);
        if (h !== h) break;                    // left the grid: stop this ray
        var rt = R_M + h, tn = (rt * cd[q] - ro) / (rt * sd[q]);
        if (tn > best) best = tn;
        last = s[q];
      }
      elev[az] = isFinite(best) ? Math.atan(best) / D : 0;
      reach[az] = last / 1000;
    }
    return { elevations: elev, reach_km: reach, siteHeight_m: h0, observerAboveTerrain_m: obsH === undefined ? 2 : obsH };
  }

  return {
    SEARCH_DAYS_AFTER: SEARCH_DAYS_AFTER,
    earthMaskFor: earthMaskFor,
    eventsFromSeries: eventsFromSeries,
    terrainHorizon: terrainHorizon,
    demCovers: demCovers,

    // Receive the decoded downsampled DEM once (worker keeps it for later horizon jobs).
    setDem: function (a) { DEM = { n: a.n, px: a.px, h: a.h }; return { ok: true, n: a.n }; },
    // 360-azimuth terrain horizon at a clicked point from the downsampled DEM.
    horizon: function (a) { if (!DEM) throw new Error('downsampled DEM not loaded'); return terrainHorizon(DEM, a.lat, a.lon, a.obsH); },

    // Explorer window: series, refined events, stats, and the first event after the window.
    explorer: function (a) {
      var start = new Date(a.start), end = new Date(a.end);
      var em = earthMaskFor(a.mask, a.minEl);
      var s = E.series(a.site, start, end, a.step, a.mask, em);
      var ev = { sun: eventsFromSeries(a.site, s, 'sun', a.mask), earth: eventsFromSeries(a.site, s, 'earth', em) };
      var after = {
        sun: E.nextEvent(a.site, 'sun', end, a.mask, SEARCH_DAYS_AFTER, 60).event,
        earth: E.nextEvent(a.site, 'earth', end, em, SEARCH_DAYS_AFTER, 60).event
      };
      return { series: s, events: ev, after: after, stats: E.stats(s) };
    },

    // Launch-slip scan for one site (rows only; the long series is not sent back).
    slip: function (a) {
      var r = E.slipScan(a.site, new Date(a.nominal), a.dur, a.from, a.to, a.step, a.mask, earthMaskFor(a.mask, a.minEl));
      return { stepMin: r.stepMin, rows: r.rows, nWin: r.nWin, perDay: r.perDay };
    },

    // Compare: one scenario.
    scenario: function (a) {
      var start = new Date(a.start), end = new Date(start.getTime() + a.days * DAY);
      var em = earthMaskFor(a.mask, a.minEl);
      var s = E.series(a.site, start, end, E.defaultStepMin(start, end), a.mask, em);
      return { series: s, stats: E.stats(s), events: { sun: eventsFromSeries(a.site, s, 'sun', a.mask), earth: eventsFromSeries(a.site, s, 'earth', em) } };
    },

    // Plain series (power calculator for the launch-slip mission window).
    series: function (a) {
      var start = new Date(a.start), end = new Date(a.end);
      return E.series(a.site, start, end, a.step || E.defaultStepMin(start, end), a.mask, earthMaskFor(a.mask, a.minEl));
    },

    // Self-test used by the UI check: proves the code really ran in a worker.
    ping: function () { return { inWorker: typeof window === 'undefined', engine: !!E && typeof E.sunEarthAt === 'function' }; }
  };
};

/* Job runner: worker if possible, otherwise main thread. Each job returns a Promise. */
window.AsteriaJobs = (function () {
  'use strict';
  var worker = null, mode = 'main', seq = 0, pending = {}, local = null;
  function localJobs() { return local || (local = window.ASTERIA_JOBS(window.LunaEngine)); }
  function runLocal(name, args) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () { try { resolve(localJobs()[name](args)); } catch (e) { reject(e); } }, 16);
    });
  }
  function fallBack(why) {
    if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } }
    worker = null; mode = 'main (' + why + ')';
    Object.keys(pending).forEach(function (id) {
      var p = pending[id]; delete pending[id];
      runLocal(p.name, p.args).then(p.resolve, p.reject);
    });
  }
  function start() {
    try {
      if (!window.Worker || !window.Blob || !window.ASTERIA_CORE) throw new Error('unsupported');
      var src = '(' + window.ASTERIA_CORE.toString() + ').call(self);\n' +
        'var JOBS = (' + window.ASTERIA_JOBS.toString() + ')(self.LunaEngine);\n' +
        'self.onmessage = function (e) { var d = e.data; try { self.postMessage({ id: d.id, result: JOBS[d.name](d.args) }); }' +
        ' catch (err) { self.postMessage({ id: d.id, error: String(err && err.message || err) }); } };\n';
      var url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      worker = new Worker(url);
      mode = 'worker';
      worker.onmessage = function (e) {
        var d = e.data, p = pending[d.id]; if (!p) return;
        delete pending[d.id];
        if (d.error) p.reject(new Error(d.error)); else p.resolve(d.result);
      };
      worker.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); fallBack('worker error'); };
    } catch (e) { worker = null; mode = 'main (' + e.message + ')'; }
  }
  function run(name, args) {
    if (!worker) return runLocal(name, args);
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending[id] = { name: name, args: args, resolve: resolve, reject: reject };
      worker.postMessage({ id: id, name: name, args: args });
    });
  }
  start();
  return { run: run, mode: function () { return mode; }, local: localJobs };
})();
