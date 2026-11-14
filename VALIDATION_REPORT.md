# LunaWindow - Validation Report

Generated 2026-11-14T06:58:38.902Z by `node tests/validate.js`.

## Overall: **PASS**

| Part | Result | Detail |
|---|---|---|
| A. Angles vs JPL Horizons (52 comparisons) | PASS | elevation max 0.0038 deg / mean 0.0009 deg; azimuth max 0.0554 deg / mean 0.0025 deg |
| A. Event times vs Horizons (4 events) | PASS | max 0.76 min / mean 0.42 min |
| B. Physics sanity tests (4) | PASS | see below |

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
| Chang'e-7 target, peak near SE ridge of Shackleton | -88.8 | 123.4 | 2026-12-01T00:00Z | Sun | 156.6677 | 156.6714 | -0.0038 | 0.3687 | 0.3683 | 0.0004 | PASS |
| Chang'e-7 target, peak near SE ridge of Shackleton | -88.8 | 123.4 | 2026-12-01T00:00Z | Earth | 243.2966 | 243.2998 | -0.0032 | -2.1493 | -2.1496 | 0.0003 | PASS |
| Chang'e-7 target, peak near SE ridge of Shackleton | -88.8 | 123.4 | 2027-04-17T06:30Z | Sun | 285.8942 | 285.8929 | 0.0013 | -1.1161 | -1.1161 | -0.0000 | PASS |
| Chang'e-7 target, peak near SE ridge of Shackleton | -88.8 | 123.4 | 2027-04-17T06:30Z | Earth | 239.3440 | 239.3421 | 0.0019 | -3.4150 | -3.4152 | 0.0002 | PASS |
| Chang'e-7 target, peak near SE ridge of Shackleton | -88.8 | 123.4 | 2027-11-03T15:00Z | Sun | 359.8777 | 359.8788 | -0.0011 | 2.7448 | 2.7457 | -0.0008 | PASS |
| Chang'e-7 target, peak near SE ridge of Shackleton | -88.8 | 123.4 | 2027-11-03T15:00Z | Earth | 240.5741 | 240.5746 | -0.0005 | -3.6170 | -3.6171 | 0.0001 | PASS |
| Chang'e-7 target, peak near SE ridge of Shackleton | -88.8 | 123.4 | 2028-07-22T21:45Z | Sun | 43.6833 | 43.6844 | -0.0010 | 1.0483 | 1.0486 | -0.0003 | PASS |
| Chang'e-7 target, peak near SE ridge of Shackleton | -88.8 | 123.4 | 2028-07-22T21:45Z | Earth | 234.4364 | 234.4368 | -0.0004 | -3.0792 | -3.0788 | -0.0004 | PASS |
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

Period: 2027-01-01 to 2028-01-01 UTC, 10-minute steps. Smooth-Moon horizon (0 deg everywhere).

| Test | Result | Pass |
|---|---|---|
| Exact south pole (-90, 0): Sun centre elevation within +-1.7 deg all year | min -1.547 deg, max 1.550 deg | PASS |
| Apollo 11: Earth above smooth horizon 100% of the year | 100.000% (min Earth el 57.96 deg) | PASS |
| Chang'e-4 (far side): Earth below smooth horizon 100% of the year | Earth up 0.000% (max Earth el -37.72 deg) | PASS |
| Equatorial near-side (0, 0): Sun above smooth horizon 45-55% of the year | 48.62% | PASS |

## Test sites

| Site | lat | E-lon | Source |
|---|---|---|---|
| Near south pole (test point) | -89.5 | 0 | Synthetic test coordinate |
| Chang'e-7 target, peak near SE ridge of Shackleton | -88.8 | 123.4 | https://en.wikipedia.org/wiki/Chang%27e_7 |
| Apollo 11 LM | 0.67416 | 23.47314 | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html |
| Apollo 15 LM (mid-latitude) | 26.13239 | 3.6333 | https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html |
| Chang'e-4 (far side) | -45.457 | 177.589 | https://lroc.im-ldi.com/images/1087 |
| East limb test point (Earth near horizon) | 0 | 88 | Synthetic test coordinate |

