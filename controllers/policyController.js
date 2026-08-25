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

module.exports = { createPolicy, getAllPolicies };