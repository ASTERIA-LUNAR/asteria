# Illumination sensitivity around the published Peak-near-Shackleton point (-88.79, 124.5).
# Usage: .venv/Scripts/python -I tools/neighbourhood_check.py out.json  (then see GAPS_AND_ISSUES.md)
import os, sys, json, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain as T
lat0, lon0 = -88.79, 124.5
out = []
# grid +-400 m in 100 m steps (local north/east offsets)
for dn in range(-400, 401, 100):
    for de in range(-400, 401, 100):
        lat = lat0 + math.degrees(dn / T.R_M)
        lon = lon0 + math.degrees(de / (T.R_M * math.cos(math.radians(lat0))))
        e, r, h0, p = T.horizon_mask(lat, lon)
        out.append({'dn': dn, 'de': de, 'lat': lat, 'lon': lon, 'h': h0, 'mask': [float(x) for x in e]})
# consistency: for the base point, find az of max horizon, report 3D point of that max
s = T.distances(); th = s / T.R_M
az = int(np.argmax(out[40]['mask']))
la, lo = T.destination(lat0, lon0, az, s)
hh = np.array([T.height(a, b)[0] for a, b in zip(la[::25], lo[::25])])
ro = T.R_M + out[40]['h'] + 2
e = np.degrees(np.arctan2((T.R_M + hh) * np.cos(th[::25]) - ro, (T.R_M + hh) * np.sin(th[::25])))
k = int(np.nanargmax(e))
json.dump({'grid': out, 'check': {'az': az, 'el': float(e[k]), 'lat': float(la[::25][k]), 'lon': float(lo[::25][k]), 'h': float(hh[k]), 'h0': out[40]['h']}}, open(sys.argv[1], 'w'))
