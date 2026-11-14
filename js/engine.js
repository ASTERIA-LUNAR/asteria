// Generated with Claude Code (Anthropic) under human direction.
/*
 * ASTERIA ephemeris engine
 * ---------------------------------------------------------------------------
 * Topocentric Sun / Earth azimuth & elevation for an observer on the Moon.
 * Plain JavaScript; works in the browser (expects window.Astronomy from
 * lib/astronomy.browser.min.js) and in Node (require('astronomy-engine')).
 *
 * METHOD (all vectors in the J2000 mean equator frame "EQJ", km):
 *  1. Moon orientation: Astronomy.RotationAxis(Body.Moon, t) gives the IAU
 *     (WGCCRE 2009) pole right ascension alpha, declination delta and prime
 *     meridian angle W. Body-fixed frame BF = Rz(W) * Rx(90-delta) * Rz(90+alpha) * EQJ.
 *     The site position in BF is r_site = (R+h)*(cos(lat)cos(lon), cos(lat)sin(lon), sin(lat)),
 *     R = 1737.4 km, lat/lon selenographic (east-positive longitude).
 *  2. Observer position: heliocentric Moon centre (Earth heliocentric state from
 *     VSOP87 + geocentric Moon state) plus the site vector rotated back to EQJ.
 *  3. Light-time: the target position is taken at the retarded time t - tau,
 *     tau = |target(t-tau) - observer(t)| / c, iterated (3 iterations, converges
 *     to < 1 microsecond). Sun: in the heliocentric frame the Sun is the origin,
 *     so its retarded position is the origin (Sun's barycentric motion, ~13 m/s,
 *     moves it < 7 km during the 499 s light time: < 0.00001 deg). Earth: its
 *     heliocentric position at t - tau is extrapolated linearly with its
 *     velocity (tau ~ 1.28 s, error << 1 m).
 *  4. Stellar aberration: first-order (special-relativistic to O(v/c)) correction
 *     using the observer velocity = Moon centre heliocentric velocity
 *     (~30 km/s, effect up to ~0.0057 deg). The 4.6 m/s rotational velocity of
 *     the surface is ignored (< 0.000001 deg). Gravitational light deflection is
 *     ignored (milli-arcsecond level for these geometries).
 *  5. The apparent direction is rotated into BF, then into the local
 *     East-North-Up frame of the site (spherical Moon: "up" = radial).
 *     Azimuth = atan2(E, N), measured clockwise from local north, where local
 *     north is the direction toward the lunar north pole along the site meridian.
 *     At exactly lat = -90 (or +90) every direction is "north" (or "south");
 *     we then use the LONGITUDE-MERIDIAN CONVENTION: the formulas below are
 *     evaluated as-is, so "north" is the direction along the meridian of the
 *     given longitude (at -90 that is the direction toward longitude lon,
 *     at +90 away from it). The given longitude therefore matters at the pole.
 *  6. No atmospheric refraction (the Moon has no atmosphere).
 *
 * Time arguments: JavaScript Date objects (UTC) or Astronomy.AstroTime.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('astronomy-engine'));
  } else {
    root.LunaEngine = factory(root.Astronomy);
  }
}(typeof self !== 'undefined' ? self : this, function (Astronomy) {
  'use strict';

  var MOON_RADIUS_KM = 1737.4;
  var SUN_RADIUS_KM = 695700;     // IAU 2015 nominal solar radius
  var EARTH_RADIUS_KM = 6378.137; // equatorial
  var KM_PER_AU = Astronomy.KM_PER_AU;
  var C_KM_S = 299792.458;
  var DEG = Math.PI / 180;

  function toTime(t) {
    return (t instanceof Astronomy.AstroTime) ? t : Astronomy.MakeTime(t);
  }

  function norm(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  // Rows of the matrix rotating EQJ vectors into the Moon body-fixed frame.
  function moonFrame(time) {
    var ax = Astronomy.RotationAxis(Astronomy.Body.Moon, time);
    var a = ax.ra * 15 * DEG;           // ra is returned in sidereal hours
    var d = ax.dec * DEG;
    var w = ax.spin * DEG;
    // z: pole
    var z = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
    // node of body equator on ICRF equator: Q = (-sin a, cos a, 0)
    var q = [-Math.sin(a), Math.cos(a), 0];
    // P = z x Q
    var p = [z[1] * q[2] - z[2] * q[1], z[2] * q[0] - z[0] * q[2], z[0] * q[1] - z[1] * q[0]];
    var cw = Math.cos(w), sw = Math.sin(w);
    var x = [cw * q[0] + sw * p[0], cw * q[1] + sw * p[1], cw * q[2] + sw * p[2]];
    var y = [-sw * q[0] + cw * p[0], -sw * q[1] + cw * p[1], -sw * q[2] + cw * p[2]];
    return { x: x, y: y, z: z, axis: ax };
  }

  function siteFrame(latDeg, lonDeg) {
    var la = latDeg * DEG, lo = lonDeg * DEG;
    var cl = Math.cos(la), sl = Math.sin(la), co = Math.cos(lo), so = Math.sin(lo);
    return {
      up: [cl * co, cl * so, sl],
      east: [-so, co, 0],
      north: [-sl * co, -sl * so, cl]
    };
  }

  // Core: apparent topocentric az/el of Sun and Earth.
  // site = {lat, lon, h_km (optional, height above 1737.4 km sphere)}
  function sunEarthAt(site, t) {
    var time = toTime(t);
    var h = site.h_km || 0;
    var F = moonFrame(time);
    var S = siteFrame(site.lat, site.lon);
    var rad = MOON_RADIUS_KM + h;
    // site position: body-fixed -> EQJ  (EQJ = x*bx + y*by + z*bz)
    var u = S.up;
    var siteEqj = [0, 0, 0];
    for (var i = 0; i < 3; i++) siteEqj[i] = rad * (u[0] * F.x[i] + u[1] * F.y[i] + u[2] * F.z[i]);

    var es = Astronomy.HelioState(Astronomy.Body.Earth, time);   // AU, AU/day
    var ms = Astronomy.GeoMoonState(time);
    var E = [es.x * KM_PER_AU, es.y * KM_PER_AU, es.z * KM_PER_AU];
    var Ev = [es.vx * KM_PER_AU / 86400, es.vy * KM_PER_AU / 86400, es.vz * KM_PER_AU / 86400];
    var Mg = [ms.x * KM_PER_AU, ms.y * KM_PER_AU, ms.z * KM_PER_AU];
    var Mv = [Ev[0] + ms.vx * KM_PER_AU / 86400, Ev[1] + ms.vy * KM_PER_AU / 86400, Ev[2] + ms.vz * KM_PER_AU / 86400];
    var obs = [E[0] + Mg[0] + siteEqj[0], E[1] + Mg[1] + siteEqj[1], E[2] + Mg[2] + siteEqj[2]];

    // Sun: retarded position = origin (see header)
    var sunVec = [-obs[0], -obs[1], -obs[2]];
    // Earth: iterate light time
    var tau = 0, earthVec;
    for (var k = 0; k < 3; k++) {
      earthVec = [E[0] - Ev[0] * tau - obs[0], E[1] - Ev[1] * tau - obs[1], E[2] - Ev[2] * tau - obs[2]];
      tau = norm(earthVec) / C_KM_S;
    }

    function apparent(vec) {
      var d = norm(vec);
      var uu = [vec[0] / d, vec[1] / d, vec[2] / d];
      var b = [Mv[0] / C_KM_S, Mv[1] / C_KM_S, Mv[2] / C_KM_S];
      var ub = dot(uu, b);
      var a = [uu[0] + b[0] - uu[0] * ub, uu[1] + b[1] - uu[1] * ub, uu[2] + b[2] - uu[2] * ub];
      var n = norm(a);
      a = [a[0] / n, a[1] / n, a[2] / n];
      // EQJ -> body fixed
      var bf = [dot(a, F.x), dot(a, F.y), dot(a, F.z)];
      var e = dot(bf, S.east), nn = dot(bf, S.north), up = dot(bf, S.up);
      var az = Math.atan2(e, nn) / DEG;
      if (az < 0) az += 360;
      var el = Math.asin(Math.max(-1, Math.min(1, up))) / DEG;
      // bf: apparent unit direction in the Moon body-fixed frame (used by offline terrain tools)
      return { az: az, el: el, dist_km: d, bf: bf };
    }

    var sun = apparent(sunVec);
    var earth = apparent(earthVec);
    sun.radius_deg = Math.asin(SUN_RADIUS_KM / sun.dist_km) / DEG;
    earth.radius_deg = Math.asin(EARTH_RADIUS_KM / earth.dist_km) / DEG;
    earth.lightTime_s = tau;
    return { time: time.date, sun: sun, earth: earth };
  }

  // Interpolated horizon elevation (deg) at azimuth az from a 360-element mask.
  function maskAt(mask, az) {
    if (!mask) return 0;
    var a = ((az % 360) + 360) % 360;
    var i = Math.floor(a), f = a - i;
    var j = (i + 1) % 360;
    return mask[i] * (1 - f) + mask[j] * f;
  }

  // Fraction (0..1) of the solar disk area above a horizon at elevation hz.
  // Treats the horizon as a straight line across the disk (the disk is only
  // ~0.53 deg wide). Uses the circular-segment area formula.
  function diskFractionAbove(centerEl, radiusDeg, hz) {
    var r = radiusDeg;
    var y0 = (hz || 0) - centerEl;     // horizon position relative to disk centre
    if (y0 >= r) return 0;
    if (y0 <= -r) return 1;
    var A = r * r * Math.acos(y0 / r) - y0 * Math.sqrt(r * r - y0 * y0);
    return A / (Math.PI * r * r);
  }

  function defaultStepMin(startDate, endDate) {
    var days = (endDate - startDate) / 86400000;
    return days <= 30 ? 10 : 60;
  }

  // Time series. Returns arrays (fast to chart).
  // earthMask (optional, ASTERIA round 2): separate horizon for the Earth test, e.g. the terrain mask
  // plus a minimum link elevation. When omitted, Earth uses 'mask' exactly as before.
  function series(site, startDate, endDate, stepMin, mask, earthMask) {
    if (earthMask === undefined) earthMask = mask;
    stepMin = stepMin || defaultStepMin(startDate, endDate);
    var out = { t: [], sunAz: [], sunEl: [], sunFrac: [], sunDist: [], earthAz: [], earthEl: [], sunUp: [], earthUp: [], stepMin: stepMin };
    var t0 = startDate.getTime(), t1 = endDate.getTime(), dt = stepMin * 60000;
    for (var ms = t0; ms <= t1; ms += dt) {
      var r = sunEarthAt(site, new Date(ms));
      var hs = maskAt(mask, r.sun.az), he = maskAt(earthMask, r.earth.az);
      out.t.push(ms);
      out.sunAz.push(r.sun.az); out.sunEl.push(r.sun.el);
      out.sunFrac.push(diskFractionAbove(r.sun.el, r.sun.radius_deg, hs));
      out.sunDist.push(r.sun.dist_km);
      out.earthAz.push(r.earth.az); out.earthEl.push(r.earth.el);
      out.sunUp.push(r.sun.el > hs); out.earthUp.push(r.earth.el > he);
    }
    return out;
  }

  // Height of body centre above the horizon mask (deg), at Date d.
  function aboveMask(site, body, d, mask) {
    var r = sunEarthAt(site, d);
    var b = body === 'sun' ? r.sun : r.earth;
    return b.el - maskAt(mask, b.az);
  }

  // Refine a sign change between ta and tb (ms) by bisection to tolMin minutes.
  function bisect(site, body, ta, tb, fa, mask, tolMin) {
    var tol = (tolMin || 1) * 60000;
    while (tb - ta > tol) {
      var tm = (ta + tb) / 2;
      var fm = aboveMask(site, body, new Date(tm), mask);
      if ((fm > 0) === (fa > 0)) { ta = tm; fa = fm; } else { tb = tm; }
    }
    return new Date(Math.round((ta + tb) / 2));
  }

  // Find rise/set events of body ('sun' | 'earth') centre relative to the mask
  // between startDate and endDate. Coarse scan at stepMin then bisection to 1 min.
  // Note: events closer together than the scan step can be missed.
  function findEvents(site, body, startDate, endDate, mask, stepMin) {
    stepMin = stepMin || 10;
    var events = [];
    var dt = stepMin * 60000;
    var ta = startDate.getTime();
    var fa = aboveMask(site, body, new Date(ta), mask);
    var initialUp = fa > 0;
    for (var tb = ta + dt; tb <= endDate.getTime() + dt - 1; tb += dt) {
      var tbc = Math.min(tb, endDate.getTime());
      var fb = aboveMask(site, body, new Date(tbc), mask);
      if ((fa > 0) !== (fb > 0)) {
        var when = bisect(site, body, ta, tbc, fa, mask, 1);
        events.push({ type: fb > 0 ? 'rise' : 'set', time: when });
      }
      ta = tbc; fa = fb;
      if (tbc === endDate.getTime()) break;
    }
    return { initiallyUp: initialUp, events: events };
  }

  // Next event (rise if currently down, set if currently up), searching up to maxDays.
  function nextEvent(site, body, fromDate, mask, maxDays, stepMin) {
    maxDays = maxDays || 40;
    stepMin = stepMin || 20;
    var chunk = 5; // days per search chunk
    var start = fromDate;
    var up = aboveMask(site, body, fromDate, mask) > 0;
    for (var d = 0; d < maxDays; d += chunk) {
      var end = new Date(start.getTime() + chunk * 86400000);
      var r = findEvents(site, body, start, end, mask, stepMin);
      if (r.events.length) return { currentlyUp: up, event: r.events[0] };
      start = end;
    }
    return { currentlyUp: up, event: null };
  }

  // Summary statistics from a series (fractions and longest runs, in hours).
  // statsRange covers samples i0..i1-1 (used by the launch-slip heatmap on sub-windows).
  function stats(s) { return statsRange(s, 0, s.t.length); }
  function statsRange(s, i0, i1) {
    var n = i1 - i0, sun = 0, earth = 0, both = 0, frac = 0;
    var dark = 0, maxDark = 0, blk = 0, maxBlk = 0;
    var stepH = s.stepMin / 60;
    for (var i = i0; i < i1; i++) {
      frac += s.sunFrac[i];
      if (s.sunUp[i]) { sun++; dark = 0; } else { dark++; if (dark > maxDark) maxDark = dark; }
      if (s.earthUp[i]) { earth++; blk = 0; } else { blk++; if (blk > maxBlk) maxBlk = blk; }
      if (s.sunUp[i] && s.earthUp[i]) both++;
    }
    return {
      pctSun: 100 * sun / n, pctEarth: 100 * earth / n, pctBoth: 100 * both / n,
      avgSunFrac: frac / n,
      longestDarkH: maxDark * stepH, longestBlackoutH: maxBlk * stepH,
      samples: n
    };
  }

  // ------------------------------------------------------- launch slip scan
  // One series covering [nominal + slipMin, nominal + slipMax + duration] at the same step the
  // main timeline uses for a window of 'durationDays' (10 min <= 30 d, else 60 min); each slip's
  // mission window is an exact sub-range of samples, so slip 0 reproduces the timeline metrics.
  function slipScan(site, nominal, durationDays, slipMin, slipMax, slipStep, mask, earthMask) {
    var stepMin = defaultStepMin(nominal, new Date(nominal.getTime() + durationDays * 86400000));
    var perDay = 1440 / stepMin;
    var start = new Date(nominal.getTime() + slipMin * 86400000);
    var end = new Date(nominal.getTime() + (slipMax + durationDays) * 86400000);
    var s = series(site, start, end, stepMin, mask, earthMask);
    var nWin = Math.round(durationDays * perDay) + 1;
    var rows = [];
    for (var slip = slipMin; slip <= slipMax + 1e-9; slip += slipStep) {
      var i0 = Math.round((slip - slipMin) * perDay);
      if (i0 + nWin > s.t.length) break;
      var st = statsRange(s, i0, i0 + nWin);
      var toSet;
      if (!s.sunUp[i0]) toSet = 0;
      else {
        toSet = null; // null = Sun does not set within the mission window
        for (var j = i0 + 1; j < i0 + nWin; j++) if (!s.sunUp[j]) { toSet = (j - i0) * stepMin / 60; break; }
      }
      st.slip = slip; st.landing = new Date(s.t[i0]); st.hoursToFirstSunset = toSet;
      rows.push(st);
    }
    return { stepMin: stepMin, rows: rows, series: s, nWin: nWin, perDay: perDay };
  }

  // ---------------------------------------------------------------- power
  // Solar constant: IAU 2015 Resolution B3 nominal total solar irradiance, exactly 1361 W/m^2
  // (Prsa et al. 2016, AJ 152, 41, arXiv:1510.07674), scaled by (1 AU / Sun distance)^2.
  var SOLAR_CONSTANT_W_M2 = 1361;
  // Cosine of the incidence angle between the Sun direction and the panel normal (clamped >= 0).
  // mode 'track': vertical panel rotating in azimuth to face the Sun -> cos(el)
  // mode 'horizontal': panel facing straight up -> sin(el)
  // mode 'fixed': vertical panel facing azimuth faceAz -> cos(el) * cos(az - faceAz)
  function panelCosIncidence(mode, sunAz, sunEl, faceAz) {
    var el = sunEl * DEG, c;
    if (mode === 'horizontal') c = Math.sin(el);
    else if (mode === 'fixed') c = Math.cos(el) * Math.cos((sunAz - (faceAz || 0)) * DEG);
    else c = Math.cos(el);
    return c > 0 ? c : 0;
  }
  // Electrical power (W): S0 * (AU/d)^2 * area * efficiency * cos(incidence) * visible disk fraction.
  function panelPower(opts, sunAz, sunEl, sunDistKm, diskFrac) {
    var au = KM_PER_AU / sunDistKm;
    return SOLAR_CONSTANT_W_M2 * au * au * opts.area * opts.eff *
      panelCosIncidence(opts.mode, sunAz, sunEl, opts.faceAz) * diskFrac;
  }

  return {
    MOON_RADIUS_KM: MOON_RADIUS_KM,
    SOLAR_CONSTANT_W_M2: SOLAR_CONSTANT_W_M2,
    KM_PER_AU: KM_PER_AU,
    panelCosIncidence: panelCosIncidence,
    panelPower: panelPower,
    statsRange: statsRange,
    slipScan: slipScan,
    SUN_RADIUS_KM: SUN_RADIUS_KM,
    sunEarthAt: sunEarthAt,
    maskAt: maskAt,
    diskFractionAbove: diskFractionAbove,
    series: series,
    findEvents: findEvents,
    nextEvent: nextEvent,
    stats: stats,
    defaultStepMin: defaultStepMin,
    _moonFrame: moonFrame
  };
}));
