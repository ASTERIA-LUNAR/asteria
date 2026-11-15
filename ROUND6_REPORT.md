# ASTERIA - Round 6 report (simulation fidelity, rover, usability)

*Generated with Claude Code (Anthropic) under human direction.*

Branch `round6`, created from tag `v1-stable` (commit c4c723f). The repository's main branch is called `master` here; it stays at `v1-stable`. Nothing is merged, no `v2-candidate` tag is created, nothing is pushed. Priorities, in order: scientific accuracy, physical realism, visual quality, presentation.

Classification used for every new feature:
* **Measured** - directly sourced observational data.
* **Calculated** - derived from measured data with documented mathematics.
* **Approximate** - rests on stated assumptions or limited-resolution data.
* **Illustrative** - visual only, no validated physical prediction.

## 0. Inspection (before any change)

### Current 3D architecture and files
* `js/view3d.js` (1,366 lines): DOM and panel, scene, terrain layers, lights, controls (Orbit / Walk / Rover), HUD, mini-map, labels, quality levels, test hooks. Loaded only when Deploy is clicked, together with `lib/three/three.min.js` (Three.js r149, WebGL2 when available), `js/view3d_math.js` and the site's tile.
* `js/view3d_math.js`: geometry helpers without Three.js (tile decoding, exact site-centred ENU positions with lunar curvature, bilinear heights, central-difference slope, grid meshes with DEM normals, skirts, stars, Earth orientation and phase, near-field Sun check). Unit-tested in Node (`tests/view3d_test.js`).
* Terrain data (all LOLA, bilinear samples, base64 int16 in `.js` files so the app works from `file://`):
  * 6 km tile per site (`data/terrain3d/<site>.js`, `tools/terrain3d.py`): 301 × 301 at 20 m from LDEM_85S_20M (6 sites) or 77 × 77 at 80 m from LDEM_80S_80M (IM-1, Nobile Rim 2 DM2).
  * Ring A to 16 km (`data/terrain3d/ext/<site>_a.js`, `tools/terrain3d_ext.py`): 100 m grid from LDEM_80S_80M (80 m at the two 80 m sites); drawn at 200 m at Low.
  * Ring B to 40 km (`<site>_b.js`): 200 m grid from LDEM_75S_120M, High only.
  * 5 m patch, 2 km × 2 km, from LDEM_875S_5M (3 sites, High; Walk/Rover on laptops at every level).
  * Nested squares with a hole for the finer mesh; edge vertices are taken from the finer grid (shared, no cracks) and short skirts hide T-junctions.
* Shading: `MeshLambertMaterial` patched in `onBeforeCompile`: Lommel-Seeliger law, relief-shading display option, optional contour and slope overlays. Per-vertex DEM normals at full resolution of each layer's grid, interpolated per fragment.
* Lights: one directional Sun light (engine az/el) with one shadow map (1024 / 2048 / 4096 px) fitted to all receivers (tile and ring A), re-rendered on every frame that is drawn; one uniform ambient "fill" light (not physical); the Earth sphere has its own shader lit from the computed Sun direction.
* Status tiles, labels and banners come from the validated horizon model of the main app (`js/engine.js` + `data/horizons`), never from the rendering.
* Tests touching the 3D view: `tests/view3d_test.js` (Node unit), `tests/accuracy3d.js` + `tools/accuracy3d.py` (every grid point vs the DEM), `tools/terrain3d.py check`, `tools/terrain3d_ext.py check`, `tests/shading_consistency.js` (rendered shadow at the site marker vs the validated model), `tests/ground_detail.js` (picture measurements), `tests/perf3d.js`, `tests/ui_check.js`, `tests/ui_round5.js`.

### Why Orbit shows square steps and Walk/Rover is hard to read (diagnosis)
* Each nested square has a different grid **and** a different DEM product: tile 20 m (LDEM_85S_20M), ring A 100 m (LDEM_80S_80M), ring B 200 m (LDEM_75S_120M). The lighting detail follows the vertex spacing, so the brightness texture changes abruptly at 3 km and 16 km.
* LDEM_85S_20M covers ring A completely for 4 sites (both Peak near Shackleton points, Shackleton crater centre, Mons Malapert) and ring B completely for 3 of them (computed: share of ring nodes inside the 20 m product). IM-2 (92 % / 69 %), Mons Mouton (87 % / 66 %) and Nobile Rim 2 (44 % / 47 %) are only partly covered; IM-1 not at all.
* The single shadow map covers 32 km (ring A receives shadows): texel about 8 m (High) to 16 m (Medium) - coarse at the 2 m eye height of Walk.
* In shadow only the non-physical uniform fill light reaches the ground, so shadowed ground is flat grey at any exposure.

### Improvements possible with data already on disk
* Finer real data for ring A (and ring B) from LDEM_85S_20M where it covers the whole ring (`dem/ldem_85s_20m.img`, already downloaded): same site-centred grid and checks.
* Normal maps baked from the finest grid loaded for each layer, used where the drawn mesh is coarser than that grid; mipmaps (averages of real normals) for distance and for a gradual change of detail toward a coarser neighbour.
* Camera-centred second shadow map (cascade) for the Sun with the same light direction and casters.
* Earthshine light: direction, angular size and phase are already computed by the engine (Earth az/el, angular radius, Sun and Earth vectors); only Earth's albedo is needed (NASA Earth Fact Sheet).
* VIPER-proportioned rover: dimensions from NASA's pages; wheel contact from the DEM heights already in the view.
* Pointer inspection, hazard overlay, camera presets, 2D-3D link, scale bar: all from data already in the app.

