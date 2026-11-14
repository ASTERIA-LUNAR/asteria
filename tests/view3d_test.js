#!/usr/bin/env node
/* Unit tests for the 3D view geometry (js/view3d_math.js) and the terrain tiles (data/terrain3d).
 * Generated with Claude Code (Anthropic) under human direction.
 * Usage: node tests/view3d_test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const E = require('../js/engine.js');
const M = require('../js/view3d_math.js');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const expect = (name, ok, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : '')); if (!ok) fails++; };
const DEG = Math.PI / 180;
const angle = (a, b) => {
  const d = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / Math.hypot(...a) / Math.hypot(...b);
  return Math.acos(Math.max(-1, Math.min(1, d))) / DEG;
};
function loadWin(file) {
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx);
  return ctx.window;
}

// ---------------------------------------------------------------- 1. Sun / Earth direction vectors
// The 3D direction for the engine's (az, el) must equal the engine's own apparent direction vector (body-fixed 'bf',
// projected on the site's East-North-Up basis built here independently) within 0.01 deg.
(function () {
  const ids = loadWin('data/terrain3d/index.js').ASTERIA_TERRAIN3D_IDS;
  let worstSun = 0, worstEarth = 0, worstRound = 0, n = 0, seed = 42;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const id of ids) {
    const hz = loadWin('data/horizons/' + id + '.js').LUNA_HORIZONS[id];
    for (let k = 0; k < 12; k++) {
      const t = new Date(Date.UTC(2026, 0, 1) + rnd() * 5 * 365.25 * 86400000);
      const r = E.sunEarthAt({ lat: hz.lat, lon: hz.lon }, t);
      const la = hz.lat * DEG, lo = hz.lon * DEG;
      const up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
      const east = [-Math.sin(lo), Math.cos(lo), 0];
      const north = [up[1] * east[2] - up[2] * east[1], up[2] * east[0] - up[0] * east[2], up[0] * east[1] - up[1] * east[0]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      for (const [body, set] of [['sun', v => { worstSun = Math.max(worstSun, v); }], ['earth', v => { worstEarth = Math.max(worstEarth, v); }]]) {
        const b = r[body], bf = b.bf;
        const want = [dot(bf, east), dot(bf, up), -dot(bf, north)];          // Three.js: x = E, y = U, z = -N
        const got = M.dirFromAzEl(b.az, b.el);
        set(angle(got, want));
        const back = M.azElFromDir(got);
        const daz = Math.abs(((back.az - b.az + 540) % 360) - 180) * Math.cos(b.el * DEG);
        worstRound = Math.max(worstRound, daz, Math.abs(back.el - b.el));
      }
      n++;
    }
  }
  expect('3D Sun direction vector = engine az/el (vs the engine\'s raw apparent vector, ' + n + ' site/time cases) within 0.01°', worstSun < 0.01, 'worst ' + worstSun.toExponential(2) + '°');
  expect('3D Earth direction vector = engine az/el within 0.01°', worstEarth < 0.01, 'worst ' + worstEarth.toExponential(2) + '°');
  expect('direction -> az/el round trip within 0.01°', worstRound < 0.01, 'worst ' + worstRound.toExponential(2) + '°');
  // explicit convention checks
  const nrt = M.dirFromAzEl(0, 0), est = M.dirFromAzEl(90, 0), zen = M.dirFromAzEl(123, 90);
  expect('convention: az 0 = north = -z, az 90 = east = +x, el 90 = +y', Math.abs(nrt[2] + 1) < 1e-12 && Math.abs(est[0] - 1) < 1e-12 && Math.abs(zen[1] - 1) < 1e-12);
})();

// ---------------------------------------------------------------- 2. terrain tiles
(function () {
  const ids = loadWin('data/terrain3d/index.js').ASTERIA_TERRAIN3D_IDS;
  const hzIds = loadWin('data/horizons/index.js').LUNA_HORIZON_IDS;
  expect('every south-pole site with a terrain horizon has a 3D tile', hzIds.every(id => ids.includes(id)) && ids.length === hzIds.length, ids.length + ' tiles');
  let worst = 0, worstCentre = 0, worstCurv = 0, worstInv = 0, sizes = [];
  for (const id of ids) {
    const meta = loadWin('data/terrain3d/' + id + '.js').ASTERIA_TERRAIN3D[id];
    const hz = loadWin('data/horizons/' + id + '.js').LUNA_HORIZONS[id];
    const T = M.decodeTile(meta);
    sizes.push(meta.size_m);
    for (const p of meta.checkPoints) worst = Math.max(worst, Math.abs(T.H[p.j * T.n + p.i] - p.h_dem_m));
    worstCentre = Math.max(worstCentre, Math.abs(T.H[T.c * T.n + T.c] - hz.siteHeight_m));
    // ENU geometry: exact vs small-angle expectation (U = h - h0 - (R + h) theta^2 / 2, theta = s / R; error ~ theta^4)
    for (const [i, j] of [[0, 0], [T.n - 1, 0], [T.c, T.c], [7, T.n - 3]]) {
      const e = (i - T.c) * T.d, n = (T.c - j) * T.d, h = T.H[j * T.n + i], s = Math.hypot(e, n);
      const p = M.enu(T, e, n, h);
      worstCurv = Math.max(worstCurv, Math.abs(p[2] - (h - T.h0 - (T.R + h) * (s / T.R) * (s / T.R) / 2)));   // small-angle form of (R+h)cos(s/R) - (R+h0)
      const w = M.toThree(p), g = M.gridFromWorld(T, w[0], w[2], false);
      worstInv = Math.max(worstInv, Math.hypot(g.e - e, g.n - n));
    }
  }
  expect('JS decoder: tile heights at the stored check points (site centre + 3 others) match direct DEM samples within 1 m', worst <= 1, 'worst ' + worst.toFixed(3) + ' m');
  expect('tile centre height = horizon file site height (same DEM) within 1 m', worstCentre <= 1, 'worst ' + worstCentre.toFixed(3) + ' m');
  expect('tile size about 6 km', sizes.every(s => s >= 6000 && s <= 6200), sizes.join(', '));
  expect('ENU vertex = h - h0 minus the curvature drop (R+h)θ²/2 (within 1 cm)', worstCurv < 0.01, 'worst ' + (worstCurv * 1000).toFixed(2) + ' mm');
  expect('world -> grid inverse (walk/rover ground lookup) round trip within 1 cm', worstInv < 0.01, 'worst ' + (worstInv * 1000).toFixed(2) + ' mm');
})();

// ---------------------------------------------------------------- 3. slope, mesh height, near-field Sun, Earth phase
(function () {
  // synthetic tile: a plane rising 10 deg toward the east
  const n = 101, d = 20, c = 50, H = new Float32Array(n * n), tan10 = Math.tan(10 * DEG);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) H[j * n + i] = 1000 + (i - c) * d * tan10;
  const T = { n, d, c, h0: 1000, R: 1737400, half: c * d, H, k: 1 };
  const s1 = M.slopeAt(T, 123.4, -456.7);
  expect('slope of a 10° plane = 10.00° with the downhill direction west (270°)', Math.abs(s1.slope - 10) < 1e-3 && Math.abs(s1.downhillAz - 270) < 1e-3, s1.slope.toFixed(6) + '°, ' + s1.downhillAz.toFixed(3) + '°');
  expect('mesh height = bilinear height on a plane', Math.abs(M.meshHeightAt(T, 33.3, 71.1) - M.heightAt(T, 33.3, 71.1)) < 1e-6);
  // near-field Sun: plane rising to the east blocks a low Sun in the east, not one in the west
  const east = M.nearFieldSunUp(T, 0, 0, 90, 5, 2), west = M.nearFieldSunUp(T, 0, 0, 270, 1, 2);
  expect('near-field estimate: a 10° slope blocks a Sun at 5° on the uphill side, not a Sun at 1° on the downhill side', !east.up && west.up, JSON.stringify({ east: east.tileHorizon.toFixed(2), west: west.tileHorizon.toFixed(2) }));
  // DEM-based vertex normals and slope (Part 5): a 10° plane rising to the east -> normal tilted 10° toward the west
  const PG = M.buildGridMesh(T, 1, 0, null, T), kc = c * n + c;
  const nv = [PG.normal[3 * kc], PG.normal[3 * kc + 1], PG.normal[3 * kc + 2]];
  const tilt = Math.acos(nv[1]) / DEG, toward = Math.atan2(nv[0], -nv[2]) / DEG;
  expect('vertex normals from the DEM at full resolution: 10° plane -> normal tilted 10.00° toward the west (downhill), slope attribute 10.00°', Math.abs(tilt - 10) < 0.01 && Math.abs(Math.abs(toward) - 90) < 0.01 && nv[0] < 0 && Math.abs(PG.slope[kc] - 10) < 0.01, 'tilt ' + tilt.toFixed(4) + '°, slope ' + PG.slope[kc].toFixed(4) + '°');
  // Earth phase: Sun behind the observer -> full Earth; Sun behind Earth -> new Earth
  const full = M.earthPhase({ az: 180, el: 0, dist_km: 1.496e8 }, { az: 0, el: 0, dist_km: 384400 });
  const neu = M.earthPhase({ az: 0, el: 0, dist_km: 1.496e8 }, { az: 0, el: 0, dist_km: 384400 });
  expect('Earth phase: Sun opposite Earth -> fully lit; Sun behind Earth -> unlit', full.illuminated > 0.9999 && neu.illuminated < 1e-4, full.illuminated.toFixed(5) + ' / ' + neu.illuminated.toFixed(5));
  // phase from the engine vs. a direct computation with the engine's raw vectors
  const r = E.sunEarthAt({ lat: -88.79, lon: 124.5 }, new Date('2027-03-10T00:00:00Z'));
  const sv = r.sun.bf.map(x => x * r.sun.dist_km), ev = r.earth.bf.map(x => x * r.earth.dist_km);
  const es = sv.map((x, k) => x - ev[k]), eo = ev.map(x => -x);
  const ph = angle(es, eo), p2 = M.earthPhase(r.sun, r.earth);
  expect('Earth phase from az/el equals the engine-vector computation within 0.01°', Math.abs(ph - p2.phaseAngle) < 0.01, ph.toFixed(4) + '° vs ' + p2.phaseAngle.toFixed(4) + '°');
  // lat/lon of grid points: the centre is the site, and 1 km north moves toward the pole-facing meridian
  const ll = M.latLonAt(-85.98, -1.67, 0, 0), ln = M.latLonAt(-85.98, -1.67, 0, 1000);
  expect('grid -> lat/lon: centre is the site; 1 km north is 1000/R rad further north', Math.abs(ll.lat + 85.98) < 1e-9 && Math.abs(ll.lon + 1.67) < 1e-9 && Math.abs((ln.lat - ll.lat) - 1000 / 1737400 / DEG) < 1e-9);
})();

// ---------------------------------------------------------------- 3b. extended terrain rings, 5 m patch, seams (round 4)
(function () {
  const ids = loadWin('data/terrain3d/index.js').ASTERIA_TERRAIN3D_IDS;
  const ids5 = loadWin('data/terrain3d/hi5m_index.js').ASTERIA_TERRAIN3D_5M_IDS;
  let worstA = 0, worstB = 0, worst5 = 0, nA = 0, seam = 0, seamN = 0, sizes = [], gapCells = 0, worst5c = 0;
  const posAt = (P, m, ii, jj) => [P.pos[3 * (jj * m + ii)], P.pos[3 * (jj * m + ii) + 1], P.pos[3 * (jj * m + ii) + 2]];
  for (const id of ids) {
    const T = M.decodeTile(loadWin('data/terrain3d/' + id + '.js').ASTERIA_TERRAIN3D[id]);
    const A = M.decodeTile(loadWin('data/terrain3d/ext/' + id + '_a.js').ASTERIA_TERRAIN3D_EXT[id + '_a']);
    const B = M.decodeTile(loadWin('data/terrain3d/ext/' + id + '_b.js').ASTERIA_TERRAIN3D_EXT[id + '_b']);
    for (const p of A.meta.checkPoints) { worstA = Math.max(worstA, Math.abs(A.H[p.j * A.n + p.i] - p.h_dem_m)); nA++; }
    for (const p of B.meta.checkPoints) { worstB = Math.max(worstB, Math.abs(B.H[p.j * B.n + p.i] - p.h_dem_m)); nA++; }
    sizes.push(A.half, B.half);
    // seams: every ring vertex on the hole edge is bit-identical to the vertex of the finer mesh at the same node
    for (const [outer, inner, stride] of [[A, T, 1], [B, A, 1], [A, T, 2]]) {
      const I = stride > 1 ? decim(inner, stride) : inner, O = stride > 1 ? decim(outer, stride) : outer;
      const PO = M.buildGridMesh(O, 1, I.half, I), PI = M.buildGridMesh(I, 1, 0, null);
      for (let jj = 0; jj < PO.m; jj++) for (let ii = 0; ii < PO.m; ii++) {
        const e = (ii - O.c) * O.d, n = (O.c - jj) * O.d;
        if (Math.max(Math.abs(e), Math.abs(n)) !== I.half || Math.abs(e) > I.half || Math.abs(n) > I.half) continue;
        const pi = Math.round(e / I.d + I.c), pj = Math.round(I.c - n / I.d);
        const a = posAt(PO, PO.m, ii, jj), b = posAt(PI, PI.m, pi, pj);
        seam = Math.max(seam, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); seamN++;
      }
      // no hole cell is left undrawn: every outer cell outside the inner square is in the index
      const cells = PO.index.length / 6, m = PO.m, inside = Math.round(2 * I.half / O.d);
      if (cells !== (m - 1) * (m - 1) - inside * inside) gapCells++;
    }
    if (ids5.includes(id)) {
      const P = M.decodeTile(loadWin('data/terrain3d/hi5m/' + id + '.js').ASTERIA_TERRAIN3D_5M[id]);
      for (const p of P.meta.checkPoints) worst5 = Math.max(worst5, Math.abs(P.H[p.j * P.n + p.i] - p.h_dem_m));
      // the tile's hole edge takes its heights from the patch: shared vertices
      const PT = M.buildGridMesh(T, 1, P.half, P), PP = M.buildGridMesh(P, 1, 0, null);
      for (let jj = 0; jj < PT.m; jj++) for (let ii = 0; ii < PT.m; ii++) {
        const e = (ii - T.c) * T.d, n = (T.c - jj) * T.d;
        if (Math.max(Math.abs(e), Math.abs(n)) !== P.half || Math.abs(e) > P.half || Math.abs(n) > P.half) continue;
        const a = posAt(PT, PT.m, ii, jj), b = posAt(PP, PP.m, Math.round(e / P.d + P.c), Math.round(P.c - n / P.d));
        seam = Math.max(seam, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); seamN++;
      }
      worst5c = Math.max(worst5c, Math.abs(P.H[P.c * P.n + P.c] - T.H[T.c * T.n + T.c]));
      // readouts use the patch inside 1 km: T.patch hook
      T.patch = P;
      const h = M.heightAt(T, 123.4, -456.7), hp = M.heightAt(P, 123.4, -456.7); T.patch = null;
      if (Math.abs(h - hp) > 1e-9) gapCells++;
    }
  }
  expect('extended terrain: ring A (16 km) and ring B (40 km) heights at stored check points (' + nA + ', incl. far corners) within 1 m of direct DEM samples', worstA <= 1 && worstB <= 1, 'worst ring A ' + worstA.toFixed(3) + ' m, ring B ' + worstB.toFixed(3) + ' m');
  expect('extended terrain: half-sizes 16 km and 40 km for every site', sizes.every((x, k) => x === (k % 2 ? 40000 : 16000)), [...new Set(sizes)].join(', '));
  expect('seams: ' + seamN + ' hole-edge vertices (tile/ring A, ring A/ring B, Low-quality decimation, 5 m patch/tile) identical to the vertices of the finer mesh', seam === 0, 'max distance ' + seam + ' m');
  expect('seams: no missing cells around the holes; heights inside the 5 m patch come from the patch', gapCells === 0, gapCells + ' problems');
  expect('5 m patch (' + ids5.join(', ') + '): heights at stored check points within 1 m of direct LDEM_875S_5M samples', ids5.length === 3 && worst5 <= 1, 'worst ' + worst5.toFixed(3) + ' m; site centre 5 m vs 20 m DEM differ by ' + worst5c.toFixed(2) + ' m');
  function decim(G, st) {
    const mm = Math.floor((G.n - 1) / st) + 1, H = new Float32Array(mm * mm);
    for (let j = 0; j < mm; j++) for (let i = 0; i < mm; i++) H[j * mm + i] = G.H[j * st * G.n + i * st];
    return Object.assign({}, G, { n: mm, d: G.d * st, c: (mm - 1) / 2, half: (mm - 1) / 2 * G.d * st, H });
  }
})();

// ---------------------------------------------------------------- 3c. real stars (round 4)
// Independent check: star az/el from the IAU/WGCCRE 2009 lunar rotation model (Archinal et al. 2011, Celest. Mech.
// Dyn. Astr. 109, 101, Table 2: alpha0, delta0, W with the E1-E13 terms) written out here, versus the 3D view's
// directions (which use the engine's frame from Astronomy Engine's RotationAxis).
(function () {
  const rows = loadWin('data/stars.js').ASTERIA_STARS.rows;
  const pick = [2491, 2326, 5340, 5459, 7001, 472];   // Sirius, Canopus, Arcturus, alpha Cen A, Vega, Achernar
  const sel = rows.filter(r => pick.includes(r[0]));
  const s = Math.sin, c = Math.cos, D = DEG;
  function iauMoon(date) {
    const d = (date.getTime() / 86400000 + 2440587.5 + 69.184 / 86400) - 2451545.0, T = d / 36525;
    const E = [0, 125.045 - 0.0529921 * d, 250.089 - 0.1059842 * d, 260.008 + 13.0120009 * d, 176.625 + 13.3407154 * d, 357.529 + 0.9856003 * d,
      311.589 + 26.4057084 * d, 134.963 + 13.0649930 * d, 276.617 + 0.3287146 * d, 34.226 + 1.7484877 * d, 15.134 - 0.1589763 * d,
      119.743 + 0.0036096 * d, 239.961 + 0.1643573 * d, 25.053 + 12.9590088 * d].map(x => x * D);
    const a0 = 269.9949 + 0.0031 * T - 3.8787 * s(E[1]) - 0.1204 * s(E[2]) + 0.0700 * s(E[3]) - 0.0172 * s(E[4]) + 0.0072 * s(E[6]) - 0.0052 * s(E[10]) + 0.0043 * s(E[13]);
    const d0 = 66.5392 + 0.0130 * T + 1.5419 * c(E[1]) + 0.0239 * c(E[2]) - 0.0278 * c(E[3]) + 0.0068 * c(E[4]) - 0.0029 * c(E[6]) + 0.0009 * c(E[7]) + 0.0008 * c(E[10]) - 0.0009 * c(E[13]);
    const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.5610 * s(E[1]) + 0.1208 * s(E[2]) - 0.0642 * s(E[3]) + 0.0158 * s(E[4]) + 0.0252 * s(E[5]) - 0.0066 * s(E[6]) - 0.0047 * s(E[7]) - 0.0046 * s(E[8]) + 0.0028 * s(E[9]) + 0.0052 * s(E[10]) + 0.0040 * s(E[11]) + 0.0019 * s(E[12]) - 0.0044 * s(E[13]);
    return { a0: a0 * D, d0: d0 * D, W: W * D };
  }
  // EQJ -> body fixed with the standard 3-1-3 rotation Rz(W) Rx(90 - d0) Rz(90 + a0)
  function rotZ(v, t) { return [c(t) * v[0] + s(t) * v[1], -s(t) * v[0] + c(t) * v[1], v[2]]; }
  function rotX(v, t) { return [v[0], c(t) * v[1] + s(t) * v[2], -s(t) * v[1] + c(t) * v[2]]; }
  let worst = 0, n = 0, sample = '';
  for (const id of ['peak_shackleton_lw', 'mons_malapert', 'im1']) {
    const hz = loadWin('data/horizons/' + id + '.js').LUNA_HORIZONS[id];
    for (const iso of ['2026-12-01T00:00:00Z', '2027-05-17T13:00:00Z', '2028-02-29T06:30:00Z', '2030-08-08T20:00:00Z']) {
      const date = new Date(iso), years = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / (365.25 * 86400000);
      const got = M.starDirs(sel, E._moonFrame(date), hz.lat, hz.lon, years);
      const R = iauMoon(date), la = hz.lat * D, lo = hz.lon * D;
      sel.forEach((r, k) => {
        const dec = (r[2] + r[6] * years / 3600) * D, ra = (r[1] + r[5] * years / 3600 / Math.cos(r[2] * D)) * D;
        let v = [c(dec) * c(ra), c(dec) * s(ra), s(dec)];
        v = rotZ(rotX(rotZ(v, Math.PI / 2 + R.a0), Math.PI / 2 - R.d0), R.W);
        const e = -s(lo) * v[0] + c(lo) * v[1], nn = -s(la) * c(lo) * v[0] - s(la) * s(lo) * v[1] + c(la) * v[2], u = c(la) * c(lo) * v[0] + c(la) * s(lo) * v[1] + s(la) * v[2];
        const want = M.azElFromDir([e, u, -nn]), have = M.azElFromDir([got[3 * k], got[3 * k + 1], got[3 * k + 2]]);
        const err = Math.max(Math.abs(((have.az - want.az + 540) % 360) - 180) * Math.cos(want.el * D), Math.abs(have.el - want.el));
        if (err > worst) { worst = err; sample = r[7] + ' at ' + id + ' ' + iso + ': az/el ' + have.az.toFixed(3) + '/' + have.el.toFixed(3) + ' vs ' + want.az.toFixed(3) + '/' + want.el.toFixed(3); }
        n++;
      });
    }
  }
  expect('real stars: ' + n + ' az/el values of 6 bright stars (3 sites, 4 dates) match an independent IAU/WGCCRE 2009 computation within 0.1°', worst < 0.1 && sel.length === 6, 'worst ' + worst.toFixed(4) + '° (' + sample + ')');
  expect('star list: Yale Bright Star Catalogue to V = 5.0 (' + rows.length + ' stars), source cited in the file', rows.length > 1500 && rows.every(r => r[3] <= 5.0) && /Bright Star Catalogue/.test(loadWin('data/stars.js').ASTERIA_STARS.source));
})();

// ---------------------------------------------------------------- 4. lazy loading: the main page does not load the 3D code
(function () {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const tags = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const bad = tags.filter(s => /three|view3d|terrain3d\/(?!index\.js)/.test(s));
  expect('index.html does not load Three.js, the 3D code or any terrain tile (only the 3D site list)', bad.length === 0, bad.join(', ') || tags.filter(s => /terrain3d/.test(s)).join(', '));
  expect('Three.js is a local file (lib/three/three.min.js, r149, MIT licence alongside)', fs.existsSync(path.join(ROOT, 'lib/three/three.min.js')) && /Copyright 2010-2023 Three.js Authors/.test(fs.readFileSync(path.join(ROOT, 'lib/three/three.min.js'), 'utf8').slice(0, 300)) && fs.existsSync(path.join(ROOT, 'lib/three/LICENSE')));
})();

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
