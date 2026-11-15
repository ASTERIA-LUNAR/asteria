# ASTERIA - Validation Report

Generated 2026-11-15T09:08:37.261Z by `node tests/validate.js`. (The test code was generated with Claude Code (Anthropic) under human direction; see AI_DISCLOSURE.md.)

## Overall: **PASS**

| Part | Result | Detail |
|---|---|---|
| A. Angles vs JPL Horizons (52 comparisons) | PASS | elevation max 0.0038 deg / mean 0.0009 deg; azimuth max 0.0554 deg / mean 0.0025 deg |
| A. Event times vs Horizons (4 events) | PASS | max 0.76 min / mean 0.42 min |
| B. Physics sanity tests (5) | PASS | see below |
| E. Custom point, one-year check vs JPL Horizons (8761 hourly rows x 2 bodies) | PASS | elevation max 0.0028 deg; azimuth max 0.0039 deg; sunrise/sunset max 1.42 min; Earth min elevation 1.63 deg |
| F. Instant status check (independent: Horizons + Python terrain; 8 sites x 21 times x 2 bodies) | PASS | 336/336 agree; 3 on the edge (within 0.05 deg), 0 disagreements outside the edge |
| G. 3D terrain accuracy (every grid point vs LOLA; slopes; rover positions) | PASS | heights max 0.100 m over 14,499,574 points (limit 1 m); rover slope vs Python max diff 0.534 deg; 20 rover positions within one DEM cell and 1 m |
| C. Blind test vs JPL Horizons (5 new random cases, 10 comparisons, fetched fresh) | PASS | elevation max 0.0029 deg; azimuth max 0.0038 deg |

## Method

* **Our engine** (`js/engine.js`): Astronomy Engine 2.1.19 (VSOP87 Earth + Chapront lunar theory) for positions; IAU/WGCCRE Moon orientation model (`Astronomy.RotationAxis(Body.Moon)`) for the body-fixed frame; spherical Moon, R = 1737.4 km; site height 0 km; light-time correction (target at retarded time); first-order stellar aberration with the Moon's heliocentric velocity; no refraction. Elevation is measured from the plane perpendicular to the radial (local vertical) direction.
* **Reference**: JPL Horizons API (`https://ssd.jpl.nasa.gov/api/horizons.api`), `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='E-lon,lat,0'`, targets Sun (10) and Earth (399), `QUANTITIES='4'` (apparent azimuth/elevation), `APPARENT='AIRLESS'`, `TIME_TYPE='UT'`, `EXTRA_PREC='YES'`. Horizons reports the lunar frame as MEAN_ME (high precision, DE-based) with radii 1737.4 km. Horizons' quantity 4 also includes gravitational light deflection, which we omit (milli-arcsecond effect).
* Raw Horizons responses are cached in `tests/horizons_cache/` (first line of each file = the exact query URL).
* **Pass criteria**: |elevation error| < 0.1 deg; |azimuth error| < 0.2 deg, relaxed to 0.2 deg / cos(el) only when Horizons elevation > 80 deg (azimuth is ill-conditioned near the zenith: a tiny angular offset becomes a large azimuth change). Event times within 2 minutes.
* The highest Sun elevation in the test set is 89.02 deg.

## A. Angle comparison (ours vs Horizons)

| Site | lat | E-lon | UTC | Body | Az ours | Az Horizons | dAz | El ours | El Horizons | dEl | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Near south pole (test point) | -89.5 | 0 | 2026-12-01T00:00Z | Sun | 280.0470 | 280.0508 | -0.0038 | 1.5578 | 1.5575 | 0.0003 | PASS |
| Near south pole (test point) | -89.5 | 0 | 2026-12-01T00:00Z | Earth | 6.6652 | 6.6684 | -0.0032 | -1.1132 | -1.1136 | 0.0004 | PASS |
| Near south pole (test point) | -89.5 | 0 | 2027-04-17T06:30Z | Sun | 49.2599 | 49.2587 | 0.0013 | -1.1182 | -1.1181 | -0.0001 | PASS |
| Near south pole (test point) | -89.5 | 0 | 2027-04-17T06:30Z | Earth | 2.6918 | 2.6899 | 0.0019 | -2.3035 | -2.3036 | 0.0002 | PASS |
| Near south pole (test point) | -89.5 | 0 | 2027-11-03T15:00Z | Sun | 123.2881 | 123.2892 | -0.0011 | 1.2704 | 1.2713 | -0.0008 | PASS |
| Near south pole (test point) | -89.5 | 0 | 2027-11-03T15:00Z | Earth | 3.9165 | 3.9170 | -0.0005 | -2.5283 | -2.5284 | 0.0001 | PASS |
| Near south pole (test point) | -89.5 | 0 | 2028-07-22T21:45Z | Sun | 167.0743 | 167.0754 | -0.0010 | -0.3069 | -0.3066 | -0.0003 | PASS |
| Near south pole (test point) | -89.5 | 0 | 2028-07-22T21:45Z | Earth | 357.7951 | 357.7956 | -0.0004 | -1.8815 | -1.8811 | -0.0004 | PASS |
| Polar test point near Shackleton (test geometry) | -88.8 | 123.4 | 2026-12-01T00:00Z | Sun | 156.6677 | 156.6714 | -0.0038 | 0.3687 | 0.3683 | 0.0004 | PASS |
| Polar test point near Shackleton (test geometry) | -88.8 | 123.4 | 2026-12-01T00:00Z | Earth | 243.2966 | 243.2998 | -0.0032 | -2.1493 | -2.1496 | 0.0003 | PASS |
| Polar test point near Shackleton (test geometry) | -88.8 | 123.4 | 2027-04-17T06:30Z | Sun | 285.8942 | 285.8929 | 0.0013 | -1.1161 | -1.1161 | -0.0000 | PASS |
| Polar test point near Shackleton (test geometry) | -88.8 | 123.4 | 2027-04-17T06:30Z | Earth | 239.3440 | 239.3421 | 0.0019 | -3.4150 | -3.4152 | 0.0002 | PASS |
| Polar test point near Shackleton (test geometry) | -88.8 | 123.4 | 2027-11-03T15:00Z | Sun | 359.8777 | 359.8788 | -0.0011 | 2.7448 | 2.7457 | -0.0008 | PASS |
| Polar test point near Shackleton (test geometry) | -88.8 | 123.4 | 2027-11-03T15:00Z | Earth | 240.5741 | 240.5746 | -0.0005 | -3.6170 | -3.6171 | 0.0001 | PASS |
| Polar test point near Shackleton (test geometry) | -88.8 | 123.4 | 2028-07-22T21:45Z | Sun | 43.6833 | 43.6844 | -0.0010 | 1.0483 | 1.0486 | -0.0003 | PASS |
| Polar test point near Shackleton (test geometry) | -88.8 | 123.4 | 2028-07-22T21:45Z | Earth | 234.4364 | 234.4368 | -0.0004 | -3.0792 | -3.0788 | -0.0004 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2026-12-01T00:00Z | Sun | 268.6484 | 268.6487 | -0.0004 | -13.4261 | -13.4223 | -0.0038 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2026-12-01T00:00Z | Earth | 272.4205 | 272.4223 | -0.0018 | 73.1057 | 73.1089 | -0.0032 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2027-04-17T06:30Z | Sun | 88.0771 | 88.0772 | -0.0001 | 64.1976 | 64.1989 | -0.0013 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2027-04-17T06:30Z | Earth | 275.3600 | 275.3601 | -0.0001 | 69.0500 | 69.0481 | 0.0019 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2027-11-03T15:00Z | Sun | 91.4519 | 91.4527 | -0.0009 | -9.8195 | -9.8206 | 0.0011 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2027-11-03T15:00Z | Earth | 276.3810 | 276.3814 | -0.0004 | 70.2578 | 70.2583 | -0.0005 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2028-07-22T21:45Z | Sun | 89.3907 | 89.3912 | -0.0005 | -53.5995 | -53.6005 | 0.0010 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2028-07-22T21:45Z | Earth | 273.4572 | 273.4562 | 0.0009 | 64.1701 | 64.1706 | -0.0005 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2026-12-01T00:00Z | Sun | 265.8353 | 265.8340 | 0.0013 | 5.1140 | 5.1175 | -0.0035 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2026-12-01T00:00Z | Earth | 172.7983 | 172.7907 | 0.0076 | 64.9298 | 64.9298 | -0.0000 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2027-04-17T06:30Z | Sun | 111.7587 | 111.7597 | -0.0010 | 39.6906 | 39.6916 | -0.0010 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2027-04-17T06:30Z | Earth | 182.3463 | 182.3510 | -0.0047 | 66.2789 | 66.2790 | -0.0001 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2027-11-03T15:00Z | Sun | 77.4402 | 77.4404 | -0.0002 | -27.1153 | -27.1167 | 0.0014 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2027-11-03T15:00Z | Earth | 179.2826 | 179.2813 | 0.0013 | 66.5447 | 66.5448 | -0.0001 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2028-07-22T21:45Z | Sun | 34.2014 | 34.1999 | 0.0015 | -59.5347 | -59.5354 | 0.0008 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2028-07-22T21:45Z | Earth | 194.0955 | 194.0942 | 0.0013 | 65.2123 | 65.2120 | 0.0003 | PASS |
| Chang'e-4 (far side) | -45.457 | 177.589 | 2026-12-01T00:00Z | Sun | 99.9862 | 99.9887 | -0.0025 | -7.6509 | -7.6538 | 0.0029 | PASS |
| Chang'e-4 (far side) | -45.457 | 177.589 | 2026-12-01T00:00Z | Earth | 192.9277 | 192.9322 | -0.0045 | -45.3560 | -45.3559 | -0.0001 | PASS |
| Chang'e-4 (far side) | -45.457 | 177.589 | 2027-04-17T06:30Z | Sun | 241.5974 | 241.5962 | 0.0012 | -26.9214 | -26.9221 | 0.0007 | PASS |
| Chang'e-4 (far side) | -45.457 | 177.589 | 2027-04-17T06:30Z | Earth | 187.4660 | 187.4633 | 0.0027 | -47.0278 | -47.0282 | 0.0003 | PASS |
| Chang'e-4 (far side) | -45.457 | 177.589 | 2027-11-03T15:00Z | Sun | 296.0416 | 296.0420 | -0.0004 | 25.3581 | 25.3595 | -0.0014 | PASS |
| Chang'e-4 (far side) | -45.457 | 177.589 | 2027-11-03T15:00Z | Earth | 189.2843 | 189.2850 | -0.0007 | -47.1310 | -47.1310 | 0.0000 | PASS |
| Chang'e-4 (far side) | -45.457 | 177.589 | 2028-07-22T21:45Z | Sun | 345.3593 | 345.3607 | -0.0014 | 43.7814 | 43.7819 | -0.0005 | PASS |
| Chang'e-4 (far side) | -45.457 | 177.589 | 2028-07-22T21:45Z | Earth | 180.2992 | 180.2998 | -0.0006 | -46.8372 | -46.8367 | -0.0004 | PASS |
| East limb test point (Earth near horizon) | 0 | 88 | 2026-12-01T00:00Z | Sun | 262.9923 | 262.9962 | -0.0039 | -77.8520 | -77.8483 | -0.0037 | PASS |
| East limb test point (Earth near horizon) | 0 | 88 | 2026-12-01T00:00Z | Earth | 271.3610 | 271.3614 | -0.0004 | 8.4024 | 8.4055 | -0.0032 | PASS |
| East limb test point (Earth near horizon) | 0 | 88 | 2027-04-17T06:30Z | Sun | 272.3069 | 272.3067 | 0.0002 | 51.2453 | 51.2441 | 0.0013 | PASS |
| East limb test point (Earth near horizon) | 0 | 88 | 2027-04-17T06:30Z | Earth | 272.5446 | 272.5447 | -0.0002 | 4.4219 | 4.4200 | 0.0019 | PASS |
| East limb test point (Earth near horizon) | 0 | 88 | 2027-11-03T15:00Z | Sun | 92.6747 | 92.6761 | -0.0014 | 54.6924 | 54.6912 | 0.0012 | PASS |
| East limb test point (Earth near horizon) | 0 | 88 | 2027-11-03T15:00Z | Earth | 272.7928 | 272.7929 | -0.0001 | 5.6628 | 5.6633 | -0.0005 | PASS |
| East limb test point (Earth near horizon) | 0 | 88 | 2028-07-22T21:45Z | Sun | 90.1844 | 90.1847 | -0.0003 | 10.9249 | 10.9238 | 0.0010 | PASS |
| East limb test point (Earth near horizon) | 0 | 88 | 2028-07-22T21:45Z | Earth | 272.1067 | 272.1062 | 0.0004 | -0.4800 | -0.4795 | -0.0004 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2027-08-15T06:30Z | Sun | 184.9903 | 184.9350 | 0.0554 | 89.0203 | 89.0188 | 0.0015 | PASS |
| Apollo 11 LM | 0.67416 | 23.47314 | 2027-08-15T06:30Z | Earth | 271.9123 | 271.9093 | 0.0030 | 67.7581 | 67.7586 | -0.0004 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2027-08-16T21:30Z | Sun | 180.1176 | 180.1159 | 0.0017 | 63.5213 | 63.5202 | 0.0011 | PASS |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | 2027-08-16T21:30Z | Earth | 189.9931 | 189.9925 | 0.0006 | 62.4590 | 62.4584 | 0.0007 | PASS |

