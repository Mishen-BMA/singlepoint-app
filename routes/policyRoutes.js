const express = require('express');
const router = express.Router();
const {
  createPolicy,
  getAllPolicies,
  acknowledgePolicy,
  getAcknowledgementsForPolicy
} = require('../controllers/policyController');

router.post('/policies', createPolicy);
router.get('/policies', getAllPolicies);
router.post('/policies/acknowledge', acknowledgePolicy);
router.get('/policies/:id/acknowledgements', getAcknowledgementsForPolicy);

module.exports = router;