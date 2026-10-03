const express = require('express');

const {
  submitIncident,
  getIncidents,
  changeIncidentStatus
} = require('../controllers/complianceController');
const { requireUser } = require('../../authentication-authorization-charuka/middleware/auth');
const { requirePermission } = require('../../authentication-authorization-charuka/middleware/permissions');

const router = express.Router();


// POST /api/incidents
// Staff submits a new incident
router.post('/', requireUser, requirePermission('incidents.submit'), submitIncident);


// GET /api/incidents
// Get incidents
// ?user_id=5 can be used to retrieve one user's incidents
router.get('/', requireUser, getIncidents);


// PATCH /api/incidents/:id
// Triages (admin/manager) update incident status
router.patch('/:id', requireUser, requirePermission('incidents.triage'), changeIncidentStatus);


module.exports = router;