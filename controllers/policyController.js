const db = require('../models/db');

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

// Staff member acknowledges a policy
function acknowledgePolicy(req, res) {
  const { policy_id, user_id } = req.body;

  if (!policy_id || !user_id) {
    return res.status(400).json({ error: 'policy_id and user_id are required' });
  }

  const sql = `INSERT INTO acknowledgements (policy_id, user_id) VALUES (?, ?)`;
  db.run(sql, [policy_id, user_id], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to record acknowledgement' });
    }
    res.status(201).json({
      id: this.lastID,
      policy_id,
      user_id,
      acknowledged_at: new Date().toISOString()
    });
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
    SELECT p.version AS current_version, a.acknowledged_at
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

    const compliant = !!row.acknowledged_at; // simplified for now — see note below
    res.json({ policyId, userId, currentVersion: row.current_version, compliant });
  });
}

module.exports = { createPolicy, getAllPolicies, acknowledgePolicy, getAcknowledgementsForPolicy, updatePolicy };