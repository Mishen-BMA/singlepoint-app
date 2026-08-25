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

module.exports = { createPolicy, getAllPolicies, acknowledgePolicy, getAcknowledgementsForPolicy };
