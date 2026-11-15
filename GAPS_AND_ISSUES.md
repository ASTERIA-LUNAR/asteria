Status as of 2026-11-15 (round 6 on branch `round6`, not merged: finer real terrain detail, normal maps, near-camera shadows, earthshine, VIPER-proportioned rover, inspection tools, Getting started actions, 2D scale bar, Design decisions - section 11; round 5: independent instant-status and 3D accuracy checks, ground detail, jump buttons, UI polish, proof for judges, tag v1-stable - section 10; round 4: faster, clearer and more realistic 3D view, beginner Sky view - section 9; round 3: 3D terrain view "Deploy", rover, AI disclosure and branding check, submission links, first-visit intro; builds on rounds 2B and 2C). This file lists what is missing, what is approximate, and what could not be sourced. Everything listed here is also labelled in the app where it applies.

## 1. Sites and coordinates

* **19 sites** in total:
  * **8 south-pole sites** with LOLA terrain horizons.
  * **11 reference sites** outside the south pole (Apollo 11-17 and robotic landers), shown as "Reference sites (outside the south pole)" with a smooth horizon (terrain not included).
* **NASA Artemis III regions** (28 Oct 2024 list of nine; names confirmed from the NASA release). Since February 2026 the first Artemis landing is planned as Artemis IV, targeted for 2028 (Artemis III, 2027, is a crewed test flight in low Earth orbit; NASA release of 27 Feb 2026); NASA's Artemis IV mission page shows the same nine regions. Site labels keep "Artemis III candidate region", the name under which NASA announced them.
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
  * Beyond the selected window, the next event is searched for up to 400 days with 60-minute steps. If none is found, the tiles say "Not within the next N days (search limit)" (N = rest of the window + 400) instead of "> N days", and Explain mode explains the limit. Compare and Launch slip search only inside their own window and say so ("Whole N-day window (no sunset within it)", "No sunset within the N-day mission").
* **Sunrise/sunset and Earthrise/Earthset** use the centre of the body. "Average illumination" averages the visible fraction of the solar disk, treating the horizon as a straight line across the disk (its diameter is computed at each step from the Sun distance and shown in Expert view).
* **Earth link**: Earth's centre is above the terrain horizon plus the user's minimum elevation (default 0°). It is a geometric line of sight only; antennas, power, Earth ground-station coverage and relay satellites are not modelled.
* **Moon frame**: the Moon orientation uses the IAU/WGCCRE rotation model; Horizons uses the DE-based Mean-Earth frame. The difference is well under 0.01° in the validation tables.
* **Moon shape**: the Moon is a 1737.4 km sphere for the Sun and Earth directions. Site height changes them by less than 0.001°.
* **Animation**: the Sky view and the timeline cursor step through computed samples (every 10 or 60 min). Nothing is interpolated between samples.
* **Map**:
  * The hillshade uses synthetic lighting (from the upper left at 25° altitude). It is not real illumination at any date.
  * Slope is computed by central differences on a 37 m sample grid and shown as 74 m pixels (coarser zooms are averages). Real slopes over a few metres can be steeper.
  * The published-illumination layer is classed into 10 bins. NASA's 60 m map (AVGVISIB_85S_060M_201608) covers only about 85°S-90°S; its coverage is drawn as a dashed yellow square and the legend says so. **PGDA product 69 does provide an average-illumination map that covers 80-85°S**: AVGVISIB_75S_120M_201608 (120 m/px, 75°S-90°S, same two definitions in its label). It is shown as an outer layer under the 60 m map, with its own source and resolution label, on 148 m pixels (zoom 4). It is coarser, so it can differ from the 60 m map (for example 43% vs 39% at the Mons Malapert landform centre). The cross-check now also compares every site with it, including IM-1 and Nobile Rim 2 (DM2), which the 60 m map does not reach.
  * First load and **Whole pole** zoom the map so the data square covers the whole map panel (fractional zoom; the same value is the minimum zoom). On a non-square panel a strip of the square along the longer side is off-screen (reachable by panning); at that zoom no area outside the data is visible, so the outside-click message mainly matters while panning near the edge.
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

