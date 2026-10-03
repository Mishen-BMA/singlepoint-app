const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const {
  findUserByEmail,
  findUserById,
  createUser,
  getAllUsers,
  updateUserRole,
  changePassword,
  setUserActive,
  getActiveAdminCount,
  getLoginEvents,
  createAuthSession,
  revokeAuthSession,
  revokeUserSessions,
  recordLoginEvent
} = require('../models/userModel');
const { issueToken } = require('../middleware/auth');

const SALT_ROUNDS = 10;
const ALLOWED_ROLES = ['admin', 'manager', 'staff'];

async function login(req, res) {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await findUserByEmail(email.trim().toLowerCase());
    const passwordMatches = user && user.is_active && await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      await recordLoginEvent({ action: 'login_failed', ipAddress: req.ip, userAgent: req.get('user-agent') });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await createAuthSession(sessionId, user.id, expiresAt);
    await recordLoginEvent({ userId: user.id, action: 'login_succeeded', ipAddress: req.ip, userAgent: req.get('user-agent') });
    const token = issueToken(user, sessionId);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
}

async function me(req, res) {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
}

async function logout(req, res) {
  await revokeAuthSession(req.sessionId);
  await recordLoginEvent({ userId: req.user.id, action: 'logout', ipAddress: req.ip, userAgent: req.get('user-agent') });
  res.json({ message: 'Logged out' });
}

async function changeOwnPassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' ||
      newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    return res.status(400).json({ error: 'Current password and a new password of 12-72 bytes are required' });
  }
  try {
    const user = await findUserById(req.user.id);
    const userWithHash = await findUserByEmail(user.email);
    if (!await bcrypt.compare(currentPassword, userWithHash.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    await changePassword(req.user.id, await bcrypt.hash(newPassword, SALT_ROUNDS));
    await revokeUserSessions(req.user.id);
    await recordLoginEvent({ userId: req.user.id, action: 'password_changed', ipAddress: req.ip, userAgent: req.get('user-agent') });
    res.json({ message: 'Password changed. Sign in again with your new password.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password' });
  }
}

// Admin-only: creates individual staff accounts, replacing the single
// shared AnyDesk credential (R01/R02 in the risk register).
async function registerUser(req, res) {
  const { name, email, password, role } = req.body;

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Enter a valid name and email address' });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ error: 'Password must be 12-72 bytes long' });
  }

  try {
    const existing = await findUserByEmail(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
}

async function listUsers(req, res) {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function changeUserRole(req, res) {
  const userId = Number(req.params.id);
  const { role } = req.body;
  if (!Number.isInteger(userId) || userId < 1 || !ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: 'A valid user id and role are required' });
  }
  if (String(userId) === String(req.user.id) && role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin access' });
  }
  try {
    const target = await findUserById(userId);
    if (target?.is_active && target.role === 'admin' && role !== 'admin' && await getActiveAdminCount() <= 1) {
      return res.status(409).json({ error: 'At least one active admin account must remain' });
    }
    const user = await updateUserRole(userId, role);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
}

async function setUserStatus(req, res) {
  const userId = Number(req.params.id);
  const { isActive } = req.body;
  if (!Number.isInteger(userId) || userId < 1 || typeof isActive !== 'boolean' ||
      (String(userId) === String(req.user.id) && !isActive)) {
    return res.status(400).json({ error: 'A valid user id and active state are required; you cannot deactivate your own account' });
  }
  try {
    const target = await findUserById(userId);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!isActive && target.is_active && target.role === 'admin' && await getActiveAdminCount() <= 1) {
      return res.status(409).json({ error: 'At least one active admin account must remain' });
    }
    const user = await setUserActive(userId, isActive);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!isActive) await revokeUserSessions(userId);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update account status' });
  }
}

async function listLoginEvents(req, res) {
  try {
    res.json(await getLoginEvents());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch login events' });
  }
}

module.exports = { login, me, logout, registerUser, listUsers, changeUserRole, changeOwnPassword, setUserStatus, listLoginEvents };
