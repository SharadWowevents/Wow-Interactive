const { verifyPassword, getExpectedToken, isAdmin, setAdminPassword } = require('../middleware/auth');

const loginAttempts = new Map();

exports.login = async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);

    if (attempts.length >= 10) {
      return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    }

    attempts.push(now);
    loginAttempts.set(ip, attempts);

    const inputPassword = String(req.body.password || '');
    const isValid = await verifyPassword(inputPassword);

    if (!isValid) {
      return res.status(401).json({ error: 'Wrong password' });
    }

    // Clear failed attempts on successful login
    loginAttempts.delete(ip);

    const token = await getExpectedToken();
    const secure = req.protocol === 'https' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `wc_admin=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`);
    res.json({ ok: true, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.logout = (req, res) => {
  res.setHeader('Set-Cookie', 'wc_admin=; Path=/; Max-Age=0');
  res.json({ ok: true });
};

exports.checkAuth = async (req, res) => {
  try {
    const authenticated = await isAdmin(req);
    res.json({ authenticated });
  } catch (_) {
    res.json({ authenticated: false });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const isCurrentValid = await verifyPassword(currentPassword);
    if (!isCurrentValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newToken = await setAdminPassword(newPassword);
    const secure = req.protocol === 'https' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `wc_admin=${newToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`);

    res.json({ ok: true, message: 'Password changed successfully', token: newToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
