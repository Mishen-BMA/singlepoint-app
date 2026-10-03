const db = require('../../models/db');

async function createPolicy(req, res) {
  const { title, content } = req.body;

  if (typeof title !== 'string' || typeof content !== 'string' || title.trim().length < 3 || title.trim().length > 160 || content.trim().length < 10 || content.length > 20000) {
    return res.status(400).json({ error: 'Provide a policy title (3-160 characters) and content (10-20000 characters)' });
  }

  try {
    const result = await db.query(
      'INSERT INTO policies (title, content) VALUES ($1, $2) RETURNING *',
      [title.trim(), content.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create policy' });
  }
}

async function getAllPolicies(req, res) {
  try {
    const result = await db.query(
      `SELECT p.*,
        (SELECT a.version_acknowledged FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
         ORDER BY a.acknowledged_at DESC, a.id DESC LIMIT 1) AS version_acknowledged,
        (SELECT a.acknowledged_at FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
         ORDER BY a.acknowledged_at DESC, a.id DESC LIMIT 1) AS acknowledged_at
       FROM policies p
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    result.rows = result.rows.map((row) => ({
      ...row,
      compliant: Number(row.version_acknowledged) === Number(row.version),
      overdue: Number(row.version_acknowledged) !== Number(row.version) &&
        Date.parse(row.updated_at) <= Date.now() - 30 * 24 * 60 * 60 * 1000
    }));
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
}

async function getAcknowledgementsForPolicy(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT u.id AS user_id, u.name, u.email, p.version AS current_version,
        (SELECT a.version_acknowledged FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = u.id
         ORDER BY a.acknowledged_at DESC, a.id DESC LIMIT 1) AS version_acknowledged,
        (SELECT a.acknowledged_at FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = u.id
         ORDER BY a.acknowledged_at DESC, a.id DESC LIMIT 1) AS acknowledged_at
       FROM policies p CROSS JOIN users u
       WHERE p.id = $1
       ORDER BY u.name`,
      [id]
    );
    if (result.rowCount === 0) {
      const policy = await db.query('SELECT id FROM policies WHERE id = $1', [id]);
      if (policy.rowCount === 0) return res.status(404).json({ error: 'Policy not found' });
    }
    result.rows = result.rows.map((row) => ({
      ...row,
      compliant: Number(row.version_acknowledged) === Number(row.current_version)
    }));
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch acknowledgements' });
  }
}

async function updatePolicy(req, res) {
  const { id } = req.params;
  const { title, content } = req.body;

  if (typeof title !== 'string' || typeof content !== 'string' || title.trim().length < 3 || title.trim().length > 160 || content.trim().length < 10 || content.length > 20000) {
    return res.status(400).json({ error: 'Provide a policy title (3-160 characters) and content (10-20000 characters)' });
  }

  try {
    const result = await db.query(
      `UPDATE policies
       SET title = $1, content = $2, version = version + 1, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [title.trim(), content.trim(), id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update policy' });
  }
}

async function getComplianceStatus(req, res) {
  const { policyId, userId } = req.params;
  if (String(req.user.id) !== String(userId) && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only view your own compliance' });
  }

  try {
    const result = await db.query(
      `SELECT p.version AS current_version,
        (SELECT version_acknowledged FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
         ORDER BY a.acknowledged_at DESC, a.id DESC LIMIT 1) AS version_acknowledged,
        (SELECT acknowledged_at FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
         ORDER BY a.acknowledged_at DESC, a.id DESC LIMIT 1) AS acknowledged_at
       FROM policies p
       WHERE p.id = $2`,
      [userId, policyId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    const row = result.rows[0];
    res.json({
      policyId,
      userId,
      currentVersion: row.current_version,
      versionAcknowledged: row.version_acknowledged || null,
      compliant: row.version_acknowledged === row.current_version
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check compliance' });
  }
}

async function acknowledgePolicy(req, res) {
  const { policy_id } = req.body;
  const user_id = req.user.id;

  if (!policy_id) {
    return res.status(400).json({ error: 'policy_id is required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO acknowledgements (policy_id, user_id, version_acknowledged)
       SELECT id, $1, version FROM policies WHERE id = $2
       RETURNING *`,
      [user_id, policy_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to record acknowledgement' });
  }
}

async function getUserComplianceOverview(req, res) {
  const { userId } = req.params;
  if (String(req.user.id) !== String(userId) && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only view your own compliance' });
  }

  try {
    const queryResult = await db.query(
      `SELECT p.id AS policy_id, p.title, p.content, p.version AS current_version,
        (SELECT version_acknowledged FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
         ORDER BY a.acknowledged_at DESC, a.id DESC LIMIT 1) AS version_acknowledged,
        (SELECT acknowledged_at FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
         ORDER BY a.acknowledged_at DESC, a.id DESC LIMIT 1) AS acknowledged_at
       FROM policies p
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const policies = queryResult.rows.map((row) => ({
      policyId: row.policy_id,
      title: row.title,
      content: row.content,
      currentVersion: row.current_version,
      versionAcknowledged: row.version_acknowledged || null,
      acknowledgedAt: row.acknowledged_at,
      compliant: row.version_acknowledged === row.current_version
    }));

    res.json({ userId, policies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch compliance overview' });
  }
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
