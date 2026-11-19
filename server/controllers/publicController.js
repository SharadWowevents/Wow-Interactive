const path = require('path');
const Question = require('../models/Question');
const geo = require('../utils/geo');
const { MAX_ANSWER_LEN, cleanAnswer, isBlocked } = require('../utils/textProcessing');
const { summarize, qType } = require('../utils/summarize');
const { addSubscriber, broadcast } = require('../utils/sse');
const { broadcastQuestionUpdate } = require('../utils/websocket');

const ipHits = new Map();

exports.getPublicQuestion = async (req, res) => {
  try {
    const q = await Question.findOne({ id: req.params.id }).lean();
    if (!q) return res.status(404).json({ error: 'Question not found' });

    res.json({
      id: q.id,
      type: qType(q),
      options: q.type === 'poll' ? q.options : undefined,
      multi: !!q.multi,
      showResults: q.showResults !== false,
      text: q.text,
      open: q.open,
      mode: q.mode,
      maxPerPerson: q.maxPerPerson,
      maxLength: MAX_ANSWER_LEN,
      resetAt: q.resetAt || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.submitAnswer = async (req, res) => {
  try {
    const q = await Question.findOne({ id: req.params.id });
    if (!q) return res.status(404).json({ error: 'Question not found' });
    if (!q.open) return res.status(403).json({ error: 'Responses are closed for this question.' });

    const pid = String(req.body.pid || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
    if (pid.length < 8) return res.status(400).json({ error: 'Please reload the page and try again.' });

    const now = Date.now();
    const ip = req.ip || req.connection.remoteAddress;
    const hits = (ipHits.get(ip) || []).filter(t => now - t < 60000);
    if (hits.length >= 1500) {
      return res.status(429).json({ error: 'Too many answers from this network. Wait a moment.' });
    }
    hits.push(now);
    ipHits.set(ip, hits);

    if (q.type === 'poll') {
      const valid = new Set((q.options || []).map(o => o.id));
      const choices = [...new Set((Array.isArray(req.body.choices) ? req.body.choices : []).map(String))].filter(c => valid.has(c));
      if (!choices.length) return res.status(400).json({ error: 'Pick an option first.' });
      if (!q.multi && choices.length > 1) return res.status(400).json({ error: 'Pick just one option.' });

      const prev = q.responses.findIndex(r => r.pid === pid);
      if (prev >= 0) q.responses.splice(prev, 1);

      const optionMap = new Map((q.options || []).map(o => [o.id, o.text]));
      q.responses.push({
        t: now,
        pid,
        choices,
        text: choices.map(c => optionMap.get(c) || '').join('; ')
      });

      await q.save();
      const meta = { id: q.id, open: q.open, showResults: q.showResults, resetAt: q.resetAt, options: q.options };
      broadcast(q.id, Question);
      broadcastQuestionUpdate(q.id, summarize(q), meta);
      return res.json({ ok: true, used: 1, maxPerPerson: 1, choices, changed: prev >= 0 });
    }

    if (q.type === 'map') {
      const city = geo.get(req.body.cityId);
      if (!city) return res.status(400).json({ error: 'Pick your city from the list.' });

      const prev = q.responses.findIndex(r => r.pid === pid);
      const entry = {
        t: now,
        pid,
        text: city.label,
        city: {
          id: city.id,
          name: city.name,
          state: city.state,
          country: city.country,
          cc: city.cc,
          label: city.label,
          lat: city.lat,
          lon: city.lon
        }
      };

      if (prev >= 0) q.responses.splice(prev, 1);
      q.responses.push(entry);

      await q.save();
      const meta = { id: q.id, open: q.open, showResults: q.showResults, resetAt: q.resetAt };
      broadcast(q.id, Question);
      broadcastQuestionUpdate(q.id, summarize(q), meta);
      return res.json({ ok: true, used: 1, maxPerPerson: 1, city: entry.city, changed: prev >= 0 });
    }

    // Word Cloud type
    const text = cleanAnswer(req.body.text);
    if (!text) return res.status(400).json({ error: 'Type an answer first.' });

    const mine = q.responses.filter(r => r.pid === pid);
    if (mine.length >= q.maxPerPerson) {
      return res.status(403).json({
        error: `You've already sent ${q.maxPerPerson} answer${q.maxPerPerson > 1 ? 's' : ''}. Thank you!`
      });
    }

    q.responses.push({
      t: now,
      pid,
      text,
      blocked: isBlocked(text) || false
    });

    await q.save();
    const meta = { id: q.id, open: q.open, showResults: q.showResults, resetAt: q.resetAt };
    broadcast(q.id, Question);
    broadcastQuestionUpdate(q.id, summarize(q), meta);
    res.json({ ok: true, used: mine.length + 1, maxPerPerson: q.maxPerPerson });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCloudData = async (req, res) => {
  try {
    const q = await Question.findOne({ id: req.params.id }).lean();
    if (!q) return res.status(404).json({ error: 'Question not found' });
    res.json(summarize(q));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCities = (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const query = req.query.q || '';
  const limit = Math.min(10, parseInt(req.query.limit, 10) || 8);
  res.json({ cities: geo.search(query, limit) });
};

exports.streamUpdates = async (req, res) => {
  try {
    const q = await Question.findOne({ id: req.params.id }).lean();
    if (!q) return res.status(404).json({ error: 'Question not found' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    res.write('retry: 3000\n');
    res.write(`data: ${JSON.stringify(summarize(q))}\n\n`);

    const cleanup = addSubscriber(q.id, res);
    req.on('close', cleanup);
  } catch (err) {
    res.status(500).end();
  }
};

exports.getCountriesGeoJson = (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=604800');
  res.sendFile(path.join(__dirname, '..', 'geo', 'countries-ind.json'));
};
