// Ordered, idempotent migrations for the role hierarchy / RBAC rework.
// Each migration runs at most once (tracked in schema_migrations) and the
// whole body of a migration runs inside db.transaction() so a failure never
// leaves the schema half-migrated.
const db = require('./db');

// Role hierarchy: admin sits outside the org tree (system role). ceo is the
// top of the org tree (at most one active), manager reports to ceo, and the
// three individual-contributor roles report to a manager.
const ROLES = [
  { key: 'admin', label: 'Admin', level: 0, parentKey: null, isOrgRole: false, singleton: false },
  { key: 'ceo', label: 'CEO', level: 1, parentKey: null, isOrgRole: true, singleton: true },
  { key: 'manager', label: 'Manager', level: 2, parentKey: 'ceo', isOrgRole: true, singleton: false },
  { key: 'software_engineer', label: 'Software Engineer', level: 3, parentKey: 'manager', isOrgRole: true, singleton: false },
  { key: 'hr', label: 'HR', level: 3, parentKey: 'manager', isOrgRole: true, singleton: false },
  { key: 'data_science', label: 'Data Science', level: 3, parentKey: 'manager', isOrgRole: true, singleton: false }
];

const PERMISSIONS = [
  ['users.manage', 'Create/deactivate accounts and change roles'],
  ['users.view_directory', 'View the user/reporting directory'],
  ['roles.manage_assignments', 'Edit which roles/users a policy or training module is assigned to'],
  ['policies.manage', 'Create and edit policy content'],
  ['policies.view_assigned', 'View policies assigned to you'],
  ['policies.acknowledge', 'Acknowledge/agree to a policy'],
  ['policies.view_acknowledgements', 'View who has acknowledged a policy'],
  ['training.manage', 'Create and edit training modules and quizzes'],
  ['training.take', 'Take assigned/recommended training modules and quizzes'],
  ['training.assign_user', 'Assign a training module to an individual user'],
  ['compliance.view_own', 'View your own compliance status'],
  ['compliance.view_overview', 'View an aggregate compliance overview'],
  ['compliance.view_executive', 'View the executive compliance dashboard'],
  ['compliance.export_csv', 'Export the compliance report as CSV'],
  ['compliance.send_reminder', 'Send a compliance reminder to a user'],
  ['incidents.submit', 'Submit an incident report'],
  ['incidents.view_all', 'View incidents beyond your own'],
  ['incidents.triage', 'Change the status/severity of an incident'],
  ['audit.view', 'View the login/audit log']
];

