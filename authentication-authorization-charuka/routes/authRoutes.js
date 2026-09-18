const express = require('express');
const router = express.Router();
const { login, me, logout, registerUser, listUsers } = require('../controllers/authController');
const { requireUser, requireAdmin } = require('../middleware/auth');

router.post('/auth/login', login);
router.post('/auth/logout', requireUser, logout);
router.get('/auth/me', requireUser, me);

// Admin-only staff management — Section 5.1: individual accounts for every
// staff member, no self-registration.
router.post('/users', requireUser, requireAdmin, registerUser);
router.get('/users', requireUser, requireAdmin, listUsers);

module.exports = router;
