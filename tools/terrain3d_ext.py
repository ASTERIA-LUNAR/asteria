"""
ASTERIA - extended terrain rings and the 5 m inner patch for the 3D "Deploy" view (round 4).
Generated with Claude Code (Anthropic) under human direction.

Same site-centred grid as tools/terrain3d.py (azimuthal-equidistant ground coordinates e, n on the 1737.4 km sphere,
great-circle destination -> lat/lon -> the DEM's south polar stereographic grid -> bilinear height), so the browser
places every node with the same exact ENU formula (lunar curvature included).

  ring A  : square of half-size 16 km, spacing 100 m (20 m tiles) or 80 m (80 m tiles); covers the site's 6 km tile
            (the browser leaves a hole there) and includes e.g. the Shackleton rim from its floor.
            DEM: LDEM_80S_80M (80 m/pix) when it covers the whole square, else LDEM_75S_120M.
  ring B  : square of half-size 40 km, spacing 200 m (or 160 m), from LDEM_75S_120M (120 m/pix); High quality only.
            The browser leaves a hole for ring A.
  patch5m : 2 km x 2 km at 5 m from LDEM_875S_5M (5 m/pix, 87.5S to the pole), for the curated sites inside its coverage,
            from the row windows fetched by tools/fetch_round4.py (HTTP Range requests); High quality only.
Round 6 (finer real data where it exists; same grid, same checks):
  ring A fine (_af): half-size 16 km, spacing 25 m, from LDEM_85S_20M only, for sites whose whole ring A lies inside that
            product (both Peak near Shackleton points, Shackleton crater centre, Mons Malapert). The browser draws it at
            50 m (High) or 100 m (Medium) and bakes a normal map at 25 m from it (never finer than the 20 m source).
  ring B fine (_bf): half-size 40 km, spacing 100 m, from LDEM_85S_20M, else LDEM_80S_80M, when one of them covers the
            whole ring (never upsampled: 100 m is coarser than both sources). Drawn at 200 m with a 100 m normal map.
Every hole edge falls on nodes of the finer grid inside it (half-sizes are multiples of both spacings), and the browser
takes those boundary heights from the finer grid, so neighbouring meshes share identical edge vertices (no gaps).

Outputs: data/terrain3d/ext/<site>_a.js, <site>_b.js, <site>_af.js, <site>_bf.js, data/terrain3d/fine_index.js, data/terrain3d/hi5m/<site>.js  (base64 int16, as the tiles)
Usage:
  .venv/Scripts/python -I tools/terrain3d_ext.py build    # rings + 5 m patches
  .venv/Scripts/python -I tools/terrain3d_ext.py check    # decode and compare with direct DEM samples (independent path)
"""
import base64
import json
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain as T          # noqa: E402
import terrain3d as T3       # noqa: E402

ROOT = T.ROOT
OUT_EXT = os.path.join(ROOT, 'data', 'terrain3d', 'ext')
OUT_5M = os.path.join(ROOT, 'data', 'terrain3d', 'hi5m')
HALF_A, HALF_B, HALF_5M = 16000.0, 40000.0, 1000.0
PDS = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/'
DL5M = os.path.join(ROOT, 'dem', 'dl5m')


class Window5m:
    """Rows j0..j1 of LDEM_875S_5M (all columns), as fetched by tools/fetch_round4.py."""
    name, n, scale, factor = 'LDEM_875S_5M', 30336, 5.0, 0.5

    def __init__(self, sid):
        m = json.load(open(os.path.join(DL5M, sid + '_rows.json')))
        self.j0, self.j1 = m['j0'], m['j1']
        raw = np.fromfile(os.path.join(DL5M, sid + '_rows.bin'), dtype='<i2')
        assert raw.size == (self.j1 - self.j0 + 1) * self.n, 'incomplete window'
        self.h = raw.reshape(-1, self.n).astype(np.float32) * self.factor

    def sample(self, x, y):
        i = np.asarray(x, float) / self.scale + self.n / 2 - 0.5
        j = -np.asarray(y, float) / self.scale + self.n / 2 - 0.5 - self.j0
        ok = (i >= 0) & (j >= 0) & (i < self.n - 1) & (j < self.h.shape[0] - 1)
        out = np.full(i.shape, np.nan)
        ii, jj = i[ok], j[ok]
        i0, j0 = np.floor(ii).astype(int), np.floor(jj).astype(int)
        a, b = ii - i0, jj - j0
        H = self.h
        out[ok] = H[j0, i0] * (1 - a) * (1 - b) + H[j0, i0 + 1] * a * (1 - b) + H[j0 + 1, i0] * (1 - a) * b + H[j0 + 1, i0 + 1] * a * b
        return out


def grid_heights(site, half, d, dems):
    n = 2 * int(round(half / d)) + 1
    E, N = T3.node_grid(n, d)
    lat, lon = T3.node_latlon_fast(site['lat'], site['lon'], E, N)
    x, y = T.PolarDEM.xy(lat.ravel(), lon.ravel())
    for dem in dems:
        h = dem.sample(x, y)
        if not np.isnan(h).any():
            return dem, n, h.reshape(n, n), lat, lon
    raise ValueError('no single DEM covers %s at half-size %g m' % (site['id'], half))


