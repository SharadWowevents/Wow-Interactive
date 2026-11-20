const crypto = require('crypto');
const QRCode = require('qrcode');
const Question = require('../models/Question');
const geo = require('../utils/geo');
const { newId } = require('../utils/textProcessing');
const { summarize, qType, pollFor } = require('../utils/summarize');
const { effectiveCutoff, dayKey, labelForDayKey, rangeForDayKeys, DAY_TIMEZONE } = require('../utils/day');
const { broadcast } = require('../utils/sse');
const { broadcastQuestionUpdate, broadcastAdminUpdate, broadcastQuestionDeleted } = require('../utils/websocket');

const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

function baseUrl(req) {
  return PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}

function links(req, q) {
  const b = baseUrl(req);
  return {
    answer: `${b}/q/${q.id}`,
    live: `${b}/live/${q.id}`
  };
}

function validQuestionFields(body, q) {
  if (body.text !== undefined) {
    const t = String(body.text).replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!t) return 'Question text is required';
    q.text = t;
  }
  if (body.mode !== undefined) q.mode = body.mode === 'words' ? 'words' : 'phrase';
  if (body.maxPerPerson !== undefined) q.maxPerPerson = Math.max(1, Math.min(10, parseInt(body.maxPerPerson, 10) || 1));
  if (body.open !== undefined) q.open = !!body.open;
  if (body.venueId !== undefined) {
    if (!body.venueId) q.venue = null;
    else {
      const v = geo.get(body.venueId);
      if (!v) return 'Event city not found';
      q.venue = { id: v.id, name: v.name, label: v.label, lat: v.lat, lon: v.lon, cc: v.cc };
    }
  }
  if (body.multi !== undefined) q.multi = !!body.multi;
  if (body.showResults !== undefined) q.showResults = !!body.showResults;
  if (body.options !== undefined) {
    if (!Array.isArray(body.options)) return 'Options must be a list';
    const seen = new Set(), out = [];
    const old = new Map((q.options || []).map(o => [o.id, o]));
    for (const o of body.options) {
      const text = String((o && o.text) ?? o ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!text) continue;
      if (seen.has(text.toLowerCase())) return `"${text}" is listed twice`;
      seen.add(text.toLowerCase());
      const id = o && o.id && old.has(o.id) ? o.id : crypto.randomBytes(4).toString('hex');
      out.push({ id, text });
    }
    if (out.length < 2) return 'A poll needs at least 2 options';
    if (out.length > 8) return 'A poll can have at most 8 options';
    q.options = out;
  }
  if (Array.isArray(body.hidden)) {
    q.hidden = [...new Set(body.hidden.map(h => String(h).toLowerCase().trim()).filter(Boolean))].slice(0, 500);
  }
  return null;
}

