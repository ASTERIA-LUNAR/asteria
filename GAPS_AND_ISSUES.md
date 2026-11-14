Status as of 2026-11-14 (round 2B: accuracy audit and map fixes). This file lists what is missing, what is approximate, and what could not be sourced. Everything listed here is also labelled in the app where it applies.

## 1. Sites and coordinates

* **19 sites** in total:
  * **8 south-pole sites** with LOLA terrain horizons.
  * **11 reference sites** outside the south pole (Apollo 11-17 and robotic landers), shown as "Reference sites (outside the south pole)" with a smooth horizon (terrain not included).
* **NASA Artemis III regions** (28 Oct 2024 list of nine; names confirmed from the NASA release).
  * NASA publishes the region boundaries **only as images**, with no numeric coordinates.
  * Plotted (with terrain horizon and computed values) only where a point is genuinely inside the region:
    * **Malapert Massif**: centre of the named landform Mons Malapert (IAU 16338). "Malapert Massif" is not an IAU name.
    * **Mons Mouton**: centre of the named landform (IAU 16070).
    * **Nobile Rim 2**: published point DM2 (Peña-Asensio et al., arXiv 2406.19863; an independent study, not a NASA selection).
    * The two landform centres were checked to lie inside the IAU Gazetteer outline (WKT polygon) of the landform. They are single points on 67-130 km mountains, so other parts of the region can differ a lot. Region boundaries are not plotted.
  * **Not plotted, no values computed** (listed by name with a link to the NASA announcement): Peak near Cabeus B, Haworth, Mons Mouton Plateau, Nobile Rim 1, de Gerlache Rim 2, Slater Plain. Earlier rounds showed crater centres for these (Cabeus B, Haworth, Nobile, de Gerlache, Slater); those points were outside the rim/peak/plain regions and were removed, with their horizons and metrics.
* **Peak near Shackleton**: two entries.
  * The published coordinate (Mahanti et al. 2024).
  * A clearly labelled **derived** "best-supported point": the 50 m grid point within 500 m where our model and the published map agree it is best lit. This point is the app's default view. It is an illustration, not a landing recommendation.
