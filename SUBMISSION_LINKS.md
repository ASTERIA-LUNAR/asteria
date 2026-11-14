# ASTERIA - submission links

*Generated with Claude Code (Anthropic) under human direction.*

Every link below is a full public https:// URL (no login) that the project actually used and cites elsewhere in the project (README.md, the About page, `data/sites.js`, the validation code or VALIDATION_REPORT.md). `node tests/features_test.js` checks that each URL here also appears in those citations.

## 1. NASA data and resources used

1. NASA/JPL Horizons system (reference ephemeris for all validation tests) - https://ssd.jpl.nasa.gov/horizons/
2. NASA/JPL Horizons API (fresh blind-test and one-year fetches, cached raw responses in tests/horizons_cache/) - https://ssd.jpl.nasa.gov/api/horizons.api
3. LRO LOLA gridded polar DEMs LDEM_85S_20M, LDEM_80S_80M, LDEM_75S_120M, NASA PDS Geosciences Node (terrain horizons, map tiles, 3D terrain) - https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
4. NASA PGDA Lunar Polar Illumination, product 69 (average-illumination maps AVGVISIB_85S_060M_201608 and AVGVISIB_75S_120M_201608) - https://pgda.gsfc.nasa.gov/products/69
5. NASA PGDA product 69 illumination map files (download location linked from the PGDA page) - https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/
6. NASA NTRS, Mazarico et al., lunar polar illumination method (abstract, cited for the illumination cross-check) - https://ntrs.nasa.gov/citations/20120010094
7. NASA NSSDC, Apollo lunar landing site coordinates - https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html
8. NASA, "NASA Provides Update on Artemis III Moon Landing Regions" (28 Oct 2024, the nine candidate regions) - https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
9. NASA, "NASA Identifies Candidate Regions for Landing Next Americans on Moon" (2022 list, Peak near Shackleton) - https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/
10. LROC (NASA LRO camera, NASA/GSFC/Arizona State University), Chang'e-4 lander position - https://lroc.im-ldi.com/images/1087
11. LROC, Chandrayaan-3 (Vikram) lander position - https://lroc.im-ldi.com/images/1314
12. LROC, SLIM lander position - https://lroc.im-ldi.com/images/1358
13. LROC, IM-1 Odysseus lander position - https://lroc.im-ldi.com/images/1360
14. LROC, Chang'e-6 lander position - https://lroc.im-ldi.com/images/1374
15. LROC, Blue Ghost Mission 1 lander position - https://lroc.im-ldi.com/images/1407
16. LROC, IM-2 Athena lander position - https://lroc.im-ldi.com/images/1408

## 2. Space agency partner and other data, resources and tools used

1. IAU Gazetteer of Planetary Nomenclature (IAU WGPSN / USGS), feature names and coordinates - https://planetarynames.wr.usgs.gov/
2. IAU Gazetteer, Mons Mouton (feature 16070) - https://planetarynames.wr.usgs.gov/Feature/16070
3. IAU Gazetteer, Mons Malapert (feature 16338) - https://planetarynames.wr.usgs.gov/Feature/16338
4. IAU Gazetteer, Shackleton crater (feature 5450) - https://planetarynames.wr.usgs.gov/Feature/5450
5. Mahanti et al. 2024, Planetary Science Journal 5, 62 (Peak near Shackleton point) - https://iopscience.iop.org/article/10.3847/PSJ/ad1b50
6. Mazarico et al. 2011, Icarus 211, 1066-1081 (illumination of the lunar polar regions; requested citation for PGDA product 69) - https://doi.org/10.1016/j.icarus.2010.10.030
7. Peña-Asensio et al., arXiv 2406.19863 (Nobile Rim 2 site DM2; accepted in Acta Astronautica) - https://arxiv.org/abs/2406.19863
8. IAU 2015 Resolution B3 nominal solar values, Prša et al. 2016, arXiv 1510.07674 (1361 W/m² total solar irradiance) - https://arxiv.org/abs/1510.07674
9. Astronomy Engine 2.1.19 by Don Cross, MIT licence (ephemeris library) - https://github.com/cosinekitty/astronomy
10. Leaflet 1.9.4, BSD-2-Clause (map) - https://leafletjs.com/
11. Three.js r149, MIT (3D terrain view) - https://threejs.org/
12. Playwright (headless browser tests) - https://playwright.dev/
13. Python (data processing) - https://www.python.org/
14. NumPy (data processing) - https://numpy.org/
15. Pillow (map tile images) - https://python-pillow.org/
16. Claude Code by Anthropic (AI coding assistant that generated the code, scripts and documentation; see AI_DISCLOSURE.md) - https://www.anthropic.com/claude-code

## Notes

* Counts: 16 NASA links, 16 other links.
* Not listed because they were not used as a data source or tool: NASA Moon Trek and LROC Quickmap (mentioned in the app and in VERIFY_YOURSELF.md only as places where readers can check results themselves); the LROC home page.
* Not used: Chart.js (charts are drawn directly on HTML canvas).
* Reachability was checked on 2026-11-14 with a plain HTTP client: all URLs returned HTTP 200 except the NASA NTRS page, which did not answer that client within 60 s; the NTRS public API returned the same record (20120010094, "public use permitted") at that time. https://www.anthropic.com/claude-code redirects to Anthropic's current Claude Code page.
