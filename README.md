# LunaWindow - Lunar Landing Site Navigator

Entry for the **NASA Space Apps Challenge 2026** challenge "Lunar Landing Site Navigator".
*Not endorsed by NASA.*

LunaWindow shows, for any lunar site and date, when the **Sun** is above the local horizon (solar power) and when the **Earth** is above it (direct-to-Earth communication). It focuses on the lunar south pole, where the Sun skims the horizon and terrain decides everything. Mission planners, educators and the public can use it to compare sites and dates, and to see what a launch slip does to the power and communication windows.

## How to open it

Double-click **`index.html`**. It runs offline in any modern browser, with no server, build step or internet connection. All libraries and data are loaded from local `<script>` tags.

## What you can do

* **Explorer**
  * Pick a curated site (searchable list, or a marker on the south-pole map) or type or click custom coordinates.
  * Choose a UTC start time ("Now" button; Riyadh time is shown alongside) and a 7, 30, 90 or 365-day window.
  * Press play to animate.
  * **Countdown cards** show the time to the next sunset/sunrise and Earthset/Earthrise.
  * **Sky view**: a 360° horizon panorama with the LOLA terrain silhouette, Sun and Earth at true angular size, and their tracks over the window.
  * **Timeline** bars for Sun visible, Earth visible and Both (power + DTE), plus % sunlit, % Earth visible, % both, longest darkness and longest Earth blackout.
* **Compare**: up to 4 site and date scenarios side by side, with the best value in each row highlighted. "Slip first by N days" re-evaluates the same site after a schedule slip.
* **Explain mode**: plain-language notes on why the Sun skims the polar horizon (the Moon's axis is tilted about 1.5°) and how libration makes Earth bob near the horizon.
* **Validation**: every comparison against JPL Horizons, plus the sanity tests.
* **About**: methods, limitations and credits.

## Methods (short)

* **Ephemeris** (`js/engine.js`)
  * Positions come from [Astronomy Engine](https://github.com/cosinekitty/astronomy) v2.1.19 (MIT).
  * Moon orientation comes from the IAU/WGCCRE model (`Astronomy.RotationAxis(Body.Moon)`), which gives the pole RA/Dec and the prime-meridian angle W.
  * Sun and Earth vectors are taken from the site on the Moon, with light-time correction (target at the retarded time) and first-order stellar aberration (Moon's velocity). They are rotated to the Moon body-fixed frame, then to the site's local East-North-Up frame.
  * Azimuth is clockwise from local north (toward the lunar north pole). At exactly ±90° latitude, "north" follows the meridian of the given longitude.
  * There is no refraction, because the Moon has no atmosphere.
* **Events**: a 10-minute scan with bisection to 1 minute, against a 360-value horizon mask.
* **Terrain** (`tools/terrain.py`)
  * Uses the LOLA gridded polar DEMs LDEM_85S_20M (20 m/px), LDEM_80S_80M (80 m/px) and LDEM_75S_120M (120 m/px).
  * The polar stereographic projection comes from the PDS labels and `DSMAP_POLAR.CAT`.
  * 360 rays per site are ray-marched along great circles out to 300 km, with an observer 2 m above the ground and exact spherical geometry (curvature included).
  * Projection checks:
    * Shackleton's ~4 km-deep bowl appears at the correct longitude and not at the mirrored one.
    * IM-1's LOLA height is 2593 m, against LROC's 2579 m.
    * The 20 m and 80 m DEMs agree within 0.5 m.
* **Sites** (`data/sites.js`): 18 curated sites, every one with source URL(s) and a note on exactly what the coordinate is.

## Validation summary (`node tests/validate.js`) - **PASS**

| Part | Result |
|---|---|
| 52 angle comparisons vs JPL Horizons. 6 sites: near pole −89.5°, Chang'e-7/Shackleton ridge, Apollo 11, Apollo 15, Chang'e-4 far side, east-limb point. Dates 2026-2028, Sun up to 89° elevation | Elevation error max **0.0038°** (mean 0.0009°). Azimuth error max **0.055°** (Sun at 89° elevation, near the zenith); all other cases ≤ 0.008° |
| 4 event times (sunset ×3, Earthset ×1) vs Horizons 1-minute tables | max **0.76 min** |
| South pole Sun elevation over a year within ±1.7° | −1.547° … +1.550° ✔ |
| Apollo 11: Earth always up | 100 % ✔ |
| Chang'e-4: Earth never up | 0 % ✔ |
| Equatorial near side: Sun up 45-55 % | 48.6 % ✔ |

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

A published value for Peak near Shackleton is "approximately 80%". It differs from our 49.6% and is discussed honestly in [GAPS_AND_ISSUES.md](GAPS_AND_ISSUES.md).

## Data sources

* NASA/JPL Horizons API - validation reference: https://ssd.jpl.nasa.gov/horizons/
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
tests/ui_check.js     headless browser smoke test (Playwright)
tools/terrain.py      DEM reading, horizon masks, hillshade
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
npx playwright install chromium; node tests/ui_check.js
```

## Credits

Astronomy Engine by Don Cross (MIT). LOLA data: NASA LRO / LOLA team via the PDS Geosciences Node. JPL Horizons: NASA/JPL Solar System Dynamics Group. LROC: NASA/GSFC/Arizona State University.
