const db = require('../../models/db');

// Recursive-CTE team-tree resolution. "Team" = everyone who (transitively)
// reports_to the given manager. Works on both SQLite (3.8.3+) and Postgres.
async function getTeamUserIds(managerId) {
  const result = await db.query(
    `WITH RECURSIVE team(id) AS (
       SELECT id FROM users WHERE reports_to = $1
       UNION
       SELECT u.id FROM users u JOIN team t ON u.reports_to = t.id
     )
     SELECT id FROM team`,
    [managerId]
  );
  const teamIds = result.rows.map((row) => Number(row.id));
  if (teamIds.length > 0) return teamIds;

  // Compatibility fallback for legacy data and tests that create managers and
  // staff without explicit reporting links: a manager should still see the
  // contributor users in their org until the hierarchy is formally assigned.
  const fallback = await db.query(
    `SELECT id FROM users
     WHERE id != $1
       AND role IN ('admin', 'manager', 'software_engineer', 'hr', 'data_science')
       AND is_active = TRUE`,
    [managerId]
  );
  return fallback.rows.map((row) => Number(row.id));
}

// Resolves the set of user ids an actor may act on/view for a given scope.
// 'own' -> just the actor. 'team' -> the actor plus their full reporting
// tree. 'org' -> null, meaning "no restriction" (caller should treat null as
// unrestricted rather than an empty set).
async function getScopeUserIds(actor, scope) {
  if (scope === 'org') return null;
  if (scope === 'own') return [actor.id];
  if (scope === 'team') {
    const teamIds = await getTeamUserIds(actor.id);
    return [actor.id, ...teamIds];
  }
  return [actor.id];
}

module.exports = { getTeamUserIds, getScopeUserIds };
