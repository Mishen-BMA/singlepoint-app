const jwt = require('jsonwebtoken');
const {
  findUserById,
  findAuthSession,
  refreshAuthSession
} = require('../models/userModel');

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

function issueToken(user, sessionId) {
  return jwt.sign(
    { id: user.id, role: user.role, jti: sessionId },
    JWT_SECRET,
    { expiresIn: SESSION_TIMEOUT_SECONDS }
  );
}

async function requireSession(req, res, next) {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(payload.id);
    const session = payload.jti ? await findAuthSession(payload.jti, payload.id) : null;
    if (!user || !user.is_active || !session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    req.user = { id: user.id, role: user.role };

    const expiresAt = new Date(Date.now() + SESSION_TIMEOUT_SECONDS * 1000).toISOString();
    await refreshAuthSession(payload.jti, expiresAt);
    req.sessionId = payload.jti;
    res.setHeader('X-Auth-Token', issueToken(req.user, payload.jti));
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// requireUser = requireSession + the Acceptable Use Policy gate. Required
// lazily (not at module scope) to avoid a circular import between the auth
// middleware and the policy model.
async function requireUser(req, res, next) {
  return requireSession(req, res, async () => {
    try {
      const { getPendingGatePolicies } = require('../../policy management - mishen/models/policyModel');
      const pending = await getPendingGatePolicies(req.user.id);
      if (pending.length > 0) {
        return res.status(403).json({ error: 'Acceptable Use Policy acknowledgement required', code: 'AUP_REQUIRED' });
      }
      return next();
    } catch (error) {
      // Fail closed: if the gate check itself errors, deny the request.
      return res.status(403).json({ error: 'Acceptable Use Policy acknowledgement required', code: 'AUP_REQUIRED' });
    }
  });
}

module.exports = {
  requireSession,
  requireUser,
  issueToken,
  SESSION_TIMEOUT_SECONDS
};
