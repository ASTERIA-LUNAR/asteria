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

## Round 6B Part 2 - Shadows off by default - DONE

**What changed** (`js/view3d.js`)
* In Orbit, Walk and Rover the cast shadows are **off by default**; the toggle is now "**Shadows (approximate)**". The choice is remembered for this session only (while the page stays open; not stored on the device).
* Off: the picture's shadow label reads "Shadows off: the terrain is lit from the Sun's real direction without cast shadows. Sunlit/shadowed status at the site comes from the validated horizon model (tiles above)." On: the existing label ("Shadows from terrain within 16/40 km (visual approximation) …").
* Off also means the shadow maps are not rendered at all (fewer GPU passes); the lights, their order and their directions are unchanged. Turning shadows on re-renders every shadow map once.
* Wording kept truthful with shadows off: the "Sun hidden behind terrain" banner says the ground is drawn lit from the Sun's direction (instead of "may still look lit"); the "ground looks almost black" tip says so only when it is true (shadows on, or the Sun below the horizon); otherwise it says the ground is drawn lit, without "Light up", and still offers "Jump to next sunlight". Earthshine only matters where sunlight is blocked, so switching Earthshine on also switches shadows on (otherwise its raised exposure would wash sunlit ground out).
* `tests/shading_consistency.js` turns shadows on explicitly (and stops if it cannot). `tests/ui_check.js` accepts the "Shadows off" label as the default shadow label.

**Tests**: `node tests/ui_round6b.js` (laptop + phone) - off by default with the new name and note, maps not rendered; on shows the existing label and renders the maps; status tiles, Sun/Earth readouts, positions, labels and an inspection readout identical with shadows on and off; banner wording; remembered for the session and not in localStorage; Earthshine turns shadows on - ALL PASS. `node tests/shading_consistency.js` (shadows on): **Low 97.8 %, Medium 99.0 %, High 99.8 %** - unchanged; 0 unexplained; near cascade 261/264 vs 260/264 (Medium) and 263/264 vs 263/264 (High). `ui_check.js`, `ui_round5.js`, `ui_round6.js`: PASS.

**Classification**: shadows - Approximate (unchanged); the default only changes what is drawn. **Limitations**: with shadows off, ground the validated model says is in shadow is drawn lit; the status tiles, banner and label say so.

## Round 6B Part 3 - Relief shading defaults and the visible square - DONE

**Defaults**: Relief shading is off by default in Orbit and on in Walk and Rover. A change the user makes is kept for the mode it was made in (this session only); switching mode re-applies the other mode's default unless the user changed it there. (Before, one choice applied to all modes.)

**The visible square - cause** (measured, `tests/tile_edge.js`; Peak near Shackleton, Orbit at 60 km, pitch 40°, relief on, laptop): the relief term adds the difference between the DEM normal and a smoothed DEM normal, divided by sin(Sun elevation) (×10 at a low Sun). Inside the 6 km tile that difference comes from per-vertex 20 m normals, i.e. relief smaller than a pixel at this distance (about 40-70 m per pixel): it turns into grain, and because the term is clipped at zero, the grain also raises the mean brightness. The rings outside get their lighting detail from normal maps whose mipmaps average the real normals at distance, so they look smoother. Result: a brighter, grainier square.

