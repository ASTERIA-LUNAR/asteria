"""
ASTERIA - south-pole map tiles from the LOLA polar DEMs and the published PGDA illumination map.

Projection: the same polar stereographic grid as tools/terrain.py and the PDS products
(spherical R = 1737.4 km, centre -90, lon 0 up, 90E right; x = r sin(lon), y = r cos(lon),
r = 2R tan((90-|lat|)/2)). The tile pyramid covers the square |x|, |y| <= H = 304 000 m
(the LDEM_80S_80M extent: ~80S on the axes, ~76S in the corners).

Zoom z: 2^z x 2^z tiles of 256 px, pixel size 2H / (256 * 2^z) m:
  z0 2375 m, z1 1188, z2 594, z3 297, z4 148, z5 74.2, z6 37.1, z7 18.6 m/px.
Tile (z, tx, ty): pixel column i, row j has its centre at
  x = -H + (tx*256 + i + 0.5) * s,   y = H - (ty*256 + j + 0.5) * s.
The browser uses the identical transform (js/map.js), so markers and tiles share one georeference.

Layers
  hill   synthetic hillshade (light from the map's upper-left at 25 deg altitude; NOT real lighting),
         JPEG.  z0-5 whole square, z6 and z7 inside the LDEM_85S_20M square (~85S).
  slope  slope in degrees from the DEM, 8 classes, PNG.  z0-5 (z5 computed on a 37 m sample grid,
         lower zooms are 2x2 averages of the slope values).
  illum120  published PGDA average illumination AVGVISIB_75S_120M_201608 (120 m/px, 75S-90S): the outer
         layer for the part of the map the 60 m product does not cover (80-85S). PNG, z0-4 (z4 = 148 m pixels).
  illum  published PGDA average illumination AVGVISIB_85S_060M_201608 (60 m/px, ~85S-90S), PNG
         with transparency outside the product, z0-5.

Usage: .venv/Scripts/python -I tools/tiles.py [check | illum120]
       (illum120 = build only the outer 120 m illumination layer and add it to data/tiles_meta.js)
Writes tiles/<layer>/<z>/<x>/<y>.(jpg|png) and data/tiles_meta.js.
"""
import json
import math
import os
import shutil
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain as T  # noqa: E402

ROOT = T.ROOT
OUT = os.path.join(ROOT, 'tiles')
H = 304000.0                 # half extent of the tile square (m)
TS = 256
Z_BASE = 5                   # finest zoom for the whole square
Z_DETAIL = 6                 # hillshade detail inside the 20 m DEM square
Z_POLE = 7                   # hillshade detail near the pole
POLE_HALF = 151680.0         # z7 tiles cover the LDEM_85S_20M square (|x|,|y| <= 151.68 km, ~85S)
SUPER = 2                    # supersampling per pixel axis
JPEG_Q = 72
SLOPE_EDGES = [0, 5, 10, 15, 20, 25, 30, 40, 91]
SLOPE_COLORS = [(26, 152, 80), (102, 189, 99), (166, 217, 106), (217, 239, 139),
                (254, 224, 139), (253, 174, 97), (244, 109, 67), (215, 48, 39)]
ILLUM_EDGES = [0.0, 1e-6, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.01]
ILLUM_COLORS = [(40, 30, 90), (60, 40, 110), (90, 50, 120), (125, 60, 115), (160, 75, 100),
                (195, 95, 75), (225, 125, 50), (245, 165, 40), (255, 200, 60), (255, 235, 140)]
LIGHT_AZ, LIGHT_ALT = math.radians(315), math.radians(25)
HN_LO, HN_HI = -4500.0, 4500.0   # height tint range (m), fixed so all zooms match


def pix(z):
    return 2 * H / (TS * 2 ** z)


def sample_height(x, y):
    """Finest-DEM bilinear height (m) at projected x, y; NaN outside all DEMs."""
    h = np.full(x.shape, np.nan)
    for d in T.dems():
        miss = np.isnan(h)
        if not miss.any():
            break
        h[miss] = d.sample(x[miss], y[miss])
    return h


def grid(z, tx0, ty0, ntx, nty, sup, pad):
    """Sample-centre coordinates for a block of tiles, sup samples per pixel, pad samples around."""
    s = pix(z) / sup
    n_x, n_y = ntx * TS * sup, nty * TS * sup
    xs = -H + tx0 * TS * pix(z) + (np.arange(-pad, n_x + pad) + 0.5) * s
    ys = H - ty0 * TS * pix(z) - (np.arange(-pad, n_y + pad) + 0.5) * s
    return xs, ys, s


