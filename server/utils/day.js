/**
 * Day-wise (daily fresh) helpers.
 *
 * The Live page should only show *today's* answers. At midnight the
 * count / word-cloud / poll / map automatically starts from zero again
 * — no manual "Clear" needed, and yesterday's answers stay in the DB.
 *
 * The day boundary is midnight in DAY_TIMEZONE (default Asia/Kolkata,
 * because the event / projector is in India). Set DAY_TIMEZONE in
 * server/.env if the event is elsewhere, e.g. DAY_TIMEZONE=UTC
 */

const DAY_TIMEZONE =
  process.env.DAY_TIMEZONE || process.env.APP_TIMEZONE || 'Asia/Kolkata';

function partsInTz(timeZone, dateMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = {};
  for (const p of dtf.formatToParts(new Date(dateMs))) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return parts;
}

/** Offset (ms) of `timeZone` wall-clock ahead of UTC at `dateMs`. */
function tzOffsetMs(timeZone, dateMs) {
  const p = partsInTz(timeZone, dateMs);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - Math.floor(dateMs / 1000) * 1000;
}

/** Epoch ms of 00:00 (in DAY_TIMEZONE) of the day containing `dateMs + dayOffset`. */
function startOfDayMs(now = Date.now(), dayOffset = 0) {
  const p = partsInTz(DAY_TIMEZONE, now);
  const y = +p.year, m = +p.month - 1, d = +p.day + dayOffset;
  // Start from UTC midnight of that calendar date, then refine for the tz offset.
  let guess = Date.UTC(y, m, d);
  for (let i = 0; i < 3; i++) {
    guess = Date.UTC(y, m, d) - tzOffsetMs(DAY_TIMEZONE, guess);
  }
  return guess;
}

function nextDayStartMs(now = Date.now()) {
  return startOfDayMs(now, 1);
}

/** e.g. "2026-11-19" in DAY_TIMEZONE */
function dayKey(now = Date.now()) {
  const p = partsInTz(DAY_TIMEZONE, now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** e.g. "Thu, 19 Nov 2026" in DAY_TIMEZONE */
function dayLabel(now = Date.now()) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: DAY_TIMEZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(now));
  } catch {
    return dayKey(now);
  }
}

/**
 * Responses before this instant must not show on the Live page:
 * whichever is later — the last manual Clear (resetAt) or today's midnight.
 */
function effectiveCutoff(q, now = Date.now()) {
  return Math.max((q && q.resetAt) || 0, startOfDayMs(now));
}

function dayInfo(q, now = Date.now()) {
  return {
    dayKey: dayKey(now),
    dayLabel: dayLabel(now),
    dayStart: startOfDayMs(now),
    nextDayStart: nextDayStartMs(now),
    timezone: DAY_TIMEZONE,
    resetAt: effectiveCutoff(q, now)
  };
}

/** Parse "YYYY-MM-DD" -> { y, m (1-12), d } or null. */
function parseDayKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** Epoch ms of 00:00 (DAY_TIMEZONE) on the calendar date "YYYY-MM-DD". */
function startOfDayKeyMs(key) {
  const p = parseDayKey(key);
  if (!p) return null;
  let guess = Date.UTC(p.y, p.m - 1, p.d);
  for (let i = 0; i < 3; i++) {
    guess = Date.UTC(p.y, p.m - 1, p.d) - tzOffsetMs(DAY_TIMEZONE, guess);
  }
  return guess;
}

/** "Thu, 19 Nov 2026" label for a specific "YYYY-MM-DD" key. */
function labelForDayKey(key) {
  const ms = startOfDayKeyMs(key);
  return ms == null ? String(key || '') : dayLabel(ms);
}

/**
 * Inclusive date-range [fromKey, toKey] -> { fromMs, toMs } where toMs is
 * exclusive (midnight after toKey). Returns null for invalid / reversed /
 * future ranges.
 */
function rangeForDayKeys(fromKey, toKey) {
  if (!parseDayKey(fromKey) || !parseDayKey(toKey)) return null;
  if (fromKey > toKey) return null;
  if (toKey > dayKey()) return null; // no future data can exist
  const fromMs = startOfDayKeyMs(fromKey);
  // Midnight after toKey: take toKey's midnight and add one calendar day.
  const p = parseDayKey(toKey);
  let toMs = Date.UTC(p.y, p.m - 1, p.d + 1);
  for (let i = 0; i < 3; i++) {
    toMs = Date.UTC(p.y, p.m - 1, p.d + 1) - tzOffsetMs(DAY_TIMEZONE, toMs);
  }
  return { fromMs, toMs };
}

module.exports = {
  DAY_TIMEZONE,
  startOfDayMs,
  nextDayStartMs,
  dayKey,
  dayLabel,
  effectiveCutoff,
  dayInfo,
  parseDayKey,
  startOfDayKeyMs,
  labelForDayKey,
  rangeForDayKeys
};
