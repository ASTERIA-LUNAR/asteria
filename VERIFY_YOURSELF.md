# Verify ASTERIA yourself

This guide is for anyone who wants to check ASTERIA's numbers without programming. Each check takes a few minutes and needs only a web browser.

---

## 1. Check the Sun and Earth positions against NASA/JPL Horizons

JPL Horizons is NASA's official service for the positions of the Sun, Moon and planets. ASTERIA was compared with it on many cases. One of the **blind-test** cases is below: it was chosen at random and fetched fresh from Horizons on 14 Nov 2026 (VALIDATION_REPORT.md, section "C. Blind test").

**The case:** Peak near Shackleton (latitude −88.79°, longitude 124.5° east), **4 December 2026, 00:50 UTC**.

### Step 1: ask NASA

Copy this whole address into your browser's address bar and press Enter. It asks Horizons where the **Sun** is, as seen from that point on the Moon:

```
https://ssd.jpl.nasa.gov/api/horizons.api?format=text&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&QUANTITIES=%274%27&APPARENT=%27AIRLESS%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&CSV_FORMAT=%27YES%27&TIME_TYPE=%27UT%27&COMMAND=%2710%27&SITE_COORD=%27124.5%2C-88.79%2C0%27&TLIST=%272026-12-04+00%3A50%27
```

What the address means: `COMMAND='10'` = the Sun, `CENTER='coord@301'` = a point on the Moon (301), `SITE_COORD='124.5,-88.79,0'` = east longitude, latitude, height 0 km, `TLIST='2026-12-04 00:50'` = the time (UT), `QUANTITIES='4'` = azimuth and elevation, `APPARENT='AIRLESS'` = no atmosphere.

You get a page of plain text. Check these lines near the top:

```
Target body name: Sun (10)
Center body name: Moon (301)
Center geodetic : 124.5, -88.79, ...
```

Then find the line `$$SOE` (start of ephemeris). The line under it holds the answer:

```
 Date__(UT)__HR:MN:SC.fff, , ,Azimuth_(a-app), Elevation_(a-app),
...
$$SOE
 2026-Dec-04 00:50:00.000,*, ,  118.656263015,       0.877258331,
$$EOE
```

So NASA says: **Sun azimuth 118.656°, elevation 0.877°**. (Azimuth is measured clockwise from north; elevation is the angle above the flat horizon.)

For the **Earth**, use the same address with `COMMAND=%2710%27` changed to `COMMAND=%27399%27` (399 = Earth):

```
https://ssd.jpl.nasa.gov/api/horizons.api?format=text&OBJ_DATA=%27NO%27&MAKE_EPHEM=%27YES%27&EPHEM_TYPE=%27OBSERVER%27&CENTER=%27coord%40301%27&COORD_TYPE=%27GEODETIC%27&QUANTITIES=%274%27&APPARENT=%27AIRLESS%27&ANG_FORMAT=%27DEG%27&EXTRA_PREC=%27YES%27&CSV_FORMAT=%27YES%27&TIME_TYPE=%27UT%27&COMMAND=%27399%27&SITE_COORD=%27124.5%2C-88.79%2C0%27&TLIST=%272026-12-04+00%3A50%27
```

NASA's answer for the Earth (line under `$$SOE`): **azimuth 242.084°, elevation −6.003°** (Earth is below the horizon at that moment).

### Step 2: ask ASTERIA

1. Double-click `index.html` to open ASTERIA.
2. Click in the browser's address bar, go to the very end of the address, and add this text (it is ASTERIA's share link for the same place and time):

   ```
   #site=peak_shackleton&t=2026-12-04T00:50Z&w=7
   ```

   The address then ends in `index.html#site=peak_shackleton&t=2026-12-04T00:50Z&w=7`. Press Enter.
3. Tick **Expert view** at the top right.
4. Check that the site name is **Peak near Shackleton (illuminated area)** and that "Showing" says **2026-12-04 00:50 UTC**. (The time slider must be at the far left, which is the start of the window.)
5. Scroll down to the panel **Technical values at the selected time**. Read *Sun elevation*, *Sun azimuth*, *Earth elevation* and *Earth azimuth*.

### What you should see

| | NASA/JPL Horizons | ASTERIA (Expert view) | Difference |
|---|---|---|---|
| Sun azimuth | 118.656° | 118.653° | 0.003° |
| Sun elevation | 0.877° | +0.877° | less than 0.001° |
| Earth azimuth | 242.084° | 242.081° | 0.002° |
| Earth elevation | −6.003° | −6.002° | 0.001° |

