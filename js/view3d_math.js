/* ASTERIA 3D view - geometry helpers (no Three.js, no DOM; works in the browser and in Node for unit tests).
 * Generated with Claude Code (Anthropic) under human direction.
 *
 * Frames
 *  - Site ENU: East, North, Up at the site (spherical Moon, R = 1737.4 km, up = radial), metres, origin on the
 *    ground at the site (height h0 above the sphere). Azimuth clockwise from local north, as in js/engine.js.
 *  - Three.js world: x = East, y = Up, z = -North (right-handed, y up).
 *  - Tile grid (tools/terrain3d.py): node (i, j), e = (i - c) d, n = (c - j) d, c = (N - 1) / 2; (e, n) are
 *    azimuthal-equidistant ground coordinates on the 1737.4 km sphere (great-circle distance s = |(e, n)|,
 *    direction az = atan2(e, n)).
 *  - Exact 3D position of a surface point at grid (e, n) with height h above the sphere:
 *    theta = s / R; E = (R + h) sin(theta) sin(az); N = (R + h) sin(theta) cos(az); U = (R + h) cos(theta) - (R + h0).
 *    This includes the curvature drop (about 5 m at the tile corners).
 *  - Vertical exaggeration k: h' = h0 + k (h - h0) (k = 1: true scale).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AsteriaView3DMath = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var DEG = Math.PI / 180;

  function b64ToBytes(b64) {
    if (typeof Buffer !== 'undefined' && typeof window === 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    var bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  // Decode a tile written by tools/terrain3d.py into absolute heights (m above the 1737.4 km sphere).
  function decodeTile(meta) {
    var u8 = b64ToBytes(meta.b64), n = meta.n;
    if (u8.length !== n * n * 2) throw new Error('terrain tile size mismatch');
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), H = new Float32Array(n * n);
    for (var k = 0; k < n * n; k++) H[k] = meta.offset_m + dv.getInt16(2 * k, true) * meta.unit_m;
    return {
      id: meta.siteId, n: n, d: meta.spacing_m, c: (n - 1) / 2, h0: meta.h0_m, R: meta.radius_m || 1737400,
      half: (n - 1) / 2 * meta.spacing_m, H: H, meta: meta, k: 1
    };
  }

  // ------------------------------------------------------------ positions
  function exH(T, h) { return T.h0 + T.k * (h - T.h0); }               // exaggerated height
  // Exact ENU [E, N, U] of the surface point at grid (e, n) with (true) height h, using the tile's exaggeration.
  function enu(T, e, n, h) {
    var s = Math.sqrt(e * e + n * n), th = s / T.R, rr = T.R + exH(T, h);
    var sa = s > 0 ? e / s : 0, ca = s > 0 ? n / s : 1;
    var hor = rr * Math.sin(th);
    return [hor * sa, hor * ca, rr * Math.cos(th) - (T.R + T.h0)];
  }
  function toThree(v) { return [v[0], v[2], -v[1]]; }                  // ENU -> Three.js (x, y, z)
  function fromThree(v) { return [v[0], -v[2], v[1]]; }                // Three.js -> ENU

  // Unit direction (Three.js world) for azimuth/elevation in degrees (azimuth clockwise from north).
  function dirFromAzEl(az, el) {
    var a = az * DEG, e = el * DEG, ce = Math.cos(e);
    return toThree([ce * Math.sin(a), ce * Math.cos(a), Math.sin(e)]);
  }
  function azElFromDir(v) {
    var x = v[0], y = v[1], z = v[2], r = Math.sqrt(x * x + y * y + z * z);
    var az = Math.atan2(x, -z) / DEG; if (az < 0) az += 360;
    return { az: az, el: Math.asin(Math.max(-1, Math.min(1, y / r))) / DEG };
  }

  // ----------------------------------------------------------- height field
  function inside(T, e, n) { return Math.abs(e) <= T.half && Math.abs(n) <= T.half; }
  function cell(T, e, n) {
    var fi = e / T.d + T.c, fj = T.c - n / T.d;
    var i = Math.max(0, Math.min(T.n - 2, Math.floor(fi))), j = Math.max(0, Math.min(T.n - 2, Math.floor(fj)));
    return { i: i, j: j, a: fi - i, b: fj - j };
  }
  function node(T, i, j) { return T.H[j * T.n + i]; }
  // A finer grid (the 5 m patch) attached as T.patch replaces the tile's surface inside its square.
  function inPatch(T, e, n) { var P = T.patch; return P && Math.abs(e) <= P.half && Math.abs(n) <= P.half; }
  // Bilinear DEM height (true, m above the sphere) at grid (e, n) - the method used to build the tile.
  function heightAt(T, e, n) {
    if (inPatch(T, e, n)) return heightAt(T.patch, e, n);
    var q = cell(T, e, n), i = q.i, j = q.j, a = q.a, b = q.b;
    return node(T, i, j) * (1 - a) * (1 - b) + node(T, i + 1, j) * a * (1 - b) + node(T, i, j + 1) * (1 - a) * b + node(T, i + 1, j + 1) * a * b;
  }
  // Height on the rendered mesh: each cell is split along the (i, j+1)-(i+1, j) diagonal, as in buildIndex().
  function meshHeightAt(T, e, n) {
    if (inPatch(T, e, n)) return meshHeightAt(T.patch, e, n);
    var q = cell(T, e, n), i = q.i, j = q.j, a = q.a, b = q.b;
    var h00 = node(T, i, j), h10 = node(T, i + 1, j), h01 = node(T, i, j + 1), h11 = node(T, i + 1, j + 1);
    if (a + b <= 1) return h00 + (h10 - h00) * a + (h01 - h00) * b;
    return h11 + (h01 - h11) * (1 - a) + (h10 - h11) * (1 - b);
  }
  // Slope (deg) and downhill azimuth of the DEM surface: central differences over one grid spacing d of the bilinear
  // heights, dh/de = (h(e+d) - h(e-d)) / 2d, dh/dn likewise (round 5: the same formula as the 3D slope shading in
  // buildGridMesh and as the independent Python check, tools/accuracy3d.py; before, a one-sided gradient inside one
  // cell was used, which differed from the DEM-derived slope by up to 16 deg on rough ground).
  function slopeAt(T, e, n) {
    if (inPatch(T, e, n)) {
      var P = T.patch, lim = P.half - P.d;
      if (Math.abs(e) <= lim && Math.abs(n) <= lim) return slopeAt(P, e, n);
    }
    var d = T.d, h = function (x, y) { return heightAt(T, x, y); };
    var dhde = (h(e + d, n) - h(e - d, n)) / (2 * d);                     // east
    var dhdn = (h(e, n + d) - h(e, n - d)) / (2 * d);                     // north
    var g = Math.sqrt(dhde * dhde + dhdn * dhdn);
    var down = Math.atan2(-dhde, -dhdn) / DEG; if (down < 0) down += 360;
    return { slope: Math.atan(g) / DEG, downhillAz: down };
  }
  // Inverse of enu(): grid (e, n) of the surface point below Three.js world point (x, z) (2 fixed-point iterations).
  function gridFromWorld(T, x, z, useMesh) {
    var E = x, N = -z, rho = Math.sqrt(E * E + N * N);
    if (rho === 0) return { e: 0, n: 0 };
    var sa = E / rho, ca = N / rho, s = rho, hf = useMesh ? meshHeightAt : heightAt;
    for (var it = 0; it < 3; it++) {
      var h = exH(T, hf(T, s * sa, s * ca));
      s = T.R * Math.asin(Math.min(1, rho / (T.R + h)));
    }
    return { e: s * sa, n: s * ca };
  }
  // Ground point (Three.js world) on the rendered mesh below world (x, z).
  function groundWorld(T, x, z) {
    var g = gridFromWorld(T, x, z, true);
    var p = toThree(enu(T, g.e, g.n, meshHeightAt(T, g.e, g.n)));
    return { e: g.e, n: g.n, y: p[1], inside: inside(T, g.e, g.n) };
  }

  // Index buffer for an (m x m) vertex grid; each cell split along the (i, j+1)-(i+1, j) diagonal.
  function buildIndex(m) {
    var idx = new Uint32Array((m - 1) * (m - 1) * 6), k = 0;
    for (var j = 0; j < m - 1; j++) for (var i = 0; i < m - 1; i++) {
      var a = j * m + i, b = a + 1, c = a + m, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b;     // counter-clockwise seen from above (y up)
      idx[k++] = b; idx[k++] = c; idx[k++] = d;
    }
    return idx;
  }
  // Vertex positions (Three.js world) for every 'stride'-th node (stride 1 = full resolution).
  function buildPositions(T, stride) {
    stride = stride || 1;
    var m = Math.floor((T.n - 1) / stride) + 1, pos = new Float32Array(m * m * 3), k = 0;
    for (var jj = 0; jj < m; jj++) for (var ii = 0; ii < m; ii++) {
      var i = ii * stride, j = jj * stride, e = (i - T.c) * T.d, n = (T.c - j) * T.d;
      var p = toThree(enu(T, e, n, node(T, i, j)));
      pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2];
    }
    return { m: m, pos: pos };
  }

  // --------------------------------------------- nested grids (round 4)
  // Height of grid G exactly at a node when (e, n) falls on one (no interpolation rounding), else on its mesh.
  function nodeOrMesh(G, e, n) {
    var fi = e / G.d + G.c, fj = G.c - n / G.d, i = Math.round(fi), j = Math.round(fj);
    if (Math.abs(fi - i) < 1e-9 && Math.abs(fj - j) < 1e-9 && i >= 0 && j >= 0 && i < G.n && j < G.n) return node(G, i, j);
    return meshHeightAt(G, e, n);
  }
  // Mesh of every 'stride'-th node of grid G with a square hole of half-size 'hole' (0 = none) where a finer mesh is drawn.
  // Nodes on the hole's edge take their height from that finer grid ('inner'), so both meshes share identical edge
  // vertices; nodes on G's own outer edge can likewise take heights from 'outerOf' (unused here). Returns positions
  // (Three.js world), the index (cells fully inside the hole left out) and the number of nodes per side.
  // Normals and slope come from the DEM at full resolution ('nsrc', default G itself): central differences over one
  // full-resolution cell, positions with the exact curvature and the current vertical exaggeration; slope (deg) from
  // true heights. Also returns the true heights (for contour lines).
  function buildGridMesh(G, stride, hole, inner, nsrc) {
    stride = stride || 1;
    var S = nsrc || G, dd = S.d;
    var m = Math.floor((G.n - 1) / stride) + 1, pos = new Float32Array(m * m * 3), H = new Float32Array(m * m), k = 0, eps = 1e-6;
    var nor = new Float32Array(m * m * 3), nsm = new Float32Array(m * m * 3), slope = new Float32Array(m * m), RS = 4 * dd;
    for (var jj = 0; jj < m; jj++) for (var ii = 0; ii < m; ii++) {
      var i = ii * stride, j = jj * stride, e = (i - G.c) * G.d, n = (G.c - j) * G.d, h = node(G, i, j);
      if (hole > 0 && inner && Math.abs(e) <= hole + eps && Math.abs(n) <= hole + eps && Math.max(Math.abs(e), Math.abs(n)) >= hole - eps) h = nodeOrMesh(inner, e, n);
      H[jj * m + ii] = h;
      var p = toThree(enu(G, e, n, h));
      var hE1 = heightAt(S, e + dd, n), hE0 = heightAt(S, e - dd, n), hN1 = heightAt(S, e, n + dd), hN0 = heightAt(S, e, n - dd);
      slope[jj * m + ii] = Math.atan(Math.sqrt(Math.pow((hE1 - hE0) / (2 * dd), 2) + Math.pow((hN1 - hN0) / (2 * dd), 2))) / DEG;
      var a1 = enu(G, e + dd, n, hE1), a0 = enu(G, e - dd, n, hE0), b1 = enu(G, e, n + dd, hN1), b0 = enu(G, e, n - dd, hN0);
      var tx = a1[0] - a0[0], ty = a1[1] - a0[1], tz = a1[2] - a0[2], ux = b1[0] - b0[0], uy = b1[1] - b0[1], uz = b1[2] - b0[2];
      var cx = ty * uz - tz * uy, cy = tz * ux - tx * uz, cz = tx * uy - ty * ux, cl = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
      var nt = toThree([cx / cl, cy / cl, cz / cl]);
      nor[k] = nt[0]; nor[k + 1] = nt[1]; nor[k + 2] = nt[2];
      // smoothed normal (central differences over +-4 cells), used only by the relief-shading display option
      var sa1 = enu(G, e + RS, n, heightAt(S, e + RS, n)), sa0 = enu(G, e - RS, n, heightAt(S, e - RS, n)), sb1 = enu(G, e, n + RS, heightAt(S, e, n + RS)), sb0 = enu(G, e, n - RS, heightAt(S, e, n - RS));
      var stx = sa1[0] - sa0[0], sty = sa1[1] - sa0[1], stz = sa1[2] - sa0[2], sux = sb1[0] - sb0[0], suy = sb1[1] - sb0[1], suz = sb1[2] - sb0[2];
      var scx = sty * suz - stz * suy, scy = stz * sux - stx * suz, scz = stx * suy - sty * sux, scl = Math.sqrt(scx * scx + scy * scy + scz * scz) || 1;
      var st = toThree([scx / scl, scy / scl, scz / scl]);
      nsm[k] = st[0]; nsm[k + 1] = st[1]; nsm[k + 2] = st[2];
      pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2];
    }
    var idx = [], dd = G.d * stride;
    for (var j2 = 0; j2 < m - 1; j2++) for (var i2 = 0; i2 < m - 1; i2++) {
      var ec = ((i2 + 0.5) * stride - G.c) * G.d, nc = (G.c - (j2 + 0.5) * stride) * G.d;
      if (hole > 0 && Math.abs(ec) < hole && Math.abs(nc) < hole) continue;
      var a = j2 * m + i2, b = a + 1, c = a + m, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    return { m: m, pos: pos, H: H, normal: nor, normalSmooth: nsm, slope: slope, index: (m * m > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)), spacing: G.d * stride };
  }
  // Skirt: a vertical strip hanging 'drop' metres below the outer edge of grid G (every 'stride'-th node), so the
  // T-junctions where a finer mesh meets a coarser one show terrain-coloured skirt instead of gaps.
  function buildSkirt(G, stride, drop, heightFn) {
    stride = stride || 1;
    var m = Math.floor((G.n - 1) / stride) + 1, ring = [];
    for (var a = 0; a < m - 1; a++) ring.push([a, 0]);
    for (var b = 0; b < m - 1; b++) ring.push([m - 1, b]);
    for (var c2 = m - 1; c2 > 0; c2--) ring.push([c2, m - 1]);
    for (var d2 = m - 1; d2 > 0; d2--) ring.push([0, d2]);
    ring.push(ring[0]);
    var pos = new Float32Array(ring.length * 6), nor = new Float32Array(ring.length * 6), H = new Float32Array(ring.length * 2), sl = new Float32Array(ring.length * 2), idx = [];
    var dd = G.d;
    for (var q = 0; q < ring.length; q++) {
      var i = ring[q][0] * stride, j = ring[q][1] * stride, e = (i - G.c) * G.d, n = (G.c - j) * G.d;
      var h = heightFn ? heightFn(e, n) : node(G, i, j);
      var t = toThree(enu(G, e, n, h)), bt = toThree(enu(G, e, n, h - drop / (G.k || 1)));
      pos.set(t, q * 6); pos.set(bt, q * 6 + 3);
      // the skirt is shaded like the terrain at its top edge (terrain normal), so it does not light up as a wall
      var a1 = enu(G, e + dd, n, heightAt(G, e + dd, n)), a0 = enu(G, e - dd, n, heightAt(G, e - dd, n)), b1 = enu(G, e, n + dd, heightAt(G, e, n + dd)), b0 = enu(G, e, n - dd, heightAt(G, e, n - dd));
      var tx = a1[0] - a0[0], ty = a1[1] - a0[1], tz = a1[2] - a0[2], ux = b1[0] - b0[0], uy = b1[1] - b0[1], uz = b1[2] - b0[2];
      var cx = ty * uz - tz * uy, cy = tz * ux - tx * uz, cz = tx * uy - ty * ux, cl = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
      var nt = toThree([cx / cl, cy / cl, cz / cl]);
      nor.set(nt, q * 6); nor.set(nt, q * 6 + 3);
      H[2 * q] = h; H[2 * q + 1] = h;   // contour lines would not run down the skirt
      if (q < ring.length - 1) { var t0 = 2 * q, b0i = t0 + 1, t1 = t0 + 2, b1i = t0 + 3; idx.push(t0, b0i, t1, t1, b0i, b1i); }
    }
    return { pos: pos, normal: nor, normalSmooth: nor, H: H, slope: sl, index: new Uint32Array(idx) };
  }

  // ------------------------------------------------------------ stars (round 4)
  // Unit directions (Three.js world, site frame) of catalogue stars at a time. rows: [hr, ra, dec (deg, J2000), vmag,
  // b-v, pmRA*cos(dec), pmDec ("/yr)]; F: the engine's Moon body-fixed frame (rows x, y, z in EQJ: LunaEngine._moonFrame);
  // years: time since J2000.0 (proper motion). Annual aberration (< 0.006 deg) and parallax are neglected.
  function starDirs(rows, F, lat, lon, years) {
    var la = lat * DEG, lo = lon * DEG, cl = Math.cos(la), sl = Math.sin(la), co = Math.cos(lo), so = Math.sin(lo);
    var up = [cl * co, cl * so, sl], east = [-so, co, 0], north = [-sl * co, -sl * so, cl];
    // site ENU axes expressed in EQJ (BF axis k in EQJ = F.x[k], F.y[k], F.z[k] columns)
    var ax = function (v) { return [v[0] * F.x[0] + v[1] * F.y[0] + v[2] * F.z[0], v[0] * F.x[1] + v[1] * F.y[1] + v[2] * F.z[1], v[0] * F.x[2] + v[1] * F.y[2] + v[2] * F.z[2]]; };
    var E = ax(east), N = ax(north), U = ax(up), out = new Float32Array(rows.length * 3);
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k], dec = (r[2] + r[6] * years / 3600) * DEG, ra = (r[1] + r[5] * years / 3600 / Math.max(1e-6, Math.cos(r[2] * DEG))) * DEG;
      var u = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
      var e = u[0] * E[0] + u[1] * E[1] + u[2] * E[2], n = u[0] * N[0] + u[1] * N[1] + u[2] * N[2], z = u[0] * U[0] + u[1] * U[1] + u[2] * U[2];
      out[3 * k] = e; out[3 * k + 1] = z; out[3 * k + 2] = -n;     // ENU -> Three.js
    }
    return out;
  }

  // ------------------------------------------------------------ Earth orientation (round 4)
  // Earth-fixed axes (x: 0 deg longitude on the equator, y: 90 deg E, z: north pole) as Three.js world directions at
  // the site, at time 'date' (pass the time light left Earth). Earth's rotation from Astronomy Engine: Greenwich apparent
  // sidereal time (SiderealTime) about the true pole of date, precession-nutation EQD -> EQJ (Rotation_EQD_EQJ); polar
  // motion ignored (< 1e-4 deg). EQJ -> Moon body-fixed with the engine's frame F, then the site's East-North-Up.
  function earthAxes(Astronomy, date, F, lat, lon) {
    var time = Astronomy.MakeTime(date), rot = Astronomy.Rotation_EQD_EQJ(time), g = Astronomy.SiderealTime(time) * 15 * DEG;
    var la = lat * DEG, lo = lon * DEG, cl = Math.cos(la), sl = Math.sin(la), co = Math.cos(lo), so = Math.sin(lo);
    var up = [cl * co, cl * so, sl], east = [-so, co, 0], north = [-sl * co, -sl * so, cl];
    var toWorld = function (v) {
      var q = Astronomy.RotateVector(rot, new Astronomy.Vector(v[0], v[1], v[2], time)), u = [q.x, q.y, q.z];
      var bf = [u[0] * F.x[0] + u[1] * F.x[1] + u[2] * F.x[2], u[0] * F.y[0] + u[1] * F.y[1] + u[2] * F.y[2], u[0] * F.z[0] + u[1] * F.z[1] + u[2] * F.z[2]];
      var e = bf[0] * east[0] + bf[1] * east[1] + bf[2] * east[2], n = bf[0] * north[0] + bf[1] * north[1] + bf[2] * north[2], z = bf[0] * up[0] + bf[1] * up[1] + bf[2] * up[2];
      return [e, z, -n];
    };
    return { x: toWorld([Math.cos(g), Math.sin(g), 0]), y: toWorld([-Math.sin(g), Math.cos(g), 0]), z: toWorld([0, 0, 1]) };
  }
  // Sub-observer point on Earth (geocentric latitude, east longitude, deg) for an observer seeing Earth in direction d.
  function subObserver(ax, d) {
    var o = [-d[0], -d[1], -d[2]], dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
    var lat = Math.asin(Math.max(-1, Math.min(1, dot(o, ax.z)))) / DEG, lon = Math.atan2(dot(o, ax.y), dot(o, ax.x)) / DEG;
    return { lat: lat, lon: lon };
  }

  // ------------------------------------------------------------ Earth phase
  // Illuminated fraction of Earth's disk seen from the site, from the engine's Sun and Earth vectors
  // (az, el, distance). Phase angle = angle at Earth between the directions to the Sun and to the observer.
  function earthPhase(sun, earth) {
    var s = dirFromAzEl(sun.az, sun.el), e = dirFromAzEl(earth.az, earth.el);
    var S = [s[0] * sun.dist_km, s[1] * sun.dist_km, s[2] * sun.dist_km], Ev = [e[0] * earth.dist_km, e[1] * earth.dist_km, e[2] * earth.dist_km];
    var es = [S[0] - Ev[0], S[1] - Ev[1], S[2] - Ev[2]], eo = [-Ev[0], -Ev[1], -Ev[2]];
    var dot = es[0] * eo[0] + es[1] * eo[1] + es[2] * eo[2];
    var ls = Math.sqrt(es[0] * es[0] + es[1] * es[1] + es[2] * es[2]), lo = Math.sqrt(eo[0] * eo[0] + eo[1] * eo[1] + eo[2] * eo[2]);
    var ph = Math.acos(Math.max(-1, Math.min(1, dot / (ls * lo)))) / DEG;
    return { phaseAngle: ph, illuminated: (1 + Math.cos(ph * DEG)) / 2 };
  }

  // ------------------------------------------------- near-field Sun check
  // Is the Sun's centre above the terrain of THIS TILE ONLY, seen from grid (e, n) at eyeH metres above the
  // DEM surface? Steps along the Sun's azimuth to the tile edge (half-cell steps), with exact curvature.
  // Distant terrain (outside the tile) is NOT included: a near-field estimate only.
  function nearFieldSunUp(T, e0, n0, sunAz, sunEl, eyeH) {
    // Sun direction in the site frame -> elevation and azimuth in the local frame at (e0, n0)
    var s0 = Math.sqrt(e0 * e0 + n0 * n0), th = s0 / T.R, az0 = Math.atan2(e0, n0);
    var up = [Math.sin(th) * Math.sin(az0), Math.sin(th) * Math.cos(az0), Math.cos(th)];   // ENU of local up
    var a = sunAz * DEG, el = sunEl * DEG, d = [Math.cos(el) * Math.sin(a), Math.cos(el) * Math.cos(a), Math.sin(el)];
    var sinEl = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
    var hor = [d[0] - sinEl * up[0], d[1] - sinEl * up[1], d[2] - sinEl * up[2]];
    var hl = Math.sqrt(hor[0] * hor[0] + hor[1] * hor[1]) || 1;
    var ue = hor[0] / hl, un = hor[1] / hl;            // step direction in grid coordinates (tile is ~flat at this scale)
    var tanEl = Math.tan(Math.asin(sinEl)), hObs = heightAt(T, e0, n0) + eyeH, step = T.d / 2;
    var maxEl = -90;
    for (var t = step; ; t += step) {
      var e = e0 + ue * t, n = n0 + un * t;
      if (!inside(T, e, n)) break;
      var h = heightAt(T, e, n);
      var ang = Math.atan2(h - hObs - t * t / (2 * T.R), t) / DEG;  // elevation of the terrain point (curvature drop)
      if (ang > maxEl) maxEl = ang;
    }
    var localEl = Math.asin(sinEl) / DEG;
    return { up: localEl > maxEl, localEl: localEl, tileHorizon: maxEl, tanEl: tanEl };
  }

  // Selenographic lat/lon (deg, east-positive) of grid point (e, n) of a tile centred on (lat0, lon0).
  function latLonAt(lat0, lon0, e, n, R) {
    var la = lat0 * DEG, lo = lon0 * DEG, s = Math.sqrt(e * e + n * n), th = s / (R || 1737400);
    var up = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    var east = [-Math.sin(lo), Math.cos(lo), 0];
    var north = [up[1] * east[2] - up[2] * east[1], up[2] * east[0] - up[0] * east[2], up[0] * east[1] - up[1] * east[0]];
    var se = s > 0 ? e / s : 0, sn = s > 0 ? n / s : 0, ct = Math.cos(th), st = Math.sin(th), v = [0, 0, 0];
    for (var k = 0; k < 3; k++) v[k] = ct * up[k] + st * (se * east[k] + sn * north[k]);
    return { lat: Math.asin(v[2]) / DEG, lon: Math.atan2(v[1], v[0]) / DEG };
  }

  return {
    latLonAt: latLonAt, starDirs: starDirs, earthAxes: earthAxes, subObserver: subObserver, nodeOrMesh: nodeOrMesh, buildGridMesh: buildGridMesh, buildSkirt: buildSkirt,
    decodeTile: decodeTile, enu: enu, toThree: toThree, fromThree: fromThree, dirFromAzEl: dirFromAzEl, azElFromDir: azElFromDir,
    heightAt: heightAt, meshHeightAt: meshHeightAt, slopeAt: slopeAt, gridFromWorld: gridFromWorld, groundWorld: groundWorld,
    inside: inside, buildIndex: buildIndex, buildPositions: buildPositions, earthPhase: earthPhase, nearFieldSunUp: nearFieldSunUp
  };
}));
