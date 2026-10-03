const express = require('express');
const router = express.Router();
const {
  createPolicy,
  getAllPolicies,
  acknowledgePolicy,
  getAcknowledgementsForPolicy,
  updatePolicy,
  deletePolicy,
  getComplianceStatus,
  getUserComplianceOverview,
  getGatePolicies,
  postGateDecision,
  getAcknowledgementHistoryForPolicy,
  getPolicyAssignments,
  setPolicyAssignments
} = require('../controllers/policyController');

const { requireUser, requireSession } = require('../../authentication-authorization-charuka/middleware/auth');
const { requirePermission } = require('../../authentication-authorization-charuka/middleware/permissions');

// Allow-listed: usable while the caller still has a pending gate policy.
router.get('/policies/gate', requireSession, getGatePolicies);
router.post('/policies/gate/decision', requireSession, postGateDecision);

router.post('/policies', requireUser, requirePermission('policies.manage'), createPolicy);
router.put('/policies/:id', requireUser, requirePermission('policies.manage'), updatePolicy);
router.delete('/policies/:id', requireUser, requirePermission('policies.manage'), deletePolicy);
router.get('/policies', requireUser, requirePermission('policies.view_assigned'), getAllPolicies);
router.post('/policies/acknowledge', requireUser, requirePermission('policies.acknowledge'), acknowledgePolicy);
router.get('/policies/:id/acknowledgements', requireUser, requirePermission('policies.view_acknowledgements'), getAcknowledgementsForPolicy);
router.get('/policies/:id/acknowledgement-history', requireUser, requirePermission('policies.manage'), getAcknowledgementHistoryForPolicy);
router.get('/policies/:id/assignments', requireUser, requirePermission('roles.manage_assignments'), getPolicyAssignments);
router.put('/policies/:id/assignments', requireUser, requirePermission('roles.manage_assignments'), setPolicyAssignments);
router.get('/compliance/:policyId/:userId', requireUser, getComplianceStatus);
router.get('/compliance/:userId', requireUser, getUserComplianceOverview);

module.exports = router;