## A. Event times (smooth-Moon horizon, body centre crossing 0 deg)

Our time: coarse 10-minute scan + bisection to 1 minute. Horizons time: 1-minute table around our event, crossing linearly interpolated.

| Event | lat | E-lon | Ours (UTC) | Horizons (UTC) | Difference (min) | Pass |
|---|---|---|---|---|---|---|
| Apollo 11 sunset | 0.67416 | 23.47314 | 2027-01-28T02:39:03.750Z | 2027-01-28T02:39:29.444Z | -0.43 | PASS |
| Chandrayaan-3 sunset | -69.3741 | 32.32 | 2027-06-23T18:39:41.250Z | 2027-06-23T18:38:55.804Z | 0.76 | PASS |
| East-limb test point Earthset | 0 | 88 | 2027-03-05T08:35:18.750Z | 2027-03-05T08:35:30.364Z | -0.19 | PASS |
| Chang'e-4 sunset | -45.457 | 177.589 | 2028-02-03T07:59:03.750Z | 2028-02-03T07:59:21.386Z | -0.29 | PASS |

## B. Physics sanity tests

Period: 2027-01-01 to 2028-01-01 UTC, 10-minute steps (test 5: 30-minute scan refined to 1 minute). Smooth-Moon horizon (0 deg everywhere).

| Test | Result | Pass |
|---|---|---|
| Exact south pole (-90, 0): Sun centre elevation within +-1.7 deg all year | min -1.547 deg, max 1.550 deg | PASS |
| Apollo 11: Earth above smooth horizon 100% of the year | 100.000% (min Earth el 57.96 deg) | PASS |
| Chang'e-4 (far side): Earth below smooth horizon 100% of the year | Earth up 0.000% (max Earth el -37.72 deg) | PASS |
| Equatorial near-side (0, 0): Sun above smooth horizon 45-55% of the year | 48.62% | PASS |
| Max Sun elevation at 20 random latitudes -60 to -90 (seed 20261114): never above 90 - abs(lat) + 1.6 deg, and within 0.2 deg of 90 - abs(lat) + 1.54 deg | max - (90 - abs(lat)): 1.504 to 1.550 deg; largest deviation from 90 - abs(lat) + 1.54: 0.036 deg | PASS |

**Test 5 detail: maximum Sun elevation over 2027** (smooth horizon). Rule (from the test specification): the maximum should come within 0.2 deg of 90 - |lat| + 1.54 deg and never exceed 90 - |lat| + 1.6 deg. Reason: the Sun stays close to the ecliptic, and the Moon's equator is tilted only slightly to it; the IAU/WGCCRE orientation model used by the engine gives a tilt of 1.522-1.572 deg to the J2000 ecliptic over the period (Astronomy Engine `RotationAxis`, sampled every 30 days). Random latitudes uniform in -60 to -90, longitudes uniform; 30-minute scan, then 1-minute steps within 30 minutes of the highest sample.

