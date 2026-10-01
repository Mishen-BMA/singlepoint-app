const cors = require('cors');
const policyRoutes = require('./policy management - mishen/routes/policyRoutes');
const { initializePolicyTables } = require('./policy management - mishen/models/policyModel');
const authRoutes = require('./authentication-authorization-charuka/routes/authRoutes');
const { initializeUserTable } = require('./authentication-authorization-charuka/models/userModel');
const express = require('express');
const app = express();
const trainingRoutes = require('./security-training-awareness-nihara/routes/trainingRoutes');
const { initializeTrainingTables } = require('./security-training-awareness-nihara/models/trainingModel');

app.use(express.json()); // lets our server understand JSON sent from the frontend
app.use(cors());
app.use('/api', policyRoutes);
app.use('/api', authRoutes);
app.use('/api', trainingRoutes);

app.get('/', (req, res) => {
  res.send('SinglePoint API is running');
});

const PORT = process.env.PORT || 4000;

Promise.all([initializePolicyTables(), initializeUserTable(), initializeTrainingTables()])
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize policy tables:', error.message);
    process.exit(1);
  });