Notes: "Synthetic test coordinate" points are not landing sites; they were chosen to exercise geometry (near-pole Sun skimming, Earth near the east limb). The Chang'e-7 coordinate comes from a Wikipedia infobox (which itself cites a social-media post) and is used only as a test geometry.

## Terrain illumination cross-check

Peak near Shackleton (-88.79, 124.5) vs the published "approximately 80%" figure. Do-not-tune policy: nothing in the model was adjusted to match.

**Sources and definitions**

* Published claim: Mahanti et al. 2024 (PSJ 5, 62): "a small area (−88.79, 124.5) receives persistent solar illumination (approximately 80% of the time; Mazarico et al. 2011)." (https://iopscience.iop.org/article/10.3847/PSJ/ad1b50)
* Original method (abstract): Mazarico et al. 2011, Icarus 211: horizons from "240 m-resolution polar digital elevation models"; "simulations over long periods (several 18.6-years lunar precession cycles) with a high temporal resolution (6 h)". Observer height is not stated in the abstract; the full paper (Elsevier) was not accessible. (https://ntrs.nasa.gov/citations/20120010094)
* Published map product: NASA PGDA product 69: "Maps of the solar illumination, averaged over hourly timesteps spanning 18.6 years" (no start year given). Map AVGVISIB_85S_060M_201608 (60 m/px, based on LDEM_85S_060M), label: "average illumination by the solar disc ... indicate the percentage of timesteps where each pixel was sunlit (by any fraction of the solar disc)"; the same label's image description says "its average solar disc visibility". The two wordings differ, so we compute both definitions. (https://pgda.gsfc.nasa.gov/products/69)

**Method.** Sun directions from the validated LunaWindow engine (hourly, 2027-01-01 to 2045-08-08, 163057 steps = one 18.6-year nodal cycle; "2027" = calendar year 2027). Terrain horizons from LOLA LDEM_85S_20M/80S_80M/75S_120M (20 m/px near the site), 360 azimuths, rays to 300 km, at observer heights 2 m and 10 m above the surface. Three definitions: (1) average visible fraction of the solar disk, (2) % of time the Sun centre is above the horizon, (3) % of time any part of the disk is above the horizon. The published map (AVGVISIB_85S_060M_201608) is sampled at the same points (bilinear; nearest-pixel in brackets).

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

**Other curated sites vs the published map** (observer 2 m, 18.6 years):

| Site | lat | E-lon | (1) Avg disk fraction | (2) Sun centre up | (3) Any part up | Published map | Difference (1) - map |
|---|---|---|---|---|---|---|---|
| im2 | -84.7906 | 29.1957 | 45.0% | 45.0% | 46.7% | 46.0% | -1.0 pts |
| change7 | -88.8 | 123.4 | 55.1% | 55.1% | 57.1% | 49.0% | 6.1 pts |
| peak_shackleton | -88.79 | 124.5 | 48.1% | 48.1% | 49.8% | 45.4% | 2.8 pts |
| nobile_rim2_dm2 | -84.20156 | 60.69989 | 32.8% | 32.8% | 34.2% | n/a | n/a |
| mons_mouton | -84.6 | 31 | 30.1% | 30.1% | 33.1% | 32.8% | -2.8 pts |
| shackleton_centre | -89.67 | 129.78 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0 pts |

**Finding.** At the published coordinate, the published 60 m map itself gives 45.4%, and our model gives 48.1% (2 m, 18.6 years). Both are well below "approximately 80%". The ~80% figure is therefore not reproduced by the public map product at that coordinate. Possible reasons: the 2011 analysis used 240 m topography and different heights or periods, the coordinate is rounded to 0.01° (about ±150 m), and illumination changes a lot over a few hundred metres. We report this as-is. With the observer 10 m above the surface (the Mazarico et al. abstract notes that ~10 m height gains can greatly improve illumination), the best point within 500 m reaches 79.2% in our model; the published map at that point gives 58.1% (the map does not state its observer height).
