const bcrypt = require('bcrypt');
const {
  findUserByEmail,
  findUserById,
  createUser,
  getAllUsers,
  updateUserRole
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
    if (!user) {
      // Same error for "no such user" and "wrong password" — don't leak
      // which one it was.
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = issueToken(user);
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
  // JWTs are stateless — there's nothing server-side to invalidate. This
  // endpoint exists so the frontend has a clean call to make; the real
  // logout is the client discarding its stored token.
  res.json({ message: 'Logged out' });
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
    const user = await updateUserRole(userId, role);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
}

module.exports = { login, me, logout, registerUser, listUsers, changeUserRole };