// [roleKey, permissionKey, scope] — scope is one of own/team/org.
const ROLE_PERMISSIONS = [
  ['admin', 'users.manage', 'org'],
  ['admin', 'users.view_directory', 'org'],
  ['admin', 'roles.manage_assignments', 'org'],
  ['admin', 'policies.manage', 'org'],
  ['admin', 'policies.view_assigned', 'own'],
  ['admin', 'policies.acknowledge', 'own'],
  ['admin', 'policies.view_acknowledgements', 'org'],
  ['admin', 'training.manage', 'org'],
  ['admin', 'training.take', 'own'],
  ['admin', 'training.assign_user', 'org'],
  ['admin', 'compliance.view_own', 'own'],
  ['admin', 'compliance.view_overview', 'org'],
  ['admin', 'compliance.view_executive', 'org'],
  ['admin', 'compliance.export_csv', 'org'],
  ['admin', 'compliance.send_reminder', 'org'],
  ['admin', 'incidents.submit', 'own'],
  ['admin', 'incidents.view_all', 'org'],
  ['admin', 'incidents.triage', 'org'],
  ['admin', 'audit.view', 'org'],

  ['ceo', 'users.view_directory', 'org'],
  ['ceo', 'policies.view_assigned', 'own'],
  ['ceo', 'policies.acknowledge', 'own'],
  ['ceo', 'policies.view_acknowledgements', 'org'],
  ['ceo', 'training.take', 'own'],
  ['ceo', 'compliance.view_own', 'own'],
  ['ceo', 'compliance.view_overview', 'org'],
  ['ceo', 'compliance.view_executive', 'org'],
  ['ceo', 'compliance.export_csv', 'org'],
  ['ceo', 'incidents.view_all', 'org'],
  ['ceo', 'audit.view', 'org'],

  ['manager', 'users.view_directory', 'team'],
  ['manager', 'audit.view', 'team'],
  ['manager', 'policies.view_assigned', 'own'],
  ['manager', 'policies.acknowledge', 'own'],
  ['manager', 'policies.view_acknowledgements', 'team'],
  ['manager', 'training.take', 'own'],
  ['manager', 'training.assign_user', 'team'],
  ['manager', 'compliance.view_own', 'own'],
  ['manager', 'compliance.view_overview', 'team'],
  ['manager', 'compliance.export_csv', 'team'],
  ['manager', 'compliance.send_reminder', 'team'],
  ['manager', 'incidents.submit', 'own'],
  ['manager', 'incidents.view_all', 'team'],
  ['manager', 'incidents.triage', 'team'],

  ['software_engineer', 'policies.view_assigned', 'own'],
  ['software_engineer', 'policies.acknowledge', 'own'],
  ['software_engineer', 'training.take', 'own'],
  ['software_engineer', 'compliance.view_own', 'own'],
  ['software_engineer', 'incidents.submit', 'own'],

  ['data_science', 'policies.view_assigned', 'own'],
  ['data_science', 'policies.acknowledge', 'own'],
  ['data_science', 'training.take', 'own'],
  ['data_science', 'compliance.view_own', 'own'],
  ['data_science', 'incidents.submit', 'own'],

  // HR: deliberate exception — org-wide READ-ONLY compliance visibility,
  // but never incidents, survey answers, or quiz scores.
  ['hr', 'policies.view_assigned', 'own'],
  ['hr', 'policies.acknowledge', 'own'],
  ['hr', 'training.take', 'own'],
  ['hr', 'compliance.view_own', 'own'],
  ['hr', 'incidents.submit', 'own'],
  ['hr', 'compliance.view_overview', 'org']
];

// Legacy role name -> new role key. The old "staff" catch-all becomes
// software_engineer; admin/manager keep their names.
const LEGACY_ROLE_MAP = { staff: 'software_engineer', admin: 'admin', manager: 'manager' };

// Legacy training_modules.target_roles CSV values map onto the new roles.
// NOTE: the legacy content used "admin" to mean the executive/CEO audience —
// that is now represented by the ceo role, not the admin (system) role.
const LEGACY_TARGET_ROLE_MAP = {
  staff: ['software_engineer', 'hr', 'data_science'],
  manager: ['manager'],
  admin: ['ceo']
};

async function tableColumns(tableName) {
  const result = db.dialect === 'sqlite'
    ? await db.query(`PRAGMA table_info(${tableName})`)
    : await db.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [tableName]);
  return result.rows.map((row) => row.name || row.column_name);
}

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function isApplied(version) {
  const result = await db.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
  return result.rowCount > 0;
}

async function markApplied(query, version) {
  await query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
}

// --- Migration 1: roles / permissions / role_permissions -------------------
async function migrateRolesAndPermissions() {
  const version = 'roles_permissions_v1';
  if (await isApplied(version)) return;

  await db.transaction(async (query) => {
    await query(`
      CREATE TABLE IF NOT EXISTS roles (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        level INTEGER NOT NULL,
        parent_key TEXT REFERENCES roles(key),
        is_org_role BOOLEAN NOT NULL DEFAULT TRUE,
        singleton BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS permissions (
        key TEXT PRIMARY KEY,
        description TEXT NOT NULL
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_key TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
        permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
        scope TEXT NOT NULL CHECK (scope IN ('own', 'team', 'org')),
        PRIMARY KEY (role_key, permission_key)
      )
    `);

    for (const role of ROLES) {
      await query(
        `INSERT INTO roles (key, label, level, parent_key, is_org_role, singleton)
         SELECT $1, $2, $3, $4, $5, $6
         WHERE NOT EXISTS (SELECT 1 FROM roles WHERE key = $1)`,
        [role.key, role.label, role.level, role.parentKey, role.isOrgRole, role.singleton]
      );
    }
    for (const [key, description] of PERMISSIONS) {
      await query(
        `INSERT INTO permissions (key, description)
         SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE key = $1)`,
        [key, description]
      );
    }
    for (const [roleKey, permissionKey, scope] of ROLE_PERMISSIONS) {
      await query(
        `INSERT INTO role_permissions (role_key, permission_key, scope)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_key = $1 AND permission_key = $2)`,
        [roleKey, permissionKey, scope]
      );
    }

    await markApplied(query, version);
  });
}

