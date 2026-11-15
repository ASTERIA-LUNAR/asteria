# Ground-level appearance, round 6C: before and after

*Generated with Claude Code (Anthropic) under human direction.*

Full write-up: `ROUND6_REPORT.md`, section "Round 6C". Made with `node tests/ground_detail_6c.js` (headless Chromium, 1440 × 900, laptop GPU via ANGLE/D3D11; shadows off as by default; overlays hidden).

* Same site, time and lighting in every picture: Peak near Shackleton, 2028-09-25 10:04 UTC (Sun 2.57° up, azimuth 334.7°); Mons Malapert, 2028-09-28 03:00 UTC (Sun 3.03° up, azimuth 68.0°, sunlit per the validated horizon model).
* Views: `orbit60` (60 km, pitch 40°), `orbit3` (3 km, pitch 25°), `walk` (eye 2 m at the site, looking across the Sun direction), `rover` (default rover view). Quality `medium` and `high`.
* `before_*`: commit 0ba841e (end of round 6B). `after_*`: round 6C. Variants: `_relief_off`, `_lambert` (plain Lambert, diagnostic), `_ao_on` / `_ao_off` (openness shading), `_vertex_normals` (normal maps off, diagnostic).
* Numbers: `measurements_before.json`, `measurements_after.json` (mean, std, detail, blk16, fgRel, screen pixels per DEM cell, layers, exposure); `clipping.json` (share of black / white clipped ground pixels, `node tests/clip_6c.js`); `invariants_before.json`, `invariants_after.json` (what must not change: vertex hashes, inspection readouts, rover, status, directions - 0 differences).

Every normal comes from stored LOLA heights at the grid's own spacing; nothing finer than the data is drawn or invented.
