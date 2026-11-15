# Close-range surface texture, round 6E: before and after

*Generated with Claude Code (Anthropic) under human direction.*

Full write-up: `ROUND6_REPORT.md`, section "Round 6E". Made with `node tests/ui_round6e.js --base <checkout of fe76cd6>` (headless Chromium, laptop 1440 × 900 and emulated phone 390 × 844, GPU via ANGLE/D3D11; shadows off as by default).

* Same site, time and lighting as round 6C: Peak near Shackleton, 2028-09-25 10:04 UTC (5 m patch); Mons Malapert, 2028-09-28 03:00 UTC (20 m tile).
* Views: `orbit60` (60 km, laptop only), `orbit3` (3 km), `walk` (eye 2 m at the site, looking across the Sun direction), `rover` (default rover view). Quality `medium` (both sites) and `high` (Peak near Shackleton).
* File names: `<site>_<view>_<quality>_<device>_cover-off.jpg` = covering off, which is pixel-identical to the round 6C build (tested by a hash of the rendered pixels against a checkout of commit fe76cd6); `..._cover-on.jpg` = covering on (the default in Walk and Rover). In Orbit both files are identical by design (the covering has no effect there; tested).
* `cone_peak_shackleton_lw_walk_medium_laptop_cover-on.jpg`: the view toward the isolated spike near Peak near Shackleton (round 6E Part 0; probably a DEM artifact, see GAPS_AND_ISSUES.md section 12).
* Numbers: `results_6e.json` (per device / site / quality / view: hash, ground-band mean luminance, detail, clipped white/black share for covering off and on; changed pixels; frame time off/on; unlit-pixel check with shadows on).

The covering is **Illustrative**: fine grain, small craters and rock flecks are drawn for realism, not measured. The heights, slopes, readouts, shadows and the Sun direction are the LOLA data and the validated engine.
