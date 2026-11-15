#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Prompt 7D: dark "crack" seams between terrain layers in Walk/Rover (display fix).
 * Edges (junctions between nested terrain layers): 5 m patch / 20 m tile (High, 5 m sites), tile / ring A (all
 * qualities), ring A / ring B (High). Sites: the three 5 m sites (peak_shackleton, peak_shackleton_lw,
 * shackleton_centre) and two 20 m sites (mons_malapert, mons_mouton), each at a time with the Sun up; Low, Medium, High;
 * laptop 1440 x 900, plus an emulated phone (390 x 844, automatic quality).
 *  1 Height step along every edge (statistics): "slit" = height of each fine-edge vertex minus the straight coarse edge
 *    between the two coarse edge vertices around it (the opening at the T-junctions), and "product" = fine height minus
 *    the coarse product's own DEM height at the same point.
 *  2 Seam darkness: Walk views looking along the edge (both directions) and across it (from each side), and a Rover view
 *    (patch and tile edges: the rover stays on the tile), shadows off and on. Every visible edge point (depth test
 *    against a terrain-only depth pass) within 1.5 km is projected; across the projected edge the luminance profile is
 *    read: band = mean of the 3 pixels on the edge, sides = means of pixels 5-12 px to either side (ground only, no sky,
 *    the darker side at least MIN_LUM, side pixels at about the edge point's distance, i.e. not across a ridge line, and
 *    each side even: its range within its own mean, i.e. the edge does not run along a lit/unlit boundary of the terrain;
 *    and the edge point's own ground lit by the Sun: cos i >= 0.05 from the finer grid's heights).
 *    r = band / darker side, rHi = band / brighter side, black = fraction of points with r < 0.5 (darkPx, reported:
 *    fraction whose darkest band pixel is below half the darker side). The same measurement on parallel "control" lines
 *    2 coarse cells inside and outside each edge shows how ordinary ground scores.
 *    PASS per site, quality, edge and shadow setting (all views together; at least MIN_N points): median r >= 0.85 and
 *    median rHi <= 1.15 (the band within 15 % of the ground on both sides), p05 of r >= 0.80, black <= 0.5 %, darkPx
 *    <= 2 %. Chosen from the measurements (ROUND6_REPORT.md, Prompt 7D): the build before the fix had p05 0.39-0.72 and
 *    darkPx 8-44 % on every edge, the fixed build p05 >= 0.84 and darkPx 0 %; ordinary ground (control lines) p05
 *    0.71-0.99 with a few exceptions on rough Low-quality ground.
 *    Walk and Rover stay on the 6 km tile (as for the user), so the tile edge is seen from inside the tile and the ring A
 *    / ring B edge (16 km) from a low Orbit camera (700 m, 7 deg pitch), which every edge also gets.
 *  3 What must not change (compared with the build before the fix, docs/ground_detail/seams/invariants_before.json, or
 *    with --before <checkout>): vertex positions and heights (aH) of every top surface (tile, 5 m patch, ring A, ring B;
 *    hash of the Float32 values), inspection readouts at fixed pixels of fixed views and at the owner's inspected point
 *    (-88.8164, 126.0967 E) from the owner's custom point (-88.8095, 125.7699 E), rover pose and readout, status tiles,
 *    Sun/Earth directions and readouts.
 *  4 With --before <checkout>: Orbit pictures (60 km, 9 km, 3 km) of both builds differ only along the seams (every
 *    pixel whose luminance changed by more than 6 lies within 4 px x pixel ratio of a projected layer edge).
 *  5 Performance (Medium, peak_shackleton): warm first frame < 1.5 s; orbit, Walk and Rover >= 30 frames/s.
 *  6 No console errors.
 * Screenshots: docs/ground_detail/seams/<tag>_*.jpg (the owner's view and an along / across view per edge).
 *   node tests/ui_seams.js [--root <checkout>] [--tag after] [--before <checkout of the build before>]
 *        [--write-invariants] [--measure-only] [--sites a,b] [--quality low,medium,high] [--no-phone] [--no-perf]
 * --root: test another checkout (used with --tag before --measure-only --write-invariants on the build before the fix). */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), url = require('url');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const has = k => process.argv.includes(k);
const ROOT = arg('--root') ? path.resolve(arg('--root')) : path.join(__dirname, '..');
const TAG = arg('--tag') || 'after';
const BEFORE = arg('--before') ? path.resolve(arg('--before')) : null;
const MEASURE_ONLY = has('--measure-only');
const OUT = path.join(__dirname, '..', 'docs', 'ground_detail', 'seams'); fs.mkdirSync(OUT, { recursive: true });
const TOL = 0.15, P05_MIN = 0.80, BLACK_MAX = 0.005, DARKPX_MAX = 0.02, MIN_LUM = 12, MIN_N = 20;
const seamOK = s => s.r >= 1 - TOL && s.rHi <= 1 + TOL && s.p05 >= P05_MIN && s.black <= BLACK_MAX && s.darkPx <= DARKPX_MAX;
const RULE = `median r >= ${1 - TOL}, median rHi <= ${1 + TOL}, p05 r >= ${P05_MIN}, black <= ${100 * BLACK_MAX} %, darkPx <= ${100 * DARKPX_MAX} %`;
const CASES = [
  { site: 'peak_shackleton', t: '2028-09-25T10:04', p5: true },
  { site: 'peak_shackleton_lw', t: '2028-09-25T10:04', p5: true },
  { site: 'shackleton_centre', t: '2028-09-25T10:04', p5: true },
  { site: 'mons_malapert', t: '2028-09-28T03:00', p5: false },
  { site: 'mons_mouton', t: '2028-09-23T19:00', p5: false }
].filter(c => !arg('--sites') || arg('--sites').split(',').includes(c.site));
const QUALS = (arg('--quality') || 'low,medium,high').split(',');
const OWNER = { hash: '#lat=-88.8095&lon=125.7699&t=2028-09-25T10:04Z&w=1', inspect: [-88.8164, 126.0967] };
const HIDE = '.v3d-mini,.v3d-hud,.v3d-labels,.v3d-feat,.v3d-msgs,.v3d-shadownote,#v3dPad,.v3d-exag,.v3d-qnote,.v3d-close,.v3d-relief-note,#v3dInspect,#v3dInspMark,.v3d-lbl,#v3dAboutBtn{visibility:hidden!important}';
let fails = 0;
const expect = (name, ok, info) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? ' - ' + String(info).slice(0, 700) : '')); if (!ok) fails++; };

