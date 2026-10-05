const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-only-secret-that-is-not-used-outside-tests';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173,http://127.0.0.1:5173';

const bcrypt = require('bcrypt');
const db = require('../models/db');
const { startServer } = require('../server');
const { initializeIncidentTable } = require('../compliance-reporting-incidents-sadini/models/incidentModel');
const { createUser } = require('../authentication-authorization-charuka/models/userModel');

test('authenticated proposal workflows work end to end', async () => {
  await db.query(`CREATE TABLE training_modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 10,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const server = await startServer(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const admin = await createUser({
      name: 'Admin User', email: 'admin@example.test',
      passwordHash: await bcrypt.hash('Admin-Password-2026!', 4), role: 'admin'
    });
    const manager = await createUser({
      name: 'Manager User', email: 'manager@example.test',
      passwordHash: await bcrypt.hash('Manager-Password-2026!', 4), role: 'manager'
    });
    const staff = await createUser({
      name: 'Staff User', email: 'staff@example.test',
      passwordHash: await bcrypt.hash('Staff-Password-2026!', 4), role: 'staff'
    });

    async function login(email, password) {
      const response = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      assert.equal(response.status, 200);
      return (await response.json()).token;
    }

    // Agrees to every currently-pending gate policy (just the AUP today) so
    // the rest of this suite can exercise ordinary gated routes.
    async function acceptAup(token) {
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const pendingResponse = await fetch(`${base}/policies/gate`, { headers });
      assert.equal(pendingResponse.status, 200);
      const { pending } = await pendingResponse.json();
      for (const policy of pending) {
        const decisionResponse = await fetch(`${base}/policies/gate/decision`, {
          method: 'POST', headers,
          body: JSON.stringify({ policy_id: policy.id, version: policy.version, decision: 'agreed' })
        });
        assert.equal(decisionResponse.status, 201);
      }
    }

    async function loginAndAcceptAup(email, password) {
      const token = await login(email, password);
      await acceptAup(token);
      return token;
    }

    const adminToken = await loginAndAcceptAup('admin@example.test', 'Admin-Password-2026!');
    const managerToken = await loginAndAcceptAup('manager@example.test', 'Manager-Password-2026!');
    const staffToken = await loginAndAcceptAup('staff@example.test', 'Staff-Password-2026!');
    const ceoPermissions = await db.query(
      "SELECT permission_key, scope FROM role_permissions WHERE role_key = 'ceo'"
    );
    const ceoPermissionMap = Object.fromEntries(ceoPermissions.rows.map((row) => [row.permission_key, row.scope]));
    assert.equal(ceoPermissionMap['incidents.view_all'], 'org');
    assert.equal(ceoPermissionMap['users.view_directory'], 'org');
    assert.equal(ceoPermissionMap['audit.view'], 'org');
    assert.equal(Object.hasOwn(ceoPermissionMap, 'incidents.submit'), false);
    const staffHeaders = { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' };
    const managerHeaders = { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' };
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    let response;

    response = await fetch(`${base}/training/modules`, { headers: managerHeaders });
    const managerModules = await response.json();
    assert.equal(managerModules.find((module) => module.title === 'How to Report an Incident').recommended, true);
    response = await fetch(`${base}/training/modules`, { headers: staffHeaders });
    const staffModules = await response.json();
    assert.equal(staffModules.find((module) => module.title === 'How to Report an Incident').recommended, false);

    response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing@example.test', password: 'Not-The-Password' })
    });
    assert.equal(response.status, 401);
    response = await fetch(`${base}/auth/events`, { headers: managerHeaders });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).some((event) => event.action === 'login_failed'));
    response = await fetch(`${base}/auth/events`, { headers: staffHeaders });
    assert.equal(response.status, 403);

    response = await fetch(base.replace('/api', '/'), { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    response = await fetch(base.replace('/api', '/'), { headers: { Origin: 'http://127.0.0.1:5173' } });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');

    const forged = await fetch(`${base}/policies`, { headers: { 'x-user-id': '1', 'x-user-role': 'admin' } });
    assert.equal(forged.status, 401);

    response = await fetch(`${base}/policies`, { headers: staffHeaders });
    const policies = await response.json();
    assert.equal(policies.length, 5);
    const acceptableUsePolicy = policies.find((policy) => policy.title === 'Acceptable Use Policy');
    assert.match(acceptableUsePolicy.content, /30 minutes/i);
    assert.match(acceptableUsePolicy.content, /12 characters/i);
    assert.match(acceptableUsePolicy.content, /bcrypt/i);
    assert.match(acceptableUsePolicy.content, /70%/);
    assert.match(acceptableUsePolicy.content, /30 days/i);
    // Staff already agreed to the AUP at login (loginAndAcceptAup); it must
    // never be acknowledged again through the ordinary endpoint.
    assert.equal(acceptableUsePolicy.compliant, true);
    response = await fetch(`${base}/policies/acknowledge`, {
      method: 'POST', headers: staffHeaders, body: JSON.stringify({ policy_id: acceptableUsePolicy.id })
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'USE_GATE_ENDPOINT');

    const targetPolicy = policies.find((policy) => policy.title !== 'Acceptable Use Policy');
    assert.equal(targetPolicy.compliant, false);

    response = await fetch(`${base}/policies/acknowledge`, {
      method: 'POST', headers: staffHeaders, body: JSON.stringify({ policy_id: targetPolicy.id })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/policies`, { headers: staffHeaders });
    assert.equal((await response.json()).find((policy) => policy.id === targetPolicy.id).compliant, true);

    response = await fetch(`${base}/policies/${targetPolicy.id}`, {
      method: 'PUT', headers: adminHeaders,
      body: JSON.stringify({ title: targetPolicy.title, content: `${targetPolicy.content} Updated for testing.` })
    });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/policies`, { headers: staffHeaders });
    assert.equal((await response.json()).find((policy) => policy.id === targetPolicy.id).compliant, false);
    response = await fetch(`${base}/policies/acknowledge`, {
      method: 'POST', headers: staffHeaders, body: JSON.stringify({ policy_id: targetPolicy.id })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/policies/${targetPolicy.id}/acknowledgements`, { headers: managerHeaders });
    const roster = await response.json();
    assert.equal(roster.find((entry) => Number(entry.user_id) === Number(staff.id)).compliant, true);
    response = await fetch(`${base}/compliance/${staff.id}`, { headers: staffHeaders });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).policies.length, 5);
    response = await fetch(`${base}/compliance/${admin.id}`, { headers: staffHeaders });
    assert.equal(response.status, 403);

    const surveyResponse = await fetch(`${base}/training/survey`, { headers: staffHeaders });
    const survey = await surveyResponse.json();
    const weakQuestions = await db.query('SELECT id, weak_answer, module_id FROM survey_questions ORDER BY id');
    const answers = weakQuestions.rows.map((question, index) => ({
      questionId: question.id,
      answer: index === 0 ? question.weak_answer : (question.weak_answer === 'yes' ? 'no' : 'yes')
    }));
    response = await fetch(`${base}/training/survey`, {
      method: 'POST', headers: staffHeaders, body: JSON.stringify({ answers })
    });
    const recommendation = await response.json();
    assert.equal(recommendation.recommendedModules.length, 1);

    const modulesResponse = await fetch(`${base}/training/modules`, { headers: staffHeaders });
    const modules = await modulesResponse.json();
    const recommendedModule = modules.find((module) => module.recommended);
    assert.ok(recommendedModule);

    response = await fetch(`${base}/training/modules`, {
      method: 'POST', headers: staffHeaders,
      body: JSON.stringify({ title: 'Unauthorized lesson', category: 'Security', durationMin: 10, content: 'A lesson that staff cannot create.' })
    });
    assert.equal(response.status, 403);
    response = await fetch(`${base}/training/modules`, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ title: 'Admin lesson', category: 'Security', durationMin: 10, content: 'A lesson managed by the administrator.' })
    });
    assert.equal(response.status, 201);
    const managedModule = await response.json();
    response = await fetch(`${base}/training/modules/${managedModule.id}/quiz/questions`, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ question: 'Which option is correct?', options: ['Correct', 'Incorrect'], correctIndex: 0 })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/training/modules/${managedModule.id}/quiz`, { headers: staffHeaders });
    const managedQuiz = await response.json();
    assert.equal(managedQuiz.length, 1);
    assert.equal(Object.hasOwn(managedQuiz[0], 'correct_index'), false);

    const quizResponse = await fetch(`${base}/training/modules/${recommendedModule.id}/quiz`, { headers: staffHeaders });
    const quiz = await quizResponse.json();
    assert.ok(Array.isArray(quiz[0].options));
    assert.equal(Object.hasOwn(quiz[0], 'correct_index'), false);
    const answerKey = await db.query('SELECT id, correct_index FROM quiz_questions WHERE module_id = $1', [recommendedModule.id]);
    const quizAnswers = Object.fromEntries(answerKey.rows.map((question) => [question.id, question.correct_index]));
    response = await fetch(`${base}/training/modules/${recommendedModule.id}/quiz`, {
      method: 'POST', headers: staffHeaders, body: JSON.stringify({ answers: quizAnswers })
    });
    assert.equal((await response.json()).passed, true);

    response = await fetch(`${base}/incidents`, {
      method: 'POST', headers: staffHeaders,
      body: JSON.stringify({ user_id: admin.id, incident_type: 'Lost Device', title: 'Lost work phone', description: 'A work phone was lost during the commute.', severity: 'Critical' })
    });
    assert.equal(response.status, 201);
    const report = (await response.json()).incident;
    assert.equal(Number(report.user_id), Number(staff.id));
    assert.equal(report.severity, 'Critical');
    response = await fetch(`${base}/incidents?user_id=${admin.id}`, { headers: staffHeaders });
    assert.equal(response.status, 403);
    response = await fetch(`${base}/incidents/${report.id}`, {
      method: 'PATCH', headers: managerHeaders, body: JSON.stringify({ status: 'Investigating', severity: 'High', reviewed_by: staff.id })
    });
    assert.equal(response.status, 200);
    const updatedReport = (await response.json()).incident;
    assert.equal(Number(updatedReport.reviewed_by), Number(manager.id));
    assert.equal(updatedReport.status, 'Investigating');

    response = await fetch(`${base}/compliance/overview`, { headers: managerHeaders });
    const overview = await response.json();
    assert.equal(response.status, 200);
    assert.equal(overview.staffCount, 3);
    assert.ok(overview.staff.find((member) => Number(member.id) === Number(staff.id)));

    response = await fetch(`${base}/compliance/export.csv`, { headers: managerHeaders });
    assert.match(response.headers.get('content-type'), /text\/csv/);
    assert.match(await response.text(), /Compliance %/);

    response = await fetch(`${base}/compliance/reminders`, {
      method: 'POST', headers: managerHeaders,
      body: JSON.stringify({ userId: staff.id, message: 'Complete remaining requirements.' })
    });
    assert.equal(response.status, 201);
    const createdReminder = await response.json();
    response = await fetch(`${base}/compliance/reminders/me`, { headers: staffHeaders });
    assert.equal((await response.json()).length, 1);
    response = await fetch(`${base}/compliance/reminders/${createdReminder.id}/read`, { method: 'PATCH', headers: staffHeaders });
    assert.equal(response.status, 200);
    const acknowledgedReminder = await response.json();
    assert.ok(acknowledgedReminder.read_at);
    response = await fetch(`${base}/compliance/reminders/${createdReminder.id}/read`, { method: 'PATCH', headers: managerHeaders });
    assert.equal(response.status, 404);

    response = await fetch(`${base}/users/${staff.id}/role`, {
      method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ role: 'manager' })
    });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/compliance/overview`, { headers: staffHeaders });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-auth-token') !== null, true);

    response = await fetch(`${base}/auth/password`, {
      method: 'PATCH', headers: staffHeaders,
      body: JSON.stringify({ currentPassword: 'Staff-Password-2026!', newPassword: 'Staff-New-Password-2026!' })
    });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/auth/me`, { headers: staffHeaders });
    assert.equal(response.status, 401);

    response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@example.test', password: 'Staff-Password-2026!' })
    });
    assert.equal(response.status, 401);
    const newStaffToken = await login('staff@example.test', 'Staff-New-Password-2026!');
    response = await fetch(`${base}/auth/logout`, {
      method: 'POST', headers: { Authorization: `Bearer ${newStaffToken}` }
    });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${newStaffToken}` } });
    assert.equal(response.status, 401);

    response = await fetch(`${base}/auth/events`, { headers: adminHeaders });
    const events = await response.json();
    assert.ok(events.some((event) => event.action === 'password_changed'));
    assert.ok(events.some((event) => event.action === 'logout'));

    response = await fetch(`${base}/users/${staff.id}/active`, {
      method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ isActive: false })
    });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@example.test', password: 'Staff-New-Password-2026!' })
    });
    assert.equal(response.status, 401);

    response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'blocked@example.test', password: 'Wrong-Password-2026!' })
    });
    assert.equal(response.status, 401);
    response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'blocked@example.test', password: 'Wrong-Password-2026!' })
    });
    assert.equal(response.status, 429);

    await db.query('DROP TABLE incidents');
    await db.query(`CREATE TABLE incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      incident_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Under Review', 'Resolved')),
      reviewed_by INTEGER REFERENCES users(id),
      reviewed_at TEXT
    )`);
    await db.query(
      `INSERT INTO incidents (user_id, incident_type, title, description, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [admin.id, 'Other', 'Legacy report', 'A legacy report used an old status.', 'Under Review']
    );
    await initializeIncidentTable();
    const migratedIncident = await db.query('SELECT status, severity FROM incidents WHERE title = $1', ['Legacy report']);
    assert.equal(migratedIncident.rows[0].status, 'Investigating');
    assert.equal(migratedIncident.rows[0].severity, 'Medium');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.end();
  }
});