* **Chang'e-7 target: removed.** Its only source was a Wikipedia infobox citing a social-media post (no primary source found). It is no longer a site and is not used in any calculation. The validation still uses the geometry (-88.8, 123.4) as a plain test coordinate for the JPL Horizons comparison; it is labelled "test geometry only".
* **Source quality** (`sourceType` in `data/sites.js`, shown in Expert view): every remaining site has a **primary** coordinate source (NSSDC, LROC/ASU, IAU/USGS Gazetteer, or the authors' own peer-reviewed paper), each re-fetched and checked on 2026-11-14. **Secondary sources remaining: none.** Wikipedia links were removed, together with note text that only Wikipedia supported.
* **Blue Ghost Mission 1**: now the LROC post-landing lander position (18.5623°N, 61.8103°E, LROC image page 1407). Earlier versions used the pre-landing region image centre.
* **Not added as sites** (no numeric coordinates in any fetched source):
  * the IM-2 pre-launch target
  * the VIPER target (its destination, Mons Mouton, is noted on that site)
  * Griffin-1
  * Blue Ghost M2

## 2. Terrain illumination cross-check

* **Reference**: NASA's published map AVGVISIB_85S_060M_201608 (PGDA product 69). It is 60 m/px, covers about 85°S-90°S, and averages hourly steps over 18.6 years.
  * Its label describes the value both as "% of timesteps sunlit (by any fraction of the solar disc)" and as "average solar disc visibility". We compute both definitions, plus Sun-centre-up.
* **All 8 south-pole sites** were compared (observer 2 m, 18.6 years, hourly).
  * 6 are inside the 60 m map. Excluding the derived point, which was chosen using that map, our values differ from it by **2.3 points on average and 5.1 points at most** (Mons Malapert landform centre).
  * Against the coarser 120 m map (AVGVISIB_75S_120M_201608, covers all sites incl. IM-1 and DM2): 3.0 points on average, 9.3 at most (Mons Malapert landform centre, where the 120 m map is 4 points brighter than the 60 m map).
  * (Earlier rounds also compared the Chang'e-7 target and five crater-centre points; those were removed in round 2B.)
* **Peak near Shackleton, "approximately 80 %"** (Mahanti et al. 2024, citing Mazarico et al. 2011):
  * At the published coordinate, our model gives 48.1 % and the published map gives 45.4 %. Neither reproduces 80 %.
  * With the observer 10 m above the ground, the best point within 500 m reaches 79.2 % in our model; the map gives 58.1 % there.
  * Possible reasons: different DEM (240 m in 2011), unknown observer height, rounding of the coordinate (±150 m), and strong small-scale variation.
  * **Nothing was tuned.**
* **Not modelled**: remaining differences come from DEM version and resolution (20 m vs 60 m), our 1° azimuth mask, different 18.6-year spans, and the unknown observer height in the published products.
* For speed, one Sun-direction series (computed at the published Peak-near-Shackleton coordinate) is used for every site. The direction error this causes is the solar parallax over the distance between the sites: about 0.0001° or less for every south-pole site (at most about 300 km apart). Each site still uses its own horizon mask and local frame.
* Full tables are in VALIDATION_REPORT.md and on the Validation page.

## 3. Approximations (labelled in the app)

* **Clicked or typed points inside the map** get a terrain horizon from a **downsampled 240 m DEM** (`data/dem_coarse.js`, 8.8 MB, area mean of the three LOLA DEMs), labelled "terrain from coarser 240 m data (less precise than curated sites)". It was shipped only after it passed validation (`node tests/coarse_validation.js`; VALIDATION_REPORT.md and the Validation tab): at the 8 curated south-pole sites the yearly % sunlit differs from the 20 m-based horizons by 2.0 points on average and 6.9 at most (Mons Malapert landform centre, where averaging lowers the summit); at 50 random points in 85-90°S the 18.6-year average illumination differs from NASA's published map by 1.5 points on average (16.0 at most, one point). Features smaller than about 240 m are not represented. Rays stop at the edge of the map data, so near the map edge the horizon in outward directions is incomplete (Expert view shows the shortest ray reach).
* **Smooth-Moon horizon**: typed points outside the map and the reference sites outside the south pole use it (a Moon without mountains), clearly labelled.
* **Terrain masks**:
  * 1° azimuth steps, interpolated linearly.
  * DEM resolution 20 m (within about 85°S), 80 m (to 80°S) and 120 m (beyond); rays out to 300 km.
  * Observer 2 m above the bilinearly interpolated surface.
  * Boulders, the lander itself and sub-pixel relief are not modelled.
* **Events, windows and statistics**:
  * Events are found by a 10-minute scan (60 min for windows over 30 days) and refined to 1 minute. Visibility periods shorter than one step can be missed.
  * Statistics and "max elevation" in the window lists come from the samples, so they are accurate to about one step.
  * Windows cut by the start or end of the period count only their part inside it, and are marked "before"/"after" and "+".
  * Beyond the selected window, the next event is searched for up to 400 days with 60-minute steps.
* **Sunrise/sunset and Earthrise/Earthset** use the centre of the body. "Average illumination" averages the visible fraction of the solar disk, treating the horizon as a straight line across the disk (its diameter is computed at each step from the Sun distance and shown in Expert view).
* **Earth link**: Earth's centre is above the terrain horizon plus the user's minimum elevation (default 0°). It is a geometric line of sight only; antennas, power, Earth ground-station coverage and relay satellites are not modelled.
* **Moon frame**: the Moon orientation uses the IAU/WGCCRE rotation model; Horizons uses the DE-based Mean-Earth frame. The difference is well under 0.01° in the validation tables.
* **Moon shape**: the Moon is a 1737.4 km sphere for the Sun and Earth directions. Site height changes them by less than 0.001°.
* **Animation**: the Sky view and the timeline cursor step through computed samples (every 10 or 60 min). Nothing is interpolated between samples.
* **Map**:
  * The hillshade uses synthetic lighting (from the upper left at 25° altitude). It is not real illumination at any date.
  * Slope is computed by central differences on a 37 m sample grid and shown as 74 m pixels (coarser zooms are averages). Real slopes over a few metres can be steeper.
  * The published-illumination layer is classed into 10 bins. NASA's 60 m map (AVGVISIB_85S_060M_201608) covers only about 85°S-90°S; its coverage is drawn as a dashed yellow square and the legend says so. **PGDA product 69 does provide an average-illumination map that covers 80-85°S**: AVGVISIB_75S_120M_201608 (120 m/px, 75°S-90°S, same two definitions in its label). It is shown as an outer layer under the 60 m map, with its own source and resolution label, on 148 m pixels (zoom 4). It is coarser, so it can differ from the 60 m map (for example 43% vs 39% at the Mons Malapert landform centre). The cross-check now also compares every site with it, including IM-1 and Nobile Rim 2 (DM2), which the 60 m map does not reach.
  * The tile square reaches about 80°S on the axes and about 76°S in the corners. Panning and zooming are limited to it; the area outside is hatched and its edge drawn as a dashed orange line. A click outside it selects nothing and says "No elevation data here - this map covers the lunar south pole (about 80°S to the pole)." 

### Launch-slip heatmap

* One series covers the whole slip range, at the step the timeline uses for the mission length.
  * Each slip is an exact slice of that series, so slip 0 equals the Explore metrics for the same window. This is tested in Node and in the browser, with a minimum elevation applied.
* "Hours until first sunset" has the resolution of one sampling step.
* Slip steps are whole days.
* Colours are normalised per row in metric mode and on a common scale in site mode.

### Power & battery calculator - first-order estimate

* Power = 1361 W/m² × (1 AU/d)² × area × efficiency × cos(incidence) × visible disk fraction.
  * 1361 W/m² is the IAU 2015 Resolution B3 nominal total solar irradiance, read from the resolution text (Prša et al., arXiv 1510.07674, PDF fetched 2026-11-14: "1 S_N = 1361 W m^-2").
* Not modelled:
  * temperature
  * dust
  * degradation
  * wiring and conversion losses
  * light reflected from terrain
  * panel self-shadowing and panel height
  * battery efficiency
* The battery size is load × longest darkness ÷ usable fraction. For a fixed-azimuth panel the longest zero-output period can be longer; the app then shows a note with the battery needed for that period.
* Energy is integrated with the trapezoid rule on the samples.

### Text audit

* All user-facing factual text was audited (TEXT_AUDIT.md). Unsupported numbers and claims were removed or rewritten; numbers are read live from the app's computations or cite a fetched source.
* Not stated in the app for lack of a fetched source: the Moon's axial tilt to the ecliptic (the NASA Moon fact sheet fetched lists only the obliquity to the orbit, 6.68°), a typical lander slope limit, and the VIPER destination.

## 4. Known issues and limitations of the app

* The date picker displays in the browser's locale format (it may show AM/PM), but the value is always interpreted as **UTC**, as labelled.
* **Timings** (headless Chromium on the development laptop):
  * A 365-day window takes about 0.2-0.3 s.
  * The 14-site launch-slip heatmap takes about 5 s.
  * Both run in a background Web Worker, so the page stays responsive. The pixel-rocket loader appears only after 250 ms.
* **Web Worker**:
  * `importScripts()` of local files is blocked under file://. The worker is therefore built from inline source: `js/core.js` contains Astronomy Engine and `js/engine.js` verbatim. It is generated by `tools/build_core.js`, and a unit test fails if it is out of date.
  * If a browser refuses the worker, the same job code runs on the main thread, with brief UI pauses on long windows.
  * Tested in Chromium (Playwright). Not tested in Firefox or Safari in this round.
* **Tour captions** are computed live from the current date and state, so their numbers change from day to day.
  * Some values can legitimately be 0 % (for example, no Earth link in a 2-week window).
  * The tour uses whatever minimum link elevation is set.
* **Copy link** uses the clipboard API. Where the browser blocks it (some file:// contexts), a prompt shows the link to copy by hand.
* **Map tiles**: 63.9 MB in 8,195 files, under the 80 MB target. On disk they take about 77 MB because of file-system block size. Above zoom 7 the map overzooms (it enlarges zoom-7 tiles).

## 5. Verification aids

* VERIFY_YOURSELF.md: step-by-step checks for non-programmers (Horizons URL for a blind-test case and the matching share link, LROC Quickmap, NASA's illumination layer, a raw cached Horizons response).
* LROC Quickmap's controls were described from general knowledge of the site, not re-checked in a browser this round; the guide says to look for the closest-named control if a label differs.

## 6. Process notes

* **Git**: the repository-local identity is "LunaWindow" with a noreply address (kept by request; the global git config is unchanged).
  * The folder name also stays `lunawindow`. Internal identifiers (`LunaEngine`, `LUNA_*` globals, `window.LunaApp`) keep the old name to avoid regressions; `window.AsteriaApp` is an alias.
  * Nothing has been pushed.
* **Privacy**: a personal Windows path found in an early tool was removed from the whole history earlier. No personal names, emails or user paths are in tracked files.
  * The only email-like string is the Astronomy Engine author's MIT copyright line. It is kept as a required licence notice, inside `lib/astronomy.browser.min.js` and its verbatim copy in `js/core.js`.
* **Large inputs not in git**:
  * the LOLA DEMs (`dem/`, about 690 MB)
  * the PGDA illumination maps (`dem/pgda/`)
  * the exported Sun vectors (`dem/work/`)
  * `.venv/`
  * The download URLs are in README.md.
* **Sources**:
  * Gazetteer feature data was read from planetarynames.wr.usgs.gov (search results and feature pages, fetched 2026-11-14).
  * The NASA region list was read from the 28 Oct 2024 release (RELEASE 24-136).
  * The PGDA product page states no licence. It asks users to cite Mazarico et al. (2011), which the About page and README do.
