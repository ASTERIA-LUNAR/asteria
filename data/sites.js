// LunaWindow curated sites. Every coordinate below was read from the source URL(s) listed
// (fetched 2026-11-14). Latitude: degrees, north positive. Longitude: degrees EAST positive.
// "coordKind" says exactly what the point is, because several south-pole entries are
// representative points or feature coordinates, not landing points or region centres.
window.LUNA_SITES = [
  // ------------------------------------------------------------------ Apollo
  { id: 'apollo11', name: 'Apollo 11', mission: 'Apollo 11', agency: 'NASA', country: 'USA', lat: 0.67416, lon: 23.47314,
    status: 'landed', year: 1969, coordKind: 'Lunar Module position',
    sources: ['https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html'],
    notes: 'Mare Tranquillitatis. NSSDC: planetocentric Mean Earth/Polar Axis (DE421), from LRO images (Wagner et al. 2017).' },
  { id: 'apollo12', name: 'Apollo 12', mission: 'Apollo 12', agency: 'NASA', country: 'USA', lat: -3.0128, lon: -23.4219,
    status: 'landed', year: 1969, coordKind: 'Lunar Module position',
    sources: ['https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html'], notes: 'Oceanus Procellarum.' },
  { id: 'apollo14', name: 'Apollo 14', mission: 'Apollo 14', agency: 'NASA', country: 'USA', lat: -3.64589, lon: -17.47194,
    status: 'landed', year: 1971, coordKind: 'Lunar Module position',
    sources: ['https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html'], notes: 'Fra Mauro formation.' },
  { id: 'apollo15', name: 'Apollo 15', mission: 'Apollo 15', agency: 'NASA', country: 'USA', lat: 26.13239, lon: 3.63330,
    status: 'landed', year: 1971, coordKind: 'Lunar Module position',
    sources: ['https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html'], notes: 'Hadley-Apennine.' },
  { id: 'apollo16', name: 'Apollo 16', mission: 'Apollo 16', agency: 'NASA', country: 'USA', lat: -8.9734, lon: 15.5011,
    status: 'landed', year: 1972, coordKind: 'Lunar Module position',
    sources: ['https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html'], notes: 'Descartes Highlands.' },
  { id: 'apollo17', name: 'Apollo 17', mission: 'Apollo 17', agency: 'NASA', country: 'USA', lat: 20.1911, lon: 30.7723,
    status: 'landed', year: 1972, coordKind: 'Lunar Module position',
    sources: ['https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html'], notes: 'Taurus-Littrow valley.' },

  // ------------------------------------------------------- robotic landers
  { id: 'chandrayaan3', name: 'Chandrayaan-3 (Vikram)', mission: 'Chandrayaan-3', agency: 'ISRO', country: 'India', lat: -69.3741, lon: 32.32,
    status: 'landed', year: 2023, coordKind: 'Lander position (LROC)',
    sources: ['https://lroc.im-ldi.com/images/1314', 'https://en.wikipedia.org/wiki/Chandrayaan-3'],
    notes: 'Shiv Shakti Point. LROC: 69.3741°S, 32.32°E, 532 m elevation.' },
  { id: 'change4', name: "Chang'e-4", mission: "Chang'e-4", agency: 'CNSA', country: 'China', lat: -45.457, lon: 177.589,
    status: 'landed', year: 2019, coordKind: 'Lander position (LROC, ±20 m)',
    sources: ['https://lroc.im-ldi.com/images/1087', 'https://en.wikipedia.org/wiki/Chang%27e_4'],
    notes: 'Von Kármán crater, far side: Earth never visible; communications via the Queqiao relay satellite.' },
  { id: 'change6', name: "Chang'e-6", mission: "Chang'e-6", agency: 'CNSA', country: 'China', lat: -41.6385, lon: 206.0148,
    status: 'landed', year: 2024, coordKind: 'Lander position (LROC, ±30 m)',
    sources: ['https://lroc.im-ldi.com/images/1374', 'https://en.wikipedia.org/wiki/Chang%27e_6'],
    notes: 'Apollo basin, far side (206.0148°E = 153.9852°W). First far-side sample return.' },
  { id: 'slim', name: 'SLIM', mission: 'Smart Lander for Investigating Moon', agency: 'JAXA', country: 'Japan', lat: -13.3160, lon: 25.2510,
    status: 'landed', year: 2024, coordKind: 'Lander position (LROC)',
    sources: ['https://lroc.im-ldi.com/images/1358', 'https://en.wikipedia.org/wiki/Smart_Lander_for_Investigating_Moon'],
    notes: 'Near Shioli crater. LROC: -912 m elevation.' },
  { id: 'im1', name: 'IM-1 Odysseus', mission: 'IM-1 (CLPS)', agency: 'Intuitive Machines / NASA CLPS', country: 'USA', lat: -80.13, lon: 1.44,
    status: 'landed', year: 2024, coordKind: 'Lander position (LROC)',
    sources: ['https://lroc.im-ldi.com/images/1360', 'https://en.wikipedia.org/wiki/IM-1'],
    notes: 'Malapert A region. LROC: 2579 m elevation. Lander tipped over on landing.' },
  { id: 'im2', name: 'IM-2 Athena', mission: 'IM-2 (CLPS)', agency: 'Intuitive Machines / NASA CLPS', country: 'USA', lat: -84.7906, lon: 29.1957,
    status: 'landed', year: 2025, coordKind: 'Lander position (LROC)',
    sources: ['https://lroc.im-ldi.com/images/1408', 'https://en.wikipedia.org/wiki/IM-2'],
    notes: 'Mons Mouton plateau region. Lander came to rest on its side in a crater.' },
  { id: 'bgm1', name: 'Blue Ghost Mission 1', mission: 'Blue Ghost M1 (CLPS)', agency: 'Firefly Aerospace / NASA CLPS', country: 'USA', lat: 18.56, lon: 61.81,
    status: 'landed', year: 2025, coordKind: 'Landing-region image centre (LROC), not an exact lander fix',
    sources: ['https://lroc.im-ldi.com/images/1400', 'https://en.wikipedia.org/wiki/Blue_Ghost_Mission_1'],
    notes: 'Mare Crisium, near Mons Latreille.' },

  // ---------------------------------------------------- planned / candidate
  { id: 'change7', name: "Chang'e-7 target", mission: "Chang'e-7", agency: 'CNSA', country: 'China', lat: -88.8, lon: 123.4,
    status: 'planned', year: 2027, coordKind: 'Reported target point (weakly sourced)',
    sources: ['https://en.wikipedia.org/wiki/Chang%27e_7'],
    notes: '"Peak near the southeast ridge of Shackleton crater". The Wikipedia infobox cites a social-media post: treat as approximate. Launch delayed to 2027 (per the same page).' },
  { id: 'peak_shackleton', name: 'Peak near Shackleton (illuminated area)', mission: 'Artemis III candidate region (2022 list)', agency: 'NASA', country: 'USA', lat: -88.79, lon: 124.5,
    status: 'candidate', year: null, coordKind: 'Published high-illumination point inside the region (not the region centre)',
    sources: ['https://iopscience.iop.org/article/10.3847/PSJ/ad1b50', 'https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-moon/'],
    notes: 'Mahanti et al. 2024 (PSJ 5, 62): "a small area (−88.79, 124.5) receives persistent solar illumination (approximately 80% of the time; Mazarico et al. 2011)". "Peak near Shackleton" was in NASA\'s 2022 list of 13 regions; it is not in the October 2024 list of 9. LunaWindow cross-check (Validation page): at this exact rounded coordinate both our model (48% average illumination over 18.6 years, observer 2 m) and the published LOLA average-illumination map (45%) are well below 80%; see the derived point "Peak near Shackleton - best-lit point".' },
  { id: 'peak_shackleton_lw', name: 'Peak near Shackleton - best-lit point (derived)', mission: 'Artemis III candidate region (2022 list)', agency: 'NASA', country: 'USA', lat: -88.7851, lon: 124.3438,
    status: 'candidate', year: null, coordKind: 'DERIVED by LunaWindow (not a published coordinate): the 50 m grid point within 500 m of the published point where our terrain model and the published LOLA average-illumination map agree it is best lit',
    sources: ['https://pgda.gsfc.nasa.gov/products/69', 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/', 'https://iopscience.iop.org/article/10.3847/PSJ/ad1b50'],
    notes: '150 m north and 100 m west of the published (-88.79, 124.5). Average illumination over 18.6 years: LunaWindow 59.8% (observer 2 m), published map AVGVISIB_85S_060M_201608 59.2% (its maximum within 500 m). An illustration of how much illumination changes over a few hundred metres, not a landing recommendation.' },
  { id: 'nobile_rim2_dm2', name: 'Nobile Rim 2 (site DM2)', mission: 'Artemis III candidate region', agency: 'NASA', country: 'USA', lat: -84.20156, lon: 60.69989,
    status: 'candidate', year: null, coordKind: 'Published optimal point within the region from a research study (not the region centre)',
    sources: ['https://arxiv.org/abs/2406.19863', 'https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/'],
    notes: 'Peña-Asensio et al. (arXiv 2406.19863) "Evaluating potential landing sites for the Artemis III mission using a multi-criteria decision making approach": site DM2 is their optimal point. Independent study, not a NASA selection.' },
  { id: 'mons_mouton', name: 'Mons Mouton', mission: 'Artemis III candidate region; VIPER destination', agency: 'NASA', country: 'USA', lat: -84.6, lon: 31.0,
    status: 'candidate', year: null, coordKind: 'Named-feature coordinate (approximate region reference), not the region centre',
    sources: ['https://en.wikipedia.org/wiki/Mons_Mouton', 'https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/', 'https://science.nasa.gov/mission/viper'],
    notes: '"Mons Mouton" and "Mons Mouton Plateau" are both in NASA\'s October 2024 list of nine Artemis III regions. NASA gives no numeric region coordinates.' },

  // ---------------------------------------------------- reference features
  { id: 'shackleton_centre', name: 'Shackleton crater centre (floor)', mission: 'Reference feature', agency: '-', country: '-', lat: -89.67, lon: 129.78,
    status: 'reference', year: null, coordKind: 'Crater centre (IAU feature coordinate via Wikipedia)',
    sources: ['https://en.wikipedia.org/wiki/Shackleton_(crater)'],
    notes: 'Permanently shadowed crater floor - a contrast case for the sunlit rim and ridge points.' }
];

// Artemis III regions (NASA, Oct 2024) that we could NOT plot because no numeric coordinate
// was found in any fetched source. Listed so the UI can show them honestly.
window.LUNA_UNPLOTTED_REGIONS = {
  source: 'https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/',
  names: ['Peak near Cabeus B', 'Haworth', 'Malapert Massif', 'Mons Mouton Plateau', 'Nobile Rim 1', 'de Gerlache Rim 2', 'Slater Plain']
};
