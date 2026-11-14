# LunaWindow - Lunar Landing Site Navigator

Entry for the **NASA Space Apps Challenge 2026** challenge "Lunar Landing Site Navigator".
*Not endorsed by NASA.*

LunaWindow shows, for any lunar site and date, when the **Sun** is above the local horizon (solar power) and when the **Earth** is above it (direct-to-Earth communication). It focuses on the lunar south pole, where the Sun skims the horizon and terrain decides everything. Mission planners, educators and the public can use it to compare sites and dates, and to see what a launch slip does to the power and communication windows.

## How to open it

Double-click **`index.html`**. It runs offline in any modern browser, with no server, build step or internet connection. All libraries and data are loaded from local `<script>` tags.

## What you can do

**New here? Press "Take the 60-second tour"** in the top bar. It walks through five steps:

1. Apollo 11, where Earth is always up.
2. Peak near Shackleton, where the terrain horizon decides when the Sun is visible.
3. The sunset countdown.
4. What a 2-week launch slip does to power and DTE.
5. A power and battery check.

All captions are computed live from the app's own results. The app opens on Peak near Shackleton, from now, with a 30-day window.

* **Explorer**
  * Pick a curated site (searchable list, or a marker on the south-pole map) or type or click custom coordinates.
  * Choose a UTC start time ("Now" button; Riyadh time is shown alongside) and a 7, 14, 30, 90 or 365-day window.
  * Press play to animate.
  * **Countdown cards** show the time to the next sunset/sunrise and Earthset/Earthrise.
  * **Sky view**: a 360° horizon panorama with the LOLA terrain silhouette, Sun and Earth at true angular size, and their tracks over the window.
  * **Timeline** bars for Sun visible, Earth visible and Both (power + DTE), with these metrics:
    * % sunlit (Sun centre up)
    * **average illumination** (mean visible fraction of the solar disk)
    * % Earth visible
    * % both
    * longest darkness
    * longest Earth blackout
* **Compare**: up to 4 site and date scenarios side by side, with the best value in each row highlighted. "Slip first by N days" re-evaluates the same site after a schedule slip.
* **Launch slip**: a heatmap of how the surface mission changes if landing slips by 0-60 days (configurable).
  * Inputs: nominal landing date, mission duration (default 14 Earth days) and slip step.
  * Rows are either the metrics for the current site, or several sites (all sites in Compare, or all south-pole terrain sites).
  * Hover a cell for every value. The nominal date and the best date are outlined.
  * A line chart shows the chosen metric against slip.
  * Click a cell to open that site and date in the Explorer.
* **Power**: a solar power and battery calculator.
  * Inputs: panel area, efficiency and load; usable battery fraction.
  * Orientation: vertical Sun-tracking, horizontal, or vertical facing a fixed azimuth.
  * Mission window: the Explorer window or the launch-slip mission.
  * Outputs: a power vs time chart, energy generated vs needed, the energy balance, mean and peak power, and the battery needed to survive the longest darkness.
  * Labelled as a first-order estimate.
