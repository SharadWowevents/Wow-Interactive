const { ADMIN_PASSWORD, adminToken, isAdmin } = require('../middleware/auth');

const loginAttempts = new Map();

exports.login = (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);

  if (attempts.length >= 10) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  attempts.push(now);
  loginAttempts.set(ip, attempts);

  if (String(req.body.password || '') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  // Clear failed attempts on successful login
  loginAttempts.delete(ip);

  const token = adminToken();
  const secure = req.protocol === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `wc_admin=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`);
  res.json({ ok: true, token });
};

exports.logout = (req, res) => {
  res.setHeader('Set-Cookie', 'wc_admin=; Path=/; Max-Age=0');
  res.json({ ok: true });
};

exports.checkAuth = (req, res) => {
  res.json({ authenticated: isAdmin(req) });
};
