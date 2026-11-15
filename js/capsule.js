// Generated with Claude Code (Anthropic) under human direction.
/* ASTERIA Historical Capsule: a short illustrated animation through key space-exploration milestones.
 * Loaded lazily (one <script> tag added on the first click of the "Historical Capsule" button), drawn with Canvas 2D.
 * It is NOT ASTERIA data: every picture is an artistic, simplified, not-to-scale illustration; the captions are
 * historical facts with the sources listed in the Sources panel and in docs/HISTORICAL_CAPSULE.md.
 * Nothing runs while it is closed: no requestAnimationFrame, no timers, no listeners on window/document.
 * It never touches the app's state, URL hash or scroll position (they are restored exactly on exit). */
window.AsteriaCapsule = (function () {
  'use strict';

  // ------------------------------------------------------------------ milestones (single source of the captions)
  // The table in docs/HISTORICAL_CAPSULE.md is checked against this array by tests/ui_capsule.js.
  var CHAPTERS = [
    { id: 'sputnik', year: '1957', title: 'Sputnik 1', flags: ['su'],
      text: "The Soviet Union launches the world's first artificial satellite, and the Space Age begins.",
      src: [['NASA History: Sputnik', 'https://www.nasa.gov/history/sputnik/index.html']] },
    { id: 'luna2', year: '1959', title: 'Luna 2', flags: ['su'],
      text: 'A Soviet probe becomes the first spacecraft to reach the Moon, striking its surface.',
      src: [['NASA Science: Moon missions', 'https://science.nasa.gov/moon/missions/'], ['NASA Science: Deep space robotic firsts', 'https://science.nasa.gov/deep-space-exploration/']] },
    { id: 'vostok', year: '1961', title: 'Vostok 1', flags: ['su'],
      text: 'Yuri Gagarin becomes the first human to orbit the Earth, in a flight of 108 minutes.',
      src: [['NASA Science: Yuri Gagarin, first human in space', 'https://science.nasa.gov/resource/yuri-gagarin-first-human-in-space/']] },
    { id: 'luna9', year: '1966', title: 'Luna 9', flags: ['su'],
      text: 'The first soft landing on the Moon, and the first picture from its surface.',
      src: [['NASA Science: Moon missions', 'https://science.nasa.gov/moon/missions/']] },
    { id: 'apollo8', year: '1968', title: 'Apollo 8', flags: ['us'],
      text: 'Borman, Lovell and Anders become the first humans to orbit the Moon, and see Earthrise.',
      src: [['NASA: Apollo 8', 'https://www.nasa.gov/mission/apollo-8/'], ['NASA NSSDCA: Apollo 8', 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1968-118A']] },
    { id: 'apollo11', year: '1969', title: 'Apollo 11', flags: ['us'],
      text: 'Armstrong and Aldrin land and walk on the Moon while Collins pilots the command module in orbit.',
      src: [['NASA NSSDCA: Apollo 11 Lunar Module', 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C'], ['NASA: Apollo 11', 'https://www.nasa.gov/mission/apollo-11/']] },
    { id: 'lunokhod', year: '1970', title: 'Luna 17 and Lunokhod 1', flags: ['su'],
      text: 'Luna 17 lands Lunokhod 1, the first remote-controlled rover on the Moon.',
      src: [['NASA Science: APOD 1997 April 20, Moon Robot: Lunokhod 1', 'https://science.nasa.gov/image-article/apod-1997-april-20-moon-robot-lunokhod-1/'], ['NASA Science: Moon missions', 'https://science.nasa.gov/moon/missions/']] },
    { id: 'apollo17', year: '1972', title: 'Apollo 17', flags: ['us'],
      text: "Apollo's last lunar landing: Cernan and Schmitt explore Taurus-Littrow with the Lunar Roving Vehicle.",
      src: [['NASA: Apollo 17', 'https://www.nasa.gov/mission/apollo-17/'], ['NASA NSSDCA: Apollo 17 Lunar Module', 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1972-096C']] },
    { id: 'lcross', year: '2009', title: 'LCROSS and LRO', flags: ['us'],
      text: "LCROSS strikes Cabeus crater near the south pole and detects water; LRO's laser altimeter maps the terrain ASTERIA uses.",
      src: [['NASA NSSDCA: LCROSS', 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031B'], ['NASA NSSDCA: LRO', 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A']] },
    { id: 'change4', year: '2019', title: "Chang'e 4", flags: ['cn'],
      text: "China makes the first landing on the Moon's far side, and the Yutu-2 rover drives off.",
      src: [['NASA Science: Moon missions', 'https://science.nasa.gov/moon/missions/'], ["NASA: First look, Chang'e lunar landing site", 'https://www.nasa.gov/solar-system/first-look-change-lunar-landing-site/']] },
    { id: 'chandrayaan3', year: '2023', title: 'Chandrayaan-3', flags: ['in'],
      text: "India's Chandrayaan-3 becomes the first spacecraft to soft-land near the lunar south pole, and deploys a rover.",
      src: [['NASA Science: Chandrayaan-3', 'https://science.nasa.gov/mission/chandrayaan-3/'], ['NASA Science: Moon missions', 'https://science.nasa.gov/moon/missions/'], ['ISRO: Chandrayaan-3', 'https://www.isro.gov.in/Chandrayaan3.html']] },
    { id: 'wave2024', year: '2024', title: "SLIM, IM-1 and Chang'e 6", flags: ['jp', 'us', 'cn'],
      text: "SLIM lands within 100 m of its target, Odysseus lands near the south pole, and Chang'e 6 returns far-side samples.",
      src: [['JAXA: SLIM landing results, 25 Jan 2024', 'https://global.jaxa.jp/press/2024/01/20240125-1_e.html'], ["NASA: LRO images Intuitive Machines' Odysseus lander", 'https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/'], ['NASA Science: Moon missions', 'https://science.nasa.gov/moon/missions/']] },
    { id: 'artemis2', year: '2026', title: 'Artemis II', flags: ['us', 'ca'],
      text: 'Three NASA astronauts and one CSA astronaut fly around the Moon, the first crewed lunar flyby in 50 years.',
      src: [['NASA: Artemis II', 'https://www.nasa.gov/mission/artemis-ii/']] },
    { id: 'artemis4', year: '2028', title: 'Next: Artemis IV (planned)', flags: ['us'],
      text: "Planned: two astronauts descend to spend about a week near the Moon's south pole; launch targeted for early 2028.",
      src: [['NASA: Artemis IV', 'https://www.nasa.gov/mission/artemis-iv/'], ['NASA, 27 Feb 2026: Artemis architecture update', 'https://www.nasa.gov/news-release/nasa-adds-mission-to-artemis-lunar-program-updates-architecture/']] }
  ];
  var FLAGNAME = { su: 'USSR', us: 'USA', cn: 'China', 'in': 'India', jp: 'Japan', ca: 'Canada' };
  var BANNER = 'Historical illustrations - artistic, simplified, not to scale; not ASTERIA data';
  var CREDIT = 'Illustrations and animation are drawn by code written with Claude Code (Anthropic), an AI coding assistant; historical facts are from the sources listed.';
  var END_TITLE = 'Next: humans return to the Moon';
  var END_BTN = 'Explore the south-pole landing sites';

  // ------------------------------------------------------------------ timing (seconds of wall-clock time per chapter)
  var D = 5.2;                 // chapter length
  var SLOW = 0.28;             // slow-motion speed while the caption is read
  var CAP_IN = [1.1, 1.55], CAP_OUT = [4.1, 4.45];   // caption fully readable 1.55-4.1 s (2.55 s)
  var END_AT = 4.2;            // last chapter: the end card appears here and the scene keeps drifting slowly
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var RMF = REDUCE ? 0.6 : 1;  // gentler motion
  var TIN = REDUCE ? 0.8 : 0.5; // transition length (reduced motion: plain cross-fade)

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sm(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function speedAt(u) {
    var s;
    if (u < 0.7) s = 1;
    else if (u < 1.3) s = lerp(1, SLOW, sm(0.7, 1.3, u));
    else if (u < 4.1) s = SLOW;
    else if (u < 4.7) s = lerp(SLOW, 1, sm(4.1, 4.7, u));
    else s = lerp(1, 1.3, sm(4.7, D, u));
    return s * RMF;
  }
  // scene time accumulated over one chapter (+ the overlap into the next), used to normalise scene progress q
  var STT = (function () { var s = 0, n = 400, h = (D + TIN) / n; for (var i = 0; i < n; i++) s += speedAt(Math.min(D, (i + 0.5) * h)) * h; return s; })();

  // ------------------------------------------------------------------ state
  var el = null, cv = null, ctx = null, W = 0, H = 0, DPR = 1, L = null;
  var isOpen = false, playing = false, ended = false, raf = 0, last = 0, frames = 0;
  var ci = 0, u = 0, st = 0, from = null, curSpeed = 0;
  var opener = null, saved = null, ui = {}, capState = '', grainPat = null, vign = null, stars = null;
  var listeners = [];

  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function makeStars() {
    var r = rng(7), layers = [];
    for (var l = 0; l < 3; l++) {
      var a = [], n = [140, 80, 34][l];
      for (var i = 0; i < n; i++) a.push({ x: r(), y: r(), s: [0.6, 1.0, 1.6][l] * (0.7 + r() * 0.6), a: [0.35, 0.55, 0.85][l] * (0.6 + r() * 0.4), tw: r() * 6.28 });
      layers.push(a);
    }
    return layers;
  }

  // ------------------------------------------------------------------ drawing helpers
  var SUN = '#ffc23d', WARM = '#ffb85c';
  function bg(c, t, opt) {
    opt = opt || {};
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, opt.top || '#04070f'); g.addColorStop(1, opt.bot || '#0a1428');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var drift = (opt.drift === undefined ? 1 : opt.drift) * t;
    for (var l = 0; l < 3; l++) {
      var lay = stars[l], sp = [2, 5, 11][l] * L.S * 0.12 * drift;
      for (var i = 0; i < lay.length; i++) {
        var s = lay[i], x = ((s.x * W - sp) % W + W) % W, y = s.y * H;
        var a = s.a * (REDUCE ? 1 : 0.85 + 0.15 * Math.sin(t * 1.3 + s.tw));
        c.fillStyle = 'rgba(225,235,255,' + a.toFixed(3) + ')';
        var sz = s.s * DPR; c.fillRect(x, y, sz, sz);
      }
    }
    if (opt.sunGlow !== false) {    // warm sunlight from the upper left
      var sg = c.createRadialGradient(-W * 0.05, -H * 0.1, 0, -W * 0.05, -H * 0.1, Math.max(W, H) * 0.7);
      sg.addColorStop(0, 'rgba(255,190,90,0.20)'); sg.addColorStop(0.4, 'rgba(255,170,70,0.05)'); sg.addColorStop(1, 'rgba(255,170,70,0)');
      c.fillStyle = sg; c.fillRect(0, 0, W, H);
    }
  }
  function shade(c, x, y, r, lx, ly, dark) {   // night side of a sphere; light coming from direction (lx, ly)
    var g = c.createLinearGradient(x + lx * r, y + ly * r, x - lx * r, y - ly * r);
    g.addColorStop(0, 'rgba(2,5,12,0)'); g.addColorStop(0.45, 'rgba(2,5,12,0.05)'); g.addColorStop(0.75, 'rgba(2,5,12,' + (dark * 0.75) + ')'); g.addColorStop(1, 'rgba(2,5,12,' + dark + ')');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  }
  function earth(c, x, y, r, t, lx, ly) {
    lx = lx === undefined ? -0.7 : lx; ly = ly === undefined ? -0.5 : ly;
    var gl = c.createRadialGradient(x, y, r * 0.95, x, y, r * 1.18);
    gl.addColorStop(0, 'rgba(110,175,255,0.45)'); gl.addColorStop(1, 'rgba(110,175,255,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(x, y, r * 1.18, 0, 6.2832); c.fill();
    var g = c.createRadialGradient(x + lx * r * 0.4, y + ly * r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#5aa2ec'); g.addColorStop(0.6, '#2a68b8'); g.addColorStop(1, '#12386e');
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fillStyle = g; c.fill(); c.clip();
    var rot = (t * 0.03) % 2;   // slowly rotating land and clouds
    for (var i = 0; i < 7; i++) {   // continents: clusters of soft patches
      var px = x + (((i * 0.29 + rot) % 2) - 1) * r * 1.25, py = y + Math.sin(i * 2.3) * r * 0.55;
      c.fillStyle = i % 3 === 2 ? 'rgba(150,135,95,0.55)' : 'rgba(84,128,88,0.6)';
      c.beginPath(); c.ellipse(px, py, r * (0.09 + 0.05 * (i % 3)), r * (0.06 + 0.03 * (i % 2)), i * 0.9, 0, 6.2832); c.fill();
      c.beginPath(); c.ellipse(px + r * 0.08, py + r * 0.05, r * 0.07, r * 0.05, i, 0, 6.2832); c.fill();
    }
    c.strokeStyle = 'rgba(255,255,255,0.42)'; c.lineCap = 'round';
    for (var j = 0; j < 9; j++) {   // thin cloud bands
      var cx = x + (((j * 0.23 + rot * 1.3) % 2) - 1) * r * 1.3, cy = y + Math.sin(j * 1.7 + 1) * r * 0.75;
      c.lineWidth = Math.max(1, r * 0.018); c.beginPath(); c.ellipse(cx, cy, r * 0.2, r * 0.035, -0.15, 0.3, 2.8); c.stroke();
    }
    c.restore();
    shade(c, x, y, r, lx, ly, 0.92);
  }
  var CRATERS = (function () { var r = rng(11), a = []; for (var i = 0; i < 14; i++) a.push([r() * 1.6 - 0.8, r() * 1.6 - 0.8, 0.05 + r() * 0.13]); return a; })();
  function moon(c, x, y, r, lx, ly, rot) {
    lx = lx === undefined ? -0.7 : lx; ly = ly === undefined ? -0.5 : ly;
    var g = c.createRadialGradient(x + lx * r * 0.4, y + ly * r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#d8d3c9'); g.addColorStop(0.7, '#a29d94'); g.addColorStop(1, '#6f6b65');
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fillStyle = g; c.fill(); c.clip();
    var off = rot || 0;
    c.fillStyle = 'rgba(70,68,64,0.18)';   // maria
    c.beginPath(); c.ellipse(x + (((0.2 + off) % 2 + 2) % 2 - 1) * r, y - r * 0.2, r * 0.35, r * 0.25, 0.3, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(x + (((0.9 + off) % 2 + 2) % 2 - 1) * r, y + r * 0.25, r * 0.25, r * 0.18, -0.4, 0, 6.2832); c.fill();
    for (var i = 0; i < CRATERS.length; i++) {
      var k = CRATERS[i], cx = x + ((((k[0] + 1 + off) % 2) + 2) % 2 - 1) * r, cy = y + k[1] * r, cr = k[2] * r;
      c.fillStyle = 'rgba(60,58,55,0.2)'; c.beginPath(); c.arc(cx, cy, cr, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(240,235,225,0.16)'; c.lineWidth = cr * 0.15; c.beginPath(); c.arc(cx, cy, cr * 0.92, 2.4, 4.2); c.stroke();
    }
    c.restore();
    shade(c, x, y, r, lx, ly, 0.95);
  }
  var GCRAT = (function () { var r = rng(23), a = []; for (var i = 0; i < 22; i++) a.push([r(), r(), 0.3 + r() * 0.9]); return a; })();
  // lunar ground from horizon y0 to the bottom; pan shifts the craters; tone 0..1 (brightness)
  function ground(c, y0, pan, tone, opt) {
    opt = opt || {};
    tone = tone === undefined ? 1 : tone;
    if (opt.hills) {   // distant massifs
      c.fillStyle = opt.hillCol || '#3e3d44';
      c.beginPath(); c.moveTo(0, y0 + 2);
      var span = W * 0.42;
      for (var x = -span; x <= W + span; x += span / 6) {   // rounded massifs, gently panning
        var ix = Math.floor((x + pan * 0.3) / span), fx = ((x + pan * 0.3) / span) - ix, hgt = 0.45 + 0.55 * Math.abs(Math.sin(ix * 12.9898 + 4.1));
        c.lineTo(x - (pan * 0.3) % (span / 6), y0 - L.S * opt.hills * hgt * Math.pow(Math.sin(fx * Math.PI), 0.8));
      }
      c.lineTo(W, y0 + 2); c.closePath(); c.fill();
      if (opt.hillLit) { c.fillStyle = 'rgba(255,200,120,0.10)'; c.fill(); }
    }
    var g = c.createLinearGradient(0, y0, 0, H);
    g.addColorStop(0, 'rgb(' + Math.round(150 * tone) + ',' + Math.round(146 * tone) + ',' + Math.round(138 * tone) + ')');
    g.addColorStop(1, 'rgb(' + Math.round(52 * tone) + ',' + Math.round(51 * tone) + ',' + Math.round(50 * tone) + ')');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, y0 + L.S * 1.2);
    c.quadraticCurveTo(W / 2, y0 - L.S * 1.2, W, y0 + L.S * 1.2); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
    for (var i = 0; i < GCRAT.length; i++) {
      var k = GCRAT[i], d = k[1], yy = y0 + (H - y0) * (0.08 + 0.92 * d * d), sc = (0.25 + d * 1.6) * L.S * 3 * k[2];
      var xx = (((k[0] * W * 1.4 - pan * (0.4 + d)) % (W * 1.4)) + W * 1.4) % (W * 1.4) - W * 0.2;
      c.fillStyle = 'rgba(30,29,28,' + (0.35 * tone).toFixed(3) + ')'; c.beginPath(); c.ellipse(xx, yy, sc, sc * 0.28, 0, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(235,228,215,' + (0.22 * tone).toFixed(3) + ')'; c.lineWidth = sc * 0.12; c.beginPath(); c.ellipse(xx, yy, sc, sc * 0.28, 0, 0.2, 2.9); c.stroke();
    }
  }
  function flame(c, x, y, w, len, t, ang) {
    var f = len * (REDUCE ? 1 : 0.88 + 0.12 * Math.sin(t * 47) * Math.sin(t * 31));
    c.save(); c.translate(x, y); if (ang) c.rotate(ang);
    var g = c.createLinearGradient(0, 0, 0, f);
    g.addColorStop(0, 'rgba(255,255,235,0.95)'); g.addColorStop(0.25, 'rgba(255,210,120,0.9)'); g.addColorStop(0.6, 'rgba(255,140,50,0.55)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(-w / 2, 0); c.quadraticCurveTo(-w * 0.7, f * 0.45, 0, f); c.quadraticCurveTo(w * 0.7, f * 0.45, w / 2, 0); c.closePath(); c.fill();
    c.restore();
  }
  function plume(c, x, y, t, n, spread, len, col) {   // exhaust smoke particles below (x, y)
    for (var i = 0; i < n; i++) {
      var a = ((t * 0.9 + i / n) % 1), px = x + Math.sin(i * 12.9898) * spread * a * 1.6, py = y + a * len;
      var r = (0.3 + a * 1.4) * spread * 0.45;
      c.fillStyle = 'rgba(' + (col || '230,225,215') + ',' + (0.30 * (1 - a)).toFixed(3) + ')';
      c.beginPath(); c.arc(px, py, r, 0, 6.2832); c.fill();
    }
  }
  function dust(c, x, y, t, amt, width) {   // lunar dust flies in straight lines (no air) and falls back
    if (amt <= 0) return;
    c.save(); c.globalAlpha = clamp(amt, 0, 1);
    for (var i = 0; i < 26; i++) {
      var a = ((t * 1.4 + i / 26) % 1), dir = i % 2 ? 1 : -1, ang = 0.05 + (i % 5) * 0.03;
      var dx = dir * a * width * (0.6 + 0.4 * ((i * 7) % 5) / 5), dy = -Math.sin(ang) * a * width * 0.6 + a * a * width * 0.12;
      c.fillStyle = 'rgba(200,192,178,' + (0.5 * (1 - a)).toFixed(3) + ')';
      c.fillRect(x + dx, y + dy, L.S * 0.5 * (1 - a * 0.5), L.S * 0.25);
    }
    var g = c.createRadialGradient(x, y, 0, x, y, width * 0.7);
    g.addColorStop(0, 'rgba(210,200,185,0.35)'); g.addColorStop(1, 'rgba(210,200,185,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, width * 0.7, width * 0.18, 0, 0, 6.2832); c.fill();
    c.restore();
  }
  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function poly(c, pts, col) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.fill(); }
  function astronaut(c, x, y, h, phase, facing) {   // suited figure, gold visor, no face; (x, y) = feet
    var s = h / 10; facing = facing || 1;
    c.save(); c.translate(x, y); c.scale(facing, 1);
    var sw = Math.sin(phase || 0) * 0.35;
    c.strokeStyle = '#e9e6df'; c.lineCap = 'round'; c.lineWidth = s * 1.5;
    c.beginPath(); c.moveTo(-s * 0.6, -s * 4.2); c.lineTo(-s * 0.6 - sw * s * 2, 0); c.moveTo(s * 0.6, -s * 4.2); c.lineTo(s * 0.6 + sw * s * 2, 0); c.stroke();   // legs
    rect(c, -s * 2.6, -s * 7.6, s * 1.4, s * 3.4, '#b9b6ae');   // backpack
    c.fillStyle = '#f2efe8'; c.beginPath(); c.moveTo(-s * 1.4, -s * 7.6); c.lineTo(s * 1.4, -s * 7.6); c.lineTo(s * 1.3, -s * 3.8); c.lineTo(-s * 1.3, -s * 3.8); c.closePath(); c.fill();   // torso
    c.beginPath(); c.moveTo(s * 0.8, -s * 7.0); c.lineTo(s * 1.6 + sw * s, -s * 4.8); c.stroke();   // arm
    c.fillStyle = '#f2efe8'; c.beginPath(); c.arc(0, -s * 8.6, s * 1.35, 0, 6.2832); c.fill();   // helmet
    var vg = c.createLinearGradient(-s, -s * 9.4, s * 1.2, -s * 7.8);
    vg.addColorStop(0, '#f4c35a'); vg.addColorStop(1, '#6a3d10');
    c.fillStyle = vg; c.beginPath(); c.ellipse(s * 0.35, -s * 8.6, s * 0.95, s * 0.8, 0, 0, 6.2832); c.fill();   // visor
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(s * 0.1, -s * 9.0, s * 0.3, s * 0.15, -0.5, 0, 6.2832); c.fill();
    c.restore();
  }

  // ------------------------------------------------------------------ flags (drawn by code, official proportions)
  function star5(c, x, y, r, rot) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.382 : r, a = (rot || 0) - Math.PI / 2 + i * Math.PI / 5; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill();
  }
  var MAPLE = 'm-90 2030 45-863a95 95 0 0 0-111-98l-859 151 116-320a65 65 0 0 0-20-73l-941-762 212-99a65 65 0 0 0 34-79l-186-572 542 115a65 65 0 0 0 73-38l105-247 423 454a65 65 0 0 0 111-57l-204-1052 327 189a65 65 0 0 0 91-27l332-652 332 652a65 65 0 0 0 91 27l327-189-204 1052a65 65 0 0 0 111 57l423-454 105 247a65 65 0 0 0 73 38l542-115-186 572a65 65 0 0 0 34 79l212 99-941 762a65 65 0 0 0-20 73l116 320-859-151a95 95 0 0 0-111 98l45 863z';
  var maplePath = null;
  function flag(c, code, x, y, w, h) {
    c.save(); c.translate(x, y);
    if (code === 'us') {   // 13 stripes, 50 stars in 9 rows (6/5), canton 2/5 wide and 7 stripes tall
      for (var i = 0; i < 13; i++) rect(c, 0, i * h / 13, w, h / 13 + 0.5, i % 2 ? '#ffffff' : '#b22234');
      var cw = w * 0.76 / 1.9, ch = h * 7 / 13; rect(c, 0, 0, cw, ch, '#3c3b6e');
      c.fillStyle = '#ffffff';
      for (var r = 0; r < 9; r++) for (var k = 0; k < (r % 2 ? 5 : 6); k++) star5(c, (r % 2 ? 2 * k + 2 : 2 * k + 1) * cw / 12, (r + 1) * ch / 10, h * 0.0308);
    } else if (code === 'su') {   // red, gold star outline above the hammer and sickle (upper hoist)
      rect(c, 0, 0, w, h, '#cc0000');
      var u0 = h / 8; c.fillStyle = '#ffd700'; c.strokeStyle = '#ffd700';
      c.lineWidth = Math.max(0.6, u0 * 0.12); c.beginPath();
      for (var j = 0; j < 10; j++) { var rr = j % 2 ? u0 * 0.5 * 0.382 : u0 * 0.5, a = -Math.PI / 2 + j * Math.PI / 5; c.lineTo(u0 * 2 + Math.cos(a) * rr, u0 * 1 + Math.sin(a) * rr); }
      c.closePath(); c.stroke();
      c.lineCap = 'butt';
      c.lineWidth = u0 * 0.32; c.beginPath(); c.arc(u0 * 2.05, u0 * 2.55, u0 * 0.95, -0.5, 2.9); c.stroke();   // sickle blade
      c.lineWidth = u0 * 0.28; c.beginPath(); c.moveTo(u0 * 1.25, u0 * 3.55); c.lineTo(u0 * 1.0, u0 * 3.85); c.stroke();   // sickle handle
      c.lineWidth = u0 * 0.26; c.beginPath(); c.moveTo(u0 * 1.4, u0 * 3.75); c.lineTo(u0 * 2.85, u0 * 2.1); c.stroke();   // hammer shaft
      c.save(); c.translate(u0 * 2.85, u0 * 2.1); c.rotate(-0.85 + Math.PI / 2); c.fillRect(-u0 * 0.55, -u0 * 0.2, u0 * 1.1, u0 * 0.4); c.restore();   // hammer head
    } else if (code === 'cn') {   // red, one large and four small gold stars, each small star pointing at the large one
      rect(c, 0, 0, w, h, '#ee1c25'); c.fillStyle = '#ffff00';
      var g = h / 20; star5(c, 5 * g, 5 * g, 3 * g, 0);
      [[10, 2], [12, 4], [12, 7], [10, 9]].forEach(function (p) { var ang = Math.atan2(5 - p[1], 5 - p[0]) + Math.PI / 2; star5(c, p[0] * g, p[1] * g, g, ang); });
    } else if (code === 'in') {   // saffron, white, green; navy 24-spoke chakra
      rect(c, 0, 0, w, h / 3 + 0.5, '#ff9933'); rect(c, 0, h / 3, w, h / 3 + 0.5, '#ffffff'); rect(c, 0, 2 * h / 3, w, h / 3, '#138808');
      var cx = w / 2, cy = h / 2, cr = (h / 3) * 0.4;
      c.strokeStyle = '#000080'; c.lineWidth = Math.max(0.5, cr * 0.12); c.beginPath(); c.arc(cx, cy, cr, 0, 6.2832); c.stroke();
      c.lineWidth = Math.max(0.3, cr * 0.05); c.beginPath();
      for (var s = 0; s < 24; s++) { var aa = s * Math.PI / 12; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(aa) * cr, cy + Math.sin(aa) * cr); }
      c.stroke();
    } else if (code === 'jp') {   // white with a crimson disc, diameter 3/5 of the height
      rect(c, 0, 0, w, h, '#ffffff'); c.fillStyle = '#bc002d'; c.beginPath(); c.arc(w / 2, h / 2, h * 0.3, 0, 6.2832); c.fill();
    } else if (code === 'ca') {   // red-white-red 1:2:1 with the 11-point maple leaf
      rect(c, 0, 0, w, h, '#d52b1e'); rect(c, w / 4, 0, w / 2, h, '#ffffff');
      if (!maplePath && window.Path2D) maplePath = new Path2D(MAPLE);
      if (maplePath) { c.save(); c.translate(w / 2, h / 2); var sc = h / 4800; c.scale(sc, sc); c.fillStyle = '#d52b1e'; c.fill(maplePath); c.restore(); }
    }
    c.restore();
  }
  var RATIO = { us: 1.9, su: 2, cn: 1.5, 'in': 1.5, jp: 1.5, ca: 2 };
  function flagChip(code) {
    var span = document.createElement('span'); span.className = 'cap-chip';
    var k = document.createElement('canvas'), hh = 14, ww = Math.round(hh * RATIO[code]), dp = Math.min(3, window.devicePixelRatio || 1);
    k.width = ww * dp; k.height = hh * dp; k.style.width = ww + 'px'; k.style.height = hh + 'px'; k.setAttribute('aria-hidden', 'true');
    var c2 = k.getContext('2d'); c2.scale(dp, dp); flag(c2, code, 0, 0, ww, hh);
    span.appendChild(k); span.appendChild(document.createTextNode(FLAGNAME[code]));
    return span;
  }

  // ------------------------------------------------------------------ spacecraft (simplified silhouettes, approximate proportions)
  function sputnik(c, x, y, s, ang) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.strokeStyle = '#cfd3da'; c.lineWidth = s * 0.06;
    c.beginPath(); for (var i = -1.5; i <= 1.5; i += 1) { c.moveTo(-s * 0.3, i * s * 0.2); c.lineTo(-s * 3.2, i * s * 0.55); } c.stroke();
    var g = c.createRadialGradient(-s * 0.15, -s * 0.2, s * 0.05, 0, 0, s * 0.6);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c9ced6'); g.addColorStop(1, '#5d6470');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, s * 0.6, 0, 6.2832); c.fill();
    c.restore();
  }
  function r7(c, x, y, s, sep, t) {   // R-7 / Vostok: core + four tapered strap-on boosters; sep 0..1 = boosters falling away
    var cw = s * 0.9, ch = s * 9;
    for (var b = 0; b < 3; b++) {   // two outer boosters and the front one
      var side = b === 0 ? -1 : b === 1 ? 1 : 0, dx = side * s * 0.75, k = sep;
      c.save(); c.translate(x + dx + side * k * s * 3, y + k * k * s * 6); c.rotate(side * k * 0.9 + (side === 0 ? k * 0.3 : 0));
      if (side !== 0 || k > 0) {
        c.fillStyle = side === 0 ? '#c9ccd2' : '#dfe2e7';
        c.beginPath(); c.moveTo(-s * 0.35, 0); c.lineTo(s * 0.35, 0); c.lineTo(s * 0.12, -s * 4.2); c.lineTo(-s * 0.12, -s * 4.2); c.closePath(); c.fill();
        if (k === 0) flame(c, 0, 0, s * 0.55, s * 3.2, t + b);
      }
      c.restore();
    }
    rect(c, x - cw / 2, y - ch, cw, ch, '#e7e9ee'); rect(c, x - cw / 2, y - ch * 0.62, cw, s * 0.25, '#7b818c');
    c.fillStyle = '#d8dbe1'; c.beginPath(); c.moveTo(x - cw / 2, y - ch); c.lineTo(x + cw / 2, y - ch); c.lineTo(x + cw * 0.3, y - ch - s * 1.6); c.lineTo(x - cw * 0.3, y - ch - s * 1.6); c.closePath(); c.fill();
    rect(c, x - cw * 0.08, y - ch - s * 2.4, cw * 0.16, s * 0.8, '#aeb3bc');
    rect(c, x - cw / 2, y - ch * 0.5, cw * 0.18, ch * 0.5, 'rgba(0,0,0,0.12)');
    flame(c, x, y, s * 0.7, s * 4, t);
  }
  function csm(c, x, y, s, ang) {
    c.save(); c.translate(x, y); c.rotate(ang || 0);
    c.fillStyle = '#9aa0aa'; c.beginPath(); c.moveTo(-s * 2.6, -s * 0.5); c.lineTo(-s * 3.3, -s * 0.8); c.lineTo(-s * 3.3, s * 0.8); c.lineTo(-s * 2.6, s * 0.5); c.closePath(); c.fill();
    rect(c, -s * 2.6, -s * 0.75, s * 2.4, s * 1.5, '#d9dce2'); rect(c, -s * 2.0, -s * 0.75, s * 0.25, s * 1.5, '#8a909a');
    c.fillStyle = '#eef0f3'; c.beginPath(); c.moveTo(-s * 0.2, -s * 0.75); c.lineTo(s * 1.0, -s * 0.12); c.lineTo(s * 1.0, s * 0.12); c.lineTo(-s * 0.2, s * 0.75); c.closePath(); c.fill();
    c.restore();
  }
  function lm(c, x, y, s, ascentOnly) {   // Apollo lunar module; (x, y) = footpads level
    if (!ascentOnly) {
      c.strokeStyle = '#b9b3a2'; c.lineWidth = s * 0.18;
      c.beginPath(); c.moveTo(-s * 1.4 + x, y - s * 2.2); c.lineTo(-s * 2.5 + x, y); c.moveTo(s * 1.4 + x, y - s * 2.2); c.lineTo(s * 2.5 + x, y); c.stroke();
      rect(c, x - s * 2.8, y - s * 0.12, s * 0.6, s * 0.12, '#cfc9b8'); rect(c, x + s * 2.2, y - s * 0.12, s * 0.6, s * 0.12, '#cfc9b8');
      var g = c.createLinearGradient(x - s * 1.6, 0, x + s * 1.6, 0); g.addColorStop(0, '#a77b22'); g.addColorStop(0.45, '#e3b649'); g.addColorStop(1, '#7c5714');
      poly(c, [x - s * 1.7, y - s * 1.6, x + s * 1.7, y - s * 1.6, x + s * 1.5, y - s * 3.0, x - s * 1.5, y - s * 3.0], g);
    }
    poly(c, [x - s * 1.4, y - s * 3.0, x + s * 1.3, y - s * 3.0, x + s * 1.5, y - s * 4.2, x + s * 0.6, y - s * 5.0, x - s * 1.0, y - s * 5.0, x - s * 1.5, y - s * 4.0], '#c8c9cb');
    poly(c, [x - s * 0.9, y - s * 4.6, x - s * 0.3, y - s * 4.6, x - s * 0.5, y - s * 4.1], '#22252b');
    rect(c, x + s * 0.4, y - s * 5.6, s * 0.08, s * 0.7, '#9fa2a8');
    c.fillStyle = '#d9dadc'; c.beginPath(); c.arc(x + s * 0.44, y - s * 5.7, s * 0.3, 3.4, 6.0); c.fill();
  }
  function lunokhod(c, x, y, s, t, lidOpen) {   // (x, y) = ground contact
    var wr = s * 0.55;
    c.fillStyle = '#2b2d33';
    for (var i = 0; i < 4; i++) {
      var wx = x - s * 2.2 + i * s * 1.45;
      c.beginPath(); c.arc(wx, y - wr, wr, 0, 6.2832); c.fill();
      c.strokeStyle = '#8b8f98'; c.lineWidth = s * 0.08; c.beginPath();
      for (var k = 0; k < 3; k++) { var a = t * 3 + k * 2.09; c.moveTo(wx, y - wr); c.lineTo(wx + Math.cos(a) * wr, y - wr + Math.sin(a) * wr); }
      c.stroke();
    }
    var g = c.createLinearGradient(0, y - s * 2.6, 0, y - s * 1.1); g.addColorStop(0, '#c9cbd0'); g.addColorStop(1, '#6d7079');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y - s * 1.75, s * 2.9, s * 0.9, 0, 0, 6.2832); c.fill();   // the tub
    c.save(); c.translate(x - s * 2.6, y - s * 2.45); c.rotate(-lidOpen * 1.1);   // convex lid with solar cells, hinged at the back
    var lg = c.createLinearGradient(0, 0, s * 5.4, 0); lg.addColorStop(0, '#1b2f5c'); lg.addColorStop(1, '#3c5a9a');
    c.fillStyle = lg; c.beginPath(); c.ellipse(s * 2.7, 0, s * 2.8, s * 0.45, 0, Math.PI, 0); c.fill();
    c.restore();
    rect(c, x + s * 2.2, y - s * 3.3, s * 0.1, s * 1.2, '#bfc3ca');
    c.fillStyle = '#e6e8ec'; c.beginPath(); c.arc(x + s * 2.25, y - s * 3.35, s * 0.18, 0, 6.2832); c.fill();
    c.fillStyle = '#16181c'; c.beginPath(); c.arc(x + s * 2.6, y - s * 1.9, s * 0.18, 0, 6.2832); c.fill();
  }
  function lrv(c, x, y, s, t) {   // Lunar Roving Vehicle with two seated, suited astronauts; drives to the left
    var wr = s * 0.75;
    for (var i = 0; i < 2; i++) {
      var wx = x + (i ? s * 2.4 : -s * 2.4);
      c.fillStyle = '#3b3d42'; c.beginPath(); c.arc(wx, y - wr, wr, 0, 6.2832); c.fill();
      c.strokeStyle = '#9da1aa'; c.lineWidth = s * 0.08; c.beginPath();
      for (var k = 0; k < 4; k++) { var a = -t * 4 + k * 1.571; c.moveTo(wx, y - wr); c.lineTo(wx + Math.cos(a) * wr, y - wr + Math.sin(a) * wr); }
      c.stroke();
      c.fillStyle = '#c6a24a'; c.beginPath(); c.arc(wx, y - wr, wr * 1.15, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(wx, y - wr); c.closePath(); c.fill();
    }
    rect(c, x - s * 3.4, y - s * 1.8, s * 6.8, s * 0.3, '#a3a7ae');
    astronaut(c, x - s * 0.9, y - s * 1.5, s * 3.6, 1.2, -1);
    astronaut(c, x + s * 0.9, y - s * 1.5, s * 3.6, 1.2, -1);
    rect(c, x + s * 2.6, y - s * 4.2, s * 0.08, s * 2.4, '#c0c3c9');
    c.fillStyle = '#e9eaec'; c.beginPath(); c.moveTo(x + s * 1.6, y - s * 4.0); c.quadraticCurveTo(x + s * 2.64, y - s * 5.0, x + s * 3.7, y - s * 4.0); c.closePath(); c.fill();
  }
  function lro(c, x, y, s) {
    rect(c, x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6, '#c9a53e'); rect(c, x - s * 0.8, y - s * 0.8, s * 1.6, s * 0.4, '#e2c060');
    rect(c, x - s * 4.4, y - s * 0.12, s * 3.6, s * 0.24, '#9aa0aa');
    var pg = c.createLinearGradient(x - s * 4.4, 0, x - s * 2.0, 0); pg.addColorStop(0, '#1c3567'); pg.addColorStop(1, '#3a5fa6');
    rect(c, x - s * 4.6, y - s * 1.2, s * 2.4, s * 2.4, pg);
    c.fillStyle = '#e6e8ec'; c.beginPath(); c.arc(x + s * 1.4, y - s * 0.6, s * 0.6, 0, 6.2832); c.fill();
  }
  function bigLander(c, x, y, s, legs) {   // generic tall lander (illustrative)
    c.strokeStyle = '#a9aeb7'; c.lineWidth = s * 0.25;
    c.beginPath(); c.moveTo(x - s * 1.4, y - s * 3); c.lineTo(x - s * 2.6 - legs * s * 0.3, y); c.moveTo(x + s * 1.4, y - s * 3); c.lineTo(x + s * 2.6 + legs * s * 0.3, y); c.stroke();
    var g = c.createLinearGradient(x - s * 1.6, 0, x + s * 1.6, 0); g.addColorStop(0, '#f0f2f5'); g.addColorStop(0.55, '#c3c8d0'); g.addColorStop(1, '#6f7680');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - s * 1.6, y - s * 1.6); c.lineTo(x + s * 1.6, y - s * 1.6); c.lineTo(x + s * 1.6, y - s * 13); c.quadraticCurveTo(x, y - s * 16.5, x - s * 1.6, y - s * 13); c.closePath(); c.fill();
    rect(c, x - s * 1.6, y - s * 11.6, s * 3.2, s * 0.35, '#3a3f48');
    c.fillStyle = '#1b2230'; for (var i = 0; i < 3; i++) c.fillRect(x - s * 0.9 + i * s * 0.7, y - s * 12.6, s * 0.4, s * 0.5);
  }
  function smallLander(c, x, y, s, gold) {   // compact robotic lander (Luna 17 platform / Chang'e / Vikram style, simplified)
    c.strokeStyle = '#b3b6bd'; c.lineWidth = s * 0.16;
    c.beginPath(); c.moveTo(x - s * 1.2, y - s * 1.4); c.lineTo(x - s * 2.1, y); c.moveTo(x + s * 1.2, y - s * 1.4); c.lineTo(x + s * 2.1, y); c.stroke();
    var g = c.createLinearGradient(x - s * 1.5, 0, x + s * 1.5, 0);
    if (gold) { g.addColorStop(0, '#a37a20'); g.addColorStop(0.5, '#e8c158'); g.addColorStop(1, '#7a5512'); } else { g.addColorStop(0, '#8d929b'); g.addColorStop(0.5, '#d3d6dc'); g.addColorStop(1, '#666b74'); }
    rect(c, x - s * 1.5, y - s * 2.9, s * 3, s * 1.6, g);
  }
  function smallRover(c, x, y, s, t, six) {   // Yutu-2 / Pragyan style: box, wheels, two solar wings, mast
    var n = six ? 3 : 2, wr = s * 0.32;
    c.fillStyle = '#2e3036';
    for (var i = 0; i < n; i++) { var wx = x - s * 0.9 + i * (s * 1.8 / (n - 1)); c.beginPath(); c.arc(wx, y - wr, wr, 0, 6.2832); c.fill(); }
    var g = c.createLinearGradient(0, y - s * 1.6, 0, y - s * 0.6); g.addColorStop(0, '#e2c464'); g.addColorStop(1, '#8a6a1c');
    rect(c, x - s * 1.1, y - s * 1.5, s * 2.2, s * 0.85, g);
    rect(c, x - s * 2.2, y - s * 1.65, s * 1.1, s * 0.14, '#2a4a8c'); rect(c, x + s * 1.1, y - s * 1.65, s * 1.1, s * 0.14, '#2a4a8c');
    rect(c, x + s * 0.6, y - s * 2.5, s * 0.1, s * 1.0, '#c3c6cc'); rect(c, x + s * 0.45, y - s * 2.75, s * 0.45, s * 0.28, '#d9dbe0');
  }
  function sls(c, x, y, s, t, fire) {   // SLS with Orion: orange core stage, two white boosters, launch abort tower
    rect(c, x - s * 1.6, y - s * 10.5, s * 0.75, s * 10.5, '#eceef1'); rect(c, x + s * 0.85, y - s * 10.5, s * 0.75, s * 10.5, '#eceef1');
    poly(c, [x - s * 1.6, y - s * 10.5, x - s * 0.85, y - s * 10.5, x - s * 1.22, y - s * 11.4], '#eceef1');
    poly(c, [x + s * 0.85, y - s * 10.5, x + s * 1.6, y - s * 10.5, x + s * 1.22, y - s * 11.4], '#eceef1');
    var g = c.createLinearGradient(x - s * 0.85, 0, x + s * 0.85, 0); g.addColorStop(0, '#b65a1c'); g.addColorStop(0.5, '#e9853a'); g.addColorStop(1, '#8f4412');
    rect(c, x - s * 0.85, y - s * 13, s * 1.7, s * 13, g);
    rect(c, x - s * 0.7, y - s * 14.6, s * 1.4, s * 1.6, '#e3e5e9');
    poly(c, [x - s * 0.7, y - s * 14.6, x + s * 0.7, y - s * 14.6, x, y - s * 16.2], '#f1f2f4');
    rect(c, x - s * 0.06, y - s * 17.6, s * 0.12, s * 1.5, '#d0d3d8');
    if (fire) { flame(c, x - s * 1.22, y, s * 0.9, s * 6, t); flame(c, x + s * 1.22, y, s * 0.9, s * 6, t + 1); flame(c, x, y, s * 1.2, s * 4.5, t + 2); }
  }
  function orion(c, x, y, s, ang) {
    c.save(); c.translate(x, y); c.rotate(ang || 0);
    c.fillStyle = '#28427a';
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (d) { c.save(); c.rotate(Math.atan2(d[1], d[0])); c.fillRect(s * 0.6, -s * 0.22, s * 2.2, s * 0.44); c.restore(); });
    rect(c, -s * 1.1, -s * 0.6, s * 1.2, s * 1.2, '#d7dadf');
    c.fillStyle = '#eef0f3'; c.beginPath(); c.moveTo(s * 0.1, -s * 0.75); c.lineTo(s * 1.2, -s * 0.2); c.lineTo(s * 1.2, s * 0.2); c.lineTo(s * 0.1, s * 0.75); c.closePath(); c.fill();
    c.restore();
  }

  // ------------------------------------------------------------------ scenes: draw(c, q (0..1 progress), t (scene time s))
  var SCENES = {
    sputnik: function (c, q, t) {
      bg(c, t);
      var ex = L.portrait ? W * 0.5 : W * 0.33, ey = L.portrait ? H * 1.02 : H * 1.28, er = L.portrait ? W * 0.95 : H * 0.82;
      earth(c, ex, ey, er, t);
      var a = lerp(-2.55, -0.65, q), rx = er * 1.32, ry = er * 1.12, sx = ex + Math.cos(a) * rx, sy = ey + Math.sin(a) * ry;
      c.strokeStyle = 'rgba(255,200,120,0.35)'; c.lineWidth = L.S * 0.18; c.setLineDash([L.S * 0.8, L.S * 0.8]);
      c.beginPath(); c.ellipse(ex, ey, rx, ry, 0, -2.75, a); c.stroke(); c.setLineDash([]);
      if (!REDUCE) for (var i = 0; i < 3; i++) {   // "beep" radio rings
        var k = ((t * 0.9 + i / 3) % 1); c.strokeStyle = 'rgba(255,214,150,' + (0.45 * (1 - k)).toFixed(3) + ')'; c.lineWidth = L.S * 0.15;
        c.beginPath(); c.arc(sx, sy, L.S * (1.5 + k * 9), 0, 6.2832); c.stroke();
      }
      sputnik(c, sx, sy, L.S * 1.6, a + Math.PI / 2 + 1.4);
    },
    luna2: function (c, q, t) {
      bg(c, t);
      var mx = L.portrait ? W * 0.62 : L.fx + L.S * 10, my = L.portrait ? H * 0.36 : L.fy - L.S * 4, mr = L.S * (L.portrait ? 20 : 24);
      earth(c, L.portrait ? W * 0.12 : W * 0.08, L.portrait ? H * 0.12 : H * 0.18, L.S * 4, t);
      moon(c, mx, my, mr);
      var hitK = 0.8, k = Math.min(q / hitK, 1), ex = mx - mr * 0.72, ey = my - mr * 0.55 + mr * 0.15;
      var sx0 = -W * 0.05, sy0 = my - mr * 1.6;
      var px = lerp(sx0, ex, k), py = lerp(sy0, ey, k) - Math.sin(k * Math.PI) * mr * 0.25;
      if (k < 1) {
        var tr = c.createLinearGradient(px - L.S * 22, py, px, py); tr.addColorStop(0, 'rgba(255,200,120,0)'); tr.addColorStop(1, 'rgba(255,214,150,0.6)');
        c.strokeStyle = tr; c.lineWidth = L.S * 0.3; c.beginPath(); c.moveTo(px - L.S * 22, py - (py - sy0) * 0.1); c.lineTo(px, py); c.stroke();
        sputnik(c, px, py, L.S * 0.9, 0.3);
      } else {
        var f = clamp((q - hitK) / 0.25, 0, 1);
        var g = c.createRadialGradient(ex, ey, 0, ex, ey, L.S * (2 + f * 10));
        g.addColorStop(0, 'rgba(255,240,200,' + (0.95 * (1 - f)).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,180,90,0)');
        c.fillStyle = g; c.beginPath(); c.arc(ex, ey, L.S * (2 + f * 10), 0, 6.2832); c.fill();
      }
    },
    vostok: function (c, q, t) {
      var alt = sm(0, 1, q);
      var top = 'rgb(' + Math.round(lerp(20, 4, alt)) + ',' + Math.round(lerp(42, 7, alt)) + ',' + Math.round(lerp(90, 15, alt)) + ')';
      bg(c, t * 0.3, { top: top, bot: alt < 0.5 ? '#3a4f7a' : '#0a1428', sunGlow: true });
      var gy = H * 0.86 + alt * H * 0.9;   // the ground falls away as the rocket climbs
      if (gy < H * 1.6) {
        var hz = c.createLinearGradient(0, gy - H * 0.25, 0, gy); hz.addColorStop(0, 'rgba(255,160,80,0)'); hz.addColorStop(1, 'rgba(255,170,90,0.45)');
        c.fillStyle = hz; c.fillRect(0, gy - H * 0.25, W, H * 0.25);
        c.fillStyle = '#121a2c'; c.beginPath(); c.moveTo(0, gy); c.quadraticCurveTo(W / 2, gy - L.S * 4 * (1 + alt * 3), W, gy); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      }
      for (var i = 0; i < 5; i++) {   // clouds sliding down
        var cy = ((i * 0.23 + alt * 1.6) % 1.2) * H - H * 0.1, cx = (i * 0.31 % 1) * W;
        c.fillStyle = 'rgba(200,215,240,' + (0.12 * (1 - alt)).toFixed(3) + ')'; c.beginPath(); c.ellipse(cx, cy, L.S * 16, L.S * 2, 0, 0, 6.2832); c.fill();
      }
      var rx = L.portrait ? W * 0.5 : L.fx, ry = L.portrait ? H * 0.5 : L.fy + L.S * 14 - alt * L.S * 4;
      var sep = clamp((q - 0.45) / 0.5, 0, 1);
      plume(c, rx, ry + L.S * 3, t, 18, L.S * 2.2, L.S * 26);
      r7(c, rx, ry, L.S * 1.25, sep, t);
    },
    luna9: function (c, q, t) {
      bg(c, t);
      earth(c, L.portrait ? W * 0.78 : W * 0.86, H * 0.16, L.S * 4.2, t);
      var gy = L.portrait ? H * 0.5 : H * 0.7;
      ground(c, gy, t * L.S * 2, 1, { hills: 4 });
      var land = 0.42, k = Math.min(q / land, 1), lx = L.portrait ? W * 0.5 : L.fx, ly = lerp(-H * 0.1, gy + L.S * 4, sm(0, 1, k));
      var s = L.S * 1.3;
      if (k < 1) {
        flame(c, lx, ly, s * 1.2, s * (2.5 + 1.5 * (1 - k)), t);
        rect(c, lx - s * 1.0, ly - s * 3.4, s * 2.0, s * 3.2, '#9aa0aa'); rect(c, lx - s * 1.0, ly - s * 3.4, s * 0.5, s * 3.2, '#c5c9d0');
        c.fillStyle = '#d5d8de'; c.beginPath(); c.arc(lx, ly - s * 4.2, s * 0.9, 0, 6.2832); c.fill();
        dust(c, lx, gy + L.S * 4, t, clamp((k - 0.6) / 0.4, 0, 1), L.S * 14);
      } else {
        var o = sm(land + 0.06, land + 0.32, q), bx = lx, by = gy + L.S * 4;
        dust(c, bx, by, t, clamp(1 - (q - land) / 0.15, 0, 1), L.S * 14);
        c.fillStyle = '#b8bcc4';
        for (var p = 0; p < 4; p++) {   // four petals open
          c.save(); c.translate(bx, by - s * 0.9); c.rotate(-Math.PI / 2 + (p - 1.5) * 0.6 * o + (p < 2 ? -1 : 1) * o * 0.9);
          c.beginPath(); c.moveTo(-s * 0.35, 0); c.lineTo(s * 0.35, 0); c.lineTo(s * 0.2, -s * 1.7); c.lineTo(-s * 0.2, -s * 1.7); c.closePath(); c.fill(); c.restore();
        }
        var g = c.createRadialGradient(bx - s * 0.3, by - s * 1.4, s * 0.1, bx, by - s * 1.0, s * 1.0); g.addColorStop(0, '#f0f2f5'); g.addColorStop(1, '#7c828c');
        c.fillStyle = g; c.beginPath(); c.arc(bx, by - s * 1.0, s * 0.95, 0, 6.2832); c.fill();
        c.strokeStyle = '#d7dae0'; c.lineWidth = s * 0.08; c.beginPath();
        for (var a = 0; a < 4; a++) { c.moveTo(bx, by - s * 1.8); c.lineTo(bx + Math.cos(-2.4 + a * 0.55) * s * 2.2 * o, by - s * 1.8 + Math.sin(-2.4 + a * 0.55) * s * 2.2 * o); }
        c.stroke();
        if (o > 0.5 && !REDUCE) {   // picture data going home
          var ex = L.portrait ? W * 0.78 : W * 0.86, ey = H * 0.16;
          for (var i = 0; i < 4; i++) { var kk = ((t * 0.7 + i / 4) % 1); c.fillStyle = 'rgba(255,214,150,' + (0.7 * (1 - Math.abs(kk - 0.5) * 2)).toFixed(3) + ')'; c.fillRect(lerp(bx, ex, kk), lerp(by - s * 2, ey, kk), L.S * 0.5, L.S * 0.5); }
        }
      }
    },
    apollo8: function (c, q, t) {
      bg(c, t * 0.4, { sunGlow: false });
      var cx = W * 0.5, R = Math.max(W, H) * 1.6, hy = L.portrait ? H * 0.52 : H * 0.72;
      var ex = L.portrait ? W * 0.5 : W * 0.58, ey = lerp(hy + L.S * 6, hy - L.S * 14, sm(0, 1, q)), er = L.S * 6.5;
      earth(c, ex, ey, er, t, 0.9, -0.1);   // lit from the right, half Earth
      var g = c.createLinearGradient(0, hy - L.S * 3, 0, H); g.addColorStop(0, '#a19c92'); g.addColorStop(0.15, '#5f5c57'); g.addColorStop(1, '#16161a');
      c.fillStyle = g; c.beginPath(); c.arc(cx, hy + R, R, 0, 6.2832); c.fill();
      for (var i = 0; i < 9; i++) {   // craters on the limb, sliding as the spacecraft orbits
        var x = ((i * 0.17 * W - t * L.S * 4) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15, y = hy + L.S * (2 + (i % 3) * 3);
        c.fillStyle = 'rgba(25,25,28,0.45)'; c.beginPath(); c.ellipse(x, y, L.S * (2 + i % 3), L.S * 0.5, 0, 0, 6.2832); c.fill();
      }
      csm(c, lerp(W * 0.12, W * 0.32, q), H * 0.22 + Math.sin(q * 3) * L.S, L.S * 1.4, 0.1);
    },
    apollo11: function (c, q, t) {
      bg(c, t * 0.5);
      earth(c, L.portrait ? W * 0.2 : W * 0.14, H * 0.17, L.S * 4, t);
      { var k0 = (t * 0.05) % 1; c.fillStyle = 'rgba(230,232,236,0.9)'; c.beginPath(); c.arc(lerp(W * 0.3, W * 0.95, k0), H * 0.1 + Math.sin(k0 * 3) * L.S, L.S * 0.35, 0, 6.2832); c.fill(); }   // Collins in orbit
      var gy = L.portrait ? H * 0.5 : H * 0.72;
      ground(c, gy, t * L.S, 1);
      var land = 0.38, k = Math.min(q / land, 1), lx = L.portrait ? W * 0.42 : L.fx - L.S * 4, s = L.S * 1.5;
      var ly = lerp(-H * 0.05, gy + L.S * 5, sm(0, 1, k));
      if (k < 1) { flame(c, lx, ly - s * 1.5, s * 0.8, s * 2.2, t); dust(c, lx, gy + L.S * 5, t, clamp((k - 0.55) / 0.45, 0, 1), L.S * 18); }
      else dust(c, lx, gy + L.S * 5, t, clamp(1 - (q - land) / 0.1, 0, 1), L.S * 18);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(lx + s * 2.5, gy + L.S * 5.2, s * 3.5 * (k >= 1 ? 1 : 0.3), s * 0.4, 0, 0, 6.2832); c.fill();
      lm(c, lx, ly, s);
      var fx = lx + s * 7.5, fy = gy + L.S * 6.5;
      if (q > 0.5) {
        var w = sm(0.5, 0.68, q), ax = lerp(lx + s * 3.2, fx - s * 1.8, w);
        var fk = sm(0.62, 0.8, q);   // flag rises
        if (fk > 0) {
          var ph = s * 7 * fk;
          rect(c, fx, fy - ph, s * 0.12, ph, '#d9dadc'); rect(c, fx, fy - ph, s * 3.2, s * 0.08, '#d9dadc');
          c.save(); c.globalAlpha = fk; flag(c, 'us', fx + s * 0.12, fy - ph + s * 0.08, s * 3.1, s * 3.1 / 1.9); c.restore();
        }
        c.save(); c.globalAlpha = sm(0.5, 0.56, q); astronaut(c, ax, fy, s * 5.5, (q - 0.5) * 40 * (1 - sm(0.66, 0.7, q)), 1); c.restore();
        if (q > 0.78) { c.save(); c.globalAlpha = sm(0.78, 0.86, q); astronaut(c, lx + s * 2.6, gy + L.S * 5.8, s * 5.2, 0, -1); c.restore(); }
      }
    },
    lunokhod: function (c, q, t) {
      bg(c, t * 0.5);
      earth(c, W * 0.82, H * 0.15, L.S * 3.6, t);
      var gy = L.portrait ? H * 0.5 : H * 0.68, pan = q * L.S * 30;
      ground(c, gy, pan, 1, { hills: 3 });
      var px = L.portrait ? W * 0.18 : L.fx - L.S * 22, s = L.S * 1.5;
      c.save(); c.translate(-pan * 0.6, 0);
      smallLander(c, px, gy + L.S * 6, s * 1.2, false);
      c.fillStyle = '#7c818a'; poly(c, [px + s * 1.6, gy + L.S * 6 - s * 1.6, px + s * 5.2, gy + L.S * 6, px + s * 4.6, gy + L.S * 6, px + s * 1.4, gy + L.S * 6 - s * 1.3], '#8a8f98');
      c.restore();
      var dk = sm(0.08, 1, q), rx = lerp(px + s * 3, px + s * 3 + L.S * 46, dk) - pan * 0.6, ry = gy + L.S * 7 - (q < 0.15 ? (1 - q / 0.15) * s * 1.4 : 0);
      c.fillStyle = 'rgba(40,38,36,0.35)';   // wheel tracks
      c.fillRect(px + s * 3 - pan * 0.6, gy + L.S * 7 - s * 0.1, rx - (px + s * 3 - pan * 0.6), s * 0.18);
      lunokhod(c, rx, ry, s, t * (q > 0.05 ? 1 : 0), 0.15);
    },
    apollo17: function (c, q, t) {
      bg(c, t * 0.3);
      earth(c, L.portrait ? W * 0.75 : W * 0.7, H * 0.14, L.S * 3.4, t);
      var gy = L.portrait ? H * 0.5 : H * 0.62, pan = q * L.S * 40;
      ground(c, gy, pan, 1, { hills: 16, hillCol: '#3d3c43', hillLit: true });
      c.save(); c.translate(W * 0.15 - pan * 0.3, 0); lm(c, 0, gy + L.S * 3, L.S * 0.55); c.restore();
      var vx = (L.portrait ? W * 0.62 : L.fx + L.S * 6) - q * L.S * 10, vy = gy + L.S * 12, s = L.S * 1.25;
      if (!REDUCE) for (var i = 0; i < 16; i++) {   // rooster-tail dust from the rear wheel, ballistic arcs
        var a = ((t * 1.6 + i / 16) % 1), bx = vx + s * 2.4 + a * L.S * 9, by = vy - s * 0.4 - Math.sin(a * Math.PI) * L.S * 4 * (0.6 + (i % 3) * 0.2);
        c.fillStyle = 'rgba(200,190,175,' + (0.45 * (1 - a)).toFixed(3) + ')'; c.fillRect(bx, by, L.S * 0.4, L.S * 0.3);
      }
      lrv(c, vx, vy, s, t);
    },
    lcross: function (c, q, t) {
      bg(c, t * 0.5);
      var R = Math.max(W, H) * 1.25, cx = W * 0.5, top = L.portrait ? H * 0.36 : H * 0.48;
      var g = c.createRadialGradient(cx - R * 0.3, top - R * 0.2, R * 0.2, cx, top + R, R);
      g.addColorStop(0, '#d6d0c4'); g.addColorStop(0.5, '#9a958c'); g.addColorStop(1, '#3a3936');
      c.fillStyle = g; c.beginPath(); c.arc(cx, top + R, R, 0, 6.2832); c.fill();
      var kx = L.portrait ? W * 0.55 : L.fx, ky = top + L.S * 10;   // Cabeus crater: permanently shadowed floor
      c.fillStyle = '#0d0e12'; c.beginPath(); c.ellipse(kx, ky, L.S * 12, L.S * 3, 0, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(240,230,210,0.35)'; c.lineWidth = L.S * 0.5; c.beginPath(); c.ellipse(kx, ky, L.S * 12, L.S * 3, 0, 3.4, 6.1); c.stroke();
      var ox = lerp(-W * 0.05, W * 1.05, (q * 0.85 + 0.05)), oy = top - L.S * 14;   // LRO passes over, firing laser pulses
      if (!REDUCE) for (var i = 0; i < 6; i++) { var k = ((t * 2 + i / 6) % 1); c.fillStyle = 'rgba(120,255,160,' + (0.8 * (1 - k)).toFixed(3) + ')'; c.fillRect(ox - L.S * 0.15, lerp(oy + L.S, top + L.S * 2, k), L.S * 0.3, L.S * 0.8); }
      c.strokeStyle = 'rgba(120,255,160,0.35)'; c.lineWidth = L.S * 0.2; c.beginPath();   // mapped track
      c.moveTo(-W * 0.05, top + L.S * 2.2); c.lineTo(ox, top + L.S * 2.2); c.stroke();
      lro(c, ox, oy, L.S * 0.9);
      var hk = 0.5, imp = clamp(q / hk, 0, 1);   // Centaur impactor
      if (imp < 1) {
        var ix = lerp(kx - L.S * 30, kx, imp), iy = lerp(-H * 0.05, ky, imp);
        c.strokeStyle = 'rgba(255,214,150,0.6)'; c.lineWidth = L.S * 0.3; c.beginPath(); c.moveTo(ix - L.S * 6, iy - L.S * 6 * (ky + H * 0.05) / (L.S * 30)); c.lineTo(ix, iy); c.stroke();
        rect(c, ix - L.S * 0.6, iy - L.S * 0.6, L.S * 1.2, L.S * 1.2, '#dfe2e7');
      } else {
        var p = clamp((q - hk) / 0.45, 0, 1);
        var fl = c.createRadialGradient(kx, ky, 0, kx, ky, L.S * 6); fl.addColorStop(0, 'rgba(255,240,210,' + (0.9 * (1 - p * 3 > 0 ? 1 - p * 3 : 0)).toFixed(3) + ')'); fl.addColorStop(1, 'rgba(255,200,120,0)');
        c.fillStyle = fl; c.beginPath(); c.arc(kx, ky, L.S * 6, 0, 6.2832); c.fill();
        for (var j = 0; j < 40; j++) {   // ejecta plume rising into sunlight, with blue sparkles for water
          var a = -Math.PI / 2 + (j / 39 - 0.5) * 1.2, v = L.S * (8 + (j * 37 % 11)), d = v * p * 2.2, gy2 = p * p * L.S * 10;
          var px = kx + Math.cos(a) * d, py = ky + Math.sin(a) * d + gy2;
          c.fillStyle = j % 3 === 0 ? 'rgba(140,200,255,' + (0.9 * (1 - p)).toFixed(3) + ')' : 'rgba(220,210,190,' + (0.6 * (1 - p)).toFixed(3) + ')';
          c.fillRect(px, py, L.S * 0.45, L.S * 0.45);
        }
      }
    },
    change4: function (c, q, t) {
      bg(c, t * 0.4);
      var gy = L.portrait ? H * 0.5 : H * 0.66;
      ground(c, gy, q * L.S * 10, 0.95, { hills: 7, hillCol: '#36353b' });
      var qx = W * 0.2 + q * L.S * 6, qy = H * 0.14;   // relay satellite beyond the far side, linking to Earth (out of view)
      c.fillStyle = '#d7dae0'; c.fillRect(qx - L.S * 0.6, qy - L.S * 0.6, L.S * 1.2, L.S * 1.2);
      c.fillStyle = '#eef0f3'; c.beginPath(); c.arc(qx + L.S * 1.2, qy, L.S * 1.3, 1.6, 4.7); c.fill();
      var lx = L.portrait ? W * 0.38 : L.fx - L.S * 8, ly = gy + L.S * 8, s = L.S * 1.4;
      if (!REDUCE) for (var i = 0; i < 5; i++) { var k = ((t * 0.8 + i / 5) % 1); c.fillStyle = 'rgba(255,214,150,' + (0.7 * Math.sin(k * Math.PI)).toFixed(3) + ')'; c.fillRect(lerp(lx, qx, k), lerp(ly - s * 3, qy, k), L.S * 0.4, L.S * 0.4); }
      smallLander(c, lx, ly, s, true);
      rect(c, lx - s * 4.2, ly - s * 2.7, s * 2.6, s * 0.2, '#2a4a8c'); rect(c, lx + s * 1.6, ly - s * 2.7, s * 2.6, s * 0.2, '#2a4a8c');
      poly(c, [lx + s * 1.4, ly - s * 1.4, lx + s * 3.6, ly, lx + s * 3.2, ly, lx + s * 1.3, ly - s * 1.1], '#9aa0aa');   // ramp
      var dk = sm(0.15, 1, q), rx = lerp(lx + s * 1.6, lx + s * 1.6 + L.S * 28, dk), ry = ly + L.S * 2 * dk - (q < 0.3 ? (1 - q / 0.3) * s * 1.2 : 0);
      c.fillStyle = 'rgba(40,38,36,0.3)'; c.fillRect(lx + s * 3.6, ly + L.S * 0.1, Math.max(0, rx - lx - s * 3.6), s * 0.12);
      smallRover(c, rx, ry, s * 0.9, t, true);
    },
    chandrayaan3: function (c, q, t) {
      bg(c, t * 0.4, { sunGlow: false });
      var gy = L.portrait ? H * 0.5 : H * 0.66;
      var sx = W * 0.04, sg = c.createRadialGradient(sx, gy - L.S, 0, sx, gy - L.S, Math.max(W, H) * 0.8);   // low Sun skimming the horizon
      sg.addColorStop(0, 'rgba(255,214,140,0.55)'); sg.addColorStop(0.15, 'rgba(255,180,90,0.18)'); sg.addColorStop(1, 'rgba(255,170,70,0)');
      c.fillStyle = sg; c.fillRect(0, 0, W, H);
      ground(c, gy, t * L.S, 0.75, { hills: 9, hillCol: '#2c2b31', hillLit: true });
      var land = 0.42, k = Math.min(q / land, 1), lx = L.portrait ? W * 0.55 : L.fx, s = L.S * 1.4;
      var ly = lerp(-H * 0.05, gy + L.S * 7, sm(0, 1, k));
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.moveTo(lx - s * 2, gy + L.S * 7); c.lineTo(lx + s * 2, gy + L.S * 7); c.lineTo(lx + s * 18 * (k >= 1 ? 1 : 0.2), gy + L.S * 7.6); c.lineTo(lx - s * 0, gy + L.S * 7.8); c.closePath(); c.fill();   // long shadow
      if (k < 1) { for (var e = -1; e <= 1; e += 2) flame(c, lx + e * s * 0.8, ly - s * 1.4, s * 0.5, s * 1.6, t + e); dust(c, lx, gy + L.S * 7, t, clamp((k - 0.55) / 0.45, 0, 1), L.S * 16); }
      else dust(c, lx, gy + L.S * 7, t, clamp(1 - (q - land) / 0.1, 0, 1), L.S * 16);
      smallLander(c, lx, ly, s, true);
      rect(c, lx - s * 1.5, ly - s * 3.8, s * 0.2, s * 0.9, '#2a4a8c');
      if (k >= 1) {
        var r = sm(land + 0.08, land + 0.2, q);
        poly(c, [lx + s * 1.5, ly - s * 1.5, lx + s * 1.5 + s * 2.4 * r, ly - s * 1.5 + s * 1.5 * r, lx + s * 1.5 + s * 2.4 * r, ly - s * 1.35 + s * 1.5 * r, lx + s * 1.5, ly - s * 1.35], '#a4a8b0');
        var dk = sm(land + 0.2, 1, q);
        if (dk > 0) smallRover(c, lerp(lx + s * 3.4, lx + s * 3.4 + L.S * 18, dk), ly, s * 0.7, t, true);
      }
    },
    wave2024: function (c, q, t) {
      bg(c, t * 0.5);
      var mx = L.portrait ? W * 0.5 : L.fx, my = L.portrait ? H * 0.38 : L.fy, mr = L.S * (L.portrait ? 22 : 26);
      earth(c, L.portrait ? W * 0.12 : W * 0.1, L.portrait ? H * 0.1 : H * 0.15, L.S * 3.5, t);
      moon(c, mx, my, mr, -0.7, -0.5, t * 0.04);
      var pts = [{ n: 'SLIM', a: -2.6, rr: 0.55, at: 0.1 }, { n: 'IM-1', a: 1.75, rr: 0.88, at: 0.3 }, { n: "Chang'e 6", a: -0.6, rr: 0.7, at: 0.5 }];
      c.font = Math.round(L.S * 1.7) + 'px system-ui, sans-serif'; c.textBaseline = 'middle';
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], k = sm(p.at, p.at + 0.18, q), px = mx + Math.cos(p.a) * mr * p.rr, py = my + Math.sin(p.a) * mr * p.rr;
        if (k <= 0) continue;
        var ox = px + Math.cos(p.a) * mr * 0.9 * (1 - k), oy = py + Math.sin(p.a) * mr * 0.9 * (1 - k);
        c.strokeStyle = 'rgba(255,214,150,' + (0.5 * (1 - k)).toFixed(3) + ')'; c.lineWidth = L.S * 0.2; c.beginPath(); c.moveTo(px + Math.cos(p.a) * mr * 0.9, py + Math.sin(p.a) * mr * 0.9); c.lineTo(ox, oy); c.stroke();
        var pulse = REDUCE ? 0.5 : (t * 0.8 + i * 0.3) % 1;
        c.strokeStyle = 'rgba(255,200,110,' + (0.6 * (1 - pulse) * k).toFixed(3) + ')'; c.beginPath(); c.arc(px, py, L.S * (0.8 + pulse * 3), 0, 6.2832); c.stroke();
        c.fillStyle = 'rgba(255,226,170,' + k.toFixed(3) + ')'; c.beginPath(); c.arc(ox, oy, L.S * 0.6, 0, 6.2832); c.fill();
        c.fillStyle = 'rgba(235,240,250,' + (k * 0.9).toFixed(3) + ')'; c.textAlign = Math.cos(p.a) < 0 ? 'right' : 'left';
        c.fillText(p.n, px + (Math.cos(p.a) < 0 ? -1 : 1) * L.S * 2.4, py);
      }
      var rk = sm(0.7, 1, q);   // Chang'e 6 sample capsule heading home
      if (rk > 0) {
        var p2 = pts[2], sx = mx + Math.cos(p2.a) * mr * p2.rr, sy = my + Math.sin(p2.a) * mr * p2.rr, ex = L.portrait ? W * 0.12 : W * 0.1, ey = L.portrait ? H * 0.1 : H * 0.15;
        var bx = lerp(sx, ex, rk), by = lerp(sy, ey, rk) - Math.sin(rk * Math.PI) * mr * 0.6;
        c.strokeStyle = 'rgba(255,214,150,0.4)'; c.setLineDash([L.S * 0.6, L.S * 0.6]); c.beginPath(); c.moveTo(sx, sy);
        for (var j = 1; j <= 12; j++) { var kk = rk * j / 12; c.lineTo(lerp(sx, ex, kk), lerp(sy, ey, kk) - Math.sin(kk * Math.PI) * mr * 0.6); }
        c.stroke(); c.setLineDash([]);
        c.fillStyle = '#ffe6b0'; c.beginPath(); c.arc(bx, by, L.S * 0.55, 0, 6.2832); c.fill();
      }
    },
    artemis2: function (c, q, t) {
      var cut = 0.34;
      if (q < cut) {   // launch
        var k = q / cut, alt = sm(0, 1, k);
        bg(c, t * 0.2, { top: 'rgb(' + Math.round(lerp(18, 6, alt)) + ',' + Math.round(lerp(34, 10, alt)) + ',' + Math.round(lerp(72, 20, alt)) + ')', bot: '#2b3a5c' });
        var gy = H * 0.9 + alt * H * 0.5;
        c.fillStyle = '#0e1524'; c.fillRect(0, gy, W, H);
        var rx = L.portrait ? W * 0.5 : L.fx, ry = gy - L.S * 1 - alt * H * 0.35, s = L.S * 1.15;
        rect(c, rx - s * 6, gy - s * 20, s * 1.4, s * 20, '#1c2638');   // tower
        plume(c, rx, ry + s * 4, t, 22, s * 3, s * 22, '240,236,228');
        sls(c, rx, ry, s, t, true);
        var fl = 1 - sm(0.85, 1, k); c.fillStyle = 'rgba(255,240,215,' + ((1 - fl) * 0.85).toFixed(3) + ')'; c.fillRect(0, 0, W, H);   // light cut
        return;
      }
      var k2 = (q - cut) / (1 - cut);
      bg(c, t * 0.4);
      var ex = L.portrait ? W * 0.3 : W * 0.24, ey = L.portrait ? H * 0.36 : H * 0.48, mx = L.portrait ? W * 0.74 : W * 0.78, my = ey - L.S * 2;
      earth(c, ex, ey, L.S * (L.portrait ? 7 : 9), t);
      moon(c, mx, my, L.S * (L.portrait ? 3.6 : 4.5));
      var path = function (s) {   // free-return figure-eight (illustrative, not to scale)
        var a = s * Math.PI * 2;
        return [lerp(ex, mx, 0.5) + Math.sin(a) * (mx - ex) * 0.58, ey - L.S + Math.sin(a * 2) * L.S * (L.portrait ? 7 : 9)];
      };
      c.strokeStyle = 'rgba(255,214,150,0.35)'; c.lineWidth = L.S * 0.2; c.setLineDash([L.S * 0.7, L.S * 0.7]); c.beginPath();
      for (var i = 0; i <= 80; i++) { var p = path(-0.25 + i / 80); if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); } c.stroke(); c.setLineDash([]);
      var s0 = -0.25 + 0.15 + k2 * 0.85, pp = path(s0), pn = path(s0 + 0.01);
      orion(c, pp[0], pp[1], L.S * 0.9, Math.atan2(pn[1] - pp[1], pn[0] - pp[0]));
      var fl2 = 1 - sm(0, 0.12, k2); if (fl2 > 0) { c.fillStyle = 'rgba(255,240,215,' + (fl2 * 0.85).toFixed(3) + ')'; c.fillRect(0, 0, W, H); }
    },
    artemis4: function (c, q, t) {
      bg(c, t * 0.4, { sunGlow: false });
      var gy = L.portrait ? H * 0.5 : H * 0.64;
      earth(c, L.portrait ? W * 0.78 : W * 0.74, gy - L.S * 3, L.S * 3.2, t, -0.9, 0);   // Earth low on the horizon near the pole
      var sg = c.createRadialGradient(0, gy, 0, 0, gy, Math.max(W, H) * 0.9);
      sg.addColorStop(0, 'rgba(255,214,140,0.5)'); sg.addColorStop(0.2, 'rgba(255,180,90,0.12)'); sg.addColorStop(1, 'rgba(255,170,70,0)');
      c.fillStyle = sg; c.fillRect(0, 0, W, H);
      ground(c, gy, t * L.S * 0.8, 0.72, { hills: 11, hillCol: '#29282e', hillLit: true });
      var land = 0.34, k = Math.min(q / land, 1), lx = L.portrait ? W * 0.36 : L.fx - L.S * 6, s = L.S * 1.05;
      var ly = lerp(-H * 0.3, gy + L.S * 8, sm(0, 1, k));
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.moveTo(lx - s * 2, gy + L.S * 8); c.lineTo(lx + s * 2, gy + L.S * 8); c.lineTo(lx + s * 40 * (k >= 1 ? 1 : 0.1), gy + L.S * 9); c.closePath(); c.fill();
      if (k < 1) { flame(c, lx, ly - s * 1.4, s * 1.4, s * 3, t); dust(c, lx, gy + L.S * 8, t, clamp((k - 0.5) / 0.5, 0, 1), L.S * 24); }
      else dust(c, lx, gy + L.S * 8, t, clamp(1 - (q - land) / 0.15, 0, 1), L.S * 24);
      bigLander(c, lx, ly, s, k);
      if (q > land + 0.08) {
        var a = sm(land + 0.08, land + 0.24, q);
        c.save(); c.globalAlpha = a;
        astronaut(c, lx + s * 5 + a * s * 3, gy + L.S * 9, s * 5.5, t * 3 * (REDUCE ? 0 : 1), 1);
        astronaut(c, lx + s * 9 + a * s * 4, gy + L.S * 9.4, s * 5.6, t * 3 * (REDUCE ? 0 : 1) + 1.5, 1);
        c.restore();
      }
    }
  };

  // ------------------------------------------------------------------ frame rendering
  function layout() {
    var r = cv.getBoundingClientRect(), cw = Math.max(1, r.width), ch = Math.max(1, r.height);
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.round(cw * DPR); H = Math.round(ch * DPR);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    var portrait = ch > cw * 1.05;
    L = { portrait: portrait, S: (portrait ? Math.min(W, H * 0.62) : Math.min(W * 0.62, H)) / 70, fx: portrait ? W * 0.5 : W * 0.64, fy: portrait ? H * 0.36 : H * 0.46 };
    vign = null;
  }
  function makeGrain() {
    var g = document.createElement('canvas'); g.width = g.height = 128;
    var c2 = g.getContext('2d'), im = c2.createImageData(128, 128), r = rng(99);
    for (var i = 0; i < im.data.length; i += 4) { var v = Math.floor(r() * 255); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 18; }
    c2.putImageData(im, 0, 0);
    grainPat = ctx.createPattern(g, 'repeat');
  }
  function drawScene(idx, q, t) {
    ctx.save();
    try { SCENES[CHAPTERS[idx].id](ctx, q, t); } finally { ctx.restore(); }
  }
  function render() {
    if (!ctx) return;
    var q = st / STT, k = from ? (REDUCE ? sm(0, TIN, u) : sm(0, TIN, u)) : 1, pan = REDUCE ? 0 : W * 0.12;
    ctx.save();
    if (k < 1) ctx.translate((1 - k) * pan, 0);
    drawScene(ci, q, st + ci * 7);
    ctx.restore();
    if (from && k < 1) {
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.translate(-k * pan, 0);
      drawScene(from.ci, from.st / STT, from.st + from.ci * 7);
      ctx.restore();
      if (!REDUCE) {   // warm light sweep across the cut
        var sx = lerp(-W * 0.4, W * 1.4, k), g = ctx.createLinearGradient(sx - W * 0.25, 0, sx + W * 0.25, H * 0.2);
        g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(0.5, 'rgba(255,214,150,' + (0.28 * Math.sin(k * Math.PI)).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }
    if (from && k >= 1) from = null;
    if (!vign) { vign = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vign.addColorStop(0, 'rgba(0,0,0,0)'); vign.addColorStop(1, 'rgba(0,0,0,0.55)'); }
    ctx.fillStyle = vign; ctx.fillRect(0, 0, W, H);
    if (grainPat) {   // subtle film grain
      ctx.save(); var o = REDUCE ? 0 : (frames * 37) % 128; ctx.translate(o, (frames * 71) % 128); ctx.fillStyle = grainPat; ctx.fillRect(-o, -((frames * 71) % 128), W, H); ctx.restore();
    }
    updateCaption();
    frames++;
  }
  function capAlpha() {
    if (ended) return 0;
    if (u < CAP_IN[0]) return 0;
    if (u < CAP_IN[1]) return sm(CAP_IN[0], CAP_IN[1], u);
    if (ci === CHAPTERS.length - 1) return u < END_AT ? 1 : 1 - sm(END_AT, END_AT + 0.3, u);
    if (u < CAP_OUT[0]) return 1;
    return 1 - sm(CAP_OUT[0], CAP_OUT[1], u);
  }
  function updateCaption() {
    var a = capAlpha(), y = (1 - a) * (REDUCE ? 0 : (u < 2.5 ? 14 : -10));
    var key = a.toFixed(2) + '|' + y.toFixed(1);
    if (key !== capState) {
      capState = key;
      ui.cap.style.opacity = a.toFixed(2);
      ui.cap.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
      ui.cap.style.visibility = a > 0.01 ? 'visible' : 'hidden';
    }
  }

  function advance(dt) {
    var last = ci === CHAPTERS.length - 1;
    curSpeed = ended ? SLOW * RMF : speedAt(Math.min(u, D));
    u += dt; st += dt * curSpeed;
    if (from) from.st += dt * from.sp;
    if (last && u >= END_AT) {
      if (!ended) { ended = true; showEnd(true); }
      u = Math.min(u, END_AT + 0.4);
    }
    if (!last && u >= D) go(ci + 1, true);
  }
  function loop(ts) {
    raf = 0;
    if (!isOpen || !playing) return;
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
    advance(dt);
    render();
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (isOpen && playing && !raf && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function renderOnce() { if (isOpen && !raf) render(); }

  function go(k, natural) {
    k = clamp(k, 0, CHAPTERS.length - 1);
    from = { ci: ci, st: st, sp: natural ? speedAt(D) : 1 };
    if (k === ci && !natural) from = null;
    ci = k; u = natural ? Math.max(0, u - D) : 0; st = 0;
    if (ended) { ended = false; showEnd(false); }
    setCaption();
    renderOnce();
  }
  function setCaption() {
    var ch = CHAPTERS[ci];
    ui.year.textContent = ch.year; ui.title.textContent = ch.title; ui.text.textContent = ch.text;
    ui.flags.textContent = ''; ch.flags.forEach(function (f) { ui.flags.appendChild(flagChip(f)); });
    capState = '';
    ui.strip.querySelectorAll('button').forEach(function (b, i) { b.classList.toggle('on', i === ci); if (i === ci) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    var cur = ui.strip.children[ci]; if (cur && cur.scrollIntoView && ui.strip.scrollWidth > ui.strip.clientWidth) { var sl = cur.offsetLeft - ui.strip.clientWidth / 2 + cur.offsetWidth / 2; ui.strip.scrollLeft = sl; }
  }
  function showEnd(on) {
    ui.end.hidden = !on;
    ui.play.innerHTML = on ? '&#8635;' : (playing ? '&#10073;&#10073;' : '&#9654;');
    ui.play.setAttribute('aria-label', on ? 'Replay from the start' : (playing ? 'Pause' : 'Play'));
  }
  function setPlaying(p) {
    playing = p;
    if (!ended) { ui.play.innerHTML = p ? '&#10073;&#10073;' : '&#9654;'; ui.play.setAttribute('aria-label', p ? 'Pause' : 'Play'); }
    el.classList.toggle('paused', !p);
    if (p) kick(); else { stop(); curSpeed = 0; }
  }
  function togglePlay() {
    if (ended) { go(0, false); from = null; setPlaying(true); return; }
    setPlaying(!playing);
  }

  // ------------------------------------------------------------------ DOM
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function build() {
    el = h('div', 'cap-overlay'); el.id = 'capsule'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Historical Capsule');
    cv = h('canvas', 'cap-canvas'); cv.setAttribute('aria-hidden', 'true'); el.appendChild(cv);
    var scrim = h('div', 'cap-scrim'); scrim.setAttribute('aria-hidden', 'true'); el.appendChild(scrim);
    var banner = h('div', 'cap-banner', BANNER); el.appendChild(banner);
    var top = h('div', 'cap-top');
    ui.src = h('button', 'cap-btn cap-srcbtn'); ui.src.type = 'button'; ui.src.innerHTML = '<span aria-hidden="true">i</span> Sources'; ui.src.setAttribute('aria-expanded', 'false'); ui.src.setAttribute('aria-controls', 'capSources');
    ui.x = h('button', 'cap-btn cap-x'); ui.x.type = 'button'; ui.x.innerHTML = '&times;'; ui.x.setAttribute('aria-label', 'Close the Historical Capsule');
    top.appendChild(ui.src); top.appendChild(ui.x); el.appendChild(top);
    ui.cap = h('div', 'cap-caption'); ui.cap.setAttribute('aria-live', 'polite');
    ui.year = h('div', 'cap-year'); ui.title = h('div', 'cap-title'); ui.flags = h('div', 'cap-flags'); ui.text = h('p', 'cap-text');
    ui.cap.appendChild(ui.year); ui.cap.appendChild(ui.title); ui.cap.appendChild(ui.text); ui.cap.appendChild(ui.flags);
    el.appendChild(ui.cap);
    ui.end = h('div', 'cap-end'); ui.end.hidden = true;
    ui.end.appendChild(h('div', 'cap-endtitle', END_TITLE));
    ui.endBtn = h('button', 'cap-endbtn', END_BTN); ui.endBtn.type = 'button'; ui.end.appendChild(ui.endBtn);
    el.appendChild(ui.end);
    var bar = h('div', 'cap-bar');
    ui.prev = h('button', 'cap-btn cap-nav'); ui.prev.type = 'button'; ui.prev.innerHTML = '&#9664;&#9664;'; ui.prev.setAttribute('aria-label', 'Previous milestone');
    ui.play = h('button', 'cap-btn cap-play'); ui.play.type = 'button';
    ui.next = h('button', 'cap-btn cap-nav'); ui.next.type = 'button'; ui.next.innerHTML = '&#9654;&#9654;'; ui.next.setAttribute('aria-label', 'Next milestone');
    ui.strip = h('div', 'cap-strip'); ui.strip.setAttribute('role', 'group'); ui.strip.setAttribute('aria-label', 'Milestones');
    CHAPTERS.forEach(function (chp, i) { var b = h('button', 'cap-year-btn', chp.year); b.type = 'button'; b.setAttribute('aria-label', chp.year + ': ' + chp.title); b.title = chp.title; b.addEventListener('click', function () { go(i, false); if (!playing) setPlaying(true); }); ui.strip.appendChild(b); });
    bar.appendChild(ui.prev); bar.appendChild(ui.play); bar.appendChild(ui.next); bar.appendChild(ui.strip);
    el.appendChild(bar);
    ui.panel = h('div', 'cap-sources'); ui.panel.id = 'capSources'; ui.panel.hidden = true; ui.panel.setAttribute('role', 'region'); ui.panel.setAttribute('aria-label', 'Sources');
    var ph = h('div', 'cap-srchead'); ph.appendChild(h('h2', '', 'Sources'));
    ui.srcClose = h('button', 'cap-btn'); ui.srcClose.type = 'button'; ui.srcClose.textContent = 'Close'; ph.appendChild(ui.srcClose);
    ui.panel.appendChild(ph);
    var ol = h('ol', 'cap-srclist');
    CHAPTERS.forEach(function (chp) {
      var li = h('li'); li.appendChild(h('b', '', chp.year + ' ' + chp.title + ': '));
      chp.src.forEach(function (s, j) { if (j) li.appendChild(document.createTextNode('; ')); var a = h('a', '', s[0]); a.href = s[1]; a.target = '_blank'; a.rel = 'noopener'; li.appendChild(a); });
      ol.appendChild(li);
    });
    ui.panel.appendChild(ol);
    ui.panel.appendChild(h('p', 'cap-note', 'Spacecraft, rockets, people and places are simplified illustrations with approximate proportions; distances, sizes and trajectories are not to scale. Details and the verified wording for each milestone: docs/HISTORICAL_CAPSULE.md (in the project repository).'));
    ui.panel.appendChild(h('p', 'cap-credit', CREDIT));
    el.appendChild(ui.panel);

    ui.play.addEventListener('click', togglePlay);
    ui.prev.addEventListener('click', function () { go(ci - 1, false); if (!playing) setPlaying(true); });
    ui.next.addEventListener('click', function () { if (ci < CHAPTERS.length - 1) { go(ci + 1, false); if (!playing) setPlaying(true); } });
    ui.x.addEventListener('click', function () { close(); });
    ui.src.addEventListener('click', function () { toggleSources(); });
    ui.srcClose.addEventListener('click', function () { toggleSources(false); });
    ui.endBtn.addEventListener('click', function () {
      close(true);
      var t = document.querySelector('.tab[data-page="explorer"]'); if (t) t.click();
      window.scrollTo(0, 0);
      var m = document.getElementById('lmap'); if (t) t.focus(); else if (m) m.focus();
    });
    el.addEventListener('keydown', onKey);
    document.body.appendChild(el);
    ctx = cv.getContext('2d');
    stars = makeStars(); makeGrain();
  }
  var wasPlayingBeforeSources = false;
  function toggleSources(on) {
    if (on === undefined) on = ui.panel.hidden;
    ui.panel.hidden = !on; ui.src.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) { wasPlayingBeforeSources = playing; if (playing) setPlaying(false); ui.srcClose.focus(); }
    else { if (wasPlayingBeforeSources) setPlaying(true); ui.src.focus(); }
  }
  function focusables() { return Array.prototype.filter.call(el.querySelectorAll('button, a[href]'), function (b) { return b.offsetParent !== null && !b.disabled; }); }
  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); if (!ui.panel.hidden) toggleSources(false); else close(); return; }
    if (e.key === 'Tab') {   // focus trap
      var f = focusables(); if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
      return;
    }
    if (!ui.panel.hidden) return;
    var tg = e.target, onOtherBtn = tg && (tg.tagName === 'BUTTON' || tg.tagName === 'A') && tg !== ui.play;
    if ((e.key === ' ' || e.key === 'Spacebar') && !onOtherBtn) { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (ci < CHAPTERS.length - 1) go(ci + 1, false); if (!playing) setPlaying(true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(ci - 1, false); if (!playing) setPlaying(true); }
  }
  function onVis() { if (document.hidden) stop(); else kick(); }
  function onResize() { if (!isOpen) return; layout(); renderOnce(); }
  function on(target, ev, fn) { target.addEventListener(ev, fn); listeners.push([target, ev, fn]); }

  function open(btn) {
    if (isOpen) return;
    opener = btn || document.activeElement;
    saved = { x: window.scrollX, y: window.scrollY, hash: location.hash };
    if (!el) build();
    isOpen = true; ended = false; from = null; ci = 0; u = 0; st = 0; frames = 0;
    ui.end.hidden = true; ui.panel.hidden = true; ui.src.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.add('capsule-open');
    el.hidden = false; el.classList.add('on');
    if (opener && opener.setAttribute) opener.setAttribute('aria-expanded', 'true');
    if (opener && opener.classList) opener.classList.add('open');
    on(document, 'visibilitychange', onVis); on(window, 'resize', onResize);
    layout(); setCaption();
    setPlaying(true);
    render();   // first frame immediately
    ui.play.focus({ preventScroll: true });
  }
  function close(keepFocus) {
    if (!isOpen) return;
    isOpen = false; stop(); playing = false; curSpeed = 0;
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2]); }); listeners = [];
    el.classList.remove('on'); el.hidden = true;
    document.documentElement.classList.remove('capsule-open');
    if (opener && opener.setAttribute) opener.setAttribute('aria-expanded', 'false');
    if (opener && opener.classList) opener.classList.remove('open');
    if (saved) {
      if (location.hash !== saved.hash) { try { history.replaceState(null, '', saved.hash || location.pathname + location.search); } catch (e) { /* ignore */ } }
      window.scrollTo(saved.x, saved.y);
    }
    if (!keepFocus && opener && opener.focus) opener.focus({ preventScroll: true });
  }

  return {
    open: open, close: close, isOpen: function () { return isOpen; },
    chapters: CHAPTERS, banner: BANNER, credit: CREDIT, endTitle: END_TITLE, endButton: END_BTN,
    // test hooks (read-only state)
    _state: function () { return { open: isOpen, playing: playing, ended: ended, chapter: ci, u: u, speed: curSpeed, frames: frames, raf: !!raf, reduce: REDUCE, transition: !!from }; },
    _go: function (k) { go(k, false); },
    _flag: flag
  };
})();
