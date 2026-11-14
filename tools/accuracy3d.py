"""
ASTERIA - independent Python side of the 3D terrain accuracy check (round 5, Part 2).
Generated with Claude Code (Anthropic) under human direction.

Called by tests/accuracy3d.js:  .venv/Scripts/python -I tools/accuracy3d.py <points.json> <out.json>
  heights   : EVERY grid point of every 3D product (data/terrain3d/<site>.js, ext/<site>_a/_b/_af/_bf.js, hi5m/<site>.js) vs a
              bilinear sample of the source LOLA DEM. Node positions from the site's up vector rotated by the ground
              distance (vectorised form of terrain3d.node_latlon_vector, not the great-circle routine of the generators).
  slopes    : central differences over the grid spacing d of DEM heights sampled at the geographic positions of
              (e +- d, n) and (e, n +- d); and the 2D map's slope layer: the PNG class of the zoom-5 pixel and a
              reproduction of that pixel (np.gradient on 37.1 m samples, mean of 2 x 2 samples, as tools/tiles.py).
  positions : true rover position -> stereographic x, y; distance to the projected displayed lat/lon; DEM height at
              the displayed lat/lon.
"""
import base64
import json
import math
import os
import re
import sys
from datetime import datetime, timezone

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain as T             # noqa: E402
import terrain3d_ext as TX      # noqa: E402  (Window5m: rows of LDEM_875S_5M fetched by tools/fetch_round4.py)

ROOT = T.ROOT
R = T.R_M
D3 = os.path.join(ROOT, 'data', 'terrain3d')
MAP_H, MAP_TS = 304000.0, 256
SLOPE_EDGES = [0, 5, 10, 15, 20, 25, 30, 40, 91]


def load(path):
    txt = open(path, encoding='utf-8').read()
    return json.loads(re.search(r'\]\s*=\s*(\{.*\});', txt, re.S).group(1))


def latlon(lat0, lon0, e, n):
    """Vectorised: geographic position of ground point (e, n) (true ground metres east/north) of a site frame."""
    e, n = np.asarray(e, float), np.asarray(n, float)
    la, lo = math.radians(lat0), math.radians(lon0)
    up = np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    east = np.array([-math.sin(lo), math.cos(lo), 0.0])
    north = np.cross(up, east)
    s = np.hypot(e, n)
    th = s / R
    with np.errstate(invalid='ignore', divide='ignore'):
        se = np.where(s > 0, e / np.where(s > 0, s, 1), 0.0)
        sn = np.where(s > 0, n / np.where(s > 0, s, 1), 0.0)
    v = (np.cos(th)[..., None] * up + np.sin(th)[..., None] * (se[..., None] * east + sn[..., None] * north))
    return np.degrees(np.arcsin(np.clip(v[..., 2], -1, 1))), np.degrees(np.arctan2(v[..., 1], v[..., 0]))


def stereo(lat, lon):
    r = 2 * R * np.tan(np.radians(90 - np.abs(lat)) / 2)
    return r * np.sin(np.radians(lon)), r * np.cos(np.radians(lon))


def raw_bilinear(H, scale, n, j_off, x, y):
    """Bilinear sample of a raw PDS array (rows j_off.. of an n x n polar stereographic grid) at projected x, y."""
    fi = x / scale + n / 2 - 0.5
    fj = -y / scale + n / 2 - 0.5 - j_off
    i0, j0 = np.floor(fi).astype(np.int64), np.floor(fj).astype(np.int64)
    a, b = fi - i0, fj - j0
    return H[j0, i0] * (1 - a) * (1 - b) + H[j0, i0 + 1] * a * (1 - b) + H[j0 + 1, i0] * (1 - a) * b + H[j0 + 1, i0 + 1] * a * b


_W5 = {}
def sampler(product, sid):
    """Function (lat, lon) -> DEM height (m) of the named LOLA product."""
    if product == 'LDEM_875S_5M':
        if sid not in _W5:
            _W5[sid] = TX.Window5m(sid)
        w = _W5[sid]
        return lambda la, lo: raw_bilinear(w.h, w.scale, w.n, w.j0, *stereo(la, lo))
    d = {x.name: x for x in T.dems()}[product]
    return lambda la, lo: raw_bilinear(d.h, d.scale, d.n, 0, *stereo(la, lo))


def finest(x, y):
    h = np.full(np.shape(x), np.nan)
    for d in T.dems():
        miss = np.isnan(h)
        if not miss.any():
            break
        h[miss] = d.sample(np.asarray(x)[miss], np.asarray(y)[miss])
    return h


