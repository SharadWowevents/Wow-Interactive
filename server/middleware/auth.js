const crypto = require('crypto');
const Admin = require('../models/Admin');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || ADMIN_PASSWORD + ':wordcloud';

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), String(salt), 100000, 64, 'sha512').toString('hex');
}

async function getAdminRecord() {
  try {
    return await Admin.findOne({ username: 'admin' });
  } catch (err) {
    return null;
  }
}

async function verifyPassword(password) {
  const adminDoc = await getAdminRecord();
  if (adminDoc) {
    const computedHash = hashPassword(password, adminDoc.salt);
    try {
      return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(adminDoc.passwordHash));
    } catch (_) {
      return false;
    }
  }
  return String(password) === ADMIN_PASSWORD;
}

async function getExpectedToken() {
  const adminDoc = await getAdminRecord();
  const secretKey = adminDoc ? adminDoc.passwordHash : ADMIN_PASSWORD;
  return crypto.createHmac('sha256', SESSION_SECRET).update('admin:' + secretKey).digest('hex');
}

function readCookie(req, name) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

async function isAdmin(req) {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    token = readCookie(req, 'wc_admin');
  }

  const expected = await getExpectedToken();
  if (!token || token.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch (_) {
    return false;
  }
}

async function requireAdmin(req, res, next) {
  const authenticated = await isAdmin(req);
  if (authenticated) return next();
  res.status(401).json({ error: 'Not signed in' });
}

async function setAdminPassword(newPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(newPassword, salt);
  await Admin.findOneAndUpdate(
    { username: 'admin' },
    { passwordHash, salt, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  return await getExpectedToken();
}

module.exports = {
  ADMIN_PASSWORD,
  SESSION_SECRET,
  verifyPassword,
  getExpectedToken,
  isAdmin,
  requireAdmin,
  setAdminPassword
};
