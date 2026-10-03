const express = require('express');
const router = express.Router();
const { login, me, logout, registerUser, listUsers, changeUserRole, changeOwnPassword, setUserStatus, listLoginEvents } = require('../controllers/authController');
const { requireUser, requireSession, requireAdmin } = require('../middleware/auth');
const { requireManagerOrAdmin } = require('../middleware/auth');

router.post('/auth/login', login);
router.post('/auth/logout', requireSession, logout);
router.get('/auth/me', requireSession, me);
router.patch('/auth/password', requireUser, changeOwnPassword);
router.get('/auth/events', requireUser, requireManagerOrAdmin, listLoginEvents);

// Admin-only staff management — Section 5.1: individual accounts for every
// staff member, no self-registration.
router.post('/users', requireUser, requireAdmin, registerUser);
router.get('/users', requireUser, requireAdmin, listUsers);
router.patch('/users/:id/role', requireUser, requireAdmin, changeUserRole);
router.patch('/users/:id/active', requireUser, requireAdmin, setUserStatus);

module.exports = router;
