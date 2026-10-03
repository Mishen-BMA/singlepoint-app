const express = require('express');

const {
  submitIncident,
  getIncidents,
  changeIncidentStatus
} = require('../controllers/complianceController');
const { requireUser, requireManagerOrAdmin } = require('../../authentication-authorization-charuka/middleware/auth');

const router = express.Router();


// POST /api/incidents
// Staff submits a new incident
router.post('/', requireUser, submitIncident);


// GET /api/incidents
// Get incidents
// ?user_id=5 can be used to retrieve one user's incidents
router.get('/', requireUser, getIncidents);


// PATCH /api/incidents/:id
// Admin updates incident status
router.patch('/:id', requireUser, requireManagerOrAdmin, changeIncidentStatus);


module.exports = router;