"""
ASTERIA - terrain tiles for the 3D "Deploy" view.
Generated with Claude Code (Anthropic) under human direction.

For every curated south-pole site with a terrain horizon (data/horizons/index.js) this cuts a
square tile of about 6 km x 6 km centred on the site from the LOLA polar DEMs and writes
data/terrain3d/<site>.js (heights as base64 int16, so it loads from file:// with a <script> tag),
plus data/terrain3d/index.js (list of sites that have a tile).

GRID (local, site-centred):
  Node (i, j), i = column (east), j = row (north at row 0), spacing d metres, n x n nodes,
  e = (i - c) * d, n = (c - j) * d, c = (n - 1) / 2.
  (e, n) are azimuthal-equidistant coordinates: the node is the surface point at great-circle
  distance s = hypot(e, n) (on the 1737.4 km reference sphere) from the site, in the direction
  az = atan2(e, n) (clockwise from local north).  Its lat/lon comes from the exact great-circle
  destination formula (tools/terrain.py: destination), then the south polar stereographic projection
  of the DEM.  Because nodes are placed by TRUE ground distance and only then projected, the
  stereographic scale factor k = 2 / (1 + sin|lat|) (DEM pixels are true-scale at the pole only) is
  accounted for exactly; it is recorded in the tile metadata.
HEIGHT:
  bilinear interpolation of ONE DEM product per tile (the finest product that covers every node:
  LDEM_85S_20M, else LDEM_80S_80M, else LDEM_75S_120M; no mixing inside a tile), metres above the
  1737.4 km sphere.  Stored as int16 counts of 'unit_m' (0.1 m, or 0.2 m if the relief does not fit)
  relative to 'offset_m'.
3D POSITION (computed in the browser, js/view3d_math.js, from the stored height h):
  theta = s / R; P = (R + h) * unit vector at (theta, az); in the site's East-North-Up frame
  E = (R + h) sin(theta) sin(az), N = (R + h) sin(theta) cos(az), U = (R + h) cos(theta) - (R + h0)
  -> includes the lunar curvature drop (about 5 m at the tile corners) exactly.

Usage (from the project root):
  .venv/Scripts/python -I tools/terrain3d.py build     # write data/terrain3d/*.js
  .venv/Scripts/python -I tools/terrain3d.py check     # decode the .js files and compare with direct DEM samples
"""
import base64
import json
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain as T  # noqa: E402  (tools/terrain.py: DEM reader, projection, great-circle destination)

ROOT = T.ROOT
OUT_DIR = os.path.join(ROOT, 'data', 'terrain3d')
TILE_M = 6000.0
R_M = T.R_M
SPACING = {'LDEM_85S_20M': 20.0, 'LDEM_80S_80M': 80.0, 'LDEM_75S_120M': 120.0}
SOURCE = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/'


def horizon_sites():
    txt = open(os.path.join(ROOT, 'data', 'horizons', 'index.js'), encoding='utf-8').read()
    ids = json.loads(re.search(r'=\s*(\[.*?\])', txt, re.S).group(1))
    sites = {s['id']: s for s in T.load_sites()}
    return [sites[i] for i in ids]


def node_grid(n, d):
    c = (n - 1) / 2.0
    i = np.arange(n)
    e = (i - c) * d                 # columns: east
    nn = (c - i) * d                # rows: north at row 0
    E, N = np.meshgrid(e, nn)       # E[j, i], N[j, i]
    return E, N


def node_latlon_fast(lat0, lon0, E, N):
    """Same as node_latlon (great-circle destination), vectorised over both arrays."""
    p1, l1 = math.radians(lat0), math.radians(lon0)
    s = np.hypot(E, N); a = np.arctan2(E, N); d = s / R_M
    sp = math.sin(p1) * np.cos(d) + math.cos(p1) * np.sin(d) * np.cos(a)
    p2 = np.arcsin(np.clip(sp, -1, 1))
    l2 = l1 + np.arctan2(np.sin(a) * np.sin(d) * math.cos(p1), np.cos(d) - math.sin(p1) * sp)
    return np.degrees(p2), np.degrees(l2)


