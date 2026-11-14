# Ground detail in Walk and Rover (round 5, Part 3)

*Generated with Claude Code (Anthropic) under human direction.*

Same site, time and camera in every picture (overlays hidden), 1440 × 900 window, headless Chromium on the development laptop. Measured with `node tests/ground_detail.js --other round3=<checkout of 46b0fa8> --other before=<checkout of 3b40923> --tag after`; all numbers in `measurements.json` (luminance 0-255 of the ground band; "detail" = mean absolute difference between neighbouring pixels; "foreground relative contrast" = standard deviation / mean in the nearest third of the ground).

Sites and times: Peak near Shackleton (-88.79, 124.5), 2028-09-25 10:04 UTC, Sun 2.6° high (5 m LOLA patch exists); Mons Mouton (landform centre), 2026-11-25 17:53 UTC, Sun 5.2° high (20 m tile only). Quality Medium.

Files: `r5_ground_<build>_<site>_<walk|rover>[_variant].jpg`; builds: `round3` (commit 46b0fa8), `before` (this round before the fix), `after`; `_medium_light_up` = with "Light up" (3× brightness) active, as when it was remembered from an earlier visit.

| View | Round 3 | Before: normal | Before: "Light up" remembered | After (relief shading on) |
|---|---|---|---|---|
| Peak near Shackleton, Walk: detail | 0.17 | 0.87 | 0.55 (foreground 225/255) | 2.94 |
| Mons Mouton, Walk: detail | 0.75 | 4.11 | 0.71 (foreground 255/255 = clipped white) | 6.94 |
| Peak near Shackleton, Rover: detail | 0.01 | 0.06 | 0.19 | 0.27 |
| Mons Mouton, Rover: detail | 0.02 | 0.13 | 0.06 (foreground 255/255) | 0.08 |

What the measurements show:

* **Geometry and normals did not lose detail since round 3.** Switching the current build to plain Lambert shading (the round-3 law, diagnostic hook) reproduces the round-3 picture: Mons Mouton Walk mean / spread / detail 64.4 / 20.0 / 0.76 vs round 3's 64.4 / 20.1 / 0.75. Fitting the shadow camera to the 6 km tile only (round-3 texel 4 m instead of 21 m) changed nothing measurable in these views.
* **"Light up" remembered between visits** washes sunlit ground out to pure white (foreground mean 255, relative contrast 0): every slope looks the same. The app suggests Light up whenever a site is in shadow, and the setting was stored and reused on the next visit and at sunlit sites. Round 3 had no brightness control. Fixed: Light up is session-only and switches itself off (with a note) when the validated status says the Sun is up.
* **Lommel-Seeliger shading** (round 4) divides cos i by cos i + cos e. In Walk and Rover the view is grazing (cos e small), so sunlit slopes facing toward and away from the low Sun come out at nearly the same bright tone. Fixed with the "Relief shading" display option (default on in Walk and Rover).
* **Low quality** drew the 6 km tile at every second node (40 m) and the 5 m patch was only used at High. Small effect in these views (Walk detail 0.82 at Low vs 0.87 at Medium) but real; fixed: Walk and Rover on laptops use the full tile and the 5 m patch at every quality level.
* Where the 20 m DEM itself is smooth (the Mons Mouton rover view is on an even mountain flank) no shading can show relief that is not in the data; relief shading does not add any.
