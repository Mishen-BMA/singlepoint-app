const db = require('../../models/db');

// Create a new policy
function createPolicy(req, res) {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const sql = `INSERT INTO policies (title, content) VALUES (?, ?)`;
  db.run(sql, [title, content], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create policy' });
    }
    res.status(201).json({
      id: this.lastID,
      title,
      content,
      version: 1
    });
  });
}

// Get all policies
function getAllPolicies(req, res) {
  db.all(`SELECT * FROM policies ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch policies' });
    }
    res.json(rows);
  });
}

// See who has acknowledged a specific policy (Admin view)
function getAcknowledgementsForPolicy(req, res) {
  const { id } = req.params;

  const sql = `SELECT * FROM acknowledgements WHERE policy_id = ?`;
  db.all(sql, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch acknowledgements' });
    }
    res.json(rows);
  });
}

// Admin updates an existing policy — this bumps the version number
function updatePolicy(req, res) {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const sql = `
    UPDATE policies
    SET title = ?, content = ?, version = version + 1
    WHERE id = ?
  `;
  db.run(sql, [title, content, id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update policy' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.json({ message: 'Policy updated', id, title, content });
  });
}

// Check if a user's acknowledgement is for the CURRENT version of a policy
function getComplianceStatus(req, res) {
  const { policyId, userId } = req.params;

  const sql = `
    SELECT p.version AS current_version, a.version_acknowledged, a.acknowledged_at
    FROM policies p
    LEFT JOIN acknowledgements a
      ON a.policy_id = p.id AND a.user_id = ?
    WHERE p.id = ?
    ORDER BY a.acknowledged_at DESC
    LIMIT 1
  `;
  db.get(sql, [userId, policyId], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to check compliance' });
    if (!row) return res.status(404).json({ error: 'Policy not found' });

    const compliant = row.version_acknowledged === row.current_version;
    res.json({
      policyId,
      userId,
      currentVersion: row.current_version,
      versionAcknowledged: row.version_acknowledged || null,
      compliant
    });
  });
}

function acknowledgePolicy(req, res) {
  const { policy_id, user_id } = req.body;

  if (!policy_id || !user_id) {
    return res.status(400).json({ error: 'policy_id and user_id are required' });
  }

  // First, find out what version this policy is currently on
  db.get(`SELECT version FROM policies WHERE id = ?`, [policy_id], (err, policy) => {
    if (err) return res.status(500).json({ error: 'Failed to look up policy' });
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const sql = `INSERT INTO acknowledgements (policy_id, user_id, version_acknowledged) VALUES (?, ?, ?)`;
    db.run(sql, [policy_id, user_id, policy.version], function (err) {
      if (err) return res.status(500).json({ error: 'Failed to record acknowledgement' });
      res.status(201).json({
        id: this.lastID,
        policy_id,
        user_id,
        version_acknowledged: policy.version,
        acknowledged_at: new Date().toISOString()
      });
    });
  });
}

// Get every policy with this user's compliance status on each one
function getUserComplianceOverview(req, res) {
  const { userId } = req.params;

  const sql = `
    SELECT
      p.id AS policy_id,
      p.title,
      p.version AS current_version,
      a.version_acknowledged,
      a.acknowledged_at
    FROM policies p
    LEFT JOIN (
      SELECT policy_id, version_acknowledged, acknowledged_at
      FROM acknowledgements
      WHERE user_id = ?
      GROUP BY policy_id
      HAVING acknowledged_at = MAX(acknowledged_at)
    ) a ON a.policy_id = p.id
    ORDER BY p.id
  `;

  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch compliance overview' });

    const result = rows.map(row => ({
      policyId: row.policy_id,
      title: row.title,
      currentVersion: row.current_version,
      versionAcknowledged: row.version_acknowledged || null,
      compliant: row.version_acknowledged === row.current_version
    }));

    res.json({ userId, policies: result });
  });
}

module.exports = {
  createPolicy,
  getAllPolicies,
  acknowledgePolicy,
  getAcknowledgementsForPolicy,
  updatePolicy,
  getComplianceStatus,
  getUserComplianceOverview
};
