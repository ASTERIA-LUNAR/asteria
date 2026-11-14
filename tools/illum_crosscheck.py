# Generated with Claude Code (Anthropic) under human direction.
"""
Terrain illumination cross-check against the published LOLA average-illumination product
(Mazarico et al. 2011 method; PGDA product AVGVISIB_85S_060M_201608).

Inputs:
  dem/work/sun_18p6y.bin   hourly apparent Sun direction (Moon body-fixed) + distance from
                           tools/export_sun_vectors.js (validated ASTERIA engine)
  dem/ldem_*.img           LOLA DEMs (horizon masks, via tools/terrain.py)
  dem/pgda/AVGVISIB_85S_060M_201608.IMG   published average illumination map (60 m/px)

Outputs: data/illum_crosscheck.js (window.LUNA_XCHECK) used by the app and VALIDATION_REPORT.md.

Usage: .venv/Scripts/python -I tools/illum_crosscheck.py          # everything (~10 min)
       .venv/Scripts/python -I tools/illum_crosscheck.py sites    # per-site rows only
       .venv/Scripts/python -I tools/illum_crosscheck.py pgda120  # add the 120 m map (AVGVISIB_75S_120M_201608,
                                                                  # 75-90S) value at each site to the rows
"""
import json
import math
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain as T  # noqa: E402

ROOT = T.ROOT
SUN_R_KM = 695700.0
PUB_LAT, PUB_LON = -88.79, 124.5
HEIGHTS = [2.0, 10.0]
GRID_STEP, GRID_RADIUS = 50.0, 500.0
YEAR_END_MS = 1830297600000.0  # 2028-01-01T00:00:00Z


def load_sun():
    raw = np.fromfile(os.path.join(ROOT, 'dem', 'work', 'sun_18p6y.bin'), dtype='<f8').reshape(-1, 5)
    return raw[:, 0], raw[:, 1:4], raw[:, 4]


class PGDA:
    """Published average-illumination map (same polar stereographic grid convention as LOLA)."""
    def __init__(self, product='AVGVISIB_85S_060M_201608'):
        base = os.path.join(ROOT, 'dem', 'pgda', product)
        lbl = T.read_label(base + '.LBL')
        self.n, self.scale = lbl['lines'], lbl['scale']
        assert lbl['line_off'] == self.n / 2 - 0.5
        self.v = np.fromfile(base + '.IMG', dtype='<i2').reshape(self.n, self.n).astype(np.float64) * lbl['factor']

    def sample(self, lat, lon):
        x, y = T.PolarDEM.xy(np.array([lat]), np.array([lon]))
        i = x[0] / self.scale + self.n / 2 - 0.5
        j = -y[0] / self.scale + self.n / 2 - 0.5
        i0, j0 = int(math.floor(i)), int(math.floor(j))
        if i0 < 0 or j0 < 0 or i0 >= self.n - 1 or j0 >= self.n - 1:
            return None, None          # outside the published map
        fi, fj = i - i0, j - j0
        v = self.v
        bil = (v[j0, i0] * (1 - fi) * (1 - fj) + v[j0, i0 + 1] * fi * (1 - fj) +
               v[j0 + 1, i0] * (1 - fi) * fj + v[j0 + 1, i0 + 1] * fi * fj)
        near = v[int(round(j)), int(round(i))]
        return float(bil), float(near)


def illumination(lat, lon, mask, bf, dist, sel):
    """Return (avg disk fraction, % centre up, % any part up) over records in sel."""
    la, lo = math.radians(lat), math.radians(lon)
    up = np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    ea = np.array([-math.sin(lo), math.cos(lo), 0.0])
    no = np.array([-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la)])
    b = bf[sel]
    el = np.degrees(np.arcsin(np.clip(b @ up, -1, 1)))
    az = np.degrees(np.arctan2(b @ ea, b @ no)) % 360.0
    i = np.floor(az).astype(int) % 360
    f = az - np.floor(az)
    hz = mask[i] * (1 - f) + mask[(i + 1) % 360] * f
    r = np.degrees(np.arcsin(SUN_R_KM / dist[sel]))
    y0 = hz - el
    frac = np.where(y0 >= r, 0.0, np.where(y0 <= -r, 1.0, 0.0))
    m = (y0 > -r) & (y0 < r)
    yy = y0[m]; rr = r[m]
    frac[m] = (rr * rr * np.arccos(yy / rr) - yy * np.sqrt(rr * rr - yy * yy)) / (math.pi * rr * rr)
    return float(frac.mean()), float(100 * (el > hz).mean()), float(100 * (el + r > hz).mean())


def mask_at(lat, lon, h_obs):
    T.OBS_HEIGHT_M = h_obs
    e, reach, h0, prod = T.horizon_mask(lat, lon)
    return e, h0


def offset(dn, de):
    lat = PUB_LAT + math.degrees(dn / T.R_M)
    lon = PUB_LON + math.degrees(de / (T.R_M * math.cos(math.radians(PUB_LAT))))
    return lat, lon


