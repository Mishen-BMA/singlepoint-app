require('./policy management - mishen/models/policyModel');
const cors = require('cors');
const policyRoutes = require('./policy management - mishen/routes/policyRoutes');
const express = require('express');
const app = express();

app.use(express.json()); // lets our server understand JSON sent from the frontend
app.use(cors());
app.use('/api', policyRoutes);

app.get('/', (req, res) => {
  res.send('SinglePoint API is running');
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});