def build_site(site):
    lat0, lon0 = site['lat'], site['lon']
    for dem in T.dems():                       # finest product first
        d = SPACING[dem.name]
        n = 2 * int(round(TILE_M / 2 / d)) + 1    # odd: the centre node is the site itself
        E, N = node_grid(n, d)
        lat, lon = node_latlon_fast(lat0, lon0, E, N)
        x, y = T.PolarDEM.xy(lat.ravel(), lon.ravel())
        h = dem.sample(x, y)
        if not np.isnan(h).any():
            break
    else:
        raise ValueError('no single DEM covers the whole tile')
    h = h.reshape(n, n)
    c = (n - 1) // 2
    h0 = float(h[c, c])
    lo, hi = float(h.min()), float(h.max())
    offset = round((lo + hi) / 2, 1)
    unit = 0.1
    if (hi - lo) / unit > 65000:
        unit = 0.2
    q = np.round((h - offset) / unit)
    assert q.min() >= -32768 and q.max() <= 32767
    q = q.astype('<i2')
    b64 = base64.b64encode(q.tobytes()).decode('ascii')
    k_site = 2 / (1 + math.sin(math.radians(abs(lat0))))
    corner = math.hypot(c * d, c * d)
    rng = np.random.default_rng(sum(map(ord, site['id'])))
    checks = []
    for (jj, ii) in [(c, c)] + [tuple(rng.integers(0, n, 2)) for _ in range(3)]:
        checks.append({'i': int(ii), 'j': int(jj), 'lat': float(lat[jj, ii]), 'lon': float(lon[jj, ii]),
                       'h_dem_m': round(float(h[jj, ii]), 3)})
    meta = {
        'siteId': site['id'], 'lat': lat0, 'lon': lon0,
        'demProduct': dem.name, 'demPixel_m': dem.scale,
        'demSource': SOURCE,
        'n': n, 'spacing_m': d, 'size_m': (n - 1) * d,
        'h0_m': round(h0, 2), 'offset_m': offset, 'unit_m': unit,
        'heightMin_m': round(lo, 1), 'heightMax_m': round(hi, 1),
        'stereoScaleFactorAtSite': round(k_site, 6),
        'demPixelTrue_m': round(dem.scale / k_site, 2),
        'curvatureDropAtCorner_m': round(R_M * (1 - math.cos(corner / R_M)), 2),
        'radius_m': R_M,
        'encoding': 'base64 of little-endian int16, row-major, row 0 = north edge, column 0 = west edge; height_m = offset_m + value * unit_m (above the 1737.4 km sphere)',
        'method': ('Nodes on a regular %g m grid in site-centred azimuthal-equidistant coordinates (true ground distance '
                   'along great circles on the 1737.4 km sphere), converted to lat/lon with the exact destination formula, '
                   'projected to the DEM\'s south polar stereographic grid (so the stereographic scale factor is accounted for), '
                   'height by bilinear interpolation of %s only (finest product covering the whole tile). '
                   '3D positions in the site East-North-Up frame include the lunar curvature drop exactly.') % (d, dem.name),
        'checkPoints': checks,
        'generator': 'tools/terrain3d.py',
    }
    return meta, b64


