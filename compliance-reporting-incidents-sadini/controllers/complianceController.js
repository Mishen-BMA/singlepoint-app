const {
  createIncident,
  getAllIncidents,
  getIncidentsByUser,
  updateIncidentStatus
} = require('../models/incidentModel');

const ALLOWED_INCIDENT_TYPES = [
  'Suspicious Client Request',
  'Lost Device',
  'Policy Violation',
  'Suspicious Activity',
  'Other'
];

const ALLOWED_STATUSES = [
  'Pending',
  'Under Review',
  'Resolved'
];

async function submitIncident(req, res) {
  try {
    const {
      user_id,
      incident_type,
      title,
      description,
      reported_at
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        message: 'user_id is required'
      });
    }

    if (!incident_type) {
      return res.status(400).json({
        message: 'incident_type is required'
      });
    }

    if (!title) {
      return res.status(400).json({
        message: 'title is required'
      });
    }

    if (!description) {
      return res.status(400).json({
        message: 'description is required'
      });
    }

    if (!ALLOWED_INCIDENT_TYPES.includes(incident_type)) {
      return res.status(400).json({
        message: 'Invalid incident type'
      });
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
      userId: user_id,
      incidentType: incident_type,
      title: title.trim(),
      description: description.trim(),
      reportedAt: reported_at
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

    let incidents;

    if (user_id) {
      incidents = await getIncidentsByUser(user_id);
    } else {
      incidents = await getAllIncidents();
    }

    return res.status(200).json({
      incidents
    });

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

    const {
      status,
      reviewed_by
    } = req.body;

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

    if (!reviewed_by) {
      return res.status(400).json({
        message: 'reviewed_by is required'
      });
    }

    const incident = await updateIncidentStatus(
      id,
      status,
      reviewed_by
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