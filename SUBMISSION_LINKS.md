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
17. LRO LOLA LDEM_875S_5M, 5 m/pixel south-pole DEM, NASA PDS Geosciences Node (3D view: 2 km × 2 km inner patches at High quality; only the needed rows were fetched with HTTP Range requests) - https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_875s_5m.img
18. NASA Earth Observatory, Blue Marble Next Generation (cloud-free monthly composites; 3D view Earth texture) - https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/
19. NASA Blue Marble Next Generation, topography and bathymetry, July 2004, 5400 × 2700 (the file used for the Earth texture) - https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg
20. NASA Earth Fact Sheet (NSSDC): Earth's geometric albedo 0.434 and Bond albedo 0.294 (round 6: 3D earthshine strength) - https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
21. NASA VIPER mission page (what VIPER is, 100-day mission, destination Mons Mouton; round 6 rover and "About this rover") - https://science.nasa.gov/mission/viper/
22. NASA VIPER rover and instruments (published size 2.5 m tall, 1.5 m long and wide; four wheel modules; instruments) - https://science.nasa.gov/mission/viper/rover-and-instruments/
23. NASA, "NASA Provides Progress Update on Moon Base Rovers" (20 Oct 2026: VIPER's current status) - https://www.nasa.gov/missions/moon-base/nasa-provides-progress-update-on-moon-base-rovers/
24. NASA, "NASA Selects Blue Origin to Deliver VIPER Rover to Moon's South Pole" (19 Sep 2025) - https://www.nasa.gov/news-release/nasa-selects-blue-origin-to-deliver-viper-rover-to-moons-south-pole/
25. NASA, "NASA Ends VIPER Project, Continues Moon Exploration" (17 Jul 2024) - https://www.nasa.gov/news-release/nasa-ends-viper-project-continues-moon-exploration/

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
17. Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren 1991), CDS catalogue V/50, public domain (3D view stars; file copy from the Harvard-Smithsonian CfA mirror http://tdc-www.harvard.edu/catalogs/bsc5.dat.gz) - https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50
18. IAU Gazetteer of Planetary Nomenclature, GIS downloads (3D view feature labels) - https://planetarynames.wr.usgs.gov/GIS_Downloads
19. IAU Gazetteer, Moon nomenclature centre points (the file used: MOON_nomenclature_center_pts) - https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip
20. Lucey et al. 2014, "The global albedo of the Moon at 1.064 µm from LOLA", JGR Planets 119 (checked for a south-pole albedo map; its polar maps are about 2 km/pixel, so none was used) - https://doi.org/10.1002/2013JE004592
21. Archinal et al. 2011, "Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2009", Celestial Mechanics and Dynamical Astronomy 109 (lunar rotation model, written out independently in the star-direction test) - https://doi.org/10.1007/s10569-010-9320-4

## Notes

* Counts: 25 NASA links, 21 other links (round 4 added 3 NASA and 5 other links for the 3D view; round 6 added 6 NASA links: the Earth Fact Sheet and five VIPER pages).
* Round 6 links were fetched on 2026-11-15 (HTTP 200). https://www.nasa.gov/mission/viper/ returned HTTP 404 and is not listed. The science.nasa.gov VIPER page (updated 21 Sep 2026) still says VIPER "was slated to land"; the app states the status from NASA's newer 20 Oct 2026 update, with its date.
* Not listed because they were not used as a data source or tool: NASA Moon Trek and LROC Quickmap (mentioned in the app and in VERIFY_YOURSELF.md only as places where readers can check results themselves); the LROC home page.
* Not used: Chart.js (charts are drawn directly on HTML canvas).
* Reachability was checked on 2026-11-14 with a plain HTTP client: all URLs returned HTTP 200 except the NASA NTRS page, which did not answer that client within 60 s; the NTRS public API returned the same record (20120010094, "public use permitted") at that time. https://www.anthropic.com/claude-code redirects to Anthropic's current Claude Code page.
* Round 4 links were checked on 2026-11-14: the PDS 5 m DEM, Blue Marble page and file, the Gazetteer GIS page and file, and the Archinal et al. DOI answered (HTTP 200/206). The CDS V/50 catalogue page answered HTTP 200 once and timed out on a second check; the CDS file server did not answer, so the identical catalogue file was taken from the Harvard-Smithsonian CfA mirror (http only). The Lucey et al. DOI returns HTTP 403 to scripted clients (publisher block); it resolves in a browser.
