# ASTERIA - Lunar South Pole Landing Site Navigator

Entry for the **NASA Space Apps Challenge 2026** challenge "Lunar Landing Site Navigator".
*Not affiliated with NASA's ASTERIA CubeSat mission. Not endorsed by NASA.*

ASTERIA shows, for sites at the Moon's **south pole** and any date, when the **Sun** is above the local terrain horizon (solar power and heat) and when the **Earth** is above it (direct radio contact). At the pole the Sun skims around the horizon, so a few metres of hill decide between light and darkness. Mission planners, educators and the public can compare sites and dates, follow the light and communication windows, and see what a launch slip does to them.

## How to open it

Double-click **`index.html`**. It runs offline in any modern browser, with no server, build step or internet connection. All libraries, data and map tiles are loaded from local files. Heavy computations run in a background Web Worker built from inline source (this works from `file://`); if a browser refuses the worker, the same code runs on the page.

## What you see

**Explore** (default): the derived best-supported point near Peak near Shackleton, from now, for 30 days.

* **South-pole map** (about 80°S-90°S, pan and zoom). Layers:
  * **Terrain**: hillshade from LOLA elevation data, labelled "synthetic lighting, not real illumination". 18.6 m/px inside about 85°S, 74 m/px beyond.
  * **Slope** in degrees from the DEM, with a legend. Computed on a 37 m grid and shown as 74 m pixels.
  * **Average illumination**: NASA's published PGDA map, with its source and definition. It covers about 85°S-90°S.
  * **Site markers**: markers that overlap on screen are grouped with a count, and a click lists them.
  * Clicking anywhere selects a custom point and shows its lat/lon. Custom points use a smooth horizon.
* **Site Card** with three status tiles. Each has a plain-English line and a countdown:
  * **Sunlight** (amber): Sun up or down, time to the next sunset or sunrise.
  * **Earth link** (blue): Earth in view or hidden, time to the next Earthset or Earthrise.
  * **Mission status**: green for both, amber or blue for only one, grey for neither.
* **Sky view**: a 360° horizon panorama with the terrain skyline and the Sun and Earth at their computed positions. Play steps through computed samples only; nothing is interpolated.
* **Timeline** of sunlight, Earth link and both, with summary metrics.
* **Earth link windows** and **Sunlight windows**:
  * Each window with start, end, duration and maximum elevation.
  * An elevation-vs-time chart with the terrain horizon height at the body's azimuth.
  * Summary: % of time visible, longest blackout or darkness, number of windows, average window length.
  * **Minimum elevation above terrain for a usable link**: 0° by default. It applies to the windows, the timeline, Compare and Launch slip. Labelled "geometric line-of-sight only; antenna, power and ground-station availability are not modelled".
* **Expert view**: every technical value.
  * Elevations, azimuths and solar-disk % at the selected time.
  * Average illumination and horizon heights.
  * Sampling, methods and full sources.
* **Explain mode**: a "?" next to each metric says what it is and why it matters.
* **Getting started**: a 3-step hint on the first visit. It can be dismissed, and the dismissal is remembered.

**Tabs**

* **Launch slip**: a heatmap of the surface-mission metrics for landing slips of 0-60 days. Rows are either the metrics for one site or all 14 terrain sites. Click a cell to open that date.
* **Power**: a first-order solar power and battery estimate.
* **Compare**: up to 4 site and date scenarios, with sunlight and Earth-link metrics side by side.
* **Validation**: JPL Horizons comparison, sanity tests, and the terrain illumination cross-check against NASA's published map.
* **About**: methods, what is computed vs estimated, limitations, credits.

**Tour** (5 steps, all numbers read live from the app):

1. The south-pole map, and why the pole matters.
2. The selected polar site: the Sun skims the horizon and terrain blocks it, compared with Apollo 11 near the equator.
3. Earth link windows and the next Earthset.
4. What a 2-week launch slip changes.
5. The power and battery verdict.

**Shareable links**: `#site=...&t=...&w=...&me=...&tab=...` (or `#lat=..&lon=..` for a custom point) reopens the exact view.

**Pixel-art loader**: a small rocket flies from Earth to the Moon only when an operation is still running after 250 ms. There is no artificial delay. With reduced motion, a plain spinner is shown instead.

## Sites

There are 14 south-pole sites with LOLA terrain horizons, plus 11 reference sites outside the south pole. The reference sites use a smooth horizon (terrain not included) and are kept for comparison and education. Every site has source links and a note on exactly what its coordinate is (`data/sites.js`).

**NASA Artemis III candidate regions.** NASA's 28 Oct 2024 list of nine regions publishes the region boundaries only as images, with no coordinates. A region is plotted (with sunlight and Earth calculations) **only** where a point is genuinely inside it:

