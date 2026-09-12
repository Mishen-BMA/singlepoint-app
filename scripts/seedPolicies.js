const db = require('../models/db');

const policies = [
  {
    title: 'Remote Access & AnyDesk Usage Policy',
    content: 'All remote access sessions must use individual credentials and an approved connection request. Never accept an unexpected AnyDesk request, share remote-access passwords, or leave a session open after work is complete. Report suspicious connection attempts through the incident reporting process.'
  },
  {
    title: 'Password & Credential Handling Policy',
    content: 'Use unique passwords for company accounts and never store client credentials in personal notes or share them over WhatsApp. Credentials must be kept in the approved company storage location and disclosed only to authorized staff through approved channels.'
  },
  {
    title: 'Incident Reporting Procedure',
    content: 'Report suspicious client requests, lost devices, exposed credentials, unexpected remote-access requests, and policy violations as soon as they are noticed. Include what happened, when it happened, the affected system or client, and any action already taken.'
  },
  {
    title: 'Client Data Handling Guidelines',
    content: 'Access only the client information required for your assigned work. Do not copy client data to personal devices, send it through personal messaging accounts, or retain it after the task is complete. Escalate accidental disclosure immediately.'
  }
];

async function seedPolicies() {
  for (const policy of policies) {
    await db.query(
      `INSERT INTO policies (title, content)
       SELECT $1, $2
       WHERE NOT EXISTS (SELECT 1 FROM policies WHERE title = $1)`,
      [policy.title, policy.content]
    );
  }
  const result = await db.query('SELECT id, title, version FROM policies ORDER BY id');
  console.table(result.rows);
}

seedPolicies()
  .catch((error) => {
    console.error('Failed to seed policies:', error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
