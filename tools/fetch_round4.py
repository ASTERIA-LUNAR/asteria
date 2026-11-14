# Generated with Claude Code (Anthropic) under human direction.
"""
ASTERIA - download the round-4 inputs for the 3D view (not shipped; outputs go to dem/, which git ignores).

  1. LDEM_875S_5M windows (PDS Geosciences Node, LOLA GDR polar, 5 m/pix, 87.5S to the pole, int16 x 0.5 m):
     only the rows around the curated sites inside its coverage are fetched with HTTP Range requests
     (the full file is 1.84 GB). Each window: rows j0..j1 (all 30336 columns), saved as dem/dl5m/<site>_rows.bin
     with dem/dl5m/<site>_rows.json (j0, j1).
  2. Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren 1991; CDS catalogue V/50, public domain),
     copy distributed by the Harvard-Smithsonian CfA: dem/stars/bsc5.dat.gz
  3. NASA Blue Marble Next Generation, topography and bathymetry, July 2004 (cloud-free monthly composite; NASA
     Earth Observatory, public domain NASA imagery): dem/earth/world.topo.bathy.200407.3x5400x2700.jpg

Usage: .venv/Scripts/python -I tools/fetch_round4.py [5m|stars|earth|all]
"""
import json
import math
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R_M = 1737400.0
URL_5M = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.img'
N5, SCALE5 = 30336, 5.0
URL_BSC = 'http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz'   # Harvard/SAO copy of CDS V/50 (cdsarc did not answer)
URL_EARTH = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg'
SITES_5M = {  # curated sites inside 87.5S (data/sites.js)
    'peak_shackleton': (-88.79, 124.5),
    'peak_shackleton_lw': (-88.7851, 124.3438),
    'shackleton_centre': (-89.67, 129.78),
}
HALF_M = 1400.0   # window half-size (the 3D patch is 2 km x 2 km; margin for interpolation)
UA = {'User-Agent': 'asteria-data-fetch/1.0'}


def get(url, path, rng=None):
    req = urllib.request.Request(url, headers=dict(UA, **({'Range': 'bytes=%d-%d' % rng} if rng else {})))
    with urllib.request.urlopen(req, timeout=300) as r, open(path + '.part', 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    os.replace(path + '.part', path)


def ij(lat, lon):
    r = 2 * R_M * math.tan(math.radians(90 - abs(lat)) / 2)
    x, y = r * math.sin(math.radians(lon)), r * math.cos(math.radians(lon))
    return x / SCALE5 + N5 / 2 - 0.5, -y / SCALE5 + N5 / 2 - 0.5


def fetch_5m():
    d = os.path.join(ROOT, 'dem', 'dl5m'); os.makedirs(d, exist_ok=True)
    for sid, (lat, lon) in SITES_5M.items():
        out = os.path.join(d, sid + '_rows.bin')
        i, j = ij(lat, lon)
        h = int(HALF_M * 1.01 / SCALE5) + 3   # stereographic scale factor near the pole is ~1.0001
        j0, j1 = int(j) - h, int(j) + h
        meta = {'j0': j0, 'j1': j1, 'n': N5, 'scale_m': SCALE5, 'source': URL_5M, 'site_ij': [i, j]}
        if os.path.exists(out) and os.path.getsize(out) == (j1 - j0 + 1) * N5 * 2:
            print(sid, 'already there'); continue
        print(sid, 'rows', j0, j1, '(%.1f MB)' % ((j1 - j0 + 1) * N5 * 2 / 1e6), flush=True)
        get(URL_5M, out, (j0 * N5 * 2, (j1 + 1) * N5 * 2 - 1))
        assert os.path.getsize(out) == (j1 - j0 + 1) * N5 * 2, 'short download'
        json.dump(meta, open(os.path.join(d, sid + '_rows.json'), 'w'))


def fetch_stars():
    d = os.path.join(ROOT, 'dem', 'stars'); os.makedirs(d, exist_ok=True)
    get(URL_BSC, os.path.join(d, 'bsc5.dat.gz')); print('BSC ok')


def fetch_earth():
    d = os.path.join(ROOT, 'dem', 'earth'); os.makedirs(d, exist_ok=True)
    get(URL_EARTH, os.path.join(d, 'world.topo.bathy.200407.3x5400x2700.jpg')); print('Blue Marble ok')


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what in ('stars', 'all'): fetch_stars()
    if what in ('earth', 'all'): fetch_earth()
    if what in ('5m', 'all'): fetch_5m()