def encode(h):
    lo, hi = float(h.min()), float(h.max())
    offset = round((lo + hi) / 2, 1)
    unit = 0.1
    while (hi - lo) / unit > 65000:
        unit *= 2
    q = np.round((h - offset) / unit)
    assert q.min() >= -32768 and q.max() <= 32767
    return offset, unit, base64.b64encode(q.astype('<i2').tobytes()).decode('ascii')


def write(path, var, sid, meta):
    with open(path, 'w') as f:
        f.write('// Generated by tools/terrain3d_ext.py - LOLA terrain for the 3D view (see method in the metadata)\n')
        f.write('window.%s = window.%s || {};\n' % (var, var))
        f.write('window.%s[%s] = %s;\n' % (var, json.dumps(sid), json.dumps(meta)))


def build_one(site, tile, kind):
    d_t, n_t = tile['spacing_m'], tile['n']
    half_t = (n_t - 1) / 2 * d_t
    dA = d_t * round(100 / d_t)
    by = {d.name: d for d in T.dems()}
    if kind == 'a':
        half, d, dems, inner = HALF_A, dA, [by['LDEM_80S_80M'], by['LDEM_75S_120M']], half_t
    elif kind == 'b':
        half, d, dems, inner = HALF_B, 2 * dA, [by['LDEM_75S_120M']], HALF_A
    elif kind == 'af':
        half, d, dems, inner = HALF_A, 25.0, [by['LDEM_85S_20M']], half_t
    elif kind == 'bf':
        half, d, dems, inner = HALF_B, 100.0, [by['LDEM_85S_20M'], by['LDEM_80S_80M']], HALF_A
    else:
        half, d, dems, inner = HALF_5M, 5.0, [Window5m(site['id'])], 0.0
    assert abs(inner / d - round(inner / d)) < 1e-9 and abs(half / d - round(half / d)) < 1e-9
    dem, n, h, lat, lon = grid_heights(site, half, d, dems)
    offset, unit, b64 = encode(h)
    c = (n - 1) // 2
    rng = np.random.default_rng(sum(map(ord, site['id'] + kind)))
    pts = [(c, c), (0, 0), (n - 1, n - 1)] + [tuple(int(v) for v in rng.integers(0, n, 2)) for _ in range(5)]
    checks = [{'i': i, 'j': j, 'lat': float(lat[j, i]), 'lon': float(lon[j, i]), 'h_dem_m': round(float(h[j, i]), 3)} for (j, i) in pts]
    pix = getattr(dem, 'scale', 5.0)
    return {
        'siteId': site['id'], 'kind': {'a': 'ringA', 'b': 'ringB', 'af': 'ringAfine', 'bf': 'ringBfine', '5m': 'patch5m'}[kind], 'lat': site['lat'], 'lon': site['lon'],
        'demProduct': dem.name, 'demPixel_m': pix, 'demSource': PDS + dem.name.lower() + '.img',
        'n': n, 'spacing_m': d, 'half_m': half, 'holeHalf_m': inner, 'h0_m': tile['h0_m'],
        'offset_m': offset, 'unit_m': unit, 'heightMin_m': round(float(h.min()), 1), 'heightMax_m': round(float(h.max()), 1),
        'curvatureDropAtEdge_m': round(T.R_M * (1 - math.cos(half / T.R_M)), 1), 'radius_m': T.R_M,
        'encoding': 'base64 of little-endian int16, row-major, row 0 = north edge, column 0 = west edge; height_m = offset_m + value * unit_m (above the 1737.4 km sphere)',
        'method': ('Same site-centred azimuthal-equidistant grid as the 6 km tile (tools/terrain3d.py), %g m spacing, half-size %g m; '
                   'bilinear heights from %s only. The browser draws only the part outside the inner square of half-size %g m '
                   '(covered by a finer mesh) and takes the heights on that boundary from the finer mesh.') % (d, half, dem.name, inner),
        'checkPoints': checks, 'generator': 'tools/terrain3d_ext.py', 'b64': b64,
    }