### New datasets / dependencies
* No new dependency. New derived data files: finer ring grids from LDEM_85S_20M (and LDEM_80S_80M for ring B where 20 m does not cover it). No new downloads of DEMs.
* New cited sources: NASA VIPER pages (science.nasa.gov, nasa.gov), NASA Earth Fact Sheet (albedo).

### Expected scientific and visual impact
* Scientific results (Sun/Earth positions, horizons, status, countdowns, power, validation): **none expected** - `js/engine.js`, the horizon masks and the time predictions are not touched.
* 3D heights: new grids must pass the same check (every grid point within 1 m of a direct DEM sample; target the existing 0.1 m storage step).
* Visual: finer lighting detail to 16-40 km; smoother change of detail at the ring edges; sharper shadows near the camera; readable relief in shadow when Earth is up (earthshine, at an exposure stated on screen).

### Possible regressions (to check)
* Load time and memory: larger ring files (several MB) and textures; frame rate with an extra shadow pass. Phones / Low keep the current data.
* Shading consistency: the far shadow map must stay unchanged so agreement cannot drop; the near cascade must give the same verdict.
* Earthshine must not alter the Sun light, status tiles or readouts; the brightness/Light-up logic must keep working.
* UI tests that count layers, vertices, textures or light settings; the AI-wording test (no new AI wording in the UI).
* Geometry morphing across ring edges would move drawn vertices away from their DEM heights - see Part 1 for the decision.

## Baseline (v1-stable, before any change)

Measured with `node tests/perf3d.js --phone --quality low,medium,high` (headless Chromium on the development laptop, GPU via ANGLE/D3D11; "phone" = emulated screen size and touch on the same GPU). Raw rows: `tests/perf/round6_baseline.json` / `.log`. The browser caps the frame rate at 60 frames/s, so the average while orbiting is 59-60 frames/s everywhere; the GPU-synced render time (median of 20 renders, each followed by a 1-pixel read-back) is added to compare the cost of a frame. GPU resource counts are Three.js `renderer.info` (geometries, textures, draw calls, triangles); **exact GPU memory in bytes is not available in browsers** (WebGL has no memory query). The before/after table is in Part 5.

## Part 1 - Terrain detail in Orbit, Walk and Rover (real data only) - DONE

**What changed**
* **Finer ring grids** (`tools/terrain3d_ext.py build`): ring A at **25 m** from LDEM_85S_20M for the 4 sites whose whole ring A lies inside that product (both Peak near Shackleton points, Shackleton crater centre, Mons Malapert); ring B at **100 m** from LDEM_85S_20M (3 sites) or LDEM_80S_80M (4 sites) where one of them covers the whole 40 km ring. Same site-centred grid, curvature and encoding as round 4. Index: `data/terrain3d/fine_index.js`.
* **Geometry**: High draws ring A from the 25 m grid every 2nd node (**50 m**, was 100 m) and ring B from the 100 m grid every 2nd node (200 m, as before but from the finer product). Medium keeps the round-4 ring A geometry (100 m, LDEM_80S_80M): drawing a 100 m sampling of the 20 m product changed 2 of 50 shading-consistency verdicts at Mons Malapert (98.5 % instead of 99.0 %), so that was **not implemented** (accuracy first; see "Trade-offs for the owner"). Low is unchanged.
* **Normal maps** (Medium and High, WebGL2): baked in the browser from the finest loaded grid of each ring (`js/view3d_math.js` `bakeNormalXZ`): central differences over one grid spacing of the exact ENU positions, identical to the mesh's vertex normals at the same node (unit test). Texel = grid node (25 m ring A, 100 m ring B; never finer than the grid or its DEM). Float (or half-float) two-component textures with a mipmap chain of 2 × 2 averages (`mipChainXZ`). Labelled per area in the 3D notes ("Resolution by area: … geometry: X m grid; lighting detail (normal map): Y m LOLA data (product)").
* **Gradual change of detail at ring edges** instead of square steps: ring A's outer 3 km samples its normal map at a coarser mip level toward ring B's 100 m (High); where ring A is much coarser than the tile (100 m vs 20 m), the tile's outer 500 m blends toward its smoothed DEM normal (±4 cells); the 5 m patch's outer 150 m likewise. **Geometry is not morphed**: morphing would move drawn vertices away from their DEM heights (it would fail "every grid point within 1 m of the DEM"); the meshes already share their edge vertices (no cracks; seam test).
* **Near-camera shadow cascade** (Medium 2048 px, High 4096 px): a second Sun shadow map, same direction and same casters, fitted to a square around the view centre (Orbit: half the camera distance, 0.5-8 km; Walk/Rover: about 1 km), texel 2.3-5.6 m instead of 9-22 m. The picture uses **min(full map, near map)**: on its own the finer map turned 3 of 264 grazing-Sun cases (Sun < 0.33° above the drawn terrain) from shadow to lit; with the minimum it can only add the shadows the coarse map misses and never lights ground the full map shadows. The full Sun map is now re-rendered only when the time or the terrain changes (it does not depend on the camera).
* **Earthshine** (toggle "Earthshine", off by default): see below.
* Shadows checkbox: receivers ignore the shadow maps (a uniform) instead of switching the light's shadow off (the light order must stay fixed for the cascade).
* Fixed while testing: the new shadow maps and normal maps were not freed on Close (the UI test caught it; now 0 geometries and 0 textures after closing).