* **Custom point, one-year check** (round 2C, `tests/one_year_check.js`, section E of VALIDATION_REPORT.md): at (-70.9457, 67.9235 E), smooth horizon, hourly Horizons rows for a year agree with the engine to 0.0028° in elevation and 0.0039° in azimuth. Horizons' lowest Earth elevation there is 1.634° (2026-12-08 05:31 UTC): Earth never sets in that year, and the app correctly shows "Not within the next 430 days (search limit)" for the next Earthset. All 24 sunrises/sunsets agree within 1.42 min (limit 2 min). At this latitude the Sun crosses the horizon at only about 0.003° per minute, so these event times are more sensitive to tiny elevation differences than at lower latitudes. No engine change was needed.
* **Sun-elevation rule** (round 2C, `tests/validate.js` test 5): at 20 seeded random latitudes between -60° and -90°, the 2027 maximum Sun elevation is 1.504°-1.550° above 90 - |lat| (rule: within 0.2° of +1.54°, never above +1.6°). The 1.54° comes from the test specification; the Validation page also shows the tilt computed from the engine's IAU/WGCCRE model (1.52°-1.57° to the J2000 ecliptic over 2027).

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

## 7. Round 3: 3D terrain view ("Deploy")

*Round 4 changed the 3D view (extended terrain and its shadows, quality levels, real stars, Blue Marble Earth, regolith shading). Where this section and section 9 differ, section 9 is current.*

**Sites with 3D**: all 8 curated south-pole sites with terrain horizons. 6 tiles use LDEM_85S_20M (20 m grid: both Peak near Shackleton points, Shackleton crater centre, Mons Malapert, Mons Mouton, IM-2); IM-1 and Nobile Rim 2 (DM2) lie outside the 20 m DEM and use LDEM_80S_80M (80 m grid, 6.08 km tile). Each tile uses one DEM product only (no seams). Reference sites outside the pole and clicked or typed custom points have no 3D view (no Deploy button).

**Isolation from the existing app**: index.html loads only the 8-entry list `data/terrain3d/index.js`. Three.js, `js/view3d.js`, `js/view3d_math.js` and the tile are injected only when Deploy is clicked (the UI test checks that `THREE` is undefined before). The only changes to `js/app.js` are the Deploy button, the lazy loader and a listener hook at the end of `renderInstant()`. All earlier tests pass unchanged.

