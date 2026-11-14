# ASTERIA - Lunar South Pole Landing Site Navigator

Entry for the **NASA Space Apps Challenge 2026** challenge "Lunar Landing Site Navigator".
*Not affiliated with NASA's ASTERIA CubeSat mission. Not endorsed by NASA.*

ASTERIA shows, for sites at the Moon's **south pole** and any date, when the **Sun** is above the local terrain horizon (solar power and heat) and when the **Earth** is above it (direct radio contact). At the pole the Sun skims around the horizon, so a few metres of hill decide between light and darkness. Mission planners, educators and the public can compare sites and dates, follow the light and communication windows, and see what a launch slip does to them.

## How this was made

ASTERIA was directed by a single team member. The code, the data-processing scripts, the documentation and the text in the app were generated with [Claude Code](https://www.anthropic.com/claude-code) (Anthropic), an AI coding assistant, under that person's direction. The calculations were validated against NASA/JPL Horizons and NASA's published PGDA illumination maps (see the validation summary below), and all data sources are cited. No image- or audio-generation model was used; the few graphics drawn in code by Claude Code (pixel-art rocket, Earth and Moon; the 3D rover) are marked "AI-generated" where shown. No NASA or NASA Space Apps logos or insignia are used. Details: [AI_DISCLOSURE.md](AI_DISCLOSURE.md). Every AI-written source file starts with "Generated with Claude Code (Anthropic) under human direction", and `index.html` carries `generator` and `ai-disclosure` meta tags.

## How to open it

Double-click **`index.html`**. It runs offline in any modern browser, with no server, build step or internet connection. All libraries, data and map tiles are loaded from local files. Heavy computations run in a background Web Worker built from inline source (this works from `file://`); if a browser refuses the worker, the same code runs on the page.

## What you see

**Explore** (default): the derived best-supported point near Peak near Shackleton, from now, for 30 days.

* **South-pole map** (about 80°S-90°S, pan and zoom). Layers:
  * **Terrain**: hillshade from LOLA elevation data, labelled "synthetic lighting, not real illumination". 18.6 m/px inside about 85°S, 74 m/px beyond.
  * **Slope** in degrees from the DEM, with a legend: sampled every 37 m and averaged over 74 m pixels (larger pixels when zoomed out).
  * **Average illumination**: NASA's published PGDA maps (product 69). The 60 m map AVGVISIB_85S_060M_201608 covers about 85°S-90°S only (dashed yellow outline); outside it, the coarser 120 m map AVGVISIB_75S_120M_201608 (75°S-90°S) is shown, each with its source, resolution, and a note that the documentation gives two different definitions.
  * **Site markers**: markers that overlap on screen are grouped with a count, and a click lists them.
  * On first load and with **Whole pole**, the map is zoomed so the data-coverage square fills the map panel (no empty margins, laptop and phone). On a panel that is not square, a strip of the square along the longer side is off-screen and can be reached by panning.
  * Panning and zooming are limited to the area covered by the map data; outside it is hatched and the edge is drawn. A click outside the data selects nothing and shows "No elevation data here - this map covers the lunar south pole (about 80°S to the pole)."
  * Clicking inside the map selects a custom point. It gets a terrain horizon computed in the browser from a downsampled 240 m DEM, labelled "terrain from coarser 240 m data (less precise than curated sites)". This was shipped only because it passed validation (see below). Typed points outside the map use a smooth horizon (a Moon without mountains), also labelled.
* **Site Card** with three status tiles. Each has a plain-English line and a countdown:
  * **Sunlight** (amber): Sun up or down, time to the next sunset or sunrise.
  * **Earth link** (blue): Earth in view or hidden, time to the next Earthset or Earthrise.
  * **Mission status**: green for both, amber or blue for only one, grey for neither.
  * If no change is found within the search limit (the window plus 400 days), the tile says e.g. "Next Earthset: Not within the next 430 days (search limit)", and Explain mode adds a one-line explanation. Compare and Launch slip, which only look inside their own window, say "Whole N-day window (no sunset within it)" or "No sunset within the N-day mission".
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

* **Launch slip**: a heatmap of the surface-mission metrics for landing slips of 0-60 days. Rows are either the metrics for one site or all 8 south-pole sites with terrain horizons. Click a cell to open that date.
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

**First-visit intro**: on the first visit only, a short title card (the pixel-art rocket flying from Earth to the Moon, "ASTERIA", "Lunar South Pole Landing Site Navigator"). Its length is one constant, `INTRO_MS = 3000`, at the top of `js/intro.js`. It is not a loading screen and says nothing about loading: the app loads and computes behind it, and if it is still computing when the intro ends, the normal loader takes over. Skip button; any click, tap or key skips it. It is skipped automatically with reduced motion, with a share link (`#site=...`, `#lat=...`) and in automated browsers (unless a test opts in). "Replay intro" is on the About page.

### 3D terrain view ("Deploy")

For each of the 8 curated south-pole sites (all inside the LOLA DEM coverage), the Site Card shows **Deploy: 3D terrain view**. Nothing of the 3D view is loaded before that click: Three.js (`lib/three/`, r149, MIT), `js/view3d*.js` and the site's terrain tile are added on demand (the rocket loader appears if that takes more than 250 ms; about 0.2-0.4 s in the tests). The view fades in and out; Close or Escape returns to the app.

* **Terrain**: a 6 km × 6 km LOLA tile centred on the site, at true scale (vertical exaggeration 1×, 2×, 3×, 5×, always shown on screen).
* **Sun**: the light direction and a disk at the engine's azimuth/elevation and angular size. **Earth**: a sphere at the engine's azimuth/elevation and angular size (about 1.9° across), lit by the same Sun direction, so its phase comes from the real geometry (the lit % is in Expert view). Plain blue (no clouds or continents).
* **Distant skyline**: the site's terrain horizon (`data/horizons`) drawn as a ring 60 km away, so from the site marker the 3D horizon matches the 2D sky view.
* **Shadows**: shadow mapping of the tile, labelled "Near-field shadows (visual approximation); distant terrain shadows not rendered; sunlit and Earth-visible status at the site marker come from the validated horizon model." When the validated model says the Sun is behind terrain at the site, a banner says so.
* **Panel**: time, Sunlight and Earth-link tiles at the site marker (same colours as the main app; from the validated model), Sun and Earth elevation/azimuth in Expert view, and a time slider and play button synced with the main app.
* **Controls**: Orbit (drag, right/Shift-drag to pan, wheel or pinch, arrow keys, + / -), Walk (eye 2 m above the ground as in the horizon model; WASD/arrows, Q/E, Shift; drag to look; on-screen arrow buttons), Rover.
* **Rover**: a simple AI-drawn illustration driven with WASD/arrows or the on-screen buttons. Shows position (m from the site and lat/lon), DEM elevation, local slope (gradient over one DEM cell) with a warning above a user-set limit (default 15°), and whether the Sun is above the tile's own terrain, labelled "near-field estimate".

| 3D view | Accurate (tested) | Approximate / not modelled |
|---|---|---|
| Terrain heights | Tile = bilinear LOLA DEM samples, within 0.05 m of direct DEM samples (`tools/terrain3d.py check`) | DEM resolution: 20 m (6 sites) or 80 m (IM-1, Nobile Rim 2); boulders, sub-grid relief and the lander are not represented. Phones draw every 2nd node (40 m); readouts still use the full grid |
| Geometry | Exact site-centred ENU positions including lunar curvature (about 5 m drop at the corners); nodes placed by true ground distance, so the stereographic scale factor is handled | Spherical Moon (R = 1737.4 km), as in the rest of the app |
| Sun | Light direction = engine az/el within 0.01° (1.7e-6° in `tests/view3d_test.js`; checked again in the browser); disk size from the engine | - |
| Earth | Position and angular size from the engine (< 0.01°); phase from the engine's Sun and Earth vectors | Plain sphere; unlit side drawn faintly so it can be found |
| Sunlit / Earth link at the site | From the validated horizon model (same as the main app) | - |
| Shadows on the tile | Cast by the tile's own terrain | Visual approximation (shadow-map resolution); shadows from terrain outside the tile are not rendered |
| Distant skyline | Exact horizon mask from the site marker | Drawn as a ring 60 km away: approximate when the camera is elsewhere; terrain between the tile edge and the skyline is not drawn (dark) |
| Lighting | - | A faint uniform fill light (not physical); no light reflected from terrain or Earthshine |
| Rover | DEM elevation and slope at the DEM's resolution | Sun "near-field estimate" uses the tile only; the rover model and speed are illustrative |
| Stars | - | Off by default; decorative random points, not a star catalogue |

## Sites

There are 8 south-pole sites with LOLA terrain horizons, plus 11 reference sites outside the south pole. The reference sites use a smooth horizon (terrain not included) and are kept for comparison and education. Every site has source links and a note on exactly what its coordinate is (`data/sites.js`).

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
  * 360 rays to 300 km, observer 2 m above the ground, spherical geometry (lunar curvature).
  * Clicked points: the same method in the Web Worker on a downsampled 240 m grid (`tools/coarse_dem.py`, `js/jobs.js`); it reproduces `terrain.py` on the same grid to 1e-9°, and was validated against the 20 m horizons and NASA's map before being enabled.
* **Map tiles** (`tools/tiles.py`)
  * Polar stereographic grid identical to the DEMs and to the browser CRS (`js/map.js`).
  * 8,536 tiles, 66.7 MB (incl. the outer 120 m illumination layer).
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
| Maximum Sun elevation at 20 random latitudes -60° to -90° (2027, smooth horizon): ≤ 90 - \|lat\| + 1.6°, within 0.2° of 90 - \|lat\| + 1.54° | pass: max - (90 - \|lat\|) between 1.504° and 1.550°, largest deviation from +1.54° is 0.036° |
| **Custom point, one-year check** (`node tests/one_year_check.js`): (-70.9457, 67.9235 E), smooth horizon, Earth and Sun every hour 2026-11-14 to 2027-11-14 vs fresh Horizons fetches (8,761 rows each) | elevation max 0.0028°, azimuth max 0.0039°; Horizons' lowest Earth elevation 1.634° (2026-12-08 05:31 UTC), so Earth never sets there that year, and the app shows no Earthset either; 24/24 sunrises/sunsets within 1.42 min |
| **Blind test** (`node tests/blind_test.js --new`): 5 new random south-pole site/time cases in 2026-2030, fetched fresh from Horizons, 10 comparisons | 10/10 pass; elevation max 0.0029°, azimuth max 0.0038° |
| **Terrain for clicked points** (`node tests/coarse_validation.js`), 240 m data | curated sites: % sunlit differs from the 20 m horizons by 2.0 points on average, 6.9 at most (limits 5 / 10); 50 random points in 85-90°S vs NASA's map: 1.5 points on average (limit 5) -> PASS, shipped |
| `node tests/view3d_test.js` | 3D geometry: Sun and Earth direction vectors vs the engine's raw apparent vectors (96 site/time cases, worst 1.7e-6°), tile decoder vs DEM check points (0.05 m), curvature, world-to-grid inverse, slope, near-field Sun, Earth phase, lazy loading |
| `.venv\Scripts\python -I tools\terrain3d.py check` | 3D tiles: site centre + 3 random nodes per site vs raw DEM samples by an independent path, worst 0.049 m (limit 1 m) |
| `node tests/features_test.js` | power model, slip = timeline, minimum-elevation logic, worker job = engine, `js/core.js` in sync, all 8,536 requestable tiles exist, tiles < 80 MB, map projection, site sources and Artemis region rules, downsampled DEM size/decoding/gating, SUBMISSION_LINKS.md links all cited, AI-disclosure meta tags and file headers |
| `node tests/ui_check.js` | laptop and phone via file://, every feature, tour, worker, loader, reduced motion, map fit (data square fills the panel on first load and after "Whole pole"), map coverage limits, search-limit wording, clicked-point terrain, the VERIFY_YOURSELF share link, the 3D view (lazy loading, light direction vs engine < 0.01° in the browser, Earth position and size, time sync both ways, exaggeration label, orbit/walk/rover controls incl. on-screen buttons, phone mesh reduction, GPU memory freed on close), the first-visit intro (shows once, Skip/key/tap, auto-close after 3 s, not with a share link, reduced motion or in tests unless enabled, replay); no console errors |

Terrain illumination cross-check against NASA's published average-illumination maps (PGDA product 69; 18.6 years, observer 2 m):

* 60 m map (AVGVISIB_85S_060M_201608, about 85°S-90°S): 5 of our south-pole sites (excluding the derived point, which was chosen using that map) differ from it by **2.3 points on average and 5.1 at most**.
* 120 m map (AVGVISIB_75S_120M_201608, 75°S-90°S, covers every site): **3.0 points on average, 9.3 at most** (Mons Malapert landform centre).
* The published "~80%" at Peak near Shackleton (−88.79, 124.5) is not reproduced by either model at that coordinate: ours 48.1 %, the 60 m map 45.4 %. Nothing was tuned.
* Full tables are in [VALIDATION_REPORT.md](VALIDATION_REPORT.md) and on the Validation page.

**Check it yourself:** [VERIFY_YOURSELF.md](VERIFY_YOURSELF.md) shows, without programming, how to repeat a blind-test case in a browser against NASA/JPL Horizons, check coordinates in LROC Quickmap, compare a site with NASA's illumination map, and read a saved raw Horizons response. All user-facing claims are listed with their basis in [TEXT_AUDIT.md](TEXT_AUDIT.md).

## Terrain results (2027, `node tests/illumination.js`, Earth minimum elevation 0°)

| Site | Sunlit % (terrain) | Sunlit % (smooth) | Earth visible % | Both % |
|---|---|---|---|---|
| Peak near Shackleton - best-lit point (derived) | 61.0 | 50.9 | 27.8 | 17.2 |
| Peak near Shackleton (illuminated area) | 49.6 | 50.9 | 15.2 | 7.3 |
| IM-2 Athena | 43.7 | 48.6 | 80.4 | 35.9 |
| IM-1 Odysseus | 38.3 | 48.6 | 100.0 | 38.3 |
| Mons Malapert (landform centre) | 33.0 | 48.8 | 100.0 | 33.0 |
| Nobile Rim 2 (site DM2) | 32.6 | 49.1 | 24.7 | 7.7 |
| Mons Mouton (landform centre) | 29.6 | 48.6 | 56.2 | 20.0 |
| Shackleton crater centre (floor) | 0.0 | 54.6 | 0.0 | 0.0 |

## Data sources

Every site records `sourceType` (all **primary** this round) and what its source states (`sourceCheck`), shown in Expert view. All coordinate sources were re-fetched and checked on 2026-11-14.

* NASA Artemis III candidate regions, 28 Oct 2024: https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ (2022 list: https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/)
* IAU Gazetteer of Planetary Nomenclature (USGS): https://planetarynames.wr.usgs.gov/ (feature pages linked from each site)
* LRO LOLA gridded polar DEMs, PDS Geosciences Node: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
* LOLA average illumination maps, NASA PGDA product 69: https://pgda.gsfc.nasa.gov/products/69 (AVGVISIB_85S_060M_201608 and AVGVISIB_75S_120M_201608)
  * Files: https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/
  * The PGDA page gives no licence text. It asks users to cite Mazarico et al. (2011), Icarus 211, 1066-1081 (https://doi.org/10.1016/j.icarus.2010.10.030; original method abstract on NASA NTRS: https://ntrs.nasa.gov/citations/20120010094), which the app does.
* NASA/JPL Horizons API (validation reference): https://ssd.jpl.nasa.gov/horizons/
* Solar constant: IAU 2015 Resolution B3, 1361 W/m² (Prša et al. 2016, AJ 152, 41; https://arxiv.org/abs/1510.07674, value read from the resolution text)
* Apollo coordinates: NASA NSSDC. Robotic landers: LROC featured-image pages (Blue Ghost M1: post-landing page 1407).
* Other south-pole points: Mahanti et al. 2024 (PSJ 5, 62) and Peña-Asensio et al. (arXiv 2406.19863, "Accepted for publication in Acta Astronautica").
* Libraries: Astronomy Engine 2.1.19 (MIT), Leaflet 1.9.4 (BSD-2-Clause), Three.js r149 (MIT, https://threejs.org/, loaded only by Deploy), all in `lib/`.
* Development tools (not shipped): Python (https://www.python.org/) with NumPy (https://numpy.org/) and Pillow (https://python-pillow.org/), Playwright (https://playwright.dev/), Claude Code (https://www.anthropic.com/claude-code).
* All links used for the submission: [SUBMISSION_LINKS.md](SUBMISSION_LINKS.md).

## Project layout

```
index.html               app (open this)
css/style.css            styling
js/engine.js             validated ephemeris engine (browser + Node)
js/core.js               GENERATED: Astronomy Engine + engine.js verbatim, so a Blob worker can reuse them
js/jobs.js               compute jobs (worker or main thread), incl. the clicked-point terrain horizon
js/map.js                Leaflet map, polar stereographic CRS, data-coverage limits
js/app.js                UI;  js/loader.js pixel rocket loader;  js/explain.js "?" texts
js/intro.js              first-visit intro (INTRO_MS at the top)
js/view3d.js             3D view (loaded only by Deploy);  js/view3d_math.js its geometry (also used by Node tests)
lib/                     Astronomy Engine, Leaflet, Three.js (local copies)
tiles/                   map tiles (hill, slope, illum, illum120);  data/tiles_meta.js
data/sites.js            sites (with source type) + NASA Artemis III region list
data/horizons/*.js       LOLA terrain horizon masks (8 south-pole sites)
data/dem_coarse.js       downsampled 240 m DEM for clicked points (8.8 MB, loaded on first click)
data/validation.js, data/illumination.js, data/illum_crosscheck*.js,
data/coarse_validation.js, data/blind_test.js                        generated results
tests/validate.js        Horizons + sanity + blind test -> VALIDATION_REPORT.md
tests/horizons_api.js    shared JPL Horizons client and cache (tests/horizons_cache/)
tests/blind_test.js      picks and fetches new random blind-test cases (--new)
tests/one_year_check.js  custom point, one year of hourly Horizons rows (run by validate.js; writes data/one_year_check.js)
tests/coarse_validation.js  validation of terrain for clicked points
tests/illumination.js    one-year terrain statistics
tests/features_test.js   unit tests
tests/view3d_test.js     3D geometry unit tests
tests/ui_check.js        headless browser check (Playwright), laptop + phone, file://
tools/terrain.py         DEM reading, horizon masks
tools/terrain3d.py       6 km terrain tiles for the 3D view (build / check) -> data/terrain3d/
tools/coarse_dem.py      builds data/dem_coarse.js (+ "check": terrain.py on the same grid)
tools/tiles.py           map tile pyramids + georeference check ("illum120" = outer illumination layer only)
tools/illum_crosscheck.py, tools/export_sun_vectors.js   illumination cross-check
tools/build_core.js      builds js/core.js
README.md, GAPS_AND_ISSUES.md, VALIDATION_REPORT.md, TEXT_AUDIT.md, VERIFY_YOURSELF.md,
AI_DISCLOSURE.md, SUBMISSION_LINKS.md
```

## Re-running everything

```powershell
npm install                                  # astronomy-engine, playwright (tests only)
node tests/validate.js                       # validation (offline from the Horizons cache)
python -m venv .venv; .venv\Scripts\python -m pip install numpy pillow
# download ldem_85s_20m, ldem_80s_80m, ldem_75s_120m (.img + .lbl) into dem/, and
# AVGVISIB_85S_060M_201608 and AVGVISIB_75S_120M_201608 (.IMG/.LBL) into dem/pgda/ (URLs above)
.venv\Scripts\python -I tools\terrain.py check
.venv\Scripts\python -I tools\terrain.py horizons
.venv\Scripts\python -I tools\terrain3d.py build   # 3D tiles (seconds); 'check' compares them with the DEM
.venv\Scripts\python -I tools\tiles.py           # ~12 min, writes tiles/ and data/tiles_meta.js
node tests/illumination.js
node tools/export_sun_vectors.js -88.79 124.5 2027-01-01T00:00:00Z 2045-08-08T00:00:00Z 60 dem/work/sun_18p6y.bin
.venv\Scripts\python -I tools\illum_crosscheck.py         # ~10 min; "sites" = per-site rows only
.venv\Scripts\python -I tools\illum_crosscheck.py pgda120 # adds the 120 m map value per site
.venv\Scripts\python -I tools\coarse_dem.py 240           # data/dem_coarse.js
.venv\Scripts\python -I tools\coarse_dem.py check 240     # terrain.py on the same grid (implementation check)
node tests/coarse_validation.js              # must PASS for clicked-point terrain to be enabled
node tests/blind_test.js                     # offline re-check; "--new" picks and fetches new cases
node tests/one_year_check.js                 # custom point, one-year check (fetches once, then from the cache)
node tests/validate.js
node tools/build_core.js                     # after any change to js/engine.js
node tests/view3d_test.js
node tests/features_test.js
npx playwright install chromium; node tests/ui_check.js
```

## Credits

Astronomy Engine by Don Cross (MIT). Leaflet by Volodymyr Agafonkin and contributors (BSD-2-Clause). Three.js by the three.js authors (MIT). LOLA data: NASA LRO/LOLA team via the PDS Geosciences Node. Illumination maps: NASA PGDA, Mazarico et al. 2011. Feature names and coordinates: IAU WGPSN / USGS Gazetteer of Planetary Nomenclature. JPL Horizons: NASA/JPL Solar System Dynamics Group. LROC: NASA/GSFC/Arizona State University.
