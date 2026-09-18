const bcrypt = require('bcrypt');
const {
  findUserByEmail,
  findUserById,
  createUser,
  getAllUsers
} = require('../models/userModel');
const { issueToken } = require('../middleware/auth');

const SALT_ROUNDS = 10;
const ALLOWED_ROLES = ['admin', 'manager', 'staff'];

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
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

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
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

module.exports = { login, me, logout, registerUser, listUsers };