| lat | E-lon | Max Sun el (deg) | When (UTC) | 90 - abs(lat) + 1.54 | Difference | Limit | Pass |
|---|---|---|---|---|---|---|---|
| -63.8852 | -42.432 | 27.6218 | 2027-10-18 16:33 | 27.6548 | -0.0330 | 27.7148 | PASS |
| -82.7161 | -109.2031 | 8.7890 | 2027-10-24 04:18 | 8.8239 | -0.0349 | 8.8839 | PASS |
| -67.1705 | -103.7412 | 24.3341 | 2027-10-23 17:28 | 24.3695 | -0.0354 | 24.4295 | PASS |
| -82.119 | -31.2649 | 9.3876 | 2027-10-17 18:33 | 9.4210 | -0.0334 | 9.4810 | PASS |
| -82.4992 | -124.8207 | 9.0084 | 2027-10-25 11:07 | 9.0408 | -0.0324 | 9.1008 | PASS |
| -60.48 | -146.8452 | 31.0339 | 2027-10-27 06:19 | 31.0600 | -0.0261 | 31.1200 | PASS |
| -61.6381 | -13.6863 | 29.8660 | 2027-10-16 07:51 | 29.9019 | -0.0359 | 29.9619 | PASS |
| -77.4549 | 118.8098 | 14.0910 | 2027-11-03 23:54 | 14.0851 | 0.0059 | 14.1451 | PASS |
| -78.4664 | 95.8685 | 13.0832 | 2027-11-05 21:03 | 13.0736 | 0.0096 | 13.1336 | PASS |
| -66.5553 | -97.9049 | 24.9490 | 2027-10-23 05:57 | 24.9847 | -0.0357 | 25.0447 | PASS |
| -81.5603 | 9.0086 | 9.9606 | 2027-11-12 23:46 | 9.9797 | -0.0191 | 10.0397 | PASS |
| -78.7905 | 2.5158 | 12.7240 | 2027-11-13 12:44 | 12.7495 | -0.0255 | 12.8095 | PASS |
| -69.8723 | -16.5567 | 21.6324 | 2027-10-16 13:32 | 21.6677 | -0.0353 | 21.7277 | PASS |
| -63.942 | -113.2937 | 27.5637 | 2027-10-24 12:17 | 27.5980 | -0.0343 | 27.6580 | PASS |
| -84.5852 | -62.113 | 6.9206 | 2027-10-20 07:18 | 6.9548 | -0.0342 | 7.0148 | PASS |
| -65.7253 | 108.7597 | 25.8226 | 2027-11-04 19:38 | 25.8147 | 0.0079 | 25.8747 | PASS |
| -85.4873 | -151.5557 | 6.0282 | 2027-10-27 16:01 | 6.0527 | -0.0245 | 6.1127 | PASS |
| -68.2113 | 137.3532 | 23.3299 | 2027-11-02 11:23 | 23.3287 | 0.0012 | 23.3887 | PASS |
| -88.8353 | 136.2311 | 2.7063 | 2027-11-02 15:04 | 2.7047 | 0.0016 | 2.7647 | PASS |
| -84.6636 | -175.8287 | 6.8611 | 2027-10-29 15:42 | 6.8764 | -0.0153 | 6.9364 | PASS |

## E. Custom point, one-year check: **PASS**

Point -70.9457, 67.9235 E, smooth horizon (it is outside the south-pole map, so the app uses a smooth horizon there). JPL Horizons apparent azimuth/elevation of the Earth (399) and the Sun (10), same settings as part A, every hour from 2026-11-14 00:00 to 2027-11-14 00:00 UT: 8761 rows per body. Cache files: `tests/horizons_cache/ca37b62ceaf11412.txt` (Earth), `tests/horizons_cache/419c9ccaca1fe9ba.txt` (Sun). Run alone with `node tests/one_year_check.js`.

| Body | max abs dEl (deg) | mean abs dEl | max abs dAz (deg) | mean abs dAz | Pass |
|---|---|---|---|---|---|
| Earth | 0.0026 | 0.0010 | 0.0032 | 0.0009 | PASS |
| Sun | 0.0028 | 0.0011 | 0.0039 | 0.0011 | PASS |

**Earth elevation (Horizons).** Minimum over the year **1.6344 deg** at 2026-12-08 05:31 UTC (1-minute Horizons table around the hourly minimum, 1.6345 deg at 2026-12-08 06:00; `tests/horizons_cache/b5f0cc1e60818953.txt`). The engine gives 1.6344 deg at that minute. Earth is below 0 deg in 0 of 8761 hourly rows: **according to Horizons, Earth never goes below 0 deg (smooth horizon) in this year**. There is therefore no Earthset or Earthrise to compare; the app finds none either, and its countdown shows "Not within the next N days (search limit)".

**Events.** Every 0 deg crossing in the hourly Horizons table was refined with a 1-minute Horizons table (crossing linearly interpolated) and compared with the events from the app's own Explore job (`js/jobs.js`: 365-day window, 60-minute scan refined to 1 minute, smooth horizon, minimum elevation 0). Earthset/Earthrise: Horizons 0, app 0. Sunset/sunrise: Horizons 24, app 24; difference max **1.42 min**, mean 0.52 min; unmatched 0, extra 0 (tolerance 2 min). At this latitude the Sun's centre crosses the horizon slowly (about 0.003 deg per minute), so a 0.003 deg elevation difference moves a crossing by about a minute, on top of the app's 1-minute refinement.

**Next-event predictions.** For 30-day windows started every 14 days, the next event the app's countdown would show (inside the window, otherwise from the 400-day search after it) was compared with the first refined Horizons crossing after the window start: Earth 24/24 agree (Horizons has no crossing in the year and the app shows none), Sun 24/24 agree within 2 min.

| Horizons sunrise/sunset (UTC) | App (UTC) | Difference (min) | Pass |
|---|---|---|---|
| set 2026-11-26 14:16:27 | 2026-11-26 14:15:28 | -1.00 | PASS |
| rise 2026-12-10 16:30:00 | 2026-12-10 16:30:28 | 0.46 | PASS |
| set 2026-12-26 02:40:27 | 2026-12-26 02:39:50 | -0.61 | PASS |
| rise 2027-01-09 10:14:54 | 2027-01-09 10:14:31 | -0.38 | PASS |
| set 2027-01-24 13:14:15 | 2027-01-24 13:14:31 | 0.27 | PASS |
| rise 2027-02-08 05:20:30 | 2027-02-08 05:20:09 | -0.35 | PASS |
| set 2027-02-22 22:42:46 | 2027-02-22 22:42:39 | -0.12 | PASS |
| rise 2027-03-09 23:53:50 | 2027-03-09 23:52:58 | -0.87 | PASS |
| set 2027-03-24 08:08:03 | 2027-03-24 08:07:58 | -0.09 | PASS |
| rise 2027-04-08 16:16:22 | 2027-04-08 16:15:28 | -0.91 | PASS |
| set 2027-04-22 18:27:16 | 2027-04-22 18:27:39 | 0.37 | PASS |
| rise 2027-05-08 05:33:19 | 2027-05-08 05:32:20 | -0.99 | PASS |
| set 2027-05-22 06:16:46 | 2027-05-22 06:17:20 | 0.57 | PASS |
| rise 2027-06-06 15:43:06 | 2027-06-06 15:42:39 | -0.45 | PASS |
| set 2027-06-20 19:45:39 | 2027-06-20 19:45:28 | -0.18 | PASS |
| rise 2027-07-05 23:30:14 | 2027-07-05 23:30:28 | 0.23 | PASS |
| set 2027-07-20 10:38:10 | 2027-07-20 10:37:58 | -0.21 | PASS |
| rise 2027-08-04 06:10:24 | 2027-08-04 06:10:46 | 0.37 | PASS |
| set 2027-08-19 02:19:56 | 2027-08-19 02:19:13 | -0.73 | PASS |
| rise 2027-09-02 13:14:02 | 2027-09-02 13:14:31 | 0.49 | PASS |
| set 2027-09-17 18:04:12 | 2027-09-17 18:03:16 | -0.93 | PASS |
| rise 2027-10-01 22:09:57 | 2027-10-01 22:09:50 | -0.11 | PASS |
| set 2027-10-17 09:00:00 | 2027-10-17 08:58:35 | -1.42 | PASS |
| rise 2027-10-31 10:05:48 | 2027-10-31 10:06:05 | 0.28 | PASS |

## C. Blind test

Cases chosen by `node tests/blind_test.js --new` on 2026-11-14: crypto.randomInt: site uniformly from the curated south-pole sites with terrain horizons; time uniformly over whole minutes 2026-01-01..2030-12-31 UTC; queries already in tests/horizons_cache were rejected; every response fetched fresh from the Horizons API. Same settings and tolerances as part A. The raw responses are in the cache files listed (first line = exact query URL).