def cmd_build():
    os.makedirs(OUT_DIR, exist_ok=True)
    ids = []
    for s in horizon_sites():
        meta, b64 = build_site(s)
        with open(os.path.join(OUT_DIR, s['id'] + '.js'), 'w') as f:
            f.write('// Generated by tools/terrain3d.py - LOLA terrain tile for the 3D view (see method in the metadata)\n')
            f.write('window.ASTERIA_TERRAIN3D = window.ASTERIA_TERRAIN3D || {};\n')
            f.write('window.ASTERIA_TERRAIN3D[%s] = %s;\n' % (json.dumps(s['id']), json.dumps(dict(meta, b64=b64))))
        ids.append(s['id'])
        print('%-20s %-14s n=%3d d=%3g m  h0=%8.1f  range %7.1f..%7.1f  k=%.5f  %d KB' % (
            s['id'], meta['demProduct'], meta['n'], meta['spacing_m'], meta['h0_m'], meta['heightMin_m'], meta['heightMax_m'],
            meta['stereoScaleFactorAtSite'], len(b64) // 1024))
    with open(os.path.join(OUT_DIR, 'index.js'), 'w') as f:
        f.write('// Generated by tools/terrain3d.py - sites that have a 3D terrain tile\n')
        f.write('window.ASTERIA_TERRAIN3D_IDS = %s;\n' % json.dumps(ids))


# ---------------------------------------------------------------- check (independent path)
def ecef(lat, lon, r=1.0):
    la, lo = np.radians(lat), np.radians(lon)
    return np.stack([r * np.cos(la) * np.cos(lo), r * np.cos(la) * np.sin(lo), r * np.sin(la)], -1)


def node_latlon_vector(lat0, lon0, e, n):
    """Independent of destination(): rotate the site's up vector toward (east, north) by theta = s/R."""
    la, lo = math.radians(lat0), math.radians(lon0)
    up = np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    east = np.array([-math.sin(lo), math.cos(lo), 0.0])
    north = np.cross(up, east)
    s = math.hypot(e, n)
    if s == 0:
        v = up
    else:
        th = s / R_M
        v = math.cos(th) * up + math.sin(th) * (e / s * east + n / s * north)
    return math.degrees(math.asin(v[2])), math.degrees(math.atan2(v[1], v[0]))


def raw_bilinear(dem, lat, lon):
    """Bilinear sample computed directly from the raw DEM array and the projection in the .LBL/catalog."""
    r = 2 * R_M * math.tan(math.radians(90 - abs(lat)) / 2)
    x, y = r * math.sin(math.radians(lon)), r * math.cos(math.radians(lon))
    fi = x / dem.scale + dem.n / 2 - 0.5
    fj = -y / dem.scale + dem.n / 2 - 0.5
    i0, j0 = int(math.floor(fi)), int(math.floor(fj))
    a, b = fi - i0, fj - j0
    H = dem.h
    return float(H[j0, i0] * (1 - a) * (1 - b) + H[j0, i0 + 1] * a * (1 - b) + H[j0 + 1, i0] * (1 - a) * b + H[j0 + 1, i0 + 1] * a * b)


def load_tile(sid):
    txt = open(os.path.join(OUT_DIR, sid + '.js'), encoding='utf-8').read()
    m = re.search(r'ASTERIA_TERRAIN3D\[[^\]]+\]\s*=\s*(\{.*\});', txt, re.S)
    return json.loads(m.group(1))


def cmd_check():
    by_name = {d.name: d for d in T.dems()}
    hz_txt = {}
    worst = 0.0
    ok_all = True
    for s in horizon_sites():
        t = load_tile(s['id'])
        q = np.frombuffer(base64.b64decode(t['b64']), dtype='<i2').reshape(t['n'], t['n'])
        H = t['offset_m'] + q.astype(np.float64) * t['unit_m']
        dem = by_name[t['demProduct']]
        n, d = t['n'], t['spacing_m']
        c = (n - 1) // 2
        rng = np.random.default_rng(12345 + len(s['id']))
        pts = [(c, c)] + [tuple(int(v) for v in rng.integers(0, n, 2)) for _ in range(3)]
        rows = []
        for (j, i) in pts:
            e, nn = (i - c) * d, (c - j) * d
            la, lo = node_latlon_vector(s['lat'], s['lon'], e, nn)
            ref = raw_bilinear(dem, la, lo)
            diff = H[j, i] - ref
            worst = max(worst, abs(diff))
            ok_all &= abs(diff) <= 1.0
            rows.append('(%d,%d) %+.0f E %+.0f N: tile %.2f  DEM %.2f  diff %+.3f m' % (i, j, e, nn, H[j, i], ref, diff))
        # site centre against the horizon file's site height (same DEM product where the horizon used it)
        hz = open(os.path.join(ROOT, 'data', 'horizons', s['id'] + '.js'), encoding='utf-8').read()
        hs = float(re.search(r'"siteHeight_m":\s*(-?[\d.]+)', hz).group(1))
        hp = re.search(r'"siteHeightFrom":\s*"([^"]+)"', hz).group(1)
        print('%-20s %s n=%d d=%g m; centre vs horizon file (%s): %.1f vs %.1f' % (s['id'], t['demProduct'], n, d, hp, H[c, c], hs))
        for r in rows:
            print('    ' + r)
    print('Worst |tile - direct DEM sample| = %.3f m -> %s (limit 1 m)' % (worst, 'PASS' if ok_all else 'FAIL'))
    if not ok_all:
        sys.exit(1)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    {'build': cmd_build, 'check': cmd_check}[cmd]()
