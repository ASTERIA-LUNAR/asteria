# ASTERIA - Gaps, issues and approximations

Status as of 2026-11-14 (after the second development round). This file lists what is missing, what is approximate, and what could not be sourced.

## 1. Sites that could not be sourced (left out or only partly covered)

| Item | What happened | What we did |
|---|---|---|
| NASA Artemis III candidate **region centres** (Oct 2024 list of 9) | No fetched source gives numeric region centres. The NASA releases (2022 and 2024) only show regions on images. LPSC/NTRS abstracts checked had no coordinates. Mahanti et al. 2024 lists centres of *permanently shadowed regions* inside some regions, which are not landing areas. | We did **not** use a "region centre (approximate)" label because no region centre was sourced. We include two regions using sourced points that are clearly labelled: **Mons Mouton** (the named feature's coordinate, from Wikipedia) and **Nobile Rim 2** (site DM2 from the Peña-Asensio et al. study, arXiv 2406.19863). The other seven (Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Nobile Rim 1, de Gerlache Rim 2, Slater Plain) are listed in the app as "not plotted". |
| Shackleton **connecting ridge** / specific rim points | No fetchable paper gave point coordinates (Mazarico 2011, Speyerer & Robinson 2013, Gläser 2014, Bernhardt 2022, De Rosa 2012 were behind paywalls or had no coordinates in accessible text). | Used the **Chang'e-7 target** ("peak near the southeast ridge of Shackleton", 88.8°S 123.4°E) from Wikipedia, flagged as weakly sourced (the infobox cites a social-media post), and **Peak near Shackleton** (−88.79, 124.5) quoted verbatim from Mahanti et al. 2024. |
| IM-2 pre-launch target, VIPER target, Astrobotic Griffin-1 (Nobile), Firefly Blue Ghost M2 (far side) | NASA and Wikipedia pages name the areas but give no numbers. | Not added as separate sites. IM-2's actual LROC landing position is included; VIPER's destination (Mons Mouton) is noted on the Mons Mouton entry. |
| Blue Ghost Mission 1 | LROC gives the **landing-region image centre** (18.56°N, 61.81°E), not a lander fix. | Included, labelled as image centre. |

## 2. Terrain illumination cross-check (Peak near Shackleton vs published "~80%")

The full tables are in VALIDATION_REPORT.md under "Terrain illumination cross-check" and on the app's Validation page.

* **Claim**: Mahanti et al. 2024 (PSJ 5, 62): "a small area (−88.79, 124.5) receives persistent solar illumination (approximately 80% of the time; Mazarico et al. 2011)".
* **Definition sources we could read**:
  * Mazarico et al. 2011 abstract (NTRS 20120010094): 240 m DEMs, several 18.6-year cycles at 6 h steps. The full paper is paywalled and was not read, so the exact definition and observer height are unknown.
  * The public map product (NASA PGDA product 69, AVGVISIB_85S_060M_201608, 60 m/px) averages hourly steps over 18.6 years. The start year is not given.
  * Its label contradicts itself. One place says "percentage of timesteps ... sunlit (by any fraction of the solar disc)"; another says "average solar disc visibility". We therefore computed both definitions, plus a Sun-centre one.
* **Results at the published coordinate**:

  | Source / observer height | Average illumination |
  |---|---|
  | Our model, 2 m, 2027 | 49.6 % |
  | Our model, 2 m, 2027-2045 (18.6 years) | 48.1 % |
  | Our model, 10 m, 18.6 years | 59.6 % |
  | Published map | **45.4 %** |

  The public map product does not reproduce "~80%" at this coordinate.
* **Neighbourhood scan** (317 points within 500 m on a 50 m grid, 18.6 years):

  | Observer height | Our best point | Our value there | Published map there | Correlation with the map |
  |---|---|---|---|---|
  | 2 m | 450 m W / 150 m S | 62.1 % | 38.0 % | r = 0.84 |
  | 10 m | 350 m W / 350 m S | **79.2 %** | 58.1 % | r = 0.68 |

  The published map's own maximum in the area is 59.2 %.
* **Point both models support**: 150 m N / 100 m W of the published coordinate. Our model gives 59.8 % and the map gives 59.2 %. It is added as a separate, clearly labelled **derived** site, and the original coordinate is kept.
* **Other sites vs the published map** (2 m, 18.6 years):

  | Site | Our model | Published map |
  |---|---|---|
  | IM-2 | 45.0 % | 46.0 % |
  | Mons Mouton | 30.1 % | 32.8 % |
  | Chang'e-7 target | 55.1 % | 49.0 % |
  | Shackleton floor | 0 % | 0 % |

  Nobile Rim 2 is outside the 60 m map.
* **Not tuned.** Remaining differences are expected from:
  * DEM version and resolution (20 m vs 60 m)
  * our 1° azimuth horizon mask
  * different 18.6-year spans
  * unknown observer height in the published products
* For speed, the cross-check uses one Sun-direction series computed at the published coordinate for every grid point and site. The direction error this causes is below 0.0001°. Each point still uses its own horizon mask and local frame.

## 3. Approximations (also labelled in the app)

* **Smooth-Moon horizon** for all non-polar sites and every custom point. The app shows "Smooth Moon horizon - terrain not included". Local hills can shift rise and set times by hours to days.
* **Terrain horizons** exist only for the 8 curated sites south of 80°S. The DEMs are too large to ship to the browser, so custom points never get terrain.
* Horizon masks use 1° azimuth steps with linear interpolation. DEM resolution is 20 m (within about 85°S), 80 m (to 80°S) and 120 m (to 75°S). Rays go out to 300 km. Observer height is 2 m above the bilinearly interpolated surface. Boulders, the lander itself and sub-pixel relief are not modelled.
* The **Moon orientation** uses the IAU/WGCCRE rotation model from Astronomy Engine. Horizons uses the DE-based Mean-Earth/polar-axis frame. The difference is well under 0.01° in the validation tables.
* The Moon is a sphere of 1737.4 km. Ephemeris calculations put every site on that sphere (h = 0). The effect of a site's real height on Sun/Earth directions is below 0.001°. Terrain height is used for the horizon masks.
* Light-time: the Sun is held at the heliocentric origin. Its motion around the barycentre during the 8-minute light time is under 0.00001°. Gravitational light deflection is ignored.
* **Sunrise/sunset and Earthrise/Earthset** use the centre of the body. "Average illumination (solar-disk fraction)" averages the visible fraction of the disk, treating the horizon as a straight line across the 0.53° disk. Both metrics are shown.
* **Events** are found by a scan with 10-minute steps (60-minute steps for windows over 30 days) and refined to 1 minute. Visibility periods shorter than one step can be missed. Beyond the selected window, the next event is searched for up to 400 days with 60-minute steps.
* **Statistics** (% sunlit, longest darkness, etc.) come from the samples, so they are accurate to about one step (10 or 60 min).
* "Earth visible" means Earth's centre is above the horizon. Antenna patterns, Earth ground-station coverage and relay satellites are not modelled.
* The south-pole map is a synthetic hillshade (light from the upper-left at 25° altitude). It does not show real lighting at any date.

### Launch-slip heatmap

* One series covers the whole slip range, at the same step the timeline uses for the mission length: 10 min for missions up to 30 days, 60 min beyond. Each slip is an exact slice of that series, so slip 0 equals the Explorer metrics for the same window. A unit test and the browser check confirm this.
* "Hours until first sunset" has the resolution of one sampling step (10 or 60 min). It is not refined by bisection.
* Slip steps are whole days.
* Colours are normalised per row in metric mode and on a common scale in site mode.

### Power & battery calculator - first-order estimate (labelled in the app)

* Power = 1361 W/m² × (1 AU/d)² × area × efficiency × cos(incidence) × visible disk fraction.
* 1361 W/m² is the IAU 2015 Resolution B3 nominal total solar irradiance (Prša et al. 2016, AJ 152, 41, arXiv:1510.07674). We confirmed the value from the verbatim text of the Wikipedia "Solar constant" article, which cites the resolution. We could not extract text from the arXiv PDF itself.
* Not modelled:
  * temperature effects
  * dust
  * degradation
  * wiring and conversion losses
  * light reflected from terrain
  * panel self-shadowing and the panel's height above the observer point
  * battery charge and discharge efficiency
* The battery size is load × longest darkness ÷ usable fraction, using longest *darkness* (Sun centre down). For a fixed-azimuth panel the longest zero-output period can be longer. The app then shows a note with the battery needed for that period.
* Energy uses the trapezoid rule on the series samples.

## 4. Known issues / limitations of the app

* The date picker displays in the browser's locale format (it may show AM/PM), but the value is always interpreted as **UTC**, as labelled.
* 365-day windows, 4-scenario comparisons over 365 days and multi-site slip heatmaps take about 1-4 seconds in the browser. The heatmap shows a progress line while it runs.
* Map markers for sites that are close together overlap. The Chang'e-7 target, Peak near Shackleton and its derived best-lit point lie within about 300 m of each other. Only the selected site is labelled; hover shows the names.
* Tour captions are computed live from the current date and state, so their numbers change from day to day. Some steps can legitimately show 0% (for example, no power+DTE overlap in a window).
* "Copy link" uses the clipboard API. Where the browser blocks it (some file:// contexts), a prompt shows the link to copy by hand.

## 5. Process notes

* **Git identity**: all commits were rewritten to author and committer "LunaWindow" with a noreply address. The same identity is set in this repository's local config, and the global git config is unchanged.
* A personal Windows path found in older versions of `tools/neighbourhood_check.py` was removed from the whole history. Old objects were pruned.
* No personal names, emails or user paths remain in tracked files or history. The only email-like string is the Astronomy Engine author's copyright line inside `lib/astronomy.browser.min.js`. It is a required MIT licence notice, so it is kept.
* Nothing has been pushed.
* These large inputs are not in git:
  * the LOLA DEMs (`dem/`, about 690 MB)
  * the PGDA illumination maps (`dem/pgda/`, about 100 MB)
  * the exported Sun vectors (`dem/work/`)
  * `.venv/`
* The URLs to download these inputs again are in README.md.
* NSSDC Apollo coordinates are in the planetocentric Mean Earth/Polar Axis frame (DE421), the same frame as LOLA and Horizons.
