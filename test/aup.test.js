const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.DATABASE_URL = 'sqlite::memory:';
process.env.JWT_SECRET = 'test-only-secret-that-is-not-used-outside-tests';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173,http://127.0.0.1:5173';

const bcrypt = require('bcrypt');
const db = require('../models/db');
const { startServer } = require('../server');
const { createUser } = require('../authentication-authorization-charuka/models/userModel');

test('Acceptable Use Policy hard gate', async () => {
  const server = await startServer(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const admin = await createUser({
      name: 'Gate Admin', email: 'gate-admin@example.test',
      passwordHash: await bcrypt.hash('Gate-Admin-Password-2026!', 4), role: 'admin'
    });
    const staffA = await createUser({
      name: 'Gate Staff A', email: 'gate-staff-a@example.test',
      passwordHash: await bcrypt.hash('Gate-Staff-A-Password-2026!', 4), role: 'staff'
    });
    const staffB = await createUser({
      name: 'Gate Staff B', email: 'gate-staff-b@example.test',
      passwordHash: await bcrypt.hash('Gate-Staff-B-Password-2026!', 4), role: 'staff'
    });
    const staffC = await createUser({
      name: 'Gate Staff C', email: 'gate-staff-c@example.test',
      passwordHash: await bcrypt.hash('Gate-Staff-C-Password-2026!', 4), role: 'staff'
    });

    async function login(email, password) {
      const response = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return response;
    }

    function headersFor(token) {
      return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    }

    async function getGatePending(token) {
      const response = await fetch(`${base}/policies/gate`, { headers: headersFor(token) });
      assert.equal(response.status, 200);
      return (await response.json()).pending;
    }

    async function agree(token, policy) {
      return fetch(`${base}/policies/gate/decision`, {
        method: 'POST', headers: headersFor(token),
        body: JSON.stringify({ policy_id: policy.id, version: policy.version, decision: 'agreed' })
      });
    }

    async function decline(token, policy) {
      return fetch(`${base}/policies/gate/decision`, {
        method: 'POST', headers: headersFor(token),
        body: JSON.stringify({ policy_id: policy.id, version: policy.version, decision: 'declined' })
      });
    }

    async function loginAndAgree(email, password) {
      const loginResponse = await login(email, password);
      assert.equal(loginResponse.status, 200);
      const { token } = await loginResponse.json();
      const pending = await getGatePending(token);
      for (const policy of pending) {
        const decisionResponse = await agree(token, policy);
        assert.equal(decisionResponse.status, 201);
      }
      return token;
    }

    // --- Admin needs to accept the gate too, to use admin-only routes below ---
    const adminToken = await loginAndAgree('gate-admin@example.test', 'Gate-Admin-Password-2026!');
    const adminHeaders = headersFor(adminToken);

    // --- 1. A freshly logged-in user is gated everywhere except the allow-list ---
    let loginResponse = await login('gate-staff-a@example.test', 'Gate-Staff-A-Password-2026!');
    assert.equal(loginResponse.status, 200);
    const loginBody = await loginResponse.json();
    assert.equal(loginBody.user.aupPending, true);
    const staffAToken1 = loginBody.token;
    const staffAHeaders1 = headersFor(staffAToken1);

    let response = await fetch(`${base}/auth/me`, { headers: staffAHeaders1 });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).aupPending, true);

    for (const path of ['/policies', '/training/modules', '/incidents']) {
      response = await fetch(`${base}${path}`, { headers: staffAHeaders1 });
      assert.equal(response.status, 403, `${path} should be gated`);
      assert.equal((await response.json()).code, 'AUP_REQUIRED');
    }

    response = await fetch(`${base}/users`, { headers: adminHeaders });
    // Admin already agreed, so this one must succeed.
    assert.equal(response.status, 200);

    const pendingForStaffA = await getGatePending(staffAToken1);
    assert.equal(pendingForStaffA.length, 1);
    assert.equal(pendingForStaffA[0].title, 'Acceptable Use Policy');
    const aupPolicy = pendingForStaffA[0];

    // --- 2. Agreeing records the decision and immediately unlocks gated routes ---
    response = await agree(staffAToken1, aupPolicy);
    assert.equal(response.status, 201);
    assert.deepEqual((await response.json()).pending, []);

    const storedAgreement = await db.query(
      `SELECT * FROM acknowledgements WHERE policy_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT 1`,
      [aupPolicy.id, staffA.id]
    );
    assert.equal(storedAgreement.rows[0].decision, 'agreed');
    assert.equal(Number(storedAgreement.rows[0].version_acknowledged), aupPolicy.version);
    assert.ok(storedAgreement.rows[0].ip_address);

    response = await fetch(`${base}/policies`, { headers: staffAHeaders1 });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/training/modules`, { headers: staffAHeaders1 });
    assert.equal(response.status, 200);
    response = await fetch(`${base}/incidents`, { headers: staffAHeaders1 });
    assert.equal(response.status, 200);

    // --- 3. A second login does not ask again ---
    loginResponse = await login('gate-staff-a@example.test', 'Gate-Staff-A-Password-2026!');
    assert.equal(loginResponse.status, 200);
    const secondLoginBody = await loginResponse.json();
    assert.equal(secondLoginBody.user.aupPending, false);

    // --- 4. Double-clicking Agree does not create duplicate rows ---
    const staffBLoginResponse = await login('gate-staff-b@example.test', 'Gate-Staff-B-Password-2026!');
    const staffBToken = (await staffBLoginResponse.json()).token;
    const staffBPending = await getGatePending(staffBToken);
    const [first, second] = await Promise.all([agree(staffBToken, staffBPending[0]), agree(staffBToken, staffBPending[0])]);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const staffBRows = await db.query(
      'SELECT * FROM acknowledgements WHERE policy_id = $1 AND user_id = $2',
      [staffBPending[0].id, staffB.id]
    );
    assert.equal(staffBRows.rowCount, 1);

    // --- 5. Declining ends the session and never counts as compliant ---
    const staffCLoginResponse = await login('gate-staff-c@example.test', 'Gate-Staff-C-Password-2026!');
    const staffCToken = (await staffCLoginResponse.json()).token;
    const staffCPending = await getGatePending(staffCToken);
    response = await decline(staffCToken, staffCPending[0]);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, declined: true });
    assert.equal(response.headers.get('x-auth-token'), null);

    response = await fetch(`${base}/auth/me`, { headers: headersFor(staffCToken) });
    assert.equal(response.status, 401);

    const declinedRow = await db.query(
      `SELECT * FROM acknowledgements WHERE policy_id = $1 AND user_id = $2 ORDER BY id DESC LIMIT 1`,
      [staffCPending[0].id, staffC.id]
    );
    assert.equal(declinedRow.rows[0].decision, 'declined');

    const reLoginResponse = await login('gate-staff-c@example.test', 'Gate-Staff-C-Password-2026!');
    assert.equal(reLoginResponse.status, 200);
    assert.equal((await reLoginResponse.json()).user.aupPending, true);

    response = await fetch(`${base}/compliance/overview`, { headers: adminHeaders });
    assert.equal(response.status, 200);
    const overview = await response.json();
    const staffCRow = overview.staff.find((member) => Number(member.id) === Number(staffC.id));
    assert.ok(staffCRow.acknowledgedPolicies < staffCRow.totalPolicies);

    // --- 6. A version bump forces re-acceptance mid-session, and stale versions are rejected ---
    response = await fetch(`${base}/policies`, { headers: adminHeaders });
    const adminPolicies = await response.json();
    const aupFromAdmin = adminPolicies.find((policy) => policy.title === 'Acceptable Use Policy');
    const oldVersion = aupFromAdmin.version;

    response = await fetch(`${base}/policies/${aupFromAdmin.id}`, {
      method: 'PUT', headers: adminHeaders,
      body: JSON.stringify({ title: aupFromAdmin.title, content: `${aupFromAdmin.content} Revised for testing.` })
    });
    assert.equal(response.status, 200);
    const bumpedPolicy = await response.json();
    assert.equal(Number(bumpedPolicy.version), Number(oldVersion) + 1);

    response = await fetch(`${base}/policies`, { headers: staffAHeaders1 });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'AUP_REQUIRED');

    response = await agree(staffAToken1, { id: aupFromAdmin.id, version: oldVersion });
    assert.equal(response.status, 409);
    const staleBody = await response.json();
    assert.equal(staleBody.code, 'POLICY_VERSION_CHANGED');
    assert.equal(Number(staleBody.policy.version), Number(bumpedPolicy.version));

    response = await agree(staffAToken1, { id: aupFromAdmin.id, version: bumpedPolicy.version });
    assert.equal(response.status, 201);
    response = await fetch(`${base}/policies`, { headers: staffAHeaders1 });
    assert.equal(response.status, 200);

    // The admin who published the bump is themselves non-compliant now too
    // (their earlier agreement was for the old version) — re-agree so the
    // remaining admin-only calls below are not blocked by the gate.
    const adminPendingAfterBump = await getGatePending(adminToken);
    for (const policy of adminPendingAfterBump) {
      const decisionResponse = await agree(adminToken, policy);
      assert.equal(decisionResponse.status, 201);
    }

    // --- 7. The ordinary acknowledge endpoint refuses gate policies ---
    response = await fetch(`${base}/policies/acknowledge`, {
      method: 'POST', headers: staffAHeaders1, body: JSON.stringify({ policy_id: aupFromAdmin.id })
    });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'USE_GATE_ENDPOINT');

    // --- 8. Acknowledgement rows are append-only; history shows every decision in order ---
    // staffB: agreed (step 4), then declines the current version, then agrees again.
    let staffBPendingNow = await getGatePending(staffBToken);
    assert.equal(staffBPendingNow.length, 1, 'staffB must be re-gated after the version bump too');
    const currentAup = staffBPendingNow[0];
    response = await decline(staffBToken, currentAup);
    assert.equal(response.status, 200);
    const staffBRelogin = await login('gate-staff-b@example.test', 'Gate-Staff-B-Password-2026!');
    const staffBToken2 = (await staffBRelogin.json()).token;
    const staffBPendingAgain = await getGatePending(staffBToken2);
    response = await agree(staffBToken2, staffBPendingAgain[0]);
    assert.equal(response.status, 201);

    response = await fetch(`${base}/policies/${currentAup.id}/acknowledgement-history`, { headers: adminHeaders });
    assert.equal(response.status, 200);
    const history = await response.json();
    const staffBHistory = history.filter((row) => Number(row.user_id) === Number(staffB.id));
    assert.deepEqual(staffBHistory.map((row) => row.decision), ['agreed', 'declined', 'agreed']);

    // Admin-only: a non-admin must not see acknowledgement history.
    response = await fetch(`${base}/policies/${currentAup.id}/acknowledgement-history`, { headers: staffAHeaders1 });
    assert.equal(response.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.end();
  }
});