// --- Migration 1b: align CEO with read-only executive access ---------------
async function migrateCeoReadOnlyPermissions() {
  const version = 'ceo_read_only_permissions_v1';
  if (await isApplied(version)) return;

  await db.transaction(async (query) => {
    await query(
      `INSERT INTO role_permissions (role_key, permission_key, scope)
       SELECT 'ceo', 'audit.view', 'org'
       WHERE EXISTS (SELECT 1 FROM roles WHERE key = 'ceo')
         AND EXISTS (SELECT 1 FROM permissions WHERE key = 'audit.view')
         AND NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_key = 'ceo' AND permission_key = 'audit.view')`
    );
    await query("DELETE FROM role_permissions WHERE role_key = 'ceo' AND permission_key = 'incidents.submit'");
    await markApplied(query, version);
  });
}

// --- Migration 2: rebuild users table (drop CHECK, add reports_to, FK role) -
async function migrateUsersTable() {
  const version = 'users_rbac_v1';
  if (await isApplied(version)) return;

  if (db.dialect === 'sqlite') {
    // SQLite cannot drop/alter a CHECK constraint in place — rebuild the
    // table. Disable FK enforcement first: PRAGMA foreign_keys is a no-op
    // inside a transaction, so it must be toggled before BEGIN.
    await db.query('PRAGMA foreign_keys = OFF');
  }

  await db.transaction(async (query) => {
    if (db.dialect === 'sqlite') {
      const columns = await tableColumns('users');
      if (!columns.includes('reports_to')) {
        await query(`
          CREATE TABLE users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL REFERENCES roles(key),
            reports_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN NOT NULL DEFAULT TRUE
          )
        `);
        await query(`
          INSERT INTO users_new (id, name, email, password_hash, role, created_at, is_active)
          SELECT id, name, email, password_hash,
            CASE role WHEN 'staff' THEN 'software_engineer' ELSE role END,
            created_at, is_active
          FROM users
        `);
        await query('DROP TABLE users');
        await query('ALTER TABLE users_new RENAME TO users');
      }
      const checkResult = await query('PRAGMA foreign_key_check');
      if (checkResult.rows.length > 0) {
        throw new Error(`Foreign key check failed after users table rebuild: ${JSON.stringify(checkResult.rows)}`);
      }
    } else {
      await query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
      await query('ALTER TABLE users ALTER COLUMN role DROP DEFAULT');
      await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to BIGINT REFERENCES users(id) ON DELETE SET NULL');
      await query("UPDATE users SET role = 'software_engineer' WHERE role = 'staff'");
      const fkExists = await query(
        `SELECT 1 FROM information_schema.table_constraints
         WHERE table_name = 'users' AND constraint_name = 'users_role_fkey'`
      );
      if (fkExists.rowCount === 0) {
        await query('ALTER TABLE users ADD CONSTRAINT users_role_fkey FOREIGN KEY (role) REFERENCES roles(key)');
      }
    }

    await markApplied(query, version);
  });

  if (db.dialect === 'sqlite') {
    await db.query('PRAGMA foreign_keys = ON');
  }
}

