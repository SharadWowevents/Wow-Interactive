const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || ADMIN_PASSWORD + ':wordcloud';

const adminToken = () => {
  return crypto.createHmac('sha256', SESSION_SECRET).update('admin:' + ADMIN_PASSWORD).digest('hex');
};

function readCookie(req, name) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function isAdmin(req) {
  // Check Authorization Bearer header first
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    token = readCookie(req, 'wc_admin');
  }

  const expected = adminToken();
  if (!token || token.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(401).json({ error: 'Not signed in' });
}

module.exports = {
  ADMIN_PASSWORD,
  SESSION_SECRET,
  adminToken,
  isAdmin,
  requireAdmin
};
