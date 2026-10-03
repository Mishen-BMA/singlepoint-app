const db = require('../../models/db');
const { getScopeUserIds } = require('../models/scopeModel');

// Permission checks always hit the database (role_permissions), never the
// JWT, so a role/permission change takes effect on the very next request
// instead of waiting for the token to be reissued or expire.
async function scopeOf(user, permissionKey) {
  if (!user || !user.role) return null;
  const result = await db.query(
    'SELECT scope FROM role_permissions WHERE role_key = $1 AND permission_key = $2',
    [user.role, permissionKey]
  );
  return result.rows[0] ? result.rows[0].scope : null;
}

async function can(user, permissionKey) {
  return (await scopeOf(user, permissionKey)) !== null;
}

function requirePermission(permissionKey) {
  return async (req, res, next) => {
    try {
      const scope = await scopeOf(req.user, permissionKey);
      if (!scope) {
        return res.status(403).json({ error: 'You do not have permission to perform this action' });
      }
      req.permissionScope = scope;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Failed to evaluate permissions' });
    }
  };
}

// Checks whether targetUserId is within req.user's scope for permissionKey
// (which must already have been resolved onto req.permissionScope by
// requirePermission). Returns 404 — not 403 — on an out-of-scope id so an
// attacker cannot distinguish "exists but not yours" from "does not exist".
async function assertInScope(req, res, targetUserId) {
  const scope = req.permissionScope;
  if (scope === 'org') return true;
  const allowed = await getScopeUserIds(req.user, scope);
  if (allowed && !allowed.map(String).includes(String(targetUserId))) {
    res.status(404).json({ error: 'Not found' });
    return false;
  }
  return true;
}

module.exports = { can, scopeOf, requirePermission, assertInScope };
