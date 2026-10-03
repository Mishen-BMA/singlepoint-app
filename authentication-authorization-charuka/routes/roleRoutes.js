const express = require('express');
const router = express.Router();
const { listRoles } = require('../controllers/authController');
const { requireUser } = require('../middleware/auth');

// Every authenticated user can read the role catalogue (labels, hierarchy
// levels) — it's needed for things like the "reports to" picker in the
// admin UI and is not sensitive.
router.get('/roles', requireUser, listRoles);

module.exports = router;
