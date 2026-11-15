/* ASTERIA 3D terrain view ("Deploy"). Loaded lazily by js/app.js only when the user clicks Deploy, together with
 * lib/three/three.min.js, js/view3d_math.js and data/terrain3d/<site>.js. Nothing here runs before that.
 * Generated with Claude Code (Anthropic) under human direction.
 *
 * What is shown, and on what basis:
 *  - Terrain: the site's 6 km LOLA tile (tools/terrain3d.py) at true scale (vertical exaggeration selectable,
 *    default 1x), exact ENU positions including lunar curvature.
 *  - Sun: directional light + disk at the engine's azimuth/elevation (js/engine.js, validated against JPL Horizons),
 *    angular radius from the engine. Earth: sphere at the engine's azimuth/elevation with the engine's angular radius;
 *    its lit side comes from the same Sun direction (phase computed from real geometry, see earthPhase()).
 *  - Distant skyline: the site's terrain horizon mask (data/horizons) drawn as a ring, exact from the site marker.
 *  - Shadows: shadow mapping of the tile only (visual approximation). Sunlit / Earth-visible status at the site marker
 *    comes from the validated horizon model of the main app, never from the rendering.
 */
window.AsteriaView3D = (function () {
  'use strict';
  var M = window.AsteriaView3DMath;
  var SHADOW_BIAS_M = 3;
  var FILL = 0.05, LIGHT_UP = 3;   // fill-light intensity at brightness 1; brightness used by "Light up"
  var RING_M = 60000, SUN_D = 500000, EARTH_D = 450000, STAR_D = 800000, EYE_M = 2;   // eye = horizon-model observer height
  // Rover model (round 6): NASA VIPER proportions. Published (NASA VIPER "Rover and Instruments" page): height 2.5 m,
  // length 1.5 m, width 1.5 m, four wheel modules. Approximate (not published there): every other size below.
  var ROVER = { height: 2.5, length: 1.5, width: 1.5,
    wheelR: 0.25, wheelW: 0.2, clear: 0.45, bodyH: 0.45, bodyW: 1.1, bodyL: 1.1, panelH: 0.8, headH: 0.18,
    wheels: [[-0.65, -0.5], [0.65, -0.5], [-0.65, 0.5], [0.65, 0.5]] };   // wheel centres: x right, z back (m)
  var V = null;           // current view (null when closed)
  var TILE_CACHE = {};    // decoded tiles by site id (re-opening or changing quality does not decode again)
  var lastClosed = null;  // stats captured while closing (tests)
  var HOVER = { on: false };   // round 6B: "Inspect on hover" (off by default; kept while the page stays open)
  // round 6B: cast shadows are off by default in every mode; the user's choice is kept while the page stays open
  // (this session only, not stored on the device). Display only: no status, readout or Sun/Earth position depends on it.
  var SESSION = { shadows: false, ao: null, cover: true };
  // round 6E: close-range surface texture (Illustrative, display only; Walk and Rover): full strength to COVER_NEAR m from
  // the camera, faded to zero at COVER_FAR m; octaves of the fine pattern (laptop Medium/High, Low or phones)
  // round 6F: the distance fade is measured from the camera (it travels with the viewer); no cut-off near the viewer any
  // more - each octave and feature fades only by its own screen-space size, and the whole covering fades gently between
  // COVER_NEAR and COVER_FAR m. COVER_RMAX: largest craterlet radius (m), below the DEM grid scale.
  var COVER_NEAR = 1500, COVER_FAR = 2000, COVER_OCT = 7, COVER_OCT_LOW = 5, COVER_RMAX = 5;
  // round 6F: feature classes [cell size C (m), probability per cell, radius min, radius max (m), seed (also the lattice
  // rotation, rad), kind (0 craterlet, 1 rock fleck)]: four craterlet classes and the larger fleck class everywhere, then
  // (laptops at Medium/High only) two overlapping craterlet lattices and the small fleck class
  var COVER_CLASSES = [[30, 0.18, 2.0, COVER_RMAX, 11, 0], [12, 0.22, 0.8, 2.5, 23, 0], [4.5, 0.30, 0.3, 1.0, 37, 0], [1.4, 0.38, 0.1, 0.3, 53, 0],
    [3.0, 0.05, 0.12, 0.4, 71, 1], [14, 0.12, 0.8, 2.5, 29, 0], [5.0, 0.15, 0.3, 1.0, 43, 0], [0.8, 0.06, 0.04, 0.12, 89, 1]], COVER_CLASSES_LOW = 5;
  // round 6E Part 2: wheel tracks (Illustrative): the rover's path this session, one point every WHEEL_STEP m, the last
  // WHEEL_N points (about 250 m of path), drawn as two faint darker strips in the covering's albedo (same checkbox)
  var WHEEL_N = 64, WHEEL_STEP = 4, WHEEL_HALF = 0.6, WHEEL_W = 0.3;
  var RELIEF_PREF = { orbit: null, walk: null, rover: null };   // round 6B: relief choice per mode (null = default)
  // round 6C: openness shading (sky-view factor from the LOLA heights; display only) in Walk and Rover. SESSION.ao = the
  // user's choice for this session (null = default AO_DEFAULT); AO_GAIN: brightness factor = 1 - AO_GAIN x (1 - SVF).
  var AO_DEFAULT = false, AO_GAIN = 2.5, AO_CACHE = {};
  var RELIEF_K = 2.0;   // round 6B: relief detail fades where a pixel covers more than RELIEF_K x the layer's grid spacing
  var SHADOW_OFF_NOTE = 'Shadows off: the terrain is lit from the Sun\'s real direction without cast shadows. Sunlit/shadowed status at the site comes from the validated horizon model (tiles above).';
  function shadowsOn() { var c = $('v3dShadows'); return !!(c && c.checked); }

  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtUTC(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  function fmtDeg(x, n) { return (x >= 0 ? '+' : '') + x.toFixed(n === undefined ? 2 : n) + '°'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function isPhone() { return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth < 700; }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }

  // ------------------------------------------------------------ quality levels
  // Display settings only: none of them changes a computed value (Sun/Earth directions, status tiles, readouts).
  var QUALITY = {
    // round 6: fine = finer ring grids where they exist (ring A 25 m from LDEM_85S_20M drawn every afStride-th node,
    // ring B 100 m drawn every 2nd node); nmap = normal maps baked from the finest loaded grid; cascade = second,
    // camera-centred Sun shadow map of nearShadow px; earthShadow = earthshine casts shadows.
    low:    { label: 'Low',    stride: 2, ringA: 2, ringB: false, extShadow: false, shadow: 1024, pr: 1,   aa: false, starMag: 3.5, earthTex: 512,  patch5m: false, fine: false, nmap: false, cascade: false, earthShadow: false },
    medium: { label: 'Medium', stride: 1, ringA: 1, ringB: false, extShadow: true,  shadow: 2048, pr: 1.5, aa: true,  starMag: 4.5, earthTex: 1024, patch5m: false, fine: true, afGeom: false, nmap: true, cascade: true, nearShadow: 2048, earthShadow: true },
    high:   { label: 'High',   stride: 1, ringA: 1, ringB: true,  extShadow: true,  shadow: 4096, pr: 2,   aa: true,  starMag: 5.0, earthTex: 2048, patch5m: true,  fine: true, afGeom: true, afStride: 2, nmap: true, cascade: true, nearShadow: 4096, earthShadow: true }
  };
  var QORDER = ['low', 'medium', 'high'];
  // Starting level from device hints: phone-like devices (touch pointer, small screen, little memory or few cores) or a
  // software renderer -> Low; a recognisable dedicated GPU on a large screen -> High; otherwise Medium.
  var AUTO_Q = null;
  function autoQuality() { return AUTO_Q || (AUTO_Q = autoQuality0()); }
  function autoQuality0() {
    var why = [], q = 'medium';
    var nav = window.navigator || {}, mem = nav.deviceMemory, cores = nav.hardwareConcurrency, gpu = '';
    try {
      var c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl');
      var ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      gpu = gl ? String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : '';
      var lose = gl && gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    } catch (e) { /* no GPU info */ }
    if (isPhone()) { q = 'low'; why.push('touch screen or small window'); }
    else if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) { q = 'low'; why.push('software rendering'); }
    else if ((mem && mem <= 2) || (cores && cores <= 2)) { q = 'low'; why.push('limited memory or processor cores'); }
    else if (/nvidia|geforce|rtx|radeon rx|radeon pro|apple m\d (pro|max|ultra)/i.test(gpu) && Math.min(screen.width, screen.height) >= 900) { q = 'high'; why.push('dedicated graphics'); }
    else why.push(gpu ? 'integrated or unrecognised graphics' : 'no graphics information');
    return { q: q, why: why.join(', '), gpu: gpu };
  }

  // ------------------------------------------------------------------- DOM
  function buildDom(o) {
    var el = document.createElement('div');
    el.id = 'v3d'; el.className = 'v3d'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '3D terrain view');
    var m = o.tile;
    el.innerHTML =
      '<div class="v3d-stage" id="v3dStage">' +
      '  <div class="v3d-labels" id="v3dLabels"><span class="v3d-lbl sun" id="v3dLblSun"><i class="arw" aria-hidden="true">➤</i><span class="t">Sun</span></span><span class="v3d-lbl earth" id="v3dLblEarth"><i class="arw" aria-hidden="true">➤</i><span class="t">Earth</span></span><span class="v3d-lbl site" id="v3dLblSite"><i></i>Site</span><span class="v3d-lbl rover" id="v3dLblRover" hidden>Rover</span>' + (o.point ? '<span class="v3d-lbl site pt" id="v3dLblPt"><i></i>Your point</span>' : '') + '</div>' +
      '  <div class="v3d-exag" id="v3dExagBadge">Vertical scale 1× (true scale)</div>' +
      '  <div class="v3d-feat" id="v3dFeat"></div>' +
      '  <div class="v3d-hud" id="v3dHud"><svg class="v3d-compass" id="v3dCompass" viewBox="-30 -30 60 60" aria-hidden="true"><circle r="27"/><g id="v3dCompassRot"><path d="M0,-24 L6,-4 L0,-8 L-6,-4 Z" class="n"/><path d="M0,24 L6,4 L0,8 L-6,4 Z" class="s"/><text y="-11" class="nl">N</text></g></svg>' +
      '    <div class="v3d-hudtxt"><div id="v3dHeading">-</div><div class="v3d-scale"><i id="v3dScaleBar"></i><span id="v3dScaleTxt">-</span></div><div id="v3dDist">-</div></div></div>' +
      '  <figure class="v3d-mini" id="v3dMini"><canvas id="v3dMiniCv" width="320" height="320" aria-label="Top-view map of the terrain around the site with your position"></canvas><figcaption id="v3dMiniCap">Top view, north up</figcaption></figure>' +
      '  <div class="v3d-msgs"><div class="v3d-banner" id="v3dBanner" hidden></div>' +
      '  <div class="v3d-tip" id="v3dTip" hidden><span id="v3dTipTxt">The site is in shadow, so the ground looks almost black.</span> <button class="btn small" id="v3dTipBtn">Light up</button> <span class="fineprint">(display brightness only)</span> <button class="btn small jump-sun" id="v3dTipJump" type="button" data-jump="sun">Jump to next sunlight</button></div></div>' +
      '  <div class="v3d-qnote" id="v3dQNote" hidden></div>' +
      '  <div class="v3d-inspect" id="v3dInspect" hidden role="status" aria-live="polite"></div><i class="v3d-inspmark" id="v3dInspMark" hidden aria-hidden="true"></i>' +
      '  <p class="v3d-shadownote">Near-field shadows (visual approximation); distant terrain shadows not rendered; sunlit and Earth-visible status at the site marker come from the validated horizon model.</p>' +
      '  <div class="v3d-pad" id="v3dPad" hidden><button data-k="fwd" aria-label="Forward">&#9650;</button><button data-k="left" aria-label="Turn left">&#9664;</button><button data-k="back" aria-label="Back">&#9660;</button><button data-k="right" aria-label="Turn right">&#9654;</button></div>' +
      '  <button class="btn v3d-close" id="v3dClose" aria-label="Close the 3D view">&#10005; Close 3D</button>' +
      '</div>' +
      '<aside class="v3d-panel" id="v3dPanel">' +
      '  <div class="v3d-head"><div><div class="v3d-kicker">3D terrain view</div><h2 id="v3dTitle">' + esc(o.point ? 'Your point ' + o.point.lat.toFixed(4) + '°, ' + o.point.lon.toFixed(4) + '°E' : o.site.name) + '</h2></div><button class="btn small ghost" id="v3dToggle" aria-expanded="true" aria-controls="v3dBody">Hide panel</button></div>' +
      '  <div id="v3dBody">' +
      '  <div class="v3d-time"><span class="lbl">Showing</span> <b class="mono" id="v3dTime">-</b></div>' +
      '  <div class="row slider-row"><button class="btn play" id="v3dPlay" aria-label="Play">&#9654;</button><input id="v3dSlider" type="range" min="0" max="1" value="0" aria-label="Time within window (synced with the main view)"></div>' +
      '  <div class="tiles v3d-tiles">' +
      '    <div class="tile" id="v3dTileSun"><div class="tlabel">Sunlight at ' + (o.point ? 'your point' : 'the site marker') + '</div><div class="tstate" id="v3dSun">-</div><div class="tx x-only mono" id="v3dSunX"></div></div>' +
      '    <div class="tile" id="v3dTileEarth"><div class="tlabel">Earth link at ' + (o.point ? 'your point' : 'the site marker') + '</div><div class="tstate" id="v3dEarth">-</div><div class="tx x-only mono" id="v3dEarthX"></div></div>' +
      '  </div>' +
      '  <div class="jumprow v3d-jump"><button class="btn small jump-sun" type="button" data-jump="sun">Jump to next sunlight</button><button class="btn small jump-earth" type="button" data-jump="earth">Jump to next Earth view</button><button class="btn small jump-both" type="button" data-jump="both">Jump to next both</button><div class="hint" id="v3dJumpMsg" role="status" aria-live="polite"></div></div>' +
      '  <p class="fineprint">Status from the validated horizon model (same as the main view), not from the 3D rendering.</p>' +
      (o.point ? '  <p class="fineprint v3d-ptnote" id="v3dPtNote"></p>' : '') +
      '  <p class="fineprint" id="v3dEarthNote">Earth: continents from NASA Blue Marble (cloud-free composite); clouds not shown; orientation computed for this time.</p>' +
      '  <div class="v3d-ctl v3d-disp">' +
      '    <label>Quality <select id="v3dQuality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>' +
      '    <span class="fineprint" id="v3dQWhy"></span>' +
      '  </div>' +
      '  <div class="v3d-bright">' +
      '    <label for="v3dBright">Brightness <b class="mono" id="v3dBrightVal">1.0×</b></label>' +
      '    <div class="row"><input id="v3dBright" type="range" min="0.5" max="6" step="0.1" value="1" aria-describedby="v3dBrightNote"><button class="btn small" id="v3dLightUp" aria-pressed="false">Light up</button></div>' +
      '    <p class="fineprint" id="v3dBrightNote">Display brightness only (like camera exposure). Real polar shadows are almost black; this does not change the computed lighting.</p>' +
      '  </div>' +
      '  <div class="v3d-modes" role="group" aria-labelledby="v3dModeHead"><div class="v3d-modehead" id="v3dModeHead">View mode</div>' +
      '    <div class="seg seg-mode" role="radiogroup" aria-label="Camera mode"><button data-mode="orbit" class="on">Orbit</button><button data-mode="walk">Walk</button><button data-mode="rover">Rover</button></div>' +
      '    <div class="fineprint" id="v3dModeWhy" hidden></div>' +
      '  </div>' +
      '  <div class="v3d-ctl v3d-presets" role="group" aria-label="Camera presets"><span class="lbl">View</span><button class="btn small" data-preset="overview">Overview</button><button class="btn small" data-preset="eye">Site eye level (2 m)</button><button class="btn small" data-preset="sun">Look at Sun</button><button class="btn small" data-preset="earth">Look at Earth</button><button class="btn small" id="v3dTo2D" type="button">Show on 2D map</button></div>' +
      '  <div class="v3d-ctl v3d-insp"><span class="fineprint">Click (or tap) the terrain to read its height, slope, position and data resolution; the readout stays until the next click or Esc.</span> <label class="smallswitch"><input type="checkbox" id="v3dHover"> Inspect on hover</label></div>' +
      '  <div class="v3d-ctl">' +
      '    <label>Vertical exaggeration <select id="v3dExag"><option value="1" selected>1× (true scale)</option><option value="2">2×</option><option value="3">3×</option><option value="5">5×</option></select></label>' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dShadows"> Shadows (approximate)</label>' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dRing" checked> distant skyline</label>' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dStars" checked> stars</label>' +
      '    <label class="smallswitch" title="camera glare (display effect); there is no atmosphere on the Moon"><input type="checkbox" id="v3dGlare" checked> Sun glare <span class="fineprint">(camera glare (display effect); there is no atmosphere on the Moon)</span></label>' +
      '  </div>' +
      '  <div class="v3d-ctl"><label class="smallswitch" title="Sunlight reflected by Earth onto the Moon (physically scaled, approximate)"><input type="checkbox" id="v3dEarthshine"> Earthshine</label></div>' +
      '  <p class="fineprint" id="v3dEsNote" hidden></p>' +
      '  <p class="fineprint" id="v3dStarNote">Real star positions; cameras usually cannot see stars when the Sun or sunlit ground is in view.</p>' +
      '  <div class="v3d-ctl">' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dFeatOn" checked> feature names (IAU)</label>' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dMiniOn" checked> mini-map</label>' +
      '    <label class="smallswitch" id="v3dRingsLbl"><input type="checkbox" id="v3dRings"> 500 m distance rings</label>' +
      '  </div>' +
      '  <div class="v3d-ctl">' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dContours"> contour lines</label>' +
      '    <select id="v3dContourInt" aria-label="Contour interval"><option value="10">10 m</option><option value="25">25 m</option><option value="50">50 m</option><option value="100">100 m</option><option value="250">250 m</option></select>' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dSlope"> slope shading</label>' +
      '  </div>' +
      '  <div class="v3d-ctl"><label class="smallswitch"><input type="checkbox" id="v3dHazard"> hazard view: slopes above</label> <span class="inl"><input id="v3dHazMax" type="number" min="1" max="45" step="1" value="15" aria-label="Hazard view slope limit in degrees"> &deg;</span></div>' +
      '  <div class="v3d-ctl"><label class="smallswitch"><input type="checkbox" id="v3dRelief"> Relief shading</label></div>' +
      '  <p class="fineprint" id="v3dReliefNote">Relief shading: display contrast only; heights and slopes are the LOLA data.</p>' +
      '  <div class="v3d-ctl"><label class="smallswitch"><input type="checkbox" id="v3dAO"> Openness shading (Walk and Rover)</label></div>' +
      '  <p class="fineprint" id="v3dAONote">Openness shading: display only. Ground that sees less open sky (sky-view factor calculated from the LOLA heights) is drawn darker. It does not change the Sun direction, shadows, status or any value.</p>' +
      '  <div class="v3d-ctl" id="v3dCoverRow"><label class="smallswitch"><input type="checkbox" id="v3dCover"> Close-range surface texture (illustrative)</label></div>' +
      '  <p class="fineprint" id="v3dCoverNote">Close-range surface texture is illustrative: fine grain and small craters are drawn for realism, not measured. Heights, slopes, readouts, shadows and the Sun direction are the LOLA data and the validated engine.</p>' +
      '  <div class="v3d-legend" id="v3dLegend" hidden></div>' +
      '  <p class="hint" id="v3dHelp"></p>' +
      '  <div class="v3d-rover" id="v3dRover" hidden>' +
      '    <div class="cards small"><div class="card"><div class="cardlbl">Position from site</div><div class="val mono" id="v3dRPos">-</div></div>' +
      '    <div class="card"><div class="cardlbl">Terrain elevation</div><div class="val mono" id="v3dRElev">-</div></div>' +
      '    <div class="card"><div class="cardlbl">Local slope</div><div class="val mono" id="v3dRSlope">-</div></div>' +
      '    <div class="card"><div class="cardlbl">Sun over the tile terrain</div><div class="val" id="v3dRSun">-</div></div>' +
      '    <div class="card"><div class="cardlbl">Body tilt (wheels on LOLA heights)</div><div class="val mono" id="v3dRTilt">-</div></div></div>' +
      '    <label>Slope warning above <span class="inl"><input id="v3dSlopeMax" type="number" min="1" max="45" step="1" value="15" aria-label="Slope warning threshold in degrees"> &deg;</span></label>' +
      '    <div class="v3d-warn" id="v3dRWarn" hidden></div>' +
      '    <p class="fineprint" id="v3dRNote"></p>' +
      '    <details class="v3d-about" id="v3dAboutRover"><summary>About this rover</summary>' + ABOUT_ROVER + '</details>' +
      '  </div>' +
      '  <details class="v3d-notes"><summary>What is accurate, what is approximate</summary><ul id="v3dNotes"></ul></details>' +
      '  </div>' +
      '</aside>';
    document.body.appendChild(el);
    return el;
  }
  // "About this rover" (round 6). Facts as published by NASA (pages and dates in ROUND6_REPORT.md, SUBMISSION_LINKS.md).
  var VIPER_URL = 'https://science.nasa.gov/mission/viper/', VIPER_RI = 'https://science.nasa.gov/mission/viper/rover-and-instruments/',
    VIPER_2026 = 'https://www.nasa.gov/missions/moon-base/nasa-provides-progress-update-on-moon-base-rovers/',
    VIPER_2025 = 'https://www.nasa.gov/news-release/nasa-selects-blue-origin-to-deliver-viper-rover-to-moons-south-pole/',
    VIPER_2024 = 'https://www.nasa.gov/news-release/nasa-ends-viper-project-continues-moon-exploration/';
  var lnk = function (u, t) { return '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>'; };
  var ABOUT_ROVER =
    '<p><b>Illustrative model based on NASA VIPER\'s published dimensions. It is not a mobility simulation: ASTERIA does not predict whether a rover can traverse a slope or surface.</b></p>' +
    '<p><b>What VIPER is</b>: NASA\'s Volatiles Investigating Polar Exploration Rover, built to map the location of water ice and other potential resources at the Moon\'s South Pole on a 100-day mission (' + lnk(VIPER_URL, 'NASA VIPER mission page') + ').</p>' +
    '<p><b>Published facts used here</b> (' + lnk(VIPER_RI, 'NASA: VIPER rover and instruments') + '): 2.5 m (8 ft) tall, 1.5 m (5 ft) long and wide; four wheel modules with active suspension and independent steering; headlights; a 1 m drill (TRIDENT); instruments NSS (neutron spectrometer), NIRVSS (near-infrared volatiles spectrometer) and MSolo (mass spectrometer). NASA gives its driving speed as about 0.72 km/h; driving in this view is faster, for viewing.</p>' +
    '<p><b>Approximate</b> (not given on those pages): wheel size (drawn 0.5 m across) and tread, body sections and ground clearance, radiator, mast, camera housings and lights on the mast, solar-panel layout (drawn as vertical panels on the left, right and rear sides), wheel-module housings and suspension arms, and the positions of the drill and instruments. These follow the general appearance of NASA\'s published VIPER pictures, not measured drawings. No NASA images, textures or markings are used. VIPER\'s mass is not shown.</p>' +
    '<p><b>Current status</b> (' + lnk(VIPER_2026, 'NASA, 20 October 2026') + '): VIPER "will embark on a mission to the lunar South Pole region in 2027"; it is "currently at NASA\'s Johnson Space Center in Houston where it is fully built and undergoing final testing before traveling to NASA\'s Kennedy Space Center in Florida for launch to the Moon", to be delivered by a Blue Origin Blue Moon Mark 1 lander. Earlier: on 19 September 2025 NASA selected Blue Origin to deliver VIPER in late 2027 (' + lnk(VIPER_2025, 'NASA release') + '; NASA\'s VIPER page names Mons Mouton as the destination); on 17 July 2024 NASA had announced its intent to discontinue VIPER, citing cost increases and launch delays (' + lnk(VIPER_2024, 'NASA release') + ').</p>' +
    '<p><b>In this view</b>: each wheel rests on the LOLA surface under it and the body\'s pitch and roll follow from those four heights (Calculated from the DEM at its resolution - 20 m, or 5 m in the patch - so the tilt is the DEM\'s slope over about one cell; real ground under a rover is rougher). No traction, slip, power, wheel-soil or obstacle physics. The slope warning only compares the DEM slope with the limit you set.</p>';
  function featList(v) {
    var F = (window.ASTERIA_FEATURES3D && window.ASTERIA_FEATURES3D.sites[v.site.id]) || [];
    return F.length ? ': ' + F.map(function (f) { return '<a href="' + esc(f.link) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a> (' + f.lat.toFixed(2) + '°, ' + f.lon.toFixed(2) + '°E)'; }).join(', ') : '';
  }
  // "What is accurate, what is approximate" - written from what this view actually loaded and draws.
  function extKm(v) { var s = v.s; return s.ext.b && s.Q.ringB ? 40 : s.ext.a ? 16 : 0; }
  // Classification of each item (round 6): Measured, Calculated, Approximate or Illustrative (see ROUND6_REPORT.md).
  function cls(c) { return '<span class="cls cls-' + c.toLowerCase() + '">' + c + '</span> '; }
  function notes(v) {
    var s = v.s, m = s.T.meta, Q = s.Q, A = s.ext.a, B = s.ext.b && Q.ringB ? s.ext.b : null, P5 = s.T.patch, km = extKm(v), shKm = Q.extShadow ? km : 0;
    var list = [
      cls('Measured') + '<b>Terrain (6 km tile)</b>: LOLA ' + esc(m.demProduct) + ', ' + m.spacing_m + ' m grid' + (v.stride > 1 ? ' (drawn at ' + m.spacing_m * v.stride + ' m at ' + Q.label + ' quality; readouts use ' + m.spacing_m + ' m)' : '') + ', ' + (m.size_m / 1000).toFixed(1) + ' km square centred on the site; heights within 0.05 m of direct DEM samples (tools/terrain3d.py check). Lunar curvature is included (about ' + m.curvatureDropAtCorner_m.toFixed(0) + ' m drop at the corners). Features smaller than the grid, boulders and the lander are not represented.',
      P5 ? cls('Measured') + '<b>Sharper ground near the site</b>: a 2 km × 2 km patch at 5 m from LOLA ' + esc(P5.meta.demProduct) + ' (heights within 0.05 m of direct samples; tools/terrain3d_ext.py check). The label of this product says it is made from preliminary LOLA data. The preliminary 5 m product contains a few isolated spikes that are probably data artifacts (locations in GAPS_AND_ISSUES.md); heights are shown as published.' : null,
      A ? cls('Measured') + '<b>Extended terrain</b>: real LOLA heights to ' + km + ' km from the site: ' + esc((s.gridA || A).meta.demProduct) + ' to 16 km' + (B ? ', and ' + esc((s.gridB || B).meta.demProduct) + ' to 40 km' : '') + ' (stored heights within 0.1 m of direct DEM samples: every grid point checked, tests/accuracy3d.js). Same site-centred frame and curvature as the tile; the meshes share their edge vertices, and short vertical skirts hide the joins.' : (s.extError ? '<b>Extended terrain</b>: could not be loaded (' + esc(s.extError) + ').' : '<b>Extended terrain</b>: loading…'),
      s.areas && s.areas.length ? cls('Calculated') + '<b>Resolution by area</b> (Calculated from measured LOLA heights): ' + s.areas.map(function (a) { return esc(a.name) + ' - geometry: ' + a.geom + ' m grid; lighting detail' + (a.light < a.geom ? ' (normal map)' : '') + ': ' + a.light + ' m LOLA data (' + esc(a.product) + ')'; }).join('; ') + '. A normal map is baked from the same LOLA grid (central differences of the stored heights, never finer than that grid) and gives a coarser mesh the lighting detail of the finer data; it does not change any height. ' + (s.nmapOK ? 'Toward a coarser neighbouring area the lighting detail fades gradually (averaged real normals) instead of changing in a visible step; the meshes themselves keep their exact DEM heights (they are not morphed).' : s.nearNmOK ? 'At this quality only the 6 km tile and the 5 m patch use normal maps; the rings use the normals of their drawn grid.' : 'Normal maps need WebGL2, which this browser does not provide here.') + (s.nearNmOK ? ' The 6 km tile and the 5 m patch are shaded per pixel from normal maps of their own LOLA grids (20 m or 80 m, and 5 m) at every quality level; between grid nodes the normal is interpolated smoothly, which adds no new features.' : '') : null,
      cls('Approximate') + '<b>Surface shading</b>: Lommel-Seeliger law (a standard photometric model for lunar regolith: brightness proportional to cos i / (cos i + cos e)), with surface normals from the DEM at full resolution. <b>Uniform albedo</b>: no public LOLA 1064 nm normal-albedo map of the south pole at 250 m/pixel or finer was found (LOLA\'s published albedo maps are about 2 km/pixel near the poles; the PDS LOLA polar products named LDRM are roughness maps), so brightness differences come from the terrain\'s shape only. No synthetic rocks, small craters or textures are added in Orbit; in Walk and Rover the illustrative close-range surface texture (below) changes only the appearance near the viewer. <b>Relief shading</b> (on by default in Walk and Rover): display contrast only; heights and slopes are the LOLA data. It multiplies the Lommel-Seeliger brightness by a factor between 0.4 and 1.6 that follows the ratio of sunlight on the DEM normal to sunlight on a smoothed DEM normal (over ±4 grid cells), because at the grazing views of Walk and Rover the Lommel-Seeliger law makes slopes facing toward and away from the low Sun look almost alike; the factor is bounded, so no slope is pushed to pure black or white. Its contrast is normalised by grid spacing and viewing distance (relief smaller than about half a pixel fades out, using averages of the real DEM normals), so the 6 km tile and the surrounding rings look alike from far away. In Walk and Rover on laptops the 6 km tile is drawn at full resolution and the 5 m patch is used where it exists, at every quality level.',
      cls('Illustrative') + '<b>Openness shading</b> (Walk and Rover, off by default; display only): ground that sees less open sky is drawn darker, by 1 − 2.5 × (1 − sky-view factor). The sky-view factor is Calculated from the LOLA heights of the 6 km tile and the 5 m patch (horizon angles in 16 directions within 1 km, lunar curvature included; Zakšek et al. 2011, Remote Sensing 3, 398-415). The Moon has no sky light, so this is a relief-visualisation aid, not a light source: it does not change the Sun direction, shadows, status or any readout. It fades out over the tile\'s outer 500 m.',
      cls('Illustrative') + '<b>Why the ground looks smoother in Walk and Rover than in Orbit</b>: the finest data are 5 m (5 m patch) and 20 m (tile) grids; in Walk and Rover one grid cell covers tens to thousands of screen pixels, so the picture can only show smooth changes between grid points. In Orbit one pixel covers several grid cells, so many real features share the picture. Rocks, small craters and other features smaller than the grid are not in any dataset used. The close-range surface texture (Walk and Rover, below) adds an illustrative appearance of fine grain and small craters near the viewer; the data limit is unchanged. Terrain textures use anisotropic filtering at the device maximum (×' + (s.maxAniso || 1) + ').',
      cls('Illustrative') + '<b>Close-range surface texture</b> (Walk and Rover, on by default; checkbox "Close-range surface texture (illustrative)"): a procedural pattern drawn in the shader only, like a carpet over the real floor: brightness variation of about ±5 % (10 cm to 6 m), fine grain and small undulations, small craters (radius about 0.1-' + COVER_RMAX + ' m, below the DEM grid scale) and sparse rock flecks (0.04-0.4 m), drawn in the shading only. The small craters vary at random in shape (slightly elliptical, any orientation), rim (irregular, partly broken), depth and age (most old: shallow and soft; a few fresh: sharp rim, slight bright halo), and some overlap; the flecks have irregular outlines and varied brightness. Sizes and densities are tuned visually, not statistically matched to published crater or rock counts; none of it is a measured feature or a hazard. It is fixed to the ground in site-centred east/north metres and follows the LOLA slopes. Its distance is measured from the camera, so it travels with you: each size fades out only when it becomes smaller than about 2-4 screen pixels, and the whole texture fades gently between ' + (COVER_NEAR / 1000).toFixed(1) + ' and ' + (COVER_FAR / 1000).toFixed(1) + ' km from the camera; distant ground keeps the plain LOLA appearance (fewer octaves on Low and on phones). It only modulates the sunlit brightness: ground facing away from the Sun or in cast shadow is unchanged, and heights, slopes, readouts, shadows, status, the Sun/Earth directions and Orbit are unchanged (tested). Distant terrain looks as before. Wheel tracks (same checkbox): where the rover has driven this session (the last 250 m or so), two faint, slightly darker strips are drawn in the same way, shading only; they do not change any readout.',
      cls('Calculated') + '<b>Contour lines and slope shading</b> (optional): computed from the same LOLA heights (true heights, also when the vertical scale is exaggerated). Slope by central differences over one grid spacing (5 m, 20 m, 80 m or 100-200 m depending on the area), the same formula as the rover readout; real slopes over a few metres can be steeper.',
      cls('Calculated') + '<b>Sun</b>: direction and disk size from the validated engine (the light direction matches it to better than 0.01°).',
      cls('Calculated') + '<b>Earth</b>: position and size (about ' + (2 * (v.earthRadiusDeg || 0.95)).toFixed(1) + '° across) from the engine. ' + (s.earthTex ? 'Continents from NASA Blue Marble Next Generation (July 2004 cloud-free composite, public domain NASA imagery; ' + s.earthTex + ' × ' + s.earthTex / 2 + ' pixels at ' + Q.label + ' quality); clouds not shown; orientation computed for this time (Earth\'s rotation from Astronomy Engine; the point of Earth facing the site agrees with JPL Horizons within 0.2°, tests/earth_orientation.js). ' : 'Plain blue sphere until the map loads. ') + 'Its lit side is the computed phase from the Sun direction; the unlit side is drawn very faintly so Earth can be found.',
      cls('Illustrative') + '<b>Orientation aids</b>: compass (north = toward the lunar north pole along the site meridian, as everywhere in ASTERIA), scale bar (at the view centre in Orbit, at 100 m ahead in Walk/Rover), distance from the site, a top-view mini-map of the LOLA heights, 500 m distance rings and the rover\'s track. Named features: centres from the IAU Gazetteer of Planetary Nomenclature (USGS; up to 5 within 40 km' + featList(v) + '), placed on the drawn terrain, or on the distant skyline in their direction with their distance when they are farther away (that position is then only a direction).',
      cls('Illustrative') + '<b>Sun glare</b> (on by default): a faint halo around the Sun disk, a camera glare (display effect); there is no atmosphere on the Moon. The Sun disk itself has the computed position and size.',
      cls('Calculated') + '<b>Distant skyline</b>: the site\'s terrain horizon (data/horizons, rays to 300 km) drawn as the top edge of a dark ring ' + RING_M / 1000 + ' km away. It is exact only when seen from the site marker; elsewhere it is approximate. Between the edge of the drawn terrain (' + (km || 3) + ' km) and the ring nothing is drawn (dark).',
      cls('Approximate') + '<b>Shadows</b> (option "Shadows (approximate)", off by default; ' + (shadowsOn() ? 'on' : 'off') + ' now): ' + (shKm ? 'cast by all terrain drawn within ' + shKm + ' km of the site (shadow-map texel about ' + (s.shadowTexel || 0).toFixed(0) + ' m' + (s.sunNear ? '; near the camera a second, finer shadow map of the same Sun direction and the same terrain, texel about ' + (s.nearTexel || 0).toFixed(1) + ' m: sharper edges, the same lit and shadowed areas' : '') + '; visual approximation). Terrain farther away does not cast shadows in the picture' + (B ? '; the ring from 16 to 40 km is shaded but receives no shadows' : '') + '.' : 'cast by the 6 km tile only at ' + Q.label + ' quality (choose Medium or High for shadows from the surrounding terrain).') + ' Sunlit and Earth-visible status at the site marker always come from the validated horizon model.',
      cls('Illustrative') + '<b>Fill light and brightness</b>: a faint uniform light keeps unlit ground from being pure black. It is not physical (real shadows get only faint light reflected from sunlit terrain and Earthshine). The Brightness slider and "Light up" change only the display exposure and this fill light, never the Sun direction or any computed value.',
      cls('Approximate') + '<b>Earthshine</b> (off by default; Approximate): sunlight reflected by Earth, from the computed Earth direction. Strength = Earth&#39;s geometric albedo 0.434 (NASA Earth Fact Sheet) × (Earth radius / distance)² (its angular size) × the Lambert phase law at the computed phase angle (how much of Earth is lit) - about 1/8,000 of sunlight at full Earth. Off where Earth&#39;s centre is below the validated terrain horizon at the site marker; ' + (s.earthLight.castShadow ? 'the drawn terrain casts earthshine shadows' : 'no earthshine shadows at ' + Q.label + ' quality') + '. Earth is treated as an evenly reflecting sphere and a point source: the real value depends on clouds and Earth&#39;s real phase curve (within about a factor of 2; a sphere with Earth&#39;s Bond albedo 0.294 gives about half), and real earthshine shadows have soft edges (Earth is about 2° wide). Light reflected by sunlit terrain is not included. While on, the uniform fill light is off, and a site in shadow is shown with a raised exposure (stated on screen). Display only: no status or readout uses it.',
      cls('Calculated') + '<b>Stars</b> (on by default; background only - no calculation, readout, inspection, shadow or status uses them): the ' + (s.starRows ? s.starRows.length + ' ' : '') + 'stars brighter than magnitude ' + Q.starMag.toFixed(1) + ' (at ' + Q.label + ' quality) of the Yale Bright Star Catalogue, 5th revised edition (Hoffleit &amp; Warren 1991, public domain), at their true directions in the site\'s sky for the selected time, using the engine\'s Moon orientation (checked against an independent IAU/WGCCRE computation: within 0.002°). Size and brightness by magnitude, tint by colour index. Real star positions; cameras usually cannot see stars when the Sun or sunlit ground is in view.',
      cls('Illustrative') + '<b>Vertical exaggeration</b> above 1× stretches heights (and therefore shadows and the look of slopes); rover slope readouts always use true heights. The distant skyline ring is never exaggerated.',
      cls('Illustrative') + '<b>Rover</b>: model with NASA VIPER\'s published proportions (2.5 m tall, 1.5 m long and wide, four wheel modules; chassis, solar panels, mast with camera housings and lights, wheels with tread, steering housings and suspension arms drawn in detail, but their sizes and layout are approximate; see "About this rover"); Illustrative, not a mobility simulation. Each wheel rests on the LOLA surface and the body\'s pitch and roll follow from the four wheel heights (Calculated at the DEM\'s resolution); speed is for viewing. Elevation = LOLA height at the rover (bilinear); slope = central differences of the LOLA heights over ' + (P5 ? '5 m within 1 km of the site and ' : '') + m.spacing_m + ' m' + (P5 ? ' elsewhere' : '') + ' (checked against an independent computation from the DEM; Validation page, "3D terrain accuracy"). "Sun over the tile terrain" is a near-field estimate using only the tile.',
      cls('Calculated') + '<b>Inspection, hazard view and camera presets</b>: pointing at the terrain shows the LOLA height, slope (central differences over the grid spacing), latitude/longitude, distance from the site and the data resolution there; the hazard view colours DEM slopes above your limit (real slopes over a few metres can be steeper; not a traversability prediction); Look at Sun / Earth use the engine&#39;s directions. The camera wedge on the mini-map and "Show on 2D map" are navigation aids.',
      '<b>Graphics</b>: the rover, the close-range surface texture in Walk and Rover, and the pixel-art rocket, Earth and Moon are drawn by code written with Claude Code (Anthropic), an AI coding assistant. Terrain shapes, maps, stars and the Earth texture are renderings of NASA and catalogue data, not generated images.'
    ];
    $('v3dNotes').innerHTML = list.filter(Boolean).map(function (x) { return '<li>' + x + '</li>'; }).join('');
    var sn = v.el.querySelector('.v3d-shadownote');
    if (!shadowsOn()) { sn.textContent = SHADOW_OFF_NOTE; return; }
    sn.textContent = (shKm ? 'Shadows from terrain within ' + shKm + ' km (visual approximation); farther terrain casts no shadows here' : 'Near-field shadows (visual approximation); distant terrain shadows not rendered') + '; sunlit and Earth-visible status at the site marker come from the validated horizon model.';
  }

  // ----------------------------------------------------------------- scene
  function buildScene(o) {
    var THREE = window.THREE;
    var T = TILE_CACHE[o.tile.siteId] || (TILE_CACHE[o.tile.siteId] = M.decodeTile(o.tile));
    T.k = 1;
    var stride = o.stride;
    // mesh tile (decimated on phones); readouts always use the full tile T.
    // Progressive loading: the first frame uses a coarse mesh (4x the stride); refine() swaps in the final mesh.
    var TM = decimate(T, stride);
    var coarse = T.n > 200 ? stride * 4 : stride;
    var Q = o.Q;
    var renderer = new THREE.WebGLRenderer({ antialias: Q.aa, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pr));
    // Brightness = exposure of a linear tone map (exposure 1 = the unchanged picture); see setBrightness()
    renderer.toneMapping = THREE.LinearToneMapping; renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 1);
    var scene = new THREE.Scene();
    // round 6F: the covering's distance fade needs the camera's world position. Three.js (r149) uploads its built-in
    // cameraPosition uniform only for Shader/Phong/Toon/Standard materials, not for the Lambert terrain material, where it
    // stayed (0, 0, 0) - the site - so in round 6E the fade was measured from the site, not from the camera. uCamW is set
    // here from the camera of every render call (display only; nothing else reads it).
    scene.onBeforeRender = function (r, sc, cam) { if (U.uCamW) U.uCamW.value.setFromMatrixPosition(cam.matrixWorld); };
    scene.background = new THREE.Color(0x000000);
    var camera = new THREE.PerspectiveCamera(55, 1, 0.3, 2000000);

    // terrain: the tile now (coarse first frame), then the extended rings and the 5 m patch (loadExtended)
    // global uniforms shared by every terrain material; cascade: camera-centred Sun shadow map (Medium/High)
    var U = { uContour: { value: 0 }, uSlope: { value: 0 }, uRelief: { value: 0 }, uFlat: { value: 0.1 }, uLambert: { value: 0 }, uReliefK: { value: RELIEF_K }, uAO: { value: 0 }, uVNorm: { value: 0 }, uNoShadow: { value: 0 }, uCascadeOn: { value: 1 },
      uCover: { value: 0 }, uCovOct: { value: COVER_OCT }, uCovNear: { value: COVER_NEAR }, uCovFar: { value: COVER_FAR }, uCovDbg: { value: 0 }, uCamW: { value: new THREE.Vector3() }, uCov3: { value: 3 }, uCovA: { value: COVER_CLASSES.map(function (c) { return new THREE.Vector4(c[0], c[1], c[2], c[3]); }) }, uCovB: { value: COVER_CLASSES.map(function (c) { return new THREE.Vector2(c[4], c[5]); }) }, uTrk: { value: (function () { var a = []; for (var i = 0; i < 64; i++) a.push(new THREE.Vector2()); return a; })() }, uTrkN: { value: 0 }, cascade: !!Q.cascade };
    var nmapOK = !!(Q.nmap && renderer.capabilities.isWebGL2);
    var floatLinear = !!renderer.extensions.get('OES_texture_float_linear');
    // round 6C: per-pixel normals (normal maps of the LOLA grid) for the 6 km tile and the 5 m patch at every quality
    // level where WebGL2 is available (small textures: 301 x 301 and 401 x 401 nodes); anisotropic filtering at the
    // device maximum for every terrain texture (grazing views of Walk and Rover)
    var nearNmOK = !!renderer.capabilities.isWebGL2, maxAniso = Math.max(1, renderer.capabilities.getMaxAnisotropy() || 1);
    var terrainMat = regolithMaterial(THREE, U);
    var terrainGroup = new THREE.Group(); scene.add(terrainGroup);
    var geo = geomFrom(THREE, M.buildGridMesh(decimate(T, coarse), 1, 0, null, T));
    var terrain = new THREE.Mesh(geo, terrainMat);
    terrain.castShadow = true; terrain.receiveShadow = true;
    terrainGroup.add(terrain);

    var fill = new THREE.AmbientLight(0xffffff, FILL);
    scene.add(fill);
    // Lights (order matters, see lightsPatch): [near-cascade Sun], Sun, Earthshine.
    var sunNear = null;
    if (Q.cascade) {
      sunNear = new THREE.DirectionalLight(0xffffff, 1.7);   // same direction and intensity as the Sun; adds no light (shader)
      sunNear.castShadow = true; sunNear.shadow.mapSize.set(Q.nearShadow, Q.nearShadow);
      scene.add(sunNear); scene.add(sunNear.target);
    }
    var sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = TM.d * 0.08;
    // with a cascade, the full Sun map does not depend on the camera: re-rendered only when the time or terrain changes
    sun.shadow.autoUpdate = !Q.cascade;
    scene.add(sun); scene.add(sun.target);
    // Earthshine (round 6, off by default): sunlight reflected by Earth, from the engine's Earth direction, intensity =
    // Sun intensity x M.earthshineRatio (albedo, angular size, phase); casts shadows on Medium/High.
    var earthLight = new THREE.DirectionalLight(0xffffff, 0);
    earthLight.castShadow = !!Q.earthShadow;
    if (Q.earthShadow) { earthLight.shadow.mapSize.set(Q.shadow / 2, Q.shadow / 2); earthLight.shadow.autoUpdate = false; }
    scene.add(earthLight); scene.add(earthLight.target);

    // Sun disk and Earth (positioned relative to the camera every frame: they are at "infinity")
    var sunDisk = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }));
    scene.add(sunDisk);
    // Earth: own shader lit from the computed Sun direction (uSun), so it keeps its phase when the Sun is below the
    // site's horizon (the scene's sunlight is off then). Diffuse (Lambert) day side; the night side very faint.
    var earthMat = new THREE.ShaderMaterial({
      uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uMap: { value: null }, uHasMap: { value: 0 }, uColor: { value: new THREE.Color(0x4ea8ff) } },
      vertexShader: 'varying vec3 vN; varying vec2 vUv;\nvoid main() { vUv = uv; vN = normalize( mat3( modelMatrix ) * normal ); gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
      fragmentShader: 'uniform vec3 uSun; uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uColor; varying vec3 vN; varying vec2 vUv;\n' +
        'void main() { vec3 base = uHasMap > 0.5 ? texture2D( uMap, vUv ).rgb : uColor; float d = max( dot( normalize( vN ), normalize( uSun ) ), 0.0 );\n' +
        '  gl_FragColor = vec4( base * ( 1.15 * d ) + base * 0.06 + vec3( 0.01, 0.015, 0.03 ), 1.0 ); }'
    });
    var earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), earthMat);
    scene.add(earth);
    // camera glare around the Sun disk (display effect; the Moon has no atmosphere): a faint additive sprite
    var gc = document.createElement('canvas'); gc.width = gc.height = 128;
    var gx = gc.getContext('2d'), grd = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,244,214,0.55)'); grd.addColorStop(0.15, 'rgba(255,240,200,0.18)'); grd.addColorStop(1, 'rgba(255,240,200,0)');
    gx.fillStyle = grd; gx.fillRect(0, 0, 128, 128);
    var glareTex = new THREE.CanvasTexture(gc);
    var glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glareTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
    scene.add(glare);

    // distant skyline ring from the horizon mask (site observer = 2 m above the ground at the centre)
    var ring = new THREE.Group();
    if (o.mask) {
      var nA = 361, rp = new Float32Array(nA * 2 * 3), lp = new Float32Array(nA * 3), ri = [];
      for (var a = 0; a < nA; a++) {
        var el = o.mask[a % 360];
        // top edge: the skyline exactly as seen from the site marker; below it a dark wall down to 80 km, so the area
        // beyond the tile (not drawn) reads as dark distant terrain instead of sky
        var top = M.dirFromAzEl(a, el);
        rp.set([top[0] * RING_M, EYE_M + top[1] * RING_M, top[2] * RING_M], a * 6);
        rp.set([top[0] * RING_M, -80000, top[2] * RING_M], a * 6 + 3);
        lp.set([top[0] * RING_M, EYE_M + top[1] * RING_M, top[2] * RING_M], a * 3);
        if (a < nA - 1) { var t0 = 2 * a, b0 = t0 + 1, t1 = t0 + 2, b1 = t0 + 3; ri.push(t0, b0, t1, t1, b0, b1); }
      }
      var rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3)); rg.setIndex(ri);
      ring.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x14120f, side: THREE.DoubleSide })));
      var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
      ring.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x9c8670 })));
    }
    scene.add(ring);

    // real stars (Yale Bright Star Catalogue), off by default; built on first use (ensureStars)
    var stars = new THREE.Group();
    stars.visible = false; scene.add(stars);

    // site marker: a thin post (not to scale) at the site
    var mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 40, 0]), 3));
    var markerMat = new THREE.LineBasicMaterial({ color: 0x6f7890 });
    var marker = new THREE.Line(mg, markerMat); scene.add(marker);

    // Rover (round 6): proportions of NASA's VIPER (Illustrative model). Published (NASA, rover-and-instruments page):
    // 2.5 m tall, 1.5 m long and 1.5 m wide, four wheel modules with active suspension and independent steering, headlights,
    // a 1 m drill. NOT published there (approximate proportions, labelled in "About this rover"): wheel size, body size and
    // ground clearance, mast and camera-head size, solar-panel layout, mass. Model axes: x right, y up, -z forward.
    // Round 6B: a detailed model (buildRover) within the same published envelope (2.5 m tall, 1.5 m x 1.5 m) and with the
    // same wheel contact points; lower detail on phones and at Low quality.
    var RB = buildRover(THREE, U, !!(o.phone || Q === QUALITY.low));
    var rover = RB.rover, roverBody = RB.body, roverWheels = RB.wheels, roverStruts = RB.arms;
    rover.visible = false; scene.add(rover);

    // rover track (fading trail) and 500 m distance rings around the site (draped on the ground when terrain is built)
    var trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRACK_MAX * 3), 3));
    trackGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRACK_MAX * 3), 3));
    trackGeo.setDrawRange(0, 0);
    var track = new THREE.Line(trackGeo, new THREE.LineBasicMaterial({ vertexColors: true }));
    track.frustumCulled = false; scene.add(track);
    var distRings = new THREE.Group(); distRings.visible = false; scene.add(distRings);

    return { THREE: THREE, T: T, TM: TM, Q: Q, U: U, nmapOK: nmapOK, nearNmOK: nearNmOK, maxAniso: maxAniso, floatLinear: floatLinear, refinePending: true, coarse: coarse !== stride, terrainMat: terrainMat, terrainGroup: terrainGroup, layers: [], ext: {},
      renderer: renderer, scene: scene, camera: camera, terrain: terrain, geo: geo, fill: fill, sun: sun, sunNear: sunNear, earthLight: earthLight,
      sunDisk: sunDisk, earth: earth, glare: glare, roverBody: roverBody, roverWheels: roverWheels, roverStruts: roverStruts, roverSpin: RB.spinners, roverTris: RB.triangles, roverLow: RB.low, track: track, trackN: 0, distRings: distRings, ring: ring, stars: stars, marker: marker, markerMat: markerMat, rover: rover };
  }

  // ------------------------------------------------------------ rover model (round 6B)
  // Illustrative model of NASA's VIPER. Published (NASA "VIPER rover and instruments" page): 2.5 m tall, 1.5 m long and
  // wide, four wheel modules with active suspension and independent steering, headlights, a 1 m drill (TRIDENT),
  // instruments NSS, NIRVSS and MSolo. The arrangement below (vertical solar panels on the left, right and rear sides,
  // mast with camera housings and lights at the front right, drill at the front left, wheel size and tread, body
  // sections, radiator, instrument positions) is approximate and labelled so in "About this rover"; it is not taken
  // from any measured drawing. Simple materials, no images, textures, logos or markings. Model axes: x right, y up,
  // -z forward; the body group is posed on the wheels by placeRover(). low = phones / Low quality (fewer segments,
  // no tread blocks or spokes, no cell grid).
  function buildRover(THREE, U, low) {
    var RV = ROVER, rover = new THREE.Group(), body = new THREE.Group(); rover.add(body);
    var M_ = function (c) { return litMaterial(THREE, U, c); };
    var white = M_(0xe4e4e2), silver = M_(0xa9adb4), grey = M_(0x55595f), dark = M_(0x24262a), gold = M_(0xc9a24a), cell = M_(0x1b2d52), black = M_(0x0e0f12);
    var lamp = new THREE.MeshBasicMaterial({ color: 0xfff6d0 }), lens = new THREE.MeshBasicMaterial({ color: 0x2a3550 });
    var seg = low ? 8 : 16;
    var add = function (geo, mat, x, y, z, parent, rx, ry, rz) { var m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = true; (parent || body).add(m); return m; };
    var box = function (w, h, d, mat, x, y, z, parent) { return add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent); };
    var cyl = function (r0, r1, h, mat, x, y, z, parent, rx, ry, rz, n) { return add(new THREE.CylinderGeometry(r0, r1, h, n || seg), mat, x, y, z, parent, rx, ry, rz); };
    var y0 = RV.clear, y1 = RV.clear + RV.bodyH, hw = RV.bodyW / 2, hl = RV.bodyL / 2;
    // chassis: lower avionics bay, upper body with a structural frame (corner posts, edge rails), gold thermal blanket
    // on the deck, a finned radiator plate, front and rear bumpers
    box(RV.bodyW - 0.08, 0.16, RV.bodyL - 0.08, grey, 0, y0 + 0.08, 0);
    box(RV.bodyW, RV.bodyH - 0.16, RV.bodyL, white, 0, y0 + 0.16 + (RV.bodyH - 0.16) / 2, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { box(0.05, RV.bodyH + 0.02, 0.05, silver, c[0] * (hw - 0.02), y0 + RV.bodyH / 2, c[1] * (hl - 0.02)); });
    [y0 + 0.16, y1].forEach(function (y) {
      box(RV.bodyW + 0.01, 0.03, 0.03, silver, 0, y, -hl); box(RV.bodyW + 0.01, 0.03, 0.03, silver, 0, y, hl);
      box(0.03, 0.03, RV.bodyL + 0.01, silver, -hw, y, 0); box(0.03, 0.03, RV.bodyL + 0.01, silver, hw, y, 0);
    });
    box(RV.bodyW * 0.92, 0.03, RV.bodyL * 0.92, gold, 0, y1 + 0.03, 0);                                   // thermal blanket
    box(0.5, 0.025, 0.42, white, -0.2, y1 + 0.06, 0.18);                                                 // radiator plate
    if (!low) for (var f = 0; f < 6; f++) box(0.48, 0.03, 0.012, silver, -0.2, y1 + 0.085, 0.0 + f * 0.07);   // radiator fins
    box(RV.bodyW * 0.8, 0.06, 0.05, dark, 0, y0 + 0.1, -hl - 0.03); box(RV.bodyW * 0.8, 0.06, 0.05, dark, 0, y0 + 0.1, hl + 0.03);   // bumpers
    // instrument housings (approximate positions): NIRVSS under the front, NSS under the rear, MSolo on the deck
    box(0.22, 0.12, 0.16, dark, 0.15, y0 - 0.04, -hl + 0.12); cyl(0.035, 0.035, 0.03, lens, 0.15, y0 - 0.11, -hl + 0.12, body, 0, 0, 0, 10);
    box(0.26, 0.1, 0.2, grey, -0.2, y0 - 0.03, hl - 0.18);
    box(0.16, 0.14, 0.16, silver, 0.22, y1 + 0.11, 0.2); cyl(0.04, 0.04, 0.06, dark, 0.22, y1 + 0.21, 0.2);
    // TRIDENT drill (1 m, published) in a frame at the front left (approximate position)
    var dx = -0.3, dz = -hl - 0.1;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) { box(0.02, 0.95, 0.02, silver, dx + c[0] * 0.07, y0 + 0.36, dz + c[1] * 0.06); });
    box(0.18, 0.12, 0.16, dark, dx, y0 + 0.86, dz);                                                      // drill motor housing
    cyl(0.025, 0.025, 1.0, silver, dx, y0 + 0.3, dz); cyl(0.04, 0.012, 0.08, dark, dx, y0 - 0.22, dz);   // drill rod and bit
    // headlights (published: "NASA's first rover with headlights"): two housings on the front face (position approximate)
    [-0.05, 0.38].forEach(function (x) { box(0.16, 0.09, 0.04, dark, x, y0 + 0.3, -hl - 0.02); box(0.12, 0.05, 0.01, lamp, x, y0 + 0.3, -hl - 0.045); });
    // solar panels, vertical on the left, right and rear sides (approximate layout; at the pole the Sun stays low): cell
    // plane, frame, cell grid, and mounting brackets to the body
    var pH = RV.panelH, pY = y1 + pH / 2 - 0.05, pL = RV.bodyL * 0.95;
    var panel = function (w, d, x, z, alongX) {
      box(w, pH, d, cell, x, pY, z);
      var fw = 0.025, ex = alongX ? w : d;
      [pY - pH / 2, pY + pH / 2].forEach(function (y) { if (alongX) box(w + fw, fw, d + 0.01, silver, x, y, z); else box(w + 0.01, fw, d + fw, silver, x, y, z); });
      [-1, 1].forEach(function (s) { if (alongX) box(fw, pH, d + 0.01, silver, x + s * w / 2, pY, z); else box(w + 0.01, pH, fw, silver, x, pY, z + s * d / 2); });
      if (!low) for (var k = 1; k < 4; k++) {
        var o = -ex / 2 + k * ex / 4;
        if (alongX) box(0.006, pH - 0.02, d + 0.004, black, x + o, pY, z); else box(w + 0.004, pH - 0.02, 0.006, black, x, pY, z + o);
        if (alongX) box(w - 0.02, 0.006, d + 0.004, black, x, pY - pH / 2 + k * pH / 4, z); else box(w + 0.004, 0.006, d - 0.02, black, x, pY - pH / 2 + k * pH / 4, z);
      }
    };
    panel(0.03, pL, -hw - 0.02, 0, false); panel(0.03, pL, hw + 0.02, 0, false); panel(RV.bodyW * 0.95, 0.03, 0, hl + 0.02, true);
    [-1, 1].forEach(function (s) { [-0.3, 0.3].forEach(function (z) { box(0.05, 0.04, 0.04, silver, s * (hw - 0.005), y1 - 0.02, z); }); box(0.04, 0.04, 0.05, silver, s * 0.3, y1 - 0.02, hl - 0.005); });
    // mast (front right): turret, tube, pan/tilt joint, camera head; top of the head = 2.5 m (published overall height)
    var mx = 0.25, mz = -hl + 0.2, headB = RV.height - RV.headH, mastH = headB - 0.08 - (y1 + 0.12);
    cyl(0.09, 0.11, 0.12, grey, mx, y1 + 0.06, mz);
    cyl(0.04, 0.05, mastH, white, mx, y1 + 0.12 + mastH / 2, mz);
    cyl(0.06, 0.06, 0.08, dark, mx, headB - 0.04, mz, body, 0, 0, Math.PI / 2);                         // tilt joint
    box(0.4, RV.headH, 0.16, dark, mx, RV.height - RV.headH / 2, mz);                                     // camera head
    // camera housings: two stereo pairs facing forward, each with a lens; a light bar under the head
    [-0.13, -0.06, 0.06, 0.13].forEach(function (x) { box(0.055, 0.07, 0.04, grey, mx + x, RV.height - RV.headH / 2, mz - 0.1); cyl(0.018, 0.018, 0.012, lens, mx + x, RV.height - RV.headH / 2, mz - 0.125, body, Math.PI / 2, 0, 0, 10); });
    box(0.26, 0.025, 0.02, lamp, mx, headB - 0.01, mz - 0.075);
    // wheel modules: each wheel (a group placed on the LOLA surface every frame; local y = axle, local x = up) with a
    // steering housing and a fork on its inner side; the spinner (tyre, rims, hub, spokes, tread blocks) turns as the
    // rover drives. A suspension arm (a cylinder updated every frame) joins the housing to the body.
    var R = RV.wheelR, W = RV.wheelW, wheels = [], spinners = [], arms = [];
    var nW = low ? 14 : 28, tyreG = new THREE.CylinderGeometry(R - 0.018, R - 0.018, W, nW, 1, true), rimG = new THREE.CylinderGeometry(R - 0.012, R - 0.012, 0.012, nW, 1, true), discG = new THREE.CylinderGeometry(R - 0.03, R - 0.03, 0.01, nW);
    var hubG = new THREE.CylinderGeometry(0.06, 0.06, W - 0.01, seg), grouserG = new THREE.BoxGeometry(0.014, W, 0.03), spokeG = new THREE.BoxGeometry(R - 0.08, 0.012, 0.03);
    var armG = new THREE.CylinderGeometry(0.028, 0.028, 1, low ? 6 : 10);
    RV.wheels.forEach(function (w) {
      var g = new THREE.Group(), sp = new THREE.Group(), side = w[0] > 0 ? 1 : -1;   // local +y points to body -x: inner side = side
      g.add(sp); rover.add(g); wheels.push(g); spinners.push(sp);
      add(tyreG, dark, 0, 0, 0, sp);
      // open tyre band with rim lips at both edges and a wheel disc set 4-6 cm in from each face (no coplanar faces)
      [-1, 1].forEach(function (s) { add(rimG, silver, 0, s * (W / 2 - 0.006), 0, sp); add(discG, grey, 0, s * (W / 2 - 0.06), 0, sp); });
      add(hubG, silver, 0, 0, 0, sp);
      if (!low) {
        for (var k = 0; k < 18; k++) { var a = k / 18 * 2 * Math.PI, m = add(grouserG, black, Math.cos(a) * (R - 0.007), 0, Math.sin(a) * (R - 0.007), sp); m.rotation.y = -a; }   // tread blocks: outer edge at the wheel radius
        for (var q = 0; q < 6; q++) { var b = q / 6 * 2 * Math.PI, sk = add(spokeG, grey, Math.cos(b) * (R - 0.02) / 2, -side * (W / 2 - 0.03), Math.sin(b) * (R - 0.02) / 2, sp); sk.rotation.y = -b; }
      } else for (var k2 = 0; k2 < 8; k2++) { var a2 = k2 / 8 * 2 * Math.PI, m2 = add(grouserG, black, Math.cos(a2) * (R - 0.007), 0, Math.sin(a2) * (R - 0.007), sp); m2.rotation.y = -a2; }
      add(new THREE.BoxGeometry(R + 0.1, 0.025, 0.09), grey, (R + 0.1) / 2, side * (W / 2 + 0.03), 0, g);   // fork plate (inner side)
      add(new THREE.CylinderGeometry(0.075, 0.075, 0.1, seg), silver, R + 0.12, side * 0.03, 0, g, 0, 0, Math.PI / 2);   // steering housing (axis = up)
      var arm = new THREE.Mesh(armG, silver); arm.castShadow = true; rover.add(arm); arms.push(arm);
    });
    var tris = 0;
    rover.traverse(function (m) { if (m.isMesh) { var gg = m.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
    return { rover: rover, body: body, wheels: wheels, spinners: spinners, arms: arms, triangles: tris, low: low };
  }

  function decimate(T, stride) {
    if (stride <= 1) return T;
    var mm = Math.floor((T.n - 1) / stride) + 1, H2 = new Float32Array(mm * mm);
    for (var j = 0; j < mm; j++) for (var i = 0; i < mm; i++) H2[j * mm + i] = T.H[(j * stride) * T.n + i * stride];
    return { id: T.id, n: mm, d: T.d * stride, c: (mm - 1) / 2, h0: T.h0, R: T.R, half: (mm - 1) / 2 * T.d * stride, H: H2, meta: T.meta, k: T.k };
  }
  // Terrain material: the same grey as before, with the Lommel-Seeliger law for the Sun term (a standard photometric
  // model for regolith; e.g. Hapke 2012, "Theory of Reflectance and Emittance Spectroscopy", 2nd ed.): reflectance
  // proportional to mu0 / (mu0 + mu) (mu0, mu = cosines of the incidence and emission angles) instead of Lambert's mu0.
  // Written as Lambert x 1 / (mu0 + mu): equal to the previous Lambert picture where mu0 + mu = 1, brighter toward
  // grazing views (the flat, limb-bright look of the Moon), darker where both cosines are large. Uniform albedo (no
  // public LOLA albedo map at <= 250 m/pixel was found; see the notes). Optional real-data overlays from the DEM:
  // contour lines (true heights, interval uContour) and slope classes (uSlope).
  // Round 6: one material per terrain layer (each may carry its own normal map), sharing the global uniforms U.
  // opts.nmap: the layer's normal map (DataTexture of the x/z normal components, see M.bakeNormalXZ) - lighting detail
  // from the finest loaded LOLA grid of that area where the drawn mesh is coarser. Band uniforms (per layer): in the
  // outer part of the layer (edge distance > uBand0, 0 = centre, 1 = edge) the normal map is sampled at a coarser mip
  // level (bias up to uBandBias; mip levels are averages of real normals) or, without a map, the normal is blended
  // toward the smoothed DEM normal (uBandMix), so the amount of detail changes gradually toward the coarser
  // neighbouring mesh instead of in a visible step. Heights and vertex positions are never changed by this.
  // Round 6E: close-range surface texture (Illustrative, display only; Walk and Rover; owner decision, see design
  // decision 15). A procedural "carpet" drawn only in the fragment shader, in the site-centred ground frame (world x =
  // east, z = -north, metres), so it is fixed to the ground and continuous across the tile, the 5 m patch and the rings.
  //   1. albedo: value noise, 7 octaves of 6.4 m down to 0.1 m (each rotated), about +-5 % (mean 0: values -1..1);
  //   2. micro-relief: the same octaves as a height field of amplitude 0.035 x wavelength (rms slope about 6 deg);
  //   3. craterlets (radius 0.1-5 m, bowl + raised rim, depth up to 0.35 R) and rock flecks (radius 0.04-0.4 m, domes,
  //      +15 % albedo), one candidate per grid cell, fewer per area as the size grows. Sizes and densities are tuned
  //      visually, not statistically matched to published crater or rock counts.
  // Detail normal: partial-derivative blend on the LOLA height field (n / n_up - grad h), so it follows every LOLA slope;
  // the pattern is projected on the horizontal ground frame, and craterlet radii are measured along the LOLA surface
  // (slope-aware). Each octave / feature fades out when it is smaller than about 2-4 screen pixels (dFdx/dFdy of the
  // world position: no shimmer), and the whole covering fades from uCovNear to uCovFar metres from the camera.
  // Hashes: Gustavson's mod-289 permutation (exact in float32 for these cell indices; no sin() of large numbers).
  var COVER_GLSL = [
    'float asPm( float x ) { return mod( ( x * 34.0 + 1.0 ) * x, 289.0 ); }',
    'float asH( vec2 c ) { c = mod( c, 289.0 ); return asPm( asPm( c.x ) + c.y ) / 289.0; }',
    // value noise: x = value (-1..1), yz = gradient w.r.t. p, w = a second, independent value (-1..1) for the albedo
    'vec4 asVN( vec2 p ) {',
    '  vec2 i = floor( p ), f = p - i;',
    '  vec2 u = f * f * ( 3.0 - 2.0 * f ), du = 6.0 * f * ( 1.0 - f );',
    '  float a = asH( i ), b = asH( i + vec2( 1.0, 0.0 ) ), c = asH( i + vec2( 0.0, 1.0 ) ), d = asH( i + vec2( 1.0, 1.0 ) );',
    '  float k = a - b - c + d;',
    '  float v = a + ( b - a ) * u.x + ( c - a ) * u.y + k * u.x * u.y;',
    '  vec2 g = du * vec2( b - a + k * u.y, c - a + k * u.x );',
    '  vec4 q = fract( vec4( a, b, c, d ) * 61.0 + 0.37 );',
    '  float k2 = q.x - q.y - q.z + q.w;',
    '  float v2 = q.x + ( q.y - q.x ) * u.x + ( q.z - q.x ) * u.y + k2 * u.x * u.y;',
    '  return vec4( 2.0 * v - 1.0, 2.0 * g, 2.0 * v2 - 1.0 );',
    '}',
    // round 6F: hash over unbounded cell indices - a different permutation in every 289 x 289 block of cells, so the
    // feature pattern does not repeat every 289 cells (asH alone would repeat every 405 m for the 1.4 m class)
    'float asHB( vec2 c ) { vec2 b = floor( c / 289.0 ); return asH( c + floor( vec2( asH( b + 3.0 ), asH( b + 19.0 ) ) * 289.0 + 0.5 ) ); }',
    // round 6F: profile of one feature at offset d (world xz, metres): x = height (m), y = albedo change.
    // P0 = (R, aspect, cos, sin of the orientation), P1 = (depth, rim height (both in units of R), rim width, freshness),
    // P2 = (three phases of the rim noise, interior albedo), kind 0 = craterlet, 1 = rock fleck.
    'vec2 asProf( vec2 d, vec4 P0, vec4 P1, vec4 P2, float kind, vec3 nW ) {',
    '  float dy = -( nW.x * d.x + nW.z * d.y ) / max( nW.y, 0.2 );',   // slope-aware: radii measured along the LOLA surface
    '  vec2 q = vec2( P0.z * d.x + P0.w * d.y, -P0.w * d.x + P0.z * d.y ); q.y *= P0.y;',   // elliptical (aspect P0.y)
    '  float r = length( vec3( q.x, dy, q.y ) ), phi = r > 1e-5 ? atan( q.y, q.x ) : 0.0;',
    '  float m1 = 0.6 * sin( 2.0 * phi + P2.x ) + 0.4 * sin( 3.0 * phi + P2.y );',   // low-frequency noise around the rim
    '  float m2 = 0.5 * sin( phi + P2.z ) + 0.5 * sin( 4.0 * phi + P2.x - P2.y );',
    '  float R = P0.x, s = P1.w;',
    '  if ( kind < 0.5 ) {',
    '    float Rl = R * ( 1.0 + 0.10 * m1 ), t = r / Rl;',   // irregular rim radius
    '    if ( t >= 2.0 ) return vec2( 0.0 );',
    '    float rim = P1.y * clamp( 0.55 + 1.1 * m2, 0.0, 1.7 ), h;',   // rim height varies around the rim, partly broken
    '    if ( t < 1.0 ) { float t2 = t * t; h = -P1.x + ( P1.x + rim ) * mix( t2 * ( 3.0 - 2.0 * t ), t2, s ); }',   // old: rounded; fresh: sharp crest
    '    else { float u = ( t - 1.0 ) / P1.z; h = rim * exp( -u * u ); }',
    '    float al = P2.w * ( 1.0 - smoothstep( 0.6, 1.0, t ) ) + 0.10 * max( 0.0, s - 0.85 ) / 0.15 * ( 1.0 - smoothstep( 0.9, 1.8, t ) );',   // interior albedo; bright halo for the freshest
    '    return vec2( h * R, al );',
    '  }',
    '  float Rl = R * ( 1.0 + 0.25 * m1 + 0.12 * m2 ), t = r / Rl;',   // rock fleck: irregular outline
    '  if ( t >= 1.0 ) return vec2( 0.0 );',
    '  return vec2( P1.x * ( 1.0 - t * t ) * R, P2.w * ( 1.0 - smoothstep( 0.75, 1.0, t ) ) );',
    '}',
    // one candidate feature per cell of size C (probability pr, radius rmin..rmax, more small than large) on a lattice
    // rotated and offset per class (seed), position jittered inside the cell; kind 0 = craterlet, 1 = rock fleck.
    // Adds to the height gradient g (per metre, numerical: forward differences of the profile) and the albedo a.
    'void asFeat( vec2 p, float C, float pr, float rmin, float rmax, float seed, float kind, vec3 nW, float fp, inout vec2 g, inout float a ) {',
    '  float ca = cos( seed ), sa = sin( seed );',
    '  vec2 o = vec2( 7.31, 3.17 ) * seed, pq = vec2( ca * p.x + sa * p.y, -sa * p.x + ca * p.y ) + o;',
    '  vec2 cl = floor( pq / C ), c = cl + seed;',
    '  float h1 = asHB( c ); if ( h1 > pr ) return;',
    '  float h2 = asHB( c + vec2( 57.0, 11.0 ) ), h3 = asHB( c + vec2( 3.0, 91.0 ) ), h4 = asHB( c + vec2( 41.0, 7.0 ) ), h5 = asHB( c + vec2( 13.0, 29.0 ) ), h6 = asHB( c + vec2( 71.0, 53.0 ) );',
    '  float R = mix( rmin, rmax, h2 * h2 );',
    '  float w = 1.0 - smoothstep( 0.5 * R, R, fp ); if ( w <= 0.0 ) return;',
    '  float ext = kind < 0.5 ? 2.2 : 1.4;',   // largest extent in units of R (rim noise included)
    '  vec2 cq = ( cl + 0.5 + ( vec2( h3, h4 ) - 0.5 ) * max( 0.0, 1.0 - 2.0 * ext * R / C ) ) * C - o;',
    '  vec2 d = p - vec2( ca * cq.x - sa * cq.y, sa * cq.x + ca * cq.y );',
    '  if ( dot( d, d ) >= ext * ext * R * R ) return;',
    '  float r1 = fract( h1 * 13.7 + h2 * 5.3 ), r2 = fract( h3 * 17.3 + h5 * 3.9 ), r3 = fract( h4 * 23.1 + h6 * 7.7 ), r4 = fract( h5 * 29.9 + h2 * 11.3 ), r5 = fract( h6 * 31.3 + h3 * 2.9 );',
    '  float th = 6.2832 * r2, s = h5 * h5 * h5;',   // freshness 0 (old) .. 1 (fresh): most are old, a few fresh
    '  vec4 P0 = vec4( R, 1.0 + 0.3 * r1, cos( th ), sin( th ) ), P1, P2 = vec4( 6.2832 * r3, 6.2832 * r4, 6.2832 * r5, 0.0 );',
    '  if ( kind < 0.5 ) { P1 = vec4( mix( 0.03, 0.38, s ) * ( 0.75 + 0.5 * h6 ), mix( 0.008, 0.09, s ) * ( 0.7 + 0.6 * r1 ), mix( 0.30, 0.16, s ), s ); P2.w = 0.08 * ( r5 - 0.5 ) + 0.03 * s; }',
    '  else { P0.y = 1.0 + 0.4 * r1; P1 = vec4( 0.3 + 0.4 * r3, 0.0, 1.0, 0.0 ); P2.w = 0.05 + 0.20 * h6; }',
    '  float e = 0.04 * R; vec2 f0 = vec2( 0.0 ); float hx = 0.0, hy = 0.0;',
    '  for ( int j = 0; j < 3; j++ ) {',
    '    if ( float( j ) >= uCov3 ) break;',
    '    vec2 f = asProf( d + ( j == 1 ? vec2( e, 0.0 ) : j == 2 ? vec2( 0.0, e ) : vec2( 0.0 ) ), P0, P1, P2, kind, nW );',
    '    if ( j == 0 ) f0 = f; else if ( j == 1 ) hx = f.x; else hy = f.x;',
    '  }',
    '  g += w * vec2( hx - f0.x, hy - f0.x ) / e;',
    '  a += w * f0.y;',
    '}',
    // computes asCov (strength), asAlb (albedo factor) and asDN (first-order change of the unit normal when the detail height field is added to the LOLA surface, view space; linear in the detail gradient, so its mean is zero) from the final LOLA normal n
    'void asCover( vec3 n ) {',
    '  vec3 wdx = dFdx( vW ), wdy = dFdy( vW );',
    '  float fp = max( length( wdx ), length( wdy ) );',
    '  asCov = uCover * ( 1.0 - smoothstep( uCovNear, uCovFar, length( vW - uCamW ) ) );',   // round 6F: uCamW, not cameraPosition (see U.uCamW)
    '  if ( asCov <= 0.0 ) return;',
    '  vec3 nW = normalize( ( vec4( n, 0.0 ) * viewMatrix ).xyz );',
    '  vec2 p = vW.xz, g = vec2( 0.0 );',
    '  float a = 0.0, lam = 6.4;',
    // round 6F: domain warp (up to about 4 m, wavelength 23 m) and a patchy strength (0.75-1.25), so the grain is not uniform
    '  vec4 wq = asVN( p / 23.0 + vec2( 3.7, 1.3 ) ), wq2 = asVN( p / 23.0 + vec2( 11.3, 5.9 ) );',
    '  vec2 pw = p + 4.0 * vec2( wq.x, wq2.x );',
    '  float pa = 1.0 + 0.25 * wq2.w;',
    '  mat2 Rk = mat2( 1.0, 0.0, 0.0, 1.0 ), R1 = mat2( 0.8, -0.6, 0.6, 0.8 );',
    '  for ( int k = 0; k < 7; k++ ) {',
    '    if ( float( k ) >= uCovOct ) break;',
    '    float w = 1.0 - smoothstep( 0.25 * lam, 0.5 * lam, fp );',
    '    if ( w <= 0.0 ) break;',
    '    vec4 q = asVN( Rk * pw / lam + vec2( 17.0, 31.0 ) * float( k ) );',
    '    g += w * pa * 0.006 * exp2( 0.4 * float( k ) ) * ( q.yz * Rk );',
    '    a += w * pa * ( lam > 1.0 ? 0.022 : 0.015 ) * q.w;',
    '    lam *= 0.5; Rk = Rk * R1;',
    '  }',
    '  if ( uCovDbg > 2.5 ) { g = vec2( 0.0 ); a = 0.0; }',
    // round 6F: craterlets in four size classes (largest radius COVER_RMAX m, below the DEM grid scale); on laptops at
    // Medium/High two extra lattices of the middle classes (overlapping craterlets); rock flecks in two classes (the
    // smaller one not on Low/phones)
    // (one call site in a loop over the classes of COVER_CLASSES, uniforms uCovA/uCovB, so the feature code is compiled
    // once: unrolled copies made the first compile on Windows/D3D take many seconds)
    '  float nF = uCovOct > 5.5 ? ' + COVER_CLASSES.length.toFixed(1) + ' : ' + COVER_CLASSES_LOW.toFixed(1) + ';',
    '  for ( int i = 0; i < ' + COVER_CLASSES.length + '; i++ ) {',
    '    if ( float( i ) >= nF ) break;',
    '    asFeat( p, uCovA[ i ].x, uCovA[ i ].y, uCovA[ i ].z, uCovA[ i ].w, uCovB[ i ].x, uCovB[ i ].y, nW, fp, g, a );',
    '  }',
    // uCovDbg (tests only, round 6E diagnostics): 1 = albedo only, 2 = micro-relief and features only, 3 = features only
    '  if ( uCovDbg > 0.5 ) { if ( uCovDbg < 1.5 ) g = vec2( 0.0 ); else a = 0.0; }',
    // wheel tracks: two strips at +-WHEEL_HALF m from the path (uTrk, oldest first), darker by up to 7 %, fading with
    // the distance driven since (to 0 at the oldest point) and when a strip is narrower than about 2 screen pixels
    '  if ( uTrkN > 1.5 ) {',
    '    float tw = 1.0 - smoothstep( 0.5 * ' + WHEEL_W.toFixed(2) + ', ' + WHEEL_W.toFixed(2) + ', fp );',
    '    if ( tw > 0.0 ) {',
    '      float tr = 0.0;',
    '      for ( int k = 0; k < 63; k++ ) {',
    '        if ( float( k ) >= uTrkN - 1.5 ) break;',
    '        vec2 A = uTrk[ k ], B = uTrk[ k + 1 ], AB = B - A; float L2 = dot( AB, AB ); if ( L2 < 1e-4 ) continue;',
    '        float t = clamp( dot( p - A, AB ) / L2, 0.0, 1.0 ); vec2 dp = p - A - t * AB;',
    '        if ( dot( dp, dp ) > 1.0 ) continue;',
    '        float lat = abs( ( AB.x * ( p.y - A.y ) - AB.y * ( p.x - A.x ) ) / sqrt( L2 ) );',
    '        float st = 1.0 - smoothstep( 0.35 * ' + WHEEL_W.toFixed(2) + ', 0.5 * ' + WHEEL_W.toFixed(2) + ', abs( lat - ' + WHEEL_HALF.toFixed(2) + ' ) );',
    '        tr = max( tr, st * ( float( k ) + t + 1.0 ) / ( uTrkN - 1.0 ) );',
    '      }',
    '      a -= 0.07 * tw * tr;',
    '    }',
    '  }',
    '  asAlb = 1.0 + asCov * a;',
    '  g *= asCov;',
    '  vec3 up = vec3( viewMatrix[ 1 ] );',   // world +y (up) in view space
    '  vec3 G = g.x * vec3( viewMatrix[ 0 ] ) + g.y * vec3( viewMatrix[ 2 ] );',
    '  asDN = -max( dot( n, up ), 0.2 ) * ( G - n * dot( n, G ) );',
    '}'
  ].join('\n') + '\n';
  function regolithMaterial(THREE, U, opts) {
    opts = opts || {};
    var mat = new THREE.MeshLambertMaterial({ color: 0x9c9a95 });
    var L = { uNMap: { value: opts.nmap || null }, uBand0: { value: opts.band0 || 0.9 }, uBandBias: { value: opts.bandBias || 0 }, uBandMix: { value: opts.bandMix || 0 }, uReliefD: { value: opts.reliefD || 20 },
      uAOMap: { value: opts.ao || null }, uAOBand0: { value: opts.aoBand0 || 0.9 } };
    mat.userData.uniforms = U; mat.userData.local = L; mat.userData.aoGrid = opts.aoGrid || null;
    mat.defines = {};
    if (opts.nmap) mat.defines.AS_NMAP = '';
    if (opts.ao) mat.defines.AS_AO = '';
    mat.onBeforeCompile = function (sh) {
      ['uContour', 'uSlope', 'uRelief', 'uFlat', 'uLambert', 'uReliefK', 'uAO', 'uVNorm', 'uCover', 'uCovOct', 'uCovNear', 'uCovFar', 'uCovDbg', 'uCamW', 'uCov3', 'uCovA', 'uCovB', 'uTrk', 'uTrkN'].forEach(function (k) { sh.uniforms[k] = U[k]; });
      Object.keys(L).forEach(function (k) { sh.uniforms[k] = L[k]; });
      lightsPatch(sh, U);
      sh.vertexShader = 'attribute float aH;\nattribute float aS;\nattribute vec3 aNs;\nattribute vec2 aG;\nvarying float vH;\nvarying float vS;\nvarying vec3 vNs;\nvarying vec2 vG;\nvarying vec3 vW;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = aH; vS = aS; vNs = normalMatrix * aNs; vG = aG; vW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
      var chunk = THREE.ShaderChunk.lights_lambert_pars_fragment, from = 'vec3 irradiance = dotNL * directLight.color;';
      if (chunk.indexOf(from) < 0) throw new Error('unexpected three.js Lambert shader');
      // Relief shading (round 5, display option, default on in Walk/Rover). Lommel-Seeliger divides cos i by
      // (cos i + cos e): at the grazing views of Walk/Rover both cosines are small, so slopes facing toward or away
      // from the low Sun look almost alike and sunlit ground tends to one flat bright tone. Relief shading keeps that
      // law at 70 % and adds a local-contrast term: the difference in cos i between the full-resolution DEM normal and
      // a smoothed DEM normal (central differences over +-4 cells, attribute aNs), divided by the flat-ground value uFlat
      // (sine of the Sun's elevation, at least 0.06). Both normals come from the LOLA heights; nothing is added to them.
      // Heights, normals, shadows and the light direction are unchanged; only the displayed brightness changes.
      // uLambert (tests only): plain Lambert cos i, the round-3 law.
      // Round 6C: the local contrast is applied as a bounded factor on the Lommel-Seeliger value instead of being added to
      // 70 % of it, and it follows the Lambert brightness ratio between the DEM normal and the smoothed DEM normal:
      // factor = 1 + 0.6 tanh(0.9 (cos i - cos i_s) / cos i_s) (cos i_s at least 0.06), i.e. between 0.4 and 1.6; for small
      // differences it restores about half of the relative (Lambert) contrast that Lommel-Seeliger removes at grazing
      // views. Before, the difference was divided by the sine of the Sun's elevation over flat ground (a gain of 10 at a
      // low Sun, also on slopes facing the Sun): whole slopes clipped to black (or white) and the mean brightness rose
      // (measured: Mons Malapert Rover foreground mean 7.9/255 with std 0.2, i.e. black; Peak near Shackleton Walk mean
      // 183 vs 95 without relief). Same inputs (DEM normal, smoothed DEM normal, light direction); display only.
      chunk = chunk.replace(from, 'float muV = saturate( dot( geometry.normal, geometry.viewDir ) );\n\tfloat lsT = dotNL / max( dotNL + muV, 0.05 );\n' +
        '\tvec3 nsV = dot( vNs, vNs ) > 0.25 ? normalize( vNs ) : geometry.normal;\n' +
        '\tfloat asNsL = saturate( dot( nsV, directLight.direction ) );\n' +
        '\tfloat asX = clamp( 0.9 * asRelW * ( dotNL - asNsL ) / max( asNsL, 0.06 ), -8.0, 8.0 ), asE2 = exp( 2.0 * asX );\n' +
        '\tfloat relT = lsT * ( 1.0 + 0.6 * ( asE2 - 1.0 ) / ( asE2 + 1.0 ) );\n' +
        '\tvec3 irradiance = ( uLambert > 0.5 ? dotNL : mix( lsT, relT, uRelief ) ) * directLight.color;\n' +
        // round 6E: close-range surface texture (Illustrative). Only a bounded factor on the SUN term: the albedo variation
        // times 1 + 0.6 tanh(0.8 (cos i_detail - cos i) / cos i), cos i from the LOLA normal (dotNL). Where the LOLA sunlight
        // term or the shadow factor (already in directLight.color) is 0, irradiance stays 0: no light on back-facing or
        // shadowed ground. Earthshine and the fill light are untouched.
        '\tif ( asCov > 0.0 && asIsSun > 0.5 ) {\n' +
        '\t\tfloat asDL = dot( asDN, directLight.direction );\n' +
        '\t\tfloat asY = clamp( 0.8 * asDL / max( dotNL, 0.04 ), -8.0, 8.0 ), asE3 = exp( 2.0 * asY );\n' +
        '\t\tirradiance *= asAlb * ( 1.0 + 0.45 * ( asE3 - 1.0 ) / ( asE3 + 1.0 ) );\n' +
        '\t}');
      sh.fragmentShader = 'uniform float uContour;\nuniform float uSlope;\nuniform float uRelief;\nuniform float uFlat;\nuniform float uLambert;\nuniform float uReliefK;\nuniform float uReliefD;\nuniform float uAO;\nuniform float uVNorm;\nuniform sampler2D uAOMap;\nuniform float uAOBand0;\nfloat asRelW = 1.0;\nuniform float uCover;\nuniform float uCovOct;\nuniform float uCovNear;\nuniform float uCovFar;\nuniform float uCovDbg;\nuniform vec3 uCamW;\nuniform float uCov3;\nuniform vec4 uCovA[ ' + COVER_CLASSES.length + ' ];\nuniform vec2 uCovB[ ' + COVER_CLASSES.length + ' ];\nuniform vec2 uTrk[ 64 ];\nuniform float uTrkN;\nvarying vec3 vW;\nfloat asCov = 0.0;\nfloat asAlb = 1.0;\nvec3 asDN = vec3( 0.0, 0.0, 1.0 );\n' + COVER_GLSL + 'uniform sampler2D uNMap;\nuniform float uBand0;\nuniform float uBandBias;\nuniform float uBandMix;\nvarying float vH;\nvarying float vS;\nvarying vec3 vNs;\nvarying vec2 vG;\n' +
        sh.fragmentShader
          .replace('#include <lights_lambert_pars_fragment>', chunk)
          .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' +
            'float asBand = smoothstep( uBand0, 1.0, max( abs( vG.x - 0.5 ), abs( vG.y - 0.5 ) ) * 2.0 );\n' +
            '#ifdef AS_NMAP\n' +
            'if ( uVNorm < 0.5 ) {\n' +   // uVNorm: test-only switch back to the per-vertex normals (round 6C diagnostics)
            '  vec2 asN = texture2D( uNMap, vG, uBandBias * asBand ).rg;\n' +
            '  normal = normalize( mat3( viewMatrix ) * vec3( asN.x, sqrt( max( 0.0, 1.0 - dot( asN, asN ) ) ), asN.y ) );\n' +
            '}\n' +
            '#endif\n' +
            'if ( uBandMix > 0.0 && dot( vNs, vNs ) > 0.25 ) normal = normalize( mix( normal, normalize( vNs ), uBandMix * asBand ) );\n' +
            // round 6B: relief contrast normalised by data spacing and viewing distance. The local-contrast term shows relief
            // between the layer's grid spacing (uReliefD) and a few spacings; where one screen pixel covers more ground than
            // uReliefK x uReliefD that relief is smaller than a pixel and only adds grain (and, clipped at zero, a brighter
            // mean), so the term is scaled by (uReliefK x uReliefD / pixel footprint), at most 1. Every layer then shows the
            // relief it can resolve at the current distance, and the 6 km tile no longer stands out as a square.
            'asRelW = clamp( uReliefK * uReliefD / max( max( length( dFdx( vViewPosition ) ), length( dFdy( vViewPosition ) ) ), 1e-3 ), 0.0, 1.0 );\n' +
            // with relief on, a layer without a normal map (5 m patch, tile, rings on Low) likewise blends its per-vertex DEM
            // normal toward the smoothed DEM normal (average of real normals over +-4 cells) where relief is below a pixel:
            // the counterpart of the normal maps' mipmaps (averaged real normals), so tile and rings look alike at distance.
            '#ifndef AS_NMAP\n' +
            'if ( uRelief > 0.5 && dot( vNs, vNs ) > 0.25 ) normal = normalize( mix( normalize( vNs ), normal, asRelW ) );\n' +
            '#endif\n' +
            'if ( uCover > 0.0 ) asCover( normal );')
          // round 6C: openness shading (Walk/Rover, display only): the light reflected by the ground is scaled by
          // 1 - AO_GAIN x (1 - SVF), SVF = sky-view factor from the LOLA heights (texture value v: SVF = 0.5 + 0.5 v); faded
          // out over the layer's outer band (uAOBand0) so the 6 km tile does not end in a step
          .replace('#include <aomap_fragment>', '#include <aomap_fragment>\n' +
            '#ifdef AS_AO\n' +
            'if ( uAO > 0.0 ) {\n' +
            '  float asAOw = uAO * ( 1.0 - smoothstep( uAOBand0, 1.0, max( abs( vG.x - 0.5 ), abs( vG.y - 0.5 ) ) * 2.0 ) );\n' +
            '  float asSvf = 0.5 + 0.5 * texture2D( uAOMap, vG ).r;\n' +
            '  float asK = mix( 1.0, clamp( 1.0 - ' + AO_GAIN.toFixed(2) + ' * ( 1.0 - asSvf ), 0.0, 1.0 ), asAOw );\n' +
            '  reflectedLight.directDiffuse *= asK; reflectedLight.indirectDiffuse *= asK;\n' +
            '}\n' +
            '#endif\n')
          .replace('#include <color_fragment>', '#include <color_fragment>\n' +
            'if ( uSlope > 0.5 ) {\n' +
            '  vec3 sc = uSlope > 99.0 ? ( vS > uSlope - 100.0 ? vec3( 0.95, 0.15, 0.55 ) : diffuseColor.rgb ) : vS < 10.0 ? diffuseColor.rgb : vS < 20.0 ? vec3( 0.93, 0.80, 0.25 ) : vS < 30.0 ? vec3( 0.95, 0.50, 0.15 ) : vec3( 0.85, 0.18, 0.18 );\n' +
            '  diffuseColor.rgb = mix( diffuseColor.rgb, sc, 0.6 );\n}')
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' +
            'if ( uContour > 0.0 ) {\n' +
            '  float q = vH / uContour, w = fwidth( q );\n' +
            '  float line = 1.0 - smoothstep( 0.0, 1.2 * w, min( fract( q ), 1.0 - fract( q ) ) );\n' +
            '  float major = abs( mod( floor( q + 0.5 ), 5.0 ) ) < 0.5 ? 1.0 : 0.6;\n' +
            '  gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( 0.35, 0.85, 1.0 ), line * major * step( w, 0.5 ) );\n}');
    };
    mat.customProgramCacheKey = function () { return 'asteria-regolith-6e' + (opts.nmap ? '-nm' : '') + (opts.ao ? '-ao' : '') + (U.cascade ? '-cs' : ''); };
    return mat;
  }
  // Round 6: the directional-light loop for every lit material of the view (terrain and rover). Lights, in this order
  // (Three.js puts shadow-casting lights first, in the order they were added): with a cascade (Medium/High)
  //   0 = Sun, near cascade (camera-centred shadow map; adds no light itself), 1 = Sun (whole terrain), 2 = Earthshine;
  // without (Low): 0 = Sun, 1 = Earthshine. The Sun's shadow factor is the near cascade's where the point lies inside
  // it is min(full map, near map) (the near map blended in over its outer 8 %): both use the same light direction and
  // the same shadow-casting terrain, and the near map can only ADD the finer shadows the full map's coarser texels miss
  // (sharper, smaller shadows near the camera); it never lights ground the full map shadows. (Measured: on its own, the
  // finer map turned 3 of 264 grazing-Sun cases at the site marker from shadow to lit; tests/shading_consistency.js.)
  // uNoShadow: the "shadows" checkbox (receivers ignore all shadow maps).
  function lightsPatch(sh, U) {
    sh.uniforms.uNoShadow = U.uNoShadow; sh.uniforms.uCascadeOn = U.uCascadeOn;
    var chunk = window.THREE.ShaderChunk.lights_fragment_begin;
    var from = '\t\tdirectLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t#endif\n\t\tRE_Direct( directLight, geometry, material, reflectedLight );';
    var a = '\t\tgetDirectionalLightInfo( directionalLight, geometry, directLight );', b = '\tDirectionalLight directionalLight;';
    if (chunk.indexOf(from) < 0 || chunk.indexOf(a) < 0 || chunk.indexOf(b) < 0) throw new Error('unexpected three.js light loop');
    var to = '\t\tasIsSun = UNROLLED_LOOP_INDEX == ' + (U.cascade ? 1 : 0) + ' ? 1.0 : 0.0;\n' +
      '\t\tasSh = ( directLight.visible && receiveShadow && uNoShadow < 0.5 ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n' +
      (U.cascade ?
        '\t\tif ( UNROLLED_LOOP_INDEX == 0 ) {\n\t\t\tvec3 asC = vDirectionalShadowCoord[ i ].xyz / vDirectionalShadowCoord[ i ].w;\n' +
        '\t\t\tfloat asM = min( min( asC.x, 1.0 - asC.x ), min( asC.y, 1.0 - asC.y ) );\n' +
        '\t\t\tasNearW = ( asC.z >= 0.0 && asC.z <= 1.0 ) ? smoothstep( 0.0, 0.08, asM ) * uCascadeOn : 0.0; asNearSh = asSh;\n\t\t}\n' +
        '\t\t#endif\n\t\tif ( UNROLLED_LOOP_INDEX != 0 ) {\n\t\t\tif ( UNROLLED_LOOP_INDEX == 1 ) asSh = min( asSh, mix( 1.0, asNearSh, asNearW ) );\n' +
        '\t\t\tdirectLight.color *= asSh;\n\t\t\tRE_Direct( directLight, geometry, material, reflectedLight );\n\t\t}' :
        '\t\t#endif\n\t\tdirectLight.color *= asSh;\n\t\tRE_Direct( directLight, geometry, material, reflectedLight );');
    chunk = chunk.replace(from, to).replace(a, a + '\n\t\tasSh = 1.0;').replace(b, b + '\n\tfloat asNearSh = 1.0, asNearW = 0.0, asSh = 1.0;');
    sh.fragmentShader = 'uniform float uNoShadow;\nuniform float uCascadeOn;\nfloat asIsSun = 0.0;\n' + sh.fragmentShader.replace('#include <lights_fragment_begin>', chunk);
  }
  // Rover (and other lit objects): plain Lambert with the same light loop (so the cascade light adds no light twice).
  function litMaterial(THREE, U, color) {
    var m = new THREE.MeshLambertMaterial({ color: color });
    m.onBeforeCompile = function (sh) { lightsPatch(sh, U); };
    m.customProgramCacheKey = function () { return 'asteria-lit-6e' + (U.cascade ? '-cs' : ''); };
    return m;
  }
  // Second step of progressive loading: replace the coarse first-frame mesh with the final one (and, once loaded,
  // the extended terrain rings and the 5 m patch).
  function refine(v) {
    var s = v.s; if (!s || !s.coarse) return;
    s.coarse = false;
    buildTerrain(s); v.dirty = true;
  }
  function geomFrom(THREE, P) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P.pos, 3));
    g.setIndex(new THREE.BufferAttribute(P.index, 1));
    if (P.normal) g.setAttribute('normal', new THREE.BufferAttribute(P.normal, 3)); else g.computeVertexNormals();
    if (P.H) { g.setAttribute('aH', new THREE.BufferAttribute(P.H, 1)); g.setAttribute('aS', new THREE.BufferAttribute(P.slope, 1)); }
    if (P.normalSmooth) g.setAttribute('aNs', new THREE.BufferAttribute(P.normalSmooth, 3));
    if (P.uv) g.setAttribute('aG', new THREE.BufferAttribute(P.uv, 2));
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  // (Re)build every terrain mesh from the current grids and vertical exaggeration. Nested squares: 5 m patch (High,
  // where available) inside the tile, inside ring A (16 km), inside ring B (40 km, High). Each outer mesh leaves a hole
  // for the inner one and takes the heights on the hole's edge from it (shared vertices); skirts close the T-junctions.
  // Round 6: ring A / ring B come from the finer grids where they exist (ring A 25 m from LDEM_85S_20M, drawn at 50 m on
  // High and 100 m on Medium; ring B 100 m, drawn at 200 m), and on Medium/High each ring gets a normal map baked from
  // the grid it was loaded at (lighting detail of that LOLA grid, never finer). Every mesh keeps its exact DEM heights.
  function buildTerrain(s) {
    var THREE = s.THREE, Q = s.Q, e = s.ext;
    s.layers.forEach(function (L) {
      s.terrainGroup.remove(L.mesh); L.mesh.geometry.dispose();
      if (L.mesh.material !== s.terrainMat) disposeTerrainMat(L.mesh.material);
    });
    s.layers = []; s.areas = [];
    var add = function (name, P, cast, recv, mat) {
      var mesh = new THREE.Mesh(geomFrom(THREE, P), mat || s.terrainMat); mesh.castShadow = cast; mesh.receiveShadow = recv; mesh.name = name;
      s.terrainGroup.add(mesh); s.layers.push({ name: name, mesh: mesh, vertices: P.pos.length / 3, nmap: mat && mat.userData.local && mat.userData.local.uNMap.value ? mat.userData.local.uNMap.value.image.width : 0 });
      return mesh;
    };
    var nm = function (G) { return s.nmapOK ? normalTexture(s, G) : null; };
    // round 6C: per-pixel normals for the tile and the 5 m patch (normal maps of their own LOLA grids) wherever WebGL2 is
    // available, and the openness (sky-view factor) texture for Walk/Rover
    var nearNm = function (G) { return s.nearNmOK ? normalTexture(s, G) : null; };
    var nearAO = function (G) { return s.nearNmOK ? aoTexture(s, G) : null; };
    var TM = s.TM, patch = e.p5 && (Q.patch5m || s.fine) ? e.p5 : null;
    TM.patch = patch; s.T.patch = patch;
    // which grid is drawn for each ring, and from which grid its lighting detail comes
    // ring A geometry: the 25 m grid drawn every afStride-th node on High; on Medium the round-4 grid (100 m from
    // LDEM_80S_80M), whose shadows were validated (a 100 m sampling of the 20 m product changed 2 of 50 shading-consistency
    // verdicts at Mons Malapert, so it was not used); the lighting detail (normal map) comes from the 25 m grid at both.
    var A = Q.fine && Q.afGeom && e.af ? e.af : e.a, strideA = A === e.af ? Q.afStride : Q.ringA, NA = Q.fine && e.af ? e.af : A;
    var B = e.b && Q.ringB ? (Q.fine && e.bf ? e.bf : e.b) : null, strideB = B && B === e.bf ? 2 : 1;
    s.gridA = A || null; s.gridB = B; s.lightA = NA || null;
    var texA = A && s.nmapOK ? NA.d : null, texB = B && s.nmapOK ? B.d : null;
    if (patch) {
      // 5 m patch: full resolution; its outer 150 m blend toward the smoothed (+-4 cell = +-20 m) normal, nearer the 20 m tile
      var pOpt = s.nmapOK ? { band0: 1 - 150 / patch.half, bandMix: 1, reliefD: patch.d } : { reliefD: patch.d };
      pOpt.nmap = nearNm(patch); pOpt.ao = nearAO(patch); pOpt.aoGrid = patch; pOpt.aoBand0 = 1 - 150 / patch.half;
      add('patch5m', M.buildGridMesh(patch, 1, 0, null, patch), true, true, regolithMaterial(THREE, s.U, pOpt));
      add('patch5m-skirt', M.buildSkirt(patch, 1, 30), false, true);
      s.areas.push({ name: '5 m patch (2 km)', geom: patch.d, light: patch.d, product: patch.meta.demProduct });
    }
    s.terrainGroup.remove(s.terrain); s.geo.dispose();
    if (s.terrain.material !== s.terrainMat) disposeTerrainMat(s.terrain.material);
    var tileP = M.buildGridMesh(TM, 1, patch ? patch.half : 0, patch, s.T);
    s.geo = geomFrom(THREE, tileP); s.terrain.geometry = s.geo; s.terrainGroup.add(s.terrain);
    // tile: where ring A's lighting detail is much coarser (100 m), the tile's outer 500 m blends toward its smoothed normal
    var band = s.nmapOK && texA && texA > 2.5 * s.T.d;
    // round 6C: the tile gets the normal map of the full 20 m (or 80 m) grid s.T - the same grid the mesh is built from
    // (on phones the mesh is drawn every 2nd node, the lighting detail stays at the grid spacing); relief and its
    // distance normalisation then use the grid spacing, and the normal map's mipmaps average the real normals at distance
    var tOpt = band ? { band0: 1 - 500 / TM.half, bandMix: 1, reliefD: TM.d } : { reliefD: TM.d };
    if (s.nearNmOK) { tOpt.nmap = nearNm(s.T); tOpt.reliefD = s.T.d; tOpt.ao = nearAO(s.T); tOpt.aoGrid = s.T; tOpt.aoBand0 = 1 - 500 / TM.half; }
    s.terrain.material = band || s.nearNmOK ? regolithMaterial(THREE, s.U, tOpt) : s.terrainMat;
    s.tileNormalMap = tOpt.nmap ? s.T.n : 0;
    s.terrainMat.userData.local.uReliefD.value = TM.d;   // tile (and skirts) relief at the drawn tile spacing
    s.tileVertices = tileP.pos.length / 3;
    s.areas.push({ name: '6 km tile', geom: TM.d, light: s.T.d, product: s.T.meta.demProduct });
    var extCast = Q.extShadow;
    if (A) {
      add('tile-skirt', M.buildSkirt(TM, 1, 40, function (x, y) { return M.nodeOrMesh(TM, x, y); }), false, true);
      s.ringA = decimate(A, strideA);
      s.ringA.k = TM.k;
      // ring A's outer 3 km: normal-map detail fades (mip bias) to ring B's lighting resolution when ring B is drawn
      var mA = nm(NA) ? regolithMaterial(THREE, s.U, { nmap: s.lastTex, band0: 1 - 3000 / NA.half, bandBias: texB ? Math.max(0, Math.log2(texB / NA.d)) : 0, reliefD: NA.d }) : null;
      var PA = M.buildGridMesh(s.ringA, 1, TM.half, TM, A);
      if (NA !== A) PA.uv = M.gridUV(s.ringA, 1, NA);      // texture coordinates in the normal map's grid
      add('ringA', PA, extCast, extCast, mA || regolithMaterial(THREE, s.U, { reliefD: A.d * strideA }));
      s.areas.push({ name: 'Ring A (to 16 km)', geom: A.d * strideA, light: mA ? NA.d : A.d * strideA, product: (mA && NA !== A ? NA.meta.demProduct + ' (lighting), ' : '') + A.meta.demProduct + (mA && NA !== A ? ' (geometry)' : '') });
    } else s.ringA = null;
    if (B && s.ringA) {
      s.ringBG = decimate(B, strideB); s.ringBG.k = TM.k;
      add('ringA-skirt', M.buildSkirt(s.ringA, 1, 80), false, false);
      var mB = nm(B) ? regolithMaterial(THREE, s.U, { nmap: s.lastTex, reliefD: B.d }) : null;
      add('ringB', M.buildGridMesh(s.ringBG, 1, s.ringA.half, s.ringA, B), extCast, false, mB || regolithMaterial(THREE, s.U, { reliefD: B.d * strideB }));
      s.areas.push({ name: 'Ring B (to 40 km)', geom: B.d * strideB, light: mB ? B.d : B.d * strideB, product: B.meta.demProduct });
    } else s.ringBG = null;
    s.extVertices = s.layers.reduce(function (n, L) { return n + (/skirt/.test(L.name) ? 0 : L.vertices); }, 0);
    // round 6B: highest drawn terrain point (Three.js y) and outermost drawn extent, for the inspection ray march
    s.terrainTop = s.geo.boundingBox.max.y; s.terrainExt = s.TM.half;
    s.layers.forEach(function (L) { s.terrainTop = Math.max(s.terrainTop, L.mesh.geometry.boundingBox.max.y); });
    [s.ringA, s.ringBG].forEach(function (G) { if (G) s.terrainExt = Math.max(s.terrainExt, G.half); });
    fitShadow(s);
    buildDistRings(s);
    s.miniBase = null;
  }
  // Round 6: normal map of grid G (x/z components, float or half-float, with a mipmap chain of averaged real normals);
  // stored in s.lastTex. Baked again whenever the terrain is rebuilt (e.g. a new vertical exaggeration).
  function normalTexture(s, G) {
    var THREE = s.THREE, xz = M.bakeNormalXZ(G), levels = M.mipChainXZ(xz, G.n), half = !s.floatLinear;
    if (half) levels = levels.map(function (l) { var u = new Uint16Array(l.data.length); for (var q = 0; q < u.length; q++) u[q] = THREE.DataUtils.toHalfFloat(l.data[q]); return { data: u, width: l.width, height: l.height }; });
    var tex = new THREE.DataTexture(levels[0].data, G.n, G.n, THREE.RGFormat, half ? THREE.HalfFloatType : THREE.FloatType);
    tex.internalFormat = half ? 'RG16F' : 'RG32F';
    tex.mipmaps = levels; tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
    // round 6C: anisotropic filtering at the device maximum (was 4): sharper lighting detail at grazing views
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.anisotropy = s.maxAniso || 4;
    tex.needsUpdate = true;
    s.lastTex = tex;
    return tex;
  }
  function disposeTerrainMat(m) {
    var lu = m.userData.local;
    if (lu) ['uNMap', 'uAOMap'].forEach(function (k) { if (lu[k] && lu[k].value) lu[k].value.dispose(); });
    m.dispose();
  }
  // Round 6C: openness texture of grid G (sky-view factor from the LOLA heights, M.skyViewRows; 8-bit, value v = (SVF -
  // 0.5) / 0.5, mipmapped). Computed only when openness shading is in use (Walk/Rover), in row chunks between frames,
  // cached per grid; until it is ready the texture is 1 x 1 "open sky" (no effect).
  function aoKey(s, G) { return (G.id || s.T.id || '') + ':' + G.n + ':' + G.d + ':' + G.half; }
  function aoTexture(s, G) {
    var THREE = s.THREE, A = AO_CACHE[aoKey(s, G)], n = A ? G.n : 1, data = new Uint8Array(n * n);
    if (A) for (var q = 0; q < data.length; q++) data[q] = Math.max(0, Math.min(255, Math.round((A[q] - 0.5) / 0.5 * 255)));
    else data[0] = 255;
    var tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.anisotropy = s.maxAniso || 4; tex.unpackAlignment = 1;
    tex.needsUpdate = true;
    return tex;
  }
  // start (or continue) the sky-view computation for the tile and the 5 m patch; heights from the finest grid at each
  // sample (5 m patch, then the tile); when a grid is done its material gets the real texture
  function ensureAO(v) {
    var s = v.s; if (!s || !s.nearNmOK || v.aoBusy) return;
    var todo = [s.T.patch, s.T].filter(function (G) { return G && !AO_CACHE[aoKey(s, G)]; });
    if (!todo.length) return;
    var G = todo[0], out = new Float32Array(G.n * G.n), srcs = [s.T.patch, s.T].filter(Boolean), j = 0, t0 = performance.now();
    v.aoBusy = true;
    var step = function () {
      if (V !== v || !v.s) return;
      var tc = performance.now();
      while (j < G.n && performance.now() - tc < 12) { M.skyViewRows(G, srcs, j, j + 1, out); j++; }
      if (j < G.n) { setTimeout(step, 0); return; }
      AO_CACHE[aoKey(s, G)] = out;
      v.aoMs = (v.aoMs || 0) + Math.round(performance.now() - t0);
      [s.terrain].concat(s.layers.map(function (L) { return L.mesh; })).forEach(function (mesh) {
        var m = mesh.material, lu = m.userData.local;
        if (m.userData.aoGrid === G && lu && lu.uAOMap.value) { lu.uAOMap.value.dispose(); lu.uAOMap.value = aoTexture(s, G); }
      });
      v.aoBusy = false; v.dirty = true;
      ensureAO(v);
    };
    setTimeout(step, 0);
  }
  // round 6E: close-range surface texture (Illustrative; display only): Walk and Rover only, on by default, one choice
  // per session; in Orbit uCover = 0 (no effect at all). Fewer octaves on Low and on phones.
  function coverActive(v) { return !!(SESSION.cover && v.ctl.mode !== 'orbit'); }
  function applyCover(v) {
    var orbit = v.ctl.mode === 'orbit';
    $('v3dCover').checked = !!SESSION.cover;
    $('v3dCoverRow').hidden = orbit; $('v3dCoverNote').hidden = orbit;
    v.s.U.uCover.value = coverActive(v) ? 1 : 0;
    v.s.U.uCovOct.value = (v.phone || v.s.Q.label === 'Low') ? COVER_OCT_LOW : COVER_OCT;
    v.dirty = true;
  }
  function aoActive(v) { var on = SESSION.ao === null ? AO_DEFAULT : SESSION.ao; return !!(on && v.ctl.mode !== 'orbit' && v.s.nearNmOK); }
  function applyAO(v) {
    var on = SESSION.ao === null ? AO_DEFAULT : SESSION.ao;
    $('v3dAO').checked = on; $('v3dAO').disabled = !v.s.nearNmOK;
    v.s.U.uAO.value = aoActive(v) ? 1 : 0;
    if (aoActive(v)) ensureAO(v);
    v.dirty = true;
  }
  // concentric rings every 500 m around the site, 1 m above the drawn ground (Walk / Rover aid)
  function buildDistRings(s) {
    var THREE = s.THREE, g = s.distRings;
    g.children.slice().forEach(function (c) { g.remove(c); c.geometry.dispose(); c.material.dispose(); });
    for (var r = 500; r < s.TM.half; r += 500) {
      var n = 256, pos = new Float32Array((n + 1) * 3);
      for (var k = 0; k <= n; k++) {
        var a = 2 * Math.PI * k / n, e = r * Math.sin(a), nn = r * Math.cos(a);
        var p = M.toThree(M.enu(s.TM, e, nn, M.meshHeightAt(s.TM, e, nn) + 1 / (s.TM.k || 1)));
        pos.set(p, 3 * k);
      }
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: r % 1000 ? 0x59d9ff : 0xffffff, transparent: true, opacity: 0.8 }));
      line.userData.r = r; g.add(line);
    }
  }
  // Load the extended terrain (ring A always; ring B and the 5 m patch on High) after the first frame.
  var EXT_CACHE = {};
  function loadExtScript(src) {
    return new Promise(function (resolve, reject) {
      var sc = document.createElement('script'); sc.src = src; sc.onload = resolve;
      sc.onerror = function () { reject(new Error(src + ' could not be loaded')); };
      document.head.appendChild(sc);
    });
  }
  function loadExtended(v) {
    var s = v.s;
    var idx = Promise.all([
      s.Q.patch5m && !window.ASTERIA_TERRAIN3D_5M_IDS ? loadExtScript('data/terrain3d/hi5m_index.js') : Promise.resolve(),
      s.Q.fine && !window.ASTERIA_TERRAIN3D_FINE ? loadExtScript('data/terrain3d/fine_index.js') : Promise.resolve()
    ]);
    return idx.then(function () { return loadExtended2(v); }, function () { return loadExtended2(v); });
  }
  function loadExtended2(v) {
    var s = v.s, id = v.site.id, Q = s.Q, want = [['a', 'data/terrain3d/ext/' + id + '_a.js', 'ASTERIA_TERRAIN3D_EXT', id + '_a']];
    if (Q.ringB) want.push(['b', 'data/terrain3d/ext/' + id + '_b.js', 'ASTERIA_TERRAIN3D_EXT', id + '_b']);
    // round 6: finer ring grids where they exist (data/terrain3d/fine_index.js; Medium/High)
    var fine = Q.fine && window.ASTERIA_TERRAIN3D_FINE && window.ASTERIA_TERRAIN3D_FINE[id] || {};
    if (fine.af) want.push(['af', 'data/terrain3d/ext/' + id + '_af.js', 'ASTERIA_TERRAIN3D_EXT', id + '_af']);
    if (fine.bf && Q.ringB) want.push(['bf', 'data/terrain3d/ext/' + id + '_bf.js', 'ASTERIA_TERRAIN3D_EXT', id + '_bf']);
    if (!window.ASTERIA_FEATURES3D) loadExtScript('data/terrain3d/features.js').then(function () { if (V === v) { v.dirty = true; notes(v); } }, function () {});
    if (Q.patch5m && (window.ASTERIA_TERRAIN3D_5M_IDS || []).indexOf(id) >= 0) want.push(['p5', 'data/terrain3d/hi5m/' + id + '.js', 'ASTERIA_TERRAIN3D_5M', id]);
    return Promise.all(want.map(function (w) {
      if (EXT_CACHE[w[3] + w[0]]) return Promise.resolve();
      var have = window[w[2]] && window[w[2]][w[3]];
      return (have ? Promise.resolve() : loadExtScript(w[1])).then(function () {
        var G = M.decodeTile(window[w[2]][w[3]]);
        EXT_CACHE[w[3] + w[0]] = G;
      });
    })).then(function () {
      if (V !== v) return;
      want.forEach(function (w) { s.ext[w[0]] = EXT_CACHE[w[3] + w[0]]; s.ext[w[0]].k = s.T.k; });
      buildTerrain(s);
      s.refinePending = false; v.dirty = true;
      if (v.pt) placePoint(v);   // round 6F: the ring's heights are known now
      if (!v.userMoved && !(v.openArgs.keep) && v.ctl.mode === 'orbit') defaultView(v);
      notes(v);
    }, function (err) {
      if (V !== v) return;
      s.refinePending = false; s.extError = String(err && err.message || err); v.dirty = true;
      console.warn('Extended terrain not loaded: ' + s.extError);
    });
  }

  // Fit the shadow camera, seen from the Sun: its width and height cover the shadow-receiving terrain (the tile, or
  // ring A when the extended terrain casts shadows: Medium/High), its depth covers every shadow-casting mesh, so ridges
  // up to 16 km (Medium) or 40 km (High) away shade the tile. Tight fitting keeps the resolution at grazing angles.
  // Round 6: the same fitting for the earthshine light (Earth direction) and for the near cascade (the Sun direction,
  // width and height covering only the box v.nearBox around the camera, depth covering every caster as for the full map).
  function fitShadow(v) {
    v.shadowTexel = fitLight(v, v.sun, null);
    if (v.earthLight && v.earthLight.castShadow) fitLight(v, v.earthLight, null);
    if (v.sunNear) { v.nearTexel = fitLight(v, v.sunNear, v.nearBox || null); }
  }
  function fitLight(v, light, nearBox) {
    var THREE = v.THREE, cam = light.shadow.camera;
    var tmp = new THREE.OrthographicCamera(); tmp.position.copy(light.position); tmp.lookAt(light.target.position); tmp.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(tmp.matrixWorld).invert(), p = new THREE.Vector3();
    var box = function (bb, lo, hi) {
      for (var c = 0; c < 8; c++) {
        p.set(c & 1 ? bb.max.x : bb.min.x, c & 2 ? bb.max.y + 3 : bb.min.y, c & 4 ? bb.max.z : bb.min.z).applyMatrix4(inv);
        lo[0] = Math.min(lo[0], p.x); lo[1] = Math.min(lo[1], p.y); lo[2] = Math.min(lo[2], p.z);
        hi[0] = Math.max(hi[0], p.x); hi[1] = Math.max(hi[1], p.y); hi[2] = Math.max(hi[2], p.z);
      }
    };
    var rlo = [Infinity, Infinity, Infinity], rhi = [-Infinity, -Infinity, -Infinity], clo = rlo.slice(), chi = rhi.slice();
    var recv = [v.geo];
    if (!v.diagTileShadow) (v.layers || []).forEach(function (L) { if (L.mesh.receiveShadow && !/skirt/.test(L.name)) recv.push(L.mesh.geometry); });
    var cast = [v.geo];
    (v.layers || []).forEach(function (L) { if (L.mesh.castShadow) cast.push(L.mesh.geometry); });
    if (nearBox) {
      var ylo = Infinity, yhi = -Infinity;
      recv.forEach(function (g) { ylo = Math.min(ylo, g.boundingBox.min.y); yhi = Math.max(yhi, g.boundingBox.max.y); });
      recv = [{ boundingBox: { min: { x: nearBox.x - nearBox.h, y: ylo, z: nearBox.z - nearBox.h }, max: { x: nearBox.x + nearBox.h, y: yhi, z: nearBox.z + nearBox.h } } }];
    }
    recv.forEach(function (g) { box(g.boundingBox, rlo, rhi); });
    cast.forEach(function (g) { box(g.boundingBox, clo, chi); });
    cam.left = rlo[0] - 5; cam.right = rhi[0] + 5; cam.bottom = rlo[1] - 5; cam.top = rhi[1] + 5;
    // depth: from the nearest caster to the farthest receiver (light space looks down -z)
    cam.near = -Math.max(chi[2], rhi[2]) - 10; cam.far = -Math.min(clo[2], rlo[2]) + 10;
    cam.updateProjectionMatrix();
    var texel = Math.max(cam.right - cam.left, cam.top - cam.bottom) / light.shadow.mapSize.x;
    light.shadow.normalBias = Math.max(v.TM.d * 0.08, texel * 0.6);
    // depth bias as a fixed distance (SHADOW_BIAS_M along the light) whatever the depth range of the shadow camera
    light.shadow.bias = -SHADOW_BIAS_M / (cam.far - cam.near);
    light.shadow.needsUpdate = true;
    return texel;
  }
  // Near cascade (Medium/High): a square around the camera's ground point (Walk/Rover: 1.2 km half-size; Orbit: the view
  // centre, half of the camera distance, 0.5-8 km), snapped to a grid of 1/4 of its size so it is re-fitted only when the
  // camera has moved noticeably. Returns true when the box changed.
  function updateNear(v) {
    var s = v.s; if (!s.sunNear) return false;
    var c = v.ctl, x, z, h;
    if (c.mode === 'orbit') { x = c.target[0]; z = c.target[2]; h = Math.max(500, Math.min(8000, c.dist * 0.5)); }
    else if (c.mode === 'walk') { x = c.walk.x; z = c.walk.z; h = 1200; }
    else { x = c.rov.x; z = c.rov.z; h = 1200; }
    h = Math.pow(2, Math.round(Math.log2(h)));            // powers of two: few distinct sizes
    var g = h / 4; x = Math.round(x / g) * g; z = Math.round(z / g) * g;
    var b = s.nearBox;
    if (b && b.x === x && b.z === z && b.h === h) return false;
    s.nearBox = { x: x, z: z, h: h };
    s.nearTexel = fitLight(s, s.sunNear, s.nearBox);
    return true;
  }

  // ------------------------------------------------------------- controls
  function Controls(v) {
    var c = {
      mode: 'orbit', target: [0, 0, 0], dist: 4200, yaw: 0, pitch: 24,         // orbit (yaw = camera azimuth seen from the target)
      walk: { x: 0, z: 0, yaw: 0, pitch: 2 },                                   // walk (yaw = viewing azimuth)
      rov: { x: 0, z: 0, yaw: 0, dist: 0, camYaw: 0, lastX: 0, lastZ: 0 },
      keys: {}, pointers: {}, pinch: null
    };
    return c;
  }
  function moveKeys(k) {
    return {
      fwd: k.KeyW || k.ArrowUp || k.pad_fwd, back: k.KeyS || k.ArrowDown || k.pad_back,
      left: k.KeyA || k.ArrowLeft || k.pad_left, right: k.KeyD || k.ArrowRight || k.pad_right,
      strafeL: k.KeyQ, strafeR: k.KeyE, fast: k.ShiftLeft || k.ShiftRight, zin: k.Equal || k.NumpadAdd, zout: k.Minus || k.NumpadSubtract
    };
  }
  var MAXD = 60000, TRACK_MAX = 2000;   // farthest orbit distance (m)
  // Height (Three.js y) of the drawn ground below world (x, z): the finest mesh that contains the point, or -1e9.
  function groundY(s, x, z) {
    var grids = [s.TM, s.ringA, s.ringBG], ax = Math.max(Math.abs(x), Math.abs(z));
    for (var q = 0; q < grids.length; q++) {
      var G = grids[q]; if (!G) continue;
      // round 6B: exact quick rejection. The grid distance of the point under (x, z) is at least 0.98 x its horizontal
      // distance (s >= rho R / (R + h) for drawn heights h < 30 km), so a point with 0.98 max(|x|, |z|) > half lies
      // outside this grid for certain and the full inverse (groundWorld) is skipped. Results are unchanged.
      if (0.98 * ax > G.half) continue;
      var g = M.groundWorld(G, x, z);
      if (g.inside) return g.y;
    }
    return -1e9;
  }
  function anyKey(k) { for (var x in k) if (k[x]) return true; return false; }
  function clampTile(T, x, z) {
    var g = M.gridFromWorld(T, x, z, true), lim = T.half - T.d;
    if (Math.abs(g.e) <= lim && Math.abs(g.n) <= lim) return [x, z];
    var e = Math.max(-lim, Math.min(lim, g.e)), n = Math.max(-lim, Math.min(lim, g.n));
    var p = M.toThree(M.enu(T, e, n, M.meshHeightAt(T, e, n)));
    return [p[0], p[2]];
  }
  function stepControls(v, dt) {
    var c = v.ctl, k = moveKeys(c.keys), DEG = Math.PI / 180, TM = v.s.TM, cam = v.s.camera;
    var sp = (k.fast ? 5 : 1);
    if (c.mode === 'orbit') {
      if (k.left) c.yaw -= 60 * dt; if (k.right) c.yaw += 60 * dt;
      if (k.fwd) c.pitch = Math.min(89, c.pitch + 40 * dt); if (k.back) c.pitch = Math.max(1, c.pitch - 40 * dt);
      if (k.zin) c.dist = Math.max(30, c.dist * Math.exp(-1.5 * dt)); if (k.zout) c.dist = Math.min(MAXD, c.dist * Math.exp(1.5 * dt));
      var cy = c.yaw * DEG, cp = c.pitch * DEG;
      var px = c.target[0] + c.dist * Math.cos(cp) * Math.sin(cy), pz = c.target[2] - c.dist * Math.cos(cp) * Math.cos(cy);
      var py = c.target[1] + c.dist * Math.sin(cp);
      var gnd = groundY(v.s, px, pz);
      if (py < gnd + 15) py = gnd + 15;
      cam.position.set(px, py, pz); cam.lookAt(c.target[0], c.target[1], c.target[2]);
    } else if (c.mode === 'walk') {
      var w = c.walk, speed = 12 * sp;
      if (k.left) w.yaw -= 70 * dt; if (k.right) w.yaw += 70 * dt;
      var f = (k.fwd ? 1 : 0) - (k.back ? 1 : 0), s = (k.strafeR ? 1 : 0) - (k.strafeL ? 1 : 0), y = w.yaw * DEG;
      if (f || s) {
        var nx = w.x + (Math.sin(y) * f + Math.cos(y) * s) * speed * dt, nz = w.z + (-Math.cos(y) * f + Math.sin(y) * s) * speed * dt;
        var cl = clampTile(TM, nx, nz); w.x = cl[0]; w.z = cl[1];
      }
      var g = M.groundWorld(TM, w.x, w.z);
      cam.position.set(w.x, g.y + EYE_M, w.z);
      var p = w.pitch * DEG;
      cam.lookAt(w.x + Math.cos(p) * Math.sin(y), g.y + EYE_M + Math.sin(p), w.z - Math.cos(p) * Math.cos(y));
    } else {
      var r = c.rov, rs = 4 * sp;
      if (k.left) r.yaw -= 50 * dt; if (k.right) r.yaw += 50 * dt;
      var fr = (k.fwd ? 1 : 0) - (k.back ? 1 : 0), ry = r.yaw * DEG;
      if (fr) {
        var cl2 = clampTile(TM, r.x + Math.sin(ry) * fr * rs * dt, r.z - Math.cos(ry) * fr * rs * dt);
        r.dist += Math.hypot(cl2[0] - r.x, cl2[1] - r.z); r.x = cl2[0]; r.z = cl2[1];
      }
      placeRover(v);
      var gy = M.groundWorld(TM, r.x, r.z).y, cyaw = (r.yaw + r.camYaw) * DEG;
      var bx = r.x - Math.sin(cyaw) * 14, bz = r.z + Math.cos(cyaw) * 14;
      var bg = M.inside(TM, bx, -bz) ? M.groundWorld(TM, bx, bz).y : gy;
      cam.position.set(bx, Math.max(gy + 6, bg + 3), bz); cam.lookAt(r.x, gy + 1.2, r.z);
    }
  }
  // Rover pose (round 6): each wheel rests on the LOLA surface under it (the drawn mesh: linear interpolation between
  // DEM nodes, the same surface the picture shows); the body's pitch and roll follow from the four wheel heights
  // (plane through the front/rear and left/right averages). Readout values use the true (not exaggerated) heights.
  // This is Calculated from DEM heights at the DEM's resolution (20 m, 5 m in the patch): with 1-1.3 m between the
  // wheels the tilt equals the DEM's slope over about one cell. No traction, slip, power or obstacle physics.
  function placeRover(v) {
    var THREE = v.s.THREE, s = v.s, r = v.ctl.rov, TM = s.TM, DEG = Math.PI / 180, y = r.yaw * DEG, RV = ROVER;
    var fw = [Math.sin(y), -Math.cos(y)], rt = [Math.cos(y), Math.sin(y)];
    var c = RV.wheels.map(function (w) {
      var x = r.x + rt[0] * w[0] - fw[0] * w[1], z = r.z + rt[1] * w[0] - fw[1] * w[1], g = M.groundWorld(TM, x, z);
      return { x: x, z: z, y: g.y, h: M.meshHeightAt(TM, g.e, g.n), wx: w[0], wz: w[1] };
    });
    var avg = function (f, k) { var a = c.filter(f); return a.reduce(function (q, p) { return q + p[k]; }, 0) / a.length; };
    var front = function (p) { return p.wz < 0; }, back = function (p) { return p.wz > 0; }, left = function (p) { return p.wx < 0; }, right = function (p) { return p.wx > 0; };
    var L = 2 * Math.abs(RV.wheels[0][1]), W = 2 * Math.abs(RV.wheels[0][0]);
    var fwdV = new THREE.Vector3(fw[0] * L, avg(front, 'y') - avg(back, 'y'), fw[1] * L).normalize();
    var rtV = new THREE.Vector3(rt[0] * W, avg(right, 'y') - avg(left, 'y'), rt[1] * W).normalize();
    var up = new THREE.Vector3().crossVectors(rtV, fwdV).normalize();
    rtV.crossVectors(fwdV, up).normalize();
    var q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(rtV, up, fwdV.clone().negate()));
    var cy = c.reduce(function (a, p) { return a + p.y; }, 0) / c.length;
    s.roverBody.quaternion.copy(q); s.roverBody.position.set(r.x, cy, r.z);
    var wq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
    var corner = new THREE.Vector3(), top = new THREE.Vector3(), dir = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    c.forEach(function (p, k) {
      var wh = s.roverWheels[k]; wh.quaternion.copy(wq); wh.position.set(p.x, p.y + RV.wheelR, p.z);
      // wheel rotation from the distance driven (display only); the contact point and hub height are unchanged
      if (s.roverSpin) s.roverSpin[k].rotation.y = (r.dist || 0) / RV.wheelR * (p.wx > 0 ? 1 : -1);
      // suspension arm: from the body's side above the wheel to the top of the wheel module's steering housing (its
      // length and angle follow the ground under each wheel)
      corner.set(p.wx * 0.78, RV.clear + 0.12, p.wz).applyQuaternion(q).add(s.roverBody.position);
      top.set(RV.wheelR + 0.17, 0, 0).applyQuaternion(wq).add(wh.position);
      var arm = s.roverStruts[k]; dir.subVectors(top, corner);
      arm.position.copy(corner).addScaledVector(dir, 0.5); arm.scale.set(1, Math.max(0.01, dir.length()), 1);
      arm.quaternion.setFromUnitVectors(Y, dir.normalize());
    });
    s.rover.position.set(0, 0, 0);
    // true-height tilt (degrees) for the readout
    var pitch = Math.atan2(avg(front, 'h') - avg(back, 'h'), L) / DEG, roll = Math.atan2(avg(right, 'h') - avg(left, 'h'), W) / DEG;
    v.roverPose = { pitch: pitch, roll: roll, wheels: c.map(function (p) { return { x: p.x, z: p.z, h: p.h, drawnY: p.y, hub: s.roverWheels[c.indexOf(p)].position.y }; }) };
  }

  function setMode(v, mode, keepView) {
    var c = v.ctl;
    if (v.pt && !v.pt.inTile && mode !== 'orbit') mode = 'orbit';   // round 6F: Walk/Rover need the 6 km tile
    c.mode = mode;
    v.s.rover.visible = mode === 'rover';
    v.s.track.visible = mode === 'rover';
    v.s.distRings.visible = mode !== 'orbit' && $('v3dRings').checked;
    $('v3dRingsLbl').hidden = mode === 'orbit';
    $('v3dLblRover').hidden = mode !== 'rover';
    $('v3dRover').hidden = mode !== 'rover';
    $('v3dPad').hidden = mode === 'orbit';
    v.el.querySelectorAll('.seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === mode); b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'); });
    var help = {
      orbit: 'Orbit: drag to rotate, right-drag or Shift+drag to pan, wheel or pinch to zoom. Keys: arrows rotate, + / - zoom.',
      walk: 'Walk (eye 2 m above the ground, as in the horizon model): W/S or ↑/↓ move, A/D or ←/→ turn, Q/E step sideways, Shift faster; drag to look. On touch screens use the arrow buttons.',
      rover: 'Rover: W/S or ↑/↓ drive, A/D or ←/→ steer, Shift faster; drag to look around. On touch screens use the arrow buttons.'
    }[mode];
    $('v3dHelp').textContent = help;
    applyRelief(v);
    applyAO(v);
    applyCover(v);
    if (mode !== 'orbit') ensureFine(v);
    if (mode === 'walk' && c.walk.x === 0 && c.walk.z === 0 && !keepView) c.walk.yaw = v.inst ? v.inst.r.sun.az : 0;
    if (mode === 'rover' && c.rov.dist === 0 && !c.rov.ptStart) { c.rov.yaw = v.inst ? v.inst.r.sun.az + 90 : 0; c.rov.x = 25; c.rov.z = 0; }
    v.dirty = true;
  }

  // ---------------------------------------------------------- time update
  function setInstant(v, inst) {
    v.inst = inst;
    var r = inst.r, s = v.s, T = s.T;
    var d = M.dirFromAzEl(r.sun.az, r.sun.el);
    s.sun.target.position.set(0, 0, 0);
    s.sun.position.set(d[0] * 100000, d[1] * 100000, d[2] * 100000);
    s.sun.intensity = r.sun.el > -r.sun.radius_deg - 1 ? 1.7 : 0;
    if (s.sunNear) { s.sunNear.target.position.set(0, 0, 0); s.sunNear.position.copy(s.sun.position); s.sunNear.intensity = s.sun.intensity; s.sunNear.updateMatrixWorld(); }
    var ed = M.dirFromAzEl(r.earth.az, r.earth.el);
    s.earthLight.target.position.set(0, 0, 0); s.earthLight.position.set(ed[0] * 100000, ed[1] * 100000, ed[2] * 100000); s.earthLight.updateMatrixWorld();
    s.sun.updateMatrixWorld(); fitShadow(s);
    s.terrainMat.userData.uniforms.uFlat.value = Math.max(0.06, Math.sin(Math.max(0, r.sun.el) * Math.PI / 180));
    v.sunDir = d; v.earthDir = M.dirFromAzEl(r.earth.az, r.earth.el);
    var ph = M.earthPhase(r.sun, r.earth);
    v.phase = ph;
    applyEarthshine(v);
    // status tiles: from the validated horizon model (main app series)
    var tile = function (id, cls, stEl, text) { $(id).className = 'tile ' + cls; $(stEl).textContent = text; };
    tile('v3dTileSun', inst.sunUp ? 'on-sun' : 'off', 'v3dSun', inst.sunUp ? 'Sun up' : 'Sun down');
    tile('v3dTileEarth', inst.earthUp ? 'on-earth' : 'off', 'v3dEarth', inst.earthUp ? 'Earth in view' : 'Earth hidden');
    // round 6F: for a custom point, inst.r is the Sun/Earth at the site (drawing frame) and inst.rPt at the point (the
    // main view's values, shown in the tiles); the phase is the same at both
    var rT = inst.rPt || r;
    $('v3dSunX').textContent = 'Sun el ' + fmtDeg(rT.sun.el) + ' · az ' + rT.sun.az.toFixed(1) + '° · terrain horizon ' + fmtDeg(inst.hzSun, 1) + ' · disk ' + (2 * rT.sun.radius_deg).toFixed(3) + '°';
    $('v3dEarthX').textContent = 'Earth el ' + fmtDeg(rT.earth.el) + ' · az ' + rT.earth.az.toFixed(1) + '° · terrain horizon ' + fmtDeg(inst.hzEarth, 1) + (inst.minEl ? ' + ' + inst.minEl + '° min' : '') + ' · disk ' + (2 * rT.earth.radius_deg).toFixed(2) + '° · ' + (100 * ph.illuminated).toFixed(0) + '% lit (phase)';
    $('v3dTime').textContent = fmtUTC(new Date(inst.t)) + ' UTC';
    var sl = $('v3dSlider'); sl.max = inst.n - 1; sl.value = inst.idx;
    var col = inst.sunUp && inst.earthUp ? 0x5ee27a : inst.sunUp ? 0xffc23d : inst.earthUp ? 0x4ea8ff : 0x6f7890;
    var lcls = inst.sunUp && inst.earthUp ? 'on-both' : inst.sunUp ? 'on-sun' : inst.earthUp ? 'on-earth' : 'off';
    if (v.pt) { s.ptMat.color.setHex(col); $('v3dLblPt').className = 'v3d-lbl site pt ' + lcls; }   // round 6F: status belongs to the point
    else { s.markerMat.color.setHex(col); $('v3dLblSite').className = 'v3d-lbl site ' + lcls; }
    var b = $('v3dBanner');
    if (!inst.sunUp && rT.sun.el > -rT.sun.radius_deg) {
      b.hidden = false;
      b.textContent = 'At ' + (v.pt ? 'your point' : 'the site marker') + ' the Sun is hidden behind terrain (validated horizon model, Sun ' + fmtDeg(rT.sun.el, 1) + ' vs horizon ' + fmtDeg(inst.hzSun, 1) + '). ' + (!shadowsOn() ? 'Shadows are off in this view, so the ground is drawn lit from the Sun\'s direction; turn on "Shadows (approximate)" to see cast shadows.' : v.s.Q.extShadow ? 'Terrain more than ' + (extKm(v) || 16) + ' km away casts no shadows in this view, so parts of the ground may still look lit.' : 'At ' + v.s.Q.label + ' quality only the 6 km tile casts shadows, so parts of the ground may look lit (Medium or High add shadows from the surrounding terrain).');
    } else b.hidden = true;
    if (inst.sunUp && v.lightUpAuto && v.bright >= LIGHT_UP - 0.01) lightUpOff(v, '"Light up" switched off: the Sun is up at the site, and the extra brightness would wash the sunlit ground out to white.');
    updateTip(v);
    updateStars(v);
    orientEarth(v);
    sunEarthLabels(v);
    s.glare.visible = $('v3dGlare').checked && inst.sunUp;   // no glare from a Sun the validated model says is hidden
    v.dirty = true;
  }

  // -------------------------------------------------------------- render
  function frame(v, ts) {
    if (V !== v) return;
    var dt = Math.min(0.1, v.lastTs ? (ts - v.lastTs) / 1000 : 0); v.lastTs = ts;
    var moving = anyKey(v.ctl.keys) || v.probing;
    // round 6B: hover inspection is computed here, at most once per animation frame and only when the pointer moved
    if (v.inspReq) { var iq = v.inspReq; v.inspReq = null; showInspect(v, inspectAt(v, iq.x, iq.y)); }
    if (moving || v.dirty) {
      stepControls(v, dt);
      var s = v.s, cam = s.camera, r = v.inst && v.inst.r;
      if (r) {
        var sd = v.sunDir, ed = v.earthDir;
        s.sunDisk.position.set(cam.position.x + sd[0] * SUN_D, cam.position.y + sd[1] * SUN_D, cam.position.z + sd[2] * SUN_D);
        s.sunDisk.scale.setScalar(SUN_D * Math.sin(r.sun.radius_deg * Math.PI / 180));
        s.glare.position.copy(s.sunDisk.position); s.glare.scale.setScalar(SUN_D * Math.sin(r.sun.radius_deg * Math.PI / 180) * 12);
        s.earth.position.set(cam.position.x + ed[0] * EARTH_D, cam.position.y + ed[1] * EARTH_D, cam.position.z + ed[2] * EARTH_D);
        s.earth.scale.setScalar(EARTH_D * Math.sin(r.earth.radius_deg * Math.PI / 180));
      }
      s.stars.position.copy(cam.position);
      updateNear(v);
      s.renderer.render(s.scene, cam);
      labels(v); inspectMarker(v);
      hud(v); featureLabels(v); miniMap(v); layoutLabels(v);
      if (v.ctl.mode === 'rover') { roverReadout(v, ts); trackPush(v); wheelPush(v); }
      v.dirty = false;
      v.frames++;
    }
    else if (v.readPending && v.ctl.mode === 'rover' && ts - (v.lastRead || 0) >= 150) roverReadout(v, ts);
    v.raf = requestAnimationFrame(function (t) { frame(v, t); });
  }
  // Sun / Earth label text from the validated status (never looks visible when it is not).
  function sunEarthLabels(v) {
    var i = v.inst; if (!i) return;
    var r = i.r, sunTxt = 'Sun', earthTxt = 'Earth';
    if (!i.sunUp) sunTxt += r.sun.el < 0 ? ' (below horizon)' : ' (hidden by terrain)';
    if (!i.earthUp) earthTxt += r.earth.el < 0 ? ' (below horizon)' : r.earth.el <= i.hzEarth ? ' (hidden by terrain)' : ' (below your minimum link elevation)';
    var a = $('v3dLblSun'), b = $('v3dLblEarth');
    a.querySelector('.t').textContent = sunTxt; a.classList.toggle('hid', !i.sunUp);
    b.querySelector('.t').textContent = earthTxt; b.classList.toggle('hid', !i.earthUp);
  }
  function labels(v) {
    var s = v.s, cam = s.camera, w = v.stage.clientWidth, h = v.stage.clientHeight, THREE = s.THREE, p = new THREE.Vector3();
    var put = function (id, x, y, z) {
      p.set(x, y, z).project(cam);
      var el = $(id), ok = p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      el.style.display = ok ? '' : 'none';
      if (ok) setPos(el, (p.x + 1) / 2 * w, (1 - p.y) / 2 * h);
    };
    // Sun and Earth: when outside the picture, their labels sit at the edge, with an arrow pointing toward them
    var edge = function (id, obj) {
      var el = $(id), q = obj.position.clone().sub(cam.position).applyQuaternion(cam.quaternion.clone().invert());
      p.copy(obj.position).project(cam);
      var inside = q.z < 0 && Math.abs(p.x) < 0.98 && Math.abs(p.y) < 0.95;
      el.style.display = '';
      el.classList.toggle('edge', !inside);
      var arrow = el.querySelector('.arw');
      if (inside) { setPos(el, (p.x + 1) / 2 * w, (1 - p.y) / 2 * h); return; }
      var ang = Math.atan2(q.y, q.x), cx = Math.cos(ang), cy = Math.sin(ang), sc = Math.min((w / 2 - 70) / Math.max(1e-6, Math.abs(cx)), (h / 2 - 40) / Math.max(1e-6, Math.abs(cy)));
      setPos(el, w / 2 + cx * sc, h / 2 - cy * sc);
      arrow.style.transform = 'rotate(' + (-ang * 180 / Math.PI).toFixed(0) + 'deg)';
    };
    edge('v3dLblSun', s.sunDisk);
    edge('v3dLblEarth', s.earth);
    put('v3dLblSite', 0, 40, 0);
    if (v.pt) put('v3dLblPt', v.pt.x, v.pt.y + 40, v.pt.z);
    if (v.ctl.mode === 'rover') put('v3dLblRover', s.roverBody.position.x, s.roverBody.position.y + 3.2, s.roverBody.position.z);
  }
  function setPos(el, x, y) { el._x = x; el._y = y; el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; }
  // Keep every on-screen label inside the picture and off the panels drawn over it (mini-map, compass/scale box,
  // buttons, messages) and off each other (round 5). Order of priority: Sun, Earth, site, rover, then feature names.
  // A label is moved up or down in steps of its own height (and to the left of a panel it would cover); a feature name
  // that cannot be placed without overlapping is hidden for that frame, never drawn over something else.
  function layoutLabels(v) {
    var st = v.stage.getBoundingClientRect(), W = st.width, H = st.height, MG = 4;
    if (!W || !H) return;
    var rel = function (r) { return { l: r.left - st.left, t: r.top - st.top, r: r.right - st.left, b: r.bottom - st.top }; };
    var vis = function (e) { return e && !e.hidden && e.style.display !== 'none' && e.offsetParent !== null; };
    var obst = ['v3dMini', 'v3dHud', 'v3dClose', 'v3dExagBadge', 'v3dBanner', 'v3dTip', 'v3dQNote', 'v3dPad'].map($).filter(vis).map(function (e) { return rel(e.getBoundingClientRect()); });
    var hit = function (a, b) { return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; };
    var placed = [], out = [];
    var list = [['sun', $('v3dLblSun')], ['earth', $('v3dLblEarth')], ['site', $('v3dLblSite')], ['rover', $('v3dLblRover')]].concat((v.s.featEls || []).map(function (e) { return ['feat', e]; }));
    list.forEach(function (it) {
      var el = it[1]; if (!vis(el) || el._x === undefined) return;
      var r = rel(el.getBoundingClientRect()), w = r.r - r.l, h = r.b - r.t;
      var dx0 = r.l < MG ? MG - r.l : r.r > W - MG ? W - MG - r.r : 0;
      var free = function (q) { return q.t >= MG && q.b <= H - MG && q.l >= MG && q.r <= W - MG && !obst.concat(placed).some(function (o) { return hit(q, o); }); };
      var best = null;
      // candidates: the same x first (nearest rows first), then left/right of any panel it covers, then a scan across
      var xs = [dx0];
      obst.forEach(function (o) { xs.push(o.l - MG - r.r, o.r + MG - r.l); });
      for (var sx = MG; sx + w <= W - MG; sx += 24) xs.push(sx - r.l);
      xs.sort(function (a, b) { return Math.abs(a - dx0) - Math.abs(b - dx0); });
      for (var k = 0; k <= 30 && !best; k++) {
        var dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (h + 3);
        for (var xi = 0; xi < xs.length; xi++) {
          var q = { l: r.l + xs[xi], r: r.r + xs[xi], t: r.t + dy, b: r.b + dy };
          if (free(q)) { best = [xs[xi], dy]; break; }
          if (it[0] === 'feat' && xi > 2) break;     // feature names stay near their point (or are hidden)
        }
      }
      if (!best && it[0] === 'feat') { el.style.display = 'none'; out.push({ kind: it[0], text: el.textContent, hidden: true }); return; }
      if (!best) best = [dx0, Math.max(MG - r.t, Math.min(0, H - MG - r.b))];
      setPos(el, el._x + best[0], el._y + best[1]);
      var fin = { l: r.l + best[0], r: r.r + best[0], t: r.t + best[1], b: r.b + best[1] };
      placed.push(fin); out.push({ kind: it[0], text: el.textContent, hidden: false, rect: fin });
    });
    v.labelLayout = { stage: { w: W, h: H }, obstacles: obst, labels: out };
  }
  function roverReadout(v, ts) {
    if (ts - (v.lastRead || 0) < 150) { v.readPending = true; return; }   // retried by frame() (round 6: a single move left it stale)
    v.lastRead = ts; v.readPending = false;
    var T = v.s.T, r = v.ctl.rov, g = M.gridFromWorld(v.s.TM, r.x, r.z, true);
    var h = M.heightAt(T, g.e, g.n), sl = M.slopeAt(T, g.e, g.n), ll = M.latLonAt(T.meta.lat, T.meta.lon, g.e, g.n, T.R);
    $('v3dRPos').textContent = (g.e >= 0 ? '+' : '') + g.e.toFixed(0) + ' m E, ' + (g.n >= 0 ? '+' : '') + g.n.toFixed(0) + ' m N (' + ll.lat.toFixed(4) + '°, ' + ll.lon.toFixed(4) + '°E)';
    $('v3dRElev').textContent = h.toFixed(1) + ' m';
    $('v3dRSlope').textContent = sl.slope.toFixed(1) + '°';
    var lim = Math.max(1, Math.min(45, +$('v3dSlopeMax').value || 15)), warn = $('v3dRWarn');
    warn.hidden = !(sl.slope > lim);
    if (!warn.hidden) warn.textContent = 'Slope ' + sl.slope.toFixed(1) + '° is above your limit of ' + lim + '°.';
    var inst = v.inst, ns = inst ? M.nearFieldSunUp(T, g.e, g.n, inst.r.sun.az, inst.r.sun.el, EYE_M) : null;
    $('v3dRSun').innerHTML = ns ? (ns.up ? '<span class="c-sun">above</span>' : 'blocked') + ' <span class="fineprint">near-field estimate</span>' : '-';
    var P = v.roverPose;
    $('v3dRTilt').textContent = P ? 'pitch ' + (P.pitch >= 0 ? '+' : '') + P.pitch.toFixed(1) + '°, roll ' + (P.roll >= 0 ? '+' : '') + P.roll.toFixed(1) + '°' : '-';
    v.roverState = { e: g.e, n: g.n, h: h, slope: sl.slope, lat: ll.lat, lon: ll.lon, nearFieldSunUp: ns && ns.up, warn: !warn.hidden, dist: r.dist, pitch: P && P.pitch, roll: P && P.roll, wheels: P && P.wheels };
  }

  // -------------------------------------------------------------- events
  function bind(v) {
    var c = v.ctl, cvs = v.s.renderer.domElement, on = [];
    function add(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); on.push([t, ev, fn, opt]); }
    var formTag = function (e) { var t = e.target && e.target.tagName; return t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA'; };
    add(window, 'keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); if (v.inspect) showInspect(v, null); else close(); return; }
      if (formTag(e)) return;
      if (/^(Arrow|Key[WASDQE]|Shift|Equal|Minus|Numpad(Add|Subtract))/.test(e.code)) { c.keys[e.code] = true; v.dirty = true; if (/^Arrow/.test(e.code)) e.preventDefault(); }
    });
    add(window, 'keyup', function (e) { delete c.keys[e.code]; });
    add(window, 'blur', function () { c.keys = {}; });
    cvs.style.touchAction = 'none';
    add(cvs, 'contextmenu', function (e) { e.preventDefault(); });
    ['pointerdown', 'wheel'].forEach(function (ev) { add(cvs, ev, function () { v.userMoved = true; }, { passive: true }); });
    add(window, 'keydown', function () { v.userMoved = true; });
    add(cvs, 'pointerdown', function (e) {
      cvs.setPointerCapture && cvs.setPointerCapture(e.pointerId);
      c.pointers[e.pointerId] = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
      var ids = Object.keys(c.pointers);
      if (ids.length === 2) { var a = c.pointers[ids[0]], b = c.pointers[ids[1]]; c.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; }
    });
    var up = function (e) { delete c.pointers[e.pointerId]; if (Object.keys(c.pointers).length < 2) c.pinch = null; };
    add(cvs, 'pointerup', up); add(cvs, 'pointercancel', up);
    add(cvs, 'pointermove', function (e) {
      var p = c.pointers[e.pointerId]; if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      var ids = Object.keys(c.pointers);
      if (ids.length >= 2 && c.pinch) {
        var a = c.pointers[ids[0]], b = c.pointers[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        if (c.mode === 'orbit') { c.dist = Math.max(30, Math.min(MAXD, c.dist * c.pinch.d / Math.max(1, d))); pan(v, cx - c.pinch.cx, cy - c.pinch.cy); }
        c.pinch = { d: d, cx: cx, cy: cy }; v.dirty = true; return;
      }
      if (c.mode === 'orbit') { if (p.pan) pan(v, dx, dy); else { c.yaw += dx * 0.3; c.pitch = Math.max(1, Math.min(89, c.pitch + dy * 0.25)); } }
      else if (c.mode === 'walk') { c.walk.yaw += dx * 0.25; c.walk.pitch = Math.max(-80, Math.min(80, c.walk.pitch - dy * 0.25)); }
      else c.rov.camYaw += dx * 0.3;
      v.dirty = true;
    });
    add(cvs, 'wheel', function (e) { e.preventDefault(); if (c.mode === 'orbit') { c.dist = Math.max(30, Math.min(MAXD, c.dist * Math.exp(e.deltaY * 0.0012))); v.dirty = true; } }, { passive: false });
    // on-screen pad (hold to move)
    v.el.querySelectorAll('#v3dPad button').forEach(function (b) {
      var k = 'pad_' + b.dataset.k;
      add(b, 'pointerdown', function (e) { e.preventDefault(); c.keys[k] = true; v.dirty = true; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { add(b, ev, function () { delete c.keys[k]; }); });
    });
    add($('v3dClose'), 'click', function () { close(); });
    add($('v3dToggle'), 'click', function () {
      var body = $('v3dBody'), open = body.hidden; body.hidden = !open;
      this.textContent = open ? 'Hide panel' : 'Show panel'; this.setAttribute('aria-expanded', open ? 'true' : 'false');
      v.el.classList.toggle('collapsed', !open); setTimeout(function () { resize(v); }, 0);
    });
    v.el.querySelectorAll('.seg button').forEach(function (b) { add(b, 'click', function () { setMode(v, b.dataset.mode); }); });
    add($('v3dExag'), 'change', function () { setExag(v, +this.value); });
    // round 6: the lights keep casting (their order is fixed, see lightsPatch); receivers ignore the shadow maps
    add($('v3dShadows'), 'change', function () { SESSION.shadows = this.checked; applyShadows(v); });
    add($('v3dEarthshine'), 'change', function () {
      // earthshine only matters where sunlight is blocked, so it needs cast shadows: switching it on switches them on
      if (this.checked && !shadowsOn()) { $('v3dShadows').checked = true; SESSION.shadows = true; applyShadows(v); }
      applyEarthshine(v);
    });
    add($('v3dQuality'), 'change', function () {
      var q = this.value; lsSet('asteria.v3dQuality', q);
      setQuality(v, q, 'Quality set to ' + QUALITY[q].label + ' (your choice, remembered on this device).');
    });
    add($('v3dBright'), 'input', function () { v.lightUpAuto = false; setBrightness(v, +this.value); });
    add($('v3dLightUp'), 'click', function () { if (v.bright >= LIGHT_UP - 0.01) lightUpOff(v); else lightUp(v); });
    add($('v3dTipBtn'), 'click', function () { lightUp(v); });
    v.el.querySelectorAll('[data-jump]').forEach(function (b) { add(b, 'click', function () { if (v.app.jump) v.app.jump(b.dataset.jump); }); });
    add($('v3dFeatOn'), 'change', function () { v.dirty = true; });
    add($('v3dMiniOn'), 'change', function () { $('v3dMini').hidden = !this.checked; v.dirty = true; });
    add($('v3dRings'), 'change', function () { v.s.distRings.visible = this.checked && v.ctl.mode !== 'orbit'; v.dirty = true; });
    add($('v3dContours'), 'change', function () { overlays(v); });
    add($('v3dContourInt'), 'change', function () { overlays(v); });
    add($('v3dSlope'), 'change', function () { if (this.checked) $('v3dHazard').checked = false; overlays(v); });
    add($('v3dHazard'), 'change', function () { if (this.checked) $('v3dSlope').checked = false; overlays(v); });
    // the hazard limit and the rover's slope-warning limit are the same user setting
    add($('v3dHazMax'), 'change', function () { $('v3dSlopeMax').value = hazardLimit(); v.lastRead = 0; overlays(v); });
    v.el.querySelectorAll('[data-preset]').forEach(function (b) { add(b, 'click', function () { preset(v, b.dataset.preset); }); });
    add($('v3dTo2D'), 'click', function () { showOn2D(v); });
    // pointer inspection (round 6B): by default a click or tap without dragging inspects that point; the readout and a
    // marker stay until the next click or Esc. "Inspect on hover" (off by default; mouse only) follows the pointer live:
    // the request is only stored here and computed in frame(), at most once per animation frame.
    add(cvs, 'pointermove', function (e) {
      if (e.pointerType !== 'mouse' || e.buttons || !HOVER.on || v.inspectPinned) return;
      v.inspReq = { x: e.clientX, y: e.clientY };
    });
    add(cvs, 'pointerleave', function (e) { if (e.pointerType === 'mouse' && HOVER.on && !v.inspectPinned) { v.inspReq = null; showInspect(v, null); } });
    add(cvs, 'pointerdown', function (e) { v.tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    add(cvs, 'pointerup', function (e) {
      var t = v.tapStart; if (!t) return;
      if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 6 && performance.now() - t.t < 500) {
        v.inspReq = null; var r = inspectAt(v, e.clientX, e.clientY);
        showInspect(v, r, true); v.inspectPinned = !!r && !HOVER.on;
      }
    });
    add($('v3dHover'), 'change', function () { HOVER.on = this.checked; v.inspectPinned = false; if (!HOVER.on) showInspect(v, null); });
    add($('v3dRelief'), 'change', function () { RELIEF_PREF[v.ctl.mode] = this.checked; applyRelief(v); });
    add($('v3dAO'), 'change', function () { SESSION.ao = this.checked; applyAO(v); });
    add($('v3dCover'), 'change', function () { SESSION.cover = this.checked; applyCover(v); });
    add($('v3dRing'), 'change', function () { v.s.ring.visible = this.checked; v.dirty = true; });
    add($('v3dGlare'), 'change', function () { v.s.glare.visible = this.checked && !!(v.inst && v.inst.sunUp); v.dirty = true; });
    add($('v3dStars'), 'change', function () {
      var on = this.checked; $('v3dStarNote').hidden = !on;
      if (on) ensureStars(v).then(function () { if (V === v) { v.s.stars.visible = $('v3dStars').checked; v.dirty = true; } });
      else { v.s.stars.visible = false; v.dirty = true; }
    });
    add($('v3dSlopeMax'), 'change', function () { v.lastRead = 0; $('v3dHazMax').value = Math.max(1, Math.min(45, +this.value || 15)); overlays(v); });
    add($('v3dSlider'), 'input', function () { v.app.setIdx(+this.value); });
    add($('v3dPlay'), 'click', function () { v.app.setPlaying(!v.app.playing()); syncPlay(v); });
    add(window, 'resize', function () { resize(v); });
    v.unbind = function () { on.forEach(function (x) { x[0].removeEventListener(x[1], x[2], x[3]); }); };
  }
  function syncPlay(v) { var p = v.app.playing(); $('v3dPlay').innerHTML = p ? '&#10074;&#10074;' : '&#9654;'; $('v3dPlay').setAttribute('aria-label', p ? 'Pause' : 'Play'); }
  function pan(v, dx, dy) {
    var c = v.ctl, s = c.dist * 0.0012, y = c.yaw * Math.PI / 180;
    // screen right = (cos yaw, 0, sin yaw); screen up (on the ground) = toward the target from the camera
    c.target[0] += (-dx * Math.cos(y) + dy * -Math.sin(y)) * s;
    c.target[2] += (-dx * Math.sin(y) + dy * Math.cos(y)) * s;
    var cl = clampTile(v.s.TM, c.target[0], c.target[2]); c.target[0] = cl[0]; c.target[2] = cl[1];
    c.target[1] = M.groundWorld(v.s.TM, c.target[0], c.target[2]).y;
  }
  function setExag(v, k) {
    var s = v.s;
    s.coarse = false;
    s.T.k = k; s.TM.k = k;
    Object.keys(s.ext).forEach(function (x) { s.ext[x].k = k; });
    buildTerrain(s);
    var b = $('v3dExagBadge');
    b.textContent = k === 1 ? 'Vertical scale 1× (true scale)' : 'Vertical exaggeration ' + k + '× - heights stretched, not true scale';
    b.classList.toggle('warn', k !== 1);
    v.ctl.target[1] = M.groundWorld(s.TM, v.ctl.target[0], v.ctl.target[2]).y;
    v.dirty = true;
  }
  function resize(v) {
    var w = v.stage.clientWidth, h = v.stage.clientHeight;
    if (!w || !h) return;
    v.s.renderer.setSize(w, h, false);
    v.s.camera.aspect = w / h; v.s.camera.updateProjectionMatrix();
    v.dirty = true;
  }

  // ------------------------------------------------------------ Earth (Blue Marble)
  // NASA Blue Marble Next Generation (July 2004, cloud-free; public domain) at the quality's size, rotated for the time
  // the light left Earth (Earth's rotation and the Moon frame: js/view3d_math.js earthAxes; sub-observer point checked
  // against JPL Horizons in tests/earth_orientation.js). Lit by the same Sun direction, so the phase is unchanged.
  function loadEarth(v) {
    var s = v.s, w = s.Q.earthTex, key = w;
    var have = window.ASTERIA_EARTH_TEX && window.ASTERIA_EARTH_TEX[key];
    return (have ? Promise.resolve() : loadExtScript('data/earth/earth_' + w + '.js')).then(function () {
      if (V !== v) return;
      new s.THREE.TextureLoader().load(window.ASTERIA_EARTH_TEX[key], function (tex) {
        if (V !== v) { tex.dispose(); return; }
        tex.anisotropy = 4;
        var U = s.earth.material.uniforms; U.uMap.value = tex; U.uHasMap.value = 1;
        s.earthTex = w; v.dirty = true; notes(v);
      });
    }, function (e) { console.warn('Earth texture not loaded: ' + (e && e.message || e)); });
  }
  function orientEarth(v) {
    var s = v.s, r = v.inst && v.inst.r; if (!r || !window.Astronomy) return;
    var tl = new Date(v.inst.t - (r.earth.lightTime_s || 0) * 1000), ax = M.earthAxes(window.Astronomy, tl, window.LunaEngine._moonFrame(new Date(v.inst.t)), v.site.lat, v.site.lon);
    var THREE = s.THREE, bx = new THREE.Vector3().fromArray(ax.x), by = new THREE.Vector3().fromArray(ax.z), bz = new THREE.Vector3().fromArray(ax.y).negate();
    s.earth.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(bx, by, bz));   // SphereGeometry: +x = 0 deg E, +y = north, -z = 90 deg E
    s.earthAxes = ax;
    s.earth.material.uniforms.uSun.value.set(v.sunDir[0], v.sunDir[1], v.sunDir[2]);   // Sun direction (parallel light; phase from the real geometry)
    v.subObs = M.subObserver(ax, v.earthDir);
  }

  // ------------------------------------------------------------ real stars
  // Bright Star Catalogue to the quality's magnitude limit, drawn as points sized and dimmed by magnitude (5 groups),
  // tinted by B-V colour, at their directions for the selected time (engine's Moon orientation; js/view3d_math.js).
  var STAR_BINS = [[-2, 1, 4.5, 1.0], [1, 2, 3.4, 0.92], [2, 3, 2.6, 0.8], [3, 4, 1.9, 0.66], [4, 5.01, 1.4, 0.52]];
  function ensureStars(v) {
    var s = v.s;
    if (s.starRows) return Promise.resolve();
    var go = window.ASTERIA_STARS ? Promise.resolve() : loadExtScript('data/stars.js');
    return go.then(function () {
      if (V !== v || s.starRows) return;
      var THREE = s.THREE, all = window.ASTERIA_STARS.rows.filter(function (r) { return r[3] <= s.Q.starMag; });
      s.starRows = all; s.starBins = [];
      STAR_BINS.forEach(function (b) {
        var rows = all.filter(function (r) { return r[3] >= b[0] && r[3] < b[1]; });
        if (!rows.length) return;
        var col = new Float32Array(rows.length * 3);
        rows.forEach(function (r, k) {
          var bv = Math.max(-0.3, Math.min(1.8, r[4])), t = (bv + 0.3) / 2.1;   // blue-white to orange
          col[3 * k] = b[3] * (0.75 + 0.25 * t); col[3 * k + 1] = b[3] * (0.85 + 0.05 * t); col[3 * k + 2] = b[3] * (1.0 - 0.35 * t);
        });
        var g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rows.length * 3), 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        var pts = new THREE.Points(g, new THREE.PointsMaterial({ size: b[2], sizeAttenuation: false, vertexColors: true }));
        pts.frustumCulled = false;
        s.stars.add(pts); s.starBins.push({ rows: rows, pts: pts });
      });
      updateStars(v); notes(v);
    }, function (e) { console.warn('Star catalogue not loaded: ' + (e && e.message || e)); });
  }
  function updateStars(v) {
    var s = v.s; if (!s.starBins || !v.inst) return;
    var t = new Date(v.inst.t), F = window.LunaEngine._moonFrame(t), years = (t.getTime() - Date.UTC(2000, 0, 1, 12)) / (365.25 * 86400000);
    s.starBins.forEach(function (b) {
      var d = M.starDirs(b.rows, F, v.site.lat, v.site.lon, years), P = b.pts.geometry.attributes.position;
      for (var k = 0; k < d.length; k++) P.array[k] = d[k] * STAR_D;
      P.needsUpdate = true;
    });
    s.starTime = v.inst.t;
  }

  // ------------------------------------------------- framing and orientation aids (Part 8)
  // Oblique view on open: the camera looks across the site with the Sun 35° to the right of the view direction (so
  // slopes are side-lit and the Sun is in the picture), 20° down, far enough to show the surrounding relief.
  // Round 6F: "Choose your point -> 3D". A custom point inside a site's 3D terrain is shown in that site's existing scene
  // (same frame, meshes, heights, Sun/Earth directions and readouts); only the start position, the orbit target and a
  // second marker move to the point. (e, n): the point's azimuthal-equidistant ground coordinates from the tile centre,
  // the exact inverse of M.latLonAt. Walk and Rover need the 6 km tile (clampTile), so a point on the surrounding ring is
  // shown in Orbit only. The status tiles show the main view's values for the point (its own horizon), see setInstant.
  function pointEN(T, lat, lon) {
    var DEG = Math.PI / 180, la = T.meta.lat * DEG, lo = T.meta.lon * DEG, pa = lat * DEG, po = lon * DEG;
    var up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)], east = [-Math.sin(lo), Math.cos(lo), 0];
    var north = [up[1] * east[2] - up[2] * east[1], up[2] * east[0] - up[0] * east[2], up[0] * east[1] - up[1] * east[0]];
    var q = [Math.cos(pa) * Math.cos(po), Math.cos(pa) * Math.sin(po), Math.sin(pa)];
    var dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
    var de = dot(q, east), dn = dot(q, north), h = Math.sqrt(de * de + dn * dn), sd = T.R * Math.atan2(h, dot(q, up));
    return { e: h > 0 ? sd * de / h : 0, n: h > 0 ? sd * dn / h : 0 };
  }
  function setupPoint(v, P) {
    var s = v.s, THREE = s.THREE, g = pointEN(s.T, P.lat, P.lon), lim = s.TM.half - s.TM.d;
    v.pt = { lat: P.lat, lon: P.lon, e: g.e, n: g.n, inTile: Math.abs(g.e) <= lim && Math.abs(g.n) <= lim, km: Math.sqrt(g.e * g.e + g.n * g.n) / 1000, hzText: P.hzText || '' };
    var mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 40, 0]), 3));
    s.ptMat = new THREE.LineBasicMaterial({ color: 0x6f7890 }); s.ptMarker = new THREE.Line(mg, s.ptMat); s.scene.add(s.ptMarker);
    placePoint(v);
    var c = v.ctl;
    if (v.pt.inTile) {
      c.walk.x = v.pt.x; c.walk.z = v.pt.z; c.walk.yaw = v.app.instant() ? v.app.instant().r.sun.az : 0;
      var cl = clampTile(s.TM, v.pt.x + 25, v.pt.z); c.rov.x = cl[0]; c.rov.z = cl[1]; c.rov.yaw = c.walk.yaw + 90; c.rov.ptStart = true;
    }
  }
  function pointNote(v) {
    var pt = v.pt, s = v.s, nm = esc(v.site.name);
    $('v3dPtNote').innerHTML = '<b>Your point</b> (' + pt.lat.toFixed(4) + '°, ' + pt.lon.toFixed(4) + '°E) is ' + (pt.km < 1 ? Math.round(pt.km * 1000) + ' m' : pt.km.toFixed(1) + ' km') + ' from the marker of ' + nm + ', ' +
      (pt.inTile ? 'on its 6 km LOLA tile (' + s.T.d + ' m grid).' : 'on the LOLA terrain around its 6 km tile (100 m grid). Orbit only.') +
      ' The status tiles are the main view\'s values for your point' + (pt.hzText ? ' (' + esc(pt.hzText) + ')' : '') + '. The terrain, Sun and Earth are this site\'s 3D scene (same LOLA data and directions, no new terrain); Sun/Earth label azimuths are measured at the site marker.';
    if (!pt.inTile) {
      var why = $('v3dModeWhy'); why.hidden = false; why.textContent = 'Walk and Rover need the 6 km tile around the site marker; your point is on the coarser surrounding terrain, so it is shown in Orbit only.';
      v.el.querySelectorAll('.seg button[data-mode="walk"], .seg button[data-mode="rover"], .v3d-presets button[data-preset="eye"], .v3d-presets button[data-preset="sun"], .v3d-presets button[data-preset="earth"]').forEach(function (b) { b.disabled = true; b.title = why.textContent; });
    }
  }
  // world position of the point on the finest loaded drawn surface (tile mesh, else ring A grid; the site height until the
  // ring has loaded), and the marker there
  function placePoint(v) {
    var s = v.s, pt = v.pt, h;
    if (pt.inTile) h = M.meshHeightAt(s.TM, pt.e, pt.n);
    else if (s.ext.a && M.inside(s.ext.a, pt.e, pt.n)) h = M.heightAt(s.ext.a, pt.e, pt.n);
    else h = s.T.h0;
    var w = M.toThree(M.enu(s.T, pt.e, pt.n, h));
    pt.x = w[0]; pt.y = w[1]; pt.z = w[2]; pt.exact = pt.inTile || !!s.ext.a;
    s.ptMarker.position.set(w[0], w[1], w[2]);
  }
  function defaultView(v) {
    var c = v.ctl, r = v.inst && v.inst.r; if (!r) return;
    c.target = [0, groundY(v.s, 0, 0), 0];
    if (v.pt) { placePoint(v); c.target = [v.pt.x, v.pt.y, v.pt.z]; }
    c.yaw = r.sun.az + 180 - 35; c.pitch = 20; c.dist = v.s.Q.ringA > 1 ? 7000 : 9000;
    var A = v.s.gridA || v.s.ext.a;
    if (A) {   // a site in a deep depression (e.g. a crater floor): back off to show the walls around it
      var hmax = -1e9;
      var st = A.d < 50 ? Math.round(400 / A.d) : 4;   // same ~400 m sampling as before round 6
      for (var j = 0; j < A.n; j += st) for (var i = 0; i < A.n; i += st) {
        var e = (i - A.c) * A.d, n = (A.c - j) * A.d;
        if (e * e + n * n < 12000 * 12000) hmax = Math.max(hmax, A.H[j * A.n + i]);
      }
      if (hmax - v.s.T.h0 > 1500) { c.dist = 26000; c.pitch = 32; }
    }
    v.dirty = true;
  }
  function compassName(az) { return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((az % 360) + 360) % 360 / 45) % 8]; }
  function niceLen(m) { var p = Math.pow(10, Math.floor(Math.log10(m))), f = m / p; return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p; }
  function fmtLen(m) { return m >= 1000 ? (m / 1000).toFixed(m % 1000 ? 1 : 0) + ' km' : Math.round(m) + ' m'; }
  // compass, scale bar and distance readout
  function hud(v) {
    var s = v.s, cam = s.camera, c = v.ctl, THREE = s.THREE;
    var f = new THREE.Vector3(); cam.getWorldDirection(f);
    var head = Math.atan2(f.x, -f.z) * 180 / Math.PI; if (head < 0) head += 360;
    $('v3dCompassRot').setAttribute('transform', 'rotate(' + (-head).toFixed(1) + ')');
    $('v3dHeading').textContent = 'Facing ' + compassName(head) + ' (' + head.toFixed(0) + '°)';
    var D = c.mode === 'orbit' ? c.dist : 100, h = v.stage.clientHeight || 1;
    var mpp = 2 * D * Math.tan(cam.fov * Math.PI / 360) / h, len = niceLen(mpp * 110);
    $('v3dScaleBar').style.width = (len / mpp).toFixed(0) + 'px';
    $('v3dScaleTxt').textContent = fmtLen(len) + (c.mode === 'orbit' ? ' (at the view centre)' : ' (at 100 m ahead)');
    var px, pz;
    if (c.mode === 'orbit') { px = c.target[0]; pz = c.target[2]; }
    else if (c.mode === 'walk') { px = c.walk.x; pz = c.walk.z; }
    else { px = c.rov.x; pz = c.rov.z; }
    var g = M.gridFromWorld(s.TM, px, pz, true), d = Math.sqrt(g.e * g.e + g.n * g.n);
    var dtxt = (c.mode === 'orbit' ? 'View centre ' : c.mode === 'walk' ? 'You are ' : 'Rover ') + fmtLen(d) + ' from the site' + (d > 1 ? ' (' + compassName(Math.atan2(g.e, g.n) * 180 / Math.PI) + ')' : '');
    if (c.mode === 'orbit') dtxt += ' · camera ' + fmtLen(c.dist) + ' away';
    if (c.mode === 'rover') dtxt += ' · driven ' + fmtLen(c.rov.dist);
    $('v3dDist').textContent = dtxt;
    v.hudState = { heading: head, scaleM: len, metresPerPixel: mpp, distFromSite: d };
  }
  // round 6E Part 2: wheel tracks (Illustrative; display only): path points for the covering shader. The last entry
  // follows the rover; a new one is kept every WHEEL_STEP m; the oldest drop out after WHEEL_N points.
  function wheelPush(v) {
    var s = v.s, r = v.ctl.rov, T = s.U.uTrk.value, n = s.U.uTrkN.value;
    if (n === 0) { T[0].set(r.x, r.z); T[1].set(r.x, r.z); s.U.uTrkN.value = 2; return; }
    T[n - 1].set(r.x, r.z);
    if (Math.hypot(r.x - T[n - 2].x, r.z - T[n - 2].y) >= WHEEL_STEP) {
      if (n >= WHEEL_N) { for (var k = 0; k < n - 1; k++) T[k].copy(T[k + 1]); n--; }
      T[n].set(r.x, r.z); s.U.uTrkN.value = n + 1;
    }
  }
  // rover track: fading trail of the last TRACK_MAX positions (one every metre), 0.15 m above the ground
  function trackPush(v) {
    var s = v.s, r = v.ctl.rov, last = s.trackLast;
    if (last && Math.hypot(r.x - last[0], r.z - last[1]) < 1) return;
    s.trackLast = [r.x, r.z];
    var P = s.track.geometry.attributes.position, C = s.track.geometry.attributes.color;
    if (s.trackN >= TRACK_MAX) { P.array.copyWithin(0, 3); s.trackN = TRACK_MAX - 1; }
    P.array.set([r.x, groundY(s, r.x, r.z) + 0.15, r.z], 3 * s.trackN); s.trackN++;
    for (var k = 0; k < s.trackN; k++) { var a = 0.15 + 0.85 * k / Math.max(1, s.trackN - 1); C.array[3 * k] = a; C.array[3 * k + 1] = 0.85 * a; C.array[3 * k + 2] = 0.35 * a; }
    P.needsUpdate = true; C.needsUpdate = true; s.track.geometry.setDrawRange(0, s.trackN);
  }
  // named features (IAU Gazetteer): on the drawn ground, or on the distant skyline in their direction if farther away
  function featureLabels(v) {
    var s = v.s, F = (window.ASTERIA_FEATURES3D && window.ASTERIA_FEATURES3D.sites[v.site.id]) || [], box = $('v3dFeat');
    if (!s.featEls || s.featEls.length !== F.length) {
      box.innerHTML = '';
      s.featEls = F.map(function (f) {
        var el = document.createElement('span'); el.className = 'v3d-lbl feat';
        box.appendChild(el); return el;
      });
    }
    var on = $('v3dFeatOn').checked, w = v.stage.clientWidth, h = v.stage.clientHeight, p = new s.THREE.Vector3(), out = [];
    F.forEach(function (f, k) {
      var el = s.featEls[k], y = groundY(s, f.e, -f.n), onGround = y > -1e8, pos;
      var what = f.type.replace(/,.*/, '').toLowerCase() + (f.diameter_km ? ', ' + (f.diameter_km >= 10 ? f.diameter_km.toFixed(0) : f.diameter_km.toFixed(1)) + ' km' : '');
      if (onGround) { pos = [f.e, y + 40, -f.n]; el.textContent = f.name + ' (' + what + ')'; }
      else {
        var az = Math.atan2(f.e, f.n) * 180 / Math.PI; if (az < 0) az += 360;
        var mask = v.openArgs.mask, el0 = mask ? window.LunaEngine.maskAt(mask, az) : 0, d = M.dirFromAzEl(az, el0 + 0.4);
        pos = [d[0] * RING_M, EYE_M + d[1] * RING_M, d[2] * RING_M];
        el.textContent = f.name + ' (' + what + '), ' + f.dist_km.toFixed(0) + ' km away';
      }
      p.set(pos[0], pos[1], pos[2]).project(s.camera);
      var ok = on && p.z < 1 && p.z > -1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
      el.style.display = ok ? '' : 'none';
      if (ok) setPos(el, (p.x + 1) / 2 * w, (1 - p.y) / 2 * h);
      el.classList.toggle('far', !onGround);
      out.push({ name: f.name, onGround: onGround, shown: ok, text: el.textContent });
    });
    v.featState = out;
  }
  // mini-map: LOLA heights of ring A (lighter = higher), the 6 km tile square, the site, your position and heading,
  // and the Sun and Earth directions; north up
  function miniMap(v) {
    var s = v.s, cv = $('v3dMiniCv'); if (!cv || $('v3dMini').hidden) return;
    var A = s.ext.a, G = A || s.T, W = cv.width, ctx = cv.getContext('2d'), half = G.half;
    if (!s.miniBase) {
      var img = ctx.createImageData(W, W), lo = Infinity, hi = -Infinity;
      for (var q = 0; q < G.H.length; q++) { lo = Math.min(lo, G.H[q]); hi = Math.max(hi, G.H[q]); }
      for (var y = 0; y < W; y++) for (var x = 0; x < W; x++) {
        var e = (x / (W - 1) * 2 - 1) * half, n = (1 - y / (W - 1) * 2) * half, hh = M.heightAt(G, e, n), t = (hh - lo) / Math.max(1, hi - lo);
        var gv = Math.round(30 + 190 * t), o = 4 * (y * W + x);
        img.data[o] = gv; img.data[o + 1] = gv; img.data[o + 2] = Math.round(gv * 1.03); img.data[o + 3] = 255;
      }
      var off = document.createElement('canvas'); off.width = off.height = W; off.getContext('2d').putImageData(img, 0, 0);
      s.miniBase = off; s.miniHalf = half;
      $('v3dMiniCap').textContent = 'Top view, north up, ' + (2 * half / 1000).toFixed(0) + ' km across; shade = LOLA height (lighter = higher); square = 6 km tile; white dot = site; pink = you; white square and wedge = camera and its view; yellow / blue = Sun / Earth direction (hollow = hidden)';
    }
    var k = W / (2 * s.miniHalf), X = function (e) { return W / 2 + e * k; }, Y = function (n) { return W / 2 - n * k; };
    ctx.drawImage(s.miniBase, 0, 0);
    ctx.strokeStyle = 'rgba(89,217,255,.9)'; ctx.lineWidth = 2; ctx.strokeRect(X(-s.TM.half), Y(s.TM.half), 2 * s.TM.half * k, 2 * s.TM.half * k);
    var dirArrow = function (az, col, hollow) {
      var a = az * Math.PI / 180, r = W / 2 - 14, x = W / 2 + Math.sin(a) * r, y = W / 2 - Math.cos(a) * r;
      ctx.beginPath(); ctx.arc(x, y, 10, 0, 2 * Math.PI);
      if (hollow) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); } else { ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke(); }
    };
    // direction of the Sun (yellow) and Earth (blue) at the map edge; hollow when the validated model says hidden
    if (v.inst) { dirArrow(v.inst.r.sun.az, '#ffc23d', !v.inst.sunUp); dirArrow(v.inst.r.earth.az, '#4ea8ff', !v.inst.earthUp); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(0), Y(0), 5, 0, 2 * Math.PI); ctx.fill();
    var c = v.ctl, px, pz, yaw;
    if (c.mode === 'orbit') { px = c.target[0]; pz = c.target[2]; yaw = c.yaw + 180; }
    else if (c.mode === 'walk') { px = c.walk.x; pz = c.walk.z; yaw = c.walk.yaw; }
    else { px = c.rov.x; pz = c.rov.z; yaw = c.rov.yaw; }
    // round 6: the camera's position and its horizontal field of view (all modes)
    var cam = s.camera, fw = new s.THREE.Vector3(); cam.getWorldDirection(fw);
    var hd = Math.atan2(fw.x, -fw.z), hf = Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect), cxp = X(cam.position.x), cyp = Y(-cam.position.z), Lw = W * 0.28;
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cxp, cyp); ctx.lineTo(cxp + Math.sin(hd - hf) * Lw, cyp - Math.cos(hd - hf) * Lw); ctx.lineTo(cxp + Math.sin(hd + hf) * Lw, cyp - Math.cos(hd + hf) * Lw); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.rect(cxp - 4, cyp - 4, 8, 8); ctx.fill(); ctx.stroke();
    v.miniCam = { x: cxp, y: cyp, heading: (hd * 180 / Math.PI + 360) % 360 };
    var gx = X(px), gy = Y(-pz), ya = yaw * Math.PI / 180;
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(ya);
    ctx.fillStyle = '#ff5c8a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('N ↑', 8, 6);
  }

  // ------------------------------------------------- relief shading and finest data in Walk / Rover (round 5)
  // Relief shading is on by default in Walk and Rover and off in Orbit, unless the user has set the checkbox.
  // Round 6B: off by default in Orbit, on in Walk and Rover; a choice the user makes in one mode is kept for that mode
  // (this session only), and switching mode re-applies that mode's default unless the user changed it there.
  function reliefOn(v) { var p = RELIEF_PREF[v.ctl.mode]; return p === true || p === false ? p : v.ctl.mode !== 'orbit'; }
  function applyRelief(v) {
    var on = reliefOn(v); $('v3dRelief').checked = on;
    v.s.terrainMat.userData.uniforms.uRelief.value = on ? 1 : 0;
    v.dirty = true;
  }
  // Walk and Rover look at the ground from 2-14 m: use the finest real data there is. On laptops (not on phones) the
  // 6 km tile is drawn at full resolution even at Low quality, and the 5 m LOLA patch is loaded where it exists
  // (3 sites) even below High. Readouts then use the same grids as the picture (the 5 m patch near those sites).
  function ensureFine(v) {
    var s = v.s; if (v.phone || s.fine) return;
    s.fine = true;
    var go = function () {
      if (V !== v) return;
      if (v.stride > 1) { s.TM = s.T; v.stride = 1; s.TM.k = s.T.k; }
      buildTerrain(s); v.dirty = true; notes(v);
      if (aoActive(v)) ensureAO(v);
    };
    var id = v.site.id, want = !s.Q.patch5m;
    var idx = want && !window.ASTERIA_TERRAIN3D_5M_IDS ? loadExtScript('data/terrain3d/hi5m_index.js') : Promise.resolve();
    idx.then(function () {
      if (!want || (window.ASTERIA_TERRAIN3D_5M_IDS || []).indexOf(id) < 0) return;
      var have = window.ASTERIA_TERRAIN3D_5M && window.ASTERIA_TERRAIN3D_5M[id];
      return (have ? Promise.resolve() : loadExtScript('data/terrain3d/hi5m/' + id + '.js')).then(function () {
        if (!EXT_CACHE[id + 'p5']) EXT_CACHE[id + 'p5'] = M.decodeTile(window.ASTERIA_TERRAIN3D_5M[id]);
        s.ext.p5 = EXT_CACHE[id + 'p5']; s.ext.p5.k = s.T.k;
      });
    }).then(go, function (e) { console.warn('5 m patch not loaded: ' + (e && e.message || e)); go(); });
  }

  // ------------------------------------------------- earthshine (round 6)
  // A directional light from the engine's Earth direction with the physically scaled intensity
  //   Sun intensity x p (R_E/d)^2 Phi(alpha)   (M.earthshineRatio: geometric albedo p = 0.434, NASA Earth Fact Sheet;
  // R_E/d from Earth's angular radius; Lambert phase law at the phase angle from the engine's Sun and Earth vectors).
  // Visibility: off when Earth's centre is below the validated terrain horizon at the site marker (rays to 300 km);
  // on Medium/High the drawn terrain also casts earthshine shadows. Earth is treated as a point source (its disk is
  // about 1.9 deg wide, so real earthshine shadows have soft edges). Because earthshine is about 10^4 times fainter than
  // sunlight, a site in shadow is shown with the exposure raised by 1 / ratio (like a long camera exposure; sunlit ground
  // is then overexposed), and the non-physical uniform fill light is switched off while earthshine is on.
  // Display only: no status, readout or computed value uses it.
  function applyEarthshine(v) {
    var s = v.s, i = v.inst; if (!s || !i) return;
    var on = !!($('v3dEarthshine') && $('v3dEarthshine').checked), r = i.r;
    var es = M.earthshineRatio(r.sun, r.earth), visible = r.earth.el > i.hzEarth;
    v.esOn = on;
    s.earthLight.intensity = on && visible ? 1.7 * es.ratio : 0;
    if (s.earthLight.castShadow) s.earthLight.shadow.needsUpdate = true;
    // exposure for a site in shadow: earthshine on flat ground then reads like a light of 0.35x the Sun's display
    // intensity (mid-grey), and the relief-shading contrast is normalised by Earth's elevation instead of the Sun's
    v.esExposure = on && visible && !i.sunUp ? 0.35 / es.ratio : 1;
    s.U.uFlat.value = Math.max(0.06, Math.sin(Math.max(0, v.esExposure > 1 ? r.earth.el : r.sun.el) * Math.PI / 180));
    v.earthshine = { on: on, ratio: es.ratio, ratioBond: es.ratioBond, phaseAngle: es.phaseAngle, illuminated: es.illuminated, visible: visible, exposure: v.esExposure, intensity: s.earthLight.intensity, shadows: !!s.earthLight.castShadow };
    var n = $('v3dEsNote'), fmt = function (x) { return Math.round(x).toLocaleString('en-US'); };
    if (n) {
      n.hidden = !on;
      if (on) n.textContent = !visible ? 'Earth\'s centre is below the terrain horizon at the site marker (validated horizon model), so no earthshine reaches it: ground in shadow stays dark.' :
        'Earthshine here: about 1/' + fmt(1 / es.ratio) + ' of direct sunlight (Earth ' + (100 * es.illuminated).toFixed(0) + ' % lit, ' + (2 * r.earth.radius_deg).toFixed(2) + '° across; albedo 0.434). ' +
        (i.sunUp ? 'The Sun is up at the site, so earthshine is far too faint to see at normal exposure.' : 'Exposure raised ×' + fmt(v.esExposure) + ' (like a long camera exposure) because the site is in shadow; anything in sunlight is overexposed.') +
        ' Approximate: Earth treated as an evenly reflecting sphere (real value within about a factor of 2).';
    }
    setBrightness(v, v.bright || 1, true);
  }

  // ------------------------------------------------- real-data overlays (contours, slope)
  function overlays(v) {
    var U = v.s.terrainMat.userData.uniforms, c = $('v3dContours').checked, sl = $('v3dSlope').checked, iv = +$('v3dContourInt').value, hz = $('v3dHazard').checked;
    U.uContour.value = c ? iv : 0; U.uSlope.value = hz ? 100 + hazardLimit() : sl ? 1 : 0;
    var L = $('v3dLegend'), parts = [];
    if (c) parts.push('<span><i class="cl"></i>Contour lines every ' + iv + ' m (every 5th brighter), from the LOLA heights</span>');
    if (hz) parts.push('<span><i style="background:#f22a8c"></i>Hazard view: slope above ' + hazardLimit() + '° (your limit) from the LOLA heights, by central differences over each area\'s grid (' + (v.s.areas || []).map(function (a) { return a.geom + ' m'; }).join(', ') + '). Real slopes over a few metres can be steeper. Not a traversability prediction.</span>');
    if (sl) parts.push('<span>Slope from the DEM: <i style="background:#9c9a95"></i>&lt; 10° <i style="background:#edcc40"></i>10-20° <i style="background:#f28026"></i>20-30° <i style="background:#d92e2e"></i>&gt; 30°</span>');
    L.innerHTML = parts.join('');
    L.hidden = !parts.length;
    v.dirty = true;
  }
  // a contour interval giving about 30 lines across the tile's relief
  function defaultContour(T) {
    var r = T.meta.heightMax_m - T.meta.heightMin_m, best = 10;
    [10, 25, 50, 100, 250].forEach(function (x) { if (r / x >= 25) best = x; });
    return best;
  }

  // ------------------------------------------------- exploration and inspection (round 6, Part 3)
  // Camera presets. Directions of the Sun and Earth from the engine (validated az/el), never from the picture.
  function preset(v, name) {
    var c = v.ctl, i = v.inst;
    if (v.pt && !v.pt.inTile && name !== 'overview') return;   // round 6F: eye-level presets need the 6 km tile
    v.userMoved = true;
    if (name === 'overview') { setMode(v, 'orbit'); defaultView(v); }
    else {
      var keep = c.mode === 'walk' ? { x: c.walk.x, z: c.walk.z } : { x: 0, z: 0 };
      if (name === 'eye') keep = v.pt ? { x: v.pt.x, z: v.pt.z } : { x: 0, z: 0 };
      var az = 0, el = 2;
      if (i && name === 'eye') { az = i.r.sun.az; el = 2; }
      if (i && name === 'sun') { az = i.r.sun.az; el = i.r.sun.el; }
      if (i && name === 'earth') { az = i.r.earth.az; el = i.r.earth.el; }
      c.walk = { x: keep.x, z: keep.z, yaw: az, pitch: Math.max(-80, Math.min(80, el)) };
      setMode(v, 'walk', true);
    }
    v.lastPreset = name; v.dirty = true;
  }
  // Ground point under (x, z) on the finest DATA grid there (5 m patch, tile, ring A, ring B): heights, slopes and
  // lat/lon come from the stored LOLA grids (true heights, also with vertical exaggeration).
  function dataGridAt(s, x, z) {
    var c = [[s.T, 'tile'], [s.ringA ? (s.lightA || s.gridA) : null, 'ringA'], [s.ringBG ? s.gridB : null, 'ringB']];
    for (var q = 0; q < c.length; q++) {
      var G = c[q][0]; if (!G) continue;
      var g = M.gridFromWorld(G, x, z, false);
      if (M.inside(G, g.e, g.n)) {
        var P = G === s.T && s.T.patch && Math.abs(g.e) <= s.T.patch.half && Math.abs(g.n) <= s.T.patch.half ? s.T.patch : null;
        var drawn = q === 0 ? (P ? P.d : s.TM.d) : q === 1 ? s.ringA.d : s.ringBG.d;
        return { G: G, e: g.e, n: g.n, area: P ? '5 m patch' : ['6 km tile', 'ring A (to 16 km)', 'ring B (to 40 km)'][q], d: P ? P.d : G.d, product: (P || G).meta.demProduct, drawn: drawn };
      }
    }
    return null;
  }
  // Pointer inspection: the first point of the drawn terrain along the ray through the pixel (ray march, then bisection).
  function inspectAt(v, cx, cy) {
    var s = v.s, THREE = s.THREE, rc = v.stage.getBoundingClientRect();
    var ndc = new THREE.Vector2((cx - rc.left) / rc.width * 2 - 1, -((cy - rc.top) / rc.height) * 2 + 1);
    var ray = new THREE.Raycaster(); ray.setFromCamera(ndc, s.camera);
    var o = ray.ray.origin, d = ray.ray.direction, t0 = 0, hit = null;
    var below = function (t) { var x = o.x + d.x * t, z = o.z + d.z * t, gy = groundY(s, x, z); return gy > -1e8 && o.y + d.y * t <= gy; };
    // round 6B: the same sample sequence as before (t = 0.5 m, then steps of max(0.5 m, 0.5 % of t)), but samples where
    // the ray is above the highest drawn terrain or outside the outermost drawn grid cannot be below the ground and are
    // not evaluated; the march stops once the ray rises above the top or moves away outside the drawn area. The first
    // bracket and its bisection are those of the full march, so the hit point is the same.
    var top = s.terrainTop === undefined ? Infinity : s.terrainTop + 1, ext = (s.terrainExt || 1e9) / 0.98 + 1;
    for (var t = 0.5; t < 90000; t += Math.max(0.5, t * 0.005)) {
      var ry = o.y + d.y * t, rx = o.x + d.x * t, rz = o.z + d.z * t;
      if (ry > top) { if (d.y >= 0) break; t0 = t; continue; }
      var outX = Math.abs(rx) > ext, outZ = Math.abs(rz) > ext;
      if (outX || outZ) { if ((!outX || rx * d.x > 0) && (!outZ || rz * d.z > 0)) break; t0 = t; continue; }
      if (below(t)) { var a = t0, b = t; for (var k = 0; k < 30; k++) { var m = (a + b) / 2; if (below(m)) b = m; else a = m; } hit = b; break; }
      t0 = t;
    }
    if (hit === null) return null;
    var x = o.x + d.x * hit, z = o.z + d.z * hit, D = dataGridAt(s, x, z);
    if (!D) return null;
    var h = M.heightAt(D.G, D.e, D.n), sl = M.slopeAt(D.G, D.e, D.n), ll = M.latLonAt(s.T.meta.lat, s.T.meta.lon, D.e, D.n, s.T.R);
    return { x: x, y: groundY(s, x, z), z: z, e: D.e, n: D.n, h: h, slope: sl.slope, lat: ll.lat, lon: ll.lon, dist: Math.sqrt(D.e * D.e + D.n * D.n), area: D.area, d: D.d, product: D.product, drawn: D.drawn, px: cx - rc.left, py: cy - rc.top };
  }
  function showInspect(v, r, pinned) {
    var el = $('v3dInspect'), mk = $('v3dInspMark'); if (!el) return;
    v.inspect = r;
    if (!r) { el.hidden = true; if (mk) mk.hidden = true; v.inspectPinned = false; return; }
    var dist = r.dist >= 1000 ? (r.dist / 1000).toFixed(2) + ' km' : r.dist.toFixed(0) + ' m';
    el.innerHTML = '<b>Height</b> ' + r.h.toFixed(1) + ' m <span class="fineprint">(above the 1737.4 km sphere)</span><br><b>Slope</b> ' + r.slope.toFixed(1) + '° <span class="fineprint">(central differences over ' + r.d + ' m)</span><br>' +
      r.lat.toFixed(4) + '°, ' + r.lon.toFixed(4) + '°E · ' + dist + ' from the site<br><span class="fineprint">Data here: ' + r.d + ' m LOLA grid (' + esc(r.product) + '), ' + esc(r.area) + (r.drawn !== r.d ? ', drawn at ' + r.drawn + ' m' : '') + '. Calculated from LOLA; real slopes over a few metres can be steeper.</span>' + (pinned ? '' : '');
    el.hidden = false; mk.hidden = false;
    placeInspect(v, r.px, r.py);
  }
  function placeInspect(v, px, py) {
    var el = $('v3dInspect'), mk = $('v3dInspMark');
    var W = v.stage.clientWidth, H = v.stage.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(4, Math.min(W - w - 4, px + 14)) + 'px'; el.style.top = Math.max(4, Math.min(H - h - 4, py + 14)) + 'px';
    mk.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
  }
  // round 6B: the marker (and the readout next to it) follows the inspected ground point when the camera moves
  function inspectMarker(v) {
    var r = v.inspect; if (!r) return;
    var p = new v.s.THREE.Vector3(r.x, r.y, r.z).project(v.s.camera), ok = p.z < 1 && p.z > -1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
    $('v3dInspMark').hidden = !ok; $('v3dInspect').hidden = !ok;
    if (ok) { r.px = (p.x + 1) / 2 * v.stage.clientWidth; r.py = (1 - p.y) / 2 * v.stage.clientHeight; placeInspect(v, r.px, r.py); }
  }
  // Ground position of the current view (Orbit: the view centre; Walk/Rover: you / the rover) as lat/lon.
  function viewLatLon(v) {
    var c = v.ctl, x, z;
    if (c.mode === 'orbit') { x = c.target[0]; z = c.target[2]; } else if (c.mode === 'walk') { x = c.walk.x; z = c.walk.z; } else { x = c.rov.x; z = c.rov.z; }
    var g = M.gridFromWorld(v.s.TM, x, z, true), ll = M.latLonAt(v.s.T.meta.lat, v.s.T.meta.lon, g.e, g.n, v.s.T.R);
    return { lat: ll.lat, lon: ll.lon, e: g.e, n: g.n };
  }
  function showOn2D(v) {
    var ll = viewLatLon(v), app = v.app;
    close();
    if (app.showOn2D) app.showOn2D(ll.lat, ll.lon);
    return ll;
  }
  // Hazard view: slopes above the user's limit (the rover's slope-warning threshold), from the DEM-derived slope of
  // each mesh vertex (central differences over that grid's spacing). Calculated; real slopes over a few metres can be steeper.
  function hazardLimit() { return Math.max(1, Math.min(45, +$('v3dHazMax').value || 15)); }

  // ------------------------------------------------- quality and brightness
  function initDisplay(v) {
    $('v3dQuality').value = v.quality;
    $('v3dQWhy').textContent = v.userQuality ? '(your choice)' : '(automatic: ' + v.auto.why + ')';
    var b = parseFloat(lsGet('asteria.v3dBrightness'));
    setBrightness(v, isFinite(b) && b >= 0.5 && b <= 6 && Math.abs(b - LIGHT_UP) > 0.01 ? b : 1, true);
  }
  // Display brightness only: tone-mapping exposure, and the faint fill light scaled with it. The Sun direction,
  // the shadows' geometry and every computed value are untouched.
  function setBrightness(v, b, noSave) {
    v.bright = b;
    // round 6: with earthshine on, the non-physical fill light is off and, while the site is in shadow, the exposure is
    // multiplied by v.esExposure (see applyEarthshine); display only, like the slider itself
    v.s.renderer.toneMappingExposure = b * (v.esExposure || 1);
    v.s.fill.intensity = v.esOn ? 0 : FILL * b;
    $('v3dBright').value = b; $('v3dBrightVal').textContent = b.toFixed(1) + '×';
    var lit = b >= LIGHT_UP - 0.01;
    $('v3dLightUp').setAttribute('aria-pressed', lit ? 'true' : 'false');
    $('v3dLightUp').textContent = lit ? 'Normal brightness' : 'Light up';
    if (!noSave) lsSet('asteria.v3dBrightness', String(b));
    updateTip(v);
    v.dirty = true;
  }
  // "Light up" (round 5): a temporary boost for ground in shadow. It is not remembered between visits, and it switches
  // itself off when the validated status says the Sun is up at the site marker: at 3x exposure sunlit ground clips to
  // pure white and every slope looks the same (measured in tests/ground_detail.js). The slider is still remembered.
  function lightUp(v) { v.lightUpFrom = v.bright < LIGHT_UP - 0.01 ? v.bright : (v.lightUpFrom || 1); setBrightness(v, LIGHT_UP, true); v.lightUpAuto = true; }
  function lightUpOff(v, why) {
    v.lightUpAuto = false; setBrightness(v, v.lightUpFrom || 1, true);
    if (why) { var n = $('v3dQNote'); n.hidden = false; n.textContent = why; setTimeout(function () { if (V === v && n.textContent === why) n.hidden = true; }, 6000); }
  }
  // round 6B: shadows on/off. Off: receivers ignore the shadow maps (uNoShadow) and the maps are not rendered (saves the
  // shadow passes); the lights, their order and their directions are unchanged. On: every map is re-rendered once.
  function applyShadows(v) {
    var s = v.s, on = shadowsOn();
    s.U.uNoShadow.value = on ? 0 : 1;
    s.renderer.shadowMap.autoUpdate = on;
    if (on) { s.renderer.shadowMap.needsUpdate = true; [s.sun, s.sunNear, s.earthLight].forEach(function (L) { if (L && L.castShadow) L.shadow.needsUpdate = true; }); }
    if (v.inst) setInstant(v, v.inst);
    notes(v);
    v.dirty = true;
  }
  function updateTip(v) {
    var tip = $('v3dTip'); if (!tip) return;
    // "ground looks almost black" is true when the Sun light is off (Sun below the horizon) or cast shadows are drawn;
    // with shadows off and the Sun above the flat horizon the ground is drawn lit, so the tip says that and offers no
    // "Light up" (round 6B). "Jump to next sunlight" is offered in both cases.
    tip.hidden = !(v.inst && !v.inst.sunUp);
    var dark = shadowsOn() || v.s.sun.intensity === 0;
    $('v3dTipTxt').textContent = dark ? 'The site is in shadow, so the ground looks almost black.' : 'The Sun is hidden behind terrain at the site (validated model); shadows are off, so the ground is drawn lit.';
    $('v3dTipBtn').hidden = !dark || v.bright >= LIGHT_UP - 0.01;
    $('v3dTip').querySelector('.fineprint').hidden = $('v3dTipBtn').hidden;
  }
  // Rebuild the view at another quality level (renderer options such as antialiasing need a new context),
  // keeping the camera, mode, time and toggles.
  function setQuality(v, q, why) {
    if (!QUALITY[q] || q === v.quality) return null;
    var c = v.ctl;
    var keep = { ctl: JSON.parse(JSON.stringify({ mode: c.mode, target: c.target, dist: c.dist, yaw: c.yaw, pitch: c.pitch, walk: c.walk, rov: c.rov })),
      exag: v.s.T.k, probed: true, auto: v.auto, note: why || '', toggles: {} };
    v.el.querySelectorAll('.v3d-panel input[type=checkbox]').forEach(function (x) { keep.toggles[x.id] = x.checked; });
    var o = Object.assign({}, v.openArgs, { quality: q, keep: keep });
    close(true, true);
    return open(o);
  }
  function restoreKeep(v, k) {
    Object.keys(k.toggles || {}).forEach(function (id) { var x = $(id); if (x && x.checked !== k.toggles[id]) { x.checked = k.toggles[id]; x.dispatchEvent(new Event('change')); } });
    if (k.exag && k.exag !== 1) { $('v3dExag').value = String(k.exag); setExag(v, k.exag); }
    var c = v.ctl;
    ['target', 'dist', 'yaw', 'pitch', 'walk', 'rov'].forEach(function (x) { if (k.ctl[x] !== undefined) c[x] = k.ctl[x]; });
    setMode(v, k.ctl.mode);
    if (k.note) { var n = $('v3dQNote'); n.hidden = false; n.textContent = k.note; setTimeout(function () { if (V === v) n.hidden = true; }, 8000); }
  }
  // Frame-rate probe (about 1.5 s of continuous rendering right after opening). If the average stays below
  // 30 frames/s, step down one level and say so. Skipped when the user has chosen a level.
  function probe(v) {
    if (V !== v) return;
    v.probing = true; v.dirty = true;
    var f0 = v.frames, t0 = performance.now();
    setTimeout(function () {
      if (V !== v) return;
      v.probing = false;
      var fps = (v.frames - f0) / ((performance.now() - t0) / 1000);
      if (window.ASTERIA_V3D_FAKE_FPS) fps = window.ASTERIA_V3D_FAKE_FPS;   // test hook
      v.probeResult = { fps: Math.round(fps), stepped: false };
      var i = QORDER.indexOf(v.quality);
      if (fps < 30 && i > 0) {
        var from = v.quality;
        var nv = setQuality(v, QORDER[i - 1], 'Quality lowered to ' + QUALITY[QORDER[i - 1]].label + ' automatically (' + Math.round(fps) + ' frames/s at ' + QUALITY[from].label + '). You can change it under Quality.');
        if (nv) nv.probeResult = { fps: Math.round(fps), stepped: true, from: from };
      }
    }, 1500);
  }

  // ---------------------------------------------------------- open/close
  // o = { site, tile, mask, app: { instant(), setIdx(i), onInstant(fn) -> unsubscribe, setPlaying(b), playing() } }
  function open(o) {
    if (V) close(true);
    if (!window.THREE || !M) throw new Error('3D libraries not loaded');
    var phone = isPhone();
    var auto = o.keep && o.keep.auto ? o.keep.auto : autoQuality();
    var user = lsGet('asteria.v3dQuality'), qName = o.quality || (QUALITY[user] ? user : auto.q);
    var Q = QUALITY[qName], stride = o.tile.n > 200 ? Q.stride : 1;
    var inst0 = o.app.instant();
    var el = buildDom({ site: o.site, tile: o.tile, stride: stride, earthRadiusDeg: inst0 && inst0.r.earth.radius_deg, point: o.point || null });
    var v = { el: el, stage: $('v3dStage'), app: o.app, site: o.site, dirty: true, frames: 0, raf: 0 };
    v.s = buildScene({ tile: o.tile, mask: o.mask, phone: phone, stride: stride, Q: Q });
    v.earthRadiusDeg = inst0 && inst0.r.earth.radius_deg;
    v.stride = stride; v.phone = phone; v.quality = qName; v.Q = Q; v.auto = auto; v.userQuality = QUALITY[user] ? user : null; v.openArgs = o;
    v.stage.insertBefore(v.s.renderer.domElement, v.stage.firstChild);
    v.s.renderer.domElement.setAttribute('aria-label', '3D view of the terrain around ' + o.site.name + ' with the Sun and Earth at their computed positions');
    v.ctl = Controls(v);
    if (o.point) setupPoint(v, o.point);
    V = v;
    if (v.pt) pointNote(v);
    document.body.classList.add('v3d-open');
    bind(v);
    resize(v);
    if (inst0) {
      setInstant(v, inst0);
      defaultView(v);
    }
    initDisplay(v);
    $('v3dHover').checked = HOVER.on;
    $('v3dShadows').checked = SESSION.shadows; applyShadows(v);
    // round 6B: real stars on by default (background only; no calculation, readout, hit test, shadow or status uses them)
    if ($('v3dStars').checked) ensureStars(v).then(function () { if (V === v) { v.s.stars.visible = $('v3dStars').checked; v.dirty = true; } });
    $('v3dContourInt').value = String(defaultContour(v.s.T));
    notes(v);
    setMode(v, 'orbit');
    if (o.keep) restoreKeep(v, o.keep);
    syncPlay(v);
    v.off = o.app.onInstant(function (inst) { if (V === v) { setInstant(v, inst); syncPlay(v); } });
    v.raf = requestAnimationFrame(function (t) { frame(v, t); });
    var waitFirst = function () {
      if (V !== v) return;
      if (v.frames < 1) return setTimeout(waitFirst, 16);
      refine(v);
      loadExtended(v);
      loadEarth(v);
      if (!v.userQuality && !(o.keep && o.keep.probed) && !window.ASTERIA_V3D_NOPROBE) setTimeout(function () { probe(v); }, 100);
    };
    setTimeout(waitFirst, 16);
    // smooth transition in
    if (REDUCE) el.classList.add('on'); else requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    setTimeout(function () { var b = $('v3dClose'); if (b && V === v) b.focus({ preventScroll: true }); }, 50);
    return v;
  }
  function dispose(v) {
    cancelAnimationFrame(v.raf);
    if (v.unbind) v.unbind();
    if (v.off) v.off();
    var s = v.s, seen = [];
    s.scene.traverse(function (obj) {
      if (obj.geometry && seen.indexOf(obj.geometry) < 0) { seen.push(obj.geometry); obj.geometry.dispose(); }
      var mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
      mats.forEach(function (m) {
        if (seen.indexOf(m) < 0) {
          seen.push(m);
          for (var key in m) if (m[key] && m[key].isTexture) m[key].dispose();
          if (m.uniforms) for (var u in m.uniforms) { var val = m.uniforms[u] && m.uniforms[u].value; if (val && val.isTexture) val.dispose(); }   // shader materials (Earth)
          var lu = m.userData && m.userData.local; if (lu) for (var u2 in lu) { var v2 = lu[u2] && lu[u2].value; if (v2 && v2.isTexture) v2.dispose(); }   // terrain normal maps (round 6)
          m.dispose();
        }
      });
    });
    if (seen.indexOf(s.terrainMat) < 0) s.terrainMat.dispose();
    [s.sun, s.sunNear, s.earthLight].forEach(function (L) { if (L && L.shadow && L.shadow.map) L.shadow.map.dispose(); });
    var mem = { geometries: s.renderer.info.memory.geometries, textures: s.renderer.info.memory.textures };
    s.renderer.renderLists.dispose();
    s.renderer.dispose();
    s.renderer.forceContextLoss();
    if (v.el.parentNode) v.el.parentNode.removeChild(v.el);
    lastClosed = { afterDispose: mem, frames: v.frames, at: Date.now() };
    v.s = null;
  }
  function close(immediate, internal) {
    var v = V; if (!v) return;
    V = null;
    if (!internal) {
      document.body.classList.remove('v3d-open');
      if (v.app.playing()) v.app.setPlaying(false);
    }
    var done = function () { dispose(v); if (v.onClosed) v.onClosed(); };
    if (immediate || REDUCE) done();
    else { v.el.classList.remove('on'); cancelAnimationFrame(v.raf); setTimeout(done, 320); }
    if (!internal && v.app.onClose) v.app.onClose();
  }

  // For the automated tests: the scene's actual Sun/Earth directions and state.
  function debug() {
    var v = V;
    if (!v || !v.s) return { open: false, lastClosed: lastClosed };
    var s = v.s, lp = s.sun.position.clone().sub(s.sun.target.position).normalize();
    var cam = s.camera.position, ep = s.earth.position.clone().sub(cam).normalize();
    var DEG = Math.PI / 180;
    return {
      open: true, frames: v.frames, refining: !!s.refinePending, quality: v.quality, autoQuality: v.auto, userQuality: v.userQuality, probe: v.probeResult || null, probing: !!v.probing,
      stars: s.starRows ? { n: s.starRows.length, magLimit: s.Q.starMag, visible: s.stars.visible, time: s.starTime } : null,
      hud: v.hudState || null, features: v.featState || null, track: s.trackN, distRings: { visible: s.distRings.visible, n: s.distRings.children.length },
      miniMap: !$('v3dMini').hidden && !!s.miniBase, labelEdge: { sun: $('v3dLblSun').classList.contains('edge'), earth: $('v3dLblEarth').classList.contains('edge') },
      reliefPref: Object.assign({}, RELIEF_PREF), reliefK: s.U.uReliefK.value,
      tileNormalMap: s.tileNormalMap || 0, anisotropy: s.maxAniso, cover: { on: s.U.uCover.value === 1, pref: SESSION.cover, wheelPoints: s.U.uTrkN.value, oct: s.U.uCovOct.value, near: s.U.uCovNear.value, far: s.U.uCovFar.value }, ao: { on: s.U.uAO.value === 1, pref: SESSION.ao, def: AO_DEFAULT, busy: !!v.aoBusy, ms: v.aoMs || 0, ready: [s.T.patch, s.T].filter(Boolean).map(function (G) { return !!AO_CACHE[aoKey(s, G)]; }) },
      overlays: { contour: s.terrainMat.userData.uniforms.uContour.value, slope: s.terrainMat.userData.uniforms.uSlope.value }, relief: s.terrainMat.userData.uniforms.uRelief.value === 1, fine: !!s.fine, patch5m: !!s.T.patch, shadowMapSize: s.sun.shadow.mapSize.x, pixelRatio: s.renderer.getPixelRatio(), brightness: v.bright, fillIntensity: s.fill.intensity, exposure: s.renderer.toneMappingExposure, mode: v.ctl.mode, stride: v.stride, phone: v.phone, exaggeration: s.T.k,
      sunLightDir: [lp.x, lp.y, lp.z], sunLight: M.azElFromDir([lp.x, lp.y, lp.z]), sunDiskRadiusDeg: Math.asin(s.sunDisk.scale.x / SUN_D) / DEG,
      earthDir: v.earthDir, earthDirDrawn: [ep.x, ep.y, ep.z], earthAzEl: M.azElFromDir([ep.x, ep.y, ep.z]), earthRadiusDeg: Math.asin(s.earth.scale.x / EARTH_D) / DEG,
      sunIntensity: s.sun.intensity, earthPhase: v.phase, earthTexture: s.earthTex || null, subObserver: v.subObs || null, glare: s.glare.visible,
      labelSun: $('v3dLblSun').querySelector('.t').textContent, labelEarth: $('v3dLblEarth').querySelector('.t').textContent, instant: v.inst && { idx: v.inst.idx, t: v.inst.t, sunUp: v.inst.sunUp, earthUp: v.inst.earthUp, sun: { az: v.inst.r.sun.az, el: v.inst.r.sun.el, radius_deg: v.inst.r.sun.radius_deg }, earth: { az: v.inst.r.earth.az, el: v.inst.r.earth.el, radius_deg: v.inst.r.earth.radius_deg } },
      vertices: s.geo.attributes.position.count, triangles: s.geo.index.count / 3, extVertices: s.extVertices || 0, extError: s.extError || null,
      layers: s.layers.map(function (L) { return { name: L.name, vertices: L.vertices, cast: L.mesh.castShadow, receive: L.mesh.receiveShadow, normalMap: L.nmap || 0 }; }),
      inspect: v.inspect || null, inspectPinned: !!v.inspectPinned, inspectHover: HOVER.on, miniCam: v.miniCam || null, preset: v.lastPreset || null, viewLatLon: viewLatLon(v), walk: v.ctl.walk,
      areas: s.areas || [], nmap: !!s.nmapOK, cascade: s.sunNear ? { box: s.nearBox || null, texel: s.nearTexel || null, mapSize: s.sunNear.shadow.mapSize.x } : null, earthshine: v.earthshine || null, noShadow: s.U.uNoShadow.value === 1,
      shadowCamera: { left: s.sun.shadow.camera.left, right: s.sun.shadow.camera.right, top: s.sun.shadow.camera.top, bottom: s.sun.shadow.camera.bottom, near: s.sun.shadow.camera.near, far: s.sun.shadow.camera.far, texel: s.shadowTexel },
      memory: { geometries: s.renderer.info.memory.geometries, textures: s.renderer.info.memory.textures }, rover: v.roverState || null, roverModel: { triangles: s.roverTris, low: s.roverLow }, labelLayout: v.labelLayout || null,
      tileCentreY: M.groundWorld(s.TM, 0, 0).y,
      point: v.pt ? { lat: v.pt.lat, lon: v.pt.lon, e: v.pt.e, n: v.pt.n, x: v.pt.x, y: v.pt.y, z: v.pt.z, inTile: v.pt.inTile, km: v.pt.km, exact: v.pt.exact } : null, site: v.site.id,
      camera: [cam.x, cam.y, cam.z], eyeAboveGround: cam.y - M.groundWorld(s.TM, cam.x, cam.z).y
    };
  }
  // Test hooks: drive the controls without real key presses.
  function testKey(code, down) { if (V) { if (down) V.ctl.keys[code] = true; else delete V.ctl.keys[code]; V.dirty = true; } }
  function testMode(m) { if (V) setMode(V, m); }
  function testInspect(cx, cy) { if (!V) return null; var r = inspectAt(V, cx, cy); showInspect(V, r, true); return r; }

  // Test hook (shading-consistency check): set the time t (ms), render, and read the rendered shadow map at the site
  // marker (2 m above the ground, as the horizon model's observer). Returns the shadow-map verdict, the validated
  // horizon model's "Sun up" (Sun centre above the terrain horizon) and a near-field ray march over the drawn terrain.
  function shadowProbe(t) {
    var v = V; if (!v || !v.s) return null;
    var s = v.s, E = window.LunaEngine, r = E.sunEarthAt({ lat: v.site.lat, lon: v.site.lon }, new Date(t));
    var mask = v.openArgs.mask, hz = E.maskAt(mask, r.sun.az), sunUp = r.sun.el > hz;
    var inst = { idx: 0, n: 1, t: t, r: r, sunUp: sunUp, earthUp: r.earth.el > E.maskAt(mask, r.earth.az), hzSun: hz, hzEarth: E.maskAt(mask, r.earth.az), minEl: 0 };
    setInstant(v, inst);
    updateNear(v);
    s.renderer.render(s.scene, s.camera);
    var site = [0, groundY(s, 0, 0) + EYE_M, 0];
    var far = s.sun.intensity > 0 ? readShadow(s, s.sun, site) : { lit: false };
    // round 6: the near cascade's verdict at the same point (Medium/High; the view centre is the site by default)
    var near = s.sunNear && s.sun.intensity > 0 ? readShadow(s, s.sunNear, site) : null;
    var dh = drawnHorizon(s, r.sun.az);
    return { t: t, sunEl: r.sun.el, sunAz: r.sun.az, horizon: hz, validatedSunUp: sunUp, renderedLit: far.lit, renderedLitNear: near && near.inside ? near.lit : null, renderedLitCombined: near && near.inside ? far.lit && near.lit : far.lit, sunAboveDrawnTerrain: r.sun.el > dh.el, drawnTerrainHorizon: dh.el, castKm: dh.km, quality: v.quality, texel: s.shadowTexel, nearTexel: s.nearTexel || null };
  }
  // Depth test of world point p against a light's rendered shadow map (RGBA-packed depth), as the shader does.
  function readShadow(s, light, pt) {
    if (!light.castShadow || !light.shadow.map) return { lit: true, inside: false };
    var THREE = s.THREE, p = new THREE.Vector4(pt[0], pt[1], pt[2], 1).applyMatrix4(light.shadow.matrix);
    var W = light.shadow.mapSize.x, buf = new Uint8Array(4), px = Math.floor(p.x * W), py = Math.floor(p.y * W);
    if (!(px >= 0 && py >= 0 && px < W && py < W)) return { lit: true, inside: false };   // outside the shadow camera: drawn lit
    s.renderer.readRenderTargetPixels(light.shadow.map, px, py, 1, 1, buf);
    var f = 255 / 256, depth = f * (buf[0] / 255 / 16777216 + buf[1] / 255 / 65536 + buf[2] / 255 / 256 + buf[3] / 255);
    return { lit: p.z + light.shadow.bias <= depth, inside: true };
  }
  // Elevation (deg) of the highest shadow-casting terrain toward azimuth az, seen from 2 m above the site (true heights from
  // the finest drawn grid at each distance, lunar curvature included); used to explain disagreements.
  function drawnHorizon(s, az) {
    // only terrain that casts shadows in this view (Low: the tile; Medium: + ring A; High: + ring B)
    var grids = [s.T, s.ringA && s.Q.extShadow ? s.ringA : null, s.ringBG && s.Q.extShadow ? s.ringBG : null].filter(Boolean);
    var R = s.T.R, hObs = M.heightAt(s.T, 0, 0) + EYE_M, a = az * Math.PI / 180, se = Math.sin(a), ce = Math.cos(a), best = -90, far = 0;
    for (var t = 10; ; t += t < 3000 ? 10 : t < 16000 ? 40 : 80) {
      var e = se * t, n = ce * t, G = null;
      for (var q = 0; q < grids.length; q++) if (M.inside(grids[q], e, n)) { G = grids[q]; break; }
      if (!G) break;
      far = t;
      var ang = Math.atan2(M.heightAt(G, e, n) - hObs - t * t / (2 * R), t) * 180 / Math.PI;
      if (ang > best) best = ang;
    }
    return { el: best, km: Math.round(far / 100) / 10 };
  }
  function testScene() { return V && V.s; }
  // direction (az/el) of a catalogue star as drawn (tests)
  function starAzEl(hr) {
    var s = V && V.s; if (!s || !s.starBins) return null;
    for (var q = 0; q < s.starBins.length; q++) {
      var b = s.starBins[q], k = b.rows.findIndex(function (r) { return r[0] === hr; });
      if (k >= 0) { var P = b.pts.geometry.attributes.position.array; return M.azElFromDir([P[3 * k], P[3 * k + 1], P[3 * k + 2]]); }
    }
    return null;
  }
  function testCamera(o) { if (V) { Object.assign(V.ctl, o); V.dirty = true; } }
  function testQuality(q) { if (V) setQuality(V, q, 'Quality set to ' + QUALITY[q].label + '.'); }
  function testBrightness(b) { if (V) setBrightness(V, b); }
  // test hook: on/off for the current mode; null = automatic (defaults by mode) in every mode
  // round 6C test hook: openness shading on/off for this session; null = default
  function testCover(on) { if (V) { SESSION.cover = !!on; applyCover(V); } }
  function testAO(on) { if (V) { SESSION.ao = on === null ? null : !!on; applyAO(V); } }
  function testRelief(on) { if (V) { if (on === null) RELIEF_PREF.orbit = RELIEF_PREF.walk = RELIEF_PREF.rover = null; else RELIEF_PREF[V.ctl.mode] = !!on; applyRelief(V); } }
  // diagnostics for the ground-detail comparison (tests/ground_detail.js): plain Lambert (round-3 law); shadow camera
  // fitted to the 6 km tile only (round-3 texel size). Not reachable from the interface.
  function testDiag(o) {
    var v = V; if (!v) return;
    if ('lambert' in o) v.s.terrainMat.userData.uniforms.uLambert.value = o.lambert ? 1 : 0;
    if ('tileShadow' in o) { v.s.diagTileShadow = !!o.tileShadow; fitShadow(v.s); }
    if ('vertexNormals' in o) v.s.U.uVNorm.value = o.vertexNormals ? 1 : 0;   // round 6C: normal maps off (per-vertex normals)
    v.dirty = true;
  }
  return { testInspect: testInspect, ROVER: ROVER, starAzEl: starAzEl, testScene: testScene, QUALITY: QUALITY, shadowProbe: shadowProbe, testCamera: testCamera, testQuality: testQuality, testBrightness: testBrightness, testRelief: testRelief, testAO: testAO, testCover: testCover, testDiag: testDiag, open: open, close: close, isOpen: function () { return !!V; }, debug: debug, testKey: testKey, testMode: testMode };
})();
