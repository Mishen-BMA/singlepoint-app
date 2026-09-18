const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured');
}

// Section 6 (Non-Functional Requirements) calls for a session that ends
// after a period of inactivity. JWTs can't be revoked early, so we fake a
// sliding expiry: every authenticated request gets a freshly-issued token
// with the timer reset, via the X-Auth-Token response header. If the
// frontend doesn't pick up a fresh token for 30 minutes, the old one expires
// and the next request is rejected.
const SESSION_TIMEOUT_SECONDS = 30 * 60;

function issueToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: SESSION_TIMEOUT_SECONDS }
  );
}

function requireUser(req, res, next) {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };

    res.setHeader('X-Auth-Token', issueToken(req.user));
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireManagerOrAdmin(req, res, next) {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager or Admin access required' });
  }
  next();
}

module.exports = {
  requireUser,
  requireAdmin,
  requireManagerOrAdmin,
  issueToken,
  SESSION_TIMEOUT_SECONDS
};
