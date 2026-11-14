/* Shared JPL Horizons client for tests/validate.js and tests/blind_test.js.
 * Observer on the Moon (CENTER='coord@301', geodetic E-lon, lat, height 0 km on the 1737.4 km sphere),
 * apparent azimuth/elevation (QUANTITIES='4', APPARENT='AIRLESS'), UT. Every response is cached in
 * tests/horizons_cache/<sha1 of the query>.txt; the first line of each file is the exact query URL. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const CACHE = path.join(__dirname, 'horizons_cache');
const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';
fs.mkdirSync(CACHE, { recursive: true });

function fmtH(d) { return d.toISOString().slice(0, 16).replace('T', ' '); }   // 'YYYY-MM-DD HH:MM'
function siteCoord(s) { return `'${s.lon},${s.lat},0'`; }
function query(params) {
  const base = {
    format: 'text', OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'", COORD_TYPE: "'GEODETIC'", QUANTITIES: "'4'", APPARENT: "'AIRLESS'",
    ANG_FORMAT: "'DEG'", EXTRA_PREC: "'YES'", CSV_FORMAT: "'YES'", TIME_TYPE: "'UT'"
  };
  const qs = new URLSearchParams(Object.assign(base, params)).toString();
  const key = crypto.createHash('sha1').update(qs).digest('hex').slice(0, 16);
  return { qs, key, url: API + '?' + qs, file: path.join(CACHE, key + '.txt') };
}
function isCached(params) { return fs.existsSync(query(params).file); }
async function horizons(params) {
  const q = query(params);
  if (fs.existsSync(q.file)) return { text: fs.readFileSync(q.file, 'utf8'), cached: true, url: q.url, file: q.file };
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(q.url);
      const text = await res.text();
      if (!res.ok || !text.includes('$$SOE')) throw new Error('Horizons error: ' + text.slice(0, 400));
      fs.writeFileSync(q.file, '# ' + q.url + '\n' + text);
      await new Promise(r => setTimeout(r, 300));
      return { text, cached: false, url: q.url, file: q.file };
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1500)); }
  }
  throw lastErr;
}
function parseRows(text) {
  const block = text.split('$$SOE')[1].split('$$EOE')[0];
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  return block.trim().split(/\r?\n/).map(line => {
    const f = line.split(',').map(s => s.trim());
    const m = f[0].match(/(\d+)-(\w+)-(\d+) (\d+):(\d+):?([\d.]*)/);
    const t = Date.UTC(+m[1], MON[m[2]], +m[3], +m[4], +m[5], m[6] ? parseFloat(m[6]) : 0);
    const nums = f.filter(s => /^-?\d+(\.\d+)?$/.test(s)).map(Number);
    return { t, az: nums[nums.length - 2], el: nums[nums.length - 1] };
  });
}
function azDiff(a, b) { let d = a - b; d = ((d + 540) % 360) - 180; return d; }
module.exports = { API, CACHE, fmtH, siteCoord, query, isCached, horizons, parseRows, azDiff };