| 3D view | Classification | Accurate (tested) | Approximate / not modelled |
|---|---|---|---|
| Terrain heights | Measured | Bilinear LOLA samples; within 0.05 m of direct DEM samples at the centre and 3 random nodes per site (`tools/terrain3d.py check`, limit 1 m) | 20 m or 80 m grid; boulders, sub-grid relief and the lander are not represented; 0.1 m storage step |
| Geometry | Calculated | Site-centred ENU with exact lunar curvature (corner drop 5.2 m on 20 m tiles); nodes placed by true ground distance, so the polar-stereographic scale factor (1.0000-1.0075 at these sites) is handled | Spherical Moon (1737.4 km), as everywhere in the app |
| Sun | Calculated | Light direction = engine az/el (worst 1.7e-6° in `tests/view3d_test.js` against the engine's raw apparent vector; < 0.01° in the browser); disk angular size from the engine | - |
| Earth | Calculated (position, phase, orientation); Measured (Blue Marble imagery) | Engine az/el (< 0.01°) and angular size; phase from the engine's Sun and Earth vectors (the lighting direction is the Sun direction from the site, which differs from the direction at Earth by at most about 0.15°) | Plain blue sphere, no surface features; unlit side faintly visible so it can be found |
| Status at the site marker | Calculated | Sunlight / Earth link from the validated horizon model (same series as the main view) | - |
| Shadows | Approximate | Shadow mapping of the tile's own terrain | Visual approximation (2048 px shadow map on laptops, 1024 on phones); **shadows from terrain outside the tile are not rendered**. A banner appears when the validated model says the Sun is behind terrain at the site |
| Distant skyline | Calculated | Exact horizon mask from the site marker (`data/horizons`, rays to 300 km) | Ring 60 km away: exact only from the site marker; the ground between the tile edge and the ring is not drawn (dark wall) |
| Lighting | Illustrative (fill light) | - | Faint uniform fill light (not physical); no reflected light from terrain, no Earthshine |
| Vertical exaggeration | Illustrative | Default 1× (true scale), shown in a badge | At 2-5× heights, shadows and the look of slopes are stretched (the badge says so); the skyline ring is never exaggerated |
| Rover | Calculated (elevation, slope, tilt) / Illustrative (model, driving) | Position, DEM elevation, slope over one DEM cell (20 or 80 m) | "Sun over the tile terrain" is a near-field estimate (tile only, Sun centre, 2 m eye height); the rover model, its tilt and speed are illustrative; no rover-scale slopes (< 20 m) |
| Stars | Measured (catalogue) / Calculated (directions) | - | Off by default; decorative random points, not a catalogue |

**Performance (Part D)**: the view renders only when something changes (camera movement, keys held, time change), not every frame. Phones (coarse pointer or < 700 px wide) draw every second node (22,801 instead of 90,601 vertices), use a 1024 px shadow map, no antialiasing and a pixel ratio of at most 1.5. Closing the view disposes every geometry, material, texture and the shadow map, the render lists and the WebGL context (`renderer.info.memory` reports 0 geometries and 0 textures after disposal in the UI test) and removes the DOM. Measured in headless Chromium on the development laptop (GPU via ANGLE/D3D11): opening takes 0.2-0.4 s including loading Three.js (0.6 MB) and the tile (0.24 MB); orbiting renders at 60 frames/s at laptop and phone sizes. **Not measured on a real phone**: the phone test emulates the screen size and touch but runs on the laptop GPU.

**Known limitations of the 3D view**
* Needs WebGL. Without it, Deploy shows "The 3D view could not be opened (...)" under the button and the rest of the app keeps working.
* Two-finger pinch/pan and touch drag-to-look are implemented (pointer events) but are not exercised by the automated test (Playwright has no multi-touch); the on-screen arrow buttons and taps are tested.
* Headless Chromium with software WebGL (SwiftShader) prints "GPU stall due to ReadPixels" driver notices as console warnings. They come from the GL driver, not from page code; the UI test therefore runs WebGL on the GPU (ANGLE/D3D11) on Windows, where none appear.
* Tested in Chromium only (as the rest of the app).
* The 3D time slider steps through the same computed samples as the main view (every 10 or 60 minutes); nothing is interpolated.
* The near field is drawn lit even when the site itself is in the shadow of distant terrain (see the banner and the shadow label); the validated model, not the picture, decides "Sun up".

## 8. Round 3: AI disclosure, branding, submission links, intro

* **AI disclosure** (NASA Space Apps rules): About page credit line (since round 4B; earlier a "How this was made" section) and README "How this was made"; AI_DISCLOSURE.md; `<meta name="generator">` and `<meta name="ai-disclosure">` in index.html; every AI-written source file (29 files, checked by `tests/features_test.js`) starts with "Generated with Claude Code (Anthropic) under human direction". Generated data files name their generator script instead.
* **Graphics**: no image- or audio-generation model was used. Code-drawn graphics written by Claude Code (pixel-art rocket, Earth and Moon in the loader and the intro; the 3D rover) were labelled "AI-generated" where shown in round 3; in round 4B these labels were removed at the owner's request and the graphics are disclosed as code instead (About credit line, the 3D "Graphics:" line, README, AI_DISCLOSURE.md, metadata). The small SVG mark in the page header (also drawn by Claude Code) was **removed**, because it was too small to carry a visible watermark. Map tiles and the 3D terrain are renderings of NASA data, not generated imagery.
* **Branding check**: no NASA or NASA Space Apps logos, "meatball" or "worm" insignia, agency flags or mission patches are in the project (it contains no logo image files at all). Text references to NASA data and missions remain, as do "Not endorsed by NASA" and "Not affiliated with NASA's ASTERIA CubeSat mission".
* **SUBMISSION_LINKS.md**: 16 NASA links and 16 other links, each a full https URL that the project cites elsewhere (tested). The PGDA file server is now cited over https. On 2026-11-14 every URL answered HTTP 200 to a plain HTTP client except the NASA NTRS page (no answer within 60 s); NTRS's public API returned the same record. NASA Moon Trek and LROC Quickmap are mentioned in the app only as places to check results, so they are not listed as used.
* **First-visit intro**: an honest title card (no loading claim), `INTRO_MS = 3000` at the top of `js/intro.js`. Remembered in localStorage (in try/catch: with storage blocked it can show again on the next visit). Skipped automatically with reduced motion, a share link, and in automated browsers unless a test sets `window.ASTERIA_INTRO_TEST`. It never delays computation: in the UI test the first results were ready about 0.5 s after load while the intro was still showing.

## 9. Round 4: faster, clearer, more realistic 3D view; clearer Sky view

Validated values are unchanged: `js/engine.js` was not modified, and every earlier test still passes. Everything new in the 3D view is either real data (LOLA, the Bright Star Catalogue, NASA Blue Marble, the IAU Gazetteer) or a display setting labelled as such.

**Parts done**: 0 speed, 1 quality levels, 2 brightness, 3 extended terrain with shadows, 4 5 m patches, 5 regolith shading and DEM overlays (uniform albedo), 6 real stars, 7 Earth and Sun, 8 orientation aids, 9 beginner Sky view, 10 tests and documents. **Skipped**: none. **Not found**: a LOLA albedo map at ≤ 250 m/pixel (see below).

### Speed (Part 0)
* **Cause of the slow sites**: Deploy waited for the whole main-app computation, including the search for the first event after the window (up to 400 days in 60-minute steps). At the Shackleton crater floor (no sunrise, no Earthrise) and where Earth never sets (IM-1, Mons Malapert) that search takes most of a second, and longer on slower computers. The 3D rendering itself was never the bottleneck.
* **Fix**: the window's series and the search beyond it are now two worker jobs. Deploy waits only for the first, and Three.js and the tile load in parallel. Until the search returns (about 0.2-0.8 s), countdowns beyond the window read "Searching…". Also: progressive mesh (coarse first frame), decoded-tile cache, extended terrain loaded after the first frame.
* Shackleton crater centre: 1,088 ms → 313 ms to the first frame (laptop). Full before/after tables per site and quality: PERFORMANCE.md.

### What is accurate and what is approximate (3D view)
The full table is in README.md ("3D terrain view"). Summary of the limits:
* **Terrain resolution**: 5 m (High, within 1 km of three sites), 20 m or 80 m (6 km tile), 100 m (to 16 km; 200 m at Low), 200 m (16-40 km, High). The 5 m product's label says it is made from preliminary LOLA data. Where the grid changes, the amount of detail changes visibly.
* **Shadows**: shadow mapping (visual approximation, texel 7-22 m). Terrain beyond 3 km (Low: tile only), 16 km (Medium) or 40 km (High) casts no shadows; the 16-40 km ring receives none. Shading consistency at the site marker (8 sites × 50 times in the next year): Low 97.8 %, Medium 99.0 %, High 99.8 %; every disagreement is the Sun blocked by terrain beyond the shadow-casting range (`tests/shading_consistency.js`, `data/shading_consistency.js`). The status tiles always use the validated horizon model.
* **Surface**: Lommel-Seeliger law with a **uniform albedo**. No public LOLA 1064 nm normal-albedo map of the south pole at ≤ 250 m/pixel was found: the Lucey et al. (2014) polar maps are about 2 km/pixel; the PDS LOLA polar folder has elevation (LDEM/LDEC), slope (LDSM), roughness (LDRM) and count products only; the PGDA product pages 68/90 list DEM, roughness, slope and PSR products. Brightness differences therefore come from the terrain's shape only.
* **Fill light and brightness**: the faint fill light is not physical (no light reflected from terrain, no Earthshine); the Brightness slider changes only the display exposure and the fill light (tested: light direction, Sun intensity and status tiles unchanged).
* **Earth**: Blue Marble July 2004 composite (clouds not shown; snow and vegetation of that month). Polar motion is ignored (< 0.0001°). Orientation agrees with JPL Horizons within 0.155°; the geodetic vs geocentric latitude difference explains most of it.
* **Stars**: positions to about 0.002° (proper motion applied; annual aberration, < 0.006°, not applied). The view shows stars on request even when a real camera could not (stated on screen).
* **Sun glare**: display effect (optional, labelled); hidden when the validated model says the Sun is hidden.
* **Feature labels**: Gazetteer centre points; a crater name sits on its floor. Features beyond the drawn terrain are labelled on the skyline in their direction, with their distance (direction only).
* **Fixed in this round**: Earth was drawn unlit whenever the Sun was below the site's horizon (the scene's sunlight is switched off then). Earth now has its own lighting from the computed Sun direction.