* **Shareable links**: the URL (`#site=...&t=...&w=...&tab=...`, or `#lat=..&lon=..` for custom points) reopens the exact view. Use the "Copy link" button.
* **Explain mode**: plain-language notes on why the Sun skims the polar horizon (the Moon's axis is tilted about 1.5°) and how libration makes Earth bob near the horizon.
* **Validation**: every comparison against JPL Horizons, the sanity tests, and the terrain illumination cross-check against NASA's published LOLA illumination map.
* **About**: methods, limitations and credits.

## Methods (short)

* **Ephemeris** (`js/engine.js`)
  * Positions come from [Astronomy Engine](https://github.com/cosinekitty/astronomy) v2.1.19 (MIT).
  * Moon orientation comes from the IAU/WGCCRE model (`Astronomy.RotationAxis(Body.Moon)`), which gives the pole RA/Dec and the prime-meridian angle W.
  * Sun and Earth vectors are taken from the site on the Moon, with light-time correction (target at the retarded time) and first-order stellar aberration (Moon's velocity). They are rotated to the Moon body-fixed frame, then to the site's local East-North-Up frame.
  * Azimuth is clockwise from local north (toward the lunar north pole). At exactly ±90° latitude, "north" follows the meridian of the given longitude.
  * There is no refraction, because the Moon has no atmosphere.
* **Events**: a 10-minute scan with bisection to 1 minute, against a 360-value horizon mask.
* **Launch slip** (`LunaEngine.slipScan`)
  * One series spans the whole slip range, at the same sampling step the timeline uses for the mission length.
  * Each landing date is an exact slice of that series, so slip 0 reproduces the Explorer timeline metrics. This is tested in Node and in the browser.
* **Power** (`LunaEngine.panelPower`)
  * P = 1361 W/m² × (1 AU / Sun distance)² × area × efficiency × cos(incidence) × visible fraction of the solar disk.
  * 1361 W/m² is the IAU 2015 Resolution B3 nominal total solar irradiance (Prša et al. 2016, AJ 152, 41).
  * cos(incidence) depends on the orientation:
    * Sun-tracking vertical panel: cos(el)
    * horizontal panel: sin(el)
    * fixed vertical panel facing azimuth A: cos(el)·cos(az − A)
    * Negative values are clipped to 0 (Sun behind the panel).
  * The unit test checks a horizontal panel against S·A·η·sin(E), with E taken from JPL Horizons: error 0.001%.
* **Terrain** (`tools/terrain.py`)
  * Uses the LOLA gridded polar DEMs LDEM_85S_20M (20 m/px), LDEM_80S_80M (80 m/px) and LDEM_75S_120M (120 m/px).
  * The polar stereographic projection comes from the PDS labels and `DSMAP_POLAR.CAT`.
  * 360 rays per site are ray-marched along great circles out to 300 km, with an observer 2 m above the ground and exact spherical geometry (curvature included).
  * Projection checks:
    * Shackleton's ~4 km-deep bowl appears at the correct longitude and not at the mirrored one.
    * IM-1's LOLA height is 2593 m, against LROC's 2579 m.
    * The 20 m and 80 m DEMs agree within 0.5 m.
* **Sites** (`data/sites.js`): 19 curated sites, every one with source URL(s) and a note on exactly what the coordinate is.
  * Peak near Shackleton has two entries: the published coordinate, and a clearly labelled **derived** "best-lit point" from the cross-check below.

## Validation summary (`node tests/validate.js`) - **PASS**

| Part | Result |
|---|---|
| 52 angle comparisons vs JPL Horizons. 6 sites: near pole −89.5°, Chang'e-7/Shackleton ridge, Apollo 11, Apollo 15, Chang'e-4 far side, east-limb point. Dates 2026-2028, Sun up to 89° elevation | Elevation error max **0.0038°** (mean 0.0009°). Azimuth error max **0.055°** (Sun at 89° elevation, near the zenith); all other cases ≤ 0.008° |
| 4 event times (sunset ×3, Earthset ×1) vs Horizons 1-minute tables | max **0.76 min** |
| South pole Sun elevation over a year within ±1.7° | −1.547° … +1.550° ✔ |
| Apollo 11: Earth always up | 100 % ✔ |
| Chang'e-4: Earth never up | 0 % ✔ |
| Equatorial near side: Sun up 45-55 % | 48.6 % ✔ |
| Feature tests (`node tests/features_test.js`) | power model vs S·A·η·sin(E) within 0.001 %; slip 0 = timeline metrics exactly ✔ |
| Headless UI check (`node tests/ui_check.js`), laptop and phone | all features exercised, no console errors ✔ |

The full tables are in [VALIDATION_REPORT.md](VALIDATION_REPORT.md) and on the app's Validation page. Horizons responses are cached in `tests/horizons_cache/`, so the test reruns offline.

## Terrain results (2027, LOLA horizons, `node tests/illumination.js`)

| Site | Sunlit % (terrain) | Sunlit % (smooth) | Earth visible % |
|---|---|---|---|
| Chang'e-7 target (Shackleton SE ridge) | 55.0 | 51.0 | 55.8 |
| Peak near Shackleton (−88.79, 124.5) | 49.6 | 50.9 | 15.2 |
| IM-2 Athena | 43.7 | 48.6 | 80.4 |
| IM-1 Odysseus | 38.3 | 48.6 | 100.0 |
| Nobile Rim 2 (DM2) | 32.6 | 49.1 | 24.7 |
| Mons Mouton | 29.6 | 48.6 | 56.2 |
| Shackleton crater floor | **0.0** | 54.6 | 0.0 |

| Peak near Shackleton - derived best-lit point | 61.0 | 50.9 | 27.8 |

### Terrain illumination cross-check (`tools/illum_crosscheck.py`)

The cross-check compares Peak near Shackleton (−88.79, 124.5) with the published "approximately 80%" (Mahanti et al. 2024, citing Mazarico et al. 2011). The reference is NASA's public LOLA average-illumination map AVGVISIB_85S_060M_201608 (PGDA product 69, hourly over 18.6 years).

| | Avg disk fraction | Sun centre up | Any part up |
|---|---|---|---|
| LunaWindow, 2 m, 2027 | 49.6 % | 49.6 % | 51.3 % |
| LunaWindow, 2 m, 18.6 yr (2027-2045) | 48.1 % | 48.1 % | 49.8 % |
| LunaWindow, 10 m, 18.6 yr | 59.6 % | 59.6 % | 61.5 % |
| Published map at the same point | 45.4 % | | |
| Best point within 500 m (2 m, both models agree) | ours 59.8 %, map 59.2 % | | |
| Best point within 500 m (10 m, ours) | 79.2 % | | |

* Our model and the published map agree within a few points at IM-2, Mons Mouton and the Shackleton floor. The Chang'e-7 target is the largest difference: 55.1 % (ours) vs 49.0 % (map).
* At the published coordinate, neither model reproduces "~80%". Nothing was tuned. Details are in VALIDATION_REPORT.md and [GAPS_AND_ISSUES.md](GAPS_AND_ISSUES.md).

## Data sources

* NASA/JPL Horizons API - validation reference: https://ssd.jpl.nasa.gov/horizons/
* LOLA average illumination maps (Mazarico et al.), NASA PGDA product 69: https://pgda.gsfc.nasa.gov/products/69 (files: http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/)
* Solar constant: IAU 2015 Resolution B3 nominal total solar irradiance 1361 W/m² (Prša et al. 2016, AJ 152, 41, https://arxiv.org/abs/1510.07674)
* LRO LOLA gridded polar DEMs, PDS Geosciences Node: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
* Apollo coordinates: NASA NSSDC https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html
* Robotic lander positions: LROC featured images (lroc.im-ldi.com), cross-checked with Wikipedia.
* South-pole points: Mahanti et al. 2024, *PSJ* 5, 62; Peña-Asensio et al., arXiv 2406.19863; Wikipedia feature coordinates; NASA Artemis III region announcements.
* Useful viewers: LROC Quickmap https://quickmap.lroc.asu.edu/ , NASA Moon Trek https://trek.nasa.gov/moon/

## Project layout

```
index.html            app (open this)
css/style.css         styling
js/engine.js          ephemeris engine (browser + Node)
js/app.js             UI
lib/                  astronomy.browser.min.js (Astronomy Engine, MIT)
data/sites.js         curated sites with sources
data/horizons/*.js    LOLA terrain horizon masks
data/southpole_hillshade.png, data/map_meta.js   south-pole map
data/validation.js, data/illumination.js         generated results
tests/validate.js     Horizons + sanity validation -> VALIDATION_REPORT.md
tests/illumination.js one-year terrain illumination stats
tests/features_test.js power model + launch-slip consistency unit tests
tests/ui_check.js     headless browser check of every feature (Playwright)
tools/terrain.py      DEM reading, horizon masks, hillshade
tools/export_sun_vectors.js  hourly Sun directions (18.6 yr) for the cross-check
tools/illum_crosscheck.py    terrain illumination cross-check vs published LOLA map
data/illum_crosscheck.js     cross-check results (shown on the Validation page)
```

## Re-running everything

```powershell
npm install                                  # astronomy-engine, playwright (tests only)
node tests/validate.js                       # validation (offline from cache)
python -m venv .venv; .venv\Scripts\python -m pip install numpy pillow
# download ldem_85s_20m, ldem_80s_80m, ldem_75s_120m (.img + .lbl) from the PDS URL above into dem/
.venv\Scripts\python -I tools\terrain.py check
.venv\Scripts\python -I tools\terrain.py horizons
.venv\Scripts\python -I tools\terrain.py hillshade
node tests/illumination.js
# cross-check: download AVGVISIB_85S_060M_201608.IMG/.LBL from the PGDA link above into dem/pgda/
node tools/export_sun_vectors.js -88.79 124.5 2027-01-01T00:00:00Z 2045-08-08T00:00:00Z 60 dem/work/sun_18p6y.bin
.venv\Scripts\python -I tools\illum_crosscheck.py   # ~10 min
node tests/validate.js                       # regenerates VALIDATION_REPORT.md incl. cross-check
node tests/features_test.js
npx playwright install chromium; node tests/ui_check.js
```

## Credits

Astronomy Engine by Don Cross (MIT). LOLA data: NASA LRO / LOLA team via the PDS Geosciences Node. JPL Horizons: NASA/JPL Solar System Dynamics Group. LROC: NASA/GSFC/Arizona State University.
