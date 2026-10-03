const express = require('express');
const router = express.Router();
const {
  createPolicy,
  getAllPolicies,
  acknowledgePolicy,
  getAcknowledgementsForPolicy,
  updatePolicy,
  getComplianceStatus,
  getUserComplianceOverview,
  getGatePolicies,
  postGateDecision,
  getAcknowledgementHistoryForPolicy
} = require('../controllers/policyController');

const { requireUser, requireSession, requireAdmin, requireManagerOrAdmin } = require('../middleware/auth');

// Allow-listed: usable while the caller still has a pending gate policy.
router.get('/policies/gate', requireSession, getGatePolicies);
router.post('/policies/gate/decision', requireSession, postGateDecision);

router.post('/policies', requireUser, requireAdmin, createPolicy);
router.put('/policies/:id', requireUser, requireAdmin, updatePolicy);
router.get('/policies', requireUser, getAllPolicies);
router.post('/policies/acknowledge', requireUser, acknowledgePolicy);
router.get('/policies/:id/acknowledgements', requireUser, requireManagerOrAdmin, getAcknowledgementsForPolicy);
router.get('/policies/:id/acknowledgement-history', requireUser, requireAdmin, getAcknowledgementHistoryForPolicy);
router.get('/compliance/:policyId/:userId', requireUser, getComplianceStatus);
router.get('/compliance/:userId', requireUser, getUserComplianceOverview);

module.exports = router;