// --- Migration 3: policy_assignments / training_assignments -----------------
async function migrateAssignmentTables() {
  const version = 'assignment_tables_v1';
  if (await isApplied(version)) return;

  await db.transaction(async (query) => {
    await query(`
      CREATE TABLE IF NOT EXISTS policy_assignments (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        policy_id BIGINT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
        role_key TEXT REFERENCES roles(key) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        due_days INTEGER NOT NULL DEFAULT 30,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT policy_assignments_target_check CHECK (
          (role_key IS NOT NULL AND user_id IS NULL) OR (role_key IS NULL AND user_id IS NOT NULL)
        )
      )
    `);
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_assignments_role ON policy_assignments (policy_id, role_key) WHERE role_key IS NOT NULL');
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_assignments_user ON policy_assignments (policy_id, user_id) WHERE user_id IS NOT NULL');

    await query(`
      CREATE TABLE IF NOT EXISTS training_assignments (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        module_id BIGINT NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
        role_key TEXT REFERENCES roles(key) ON DELETE CASCADE,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        due_days INTEGER NOT NULL DEFAULT 30,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT training_assignments_target_check CHECK (
          (role_key IS NOT NULL AND user_id IS NULL) OR (role_key IS NULL AND user_id IS NOT NULL)
        )
      )
    `);
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_training_assignments_role ON training_assignments (module_id, role_key) WHERE role_key IS NOT NULL');
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_training_assignments_user ON training_assignments (module_id, user_id) WHERE user_id IS NOT NULL');

    await markApplied(query, version);
  });
}

// --- Migration 4: backfill assignments from legacy data ---------------------
async function backfillAssignments() {
  const version = 'backfill_assignments_v1';
  if (await isApplied(version)) return;

  await db.transaction(async (query) => {
    // Every role (including admin) must agree to AUP-style gate policies and
    // any other existing policy, since historically every authenticated user
    // could see/acknowledge every policy.
    const policies = await query('SELECT id FROM policies');
    for (const policy of policies.rows) {
      for (const role of ROLES) {
        await query(
          `INSERT INTO policy_assignments (policy_id, role_key, due_days)
           SELECT $1, $2, 30 WHERE NOT EXISTS (
             SELECT 1 FROM policy_assignments WHERE policy_id = $1 AND role_key = $2
           )`,
          [policy.id, role.key]
        );
      }
    }

    const modules = await query('SELECT id, target_roles FROM training_modules');
    for (const module of modules.rows) {
      const legacyRoles = (module.target_roles || '').split(',').map((role) => role.trim()).filter(Boolean);
      const roleKeys = legacyRoles.length
        ? [...new Set(legacyRoles.flatMap((role) => LEGACY_TARGET_ROLE_MAP[role] || []))]
        : [...new Set(ROLES.map((role) => role.key))];
      for (const roleKey of roleKeys) {
        await query(
          `INSERT INTO training_assignments (module_id, role_key, due_days)
           SELECT $1, $2, 30 WHERE NOT EXISTS (
             SELECT 1 FROM training_assignments WHERE module_id = $1 AND role_key = $2
           )`,
          [module.id, roleKey]
        );
      }
    }

    await markApplied(query, version);
  });
}

// --- Migration 5: role-specific policies, training, and default assignments -
const RBAC_POLICIES = [
  ['Secure Coding Policy', 'Validate and sanitize all external input, use parameterised queries, never commit secrets, and keep dependencies patched. Code handling authentication, authorization, or payment data requires a peer review before merge.', 'software_engineer'],
  ['Software Development Security Policy', 'Follow the secure development lifecycle: threat-model new features, run SAST/dependency scans in CI, and resolve high/critical findings before release. Production credentials never live in source control.', 'software_engineer'],
  ['Vulnerability Management Policy', 'Triage reported vulnerabilities by severity, patch critical issues within 7 days and high issues within 30 days, and track remediation to closure. Report anything you cannot patch yourself to the security channel.', 'software_engineer'],
  ['Employee Data Protection Policy', 'Access personnel records only for legitimate HR purposes, store them in approved HR systems only, and never export them to personal devices or spreadsheets outside those systems.', 'hr'],
  ['Privacy Policy (Employee Data)', 'Collect only the personal data needed for employment purposes, retain it only as long as required, and honour employee requests to access or correct their own records.', 'hr'],
  ['Personnel Data Handling Policy', 'Share personnel data only with people who need it to do their job, redact sensitive fields in reports where possible, and report any suspected personnel data exposure immediately.', 'hr'],
  ['Data Protection Policy', 'Classify datasets before use, apply encryption at rest and in transit for sensitive datasets, and never copy production data to a personal device or an unmanaged notebook environment.', 'data_science'],
  ['Data Privacy Policy', 'Minimise and, where possible, anonymise personal data used in models and analysis. Do not use production personal data in non-production environments without approval.', 'data_science'],
  ['Data Handling & Classification Policy', 'Label every dataset and model artefact with its classification level and follow the matching handling, storage, and sharing rules for that level.', 'data_science']
];