**Earthshine** - classification **Approximate** (physically based, with stated assumptions):
* Direction = the engine's Earth az/el (validated); angular size from the engine (Earth radius 6378.137 km / distance); phase angle from the engine's Sun and Earth vectors (`earthPhase`).
* Strength relative to direct sunlight: `p × (R_E/d)² × Φ(α)`, `Φ(α) = (sin α + (π − α) cos α) / π` (Lambert-sphere phase law), `p = 0.434` = Earth's geometric albedo (NASA Earth Fact Sheet, https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html, "Geometric albedo 0.434", page last updated 15 November 2024). Full Earth: 1.195 × 10⁻⁴ of sunlight (about 1/8,400; unit test). A Lambert sphere with Earth's Bond albedo (0.294, same page) gives 45 % of that; the real phase curve and cloud cover lie around these values, so the strength is good to about a factor of 2 (stated on screen).
* Visibility: off when Earth's centre is below the validated terrain horizon at the site marker (rays to 300 km); on Medium/High the drawn terrain casts earthshine shadows (own shadow map). Earth is treated as a point source (its 1.9° disk would soften shadow edges) - stated.
* Because earthshine is about 10⁴ times fainter than sunlight, a site in shadow is shown with the exposure raised to 0.35 / ratio (e.g. ×4,713), stated on screen ("like a long camera exposure; anything in sunlight is overexposed"); the non-physical fill light is off while earthshine is on. Not used by any status, readout or calculation.

**Files changed**: `tools/terrain3d_ext.py`, `data/terrain3d/ext/*_af.js` (4), `*_bf.js` (7), `data/terrain3d/fine_index.js`, `js/view3d_math.js` (gridUV, bakeNormalXZ, mipChainXZ, earthshineRatio), `js/view3d.js` (materials, light loop, cascade, normal maps, earthshine, notes, debug), `tools/accuracy3d.py`, `tests/accuracy3d.js`, `tests/view3d_test.js`, `tests/shading_consistency.js`, `tests/ground_detail.js`, `tests/ui_check.js` (accepts LDEM_85S_20M where it is now used), `data/accuracy3d.js`, `data/shading_consistency.js`, `docs/ground_detail/round6/`.

**Scientific data used**: LDEM_85S_20M https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_85s_20m.img ; LDEM_80S_80M https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_80s_80m.img (both already on disk); NASA Earth Fact Sheet https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html (albedo).

**Existing calculations affected**: none. `js/engine.js`, horizon masks, status, countdowns, power, rover readouts and the heights of the existing products are unchanged; the existing ring files were rebuilt byte-identical.

**Tests run and results**
* Heights: `node tests/accuracy3d.js --python` - **14,499,574 grid points** (all products including the 11 new grids, 6.56 million new points) within **0.10 m** of direct bilinear DEM samples (independent Python path), mean 0.031 m - PASS. `tools/terrain3d_ext.py check` - worst 0.099 m - PASS.
* `node tests/view3d_test.js` - ALL PASS, including new checks: 5,120 new hole-edge vertices identical to the finer mesh, no missing cells; baked normal = DEM vertex normal (difference 0), texture coordinates on texel centres; earthshine formula (full, quarter, new Earth); mip chain.
* `node tests/shading_consistency.js` (8 sites × 50 times × 3 levels): **Low 97.8 %, Medium 99.0 %, High 99.8 %** - identical to v1-stable; 0 unexplained. With the near cascade: Medium 261/264 vs 260/264 for the full map alone on the same cases, High 263/264 vs 263/264 - **agreement did not decrease**.
* `node tests/ui_check.js` (laptop + phone) PASS, no console errors; `node tests/ui_round5.js` ALL PASS; `node tests/features_test.js` PASS.
* `node tests/ground_detail.js --r6 …`: see `docs/ground_detail/round6/README.md` - Orbit detail at Peak near Shackleton 1.59 → 2.67 (Medium) and 1.55 → 2.62 (High); Mons Mouton 1.99 → 1.74 (tile-edge fade; no 20 m ring there); Walk/Rover in sunlight unchanged; Mons Mouton in shadow: flat black (detail 0) → readable relief with earthshine (0.49).

**Remaining limitations**
* IM-2, Mons Mouton, Nobile Rim 2 and IM-1: ring A is not fully inside LDEM_85S_20M (92 %, 87 %, 44 %, 0 %), so their ring A keeps the 100/80 m grid (one DEM product per grid, no mixing). A mixed-product ring (20 m where covered, 80 m elsewhere, with a product seam) is possible future work.
* Walk/Rover in sunlight: the near ground is as detailed as the 20 m (or 5 m) DEM; relief smaller than the grid is not shown and is not invented.
* Faint straight streaks near Peak near Shackleton are LOLA ground-track artefacts of LDEM_85S_20M (present in an independent hillshade) and are left as they are.
* The near cascade sharpens shadows only where the full map already allows light; edges of shadows cast by large distant ridges keep the full map's resolution (their real penumbra is tens of metres wide anyway, from the 0.53° Sun disk).
* Earthshine: point source, uniform Lambert sphere, no light reflected by sunlit terrain (which can exceed earthshine next to sunlit slopes).

**Classification of new features**

| Feature | Class |
|---|---|
| Ring A 25 m / ring B 100 m grids | Measured (LOLA heights, bilinear samples; within 0.10 m) |
| Normal maps (lighting detail) | Calculated (from measured LOLA heights) |
| Edge fade of detail (mip bias / smoothed normal) | Calculated (averages of real normals); where to fade is a display choice |
| Near-camera shadow cascade | Approximate (shadow mapping, as before) |
| Earthshine light | Approximate (documented formula, cited albedo, engine geometry) |
| Earthshine exposure | Illustrative (display exposure, stated on screen) |

## Part 2 - Rover modelled on NASA VIPER (Illustrative, clearly labelled) - DONE