| Site | lat | E-lon | UTC | Body | Az ours | Az Horizons | dAz | El ours | El Horizons | dEl | Pass | Cache file |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Nobile Rim 2 (site DM2) | -84.20156 | 60.69989 | 2027-05-04T01:21Z | Sun | 143.6896 | 143.6899 | -0.0003 | -6.2107 | -6.2123 | 0.0016 | PASS | `tests/horizons_cache/76e31aba2551196c.txt` |
| Nobile Rim 2 (site DM2) | -84.20156 | 60.69989 | 2027-05-04T01:21Z | Earth | 292.6258 | 292.6253 | 0.0005 | 7.4585 | 7.4597 | -0.0012 | PASS | `tests/horizons_cache/d015dcad431ecbd7.txt` |
| Nobile Rim 2 (site DM2) | -84.20156 | 60.69989 | 2027-05-16T04:22Z | Sun | 355.6949 | 355.6945 | 0.0004 | 4.2602 | 4.2600 | 0.0001 | PASS | `tests/horizons_cache/46222a10e9afa01c.txt` |
| Nobile Rim 2 (site DM2) | -84.20156 | 60.69989 | 2027-05-16T04:22Z | Earth | 304.1752 | 304.1746 | 0.0007 | -1.9037 | -1.9044 | 0.0007 | PASS | `tests/horizons_cache/f2fdb0da4ef536c5.txt` |
| Mons Mouton (landform centre) | -84.6 | 31 | 2026-08-22T03:13Z | Sun | 38.2186 | 38.2223 | -0.0038 | 4.2022 | 4.2043 | -0.0021 | PASS | `tests/horizons_cache/63016d419738240c.txt` |
| Mons Mouton (landform centre) | -84.6 | 31 | 2026-08-22T03:13Z | Earth | 330.6218 | 330.6246 | -0.0029 | -1.9357 | -1.9328 | -0.0029 | PASS | `tests/horizons_cache/4c1a55c8238ef9b1.txt` |
| Peak near Shackleton (illuminated area) | -88.79 | 124.5 | 2026-12-04T00:50Z | Sun | 118.6532 | 118.6563 | -0.0030 | 0.8774 | 0.8773 | 0.0002 | PASS | `tests/horizons_cache/2306b5fbfb0e6179.txt` |
| Peak near Shackleton (illuminated area) | -88.79 | 124.5 | 2026-12-04T00:50Z | Earth | 242.0814 | 242.0837 | -0.0023 | -6.0020 | -6.0028 | 0.0008 | PASS | `tests/horizons_cache/c3c02fe117b4120d.txt` |
| IM-1 Odysseus | -80.13 | 1.44 | 2028-10-19T21:25Z | Sun | 159.3497 | 159.3519 | -0.0023 | -7.7581 | -7.7577 | -0.0004 | PASS | `tests/horizons_cache/d2807b43ac162334.txt` |
| IM-1 Odysseus | -80.13 | 1.44 | 2028-10-19T21:25Z | Earth | 4.1841 | 4.1853 | -0.0011 | 4.1565 | 4.1563 | 0.0002 | PASS | `tests/horizons_cache/3eacde9ba84abfb7.txt` |

Fetch times (UTC): 2026-11-14T10:50:04.389Z, 2026-11-14T10:50:05.748Z, 2026-11-14T10:50:07.060Z, 2026-11-14T10:50:08.423Z, 2026-11-14T10:50:09.754Z. How to repeat one case by hand: VERIFY_YOURSELF.md.

## Test sites

| Site | lat | E-lon | Source |
|---|---|---|---|
| Near south pole (test point) | -89.5 | 0 | Synthetic test coordinate |
| Polar test point near Shackleton (test geometry) | -88.8 | 123.4 | Test geometry only (not a curated site) |
| Apollo 11 LM | 0.67416 | 23.47314 | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html |
| Chang'e-4 (far side) | -45.457 | 177.589 | https://lroc.im-ldi.com/images/1087 |
| East limb test point (Earth near horizon) | 0 | 88 | Synthetic test coordinate |

Notes: "Synthetic test coordinate" points are not landing sites; they were chosen to exercise geometry (near-pole Sun skimming, Earth near the east limb).

## F. Instant status check (independent: Horizons + Python terrain): **PASS**

Run with `node tests/instant_status_check.js` (`--new` chooses new cases). Cases: per site: the current whole minute when the cases were chosen, plus 20 whole-minute times uniform in 2026-01-01..2028-12-31 UTC (seeded PRNG, seed 20261114 + 97 x site index); chosen 2026-11-14 19:11 UTC ("now" = 2026-11-14 19:11 UTC). Sun (10) and Earth (399) apparent azimuth/elevation from the JPL Horizons API (observer on the Moon at the site, geodetic, height 0, QUANTITIES 4, APPARENT AIRLESS, UT; one TLIST query per site and body); terrain horizon at exactly those azimuths from tools/terrain.py horizon_at (LOLA DEMs, observer 2 m above the surface, rays to 300 km, lunar curvature); up = centre above that horizon (Earth minimum elevation 0). App = js/engine.js series sample with the stored horizon mask (as in the main view). Agreement is required in every case except where the body is within 0.05 deg of the horizon ("on the edge", listed separately).

**Result**: 336 of 336 status decisions agree (8 sites x 21 times x Sun and Earth). On the edge: 3 (0 of them disagree). Disagreements outside the edge: **0** (no bug found). Supporting numbers: app vs Horizons elevation max |difference| 0.0028 deg, azimuth 0.0041 deg; the app's stored 1-degree horizon mask vs the Python horizon at the exact azimuth: max 0.050 deg, mean 0.005 deg.

On the edge (body within 0.05 deg of the terrain horizon):

| Site | UTC | Body | Horizons el | Python horizon | Margin | Independent | App |
|---|---|---|---|---|---|---|---|
| IM-2 Athena | 2027-08-22 19:58 | sun | -0.2276 | -0.1874 | -0.0402 | down | down |
| Peak near Shackleton - best-lit point (derived) | 2027-05-30 00:30 | earth | 3.2569 | 3.2406 | 0.0163 | up | up |
| Mons Mouton (landform centre) | 2028-08-29 11:16 | earth | 2.7693 | 2.8117 | -0.0424 | down | down |

**Sunlit now.** At 2026-11-14 19:11 UTC, 3 of 8 south-pole sites are sunlit. Near the pole the Sun never climbs high: at these sites it is between -2.7° and +4.8° above the flat horizon right now, so a hill or crater wall of a degree or two in the Sun's direction decides between light and shadow. Sunlit: Peak near Shackleton (illuminated area) (Sun +2.76° at azimuth 352°, terrain there -2.71°); Peak near Shackleton - best-lit point (derived) (Sun +2.76° at azimuth 353°, terrain there -2.72°); Nobile Rim 2 (site DM2) (Sun +4.77° at azimuth 56°, terrain there +1.08°). In shadow: IM-1 Odysseus (Sun -2.68°, terrain +9.64°; below the flat horizon too); IM-2 Athena (Sun +1.76°, terrain +2.94°); Mons Mouton (landform centre) (Sun +1.94°, terrain +8.31°); Mons Malapert (landform centre) (Sun -0.37°, terrain +1.19°; below the flat horizon too); Shackleton crater centre (floor) (Sun +1.88°, terrain +20.12°). Sun positions from JPL Horizons; terrain heights computed from the LOLA elevation data in the Sun's direction.

| Site | Sun el (Horizons) | Sun az | Terrain horizon there (Python) | Sunlit (independent) | App |
|---|---|---|---|---|---|
| IM-1 Odysseus | -2.685 | 115.35 | 9.636 (highest point 0.35 km away) | no | no |
| IM-2 Athena | 1.761 | 87.83 | 2.938 (highest point 28.36 km away) | no | no |
| Peak near Shackleton (illuminated area) | 2.756 | 352.37 | -2.709 (highest point 46.82 km away) | yes | yes |
| Peak near Shackleton - best-lit point (derived) | 2.761 | 352.53 | -2.720 (highest point 46.66 km away) | yes | yes |
| Nobile Rim 2 (site DM2) | 4.775 | 56.44 | 1.084 (highest point 65.12 km away) | yes | yes |
| Mons Mouton (landform centre) | 1.937 | 86.04 | 8.315 (highest point 0.4 km away) | no | no |
| Mons Malapert (landform centre) | -0.366 | 118.58 | 1.192 (highest point 0.05 km away) | no | no |
| Shackleton crater centre (floor) | 1.878 | 347.09 | 20.119 (highest point 10.98 km away) | no | no |

Per site (all 21 times):

