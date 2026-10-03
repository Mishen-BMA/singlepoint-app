require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const policyRoutes = require('./policy management - mishen/routes/policyRoutes');
const { initializePolicyTables, seedDefaultPolicies } = require('./policy management - mishen/models/policyModel');
const authRoutes = require('./authentication-authorization-charuka/routes/authRoutes');
const roleRoutes = require('./authentication-authorization-charuka/routes/roleRoutes');
const { initializeUserTable } = require('./authentication-authorization-charuka/models/userModel');
const { runMigrations, runAssignmentMigrations } = require('./models/migrations');
const express = require('express');
const app = express();
const trainingRoutes = require('./security-training-awareness-nihara/routes/trainingRoutes');
const { initializeTrainingTables } = require('./security-training-awareness-nihara/models/trainingModel');
const incidentRoutes = require('./compliance-reporting-incidents-sadini/routes/incidentRoutes');
const { initializeIncidentTable } = require('./compliance-reporting-incidents-sadini/models/incidentModel');
const complianceRoutes = require('./compliance-reporting-incidents-sadini/routes/complianceRoutes');
const { initializeComplianceTables } = require('./compliance-reporting-incidents-sadini/models/complianceModel');
const { getStaffComplianceRows, saveComplianceSnapshot } = require('./compliance-reporting-incidents-sadini/models/complianceModel');

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim());

app.set('trust proxy', 1);
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.status(403).json({ error: 'HTTPS is required' });
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: allowedOrigins,
  exposedHeaders: ['X-Auth-Token']
}));
app.use('/api/compliance', complianceRoutes);
app.use('/api', policyRoutes);
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api', authRoutes);
app.use('/api', roleRoutes);
app.use('/api', trainingRoutes);
app.use('/api/incidents', incidentRoutes);

app.get('/', (req, res) => {
  res.send('SinglePoint API is running');
});

const PORT = process.env.PORT || 4000;

async function startServer(port = PORT) {
  await initializeUserTable();
  await runMigrations();
  await initializePolicyTables();
  await seedDefaultPolicies();
  await initializeTrainingTables();
  await runAssignmentMigrations();
  await initializeIncidentTable();
  await initializeComplianceTables();
  await captureComplianceSnapshot();
  const snapshotTimer = setInterval(() => {
    captureComplianceSnapshot().catch((error) => console.error('Daily compliance snapshot failed:', error.message));
  }, 24 * 60 * 60 * 1000);
  snapshotTimer.unref();
  return app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

async function captureComplianceSnapshot() {
  const staff = await getStaffComplianceRows();
  const percentage = staff.length
    ? Math.round(staff.reduce((total, user) => total + user.compliancePercentage, 0) / staff.length)
    : 0;
  await saveComplianceSnapshot(percentage);
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to initialize database:', error.message);
    process.exit(1);
  });
}

module.exports = { app, startServer };