def main():
    t, bf, dist = load_sun()
    all_sel = np.ones(t.size, bool)
    yr_sel = t < YEAR_END_MS
    span = '%s to %s' % (time.strftime('%Y-%m-%d', time.gmtime(t[0] / 1000)), time.strftime('%Y-%m-%d', time.gmtime(t[-1] / 1000)))
    pg = PGDA()
    t_start = time.time()
    out = {'pubLat': PUB_LAT, 'pubLon': PUB_LON, 'span': span, 'records': int(t.size), 'stepMin': 60,
           'pgdaProduct': 'AVGVISIB_85S_060M_201608', 'central': [], 'grid': {}, 'sites': []}
    # 1) the published point itself
    pub_b, pub_n = pg.sample(PUB_LAT, PUB_LON)
    out['pgdaAtPoint'] = {'bilinear': pub_b, 'nearest': pub_n}
    for h in HEIGHTS:
        mask, h0 = mask_at(PUB_LAT, PUB_LON, h)
        for label, sel in (('2027', yr_sel), ('18.6 yr', all_sel)):
            fr, cen, anyp = illumination(PUB_LAT, PUB_LON, mask, bf, dist, sel)
            out['central'].append({'height_m': h, 'period': label, 'avgDiskFrac': fr, 'pctCentre': cen, 'pctAnyPart': anyp, 'terrain_m': h0})
            print('central h=%4.1f %-8s disk %.3f  centre %.1f%%  any %.1f%%' % (h, label, fr, cen, anyp))
    # 2) neighbourhood scan (18.6-yr span)
    for h in HEIGHTS:
        pts = []
        rng = np.arange(-GRID_RADIUS, GRID_RADIUS + 1, GRID_STEP)
        for dn in rng:
            for de in rng:
                if math.hypot(dn, de) > GRID_RADIUS + 1e-6:
                    continue
                lat, lon = offset(dn, de)
                mask, h0 = mask_at(lat, lon, h)
                fr, cen, anyp = illumination(lat, lon, mask, bf, dist, all_sel)
                pb, _ = pg.sample(lat, lon)
                pts.append({'dn': float(dn), 'de': float(de), 'lat': lat, 'lon': lon, 'terrain_m': h0,
                            'avgDiskFrac': fr, 'pctCentre': cen, 'pctAnyPart': anyp, 'pgda': pb})
        best = max(pts, key=lambda p: p['avgDiskFrac'])
        best_pg = max(pts, key=lambda p: p['pgda'])
        corr = float(np.corrcoef([p['avgDiskFrac'] for p in pts], [p['pgda'] for p in pts])[0, 1])
        out['grid'][str(h)] = {'n': len(pts), 'best': best, 'bestByPgda': best_pg, 'corrWithPgda': corr,
                               'min': min(p['avgDiskFrac'] for p in pts), 'points': pts}
        print('grid h=%4.1f n=%d best disk %.3f at (%.5f, %.4f) dn=%d de=%d | PGDA there %.3f | PGDA max %.3f at dn=%d de=%d | r=%.2f' % (
            h, len(pts), best['avgDiskFrac'], best['lat'], best['lon'], best['dn'], best['de'], best['pgda'],
            best_pg['pgda'], best_pg['dn'], best_pg['de'], corr))
    # 3) all curated terrain sites (same set as tools/terrain.py horizons), observer 2 m, 18.6 yr
    out['sites'] = site_rows(bf, dist, all_sel, pg)
    out['runtime_s'] = round(time.time() - t_start)
    write(out)


def site_rows(bf, dist, sel, pg):
    rows = []
    for s in T.load_sites():
        if s['lat'] > -79.5:          # same selection as terrain.py horizons
            continue
        mask, h0 = mask_at(s['lat'], s['lon'], 2.0)
        fr, cen, anyp = illumination(s['lat'], s['lon'], mask, bf, dist, sel)
        pb, pn = pg.sample(s['lat'], s['lon'])
        rows.append({'id': s['id'], 'lat': s['lat'], 'lon': s['lon'], 'avgDiskFrac': fr, 'pctCentre': cen,
                     'pctAnyPart': anyp, 'pgda': pb, 'pgdaNearest': pn})
        print('site %-18s disk %.3f centre %.1f any %.1f | PGDA %s' % (s['id'], fr, cen, anyp, 'outside map' if pb is None else '%.3f (nearest %.3f)' % (pb, pn)))
    T.OBS_HEIGHT_M = 2.0
    return rows


def write(out):
    with open(os.path.join(ROOT, 'data', 'illum_crosscheck.js'), 'w') as f:
        f.write('// Generated by tools/illum_crosscheck.py\nwindow.LUNA_XCHECK = %s;\n' % json.dumps(out))


def sites_only():
    """Recompute only the per-site rows (e.g. after adding sites); keeps the central/grid results."""
    path = os.path.join(ROOT, 'data', 'illum_crosscheck.js')
    txt = open(path).read()
    out = json.loads(txt[txt.index('= ') + 2:txt.rstrip().rindex(';')])
    t, bf, dist = load_sun()
    out['sites'] = site_rows(bf, dist, np.ones(t.size, bool), PGDA())
    write(out)


def pgda120():
    """Add the coarser 120 m published map (covers 75-90S, so also the sites outside the 60 m map)."""
    path = os.path.join(ROOT, 'data', 'illum_crosscheck.js')
    txt = open(path).read()
    out = json.loads(txt[txt.index('= ') + 2:txt.rstrip().rindex(';')])
    pg = PGDA('AVGVISIB_75S_120M_201608')
    for s in out['sites']:
        b, n = pg.sample(s['lat'], s['lon'])
        s['pgda120'], s['pgda120Nearest'] = b, n
        print('%-20s 60 m map %s | 120 m map %.3f' % (s['id'], 'outside' if s['pgda'] is None else '%.3f' % s['pgda'], b))
    out['pgda120Product'] = 'AVGVISIB_75S_120M_201608'
    write(out)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'pgda120':
        pgda120()
    elif len(sys.argv) > 1 and sys.argv[1] == 'sites':
        sites_only()
    else:
        main()