def heights():
    files = []
    ids = json.loads(re.search(r'=\s*(\[.*?\])', open(os.path.join(D3, 'index.js')).read(), re.S).group(1))
    for sid in ids:
        files.append((sid, 'tile', os.path.join(D3, sid + '.js')))
        for k, kind in (('a', 'ringA'), ('b', 'ringB'), ('af', 'ringAfine'), ('bf', 'ringBfine')):
            fp = os.path.join(D3, 'ext', '%s_%s.js' % (sid, k))
            if k in ('a', 'b') or os.path.exists(fp):      # round 6: finer rings where they exist
                files.append((sid, kind, fp))
        p5 = os.path.join(D3, 'hi5m', sid + '.js')
        if os.path.exists(p5):
            files.append((sid, 'patch5m', p5))
    rows = []
    for sid, kind, path in files:
        t = load(path)
        n, d = t['n'], t['spacing_m']
        q = np.frombuffer(base64.b64decode(t['b64']), dtype='<i2').reshape(n, n)
        Hs = t['offset_m'] + q.astype(np.float64) * t['unit_m']
        c = (n - 1) / 2
        I, J = np.meshgrid(np.arange(n), np.arange(n))
        la, lo = latlon(t['lat'], t['lon'], (I - c) * d, (c - J) * d)
        ref = sampler(t['demProduct'], sid)(la, lo)
        diff = np.abs(Hs - ref)
        rows.append({'siteId': sid, 'kind': kind, 'dem': t['demProduct'], 'points': int(n * n), 'spacing_m': d, 'unit_m': t['unit_m'],
                     'max': float(diff.max()), 'mean': float(diff.mean())})
        print('%-20s %-8s %-14s %7d pts  max %.3f m  mean %.3f m' % (sid, kind, t['demProduct'], n * n, diff.max(), diff.mean()))
    return rows


def slope_central(f, lat0, lon0, e, n, d):
    hE1 = f(*latlon(lat0, lon0, e + d, n)); hE0 = f(*latlon(lat0, lon0, e - d, n))
    hN1 = f(*latlon(lat0, lon0, e, n + d)); hN0 = f(*latlon(lat0, lon0, e, n - d))
    return math.degrees(math.atan(math.hypot((hE1 - hE0) / (2 * d), (hN1 - hN0) / (2 * d))))


_PNG = {}
def map_pixel(x, y):
    s5 = 2 * MAP_H / (MAP_TS * 32)
    I, J = int(math.floor((x + MAP_H) / s5)), int(math.floor((MAP_H - y) / s5))
    tx, ty, i, j = I // MAP_TS, J // MAP_TS, I % MAP_TS, J % MAP_TS
    key = (tx, ty)
    if key not in _PNG:
        _PNG[key] = Image.open(os.path.join(ROOT, 'tiles', 'slope', '5', str(tx), '%d.png' % ty))
    cls = _PNG[key].getpixel((i, j))
    # reproduction (tools/tiles.py): 2 x 2 samples at s = s5 / 2, slope by central differences (np.gradient), mean
    s = s5 / 2
    vals = []
    for kj in (0, 1):
        for ki in (0, 1):
            xs = -MAP_H + (2 * I + ki + 0.5) * s
            ys = MAP_H - (2 * J + kj + 0.5) * s
            hx1, hx0 = finest(np.array([xs + s]), np.array([ys]))[0], finest(np.array([xs - s]), np.array([ys]))[0]
            hy1, hy0 = finest(np.array([xs]), np.array([ys + s]))[0], finest(np.array([xs]), np.array([ys - s]))[0]
            vals.append(math.degrees(math.atan(math.hypot((hx1 - hx0) / (2 * s), (hy1 - hy0) / (2 * s)))))
    v = float(np.mean(vals))
    return cls, v, int(np.digitize([v], SLOPE_EDGES[1:-1])[0]), s


def slopes(P):
    out = []
    for p in P['slopes']:
        t = load(os.path.join(D3, p['siteId'] + '.js'))
        f = sampler(p['dem'], p['siteId'])
        py = slope_central(f, t['lat'], t['lon'], p['e'], p['n'], p['d'])
        r = {'py': py}
        if p['grid'] == 'tile':
            la, lo = latlon(t['lat'], t['lon'], p['e'], p['n'])
            x, y = stereo(la, lo)
            cls, v, cpy, s = map_pixel(float(x), float(y))
            # Python slope at 37 m spacing at the point itself, in the map's x/y frame (no 74 m averaging)
            hx1, hx0 = finest(np.array([x + s]), np.array([y]))[0], finest(np.array([x - s]), np.array([y]))[0]
            hy1, hy0 = finest(np.array([x]), np.array([y + s]))[0], finest(np.array([x]), np.array([y - s]))[0]
            r.update({'mapClassPng': int(cls), 'mapPy': v, 'mapClassPy': cpy, 'mapLo': SLOPE_EDGES[int(cls)], 'mapHi': SLOPE_EDGES[int(cls) + 1],
                      'py74': math.degrees(math.atan(math.hypot((hx1 - hx0) / (2 * s), (hy1 - hy0) / (2 * s))))})
        out.append(r)
    return out


def positions(P):
    out = []
    for p in P['positions']:
        la, lo = latlon(p['lat0'], p['lon0'], p['e'], p['n'])
        x, y = stereo(la, lo)
        back = math.hypot(float(x) - p['mapX'], float(y) - p['mapY'])
        f = sampler(p['dem'], p['siteId'])
        demH = float(f(np.array([float(p['latTxt'])]), np.array([float(p['lonTxt'])]))[0])
        out.append({'trueLat': float(la), 'trueLon': float(lo), 'backDist_m': back, 'demH': demH})
    return out


def main():
    P = json.load(open(sys.argv[1], encoding='utf-8'))
    res = {'generated': datetime.now(timezone.utc).isoformat(), 'pointsKey': P['pointsKey'], 'generator': 'tools/accuracy3d.py',
           'heights': heights(), 'slopes': slopes(P), 'positions': positions(P)}
    with open(sys.argv[2], 'w', encoding='utf-8') as fo:
        json.dump(res, fo, indent=1)


if __name__ == '__main__':
    main()