| Site | Sun up (indep / app) | Earth visible (indep / app) | Agree | Horizons files (Sun, Earth) |
|---|---|---|---|---|
| IM-1 Odysseus | 6 / 6 | 21 / 21 | 42/42 | `tests/horizons_cache/45b713d0c4e6d964.txt`, `tests/horizons_cache/825b4c2db78fb99f.txt` |
| IM-2 Athena | 9 / 9 | 19 / 19 | 42/42 | `tests/horizons_cache/67360c29091f579f.txt`, `tests/horizons_cache/7852b8018e8fd3a2.txt` |
| Peak near Shackleton (illuminated area) | 13 / 13 | 3 / 3 | 42/42 | `tests/horizons_cache/bdfb333af2978983.txt`, `tests/horizons_cache/ae59c77232d3f526.txt` |
| Peak near Shackleton - best-lit point (derived) | 12 / 12 | 6 / 6 | 42/42 | `tests/horizons_cache/0a3f7eb3760099af.txt`, `tests/horizons_cache/d51c6d9bc9de032a.txt` |
| Nobile Rim 2 (site DM2) | 8 / 8 | 6 / 6 | 42/42 | `tests/horizons_cache/b79834fc930db184.txt`, `tests/horizons_cache/45505fecc724d279.txt` |
| Mons Mouton (landform centre) | 10 / 10 | 10 / 10 | 42/42 | `tests/horizons_cache/f8f56c64eab1e30f.txt`, `tests/horizons_cache/1c6801fc0f9c542f.txt` |
| Mons Malapert (landform centre) | 7 / 7 | 21 / 21 | 42/42 | `tests/horizons_cache/1fb408b277218f22.txt`, `tests/horizons_cache/8f8e1c6874647b0d.txt` |
| Shackleton crater centre (floor) | 0 / 0 | 0 / 0 | 42/42 | `tests/horizons_cache/f9c3e8c92e4d6566.txt`, `tests/horizons_cache/85840f52844d32dd.txt` |

## G. 3D terrain accuracy: **PASS**

