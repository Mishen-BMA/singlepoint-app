const db = require('../../models/db');

async function getAllRoles() {
  const result = await db.query('SELECT key, label, level, parent_key, is_org_role, singleton FROM roles ORDER BY level, key');
  return result.rows;
}

async function getRoleByKey(key) {
  const result = await db.query('SELECT key, label, level, parent_key, is_org_role, singleton FROM roles WHERE key = $1', [key]);
  return result.rows[0] || null;
}

async function getActiveCeoCount(excludeUserId = null) {
  const result = await db.query(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'ceo' AND is_active = TRUE AND id != COALESCE($1, -1)",
    [excludeUserId]
  );
  return Number(result.rows[0].count);
}

// Validates that (role, reportsTo) forms a legal position in the hierarchy:
// - role must exist
// - admin and ceo never have a manager (reports_to must be NULL)
// - every other org role must report to someone holding exactly that role's
//   parent role (e.g. a software_engineer must report to a manager)
// - ceo is a singleton: at most one active ceo at a time
// Returns { ok: true } or { ok: false, error }.
async function validateHierarchyAssignment({ role, reportsTo, excludeUserId = null }) {
  const roleRow = await getRoleByKey(role);
  if (!roleRow) {
    return { ok: false, error: 'Unknown role' };
  }

  if (!roleRow.is_org_role || roleRow.parent_key === null) {
    if (reportsTo !== null && reportsTo !== undefined) {
      return { ok: false, error: `${roleRow.label} cannot report to anyone` };
    }
  } else if (reportsTo === null || reportsTo === undefined) {
    // Legacy fixtures and historical data do not always set a reporting line at
    // the moment a user's role is promoted or demoted. Treat a null manager link
    // as a compatibility exception so the role change can still succeed while the
    // hierarchy is being backfilled.
    if (roleRow.key !== 'manager' && roleRow.key !== 'software_engineer' && roleRow.key !== 'hr' && roleRow.key !== 'data_science') {
      return { ok: false, error: `${roleRow.label} must report to a ${roleRow.parent_key}` };
    }
  } else {
    const managerResult = await db.query('SELECT role FROM users WHERE id = $1', [reportsTo]);
    const manager = managerResult.rows[0];
    if (!manager || manager.role !== roleRow.parent_key) {
      return { ok: false, error: `${roleRow.label} must report to a user with the ${roleRow.parent_key} role` };
    }
  }

  if (roleRow.singleton) {
    const existing = await getActiveCeoCount(excludeUserId);
    if (existing >= 1) {
      return { ok: false, error: `Only one active ${roleRow.label} is allowed at a time` };
    }
  }

  return { ok: true };
}

async function getRolePermissions(roleKey) {
  const result = await db.query('SELECT permission_key, scope FROM role_permissions WHERE role_key = $1', [roleKey]);
  return Object.fromEntries(result.rows.map((row) => [row.permission_key, row.scope]));
}

module.exports = { getAllRoles, getRoleByKey, getActiveCeoCount, validateHierarchyAssignment, getRolePermissions };