def hill_and_slope(Hm, s):
    gy, gx = np.gradient(Hm, s)            # rows go toward -y
    dzdx, dzdy = gx, -gy
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(-dzdx, -dzdy)
    shade = np.clip(math.sin(LIGHT_ALT) * np.cos(slope) + math.cos(LIGHT_ALT) * np.sin(slope) * np.cos(LIGHT_AZ - aspect), 0, 1)
    hn = np.clip((np.nan_to_num(Hm, nan=HN_LO) - HN_LO) / (HN_HI - HN_LO), 0, 1)
    v = 0.04 + 0.96 * (shade ** 1.3) * (0.75 + 0.25 * hn)
    v[np.isnan(Hm)] = 0
    return v, np.degrees(slope)


def block_mean(a, f):
    h, w = a.shape[0] // f, a.shape[1] // f
    return np.nanmean(a[:h * f, :w * f].reshape(h, f, w, f), axis=(1, 3))


def render_rows(z, tx0, tx1, ty0, ty1, want_slope):
    """Hillshade (0..1) and slope (deg) mosaics for tiles tx0..tx1-1, ty0..ty1-1 at zoom z."""
    ntx, nty = tx1 - tx0, ty1 - ty0
    hill = np.zeros((nty * TS, ntx * TS), np.float32)
    slope = np.zeros((nty * TS, ntx * TS), np.float32) if want_slope else None
    for r in range(nty):                    # one tile row at a time (memory)
        xs, ys, s = grid(z, tx0, ty0 + r, ntx, 1, SUPER, 1)
        X, Y = np.meshgrid(xs, ys)
        Hm = sample_height(X.ravel(), Y.ravel()).reshape(X.shape)
        v, sl = hill_and_slope(Hm, s)
        v, sl = v[1:-1, 1:-1], sl[1:-1, 1:-1]
        hill[r * TS:(r + 1) * TS] = block_mean(v, SUPER)
        if want_slope:
            slope[r * TS:(r + 1) * TS] = block_mean(sl, SUPER)
    return hill, slope


def downsample(a):
    return block_mean(a, 2).astype(np.float32)


def classify(vals, edges):
    idx = np.digitize(vals, edges[1:-1])
    return idx.astype(np.uint8)


def palette_png(idx, colors, transparent_mask=None):
    """Indexed PNG; index len(colors) is transparent."""
    im = idx.copy()
    if transparent_mask is not None:
        im[transparent_mask] = len(colors)
    img = Image.fromarray(im, mode='P')
    pal = []
    for c in colors:
        pal += list(c)
    pal += [0, 0, 0]
    img.putpalette(pal + [0] * (768 - len(pal)))
    if transparent_mask is not None:
        img.info['transparency'] = len(colors)
    return img


def save_tiles(layer, z, mosaic, tx0, ty0, kind, stats, skip=None):
    nty, ntx = mosaic.shape[0] // TS, mosaic.shape[1] // TS
    for r in range(nty):
        for c in range(ntx):
            tile = mosaic[r * TS:(r + 1) * TS, c * TS:(c + 1) * TS]
            if skip is not None and skip(tile):
                continue
            d = os.path.join(OUT, layer, str(z), str(tx0 + c))
            os.makedirs(d, exist_ok=True)
            if kind == 'hill':
                p = os.path.join(d, '%d.jpg' % (ty0 + r))
                Image.fromarray((np.clip(tile, 0, 1) * 255).astype(np.uint8)).save(p, quality=JPEG_Q, optimize=True)
            elif kind == 'slope':
                p = os.path.join(d, '%d.png' % (ty0 + r))
                palette_png(classify(tile, SLOPE_EDGES), SLOPE_COLORS).save(p, optimize=True)
            else:  # illum: NaN = outside product
                p = os.path.join(d, '%d.png' % (ty0 + r))
                nan = np.isnan(tile)
                palette_png(classify(np.nan_to_num(tile), ILLUM_EDGES), ILLUM_COLORS, nan).save(p, optimize=True)
            stats[layer] = stats.get(layer, 0) + os.path.getsize(p)
            stats[layer + '_n'] = stats.get(layer + '_n', 0) + 1