const RBAC_TRAINING_MODULES = [
  {
    title: 'Secure Coding & Vulnerability Awareness',
    category: 'Engineering Security',
    durationMin: 20,
    content: 'Covers secure coding fundamentals, the secure development lifecycle, and how to triage and remediate vulnerabilities.',
    roleKey: 'software_engineer',
    quiz: [
      ['Which practice best prevents SQL injection?', ['String-concatenating user input into queries', 'Parameterised queries / prepared statements', 'Disabling error messages', 'Using a longer password'], 1],
      ['Where should production credentials be stored?', ['Committed in source control', 'In a secrets manager / environment configuration, never in source control', 'In code comments', 'In a shared spreadsheet'], 1],
      ['What should happen before code touching authentication merges?', ['Nothing extra is required', 'A peer code review', 'It should be force-merged immediately', 'It should skip CI'], 1],
      ['A critical vulnerability is reported in a dependency you own. What is the expected remediation window?', ['Within 7 days', 'Within 1 year', 'Only at the next major release', 'No fixed timeframe'], 0],
      ['What should CI do with high/critical SAST or dependency-scan findings?', ['Ignore them', 'Block the release until resolved or formally accepted', 'Email them to no one', 'Delete the finding'], 1]
    ]
  },
  {
    title: 'Employee Data Protection & Privacy',
    category: 'HR Compliance',
    durationMin: 15,
    content: 'Covers safe handling of personnel data, employee privacy rights, and reporting data exposure.',
    roleKey: 'hr',
    quiz: [
      ['Where should personnel records be stored?', ['Personal spreadsheets', 'Approved HR systems only', 'A shared public drive', 'Printed folders on any desk'], 1],
      ['When can personnel data be accessed?', ['Any time, by anyone', 'Only for a legitimate HR purpose', 'Only on Fridays', 'Only by the CEO'], 1],
      ['What should you do if you discover personnel data was exposed?', ['Say nothing', 'Report it immediately', 'Wait for someone else to notice', 'Delete the evidence'], 1],
      ['How long should employee personal data be retained?', ['Forever', 'Only as long as required for employment purposes', 'Exactly one day', 'Until the disk is full'], 1],
      ['Who can request access or correction of their own personnel data?', ['No one', 'The employee themselves', 'Only external auditors', 'Only the CEO'], 1]
    ]
  },
  {
    title: 'Data Protection & Handling',
    category: 'Data Science Compliance',
    durationMin: 15,
    content: 'Covers dataset classification, encryption requirements, anonymisation, and safe handling of production data.',
    roleKey: 'data_science',
    quiz: [
      ['Before using a dataset, you should first:', ['Classify it', 'Email it to a personal account', 'Ignore its sensitivity', 'Delete its metadata'], 0],
      ['Sensitive datasets should be protected using:', ['No protection needed', 'Encryption at rest and in transit', 'A sticky note with the password', 'Public sharing links'], 1],
      ['Can production personal data be copied to a personal device?', ['Yes, always', 'No, never without approval', 'Only on weekends', 'Only if compressed'], 1],
      ['When building a model, personal data should be:', ['Used in full, unmodified', 'Minimised and anonymised where possible', 'Shared publicly for transparency', 'Duplicated across every notebook'], 1],
      ['Every dataset and model artefact should carry:', ['No labels', 'A classification label with matching handling rules', 'Just a filename', 'A random number'], 1]
    ]
  }
];