The two agree to about **0.01° or better** (for scale: the Sun's disk is about half a degree wide). Small differences come from different models of the Moon's orientation (ASTERIA uses the IAU model; Horizons uses JPL's DE441-based frame); see VALIDATION_REPORT.md for all cases.

Note: the elevations here are measured from a **flat, smooth** horizon, exactly like Horizons. Whether the Sun is actually visible also depends on the hills around the site, which Horizons does not include; ASTERIA's "Horizon at Sun / Earth az" card shows the terrain height in that direction.

---

## 2. Check a site's coordinates in LROC Quickmap

LROC Quickmap is the Lunar Reconnaissance Orbiter Camera team's online map of the Moon (NASA/GSFC/Arizona State University). You can use it to see that a site's coordinates point to the right place.

**Site A: IM-2 Athena** (ASTERIA: latitude −84.7906°, longitude 29.1957° east)
**Site B: Apollo 11 Lunar Module** (ASTERIA: latitude 0.67416°, longitude 23.47314° east)

Steps (Quickmap's buttons can change over time; if one is named differently, look for the closest match):

1. Open https://quickmap.lroc.asu.edu/ and wait for the Moon to load.
2. For a site near the south pole (Site A), switch the map projection to the **south polar** view (Quickmap offers equatorial, north polar and south polar projections in its projection/layers menu). For Site B the normal (equatorial) view is fine.
3. Move the mouse over the map: Quickmap shows the **latitude and longitude under the cursor** on screen. Zoom in (mouse wheel) and move until the cursor shows the site's coordinates. If Quickmap's search box accepts coordinates, you can also type them there.
4. **Site B (Apollo 11):** at high zoom you should see the Apollo 11 landing site area in Mare Tranquillitatis. Quickmap has a layer of named features and landing sites that you can switch on to check the label.
5. **Site A (IM-2):** at high zoom you should be on the high ground near Mons Mouton, close to the south pole.
6. Compare with the source ASTERIA uses (in ASTERIA: choose the site, tick Expert view, follow the "Sources" link):
   * IM-2: the LROC page https://lroc.im-ldi.com/images/1408 says the lander is "within a 20-meter diameter crater (84.7906° S, 29.1957° E)".
   * Apollo 11: NASA's NSSDC table https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html lists the Lunar Module at 0.67416 N, 23.47314 E.

Longitudes in ASTERIA are **east-positive**; a site given as "153.98° W" elsewhere is 206.02° E (or −153.98°) in ASTERIA.

---

## 3. Compare a site's sunlight with NASA's published illumination map

NASA's LOLA team publishes maps of average sunlight at the poles (PGDA product 69). ASTERIA shows them as a map layer and compares its own terrain model with them.

1. Open ASTERIA. Click **Choose a site** and pick **Peak near Shackleton - best-lit point (derived)** (or any south-pole site).
2. Above the map, select the layer **Avg. illumination**. The legend under the map explains the colours (0 = permanent shadow, brighter = more sunlight) and names the source. Inside the dashed yellow square you see NASA's 60 m map (about 85°S to the pole); outside it, NASA's coarser 120 m map.
3. Zoom in on the site marker and read the colour against the legend. That is NASA's long-term average for that spot, binned in steps of 10%.
4. Open the **Validation** tab and scroll to **All south-pole sites vs the published maps**. For each site the table lists ASTERIA's 18.6-year average illumination ("(1) Avg disk fraction") and the value of NASA's published map at the same point, and their difference.

Important: the **% sunlit on the Explore page is for the window you chose** (for example 30 days), so it changes with the date. NASA's map is an average over **18.6 years**. Compare like with like: use the Validation table (18.6 years in both columns). Also note that NASA's documentation describes the map value in two slightly different ways (both quoted on the Validation page).

---

## 4. Look at a raw NASA response that ASTERIA saved

Every answer ASTERIA received from JPL Horizons during validation is saved unchanged in the folder `tests/horizons_cache/`.

1. Open the folder `tests/horizons_cache` in the project. Each file has a name like `2306b5fbfb0e6179.txt`.
2. Open **`2306b5fbfb0e6179.txt`** with Notepad (or any text editor). This is the Sun answer for the case in section 1.
3. The **first line** starts with `#` and is the exact address that was sent to NASA - the same address as in section 1.
4. The rest is NASA's reply, as received. You will see:
   * `API SOURCE: NASA/JPL Horizons API`
   * a line `Ephemeris / API_USER ... Pasadena, USA / Horizons` with the date and time the answer was produced
   * `Target body name: Sun (10) {source: DE441}` and `Center body name: Moon (301)`
   * the table between `$$SOE` and `$$EOE` with the azimuth and elevation.
5. To confirm the file is genuine, paste the address from its first line into your browser: NASA returns the same text. Only the line with the generation date and time, and possibly the line describing Earth-orientation data (`EOP file`, `EOP coverage`), will differ, because they describe when the answer was made; the numbers between `$$SOE` and `$$EOE` should be identical.

The Earth answer for the same case is `c3c02fe117b4120d.txt`. The other blind-test files are listed in VALIDATION_REPORT.md (section "C. Blind test", column "Cache file").