### Performance and devices
* Measured in headless Chromium on the development laptop. Its automatic choice saw Intel integrated graphics in most runs and the laptop's NVIDIA GPU in others (the browser chose the adapter). At every quality level: first frame and full terrain within 1 s, 53-60 frames/s while orbiting (the browser caps at 60). **Phones were emulated** (screen size and touch only, same laptop GPU), so the numbers say nothing about a real phone's GPU. Not tested on a real phone, in Firefox or in Safari.
* Automatic quality: phones (touch or narrow window) start at Low, recognisable dedicated GPUs on large screens at High, everything else at Medium; a frame-rate probe steps down one level below 30 frames/s. The probe is skipped when the user has chosen a level (remembered in localStorage, inside try/catch).
* Data sizes: extended rings 6.2 MB (16 files), 5 m patches 1.3 MB, Earth textures 0.8 MB, stars 0.1 MB. Repository (tracked files) 85.3 MB in total; largest file data/dem_coarse.js, 8.4 MB (limits: 300 MB total, 50 MB per file). The downloaded inputs (5 m DEM windows, catalogue, Blue Marble original, Gazetteer) stay in the git-ignored dem/ folder. Each is loaded only when the 3D view needs it (ring B, the 5 m patch and the 2048 px Earth only at High).

### Known limitations
* The scale bar is exact only at the stated distance (perspective). Mini-map distances are horizontal ground distances in the site frame.
* Walk and Rover stay on the 6 km tile (the extended terrain is for viewing).
* Two-finger gestures are implemented but not covered by the automated test (no multi-touch in Playwright), as before.
* The CDS file server for the star catalogue did not answer; the identical file was taken from the Harvard-Smithsonian CfA mirror (http only). The Lucey et al. DOI blocks scripted link checks (HTTP 403) but resolves in a browser.
* Working copies on this computer use CRLF line endings (git `core.autocrlf`); the repository stores LF. `tests/features_test.js` now reads SUBMISSION_LINKS.md with either.

