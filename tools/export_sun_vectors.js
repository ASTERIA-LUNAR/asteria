#!/usr/bin/env node
// Generated with Claude Code (Anthropic) under human direction.
/* Export hourly apparent Sun directions (Moon body-fixed frame) + Sun distance, as seen from a
 * site, for the offline terrain-illumination cross-check (tools/illum_crosscheck.py).
 * Output: binary little-endian float64 records [t_ms, bx, by, bz, dist_km] (5 doubles).
 * Usage: node tools/export_sun_vectors.js lat lon startISO endISO stepMin out.bin */
'use strict';
const fs = require('fs');
const E = require('../js/engine.js');
const [lat, lon, a, b, step, out] = process.argv.slice(2);
const t0 = Date.parse(a), t1 = Date.parse(b), dt = (+step) * 60000;
const n = Math.floor((t1 - t0) / dt) + 1;
const buf = new Float64Array(n * 5);
for (let i = 0; i < n; i++) {
  const t = t0 + i * dt;
  const r = E.sunEarthAt({ lat: +lat, lon: +lon }, new Date(t));
  buf.set([t, r.sun.bf[0], r.sun.bf[1], r.sun.bf[2], r.sun.dist_km], i * 5);
}
fs.writeFileSync(out, Buffer.from(buf.buffer));
console.log('wrote', n, 'records to', out);