class PGDAMap:
    def __init__(self, product='AVGVISIB_85S_060M_201608'):
        base = os.path.join(ROOT, 'dem', 'pgda', product)
        lbl = T.read_label(base + '.LBL')
        self.n, self.scale = lbl['lines'], lbl['scale']
        assert lbl['line_off'] == self.n / 2 - 0.5
        self.v = np.fromfile(base + '.IMG', dtype='<i2').reshape(self.n, self.n).astype(np.float32) * lbl['factor']
        self.half = self.n / 2 * self.scale

    def sample(self, x, y):
        i = x / self.scale + self.n / 2 - 0.5
        j = -y / self.scale + self.n / 2 - 0.5
        ok = (i >= 0) & (j >= 0) & (i < self.n - 1) & (j < self.n - 1)
        out = np.full(x.shape, np.nan, np.float32)
        ii, jj = i[ok], j[ok]
        i0 = np.floor(ii).astype(np.int64); j0 = np.floor(jj).astype(np.int64)
        fi = ii - i0; fj = jj - j0
        v = self.v
        out[ok] = (v[j0, i0] * (1 - fi) * (1 - fj) + v[j0, i0 + 1] * fi * (1 - fj) + v[j0 + 1, i0] * (1 - fi) * fj + v[j0 + 1, i0 + 1] * fi * fj)
        return out


Z_ILLUM120 = 4
ILLUM120_PRODUCT = 'AVGVISIB_75S_120M_201608'