exports.getQuestions = async (req, res) => {
  try {
    const list = await Question.find().sort({ createdAt: -1 }).lean();
    const result = list.map(q => {
      const c = q.type === 'poll' ? pollFor(q, true) : summarize(q);
      const isMap = q.type === 'map', isPoll = q.type === 'poll';
      const hiddenList = isMap
        ? (q.hidden || []).map(id => { const g = geo.get(id); return { key: String(id), text: g ? g.name : id }; })
        : (q.hidden || []).map(h => ({ key: h, text: h }));

      return {
        id: q.id,
        type: qType(q),
        text: q.text,
        options: isPoll ? q.options : undefined,
        multi: !!q.multi,
        showResults: q.showResults !== false,
        mode: q.mode,
        maxPerPerson: q.maxPerPerson,
        open: q.open,
        createdAt: q.createdAt,
        venue: q.venue || null,
        hidden: q.hidden || [],
        hiddenList,
        total: c.total,
        participants: c.participants,
        countries: isMap ? c.countries : undefined,
        blocked: (q.responses || []).filter(r => r.blocked && (r.t || 0) >= effectiveCutoff(q)).length,
        top: isPoll
          ? c.options.map(o => ({ text: o.text, key: o.id, count: o.count, pct: o.pct, leader: o.leader }))
          : isMap
          ? c.cities.slice(0, 12).map(x => ({ text: x.name, key: String(x.id), count: x.count }))
          : c.words.slice(0, 12),
        links: links(req, q)
      };
    });

    res.json({ questions: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const type = ['map', 'poll'].includes(req.body.type) ? req.body.type : 'cloud';
    let candidateId;
    while (true) {
      candidateId = newId();
      const existing = await Question.findOne({ id: candidateId });
      if (!existing) break;
    }

    const q = new Question({
      id: candidateId,
      type,
      text: '',
      mode: 'phrase',
      maxPerPerson: type === 'cloud' ? 3 : 1,
      open: true,
      hidden: [],
      responses: [],
      createdAt: Date.now(),
      venue: null
    });

    if (type === 'poll') {
      q.options = [];
      q.multi = false;
      q.showResults = true;
      if (req.body.options === undefined) {
        return res.status(400).json({ error: 'A poll needs at least 2 options' });
      }
    }

    const err = validQuestionFields(type === 'cloud' ? req.body : { ...req.body, maxPerPerson: 1 }, q);
    if (err || !q.text) {
      return res.status(400).json({ error: err || 'Question text is required' });
    }

    await q.save();
    broadcastAdminUpdate();
    res.json({ id: q.id, links: links(req, q) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const q = await Question.findOne({ id: req.params.id });
    if (!q) return res.status(404).json({ error: 'Question not found' });

    const body = { ...req.body };
    if (q.type !== 'cloud') delete body.maxPerPerson;
    if (q.type !== 'poll') { delete body.options; delete body.multi; }

    const err = validQuestionFields(body, q);
    if (err) return res.status(400).json({ error: err });

    await q.save();
    const meta = { id: q.id, open: q.open, showResults: q.showResults, resetAt: effectiveCutoff(q), text: q.text, options: q.options };
    broadcast(q.id, Question);
    broadcastQuestionUpdate(q.id, summarize(q), meta);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.clearQuestion = async (req, res) => {
  try {
    const q = await Question.findOne({ id: req.params.id });
    if (!q) return res.status(404).json({ error: 'Question not found' });

    q.responses = [];
    q.hidden = [];
    q.open = true;
    q.resetAt = Date.now();
    await q.save();

    const meta = { id: q.id, open: q.open, showResults: q.showResults, resetAt: effectiveCutoff(q), text: q.text, options: q.options };
    broadcast(q.id, Question);
    broadcastQuestionUpdate(q.id, summarize(q), meta);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const q = await Question.findOneAndDelete({ id: req.params.id });
    if (!q) return res.status(404).json({ error: 'Question not found' });

    broadcast(q.id, Question);
    broadcastQuestionDeleted(q.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Dates that actually have answers — used by the Export CSV calendar.
 * Future dates (and dates with no answers) are never returned, so the
 * calendar can disable them.
 */
exports.getExportDates = async (req, res) => {
  try {
    const q = await Question.findOne({ id: req.params.id }).lean();
    if (!q) return res.status(404).json({ error: 'Question not found' });

    const counts = new Map(); // dayKey -> count
    for (const r of q.responses || []) {
      if (!r.t) continue;
      const k = dayKey(r.t);
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    const dates = [...counts.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, count]) => ({ date, label: labelForDayKey(date), count }));

    res.json({
      timezone: DAY_TIMEZONE,
      today: dayKey(),
      total: dates.reduce((a, d) => a + d.count, 0),
      dates
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.exportCsv = async (req, res) => {
  try {
    const q = await Question.findOne({ id: req.params.id }).lean();
    if (!q) return res.status(404).json({ error: 'Question not found' });

    // Optional date range: ?from=2026-11-18&to=2026-11-19 (inclusive,
    // in DAY_TIMEZONE). No range = all data (old behaviour).
    const { from, to } = req.query;
    let responses = q.responses || [];
    let rangeSuffix = '';
    if (from || to) {
      const range = rangeForDayKeys(from, to);
      if (!range) {
        return res.status(400).json({ error: 'Invalid date range. Pick dates up to today — future dates have no data to export.' });
      }
      responses = responses.filter(r => (r.t || 0) >= range.fromMs && (r.t || 0) < range.toMs);
      rangeSuffix = from === to ? `_${from}` : `_${from}_to_${to}`;
    }

    const esc = s => '"' + String(s).replace(/"/g, '""') + '"';
    let rows;

    if (q.type === 'poll') {
      const name = new Map((q.options || []).map(o => [o.id, o.text]));
      rows = [['time', 'participant', 'answer'].join(',')];
      for (const r of responses) {
        rows.push([
          new Date(r.t).toISOString(),
          r.pid.slice(0, 8),
          esc((r.choices || []).map(c => name.get(c) || '(removed option)').join('; '))
        ].join(','));
      }
      const p = pollFor({ ...q, responses }, true, { allTime: true });
      rows.push('', 'summary,votes,percent_of_voters');
      for (const o of p.options) {
        rows.push([esc(o.text), o.count, o.pct].join(','));
      }
      rows.push(['"total voters"', p.total, ''].join(','));
    } else if (q.type === 'map') {
      rows = [['time', 'participant', 'city', 'state', 'country', 'latitude', 'longitude']
        .concat(q.venue ? ['km_to_event'] : []).join(',')];
      for (const r of responses) {
        const c = r.city || {};
        rows.push([
          new Date(r.t).toISOString(),
          r.pid.slice(0, 8),
          esc(c.name || r.text),
          esc(c.state || ''),
          esc(c.country || ''),
          c.lat,
          c.lon
        ].concat(q.venue && c.lat != null ? [Math.round(geo.km(c, q.venue))] : []).join(','));
      }
    } else {
      rows = [['time', 'participant', 'answer', 'filtered'].join(',')];
      for (const r of responses) {
        rows.push([
          new Date(r.t).toISOString(),
          r.pid.slice(0, 8),
          esc(r.text),
          r.blocked ? 'yes' : ''
        ].join(','));
      }
    }

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

    // Clean question text for filename (remove illegal filesystem characters, replace whitespace with underscores)
    const sanitizedTitle = String(q.text || 'answers')
      .replace(/[\/\\:*?"<>|#%&{}\\<>*?/$!'":@+`|=]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60);

    const filename = rangeSuffix
      ? `${sanitizedTitle || 'answers'}${rangeSuffix}.csv`
      : `${sanitizedTitle || 'answers'}_${dateStr}_${timeStr}.csv`;
    const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send('\uFEFF' + rows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const hexColor = (v, d) => /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v || '') ? v : d;

exports.getQr = async (req, res) => {
  try {
    const q = await Question.findOne({ id: req.params.id }).lean();
    if (!q) return res.status(404).send('Question not found');

    // Cache QR code for 24 hours in browser / CDN since question URL is immutable
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');

    const url = links(req, q).answer;
    const opts = {
      errorCorrectionLevel: 'M',
      margin: 2,
      color: {
        dark: hexColor(req.query.dark, '#000000'),
        light: hexColor(req.query.light, '#ffffff')
      }
    };

    if (req.path.endsWith('.svg')) {
      const svg = await QRCode.toString(url, { ...opts, type: 'svg' });
      res.type('image/svg+xml').send(svg);
    } else {
      const size = Math.max(128, Math.min(2048, parseInt(req.query.size, 10) || 1024));
      res.type('image/png');
      if (req.query.download) {
        res.setHeader('Content-Disposition', `attachment; filename="qr-${q.id}.png"`);
      }
      const buffer = await QRCode.toBuffer(url, { ...opts, width: size });
      res.send(buffer);
    }
  } catch (e) {
    res.status(500).send('QR error');
  }
};
