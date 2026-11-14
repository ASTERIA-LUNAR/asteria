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

## Final (round 4): every site and quality level

Same script after all round-4 parts (`node tests/perf3d.js --phone --quality low,medium,high`; raw numbers in tests/perf/round4_final.json). "Before" = round 3 (one quality level). Time = from selecting the site and clicking Deploy at once. "Full terrain" = the refined tile plus the extended rings (and the 5 m patch at High) drawn. Frame rate while orbiting with a held key for 2 s (the browser caps at 60). The development laptop has an Intel integrated GPU and an NVIDIA GeForce RTX 5060 Laptop GPU; headless Chromium (ANGLE/D3D11) chose between them. **Phone rows are emulated** (390 × 844, touch; laptop GPU).

| Viewport | Site | Before: first frame (ms) | Quality | First frame (ms) | Full terrain (ms) | Orbit (frames/s) | Vertices (tile + extended) |
|---|---|---|---|---|---|---|---|
| laptop | im1 | 820 | low | 279 | 320 | 60 | 5,929 + 40,401 |
| laptop | im1 | 820 | medium | 212 | 221 | 60 | 5,929 + 160,801 |
| laptop | im1 | 820 | high | 160 | 291 | 59 | 5,929 + 411,802 |
| laptop | im2 | 414 | low | 219 | 280 | 60 | 22,801 + 25,921 |
| laptop | im2 | 414 | medium | 504 | 512 | 60 | 90,601 + 103,041 |
| laptop | im2 | 414 | high | 321 | 578 | 59 | 90,601 + 263,842 |
| laptop | peak_shackleton | 540 | low | 304 | 367 | 60 | 22,801 + 25,921 |
| laptop | peak_shackleton | 540 | medium | 423 | 435 | 60 | 90,601 + 103,041 |
| laptop | peak_shackleton | 540 | high | 390 | 706 | 59 | 90,601 + 424,643 |
| laptop | peak_shackleton_lw | 442 | low | 287 | 347 | 60 | 22,801 + 25,921 |
| laptop | peak_shackleton_lw | 442 | medium | 398 | 411 | 60 | 90,601 + 103,041 |
| laptop | peak_shackleton_lw | 442 | high | 381 | 628 | 59 | 90,601 + 424,643 |
| laptop | nobile_rim2_dm2 | 326 | low | 331 | 420 | 60 | 5,929 + 40,401 |
| laptop | nobile_rim2_dm2 | 326 | medium | 431 | 464 | 60 | 5,929 + 160,801 |
| laptop | nobile_rim2_dm2 | 326 | high | 242 | 505 | 59 | 5,929 + 411,802 |
| laptop | mons_mouton | 485 | low | 440 | 517 | 60 | 22,801 + 25,921 |
| laptop | mons_mouton | 485 | medium | 497 | 514 | 60 | 90,601 + 103,041 |
| laptop | mons_mouton | 485 | high | 297 | 532 | 59 | 90,601 + 263,842 |
| laptop | mons_malapert | 810 | low | 374 | 401 | 60 | 22,801 + 25,921 |
| laptop | mons_malapert | 810 | medium | 467 | 484 | 60 | 90,601 + 103,041 |
| laptop | mons_malapert | 810 | high | 327 | 596 | 59 | 90,601 + 263,842 |
| laptop | shackleton_centre | 1088 | low | 310 | 369 | 60 | 22,801 + 25,921 |
| laptop | shackleton_centre | 1088 | medium | 334 | 344 | 60 | 90,601 + 103,041 |
| laptop | shackleton_centre | 1088 | high | 208 | 415 | 59 | 90,601 + 424,643 |
| phone (emulated) | im1 | 688 | low | 361 | 414 | 60 | 5,929 + 40,401 |
| phone (emulated) | im1 | 688 | medium | 311 | 352 | 60 | 5,929 + 160,801 |
| phone (emulated) | im1 | 688 | high | 257 | 506 | 60 | 5,929 + 411,802 |
| phone (emulated) | im2 | 296 | low | 269 | 350 | 60 | 22,801 + 25,921 |
| phone (emulated) | im2 | 296 | medium | 426 | 434 | 60 | 90,601 + 103,041 |
| phone (emulated) | im2 | 296 | high | 274 | 456 | 59 | 90,601 + 263,842 |
| phone (emulated) | peak_shackleton | 288 | low | 197 | 237 | 60 | 22,801 + 25,921 |
| phone (emulated) | peak_shackleton | 288 | medium | 263 | 284 | 60 | 90,601 + 103,041 |
| phone (emulated) | peak_shackleton | 288 | high | 292 | 638 | 59 | 90,601 + 424,643 |
| phone (emulated) | peak_shackleton_lw | 286 | low | 170 | 199 | 60 | 22,801 + 25,921 |
| phone (emulated) | peak_shackleton_lw | 286 | medium | 345 | 367 | 60 | 90,601 + 103,041 |
| phone (emulated) | peak_shackleton_lw | 286 | high | 174 | 373 | 60 | 90,601 + 424,643 |
| phone (emulated) | nobile_rim2_dm2 | 265 | low | 270 | 327 | 60 | 5,929 + 40,401 |
| phone (emulated) | nobile_rim2_dm2 | 265 | medium | 289 | 312 | 60 | 5,929 + 160,801 |
| phone (emulated) | nobile_rim2_dm2 | 265 | high | 226 | 463 | 59 | 5,929 + 411,802 |
| phone (emulated) | mons_mouton | 291 | low | 318 | 378 | 60 | 22,801 + 25,921 |
| phone (emulated) | mons_mouton | 291 | medium | 364 | 389 | 60 | 90,601 + 103,041 |
| phone (emulated) | mons_mouton | 291 | high | 251 | 391 | 59 | 90,601 + 263,842 |
| phone (emulated) | mons_malapert | 658 | low | 231 | 252 | 60 | 22,801 + 25,921 |
| phone (emulated) | mons_malapert | 658 | medium | 492 | 500 | 60 | 90,601 + 103,041 |
| phone (emulated) | mons_malapert | 658 | high | 292 | 522 | 59 | 90,601 + 263,842 |
| phone (emulated) | shackleton_centre | 1071 | low | 272 | 323 | 59 | 22,801 + 25,921 |
| phone (emulated) | shackleton_centre | 1071 | medium | 457 | 462 | 60 | 90,601 + 103,041 |
| phone (emulated) | shackleton_centre | 1071 | high | 313 | 545 | 60 | 90,601 + 424,643 |

Ranges per quality (both viewports): low: first frame 170-440 ms, full terrain 199-517 ms, 59-60 frames/s; medium: first frame 212-504 ms, full terrain 221-514 ms, 60-60 frames/s; high: first frame 160-390 ms, full terrain 291-706 ms, 59-60 frames/s.

Targets: first frame < 1.5 s and smooth orbiting at Medium on a typical laptop: met on this laptop (headless). Low on a mid-range phone: not measurable here (no real phone); Low draws about 49,000 vertices with a 1024 px shadow map, pixel ratio 1 and no antialiasing.
