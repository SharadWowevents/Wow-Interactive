// Offline city lookup (GeoNames data via all-the-cities, state names via country-state-city).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BOOST_COUNTRY = (process.env.BOOST_COUNTRY || 'IN').toUpperCase();

// Modern / popular names for Indian cities that the source data lists under older names, plus extra search aliases.
const OVERRIDES = {
  1270642: { name: 'Gurugram', alias: ['Gurgaon'] },
  1273874: { name: 'Kochi', alias: ['Cochin', 'Ernakulam'] },
  1262321: { name: 'Mysuru', state: 'Karnataka', alias: ['Mysore'] },
  1263780: { name: 'Mangaluru', state: 'Karnataka', alias: ['Mangalore'] },
  1270752: { name: 'Kalaburagi', state: 'Karnataka', alias: ['Gulbarga'] },
  1275701: { name: 'Vijayapura', state: 'Karnataka', alias: ['Bijapur'] },
  1276533: { name: 'Belagavi', state: 'Karnataka', alias: ['Belgaum'] },
  1269920: { name: 'Hubballi', alias: ['Hubli'] },
  1276509: { name: 'Ballari', alias: ['Bellary'] },
  1256515: { name: 'Shivamogga', alias: ['Shimoga'] },
  1278994: { name: 'Prayagraj', alias: ['Allahabad'] },
  1273313: { name: 'Dehradun', alias: ['Dehra Dun'] },
  1275817: { name: 'Bhubaneswar', alias: ['Bhubaneshwar'] },
  1277333: { alias: ['Bangalore'] },
  1275339: { alias: ['Bombay'] },
  1275004: { alias: ['Calcutta'] },
  1264527: { alias: ['Madras'] },
  1254163: { alias: ['Trivandrum'] },
  1265873: { alias: ['Calicut'] },
  1253573: { alias: ['Baroda'] },
  1253405: { alias: ['Banaras', 'Benares', 'Kashi'] },
  1259425: { alias: ['Pondicherry', 'Pondy'] },
  1253102: { alias: ['Vizag'] },
  1269843: { alias: ['Secunderabad'] },
  1260607: { alias: ['Panjim', 'Goa'] },
};

const stripMarks = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const compact = s => stripMarks(String(s)).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

let cities = null;   // array of {id, name, state, cc, country, lat, lon, pop, keys[]}
let byId = null;

function load() {
  if (cities) return;
  const citiesPath = path.join(__dirname, '..', 'geo', 'cities.tsv.gz');
  if (!fs.existsSync(citiesPath)) {
    console.warn(`[Geo] Warning: ${citiesPath} not found.`);
    cities = [];
    byId = new Map();
    return;
  }
  const raw = zlib.gunzipSync(fs.readFileSync(citiesPath)).toString('utf8');
  cities = [];
  byId = new Map();
  for (const line of raw.split('\n')) {
    const f = line.split('\t');
    if (f.length < 8) continue;
    const id = +f[0];
    const o = OVERRIDES[id] || {};
    let name = o.name || f[1];
    let state = o.state || f[2];
    if (f[3] === BOOST_COUNTRY || f[3] === 'IN') { name = stripMarks(name); state = stripMarks(state); }
    const aliases = [f[1], ...(f[8] ? f[8].split('|') : []), ...(o.alias || [])];
    const c = { id, name, state, cc: f[3], country: f[4], lat: +f[5], lon: +f[6], pop: +f[7] || 0 };
    c.keys = [...new Set([name, ...aliases].map(compact).filter(Boolean))];
    cities.push(c);
    byId.set(id, c);
  }
}

function label(c) {
  return [c.name, c.state && c.state !== c.name ? c.state : '', c.country].filter(Boolean).join(', ');
}

function pub(c) {
  return { id: c.id, name: c.name, state: c.state, country: c.country, cc: c.cc, label: label(c), lat: c.lat, lon: c.lon };
}

function search(q, limit = 8) {
  load();
  const raw = String(q || '').split(',')[0];
  const k = compact(raw);
  if (k.length < 2) return [];
  const hits = [];
  for (const c of cities) {
    let best = 0;
    for (const key of c.keys) {
      if (key === k) { best = 3; break; }
      if (key.startsWith(k)) best = Math.max(best, 1);
    }
    if (!best) continue;
    let score = Math.log10(c.pop + 10) + (best === 3 ? 2.5 : 0) + (c.cc === BOOST_COUNTRY ? 0.8 : 0);
    hits.push([score, c]);
  }
  hits.sort((a, b) => b[0] - a[0]);
  const seen = new Set(), out = [];
  for (const [, c] of hits) {
    const k = c.cc + '|' + c.state + '|' + compact(c.name);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(pub(c));
    if (out.length >= limit) break;
  }
  return out;
}

function get(id) {
  load();
  const c = byId.get(+id);
  return c ? pub(c) : null;
}

function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

module.exports = { load, search, get, label, km };
