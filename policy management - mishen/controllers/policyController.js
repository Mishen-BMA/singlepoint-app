const db = require('../../models/db');
const {
  getPendingGatePolicies,
  getPolicyById,
  getLatestAcknowledgement,
  insertAcknowledgement,
  getAcknowledgementHistory
} = require('../models/policyModel');
const { revokeAuthSession, recordLoginEvent } = require('../../authentication-authorization-charuka/models/userModel');

const DAY_MS = 24 * 60 * 60 * 1000;

// The latest acknowledgement row (by MAX(id)) for a user+policy pair is that
// user's current decision. A declined row, or a row acknowledging an old
// version, must never count as compliant.
function statusFor({ decision, versionAcknowledged, currentVersion, updatedAt }) {
  const compliant = decision === 'agreed' && Number(versionAcknowledged) === Number(currentVersion);
  if (compliant) return { compliant, overdue: false, status: 'acknowledged' };
  if (decision === 'declined') return { compliant, overdue: false, status: 'declined' };
  const overdue = Boolean(updatedAt) && Date.parse(updatedAt) <= Date.now() - 30 * DAY_MS;
  return { compliant, overdue, status: overdue ? 'overdue' : 'pending' };
}

async function createPolicy(req, res) {
  const { title, content } = req.body;

  if (typeof title !== 'string' || typeof content !== 'string' || title.trim().length < 3 || title.trim().length > 160 || content.trim().length < 10 || content.length > 20000) {
    return res.status(400).json({ error: 'Provide a policy title (3-160 characters) and content (10-20000 characters)' });
  }

  try {
    const result = await db.query(
      'INSERT INTO policies (title, content) VALUES ($1, $2) RETURNING *',
      [title.trim(), content.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create policy' });
  }
}

async function getAllPolicies(req, res) {
  try {
    const result = await db.query(
      `SELECT p.*,
        (SELECT a.version_acknowledged FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)) AS version_acknowledged,
        (SELECT a.decision FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)) AS decision,
        (SELECT a.acknowledged_at FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)) AS acknowledged_at
       FROM policies p
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    result.rows = result.rows.map((row) => ({
      ...row,
      ...statusFor({
        decision: row.decision,
        versionAcknowledged: row.version_acknowledged,
        currentVersion: row.version,
        updatedAt: row.updated_at
      })
    }));
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch policies' });
  }
}

async function getAcknowledgementsForPolicy(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT u.id AS user_id, u.name, u.email, p.version AS current_version, p.updated_at,
        (SELECT a.version_acknowledged FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = u.id
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = u.id)) AS version_acknowledged,
        (SELECT a.decision FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = u.id
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = u.id)) AS decision,
        (SELECT a.acknowledged_at FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = u.id
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = u.id)) AS acknowledged_at
       FROM policies p CROSS JOIN users u
       WHERE p.id = $1
       ORDER BY u.name`,
      [id]
    );
    if (result.rowCount === 0) {
      const policy = await db.query('SELECT id FROM policies WHERE id = $1', [id]);
      if (policy.rowCount === 0) return res.status(404).json({ error: 'Policy not found' });
    }
    result.rows = result.rows.map((row) => ({
      ...row,
      ...statusFor({
        decision: row.decision,
        versionAcknowledged: row.version_acknowledged,
        currentVersion: row.current_version,
        updatedAt: row.updated_at
      })
    }));
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch acknowledgements' });
  }
}

async function updatePolicy(req, res) {
  const { id } = req.params;
  const { title, content } = req.body;

  if (typeof title !== 'string' || typeof content !== 'string' || title.trim().length < 3 || title.trim().length > 160 || content.trim().length < 10 || content.length > 20000) {
    return res.status(400).json({ error: 'Provide a policy title (3-160 characters) and content (10-20000 characters)' });
  }

  try {
    const result = await db.query(
      `UPDATE policies
       SET title = $1, content = $2, version = version + 1, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [title.trim(), content.trim(), id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update policy' });
  }
}

async function getComplianceStatus(req, res) {
  const { policyId, userId } = req.params;
  if (String(req.user.id) !== String(userId) && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only view your own compliance' });
  }

  try {
    const result = await db.query(
      `SELECT p.version AS current_version,
        (SELECT a.version_acknowledged FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)) AS version_acknowledged,
        (SELECT a.decision FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)) AS decision,
        (SELECT a.acknowledged_at FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)) AS acknowledged_at
       FROM policies p
       WHERE p.id = $2`,
      [userId, policyId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    const row = result.rows[0];
    const { compliant } = statusFor({
      decision: row.decision,
      versionAcknowledged: row.version_acknowledged,
      currentVersion: row.current_version
    });
    res.json({
      policyId,
      userId,
      currentVersion: row.current_version,
      versionAcknowledged: row.version_acknowledged || null,
      compliant
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check compliance' });
  }
}

async function acknowledgePolicy(req, res) {
  const { policy_id } = req.body;
  const user_id = req.user.id;

  if (!policy_id) {
    return res.status(400).json({ error: 'policy_id is required' });
  }

  try {
    const policy = await getPolicyById(policy_id);
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    if (policy.requires_gate) {
      return res.status(409).json({ code: 'USE_GATE_ENDPOINT', error: 'This policy requires the Acceptable Use Policy gate endpoint' });
    }
    const result = await db.query(
      `INSERT INTO acknowledgements (policy_id, user_id, version_acknowledged, decision)
       SELECT id, $1, version, 'agreed' FROM policies WHERE id = $2
       RETURNING *`,
      [user_id, policy_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to record acknowledgement' });
  }
}

async function getUserComplianceOverview(req, res) {
  const { userId } = req.params;
  if (String(req.user.id) !== String(userId) && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'You can only view your own compliance' });
  }

  try {
    const queryResult = await db.query(
      `SELECT p.id AS policy_id, p.title, p.content, p.version AS current_version,
        (SELECT a.version_acknowledged FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)) AS version_acknowledged,
        (SELECT a.decision FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)) AS decision,
        (SELECT a.acknowledged_at FROM acknowledgements a
         WHERE a.policy_id = p.id AND a.user_id = $1
           AND a.id = (SELECT MAX(a2.id) FROM acknowledgements a2 WHERE a2.policy_id = p.id AND a2.user_id = $1)) AS acknowledged_at
       FROM policies p
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const policies = queryResult.rows.map((row) => ({
      policyId: row.policy_id,
      title: row.title,
      content: row.content,
      currentVersion: row.current_version,
      versionAcknowledged: row.version_acknowledged || null,
      acknowledgedAt: row.acknowledged_at,
      ...statusFor({
        decision: row.decision,
        versionAcknowledged: row.version_acknowledged,
        currentVersion: row.current_version
      })
    }));

    res.json({ userId, policies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch compliance overview' });
  }
}

