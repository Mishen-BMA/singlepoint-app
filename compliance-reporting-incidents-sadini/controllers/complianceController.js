const {
  createIncident,
  getAllIncidents,
  getIncidentsByUser,
  updateIncidentStatus
} = require('../models/incidentModel');
const { scopeOf, assertInScope } = require('../../authentication-authorization-charuka/middleware/permissions');
const { getScopeUserIds } = require('../../authentication-authorization-charuka/models/scopeModel');

const ALLOWED_INCIDENT_TYPES = [
  'Suspicious Client Request',
  'Lost Device',
  'Policy Violation',
  'Suspicious Activity',
  'Other'
];

const ALLOWED_STATUSES = [
  'Open',
  'Investigating',
  'Resolved'
];
const ALLOWED_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

async function submitIncident(req, res) {
  try {
    const { incident_type, title, description, severity = 'Medium' } = req.body;

    if (typeof incident_type !== 'string' || !incident_type) {
      return res.status(400).json({
        message: 'incident_type is required'
      });
    }

    if (typeof title !== 'string' || !title) {
      return res.status(400).json({
        message: 'title is required'
      });
    }

    if (typeof description !== 'string' || !description) {
      return res.status(400).json({
        message: 'description is required'
      });
    }

    if (!ALLOWED_INCIDENT_TYPES.includes(incident_type)) {
      return res.status(400).json({
        message: 'Invalid incident type'
      });
    }
    if (!ALLOWED_SEVERITIES.includes(severity)) {
      return res.status(400).json({ message: 'Invalid incident severity' });
    }

    if (title.trim().length < 3) {
      return res.status(400).json({
        message: 'Title must contain at least 3 characters'
      });
    }

    if (description.trim().length < 10) {
      return res.status(400).json({
        message: 'Description must contain at least 10 characters'
      });
    }

    const incident = await createIncident({
      userId: req.user.id,
      incidentType: incident_type,
      title: title.trim(),
      description: description.trim(),
      severity
    });

    return res.status(201).json({
      message: 'Incident reported successfully',
      incident
    });

  } catch (error) {
    console.error('Submit incident error:', error);

    return res.status(500).json({
      message: 'Failed to submit incident'
    });
  }
}


async function getIncidents(req, res) {
  try {
    const { user_id } = req.query;

    if (user_id && String(user_id) !== String(req.user.id)) {
      const viewScope = await scopeOf(req.user, 'incidents.view_all');
      if (!viewScope) {
        return res.status(403).json({ message: 'You can only view your own incidents' });
      }
      req.permissionScope = viewScope;
      const inScope = await assertInScope(req, res, user_id);
      if (!inScope) return; // assertInScope already sent the 404
      const incidents = await getIncidentsByUser(user_id);
      return res.status(200).json({ incidents });
    }

    if (!user_id) {
      const viewScope = await scopeOf(req.user, 'incidents.view_all');
      if (viewScope) {
        const allowedIds = await getScopeUserIds(req.user, viewScope);
        const all = await getAllIncidents();
        const incidents = allowedIds
          ? all.filter((incident) => allowedIds.map(String).includes(String(incident.user_id)))
          : all;
        return res.status(200).json({ incidents });
      }
    }

    const incidents = await getIncidentsByUser(req.user.id);
    return res.status(200).json({ incidents });

  } catch (error) {
    console.error('Get incidents error:', error);

    return res.status(500).json({
      message: 'Failed to retrieve incidents'
    });
  }
}


async function changeIncidentStatus(req, res) {
  try {
    const { id } = req.params;

    const { status, severity } = req.body;

    if (!id) {
      return res.status(400).json({
        message: 'Incident ID is required'
      });
    }

    if (!status) {
      return res.status(400).json({
        message: 'Status is required'
      });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: 'Invalid incident status'
      });
    }
    if (severity !== undefined && !ALLOWED_SEVERITIES.includes(severity)) {
      return res.status(400).json({ message: 'Invalid incident severity' });
    }

    const incident = await updateIncidentStatus(
      id,
      status,
      severity || null,
      req.user.id
    );

    if (!incident) {
      return res.status(404).json({
        message: 'Incident not found'
      });
    }

    return res.status(200).json({
      message: 'Incident status updated successfully',
      incident
    });

  } catch (error) {
    console.error('Update incident error:', error);

    return res.status(500).json({
      message: 'Failed to update incident'
    });
  }
}


module.exports = {
  submitIncident,
  getIncidents,
  changeIncidentStatus
};