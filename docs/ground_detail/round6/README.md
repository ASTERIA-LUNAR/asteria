# Ground detail, round 6 (Part 1): before (v1-stable) and after

*Generated with Claude Code (Anthropic) under human direction.*

Measured with `node tests/ground_detail.js --r6 --other before=<checkout of v1-stable> --tag after` (headless Chromium, 1440 × 900, laptop GPU via ANGLE/D3D11). Same site, time and camera in each pair; overlays hidden. Numbers in `measurements.json`: luminance 0-255 of the lower part of the 3D canvas; **detail** = mean absolute difference between neighbouring pixels (higher = more visible relief); **fg rel** = standard deviation / mean in the nearest third of that band.

Cases: Peak near Shackleton (-88.79, 124.5), 2028-09-25 10:04 UTC (Sun 2.6° up; ring A has the new 25 m grid; 5 m patch); Mons Mouton (landform centre), 2026-11-25 17:53 UTC (Sun 5.2° up; ring A only partly inside LDEM_85S_20M, so it keeps the 100 m grid from LDEM_80S_80M); earthshine case: Mons Mouton, 2027-03-13 10:00 UTC (Sun hidden by terrain according to the validated model, Earth 10.8° up, 74 % lit).

| View (quality) | Before: detail | After: detail | Note |
|---|---|---|---|
| Peak near Shackleton, Orbit (Medium) | 1.59 | **2.67** | ring A lighting from 25 m LOLA data (normal map) |
| Peak near Shackleton, Orbit (High) | 1.55 | **2.62** | ring A geometry 50 m + 25 m normal map; ring B 200 m + 100 m normal map |
| Mons Mouton, Orbit (Medium) | 1.99 | 1.74 | no 20 m ring here; the tile's outer 500 m now fades to the ring's detail (no square step), which removes some 20 m detail there |
| Mons Mouton, Orbit (High) | 1.99 | 1.75 | as above |
| Peak near Shackleton, Walk (Medium / High) | 2.94 / 3.11 | 2.93 / 3.06 | standing on the 5 m patch: unchanged |
| Mons Mouton, Walk (Medium / High) | 6.94 / 6.83 | 6.74 / 6.75 | far ground: tile-edge fade |
| Peak near Shackleton, Rover | 0.27 | 0.27 | unchanged (smooth 5 m ground in view) |
| Mons Mouton, Rover | 0.08 | 0.08 | unchanged (the 20 m DEM is smooth on this flank) |
| Mons Mouton in shadow, Orbit: earthshine off / on | 0.00 (flat, mean 7.9) | **0.49** (fg rel 0.22) | earthshine with the stated exposure (×4,713) |
| Mons Mouton in shadow, Walk: earthshine off / on | 0.00 (flat, mean 7.9) | 0.04 (mean 39) | the summit is smooth in the 20 m data |

Also here: `wide_before_peak_shackleton_high.jpg` / `wide_after_peak_shackleton_high.jpg` (Orbit from 22 km: before, the 6 km tile stands out as a sharp square inside blurred 100 m terrain; after, the detail continues into ring A), and `python_hillshade_ringA_25m_peak_shackleton.jpg`: an independent Python hillshade of the 25 m ring grid. The faint straight streaks visible in the 3D view near Peak near Shackleton are in that hillshade too: they are LOLA ground-track artefacts of LDEM_85S_20M, not rendering errors, and they are not removed.

What the numbers show: the visible step at 3 km (tile → ring A) is gone where 20 m data covers ring A (4 sites) and softened elsewhere; Walk and Rover pictures in sunlight are unchanged (the ground there is as smooth as the DEM); in shadow, the only physical light source added (earthshine) makes Earth-facing relief readable when Earth is above the horizon. Nothing in these pictures comes from invented detail: every normal is a central difference of stored LOLA heights at that grid's spacing.
