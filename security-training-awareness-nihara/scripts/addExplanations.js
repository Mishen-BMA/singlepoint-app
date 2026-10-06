require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const db = require('../../models/db');

const items = [
  // ===== Phishing & Social Engineering =====
  ['You receive an AnyDesk connection request from a client at 11 PM. What do you do?',
   'Unexpected requests outside business hours may be an attacker pretending to be a client. Decline it and report it through the incident form.'],
  ['An email asks you to urgently confirm your password via a link. What is this most likely?',
   'Urgency plus a request for your password is a classic phishing sign. Real IT teams never ask for passwords by link.'],
  ['What should you do with a suspicious message?',
   'Reporting lets the admin warn others and investigate. Deleting it silently or replying helps the attacker.'],

  // ===== Password & Credential Safety =====
  ['A client POS password needs to reach a colleague. What is correct?',
   'WhatsApp, notes and plain email can be read by others. Only the approved secure channel keeps the password protected.'],
  ['Is it acceptable to share your login with a coworker?',
   'Shared logins remove accountability. Every action must be traceable to one person.'],
  ['Where should work credentials NOT be stored?',
   'Personal notes and chat apps are not protected or controlled by the company. Use an approved password manager or vault.'],

  // ===== Safe Remote Access Practices =====
  ['When you finish a remote session you should:',
   'An open session can be taken over by someone else. Close and terminate it immediately.'],
  ['Which login should you use for remote access?',
   'Individual credentials tie every action to a real person. Shared or borrowed logins break accountability.'],
  ['A connection request arrives outside business hours. You should:',
   'Unexpected after-hours requests are a warning sign. Decline and report instead of trusting a familiar-looking client ID.'],

  // ===== How to Report an Incident =====
  ['Where should a suspicious incident be reported?',
   'Chat messages get lost. The in-app incident form logs it and sends it straight to the admin.'],
  ['When should you report a lost work device?',
   'A lost device can expose emails and saved passwords. Report it immediately so access can be cut off.'],
  ['Who receives your incident report?',
   'Reports go directly to the Admin (CEO) dashboard, so they cannot be forgotten or lost in conversation.'],

  // ===== Secure Coding & Vulnerability Awareness =====
  ['Which practice best prevents SQL injection?',
   'Parameterised queries keep user input as data, never as part of the SQL command.'],
  ['Where should production credentials be stored?',
   'Secrets in source control can be read by anyone with repo access. Use a secrets manager or environment configuration.'],
  ['What should happen before code touching authentication merges?',
   'Authentication code is high risk. A peer review catches mistakes before they reach production.'],
  ['A critical vulnerability is reported in a dependency you own. What is the expected remediation window?',
   'Policy requires critical issues to be patched within 7 days, and high issues within 30 days.'],
  ['What should CI do with high/critical SAST or dependency-scan findings?',
   'High and critical findings must block the release until they are fixed or formally accepted.'],

  // ===== Employee Data Protection & Privacy =====
  ['Where should personnel records be stored?',
   'Personnel data must stay in approved HR systems, where access is controlled and logged.'],
  ['When can personnel data be accessed?',
   'Access is allowed only for a legitimate HR purpose, never out of curiosity or convenience.'],
  ['What should you do if you discover personnel data was exposed?',
   'Report it immediately. Delay or silence lets the exposure grow and breaks policy.'],
  ['How long should employee personal data be retained?',
   'Keep personal data only as long as needed for employment purposes, then dispose of it.'],
  ['Who can request access or correction of their own personnel data?',
   'Employees have the right to access and correct their own records.'],

  // ===== Data Protection & Handling =====
  ['Before using a dataset, you should first:',
   'Classification decides which handling, storage and sharing rules apply, so it comes first.'],
  ['Sensitive datasets should be protected using:',
   'Sensitive data needs encryption both at rest (stored) and in transit (moving).'],
  ['Can production personal data be copied to a personal device?',
   'Production personal data must never leave managed systems without approval.'],
  ['When building a model, personal data should be:',
   'Minimise and anonymise personal data wherever possible to reduce privacy risk.'],
  ['Every dataset and model artefact should carry:',
   'A classification label tells everyone which handling rules apply to that dataset or model.'],

  // ===== Security Governance & Policy Enforcement =====
  ['Who is accountable for approving and reviewing security policies each year?',
   'The CEO is accountable for security policy, with managers supporting enforcement.'],
  ['A team member keeps ignoring a required policy. What should a manager do?',
   'Managers follow up with reminders and escalate. They must not ignore it or act on the person\'s behalf.'],
  ['How often should a manager review team access?',
   'Access reviews happen every quarter so unneeded access is removed promptly.'],
  ['An incident report arrives. What should the manager do?',
   'Triage promptly, set status and severity, and escalate High or Critical reports to the CEO.']
];

(async () => {
  try {
    for (const [question, explanation] of items) {
      const r = await db.query(
        'UPDATE quiz_questions SET explanation = $1 WHERE question = $2', [explanation, question]);
      console.log(r.rowCount ? 'Updated:' : 'Not found:', question);
    }
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit(0);
  }
})();