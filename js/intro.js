// Generated with Claude Code (Anthropic) under human direction.
/* ASTERIA first-visit intro: an honest title card, NOT a loading screen.
 * It shows the pixel-art rocket flying from Earth to the Moon with the name and subtitle, and never claims to load
 * anything. The app loads and computes normally behind it (this file only adds one overlay element). If the app is
 * still computing when the intro ends, the existing real loader (js/loader.js) takes over.
 * Shown on the first visit only. Skipped: Skip button, any click/tap/key; automatically with prefers-reduced-motion,
 * with a share-link hash (#site=... / #lat=...), and in automated browsers (navigator.webdriver) unless a test sets
 * window.ASTERIA_INTRO_TEST = true before the page loads. "Replay intro" on the About page plays it again. */

// Duration of the intro in milliseconds. Change this one number to make it longer or shorter (e.g. 5000 = 5 s).
var INTRO_MS = 3000;

window.AsteriaIntro = (function () {
  'use strict';
  var KEY = 'asteria.introSeen';
  var el = null, raf = 0, timer = 0, t0 = 0, waiters = [], done = true, shownCount = 0;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* storage unavailable: it may show again */ } }
  function reason() {          // why the intro is NOT shown automatically (null = show it)
    if (REDUCE) return 'reduced-motion';
    if (/(^#|&)(site|lat)=/.test(location.hash || '')) return 'share-link';
    if (navigator.webdriver && !window.ASTERIA_INTRO_TEST) return 'automated';
    if (seen()) return 'seen';
    return null;
  }

  function draw(ts) {
    if (!el) return;
    if (!t0) t0 = ts;
    var L = window.AsteriaLoader, cv = el.querySelector('canvas');
    if (L && L.drawScene && cv) L.drawScene(cv.getContext('2d'), REDUCE ? 0.5 : Math.min(1, (ts - t0) / INTRO_MS), ts);
    if (!REDUCE) raf = requestAnimationFrame(draw);
  }
  function onKey() { finish(); }   // any key skips (the key is not swallowed, so browser shortcuts still work)
  function onPointer(e) { e.preventDefault(); finish(); }

  function play() {
    if (el) return;
    done = false; shownCount++;
    var L = window.AsteriaLoader, sz = (L && L.size) || [64, 20];
    el = document.createElement('div');
    el.id = 'intro'; el.className = 'intro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'ASTERIA intro');
    el.innerHTML = '<div class="intro-card">' +
      '<canvas width="' + sz[0] + '" height="' + sz[1] + '" aria-hidden="true"></canvas>' +
      '<div class="intro-name">ASTERIA</div>' +
      '<div class="intro-sub">Lunar South Pole Landing Site Navigator</div>' +
      '<button type="button" class="btn intro-skip" id="introSkip">Skip</button>' +
      '</div>';
    (document.body || document.documentElement).appendChild(el);
    t0 = 0; raf = requestAnimationFrame(draw);
    timer = setTimeout(finish, INTRO_MS);
    document.addEventListener('keydown', onKey, true);
    el.addEventListener('pointerdown', onPointer);
    el.addEventListener('click', onPointer);
    markSeen();
    requestAnimationFrame(function () { if (el) el.classList.add('on'); });
    setTimeout(function () { var b = document.getElementById('introSkip'); if (b) b.focus({ preventScroll: true }); }, 0);
  }

  function finish() {
    if (!el) return;
    clearTimeout(timer); cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey, true);
    var node = el; el = null;
    node.classList.remove('on');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, REDUCE ? 0 : 250);
    handOver();
    done = true;
    var w = waiters; waiters = [];
    w.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }

  // If the app is still loading or computing, show the existing real loader until it is ready.
  function handOver() {
    var App = window.AsteriaApp, L = window.AsteriaLoader;
    if (!L) return;
    var busy = !App || !App.state || !App.state.series || App.state.computing;
    if (!busy) return;
    L.begin('Computing…');
    var wait = function () {
      var A = window.AsteriaApp;
      if (!A || !A.state) { setTimeout(wait, 100); return; }
      A.ready().then(function () { if (!A.state.series || A.state.computing) setTimeout(wait, 100); else L.end(); }, function () { L.end(); });
    };
    wait();
  }

  var why = reason();
  if (!why) play();

  return {
    INTRO_MS: INTRO_MS,
    replay: play,
    skip: finish,
    isShown: function () { return !!el; },
    whenDone: function (fn) { if (done) fn(); else waiters.push(fn); },
    autoSkipReason: function () { return why; },
    shownCount: function () { return shownCount; }
  };
})();