| Region (NASA) | Plotted point | Lat, E-lon |
|---|---|---|
| Malapert Massif | Mons Malapert, centre of the named landform (IAU 16338; "Malapert Massif" is not an IAU name); region boundary not plotted | -85.98, -1.67 |
| Mons Mouton | Mons Mouton, centre of the named landform (IAU 16070); region boundary not plotted | -84.60, 31.00 |
| Nobile Rim 2 | Site DM2, published point inside the region (Peña-Asensio et al., arXiv 2406.19863, accepted in Acta Astronautica) | -84.20156, 60.69989 |
| Peak near Cabeus B, Haworth, Mons Mouton Plateau, Nobile Rim 1, de Gerlache Rim 2, Slater Plain | none: listed by name only. "Official boundaries published only as images; not plotted, no values computed." | - |

Both landform centres were checked to lie inside the IAU Gazetteer outline of the landform. Earlier versions showed crater centres (Cabeus B, Haworth, Nobile, de Gerlache, Slater) for these regions; they were removed because a crater centre is not inside a rim, peak or plain region.

Other south-pole sites:

* Peak near Shackleton: the published point, plus the **derived** best-supported point.
* The Chang'e-7 target.
* IM-1 and IM-2.
* The Shackleton crater centre.

## Methods (short)

