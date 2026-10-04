const db = require('../../models/db');

const GATE_POLICY_TITLES = ['Acceptable Use Policy'];
const LEGACY_DEFAULT_AUP_CONTENT = 'Use SinglePoint and company systems only for authorized business activity. Every person must use their own account and must never share credentials. Passwords must be at least 12 characters; the system stores passwords as bcrypt hashes. Sessions expire after 30 minutes of inactivity. Acknowledge current policies, complete required training, and report suspected security incidents promptly. Required policies and training become overdue after 30 days. Training quizzes require a score of at least 70% to pass. Staff may access their own records; managers may review team compliance and incidents; admins manage accounts, policies, and training.';
const DEFAULT_AUP_CONTENT = `ACCEPTABLE USE POLICY - SinglePoint and Sallelanka Solutions systems

1. Purpose and scope
This policy applies to everyone at Sallelanka Solutions who uses SinglePoint or accesses company or client systems: the CEO, managers, software engineers, HR staff, data science staff and administrators. Use SinglePoint and company systems only for authorised business purposes. You must read this policy and choose Agree or Disagree before you can use any other part of SinglePoint.

2. Accounts and passwords
- Every person uses their own individual account. Never share your login and never use a colleague's. The old shared developer or remote-access login is not permitted.
- Passwords must be at least 12 characters and unique to this system. SinglePoint stores passwords only as bcrypt hashes.
- Change your password immediately if you think it has been exposed, and report it as an incident.
- Repeated failed sign-in attempts are rate-limited.
- Your session ends after 30 minutes of inactivity. Sign out when you leave your device.

3. Roles and access
You can see only what your role needs. Everyone can see their own compliance status. Managers can see compliance, incidents and sign-in events for their team. The CEO can see organisation-wide compliance and incidents. HR can see the organisation-wide compliance overview in read-only form, but not incident reports, survey answers or quiz scores. Administrators manage accounts, policies and training. Do not try to access anything beyond your role. Accounts of people who leave or change roles are deactivated or updated promptly.

4. Remote access and client systems
- Use only your own individual credentials for AnyDesk or any other remote access to client systems.
- Close every remote session as soon as you finish.
- Never accept an unexpected or out-of-hours connection request. Decline it and report it.
- Never store or send client credentials in personal notes, WhatsApp or any other personal messaging. Use only the approved secure channel.

5. Client and personal data
- Access only the client and personal information you need for your assigned work.
- Do not copy it to personal devices, personal email or messaging accounts.
- HR staff keep employee records only in approved HR systems.
- Data science staff classify datasets before use, anonymise personal data where possible, and do not use production personal data on personal devices or in non-production environments without approval.
- Do not paste client or personal data into external AI tools or online services that the company has not approved.
- Report any accidental disclosure immediately.

6. Devices and messaging
- Lock your screen when you step away.
- Do not keep work credentials on personal phones or devices unless they are in approved secure storage.
- Report a lost or stolen device immediately, including a personal phone that holds work credentials or saved remote-access details.
- Do not use WhatsApp or other personal messaging apps to share credentials or client data.
- Install only software approved for work use.

7. Policies and training
- Read and acknowledge every policy assigned to your role, and re-acknowledge it whenever it is updated.
- Complete the security habits survey and the training modules assigned or recommended to you.
- A quiz score of at least 70% is required to pass, and you may retry.
- Policies, surveys and training left incomplete for 30 days are marked overdue, flagged on the compliance dashboard, and may trigger a reminder from your manager.

8. Incident reporting
Report suspicious requests, lost devices, exposed credentials and policy violations through the in-app incident form straight away. Do not just mention them in a chat. Choose the closest incident type and severity (Low, Medium, High or Critical). Managers and administrators review reports and update their status (Pending, Under Review, Resolved). Reports made in good faith will not be treated as misconduct.

9. Monitoring and privacy
SinglePoint records your name, work email, role, policy decisions, training survey answers and quiz results, incident reports, and account activity including sign-in and sign-out times, failed sign-in attempts, IP address and browser or device details. Every Agree or Disagree decision on this policy is permanently recorded with the policy version, timestamp and IP address. This information is used only for security and compliance purposes. You can see your own survey answers and training progress. Management can see compliance information within the limits of their role. Ask an administrator if you want to know what is held about you.

10. Enforcement and consequences
- Compliance is monitored through the compliance dashboard, overdue flags, reminders, the sign-in audit log and incident reviews.
- If you choose Disagree, your session ends immediately and you cannot use SinglePoint until you agree. Every response is recorded and administrators can review the history.
- Minor or first-time lapses are handled by your manager through a reminder and coaching.
- Repeated or deliberate breaches lead to a formal warning through HR and may lead to suspension of your access.
- Serious breaches, such as sharing credentials, unauthorised access, or deliberately exposing client data, lead to immediate account deactivation and disciplinary action under company procedures, up to termination of employment.
- This policy is reviewed at least once a year and whenever the application or the organisation changes. Each new version requires everyone to read it and agree again.`;

