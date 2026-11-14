// Generated with Claude Code (Anthropic) under human direction.
/* ASTERIA pixel-art loader: a tiny rocket flies from a pixel Earth to a pixel Moon.
 * Shown ONLY when an operation is still running after 250 ms (no artificial delay is ever added).
 * With prefers-reduced-motion a plain CSS spinner is shown instead of the animation. */
window.AsteriaLoader = (function () {
  'use strict';
  var DELAY_MS = 250, W = 64, H = 20;
  var el, cv, ctx, label, active = 0, timer = null, raf = 0, t0 = 0, shownCount = 0;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STARS = [[20, 3], [27, 15], [33, 6], [41, 17], [46, 2], [12, 17], [52, 12], [37, 11]];
  // 7x7 sprites, '.' = transparent
  var EARTH = ['..bbb..', '.bgbbb.', 'bggbbbb', 'bbggbgb', 'bbbbggb', '.bbbgb.', '..bbb..'];
  var MOON = ['..www..', '.wwwgw.', 'wgwwwww', 'wwwwgww', 'wwgwwww', '.wwwww.', '..www..'];
  var PAL = { b: '#2f7fe0', g: '#3fbf6a', w: '#c9ccd6', G: '#8d93a3' };
  var ROCKET = ['..r..', '.www.', '.wbw.', '.www.', 'rwwwr', 'r.a.r'];   // nose up
  var RPAL = { r: '#ff5a5a', w: '#f2f4f8', b: '#4ea8ff', a: '#ffc23d' };

  function sprite(rows, pal, x, y, ctx) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) {
      var c = rows[j][i]; if (c === '.') continue;
      ctx.fillStyle = (c === 'g' && pal === PAL && rows === MOON) ? PAL.G : pal[c];
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
  // Draw the 64 x 20 pixel scene on any 2D context: t = flight progress 0..1 (Earth -> Moon), ts = clock (ms) for
  // the twinkling stars and the flame. Also used by the first-visit intro (js/intro.js).
  function drawScene(c2, t, ts) {
    c2.clearRect(0, 0, W, H);
    STARS.forEach(function (s, k) { c2.fillStyle = ((ts / 300 + k) % 3) < 1 ? '#8fa1bf' : '#3a4866'; c2.fillRect(s[0], s[1], 1, 1); });
    sprite(EARTH, PAL, 1, 7, c2);
    sprite(MOON, PAL, 56, 6, c2);
    // rocket on a shallow arc between them, drawn rotated in 90-degree steps (pixel art)
    var x = 9 + t * 42, y = 12 - Math.sin(t * Math.PI) * 8;
    c2.save(); c2.translate(Math.round(x) + 3, Math.round(y)); c2.rotate(Math.PI / 2);
    for (var j = 0; j < ROCKET.length; j++) for (var i = 0; i < 5; i++) {
      var c = ROCKET[j][i]; if (c === '.') continue;
      if (c === 'a' && (Math.floor(ts / 90) % 2)) continue;          // flickering flame
      c2.fillStyle = RPAL[c]; c2.fillRect(i - 2, j - 3, 1, 1);
    }
    c2.restore();
  }
  function frame(ts) {
    if (!active) return;
    if (!t0) t0 = ts;
    drawScene(ctx, ((ts - t0) / 1800) % 1, ts);              // one flight every 1.8 s
    raf = requestAnimationFrame(frame);
  }
  function build() {
    el = document.createElement('div');
    el.id = 'loader'; el.className = 'loader' + (reduce ? ' reduced' : '');
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.hidden = true;
    el.innerHTML = (reduce ? '<span class="spinner" aria-hidden="true"></span>' : '<canvas width="' + W + '" height="' + H + '" aria-hidden="true"></canvas>') + '<span><span class="loadertxt">Computing…</span></span>';
    document.body.appendChild(el);
    cv = el.querySelector('canvas'); ctx = cv && cv.getContext('2d');
    label = el.querySelector('.loadertxt');
  }
  function show(text) {
    if (!el) build();
    label.textContent = text || 'Computing…';
    el.hidden = false; shownCount++;
    if (ctx) { t0 = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  }
  function hide() { if (el) el.hidden = true; cancelAnimationFrame(raf); }
  function begin(text) {
    active++;
    if (active === 1) { clearTimeout(timer); timer = setTimeout(function () { if (active) show(text); }, DELAY_MS); }
    else if (el && !el.hidden && text) label.textContent = text;
  }
  function end() {
    active = Math.max(0, active - 1);
    if (!active) { clearTimeout(timer); hide(); }
  }
  // Wrap a promise: the loader appears only if it is still pending after 250 ms.
  function track(promise, text) {
    begin(text);
    return promise.then(function (v) { end(); return v; }, function (e) { end(); throw e; });
  }
  return { track: track, begin: begin, end: end, shownCount: function () { return shownCount; }, isShown: function () { return !!(el && !el.hidden); }, delayMs: DELAY_MS, drawScene: drawScene, size: [W, H] };
})();