**Fix** (display only, `js/view3d.js`): per layer, the relief contrast is scaled by K × (the layer's grid spacing) / (ground size of one pixel), at most 1 (K = 2: relief smaller than about half a pixel fades out). With relief on, a layer without a normal map (5 m patch, tile, rings on Low) also blends its per-vertex DEM normal toward its smoothed DEM normal (the average of real normals over ±4 cells) by the same factor: the counterpart of the normal maps' mipmaps. Near the camera (Walk / Rover foreground) the factor is 1 and nothing changes. Heights, normals in the data, slopes, shadows, the Sun direction and every readout are unchanged.

**Numbers** (mean over 2,548 ground points in bands 150-600 m inside vs outside the tile edge; luminance 0-255; detail = mean absolute difference of neighbouring pixels):

| Quality | | Luminance inside / outside | Difference | Detail inside / outside | Difference |
|---|---|---|---|---|---|
| High | before | 67.6 / 45.2 | **+49.4 %** | 46.3 / 23.8 | **+94.2 %** |
| High | after | 44.2 / 43.8 | **+1.0 %** | 12.0 / 10.6 | **+13.5 %** |
| Medium | before | 67.5 / 52.7 | +27.9 % | 45.9 / 25.3 | +81.3 % |
| Medium | after | 44.2 / 46.4 | −4.8 % | 12.0 / 12.5 | −4.2 % |

K = 1 matched the edge even more closely on High (+0.2 % / −0.1 %) but flattened the relief everywhere and gave −18.6 % detail on Medium; K = 4 left +18.5 % / +62.6 %. Screenshots: `docs/tile_edge/before_*.png`, `docs/tile_edge/after_*.png`; raw numbers `tests/perf/tile_edge_before.json`, `tile_edge_after.json`.

**Tests**: `node tests/ui_round6b.js` (laptop + phone): defaults Orbit off / Walk on / Rover on; a change in Walk kept for Walk while Orbit and Rover keep their defaults; inspection readout, Sun direction and status identical with relief on and off - ALL PASS. `ui_check.js` (relief note unchanged), `ui_round5.js` (relief is display only), `ui_round6.js`: PASS.

**Limitations**: the remaining tile-edge contrast is the real difference in data (20 m tile vs 25-100 m rings) plus the geometric step of the mesh (no morphing, see trade-off 2). At grazing angles the pixel footprint is estimated from screen-space derivatives and is direction-dependent (the larger of the two directions is used).

**Classification**: Relief shading - Illustrative (display contrast), unchanged.

## Round 6B Part 4 - Larger 5 m patch - NOT ATTEMPTED (recorded)

**Why**: the LDEM_875S_5M data on disk are row windows fetched in round 4 (`dem/dl5m/<site>_rows.bin`, rows 19039-19609 and 16163-16733, i.e. 570 rows = 2.85 km north-south around each of the 3 sites). A 4 km patch needs about ±2.1 km of rows, so new rows (about 30 MB per site, roughly 100 MB from PDS) would have to be downloaded, the patches rebuilt, and the 1 m height check, the seam test, `tests/accuracy3d.js` (Python path) and the performance gate (first frame < 1.5 s, full terrain < 2 s, 60 frames/s on High) re-run. On submission day, with stability first, this optional part was left for later so that Parts 5-8 could be completed and tested. Nothing was changed; the 2 km patch stays as validated.

**To do it later**: extend the row window in `tools/fetch_round4.py` (rows ±440 around the site row), set `HALF_5M = 2000.0` in `tools/terrain3d_ext.py`, run `python tools/terrain3d_ext.py build` and `check`, `node tests/accuracy3d.js --python`, `node tests/view3d_test.js`, `node tests/perf3d.js --quality high`, and keep it only if the gate above is met.

## Round 6B Part 5 - Rover model detail and stars - DONE

**Rover model** (`js/view3d.js` `buildRover`; Illustrative)
* Multi-section chassis: lower avionics bay, upper body with a structural frame (corner posts, top and bottom edge rails), gold thermal blanket on the deck, a finned radiator plate, front and rear bumpers.
* Solar panels: vertical panels on the left, right and rear sides, each with a frame, a cell grid and mounting brackets.
* Mast at the front right: turret, tube, tilt joint and camera head with four camera housings (two stereo pairs) with lenses, and a light bar under the head; headlights in two housings on the body front (VIPER's headlights are published; their positions here are approximate).
* Four wheel modules: each wheel has an open tyre band with 18 tread blocks (outer edge at the 0.25 m wheel radius, so the wheel contact is unchanged), rim lips, wheel discs, hub and six spokes; a fork on the inner side, a steering housing above the wheel, and a suspension arm from the body to the housing whose length and angle follow the ground under each wheel (updated every frame). The wheels turn with the distance driven (display only).
* Instrument housings (approximate positions): TRIDENT drill (1 m rod, bit and motor housing in a frame at the front left), NIRVSS under the front, NSS under the rear, MSolo on the deck.
* Simple flat-coloured materials; no images, textures, logos, markings or NASA branding.
* Unchanged: the published envelope (top of the camera head exactly 2.5 m above the wheels' ground plane; wheel footprint 1.5 m × 1.5 m; nothing in the body extends beyond it), the wheel contact on the LOLA surface, the hub heights and the body pitch/roll calculation (`placeRover`). No mobility physics.
* Triangles: **4,996** (full detail, laptops at Medium/High) and **2,644** (phones and Low: fewer segments, 8 tread blocks, no spokes, cell grid or radiator fins). For scale, High draws about 1.07 million terrain triangles.
* "About this rover" and the 3D notes list the new approximate parts (wheel size and tread, body sections, radiator, mast, camera housings and lights, panel layout, wheel-module housings and arms, drill and instrument positions) and state that they follow the general appearance of NASA's published pictures, not measured drawings.

**Visual references (NASA)**: pages read on 2026-11-15 - https://science.nasa.gov/mission/viper/rover-and-instruments/ (dimensions, four wheel modules with active suspension and independent steering, headlights, 1 m TRIDENT drill, NSS, NIRVSS, MSolo, camera system), https://science.nasa.gov/mission/viper/ (overview illustration, alt text: "Four wheels are underneath the rover", "Mounted on top of the rover are a couple of additional small structures as well as lights", "the central structure is box-like"), https://science.nasa.gov/gallery/viper/ (pages 1-3; photo titles such as "Viper Egress Test", "VIPER Mobility Platform Testing"; image-detail pages amf-grc-2021-c-00450, amf-grc-2022-c-05389, amf-grc-2021-c-00761 have no captions), https://www.nasa.gov/missions/viper/watch-nasa-build-its-first-robotic-moon-rover/ (assembly article). **Honest limitation**: none of these pages describes the solar-panel arrangement, mast position, light positions, wheel diameter or tread in words, and the images themselves could not be measured in this session; the vertical panels on the sides and back follow the owner's description of NASA's imagery, and all of these are labelled approximate in the app. No new fact is stated as published: the only new NASA number found (mass "approximately 1,000-pound", watch-NASA-build article) is not shown, as before. https://www.nasa.gov/image-article/nasas-viper-rover-gets-its-wheels/ returned HTTP 404. "About this rover" sources are unchanged (no new fact from the new pages is used).

**Stars on by default** (Yale Bright Star Catalogue, as since round 4; Calculated): the "stars" checkbox is on when the 3D view opens and the catalogue loads with it; the camera note is shown. Stars are background points: they cast and receive no shadows and are not part of the inspection ray march (which uses only the terrain grids).

**Tests**: `node tests/ui_round6b.js` (laptop + phone): triangle budgets (full < 8,000; low < 3,000); each suspension arm ends exactly at its housing (< 1e-6 m) and the wheels turn with distance; stars on by default (904 stars at Medium); with stars on vs off, the inspection hit and readout, status tiles, Sun/Earth directions, rover readout and the rendered shadow verdict at the site marker are identical; no star object casts or receives shadows - ALL PASS. `node tests/ui_round6.js`: wheels on the LOLA surface (difference 0) with hubs one radius above, tilt vs DEM slope, model 2.5 m × 1.5 m × 1.5 m, About text - ALL PASS. `ui_check.js` (now ensures stars are on instead of toggling them), `ui_round5.js`, `view3d_test.js`, `features_test.js`: PASS.

**Classification**: rover model - Illustrative; wheel contact and body tilt - Calculated (unchanged); stars - Calculated (unchanged), on by default.

## Round 6B Part 6 - CSV export (reproducibility) - DONE

**What changed** (`js/app.js`, `index.html`, `css/style.css`, new `tools/stamp_version.js`, `data/version.js`)
* A small **"Download CSV"** link in the heading of each existing Explore panel, **Earth link windows** and **Sunlight windows** (no new panel). Each file is for the current site and window:
  * **Header block** (`#` lines): site name, latitude, longitude (east), source (the site's published source URLs, or "custom point chosen on the map"), horizon model (LOLA terrain mask with its method, 240 m data for clicked points, or smooth 0°), period start/end (UTC), sampling step (and "rise/set times refined to 1 min"), minimum link elevation, **app version** ("ASTERIA round6 @ git <commit> (<date>)"), generation time (UTC), and "Computed by ASTERIA; validated against NASA/JPL Horizons - see VALIDATION_REPORT.md".
  * **(a) Windows table** of that panel: start UTC, end UTC, duration (h), max elevation (deg), max above the terrain (deg), and whether the window starts before / ends after the period.
  * **(b) Time series**, every computed sample: UTC, Sun azimuth and elevation, visible fraction of the Sun's disk, Sun up (0/1), Earth azimuth and elevation, Earth visible (0/1, including the minimum link elevation), terrain horizon at the Sun's and at Earth's azimuth.
* Numbers are written at full precision (`String(x)`), so they are exactly the app's values. The file is built in the page and saved through a Blob link, so it works when the app is opened from `file://`. File name e.g. `asteria_peak_shackleton_sunlight_20270110T0000Z_30d.csv`.
* **App version**: a page opened from `file://` cannot ask git, so `node tools/stamp_version.js` writes the current commit into `data/version.js`. The stamp names the commit that was HEAD when it ran, i.e. the parent of the commit that contains the stamp (stated in the tool); it is re-stamped at hand-over (Part 8).

**Tests** (`node tests/ui_round6b.js`, laptop + phone, Peak near Shackleton, 2027-01-10 + 30 days, minimum link elevation 2°): header contains every field above; the windows table equals `AsteriaApp.windows()` exactly (start, end, duration, max elevation, flags) and all 4,321 series rows equal the app's series exactly, including the terrain horizon (`LunaEngine.maskAt` on the site's mask) - for both files; on the laptop the panel link triggers a real download whose content equals the generated text - ALL PASS. `ui_check.js`, `ui_round5.js`, `features_test.js`: PASS.

**Classification**: export of Calculated values (no new computation). **Limitations**: the windows table lists rise/set times refined to 1 minute; the series is at the sampling step (10 or 60 minutes), as in the app.

## Round 6B Part 7 - Compare as a trade-off table - DONE

**What changed** (`js/app.js`; no new screen): a "Power and terrain" section at the end of the existing Compare table, for every scenario column:
* **Solar energy in the window (estimate)** - the Power page's model with its current settings (panel area, efficiency, orientation, load, usable battery), applied to the scenario's series. The section heading states "first-order estimate, example values" and the settings used. Best = most energy (highlighted).
* **Battery for the longest darkness (estimate)** - load × longest darkness ÷ usable fraction, as on the Power page. Best = smallest (highlighted).
* **DEM slope at the site point** - central differences over one grid spacing of the site's best LOLA data (5 m patch for the 3 sites that have one, otherwise the 20 m or 80 m tile), the same function and grids as the 3D rover and inspection readouts; the grid is shown next to the value. "-" for points without a 3D terrain tile (custom points). Not ranked (no best highlight), with "Real slopes over a few metres can be steeper".
* To guarantee identical numbers, the Power page's arithmetic was moved unchanged into shared helpers (`powerInputs`, `powerOf`) used by both pages; best-value highlighting now ignores "-" cells. If the Power page inputs are invalid, the section says so and shows "-".

**Tests** (`node tests/ui_round6b.js`, laptop + phone; Compare with Peak near Shackleton (now and +7 days), Mons Mouton and a custom point, 30 days): the three rows are present with the label and settings, best energy/battery highlighted, slope "-" for the custom point and never highlighted; scenario 1 energy and battery **exactly equal** the Power page's for the same site, start and window (160.168 kWh and 42.563 kWh with the default example values); the slope **exactly equals** the 3D rover readout at the site point (Peak near Shackleton 2.86° on the 5 m grid, Mons Mouton 10.42° on the 20 m grid) - ALL PASS. `ui_check.js` (Compare and Power checks), `features_test.js` (power model), `ui_round5.js`: PASS.

**Classification**: energy and battery - Approximate (first-order model, example inputs); slope - Calculated (LOLA). **Limitations**: the slope is over 5-80 m, not rover scale; Compare loads a site's 3D tile (and 5 m patch) script the first time its slope is needed.

## Round 6B Part 8 - Tests and hand-over - DONE (no merge, no push)

**Final test run** (round6 branch at Part 7 + documents; development laptop, headless Chromium with the GPU via ANGLE/D3D11; laptop 1440 × 900 and emulated phone 390 × 844 for the browser suites):

| Suite | Result |
|---|---|
| `node tests/validate.js` | OVERALL: PASS (VALIDATION_REPORT.md regenerated: timestamp only) |
| `node tests/illumination.js`, `blind_test.js`, `coarse_validation.js`, `one_year_check.js`, `earth_orientation.js`, `instant_status_check.js` | all PASS; result files differ from round 6 only in timestamps and run times (checked field by field) |
| `node tests/accuracy3d.js` | PASS: 14,499,574 grid points within 0.100 m (mean 0.031 m) |
| `node tests/view3d_test.js`, `node tests/features_test.js` | ALL PASS (features: 27 NASA + 21 other links, each cited in the project) |
| Python DEM checks: `tools/terrain.py check`, `tools/terrain3d.py check` (0.049 m), `tools/terrain3d_ext.py check` (0.099 m) | PASS |
| `node tests/shading_consistency.js` (shadows turned on explicitly) | **Low 97.8 %, Medium 99.0 %, High 99.8 %** (unchanged); 0 unexplained; near cascade 261/264 vs 260/264 (Medium), 263/264 vs 263/264 (High) |
| `node tests/inspect_perf.js --compare tests/perf/inspect_before.json` | 81/81 readouts identical; Orbit median 0.70 → 0.10 ms (p95 1.9 → 0.4 ms) |
| `node tests/tile_edge.js` | High: luminance +1.0 %, detail +13.5 % (before +49.4 % / +94.2 %); Medium −4.8 % / −4.2 % (before +27.9 % / +81.3 %) |
| `node tests/ui_check.js` (laptop + phone) | UI CHECK PASS, no console errors or warnings |
| `node tests/ui_round5.js`, `node tests/ui_round6.js --shots` (laptop + phone) | ALL PASS |
| `node tests/ui_round6b.js --shots` (laptop + phone; 54 checks) | ALL PASS, no console errors or warnings |

**Test files changed for the new defaults (with reason)**: `tests/shading_consistency.js` turns shadows on (they are off by default now); `tests/ui_check.js` accepts the "Shadows off" label as the default shadow label and makes sure stars are on instead of toggling them (they are on by default now). New: `tests/inspect_perf.js`, `tests/tile_edge.js`, `tests/ui_round6b.js`, `tools/stamp_version.js`.

**Documents updated**: README.md (Round 6B features, test table row, VIPER visual references), GAPS_AND_ISSUES.md (round 6B table in section 11), TEXT_AUDIT.md (round 6B wording table), DESIGN_DECISIONS.md and the About page (new entry 13: 3D display defaults), SUBMISSION_LINKS.md (+2 NASA pages used as visual references: 27 NASA links), ROUND6_REPORT.md (this section and Parts 0-7), VALIDATION_REPORT.md (regenerated). The in-app AI disclosure is unchanged (UI wording test passes). `data/version.js` stamped "ASTERIA round6 @ git 8237241" (Part 7 commit; the hand-over commit adds only documents, test results and this stamp).

**Performance**: not re-measured with `tests/perf3d.js` in round 6B (time). Expected effect, not measured: shadows off by default removes the shadow passes (faster); the rover model adds about 5,000 triangles in Rover mode only; stars add up to about 1,600 points; the relief normalisation adds a few shader instructions per pixel. Orbiting stayed smooth in all browser tests.

## Round 6B - incomplete or unverified

* **Part 4 (larger 5 m patch)**: not attempted (new DEM rows needed; see Part 4).
* **Rover appearance**: NASA's text pages do not describe the panel layout, mast and light positions, wheel size or tread; the images themselves could not be measured here. These parts are drawn as labelled approximations; the published envelope and the wheel contact are tested.
* **Performance after 6B**: not re-measured (see above). Real phones, Firefox and Safari: not tested (phones emulated).
* **Inspection latency**: measured in headless Chromium; the single slowest update (the first, before the code is optimised by the browser) is about 5 ms.

## Round 6B - manual checks for the owner

1. Explore: in "Sunlight windows" and "Earth link windows" press **Download CSV**; open the file in a spreadsheet: header lines, the windows table, then one row per sample.
2. Deploy 3D at Peak near Shackleton: the picture label says "Shadows off: …"; tick **Shadows (approximate)** - the usual shadow label returns, the status tiles do not change. Stars are visible in the sky.
3. Click the terrain: a pink ring and a readout appear and stay; drag to rotate - they stay on the point; press Esc - they disappear (a second Esc closes 3D). Tick **Inspect on hover** and move the mouse.
4. Tick **Relief shading** in Orbit and zoom out (mouse wheel) to the farthest view: the 6 km square should no longer stand out (compare `docs/tile_edge/before_high_orbit60km_relief.png` and `after_high_orbit60km_relief.png`). Switch to Walk: relief is on; switch back to Orbit: off.
5. Rover mode: look at the rover (drag to look around): panels with frames, mast with cameras and lights, wheels with tread and suspension arms; drive (W) - the wheels turn and stay on the ground. Open "About this rover".
6. Compare page: press Compute; the new "Power and terrain" rows appear at the bottom; change the panel area on the Power page and compute Compare again - the energy changes.

## Branch state

* Branch `round6` contains the commits of round 6 Parts 0-5, round 6B Parts 0-8 and round 6C Parts 1-3 (section "Round 6C" below) on top of `v1-stable`. `master` (the main branch) and the tag `v1-stable` still point to c4c723f. No merge, no `v2-candidate` tag, no push (no remote is configured).

## Round 6C - Ground-level terrain appearance (Walk and Rover)

Owner's observation: in Orbit the terrain looks realistic with rich surface variation; in Walk and Rover the same terrain looks like broad grey gradients with small light/shadow patches. Scope: colouring and shading only. Terrain geometry, heights, slopes, readouts, status tiles, horizons, `js/engine.js` and all validated results stay unchanged (Part 3 proves it). Defaults from 6B stay: shadows off, relief off in Orbit and on in Walk/Rover, stars on.

### Part 1 - Investigation - DONE

**Method** (`tests/ground_detail_6c.js`; headless Chromium, laptop 1440 × 900, GPU via ANGLE/D3D11, shadows off as by default, overlays hidden). Same place, time and lighting in every view:
* **Peak near Shackleton** (best-lit point, -88.79°, 124.5°E), **2028-09-25 10:04 UTC**: Sun 2.57° up at azimuth 334.7°. Data: 5 m patch (LDEM_875S_5M), 20 m tile, 25 m ring A.
* **Mons Malapert** (landform centre, -85.98°, -1.67°E), **2028-09-28 03:00 UTC**: Sun 3.03° up at azimuth 68.0°, terrain horizon -1.21° (validated mask), so sunlit. Data: 20 m tile, 25 m ring A, no 5 m patch.
* Views: **Orbit 60 km** (pitch 40°, camera azimuth = Sun azimuth + 145°, the side-lit default framing), **Orbit 3 km** (pitch 25°, same azimuth), **Walk** (eye 2 m at the site marker, looking across the Sun direction: Sun azimuth + 90°, 2° down), **Rover** (default: 25 m from the site, heading Sun azimuth + 90°, camera behind). Medium and High.
* Metrics (as `tests/ground_detail.js`): ground band (lower 58-96 % of the picture) luminance mean and standard deviation (0-255), **detail** = mean absolute difference between neighbouring pixels, **blk16** = standard deviation / mean of 16 × 16-pixel block means (variation between neighbouring areas), **fgRel** = standard deviation / mean in the nearest third. Diagnostic variants of the same picture: relief off, plain Lambert. **Screen pixels per DEM cell** from the inspection ray march (ground distance between neighbouring pixels at 60 / 75 / 90 % of the picture height, centre column).
* Screenshots: `docs/ground_detail/round6c/before_<site>_<view>_<quality>[_<variant>].jpg`; numbers: `docs/ground_detail/round6c/measurements_before.json`.

**Measurements before round 6C** (Medium; High is identical in Walk and Rover because laptops already use the full tile and the 5 m patch there):

| Site | View | mean | std | detail | blk16 | relief off: mean / detail | Lambert: mean / detail | screen px per DEM cell (60 / 75 / 90 % height) |
|---|---|---|---|---|---|---|---|---|
| Peak near Shackleton | Orbit 60 km | 11.0 | 12.6 | 1.48 | 1.02 | (relief off by default) | 10.6 / 1.32 | 0.3 / 0.4 (25 m ring A) |
| Peak near Shackleton | Orbit 3 km | 17.0 | 13.7 | 1.29 | 0.75 | (off by default) | 13.7 / 0.85 | 3.7 / 6.9 / 9.2 (20 m tile) |
| Peak near Shackleton | Walk | **182.6** | 54.6 | 1.40 | 0.29 | **94.6** / 0.89 | 35.4 / 0.16 | 22 / 140 / 345 (5 m patch) |
| Peak near Shackleton | Rover | 45.7 | 33.6 | 0.27 | 0.73 | 31.3 / 0.10 | 20.0 / 0.04 | 109 / 217 / 374 (5 m) |
| Mons Malapert | Orbit 60 km | 9.4 | 10.4 | 0.75 | 1.00 | (off by default) | 9.3 / 0.65 | 0.4 / 0.4 / 0.3 |
| Mons Malapert | Orbit 3 km | 10.3 | 8.1 | 0.56 | 0.69 | (off by default) | 9.6 / 0.37 | 4.8 / 7.5 / 9.4 (20 m) |
| Mons Malapert | Walk | 91.2 | 23.6 | 0.16 | 0.26 | 98.0 / 0.17 | 56.7 / 0.02 | 684 / 1,647 / 3,028 (20 m) |
| Mons Malapert | Rover | **7.9** | **0.2** | **0.00** | 0.01 | **37.3** / 0.07 | 27.7 / 0.02 | 695 / 960 / 1,430 (20 m) |

High, Orbit 60 km: Peak near Shackleton detail 3.28, Mons Malapert 2.12 (ring A drawn at 50 m, ring B with its 100 m normal map; up to 2 px per 100 m cell at the far edge). The Mons Malapert Rover picture with relief on (the default) is **black** (`before_mons_malapert_rover_medium.jpg`); with relief off the same ground is mid-grey (`..._relief_off.jpg`). The Peak near Shackleton Walk picture with relief on has a large clipped white area (`before_peak_shackleton_walk_medium.jpg`).

**(1) Do Orbit and ground modes use different materials, shaders, normal maps, texture resolutions or pipelines?** Partly.
* Same in every mode: one renderer and one pipeline; the same terrain materials (Three.js Lambert material patched for Lommel-Seeliger); linear tone mapping with exposure 1 and fill light 0.05 in every view measured (recorded per picture in the JSON); no per-mode exposure. Output is written without an sRGB transfer curve in every mode.
* Different by mode: **relief shading** (display option, default on in Walk/Rover, off in Orbit). This is the main measured difference. Its old form kept 70 % of the Lommel-Seeliger value and **added** a term proportional to (cos i(DEM normal) − cos i(smoothed normal)) / sin(Sun elevation), clipped at 0. At a Sun 2.6-3° high the divisor is 0.06 (gain ≈ 10), so a few degrees of difference between the 20 m normal and the ±80 m smoothed normal drives whole slopes to **black** (Mons Malapert Rover: mean 7.9, std 0.2) or to **clipped white** and doubles the mean (Peak near Shackleton Walk: 182.6 vs 94.6 without relief). Those are the "small light/shadow patches" on "broad grey gradients".
* Different by layer (and so by what each mode shows): the rings (Orbit's main content) were lit **per pixel from normal maps** (25 m ring A, 100 m ring B, with averaged-normal mipmaps); the 6 km tile and the 5 m patch (the ground in Walk/Rover) were lit with **per-vertex normals** interpolated across the triangles (`layers` in the JSON: `ringA nm1281`, `patch5m` without a map, the tile without a map).
* The Lommel-Seeliger law is the same in every mode, but it behaves differently at grazing view: brightness ∝ cos i / (cos i + cos e). From Orbit cos e ≈ 0.6 ≫ cos i ≈ 0.05, so brightness follows cos i (strong slope contrast, dark ground: mean 9-25). In Walk/Rover cos e is 0.02-0.1 and comparable with cos i, so the ratio saturates toward 1: ground is 4-8× brighter and slopes facing toward and away from the low Sun look alike (relief off: detail 0.89 in Walk vs 1.29-1.48 in Orbit at Peak near Shackleton). This is the physics of that law, not an exposure setting.

**(2) Can the LOLA-derived normal maps be applied to the near tile and the 5 m patch?** Yes: both meshes already carry texture coordinates in their own grid (`gridUV`) and `bakeNormalXZ` bakes any grid. On laptops in Walk/Rover the drawn meshes already are the full data grids (20 m tile, 5 m patch), so a normal map of the same grid holds the same normals at the nodes. What changes is only the interpolation between nodes (bilinear across the cell instead of linear within each of the two triangles, so no diagonal creases), and the mipmaps (averages of the real normals) at distance. It adds lighting detail where the mesh is drawn coarser than the grid: on phones the tile is drawn every 2nd node (40 m), and in Orbit the tile is shaded with averaged normals at distance like the rings. It cannot add detail finer than the grid.

**(3) Is detail lost through colour mapping, roughness, lighting model, exposure, tone mapping or filtering?**
* Lighting model: **yes, mainly through the relief term's clipping** (above), and through Lommel-Seeliger's saturation at grazing views (physical for that law; measured with relief off).
* Colour mapping: albedo is uniform (no public LOLA normal-albedo map at ≤ 250 m/pixel near the pole), so all variation comes from shape; there is no albedo data to add.
* Roughness: the regolith material has no specular/roughness term; nothing is lost there.
* Exposure / tone mapping: identical in every mode (linear, exposure 1); not a cause. The brighter ground in Walk/Rover comes from the Lommel-Seeliger law plus the relief term's additive brightening.
* Texture filtering: normal maps used trilinear mipmapping with anisotropy 4. At grazing views (Walk/Rover looking toward ring A) anisotropy 4 blurs the far ground more than necessary; this device supports 16.

**(4) Do level-of-detail choices reduce quality near the camera unnecessarily?** Not on laptops: since round 5, Walk and Rover draw the full-resolution tile and load the 5 m patch at every quality level. On phones the tile is drawn every 2nd node (40 m) and the 5 m patch is not loaded (load and memory); lighting there came from 40 m vertex normals. Ring A at Medium is drawn at 100 m (validated trade-off, round 6 trade-off 1) with the 25 m normal map.

**(5) Would a physically based lunar photometric model improve the appearance?** Not measurably for this question. Lommel-Seeliger (already used; e.g. Hapke 2012, *Theory of Reflectance and Emittance Spectroscopy*, 2nd ed.) and Lambert are the two limits of the widely used lunar-Lambert function (McEwen 1991, *Icarus* 92, 298-311: r ∝ 2L(α)·cos i/(cos i + cos e) + (1 − L(α))·cos i, with L between 0 and 1 depending on the phase angle α). The Lambert limit measured here is **worse** in every ground view (Walk detail 0.16 vs 0.89; Rover 0.04 vs 0.10; lower foreground contrast), so a lunar-Lambert blend lies between the two and does not add detail. An opposition term (Hapke) brightens only near zero phase angle, i.e. looking straight away from the Sun; facing across the Sun (phase ≈ 90°) it does nothing, and down-Sun it adds a broad glow, not relief. Hapke's macroscopic-roughness shadowing describes roughness below the grid, which no dataset used here resolves at the site scale. Decision: keep Lommel-Seeliger.

**The fundamental limitation (plain language).** The finest elevation data are a 5 m grid near three sites and a 20 m grid elsewhere. Anything smaller than one grid cell - rocks, boulders, small craters, the texture of the ground in Apollo photographs - is not in any dataset used here, so the 3D view cannot show it at ground level without inventing it, and it does not invent it. In Orbit each screen pixel covers several real grid cells (0.3-0.4 pixels per 25 m cell at 60 km: about 3 cells per pixel), so the picture is full of real features and looks rich. In Walk one 5 m cell spans 22-345 pixels across (about 500 to 120,000 pixels in area), and one 20 m cell at Mons Malapert 680-3,000 pixels; between grid points the surface can only change smoothly, so it looks like broad gradients. Better shading can make the real shapes clearer and remove artefacts; it cannot create real detail below 5 m / 20 m.

### Part 2 - Display-only improvements (real data only) - DONE

**What changed** (`js/view3d.js`, `js/view3d_math.js`; nothing in `js/engine.js`, the data files, the meshes or any readout):
1. **Bounded relief shading** (the measured main cause). The local-contrast term is now a factor on the Lommel-Seeliger value instead of an addition to 70 % of it: factor = 1 + 0.6 · tanh(0.9 · (cos i − cos iₛ) / cos iₛ), with i the incidence angle on the DEM normal and iₛ on the smoothed DEM normal (±4 cells; cos iₛ at least 0.06). It stays between 0.4 and 1.6, so no slope is driven to black or clipped to white, and for small differences it restores about half of the relative (Lambert) contrast that Lommel-Seeliger removes at grazing views. The gain now uses the illumination of the smoothed slope itself instead of flat ground (the old divisor, sin of the Sun's elevation, overstated the gain about 4× on Sun-facing slopes). Same inputs as before; the distance normalisation of round 6B (relief fades below about half a pixel) is unchanged. Defaults unchanged (off in Orbit, on in Walk/Rover).
2. **Per-pixel normals for the 6 km tile and the 5 m patch** (`buildTerrain`): normal maps baked from their own LOLA grids (`bakeNormalXZ`, the same method and grid as the vertex normals; 301 × 301 and 401 × 401 texels; mipmaps = averages of the real normals), at every quality level where WebGL2 is available (before: only the rings, only at Medium/High). Relief's distance normalisation then uses the grid spacing and the mipmaps, as for the rings. Never finer than the source grid; between nodes the normal is interpolated bilinearly (no new features).
3. **Anisotropic filtering at the device maximum** for every terrain texture (16 on this laptop, was 4). Mip bias unchanged (0 except the existing ring-edge fade).
4. **Exposure / tone mapping**: already identical in every mode (linear, exposure 1, fill 0.05; Part 1); no change needed. The relief term no longer brightens the ground (Peak near Shackleton Walk mean 182.6 → 120.2; 14 % → 0.5 % of ground pixels clipped white).
5. **Openness shading (sky-view factor)**, toggle "Openness shading (Walk and Rover)", **off by default**: SVF = 1 − (1/16) Σ sin γᵢ, γᵢ = horizon elevation (≥ 0) in 16 directions within 1 km, from the true LOLA heights (5 m patch where it exists, then the 20 m tile; lunar curvature included), after Zakšek, Oštir & Kokalj (2011), *Sky-View Factor as a Relief Visualization Technique*, Remote Sensing 3(2), 398-415, doi:10.3390/rs3020398. Display: reflected light × (1 − 2.5 × (1 − SVF)), faded out over the tile's outer 500 m (and the patch's outer 150 m) so the tile has no step; Walk and Rover only (in Orbit the tile-only factor would show the 6 km square). Computed in the background in 12 ms row chunks the first time it is used (0.4-0.9 s per grid in Node; measured 1.4 s on the emulated phone (tile only) and 7.1 s on the laptop (tile and 5 m patch) while other test runs shared the machine), cached per grid. **Default off because the measurements show no gain**: it darkens the ground (mean −8 % to −23 % in Walk and Rover) and lowers 1-pixel detail (Peak near Shackleton Walk 1.16 → 1.09, Mons Malapert Walk 0.21 → 0.16), with at most a small rise in area variation (blk16 0 % to +13 %). Classification: Illustrative (the SVF itself is Calculated from LOLA; the Moon has no sky light, so it is a visualisation aid, not a light source).
6. **Photometric model**: kept Lommel-Seeliger (Part 1, question 5).
7. **Notes and text**: the 3D notes describe the bounded relief factor, the tile/patch normal maps, openness shading (Illustrative, with the method and citation) and a new Illustrative item "Why the ground looks smoother in Walk and Rover than in Orbit" (the data-resolution limit in plain language). About → Design decisions entry 14 and `DESIGN_DECISIONS.md`; `TEXT_AUDIT.md` (Round 6C table); README (feature list, 3D table rows, test row). The AI disclosure is unchanged (only the round-4B "Graphics:" line and the About credit line; tests).

**Before / after** (`node tests/ground_detail_6c.js --tag after --variants`; mean / std / detail / blk16 of the ground band; screenshots `docs/ground_detail/round6c/{before,after}_<site>_<view>_<quality>[_<variant>].jpg`; numbers `measurements_before.json`, `measurements_after.json`; clipped-pixel shares `clipping.json` from `node tests/clip_6c.js`):

| Site | View | Quality | Before: mean / std / detail / blk16 | After (defaults) | After, relief off | After, openness on | After, per-vertex normals (diagnostic) |
|---|---|---|---|---|---|---|---|
| Peak near Shackleton | Orbit 60 km | medium | 11 / 12.6 / 1.48 / 1.021 | **11 / 12.6 / 1.49 / 1.021** | 11 / 12.6 / 1.49 / 1.021 | 11 / 12.6 / 1.49 / 1.021 | 10.9 / 12.3 / 0.85 / 1.024 |
| Peak near Shackleton | Orbit 3 km | medium | 17 / 13.7 / 1.29 / 0.752 | **17 / 13.6 / 1.18 / 0.754** | 17 / 13.6 / 1.18 / 0.754 | 17 / 13.6 / 1.18 / 0.754 | 17 / 13.7 / 1.29 / 0.752 |
| Peak near Shackleton | Walk | medium | 182.6 / 54.6 / 1.4 / 0.29 | **120.2 / 43.5 / 1.16 / 0.35** | 94.3 / 35.1 / 0.89 / 0.361 | 107.8 / 39.7 / 1.09 / 0.355 | 121 / 44.2 / 1.16 / 0.353 |
| Peak near Shackleton | Rover | medium | 45.7 / 33.6 / 0.27 / 0.727 | **34.1 / 15.1 / 0.12 / 0.435** | 31.8 / 12.4 / 0.1 / 0.384 | 31.5 / 13.9 / 0.11 / 0.435 | 33.5 / 15.5 / 0.11 / 0.455 |
| Peak near Shackleton | Orbit 60 km | high | 25 / 28 / 3.28 / 1.058 | **25 / 28 / 3.29 / 1.058** | 25 / 28 / 3.29 / 1.058 | 25 / 28 / 3.29 / 1.058 | 25 / 28 / 4.07 / 1.055 |
| Peak near Shackleton | Orbit 3 km | high | 17.3 / 14.6 / 2.95 / 0.725 | **17.2 / 14.4 / 2.6 / 0.727** | 17.2 / 14.4 / 2.6 / 0.727 | 17.2 / 14.4 / 2.6 / 0.727 | 17.3 / 14.6 / 2.95 / 0.725 |
| Peak near Shackleton | Walk | high | 182.6 / 54.6 / 1.4 / 0.29 | **120.2 / 43.5 / 1.16 / 0.35** | 94.3 / 35.1 / 0.89 / 0.361 | 107.8 / 39.7 / 1.09 / 0.355 | 121 / 44.2 / 1.16 / 0.353 |
| Peak near Shackleton | Rover | high | 45.7 / 33.6 / 0.27 / 0.727 | **34.1 / 15.1 / 0.12 / 0.435** | 31.8 / 12.4 / 0.1 / 0.384 | 31.5 / 13.9 / 0.11 / 0.435 | 33.5 / 15.5 / 0.11 / 0.455 |
| Mons Malapert | Orbit 60 km | medium | 9.4 / 10.4 / 0.75 / 0.997 | **9.4 / 10.4 / 0.76 / 0.997** | 9.4 / 10.4 / 0.76 / 0.997 | 9.4 / 10.4 / 0.76 / 0.997 | 9.4 / 10.2 / 0.47 / 1.001 |
| Mons Malapert | Orbit 3 km | medium | 10.3 / 8.1 / 0.56 / 0.686 | **10.3 / 8.2 / 0.54 / 0.687** | 10.3 / 8.2 / 0.54 / 0.687 | 10.3 / 8.2 / 0.54 / 0.687 | 10.3 / 8.1 / 0.56 / 0.686 |
| Mons Malapert | Walk | medium | 91.2 / 23.6 / 0.16 / 0.259 | **100.1 / 14.8 / 0.21 / 0.146** | 98.2 / 15.4 / 0.19 / 0.156 | 77.2 / 11.7 / 0.16 / 0.151 | 99.9 / 14.6 / 0.16 / 0.144 |
| Mons Malapert | Rover | medium | 7.9 / 0.2 / 0 / 0.011 | **29.4 / 3.6 / 0.05 / 0.12** | 37.6 / 4.6 / 0.07 / 0.118 | 23.5 / 3.2 / 0.05 / 0.135 | 29.1 / 3.6 / 0.05 / 0.12 |
| Mons Malapert | Orbit 60 km | high | 16.2 / 17.3 / 2.12 / 0.947 | **16.2 / 17.3 / 2.13 / 0.947** | 16.2 / 17.3 / 2.13 / 0.947 | 16.2 / 17.3 / 2.13 / 0.947 | 16.1 / 17.2 / 2.48 / 0.948 |
| Mons Malapert | Orbit 3 km | high | 10.3 / 8.1 / 0.56 / 0.686 | **10.3 / 8.2 / 0.54 / 0.687** | 10.3 / 8.2 / 0.54 / 0.687 | 10.3 / 8.2 / 0.54 / 0.687 | 10.3 / 8.1 / 0.56 / 0.686 |
| Mons Malapert | Walk | high | 91.2 / 23.6 / 0.16 / 0.259 | **100.1 / 14.8 / 0.21 / 0.146** | 98.2 / 15.4 / 0.19 / 0.156 | 77.2 / 11.7 / 0.16 / 0.151 | 99.9 / 14.6 / 0.16 / 0.144 |
| Mons Malapert | Rover | high | 7.9 / 0.2 / 0 / 0.011 | **29.4 / 3.6 / 0.05 / 0.12** | 37.6 / 4.6 / 0.07 / 0.118 | 23.5 / 3.2 / 0.05 / 0.135 | 29.1 / 3.6 / 0.05 / 0.12 |

Console errors in the 96 after-renders: 0.

Reading the table:
* **Walk and Rover**: the black and white artefacts are gone (Mons Malapert Rover 7.9 → 29.4; Peak near Shackleton Walk clipped white 14 % → 0.5 %). The 1-pixel "detail" values before were partly the edges of those clipped areas, so some fell (Peak near Shackleton Rover 0.27 → 0.12); variation between areas (blk16) rose in Walk (Peak near Shackleton 0.29 → 0.35) and fell in Rover where the black/white patches had made it large (0.73 → 0.44). The ground remains smooth between grid points: that is the data (Part 1).
* **Per-pixel normals**: in Walk/Rover on laptops the mesh already is the data grid, so per-vertex vs per-pixel normals are close (diagnostic column); at Mons Malapert Walk the normal map gives 0.21 vs 0.16 detail (bilinear interpolation without triangle creases). It also gives phones and Low the tile's full 20 m lighting detail (mesh drawn at 40 m there).
* **Orbit**: unchanged at 60 km (Peak near Shackleton 1.48 → 1.49 Medium, 3.28 → 3.29 High; Mons Malapert 0.75 → 0.76, 2.12 → 2.13). At 3 km the 1-pixel detail is 9-12 % lower (1.29 → 1.18 Medium, 2.95 → 2.60 High at Peak near Shackleton) with area variation unchanged (blk16 0.752 → 0.754, 0.725 → 0.727): the tile's far part is now filtered from averaged real normals (mipmaps, 16× anisotropy) instead of aliasing per-vertex normals; the pictures look the same side by side (`before_/after_peak_shackleton_orbit3_*.jpg`). Kept, because it removes the tile edge (below).
* **Tile edge in Orbit with relief on** (`node tests/tile_edge.js --quality high,medium,low`, 60 km; inside vs outside the 6 km edge): High luminance +1.0 % → **+0.6 %**, detail +13.5 % → **+2.9 %**; Medium −4.8 % → **+0.0 %**, −4.2 % → −4.3 %; Low −8.5 % → **−0.5 %**, +52.6 % → **+30.9 %** (before measured on a checkout of 0ba841e; `tests/perf/tile_edge_6c_before.json`, `tile_edge_6c.json`; pictures `docs/tile_edge/after6c_*.png`).

**Files changed**: `js/view3d.js` (regolith shader: bounded relief, openness term, per-pixel-normal switch for diagnostics; tile/patch normal maps; anisotropy; openness texture, background computation, toggle, notes, debug and test hooks), `js/view3d_math.js` (`skyViewRows`, `skyViewFactor`), `index.html` (About: Design decision 14), `tests/view3d_test.js` (sky-view factor checks), new `tests/ui_round6c.js`, `tests/clip_6c.js`; documents listed above.

**Classification of the new effects**

| Effect | Class |
|---|---|
| Per-pixel normals for the tile and 5 m patch | Calculated (from measured LOLA heights; same method as the vertex normals) |
| Anisotropic filtering | display only (no physical claim) |
| Bounded relief shading | Illustrative (display contrast) |
| Openness shading | Illustrative (display); the sky-view factor is Calculated from LOLA |

### Part 3 - Verification - DONE

**Geometry, readouts and status unchanged** (`node tests/ground_detail_6c.js --invariants --tag after --other before=<checkout of 0ba841e>`): for both sites at Low, Medium and High, in Orbit 60 km, Orbit 3 km, Walk and Rover - vertex hashes of every terrain layer (tile, 5 m patch, rings, skirts) and of the tile's heights and slopes, **216 inspection readouts** (height, slope, lat/lon, distance, data resolution and product, hit point) at fixed pixels, rover wheel heights, hub heights, pitch/roll and the rover readout text, the status tiles and their Sun/Earth readouts, the banner, the Sun light direction and intensity, Earth's direction, the camera and eye height, the shadow camera: **0 differences**, no console errors. `node tests/inspect_perf.js --compare tests/perf/inspect_before.json`: **81/81 readouts identical** (54 Orbit + 27 Walk; largest numeric difference 0; median latency 0.3-0.4 ms per update, measured while other test runs shared the machine - the inspection code is unchanged). Openness shading on vs off (`tests/ui_round6c.js`): inspection readout, Sun/Earth directions, status tiles, camera and the rendered shadow verdict at the site marker identical.

**Shading consistency with shadows on** (`node tests/shading_consistency.js`): **Low 97.8 %, Medium 99.0 %, High 99.8 %** (unchanged), 0 unexplained; near cascade 261/264 vs 260/264 (Medium) and 263/264 vs 263/264 (High). (The shadow maps do not depend on normals or display shading.)

**Performance** (laptop 1440 × 900, `node tests/perf3d.js --quality low,medium,high`, 8 sites; before = checkout of 0ba841e measured the same way, same session; `node tests/perf3d_compare.js tests/perf/round6c_before.json tests/perf/round6c_final.json` - its "v1-stable"/"round6" labels mean before/after here):

| Quality | Build | Orbit FPS (avg) | Render ms (avg) | Deploy → first frame ms (avg; range) | → full terrain ms (avg) | Textures |
|---|---|---|---|---|---|---|
| Low | before 6C | 59.9 | 1.5 | 303 (212-445) | 400 | 0 |
| Low | after 6C | 60.0 | 1.6 | 294 (229-534) | 395 | 2 |
| Medium | before 6C | 60.0 | 2.1 | 292 (199-724) | 627 | 1 |
| Medium | after 6C | 60.0 | 1.9 | 363 (325-676) | 717 | 3 |
| High | before 6C | 59.3 | 2.4 | 330 (206-489) | 1,063 | 2 |
| High | after 6C | 59.0 | 2.0 | 266 (241-546) | 1,053 | 4-6 |

Gate met: Medium first frame **< 1.5 s** (at most 676 ms), orbiting **≥ 30 frames/s** (59-60, capped by the browser). The extra textures are the tile and patch normal maps and the 1 × 1 openness placeholder; the normal maps are baked when the terrain is built (included in the times above). These round-6B-era numbers (stars on by default, detailed rover) are higher than the round-6 table above for first frames; both builds here were measured in the same session.

**Test suites** (round6 branch with round 6C; laptop 1440 × 900 and emulated phone 390 × 844 for the browser suites):

| Suite | Result |
|---|---|
| `node tests/validate.js` | OVERALL: PASS (result files: timestamps only) |
| `node tests/illumination.js`, `blind_test.js`, `coarse_validation.js`, `one_year_check.js`, `earth_orientation.js`, `instant_status_check.js` | all PASS (result files: timestamps only) |
| `node tests/accuracy3d.js` | PASS: 14,499,574 grid points within 0.100 m (mean 0.031 m) |
| `node tests/view3d_test.js` (+ sky-view factor checks), `node tests/features_test.js` | ALL PASS |
| Python DEM checks: `tools/terrain.py check`, `tools/terrain3d.py check` (0.049 m), `tools/terrain3d_ext.py check` (0.099 m) | PASS |
| `node tests/shading_consistency.js` (shadows on) | 97.8 / 99.0 / 99.8 % (unchanged) |
| `node tests/ground_detail_6c.js --invariants` | 0 differences (above) |
| `node tests/tile_edge.js` | see Part 2 |
| `node tests/ui_round6c.js` (laptop + phone) | ALL PASS: tile normal map = its grid (301 × 301), 5 m patch normal map in Walk (laptop), anisotropy at the device maximum (16), openness off by default and labelled, no effect in Orbit, display only (readout, directions, tiles, camera, shadow verdict identical), notes with classification labels, relief no longer black at Mons Malapert Rover (26.9 / 255), no AI wording beyond the unchanged "Graphics:" line, no console errors |
| `node tests/ui_check.js`, `ui_round5.js`, `ui_round6.js`, `ui_round6b.js` (laptop + phone) | all PASS (exit 0, no FAIL lines), no console errors or warnings |

### Round 6C - not done or limited

* **No real sub-grid detail** can be shown (Part 1); Walk and Rover remain smoother than Orbit, now without black/white artefacts.
* **Openness shading** is off by default (no measured gain); it covers the 6 km tile and the 5 m patch only (rings: no effect), and in Orbit it is not applied. Its first computation runs in the background (1.4 s measured on the emulated phone, 7.1 s on the laptop with the 5 m patch while other tests were running); until then the picture is unchanged.
* **Photometric model**: Hapke/lunar-Lambert not implemented (no measurable benefit expected; Part 1).
* **Devices**: headless Chromium on the development laptop; phones emulated; not tested on a real phone, Firefox or Safari. WebGL1 browsers do not get the tile/patch normal maps or openness shading (unchanged picture, stated in the notes).

**Round 6C hand-over**: `data/version.js` stamped with the Part 2 commit (cc5a36f). No merge, no tag, no push; `master` and `v1-stable` unchanged.

## Round 6E - Close-range surface covering, plus two accuracy checks

Started 2026-11-15 11:45 Riyadh, time box 13:00.

### Part 0 - Two accuracy checks - DONE (text/notes only, no terrain change)

**a) Isolated cone near Peak near Shackleton: probably a DEM artifact.** `tools/spike_check_6e.py` (read-only; output `tests/spikes_6e.json`). The highest LDEM_875S_5M node at the cone (-88.76152, 125.1511 E) is 1498.5 m, 7.0 m above the highest of its 8 neighbours and about 24 m above the ground 20-60 m around it; LDEM_85S_20M gives 1474.2 m there (3 × 3 nodes at most 1477.5 m) and LDEM_80S_80M 1475.0 m, i.e. no hill at all. Beyond 15 m from the node the 5 m and 20 m profiles agree within 1-2 m. A one-node peak with straight sides, 35 m wide and 24 m high, is what one outlier shot looks like after gridding, and the product's label describes it as made from preliminary LOLA data. A scan of all three 5 m patches (node ≥ 2 m above all 8 neighbours and ≥ 10 m above the 20 m product) finds only this node (it lies in both Peak near Shackleton patches); Shackleton crater centre has none. The terrain was not edited or filtered; the 3D note on the 5 m patch now says: "The preliminary 5 m product contains a few isolated spikes that are probably data artifacts (locations in GAPS_AND_ISSUES.md); heights are shown as published." Details in GAPS_AND_ISSUES.md section 12. The owner decides later about a visual flag.

**b) Artemis wording.** NASA release "NASA Adds Mission to Artemis Lunar Program, Updates Architecture" (27 Feb 2026, https://www.nasa.gov/news-release/nasa-adds-mission-to-artemis-lunar-program-updates-architecture/): "the Artemis III mission, now in 2027, will be designed to test out systems and operational capabilities in low Earth orbit ... to prepare for an Artemis IV landing in 2028"; the Artemis IV mission page (https://www.nasa.gov/mission/artemis-iv/) says "Crewed Surface Landing", launch "Early 2028", and shows the nine candidate regions under "Lunar Site Selection" (it does not say more about them; ASTERIA does not either). Changed: About heading "NASA candidate landing regions (announced for Artemis III)" and its text, the map "Why" explanation, the page meta description, README, GAPS_AND_ISSUES.md, SUBMISSION_LINKS.md (+2 NASA links). Kept as they are (historically accurate names of NASA's announcements): site labels "Artemis III candidate region (Oct 2024 / 2022 list)", the map legend "NASA Artemis III candidate regions (Oct 2024)", the tour text and validation documents. TEXT_AUDIT.md updated.

### Part 1 - Close-range surface texture (Illustrative, display only) - DONE

Owner decision (supersedes the "no synthetic texture" part of design decision 14, for close range only). Implemented in the existing terrain material (`regolithMaterial`, same `onBeforeCompile` path) for every terrain layer (6 km tile, 5 m patch, rings), active only in Walk and Rover (`uCover` = 0 in Orbit). Fragment shader only: no vertex displacement, no geometry, no 3D rocks.

* **Layers** (procedural, no textures, no downloads): (1) albedo variation, 7 octaves of value noise from 6.4 m to 0.1 m (each octave rotated), about ±5 %, mean 0; (2) micro-relief: the same octaves as a height field whose slope amplitude rises toward small scales (0.006 at 6.4 m to 0.03 at 0.1 m), blended onto the final LOLA per-pixel normal as an added height field (first-order change of the unit normal, linear in the detail gradient, so it follows every LOLA slope and its mean is zero); (3) craterlets (radius 0.1-5 m; bowl and raised rim, depth up to 0.35 R; four size classes, one candidate per cell, fewer per area as the size grows) and rock flecks (0.04-0.4 m; domes, +15 % albedo), in the shading only. **Tuned visually, not statistically matched** to published crater or rock counts.
* **Mapping**: site-centred ground frame (world x = east, z = -north, metres), so the pattern is fixed to the ground (no swimming while driving) and continuous across tile/patch/ring boundaries. Projected on the horizontal frame; craterlet radii are measured along the LOLA surface (slope-aware). Hashes: mod-289 permutation (exact in float32 at these cell indices).
* **Lighting**: the covering is one bounded factor on the **Sun term only** (light-loop index of the Sun; Earthshine and the fill light untouched): albedo × (1 + 0.45 tanh(0.8 Δcos i / max(cos i, 0.04))), with cos i from the LOLA normal. Where the LOLA sunlight term or the shadow factor is 0, the result stays 0.
* **Distance / LOD**: full strength to 60 m from the camera, faded to 0 at 350 m; each octave and feature fades out when it is smaller than about 2-4 screen pixels (dFdx/dFdy of the world position); 5 octaves (and no smallest rock class) on Low and on phones, 7 otherwise.
* **Control**: checkbox "Close-range surface texture (illustrative)" next to Relief/Openness, Walk and Rover only, on by default, remembered for the session; the disclaimer (exact text from the brief) below it.
* **Mean-brightness tuning (measured)**: the first version (clamped detail cosine, ±60 % factor) moved the ground-band mean by -7 to +13 %. A test-only switch (`uCovDbg`) separated the parts: albedo alone +0.1 %, craterlets alone +0.3 %, micro-relief alone +8 to +11 %. The causes were the clamp (asymmetric), a log-symmetric factor (its linear mean is above 1) and the coarse octaves (a few cells near the viewer tilt the whole near field). The fix was a linear detail term, a linear-symmetric factor and slope amplitude rising toward small scales. Result: -1.4 to +2.4 % (below).
* **AI disclosure**: the "Graphics:" line now reads exactly as specified (the rover, the close-range surface texture in Walk and Rover, and the pixel-art rocket, Earth and Moon ...; "Terrain shapes, maps, ..."); AI_DISCLOSURE.md, `tests/ui_check.js`, `tests/ui_round6c.js`, `tests/features_test.js` updated; no other AI wording.
* **Docs**: Illustrative notes item; "Surface shading" and "Why the ground looks smoother" notes amended; design decision 15 (About and DESIGN_DECISIONS.md, identical text) and decision 14 amended; README classification row; TEXT_AUDIT.md.

### Part 2 - Wheel tracks (Illustrative) - DONE

While the rover drives, a path point is kept every 4 m (the last 64 points, about 250 m), and the last point follows the rover. In the covering shader, two strips at ±0.6 m from the path (0.3 m wide) are darkened by up to 7 %. They fade with the distance driven since, and when narrower than about 2 pixels. Same checkbox, Sun term only, no geometry, no effect on readouts. Test: 20-21 points recorded after a 4 s drive; 8,210 px differ with vs without the path (covering on); readouts, rover pose and status identical; no effect in Orbit. The strips are faint by design and hard to see at the grazing Rover camera angle.

### Part 3 - Verification - DONE

Screenshots: `docs/ground_detail/round6e/` (README there): Peak near Shackleton (5 m patch, 2028-09-25 10:04 UTC) and Mons Malapert (20 m, 2028-09-28 03:00 UTC), Walk, Rover, Orbit 3 km and 60 km, laptop (Medium, plus High at Peak near Shackleton) and phone, covering off and on; the cone view; wheel tracks. Numbers: `results_6e.json`.

| Device / site / quality / view | Ground mean off -> on | Change | Detail off -> on | Clipped white | Frame ms off / on |
|---|---|---|---|---|---|
| laptop Peak near Shackleton Medium Walk | 120.1 -> 121.3 | +1.0 % | 1.16 -> 4.94 | 0.47 -> 0.76 % | 3.0 / 1.0 |
| laptop Peak near Shackleton Medium Rover | 34.1 -> 34.2 | +0.3 % | 0.12 -> 1.90 | 0 -> 0 | 2.8 / 2.1 |
| laptop Mons Malapert Medium Walk | 100.1 -> 100.7 | +0.7 % | 0.21 -> 1.95 | 0 -> 0 | 2.5 / 1.0 |
| laptop Mons Malapert Medium Rover | 29.4 -> 29.0 | -1.3 % | 0.06 -> 1.53 | 0 -> 0 | 2.4 / 2.3 |
| laptop Low (both sites, Walk/Rover) | | -1.4 to +1.1 % | | | 1.0-2.0 / 1.2-2.1 |
| laptop High (both sites, Walk/Rover) | | -1.3 to +1.0 % | | | 1.6-2.9 / 1.6-2.7 |
| phone Peak near Shackleton Medium Walk / Rover | 69.1 -> 70.8 / 22.7 -> 23.2 | +2.4 / +2.3 % | 1.02 -> 2.95 / 0.11 -> 0.76 | 0.02 -> 0.02 % | 1.3 / 1.2, 1.4 / 1.2 |
| phone Mons Malapert Medium Walk / Rover | 99.2 -> 99.2 / 28.4 -> 28.0 | +0.1 / -1.2 % | 0.38 -> 1.31 / 0.09 -> 0.67 | 0 | 1.0 / 0.9, 1.5 / 1.7 |

Ground band = rows 4-42 % from the bottom of the drawing buffer, 5-95 % of its width; detail = mean absolute neighbour difference; clipped black unchanged everywhere (0-0.07 %). Frame ms = GPU-synchronised renders of the same frame (render + 1-pixel readPixels, 40 frames). All are far below 33 ms (30 fps) with the covering on and off; the off/on differences are within run-to-run noise.

**Tests** (all on the final code, run one after another; logs `tests/perf/round6e_*.log`):

| Test | Result |
|---|---|
| `node tests/ui_round6e.js --base <checkout of fe76cd6>` (laptop Low/Medium/High + phone) | ALL PASS (159 checks), no console errors: <br>• covering off = pixel-identical to the round 6C build in every view (hash of the rendered pixels); Orbit pixel-identical with the checkbox on or off <br>• with shadows on, 36,000-536,000 pixels per view are not reached by the Sun; none changes by more than 1 level (one pixel in each of three Peak near Shackleton Rover renders changes by exactly 1 level: 8-bit rounding where the Sun term is just above zero) <br>• ground mean within 3 % <br>• readouts (9 pixels), Sun/Earth directions, status tiles and rover readout/pose identical on/off; cone readout identical; wheel tracks <br>• checkbox, disclaimer, Illustrative item, Graphics line, no other AI wording |
| `node tests/ground_detail_6c.js --invariants --other base6c=<fe76cd6>` | INVARIANTS: PASS - 0 differences (vertex hashes of every layer, 216 inspection readouts, status tiles, Sun/Earth readouts and directions, rover pose and readout; 2 sites × 3 qualities × 4 views; the new build runs with the covering on by default) |
| `node tests/shading_consistency.js` (shadows on) | Low 97.8 %, Medium 99.0 %, High 99.8 % - unchanged |
| `node tests/tile_edge.js` | High +0.6 % / +2.9 %, Medium +0.0 % / -4.3 % - unchanged |
| `node tests/perf3d.js --phone --quality low,medium,high` | laptop Medium first frame <= 815 ms; every row 59-60 fps; no errors |
| `ui_check`, `ui_round5`, `ui_round6`, `ui_round6b`, `ui_round6c` (laptop + phone) | all pass, no console errors (ui_round6c: the "Why the ground looks smoother" check now expects the amended text: data limit unchanged, illustrative appearance) |
| Node: features_test, view3d_test, validate, earth_orientation, blind_test, one_year_check, instant_status_check, illumination, coarse_validation, accuracy3d | all pass |
| Python: `tools/terrain3d.py check`, `tools/terrain3d_ext.py check`, `tools/terrain.py check` | pass |

Result files under `data/` and VALIDATION_REPORT.md differ only in their generation timestamps.

### Round 6E - not done or limited

* The covering is **not statistically matched** to lunar crater or rock size-frequency data (tuned visually; stated in the app).
* The pattern is projected on the horizontal ground frame: on steep slopes the noise stretches by 1/cos(slope) (15 % at 30°); craterlet radii are slope-corrected.
* The wheel tracks are faint and hard to see at the default Rover camera angle; they reset when the 3D view is reopened.
* The spike near Peak near Shackleton is shown as published (owner to decide on a visual flag).
* Devices: headless Chromium on the development laptop; phones emulated (same GPU); not tested on a real phone, Firefox or Safari.
* Parts 1 and 2 were committed together (Part 2 was added while Part 1 was passing, within the time box).

**Round 6E hand-over**: `data/version.js` stamped. No merge, no tag, no push; `master` and `v1-stable` unchanged.

## Round 6D - Mission requirements and Mission casefile (unifying decision support)

Goal: one workflow - pick a site -> set mission requirements -> compare options -> open the Mission casefile -> verify every number - built only from results ASTERIA already computes. `js/engine.js`, validated values, horizons, status logic, terrain data and every existing calculation are unchanged.

### Part 1 - Mission requirements (Compare) - DONE

**What / why.** A collapsible "Mission requirements" block at the top of the Compare page (`<details>`, open by default). Seven requirements, each with a tick box and (except energy) a threshold: minimum % sunlit (50), minimum % Earth link (50), minimum % both (30), maximum longest darkness (72 h), maximum longest Earth blackout (120 h), energy balance must be positive (Power page settings; "first-order estimate, example values"), maximum site slope (15°). The defaults are labelled "Example values - set your mission's" and are not requirements of any real mission. The Compare table gains a "Mission requirements" section: one row per ticked requirement with **Met / Not met / Can't assess** per scenario, the value next to the verdict, the reason for "Can't assess", and a neutral "N of M requirements met" row. No score, weighting, ranking or highlighting on these rows (the existing best-value highlighting of the metric rows is unchanged).

**Rule.** A verdict is taken from the value at the precision it is printed with (the % and hour values to 0.1, the slope to 0.1°), so it always follows from the number the reader sees. Energy uses the Power page's own rule (produced >= needed is "Energy positive"). Hours are printed in hours (0.1 h) next to the verdict, even where the metric row shows days.

**Classification and sources.** Verdicts are comparisons of user thresholds with existing values: % sunlit / Earth / both, longest darkness / blackout = Calculated (validated engine + LOLA horizons, or smooth / 240 m horizon as in the "Horizon model" row); energy = Approximate (first-order estimate, example values); slope = Calculated from LOLA heights (5 m / 20 m / 80 m grid).

**Can't assess.** Slope at a custom point or a site without a 3D terrain tile ("no terrain data for a custom point's slope (no 3D terrain tile)"); energy when the Power page inputs are invalid ("Power page inputs are invalid (check them on the Power page)").

**Storage.** In the share link as `req=sun:50,earth:50,...` (ticked requirements only; written only when different from the example defaults; a link without `req` restores the defaults) and in `sessionStorage` (`asteria.req`) for a visit without a link. Editing a requirement re-judges the stored Compare results without recomputing.

**Files.** `index.html` (block), `js/app.js` (`REQ_DEF`, `reqCheck`, `renderCompare` split out of `runCompare` unchanged otherwise; `powerOf` also returns `loadWh` with the exact expression of the Power page's "Energy needed by load"), `css/style.css`, `tests/ui_round6d.js`.

**Tests** (`node tests/ui_round6d.js --part 1`, laptop + phone; 4 scenarios: Peak near Shackleton best-lit point (5 m), the same +7 days, Mons Malapert (20 m), custom smooth point -60°, 0°): requirement inputs equal the Compare values exactly (raw equality, all 4 scenarios); every % and hour verdict shows the same value as its Compare row and follows from it; energy and load of scenario 1 equal the Power page exactly (Explore window, same settings) and the verdict equals the Power page's "Energy positive/negative"; slope equals the Compare slope row; custom-point slope and invalid power inputs give "Can't assess" with the reason; "N of 7 requirements met" with no score/rank wording; unticking/editing re-judges without recomputing; the share link restores ticks and thresholds and a link without `req` restores the defaults; no console errors.

**Performance.** No new computation: the verdicts are a loop over at most 7 x 4 values.

**Limitations.** Verdicts at a threshold depend on the printed precision (by design). Requirements are not stored per scenario. "% both" etc. on a smooth-horizon scenario are judged like any other value; the "Horizon model" row says which horizon was used.

### Part 2 - Mission casefile - DONE

**What / why.** One "Mission casefile" button on the Explore Site Card and a "Mission casefile" button per scenario in Compare (that opens the scenario's site, start and window in Explore, then the casefile). The casefile is an overlay on the same page (works from `file://` and on the published site, no new page to keep in sync) with a clean print stylesheet. It contains only results the app already shows, for the current site, time window and requirements: (1) site - name, coordinates, what the coordinate is, sources and source type, horizon model and data resolution; (2) scenario - window start/end UTC, sampling step, minimum link elevation, the selected "now"; (3) sunlight - status now, % sunlit, average illumination, longest darkness, window count/average, the first 10 windows ("full list in CSV"); (4) Earth link - the same; (5) both - mission status now and % both (overlapping windows are not listed separately: ASTERIA does not compute such a list, so none was added); (6) power - the Power page's model and current settings applied to the Explore window ("first-order estimate, example values"); (7) terrain - DEM slope at the site point (grid, product, method), terrain horizon range, site height; (8) launch slip - slip 0 and the highest % both from the Launch-slip results if they exist for this site, horizon and minimum elevation, otherwise a one-line pointer to the tab; (9) the same Met / Not met / Can't assess list as Compare; (10) evidence table - per item: classification (Measured / Calculated / Approximate / User input), data source (cited URLs), method (link to the matching row of "Methods and formulas") and the validation result read live from the result files (angles and events vs JPL Horizons, instant status check, illumination vs NASA's PGDA map incl. this site's own row, 240 m validation, 3D slope/height accuracy), plus "Verify with NASA" (JPL Horizons queries for the Sun and Earth at this site and the selected minute); (11) limitations relevant to the site (smooth horizon / 240 m data / secondary source added when they apply); (12) footer - share link that reopens this exact view (`cf=1` in the hash), app version stamp, creation time, "Not endorsed by NASA".

**Actions.** Print / Save as PDF (browser print; the print stylesheet hides the top bar, pages, footer and the action buttons and prints black on white), Download CSV (sunlight / Earth link: the existing round 6B export, same function), Copy share link, Close (also Escape).

**Classification and sources.** As listed in the evidence table; nothing is classified Illustrative because no illustrative item is included. Sources are only URLs already cited on the About page or in the site's own source list (tested).

**Anchors.** The Validation page gained anchors for the evidence links: one per "Methods and formulas" row (`valM-orient`, `valM-enu`, `valM-pos`, `valM-azel`, `valM-horizon`, `valM-sunup`, `valM-disk`, `valM-power`, `valM-slope`, `valM-pos3d`) and `valAngles`, `valXcheck`, `valCoarse` (the existing `valHow`, `valMethods`, `valInstant`, `valAcc3d` are reused). An evidence link closes the casefile, opens the Validation page, expands a collapsed section if needed and scrolls to the anchor. (Added in Part 2 because the casefile needs them; Part 3 lists them.)

**Files.** `index.html` (button, overlay), `js/app.js` (casefile section; `renderValidation`/`renderProof` only gained `id`s), `css/style.css` (overlay, classification chips, print stylesheet), `tests/ui_round6d.js` (part 2).

**Tests** (`node tests/ui_round6d.js --part 2`, laptop + phone). Three sites, each opened from its Compare scenario: Peak near Shackleton best-lit point (5 m grid), Mons Malapert (20 m grid), custom point -60°, 0° (smooth horizon). For each: Explore shows the scenario's site/start/window; status now = the three Explore tiles; % sunlit, longest darkness, % Earth link, longest blackout, % both and average illumination = the Explore statistics (text and raw values); window counts/averages = the windows panels; window tables = the first rows of the Explore tables; scenario lines; power = the Power page cards (Explore window, same settings: energy, needed, balance, mean/peak, battery); slope = the Compare slope row; requirement verdicts = the Compare verdicts of that scenario, row by row, and the same "N of M" line; launch-slip summary = the Launch-slip results (first site) or the pointer (others); a classification on every result section and every evidence row; validation numbers present as in the result files; every internal anchor exists; every external link is a cited URL or the Horizons query for this site and minute; footer (share link with cf=1, version, creation time, "Not endorsed by NASA"); no horizontal overflow. First site also: print stylesheet hides the chrome and the buttons; casefile CSV = the existing export byte for byte (apart from its creation-time line); the share link reopens the same casefile with identical values in a fresh page; an evidence link shows the matching Validation row. Explore has exactly one new control; Escape closes; no AI wording; no console errors.

**Performance.** Opening the casefile does no computation beyond formatting (and the Power formula over the existing series, the same loop as the Power page, a few ms; slope comes from the cached 3D tile load used by Compare).

**Limitations.** The Power section always uses the Explore window (the Power page can also be set to the Launch-slip mission; then its cards show a different window - the casefile says which window it uses). The launch-slip summary appears only after the Launch slip tab has been computed for this site. Periods of "both" are not listed as windows. The PDF layout depends on the browser's print engine (checked in headless Chromium only).

### Part 3 - Integration and polish - DONE

**What.** Every casefile evidence link points to the matching Validation-page section: the "Methods and formulas" row of that item (`valM-horizon`, `valM-azel`, `valM-sunup`, `valM-disk`, `valM-power`, `valM-slope`) and, for its validation result, `valInstant`, `valAngles`, `valXcheck`, `valCoarse` or `valAcc3d` (anchors added in Part 2; `valHow`, `valMethods` reused). About page: one workflow sentence ("pick a site on the map -> set the mission requirements (Compare page) -> compare sites and dates -> open the Mission casefile -> verify each number ...") at the top, and design decision 16 "Mission requirements and Mission casefile: verdicts, not scores" (why Met / Not met / Can't assess and no composite score; why the casefile only aggregates existing results), identical in DESIGN_DECISIONS.md. No tour steps were added (the tour still has 5).

**Docs.** README.md (Compare: Mission requirements; Mission casefile; Workflow line), DESIGN_DECISIONS.md (16), TEXT_AUDIT.md (Round 6D: every new on-screen text), GAPS_AND_ISSUES.md (section 13: limits of requirements and casefile).

**Tests** (`node tests/ui_round6d.js --part 3`, laptop + phone): About shows the workflow sentence; the tour has 5 steps; About decision 16 = DESIGN_DECISIONS.md (title and text); no console errors. Evidence-link targets and the jump to the Validation row are tested in Part 2.

### Part 4 - Tests - DONE

All on the final code, logs in `tests/perf/round6d_*.log`.

| Test | Result |
|---|---|
| `node tests/ui_round6d.js` (laptop + phone; parts 1-3) | ALL PASS, 136 checks, no console errors: requirement values = Compare/Power/slope exactly and verdicts follow from the displayed values; Can't assess cases; share link restores requirements; casefile numbers = the app for a 5 m site, a 20 m site and a custom smooth-horizon point (tiles, statistics, windows, Power cards, slope, requirement verdicts, launch slip, validation results); classifications on every item; internal anchors exist, external links are cited URLs; print stylesheet hides the chrome; CSV = existing export; share link reopens the casefile; About text |
| `ui_check` (185), `ui_round5` (73), `ui_round6` (48), `ui_round6b` (54), `ui_round6c` (24), `ui_round6e --noshots` (129) - laptop + phone | all pass, no console errors; AI wording only in the About credit line and the 3D "Graphics:" line (unchanged) |
| Node: features_test, view3d_test, validate, earth_orientation, blind_test, one_year_check, instant_status_check, illumination, coarse_validation, accuracy3d | all pass (exit 0) |
| Python: `tools/terrain3d.py check`, `tools/terrain3d_ext.py check`, `tools/terrain.py check` | pass |
| `node tests/shading_consistency.js` (shadows on) | Low 97.8 %, Medium 99.0 %, High 99.8 % - unchanged |
| `node tests/perf3d.js --quality medium --sites peak_shackleton_lw,mons_malapert --phone` | 60 fps everywhere, 1.0-1.5 ms per render; first frame laptop 1097 / 357 ms, phone 440 / 254 ms. Same command on the round 6E runtime files (07cbfcc index.html, app.js, style.css; `round6d_perf3d_base6e.log`): laptop 1266 / 555 ms - the 3D view is unaffected by round 6D (the slower first frame than round 6E's report is this machine's state today, seen equally on the round 6E code) |

Result files rewritten by the test runs (VALIDATION_REPORT.md, data/validation.js, instant_status.js, coarse_validation.js, accuracy3d.js, shading_consistency.js) differed from the committed ones only in their timestamps (checked with the timestamps stripped) and were restored; `docs/ground_detail/round6e/results_6e.json` (rewritten by `ui_round6e` without `--base`) differed only in frame times and the wheel-track pixel count (8,210 vs 8,109, which depends on the rover path of the session) and was restored. `ui_round6e` was run without `--base` (the pixel comparison with the round 6C build needs a separate checkout; round 6D does not touch the 3D view, js/view3d*.js, js/engine.js or any data file).

### Round 6D - not done or limited

* Everything in Parts 1-4 was done; nothing was reverted.
* Periods of "both" are not listed as windows in the casefile (no such list exists in ASTERIA; adding one would be a new calculation).
* The casefile's Power section always uses the Explore window; the launch-slip summary needs the Launch slip tab to have been computed for the same site.
* Printing checked in headless Chromium only (computed print styles and a PDF export); not in Firefox/Safari or on a real phone (phones emulated).
* The anchors for the evidence links were added in Part 2 (they were needed there); Part 3 only lists them.

**Round 6D hand-over**: `data/version.js` stamped. No merge, no tag, no push; `master` unchanged.

## Round 6F - Crater realism, wider covering, "Choose your point -> 3D", larger mode buttons

Started 2026-11-15 about 13:05 Riyadh, time box 16:30. All round 6E rules kept: `js/engine.js`, DEMs, terrain files, vertex positions, heights, slopes, readouts, rover pose, pick rays, mini-map, status tiles, horizons and Sun/Earth directions unchanged; the covering is fragment-shader only, Walk/Rover only, Sun term only.

### Part 1 - Covering: reach and randomness - DONE

**a) Reach.** Confirming the fade by walking 1-2.4 km from the site found that it did **not** travel with the viewer: the shader used Three.js's built-in `cameraPosition`, which Three.js r149 uploads only for Shader/Phong/Toon/Standard materials - for the Lambert terrain material it stayed (0, 0, 0), i.e. the site. So in round 6E the 60-350 m fade was measured from the site marker (the owner's "craters stop appearing about 350 m away"), and with the first 6F constants the covering vanished for any camera more than about 1.7 km from the site (0 % of near-ground pixels changed, all view directions). Fixed (commit e2d9763) with a dedicated uniform `uCamW`, set from the rendering camera in `scene.onBeforeRender`; after the fix the covering is present near the viewer 2 km and 2.4 km from the site (86-90 % of the near-ground pixels change with it on/off at Medium; table in Part 4). The round 6E measurements (camera within about 25 m of the site) are not affected in practice. Now: no cut-off near the viewer; each octave and each feature fades only by its own screen-space size (dFdx/dFdy footprint, as before), and the whole covering fades gently between 1500 and 2000 m from the camera (`COVER_NEAR`/`COVER_FAR`). Choice by measurement: in Walk at Peak near Shackleton, ground near the viewer shows the covering at the site, 1 km and 2 km from it (Part 4 table); a 10 m craterlet (the largest, radius 5 m) facing the camera spans about 3-4 pixels at 2 km on the laptop canvas (pixel angle about 0.0013 rad), so beyond 2 km even the largest feature is near the pixel size and the fade removes nothing a viewer can resolve; on grazing ground the footprint fade removes it much earlier. No larger features were added: craterlet radius stays 0.1-5 m (`COVER_RMAX = 5`, below the 5 m / 20 m grid scale; source-checked by the test), so far ground keeps exactly the LOLA appearance.

**b) Randomness.** Rewritten feature code (`asFeat`/`asProf` in `COVER_GLSL`): per craterlet random ellipticity (aspect 1.0-1.3) and orientation; rim radius (±10 %) and rim height (0-1.7 x, partly broken) modulated by low-frequency noise around the rim (harmonics 1-4 with random phases); degradation state s = u³ (most old: depth about 0.02-0.04 R, rounded crest, rim about 0.006-0.01 R, nearly rimless; fresh: depth up to about 0.48 R, sharp crest, narrow rim, and for the freshest ~5 % a bright halo of up to +10 % albedo to 1.8 R); random depth/diameter (±25 %); interior albedo ±4 %; overlaps (two extra lattices of the 0.8-2.5 m and 0.3-1 m classes on laptops at Medium/High, plus the independent classes); each class on its own rotated and offset lattice with in-cell jitter, and a hash that changes permutation every 289 x 289 cells (the old one repeated every 289 cells), so no rows or columns line up (screenshot from above in Walk); rock flecks with irregular outlines (radius ±37 %), aspect up to 1.4 and brightness +5 to +25 %; the grain octaves are domain-warped (up to 4 m, 23 m wavelength) with a patchy strength (0.75-1.25). Gradients of the features are numerical (forward differences of the profile), linear in the shading as before. Still "tuned visually, not statistically matched".

**c) Performance.** Low and phones keep 5 octaves and lose the smallest fleck class and the two overlap lattices. Frame times below (Part 4).

### Part 2 - "Choose your point -> 3D" - DONE

**Architecture (safest option): offset start in the host site's existing scene.** A custom point inside a site's existing 3D terrain opens that site's 3D view unchanged - same tile, patch and ring meshes, heights, normal maps, Sun/Earth directions (computed at the site, as for the site itself), shadows, skyline, readouts and pick rays - and only the start positions move: the orbit target, Walk position (eye 2 m above the drawn ground there), Rover start (25 m east of the point) and a second, dashed "Your point" marker. Re-centring the scene on the point was rejected because it would change every vertex position and the validated frame. The point's ground coordinates (e, n) are the exact inverse of the view's `latLonAt` (round trip < 1 mm).

* **Coverage**: 6 km tile (Orbit, Walk, Rover) and the 32 km ring A (100 m grid; loaded at every quality level; Orbit only, Walk/Rover and the eye-level presets disabled with the reason "Walk and Rover need the 6 km tile ..."). Ring B (to 40 km) is loaded only at High, so it is not counted. 8 sites (7 distinct areas; the two Peak near Shackleton points overlap). A point in several areas uses the site whose tile contains it, else the nearest centre.
* **Status tiles** show the main view's values for the point (the point's own 240 m terrain horizon, or smooth horizon): state, Sun/Earth elevation, azimuth and horizon - equal to the 2D tiles (tested at two time steps). The drawn Sun/Earth and their label azimuths are the site's (the same directions in space; the panel note says so).
* **Outside every area**: Deploy is shown disabled with "3D terrain is available within about 16 km of the 8 sites with 3D terrain (blue squares on the map); this point is outside them." Curated sites without a 3D tile keep no Deploy button (unchanged). The coarse 240 m Orbit-only alternative was not built (disabled-with-reason preferred, as the brief allows).
* **Map**: thin blue outlines of the 16 squares (solid: tile; dashed: ring), not interactive; one legend line.
* **Getting started** step 3 (new) "Choose your point, then Deploy 3D" with a "Try it" button; **tour** step 4 of 6 (new), same spotlight style; other steps unchanged.
* **Share link**: `v3d=1` is written while the 3D view is open (any site) and reopens it; with `lat=`/`lon=` it reopens the custom-point 3D view.
* No new DEM data; `data/terrain3d/` unchanged.

### Part 3 - Mode buttons - DONE

The Orbit / Walk / Rover selector is a full-width segmented control (46 px tall, 16 px semibold text, 2 px border, selected = filled blue with an underline) under a small "View mode" heading, with 18 px above and 16 px below and separator lines; other panel controls unchanged. Tested on laptop and phone: visible, larger than the other panel buttons, clear selected state, no overlap with its neighbours, inside the panel.

### Part 4 - Verification

Screenshots: `docs/ground_detail/round6f/` - Walk close-up and from above (Peak near Shackleton), Walk 1 km and 2 km from the site, Rover at Peak near Shackleton and Mons Malapert, a custom point in Orbit / Walk / Rover, a point on the ring (Orbit only), the coverage outlines on the map, the tour step, the View mode selector (laptop and phone each), and two top-down views of the pattern (40 m and 150 m; Mons Malapert; covering forced on in Orbit for the screenshot only) showing no rows or columns. Numbers: `results_6f.json`; logs `tests/perf/round6f_*.log`.

**Reach (fade from the camera)** - share of the near-ground half of the picture that changes with the covering on vs off, Walk, Medium, Peak near Shackleton 2028-09-25 10:04 UTC (a sunlit view direction is chosen, since the covering modulates only the Sun term):

| Walk position | laptop | phone |
|---|---|---|
| at the site | 88.8 % | 81.6 % |
| 1 km from the site | 88.0 % | 80.2 % |
| 2 km from the site | 85.8 % | 89.7 % |
| before the uCamW fix, about 1.7 km and beyond | 0 % (any direction) | - |

**Fixes found by the verification** (each committed separately): (1) the camera-position bug above (e2d9763); (2) the first version of the feature code was inlined 24 times and made the first shader compile on Windows/D3D take 4.8-15.4 s (im1 laptop Low/Medium, cold browser); one loop over uniform arrays brought it back (a53bf56); (3) a D3D compiler warning (X4000) in the console - single return in `asProf` (9a06715); (4) the share link: the hash write on closing the 3D view is now synchronous (a delayed write undid a following hash change; 91eb489); (5) Getting started "Try it" scrolled late and moved the next step's panel out of view (9a06715).

**Tests** (all on the final code 9a06715 + docs, run one after another):

| Test | Result |
|---|---|
| `node tests/ui_round6f.js` (laptop + phone) | ALL PASS, 52 checks, no console errors: no feature class above 5 m radius (source); fade 1500/2000 m from `uCamW` (set in scene.onBeforeRender; cameraPosition unused); covering present near the viewer at the site, 1 km and 2 km; Walk/Rover frame time at Medium 1.8-4.2 ms (both 6E sites); coverage outlines (16) and legend; custom point in a tile: Deploy enabled, opens Peak near Shackleton's scene at the point (e, n within 1 m), status tiles = 2D tiles (state, el, az, horizon) at two time steps, Sun/Earth directions and vertex count = opening the site itself, Walk at the point (eye 2.00 m), Rover within 30 m; share link reopens it; ring point: Orbit only, Walk/Rover disabled with the reason, tiles = 2D; outside: Deploy disabled with the reason; curated site without a tile: no Deploy (unchanged); tour step 4 of 6; View mode selector (46 px, 16 px text vs 12.8 px, selected state, no overlap, 18/16 px spacing) |
| `node tests/ui_round6e.js --base <fe76cd6>` (laptop Low/Medium/High + phone) | ALL PASS (159): covering off pixel-identical to round 6C in every view; Orbit identical on/off; unlit pixels unchanged; ground mean -1.6 to +0.9 %; readouts, Sun/Earth, status tiles, rover identical |
| `node tests/ground_detail_6c.js --invariants --other base6c=<fe76cd6>` | INVARIANTS: PASS - 0 differences |
| `node tests/shading_consistency.js --no-write` (shadows on) | 97.8 / 99.0 / 99.8 % - unchanged |
| `node tests/tile_edge.js` | Medium +0.0 % / -4.3 % - unchanged |
| `node tests/perf3d.js --phone --quality low,medium,high` | laptop Medium first frame <= 678 ms (all 8 sites), phone Medium <= 427 ms; 59-60 fps in every row except one laptop Medium row at 51 fps (Peak near Shackleton, 3.5 ms/render - far above 30 fps) |
| cold first frame, `perf3d --quality low,medium --sites im1,peak_shackleton`, two runs each, pre-6F (a818366) vs 6F | im1 Medium: pre-6F 1412 / 569 ms, 6F 629 / 1812 ms; Peak near Shackleton Medium 312 / 292 vs 315 / 338 ms (`round6f_perf_compare.log`). The very first compile on this machine varies a lot with and without 6F; one 6F run exceeded 1.5 s for im1 (the first site compiled) - see limits |
| `ui_check`, `ui_round5`, `ui_round6`, `ui_round6b`, `ui_round6c`, `ui_round6d` (laptop + phone) | all pass, no console errors or warnings (updated for 4 Getting-started steps and 6 tour steps; ui_round6b prints the full CSV header on failure) |
| Node: features_test, view3d_test, validate, earth_orientation, blind_test, one_year_check, instant_status_check, illumination, coarse_validation, accuracy3d | all exit 0 (result files differed only in timestamps; restored) |
| Python: `tools/terrain3d.py check`, `tools/terrain3d_ext.py check`, `tools/terrain.py check` | pass |

`ui_round6e` rewrites the round 6E screenshots and `results_6e.json`; they were restored (round 6E's record).

### Round 6F - not done or limited

* **Performance gate, cold first compile**: laptop Medium first frame was 193-678 ms for all sites in the final perf3d run, but the very first shader compile of a fresh browser varies (pre-6F code too: 569-1412 ms for im1); one of two 6F cold runs gave 1812 ms for im1. Making the loops fully dynamic would cut this further but needs WebGL2-only shader syntax, so it was not done in this round.
* **Custom-point 3D** covers the 6 km tile and the 32 km ring A only (ring B is High-only); no 240 m coarse Orbit view. The drawn Sun/Earth/skyline/shadows are the site's; the point's own 240 m horizon is used for its status tiles but not drawn. Walk/Rover only on the tile.
* **Randomness** is tuned visually, not statistically matched; at the low polar Sun most craterlet interiors are dark whatever their depth (the bounded Sun-term factor saturates), so old and fresh craters differ mostly in rim, size and halo.
* The round 6E statement "full strength within 60 m of the camera" was wrong in practice (it was measured from the site); corrected here and in design decision 15.
* Devices: headless Chromium on the development laptop; phones emulated; not tested on a real phone, Firefox or Safari.
* Commits: Part 1, Part 1 fix (camera), Part 2, Part 3, Part 1 fix 2 (compile time), Part 2 fix (hash), fixes (warning, scroll), Part 4. The About text of design decision 15 went into the Part 2 commit (index.html), DESIGN_DECISIONS.md into Part 4.

**Round 6F hand-over**: `data/version.js` stamped. No merge, no tag, no push; `master` unchanged.



## Round 6G - Launch slip heatmap did not follow the current point (bug fix)

**Owner report**: the Launch slip heatmap was "inaccurate in several areas", did not respond to the latest selected point and needed a page refresh.

### 1. Reproduction (before the fix, headless Chromium, laptop 1366 × 900 and emulated phone 390 × 844)

Start: Peak near Shackleton best-lit point (A), 2028-09-25 10:04 UTC, heatmap computed (14-day mission, slips 0-60 days). Then each change, then the Launch slip tab; every heatmap cell (all 7 metrics × 61 landing dates) compared with a fresh page load for the new point (exact equality):

| Sequence | Heatmap after the change | Legend / line chart / summary | Casefile slip section |
|---|---|---|---|
| 1 site B (Mons Malapert) from the site list | **A's result** (all cells differ from B) | name A | pointer (correct - it already refused a result for another site) |
| 2 custom point by a map click | **A's result** | name A | pointer |
| 3 custom point, Deploy 3D, close | **A's result** | name A | pointer |
| 4a share link to B with `tab=slip` (hash change) | **A's result** | name A | - |
| 4b share link to B without `tab` while the Launch slip page is open | **A's result** | name A | - |
| 4c share link to a custom point with `tab=slip` | **A's result** | name A | - |
| fresh page load of a custom-point share link with `tab=slip` | **no heatmap at all** (the run started before the point existed and did nothing) | - | - |
| Explore start time changed | the nominal landing input kept the old date (it was filled only once) | - | - |

Every sequence failed on both laptop and phone; no console errors (the page looked fine, which is why it read as "inaccurate in several areas").

### 2. Cause and introducing commit

* **Stale cache, never invalidated.** `showPage('slip')` ran `if (SLIP.res) renderSlip(); else runSlip();`. `SLIP.res` was cleared only by a change of the minimum link elevation; a new point, start time, horizon (terrain on/off) or a share link left it in place, so the first result was redrawn for every later point. Introduced in the original heatmap commit **5b16663** ("Parts C-E: launch-slip heatmap ...", 14 Nov 2026) and present unchanged in `v1-stable`; **not** introduced by round 6D or 6F (6D's casefile already checked the site and horizon and so showed the pointer instead of wrong numbers; 6F's `onClose` hash write and "Try it" code are not involved - sequence 3 fails only because the point changed).
* **No request token.** Worker replies are matched to their request by id (js/jobs.js), so they cannot cross, but the app wrote `SLIP.res` from whichever run finished; with two runs in flight the older one could land last. (Before 6G nothing started a second run automatically, so this was latent.)
* **Custom-point share link to the Launch slip tab**: `applyHash` opened the tab before the point's 240 m horizon job had finished, so `runSlip` had no point.

**Values for the correct point**: none wrong. After the fix every sequence equals a fresh load exactly, and for B and the custom point the heatmap's slip 0 equals the Explore metrics for the same 14-day window exactly (pctSun, avgSunFrac, pctEarth, pctBoth, longestDarkH, longestBlackoutH, samples). The wrong numbers were always another point's correct result shown under the current point. The calculation (`slip` job, engine) is unchanged.

### 3. Fix (js/app.js, index.html, css/style.css; engine, horizons, status logic, terrain data and the launch-slip calculation unchanged)

* Each result records the inputs it was computed for (`key`: site mode, point(s) with coordinates and horizon type, nominal landing, duration, slip range and step, minimum elevation; plus the horizon arrays themselves, compared value by value). `slipFresh()` is true only when they equal the current inputs.
* Every change of point, Explore window, horizon or minimum elevation (`recompute()`) and every Launch slip input change calls `slipInputsChanged()`: on the visible Launch slip page the heatmap is **recomputed automatically** for the new point; elsewhere the old heatmap, line chart and summary are **hidden** and the page shows **"Out of date - recompute for <point name>"** with a Recompute button (recomputed automatically when the tab is opened). An edited Launch slip input (e.g. mission days) shows the out-of-date state until Compute/Recompute.
* **Request token**: every run takes `++SLIP.tok`; a reply for an older token is discarded (counted in `slipDebug().discarded`) and never writes `SLIP.res`.
* **Header** above the heatmap: "Computed for <point> (lat, lon; horizon) · nominal landing <UTC> · N-day mission · slips +a to +b days every s day(s) [· Earth link ≥ x°]" - always from the result itself.
* **Nominal landing** follows the Explore start time (as a fresh load does) unless it was set on the Launch slip page or a heatmap square was clicked (then it is kept, so returning to the tab shows the same analysis).
* **Casefile**: section 8 uses the slip result only if it is current (`slipFresh`), for the casefile's point and horizon (horizon arrays equal), minimum elevation, and its nominal landing equals the casefile's window start; otherwise the existing pointer to the Launch slip tab.
* **Other per-point results checked**: Power page - rerun when it is visible and the point/window changes (a share link without `tab` used to leave the old point's result), and given a request token; Timeline, Sky view, status tiles and windows already use the Explore token (`S.token`) and are recomputed by `recompute()` - not affected (tested indirectly: the slip-0 = Explore checks and every UI suite); Compare scenarios are explicit site/date pairs, independent of the current point - not affected (a Compare change marks an "All sites in Compare" heatmap out of date through its key).

### 4. Tests

`node tests/ui_round6g.js` (laptop + phone; sequences 1, 2, 3, 4a, 4b, 4c, Explore start, terrain off, minimum elevation 5°, fresh custom-point link with `tab=slip`): after every change the heatmap equals a fresh load for the new point and window exactly (all cells, legend, line chart, summary, header) or shows the out-of-date state with the old heatmap hidden; casefile summary = the result for its point and window, or the pointer; Launch slip input change → out of date → Recompute; a nominal set on the page is kept; stale replies discarded (a run for A overtaken by a share link to B; two runs back to back); slip 0 = Explore metrics (B, custom point); Power page follows a share-link change; no console errors.

**Test run** (final code 2b5936d, run one after another or in three parallel groups on the development laptop):

| Test | Result |
|---|---|
| `node tests/ui_round6g.js` (laptop + phone) | ALL PASS, 68 checks, no console errors |
| `ui_check`, `ui_round5`, `ui_round6`, `ui_round6b`, `ui_round6c`, `ui_round6d`, `ui_round6f` (laptop + phone) | all exit 0, no FAIL lines |
| `node tests/ui_round6e.js --base <checkout of fe76cd6>` | ALL PASS |
| `node tests/shading_consistency.js --no-write` (shadows on) | 97.8 / 99.0 / 99.8 % - unchanged, 0 unexplained |
| Node: features_test, view3d_test, validate, earth_orientation, blind_test, one_year_check, instant_status_check, illumination, coarse_validation, accuracy3d | all exit 0 (result files differed only in timestamps/run times; restored) |
| Python: `tools/terrain3d.py check`, `tools/terrain3d_ext.py check`, `tools/terrain.py check` | pass |

Screenshots and result files rewritten by ui_round6e/6f were restored. Not run this round: perf3d, tile_edge, ground_detail invariants (the 3D code is unchanged in 6G).

### Round 6G - not done or limited

* A discarded run is not cancelled inside the Web Worker; after quick point changes the newest heatmap waits for the older runs (see GAPS section 15).
* Headless Chromium only; phones emulated.

**Round 6G hand-over**: `data/version.js` stamped. No merge, no tag, no push; `master` and `v1-stable` unchanged.



## Round 6H - Map usability, Explore first screen, guided-step navigation, site inventory

**Owner feedback**: (1) zooming out no longer showed the full map extent; (2) the main sites were hard to select near custom points and the 3D-coverage outlines; (3) the Explore tab had grown - the "Verified against NASA data" card should be visible without scrolling; (4) every introduction / Getting-started / tour step must take the reader to the place it describes; (5) report site/point data not shown on the map. Rules kept: `js/engine.js`, validated values, horizons, status logic, terrain data, the projection and every calculation unchanged; AI disclosure unchanged (round 6E text); no information removed (secondary text moved into expandable sections).

### Part 1 - Map extent - DONE (218e687)

**Cause.** The zoom code in `js/map.js` is identical in `v1-stable` and `round6` (minimum zoom = "cover" zoom since round 2C, aecf384: the data square fills the map box, its side = the box's longer side). What changed is the **map box**: it stretches to the height of the Site Card next to it, and **3b27576** (round 6D Part 2, "Mission casefile" button on the Site Card) made the Site Card - and so the map box - 58 px taller (749 -> 807 px; 784 px at 837d6ce). Measured in headless Chromium (map box w x h):

| Window | v1-stable (= 3b27576^) | 3b27576 | 837d6ce (before 6H) | after 6H |
|---|---|---|---|---|
| 1366 x 768 | 771 x 749 at y 128 (bottom 877, already below the window) | 771 x 807 (taller than wide: the cover zoom cropped the square's sides by 19 px) | 771 x 784 | 690 x 446, bottom 574 |
| 1440 x 900 | 816 x 749, bottom 877 (whole map on screen) | 816 x 807, bottom **935** (below the window) | 816 x 784, bottom 912 | 730 x 578, bottom 706 |
| phone 390 x 844 | 344 x 460 (cover zoom crops 59 px left and right) | same | same | same box |

So at 1440 x 900 the bottom of the map (and with it part of the data square) left the window with 3b27576, and on every size the minimum zoom could never show the whole square on a non-square box.

**Fix.** Minimum zoom = **contain zoom** (the whole data square fits the map box; side = the box's shorter side); a new **"Show all"** control (house icon, under the zoom buttons) fits exactly that. The first view and "Whole pole" are unchanged (the square fills the box, pole centred, no area outside the data). Panning is still limited to the data (`maxBounds`, viscosity 1; round 2b): at the minimum zoom the square is held centred and the strip beside it is the existing hatched "no data" area with the orange "Edge of the map data" outline; at any larger zoom no area outside the data can be panned into view; a click outside the data still shows "No elevation data here ...". Leaflet snapped every zoom to 0.5 before clamping, so a pan at the fractional minimum zoom re-snapped it upwards (0.41 -> 0.5 on a phone: the full extent was lost again) - a zoom equal to the minimum or to the current zoom is now kept as it is. Part 3 brings the map box back inside the window on laptops.

### Part 2 - Markers and selection - DONE (1f54ccf)

* Site markers: same shapes and colours (white mission/published point, dashed derived point, violet Artemis diamond, pink reference, numbered group), visual 18-22 px (was 13-18 px), clickable box **34 px** with a mouse and **44 px** on touch screens / phones (was 18 px).
* Order: markers are in Leaflet's marker pane above the 3D-coverage outlines (overlay pane, `interactive: false`, so they never take a click) and above the custom-point marker (`zIndexOffset`). A click inside a site's box selects the site even when a custom point or an outline is under it; a click anywhere else places a custom point (tested next to a custom point and where an outline crosses a marker's box).
* Custom point: a small amber crosshair (14 px, not clickable) instead of a white ring; legend line "Your point (map click)".
* Labels: every marker gets a short label (name without the "(...)" / " - ..." part; the selected site shows its full name, or the short one if the full one does not fit), placed right, left, above or below where it overlaps no other label, marker or map control and stays inside the map; otherwise it is left out (the name still shows on hover / focus, and in the site list). Laid out again after every pan/zoom (not while a group's list is open).
* Keyboard: markers were already focusable (Tab), but Enter did nothing for a single site (Leaflet 1.9 maps Enter only to popups; same in `v1-stable`) - Enter or Space now selects it; Space also opens a group's list (Enter already did).

### Part 3 - Explore first screen - DONE (310d2e5)

At laptop widths (> 1180 px) `fitHero()` sizes the map + Site Card row to the window (480-1000 px tall) so that the row and the **"Verified against NASA data" card** below it fit without page scrolling; the Site Card column is wider (1.2fr : 1fr) and compact:
* Deploy note beside the Deploy button; the three status tiles side by side (state 1.2 rem instead of 1.45 rem, count 0.86 rem - no text below the page's smallest size, .66 rem).
* Moved into expandable sections (nothing removed): the tiles' "Why it matters" lines -> **"Why these matter"**; the map layer notes -> **"About this layer"** (colour bars and the marker key stay visible); the custom-point reliability note -> **"How reliable is this point?"** (the kind line above it still says which horizon is used).
* "Mission casefile" button moved up beside "Choose a site" (it was on its own row under the jump buttons).
* On the compact card the tiles' search-limit explanations (Explain mode, only when a countdown says "Not within the next N days (search limit)") are shown once under the tiles in an expandable **"Why "not within the next … days"?"** (same text, prefixed with the tile name) instead of inside each narrow tile; long countdown text wraps inside its tile (it overflowed into the next tile in the first version of this part).
* Checked for every curated south-pole site, two reference sites and a custom point at 1366 x 768 and 1440 x 900: the Site Card content fits without scrolling inside the card (fix commit after Part 4).
* Not applied in Expert view (the card then shows every technical value at full length; the page scrolls as before) or below 1181 px (one column).
* Phones: map, then the Site Card (site, time, **status tiles**, why, jump/casefile, then Deploy - moved after the tiles with CSS `order`), then the Verified card.

Screenshots: `docs/ui_round6h/before_explore_{l1366,l1440,phone}.png` (837d6ce) and `after_explore_*.png`; also `map_showall_*`, `markers_*`, `tour1_*`, `tour4_*`.

| | 1366 x 768 before | after | 1440 x 900 before | after |
|---|---|---|---|---|
| status tiles | 2 of 3 fully visible | all 3 | stacked in the Site Card | all 3 |
| Verified card | below the window (scroll needed) | fully visible | below the window (scroll needed) | fully visible |
| map box | 771 x 784 (bottom off-screen) | 690 x 446 | 816 x 784 (bottom off-screen) | 730 x 578 |

### Part 4 - Guided steps navigate - DONE (13b8629)

One guide function (`guideTo`) for Getting started and the tour: switch to the step's tab, open collapsed `<details>` around the target, scroll inner scroll areas (the Site Card on laptops) and the page so the target lies between the top bar and the step box (top-aligned when taller than that space; smooth, instant with prefers-reduced-motion; while a step is shown there is extra space below the page so targets near its end can clear the box), and spotlight it (`.tour-hl`).

| Step | Goes to | Set-up |
|---|---|---|
| Getting started 1 - the map | Explore, map panel | whole map extent ("Show all"); button "Show the whole pole" now also shows the whole extent |
| Getting started 2 - status tiles | Explore, the three tiles (was the whole Site Card) | - |
| Getting started 3 - Choose your point, then Deploy 3D | Explore, map panel | map moved to the blue 3D squares near Peak near Shackleton; button **"Take me there"** (was "Try it") places the example point and guides to Deploy |
| Getting started 4 - Go deeper | Explore, Sky view | (buttons unchanged) |
| Tour 1-6 | map (whole extent), Sky view, Earth link panel, Deploy row (example custom point selected), Launch slip heatmap, Power verdict | each step already selected its site/point and computed its numbers; tab switch, scrolling and spotlight now through `guideTo` |

A step opened from another tab switches back to its tab. The round 5 spotlight points at the Tour button in the top bar (page scrolled to the top; unchanged); the first-visit intro (`js/intro.js`) is a title card that describes no place.

Also fixed while testing: "Show on 2D map" (3D view) kept its point exactly centred only until the layout resize that follows closing the 3D view (Leaflet's pan path truncates the offset to whole pixels; 4 m off at zoom 7; found by ui_round6) - now re-centred with a reset view.

### Part 5 - Site inventory (report only; nothing added or removed)

"On 2D map" = drawn as a marker on the south-pole map. The map covers the LOLA tile square (about 80°S on the axes, 76°S in the corners; `AsteriaMap.inData`).

**A. Curated sites (`data/sites.js`, 19 entries)**

| Site (id) | Lat, E-lon | Source | On 2D map | Used in | Why |
|---|---|---|---|---|---|
| IM-1 Odysseus (im1) | -80.13, 1.44 | LROC image 1360 | yes | Explore, terrain horizons, 3D, illumination, instant status, blind test, coarse validation, Compare, Launch slip, casefile | inside the map |
| IM-2 Athena (im2) | -84.7906, 29.1957 | LROC 1408 | yes (grouped with Mons Mouton when zoomed out) | same | inside |
| Peak near Shackleton (peak_shackleton) | -88.79, 124.5 | Mahanti et al. 2024 (PSJ 5, 62) | yes (grouped with the derived point when zoomed out) | same + PGDA cross-check, tour, Getting started | inside |
| Peak near Shackleton - best-lit point, derived (peak_shackleton_lw) | -88.7851, 124.3438 | derived by ASTERIA (LOLA + PGDA 69 + Mahanti) | yes | same; default site | inside |
| Nobile Rim 2, site DM2 (nobile_rim2_dm2) | -84.20156, 60.69989 | Peña-Asensio et al. (arXiv 2406.19863) | yes | same | inside |
| Mons Mouton, landform centre (mons_mouton) | -84.60, 31.00 | IAU Gazetteer 16070 | yes | same | inside |
| Mons Malapert, landform centre (mons_malapert) | -85.98, -1.67 | IAU Gazetteer 16338 | yes | same | inside |
| Shackleton crater centre (shackleton_centre) | -89.67, 129.78 | IAU Gazetteer 5450 | yes | same | inside |
| Apollo 11, 12, 14, 15, 16, 17 | 0.67416, 23.47314 / -3.0128, -23.4219 / -3.64589, -17.47194 / 26.13239, 3.6333 / -8.9734, 15.5011 / 20.1911, 30.7723 | NSSDC | no | site list, Explore (smooth horizon), Compare, Launch slip; Apollo 11 in tour step 2 and the Horizons angle checks; Apollo 15 in the angle checks | outside the south-pole map; the map note says so when one is selected |
| Chandrayaan-3 (Vikram) | -69.3741, 32.32 | LROC 1314 | no | site list, Compare; Horizons event check | 69°S: outside the map data |
| Chang'e-4, Chang'e-6 | -45.457, 177.589 / -41.6385, 206.0148 | LROC 1087 / 1374 | no | site list, Compare; Chang'e-4 in the angle checks and the far-side sanity test | outside |
| SLIM, Blue Ghost Mission 1 | -13.316, 25.251 / 18.5623, 61.8103 | LROC 1358 / 1407 | no | site list, Compare | outside |

**B. NASA Artemis III candidate regions (`LUNA_ARTEMIS_REGIONS`, 9)**: Malapert Massif, Mons Mouton and Nobile Rim 2 are shown through their points above. **Peak near Cabeus B, Haworth, Mons Mouton Plateau, Nobile Rim 1, de Gerlache Rim 2, Slater Plain**: listed by name only (site list, About, tour text) - NASA publishes the boundaries only as images, with no coordinates; crater-centre points were removed in round 2 because a crater centre is not inside a rim, peak or plain region.

**C. Points in other data files (none shown on the map)**

| Data | Points | Used in |
|---|---|---|
| `validation.js` angle checks | "Near south pole (test point)" -89.5, 0 (synthetic); "Polar test point near Shackleton" -88.8, 123.4 (test geometry); "East limb test point" 0, 88; Apollo 11, Apollo 15, Chang'e-4 | JPL Horizons comparison (Validation page, VALIDATION_REPORT.md) |
| `validation.js` sanity tests | 20 seeded random points 60-90°S (e.g. -63.8852, -42.4320; -88.8353, 136.2311) | Sun-elevation sanity test |
| `validation.js` / `blind_test.js` blind cases | Nobile Rim 2, Mons Mouton, Peak near Shackleton, IM-1 at random times | blind test (the sites themselves are shown) |
| `one_year_check.js` | custom point -70.9457, 67.9235 | one-year hourly Horizons check (outside the map data) |
| `coarse_validation.js` | the 8 sites + 50 random points 85-89.3°S | validation of the 240 m terrain for clicked points |
| `illum_crosscheck.js` | the 8 sites + 317 grid points within about 500 m of the published Peak near Shackleton point | PGDA cross-check; choice of the derived best-lit point |
| `illumination.js`, `instant_status.js`, `accuracy3d.js`, `data/horizons/`, `data/terrain3d/` | the 8 sites (accuracy3d: 20 rover/inspection positions inside their 3D tiles) | Validation, 3D, tests |
| `data/terrain3d/features.js` | 15 IAU named features near the sites (Shackleton, Slater, Nobile, Malapert A, Mons Mouton, Haynes, Oberbeck, Scott M, Jaci, Masina, Dawa, Lhamu, Floss, Spudis, Marvin) | labels in the 3D view only |

**Recommendations (owner decides; nothing changed):**
* **Keep the 11 reference sites hidden on the 2D map**: they lie outside its data (69°S to 26°N). They stay selectable from the site list, where the map note explains that they are outside the map.
* **Keep test, random and grid points hidden** (validation, sanity, coarse-validation randoms, PGDA grid, the one-year custom point): they are test inputs, not sites, and about 400 extra points would bury the 8 sites; they are documented on the Validation page and in VALIDATION_REPORT.md.
* **Keep the 6 name-only Artemis III regions hidden** until NASA publishes coordinates or a sourced point inside each region exists (plotting a guess would break the round 2 rule).
* **Could be shown (optional)**: the 15 IAU feature names from the 3D view as small text labels on the 2D map at closer zooms (published Gazetteer coordinates). Not done: it adds clutter near the sites and was not requested.

### Part 6 - Tests - DONE

`tests/ui_round6h.js` (new; laptop 1366 x 768, laptop 1440 x 900, emulated phone 390 x 844): first view filled with data; zooming out reaches the contain zoom with the whole square in the box; panning at the minimum zoom keeps it whole (no re-snap); at a larger zoom panning shows no area outside the data; "Show all" control fits the whole extent; outside click -> message, nothing selected; marker box >= 32 / 40 px and visual >= 16 px; a click just outside a marker's box places a custom point (crosshair, under the marker, not clickable) and a click inside the box near its edge selects the site; the 16 coverage outlines are not interactive and, where one crosses a marker's box, the marker is on top and a click selects it (or opens its group list); labels never overlap another label or a marker (whole pole and zoomed; font >= 12 px); focus + Enter selects a marker; Explore first screen (laptops: map, site selector, Site Card essentials, three tiles and the full Verified card inside the window at scroll 0, no scrolling inside the card; phone: map, tiles, Verified card in that order); every Getting-started step (4) and tour step (6) on its tab with its target highlighted, its top below the top bar and above the step box and at least 75 % of the visible space used; "Take me there"; a step started from the About tab switches back; reduced motion scrolls at once; no console errors.

Older tests changed only where they hard-coded the old layout or step behaviour:
* `tests/ui_round6.js`: Getting started step 2 highlights the tiles (`statusTiles`, was `siteCard`); step 3's button is "Take me there: ..." (was "Try it: ...").
* `tests/ui_check.js`: the first-load fit check runs with Getting started open, whose step 1 now shows the whole data square (checked as "whole square visible"; the filled first view without Getting started is checked in ui_round6h); the search-limit explanation may be in the new section under the tiles on the compact laptop card.

Also found by the suites and fixed: the first-visit Getting started, scheduled 600 ms after load, now re-checks that it was not dismissed in the meantime (it now switches to its tab, which pulled a reader who had already moved on back to Explore; found by ui_check); "Show on 2D map" centring (ui_round6, above).

**Test run** (final code, headless Chromium on the development laptop; UI suites re-run after the last Site Card change):

| Test | Result |
|---|---|
| `node tests/ui_round6h.js` (l1366, l1440, phone) | ALL PASS, 102 checks, no console errors |
| `ui_check` | UI CHECK PASS, 187 checks, no console errors or warnings |
| `ui_round5`, `ui_round6`, `ui_round6b`, `ui_round6c`, `ui_round6d`, `ui_round6f`, `ui_round6g` | all pass (73, 52, 54, 24, 136, 52, 68 checks), no FAIL lines |
| `node tests/ui_round6e.js --base <checkout of fe76cd6>` | ALL PASS (159) |
| `node tests/shading_consistency.js --no-write` (shadows on) | 97.8 / 99.0 / 99.8 % - unchanged, 0 unexplained |
| Node: features_test, view3d_test, validate, earth_orientation, blind_test, one_year_check, instant_status_check, illumination, coarse_validation, accuracy3d | all exit 0 (result files differed only in timestamps and run times; restored) |
| Python: `tools/terrain3d.py check`, `tools/terrain3d_ext.py check`, `tools/terrain.py check` | pass |

Screenshots and result files rewritten by ui_round6e / ui_round6f were restored. Not run: perf3d, tile_edge, ground-detail invariants (3D code unchanged in 6H).

### Round 6H - not done or limited

* At the smallest zoom on a non-square map box the hatched no-data strip beside the square is visible (needed to show the whole extent; panning is still limited to the data).
* Labels that do not fit are left out (name on hover/focus and in the site list); close sites are grouped when zoomed out.
* Phones: the status tiles are about 1.5 screens below the top (after the map, site name and time); the Verified card follows the Site Card.
* The compact Site Card is sized for laptop windows of at least about 1181 x 700; Expert view keeps the long card (page scrolls).
* Headless Chromium only; phones emulated; not tested on a real phone, Firefox or Safari.
* Site inventory: report only; no site, point or region added, removed or changed.

**Round 6H hand-over**: `data/version.js` stamped. No merge, no tag, no push; `master` and `v1-stable` unchanged.

## Prompt 7: "About this rover" button, performance check before merging round 6

**Step 0**: a compact "About this rover" button in the 3D view, top-left directly below the "Vertical scale ... (true scale)" badge, shown only in Rover mode. It opens/closes the existing "About this rover" section of the panel (one copy of the text and sources; if the panel is hidden it is shown first; the panel scrolls to the section). The message column (button, Sun-hidden banner, tip) is placed below the badge also when the badge text wraps; the button is an obstacle for the 3D label layout. `tests/ui_round7.js` (1366 × 768, 1440 × 900, phone 390 × 844; Peak near Shackleton and Connecting Ridge): 32 checks per viewport pass, no console errors. Screenshots `docs/ui_round7`. Seen while checking, not changed: on the phone the off-screen "Earth" edge label can sit on the shadow note at the bottom (the note is not a label-layout obstacle; same before this step).

**Performance** (laptop 1440 × 900, `node tests/perf3d.js --quality low,medium,high`, 8 sites, run twice in a row; raw `tests/perf/p7_run1.json`, `p7_run2.json` and `.log`):

| Quality | Run | Orbit FPS (min-max) | Render ms (avg) | Deploy → first frame ms (avg; range) | → full terrain ms (avg) |
|---|---|---|---|---|---|
| Low | round 6 final | 60 | 0.9 | 237 (179-371) | 278 |
| Low | round 6E final | 60 | 1.4 | 321 (220-689) | 378 |
| Low | round 6F | 60 | 0.9 | 263 (155-659) | 323 |
| Low | prompt 7 run 1 (cold) | 60 | 1.0 | 282 (143-610) | 334 |
| Low | prompt 7 run 2 | 59-60 | 1.1 | 275 (155-590) | 324 |
| Medium | round 6 final | 60 | 3.5 | 334 (243-484) | 433 |
| Medium | round 6E final | 60 | 1.8 | 510 (310-815) | 653 |
| Medium | round 6F | 51-60 | 1.6 | 382 (207-678) | 466 |
| Medium | prompt 7 run 1 (cold) | 60 | 2.7 | 516 (231-1,767) | 462 |
| Medium | prompt 7 run 2 | 60 | 2.1 | 407 (216-743) | 519 |
| High | round 6 final | 59-60 | 2.9 | 243 (174-317) | 561 |
| High | round 6E final | 59-60 | 2.1 | 353 (223-524) | 998 |
| High | round 6F | 59-60 | 1.6 | 261 (185-331) | 620 |
| High | prompt 7 run 1 (cold) | 59-60 | 2.2 | 279 (184-363) | 660 |
| High | prompt 7 run 2 | 59-60 | 2.1 | 247 (172-300) | 632 |

The 1,767 ms in run 1 is im1 Medium, the first shader compile of a fresh browser (known to vary on this machine: round 6F 0.6-1.8 s); below the 2.5 s acceptance. In run 2 every Medium first frame is below 1.5 s (max 743 ms, im1) and orbiting is 59-60 frames/s at every site and level.

**Walk and Rover at Medium** (`node tests/perf_modes.js`, new; frames rendered by the 3D view while driving forward for 2 s, plus the GPU-synced render time; raw `tests/perf/p7_modes_medium.json` / `.log`): 60.0-60.8 frames/s in Walk and 60.2-60.5 in Rover at all 8 sites; 1.5-3.9 ms per render in Walk, 2.8-7.1 ms in Rover. One earlier attempt of this script timed out waiting for the first 3D view to open (im1, 90 s); the immediate re-run passed and is the one reported.

Gate met: merged into master.

## Prompt 7C: page stopped scrolling on Explore after the tour (bug fix)

Branch `scrollfix` from `master` (v2-candidate, c574530). Not changed: `js/engine.js`, calculations, data, horizons, status logic, terrain, results, the AI disclosure, the 3D view (`js/view3d.js`).

### 1. Reproduction (Playwright, Microsoft Edge 157 via channel "msedge", fresh profile, 1366 x 768 and 1440 x 900)

Sequence: Tour -> Next x 5 -> Finish (the tour ends on the **Power** tab, step 6 of 6, not Compare as reported; Compare was also visited) -> Compare -> Explore. Then a 300 px wheel at each place with the page at the top, and keys with focus where the sequence left it.

| Input (after the tour) | Before the fix | Cause |
|---|---|---|
| Wheel over the map | page did not move; the map zoomed (zoom 5 -> 3.5: the tour leaves the map zoomed in at its example point; at the minimum zoom nothing visible happens) | Leaflet `scrollWheelZoom` takes every wheel event over the map and cancels it |
| Wheel over the side card / status tiles | page did not move, and the card did not move either (it was not taller than its box) | CSS `.hero.fit .sitecard { overflow-y: auto; overscroll-behavior: contain }` (round 6H): a contained scroll box never hands the scroll to the page, even when it has nothing to scroll |
| Wheel over the top bar / page margins | page scrolled | - |
| Arrow Down / Page Down, focus on the clicked tab | page scrolled | - |
| Arrow Down after a click into the map | page did not move (the map panned) | Leaflet keyboard handler while the map has focus |
| Page Down after a click into the side card | page did not move (3 presses) | same `overscroll-behavior: contain` |
| Space on a focused tab button | page did not move (presses the button) | browser default for buttons |

On the laptop first screen (round 6H) the map and the side card cover almost the whole window, so the only places where the wheel reached the page were the top bar and narrow margins: the page "stops scrolling". The results were the same after the tour was closed with Esc or X, after it was skipped, and with no tour at all. The only difference was the map: the tour leaves it zoomed in at step 4, so wheel input visibly zooms it out first.

Guide state after Finish / Esc / X / Getting started: no `guiding` class (the round 6H 60vh bottom space is removed), no `.tour-hl`, step boxes hidden, no dimming overlay (`#spot` hidden, no `spot-on`), html/body overflow `visible`, no inline styles, and no preventDefault wheel/key listeners from the guide. One loose end: after **Finish** or **X** the focused button was hidden inside the closed box, so focus fell back to the page body.

### 2. Root cause

* (a) **Yes**: the Leaflet map captures the wheel (and the arrow keys when it has focus), and it now fills most of the first screen.
* (c) **Yes, as CSS**: `overscroll-behavior: contain` on the compact Site Card blocks wheel and keyboard scrolling from reaching the page.
* Together, (a) and (c) left almost no area of the first screen where the wheel scrolled the page.
* (b) **No**: the tour and guideTo leave no scroll lock, overflow, padding, overlay or focus trap behind. Only the focus was lost to the body when the box closed, and that is fixed too.

### 3. Fix

* `js/map.js`: a capture-phase wheel listener on the map container hands a plain wheel to the page and shows a short hint over the map for about 1.5 s: "Use Ctrl + scroll to zoom the map" ("Cmd" on a Mac). Leaflet never sees the event and nothing is cancelled.
  * Ctrl/Cmd + wheel zooms the map as before, and Leaflet stops the browser's page zoom. A touchpad pinch sends Ctrl + wheel, so it zooms the map.
  * After a pointer press inside the map (click, tap, drag), a plain wheel zooms the map until a press outside it (or until the window loses focus).
  * Arrow keys: Leaflet's behaviour is unchanged, so they pan only while the map container has focus (after a click into it) and otherwise scroll the page.
  * +/-, Show all, double-click, touch pinch and dragging are unchanged.
  * Test hook: `AsteriaMap.wheelState()`.
* `css/style.css`: `overscroll-behavior: contain` removed from the compact Site Card. The card still scrolls inside itself when its content is taller; at its end the scroll continues on the page. Hint style added (reduced motion: no fade).
* `js/app.js`:
  * When the tour or Getting started closes (Finish, Done, X, Esc, or a tab chosen by the user), focus that was in the box (or lost with it) goes to `<main>` (tabindex -1, no outline), not the map. Arrow keys, Page Down and Space then scroll the page.
  * A tab chosen by the user now closes an open tour or Getting-started step (its target is on another tab).
  * Getting started step 1 text updated.
* `js/explain.js`: map "?" text updated. TEXT_AUDIT.md lists the new and changed text.
* Optional phone "Earth" edge label vs shadow note: tried (shadow note added to the 3D label-layout obstacles) and **reverted**. On the phone Walk view the Sun and Earth labels then found no free place and fell onto other panels (`ui_round5` phone, 2 FAIL). The issue is left as it was (GAPS section 17).

### 4. Tests

`tests/ui_scroll.js` (new; Edge engine, l1366, l1440, phone 390 x 844; fresh profile per sequence) runs these sequences: the owner's sequence (tour to Finish -> Compare -> Explore), the tour closed with Esc, with X and by choosing a tab, and Getting started closed with Done and with X.

After each sequence it checks:
* No leftovers: bottom space, spotlight, step box, overlay, overflow or inline styles; focus is not in the map; the map is the topmost element at its centre.
* A plain wheel over the map, the side card / tiles, the side-card text and the top bar scrolls the page, and the map zoom is unchanged.
* The hint appears inside the map and goes away.
* Arrow Down, Page Down and Space scroll the page.
* No console errors.

After the owner's sequence it also checks:
* Ctrl + wheel zooms in and out without moving the page.
* A drag pans and activates the map; a plain wheel then zooms and Arrow Down pans.
* After a click outside the map, the wheel and Arrow Down scroll the page again.
* +/-, Show all and double-click still work.
* On the phone: touch pinch (CDP pinch gesture) and one-finger drag.

**265 checks, all pass.** On the unfixed master the same test fails at the first wheel over the map (it zooms instead of scrolling) and at focus after Finish.

| Suite | Result |
|---|---|
| `ui_scroll` (new) | 265 pass, 0 fail |
| `ui_check` | UI CHECK PASS, 187 checks, no console errors or warnings |
| `ui_round5` | 73 pass (after reverting the optional label change; with it: 71 pass, 2 FAIL phone, see above) |
| `ui_round6`, `6b`, `6c`, `6d`, `6f`, `6g`, `6h`, `7` | 52, 54, 24, 136, 52, 68, 102, 93 pass, 0 fail |
| `ui_round6e --base <checkout of fe76cd6>` | 159 pass |
| `shading_consistency --no-write` (shadows on) | 97.8 / 99.0 / 99.8 %, 0 unexplained (unchanged) |
| Node: features_test, view3d_test, validate, earth_orientation, blind_test, one_year_check, instant_status_check, illumination, coarse_validation, accuracy3d --python | all exit 0 (result files differed only in timestamps; restored) |
| Python: `tools/terrain3d.py check`, `tools/terrain3d_ext.py check`, `tools/terrain.py check` | pass (worst 0.049 m, 0.099 m) |

Older tests updated: none (no test used plain-wheel map zoom). The screenshots rewritten by ui_round6e and ui_round6f were restored.

The UI suites other than ui_round5 and ui_round7 ran while the optional 3D-label change was still in place. After the revert, `js/view3d.js` is byte-identical to master, and ui_round5 and ui_round7 (the 3D-label suites) were re-run on the final code. Not run: perf3d, tile_edge, ground-detail invariants (3D code unchanged).

Limits: Edge headless on Windows, phones emulated; not checked with a real touchpad, a real phone, Firefox or Safari.

Merged into master (fast-forward) and tagged `v2-candidate-b`; `v1-stable` and `v2-candidate` unchanged; nothing pushed.

## Prompt 7D: dark "crack" seams between terrain layers in Walk/Rover (display fix) + map popup contrast

Branch `seamfix` from `master` (v2-candidate-b, 41426c8). Not changed: `js/engine.js`, DEMs, terrain files, stored heights, top-surface vertex heights, slopes, inspection readouts, rover pose, pick rays, status tiles, horizons, Sun/Earth directions, the AI disclosure, the Prompt 7C scroll/wheel behaviour. Shortened at the end because of the deadline (see "Tests run").

### Cause (reproduced at the owner's point: Walk at -88.8095, 125.7699 E, High, facing the 5 m patch's east edge at e = +1000 m)
1. **Real gaps at the T-junctions.** Each coarser layer takes its hole-edge heights from the finer layer, but only at its own nodes. Between two coarse edge nodes the coarse edge is straight, while the finer edge follows its own grid (3 extra vertices per 20 m on the 5 m patch). That leaves a thin vertical slit. Measured on the pixels of the dark line: luminance **0**, and a raycast through them hits **no mesh**.
2. **The skirts did not hide the slits.** They were single-sided (from one side you saw the black sky through them). They hung *below* the ground, so with shadows on they always fell in the terrain's own shadow, and their normal-map coordinates were all (0, 0). Seen from the right angle they showed as a black line with a bright notch at the skyline.
3. **Border smoothing (secondary).** The smoothed DEM normal (±4 cells) of a layer's outermost vertices used heights linearly extrapolated beyond the grid. The outer bands of the 5 m patch and the tile blend fully to that normal at the edge.

Height step along each edge (true heights; "slit" = finer edge vertex minus the straight coarse edge; "product" = finer height minus the coarser product's own DEM height):

| Edge | Grids | slit sd / p95 / max (m) | product rms / max (m) |
|---|---|---|---|
| 5 m patch / tile (High) | 5 m / 20 m | 0.34-0.46 / 0.63-0.95 / 3.2-3.8 | 0.58-0.74 / 3.8-7.1 |
| tile / ring A (High) | 20 m / 50-100 m | 0.60-0.95 / 1.3-1.9 / 3.2-6.0 | 0.25-1.2 / 1.9-4.6 |
| tile / ring A (Low) | 40 m / 200 m | 1.9-2.2 / 3.7-4.5 / 6.8-10.6 | 1.2-1.9 / 4.6-9.1 |
| ring A / ring B (High) | 50-100 m / 200 m | 2.0-2.4 / 3.9-4.8 / 13-35 | 0.07-1.6 / 0.1-12 |

### Fix (display only)
* **Zipper strips** (`M.buildZipper`, layers `patch5m-seam`, `tile-seam`, `ringA-seam`). For each coarse edge segment, a fan of triangles over the finer edge vertices between its two ends fills exactly the slit. All vertices are copies of the two meshes' own edge vertices, so no height is new or moved. The strip lies in the vertical plane of the edge (zero area seen from above). It uses the finer layer's own material instance (so the finer layer wins), with its normals, normal-map coordinates and heights, drawn in both windings. It receives shadows like the finer ground and casts none, so the shadow-casting terrain is unchanged.
* **Skirts** are built from the layer's own mesh: the same top vertices, normals, smoothed normals, normal-map/AO coordinates, heights and slopes. Each uses a skirt variant of its layer's material: the same program and textures, with `uSkirt = 1`. The Sun's shadow is looked up at the skirt's top edge (`aTop`), and the skirt receives shadows exactly when its layer does. Skirts are drawn in both windings and get a small log-depth bias (+2e-6, about 3 cm at 1 km) so they never z-fight with the zipper or the ground.
* **Border smoothed normal:** the ±4-cell samples are clamped to the layer's own grid (one-sided at the border), with no extrapolation. Vertex normals and slopes are unchanged.

### Measurements (`tests/ui_seams.js`; Walk along / across each edge, Rover, a low Orbit view; shadows off and on; 5 sites x Low/Medium/High)
The band is the 3 pixels on the projected edge, compared with the ground 5-12 px to either side. Points are skipped where:
* the edge is hidden behind nearer ground (an edge point behind a gap is kept: that is a crack);
* the sides are not even ground at about the edge point's distance;
* the edge point's own ground faces away from the Sun (cos i < 0.05).

| | Build before the fix (41426c8) | Fixed build |
|---|---|---|
| tile / ring A (26 site/quality/shadow groups) | p05 0.39-0.76, black 0.2-13.6 %, single dark pixels 6.5-42 % | p05 0.89-0.97, black 0 %, dark pixels 0 % |
| 5 m patch / tile (High, 3 sites) | p05 0.59-0.68, black 0.4-4.4 %, dark pixels 7.9-13.5 % | p05 0.94-0.95, black 0 %, dark pixels 0 % |
| ring A / ring B (low Orbit) | p05 0.69-0.92, dark pixels 5-24 % | p05 0.98-1.05, dark pixels 0 % |
| owner's view (High) | p05 0.66, dark pixels 12.5 % | p05 0.85, dark pixels 0 % |

Ordinary ground scored the same way on parallel control lines gives p05 0.71-0.99. The fixed-build figures come from the full 5-site run before the final cos i filter and border-normal fix, and from the final run at the owner's site.

Pass rule (from these measurements):
* median band within 15 % of the darker side and of the brighter side;
* p05 >= 0.80;
* black (band < half the darker side) <= 0.5 %;
* single dark pixels <= 2 %.

Every edge combination of the build before the fix fails this rule; every one of the fixed build passes.

* **Unchanged** against `docs/ground_detail/seams/invariants_before.json` (recorded on 41426c8), 18 site/quality cases, 0 differences in the full run:
  * vertex position and height hashes of every top surface;
  * 459 inspection readouts, plus the owner's inspected point (-88.8164, 126.0967 E: 1535.26 m, 7.08 deg, 5 m patch);
  * rover pose and readout, status tiles, Sun/Earth directions.
* **Orbit** (60 / 9 / 3 km, 2 sites x 3 qualities): changed pixels (|dL| > 6) all lie within 4 px of a layer edge.
* **Performance** (Medium): warm first frame 72-136 ms; orbit / Walk / Rover 60 fps.
* Screenshots: `docs/ground_detail/seams/` (before_* = 41426c8, after_*, including the owner's view and close-ups).

### Map popup "N sites close together"
The site buttons had no text colour, so the page's `color-scheme: dark` gave them the browser's light button text on the light popup. They now have dark text: #10203a on #f2f5fa (measured 14.9:1); hover/focus #0a1628 on #d9e6f7 (measured 14.3:1), with a focus outline. New check in `tests/ui_round6h.js` (l1366, l1440, phone).

### Tests run (deadline: only the essential suites, one after another, no parallel GPU runs)
| Suite | Result |
|---|---|
| `ui_seams --sites peak_shackleton --quality medium,high --before <41426c8>` (owner's view, phone, Orbit diff, performance) | 23 pass, 0 fail: all judged seams pass; 0 differences in top-surface vertex/height hashes (78), 90 readouts + the owner's inspected point, rover, status, Sun/Earth; Orbit changes only along edges; warm Medium first frame 72 ms, orbit/Walk/Rover 60 fps; phone pass; no console errors |
| `ui_round6h` | 105 pass, 0 fail (incl. the new popup contrast check) |
| `ui_check` | UI CHECK PASS, 187 checks, no console errors or warnings |
| `ui_scroll` | 265 pass, 0 fail |
| `ui_round6e` (without `--base`) | 129 pass, 0 fail |
| `shading_consistency --no-write` (shadows on) | 97.8 / 99.0 / 99.8 %, 0 unexplained (unchanged) |
| `validate`, `accuracy3d`, `view3d_test` | exit 0 / ALL PASS (result files differed only in timestamps; restored) |

Not re-run for 7D (deadline): ui_round5, ui_round6, 6b, 6c, 6d, 6f, 6g, ui_round7, tile_edge, perf3d, perf_modes, the Python DEM checks and the full 5-site `ui_seams` matrix with the final rules.

Merged into master (fast-forward) and tagged `v2-candidate-c`; `v1-stable`, `v2-candidate`, `v2-candidate-b` unchanged; nothing pushed.
