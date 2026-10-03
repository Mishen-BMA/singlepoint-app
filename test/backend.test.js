const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-only-secret-that-is-not-used-outside-tests';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';

const bcrypt = require('bcrypt');
const db = require('../models/db');
const { startServer } = require('../server');
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

    const adminToken = await login('admin@example.test', 'Admin-Password-2026!');
    const managerToken = await login('manager@example.test', 'Manager-Password-2026!');
    const staffToken = await login('staff@example.test', 'Staff-Password-2026!');
    const staffHeaders = { Authorization: `Bearer ${staffToken}`, 'Content-Type': 'application/json' };
    const managerHeaders = { Authorization: `Bearer ${managerToken}`, 'Content-Type': 'application/json' };
    const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

    let response = await fetch(base.replace('/api', '/'), { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');

    const forged = await fetch(`${base}/policies`, { headers: { 'x-user-id': '1', 'x-user-role': 'admin' } });
    assert.equal(forged.status, 401);

    response = await fetch(`${base}/policies`, { headers: staffHeaders });
    const policies = await response.json();
    assert.equal(policies.length, 4);
    assert.equal(policies[0].compliant, false);

    response = await fetch(`${base}/policies/acknowledge`, {
      method: 'POST', headers: staffHeaders, body: JSON.stringify({ policy_id: policies[0].id })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/policies`, { headers: staffHeaders });
    assert.equal((await response.json())[0].compliant, true);

    response = await fetch(`${base}/policies/${policies[0].id}`, {
      method: 'PUT', headers: adminHeaders,
      body: JSON.stringify({ title: policies[0].title, content: `${policies[0].content} Updated for testing.` })
    });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/policies`, { headers: staffHeaders });
    assert.equal((await response.json())[0].compliant, false);
    response = await fetch(`${base}/policies/acknowledge`, {
      method: 'POST', headers: staffHeaders, body: JSON.stringify({ policy_id: policies[0].id })
    });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/policies/${policies[0].id}/acknowledgements`, { headers: managerHeaders });
    const roster = await response.json();
    assert.equal(roster.find((entry) => Number(entry.user_id) === Number(staff.id)).compliant, true);
    response = await fetch(`${base}/compliance/${staff.id}`, { headers: staffHeaders });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).policies.length, 4);
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
      body: JSON.stringify({ user_id: admin.id, incident_type: 'Lost Device', title: 'Lost work phone', description: 'A work phone was lost during the commute.' })
    });
    assert.equal(response.status, 201);
    const report = (await response.json()).incident;
    assert.equal(Number(report.user_id), Number(staff.id));
    response = await fetch(`${base}/incidents?user_id=${admin.id}`, { headers: staffHeaders });
    assert.equal(response.status, 403);
    response = await fetch(`${base}/incidents/${report.id}`, {
      method: 'PATCH', headers: managerHeaders, body: JSON.stringify({ status: 'Resolved', reviewed_by: staff.id })
    });
    assert.equal(response.status, 200);
    assert.equal(Number((await response.json()).incident.reviewed_by), Number(manager.id));

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
    response = await fetch(`${base}/compliance/reminders/me`, { headers: staffHeaders });
    assert.equal((await response.json()).length, 1);

    response = await fetch(`${base}/users/${staff.id}/role`, {
      method: 'PATCH', headers: adminHeaders, body: JSON.stringify({ role: 'manager' })
    });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/compliance/overview`, { headers: staffHeaders });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-auth-token') !== null, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.end();
  }
});