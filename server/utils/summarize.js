const geo = require('./geo');
const { tokens } = require('./textProcessing');
const { effectiveCutoff, dayInfo } = require('./day');

/**
 * Day-wise fresh data: by default only today's responses are summarised
 * (today = since midnight in DAY_TIMEZONE, or since the last manual
 * Clear if that was later). Pass { allTime: true } for full history
 * (e.g. CSV export).
 */
function visibleResponses(q, opts = {}) {
  const all = q.responses || [];
  if (opts.allTime) return all;
  const cutoff = effectiveCutoff(q);
  return all.filter(r => (r.t || 0) >= cutoff);
}

const TILE_URL = process.env.TILE_URL || '';
const TILE_ATTRIBUTION = process.env.TILE_ATTRIBUTION || '';

function cloudFor(q, opts = {}) {
  const responses = visibleResponses(q, opts);
  const counts = new Map(); // key -> {text, count, forms}
  const hidden = new Set((q.hidden || []).map(h => h.toLowerCase()));
  const people = new Set();
  let total = 0;

  for (const r of responses) {
    if (r.blocked) continue;
    total++;
    people.add(r.pid);
    for (const t of tokens(r.text, q.mode)) {
      const key = t.toLowerCase();
      if (hidden.has(key)) continue;
      let e = counts.get(key);
      if (!e) {
        e = { key, count: 0, forms: {} };
        counts.set(key, e);
      }
      e.count++;
      e.forms[t] = (e.forms[t] || 0) + 1;
    }
  }

  const words = [...counts.values()].map(e => {
    const form = Object.entries(e.forms).sort((a, b) => b[1] - a[1])[0][0];
    return { text: form, key: e.key, count: e.count };
  }).sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)).slice(0, 150);

  return {
    id: q.id,
    question: q.text,
    open: q.open,
    mode: q.mode,
    total,
    participants: people.size,
    words,
    ...dayInfo(q)
  };
}

function mapFor(q, opts = {}) {
  const responses = visibleResponses(q, opts);
  const hidden = new Set((q.hidden || []).map(String));
  const byCity = new Map();
  const countries = new Set();
  const people = new Set();
  let total = 0, totalKm = 0, farthest = null;

  for (const r of responses) {
    if (!r.city || hidden.has(String(r.city.id))) continue;
    total++;
    people.add(r.pid);
    countries.add(r.city.cc);
    let e = byCity.get(r.city.id);
    if (!e) {
      e = { ...r.city, count: 0, last: 0 };
      byCity.set(r.city.id, e);
    }
    e.count++;
    e.last = Math.max(e.last, r.t);
    if (q.venue) {
      const d = geo.km(r.city, q.venue);
      totalKm += d;
      if (!farthest || d > farthest.km) {
        farthest = { name: r.city.name, country: r.city.country, km: Math.round(d) };
      }
    }
  }

  const cities = [...byCity.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map(c => ({
      id: c.id,
      name: c.name,
      state: c.state,
      country: c.country,
      cc: c.cc,
      label: c.label,
      lat: c.lat,
      lon: c.lon,
      count: c.count,
      last: c.last,
      km: q.venue ? Math.round(geo.km(c, q.venue)) : undefined
    }));

  return {
    id: q.id,
    type: 'map',
    question: q.text,
    open: q.open,
    total,
    participants: people.size,
    countries: countries.size,
    venue: q.venue || null,
    totalKm: Math.round(totalKm),
    farthest,
    cities,
    tiles: TILE_URL ? { url: TILE_URL, attribution: TILE_ATTRIBUTION } : null,
    ...dayInfo(q)
  };
}

function pollFor(q, full, opts = {}) {
  const optionsList = q.options || [];
  const responses = visibleResponses(q, opts);
  const counts = new Map(optionsList.map(o => [o.id, 0]));
  const people = new Set();
  let last = 0;

  for (const r of responses) {
    if (!Array.isArray(r.choices)) continue;
    people.add(r.pid);
    last = Math.max(last, r.t);
    for (const c of r.choices) {
      if (counts.has(c)) counts.set(c, counts.get(c) + 1);
    }
  }

  const voters = people.size;
  const show = full || q.showResults !== false;
  const max = Math.max(0, ...counts.values());

  const options = optionsList.map(o => ({
    id: o.id,
    text: o.text,
    ...(show ? {
      count: counts.get(o.id) || 0,
      pct: voters ? Math.round(1000 * (counts.get(o.id) || 0) / voters) / 10 : 0,
      leader: max > 0 && (counts.get(o.id) || 0) === max
    } : {})
  }));

  return {
    id: q.id,
    type: 'poll',
    question: q.text,
    open: q.open,
    multi: !!q.multi,
    showResults: q.showResults !== false,
    total: voters,
    participants: voters,
    votes: [...counts.values()].reduce((a, b) => a + b, 0),
    last,
    options,
    ...dayInfo(q)
  };
}

const summarize = (q, full = false, opts = {}) => {
  // Allow summarize(q, { allTime: true }) as shorthand.
  if (full && typeof full === 'object') { opts = full; full = false; }
  const type = q.type || 'cloud';
  if (type === 'map') return mapFor(q, opts);
  if (type === 'poll') return pollFor(q, full, opts);
  return cloudFor(q, opts);
};

const qType = q => (q.type === 'map' || q.type === 'poll' ? q.type : 'cloud');

module.exports = {
  cloudFor,
  mapFor,
  pollFor,
  summarize,
  qType,
  visibleResponses
};
