const db = require('../../models/db');

// Run once at startup to make sure our tables exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS acknowledgements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      version_acknowledged INTEGER NOT NULL,
      acknowledged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (policy_id) REFERENCES policies(id)
    )
  `);

  db.all('PRAGMA table_info(acknowledgements)', (err, columns) => {
    if (err) {
      console.error('Failed to inspect acknowledgements table:', err.message);
      return;
    }

    if (!columns.some((column) => column.name === 'version_acknowledged')) {
      db.run(
        'ALTER TABLE acknowledgements ADD COLUMN version_acknowledged INTEGER',
        (alterErr) => {
          if (alterErr) {
            console.error('Failed to migrate acknowledgements table:', alterErr.message);
          }
        }
      );
    }
  });
});

module.exports = db;
