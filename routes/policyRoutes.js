const express = require('express');
const router = express.Router();
const {
  createPolicy,
  getAllPolicies,
  acknowledgePolicy,
  getAcknowledgementsForPolicy,
  updatePolicy,
  getComplianceStatus,
  getUserComplianceOverview
} = require('../controllers/policyController');

const { requireUser, requireAdmin } = require('../middleware/auth');

router.post('/policies', requireUser, requireAdmin, createPolicy);
router.put('/policies/:id', requireUser, requireAdmin, updatePolicy);
router.get('/policies', requireUser, getAllPolicies);
router.post('/policies/acknowledge', requireUser, acknowledgePolicy);
router.get('/policies/:id/acknowledgements', requireUser, requireAdmin, getAcknowledgementsForPolicy);
router.get('/compliance/:policyId/:userId', requireUser, getComplianceStatus);
router.get('/compliance/:userId', requireUser, getUserComplianceOverview);

module.exports = router;