def cmd_build():
    os.makedirs(OUT_EXT, exist_ok=True); os.makedirs(OUT_5M, exist_ok=True)
    have5m, fine = [], {}
    for s in T3.horizon_sites():
        tile = T3.load_tile(s['id'])
        for kind in ('a', 'b'):
            m = build_one(s, tile, kind)
            write(os.path.join(OUT_EXT, '%s_%s.js' % (s['id'], kind)), 'ASTERIA_TERRAIN3D_EXT', s['id'] + '_' + kind, m)
            print('%-20s ring %s  %-14s n=%4d d=%3g m  half %5.0f m  unit %.1f m  %4d KB' % (s['id'], kind.upper(), m['demProduct'], m['n'], m['spacing_m'], m['half_m'], m['unit_m'], len(m['b64']) // 1024))
        for kind in ('af', 'bf'):
            if kind == 'af' and tile['spacing_m'] != 20.0:
                continue                      # 80 m tiles: no 20 m data around them
            try:
                m = build_one(s, tile, kind)
            except ValueError as e:
                print('%-20s ring %s  not built (%s)' % (s['id'], kind.upper(), e))
                continue
            write(os.path.join(OUT_EXT, '%s_%s.js' % (s['id'], kind)), 'ASTERIA_TERRAIN3D_EXT', s['id'] + '_' + kind, m)
            fine.setdefault(s['id'], {})[kind] = {'demProduct': m['demProduct'], 'spacing_m': m['spacing_m'], 'demPixel_m': m['demPixel_m']}
            print('%-20s ring %s  %-14s n=%4d d=%3g m  half %5.0f m  unit %.1f m  %4d KB' % (s['id'], kind.upper(), m['demProduct'], m['n'], m['spacing_m'], m['half_m'], m['unit_m'], len(m['b64']) // 1024))
        if os.path.exists(os.path.join(DL5M, s['id'] + '_rows.json')):
            m = build_one(s, tile, '5m')
            write(os.path.join(OUT_5M, s['id'] + '.js'), 'ASTERIA_TERRAIN3D_5M', s['id'], m)
            have5m.append(s['id'])
            print('%-20s 5 m patch  n=%d  %d KB' % (s['id'], m['n'], len(m['b64']) // 1024))
    with open(os.path.join(ROOT, 'data', 'terrain3d', 'hi5m_index.js'), 'w') as f:
        f.write('// Generated by tools/terrain3d_ext.py - sites with a 5 m inner patch (LDEM_875S_5M)\n')
        f.write('window.ASTERIA_TERRAIN3D_5M_IDS = %s;\n' % json.dumps(have5m))
    with open(os.path.join(ROOT, 'data', 'terrain3d', 'fine_index.js'), 'w') as f:
        f.write('// Generated by tools/terrain3d_ext.py - finer ring grids (round 6): ring A at 25 m from LDEM_85S_20M, ring B at 100 m\n')
        f.write('window.ASTERIA_TERRAIN3D_FINE = %s;\n' % json.dumps(fine))


# ------------------------------------------------------------------ check (independent path, as terrain3d.py check)
def raw_bilinear_5m(win, lat, lon):
    r = 2 * T.R_M * math.tan(math.radians(90 - abs(lat)) / 2)
    x, y = r * math.sin(math.radians(lon)), r * math.cos(math.radians(lon))
    fi = x / win.scale + win.n / 2 - 0.5
    fj = -y / win.scale + win.n / 2 - 0.5 - win.j0
    i0, j0 = int(math.floor(fi)), int(math.floor(fj))
    a, b = fi - i0, fj - j0
    H = win.h
    return float(H[j0, i0] * (1 - a) * (1 - b) + H[j0, i0 + 1] * a * (1 - b) + H[j0 + 1, i0] * (1 - a) * b + H[j0 + 1, i0 + 1] * a * b)


def load(path):
    txt = open(path, encoding='utf-8').read()
    return json.loads(re.search(r'\]\s*=\s*(\{.*\});', txt, re.S).group(1))


def cmd_check():
    by = {d.name: d for d in T.dems()}
    worst, ok = 0.0, True
    files = [(os.path.join(OUT_EXT, f), f) for f in sorted(os.listdir(OUT_EXT))] + [(os.path.join(OUT_5M, f), f) for f in sorted(os.listdir(OUT_5M))]
    for path, f in files:
        t = load(path)
        q = np.frombuffer(base64.b64decode(t['b64']), dtype='<i2').reshape(t['n'], t['n'])
        H = t['offset_m'] + q.astype(np.float64) * t['unit_m']
        dem = Window5m(t['siteId']) if t['demProduct'] == 'LDEM_875S_5M' else by[t['demProduct']]
        c, d = (t['n'] - 1) // 2, t['spacing_m']
        rng = np.random.default_rng(777 + len(f))
        pts = [(0, 0), (t['n'] - 1, 0), (0, t['n'] - 1)] + [tuple(int(v) for v in rng.integers(0, t['n'], 2)) for _ in range(5)]
        rows = []
        for (j, i) in pts:
            e, nn = (i - c) * d, (c - j) * d
            la, lo = T3.node_latlon_vector(t['lat'], t['lon'], e, nn)
            ref = raw_bilinear_5m(dem, la, lo) if isinstance(dem, Window5m) else T3.raw_bilinear(dem, la, lo)
            diff = H[j, i] - ref
            worst = max(worst, abs(diff)); ok &= abs(diff) <= 1.0
            rows.append('%+.0f E %+.0f N: %.2f vs DEM %.2f (%+.3f)' % (e, nn, H[j, i], ref, diff))
        print('%-28s %-14s n=%d d=%g: worst %.3f m   e.g. %s' % (f, t['demProduct'], t['n'], d, max(abs(float(r.split('(')[-1][:-1])) for r in rows), rows[0]))
    print('Worst |stored - direct DEM sample| = %.3f m -> %s (limit 1 m)' % (worst, 'PASS' if ok else 'FAIL'))
    if not ok:
        sys.exit(1)


if __name__ == '__main__':
    {'build': cmd_build, 'check': cmd_check}[sys.argv[1] if len(sys.argv) > 1 else 'check']()
