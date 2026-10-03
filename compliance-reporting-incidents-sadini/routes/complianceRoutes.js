const express = require('express');
const {
  exportCsv,
  getMyReminders,
  getOverview,
  getTrends,
  sendReminder
} = require('../controllers/complianceReportingController');
const { requireUser } = require('../../authentication-authorization-charuka/middleware/auth');
const { requirePermission } = require('../../authentication-authorization-charuka/middleware/permissions');

const router = express.Router();

// view_overview (manager/admin) or view_executive (ceo) — resolved inline in
// the controller since either grants read access here.
router.get('/overview', requireUser, getOverview);
router.get('/trends', requireUser, getTrends);
router.get('/export.csv', requireUser, requirePermission('compliance.export_csv'), exportCsv);
router.post('/reminders', requireUser, requirePermission('compliance.send_reminder'), sendReminder);
router.get('/reminders/me', requireUser, getMyReminders);

module.exports = router;