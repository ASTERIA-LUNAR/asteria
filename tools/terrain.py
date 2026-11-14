"""
LunaWindow - Phase 3 terrain horizons from LOLA polar DEMs.

Products (PDS Geosciences Node, LRO LOLA RDR, lola_gdr/polar/img):
  LDEM_85S_20M  (15168 x 15168, 20 m/pix, ~85S-90S)  - near field, preferred
  LDEM_80S_80M  ( 7600 x  7600, 80 m/pix, ~80S-90S)  - fallback / far field
  LDEM_75S_120M ( 7624 x  7624, 120 m/pix, ~75S-90S) - far field for sites near 80S (e.g. IM-1)
Both: 16-bit LSB integers, HEIGHT_m = DN * 0.5 relative to a 1737.4 km sphere,
polar stereographic (spherical, R = 1737.4 km), centre -90, lon 0 up, 90E right
(from the .LBL files and catalog/DSMAP_POLAR.CAT).

Usage (from the project root):
  .venv/Scripts/python -I tools/terrain.py check       # projection/elevation sanity checks
  .venv/Scripts/python -I tools/terrain.py horizons    # write data/horizons/<site>.js
  .venv/Scripts/python -I tools/terrain.py hillshade   # write data/southpole_hillshade.png + data/map_meta.js
"""
import json
import math
import os
import re
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEM_DIR = os.path.join(ROOT, 'dem')
R_M = 1737400.0
OBS_HEIGHT_M = 2.0
MAX_DIST_M = 300000.0


def read_label(path):
    txt = open(path, encoding='latin-1').read()
    def num(key):
        m = re.search(r'^\s*' + key + r'\s*=\s*([-\d.]+)', txt, re.M)
        return float(m.group(1))
    return {
        'lines': int(num('LINES')), 'samples': int(num('LINE_SAMPLES')),
        'scale': num('MAP_SCALE'), 'factor': num('SCALING_FACTOR'),
        'line_off': num('LINE_PROJECTION_OFFSET'), 'sample_off': num('SAMPLE_PROJECTION_OFFSET'),
        'center_lat': num('CENTER_LATITUDE'), 'radius_km': num('A_AXIS_RADIUS'),
    }


class PolarDEM:
    def __init__(self, name):
        self.name = name.upper()
        base = os.path.join(DEM_DIR, name.lower())
        self.lbl = read_label(base + '.lbl')
        L = self.lbl
        assert L['center_lat'] == -90 and L['radius_km'] == 1737.4
        assert L['line_off'] == L['lines'] / 2 - 0.5, 'unexpected projection offset'
        self.n = L['lines']
        self.scale = L['scale']
        raw = np.fromfile(base + '.img', dtype='<i2')
        assert raw.size == self.n * self.n, 'DEM size mismatch (incomplete download?)'
        self.h = raw.reshape(self.n, self.n).astype(np.float32) * L['factor']
        self.half_extent = self.n / 2 * self.scale

    # lat/lon (deg) -> projected x, y (m)  [south polar stereographic, lon 0 up, 90E right]
    @staticmethod
    def xy(lat, lon):
        r = 2 * R_M * np.tan(np.radians(90 - np.abs(lat)) / 2)
        lo = np.radians(lon)
        return r * np.sin(lo), r * np.cos(lo)

    def ij(self, x, y):
        # 0-based sample i (column), line j (row).  From DSMAP_POLAR.CAT:
        # X = (I - N/2 - 0.5)*scale ; Y = -(J - N/2 - 0.5)*scale  (I,J 1-based)
        i = x / self.scale + self.n / 2 - 0.5
        j = -y / self.scale + self.n / 2 - 0.5
        return i, j

    def sample(self, x, y):
        """Bilinear height (m); NaN outside the grid."""
        i, j = self.ij(np.asarray(x, float), np.asarray(y, float))
        ok = (i >= 0) & (j >= 0) & (i < self.n - 1) & (j < self.n - 1)
        out = np.full(i.shape, np.nan, dtype=np.float64)
        ii, jj = i[ok], j[ok]
        i0 = np.floor(ii).astype(np.int64); j0 = np.floor(jj).astype(np.int64)
        fi = ii - i0; fj = jj - j0
        h = self.h
        out[ok] = (h[j0, i0] * (1 - fi) * (1 - fj) + h[j0, i0 + 1] * fi * (1 - fj)
                   + h[j0 + 1, i0] * (1 - fi) * fj + h[j0 + 1, i0 + 1] * fi * fj)
        return out


_DEMS = None
def dems():
    global _DEMS
    if _DEMS is None:
        _DEMS = [PolarDEM('ldem_85s_20m'), PolarDEM('ldem_80s_80m'), PolarDEM('ldem_75s_120m')]
    return _DEMS


def height(lat, lon):
    """Height from the finest DEM covering the point; returns (h, product)."""
    x, y = PolarDEM.xy(np.atleast_1d(lat), np.atleast_1d(lon))
    for d in dems():
        v = d.sample(x, y)
        if not np.isnan(v[0]):
            return float(v[0]), d.name
    return float('nan'), None