* **Ephemeris** (`js/engine.js`)
  * Positions from [Astronomy Engine](https://github.com/cosinekitty/astronomy) v2.1.19 (MIT).
  * Moon orientation from the IAU/WGCCRE model.
  * Light-time correction and first-order stellar aberration.
  * Local East-North-Up frame, azimuth clockwise from local north. No refraction.
  * Validated against JPL Horizons.
  * Round 2 changed it only by an optional `earthMask` argument (terrain + minimum link elevation). The default behaviour is unchanged, and a unit test checks this.
* **Events**: 10-minute scan (60 min for windows over 30 days), refined to 1 minute.
  * **Windows** come from the refined events. A window cut by the start or end of the period counts only its part inside the period, and is marked.
* **Terrain** (`tools/terrain.py`)
  * LOLA polar DEMs LDEM_85S_20M, LDEM_80S_80M and LDEM_75S_120M.
  * 360 rays to 300 km, observer 2 m above the ground, exact spherical geometry.
* **Map tiles** (`tools/tiles.py`)
  * Polar stereographic grid identical to the DEMs and to the browser CRS (`js/map.js`).
  * 8,195 tiles, 63.9 MB.
  * `python tools/tiles.py check` verifies the georeference: Shackleton's IAU centre lands on the 2,789 m-deep floor pixel. A browser test checks the same pixel through Leaflet.
* **Launch slip**: one series per site; each landing date is an exact slice of it, so slip 0 equals the Explore metrics. This is tested with the minimum elevation applied.
* **Power** (first-order estimate)
  * P = 1361 W/m² × (1 AU/d)² × area × efficiency × cos(incidence) × visible solar-disk fraction.
  * 1361 W/m² is the IAU 2015 Resolution B3 nominal total solar irradiance.

## Validation summary - **PASS**

| Test | Result |
|---|---|
| `node tests/validate.js`: 52 angle comparisons vs JPL Horizons | elevation error max 0.0038°, azimuth max 0.055° (Sun at 89° elevation) |
| 4 event times vs Horizons | max 0.76 min |
| Physics sanity tests (pole Sun ±1.55°, Apollo 11 Earth 100 %, Chang'e-4 Earth 0 %, equator Sun 48.6 %) | pass |
| `node tests/features_test.js` | power model, slip = timeline, minimum-elevation logic, worker job = engine, `js/core.js` in sync, all 8,195 requestable tiles exist, tiles < 80 MB, map projection |
| `node tests/ui_check.js` | laptop and phone via file://, every feature, tour, worker, loader, reduced motion; no console errors |

Terrain illumination cross-check against NASA's published average-illumination map (PGDA AVGVISIB_85S_060M_201608; 18.6 years, observer 2 m):

* 10 of our south-pole sites are covered by the map. Excluding the derived point, which was chosen using the map, our values differ from it by **1.9 points on average and 6.1 points at most**.
* The published "~80%" at Peak near Shackleton (−88.79, 124.5) is not reproduced by either model at that coordinate: ours 48.1 %, map 45.4 %. Nothing was tuned.
* Full tables are in [VALIDATION_REPORT.md](VALIDATION_REPORT.md) and on the Validation page.

## Terrain results (2027, `node tests/illumination.js`, Earth minimum elevation 0°)

| Site | Sunlit % (terrain) | Sunlit % (smooth) | Earth visible % | Both % |
|---|---|---|---|---|
| Peak near Shackleton - best-lit point (derived) | 61.0 | 50.9 | 27.8 | 17.2 |
| Chang'e-7 target | 55.0 | 51.0 | 55.8 | 32.9 |
| Peak near Shackleton (published point) | 49.6 | 50.9 | 15.2 | 7.3 |
| IM-2 Athena | 43.7 | 48.6 | 80.4 | 35.9 |
| IM-1 Odysseus | 38.3 | 48.6 | 100.0 | 38.3 |
| Nobile (feature) | 34.5 | 49.0 | 21.0 | 6.9 |
| Mons Malapert (feature) | 33.0 | 48.8 | 100.0 | 33.0 |
| Nobile Rim 2 (site DM2) | 32.6 | 49.1 | 24.7 | 7.7 |
| Mons Mouton (feature) | 29.6 | 48.6 | 56.2 | 20.0 |
| Cabeus B (feature, crater floor) | 8.3 | 49.8 | 38.1 | 4.5 |
| Haworth, de Gerlache, Slater (features, crater floors), Shackleton floor | 0.0 | 49-55 | 0-17 | 0.0 |

## Data sources

* NASA Artemis III candidate regions, 28 Oct 2024: https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
* IAU Gazetteer of Planetary Nomenclature (USGS): https://planetarynames.wr.usgs.gov/ (feature pages linked from each site)
* LRO LOLA gridded polar DEMs, PDS Geosciences Node: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
* LOLA average illumination maps, NASA PGDA product 69: https://pgda.gsfc.nasa.gov/products/69
  * Files: http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/
  * The PGDA page gives no licence text. It asks users to cite Mazarico et al. (2011), Icarus 211, 1066-1081, which the app does.
* NASA/JPL Horizons API (validation reference): https://ssd.jpl.nasa.gov/horizons/
* Solar constant: IAU 2015 Resolution B3, 1361 W/m² (Prša et al. 2016, AJ 152, 41)
* Apollo coordinates: NASA NSSDC. Robotic landers: LROC featured images.
* Other south-pole points: Mahanti et al. 2024 (PSJ 5, 62) and Peña-Asensio et al. (arXiv 2406.19863).
* Libraries: Astronomy Engine 2.1.19 (MIT), Leaflet 1.9.4 (BSD-2-Clause), both in `lib/`.

## Project layout

```
index.html               app (open this)
css/style.css            styling
js/engine.js             validated ephemeris engine (browser + Node)
js/core.js               GENERATED: Astronomy Engine + engine.js verbatim, so a Blob worker can reuse them
js/jobs.js               compute jobs (worker or main thread)
js/map.js                Leaflet map, polar stereographic CRS
js/app.js                UI;  js/loader.js pixel rocket loader;  js/explain.js "?" texts
lib/                     Astronomy Engine, Leaflet (local copies)
tiles/                   map tiles (hill, slope, illum);  data/tiles_meta.js
data/sites.js            sites + NASA Artemis III region list, with sources
data/horizons/*.js       LOLA terrain horizon masks (14 sites)
data/validation.js, data/illumination.js, data/illum_crosscheck*.js   generated results
tests/validate.js        Horizons + sanity validation -> VALIDATION_REPORT.md
tests/illumination.js    one-year terrain statistics
tests/features_test.js   unit tests (power, slip, minimum elevation, packaging, tiles, projection)
tests/ui_check.js        headless browser check (Playwright), laptop + phone, file://
tools/terrain.py         DEM reading, horizon masks
tools/tiles.py           map tile pyramids + georeference check
tools/illum_crosscheck.py, tools/export_sun_vectors.js   illumination cross-check
tools/build_core.js      builds js/core.js
```

## Re-running everything

```powershell
npm install                                  # astronomy-engine, playwright (tests only)
node tests/validate.js                       # validation (offline from the Horizons cache)
python -m venv .venv; .venv\Scripts\python -m pip install numpy pillow
# download ldem_85s_20m, ldem_80s_80m, ldem_75s_120m (.img + .lbl) into dem/, and
# AVGVISIB_85S_060M_201608.IMG/.LBL into dem/pgda/ (URLs above)
.venv\Scripts\python -I tools\terrain.py check
.venv\Scripts\python -I tools\terrain.py horizons
.venv\Scripts\python -I tools\tiles.py           # ~12 min, writes tiles/ and data/tiles_meta.js
node tests/illumination.js
node tools/export_sun_vectors.js -88.79 124.5 2027-01-01T00:00:00Z 2045-08-08T00:00:00Z 60 dem/work/sun_18p6y.bin
.venv\Scripts\python -I tools\illum_crosscheck.py         # ~10 min; "sites" argument = per-site rows only
node tests/validate.js
node tools/build_core.js                     # after any change to js/engine.js
node tests/features_test.js
npx playwright install chromium; node tests/ui_check.js
```

## Credits

Astronomy Engine by Don Cross (MIT). Leaflet by Volodymyr Agafonkin and contributors (BSD-2-Clause). LOLA data: NASA LRO/LOLA team via the PDS Geosciences Node. Illumination maps: NASA PGDA, Mazarico et al. 2011. Feature names and coordinates: IAU WGPSN / USGS Gazetteer of Planetary Nomenclature. JPL Horizons: NASA/JPL Solar System Dynamics Group. LROC: NASA/GSFC/Arizona State University.