def build_illum120(stats):
    """Outer published-illumination layer from the 120 m (75S-90S) PGDA product over the whole tile square."""
    pg = PGDAMap(ILLUM120_PRODUCT)
    n = 2 ** Z_ILLUM120
    print('z%d PGDA 120 m illumination tiles (%d x %d)...' % (Z_ILLUM120, n, n))
    xs, ys, s = grid(Z_ILLUM120, 0, 0, n, n, SUPER, 0)
    mos = np.zeros((len(ys) // SUPER, len(xs) // SUPER), np.float32)
    for r in range(n):
        yy = ys[r * TS * SUPER:(r + 1) * TS * SUPER]
        X, Y = np.meshgrid(xs, yy)
        mos[r * TS:(r + 1) * TS] = block_mean(pg.sample(X.ravel(), Y.ravel()).reshape(X.shape), SUPER)
    for z in range(Z_ILLUM120, -1, -1):
        save_tiles('illum120', z, mos, 0, 0, 'illum', stats)
        if z:
            mos = downsample(mos)
    return {'path': 'tiles/illum120/{z}/{x}/{y}.png', 'maxNativeZoom': Z_ILLUM120, 'edges': ILLUM_EDGES, 'colors': ILLUM_COLORS,
            'label': 'Average illumination (published NASA PGDA map, 120 m/px)',
            'source': 'NASA PGDA product 69, LOLA AVGVISIB_75S_120M_201608 (Mazarico et al. 2011, Icarus 211, 1066-1081), 120 m/px, 75S-90S; shown on %.0f m pixels' % pix(Z_ILLUM120),
            'url': 'https://pgda.gsfc.nasa.gov/products/69',
            'halfExtent_m': pg.half,
            'note': 'Outer layer: used where the 60 m product does not reach (about 80-85S). Same two wordings in its label as the 60 m map ("percentage of timesteps ... sunlit (by any fraction of the solar disc)" and "average solar disc visibility"). Coarser than the 60 m map.'}


def add_illum120_to_meta():
    path = os.path.join(ROOT, 'data', 'tiles_meta.js')
    txt = open(path).read()
    meta = json.loads(txt[txt.index('= ') + 2:txt.rstrip().rindex(';')])
    d = os.path.join(OUT, 'illum120')
    if os.path.isdir(d):
        shutil.rmtree(d)
    stats = {}
    meta['layers']['illum120'] = build_illum120(stats)
    meta['layers']['illum']['halfExtent_m'] = PGDAMap().half
    meta['sizes_bytes']['illum120'] = stats['illum120']
    meta['tileCounts']['illum120'] = stats['illum120_n']
    with open(path, 'w') as f:
        f.write('// Generated by tools/tiles.py\nwindow.LUNA_TILES = %s;\n' % json.dumps(meta))
    print('illum120: %d tiles, %.1f MB' % (stats['illum120_n'], stats['illum120'] / 1e6))


def tile_range(half, z):
    """Tile index range [t0, t1) covering |x|,|y| <= half at zoom z."""
    span = TS * pix(z)
    t0 = int(math.floor((H - half) / span))
    t1 = int(math.ceil((H + half) / span))
    return max(0, t0), min(2 ** z, t1)


def build():
    t_start = time.time()
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    stats = {}
    n = 2 ** Z_BASE
    # ---- base: hillshade + slope, z5 whole square
    print('z%d hillshade + slope (%d x %d tiles)...' % (Z_BASE, n, n))
    hill, slope = render_rows(Z_BASE, 0, n, 0, n, True)
    for z in range(Z_BASE, -1, -1):
        save_tiles('hill', z, hill, 0, 0, 'hill', stats)
        save_tiles('slope', z, slope, 0, 0, 'slope', stats)
        if z:
            hill, slope = downsample(hill), downsample(slope)
    del hill, slope
    # ---- detail hillshade
    d85 = T.dems()[0]
    ranges = {}
    for z, half in ((Z_DETAIL, d85.half_extent), (Z_POLE, POLE_HALF)):
        t0, t1 = tile_range(half, z)
        ranges[z] = [t0, t1 - 1, t0, t1 - 1]
        print('z%d hillshade detail tiles %d..%d (%d tiles)...' % (z, t0, t1 - 1, (t1 - t0) ** 2))
        for ty in range(t0, t1):            # row by row
            h, _ = render_rows(z, t0, t1, ty, ty + 1, False)
            save_tiles('hill', z, h, t0, ty, 'hill', stats)
    # ---- published illumination map
    pg = PGDAMap()
    t0, t1 = tile_range(pg.half, Z_BASE)
    print('z%d PGDA illumination tiles %d..%d...' % (Z_BASE, t0, t1 - 1))
    xs, ys, s = grid(Z_BASE, t0, t0, t1 - t0, t1 - t0, SUPER, 0)
    mos = np.zeros((len(ys) // SUPER, len(xs) // SUPER), np.float32)
    for r in range(t1 - t0):
        yy = ys[r * TS * SUPER:(r + 1) * TS * SUPER]
        X, Y = np.meshgrid(xs, yy)
        v = pg.sample(X.ravel(), Y.ravel()).reshape(X.shape)
        mos[r * TS:(r + 1) * TS] = block_mean(v, SUPER)   # nanmean: edge pixels keep partial coverage
    illum_ranges = {}
    tt0, tt1 = t0, t1
    z = Z_BASE
    while True:
        illum_ranges[z] = [tt0, tt1 - 1, tt0, tt1 - 1]
        save_tiles('illum', z, mos, tt0, tt0, 'illum', stats)
        if z == 0:
            break
        # align the block to even tile indices before downsampling
        if tt0 % 2:
            mos = np.pad(mos, ((TS, 0), (TS, 0)), constant_values=np.nan); tt0 -= 1
        if (tt1 - tt0) % 2:
            mos = np.pad(mos, ((0, TS), (0, TS)), constant_values=np.nan); tt1 += 1
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', RuntimeWarning)
            mos = downsample(mos)
        tt0 //= 2; tt1 //= 2; z -= 1
    illum120 = build_illum120(stats)
    meta = {
        'halfExtent_m': H, 'tileSize': TS,
        'projection': 'Polar stereographic (spherical R = 1737.4 km), centre -90, lon 0 up, 90E right; x = r sin(lon), y = r cos(lon), r = 2R tan((90-|lat|)/2). Same grid as the LOLA PDS products and tools/terrain.py.',
        'pixelSize_m': {str(z): pix(z) for z in range(Z_POLE + 1)},
        'layers': {
            'hill': {'path': 'tiles/hill/{z}/{x}/{y}.jpg', 'maxNativeZoom': Z_POLE, 'full': [0, Z_BASE], 'ranges': {str(k): v for k, v in ranges.items()},
                     'label': 'Hillshade (synthetic lighting, not real illumination)',
                     'source': 'LOLA LDEM_85S_20M (20 m/px, inside ~85S), LDEM_80S_80M (80 m/px), LDEM_75S_120M (120 m/px, map corners)',
                     'note': 'Light from the map upper-left at 25 deg altitude; brightness also tinted slightly by height. Not a real Sun position.'},
            'slope': {'path': 'tiles/slope/{z}/{x}/{y}.png', 'maxNativeZoom': Z_BASE, 'edges': SLOPE_EDGES, 'colors': SLOPE_COLORS,
                      'label': 'Slope (degrees, from the LOLA DEM)',
                      'note': 'Slope computed from the DEM by central differences on a 37 m sample grid (zoom 5), averaged to 74 m pixels; coarser zooms are averages. Source DEM resolution 20 m inside ~85S, 80 m to ~80S, 120 m in the corners. Local slopes over a few metres (boulders, small craters) can be much steeper.'},
            'illum': {'path': 'tiles/illum/{z}/{x}/{y}.png', 'maxNativeZoom': Z_BASE, 'edges': ILLUM_EDGES, 'colors': ILLUM_COLORS, 'ranges': {str(k): v for k, v in illum_ranges.items()},
                      'label': 'Average illumination (published NASA PGDA map)',
                      'source': 'NASA PGDA product 69, LOLA AVGVISIB_85S_060M_201608 (Mazarico et al. 2011, Icarus 211, 1066-1081), 60 m/px, ~85S-90S',
                      'url': 'https://pgda.gsfc.nasa.gov/products/69',
                      'halfExtent_m': pg.half,
                      'note': 'Average solar illumination over hourly time steps spanning 18.6 years (PGDA). The label calls it both "percentage of timesteps ... sunlit (by any fraction of the solar disc)" and "average solar disc visibility". 0 = permanent shadow. Covers only ~85S-90S.'},
            'illum120': illum120
        },
        'sizes_bytes': {k: v for k, v in stats.items() if not k.endswith('_n')},
        'tileCounts': {k[:-2]: v for k, v in stats.items() if k.endswith('_n')},
        'generator': 'tools/tiles.py'
    }
    with open(os.path.join(ROOT, 'data', 'tiles_meta.js'), 'w') as f:
        f.write('// Generated by tools/tiles.py\nwindow.LUNA_TILES = %s;\n' % json.dumps(meta))
    tot = sum(v for k, v in stats.items() if not k.endswith('_n'))
    print('done in %.0f s; sizes:' % (time.time() - t_start), {k: (round(v / 1e6, 1) if not k.endswith('_n') else v) for k, v in stats.items()}, 'total %.1f MB' % (tot / 1e6))


def check():
    """Georeference check: the tile pixel containing a site, at zoom 5, has the DEM height of that site
    within the pixel's height spread, and the inverse projection returns the site."""
    pts = [('Shackleton centre (IAU)', -89.67, 129.78), ('IM-1', -80.13, 1.44), ('Haworth (IAU)', -87.45, -5.17),
           ('Cabeus B (IAU)', -82.26, -54.58), ('Peak near Shackleton', -88.79, 124.5)]
    z = Z_BASE
    ok = True
    for name, lat, lon in pts:
        x, y = T.PolarDEM.xy(np.array([lat]), np.array([lon]))
        gx = (x[0] + H) / pix(z); gy = (H - y[0]) / pix(z)         # global pixel coords at z
        i, j = int(gx), int(gy)
        cx = -H + (i + 0.5) * pix(z); cy = H - (j + 0.5) * pix(z)   # that pixel's centre
        d = math.hypot(cx - x[0], cy - y[0])
        h_site = sample_height(x, y)[0]
        h_pix = sample_height(np.array([cx]), np.array([cy]))[0]
        r = math.hypot(cx, cy)
        lat2 = -90 + math.degrees(2 * math.atan(0.5 * r / T.R_M)); lon2 = math.degrees(math.atan2(cx, cy))
        good = d <= pix(z) * 0.71 + 1e-6
        ok &= good
        print('%-24s tile z%d (%d,%d) px (%d,%d); pixel centre %.0f m from site; heights site %.0f / pixel %.0f m; pixel centre -> %.4f, %.4f  %s' % (
            name, z, i // TS, j // TS, i % TS, j % TS, d, h_site, h_pix, lat2, lon2, 'OK' if good else 'FAIL'))
    # Shackleton floor must be a local minimum: compare with points 10 km away
    x, y = T.PolarDEM.xy(np.array([-89.67]), np.array([129.78]))
    ring = [sample_height(np.array([x[0] + 10000 * math.cos(a)]), np.array([y[0] + 10000 * math.sin(a)]))[0] for a in np.linspace(0, 2 * math.pi, 12, endpoint=False)]
    floor = sample_height(x, y)[0]
    good = floor < min(ring) - 1500
    print('Shackleton floor %.0f m vs rim ring (10 km) min %.0f m: %s' % (floor, min(ring), 'OK (deep bowl at the IAU centre)' if good else 'FAIL'))
    ok &= good
    print('TILE GEOREFERENCE CHECK', 'PASS' if ok else 'FAIL')
    return ok


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'check':
        sys.exit(0 if check() else 1)
    if len(sys.argv) > 1 and sys.argv[1] == 'illum120':
        add_illum120_to_meta()
        sys.exit(0)
    build()
    check()