def destination(lat0, lon0, az, s):
    """Great-circle destination from (lat0, lon0) along initial azimuth az (deg, from local
    north = toward the lunar north pole) over arc length s (m). Vectorised over s."""
    p1, l1, a = math.radians(lat0), math.radians(lon0), math.radians(az)
    d = s / R_M
    sp = math.sin(p1) * np.cos(d) + math.cos(p1) * np.sin(d) * math.cos(a)
    p2 = np.arcsin(np.clip(sp, -1, 1))
    l2 = l1 + np.arctan2(math.sin(a) * np.sin(d) * math.cos(p1), np.cos(d) - math.sin(p1) * sp)
    return np.degrees(p2), np.degrees(l2)


def distances():
    # 10 m steps to 2 km, 20 m to 50 km, 40 m to 150 km, 80 m to MAX_DIST
    return np.concatenate([np.arange(10, 2000, 10), np.arange(2000, 50000, 20),
                           np.arange(50000, 150000, 40), np.arange(150000, MAX_DIST_M + 1, 80)]).astype(float)


def horizon_mask(lat0, lon0):
    h0, prod0 = height(lat0, lon0)
    if prod0 is None:
        raise ValueError('site outside DEM coverage')
    ro = R_M + h0 + OBS_HEIGHT_M
    s = distances()
    theta = s / R_M
    elev = np.zeros(360)
    reach = np.zeros(360)
    for az in range(360):
        la, lo = destination(lat0, lon0, az, s)
        x, y = PolarDEM.xy(la, lo)
        h = np.full(x.shape, np.nan)
        for d in dems():                       # finest DEM first
            miss = np.isnan(h)
            if not miss.any():
                break
            h[miss] = d.sample(x[miss], y[miss])
        valid = ~np.isnan(h)
        # stop at the first gap (left the DEMs)
        if not valid.all():
            first = np.argmin(valid)
            valid[first:] = False
        rt = R_M + h[valid]
        th = theta[valid]
        # exact spherical geometry in the vertical plane of the ray (includes curvature)
        e = np.degrees(np.arctan2(rt * np.cos(th) - ro, rt * np.sin(th)))
        elev[az] = e.max() if e.size else 0.0
        reach[az] = s[valid][-1] if valid.any() else 0.0
    return elev, reach, h0, prod0


def cmd_check():
    d85, d80 = dems()[:2]
    print('DEMs loaded:', d85.name, d85.n, d85.scale, 'm |', d80.name, d80.n, d80.scale, 'm')
    print('Height range 85S_20M: %.0f .. %.0f m' % (np.nanmin(d85.h), np.nanmax(d85.h)))
    # Shackleton profile along its centre longitude and the mirrored longitude
    for lon in (129.78, -129.78):
        prof = []
        for lat in np.arange(-90, -88.99, 0.05):
            prof.append(height(lat, lon)[0])
        print('Profile lon %7.2f (lat -90..-89 step .05): %s' % (lon, ' '.join('%5.0f' % p for p in prof)))
    for name, lat, lon, ref in [('Shackleton centre', -89.67, 129.78, None),
                                ('IM-1 (LROC 2579 m)', -80.13, 1.44, 2579),
                                ('Peak near Shackleton', -88.79, 124.5, None),
                                ('IM-2', -84.7906, 29.1957, None),
                                ('Mons Mouton', -84.6, 31.0, None)]:
        h, p = height(lat, lon)
        print('%-24s %8.1f m  (%s)%s' % (name, h, p, '' if ref is None else '  LROC ref %d m, diff %.0f m' % (ref, h - ref)))
    # 20 m vs 80 m agreement at a few points
    for lat, lon in [(-89.0, 0), (-87.0, 45), (-86.0, -100), (-88.5, 200)]:
        x, y = PolarDEM.xy(np.array([lat]), np.array([lon]))
        print('Cross-check (%g,%g): 20m %.1f  80m %.1f' % (lat, lon, d85.sample(x, y)[0], d80.sample(x, y)[0]))


