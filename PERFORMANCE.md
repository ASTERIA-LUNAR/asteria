# 3D view performance

*Generated with Claude Code (Anthropic) under human direction.* Measured with `node tests/perf3d.js --phone` in headless Chromium on the development laptop (WebGL on the GPU through ANGLE/D3D11; the browser caps rendering at 60 frames/s). "Phone" is emulated: phone screen size and touch, but the laptop GPU. Not measured on a real phone. Raw numbers: tests/perf/*.json.

## Part 0 (round 4): time from selecting a site and clicking Deploy to the first 3D frame

Cause of the slow sites: Deploy waited for the whole main-app computation, including the search for the first sunrise/Earthrise after the window (up to 400 days in 60-minute steps). Where nothing changes for a long time (Shackleton crater floor: no sunrise, no Earthrise; Mons Malapert, IM-1: Earth never sets) that search takes most of a second. The 3D view needs only the window itself. Fix: the search now runs as a second worker job (countdowns say "Searching…" for that moment), Deploy waits only for the window, and Three.js and the tile load in parallel with it. Also: progressive mesh (coarse first frame, full mesh right after) and a cache of decoded tiles.

| Viewport | Site | Before: first frame (ms) | After: first frame (ms) | After: full mesh (ms) | Orbit fps after |
|---|---|---|---|---|---|
| laptop | im1 | 820 | 404 | 414 | 60 |
| laptop | im2 | 414 | 340 | 357 | 60 |
| laptop | peak_shackleton | 540 | 702 | 734 | 60 |
| laptop | peak_shackleton_lw | 442 | 317 | 338 | 60 |
| laptop | nobile_rim2_dm2 | 326 | 362 | 377 | 60 |
| laptop | mons_mouton | 485 | 328 | 355 | 60 |
| laptop | mons_malapert | 810 | 345 | 353 | 60 |
| laptop | shackleton_centre | 1088 | 313 | 335 | 60 |
| phone (emulated) | im1 | 688 | 300 | 307 | 60 |
| phone (emulated) | im2 | 296 | 284 | 288 | 60 |
| phone (emulated) | peak_shackleton | 288 | 270 | 280 | 60 |
| phone (emulated) | peak_shackleton_lw | 286 | 278 | 285 | 60 |
| phone (emulated) | nobile_rim2_dm2 | 265 | 261 | 268 | 60 |
| phone (emulated) | mons_mouton | 291 | 327 | 334 | 60 |
| phone (emulated) | mons_malapert | 658 | 274 | 283 | 60 |
| phone (emulated) | shackleton_centre | 1071 | 262 | 270 | 60 |
