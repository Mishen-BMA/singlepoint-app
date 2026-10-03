const express = require('express');
const router = express.Router();
const {
  login, me, logout, registerUser, listUsers, changeUserRole, changeUserReportsTo,
  changeOwnPassword, setUserStatus, listLoginEvents
} = require('../controllers/authController');
const { requireUser, requireSession } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

router.post('/auth/login', login);
router.post('/auth/logout', requireSession, logout);
router.get('/auth/me', requireSession, me);
router.patch('/auth/password', requireUser, changeOwnPassword);
router.get('/auth/events', requireUser, requirePermission('audit.view'), listLoginEvents);

// Admin-only staff management — Section 5.1: individual accounts for every
// staff member, no self-registration.
router.post('/users', requireUser, requirePermission('users.manage'), registerUser);
router.get('/users', requireUser, requirePermission('users.view_directory'), listUsers);
router.patch('/users/:id/role', requireUser, requirePermission('users.manage'), changeUserRole);
router.patch('/users/:id/reports-to', requireUser, requirePermission('users.manage'), changeUserReportsTo);
router.patch('/users/:id/active', requireUser, requirePermission('users.manage'), setUserStatus);

module.exports = router;
