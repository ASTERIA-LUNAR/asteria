# ASTERIA - Lunar South Pole Landing Site Navigator

Entry for the **NASA Space Apps Challenge 2026** challenge "Lunar Landing Site Navigator".
*Not affiliated with NASA's ASTERIA CubeSat mission. Not endorsed by NASA.*

ASTERIA shows, for sites at the Moon's **south pole** and any date, when the **Sun** is above the local terrain horizon (solar power and heat) and when the **Earth** is above it (direct radio contact). At the pole the Sun skims around the horizon, so a few metres of hill decide between light and darkness. Mission planners, educators and the public can compare sites and dates, follow the light and communication windows, and see what a launch slip does to them.

## How this was made

ASTERIA was directed by a single team member. The code, the data-processing scripts, the documentation and the text in the app were generated with [Claude Code](https://www.anthropic.com/claude-code) (Anthropic), an AI coding assistant, under that person's direction. The calculations were validated against NASA/JPL Horizons and NASA's published PGDA illumination maps (see the validation summary below), and all data sources are cited. No image- or audio-generation model was used, and there is no audio. The code-drawn graphics (the 3D rover and the pixel-art rocket, Earth and Moon in the loader and intro) are drawn by code generated with Claude Code. The terrain, maps, stars and the Earth texture are renderings of NASA and catalogue data and NASA imagery (LOLA and PGDA data, the Yale Bright Star Catalogue, the IAU Gazetteer, NASA Blue Marble Next Generation), not generated images. In the app, AI use is stated in one credit line on the About page and in one "Graphics:" line in the 3D view's "What is accurate, what is approximate" section; there are no AI labels on the graphics themselves. No NASA or NASA Space Apps logos or insignia are used. Details: [AI_DISCLOSURE.md](AI_DISCLOSURE.md). Every AI-written source file starts with "Generated with Claude Code (Anthropic) under human direction", and `index.html` carries `generator` and `ai-disclosure` meta tags.

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
* **Sky view**: a 360° horizon panorama with the terrain skyline and the Sun and Earth at their computed positions. For beginners: "Direction you are facing" (N, NE, E …) and "Height above the flat horizon (degrees)", the brown area named "Mountains and crater walls (LOLA terrain)", larger Sun and Earth tagged "visible" or "hidden" (validated status), the current positions highlighted, and "How to read this: If the Sun or Earth is above the brown shape, it can be seen from the site; below it, it is hidden." Expert view keeps the detailed chart. Play steps through computed samples only; nothing is interpolated.
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
* **Getting started**: a 3-step hint on the first visit. It can be dismissed, and the dismissal is remembered. When it is completed with **Done** (not when skipped), the page is dimmed except the glowing **Tour** button, with "Take the 60-second tour" (**Start tour** / **Not now**); shown once, not in automated browsers unless a test opts in, no pulsing with reduced motion.
* **Jump to next sunlight / Earth view / both** (Site Card and 3D panel): moves the selected time to the start of the next such window (inside the window: the first computed sample where the status turns true; after it: the countdown search, 60-minute steps refined to 1 minute, then the window moves). Respects the minimum link elevation. If nothing is found: "Not within the next N days (search limit)".
* **Verified** card (Explore, under the Site Card): one line per independent check, every number read live from the result files; a click opens the Validation page.
* **Verify with NASA** (Site Card in Expert view, and the Validation page): ASTERIA's Sun and Earth azimuth/elevation for the site and minute shown, next to two links that open the exact JPL Horizons API query (same parameters as the validation tests) in a new tab; expected agreement about 0.01°.

**Tabs**

* **Launch slip**: a heatmap of the surface-mission metrics for landing slips of 0-60 days. Rows are either the metrics for one site or all 8 south-pole sites with terrain horizons. Click a cell to open that date.
* **Power**: a first-order solar power and battery estimate.
* **Compare**: up to 4 site and date scenarios, with sunlight and Earth-link metrics side by side.
  * **Mission requirements** (round 6D, collapsible block at the top): minimum % sunlit, % Earth link and % both, maximum longest darkness and longest Earth blackout, positive energy balance (Power page settings; first-order estimate, example values) and maximum site slope. Each can be ticked on or off; the defaults are labelled "Example values - set your mission's". Each scenario shows **Met / Not met / Can't assess** per requirement, with the value it judged (at the precision shown) or the reason it cannot be judged, and a neutral "N of M requirements met" line. No score, weighting or ranking. Stored in the share link and for the session.
  * A **Mission casefile** button per scenario opens that scenario in Explore with its casefile.
* **Mission casefile** (round 6D; button on the Explore Site Card): one printable page for the current site, time window and requirements, built only from results the app already shows - site and coordinate source, scenario, sunlight and Earth link (status now, %, longest gaps, first 10 windows), both, power, slope and terrain horizon, launch slip (if computed), the requirements check, an evidence table (classification, data source, method link, live validation result, Verify with NASA) and the relevant limitations; footer with a share link that reopens it, the app version and "Not endorsed by NASA". Print / Save as PDF (print stylesheet), Download CSV (the existing export), Copy share link. Every number is tested against the same number elsewhere in the app (`tests/ui_round6d.js`).

**Workflow** (round 6D): pick a site on the map -> set the mission requirements (Compare) -> compare sites and dates -> open the Mission casefile -> verify each number (method links to the Validation page, "Verify with NASA").
* **Validation**: "How we know the numbers are right" (plain language), Verify with NASA, "Methods and formulas" (with links to the source files), "Reproduce it yourself", download of VALIDATION_REPORT.md; then the JPL Horizons comparison, sanity tests, the instant status check, 3D terrain accuracy and the terrain illumination cross-check against NASA's published map.
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

For each of the 8 curated south-pole sites, the Site Card shows **» Deploy: 3D terrain view**. Nothing of the 3D view is loaded before that click: Three.js (`lib/three/`, r149, MIT), `js/view3d*.js` and the site's terrain are added on demand. Deploy waits only for the selected window's series (not for the slower search beyond the window), shows a coarse mesh first and refines it, then adds the extended terrain. Close or Escape returns to the app. Opening takes 0.2-0.9 s on the development laptop at every quality level (PERFORMANCE.md).

* **Quality** Low / Medium / High (selector in the panel): mesh resolution, extended-terrain size, shadow map, pixel ratio, antialiasing, number of stars, Earth texture size. Chosen automatically from device hints (touch screen or small window, memory and cores, the GPU name when the browser gives it), then a 1.5 s frame-rate probe steps down one level if the average stays below 30 frames/s (with a note). A choice made in the selector is remembered.
* **Terrain**: the 6 km LOLA tile (20 m or 80 m) centred on the site, surrounded by **real LOLA terrain to 16 km** (LDEM_80S_80M, 100 m grid; 200 m at Low) and, at High, **to 40 km** (LDEM_75S_120M, 200 m grid). From the Shackleton floor this includes the whole crater rim. At High, the three sites inside 87.5°S (both Peak near Shackleton points, Shackleton crater centre) get a **2 km × 2 km patch at 5 m** from LDEM_875S_5M. The meshes share their edge vertices (no gaps; tested) and short skirts hide the T-junctions. True scale by default (vertical exaggeration 1×, 2×, 3×, 5×, always shown on screen).
* **Shadows**: on Medium and High all drawn terrain casts shadows on the tile and on the 16 km ring (shadow camera fitted to them), so a site in the shadow of a crater wall looks shadowed. Checked against the validated model (below).
* **Surface**: the same grey, shaded with the Lommel-Seeliger law used for regolith, with normals from the DEM at full resolution. Uniform albedo: no public LOLA albedo map at 250 m/pixel or finer was found. Optional **contour lines** (interval selectable, labelled) and **slope shading** from the DEM. No synthetic rocks, craters or textures.
* **Relief shading** (round 5; on by default in Walk and Rover, off in Orbit, toggle in the panel): "Relief shading: display contrast only; heights and slopes are the LOLA data." Since round 6C a bounded factor (0.4-1.6) on the Lommel-Seeliger brightness that follows the ratio of sunlight on the DEM normal to sunlight on a smoothed DEM normal (±4 grid cells); before, 70 % of the Lommel-Seeliger brightness plus the difference, which clipped sunlit slopes to black at a low Sun. In Walk and Rover on laptops the 6 km tile is drawn at full resolution and the 5 m patch is used where it exists, at every quality level. Why: [docs/ground_detail/README.md](docs/ground_detail/README.md).
* **Brightness** slider and **Light up** button: display exposure and the fill light only ("Display brightness only (like camera exposure). Real polar shadows are almost black; this does not change the computed lighting."). When the validated model says the site is in shadow, a tip suggests Light up and **Jump to next sunlight**. The slider is remembered; Light up (3×) is for this visit only and switches itself off when the Sun is up at the site (at 3× sunlit ground clips to white).
* **Sun**: light direction and disk at the engine's azimuth/elevation and angular size; optional faint glare labelled "camera glare (display effect); there is no atmosphere on the Moon". **Earth**: NASA Blue Marble Next Generation (cloud-free), rotated for the time (sub-observer point within 0.2° of JPL Horizons), lit from the computed Sun direction (so its phase is right even when the Sun is below the site's horizon). Labels say "(below horizon)" or "(hidden by terrain)" when that is the validated status; when Sun or Earth is outside the picture, its label sits at the screen edge with an arrow.
* **Stars** (optional): Yale Bright Star Catalogue to magnitude 5.0 (4.5 at Medium, 3.5 at Low) at their true directions for the selected time (engine's Moon orientation), sized by magnitude, with the note "Real star positions; cameras usually cannot see stars when the Sun or sunlit ground is in view."
* **Distant skyline**: the site's horizon mask drawn as a ring 60 km away (exact from the site marker).
* **Finding your way**: oblique default view with the Sun in the picture (crater floors are framed from 26 km so the walls show), compass, scale bar, distance from the site, top-view mini-map (LOLA heights, the tile, your position and heading, Sun/Earth directions), rover track, optional 500 m distance rings in Walk/Rover, and up to 5 named features per site from the IAU Gazetteer (on the terrain, or on the skyline in their direction when farther away).
* **Panel**: time, Sunlight and Earth-link tiles at the site marker (validated model), Jump to next sunlight / Earth view / both, Expert values, time slider and play synced with the main app; Orbit, Walk (eye 2 m above the ground), Rover (position, DEM elevation, slope, slope warning, near-field Sun estimate).
* **Labels** (Sun, Earth, site, rover, feature names) are kept inside the picture and off the mini-map, compass box, buttons and each other; a feature name that cannot be placed is hidden rather than drawn over something.
* **Round 6 (branch `round6`)**:
  * **Finer real terrain**: ring A at 25 m from LDEM_85S_20M where that product covers it (both Peak near Shackleton points, Shackleton crater centre, Mons Malapert), drawn at 50 m on High; ring B at 100 m from LDEM_85S_20M or LDEM_80S_80M (7 sites), drawn at 200 m. **Normal maps** baked from the finest loaded LOLA grid give coarser meshes the lighting detail of that grid (never finer); the detail fades gradually toward a coarser neighbour instead of stepping at the ring edges (geometry is not morphed: every vertex keeps its DEM height). The 3D notes list, per area, "geometry: X m grid; lighting detail (normal map): Y m LOLA data". Medium keeps the round-4 ring A geometry (a 100 m sampling of the 20 m product changed 2 of 50 shading verdicts) with the 25 m normal map.
  * **Sharper near shadows**: a camera-centred second Sun shadow map on Medium/High (texel 2-6 m); the picture uses the minimum of both maps, so it never lights ground the full map shadows (shading consistency unchanged).
  * **Earthshine** (optional, Approximate): sunlight reflected by Earth from the computed Earth direction, strength = Earth's geometric albedo 0.434 (NASA Earth Fact Sheet) × (Earth radius / distance)² × the Lambert phase law at the computed phase (about 1/8,400 of sunlight at full Earth); off when Earth is below the validated terrain horizon; casts shadows on Medium/High; a site in shadow is shown with a stated raised exposure.
  * **Rover with NASA VIPER's published proportions** (2.5 m tall, 1.5 m × 1.5 m, four wheel modules; other sizes approximate), each wheel on the LOLA surface, body pitch and roll from the wheel heights; "About this rover" with sourced facts and VIPER's status (NASA, 20 October 2026). Illustrative: not a mobility simulation; ASTERIA does not predict whether a rover can traverse a slope or surface.
  * **Exploration**: camera presets (Overview, Site eye level 2 m, Look at Sun, Look at Earth), pointer inspection (height, slope, lat/lon, distance from the site, data resolution), hazard view (slopes above your limit), the camera and its view on the mini-map, and "Show on 2D map".
  * Before/after pictures and measurements: [docs/ground_detail/round6/](docs/ground_detail/round6/README.md); full report: [ROUND6_REPORT.md](ROUND6_REPORT.md); design choices: [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md).
* **Round 6B (same branch)**:
  * **Inspection**: click or tap the terrain to read height, slope, position and data resolution; the readout and a small marker stay until the next click or Esc. "Inspect on hover" (off by default) follows the mouse, computed at most once per frame (median 0.1 ms per update on High; the values are identical to before).
  * **Shadows off by default** in all modes ("Shadows (approximate)"; remembered for the session only). Off: "Shadows off: the terrain is lit from the Sun's real direction without cast shadows. Sunlit/shadowed status at the site comes from the validated horizon model (tiles above)." The status tiles never depend on it.
  * **Relief shading** off by default in Orbit, on in Walk and Rover (a change is kept per mode); its contrast is normalised by grid spacing and viewing distance, so the 6 km tile no longer shows as a bright, grainy square (tile edge at 60 km on High: luminance difference +49 % → +1 %, detail +94 % → +14 %; [docs/tile_edge/](docs/tile_edge/)).
  * **Rover**: a detailed VIPER-like model (chassis sections and frame, radiator, framed vertical solar panels, mast with camera housings and lights, wheels with tread, steering housings and suspension arms; 4,996 triangles, 2,644 on phones / Low) within VIPER's published 2.5 m × 1.5 m × 1.5 m; layout and part sizes approximate and labelled; wheel contact and tilt unchanged.
  * **Stars on by default** (background only; no calculation, readout, inspection, shadow or status uses them).
  * **Download CSV** in the Explore page's Sunlight windows and Earth link windows panels: header (site, coordinates, source, horizon model, period, sampling step, minimum link elevation, app version = git commit, generation time, "Computed by ASTERIA; validated against NASA/JPL Horizons - see VALIDATION_REPORT.md"), the windows table and the full time series (UTC, Sun az/el, visible Sun fraction, Sun up, Earth az/el, Earth visible, terrain horizon at both azimuths), at full precision.
  * **Compare** gains a "Power and terrain" section: solar energy in the window and battery for the longest darkness from the Power page's current settings (first-order estimate, example values; identical to the Power page for the same inputs) and the DEM slope at the site point (5 m or 20/80 m LOLA grid, identical to the 3D readout; "-" for custom points).
* **Round 6C (same branch): ground-level shading, display only** (ROUND6_REPORT.md, "Round 6C"):
  * Why Walk and Rover look smoother than Orbit: the finest data are 5 m / 20 m grids; at ground level one grid cell covers tens to thousands of screen pixels (Orbit: about 3 grid cells per pixel). Features smaller than the grid are not in any dataset used and are not invented (stated in the 3D notes).
  * The 6 km tile and the 5 m patch are shaded per pixel from normal maps of their own LOLA grids (at every quality level with WebGL2); terrain textures use the device's maximum anisotropic filtering.
  * Relief shading is a bounded factor (0.4-1.6): it no longer turns sunlit slopes black at a low Sun (Mons Malapert Rover: mean luminance 7.9 → about 27 of 255) or clips Walk views to white.
  * "Openness shading (Walk and Rover)", off by default: sky-view factor from the LOLA heights (Zakšek et al. 2011), display only.

| 3D view | Classification | Accurate (tested) | Approximate / not modelled |
|---|---|---|---|
| Terrain heights | Measured | Tile, rings and 5 m patch = bilinear LOLA samples; **all 3,444,523 grid points** within 0.10 m of direct DEM samples by an independent Python path (`node tests/accuracy3d.js`, round 5), and the stored check points (`tools/terrain3d.py check`, `tools/terrain3d_ext.py check`, `tests/view3d_test.js`) | Grid 5 / 20 / 80 / 100 / 200 m depending on the area and quality; boulders, sub-grid relief and the lander are not represented. LDEM_875S_5M is labelled "preliminary LOLA data" by its producers |
| Joins between meshes | Calculated | Edge vertices identical to the finer mesh (9,712 vertices tested, 0 m difference) | Short skirts hide T-junctions; a slight change of detail is visible where the grid changes |
| Geometry | Calculated | Exact site-centred ENU positions including lunar curvature (460 m drop at 40 km) | Spherical Moon (R = 1737.4 km), as in the rest of the app |
| Sun | Calculated | Light direction = engine az/el (worst 1.7e-6°); disk size from the engine | Glare halo is a display effect (optional, labelled) |
| Earth | Calculated (position, phase, orientation); Measured (Blue Marble imagery) | Position and size from the engine (< 0.01°); orientation: sub-observer point vs JPL Horizons, worst 0.155° in 12 cases (`tests/earth_orientation.js`); phase from the engine's Sun and Earth vectors | Texture: Blue Marble July 2004 composite, clouds not shown; night side drawn very faintly so Earth can be found |
| Stars | Measured (catalogue) / Calculated (directions) | Directions vs an independent IAU/WGCCRE 2009 computation: worst 0.0012° (72 cases) | Annual aberration (< 0.006°) not applied; point sizes are a display choice |
| Shadows | Approximate | Shading consistency with the validated "Sun up" at the site marker, 50 times per site over a year: Low 97.8 %, Medium 99.0 %, High 99.8 %; every disagreement is the Sun blocked by terrain beyond the shadow-casting range | Shadow map texel 7-22 m; terrain beyond 3 km (Low), 16 km (Medium) or 40 km (High) casts no shadows; the 16-40 km ring is shaded but receives no shadows |
| Status tiles, labels | Calculated | From the validated horizon model (same as the main app) | - |
| Surface shading | Approximate (relief shading: Illustrative) | Normals from the DEM at full resolution | Lommel-Seeliger law with a uniform albedo (no albedo map); relief shading (Walk/Rover default) is a display contrast only; faint uniform fill light (not physical); brightness slider is display only |
| Contours, slope | Calculated | From the same DEM heights (true heights); slope by central differences over one grid spacing, same formula as the rover readout | Real slopes over a few metres can be steeper |
| Feature names | Measured (Gazetteer positions) | IAU Gazetteer centre coordinates | Labels at the feature centre (a crater name sits on its floor); beyond the drawn terrain they show a direction only |
| Distant skyline | Calculated | Exact horizon mask from the site marker | Ring 60 km away: exact only from the site marker; between the drawn terrain and the ring nothing is drawn |
| Rover | Calculated (elevation, slope, tilt) / Illustrative (model, driving) | DEM elevation (20 positions: within 0.43 m of LOLA at the displayed lat/lon, which maps back within 1.4 m on the 2D map's projection) and slope (central differences; 242 points within the 0.1 m storage-step bound of an independent Python slope; fixed in round 5, was a one-sided in-cell gradient up to 16° off) | Near-field Sun estimate uses the tile only; the rover model and speed are illustrative |
| Lighting detail (normal maps, round 6) | Calculated | Normal maps baked from the finest loaded LOLA grid of each ring (25 m ring A where LDEM_85S_20M covers it, 100 m ring B); identical to the DEM vertex normals at the grid nodes (unit test) | Never finer than the grid; detail fades toward a coarser neighbour (mipmaps of real normals); geometry is not morphed |
| Near-camera shadows (round 6) | Approximate | Second Sun shadow map, same direction and casters, texel 2-6 m; picture = min(full map, near map); shading consistency unchanged (97.8 / 99.0 / 99.8 %) | Shadow mapping; edges of distant ridges keep the full map's resolution |
| Earthshine (round 6, optional) | Approximate | Direction, angular size and phase from the engine; strength = albedo 0.434 (NASA Earth Fact Sheet) × (R/d)² × Lambert phase law (unit test) | Within about a factor of 2 (clouds, real phase curve); point source; no light from sunlit terrain; shown with a stated raised exposure (Illustrative) |
| Rover model and tilt (round 6) | Illustrative (model) / Calculated (tilt) | NASA VIPER published size (2.5 m tall, 1.5 × 1.5 m, 4 wheels); each wheel on the LOLA surface (UI test: difference 0) | Other proportions approximate; tilt at DEM resolution; not a mobility simulation |
| Inspection, hazard view, presets (round 6) | Calculated | Height, slope, lat/lon, distance and resolution from the LOLA grid at the point; presets use the engine's Sun/Earth directions (within 0.05°) | Real slopes over a few metres can be steeper; hazard view is not a traversability prediction |
| 2D scale bar (round 6) | Calculated | Polar stereographic scale factor at the map centre; matches a great-circle measurement within 0.5 % (UI test) | "Scale at map centre": the scale varies slightly across the map |
| Per-pixel normals for the tile and 5 m patch (round 6C) | Calculated | Normal maps of the tile's 20 m (or 80 m) grid and the 5 m patch, same method as the rings (central differences of the stored heights); heights, readouts and status identical before/after (tests/ground_detail_6c.js --invariants) | Interpolated between nodes; no detail finer than the grid |
| Close-range surface texture (round 6E, Walk/Rover, on by default) | Illustrative | Fragment-shader pattern only (albedo ±5 %, micro-relief normals, craterlets 0.1-5 m, rock flecks 0.04-0.4 m; tuned visually, not statistically matched; faint wheel tracks along the rover's path this session); multiplies only the Sun term; off = pixel-identical to round 6C, Orbit unchanged, unlit pixels unchanged, ground mean within 3 % (`tests/ui_round6e.js`) | Not measured; no geometry, no 3D rocks; heights, slopes, readouts, shadows, status unchanged |
| Relief shading (bounded, round 6C) | Illustrative | Display contrast from the DEM normal vs a smoothed DEM normal; factor 0.4-1.6 on Lommel-Seeliger | Not a photometric prediction |
| Openness shading (round 6C, optional) | Illustrative (sky-view factor Calculated from LOLA) | Sky-view factor (16 directions, 1 km, curvature) checked on synthetic flat, pit and slope grids (tests/view3d_test.js); display only (tests/ui_round6c.js) | The Moon has no sky light: a visualisation aid, not a light source |

## Sites

There are 8 south-pole sites with LOLA terrain horizons, plus 11 reference sites outside the south pole. The reference sites use a smooth horizon (terrain not included) and are kept for comparison and education. Every site has source links and a note on exactly what its coordinate is (`data/sites.js`).

**NASA candidate landing regions (announced for Artemis III).** Since February 2026 NASA plans Artemis III (2027) as a crewed test flight in low Earth orbit and the first Artemis Moon landing as Artemis IV, targeted for 2028 ([NASA, 27 Feb 2026](https://www.nasa.gov/news-release/nasa-adds-mission-to-artemis-lunar-program-updates-architecture/)); NASA's [Artemis IV mission page](https://www.nasa.gov/mission/artemis-iv/) shows the same nine candidate regions. NASA's 28 Oct 2024 list of nine regions publishes the region boundaries only as images, with no coordinates. A region is plotted (with sunlight and Earth calculations) **only** where a point is genuinely inside it:

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

The Validation page starts with "How we know the numbers are right" and a "Verify with NASA" box; the Explore page shows a compact "Verified" card. All their numbers are read from the result files below.

| Test | Result |
|---|---|
| `node tests/validate.js`: 52 angle comparisons vs JPL Horizons | elevation error max 0.0038°, azimuth max 0.055° (Sun at 89° elevation) |
| 4 event times vs Horizons | max 0.76 min |
| Physics sanity tests (pole Sun ±1.55°, Apollo 11 Earth 100 %, Chang'e-4 Earth 0 %, equator Sun 48.6 %) | pass |
| Maximum Sun elevation at 20 random latitudes -60° to -90° (2027, smooth horizon): ≤ 90 - \|lat\| + 1.6°, within 0.2° of 90 - \|lat\| + 1.54° | pass: max - (90 - \|lat\|) between 1.504° and 1.550°, largest deviation from +1.54° is 0.036° |
| **Custom point, one-year check** (`node tests/one_year_check.js`): (-70.9457, 67.9235 E), smooth horizon, Earth and Sun every hour 2026-11-14 to 2027-11-14 vs fresh Horizons fetches (8,761 rows each) | elevation max 0.0028°, azimuth max 0.0039°; Horizons' lowest Earth elevation 1.634° (2026-12-08 05:31 UTC), so Earth never sets there that year, and the app shows no Earthset either; 24/24 sunrises/sunsets within 1.42 min |
| **Blind test** (`node tests/blind_test.js --new`): 5 new random south-pole site/time cases in 2026-2030, fetched fresh from Horizons, 10 comparisons | 10/10 pass; elevation max 0.0029°, azimuth max 0.0038° |
| **Terrain for clicked points** (`node tests/coarse_validation.js`), 240 m data | curated sites: % sunlit differs from the 20 m horizons by 2.0 points on average, 6.9 at most (limits 5 / 10); 50 random points in 85-90°S vs NASA's map: 1.5 points on average (limit 5) -> PASS, shipped |
| **Instant status check** (`node tests/instant_status_check.js`, round 5): 8 south-pole sites × 21 times (the time the cases were chosen + 20 random in 2026-2028) × Sun and Earth; angles straight from JPL Horizons, terrain horizon at the exact azimuth from `tools/terrain.py horizon_at` (Python, DEM) | 336/336 agree with the app; 3 "on the edge" (body within 0.05° of the horizon), all agree; no bug found |
| **3D terrain accuracy** (`node tests/accuracy3d.js` + `tools/accuracy3d.py`, round 5) | heights: every grid point (3.44 million) within 0.10 m of LOLA; slopes: rover readout vs Python central differences within 0.17° (20/80 m) and 0.53° (5 m), the storage-step bound; 2D map slope layer reproduced at 200/200 points; 20 rover positions within 1.4 m and 0.43 m |
| `node tests/ui_round5.js` | browser: instant status at stored case times = independent status, rover readout = verified values, relief shading changes no height/slope/light/status, Light up auto-off, jump buttons (series-checked, 3D, minimum elevation, Shackleton floor not found), tour spotlight, Deploy icon, 3D labels inside and not overlapping, Verify with NASA URL = cached validation query, Verified card numbers, Validation sections and report download; laptop + phone, no console errors |
| `node tests/view3d_test.js` | 3D geometry: Sun and Earth direction vectors vs the engine's raw apparent vectors (96 site/time cases, worst 1.7e-6°), tile decoder vs DEM check points (0.05 m), curvature, world-to-grid inverse, slope, near-field Sun, Earth phase, lazy loading |
| **Round 6** `node tests/view3d_test.js`, `tests/accuracy3d.js`, `tests/shading_consistency.js`, `tests/ui_round6.js` | finer rings: every grid point (14.5 million in all products) within 0.10 m of LOLA; 5,120 new seam vertices identical; normal maps = DEM normals; earthshine formula; shading consistency unchanged (97.8 / 99.0 / 99.8 %) and the near-camera shadows never light ground the full map shadows; rover wheels on the LOLA surface; presets within 0.05° of the engine; inspection at the site within 1 m; 2D scale bar within 0.5 % of a great-circle measurement; laptop + phone, no console errors |
| `node tests/view3d_test.js` (round 4 additions) | extended rings vs stored DEM samples (worst 0.097 m), 5 m patch (0.047 m), seams (9,712 shared edge vertices, 0 m), DEM normals (10° plane), star directions vs an independent IAU 2009 computation (worst 0.0012°) |
| `node tests/earth_orientation.js` | Earth sub-observer point vs JPL Horizons quantity 14, 12 cases: worst 0.155° (limit 1°) |
| `node tests/shading_consistency.js` | rendered shadow at the site marker vs validated "Sun up", 8 sites × 50 times: Low 97.8 %, Medium 99.0 %, High 99.8 %; all disagreements = Sun blocked by terrain beyond the shadow-casting range |
| `.venv\Scripts\python -I tools\terrain3d_ext.py check` | rings and 5 m patches vs direct DEM samples by an independent path, worst 0.098 m (limit 1 m) |
| `.venv\Scripts\python -I tools\terrain3d.py check` | 3D tiles: site centre + 3 random nodes per site vs raw DEM samples by an independent path, worst 0.049 m (limit 1 m) |
| `node tests/features_test.js` | power model, slip = timeline, minimum-elevation logic, worker job = engine, `js/core.js` in sync, all 8,536 requestable tiles exist, tiles < 80 MB, map projection, site sources and Artemis region rules, downsampled DEM size/decoding/gating, SUBMISSION_LINKS.md links all cited, AI-disclosure meta tags, file headers, README "How this was made", AI_DISCLOSURE.md and the two in-app disclosure lines |
| **Round 6B** `node tests/inspect_perf.js --compare tests/perf/inspect_before.json`, `node tests/tile_edge.js`, `node tests/ui_round6b.js` | inspection: 81/81 readouts identical, median 0.70 → 0.10 ms per update; tile edge (60 km, High): luminance +49.4 % → +1.0 %, detail +94.2 % → +13.5 %; browser checks of click/hover inspection, shadows default and invariance, relief defaults, rover model (triangles, arms), stars invariance, CSV = app values exactly, Compare = Power page and 3D readout exactly (laptop + phone) |
| **Round 6C** `node tests/ground_detail_6c.js --tag after --variants`, `node tests/ground_detail_6c.js --invariants --other before=<checkout of 0ba841e>`, `node tests/ui_round6c.js` | same site/time/lighting in Orbit, Walk and Rover before/after (docs/ground_detail/round6c/); invariants: heights (vertex hashes of every layer), 216 inspection readouts, rover pose and readout, status tiles, Sun/Earth directions identical; shading consistency 97.8 / 99.0 / 99.8 % unchanged; openness shading display only (laptop + phone) |
| `node tests/ui_check.js` | laptop and phone via file://, every feature, tour, worker, loader, reduced motion, map fit (data square fills the panel on first load and after "Whole pole"), map coverage limits, search-limit wording, clicked-point terrain, the VERIFY_YOURSELF share link, the 3D view (lazy loading, light direction vs engine < 0.01° in the browser, Earth position and size, time sync both ways, exaggeration label, orbit/walk/rover controls incl. on-screen buttons, phone mesh reduction, GPU memory freed on close), the first-visit intro (shows once, Skip/key/tap, auto-close after 3 s, not with a share link, reduced motion or in tests unless enabled, replay); AI wording only in the About credit line and the 3D "Graphics:" line (all pages, Orbit/Walk/Rover, loader, intro); no console errors |

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
* 3D view (round 4):
  * Extended terrain: LDEM_80S_80M and LDEM_75S_120M (same PDS directory as above).
  * 5 m patches: LOLA LDEM_875S_5M, https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.img (only the rows around the three sites were fetched, with HTTP Range requests: 3 × 34.6 MB instead of 1.84 GB).
  * Stars: Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren 1991), CDS catalogue V/50, public domain: https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50 (file taken from the Harvard-Smithsonian CfA copy http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz because the CDS file server did not answer).
  * Earth: NASA Blue Marble Next Generation, https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/ ; file https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg (cloud-free July 2004 composite, public domain NASA imagery; no NASA logos).
  * Feature names: IAU Gazetteer GIS downloads, https://planetarynames.wr.usgs.gov/GIS_Downloads ; file https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip
  * Albedo: none used. The only LOLA 1064 nm albedo maps found (Lucey et al. 2014, JGR Planets 119, https://doi.org/10.1002/2013JE004592) are about 2 km/pixel near the poles; the PDS polar LDRM products are roughness maps; PGDA products 68/90 have no albedo map.
  * Lunar rotation model for the independent star test: Archinal et al. 2011, https://doi.org/10.1007/s10569-010-9320-4
* Round 6:
  * Finer ring grids: LDEM_85S_20M and LDEM_80S_80M (same PDS directory as above).
  * Earth's albedo for earthshine (geometric albedo 0.434, Bond albedo 0.294): NASA Earth Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
  * VIPER (rover proportions, facts and status): NASA VIPER mission page https://science.nasa.gov/mission/viper/ ; rover and instruments https://science.nasa.gov/mission/viper/rover-and-instruments/ ; progress update (20 Oct 2026) https://www.nasa.gov/missions/moon-base/nasa-provides-progress-update-on-moon-base-rovers/ ; Blue Origin delivery award (19 Sep 2025) https://www.nasa.gov/news-release/nasa-selects-blue-origin-to-deliver-viper-rover-to-moons-south-pole/ ; 17 Jul 2024 release https://www.nasa.gov/news-release/nasa-ends-viper-project-continues-moon-exploration/
  * VIPER visual references for the round 6B rover model (photo titles and article only; no facts or numbers taken from them, no images used): NASA VIPER image gallery https://science.nasa.gov/gallery/viper/ ; "Watch NASA Build Its First Robotic Moon Rover" https://www.nasa.gov/missions/viper/watch-nasa-build-its-first-robotic-moon-rover/
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
data/terrain3d/          6 km tiles; ext/<site>_a.js, _b.js (16 / 40 km rings), _af.js, _bf.js (finer rings, round 6; fine_index.js); hi5m/<site>.js (5 m patches); features.js (IAU names)
data/stars.js            Bright Star Catalogue to V = 5.0 (3D stars);  data/earth/earth_<w>.js  Blue Marble textures (base64)
data/shading_consistency.js   rendered shadows vs the validated model (tests/shading_consistency.js)
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
tests/ui_round5.js       headless browser checks for round 5 (laptop + phone)
tests/ui_round6.js       headless browser checks for round 6: rover, presets, inspection, hazard, 2D link, Getting started, scale bar
tests/instant_status_check.js   instant status vs Horizons + Python terrain -> data/instant_status.js (tests/instant_terrain.json caches the Python result)
tests/accuracy3d.js, tools/accuracy3d.py   3D heights, slopes, rover positions vs LOLA -> data/accuracy3d.js (tests/accuracy3d_python.json)
tests/ground_detail.js   ground-detail measurement (docs/ground_detail/; --r6: Orbit/Walk/Rover before/after, docs/ground_detail/round6/)
tools/terrain.py         DEM reading, horizon masks
tools/terrain3d.py       6 km terrain tiles for the 3D view (build / check) -> data/terrain3d/
tools/terrain3d_ext.py   extended rings and 5 m patches (build / check);  tools/fetch_round4.py  their downloads
tools/stars.py, tools/earth_texture.py, tools/features3d.py   stars, Earth textures, feature labels for the 3D view
tests/perf3d.js, tests/shading_consistency.js, tests/earth_orientation.js   3D performance, shadows vs model, Earth vs Horizons
tools/coarse_dem.py      builds data/dem_coarse.js (+ "check": terrain.py on the same grid)
tools/tiles.py           map tile pyramids + georeference check ("illum120" = outer illumination layer only)
tools/illum_crosscheck.py, tools/export_sun_vectors.js   illumination cross-check
tools/build_core.js      builds js/core.js
README.md, GAPS_AND_ISSUES.md, VALIDATION_REPORT.md, TEXT_AUDIT.md, VERIFY_YOURSELF.md,
AI_DISCLOSURE.md, SUBMISSION_LINKS.md, DESIGN_DECISIONS.md, ROUND6_REPORT.md (round 6)
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
.venv\Scripts\python -I tools\fetch_round4.py      # 5 m DEM windows, star catalogue, Blue Marble (into dem/)
.venv\Scripts\python -I tools\terrain3d_ext.py build; .venv\Scripts\python -I tools\terrain3d_ext.py check
.venv\Scripts\python -I tools\stars.py; .venv\Scripts\python -I tools\earth_texture.py
# download the Gazetteer centre points (URL above), unzip into dem/gazetteer/, then:
.venv\Scripts\python -I tools\features3d.py
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
node tests/earth_orientation.js              # Earth orientation vs JPL Horizons (cached)
node tests/shading_consistency.js            # rendered shadows vs the validated model, 3 quality levels
node tests/perf3d.js --phone --quality low,medium,high
node tests/instant_status_check.js           # --new: choose new cases (now + 20 random times) and fetch them
node tests/accuracy3d.js                     # --python: rerun the Python side (needs the DEMs)
node tests/ui_round5.js                      # --shots: also screenshots
node tests/ground_detail.js --other round3=<checkout of 46b0fa8> --tag after
node tests/ui_round6.js                      # round 6; --shots: also screenshots
node tests/ground_detail.js --r6 --other before=<checkout of v1-stable> --tag after
```

## Stable snapshot

The commit tagged **`v1-stable`** (local tag, round 5) is the tested state of round 5; the main branch (`master`) stays there. Round 6 is on the branch **`round6`** for the owner's review (not merged; see ROUND6_REPORT.md). To return to it:

```powershell
git checkout v1-stable          # look at it (detached HEAD)
git switch -c from-v1 v1-stable # or start a branch from it
git reset --hard v1-stable      # or move the current branch back to it (discards later commits on that branch)
```

## Credits

Astronomy Engine by Don Cross (MIT). Leaflet by Volodymyr Agafonkin and contributors (BSD-2-Clause). Three.js by the three.js authors (MIT). LOLA data: NASA LRO/LOLA team via the PDS Geosciences Node. Illumination maps: NASA PGDA, Mazarico et al. 2011. Feature names and coordinates: IAU WGPSN / USGS Gazetteer of Planetary Nomenclature. JPL Horizons: NASA/JPL Solar System Dynamics Group. LROC: NASA/GSFC/Arizona State University.
