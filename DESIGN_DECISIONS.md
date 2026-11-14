# ASTERIA - Design decisions

*Generated with Claude Code (Anthropic) under human direction. The same text is on the About page ("Design decisions").*

For each important engineering choice: what was chosen and why (plain language first), then the alternatives considered and how it was validated (technical detail).

## 1. Astronomy Engine with the IAU Moon orientation, not SPICE
**Plain language**: the positions of the Sun and Earth in the lunar sky come from a small open-source library that runs in any browser, so ASTERIA works offline from a single folder.
**Technical**: Astronomy Engine 2.1.19 (VSOP87 planets, Chapront-based Moon), the IAU/WGCCRE Moon rotation model, light-time correction and first-order stellar aberration, no refraction. SPICE (NAIF kernels: DE440 + the lunar PA frame) is more precise (it uses the Moon's physical librations from the ephemeris) but needs tens of megabytes of kernels and a native or WebAssembly toolkit. Validation against JPL Horizons (which uses those kernels): 52 angle comparisons, elevation within 0.0038° (azimuth 0.055° only with the Sun at 89° elevation); one year hourly at a custom point, elevation within 0.0028°; 10 blind cases within 0.0029°; 336/336 independent status decisions agree. These errors are hundreds of times smaller than the terrain effects ASTERIA shows.

## 2. Observer 2 m above the ground
**Plain language**: the horizon is computed for an eye or camera about as high as a lander's instruments, not for the bare ground, where a pebble would block the Sun.
**Technical**: 2 m is the observer height of NASA's PGDA average-illumination maps (product 69), which ASTERIA is checked against; 10 m was also computed for comparison (VALIDATION_REPORT.md, illumination cross-check). The 3D Walk view and the "Site eye level" preset use the same 2 m.

## 3. Sun up = the Sun's centre above the terrain horizon; power uses the visible disk fraction
**Plain language**: "Sun up" means the middle of the Sun is above the skyline. Solar power counts how much of the Sun's disk is actually visible, because a half-hidden Sun gives about half the power.
**Technical**: a centre crossing gives exact event times (1-minute refinement) and the same rule for the Sun and Earth. The disk fraction (Sun diameter about 0.53°) is used for power and for the comparison with NASA's maps, which average the visible disk fraction. The cross-check reports all three definitions (average disk fraction, centre up, any part up), so the difference is visible rather than hidden.

## 4. Terrain horizon: 1° azimuth mask, rays to 300 km
**Plain language**: for each site the skyline is measured in 360 directions, out to 300 km - far enough to include every mountain that can rise above the horizon at the pole.
**Technical**: `tools/terrain.py` ray-marches the LOLA DEMs with exact lunar curvature (spherical Moon, R = 1737.4 km), observer 2 m above the bilinear surface; the browser interpolates the mask linearly between whole degrees. Checked: the stored 1° mask vs the horizon computed at the exact azimuth of the Sun or Earth differs by at most 0.050° (mean 0.005°) in the instant-status check. Beyond 300 km a peak would have to be kilometres high to rise above the curvature drop (about 26 km at 300 km).

## 5. Which LOLA elevation data, at which resolution
**Plain language**: ASTERIA uses NASA's laser-altimeter maps of the Moon's south pole: the finest map that covers each place.
**Technical**: LDEM_85S_20M (20 m, 85°S to the pole) near the sites, LDEM_80S_80M (80 m) and LDEM_75S_120M (120 m) farther out and for sites near 80°S, LDEM_875S_5M (5 m, preliminary) for the 2 km patches of three sites in 3D. One product per grid (no mixing inside a grid, so no hidden seams). Every stored 3D grid point (14.5 million since round 6) is within 0.10 m of a direct sample of its source DEM (independent Python check).

## 6. 240 m data for clicked points, behind a validation gate
**Plain language**: you can click any point on the map and get a terrain horizon within seconds; it uses a coarser elevation grid so the browser can do it, and this was only switched on after it passed a test.
**Technical**: `tools/coarse_dem.py` makes a 240 m area-mean grid (8.8 MB, loaded on the first click); the Web Worker reproduces `terrain.py` on that grid to 1e-9°. The gate (`tests/coarse_validation.js`): curated sites differ from their 20 m horizons by 2.0 percentage points of sunlit time on average (6.9 at most; limits 5 / 10), and 50 random points in 85-90°S differ from NASA's 60 m map by 1.5 points on average (limit 5). Alternative considered: smooth-Moon horizons for clicked points (much worse at the pole) or shipping the 20 m DEM (hundreds of MB).

## 7. Sampling every 10 or 60 minutes, events refined to 1 minute
**Plain language**: the app checks the sky every 10 minutes (every hour for long periods) and then pins each sunrise, sunset, Earthrise and Earthset down to the minute.
**Technical**: a 10-minute scan (60 minutes for windows longer than 30 days) followed by bisection to 1 minute. At the pole the Sun's centre moves about 0.003° per minute, so a minute is about the size of the ephemeris error. Event times vs Horizons: within 0.76 min (4 events) and 1.42 min (24 events over a year, including the angle error). Windows shorter than one sampling step can be missed; this is stated in the app. Statistics come from the samples and are accurate to about one sampling step.

## 8. Tolerances used in the tests
**Plain language**: every test compares ASTERIA with an independent source and passes only within a stated limit.
**Technical**: angles vs Horizons: elevation within 0.1° and azimuth within 0.2° (relaxed as 0.2°/cos(el) above 80° elevation; observed elevation ≤ 0.0038°); event times within 2 minutes; Earth orientation within 1° (observed 0.155°); 3D heights within 1 m of the DEM (observed 0.10 m, the 0.1-0.2 m storage step); rover slope within the bound the storage step allows (0.20° at 20 m, 0.81° at 5 m); clicked-point terrain: 5 / 10 percentage points (curated sites), 5 points (random points vs NASA's map); status decisions: 100 % agreement outside a 0.05° "on the edge" band; 3D shading consistency must not decrease from one version to the next.

## 9. Power model assumptions
**Plain language**: the power calculator is a first-order estimate: sunlight strength, panel size, efficiency, panel angle and how much of the Sun is visible. It ignores dust, heat and wiring losses.
**Technical**: P = 1361 W/m² (IAU 2015 Resolution B3 nominal total solar irradiance) × (1 AU / d)² × area × efficiency × cos(incidence) × visible disk fraction; energy by the trapezoid rule on the samples; battery = load × longest darkness ÷ usable fraction. Not modelled: temperature, dust, degradation, conversion losses, light reflected from terrain, panel self-shadowing and height, battery efficiency (all listed in the app). A thermal/electrical model would need hardware-specific data a planner would bring.

## 10. 3D view: levels of detail and normal maps (round 6)
**Plain language**: the 3D view draws fine terrain near the site and coarser terrain farther away so it stays fast; where the far terrain is drawn coarsely, its shading still uses the finest real elevation data available there.
**Technical**: nested square meshes (5 m patch, 20 m tile, ring A to 16 km, ring B to 40 km) sharing their edge vertices; normal maps baked in the browser from the finest loaded LOLA grid (25 m from LDEM_85S_20M where it covers ring A; 100 m for ring B) - never finer than the grid; the amount of detail fades toward a coarser neighbour (mipmaps of real normals) instead of stepping. Geometry morphing between levels was rejected because it would move drawn vertices away from their DEM heights. A camera-centred second shadow map (same Sun direction and casters) sharpens near shadows; the picture uses the minimum of both maps, so it never lights ground the full map shadows. Validated by the height check, seam test and shading consistency (Low 97.8 %, Medium 99.0 %, High 99.8 %, unchanged).

## 11. The rover is illustrative
**Plain language**: the 3D rover has the size and shape of NASA's VIPER so you can judge scale, and it sits on the real terrain, but it does not simulate driving: ASTERIA does not predict whether a rover can cross a slope.
**Technical**: VIPER's published dimensions (2.5 m tall, 1.5 m × 1.5 m, four wheel modules; NASA); other sizes approximate and labelled. Each wheel rests on the LOLA surface and the body's pitch and roll follow from the four wheel heights (at the DEM's 5-20 m resolution, so the tilt is the DEM slope over about one cell). No traction, slip, power, wheel-soil or obstacle physics; the slope warning is only a user-set threshold on the DEM slope.

## 12. Earthshine as an optional, physically scaled light (round 6)
**Plain language**: in shadow, the only natural light near the pole is sunlight reflected by Earth. ASTERIA can add it with its real direction and strength, and shows it with a raised exposure like a long camera exposure.
**Technical**: strength = Earth's geometric albedo 0.434 (NASA Earth Fact Sheet) × (Earth radius / distance)² × the Lambert-sphere phase law at the computed phase angle (about 1/8,400 of sunlight at full Earth); off when Earth's centre is below the validated terrain horizon. Approximate to about a factor of 2 (clouds, Earth's real phase curve). Light reflected from sunlit terrain (which can be brighter) is not modelled. Display only.