def cmd_horizons():
    sites = load_sites()
    out_dir = os.path.join(ROOT, 'data', 'horizons')
    os.makedirs(out_dir, exist_ok=True)
    index = []
    for s in sites:
        if s['lat'] > -79.5:
            continue
        try:
            elev, reach, h0, prod = horizon_mask(s['lat'], s['lon'])
        except ValueError as e:
            print('skip', s['id'], e)
            continue
        data = {
            'siteId': s['id'], 'lat': s['lat'], 'lon': s['lon'],
            'siteHeight_m': round(h0, 1), 'observerAboveTerrain_m': OBS_HEIGHT_M,
            'demProducts': ['LDEM_85S_20M (20 m/pix, where covered)', 'LDEM_80S_80M (80 m/pix, beyond)', 'LDEM_75S_120M (120 m/pix, beyond that)'],
            'siteHeightFrom': prod,
            'resolution': '20 m/pix within ~85S, 80 m/pix to ~80S, 120 m/pix to ~75S',
            'method': ('Ray-marched 360 azimuths (1 deg, clockwise from local north) along great circles; '
                       'samples every 10 m (<2 km), 20 m (<50 km), 40 m (<150 km), 80 m (to 300 km or DEM edge); '
                       'bilinear DEM interpolation; exact spherical geometry (lunar curvature) in the ray plane; '
                       'keeps the maximum elevation angle of terrain seen from site terrain height + 2 m.'),
            'source': 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/',
            'minReach_km': round(float(reach.min()) / 1000, 1),
            'azimuths': list(range(360)),
            'elevations': [round(float(e), 3) for e in elev],
            'reach_km': [round(float(r) / 1000, 1) for r in reach],
        }
        with open(os.path.join(out_dir, s['id'] + '.js'), 'w') as f:
            f.write('// Generated by tools/terrain.py - LOLA terrain horizon mask\n')
            f.write('window.LUNA_HORIZONS = window.LUNA_HORIZONS || {};\n')
            f.write('window.LUNA_HORIZONS[%s] = %s;\n' % (json.dumps(s['id']), json.dumps(data)))
        index.append(s['id'])
        print('%-20s h0=%7.1f m  max horizon %5.2f deg  min %5.2f deg  min reach %.0f km' %
              (s['id'], h0, elev.max(), elev.min(), reach.min() / 1000))
    with open(os.path.join(out_dir, 'index.js'), 'w') as f:
        f.write('// Generated by tools/terrain.py\nwindow.LUNA_HORIZON_IDS = %s;\n' % json.dumps(index))


def load_sites():
    txt = open(os.path.join(ROOT, 'data', 'sites.js'), encoding='utf-8').read()
    sites = []
    for m in re.finditer(r"id: '([^']+)'.*?lat: (-?[\d.]+), lon: (-?[\d.]+)", txt, re.S):
        sites.append({'id': m.group(1), 'lat': float(m.group(2)), 'lon': float(m.group(3))})
    return sites


def cmd_hillshade():
    from PIL import Image
    d80 = dems()[1]
    # Map extent: square covering ~85S..90S (half-width = projected radius at 85S)
    half = float(2 * R_M * math.tan(math.radians(5) / 2))
    npx = 1200
    xs = np.linspace(-half, half, npx)
    ys = np.linspace(half, -half, npx)
    X, Y = np.meshgrid(xs, ys)
    # Use the 20 m DEM resampled (block-sampled) for detail, fall back to 80 m
    d85 = dems()[0]
    H = d85.sample(X.ravel(), Y.ravel())
    miss = np.isnan(H)
    H[miss] = d80.sample(X.ravel()[miss], Y.ravel()[miss])
    H = H.reshape(npx, npx)
    px = 2 * half / (npx - 1)
    gy, gx = np.gradient(H, px)          # gy: along rows (down = -Y), gx: along columns (+X)
    dzdx = gx; dzdy = -gy
    sun_az, sun_alt = math.radians(315), math.radians(25)   # light from upper-left (map frame)
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(-dzdx, -dzdy)
    shade = (math.sin(sun_alt) * np.cos(slope) +
             math.cos(sun_alt) * np.sin(slope) * np.cos(sun_az - aspect))
    shade = np.clip(shade, 0, 1)
    # tint by height a little for readability
    hn = (H - np.nanpercentile(H, 1)) / (np.nanpercentile(H, 99) - np.nanpercentile(H, 1))
    hn = np.clip(np.nan_to_num(hn), 0, 1)
    v = 0.04 + 0.96 * (shade ** 1.3) * (0.75 + 0.25 * hn)
    img = (np.clip(v, 0, 1) * 255).astype(np.uint8)   # greyscale keeps the file small
    Image.fromarray(img).save(os.path.join(ROOT, 'data', 'southpole_hillshade.png'), optimize=True)
    meta = {
        'image': 'data/southpole_hillshade.png', 'pixels': npx, 'halfExtent_m': half,
        'projection': 'Polar stereographic (spherical R=1737.4 km), centre -90, lon 0 up, 90E right; '
                      'x = r sin(lon), y = r cos(lon), r = 2R tan((90-|lat|)/2)',
        'dem': 'LDEM_85S_20M resampled (LDEM_80S_80M where 85S grid ends)',
        'illumination': 'Synthetic hillshade, light from the map upper-left at 25 deg altitude (not a real Sun position)',
        'heightRange_m': [float(np.nanmin(H)), float(np.nanmax(H))]
    }
    with open(os.path.join(ROOT, 'data', 'map_meta.js'), 'w') as f:
        f.write('// Generated by tools/terrain.py\nwindow.LUNA_MAP = %s;\n' % json.dumps(meta))
    print('hillshade written', npx, 'px, half-extent %.0f m' % half)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'check'
    {'check': cmd_check, 'horizons': cmd_horizons, 'hillshade': cmd_hillshade}[cmd]()
