// Placeholder until Charuka's real Auth module is integrated.
// Real auth will attach req.user = { id, role } after verifying a token/session.
// For now, we simulate it by reading headers directly — NOT secure, temporary only.
function requireUser(req, res, next) {
  const userId = req.header('x-user-id');
  const role = req.header('x-user-role');

  if (!userId || !role) {
    return res.status(401).json({ error: 'Missing user identity (x-user-id / x-user-role headers)' });
  }

  const numericUserId = Number(userId);
  if (!Number.isInteger(numericUserId) || numericUserId < 1) {
    return res.status(401).json({ error: 'Invalid user identity' });
  }

  req.user = { id: numericUserId, role };
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireUser, requireAdmin };
