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
  var V = null;           // current view (null when closed)
  var TILE_CACHE = {};    // decoded tiles by site id (re-opening or changing quality does not decode again)
  var lastClosed = null;  // stats captured while closing (tests)

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
    low:    { label: 'Low',    stride: 2, ringA: 2, ringB: false, extShadow: false, shadow: 1024, pr: 1,   aa: false, starMag: 3.5, earthTex: 512,  patch5m: false },
    medium: { label: 'Medium', stride: 1, ringA: 1, ringB: false, extShadow: true,  shadow: 2048, pr: 1.5, aa: true,  starMag: 4.5, earthTex: 1024, patch5m: false },
    high:   { label: 'High',   stride: 1, ringA: 1, ringB: true,  extShadow: true,  shadow: 4096, pr: 2,   aa: true,  starMag: 5.0, earthTex: 2048, patch5m: true }
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
      '  <div class="v3d-labels" id="v3dLabels"><span class="v3d-lbl sun" id="v3dLblSun">Sun</span><span class="v3d-lbl earth" id="v3dLblEarth">Earth</span><span class="v3d-lbl site" id="v3dLblSite"><i></i>Site</span><span class="v3d-lbl rover" id="v3dLblRover" hidden>Rover <span class="aiwm">AI-generated illustration</span></span></div>' +
      '  <div class="v3d-exag" id="v3dExagBadge">Vertical scale 1× (true scale)</div>' +
      '  <div class="v3d-msgs"><div class="v3d-banner" id="v3dBanner" hidden></div>' +
      '  <div class="v3d-tip" id="v3dTip" hidden>The site is in shadow, so the ground looks almost black. <button class="btn small" id="v3dTipBtn">Light up</button> <span class="fineprint">(display brightness only)</span></div></div>' +
      '  <div class="v3d-qnote" id="v3dQNote" hidden></div>' +
      '  <p class="v3d-shadownote">Near-field shadows (visual approximation); distant terrain shadows not rendered; sunlit and Earth-visible status at the site marker come from the validated horizon model.</p>' +
      '  <div class="v3d-pad" id="v3dPad" hidden><button data-k="fwd" aria-label="Forward">&#9650;</button><button data-k="left" aria-label="Turn left">&#9664;</button><button data-k="back" aria-label="Back">&#9660;</button><button data-k="right" aria-label="Turn right">&#9654;</button></div>' +
      '  <button class="btn v3d-close" id="v3dClose" aria-label="Close the 3D view">&#10005; Close 3D</button>' +
      '</div>' +
      '<aside class="v3d-panel" id="v3dPanel">' +
      '  <div class="v3d-head"><div><div class="v3d-kicker">3D terrain view</div><h2 id="v3dTitle">' + esc(o.site.name) + '</h2></div><button class="btn small ghost" id="v3dToggle" aria-expanded="true" aria-controls="v3dBody">Hide panel</button></div>' +
      '  <div id="v3dBody">' +
      '  <div class="v3d-time"><span class="lbl">Showing</span> <b class="mono" id="v3dTime">-</b></div>' +
      '  <div class="row slider-row"><button class="btn play" id="v3dPlay" aria-label="Play">&#9654;</button><input id="v3dSlider" type="range" min="0" max="1" value="0" aria-label="Time within window (synced with the main view)"></div>' +
      '  <div class="tiles v3d-tiles">' +
      '    <div class="tile" id="v3dTileSun"><div class="tlabel">Sunlight at the site marker</div><div class="tstate" id="v3dSun">-</div><div class="tx x-only mono" id="v3dSunX"></div></div>' +
      '    <div class="tile" id="v3dTileEarth"><div class="tlabel">Earth link at the site marker</div><div class="tstate" id="v3dEarth">-</div><div class="tx x-only mono" id="v3dEarthX"></div></div>' +
      '  </div>' +
      '  <p class="fineprint">Status from the validated horizon model (same as the main view), not from the 3D rendering.</p>' +
      '  <div class="v3d-ctl v3d-disp">' +
      '    <label>Quality <select id="v3dQuality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>' +
      '    <span class="fineprint" id="v3dQWhy"></span>' +
      '  </div>' +
      '  <div class="v3d-bright">' +
      '    <label for="v3dBright">Brightness <b class="mono" id="v3dBrightVal">1.0×</b></label>' +
      '    <div class="row"><input id="v3dBright" type="range" min="0.5" max="6" step="0.1" value="1" aria-describedby="v3dBrightNote"><button class="btn small" id="v3dLightUp" aria-pressed="false">Light up</button></div>' +
      '    <p class="fineprint" id="v3dBrightNote">Display brightness only (like camera exposure). Real polar shadows are almost black; this does not change the computed lighting.</p>' +
      '  </div>' +
      '  <div class="v3d-ctl">' +
      '    <div class="seg" role="radiogroup" aria-label="Camera mode"><button data-mode="orbit" class="on">Orbit</button><button data-mode="walk">Walk</button><button data-mode="rover">Rover</button></div>' +
      '    <label>Vertical exaggeration <select id="v3dExag"><option value="1" selected>1× (true scale)</option><option value="2">2×</option><option value="3">3×</option><option value="5">5×</option></select></label>' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dShadows" checked> shadows</label>' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dRing" checked> distant skyline</label>' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dStars"> stars</label>' +
      '  </div>' +
      '  <p class="fineprint" id="v3dStarNote" hidden>Real star positions; cameras usually cannot see stars when the Sun or sunlit ground is in view.</p>' +
      '  <div class="v3d-ctl">' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dContours"> contour lines</label>' +
      '    <select id="v3dContourInt" aria-label="Contour interval"><option value="10">10 m</option><option value="25">25 m</option><option value="50">50 m</option><option value="100">100 m</option><option value="250">250 m</option></select>' +
      '    <label class="smallswitch"><input type="checkbox" id="v3dSlope"> slope shading</label>' +
      '  </div>' +
      '  <div class="v3d-legend" id="v3dLegend" hidden></div>' +
      '  <p class="hint" id="v3dHelp"></p>' +
      '  <div class="v3d-rover" id="v3dRover" hidden>' +
      '    <div class="cards small"><div class="card"><div class="cardlbl">Position from site</div><div class="val mono" id="v3dRPos">-</div></div>' +
      '    <div class="card"><div class="cardlbl">Terrain elevation</div><div class="val mono" id="v3dRElev">-</div></div>' +
      '    <div class="card"><div class="cardlbl">Local slope</div><div class="val mono" id="v3dRSlope">-</div></div>' +
      '    <div class="card"><div class="cardlbl">Sun over the tile terrain</div><div class="val" id="v3dRSun">-</div></div></div>' +
      '    <label>Slope warning above <span class="inl"><input id="v3dSlopeMax" type="number" min="1" max="45" step="1" value="15" aria-label="Slope warning threshold in degrees"> &deg;</span></label>' +
      '    <div class="v3d-warn" id="v3dRWarn" hidden></div>' +
      '    <p class="fineprint" id="v3dRNote"></p>' +
      '  </div>' +
      '  <details class="v3d-notes"><summary>What is accurate, what is approximate</summary><ul id="v3dNotes"></ul></details>' +
      '  </div>' +
      '</aside>';
    document.body.appendChild(el);
    return el;
  }
  // "What is accurate, what is approximate" - written from what this view actually loaded and draws.
  function extKm(v) { var s = v.s; return s.ext.b && s.Q.ringB ? 40 : s.ext.a ? 16 : 0; }
  function notes(v) {
    var s = v.s, m = s.T.meta, Q = s.Q, A = s.ext.a, B = s.ext.b && Q.ringB ? s.ext.b : null, P5 = s.T.patch, km = extKm(v), shKm = Q.extShadow ? km : 0;
    var list = [
      '<b>Terrain (6 km tile)</b>: LOLA ' + esc(m.demProduct) + ', ' + m.spacing_m + ' m grid' + (v.stride > 1 ? ' (drawn at ' + m.spacing_m * v.stride + ' m at ' + Q.label + ' quality; readouts use ' + m.spacing_m + ' m)' : '') + ', ' + (m.size_m / 1000).toFixed(1) + ' km square centred on the site; heights within 0.05 m of direct DEM samples (tools/terrain3d.py check). Lunar curvature is included (about ' + m.curvatureDropAtCorner_m.toFixed(0) + ' m drop at the corners). Features smaller than the grid, boulders and the lander are not represented.',
      P5 ? '<b>Sharper ground near the site</b>: a 2 km × 2 km patch at 5 m from LOLA ' + esc(P5.meta.demProduct) + ' (heights within 0.05 m of direct samples; tools/terrain3d_ext.py check). The label of this product says it is made from preliminary LOLA data.' : null,
      A ? '<b>Extended terrain</b>: real LOLA heights to ' + km + ' km from the site: ' + esc(A.meta.demProduct) + ' on a ' + A.d * Q.ringA + ' m grid to 16 km' + (B ? ', and ' + esc(B.meta.demProduct) + ' on a ' + B.d + ' m grid to 40 km' : '') + ' (stored heights within 0.1 m of direct DEM samples; tools/terrain3d_ext.py check). Same site-centred frame and curvature as the tile; the meshes share their edge vertices, and short vertical skirts hide the joins.' : (s.extError ? '<b>Extended terrain</b>: could not be loaded (' + esc(s.extError) + ').' : '<b>Extended terrain</b>: loading…'),
      '<b>Surface shading</b>: Lommel-Seeliger law (a standard photometric model for lunar regolith: brightness proportional to cos i / (cos i + cos e)), with surface normals from the DEM at full resolution. <b>Uniform albedo</b>: no public LOLA 1064 nm normal-albedo map of the south pole at 250 m/pixel or finer was found (LOLA\'s published albedo maps are about 2 km/pixel near the poles; the PDS LOLA polar products named LDRM are roughness maps), so brightness differences come from the terrain\'s shape only. No synthetic rocks, small craters or textures are added.',
      '<b>Contour lines and slope shading</b> (optional): computed from the same LOLA heights (true heights, also when the vertical scale is exaggerated). Slope over one DEM cell (5 m, 20 m, 80 m or 100-200 m depending on the area); real slopes over a few metres can be steeper.',
      '<b>Sun</b>: direction and disk size from the validated engine (the light direction matches it to better than 0.01°).',
      '<b>Earth</b>: position and size (about ' + (2 * (v.earthRadiusDeg || 0.95)).toFixed(1) + '° across) from the engine; plain blue sphere (no clouds or continents). Its lit side is the computed phase from the Sun direction; the unlit side is drawn very faintly so Earth can be found.',
      '<b>Distant skyline</b>: the site\'s terrain horizon (data/horizons, rays to 300 km) drawn as the top edge of a dark ring ' + RING_M / 1000 + ' km away. It is exact only when seen from the site marker; elsewhere it is approximate. Between the edge of the drawn terrain (' + (km || 3) + ' km) and the ring nothing is drawn (dark).',
      '<b>Shadows</b>: ' + (shKm ? 'cast by all terrain drawn within ' + shKm + ' km of the site (shadow-map texel about ' + (s.shadowTexel || 0).toFixed(0) + ' m; visual approximation). Terrain farther away does not cast shadows in the picture' + (B ? '; the ring from 16 to 40 km is shaded but receives no shadows' : '') + '.' : 'cast by the 6 km tile only at ' + Q.label + ' quality (choose Medium or High for shadows from the surrounding terrain).') + ' Sunlit and Earth-visible status at the site marker always come from the validated horizon model.',
      '<b>Fill light and brightness</b>: a faint uniform light keeps unlit ground from being pure black. It is not physical (real shadows get only faint light reflected from sunlit terrain and Earthshine). The Brightness slider and "Light up" change only the display exposure and this fill light, never the Sun direction or any computed value.',
      '<b>Stars</b> (off by default): the ' + (s.starRows ? s.starRows.length + ' ' : '') + 'stars brighter than magnitude ' + Q.starMag.toFixed(1) + ' (at ' + Q.label + ' quality) of the Yale Bright Star Catalogue, 5th revised edition (Hoffleit &amp; Warren 1991, public domain), at their true directions in the site\'s sky for the selected time, using the engine\'s Moon orientation (checked against an independent IAU/WGCCRE computation: within 0.002°). Size and brightness by magnitude, tint by colour index. Real star positions; cameras usually cannot see stars when the Sun or sunlit ground is in view.',
      '<b>Vertical exaggeration</b> above 1× stretches heights (and therefore shadows and the look of slopes); rover slope readouts always use true heights. The distant skyline ring is never exaggerated.',
      '<b>Rover</b>: a simple AI-generated illustration (drawn in code by Claude Code; not a vehicle model; speed not realistic). Slope = gradient of the DEM over one ' + (P5 ? '5 m cell within 1 km of the site and one ' : '') + m.spacing_m + ' m grid cell' + (P5 ? ' elsewhere' : '') + '. "Sun over the tile terrain" is a near-field estimate using only the tile.'
    ];
    $('v3dNotes').innerHTML = list.filter(Boolean).map(function (x) { return '<li>' + x + '</li>'; }).join('');
    var sn = v.el.querySelector('.v3d-shadownote');
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
    scene.background = new THREE.Color(0x000000);
    var camera = new THREE.PerspectiveCamera(55, 1, 0.3, 2000000);

    // terrain: the tile now (coarse first frame), then the extended rings and the 5 m patch (loadExtended)
    var terrainMat = regolithMaterial(THREE);
    var terrainGroup = new THREE.Group(); scene.add(terrainGroup);
    var geo = geomFrom(THREE, M.buildGridMesh(decimate(T, coarse), 1, 0, null, T));
    var terrain = new THREE.Mesh(geo, terrainMat);
    terrain.castShadow = true; terrain.receiveShadow = true;
    terrainGroup.add(terrain);

    var fill = new THREE.AmbientLight(0xffffff, FILL);
    scene.add(fill);
    var sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = TM.d * 0.08;
    scene.add(sun); scene.add(sun.target);

    // Sun disk and Earth (positioned relative to the camera every frame: they are at "infinity")
    var sunDisk = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff4d6 }));
    scene.add(sunDisk);
    var earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshLambertMaterial({ color: 0x4ea8ff, emissive: 0x06101e }));
    scene.add(earth);

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

    // rover (simple illustration, about 2 m long)
    var rover = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.0), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    body.position.y = 0.75; body.castShadow = true; rover.add(body);
    var mast = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), new THREE.MeshLambertMaterial({ color: 0xffc23d }));
    mast.position.set(0, 1.4, -0.7); rover.add(mast);
    var panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.0), new THREE.MeshLambertMaterial({ color: 0x24406e }));
    panel.position.set(0, 1.05, 0.3); panel.castShadow = true; rover.add(panel);
    var wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), wheelMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    [[-0.8, -0.7], [0.8, -0.7], [-0.8, 0.7], [0.8, 0.7]].forEach(function (w) {
      var wh = new THREE.Mesh(wheelGeo, wheelMat); wh.rotation.z = Math.PI / 2; wh.position.set(w[0], 0.32, w[1]); wh.castShadow = true; rover.add(wh);
    });
    rover.visible = false; scene.add(rover);

    return { THREE: THREE, T: T, TM: TM, Q: Q, refinePending: true, coarse: coarse !== stride, terrainMat: terrainMat, terrainGroup: terrainGroup, layers: [], ext: {},
      renderer: renderer, scene: scene, camera: camera, terrain: terrain, geo: geo, fill: fill, sun: sun,
      sunDisk: sunDisk, earth: earth, ring: ring, stars: stars, marker: marker, markerMat: markerMat, rover: rover };
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
  function regolithMaterial(THREE) {
    var mat = new THREE.MeshLambertMaterial({ color: 0x9c9a95 });
    var U = { uContour: { value: 0 }, uSlope: { value: 0 } };
    mat.userData.uniforms = U;
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uContour = U.uContour; sh.uniforms.uSlope = U.uSlope;
      sh.vertexShader = 'attribute float aH;\nattribute float aS;\nvarying float vH;\nvarying float vS;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = aH; vS = aS;');
      var chunk = THREE.ShaderChunk.lights_lambert_pars_fragment, from = 'vec3 irradiance = dotNL * directLight.color;';
      if (chunk.indexOf(from) < 0) throw new Error('unexpected three.js Lambert shader');
      chunk = chunk.replace(from, 'float muV = saturate( dot( geometry.normal, geometry.viewDir ) );\n\tvec3 irradiance = dotNL * directLight.color / max( dotNL + muV, 0.05 );');
      sh.fragmentShader = 'uniform float uContour;\nuniform float uSlope;\nvarying float vH;\nvarying float vS;\n' +
        sh.fragmentShader
          .replace('#include <lights_lambert_pars_fragment>', chunk)
          .replace('#include <color_fragment>', '#include <color_fragment>\n' +
            'if ( uSlope > 0.5 ) {\n' +
            '  vec3 sc = vS < 10.0 ? diffuseColor.rgb : vS < 20.0 ? vec3( 0.93, 0.80, 0.25 ) : vS < 30.0 ? vec3( 0.95, 0.50, 0.15 ) : vec3( 0.85, 0.18, 0.18 );\n' +
            '  diffuseColor.rgb = mix( diffuseColor.rgb, sc, 0.6 );\n}')
          .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' +
            'if ( uContour > 0.0 ) {\n' +
            '  float q = vH / uContour, w = fwidth( q );\n' +
            '  float line = 1.0 - smoothstep( 0.0, 1.2 * w, min( fract( q ), 1.0 - fract( q ) ) );\n' +
            '  float major = abs( mod( floor( q + 0.5 ), 5.0 ) ) < 0.5 ? 1.0 : 0.6;\n' +
            '  gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( 0.35, 0.85, 1.0 ), line * major * step( w, 0.5 ) );\n}');
    };
    mat.customProgramCacheKey = function () { return 'asteria-regolith-1'; };
    return mat;
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
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
  // (Re)build every terrain mesh from the current grids and vertical exaggeration. Nested squares: 5 m patch (High,
  // where available) inside the tile, inside ring A (16 km), inside ring B (40 km, High). Each outer mesh leaves a hole
  // for the inner one and takes the heights on the hole's edge from it (shared vertices); skirts close the T-junctions.
  function buildTerrain(s) {
    var THREE = s.THREE, mat = s.terrainMat, Q = s.Q, e = s.ext;
    s.layers.forEach(function (L) { s.terrainGroup.remove(L.mesh); L.mesh.geometry.dispose(); });
    s.layers = [];
    var add = function (name, P, cast, recv) {
      var mesh = new THREE.Mesh(geomFrom(THREE, P), mat); mesh.castShadow = cast; mesh.receiveShadow = recv; mesh.name = name;
      s.terrainGroup.add(mesh); s.layers.push({ name: name, mesh: mesh, vertices: P.pos.length / 3 });
      return mesh;
    };
    var TM = s.TM, patch = e.p5 && Q.patch5m ? e.p5 : null;
    TM.patch = patch; s.T.patch = patch;
    if (patch) {
      add('patch5m', M.buildGridMesh(patch, 1, 0, null, patch), true, true);
      add('patch5m-skirt', M.buildSkirt(patch, 1, 30), false, true);
    }
    s.terrainGroup.remove(s.terrain); s.geo.dispose();
    var tileP = M.buildGridMesh(TM, 1, patch ? patch.half : 0, patch, s.T);
    s.geo = geomFrom(THREE, tileP); s.terrain.geometry = s.geo; s.terrainGroup.add(s.terrain);
    s.tileVertices = tileP.pos.length / 3;
    var extCast = Q.extShadow;
    if (e.a) {
      add('tile-skirt', M.buildSkirt(TM, 1, 40, function (x, y) { return M.nodeOrMesh(TM, x, y); }), false, true);
      s.ringA = decimate(e.a, Q.ringA);
      s.ringA.k = TM.k;
      add('ringA', M.buildGridMesh(s.ringA, 1, TM.half, TM, e.a), extCast, extCast);
    } else s.ringA = null;
    if (e.b && Q.ringB && s.ringA) {
      add('ringA-skirt', M.buildSkirt(s.ringA, 1, 80), false, false);
      add('ringB', M.buildGridMesh(e.b, 1, s.ringA.half, s.ringA, e.b), extCast, false);
    }
    s.extVertices = s.layers.reduce(function (n, L) { return n + (/skirt/.test(L.name) ? 0 : L.vertices); }, 0);
    fitShadow(s);
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
    var idx = s.Q.patch5m && !window.ASTERIA_TERRAIN3D_5M_IDS ? loadExtScript('data/terrain3d/hi5m_index.js') : Promise.resolve();
    return idx.then(function () { return loadExtended2(v); }, function () { return loadExtended2(v); });
  }
  function loadExtended2(v) {
    var s = v.s, id = v.site.id, Q = s.Q, want = [['a', 'data/terrain3d/ext/' + id + '_a.js', 'ASTERIA_TERRAIN3D_EXT', id + '_a']];
    if (Q.ringB) want.push(['b', 'data/terrain3d/ext/' + id + '_b.js', 'ASTERIA_TERRAIN3D_EXT', id + '_b']);
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
  function fitShadow(v) {
    var THREE = v.THREE, sun = v.sun, cam = sun.shadow.camera;
    var tmp = new THREE.OrthographicCamera(); tmp.position.copy(sun.position); tmp.lookAt(sun.target.position); tmp.updateMatrixWorld(true);
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
    (v.layers || []).forEach(function (L) { if (L.mesh.receiveShadow && !/skirt/.test(L.name)) recv.push(L.mesh.geometry); });
    var cast = [v.geo];
    (v.layers || []).forEach(function (L) { if (L.mesh.castShadow) cast.push(L.mesh.geometry); });
    recv.forEach(function (g) { box(g.boundingBox, rlo, rhi); });
    cast.forEach(function (g) { box(g.boundingBox, clo, chi); });
    cam.left = rlo[0] - 5; cam.right = rhi[0] + 5; cam.bottom = rlo[1] - 5; cam.top = rhi[1] + 5;
    // depth: from the nearest caster to the farthest receiver (light space looks down -z)
    cam.near = -Math.max(chi[2], rhi[2]) - 10; cam.far = -Math.min(clo[2], rlo[2]) + 10;
    cam.updateProjectionMatrix();
    v.shadowTexel = Math.max(cam.right - cam.left, cam.top - cam.bottom) / sun.shadow.mapSize.x;
    sun.shadow.normalBias = Math.max(v.TM.d * 0.08, v.shadowTexel * 0.6);
    // depth bias as a fixed distance (SHADOW_BIAS_M along the light) whatever the depth range of the shadow camera
    sun.shadow.bias = -SHADOW_BIAS_M / (cam.far - cam.near);
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
  var MAXD = 60000;   // farthest orbit distance (m)
  // Height (Three.js y) of the drawn ground below world (x, z): the finest mesh that contains the point, or -1e9.
  function groundY(s, x, z) {
    var grids = [s.TM, s.ringA, s.ext.b && s.Q.ringB ? s.ext.b : null];
    for (var q = 0; q < grids.length; q++) {
      var G = grids[q]; if (!G) continue;
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
  function placeRover(v) {
    var THREE = v.s.THREE, r = v.ctl.rov, TM = v.s.TM, ro = v.s.rover, DEG = Math.PI / 180, y = r.yaw * DEG;
    var g = function (dx, dz) { var x = r.x + dx, z = r.z + dz; return new THREE.Vector3(x, M.groundWorld(TM, x, z).y, z); };
    var fw = [Math.sin(y) * 1.0, -Math.cos(y) * 1.0], rt = [Math.cos(y) * 0.8, Math.sin(y) * 0.8];
    var pf = g(fw[0], fw[1]), pb = g(-fw[0], -fw[1]), pr = g(rt[0], rt[1]), pl = g(-rt[0], -rt[1]);
    var fwd = pf.clone().sub(pb).normalize(), right = pr.clone().sub(pl).normalize();
    var up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    right.crossVectors(fwd, up).normalize();
    var m = new THREE.Matrix4().makeBasis(right, up, fwd.clone().negate());
    ro.quaternion.setFromRotationMatrix(m);
    ro.position.set(r.x, (pf.y + pb.y + pr.y + pl.y) / 4, r.z);
  }

  function setMode(v, mode) {
    var c = v.ctl;
    c.mode = mode;
    v.s.rover.visible = mode === 'rover';
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
    if (mode === 'walk' && c.walk.x === 0 && c.walk.z === 0) c.walk.yaw = v.inst ? v.inst.r.sun.az : 0;
    if (mode === 'rover' && c.rov.dist === 0) { c.rov.yaw = v.inst ? v.inst.r.sun.az + 90 : 0; c.rov.x = 25; c.rov.z = 0; }
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
    s.sun.updateMatrixWorld(); fitShadow(s);
    v.sunDir = d; v.earthDir = M.dirFromAzEl(r.earth.az, r.earth.el);
    var ph = M.earthPhase(r.sun, r.earth);
    v.phase = ph;
    // status tiles: from the validated horizon model (main app series)
    var tile = function (id, cls, stEl, text) { $(id).className = 'tile ' + cls; $(stEl).textContent = text; };
    tile('v3dTileSun', inst.sunUp ? 'on-sun' : 'off', 'v3dSun', inst.sunUp ? 'Sun up' : 'Sun down');
    tile('v3dTileEarth', inst.earthUp ? 'on-earth' : 'off', 'v3dEarth', inst.earthUp ? 'Earth in view' : 'Earth hidden');
    $('v3dSunX').textContent = 'Sun el ' + fmtDeg(r.sun.el) + ' · az ' + r.sun.az.toFixed(1) + '° · terrain horizon ' + fmtDeg(inst.hzSun, 1) + ' · disk ' + (2 * r.sun.radius_deg).toFixed(3) + '°';
    $('v3dEarthX').textContent = 'Earth el ' + fmtDeg(r.earth.el) + ' · az ' + r.earth.az.toFixed(1) + '° · terrain horizon ' + fmtDeg(inst.hzEarth, 1) + (inst.minEl ? ' + ' + inst.minEl + '° min' : '') + ' · disk ' + (2 * r.earth.radius_deg).toFixed(2) + '° · ' + (100 * ph.illuminated).toFixed(0) + '% lit (phase)';
    $('v3dTime').textContent = fmtUTC(new Date(inst.t)) + ' UTC';
    var sl = $('v3dSlider'); sl.max = inst.n - 1; sl.value = inst.idx;
    var col = inst.sunUp && inst.earthUp ? 0x5ee27a : inst.sunUp ? 0xffc23d : inst.earthUp ? 0x4ea8ff : 0x6f7890;
    s.markerMat.color.setHex(col);
    $('v3dLblSite').className = 'v3d-lbl site ' + (inst.sunUp && inst.earthUp ? 'on-both' : inst.sunUp ? 'on-sun' : inst.earthUp ? 'on-earth' : 'off');
    var b = $('v3dBanner');
    if (!inst.sunUp && r.sun.el > -r.sun.radius_deg) {
      b.hidden = false;
      b.textContent = 'At the site marker the Sun is hidden behind terrain (validated horizon model, Sun ' + fmtDeg(r.sun.el, 1) + ' vs horizon ' + fmtDeg(inst.hzSun, 1) + '). ' + (v.s.Q.extShadow ? 'Terrain more than ' + (extKm(v) || 16) + ' km away casts no shadows in this view, so parts of the ground may still look lit.' : 'At ' + v.s.Q.label + ' quality only the 6 km tile casts shadows, so parts of the ground may look lit (Medium or High add shadows from the surrounding terrain).');
    } else b.hidden = true;
    updateTip(v);
    updateStars(v);
    v.dirty = true;
  }

  // -------------------------------------------------------------- render
  function frame(v, ts) {
    if (V !== v) return;
    var dt = Math.min(0.1, v.lastTs ? (ts - v.lastTs) / 1000 : 0); v.lastTs = ts;
    var moving = anyKey(v.ctl.keys) || v.probing;
    if (moving || v.dirty) {
      stepControls(v, dt);
      var s = v.s, cam = s.camera, r = v.inst && v.inst.r;
      if (r) {
        var sd = v.sunDir, ed = v.earthDir;
        s.sunDisk.position.set(cam.position.x + sd[0] * SUN_D, cam.position.y + sd[1] * SUN_D, cam.position.z + sd[2] * SUN_D);
        s.sunDisk.scale.setScalar(SUN_D * Math.sin(r.sun.radius_deg * Math.PI / 180));
        s.earth.position.set(cam.position.x + ed[0] * EARTH_D, cam.position.y + ed[1] * EARTH_D, cam.position.z + ed[2] * EARTH_D);
        s.earth.scale.setScalar(EARTH_D * Math.sin(r.earth.radius_deg * Math.PI / 180));
      }
      s.stars.position.copy(cam.position);
      s.renderer.render(s.scene, cam);
      labels(v);
      if (v.ctl.mode === 'rover') roverReadout(v, ts);
      v.dirty = false;
      v.frames++;
    }
    v.raf = requestAnimationFrame(function (t) { frame(v, t); });
  }
  function labels(v) {
    var s = v.s, cam = s.camera, w = v.stage.clientWidth, h = v.stage.clientHeight, THREE = s.THREE, p = new THREE.Vector3();
    var put = function (id, x, y, z) {
      p.set(x, y, z).project(cam);
      var el = $(id), ok = p.z < 1 && p.z > -1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      el.style.display = ok ? '' : 'none';
      if (ok) el.style.transform = 'translate(' + ((p.x + 1) / 2 * w).toFixed(1) + 'px,' + ((1 - p.y) / 2 * h).toFixed(1) + 'px)';
    };
    put('v3dLblSun', s.sunDisk.position.x, s.sunDisk.position.y, s.sunDisk.position.z);
    put('v3dLblEarth', s.earth.position.x, s.earth.position.y, s.earth.position.z);
    put('v3dLblSite', 0, 40, 0);
    if (v.ctl.mode === 'rover') put('v3dLblRover', s.rover.position.x, s.rover.position.y + 2.5, s.rover.position.z);
  }
  function roverReadout(v, ts) {
    if (ts - (v.lastRead || 0) < 150) return;
    v.lastRead = ts;
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
    v.roverState = { e: g.e, n: g.n, h: h, slope: sl.slope, lat: ll.lat, lon: ll.lon, nearFieldSunUp: ns && ns.up, warn: !warn.hidden, dist: r.dist };
  }

  // -------------------------------------------------------------- events
  function bind(v) {
    var c = v.ctl, cvs = v.s.renderer.domElement, on = [];
    function add(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); on.push([t, ev, fn, opt]); }
    var formTag = function (e) { var t = e.target && e.target.tagName; return t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA'; };
    add(window, 'keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (formTag(e)) return;
      if (/^(Arrow|Key[WASDQE]|Shift|Equal|Minus|Numpad(Add|Subtract))/.test(e.code)) { c.keys[e.code] = true; v.dirty = true; if (/^Arrow/.test(e.code)) e.preventDefault(); }
    });
    add(window, 'keyup', function (e) { delete c.keys[e.code]; });
    add(window, 'blur', function () { c.keys = {}; });
    cvs.style.touchAction = 'none';
    add(cvs, 'contextmenu', function (e) { e.preventDefault(); });
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
    add($('v3dShadows'), 'change', function () { v.s.sun.castShadow = this.checked; v.s.terrain.receiveShadow = this.checked; v.s.terrain.material.needsUpdate = true; v.dirty = true; });
    add($('v3dQuality'), 'change', function () {
      var q = this.value; lsSet('asteria.v3dQuality', q);
      setQuality(v, q, 'Quality set to ' + QUALITY[q].label + ' (your choice, remembered on this device).');
    });
    add($('v3dBright'), 'input', function () { setBrightness(v, +this.value); });
    add($('v3dLightUp'), 'click', function () { setBrightness(v, v.bright >= LIGHT_UP - 0.01 ? 1 : LIGHT_UP); });
    add($('v3dTipBtn'), 'click', function () { setBrightness(v, LIGHT_UP); });
    add($('v3dContours'), 'change', function () { overlays(v); });
    add($('v3dContourInt'), 'change', function () { overlays(v); });
    add($('v3dSlope'), 'change', function () { overlays(v); });
    add($('v3dRing'), 'change', function () { v.s.ring.visible = this.checked; v.dirty = true; });
    add($('v3dStars'), 'change', function () {
      var on = this.checked; $('v3dStarNote').hidden = !on;
      if (on) ensureStars(v).then(function () { if (V === v) { v.s.stars.visible = $('v3dStars').checked; v.dirty = true; } });
      else { v.s.stars.visible = false; v.dirty = true; }
    });
    add($('v3dSlopeMax'), 'change', function () { v.lastRead = 0; v.dirty = true; });
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

  // ------------------------------------------------- real-data overlays (contours, slope)
  function overlays(v) {
    var U = v.s.terrainMat.userData.uniforms, c = $('v3dContours').checked, sl = $('v3dSlope').checked, iv = +$('v3dContourInt').value;
    U.uContour.value = c ? iv : 0; U.uSlope.value = sl ? 1 : 0;
    var L = $('v3dLegend'), parts = [];
    if (c) parts.push('<span><i class="cl"></i>Contour lines every ' + iv + ' m (every 5th brighter), from the LOLA heights</span>');
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

  // ------------------------------------------------- quality and brightness
  function initDisplay(v) {
    $('v3dQuality').value = v.quality;
    $('v3dQWhy').textContent = v.userQuality ? '(your choice)' : '(automatic: ' + v.auto.why + ')';
    var b = parseFloat(lsGet('asteria.v3dBrightness'));
    setBrightness(v, isFinite(b) && b >= 0.5 && b <= 6 ? b : 1, true);
  }
  // Display brightness only: tone-mapping exposure, and the faint fill light scaled with it. The Sun direction,
  // the shadows' geometry and every computed value are untouched.
  function setBrightness(v, b, noSave) {
    v.bright = b;
    v.s.renderer.toneMappingExposure = b;
    v.s.fill.intensity = FILL * b;
    $('v3dBright').value = b; $('v3dBrightVal').textContent = b.toFixed(1) + '×';
    var lit = b >= LIGHT_UP - 0.01;
    $('v3dLightUp').setAttribute('aria-pressed', lit ? 'true' : 'false');
    $('v3dLightUp').textContent = lit ? 'Normal brightness' : 'Light up';
    if (!noSave) lsSet('asteria.v3dBrightness', String(b));
    updateTip(v);
    v.dirty = true;
  }
  function updateTip(v) {
    var tip = $('v3dTip'); if (!tip) return;
    tip.hidden = !(v.inst && !v.inst.sunUp) || v.bright >= LIGHT_UP - 0.01;
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
    var el = buildDom({ site: o.site, tile: o.tile, stride: stride, earthRadiusDeg: inst0 && inst0.r.earth.radius_deg });
    var v = { el: el, stage: $('v3dStage'), app: o.app, site: o.site, dirty: true, frames: 0, raf: 0 };
    v.s = buildScene({ tile: o.tile, mask: o.mask, phone: phone, stride: stride, Q: Q });
    v.earthRadiusDeg = inst0 && inst0.r.earth.radius_deg;
    v.stride = stride; v.phone = phone; v.quality = qName; v.Q = Q; v.auto = auto; v.userQuality = QUALITY[user] ? user : null; v.openArgs = o;
    v.stage.insertBefore(v.s.renderer.domElement, v.stage.firstChild);
    v.s.renderer.domElement.setAttribute('aria-label', '3D view of the terrain around ' + o.site.name + ' with the Sun and Earth at their computed positions');
    v.ctl = Controls(v);
    V = v;
    document.body.classList.add('v3d-open');
    bind(v);
    resize(v);
    if (inst0) {
      setInstant(v, inst0);
      v.ctl.yaw = inst0.r.sun.az + 115;
    }
    initDisplay(v);
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
      mats.forEach(function (m) { if (seen.indexOf(m) < 0) { seen.push(m); for (var key in m) if (m[key] && m[key].isTexture) m[key].dispose(); m.dispose(); } });
    });
    if (s.sun.shadow && s.sun.shadow.map) s.sun.shadow.map.dispose();
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
      overlays: { contour: s.terrainMat.userData.uniforms.uContour.value, slope: s.terrainMat.userData.uniforms.uSlope.value }, shadowMapSize: s.sun.shadow.mapSize.x, pixelRatio: s.renderer.getPixelRatio(), brightness: v.bright, fillIntensity: s.fill.intensity, exposure: s.renderer.toneMappingExposure, mode: v.ctl.mode, stride: v.stride, phone: v.phone, exaggeration: s.T.k,
      sunLightDir: [lp.x, lp.y, lp.z], sunLight: M.azElFromDir([lp.x, lp.y, lp.z]), sunDiskRadiusDeg: Math.asin(s.sunDisk.scale.x / SUN_D) / DEG,
      earthDir: [ep.x, ep.y, ep.z], earthAzEl: M.azElFromDir([ep.x, ep.y, ep.z]), earthRadiusDeg: Math.asin(s.earth.scale.x / EARTH_D) / DEG,
      sunIntensity: s.sun.intensity, earthPhase: v.phase, instant: v.inst && { idx: v.inst.idx, t: v.inst.t, sunUp: v.inst.sunUp, earthUp: v.inst.earthUp, sun: { az: v.inst.r.sun.az, el: v.inst.r.sun.el, radius_deg: v.inst.r.sun.radius_deg }, earth: { az: v.inst.r.earth.az, el: v.inst.r.earth.el, radius_deg: v.inst.r.earth.radius_deg } },
      vertices: s.geo.attributes.position.count, triangles: s.geo.index.count / 3, extVertices: s.extVertices || 0, extError: s.extError || null,
      layers: s.layers.map(function (L) { return { name: L.name, vertices: L.vertices, cast: L.mesh.castShadow, receive: L.mesh.receiveShadow }; }),
      shadowCamera: { left: s.sun.shadow.camera.left, right: s.sun.shadow.camera.right, top: s.sun.shadow.camera.top, bottom: s.sun.shadow.camera.bottom, near: s.sun.shadow.camera.near, far: s.sun.shadow.camera.far, texel: s.shadowTexel },
      memory: { geometries: s.renderer.info.memory.geometries, textures: s.renderer.info.memory.textures }, rover: v.roverState || null,
      tileCentreY: M.groundWorld(s.TM, 0, 0).y,
      camera: [cam.x, cam.y, cam.z], eyeAboveGround: cam.y - M.groundWorld(s.TM, cam.x, cam.z).y
    };
  }
  // Test hooks: drive the controls without real key presses.
  function testKey(code, down) { if (V) { if (down) V.ctl.keys[code] = true; else delete V.ctl.keys[code]; V.dirty = true; } }
  function testMode(m) { if (V) setMode(V, m); }

  // Test hook (shading-consistency check): set the time t (ms), render, and read the rendered shadow map at the site
  // marker (2 m above the ground, as the horizon model's observer). Returns the shadow-map verdict, the validated
  // horizon model's "Sun up" (Sun centre above the terrain horizon) and a near-field ray march over the drawn terrain.
  function shadowProbe(t) {
    var v = V; if (!v || !v.s) return null;
    var s = v.s, E = window.LunaEngine, r = E.sunEarthAt({ lat: v.site.lat, lon: v.site.lon }, new Date(t));
    var mask = v.openArgs.mask, hz = E.maskAt(mask, r.sun.az), sunUp = r.sun.el > hz;
    var inst = { idx: 0, n: 1, t: t, r: r, sunUp: sunUp, earthUp: r.earth.el > E.maskAt(mask, r.earth.az), hzSun: hz, hzEarth: E.maskAt(mask, r.earth.az), minEl: 0 };
    setInstant(v, inst);
    s.renderer.render(s.scene, s.camera);
    var lit = false, depth = null, z = null;
    if (s.sun.intensity > 0 && s.sun.castShadow && s.sun.shadow.map) {
      var THREE = s.THREE, p = new THREE.Vector4(0, groundY(s, 0, 0) + EYE_M, 0, 1).applyMatrix4(s.sun.shadow.matrix);
      var W = s.sun.shadow.mapSize.x, buf = new Uint8Array(4);
      var px = Math.floor(p.x * W), py = Math.floor(p.y * W);
      if (px >= 0 && py >= 0 && px < W && py < W) {
        s.renderer.readRenderTargetPixels(s.sun.shadow.map, px, py, 1, 1, buf);
        var f = 255 / 256;
        depth = f * (buf[0] / 255 / 16777216 + buf[1] / 255 / 65536 + buf[2] / 255 / 256 + buf[3] / 255);
        z = p.z + s.sun.shadow.bias;
        lit = z <= depth;
      } else lit = true;   // outside the shadow camera: drawn lit
    }
    var dh = drawnHorizon(s, r.sun.az);
    return { t: t, sunEl: r.sun.el, sunAz: r.sun.az, horizon: hz, validatedSunUp: sunUp, renderedLit: lit, sunAboveDrawnTerrain: r.sun.el > dh.el, drawnTerrainHorizon: dh.el, castKm: dh.km, quality: v.quality, texel: s.shadowTexel };
  }
  // Elevation (deg) of the highest shadow-casting terrain toward azimuth az, seen from 2 m above the site (true heights from
  // the finest drawn grid at each distance, lunar curvature included); used to explain disagreements.
  function drawnHorizon(s, az) {
    // only terrain that casts shadows in this view (Low: the tile; Medium: + ring A; High: + ring B)
    var grids = [s.T, s.ringA && s.Q.extShadow ? s.ext.a : null, s.ext.b && s.Q.ringB && s.Q.extShadow ? s.ext.b : null].filter(Boolean);
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
  return { starAzEl: starAzEl, testScene: testScene, QUALITY: QUALITY, shadowProbe: shadowProbe, testCamera: testCamera, testQuality: testQuality, testBrightness: testBrightness, open: open, close: close, isOpen: function () { return !!V; }, debug: debug, testKey: testKey, testMode: testMode };
})();
