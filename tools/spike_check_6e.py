"""
ASTERIA - round 6E Part 0a: isolated spikes in the 5 m patches (LDEM_875S_5M, preliminary) - a read-only check.
Generated with Claude Code (Anthropic) under human direction.

Nothing is edited or filtered. For a given point it prints the 5 m nodes around it next to LDEM_85S_20M and
LDEM_80S_80M; then it scans the 2 km patch of every 5 m site for nodes that stand far above all 8 neighbours and
above the 20 m product at the same place.

Usage:  .venv/Scripts/python -I tools/spike_check_6e.py [lat lon]   (default: the cone near Peak near Shackleton)
Output: tests/spikes_6e.json
"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain as T                 # noqa: E402
from terrain3d_ext import Window5m  # noqa: E402

SITES = ['peak_shackleton', 'peak_shackleton_lw', 'shackleton_centre']
# a node is listed when it is >= MIN_ABOVE m above the highest of its 8 neighbours AND >= MIN_VS20 m above LDEM_85S_20M
MIN_ABOVE, MIN_VS20 = 2.0, 10.0


def ll(x, y):
    r = math.hypot(x, y)
    return -(90 - math.degrees(2 * math.atan(r / (2 * T.R_M)))), math.degrees(math.atan2(x, y)) % 360


def xy_of_node(w, i, j):
    return (i + 0.5 - w.n / 2) * w.scale, -((j + w.j0) + 0.5 - w.n / 2) * w.scale


def main():
    lat, lon = (float(sys.argv[1]), float(sys.argv[2])) if len(sys.argv) > 2 else (-88.7618, 125.1504)
    d20, d80 = T.PolarDEM('ldem_85s_20m'), T.PolarDEM('ldem_80s_80m')
    out = {'point': {'lat': lat, 'lon': lon}, 'criteria': {'min_above_8_neighbours_m': MIN_ABOVE, 'min_above_20m_m': MIN_VS20}}
    w = Window5m('peak_shackleton_lw')
    x, y = T.PolarDEM.xy(np.array([lat]), np.array([lon]))
    fi = x[0] / w.scale + w.n / 2 - 0.5; fj = -y[0] / w.scale + w.n / 2 - 0.5 - w.j0
    # the highest 5 m node within 15 m of the point is the peak of the cone
    ci, cj = int(round(fi)), int(round(fj))
    sub = w.h[cj - 3:cj + 4, ci - 3:ci + 4]
    dj, di = np.unravel_index(np.argmax(sub), sub.shape)
    pj, pi = cj - 3 + dj, ci - 3 + di
    px, py = xy_of_node(w, pi, pj)
    plat, plon = ll(px, py)
    prof = {}
    for name, ang in (('east_west', 0.0), ('north_south', 90.0)):
        rows = []
        for k in range(-12, 13):
            if ang == 0.0:
                ii, jj = pi + k, pj
            else:
                ii, jj = pi, pj + k
            nx, ny = xy_of_node(w, ii, jj)
            rows.append({'offset_m': k * 5, 'h5': float(w.h[jj, ii]), 'h20': float(d20.sample(nx, ny)), 'h80': float(d80.sample(nx, ny))})
        prof[name] = rows
    nb = w.h[pj - 1:pj + 2, pi - 1:pi + 2].copy(); c = float(nb[1, 1]); nb[1, 1] = np.nan
    ring2 = np.concatenate([w.h[pj - 4, pi - 4:pi + 5], w.h[pj + 4, pi - 4:pi + 5], w.h[pj - 4:pj + 5, pi - 4], w.h[pj - 4:pj + 5, pi + 4]])
    ring6 = np.concatenate([w.h[pj - 12, pi - 12:pi + 13], w.h[pj + 12, pi - 12:pi + 13], w.h[pj - 12:pj + 13, pi - 12], w.h[pj - 12:pj + 13, pi + 12]])
    # same neighbourhood in the 20 m grid: the nearest 20 m node and its 8 neighbours
    i20, j20 = d20.ij(px, py); i20, j20 = int(round(i20)), int(round(j20))
    g20 = d20.h[j20 - 1:j20 + 2, i20 - 1:i20 + 2]
    out['cone'] = {'peak_node_lat': plat, 'peak_node_lon': plon, 'h5_peak': c, 'h5_8nb_max': float(np.nanmax(nb)), 'h5_8nb_mean': float(np.nanmean(nb)),
                   'h5_ring_20m_mean': float(ring2.mean()), 'h5_ring_60m_mean': float(ring6.mean()),
                   'h20_at_peak': float(d20.sample(px, py)), 'h80_at_peak': float(d80.sample(px, py)),
                   'h20_3x3_nodes': g20.tolist(), 'h20_3x3_max': float(g20.max()),
                   'h5_9x9_nodes': w.h[pj - 4:pj + 5, pi - 4:pi + 5].tolist(), 'profiles': prof}
    # scan every 5 m patch (2 km x 2 km around the site)
    scan = {}
    for sid in SITES:
        ws = w if sid == 'peak_shackleton_lw' else Window5m(sid)
        m = json.load(open(os.path.join(T.DEM_DIR, 'dl5m', sid + '_rows.json')))
        si, sj = m['site_ij']; sj -= ws.j0
        i0, i1 = int(si) - 201, int(si) + 202
        j0, j1 = max(1, int(sj) - 201), min(ws.h.shape[0] - 2, int(sj) + 202)
        H = ws.h[j0 - 1:j1 + 2, i0 - 1:i1 + 2]
        C = H[1:-1, 1:-1]
        nbmax = np.max(np.stack([H[1 + a:H.shape[0] - 1 + a, 1 + b:H.shape[1] - 1 + b] for a in (-1, 0, 1) for b in (-1, 0, 1) if a or b]), axis=0)
        cand = np.argwhere(C - nbmax >= MIN_ABOVE)
        hits = []
        for (a, b) in cand:
            jj, ii = j0 + a, i0 + b
            nx, ny = xy_of_node(ws, ii, jj)
            h20 = float(d20.sample(nx, ny))
            if C[a, b] - h20 >= MIN_VS20:
                la, lo = ll(nx, ny)
                hits.append({'lat': round(la, 5), 'lon': round(lo, 4), 'h5': float(C[a, b]), 'above_8nb_max': float(C[a, b] - nbmax[a, b]),
                             'above_20m': round(float(C[a, b] - h20), 1),
                             'dist_from_site_m': round(math.hypot(ii - si, jj - sj) * ws.scale)})
        nodes_above = int((C - nbmax >= MIN_ABOVE).sum())
        scan[sid] = {'nodes_scanned': int(C.size), 'nodes_2m_above_all_8_neighbours': nodes_above, 'spikes': sorted(hits, key=lambda h: -h['above_20m'])}
    out['scan'] = scan
    p = os.path.join(T.ROOT, 'tests', 'spikes_6e.json')
    json.dump(out, open(p, 'w'), indent=1)
    cc = out['cone']
    print('cone peak node %.5f %.4f  h5 %.1f  8-nb max %.1f mean %.1f  ring20m %.1f ring60m %.1f  h20 %.1f (3x3 max %.1f)  h80 %.1f' % (
        cc['peak_node_lat'], cc['peak_node_lon'], cc['h5_peak'], cc['h5_8nb_max'], cc['h5_8nb_mean'], cc['h5_ring_20m_mean'], cc['h5_ring_60m_mean'], cc['h20_at_peak'], cc['h20_3x3_max'], cc['h80_at_peak']))
    for k, r in prof.items():
        print(k, ' '.join('%d:%.0f/%.0f' % (q['offset_m'], q['h5'], q['h20']) for q in r))
    for sid, s in scan.items():
        print(sid, s['nodes_scanned'], 'nodes; >=2 m above all 8 nb:', s['nodes_2m_above_all_8_neighbours'], '; spikes:', len(s['spikes']))
        for h in s['spikes'][:12]:
            print('   ', h)
    print('wrote', p)


if __name__ == '__main__':
    main()