// ------------------------------------------------------------------ in-page helpers
const PAGE_LIB = `window.__SEAM = (function () {
  var M = window.AsteriaView3DMath;
  function edges(s) {
    var out = [];
    if (s.TM.patch) out.push({ name: 'patch/tile', F: s.TM.patch, C: s.TM, h: s.TM.patch.half, prod: Object.assign({}, s.T, { patch: null }) });
    if (s.ringA) out.push({ name: 'tile/ringA', F: s.TM, C: s.ringA, h: s.TM.half, prod: s.gridA });
    if (s.ringBG) out.push({ name: 'ringA/ringB', F: s.ringA, C: s.ringBG, h: s.ringA.half, prod: s.gridB });
    return out;
  }
  function onSide(side, h, u) { return side === 0 ? [u, h] : side === 1 ? [h, -u] : side === 2 ? [-u, -h] : [-h, u]; }
  var OUT_AZ = [0, 90, 180, 270], ALONG_AZ = [90, 180, 270, 0];
  function stats(a) {
    if (!a.length) return { n: 0 };
    var s = a.slice().sort(function (x, y) { return Math.abs(x) - Math.abs(y); }), n = a.length, m = 0, q = 0;
    a.forEach(function (x) { m += x; q += x * x; });
    m /= n;
    return { n: n, mean: +m.toFixed(3), sd: +Math.sqrt(Math.max(0, q / n - m * m)).toFixed(3), rms: +Math.sqrt(q / n).toFixed(3), p95abs: +Math.abs(s[Math.floor(0.95 * (n - 1))]).toFixed(3), maxAbs: +Math.abs(s[n - 1]).toFixed(3) };
  }
  // height steps along every drawn edge (true heights, m)
  function steps() {
    var s = AsteriaView3D.testScene();
    return edges(s).map(function (E) {
      var F = E.F, C = E.C, h = E.h, slit = [], prod = [], nf = Math.round(2 * h / F.d);
      for (var side = 0; side < 4; side++) for (var k = 0; k < nf; k++) {
        var u = -h + k * F.d, en = onSide(side, h, u), hf = M.nodeOrMesh(F, en[0], en[1]);
        if (E.prod) prod.push(hf - M.heightAt(E.prod, en[0], en[1]));
        var j = Math.floor((u + h) / C.d + 1e-9), u0 = -h + j * C.d, w = (u - u0) / C.d;
        if (w < 1e-9) continue;   // fine vertex on a coarse vertex: shared, no opening
        var a = onSide(side, h, u0), b = onSide(side, h, u0 + C.d);
        slit.push(hf - (M.nodeOrMesh(F, a[0], a[1]) * (1 - w) + M.nodeOrMesh(F, b[0], b[1]) * w));
      }
      return { edge: E.name, fine_m: F.d, coarse_m: C.d, slit: stats(slit), product: stats(prod) };
    });
  }
  // camera pose for a view of edge 'name': kind = along1 | along2 | acrossF | acrossC | rover
  function pose(name, kind) {
    var s = AsteriaView3D.testScene(), d = AsteriaView3D.debug(), E = edges(s).filter(function (x) { return x.name === name; })[0];
    if (!E) return null;
    // the place on the edge where the ground on both sides faces the Sun best (mean cos i over +-60 m along the edge,
    // 20 m inside and outside), so the seam is seen against lit ground
    var h = E.h, Ld = M.dirFromAzEl(d.instant.sun.az, Math.max(d.instant.sun.el, 0)), side = 0, u0 = 0, best = -9;
    var cosi = function (G, e, n) { var dd = G.d, gx = (M.heightAt(G, e + dd, n) - M.heightAt(G, e - dd, n)) / (2 * dd), gy = (M.heightAt(G, e, n + dd) - M.heightAt(G, e, n - dd)) / (2 * dd), l = Math.sqrt(gx * gx + 1 + gy * gy); return (-gx * Ld[0] + Ld[1] + gy * Ld[2]) / l; };
    for (var sd = 0; sd < 4; sd++) for (var uu = -0.8 * h; uu <= 0.8 * h; uu += 0.04 * h) {
      var ov = [[0, 1], [1, 0], [0, -1], [-1, 0]][sd], sc = 0, nsc = 0;
      for (var a2 = -60; a2 <= 60; a2 += 20) { var en0 = onSide(sd, h, uu + a2); sc += Math.min(cosi(E.F, en0[0] - 20 * ov[0], en0[1] - 20 * ov[1]), cosi(E.C, en0[0] + 20 * ov[0], en0[1] + 20 * ov[1])); nsc++; }
      if (sc / nsc > best) { best = sc / nsc; side = sd; u0 = uu; }
    }
    var outv = [[0, 1], [1, 0], [0, -1], [-1, 0]][side];
    var at = function (off) {   // world x, z of the point 'off' metres outward from the edge point (negative = inside)
      var en = onSide(side, h, u0), e = en[0] + outv[0] * off, n = en[1] + outv[1] * off, G = off < 0 ? E.F : E.C;
      var p = M.toThree(M.enu(G, e, n, M.heightAt(G, e, n))); return { x: p[0], z: p[2] };
    };
    var oa = OUT_AZ[side], la = ALONG_AZ[side];
    // Walk and Rover stay on the 6 km tile (as for the user: walking is clamped to the tile, the rover drives on it), so
    // the ring A / ring B edge (16 km) is checked from a low Orbit camera only, and the tile edge from inside the tile
    var lim = s.TM.half - s.TM.d, onTile = function (off) { var en = onSide(side, h, u0); return Math.max(Math.abs(en[0] + outv[0] * off), Math.abs(en[1] + outv[1] * off)) <= lim; };
    if (kind === 'orbit') { var pc = at(0), en1 = onSide(side, h, u0), hy = M.toThree(M.enu(E.F, en1[0], en1[1], M.heightAt(E.F, en1[0], en1[1])))[1]; return { orbit: { target: [pc.x, hy, pc.z], dist: 700, pitch: 7, yaw: (la + 210) % 360 } }; }
    if (E.name === 'ringA/ringB') return null;
    var offA = onTile(3) ? 3 : -(s.TM.d + 2);
    if (kind === 'along1') { var q1 = at(offA); return { walk: { x: q1.x, z: q1.z, yaw: la, pitch: -6 } }; }
    if (kind === 'along2') { var q2 = at(offA); return { walk: { x: q2.x, z: q2.z, yaw: (la + 180) % 360, pitch: -6 } }; }
    if (kind === 'acrossC' && !onTile(30)) return null;
    if (kind === 'along1') { var p1 = at(3); return { walk: { x: p1.x, z: p1.z, yaw: la, pitch: -6 } }; }
    if (kind === 'along2') { var p2 = at(3); return { walk: { x: p2.x, z: p2.z, yaw: (la + 180) % 360, pitch: -6 } }; }
    if (kind === 'acrossF') { var p3 = at(-30); return { walk: { x: p3.x, z: p3.z, yaw: oa, pitch: -4 } }; }
    if (kind === 'acrossC') { var p4 = at(30); return { walk: { x: p4.x, z: p4.z, yaw: (oa + 180) % 360, pitch: -4 } }; }
    var p5 = at(-8); return { rov: { x: p5.x, z: p5.z, yaw: (la + 25) % 360, dist: 1, camYaw: 0, lastX: p5.x, lastZ: p5.z, ptStart: true } };
  }
  // the rendered picture and a terrain-only depth pass (RGBA-packed NDC depth; 0 = nothing drawn = sky)
  function grab() {
    var s = AsteriaView3D.testScene(), R = s.renderer, gl = R.getContext(), THREE = window.THREE;
    R.render(s.scene, s.camera);
    var W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    var rt = new THREE.WebGLRenderTarget(W, H), mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    var keep = function (o) { if (o === s.terrainGroup) return true; var f = false; o.traverse(function (c) { if (c === s.roverBody) f = true; }); return f; };
    var vis = s.scene.children.map(function (o) { var v = o.visible; o.visible = keep(o) && v; return v; });
    var bg = s.scene.background, oc = new THREE.Color(), oa = R.getClearAlpha(); R.getClearColor(oc);
    s.scene.background = null; R.setClearColor(0x000000, 0); s.scene.overrideMaterial = mat;
    R.setRenderTarget(rt); R.clear(); R.render(s.scene, s.camera);
    var dp = new Uint8Array(W * H * 4); R.readRenderTargetPixels(rt, 0, 0, W, H, dp);
    R.setRenderTarget(null); s.scene.overrideMaterial = null; R.setClearColor(oc, oa); s.scene.background = bg;
    s.scene.children.forEach(function (o, i) { o.visible = vis[i]; });
    rt.dispose(); mat.dispose(); R.render(s.scene, s.camera);
    return { W: W, H: H, px: px, dp: dp };
  }
  // luminance profiles across every visible drawn edge point within maxDist
  function profiles(G, maxDist, minLum) {
    var s = AsteriaView3D.testScene(), cam = s.camera, THREE = window.THREE, W = G.W, H = G.H, nr = cam.near, fr = cam.far;
    cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    var L = function (x, y) { var o = 4 * (y * W + x); return 0.2126 * G.px[o] + 0.7152 * G.px[o + 1] + 0.0722 * G.px[o + 2]; };
    var D = function (x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return Infinity;
      var o = 4 * (y * W + x), d = G.dp; if (!(d[o] | d[o + 1] | d[o + 2] | d[o + 3])) return Infinity;
      var v = (255 / 256) * (d[o] / 255 / 16777216 + d[o + 1] / 255 / 65536 + d[o + 2] / 255 / 256 + d[o + 3] / 255), nd = 2 * v - 1;
      return 2 * fr * nr / ((fr + nr) - nd * (fr - nr));
    };
    var V = new THREE.Vector3(), res = {}, dbg = AsteriaView3D.debug(), Ls = M.dirFromAzEl(dbg.instant.sun.az, dbg.instant.sun.el);
    // cos i of grid F's own ground at (e, n) (differences over one cell, kept inside F): an edge point on ground that the
    // Sun does not light (a slope facing away) is dark in the data itself, whatever the seam does - not judged
    var cosi = function (F, e, n) {
      var d0 = F.d, c = function (x) { return Math.max(-F.half, Math.min(F.half, x)); }, e1 = c(e + d0), e0 = c(e - d0), n1 = c(n + d0), n0 = c(n - d0);
      var gx = (M.heightAt(F, e1, n) - M.heightAt(F, e0, n)) / (e1 - e0), gy = (M.heightAt(F, e, n1) - M.heightAt(F, e, n0)) / (n1 - n0), l = Math.sqrt(gx * gx + 1 + gy * gy);
      return (-gx * Ls[0] + Ls[1] + gy * Ls[2]) / l;
    };
    var proj = function (F, en) { var p = M.toThree(M.enu(F, en[0], en[1], M.meshHeightAt(F, en[0], en[1]))); V.set(p[0], p[1], p[2]); var z = -V.clone().applyMatrix4(cam.matrixWorldInverse).z; V.project(cam); return { x: (V.x + 1) / 2 * W, y: (V.y + 1) / 2 * H, z: z, p: p }; };
    var lines = [];
    edges(s).forEach(function (E) {
      lines.push({ name: E.name, F: E.F, h: E.h });
      lines.push({ name: E.name + ' control', F: E.F, h: E.h - 2 * E.C.d });
      lines.push({ name: E.name + ' control', F: E.C, h: E.h + 2 * E.C.d, outer: true });
    });
    lines.forEach(function (E) {
      var F = E.F, h = E.h, out = res[E.name] || [];
      if (E.outer && h > F.half) return;
      for (var side = 0; side < 4; side++) {
        var u = -h;
        while (u <= h) {
          var uc = u, en = onSide(side, h, uc), q = proj(F, en);
          var dist = Math.hypot(q.p[0] - cam.position.x, q.p[1] - cam.position.y, q.p[2] - cam.position.z);
          u += Math.min(50, Math.max(0.5, dist / 120));
          if (dist > maxDist || dist < 2 || q.z <= 0) continue;
          if (cosi(F, en[0], en[1]) < 0.05) continue;
          if (q.x < 16 || q.y < 16 || q.x >= W - 16 || q.y >= H - 16) continue;
          var xi = Math.round(q.x), yi = Math.round(q.y), db = D(xi, yi);
          if (db < q.z - Math.max(0.5, 0.01 * q.z)) continue;   // hidden behind nearer ground (farther or nothing = a gap: kept)
          var q2 = proj(F, onSide(side, h, Math.min(h, uc + 1)));
          if (uc + 1 > h) q2 = proj(F, onSide(side, h, uc - 1)), q2 = { x: 2 * q.x - q2.x, y: 2 * q.y - q2.y };
          var tx = q2.x - q.x, ty = q2.y - q.y, tl = Math.hypot(tx, ty); if (tl < 1e-6) continue;
          var nx = -ty / tl, ny = tx / tl, prof = [], sky = false;
          for (var k = -12; k <= 12; k++) {
            var xx = Math.round(q.x + k * nx), yy = Math.round(q.y + k * ny);
            // the band itself may show the background (a crack); the sides must be ground at about the edge point's
            // distance (not sky, not terrain far behind a ridge line that the profile crosses)
            if (Math.abs(k) >= 5 && !(Math.abs(D(xx, yy) - q.z) <= 0.2 * q.z + 2)) { sky = true; break; }
            prof.push(L(xx, yy));
          }
          if (sky) continue;
          var mean = function (a, b) { var t = 0; for (var kk = a; kk <= b; kk++) t += prof[kk + 12]; return t / (b - a + 1); };
          var sA = mean(-12, -5), sB = mean(5, 12), band = mean(-1, 1), bmin = Math.min(prof[10], prof[11], prof[12], prof[13], prof[14]);
          var lo = Math.min(sA, sB), hi = Math.max(sA, sB);
          if (lo < minLum) continue;
          // each side must be even ground (range within the side's own mean): where the edge runs along a sharp lit /
          // unlit boundary of the terrain itself (a thin sunlit crest seen at a grazing angle), the band says nothing
          var rng = function (a, b) { var mn = 1e9, mx = -1e9; for (var kk = a; kk <= b; kk++) { mn = Math.min(mn, prof[kk + 12]); mx = Math.max(mx, prof[kk + 12]); } return mx - mn; };
          if (rng(-12, -5) > sA || rng(5, 12) > sB) continue;
          out.push([+(band / lo).toFixed(4), +(bmin / lo).toFixed(4), +(band / hi).toFixed(4), Math.round(dist), xi, yi, Math.round(lo), Math.round(hi), Math.round(band)]);
        }
      }
      res[E.name] = out;
    });
    return res;
  }
  // screen mask of all drawn layer edges (for the Orbit difference check): Uint8Array W x H, 1 within r px of an edge
  function edgeMask(W, H, r) {
    var s = AsteriaView3D.testScene(), cam = s.camera, THREE = window.THREE, mask = new Uint8Array(W * H), V = new THREE.Vector3();
    var grids = [s.TM.patch, s.TM, s.ringA, s.ringBG].filter(Boolean);
    grids.forEach(function (F) {
      var h = F.half;
      for (var side = 0; side < 4; side++) {
        var prev = null;
        for (var u = -h; u <= h + 1e-6; u += Math.max(F.d / 4, 2)) {
          var en = onSide(side, h, Math.min(u, h)), p = M.toThree(M.enu(F, en[0], en[1], M.meshHeightAt(F, en[0], en[1])));
          V.set(p[0], p[1], p[2]).project(cam);
          var cur = V.z < 1 ? { x: (V.x + 1) / 2 * W, y: (V.y + 1) / 2 * H } : null;
          if (cur && prev) {
            var n = Math.ceil(Math.hypot(cur.x - prev.x, cur.y - prev.y)) + 1;
            if (n < 4 * (W + H)) for (var t = 0; t <= n; t++) {
              var x = Math.round(prev.x + (cur.x - prev.x) * t / n), y = Math.round(prev.y + (cur.y - prev.y) * t / n);
              for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) { var X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) mask[Y * W + X] = 1; }
            }
          }
          prev = cur;
        }
      }
    });
    return mask;
  }
  return { edges: edges, steps: steps, pose: pose, grab: grab, profiles: profiles, edgeMask: edgeMask };
})();`;