Run with `node tests/accuracy3d.js` (the app's own 3D code in Node) and `.venv\Scripts\python -I tools\accuracy3d.py` (independent, from the LOLA DEMs); results of 2026-11-15 09:06 UTC.

**Heights.** Every stored grid point of every 3D terrain product (the 6 km tile of each of the 8 sites, ring A to 16 km, ring B to 40 km, the three 5 m patches, and since round 6 the finer ring grids: ring A at 25 m from LDEM_85S_20M and ring B at 100 m from LDEM_85S_20M or LDEM_80S_80M): its geographic position is computed independently (site up vector rotated by the ground distance; not the great-circle routine the generators use), and the LOLA DEM the product names is sampled there directly (bilinear, raw PDS array). Differences come from the 0.1 m (0.2 m where the relief is larger) storage step.

| Site | Product | DEM | Grid points | Spacing (m) | Max abs diff (m) | Mean abs diff (m) |
|---|---|---|---|---|---|---|
| IM-1 Odysseus | 6 km tile | LDEM_80S_80M | 5,929 | 80 | 0.050 | 0.025 |
| IM-1 Odysseus | Ring A (to 16 km) | LDEM_75S_120M | 160,801 | 80 | 0.050 | 0.025 |
| IM-1 Odysseus | Ring B (to 40 km) | LDEM_75S_120M | 251,001 | 160 | 0.050 | 0.025 |
| IM-2 Athena | 6 km tile | LDEM_85S_20M | 90,601 | 20 | 0.050 | 0.025 |
| IM-2 Athena | Ring A (to 16 km) | LDEM_80S_80M | 103,041 | 100 | 0.050 | 0.025 |
| IM-2 Athena | Ring B (to 40 km) | LDEM_75S_120M | 160,801 | 200 | 0.100 | 0.050 |
| IM-2 Athena | Ring B fine, 100 m (round 6) | LDEM_80S_80M | 641,601 | 100 | 0.100 | 0.050 |
| Peak near Shackleton (illuminated area) | 6 km tile | LDEM_85S_20M | 90,601 | 20 | 0.050 | 0.025 |
| Peak near Shackleton (illuminated area) | Ring A (to 16 km) | LDEM_80S_80M | 103,041 | 100 | 0.050 | 0.025 |
| Peak near Shackleton (illuminated area) | Ring B (to 40 km) | LDEM_75S_120M | 160,801 | 200 | 0.050 | 0.025 |
| Peak near Shackleton (illuminated area) | Ring A fine, 25 m (round 6) | LDEM_85S_20M | 1,640,961 | 25 | 0.050 | 0.025 |
| Peak near Shackleton (illuminated area) | Ring B fine, 100 m (round 6) | LDEM_85S_20M | 641,601 | 100 | 0.050 | 0.025 |
| Peak near Shackleton (illuminated area) | 5 m patch (2 km) | LDEM_875S_5M | 160,801 | 5 | 0.050 | 0.023 |
| Peak near Shackleton - best-lit point (derived) | 6 km tile | LDEM_85S_20M | 90,601 | 20 | 0.050 | 0.025 |
| Peak near Shackleton - best-lit point (derived) | Ring A (to 16 km) | LDEM_80S_80M | 103,041 | 100 | 0.050 | 0.025 |
| Peak near Shackleton - best-lit point (derived) | Ring B (to 40 km) | LDEM_75S_120M | 160,801 | 200 | 0.050 | 0.025 |
| Peak near Shackleton - best-lit point (derived) | Ring A fine, 25 m (round 6) | LDEM_85S_20M | 1,640,961 | 25 | 0.050 | 0.025 |
| Peak near Shackleton - best-lit point (derived) | Ring B fine, 100 m (round 6) | LDEM_85S_20M | 641,601 | 100 | 0.050 | 0.025 |
| Peak near Shackleton - best-lit point (derived) | 5 m patch (2 km) | LDEM_875S_5M | 160,801 | 5 | 0.050 | 0.024 |
| Nobile Rim 2 (site DM2) | 6 km tile | LDEM_80S_80M | 5,929 | 80 | 0.050 | 0.025 |
| Nobile Rim 2 (site DM2) | Ring A (to 16 km) | LDEM_80S_80M | 160,801 | 80 | 0.050 | 0.025 |
| Nobile Rim 2 (site DM2) | Ring B (to 40 km) | LDEM_75S_120M | 251,001 | 160 | 0.100 | 0.050 |
| Nobile Rim 2 (site DM2) | Ring B fine, 100 m (round 6) | LDEM_80S_80M | 641,601 | 100 | 0.100 | 0.050 |
| Mons Mouton (landform centre) | 6 km tile | LDEM_85S_20M | 90,601 | 20 | 0.050 | 0.025 |
| Mons Mouton (landform centre) | Ring A (to 16 km) | LDEM_80S_80M | 103,041 | 100 | 0.050 | 0.025 |
| Mons Mouton (landform centre) | Ring B (to 40 km) | LDEM_75S_120M | 160,801 | 200 | 0.100 | 0.050 |
| Mons Mouton (landform centre) | Ring B fine, 100 m (round 6) | LDEM_80S_80M | 641,601 | 100 | 0.100 | 0.050 |
| Mons Malapert (landform centre) | 6 km tile | LDEM_85S_20M | 90,601 | 20 | 0.050 | 0.025 |
| Mons Malapert (landform centre) | Ring A (to 16 km) | LDEM_80S_80M | 103,041 | 100 | 0.050 | 0.025 |
| Mons Malapert (landform centre) | Ring B (to 40 km) | LDEM_75S_120M | 160,801 | 200 | 0.100 | 0.050 |
| Mons Malapert (landform centre) | Ring A fine, 25 m (round 6) | LDEM_85S_20M | 1,640,961 | 25 | 0.050 | 0.025 |
| Mons Malapert (landform centre) | Ring B fine, 100 m (round 6) | LDEM_80S_80M | 641,601 | 100 | 0.100 | 0.050 |
| Shackleton crater centre (floor) | 6 km tile | LDEM_85S_20M | 90,601 | 20 | 0.050 | 0.025 |
| Shackleton crater centre (floor) | Ring A (to 16 km) | LDEM_80S_80M | 103,041 | 100 | 0.050 | 0.025 |
| Shackleton crater centre (floor) | Ring B (to 40 km) | LDEM_75S_120M | 160,801 | 200 | 0.050 | 0.025 |
| Shackleton crater centre (floor) | Ring A fine, 25 m (round 6) | LDEM_85S_20M | 1,640,961 | 25 | 0.050 | 0.025 |
| Shackleton crater centre (floor) | Ring B fine, 100 m (round 6) | LDEM_85S_20M | 641,601 | 100 | 0.050 | 0.025 |
| Shackleton crater centre (floor) | 5 m patch (2 km) | LDEM_875S_5M | 160,801 | 5 | 0.050 | 0.020 |

All 14,499,574 grid points: max abs difference **0.100 m**, mean 0.031 m (limit 1 m) -> PASS.

**Slopes.** Same method in both: central differences over one grid spacing d of the bilinear DEM heights in the site's true ground east/north directions, dh/de = (h(e+d) - h(e-d)) / 2d, dh/dn = (h(n+d) - h(n-d)) / 2d, slope = atan(sqrt(dh/de^2 + dh/dn^2)). The 3D readout uses the stored grid (js/view3d_math.js slopeAt); Python samples the LOLA DEM directly at the geographic positions of those points (tools/accuracy3d.py). d = 20 m or 80 m (6 km tile) and 5 m (patch). The 2D map's slope layer uses the same formula on a 37 m sample grid (np.gradient), averaged over 2 x 2 samples into 74 m pixels and shown in 8 classes (tools/tiles.py).

| Comparison | Points | Max abs diff (deg) | Mean abs diff (deg) | Note |
|---|---|---|---|---|
| Rover readout vs Python, tile grid points (20 m / 80 m) | 200 | 0.169 | 0.039 | 200 of 200 within the storage-step bound (0.05-0.20 deg for 80 m / 20 m spacing) |
| Rover readout vs Python, 5 m patch points (High quality) | 42 | 0.534 | 0.169 | 42 of 42 within the storage-step bound (0.81 deg at 5 m spacing) |
| 3D slope shading (mesh attribute) vs rover readout, same points | 200 | 0.000 | 0.000 | same formula, same heights |
| Before the fix: old rover readout (bilinear gradient inside one cell) vs Python, tile points | 200 | 15.943 | 1.075 | different method (one-sided over one cell); fixed this round |
| Before the fix: old readout vs Python, 5 m patch points | 42 | 7.799 | 1.276 | fixed this round |
| 2D map layer: Python reproduction of the 74 m pixel vs the map's stored class | 200 | 0.000 | 0.000 | 200 of 200 in the same class |
| Rover readout (20 m / 80 m) vs the 2D map's 74 m pixel value at the same points | 200 | 8.055 | 1.036 | different pixel size, not an error; 155 of 200 readouts fall in the map pixel's class |
| Python at 37 m spacing (no 74 m averaging) vs the 2D map's 74 m pixel value | 200 | 5.622 | 0.788 | effect of averaging alone |

Tolerance: the error that the 0.1 m height storage step alone can cause, atan(sqrt(2) x 0.05 m / d): 0.05 deg at 80 m, 0.20 deg at 20 m, 0.81 deg at 5 m spacing. Finding: before this round the rover readout used the gradient of the bilinear surface inside one grid cell (one-sided differences), while the 3D slope shading used central differences; against the DEM-derived central-difference slope the old readout differed by up to 15.9 deg (mean 1.07 deg) on the 6 km tiles and 7.8 deg on the 5 m patches. The readout (js/view3d_math.js slopeAt) now uses central differences over one grid spacing, the same formula as the slope shading and as the Python check: max difference 0.169 deg (tile) and 0.534 deg (5 m), every point within the storage-step bound. The 2D map's slope layer is correct for its own 74 m pixels (200/200 classes reproduced); it is smoother than the 3D readout because of its larger pixels (mean difference 1.0 deg), which the map legend states.

**Positions.** Rover positions chosen at random inside the drawn tile (14 on the 6 km tiles as at Low/Medium quality, 6 inside the 5 m patches as at High). The latitude/longitude the Rover panel displays (4 decimals) is converted with the 2D map's own projection (js/map.js project: south polar stereographic) and compared with the rover's true position, computed independently in Python (site-frame east/north -> great-circle position -> the DEM's stereographic grid). The displayed elevation (1 decimal) is compared with a bilinear sample of the LOLA DEM (the tile's product, or LDEM_875S_5M inside the patch) at the displayed latitude/longitude.

| Site | e (m) | n (m) | Displayed lat, lon | Back through the map projection: distance (m) | DEM cell (m) | Displayed elevation | DEM height there (m) | Pass |
|---|---|---|---|---|---|---|---|---|
| IM-1 Odysseus | -1723.6 | 2612.0 | -80.0437, 1.1112 | 0.25 | 80 | 2618.8 m | 2618.92 | PASS |
| IM-2 Athena | 1953.9 | 605.6 | -84.7702, 29.9026 | 0.99 | 20 | 5223.6 m | 5223.42 | PASS |
| Peak near Shackleton (illuminated area) | -2277.3 | -515.0 | -88.8046, 120.8977 | 0.67 | 20 | 1276.7 m | 1276.65 | PASS |
| Peak near Shackleton - best-lit point (derived) | -1288.5 | 2219.8 | -88.7112, 122.4543 | 0.19 | 20 | 1221.2 m | 1221.63 | PASS |
| Nobile Rim 2 (site DM2) | -641.4 | -394.6 | -84.2145, 60.4901 | 1.08 | 80 | 1044.7 m | 1044.90 | PASS |
| Mons Mouton (landform centre) | -723.7 | -2502.6 | -84.6825, 30.7425 | 0.72 | 20 | 5111.9 m | 5111.92 | PASS |
| Mons Malapert (landform centre) | -242.5 | 1460.6 | -85.9318, -1.7827 | 0.71 | 20 | 4701.2 m | 4700.95 | PASS |
| Shackleton crater centre (floor) | 1886.9 | 2298.1 | -89.5895, 138.4981 | 0.94 | 20 | -2631.4 m | -2631.14 | PASS |
| IM-1 Odysseus | -2252.7 | -2614.3 | -80.2159, 1.0028 | 1.12 | 80 | 2717.9 m | 2717.62 | PASS |
| IM-2 Athena | -96.9 | -93.3 | -84.7937, 29.1605 | 0.73 | 20 | 5323.8 m | 5323.76 | PASS |
| Peak near Shackleton (illuminated area) | 2371.7 | 1967.1 | -88.7227, 128.0110 | 0.98 | 20 | 1143.2 m | 1143.53 | PASS |
| Peak near Shackleton - best-lit point (derived) | 1919.9 | -1200.4 | -88.8230, 127.4276 | 0.52 | 20 | 1437.4 m | 1437.47 | PASS |
| Nobile Rim 2 (site DM2) | 2146.0 | -2269.1 | -84.2760, 61.4095 | 1.41 | 80 | 834.9 m | 835.15 | PASS |
| Mons Mouton (landform centre) | -1847.8 | -1854.2 | -84.6608, 30.3451 | 0.04 | 20 | 5040.7 m | 5040.62 | PASS |
| Shackleton crater centre (floor) | 293.6 | -817.6 | -89.6968, 131.6099 | 0.20 | 5 | -2762.7 m | -2762.75 | PASS |
| Peak near Shackleton (illuminated area) | 608.7 | -575.9 | -88.8088, 125.4656 | 0.65 | 5 | 1585.3 m | 1585.25 | PASS |
| Peak near Shackleton - best-lit point (derived) | 730.5 | 169.2 | -88.7793, 125.4747 | 0.56 | 5 | 1526.4 m | 1526.65 | PASS |
| Shackleton crater centre (floor) | 313.7 | 243.8 | -89.6618, 131.5332 | 0.07 | 5 | -2789.4 m | -2789.47 | PASS |
| Peak near Shackleton (illuminated area) | 947.7 | -299.4 | -88.7995, 125.9919 | 0.97 | 5 | 1531.2 m | 1531.29 | PASS |
| Peak near Shackleton - best-lit point (derived) | 833.9 | 827.1 | -88.7575, 125.6122 | 0.59 | 5 | 1433.1 m | 1433.02 | PASS |

20 positions: largest distance 1.41 m (limit: one DEM cell), largest elevation difference 0.43 m (limit 1 m) -> PASS.

## Terrain illumination cross-check

Peak near Shackleton (-88.79, 124.5) vs the published "approximately 80%" figure. Do-not-tune policy: nothing in the model was adjusted to match.

**Sources and definitions**

* Published claim: Mahanti et al. 2024 (PSJ 5, 62): "a small area (−88.79, 124.5) receives persistent solar illumination (approximately 80% of the time; Mazarico et al. 2011)." (https://iopscience.iop.org/article/10.3847/PSJ/ad1b50)
* Original method (abstract): Mazarico et al. 2011, Icarus 211: horizons from "240 m-resolution polar digital elevation models"; "simulations over long periods (several 18.6-years lunar precession cycles) with a high temporal resolution (6 h)". Observer height is not stated in the abstract; the full paper (Elsevier) was not accessible. (https://ntrs.nasa.gov/citations/20120010094)
* Published map product: NASA PGDA product 69: "Maps of the solar illumination, averaged over hourly timesteps spanning 18.6 years" (no start year given). Map AVGVISIB_85S_060M_201608 (60 m/px, based on LDEM_85S_060M), label: "average illumination by the solar disc ... indicate the percentage of timesteps where each pixel was sunlit (by any fraction of the solar disc)"; the same label's image description says "its average solar disc visibility". The two wordings differ, so we compute both definitions. (https://pgda.gsfc.nasa.gov/products/69)

**Method.** Sun directions from the validated ASTERIA engine (hourly, 2027-01-01 to 2045-08-08, 163057 steps = one 18.6-year nodal cycle; "2027" = calendar year 2027). Terrain horizons from LOLA LDEM_85S_20M/80S_80M/75S_120M (20 m/px near the site), 360 azimuths, rays to 300 km, at observer heights 2 m and 10 m above the surface. Three definitions: (1) average visible fraction of the solar disk, (2) % of time the Sun centre is above the horizon, (3) % of time any part of the disk is above the horizon. The published map (AVGVISIB_85S_060M_201608) is sampled at the same points (bilinear; nearest-pixel in brackets).

| Observer height | Period | (1) Avg disk fraction | (2) Sun centre up | (3) Any part of disk up |
|---|---|---|---|---|
| 2 m | 2027 | 49.6% | 49.6% | 51.3% |
| 2 m | 18.6 yr | 48.1% | 48.1% | 49.8% |
| 10 m | 2027 | 60.9% | 60.9% | 62.7% |
| 10 m | 18.6 yr | 59.6% | 59.6% | 61.5% |
| Published map AVGVISIB_85S_060M_201608 at the same point | 18.6 yr | 45.4% (nearest pixel 42.8%) | | |
| Published text (Mahanti et al. 2024) | not stated | ~80% | | |

**Neighbourhood scan** (all points within 500 m of the published coordinate on a 50 m grid, 18.6-year span):

| Height | Points | Best point (ours) | Ours there (1)/(2)/(3) | Published map there | Max of published map in the area | Correlation ours vs map |
|---|---|---|---|---|---|---|
| 2.0 m | 317 | -88.79495, 123.7972 (-150 m N, -450 m E) | 62.1% / 62.1% / 63.6% | 38.0% | 59.2% at -88.78505, 124.3438 | r = 0.84 |
| 10.0 m | 317 | -88.80154, 123.9534 (-350 m N, -350 m E) | 79.2% / 79.2% / 82.1% | 58.1% | 59.2% at -88.78505, 124.3438 | r = 0.68 |

Best point supported by both models (maximum of min(ours at 2 m, published map)): **-88.78505, 124.3438**, ours 59.8%, published map 59.2%. Added to the app as a clearly labelled derived point; the original published coordinate is kept.

**All south-pole sites with terrain horizons vs the published map** (observer 2 m, 18.6 years). "(landform centre)" = IAU Gazetteer centre of a landform that is itself a NASA Artemis III region (one point, not a landing site; region boundary not plotted). The 60 m published map covers ~85°S-90°S only ("outside map" = not covered); the coarser 120 m map AVGVISIB_75S_120M_201608 (75°S-90°S) covers every site:

| Site | lat | E-lon | (1) Avg disk fraction | (2) Sun centre up | (3) Any part up | Published 60 m map | Difference (1) - 60 m map | Published 120 m map | Difference (1) - 120 m map |
|---|---|---|---|---|---|---|---|---|---|
| IM-1 Odysseus | -80.13 | 1.44 | 39.4% | 39.4% | 40.0% | outside map | n/a | 37.0% | 2.4 pts |
| IM-2 Athena | -84.7906 | 29.1957 | 45.0% | 45.0% | 46.7% | 46.0% | -1.0 pts | 46.5% | -1.5 pts |
| Peak near Shackleton (illuminated area) | -88.79 | 124.5 | 48.1% | 48.1% | 49.8% | 45.4% | 2.8 pts | 45.9% | 2.2 pts |
| Peak near Shackleton - best-lit point (derived) | -88.7851 | 124.3438 | 59.8% | 59.8% | 61.4% | 59.1% | 0.7 pts | 54.2% | 5.6 pts |
| Nobile Rim 2 (site DM2) | -84.20156 | 60.69989 | 32.8% | 32.8% | 34.2% | outside map | n/a | 34.6% | -1.8 pts |
| Mons Mouton (landform centre) | -84.6 | 31 | 30.1% | 30.1% | 33.1% | 32.8% | -2.8 pts | 33.6% | -3.5 pts |
| Mons Malapert (landform centre) | -85.98 | -1.67 | 33.9% | 33.9% | 34.6% | 39.0% | -5.1 pts | 43.2% | -9.3 pts |
| Shackleton crater centre (floor) | -89.67 | 129.78 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0 pts | 0.0% | 0.0 pts |

Sites covered by the 60 m map (excluding the derived point, which was chosen using that map): 5; |difference| mean 2.3 pts, max 5.1 pts. Against the coarser 120 m map (all 7 sites except the derived point): |difference| mean 3.0 pts, max 9.3 pts.

**Finding.** At the published coordinate, the published 60 m map itself gives 45.4%, and our model gives 48.1% (2 m, 18.6 years). Both are well below "approximately 80%". The ~80% figure is therefore not reproduced by the public map product at that coordinate. Possible reasons: the 2011 analysis used 240 m topography and different heights or periods, the coordinate is rounded to 0.01° (about ±150 m), and illumination changes a lot over a few hundred metres. We report this as-is. With the observer 10 m above the surface (the Mazarico et al. abstract notes that ~10 m height gains can greatly improve illumination), the best point within 500 m reaches 79.2% in our model; the published map at that point gives 58.1% (the map does not state its observer height).

## D. Terrain for clicked points (downsampled 240 m DEM): **PASS - shipped**

`tools/coarse_dem.py` builds a 2534 x 2534 grid at 240 m covering the whole map square, as the area mean of the finest LOLA DEM fully covering each pixel (LDEM_75S_120M, LDEM_80S_80M, LDEM_85S_20M); heights in whole metres, row differences, zlib, base64, embedded as `data/dem_coarse.js` (8.79 MB, loaded only when a point is clicked). The browser (Web Worker, `js/jobs.js`) computes the horizon with the method of `tools/terrain.py`: 360 azimuths, the same ray sample distances to 300 km, bilinear heights, lunar curvature, observer 2 m above the interpolated surface; rays stop at the edge of the grid.

Pass criteria (fixed before running `node tests/coarse_validation.js`): mean |difference in % sunlit (2027)| <= 5 points and max <= 10 points vs the 20 m-based horizons; mean |difference| in 18.6-year average illumination vs the published PGDA map <= 5 points.

**(1) Curated south-pole sites** (2027, 30-minute steps, Earth minimum elevation 0):

| Site | Horizon |diff| mean / max (deg) | Sunlit % (20 m) | Sunlit % (240 m) | Earth visible % (20 m) | Earth visible % (240 m) |
|---|---|---|---|---|---|
| IM-1 Odysseus | 0.19 / 1.15 | 38.3 | 38.3 | 100.0 | 100.0 |
| IM-2 Athena | 0.03 / 0.26 | 43.7 | 43.8 | 80.4 | 80.5 |
| Peak near Shackleton (illuminated area) | 0.42 / 1.28 | 49.6 | 53.5 | 15.2 | 23.7 |
| Peak near Shackleton - best-lit point (derived) | 0.46 / 1.97 | 61.0 | 57.2 | 27.8 | 24.8 |
| Nobile Rim 2 (site DM2) | 0.19 / 1.25 | 32.6 | 34.0 | 24.7 | 24.9 |
| Mons Mouton (landform centre) | 0.10 / 0.71 | 29.6 | 29.4 | 56.2 | 56.3 |
| Mons Malapert (landform centre) | 2.29 / 4.85 | 33.0 | 39.8 | 100.0 | 100.0 |
| Shackleton crater centre (floor) | 0.06 / 0.15 | 0.0 | 0.0 | 0.0 | 0.0 |

|difference in % sunlit|: mean **2.03**, max **6.86** points -> PASS. |difference in % Earth visible|: mean 1.49, max 8.54 points (reported, not a criterion). Horizon difference: mean of site means 0.47 deg, largest single azimuth 4.85 deg.

**(2) 50 random points in 85-90 S** (seed 20261114, uniform in area): 18.6-year average illumination (average visible solar-disk fraction, hourly 2027-01-01 to 2045-08-08 (hourly), same method and Sun-direction file as the cross-check) from the 240 m horizon vs the published map AVGVISIB_85S_060M_201608 (bilinear): |difference| mean **1.47**, median 0.98, max 16.01 points; 49/50 within 5 points; 8 points are in permanent shadow in both -> PASS.

| lat | E-lon | Ours (240 m) | Published map | Difference (pts) |
|---|---|---|---|---|
| -88.93271 | -10.82084 | 15.5% | 18.8% | -3.3 |
| -86.81233 | -94.06097 | 33.6% | 34.5% | -0.9 |
| -86.2407 | -50.53364 | 19.7% | 22.1% | -2.4 |
| -86.08357 | 131.5693 | 44.9% | 40.3% | 4.6 |
| -87.44114 | 176.70663 | 32.2% | 33.2% | -1.0 |
| -88.27863 | 70.70666 | 5.4% | 6.6% | -1.2 |
| -86.59476 | 36.22473 | 4.8% | 5.5% | -0.6 |
| -85.62515 | -15.90084 | 0.7% | 0.3% | 0.3 |
| -85.45101 | 164.16069 | 41.1% | 41.7% | -0.6 |
| -87.23427 | 167.1823 | 34.9% | 35.9% | -1.0 |
| -85.45945 | -42.97631 | 1.7% | 2.3% | -0.6 |
| -87.48613 | -176.50296 | 36.2% | 36.7% | -0.5 |
| -86.12282 | 94.97876 | 37.5% | 21.5% | 16.0 |
| -86.39628 | 78.49155 | 16.4% | 17.7% | -1.3 |
| -88.35832 | 20.23747 | 17.8% | 21.3% | -3.5 |
| -86.64337 | -128.97589 | 18.3% | 16.4% | 1.9 |
| -85.15071 | -53.61735 | 4.5% | 5.1% | -0.6 |
| -85.59778 | 12.5541 | 12.9% | 13.6% | -0.6 |
| -85.29751 | -92.82677 | 0.3% | 0.6% | -0.3 |
| -89.293 | 104.29524 | 31.9% | 32.4% | -0.5 |
| -85.69456 | 44.36391 | 16.6% | 18.9% | -2.3 |
| -88.93155 | -71.68308 | 21.0% | 23.8% | -2.8 |
| -88.61785 | -146.99346 | 0.0% | 0.0% | 0.0 |
| -85.22438 | 48.07295 | 0.0% | 0.0% | 0.0 |
| -87.7891 | -100.98474 | 3.3% | 5.3% | -2.0 |
| -85.46662 | -145.58449 | 34.1% | 35.3% | -1.2 |
| -88.00016 | -17.46748 | 4.4% | 6.8% | -2.4 |
| -85.50923 | -55.94002 | 2.7% | 3.2% | -0.6 |
| -85.27396 | 40.4436 | 28.9% | 30.4% | -1.5 |
| -85.99042 | 130.05191 | 47.0% | 43.0% | 4.0 |
| -86.12633 | 53.84003 | 32.4% | 33.8% | -1.4 |
| -87.0604 | -117.72518 | 24.0% | 22.7% | 1.2 |
| -85.07482 | 1.0722 | 13.0% | 13.8% | -0.8 |
| -85.14149 | 146.96206 | 15.3% | 17.5% | -2.2 |
| -86.10656 | 100.23585 | 10.4% | 10.0% | 0.3 |
| -87.38857 | 1.14605 | 0.0% | 0.0% | 0.0 |
| -88.01632 | 174.1791 | 32.8% | 32.2% | 0.6 |
| -88.29033 | 81.99756 | 0.0% | 0.0% | 0.0 |
| -87.82073 | -76.10839 | 15.3% | 15.1% | 0.2 |
| -85.96349 | 101.40287 | 34.4% | 35.5% | -1.0 |
| -86.98444 | 104.88089 | 0.0% | 0.0% | 0.0 |
| -85.6894 | -145.31102 | 10.6% | 12.2% | -1.5 |
| -85.10664 | 47.51299 | 0.0% | 0.1% | -0.1 |
| -87.33126 | -136.69448 | 24.9% | 25.6% | -0.6 |
| -88.15411 | -96.8105 | 0.0% | 0.0% | 0.0 |
| -87.14209 | 95.40091 | 1.6% | 3.0% | -1.3 |
| -87.55224 | -166.76776 | 24.1% | 25.2% | -1.1 |
| -86.11815 | 129.87317 | 43.7% | 44.4% | -0.7 |
| -85.00339 | -95.15112 | 32.0% | 30.5% | 1.4 |
| -85.74335 | 168.31705 | 0.0% | 0.4% | -0.4 |

Implementation check: on the same 240 m grid, `tools/terrain.py`'s own ray code and the browser code agree to 3.7e-10 deg (im2, mons_malapert, peak_shackleton).

Result: shipped. Clicked or typed points inside the map get this horizon, labelled "terrain from coarser 240 m data (less precise than curated sites)". No finer grid was needed. A 120 m grid of the same area would be about four times larger (over the 15 MB limit).

## Other checks (run separately)

* `node tests/features_test.js`: power model vs S*A*eta*sin(E_Horizons); launch-slip slip 0 = timeline metrics; the optional Earth mask leaves the validated default unchanged and equals "Earth el > horizon + minimum elevation"; the worker job code gives the same series as the engine; `js/core.js` is a verbatim rebuild of the engine; every requestable map tile exists, the tile set is < 80 MB, and the browser map projection puts the IAU Shackleton centre on the same tile pixel as the tile generator.
* `.venv/Scripts/python -I tools/tiles.py check`: tile georeference - for 5 sites the tile pixel containing the site has the DEM height of the site, and the Shackleton IAU centre is a ~3.5 km-deep bowl relative to a 10 km ring.
* `node tests/ui_check.js`: the app opened via file:// at laptop and phone sizes (all features, tour, Blob Web Worker, loader, reduced motion, map coverage limits, clicked-point terrain, outside-click message, the VERIFY_YOURSELF.md share link), no console errors.
* `node tests/coarse_validation.js`: section D above. `node tests/blind_test.js`: section C (offline re-check from the cache).
* `node tests/instant_status_check.js`: section F (also run by this script from the caches). `node tests/accuracy3d.js`: section G (its Python side, `tools/accuracy3d.py`, needs the DEMs; the result is cached).
* `node tests/ui_round5.js`: in the browser, the instant status at stored case times equals the independent status, the rover readout equals the verified values, relief shading changes no height, slope, light direction or status, the jump buttons land on times where the status is true, and the "Verify with NASA" URL is identical to the cached validation query.
* `node tests/features_test.js` also checks: every site has a primary/secondary source type and no Wikipedia source; the removed points have no site, horizon or computed rows; Artemis III regions are plotted only through landform centres or a published point; the downsampled DEM is <= 15 MB, decodes correctly and, with the shipped worker code, reproduces the stored validation; terrain for clicked points is gated on the validation result.

### Round 6 (3D fidelity, rover, usability; branch round6)

* `node tests/accuracy3d.js --python`: section G now includes the finer ring grids (ring A at 25 m from LDEM_85S_20M at 4 sites, ring B at 100 m at 7 sites): every grid point within 0.10 m of its DEM.
* `node tests/view3d_test.js` (round 6 additions): seams of the finer rings (5,120 hole-edge vertices identical, no missing cells); normal maps = the DEM vertex normals at the grid nodes; texture coordinates on texel centres; earthshine formula (full Earth = 0.434 x (R_E/d)^2, Lambert phase law, new Earth 0); mipmap chain = 2 x 2 averages.
* `node tests/shading_consistency.js`: unchanged from round 5 (Low 97.8 %, Medium 99.0 %, High 99.8 %); with the near-camera shadow cascade (min of both maps) agreement at the site marker is at least that of the full map on the same cases.
* `node tests/ui_round6.js`: rover wheels on the LOLA surface, tilt vs DEM slope, VIPER size, "About this rover" (statement, dated status, NASA sources), no traversability claims; camera presets vs engine Sun/Earth directions (0.05 deg); pointer inspection at the site marker (height within 1 m); hazard view; Show on 2D map; Getting started actions; 2D scale bar vs an independent great-circle measurement (0.5 %); laptop + phone, no console errors.
* Details and before/after numbers: ROUND6_REPORT.md; ground detail: docs/ground_detail/round6/.
