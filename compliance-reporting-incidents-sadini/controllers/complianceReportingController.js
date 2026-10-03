const {
  createReminder,
  getComplianceSnapshots,
  getRemindersForUser,
  getStaffComplianceRows,
  saveComplianceSnapshot
} = require('../models/complianceModel');

async function getOverview(req, res) {
  try {
    const staff = await getStaffComplianceRows();
    const compliancePercentage = staff.length
      ? Math.round(staff.reduce((total, user) => total + user.compliancePercentage, 0) / staff.length)
      : 0;
    await saveComplianceSnapshot(compliancePercentage);

    res.json({
      compliancePercentage,
      staffCount: staff.length,
      compliantCount: staff.filter((user) => user.pendingItems === 0).length,
      pendingCount: staff.reduce((total, user) => total + user.pendingItems, 0),
      overdueCount: staff.reduce((total, user) => total + user.overdueItems, 0),
      staff
    });
  } catch (error) {
    console.error('Compliance overview failed:', error.message);
    res.status(500).json({ error: 'Failed to fetch compliance overview' });
  }
}

async function getTrends(req, res) {
  try {
    const staff = await getStaffComplianceRows();
    const compliancePercentage = staff.length
      ? Math.round(staff.reduce((total, user) => total + user.compliancePercentage, 0) / staff.length)
      : 0;
    await saveComplianceSnapshot(compliancePercentage);
    res.json(await getComplianceSnapshots());
  } catch (error) {
    console.error('Compliance trend query failed:', error.message);
    res.status(500).json({ error: 'Failed to fetch compliance trends' });
  }
}

async function exportCsv(req, res) {
  try {
    const staff = await getStaffComplianceRows();
    const rows = [
      ['Name', 'Email', 'Role', 'Policies acknowledged', 'Total policies', 'Training completed', 'Total training', 'Pending items', 'Compliance %'],
      ...staff.map((user) => [
        user.name,
        user.email,
        user.role,
        user.acknowledgedPolicies,
        user.totalPolicies,
        user.completedTraining,
        user.totalTraining,
        user.pendingItems,
        user.compliancePercentage
      ])
    ];
    const csv = rows.map((row) => row.map((value) => {
      const rawText = String(value ?? '');
      const text = /^[\s]*[=+@-]/.test(rawText) ? `'${rawText}` : rawText;
      return `"${text.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="singlepoint-compliance.csv"');
    res.send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('Compliance export failed:', error.message);
    res.status(500).json({ error: 'Failed to export compliance report' });
  }
}

async function sendReminder(req, res) {
  const recipientId = Number(req.body.userId);
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!Number.isInteger(recipientId) || recipientId < 1 || !message || message.length > 500) {
    return res.status(400).json({ error: 'A valid userId and message (up to 500 characters) are required' });
  }

  try {
    const reminder = await createReminder({
      recipientId,
      createdBy: req.user.id,
      message
    });
    res.status(201).json(reminder);
  } catch (error) {
    console.error('Compliance reminder failed:', error.message);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
}

async function getMyReminders(req, res) {
  try {
    res.json(await getRemindersForUser(req.user.id));
  } catch (error) {
    console.error('Reminder query failed:', error.message);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
}

module.exports = { getOverview, getTrends, exportCsv, sendReminder, getMyReminders };