async function initializePolicyTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS policies (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const policyColumns = db.dialect === 'sqlite'
    ? await db.query('PRAGMA table_info(policies)')
    : await db.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
      ['policies']
    );
  if (!policyColumns.rows.some((column) => (column.name || column.column_name) === 'requires_gate')) {
    await db.query('ALTER TABLE policies ADD COLUMN requires_gate BOOLEAN NOT NULL DEFAULT FALSE');
    for (const title of GATE_POLICY_TITLES) {
      await db.query('UPDATE policies SET requires_gate = TRUE WHERE title = $1', [title]);
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS acknowledgements (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      policy_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      version_acknowledged INTEGER NOT NULL,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE
    )
  `);

  const acknowledgementColumns = db.dialect === 'sqlite'
    ? await db.query('PRAGMA table_info(acknowledgements)')
    : await db.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
      ['acknowledgements']
    );
  const acknowledgementColumnNames = acknowledgementColumns.rows.map((column) => column.name || column.column_name);
  if (!acknowledgementColumnNames.includes('decision')) {
    await db.query("ALTER TABLE acknowledgements ADD COLUMN decision VARCHAR(10) NOT NULL DEFAULT 'agreed'");
  }
  if (!acknowledgementColumnNames.includes('ip_address')) {
    await db.query('ALTER TABLE acknowledgements ADD COLUMN ip_address TEXT');
  }
  if (!acknowledgementColumnNames.includes('user_agent')) {
    await db.query('ALTER TABLE acknowledgements ADD COLUMN user_agent TEXT');
  }

  await db.query('CREATE INDEX IF NOT EXISTS idx_ack_user_policy ON acknowledgements (user_id, policy_id, id)');
}

async function seedDefaultPolicies() {
  const policies = [
    ['Acceptable Use Policy', DEFAULT_AUP_CONTENT, true],
    ['Remote Access & AnyDesk Usage Policy', 'Use individual credentials for remote access. Never accept unexpected connection requests, share passwords, or leave a session open. Report suspicious attempts.', false],
    ['Password & Credential Handling Policy', 'Use unique passwords. Never store client credentials in personal notes or share them over WhatsApp. Use only approved secure storage and sharing channels.', false],
    ['Incident Reporting Procedure', 'Promptly report suspicious requests, lost devices, exposed credentials, and policy violations. Include what happened, when, affected systems, and actions taken.', false],
    ['Client Data Handling Guidelines', 'Access only client information needed for assigned work. Do not copy it to personal devices or messaging accounts; report accidental disclosure immediately.', false]
  ];

  for (const [title, content, requiresGate] of policies) {
    await db.query(
      `INSERT INTO policies (title, content, requires_gate)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (SELECT 1 FROM policies WHERE title = $1)`,
      [title, content, requiresGate]
    );
  }

  // Upgrade only the original built-in AUP. A policy edited by an
  // administrator must not be overwritten during a later startup.
  await db.query(
    `UPDATE policies
     SET content = $1, version = version + 1, updated_at = NOW()
     WHERE title = $2 AND content = $3`,
    [DEFAULT_AUP_CONTENT, 'Acceptable Use Policy', LEGACY_DEFAULT_AUP_CONTENT]
  );
}

// Gate policies the user has NOT currently agreed to (latest row for that
// policy, by MAX(id), must be decision='agreed' at the current version).
async function getPendingGatePolicies(userId) {
  const result = await db.query(
    `SELECT p.id, p.title, p.content, p.version FROM policies p
     WHERE p.requires_gate = TRUE AND NOT EXISTS (
       SELECT 1 FROM acknowledgements a
       WHERE a.policy_id = p.id AND a.user_id = $1 AND a.decision = 'agreed' AND a.version_acknowledged = p.version
         AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)
     )
     ORDER BY p.id`,
    [userId]
  );
  return result.rows;
}

async function getPolicyById(id) {
  const result = await db.query('SELECT * FROM policies WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getLatestAcknowledgement(policyId, userId) {
  const result = await db.query(
    `SELECT * FROM acknowledgements a
     WHERE a.policy_id = $1 AND a.user_id = $2
     ORDER BY a.id DESC LIMIT 1`,
    [policyId, userId]
  );
  return result.rows[0] || null;
}

async function insertAcknowledgement({ policyId, userId, versionAcknowledged, decision, ipAddress, userAgent }) {
  const result = await db.query(
    `INSERT INTO acknowledgements (policy_id, user_id, version_acknowledged, decision, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [policyId, userId, versionAcknowledged, decision, ipAddress || null, userAgent || null]
  );
  return result.rows[0];
}

async function getAcknowledgementHistory(policyId) {
  const result = await db.query(
    `SELECT a.id, a.user_id, u.name AS user_name, u.email, a.version_acknowledged, a.decision, a.acknowledged_at, a.ip_address
     FROM acknowledgements a
     JOIN users u ON u.id = a.user_id
     WHERE a.policy_id = $1
     ORDER BY a.id DESC`,
    [policyId]
  );
  return result.rows;
}

module.exports = {
  initializePolicyTables,
  seedDefaultPolicies,
  getPendingGatePolicies,
  getPolicyById,
  getLatestAcknowledgement,
  insertAcknowledgement,
  getAcknowledgementHistory
};
