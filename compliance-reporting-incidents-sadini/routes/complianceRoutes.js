const express = require('express');
const {
  exportCsv,
  getMyReminders,
  getOverview,
  getTrends,
  sendReminder
} = require('../controllers/complianceReportingController');
const { requireUser, requireManagerOrAdmin } = require('../../authentication-authorization-charuka/middleware/auth');

const router = express.Router();

router.get('/overview', requireUser, requireManagerOrAdmin, getOverview);
router.get('/trends', requireUser, requireManagerOrAdmin, getTrends);
router.get('/export.csv', requireUser, requireManagerOrAdmin, exportCsv);
router.post('/reminders', requireUser, requireManagerOrAdmin, sendReminder);
router.get('/reminders/me', requireUser, getMyReminders);

module.exports = router;