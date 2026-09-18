const express = require('express');

const {
  submitIncident,
  getIncidents,
  changeIncidentStatus
} = require('../controllers/incidentController');

const router = express.Router();


// POST /api/incidents
// Staff submits a new incident
router.post('/', submitIncident);


// GET /api/incidents
// Get incidents
// ?user_id=5 can be used to retrieve one user's incidents
router.get('/', getIncidents);


// PATCH /api/incidents/:id
// Admin updates incident status
router.patch('/:id', changeIncidentStatus);


module.exports = router;