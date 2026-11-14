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