**What changed**
* The 3D rover now has VIPER's **published proportions**: 2.5 m overall height (mast and camera head), 1.5 m × 1.5 m footprint, four wheel modules; plus headlights and a drill housing (both published features). Not published on the NASA pages read, therefore drawn as **approximate** proportions and labelled so: wheel size (0.5 m across), body size and ground clearance, mast and camera-head size, solar-panel layout (vertical panels on three sides), drill position. Mass is not stated on those pages and is not shown.
* **Ground contact** (Calculated from DEM heights at the DEM's resolution): each wheel rests on the LOLA surface below it (the drawn mesh, i.e. linear interpolation between DEM nodes; with the 5 m patch where it exists); suspension struts stretch from the body to each wheel hub; the body's pitch and roll follow from the four wheel heights; readout "Body tilt (wheels on LOLA heights)" from true (not exaggerated) heights. With 1.0-1.3 m between the wheels and 20 m (or 5 m) DEM cells, the tilt equals the DEM slope over about one cell (stated).
* **Driving stays Illustrative**: no traction, slip, power, wheel-soil interaction or obstacle physics; speed is for viewing (NASA's published driving rate, about 0.72 km/h, is quoted). The slope warning remains a user-set threshold on the DEM slope only.
* **"About this rover"** (expandable, in the Rover panel): what VIPER is, the sourced facts, the current status with its date, and the required statement "Illustrative model based on NASA VIPER's published dimensions. It is not a mobility simulation: ASTERIA does not predict whether a rover can traverse a slope or surface."
* The AI disclosure "Graphics:" line (round 4B) is unchanged and still accurate: the rover is drawn by code written with Claude Code; no other AI wording was added (UI test).

**VIPER facts used and their sources** (fetched 2026-11-15)

| Fact | Source (verbatim where quoted) | Page date |
|---|---|---|
| 2.5 m tall, 1.5 m long and wide ("Measuring 8 feet (2.5 meters) tall and 5 feet (1.5 meters) in length and width") | https://science.nasa.gov/mission/viper/rover-and-instruments/ | page last updated 21 Sep 2023 |
| Four wheel modules, active suspension, independent steering | same page | 21 Sep 2023 |
| Headlights ("NASA's first rover with headlights"); 1 m TRIDENT drill; NSS, NIRVSS, MSolo | same page | 21 Sep 2023 |
| Driving rate "about 0.45 mph (0.72 kph)" | same page | 21 Sep 2023 |
| Mission: map water ice and other potential resources; 100-day mission; destination Mons Mouton; Blue Moon MK-1 delivery announced 19 Sep 2025 (task order CS-7) | https://science.nasa.gov/mission/viper/ | page last updated 21 Sep 2026 |
| **Current status**: "will embark on a mission to the lunar South Pole region in 2027"; "currently at NASA's Johnson Space Center in Houston where it is fully built and undergoing final testing before traveling to NASA's Kennedy Space Center in Florida for launch to the Moon"; delivery by a Blue Moon Mark 1 lander | https://www.nasa.gov/missions/moon-base/nasa-provides-progress-update-on-moon-base-rovers/ | 20 Oct 2026 (updated 21 Oct 2026) |
| Blue Origin selected to deliver VIPER "in late 2027, using a second Blue Moon MK1 lander" | https://www.nasa.gov/news-release/nasa-selects-blue-origin-to-deliver-viper-rover-to-moons-south-pole/ | 19 Sep 2025 |
| 17 July 2024: NASA's "intent to discontinue development" (cost increases, launch delays, risk of cost growth) | https://www.nasa.gov/news-release/nasa-ends-viper-project-continues-moon-exploration/ | 17 Jul 2024 |
| Not published on these pages: mass, wheel diameter, mast height, solar-panel count/arrangement, battery | - | - |

Note for the owner: the science.nasa.gov VIPER page (updated 21 Sep 2026) still says VIPER "was slated to land" and shows "Occurred 2 years ago", which conflicts with NASA's newer 20 Oct 2026 progress update. The app states the status from the newest NASA page and its date. The page https://www.nasa.gov/mission/viper/ returned HTTP 404.

**Files changed**: `js/view3d.js` (ROVER proportions, model, placeRover, tilt readout, About tab, notes), `css/style.css` (About tab), `tests/ui_round6.js` (new).

**Scientific data used**: LOLA heights already in the view (no new data); NASA VIPER pages above (facts only).

**Existing calculations affected**: none (rover elevation/slope readouts unchanged; the tilt is a new readout).

**Tests**: `node tests/ui_round6.js` (laptop + phone): wheels on the LOLA surface (difference 0), hubs one wheel radius above; tilt vs DEM slope within 2° (9.2° vs 9.6° at Mons Mouton); model 2.5 m tall and 1.5 m × 1.5 m; About text with statement, dimensions, dated status and NASA links; no traversability claims anywhere in the page except the disclaimer; no AI wording in the rover panel; no console errors - ALL PASS. `node tests/ui_check.js` PASS.

**Remaining limitations**: the model is a simplified shape (boxes and cylinders); wheel size, panels and mast are approximate; the tilt shows the DEM-scale slope, not rover-scale roughness; headlights are not light sources.

**Classification**: rover model - Illustrative; wheel contact and body tilt - Calculated (from LOLA heights at the DEM's resolution); driving - Illustrative.

## Part 3 - Exploration and inspection - DONE

**What changed** (3D panel, `js/view3d.js`; 2D map `js/map.js`; hook in `js/app.js`)
* **Camera presets**: Overview (the default oblique Orbit view), Site eye level (Walk at the site marker, eye 2 m above the ground as in the horizon model, facing the Sun's azimuth), Look at Sun, Look at Earth (Walk, view direction = the engine's az/el; elevation limited to ±80°). Directions come from the validated engine values, not from the picture.
* **Pointer inspection**: hovering with a mouse (or tapping / clicking without dragging) shows height (m above the 1737.4 km sphere), slope (central differences over the grid spacing - the same function as the Rover readout), latitude/longitude, distance from the site, and the data resolution and product at that point ("Data here: 25 m LOLA grid (LDEM_85S_20M), ring A (to 16 km), drawn at 50 m"), plus "real slopes over a few metres can be steeper". The point is found by marching the view ray to the drawn surface; the numbers come from the stored LOLA grid at that point (true heights, also with vertical exaggeration).
* **Hazard view** (checkbox + limit): colours slopes above the user's limit (the same setting as the Rover slope warning; changing one changes the other); legend states the grid spacings in view and "Real slopes over a few metres can be steeper. Not a traversability prediction."
* **2D-3D link**: the 3D mini-map now draws the camera position and its horizontal field of view (all modes); **Show on 2D map** closes the 3D view, switches to Explore and centres the 2D south-pole map on the 3D view position (Orbit: view centre; Walk: you; Rover: the rover) with a labelled marker ("Position from the 3D view: lat, lon").
* Fixed: the Rover readout could stay stale after a single move (it was throttled to 150 ms and only ran on frames that redraw); a skipped readout is now retried. Found as an intermittent failure of `tests/ui_round5.js` (1 in 4 runs before; 0 in 3 after).

**Files changed**: `js/view3d.js`, `js/map.js` (showPoint), `js/app.js` (showOn2D hook), `css/style.css`, `tests/ui_round6.js`.

**Scientific data used**: none new (LOLA grids already in the view; engine Sun/Earth directions).

**Existing calculations affected**: none.

**Tests** (`node tests/ui_round6.js`, laptop + phone, ALL PASS): Site eye level = Walk at the marker, eye 2.00 m, Sun azimuth; Look at Sun / Earth: camera direction within 0.05° of the engine's az/el; Overview = Orbit default; inspection at the site marker's pixel reports distance < 1 cell and the LOLA height within 1 m (0.0 m); tooltip contents; hazard uniform = 100 + limit, limit shared with the rover, legend text; mini-map camera heading = HUD heading; Show on 2D map: 3D closed, map centre within 1e-4° of the 3D position, marker and label present; no console errors. `tests/ui_check.js` PASS, `tests/ui_round5.js` ALL PASS (3 runs).

**Remaining limitations**: inspection uses the drawn mesh to find the point under the pointer (at grazing views a point can be a few metres off where the mesh is coarser than the data grid); the 2D marker stays until the next "Show on 2D map"; hover inspection is mouse-only (touch: tap).

**Classification**: presets - Calculated (directions from the validated engine); inspection values - Calculated (from LOLA); hazard view - Calculated (DEM slope vs a user threshold; not a traversability prediction); camera wedge and 2D link - Illustrative (navigation aids).

## Part 4 - Usability and explanation - DONE

**What changed**
* **Getting started** (`js/app.js`, `index.html`): every step now scrolls to and highlights what it describes and offers buttons that do what it mentions. Step 1 (map): "Open a site: Peak near Shackleton", "Show the whole pole". Step 2 (status tiles): "Explain the Sunlight tile" (opens its ? explanation). Step 3 (Go deeper, Sky view): "Play the Sky view", "Turn on Expert view", "Show ? explanations" (turns Explain on and opens the Sky view's explanation), "Start the Tour". Smooth scrolling is skipped with reduced motion.
* **Dynamic scale bar** on the 2D south-pole map (`js/map.js`): updates on zoom and pan; round lengths (1, 2, 5 × 10ⁿ m/km); ground metres per pixel = projected metres per pixel / k with k = 2 / (1 + sin|lat|), the polar stereographic scale factor on the 1737.4 km sphere at the **map centre**; labelled "(scale at map centre)" with a tooltip that the scale varies slightly across the map.
* **Design decisions**: new `DESIGN_DECISIONS.md` and the same 12 entries on the About page (expandable): Astronomy Engine + IAU orientation vs SPICE; 2 m observer; Sun-centre vs disk-fraction; 1° mask and 300 km rays; DEM products; 240 m data and its validation gate; 10/60-minute sampling with 1-minute refinement; test tolerances; power model; 3D levels of detail and normal maps; rover as illustrative; earthshine. Plain language first, then alternatives and validation. (While writing it, one figure was corrected before commit: the angle tolerance is 0.1° elevation / 0.2° azimuth.)
* **Classification**: every item of the 3D "What is accurate, what is approximate" list now starts with a Measured / Calculated / Approximate / Illustrative label (the "Graphics:" disclosure line is unchanged, as required); new item for inspection, hazard view and presets. README and GAPS 3D tables have a Classification column; README's table has new rows for the round-6 features.

**Files changed**: `js/app.js`, `js/map.js`, `js/view3d.js` (notes), `index.html` (hint actions, About "Design decisions"), `css/style.css`, `DESIGN_DECISIONS.md` (new), `README.md`, `GAPS_AND_ISSUES.md` (tables), `tests/ui_round6.js`.

**Scientific data used**: none new.

**Existing calculations affected**: none.

**Tests** (`node tests/ui_round6.js`, laptop + phone, ALL PASS): fresh visitor - step 1/2/3 each highlight their panel and bring it into view; every button does what it says (site opened, ? explanation of the Sunlight tile shown, Sky view playing, Expert view on, Explain on with the Sky view explanation, Tour started); scale bar at zoom 4, 6 and 8 and at 89°S and 85°S: metres per pixel agree with an independent great-circle measurement within 0.2 % (observed < 0.01 %), k equals 2/(1 + sin|lat|), the bar's ground length equals its round label within 0.5 %, label "(scale at map centre)". `node tests/ui_check.js` PASS (AI wording only in the two allowed lines; classification labels added no AI wording), `node tests/features_test.js` PASS.

**Remaining limitations**: the scale bar is exact at the map centre only (stated); Design decisions are text, not interactive.

**Classification**: Getting started and Design decisions - presentation (no physical prediction); scale bar - Calculated.

## Trade-offs for the owner (not implemented; owner to decide)

1. **Medium-quality ring A geometry from the 20 m product.** Drawing ring A at Medium as a 100 m sampling of the 25 m grid (LDEM_85S_20M) instead of the round-4 100 m grid (LDEM_80S_80M) changed 2 of 50 shading-consistency verdicts at Mons Malapert (Medium 99.0 % → 98.5 %; one case where the Sun was 0.15° below the drawn terrain was then drawn lit). Not implemented. Medium gets the 25 m lighting detail through the normal map instead. Option: draw ring A at 50 m on Medium too (as on High), which had no such change at High, at the cost of about 4× more ring vertices on Medium.
2. **Geometry morphing between levels of detail.** Blending vertex heights across ring edges would hide the remaining geometric step, but drawn vertices would no longer be at their DEM heights (the 1 m height test would fail by tens of metres in the blend band). Not implemented; only lighting detail is blended.
3. **Mixed-product rings.** IM-2 and Mons Mouton have 92 % / 87 % of ring A inside LDEM_85S_20M. A ring with 20 m data where covered and 80 m elsewhere would show more detail there but would contain a product seam (heights from two DEMs side by side). Not implemented (one DEM per grid, as since round 3).
4. **Near-camera shadows alone.** Used on their own (instead of min(full, near)), the finer near shadow map would be sharper at shadow edges of distant ridges, but it turned 3 of 264 grazing-Sun cases from shadow to lit at the site marker. Not implemented.

## Part 5 - Quality and hand-over - DONE (no merge, no tag, no push)

**Final test run** (round6 branch, development laptop, headless Chromium with the GPU via ANGLE/D3D11; laptop 1440 × 900 and emulated phone 390 × 844 for the browser suites):

| Suite | Result |
|---|---|
| `node tests/validate.js` | OVERALL: PASS (VALIDATION_REPORT.md regenerated; round-6 lines added) |
| `node tests/illumination.js`, `blind_test.js`, `coarse_validation.js`, `one_year_check.js`, `earth_orientation.js`, `instant_status_check.js` | all PASS, values identical to v1-stable (only timestamps changed in the result files) |
| `node tests/accuracy3d.js` | PASS: 14,499,574 grid points within 0.10 m |
| `node tests/view3d_test.js`, `node tests/features_test.js` | ALL PASS |
| Python DEM checks: `tools/terrain.py check`, `tools/terrain3d.py check` (0.049 m), `tools/terrain3d_ext.py check` (0.099 m) | PASS |
| `node tests/shading_consistency.js` | Low 97.8 %, Medium 99.0 %, High 99.8 % (unchanged); near cascade never lowers agreement |
| `node tests/ui_check.js` (laptop + phone) | UI CHECK PASS, no console errors or warnings |
| `node tests/ui_round5.js` (laptop + phone) | ALL PASS |
| `node tests/ui_round6.js --shots` (laptop + phone) | ALL PASS |
| `node tests/perf3d.js --phone --quality low,medium,high` | completed, no console errors (table below) |

**Performance before/after** (`node tests/perf3d_compare.js tests/perf/round6_baseline.json tests/perf/round6_final.json`; averages over the 8 sites; raw rows in `tests/perf/round6_*.json`):

| Viewport | Quality | Build | Orbit FPS (avg) | Render ms (avg of site medians) | Deploy -> first frame ms | -> final tile (LOD refine) ms | -> full terrain ms | Geometries | Textures | Draw calls | Triangles (avg) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| laptop | low | v1-stable | 60.0 | 1.3 | 253 | 284 | 369 (292-468) | 6-6 | 1-1 | 6-6 | 94,738 |
| laptop | low | round6 | 60.0 | 0.9 | 220 | 227 | 278 (219-421) | 6-6 | 1-1 | 6-6 | 94,738 |
| laptop | medium | v1-stable | 60.0 | 2.1 | 261 | 467 | 510 (427-593) | 6-6 | 1-1 | 6-6 | 365,872 |
| laptop | medium | round6 | 60.0 | 3.5 | 248 | 293 | 433 (299-527) | 6-6 | 4-4 | 6-6 | 365,872 |
| laptop | high | v1-stable | 59.4 | 2.5 | 269 | 305 | 721 (440-932) | 8-10 | 1-1 | 8-10 | 788,892 |
| laptop | high | round6 | 59.8 | 2.9 | 223 | 229 | 561 (435-725) | 8-10 | 5-5 | 8-10 | 1,067,672 |
| phone (emulated) | low | v1-stable | 60.0 | 1.3 | 251 | 273 | 333 (193-450) | 6-6 | 1-1 | 6-6 | 94,738 |
| phone (emulated) | low | round6 | 60.0 | 0.8 | 199 | 207 | 252 (156-350) | 6-6 | 1-1 | 6-6 | 94,738 |
| phone (emulated) | medium | v1-stable | 60.0 | 1.6 | 320 | 450 | 467 (343-588) | 6-6 | 1-1 | 6-6 | 365,872 |
| phone (emulated) | medium | round6 | 60.0 | 2.7 | 263 | 282 | 421 (275-584) | 6-6 | 4-4 | 6-6 | 365,872 |
| phone (emulated) | high | v1-stable | 59.3 | 2.3 | 236 | 297 | 679 (539-932) | 8-10 | 1-1 | 8-10 | 788,892 |
| phone (emulated) | high | round6 | 59.9 | 2.7 | 220 | 232 | 578 (361-734) | 8-10 | 5-5 | 8-10 | 1,067,672 |

Reading the table: the browser caps the frame rate at 60 frames/s, so orbiting stays at 59-60 frames/s at every level before and after; the GPU-synced render time shows the real cost: Medium +1.1-1.4 ms per frame and High +0.4 ms (extra near-shadow and earthshine maps, normal-map sampling); Low slightly faster. Loading got faster at every level (first frame 199-263 ms; full terrain on High 561 ms vs 721 ms on the laptop) although High now loads up to 4.3 MB more ring data at 4 sites, mainly because the full Sun shadow map is no longer re-rendered every frame. Textures: +3 on Medium (near shadow, earthshine shadow, ring A normal map), +4 on High (also ring B normal map); High draws about 35 % more triangles (ring A at 50 m). Exact GPU memory in bytes is not available in browsers; the new normal maps are at most 1281 × 1281 two-component float (about 13 MB with mipmaps, or half that in half-float). No scientific resolution was reduced to reach these numbers. Phones were emulated on the laptop GPU (not a real phone).

**Documents updated**: README.md (3D section, data sources, layout, validation table, rerun commands, snapshot note), GAPS_AND_ISSUES.md (status line, Classification column, section 11 with a classification table), VALIDATION_REPORT.md (regenerated, round-6 lines), TEXT_AUDIT.md (round 6 table), SUBMISSION_LINKS.md (+6 NASA links: Earth Fact Sheet and 5 VIPER pages), AI_DISCLOSURE.md (round 6 note; files only, the in-app disclosure is unchanged), DESIGN_DECISIONS.md (new), `tests/perf3d_compare.js` (new).

**Existing calculations affected**: none.

**Classification**: no new feature in this part.

## Incomplete or unverified requirements

* **Walk/Rover readability in sunlight**: no measurable gain at the two test sites (their 5 m / 20 m ground is smooth in the data); the gain is in Orbit (ring A detail) and in shadow (earthshine, when Earth is up). Nothing below the DEM resolution is shown or invented.
* **Earthshine** is checked only against its formula (unit test) and the engine geometry, not against measured earthshine brightness on the lunar surface; uncertainty about a factor of 2 (stated). Light reflected from sunlit terrain is not modelled.
* **Finer data for IM-2, Mons Mouton, Nobile Rim 2, IM-1**: ring A not fully covered by LDEM_85S_20M, so no 25 m ring there (trade-off 3); their ring B uses the 100 m grid where LDEM_80S_80M covers it (IM-2, Mons Mouton, DM2).
* **Square steps**: lighting steps removed (fade); small geometric steps can remain at ring edges (trade-off 2).
* **VIPER**: mass, wheel size, mast height and solar-panel layout are not published on the NASA pages read; drawn as labelled approximations. NASA's VIPER mission page and its newer progress update disagree on the status; the app quotes the newer one with its date.
* **Devices**: all measurements in headless Chromium on the development laptop; phones emulated (screen size and touch on the laptop GPU). Not tested on a real phone, in Firefox or Safari; two-finger gestures not automated (as before). Frame rate is capped at 60 frames/s by the browser, so the render-time column is the better before/after comparison. Exact GPU memory in bytes is not available in browsers.
* **Hover inspection** works with a mouse; on touch screens it is tap-to-inspect.
* Low quality is unchanged (no normal maps, no near cascade, no earthshine shadows) to keep phones fast.

## Manual checks for the owner

Open `index.html` from the `round6` branch (`git switch round6`, then double-click `index.html`). On the laptop:
1. **First visit**: in a private window, wait for "Getting started". Step 1 should scroll to the map; press "Open a site: Peak near Shackleton". Next: the status tiles are highlighted; press "Explain the Sunlight tile" - an explanation opens. Next: the Sky view is highlighted; try the four buttons (Play, Expert view, ? explanations, Tour).
2. **2D scale bar**: zoom and pan the map; the bar at the bottom right changes and reads e.g. "2 km (scale at map centre)".
3. **3D detail**: select Peak near Shackleton, press "» Deploy", choose Quality "High". Look at the ground around the bright 6 km square: the old sharp square edge should be gone and the surrounding terrain shows craters. Open "What is accurate, what is approximate": each item starts with a coloured Measured / Calculated / Approximate / Illustrative label, and "Resolution by area" lists geometry and lighting detail per area.
4. **Earthshine**: set the date to 2027-03-13 10:00 UTC at Mons Mouton (or use "Jump" until Sun is down and Earth is in view), open 3D, tick "Earthshine". The ground facing Earth becomes grey with relief; the note states the strength (about 1/13,000 of sunlight) and the raised exposure. Untick: back to the dark picture.
5. **Rover**: switch to Rover and drive with W/arrow keys over a slope; the wheels stay on the ground and "Body tilt" changes. Open "About this rover": check the statement, the facts and the status date (20 October 2026) and click a NASA link.
6. **Inspection and hazard view**: move the mouse over the terrain - a box shows height, slope, position, distance and data resolution. Tick "hazard view" and change the limit (e.g. 10°): steep slopes turn pink; the rover's slope warning uses the same number.
7. **Presets and 2D link**: press "Look at Sun", "Look at Earth", "Site eye level (2 m)", "Overview". Press "Show on 2D map": the 3D view closes and the 2D map centres on a pink ring labelled "Position from the 3D view".
8. **About page**: open "Design decisions" and read two or three entries.

On a phone (or the browser's device emulation):
9. Repeat steps 1, 3 (Quality stays Low or Medium), 5 and 7. Tap the terrain to inspect a point. Check that the panel scrolls, the buttons are reachable and nothing overlaps badly.
10. Compare with `v1-stable` if anything looks worse: `git switch --detach v1-stable` (look only), then `git switch round6` to come back.

## Round 6B: owner-provided suggestions

Decisions taken by the owner's lead engineer before round 6B (recorded here; the deferred and rejected items are **not** implemented). Context: submission day, stability first; priorities accuracy, physical realism, functional completeness, visual quality, presentation.

| Suggestion | Decision | Reason |
|---|---|---|
| Guided mission scenarios | Defer | The Tour and Getting started already guide a first visit; new scenarios need careful scripting and testing. |
| Mission-change simulator | Already exists | Launch slip page. |
| Visual explanation mode | Already exists | Explain, ? buttons, Sky view captions, Getting started. |
| NASA candidate region explorer | Reject (accuracy) | 6 of the 9 regions are published only as images, without coordinates; plotting them would require guessing. |
| Unified trade-off explorer | Improve existing Compare | Round 6B Part 7: energy, battery and DEM slope rows in Compare. |
| Confidence panel | Already exists | "Verified against NASA data" card; Measured / Calculated / Approximate / Illustrative labels. |
| Site discovery | Defer | Needs sunlight/Earth computations for thousands of points; only the coarse 240 m terrain is fast enough, and it can differ by up to about 16 percentage points at single locations - not defensible for ranking. |
| Safety screening | Already exists | Slope hazard view and rover slope warning; surface roughness would need new data. |
| Timeline integration | Already exists | Explore timeline, Sky view and 3D share one time cursor. |
| Validation and reproducibility | Implement | CSV export of the windows and the time series (Part 6). |
| Detailed VIPER rover model | Implement | Part 5. |
| Stars on by default | Implement | Part 5. |

## Round 6B Part 1 - Fast terrain inspection - DONE

**Measured before** (`node tests/inspect_perf.js --save tests/perf/inspect_before.json`; High, Peak near Shackleton, 2028-09-25 10:04 UTC, laptop 1440 × 900, headless Chromium; one update = hit point + LOLA values + readout): Orbit default view, 54 check pixels × 5: median **0.70 ms**, 95th percentile 1.9 ms, max 4.9 ms; Walk (Site eye level), 27 × 5: median 0.30 ms, p95 1.2 ms. Diagnosis: the existing inspection was already a ray march on the drawn LOLA height grids (not a mesh raycast); what made the readout feel laggy was that it followed the cursor through a 90 ms throttle (the box trailed the pointer by up to 90 ms and jumped), and each ray was evaluated from the camera all the way out, including the kilometres of empty space above the terrain.

**What changed** (`js/view3d.js`, `css/style.css`)
* **Click / tap to inspect is now the default**: the readout and a small pink marker stay pinned until the next click or Esc (Esc first clears the readout; a second Esc closes the 3D view, as before). The marker and readout follow the inspected ground point when the camera moves.
* **"Inspect on hover"** toggle (off by default; kept while the page is open): with a mouse, the readout follows the pointer live. The pointer position is only stored by the event; the readout is computed in the animation loop, **at most once per frame and only when the pointer moved** (no throttle).
* **Faster march, same result**: the same sample sequence along the ray (0.5 m, then steps of max(0.5 m, 0.5 % of the distance)), but samples above the highest drawn terrain or outside the outermost drawn grid are not evaluated, and the march stops once the ray rises above the terrain or moves away outside it; plus an exact quick rejection before the per-grid inverse projection (a point with 0.98 × max(|x|, |z|) > half-size cannot be inside that grid). The first bracket and its 30-step bisection are those of the full march, so the hit point is bit-identical. The heights, slopes and lat/lon still come from the finest stored LOLA grid at the point (unchanged code).

**Tests**
* `node tests/inspect_perf.js --compare tests/perf/inspect_before.json`: **81/81 readouts identical** (54 Orbit + 27 Walk check positions; height, slope, lat/lon, distance, data resolution; largest numeric difference 0). Latency per update: Orbit median **0.70 → 0.10 ms**, p95 1.9 → 0.6 ms; Walk median 0.30 → 0.10 ms, p95 1.2 → 0.3 ms (browser timer resolution 0.1 ms). The single slowest update stays about 5 ms (the first call, before the JavaScript engine has optimised the code); target < 4 ms is met at median and 95th percentile.
* `node tests/ui_round6b.js` (laptop + phone): hover off by default; mouse movement shows nothing; click / tap at the site marker pins readout and marker (distance 0 m); the pinned readout stays when the mouse moves; after the camera turns the marker stays on the ground point (< 2 px); Esc clears and the view stays open; with hover on the readout follows the mouse; a second tap moves the readout; no console errors - ALL PASS. `ui_round6.js`, `ui_check.js`, `ui_round5.js`: PASS.

**Classification**: inspection values - Calculated (LOLA), unchanged. **Limitations**: hover needs a mouse; touch screens use tap (as before).

## Branch state

* Branch `round6` contains the commits of Parts 0-5 on top of `v1-stable`. `master` (the main branch) and the tag `v1-stable` still point to c4c723f. No merge, no `v2-candidate` tag, no push (no remote is configured).
