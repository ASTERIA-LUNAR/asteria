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

  return {
    SEARCH_DAYS_AFTER: SEARCH_DAYS_AFTER,
    earthMaskFor: earthMaskFor,
    eventsFromSeries: eventsFromSeries,

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
