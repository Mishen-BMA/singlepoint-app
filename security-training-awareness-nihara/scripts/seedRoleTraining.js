require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('../../models/db');

const modules = [
  {
    title: 'Secure Coding & Vulnerability Awareness',
    category: 'Engineering Security', duration: 20, roles: ['software_engineer'],
    content: 'Covers secure coding fundamentals, the secure development lifecycle, and how to triage and remediate vulnerabilities.',
    quiz: [
      ['Which practice best prevents SQL injection?',
        ['String-concatenating user input into queries', 'Disabling error messages', 'Parameterised queries / prepared statements', 'Using a longer password'], 2],
      ['Where should production credentials be stored?',
        ['In code comments', 'In a secrets manager or environment configuration, never in source control', 'Committed in the repository', 'In a shared spreadsheet'], 1],
      ['What should happen before code touching authentication merges?',
        ['Nothing extra is required', 'It should be force-merged immediately', 'It should skip CI', 'A peer code review'], 3],
      ['A critical vulnerability is reported in a dependency you own. What is the expected remediation window?',
        ['Within 7 days', 'Within 1 year', 'Only at the next major release', 'No fixed timeframe'], 0],
      ['What should CI do with high/critical SAST or dependency-scan findings?',
        ['Ignore them', 'Email them to no one', 'Block the release until resolved or formally accepted', 'Delete the finding'], 2]
    ]
  },
  {
    title: 'Employee Data Protection & Privacy',
    category: 'HR Compliance', duration: 15, roles: ['hr'],
    content: 'Covers safe handling of personnel data, employee privacy rights, and reporting data exposure.',
    quiz: [
      ['Where should personnel records be stored?',
        ['Personal spreadsheets', 'Approved HR systems only', 'A shared public drive', 'Printed folders on any desk'], 1],
      ['When can personnel data be accessed?',
        ['Any time, by anyone', 'Only on Fridays', 'Only for a legitimate HR purpose', 'Only by the CEO'], 2],
      ['What should you do if you discover personnel data was exposed?',
        ['Say nothing', 'Wait for someone else to notice', 'Delete the evidence', 'Report it immediately'], 3],
      ['How long should employee personal data be retained?',
        ['Only as long as required for employment purposes', 'Forever', 'Exactly one day', 'Until the disk is full'], 0],
      ['Who can request access or correction of their own personnel data?',
        ['No one', 'Only external auditors', 'The employee themselves', 'Only the CEO'], 2]
    ]
  },
  {
    title: 'Data Protection & Handling',
    category: 'Data Science Compliance', duration: 15, roles: ['data_science'],
    content: 'Covers dataset classification, encryption requirements, anonymisation, and safe handling of production data.',
    quiz: [
      ['Before using a dataset, you should first:',
        ['Classify it', 'Email it to a personal account', 'Ignore its sensitivity', 'Delete its metadata'], 0],
      ['Sensitive datasets should be protected using:',
        ['No protection needed', 'A sticky note with the password', 'Encryption at rest and in transit', 'Public sharing links'], 2],
      ['Can production personal data be copied to a personal device?',
        ['Yes, always', 'Only on weekends', 'Only if compressed', 'No, never without approval'], 3],
      ['When building a model, personal data should be:',
        ['Used in full, unmodified', 'Minimised and anonymised where possible', 'Shared publicly for transparency', 'Duplicated across every notebook'], 1],
      ['Every dataset and model artefact should carry:',
        ['No labels', 'Just a filename', 'A random number', 'A classification label with matching handling rules'], 3]
    ]
  },
  {
    title: 'Security Governance & Policy Enforcement',
    category: 'Leadership Security', duration: 10, roles: ['ceo', 'manager'],
    content: 'Covers leadership responsibility for security policy, fair enforcement, access reviews, and handling reported incidents.',
    quiz: [
      ['Who is accountable for approving and reviewing security policies each year?',
        ['Any engineer', 'The CEO, with managers supporting enforcement', 'Clients', 'Nobody'], 1],
      ['A team member keeps ignoring a required policy. What should a manager do?',
        ['Ignore it', 'Send a reminder, follow up, and escalate under the enforcement section', 'Acknowledge it on their behalf', 'Delete their account without telling anyone'], 1],
      ['How often should a manager review team access?',
        ['Never', 'Only when someone leaves', 'Every five years', 'Every quarter'], 3],
      ['An incident report arrives. What should the manager do?',
        ['Wait to see if it repeats', 'Delete it', 'Triage promptly, set status and severity, and escalate High or Critical reports to the CEO', 'Discuss it only in a chat group'], 2]
    ]
  }
];

(async () => {
  try {
    for (const m of modules) {
      const exists = await db.query('SELECT id FROM training_modules WHERE title = $1', [m.title]);
      if (exists.rows.length > 0) {
        console.log('Skipped (already exists):', m.title);
        continue;
      }
      const r = await db.query(
        `INSERT INTO training_modules (title, category, duration_min, content, target_roles)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [m.title, m.category, m.duration, m.content, m.roles.join(',')]);
      const moduleId = r.rows[0].id;

      for (const q of m.quiz) {
        await db.query(
          `INSERT INTO quiz_questions (module_id, question, options, correct_index)
           VALUES ($1,$2,$3::jsonb,$4)`,
          [moduleId, q[0], JSON.stringify(q[1]), q[2]]);
      }
      for (const role of m.roles) {
        await db.query(
          'INSERT INTO training_assignments (module_id, role_key, due_days) VALUES ($1,$2,30)',
          [moduleId, role]);
      }
      console.log('Added:', m.title, '->', m.roles.join(', '));
    }
  } catch (e) {
    console.error('Seed failed:', e.message);
  } finally {
    process.exit(0);
  }
})();