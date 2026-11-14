# LunaWindow - Gaps, issues and approximations

Status as of 2026-11-14. This file lists what is missing, what is approximate, and what could not be sourced.

## 1. Sites that could not be sourced (left out or only partly covered)

| Item | What happened | What we did |
|---|---|---|
| NASA Artemis III candidate **region centres** (Oct 2024 list of 9) | No fetched source gives numeric region centres. The NASA releases (2022 and 2024) only show regions on images. LPSC/NTRS abstracts checked had no coordinates. Mahanti et al. 2024 lists centres of *permanently shadowed regions* inside some regions, which are not landing areas. | We did **not** use a "region centre (approximate)" label because no region centre was sourced. We include two regions using sourced points that are clearly labelled: **Mons Mouton** (the named feature's coordinate, from Wikipedia) and **Nobile Rim 2** (site DM2 from the Peña-Asensio et al. study, arXiv 2406.19863). The other seven (Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Nobile Rim 1, de Gerlache Rim 2, Slater Plain) are listed in the app as "not plotted". |
| Shackleton **connecting ridge** / specific rim points | No fetchable paper gave point coordinates (Mazarico 2011, Speyerer & Robinson 2013, Gläser 2014, Bernhardt 2022, De Rosa 2012 were behind paywalls or had no coordinates in accessible text). | Used the **Chang'e-7 target** ("peak near the southeast ridge of Shackleton", 88.8°S 123.4°E) from Wikipedia, flagged as weakly sourced (the infobox cites a social-media post), and **Peak near Shackleton** (−88.79, 124.5) quoted verbatim from Mahanti et al. 2024. |
| IM-2 pre-launch target, VIPER target, Astrobotic Griffin-1 (Nobile), Firefly Blue Ghost M2 (far side) | NASA and Wikipedia pages name the areas but give no numbers. | Not added as separate sites. IM-2's actual LROC landing position is included; VIPER's destination (Mons Mouton) is noted on the Mons Mouton entry. |
| Blue Ghost Mission 1 | LROC gives the **landing-region image centre** (18.56°N, 61.81°E), not a lander fix. | Included, labelled as image centre. |

## 2. Published illumination comparison (not forced to agree)

* Mahanti et al. 2024 (PSJ 5, 62, https://iopscience.iop.org/article/10.3847/PSJ/ad1b50): "a small area (−88.79, 124.5) receives persistent solar illumination (approximately 80% of the time; Mazarico et al. 2011)".
* LunaWindow, at that exact coordinate, observer 2 m above the LOLA surface, Sun centre above the terrain horizon, calendar year 2027: **49.6 %**.
* On a 9 × 9 grid of points within ±400 m of it (100 m spacing, 1-hour steps, 2027), our values range from **2.1 % to 68.1 %**, with the best point 400 m south-west and 41 m higher (`tools/neighbourhood_check.py`).
* Likely reasons for the difference: the coordinate is rounded to 0.01° (about ±150 m in latitude), illumination at this place changes greatly over a few hundred metres, the published figure comes from a multi-year analysis with a different method and period, and we use 20 m/pixel topography with a 1° azimuth mask. **We report the difference and have not tuned anything.**
* Mazarico et al. 2011 (abstract, NTRS 20120010094) state that a location near the Shackleton rim is sunlit continuously for about 240 days per year. We did not have that location's coordinates, so we could not test it.
* Qualitative check passed: the Shackleton crater floor gets 0 % sunlight in 2027 (permanently shadowed). Rim and ridge points 10-30 km away get 50-55 %.

## 3. Approximations (also labelled in the app)

* **Smooth-Moon horizon** for all non-polar sites and every custom point. The app shows "Smooth Moon horizon - terrain not included". Local hills can shift rise and set times by hours to days.
* **Terrain horizons** exist only for the 7 curated sites south of 80°S. The DEMs are too large to ship to the browser, so custom points never get terrain.
* Horizon masks use 1° azimuth steps with linear interpolation. DEM resolution is 20 m (within about 85°S), 80 m (to 80°S) and 120 m (to 75°S). Rays go out to 300 km. Observer height is 2 m above the bilinearly interpolated surface. Boulders, the lander itself and sub-pixel relief are not modelled.
* The **Moon orientation** uses the IAU/WGCCRE rotation model from Astronomy Engine. Horizons uses the DE-based Mean-Earth/polar-axis frame. The difference is well under 0.01° in the validation tables.
* The Moon is a sphere of 1737.4 km. Ephemeris calculations put every site on that sphere (h = 0). The effect of a site's real height on Sun/Earth directions is below 0.001°. Terrain height is used for the horizon masks.
* Light-time: the Sun is held at the heliocentric origin. Its motion around the barycentre during the 8-minute light time is under 0.00001°. Gravitational light deflection is ignored.
* **Sunrise/sunset and Earthrise/Earthset** use the centre of the body. "Solar disk visible" treats the horizon as a straight line across the 0.53° disk.
* **Events** are found by a scan with 10-minute steps (60-minute steps for windows over 30 days) and refined to 1 minute. Visibility periods shorter than one step can be missed. Beyond the selected window, the next event is searched for up to 400 days with 60-minute steps.
* **Statistics** (% sunlit, longest darkness, etc.) come from the samples, so they are accurate to about one step (10 or 60 min).
* "Earth visible" means Earth's centre is above the horizon. Antenna patterns, Earth ground-station coverage and relay satellites are not modelled.
* The south-pole map is a synthetic hillshade (light from the upper-left at 25° altitude). It does not show real lighting at any date.

## 4. Known issues / limitations of the app

* The date picker displays in the browser's locale format (it may show AM/PM), but the value is always interpreted as **UTC**, as labelled.
* 365-day windows and 4-scenario comparisons over 365 days take about 1 second to compute in the browser.
* Map markers for sites that are close together (Chang'e-7 target and Peak near Shackleton are about 300 m apart) overlap. Only the selected site is labelled. Hover shows the names.
* Not built (TODO hooks only, as requested): launch-slip heatmap, solar power and battery calculator (`LunaApp.todo.*` in `js/app.js`, comments in `index.html`).

## 5. Process notes

* Git: a global git identity already existed on this machine, so the repo uses it (no repo-only identity was set). Nothing has been pushed.
* The LOLA DEMs (`dem/`, about 690 MB) and `.venv/` are not in git. Re-download them with the URLs in README.md to regenerate the terrain products.
* NSSDC Apollo coordinates are in the planetocentric Mean Earth/Polar Axis frame (DE421), the same frame as LOLA and Horizons.