## 10. Round 5: independent checks, ground detail, jump buttons, polish, proof

`js/engine.js` was not changed (no check revealed an engine bug). One real disagreement was found and fixed (the rover's slope readout, below). Tag `v1-stable` marks the final commit of this round (local only; see README "Stable snapshot").

### Instant status check (Part 1)
* `tests/instant_status_check.js`: for the 8 curated south-pole sites, at the time the cases were chosen (2026-11-14 19:11 UTC) and at 20 random whole-minute times per site in 2026-2028 (seeded), Sun and Earth apparent azimuth/elevation were taken directly from the JPL Horizons API (one TLIST query per site and body, cached), and the terrain horizon at exactly those azimuths was computed by `tools/terrain.py horizon_at` from the LOLA DEMs (not from the app's JavaScript or the stored masks).
* **336 of 336** Sun-up / Earth-visible decisions agree with the app. **On the edge** (body within 0.05° of the horizon): 3 cases (IM-2 Sun, Peak near Shackleton derived point Earth, Mons Mouton Earth), all agree. Disagreements outside the edge: 0, so no bug was found. App vs Horizons: elevation within 0.0028°; the app's 1° mask vs the exact-azimuth Python horizon: within 0.050° (mean 0.005°).
* **Sunlit at 2026-11-14 19:11 UTC: 3 of 8 sites** (both Peak near Shackleton points and Nobile Rim 2 / DM2). The Sun stood between −2.7° and +4.8° above the flat horizon at the sites; at the two Peak near Shackleton points the terrain in the Sun's direction is below the flat horizon (−2.7°), so the Sun at +2.8° is clear; at DM2 the Sun (+4.8°) clears a +1.1° horizon. IM-2 (+1.8° vs +2.9°), Mons Mouton (+1.9° vs +8.3°) and the Shackleton floor (+1.9° vs +20.1°) are shadowed by terrain; at IM-1 and Mons Malapert the Sun is below the flat horizon as well. The paragraph and table are rebuilt from `data/instant_status.js` (VALIDATION_REPORT.md section F, Validation page).
* "Now" is fixed at the moment the cases were chosen; `--new` chooses new cases and fetches them.

### 3D terrain accuracy (Part 2)
* Heights: all 3,444,523 grid points of the 8 tiles, 16 rings and 3 five-metre patches vs direct bilinear samples of the named LOLA DEM (Python, independent node positions): max 0.10 m (ring B, 0.2 m storage step), mean 0.03 m.
* **Bug fixed - rover slope**: the readout used the gradient of the bilinear surface inside one cell (one-sided differences), while the 3D slope shading used central differences. Against a Python central-difference slope from the DEM at the same spacing it differed by up to 15.9° (mean 1.1°) on the tiles and 7.8° on the 5 m patches. `js/view3d_math.js` slopeAt now uses central differences over one grid spacing: max 0.17° (20/80 m) and 0.53° (5 m), within the bound the 0.1 m height storage step allows (0.20° at 20 m, 0.81° at 5 m); slope shading and readout are now identical.
* The 2D map's slope layer is correct for its own pixels (200/200 classes reproduced in Python: 37 m central differences averaged to 74 m). It differs from the 20 m 3D readout by 1.0° on average (up to 8°) because of the pixel size; 155 of 200 readouts fall in the map pixel's class. The map legend states its pixel size.
* Positions: 20 random rover positions (6 inside 5 m patches): the displayed latitude/longitude (4 decimals) projected with the 2D map's projection lands within 1.4 m of the true position (limit one DEM cell, 5-80 m); the displayed elevation is within 0.43 m of LOLA there (limit 1 m).

### Ground detail in Walk and Rover (Part 3)
Measured with `tests/ground_detail.js` (same site, time and camera; the round-3 build, the build before the fix, and after; `docs/ground_detail/`):
* Geometry and normals did **not** lose detail since round 3: switching the current build to plain Lambert shading reproduces the round-3 picture numerically. Fitting the shadow camera to the 6 km tile only (round-3 texel size) changed nothing measurable.
* Causes of the flatter look: (1) **"Light up" (3×) was remembered** across visits and sites; at sunlit sites it clips the ground to pure white (foreground 255/255, no contrast). (2) **Lommel-Seeliger** shading (round 4) at the grazing views of Walk/Rover gives slopes facing toward and away from the low Sun nearly the same bright tone. (3) At **Low** quality the tile was drawn every second node (40 m) and the **5 m patch** was used only at High (a small effect in the measured views).
* Fix: "Relief shading" display option (default on in Walk and Rover, toggle in the panel, labelled "Relief shading: display contrast only; heights and slopes are the LOLA data."): 70 % Lommel-Seeliger plus the sunlight difference between the DEM normal and a smoothed DEM normal (±4 cells). Walk/Rover on laptops use the full tile and the 5 m patch at every quality (phones unchanged for speed). Light up is session-only and switches itself off when the validated status says the Sun is up. Walk detail (mean neighbouring-pixel difference): Peak near Shackleton 0.87 → 2.94, Mons Mouton 4.11 → 6.94; Rover at Peak near Shackleton 0.06 → 0.27. Where the 20 m DEM is itself smooth (the Mons Mouton rover view) the picture stays smooth: nothing is invented.
* Unchanged and tested: heights, slopes, rover readouts, light direction, status tiles, shadows (`tests/shading_consistency.js`: Low 97.8 %, Medium 99.0 %, High 99.8 %, as before).
* Limitation: relief shading is a display aid, not photometry; in shadow only the uniform fill light reaches the ground, so shadowed ground stays flat.

### Jump buttons (Part 4)
* Inside the selected window the jump lands on the first computed sample where the status turns true (up to one sampling step after the actual start). Beyond the window, the 60-minute search (the same as the countdowns) can miss windows shorter than one hour.
* "Both": the start is the later of the Sun and Earth rises in that 60-minute step, each refined to 1 minute.
* Not found within the search limit (rest of the window + 400 days): "Not within the next N days (search limit)", e.g. sunlight on the Shackleton crater floor.

### UI polish (Part 5)
* Tour spotlight after a completed Getting started (once; not in automated browsers unless opted in; no pulse with reduced motion; not after an early skip).
* Deploy icon "»"; the only remaining ▲ is the "forward" key of the 3D arrow pad (next to three other arrows; aria-labelled).
* 3D labels are kept inside the picture and off panels and each other; on small screens some feature names are hidden for that frame instead of overlapping (they remain listed in the notes). The mini-map caption is hidden in windows under 620 px high (its content is in the notes).

### Proof for judges (Part 6)
* "Verify with NASA" opens the Horizons API's text output (a technical table, not a web page). The URL is the one the validation tests use; it needs an internet connection, the rest of the app does not.
* The Verified card and "How we know the numbers are right" read their numbers from `data/validation.js`, `data/instant_status.js`, `data/illum_crosscheck.js` and `data/accuracy3d.js`. The illumination line averages the 5 sites inside NASA's 60 m map, excluding the derived point (chosen using that map), as in the report.
* "Download VALIDATION_REPORT.md": under file:// some browsers open the file instead of downloading it.

### Testing
* All Node suites, the Python DEM checks, `tests/ui_check.js` and `tests/ui_round5.js` (laptop + phone, no console errors) pass. As before, phones are emulated (screen size and touch on the laptop GPU); Chromium only.

## 11. Round 6: simulation fidelity, rover, usability (branch `round6`, not merged)

`js/engine.js`, the horizon masks, status, countdowns, power and all validated values are unchanged. Every new feature is classified (Measured / Calculated / Approximate / Illustrative) in the 3D notes and in ROUND6_REPORT.md, which also has the before/after performance table and the owner's manual checklist.

| Feature | Classification | Basis / test | Limits |
|---|---|---|---|
| Ring A 25 m (4 sites) and ring B 100 m (7 sites) grids | Measured | LOLA LDEM_85S_20M / LDEM_80S_80M; every grid point within 0.10 m (tests/accuracy3d.js) | IM-2, Mons Mouton, Nobile Rim 2 and IM-1 have no full 20 m coverage of ring A (one DEM per grid) |
| Normal maps, edge fade | Calculated | = DEM normals at the nodes (tests/view3d_test.js) | never finer than the grid; the tile's outer 500 m loses some 20 m detail where ring A is coarse (fade) |
| Near-camera shadow map | Approximate | min(full, near): shading consistency unchanged, never lights more | edges of shadows from distant ridges keep the coarse map's resolution |
| Earthshine | Approximate | albedo 0.434 (NASA Earth Fact Sheet), engine geometry, Lambert phase law | about a factor of 2; point source; no light from sunlit terrain; raised exposure stated on screen |
| VIPER-proportioned rover | Illustrative (model) / Calculated (wheel contact, tilt) | NASA published size; wheels on the LOLA surface (tests/ui_round6.js) | other proportions approximate; tilt at DEM resolution; no mobility physics; no traversability prediction |
| Presets, inspection, hazard view | Calculated | engine directions (0.05°); LOLA heights/slopes | real slopes over a few metres can be steeper |
| Show on 2D map, camera wedge | Illustrative (navigation aids) | position from the 3D view (tests/ui_round6.js) | the 2D marker stays until the next use |
| 2D scale bar | Calculated | polar stereographic k = 2/(1+sin|lat|); great-circle check within 0.5 % | exact at the map centre only (labelled) |
| Getting started actions, Design decisions | presentation | tests/ui_round6.js; DESIGN_DECISIONS.md | - |

### Round 6B (same branch): usability fixes, rover model, planning additions
| Feature | Classification | Basis / test | Limits |
|---|---|---|---|
| Click/tap inspection (pinned, Esc clears), "Inspect on hover" (off by default) | Calculated (values unchanged) | 81/81 readouts identical to before (tests/inspect_perf.js); median 0.70 -> 0.10 ms per update on High | hover needs a mouse |
| Shadows off by default ("Shadows (approximate)") | Approximate (when on) | status, positions and readouts identical on/off; shading consistency with shadows on 97.8 / 99.0 / 99.8 % (unchanged) | with shadows off, ground in shadow is drawn lit (stated on the picture and in the banner) |
| Relief shading defaults (Orbit off, Walk/Rover on) and contrast normalised by grid spacing and pixel footprint | Illustrative (display) | tile edge at 60 km, High: luminance +49.4 % -> +1.0 %, detail +94.2 % -> +13.5 % (tests/tile_edge.js) | the data difference between the 20 m tile and 25-100 m rings remains |
| Detailed VIPER-like rover model | Illustrative | published envelope 2.5 x 1.5 x 1.5 m and wheel contact unchanged (tests/ui_round6.js, tests/ui_round6b.js); 4,996 / 2,644 triangles | panel layout, mast, lights, wheel size and tread, instrument positions approximate (NASA pages do not describe them) |
| Stars on by default | Calculated (directions), background only | inspection, status, Sun/Earth directions, rover readout and rendered shadow identical with stars on/off | cameras usually cannot see stars in daylight (note) |
| CSV export (windows + time series) | export of Calculated values | equals the app's windows and series exactly (tests/ui_round6b.js) | series at the sampling step; app version = commit stamped by tools/stamp_version.js |
| Compare: energy, battery, DEM slope | Approximate (power: first-order, example values) / Calculated (slope) | equal to the Power page and to the 3D rover readout for the same inputs (tests/ui_round6b.js) | slope "-" without a 3D tile; slope over 5-80 m grids, real slopes over a few metres can be steeper; not ranked |
| Larger 5 m patch (4 km) | not attempted | needs new LDEM_875S_5M rows beyond the stored windows (ROUND6_REPORT.md, Part 4) | - |

### Known limitations and open items (round 6)
* Geometry is not morphed between levels of detail (it would move vertices off their DEM heights); a slight change of geometric detail can still be seen at ring edges.
* Medium keeps the round-4 ring A geometry because a 100 m sampling of the 20 m product changed 2 of 50 shading verdicts at Mons Malapert; only its lighting comes from the 25 m grid (trade-off recorded in ROUND6_REPORT.md for the owner).
* Faint straight streaks near Peak near Shackleton are LOLA ground-track artefacts in LDEM_85S_20M (also in an independent hillshade) and are not removed.
* Walk/Rover in sunlight look the same as before where the DEM itself is smooth: nothing below the grid resolution is shown or invented.
* Performance numbers are from headless Chromium on the development laptop; phones were emulated (screen size and touch on the laptop GPU). Not measured on a real phone, in Firefox or in Safari. Exact GPU memory in bytes is not available in browsers.
* The science.nasa.gov VIPER page (21 Sep 2026) and NASA's 20 Oct 2026 update differ on VIPER's status; the app quotes the newer page with its date.

## 12. Round 6E: data checks (branch `round6`, not merged)

### Isolated spike in the 5 m patch near Peak near Shackleton (probably a DEM artifact; terrain not edited)

* **What is seen**: in Walk/Rover at "Peak near Shackleton - best-lit point" a sharp cone stands about 890 m from the site (inspection near -88.7618, 125.1504 E: height 1486.6 m, slope 44.4° on the 5 m patch).
* **Evidence** (`tools/spike_check_6e.py`, read-only; numbers in `tests/spikes_6e.json`):
  * The highest 5 m node (LDEM_875S_5M) is at -88.76152, 125.1511 E: **1498.5 m**, i.e. **7.0 m above the highest of its 8 neighbours**, about 24 m above the ground 20-60 m around it (ring means 1474.9 / 1474.3 m).
  * At the same place **LDEM_85S_20M gives 1474.2 m** (the 3 × 3 surrounding 20 m nodes reach at most 1477.5 m) and **LDEM_80S_80M gives 1475.0 m**: neither shows any hill. The 5 m and 20 m profiles agree within about 1-2 m everywhere beyond 15 m from the node (east-west and north-south, ±60 m).
  * Shape: one node with straight sides falling over 2-3 nodes (10-15 m) to the surrounding level - a 35 m wide, 24 m high cone, the typical result of gridding one outlier height measurement. No published LOLA-derived product used here shows a landform there.
  * The LDEM_875S_5M label describes its heights as generated from preliminary LOLA data.
* **Verdict**: probably a data artifact of the preliminary 5 m product, not a real landform. Heights are shown as published (not edited or filtered); the 3D note on the 5 m patch says so. The owner decides later about any visual flag.
* **Scan of all 5 m patches** (2 km × 2 km, 163,216 nodes each; criterion: a node ≥ 2 m above all 8 neighbours AND ≥ 10 m above LDEM_85S_20M at the same point): Peak near Shackleton (illuminated area) 1 spike, Peak near Shackleton - best-lit point 1 spike (the same node, both patches contain it), Shackleton crater centre 0. Nodes ≥ 2 m above all 8 neighbours but consistent with the 20 m grid: 4, 6 and 0 respectively (small real knolls or noise, not listed as spikes).

| Location (node) | 5 m height | Above 8 neighbours | Above LDEM_85S_20M | Distance from site |
|---|---|---|---|---|
| -88.76152, 125.1511 E | 1498.5 m | 7.0 m | 24.3 m | 887 m (best-lit point), 961 m (illuminated area) |

### Artemis III / Artemis IV wording

* NASA (release of 27 Feb 2026, https://www.nasa.gov/news-release/nasa-adds-mission-to-artemis-lunar-program-updates-architecture/): Artemis III (2027) tests systems in low Earth orbit; the first Artemis landing is Artemis IV, targeted for 2028 (Artemis IV page: "Early 2028"). The app and documents now say the regions were announced for Artemis III and that the first landing is now planned as Artemis IV. NASA's Artemis IV mission page shows the same nine regions under "Lunar Site Selection"; no NASA text read says more than that, so ASTERIA claims nothing further.