// ------------------------------------------------------------------ helpers (node side)
async function openPage(browser, root, hash, q, phone) {
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(q => { window.ASTERIA_V3D_NOPROBE = true; try { localStorage.setItem('asteria.hintDismissed', '1'); localStorage.setItem('asteria.spotlightShown', '1'); localStorage.setItem('asteria.tourOffered', '1'); if (q) localStorage.setItem('asteria.v3dQuality', q); else localStorage.removeItem('asteria.v3dQuality'); } catch (e) { /* */ } }, q || null);
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(url.pathToFileURL(path.join(root, 'index.html')).href + hash);
  await page.waitForFunction(() => window.AsteriaApp && AsteriaApp.state.series && AsteriaApp.state.site && AsteriaApp.state.seriesSite === AsteriaApp.state.site, null, { timeout: 90000 });
  await page.evaluate(() => AsteriaApp.ready());
  await page.evaluate(() => AsteriaApp.openDeploy());
  await page.waitForFunction(() => window.AsteriaView3D && AsteriaView3D.debug().open && !AsteriaView3D.debug().refining && AsteriaView3D.debug().frames > 2, null, { timeout: 120000 });
  await page.addStyleTag({ content: HIDE });
  await page.evaluate(PAGE_LIB);
  return { ctx, page, errs };
}
const settle = async (page, ms) => {
  await page.waitForFunction(() => { const a = AsteriaView3D.debug().ao; return !a || !a.busy; }, null, { timeout: 60000 });
  await page.waitForTimeout(ms || 900);
};
const setShadows = (page, on) => page.evaluate(on => { const c = document.getElementById('v3dShadows'); if (c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change')); } }, on);
async function setView(page, v) {
  await page.evaluate(v => {
    if (v.mode) AsteriaView3D.testMode(v.mode);
    if (v.walk) AsteriaView3D.testCamera({ walk: v.walk });
    if (v.rov) AsteriaView3D.testCamera({ rov: v.rov });
    if (v.orbit) AsteriaView3D.testCamera(v.orbit);
  }, v);
}
const shot = async (page, file) => { const cv = await page.$('#v3dStage canvas'); await cv.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 85 }); };
const median = a => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const summary = rows => ({ n: rows.length, r: +median(rows.map(x => x[0])).toFixed(3), rHi: +median(rows.map(x => x[2])).toFixed(3), black: +(rows.filter(x => x[0] < 0.5).length / Math.max(1, rows.length)).toFixed(4), darkPx: +(rows.filter(x => x[1] < 0.5).length / Math.max(1, rows.length)).toFixed(4), bright: +(rows.filter(x => x[2] > 1.3).length / Math.max(1, rows.length)).toFixed(4), p05: rows.length ? +rows.map(x => x[0]).sort((a, b) => a - b)[Math.floor(0.05 * (rows.length - 1))].toFixed(3) : null });

// invariants of one open view (what the fix must not change)
const INV = () => {
  const s = AsteriaView3D.testScene(), d = AsteriaView3D.debug();
  const hash = arr => { let h1 = 2166136261 >>> 0; const u = new Uint32Array(arr.buffer, arr.byteOffset, arr.length); for (let k = 0; k < u.length; k++) h1 = Math.imul(h1 ^ u[k], 16777619) >>> 0; return h1.toString(16) + '/' + u.length; };
  const geo = { tile: hash(s.geo.attributes.position.array), tileH: hash(s.geo.attributes.aH.array), tileSlope: hash(s.geo.attributes.aS.array) };
  s.layers.forEach(L => { if (/skirt|seam/.test(L.name)) return; geo[L.name] = hash(L.mesh.geometry.attributes.position.array); geo[L.name + 'H'] = hash(L.mesh.geometry.attributes.aH.array); });
  const st = document.getElementById('v3dStage').getBoundingClientRect(), insp = [];
  for (const fy of [0.55, 0.7, 0.85]) for (const fx of [0.25, 0.5, 0.75]) {
    const r = AsteriaView3D.testInspect(st.left + st.width * fx, st.top + st.height * fy);
    insp.push(r ? [r.h, r.slope, r.lat, r.lon, r.dist, r.d, r.area, r.product, r.drawn, r.x, r.y, r.z].map(x => typeof x === 'number' ? +x.toPrecision(12) : x) : null);
  }
  AsteriaView3D.testInspect(-10, -10);
  const txt = id => { const e = document.getElementById(id); return e ? e.textContent : null; };
  return {
    geo, insp,
    tiles: [txt('v3dSun'), txt('v3dEarth'), txt('v3dSunX'), txt('v3dEarthX'), document.getElementById('v3dTileSun').className, document.getElementById('v3dTileEarth').className, txt('v3dTime')],
    sunLightDir: d.sunLightDir.map(x => +x.toPrecision(12)), sunIntensity: d.sunIntensity, earthDir: d.earthDir.map(x => +x.toPrecision(12)), earthAzEl: d.earthAzEl,
    camera: d.camera.map(x => +x.toPrecision(10)), eye: +d.eyeAboveGround.toPrecision(10),
    rover: d.mode === 'rover' && d.rover ? JSON.stringify(d.rover) : null, roverReadout: d.mode === 'rover' ? txt('v3dRover') : null
  };
};
function diff(a, b, p, list) {
  if (typeof a !== typeof b || (a === null) !== (b === null)) { list.push(p + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); return; }
  if (a && typeof a === 'object') { new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => diff(a[k], b[k], p + '.' + k, list)); return; }
  if (a !== b) list.push(p + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
}

// ------------------------------------------------------------------ 1-2: steps and seam darkness, 3: invariants
async function measureAll(browser, root, tag) {
  const meas = { tag, steps: {}, groups: {}, views: [] }, inv = {}, errsAll = [];
  for (const c of CASES) for (const q of QUALS) {
    const { ctx, page, errs } = await openPage(browser, root, `#site=${c.site}&t=${c.t}Z&w=1`, q);
    const key = c.site + '/' + q;
    meas.steps[key] = await page.evaluate(() => __SEAM.steps());
    const edgeNames = meas.steps[key].map(e => e.edge);
    // invariants: Orbit (default framing), Walk at the site marker, Rover default
    inv[key] = {};
    for (const [vn, v] of [['orbit', { mode: 'orbit', orbit: { dist: 9000, pitch: 30, yaw: 200 } }], ['walk', { mode: 'walk', walk: { x: 0, z: 0, yaw: 120, pitch: -2 } }], ['rover', { mode: 'rover' }]]) {
      await setView(page, v); await page.waitForTimeout(600);
      inv[key][vn] = await page.evaluate(INV);
    }
    for (const sh of [false, true]) {
      await setShadows(page, sh);
      for (const en of edgeNames) for (const kind of ['along1', 'along2', 'acrossF', 'acrossC', 'rover', 'orbit']) {
        const pose = await page.evaluate(([en, kind]) => __SEAM.pose(en, kind), [en, kind]);
        if (!pose) continue;   // not reachable in Walk / Rover (outside the 6 km tile)
        await setView(page, Object.assign({ mode: kind === 'rover' ? 'rover' : kind === 'orbit' ? 'orbit' : 'walk' }, pose));
        await settle(page, 1000);
        const prof = await page.evaluate(() => { const G = __SEAM.grab(); return __SEAM.profiles(G, 1500, 12); });
        for (const e2 of Object.keys(prof)) {
          const gk = `${c.site}|${q}|${e2}|${sh ? 'shadows' : 'noshadows'}`;
          (meas.groups[gk] = meas.groups[gk] || []).push(...prof[e2]);
        }
        const sm = summary(prof[en] || []);
        meas.views.push({ site: c.site, q, edge: en, kind, shadows: sh, n: sm.n, r: sm.r, rHi: sm.rHi, black: sm.black, blackPts: (prof[en] || []).filter(x => x[0] < 0.5).slice(0, 12) });
        if (!sh && (kind === 'along1' || kind === 'acrossF' || kind === 'rover' || (kind === 'orbit' && en === 'ringA/ringB')) && q === 'high')
          await shot(page, `${tag}_${c.site}_${q}_${en.replace('/', '-')}_${kind}.jpg`);
      }
    }
    errsAll.push(...errs.map(e => key + ': ' + e));
    await ctx.close();
  }
  // the owner's view: Walk at the owner's custom point, facing the inspected point (on the 5 m patch's east edge)
  for (const q of QUALS) {
    const { ctx, page, errs } = await openPage(browser, root, OWNER.hash, q);
    const key = 'owner/' + q;
    inv[key] = {};
    const ow = await page.evaluate(ip => {
      const d = AsteriaView3D.debug(), h = AsteriaApp.host3D(ip[0], ip[1]), s = AsteriaView3D.testScene(), M = window.AsteriaView3DMath;
      const G = s.TM, p = M.toThree(M.enu(G, h.e, h.n, M.meshHeightAt(G, h.e, h.n)));
      const az = Math.atan2(p[0] - d.point.x, -(p[2] - d.point.z)) * 180 / Math.PI;
      return { x: d.point.x, z: d.point.z, az: (az + 360) % 360, target: p };
    }, OWNER.inspect);
    await setView(page, { mode: 'walk', walk: { x: ow.x, z: ow.z, yaw: ow.az, pitch: -3 } });
    await settle(page, 1200);
    inv[key].walk = await page.evaluate(INV);
    // inspection readout at the owner's inspected point (projected to the screen)
    inv[key].ownerInspect = await page.evaluate(p => {
      const s = AsteriaView3D.testScene(), V = new THREE.Vector3(p[0], p[1], p[2]).project(s.camera), st = document.getElementById('v3dStage').getBoundingClientRect();
      const r = AsteriaView3D.testInspect(st.left + (V.x + 1) / 2 * st.width, st.top + (1 - V.y) / 2 * st.height); AsteriaView3D.testInspect(-10, -10);
      return r ? [r.h, r.slope, r.lat, r.lon, r.dist, r.d, r.area, r.product, r.drawn].map(x => typeof x === 'number' ? +x.toPrecision(12) : x) : null;
    }, ow.target);
    for (const sh of [false, true]) {
      await setShadows(page, sh); await settle(page, 1200);
      await shot(page, `${tag}_owner_view_${q}${sh ? '_shadows' : ''}.jpg`);
      const prof = await page.evaluate(() => { const G = __SEAM.grab(); return __SEAM.profiles(G, 1500, 12); });
      for (const e2 of Object.keys(prof)) { const gk = `owner|${q}|${e2}|${sh ? 'shadows' : 'noshadows'}`; (meas.groups[gk] = meas.groups[gk] || []).push(...prof[e2]); }
      // close-up along the edge near the inspected point (3 m outside the patch, looking south and north)
      if (q === 'high' && !sh) for (const [nm, yaw] of [['closeup_s', 175], ['closeup_n', 355]]) {
        await setView(page, { mode: 'walk', walk: { x: 1003, z: 600, yaw, pitch: -8 } }); await settle(page, 1200);
        await shot(page, `${tag}_owner_${nm}_${q}.jpg`);
        const p2 = await page.evaluate(() => { const G = __SEAM.grab(); return __SEAM.profiles(G, 1500, 12); });
        for (const e2 of Object.keys(p2)) { const gk = `owner|${q}|${e2}|noshadows`; (meas.groups[gk] = meas.groups[gk] || []).push(...p2[e2]); }
        await setView(page, { mode: 'walk', walk: { x: ow.x, z: ow.z, yaw: ow.az, pitch: -3 } });
      }
    }
    await setView(page, { mode: 'rover' }); await page.waitForTimeout(700);
    inv[key].rover = await page.evaluate(INV);
    errsAll.push(...errs.map(e => key + ': ' + e));
    await ctx.close();
  }
  meas.summary = {};
  Object.keys(meas.groups).forEach(k => { meas.summary[k] = summary(meas.groups[k]); });
  return { meas, inv, errs: errsAll };
}

// ------------------------------------------------------------------ 4: Orbit pictures change only along the seams
async function orbitPixels(browser, root, c, q) {
  const { ctx, page, errs } = await openPage(browser, root, `#site=${c.site}&t=${c.t}Z&w=1`, q);
  const out = [];
  for (const [vn, o] of [['orbit60', { dist: 60000, pitch: 40, yaw: 200 }], ['orbit9', { dist: 9000, pitch: 30, yaw: 200 }], ['orbit3', { dist: 3000, pitch: 25, yaw: 200 }]]) {
    await setView(page, { mode: 'orbit', orbit: Object.assign({ target: [0, 0, 0] }, o) }); await settle(page, 1200);
    out.push(await page.evaluate(() => { const G = __SEAM.grab(); const pr = AsteriaView3D.testScene().renderer.getPixelRatio(); const m = __SEAM.edgeMask(G.W, G.H, Math.ceil(4 * pr)); let b = ''; for (let i = 0; i < G.px.length; i += 8192) b += String.fromCharCode.apply(null, G.px.subarray(i, i + 8192)); let mb = ''; for (let i = 0; i < m.length; i += 8192) mb += String.fromCharCode.apply(null, m.subarray(i, i + 8192)); return { W: G.W, H: G.H, px: btoa(b), mask: btoa(mb) }; }));
  }
  await ctx.close();
  return { views: out, errs };
}

(async () => {
  const browser = await chromium.launch({ args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [] });
  console.log(`ui_seams: ${TAG} build at ${ROOT}`);
  const { meas, inv, errs } = await measureAll(browser, ROOT, TAG);
  fs.writeFileSync(path.join(OUT, `measurements_${TAG}.json`), JSON.stringify({ steps: meas.steps, summary: meas.summary, views: meas.views }, null, 1));
  if (has('--write-invariants')) fs.writeFileSync(path.join(OUT, `invariants_${TAG}.json`), JSON.stringify(inv, null, 1));

  // 1 height steps (report)
  for (const k of Object.keys(meas.steps)) for (const e of meas.steps[k])
    console.log(`steps ${k.padEnd(26)} ${e.edge.padEnd(12)} (${e.fine_m} m / ${e.coarse_m} m): slit n ${e.slit.n} mean ${e.slit.mean} sd ${e.slit.sd} p95|.| ${e.slit.p95abs} max|.| ${e.slit.maxAbs} m; product n ${e.product.n} mean ${e.product.mean} sd ${e.product.sd} rms ${e.product.rms} max|.| ${e.product.maxAbs} m`);
  // 2 seam darkness
  for (const k of Object.keys(meas.summary).sort()) {
    const s = meas.summary[k];
    const line = `seam ${k.padEnd(52)} n ${String(s.n).padStart(5)}  r ${s.r}  rHi ${s.rHi}  p05 ${s.p05}  black ${(100 * s.black).toFixed(2)} %  darkPx ${(100 * s.darkPx).toFixed(2)} %  bright ${(100 * s.bright).toFixed(2)} %`;
    if (MEASURE_ONLY || / control\|/.test(k)) { console.log(line + (/ control\|/.test(k) && !MEASURE_ONLY ? '  (ordinary ground: parallel lines 2 coarse cells inside and outside the edge, for comparison)' : '')); continue; }
    if (s.n < MIN_N) { console.log(line + '  (too few lit edge points to judge)'); continue; }
    expect(line + ` (${RULE})`, seamOK(s));
  }
  if (!MEASURE_ONLY) {
    // coverage: every edge type judged at every site/quality where it is drawn, and every quality
    const judged = new Set(Object.keys(meas.summary).filter(k => meas.summary[k].n >= MIN_N).map(k => k.split('|').slice(0, 3).join('|')));
    // edges a user can reach in Walk / Rover (the ring A / ring B edge at 16 km is seen only from Orbit: judged when its
    // low Orbit view has enough lit points, not required)
    const want = []; Object.keys(meas.steps).forEach(k => { const [site, q] = k.split('/'); meas.steps[k].forEach(e => { if (e.edge !== 'ringA/ringB') want.push(`${site}|${q}|${e.edge}`); }); });
    const miss = want.filter(w => !judged.has(w));
    expect(`seam coverage: ${want.length - miss.length}/${want.length} site/quality combinations of the Walk/Rover edges (patch/tile, tile/ringA) had at least ${MIN_N} lit edge points (shadows off or on)`, miss.length <= Math.floor(0.1 * want.length) && QUALS.every(q => [...judged].some(j => j.split('|')[1] === q)), miss.join(', '));
    const ownerK = Object.keys(meas.summary).filter(k => /^owner\|high\|patch\/tile/.test(k));
    expect(`owner's view (High): patch/tile edge judged (${ownerK.map(k => k + ' n ' + meas.summary[k].n).join('; ')})`, ownerK.some(k => meas.summary[k].n >= MIN_N));

    // 3 invariants
    let ref = null, refName = '';
    if (fs.existsSync(path.join(OUT, 'invariants_before.json')) && !has('--live-invariants')) { ref = JSON.parse(fs.readFileSync(path.join(OUT, 'invariants_before.json'), 'utf8')); refName = 'docs/ground_detail/seams/invariants_before.json (recorded on the build before the fix)'; }
    else if (BEFORE) { console.log('measuring the build before for the invariants: ' + BEFORE); ref = (await measureAll(browser, BEFORE, 'before-live')).inv; refName = BEFORE; }
    if (ref) {
      const list = [], refRun = {}; Object.keys(inv).forEach(k => { refRun[k] = ref[k]; });   // the cases run this time
      diff(refRun, inv, '', list);
      const nGeo = Object.values(inv).reduce((n, x) => n + Object.values(x).reduce((m, v) => m + (v && v.geo ? Object.keys(v.geo).length : 0), 0), 0);
      const nInsp = Object.values(inv).reduce((n, x) => n + Object.values(x).reduce((m, v) => m + (v && v.insp ? v.insp.length : 0), 0), 0);
      expect(`unchanged vs ${refName}: ${nGeo} top-surface vertex/height hashes, ${nInsp} inspection readouts + the owner's inspected point at ${QUALS.length} qualities, rover pose and readout, status tiles, Sun/Earth directions (${Object.keys(inv).length} site/quality cases)`, list.length === 0, list.slice(0, 20).join(' | '));
      const oi = inv['owner/high'] && inv['owner/high'].ownerInspect;
      expect(`owner's inspected point (-88.8164, 126.0967 E) read out on the 5 m patch's edge (High): ${oi && oi.slice(0, 4).join(', ')} ${oi && oi[6]}`, !!oi);
    } else expect('invariants reference available (docs/ground_detail/seams/invariants_before.json or --before)', false);

    // 4 Orbit differences only along the seams
    if (BEFORE) {
      for (const c of CASES.filter(c => c.site === 'peak_shackleton' || c.site === 'mons_malapert')) for (const q of QUALS) {
        const a = await orbitPixels(browser, BEFORE, c, q), b = await orbitPixels(browser, ROOT, c, q);
        a.views.forEach((va, i) => {
          const vb = b.views[i], pa = Buffer.from(va.px, 'base64'), pb = Buffer.from(vb.px, 'base64'), mk = Buffer.from(vb.mask, 'base64');
          let changed = 0, outside = 0, maxOut = 0;
          for (let k = 0, p = 0; p < pa.length; p += 4, k++) {
            const la = 0.2126 * pa[p] + 0.7152 * pa[p + 1] + 0.0722 * pa[p + 2], lb = 0.2126 * pb[p] + 0.7152 * pb[p + 1] + 0.0722 * pb[p + 2], dl = Math.abs(la - lb);
            if (dl > 6) { changed++; if (!mk[k]) { outside++; maxOut = Math.max(maxOut, dl); } }
          }
          expect(`Orbit ${['60 km', '9 km', '3 km'][i]} ${c.site} ${q}: ${changed} pixels changed (|dL| > 6), all within ${'4 px'} of a layer edge (outside: ${outside})`, outside === 0, `max change outside ${maxOut.toFixed(1)}`);
        });
      }
    } else console.log('NOTE Orbit difference check skipped (needs --before <checkout of the build before>)');

    // 5 performance (Medium, peak_shackleton)
    if (!has('--no-perf')) {
      const { ctx, page, errs: pe } = await openPage(browser, ROOT, '#site=peak_shackleton&t=2028-09-25T10:04Z&w=1', 'medium');
      await page.evaluate(() => AsteriaView3D.close(true)); await page.waitForTimeout(500);
      const first = await page.evaluate(() => new Promise(res => { const t0 = performance.now(); AsteriaApp.openDeploy(); const f = () => { const d = window.AsteriaView3D && AsteriaView3D.debug(); if (d && d.open && d.frames >= 1) res(performance.now() - t0); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
      await page.waitForFunction(() => AsteriaView3D.debug().open && !AsteriaView3D.debug().refining && AsteriaView3D.debug().frames > 2, null, { timeout: 90000 });
      await page.evaluate(PAGE_LIB);
      expect(`performance: warm Medium first frame ${Math.round(first)} ms < 1500 ms`, first < 1500);
      for (const m of ['orbit', 'walk', 'rover']) {
        await setView(page, { mode: m }); await settle(page, 800);
        const fps = await page.evaluate(m => new Promise(res => {
          const key = m === 'orbit' ? 'ArrowLeft' : 'KeyW'; AsteriaView3D.testKey(key, true);
          const f0 = AsteriaView3D.debug().frames, t0 = performance.now();
          setTimeout(() => { AsteriaView3D.testKey(key, false); res((AsteriaView3D.debug().frames - f0) / ((performance.now() - t0) / 1000)); }, 2000);
        }), m);
        expect(`performance: ${m} at Medium ${fps.toFixed(1)} frames/s >= 30`, fps >= 30);
      }
      errs.push(...pe);
      await ctx.close();
    }

    // phone (automatic quality): seams at the tile / ring A edge in Walk and Rover
    if (!has('--no-phone')) for (const c of CASES.filter(c => c.site === 'peak_shackleton' || c.site === 'mons_malapert')) {
      const { ctx, page, errs: pe } = await openPage(browser, ROOT, `#site=${c.site}&t=${c.t}Z&w=1`, null, true);
      const q = await page.evaluate(() => AsteriaView3D.debug().quality);
      const rows = [];
      for (const kind of ['along1', 'along2', 'acrossF', 'acrossC', 'rover', 'orbit']) {
        const pose = await page.evaluate(kind => __SEAM.pose('tile/ringA', kind), kind);
        if (!pose) continue;
        await setView(page, Object.assign({ mode: kind === 'rover' ? 'rover' : kind === 'orbit' ? 'orbit' : 'walk' }, pose)); await settle(page, 1000);
        const prof = await page.evaluate(() => { const G = __SEAM.grab(); return __SEAM.profiles(G, 1500, 12); });
        rows.push(...(prof['tile/ringA'] || []));
        if (kind === 'along1' || kind === 'rover') await shot(page, `${TAG}_phone_${c.site}_${kind}.jpg`);
      }
      const s = summary(rows);
      expect(`phone ${c.site} (${q}) tile/ringA Walk+Rover+low Orbit: n ${s.n} r ${s.r} rHi ${s.rHi} black ${(100 * s.black).toFixed(2)} %`, s.n >= MIN_N && seamOK(s), RULE);
      errs.push(...pe.map(e => 'phone ' + c.site + ': ' + e));
      await ctx.close();
    }
    expect(`no console errors (${errs.length})`, errs.length === 0, errs.slice(0, 5).join(' | '));
  }
  await browser.close();
  console.log(MEASURE_ONLY ? 'MEASURED' : fails ? `FAILED: ${fails}` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
