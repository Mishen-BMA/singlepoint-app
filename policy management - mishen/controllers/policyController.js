const db = require('../../models/db');

async function createPolicy(req, res) {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
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
    const result = await db.query('SELECT * FROM policies ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
}

async function getAcknowledgementsForPolicy(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM acknowledgements WHERE policy_id = $1 ORDER BY acknowledged_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch acknowledgements' });
  }
}

async function updatePolicy(req, res) {
  const { id } = req.params;
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
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

  try {
    const result = await db.query(
      `SELECT p.version AS current_version, a.version_acknowledged, a.acknowledged_at
       FROM policies p
       LEFT JOIN LATERAL (
         SELECT version_acknowledged, acknowledged_at
         FROM acknowledgements
         WHERE policy_id = p.id AND user_id = $1
         ORDER BY acknowledged_at DESC
         LIMIT 1
       ) a ON TRUE
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

  try {
    const queryResult = await db.query(
      `SELECT p.id AS policy_id, p.title, p.content, p.version AS current_version,
              a.version_acknowledged, a.acknowledged_at
       FROM policies p
       LEFT JOIN LATERAL (
         SELECT version_acknowledged, acknowledged_at
         FROM acknowledgements
         WHERE policy_id = p.id AND user_id = $1
         ORDER BY acknowledged_at DESC
         LIMIT 1
       ) a ON TRUE
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