async function seedRbacContent() {
  const version = 'seed_rbac_content_v1';
  if (await isApplied(version)) return;

  await db.transaction(async (query) => {
    const existingPolicyCount = await query('SELECT COUNT(*)::int AS n FROM policies');
    if (existingPolicyCount.rows[0].n > 0) {
      await markApplied(query, version);
      return;
    }

    for (const [title, content, roleKey] of RBAC_POLICIES) {
      const inserted = await query(
        `INSERT INTO policies (title, content, requires_gate)
         SELECT $1, $2, FALSE
         WHERE NOT EXISTS (SELECT 1 FROM policies WHERE title = $1)
         RETURNING id`,
        [title, content]
      );
      const policyRow = inserted.rows[0] || (await query('SELECT id FROM policies WHERE title = $1', [title])).rows[0];
      await query(
        `INSERT INTO policy_assignments (policy_id, role_key, due_days)
         SELECT $1, $2, 30 WHERE NOT EXISTS (
           SELECT 1 FROM policy_assignments WHERE policy_id = $1 AND role_key = $2
         )`,
        [policyRow.id, roleKey]
      );
    }

    for (const module of RBAC_TRAINING_MODULES) {
      let moduleRow = (await query('SELECT id FROM training_modules WHERE title = $1', [module.title])).rows[0];
      if (!moduleRow) {
        const inserted = await query(
          `INSERT INTO training_modules (title, category, duration_min, content, target_roles)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [module.title, module.category, module.durationMin, module.content, module.roleKey]
        );
        moduleRow = inserted.rows[0];
        for (const [question, options, correctIndex] of module.quiz) {
          await query(
            `INSERT INTO quiz_questions (module_id, question, options, correct_index)
             VALUES ($1, $2, $3::jsonb, $4)`,
            [moduleRow.id, question, JSON.stringify(options), correctIndex]
          );
        }
      }
      await query(
        `INSERT INTO training_assignments (module_id, role_key, due_days)
         SELECT $1, $2, 30 WHERE NOT EXISTS (
           SELECT 1 FROM training_assignments WHERE module_id = $1 AND role_key = $2
         )`,
        [moduleRow.id, module.roleKey]
      );
    }

    await markApplied(query, version);
  });
}

async function repairRoleSpecificAssignments() {
  const version = 'repair_role_specific_assignments_v1';
  if (await isApplied(version)) return;

  await db.transaction(async (query) => {
    for (const [title, content, roleKey] of RBAC_POLICIES) {
      const policy = (await query('SELECT id FROM policies WHERE title = $1', [title])).rows[0];
      if (!policy) continue;
      await query(
        'DELETE FROM policy_assignments WHERE policy_id = $1 AND role_key IS NOT NULL AND role_key <> $2',
        [policy.id, roleKey]
      );
      await query(
        `INSERT INTO policy_assignments (policy_id, role_key, due_days)
         SELECT $1, $2, 30
         WHERE NOT EXISTS (
           SELECT 1 FROM policy_assignments WHERE policy_id = $1 AND role_key = $2
         )`,
        [policy.id, roleKey]
      );
    }

    await markApplied(query, version);
  });
}

async function runMigrations() {
  await ensureMigrationsTable();
  await migrateRolesAndPermissions();
  await migrateCeoReadOnlyPermissions();
  await migrateUsersTable();
}

async function runAssignmentMigrations() {
  await ensureMigrationsTable();
  await migrateAssignmentTables();
  await backfillAssignments();
  await seedRbacContent();
  await repairRoleSpecificAssignments();
}

module.exports = {
  runMigrations,
  runAssignmentMigrations,
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  LEGACY_ROLE_MAP,
  LEGACY_TARGET_ROLE_MAP
};