async function getGatePolicies(req, res) {
  try {
    const pending = await getPendingGatePolicies(req.user.id);
    res.json({ pending });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gate policies' });
  }
}

async function postGateDecision(req, res) {
  const { policy_id, version, decision } = req.body;

  if (!Number.isFinite(policy_id) || !Number.isFinite(version) || !['agreed', 'declined'].includes(decision)) {
    return res.status(400).json({ error: 'policy_id, version, and a valid decision are required' });
  }

  try {
    const policy = await getPolicyById(policy_id);
    if (!policy || !policy.requires_gate) {
      return res.status(404).json({ error: 'Gate policy not found' });
    }
    if (Number(policy.version) !== Number(version)) {
      return res.status(409).json({
        code: 'POLICY_VERSION_CHANGED',
        policy: { id: policy.id, title: policy.title, content: policy.content, version: policy.version }
      });
    }

    if (decision === 'agreed') {
      const latest = await getLatestAcknowledgement(policy.id, req.user.id);
      const alreadyAgreed = latest && latest.decision === 'agreed' && Number(latest.version_acknowledged) === Number(policy.version);
      if (!alreadyAgreed) {
        await insertAcknowledgement({
          policyId: policy.id,
          userId: req.user.id,
          versionAcknowledged: policy.version,
          decision: 'agreed',
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
        await recordLoginEvent({ userId: req.user.id, action: 'aup_agreed', ipAddress: req.ip, userAgent: req.get('user-agent') });
      }
      const pending = await getPendingGatePolicies(req.user.id);
      return res.status(201).json({ ok: true, pending });
    }

    // decision === 'declined': fail closed — always revoke the session, even
    // if recording the decline itself throws.
    try {
      await insertAcknowledgement({
        policyId: policy.id,
        userId: req.user.id,
        versionAcknowledged: policy.version,
        decision: 'declined',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      await recordLoginEvent({ userId: req.user.id, action: 'aup_declined', ipAddress: req.ip, userAgent: req.get('user-agent') });
    } finally {
      await revokeAuthSession(req.sessionId);
    }
    res.removeHeader('X-Auth-Token');
    res.status(200).json({ ok: true, declined: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record your decision' });
  }
}

async function getAcknowledgementHistoryForPolicy(req, res) {
  const { id } = req.params;
  try {
    const policy = await getPolicyById(id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    const history = await getAcknowledgementHistory(id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch acknowledgement history' });
  }
}

module.exports = {
  createPolicy,
  getAllPolicies,
  acknowledgePolicy,
  getAcknowledgementsForPolicy,
  updatePolicy,
  getComplianceStatus,
  getUserComplianceOverview,
  getGatePolicies,
  postGateDecision,
  getAcknowledgementHistoryForPolicy
};
